/**
 * termin-heute.js — „wer ist heute im Haus?"
 *
 * Warum es das gibt
 * ─────────────────
 * Beta-2, 05.09.2026: Beim Erfassen einer neuen Verordnung stand der Patient,
 * der gerade auf dem Behandlungsstuhl sitzt, irgendwo mitten in einer
 * alphabetischen Liste. Die Praxis tippt den Namen — obwohl der Kalender seit
 * dem Morgen weiss, wer heute kommt. Das ist die teuerste Art, eine Information
 * zu erfragen, die das Programm schon hat.
 *
 * Diese Datei beantwortet genau eine Frage: hat dieser Patient heute einen
 * Termin, und um wie viel Uhr? Sie zeichnet nichts und verdrahtet nichts —
 * `patient-suche.js` holt sich daraus nur `rank` (nach oben) und `badgeOf`
 * (die Uhrzeit hinter dem Namen).
 *
 * Warum ein Modulzustand statt eines Rückgabewerts
 * ────────────────────────────────────────────────
 * `attachPatientSearch()` verdrahtet ein Feld genau EINMAL (dataset-Wächter).
 * Die Rezeptmaske wird aber immer wieder geöffnet, und „heute" ändert sich
 * dazwischen. Ein einmal übergebenes Array wäre am nächsten Morgen falsch.
 * Deshalb liegt der Index hier im Modul, die Masken rufen beim Öffnen
 * `heuteAktualisieren()`, und `heuteRang`/`heuteHinweis` lesen bei jedem
 * Tastendruck den frischen Stand.
 *
 * Grundregel bei Mehrdeutigkeit — dieselbe wie in termin-patient-bezug.js:
 * lieber nichts als falsch. Zwei Patienten mit demselben Namen ohne
 * `lead_id`/Telefon werden NICHT vorgeschlagen; ein falscher Vorschlag ist
 * schlimmer als gar keiner, weil er blind bestätigt wird.
 */

import { parseNameMitGeburt } from './termin-patient-bezug.js?v=20260817';

/** Termine, die den Patienten heute wirklich ins Haus bringen. */
const RELEVANTE_STATUS = ['confirmed', 'pending', 'completed'];

const nurZiffern = (s) => String(s || '').replace(/\D/g, '');

const leadName = (l) =>
  ([l?.first_name, l?.last_name].filter(Boolean).join(' ').trim() || l?.title || '').trim();

/** Uhrzeit eines Termins, wie sie in der Praxis gesprochen wird. */
export function uhrzeitBerlin(startTime) {
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  }).format(d);
}

/**
 * Tagesgrenzen in Berliner Zeit.
 *
 * ⛔ Nicht `toISOString().slice(0,10)` — das rutscht abends auf den Folgetag.
 * Dasselbe Muster steht in `loadScheduleBookings()` (dashboard.js:1732).
 */
export function tagesgrenzen(jetzt = new Date()) {
  const tag = jetzt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  return {
    tag,
    von: new Date(`${tag}T00:00:00`).toISOString(),
    bis: new Date(`${tag}T23:59:59`).toISOString(),
  };
}

/**
 * Baut den Nachschlage-Index aus den Terminen eines Tages.
 *
 * Rein und ohne Netz, damit er sich testen lässt.
 *
 * @param {Array} termine  Zeilen aus `bookings` (lead_id, customer_name,
 *                         customer_phone_normalized, start_time, status)
 * @param {Date}  [jetzt]  Bezugspunkt: bei mehreren Terminen gewinnt der,
 *                         der der Gegenwart am nächsten liegt.
 */
