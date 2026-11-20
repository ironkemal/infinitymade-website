/**
 * raum-plan.js — Raumlogik ohne DOM und ohne Datenbank (Physio/PILOT-PLAN.md M1/M2).
 *
 * Portiert aus der lokalen Demo (`tools/browser-probe/physio-demo/raeume.mjs`, Commit 7a28f4a0).
 * Pro Raum und Zeitraum zählt ein Termin. Teilnehmer:innen einer Gruppe teilen ihren Haupttermin.
 *
 * Termin = Zeile aus `bookings`, Raum = Zeile aus `rooms`. Zeiten als ISO-Text oder Millisekunden.
 */

export const RAUM_NAME_MAX = 80;
export const RAUM_PLAETZE_MAX = 99;

const NICHT_BELEGEND = new Set(['cancelled', 'no_show']);

export function raumName(wert) {
  const name = String(wert ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > RAUM_NAME_MAX) throw new Error(`Bitte einen Raumnamen mit 1–${RAUM_NAME_MAX} Zeichen eingeben.`);
  return name;
}

export function raumPlaetze(wert) {
  const zahl = wert === '' || wert == null ? 1 : Number(wert);
  if (!Number.isInteger(zahl) || zahl < 1 || zahl > RAUM_PLAETZE_MAX) throw new Error(`Bitte 1–${RAUM_PLAETZE_MAX} Plätze eingeben.`);
  return zahl;
}

export function raumNameFrei(raeume, name, { id = null, businessId = null } = {}) {
  const gesucht = raumName(name).toLocaleLowerCase('de');
  return !raeume.some(r => r.id !== id && (r.business_id ?? null) === businessId && r.name.toLocaleLowerCase('de') === gesucht);
}

/** Räume eines Standorts. Ohne Standort alle aktiven (Inhaber ohne `businesses`-Zeile). */
export function raeumeDesStandorts(raeume, businessId) {
  const aktiv = (raeume || []).filter(r => r.aktiv !== false);
  const passend = businessId ? aktiv.filter(r => r.business_id === businessId || r.business_id == null) : aktiv;
  return [...passend].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, 'de'));
}

function ms(zeit) {
  return typeof zeit === 'number' ? zeit : Date.parse(zeit);
}

function intervall(termin) {
  const start = ms(termin.start_time);
  const ende = ms(termin.end_time);
  return Number.isFinite(start) && Number.isFinite(ende) && ende > start ? { start, ende } : null;
}

/** Zählt für die Belegung: nicht abgesagt, gültige Zeit, und je Gruppe nur der Elterntermin. */
export function terminZaehlt(termin) {
  return !NICHT_BELEGEND.has(termin.status) && !termin.group_parent_id && intervall(termin) !== null;
}

/** Termine, die den Raum im halboffenen Intervall [start, ende) belegen. */
export function belegungen(raumId, termine, start, ende, { ohneTerminId = null } = {}) {
  const von = ms(start);
  const bis = ms(ende);
  return (termine || []).filter(t => {
    if (t.room_id !== raumId || t.id === ohneTerminId || !terminZaehlt(t)) return false;
    const zeit = intervall(t);
    return zeit.start < bis && zeit.ende > von;
  });
}

/**
 * Ein Raum ist durch einen Haupttermin belegt. Die Buchungssperre setzt der Datenbanktrigger durch.
 */
export function raumKonflikt(raum, termine, start, ende, optionen = {}) {
  const konflikte = belegungen(raum.id, termine, start, ende, optionen);
  return { voll: konflikte.length > 0, konflikte };
}

/** Für die Raumwahl: jeder Raum mit `voll` und Anzahl überlappender Termine. Freie zuerst. */
export function raumAuswahl(raeume, termine, start, ende, optionen = {}) {
  return raeume
    .map(raum => {
      const { voll, konflikte } = raumKonflikt(raum, termine, start, ende, optionen);
      return { raum, voll, belegt: konflikte.length };
    })
    .sort((a, b) => Number(a.voll) - Number(b.voll));
}

/**
 * Belegung jetzt: je Raum die laufenden Termine, dazu die laufenden Termine ohne Raum.
 * Ohne die zweite Zahl stünde ein Raum auf „frei", obwohl dort ein online gebuchter Patient liegt.
 */
export function belegungJetzt(raeume, termine, jetzt) {
  const zeitpunkt = ms(jetzt);
  const laufend = (termine || []).filter(t => {
    if (!terminZaehlt(t)) return false;
    const zeit = intervall(t);
    return zeit.start <= zeitpunkt && zeit.ende > zeitpunkt;
  });
  const raumIds = new Set(raeume.map(r => r.id));
  return {
    raeume: raeume.map(raum => {
      const hier = laufend.filter(t => t.room_id === raum.id);
      const restMs = hier.reduce((max, t) => Math.max(max, intervall(t).ende - zeitpunkt), 0);
      return { raum, termine: hier, voll: hier.length > 0, restMinuten: Math.ceil(restMs / 60000) };
    }),
    ohneRaum: laufend.filter(t => !t.room_id || !raumIds.has(t.room_id)).length,
  };
}