export function baueHeuteIndex(termine, jetzt = new Date()) {
  const index = { nachId: new Map(), nachTelefon: new Map(), nachName: new Map() };
  const namenIdentitaet = new Map();   // Namensschluessel -> wer dahinter steckt
  const namenMehrdeutig = new Set();
  const t0 = jetzt.getTime();

  // Näher an jetzt gewinnt: wer um 9:00 und um 16:00 kommt, soll um 15:50
  // nicht mit „Heute 09:00" beschriftet sein.
  const naeher = (alt, neu) =>
    !alt || Math.abs(new Date(neu).getTime() - t0) < Math.abs(new Date(alt).getTime() - t0);

  const setze = (karte, schluessel, startTime) => {
    if (!schluessel) return;
    if (naeher(karte.get(schluessel), startTime)) karte.set(schluessel, startTime);
  };

  for (const b of termine || []) {
    if (!b || !b.start_time) continue;
    if (b.status && !RELEVANTE_STATUS.includes(b.status)) continue;
    if (b.no_show) continue;

    setze(index.nachId, b.lead_id, b.start_time);
    setze(index.nachTelefon, nurZiffern(b.customer_phone_normalized || b.customer_phone), b.start_time);

    // Name ist der schwächste Schlüssel — nur brauchbar, solange er eindeutig
    // ist. Ein Doppelname wird bewusst komplett verworfen, nicht geraten.
    const { name, geburtsdatum } = parseNameMitGeburt(b.customer_name);
    if (!name) continue;
    const schluessel = `${name.toLowerCase()}|${geburtsdatum || ''}`;

    // Zwei Termine auf denselben Namen sind erst dann zwei Menschen, wenn
    // lead_id oder Telefonnummer sich unterscheiden. Zwei Termine desselben
    // Patienten am selben Tag sind der Normalfall und duerfen den Schluessel
    // nicht verbrennen.
    const identitaet = b.lead_id || nurZiffern(b.customer_phone_normalized || b.customer_phone) || '';
    const bekannt = namenIdentitaet.get(schluessel);
    if (bekannt !== undefined && bekannt !== identitaet) namenMehrdeutig.add(schluessel);
    else namenIdentitaet.set(schluessel, identitaet);

    setze(index.nachName, schluessel, b.start_time);
  }

  // Mehrdeutige Namen ganz entfernen — lieber kein Vorschlag als der falsche
  // Patient, der dann blind bestaetigt wird.
  for (const s of namenMehrdeutig) index.nachName.delete(s);
  return index;
}

/**
 * Termin dieses Patienten im Index — oder null.
 * Reihenfolge der Schlüssel = Verlässlichkeit: id → Telefon → Name.
 */
export function terminZuLead(index, lead) {
  if (!index || !lead) return null;
  if (lead.id && index.nachId.has(lead.id)) return index.nachId.get(lead.id);

  const tel = nurZiffern(lead.phone_normalized || lead.phone);
  if (tel && index.nachTelefon.has(tel)) return index.nachTelefon.get(tel);

  const name = leadName(lead).toLowerCase();
  if (!name) return null;
  // Erst mit Geburtsdatum (eindeutiger), dann ohne.
  const mitGeburt = index.nachName.get(`${name}|${lead.geburtsdatum || ''}`);
  return mitGeburt || index.nachName.get(`${name}|`) || null;
}

// ── Modulzustand ────────────────────────────────────────────────────────────
let _index = baueHeuteIndex([]);

/**
 * Holt die heutigen Termine und ersetzt den Index.
 *
 * Kein bizScope: der Vorschlag hebt nur Patienten an, die in der Liste des
 * Aufrufers ohnehin schon stehen — und die ist bizScope't. Ein Termin eines
 * fremden Standorts findet hier also keinen Patienten und bleibt wirkungslos.
 *
 * Wirft nie: ein fehlgeschlagener Vorschlag darf keine Maske aufhalten.
 */
export async function heuteAktualisieren(supabase, ownerId, jetzt = new Date()) {
  if (!supabase || !ownerId) return _index;
  const { von, bis } = tagesgrenzen(jetzt);
  try {
    const { data, error } = await supabase.from('bookings')
      .select('id,lead_id,customer_name,customer_phone_normalized,start_time,status,no_show')
      .eq('owner_id', ownerId)
      .gte('start_time', von).lte('start_time', bis)
      .neq('status', 'cancelled');
    if (error) throw error;
    _index = baueHeuteIndex(data || [], jetzt);
  } catch (e) {
    console.warn('[termin-heute] Heutige Termine nicht ladbar:', e);
  }
  return _index;
}

/** 1 = heute im Haus (nach oben), 0 = normal. Signatur passt auf `cfg.rank`. */
export function heuteRang(lead) {
  return terminZuLead(_index, lead) ? 1 : 0;
}

/** „Heute 14:30" hinter dem Namen — oder ''. Signatur passt auf `cfg.badgeOf`. */
export function heuteHinweis(lead) {
  const start = terminZuLead(_index, lead);
  return start ? `Heute ${uhrzeitBerlin(start)}` : '';
}

/**
 * Den Index verwerfen.
 *
 * Nach einem Standortwechsel zeigt er sonst noch die Termine des vorherigen
 * Standorts. Folgenlos bleibt das nur, solange der Aufrufer seine ohnehin
 * bizScope'te Patientenliste dagegenhaelt — verlassen sollte man sich darauf
 * nicht. Ausserdem der Weg, mit dem ein Test wieder bei null anfaengt.
 */
export function heuteZuruecksetzen() { _index = baueHeuteIndex([]); }
