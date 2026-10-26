/**
 * startseite-rechnen.js — reine Rechenfunktionen der Startseite „Heute“ (Redesign v2, PLAN-V2 V6.F).
 *
 * Kein DOM, kein Netz: alles hier ist mit `node --test` prüfbar. Daten holt module/startseite-neu.js.
 * Regeln aus backend-a-daten.md §2.1/2.3: abgesagte Termine, Blocker (services.is_internal) und
 * Gruppen-Kindtermine zählen nicht; Angestellte sehen nur eigene Termine.
 * „Erledigt“ wird hier bewusst NICHT aus bookings.status abgeleitet (wird nur nebenbei gesetzt,
 * kalender-kontextmenue.js:26) — die Liste kennt nur vorbei / läuft / offen nach der Uhr.
 */

/** Begrüßung nach Berliner Stunde (0–23); Grenzen wie greeting() in attendance.js:62. */
export function begruessung(stunde) {
  const h = Number(stunde);
  if (!Number.isFinite(h)) return 'Guten Tag';
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

const ms = (iso) => { const t = new Date(iso).getTime(); return Number.isNaN(t) ? null : t; };

/**
 * Heutige Termine für die Startseite: gefiltert, sortiert, mit Zustand nach der Uhr.
 * @param {Array} rohe  Zeilen aus bookings (start_time, end_time, status, user_id, group_parent_id, services{is_internal})
 * @param {{jetzt?: Date, uid?: string, nurEigene?: boolean}} o
 * @returns {Array} Kopien mit `zustand` ∈ 'vorbei' | 'laeuft' | 'offen'
 */
export function heutigeTermine(rohe, { jetzt = new Date(), uid = null, nurEigene = false } = {}) {
  const t = jetzt.getTime();
  return (Array.isArray(rohe) ? rohe : [])
    .filter((b) => b && b.status !== 'cancelled' && !b.group_parent_id && !b.services?.is_internal)
    .filter((b) => !nurEigene || (uid && b.user_id === uid))
    .filter((b) => ms(b.start_time) !== null)
    .map((b) => {
      const s = ms(b.start_time);
      const e = ms(b.end_time) ?? s;
      const zustand = e <= t ? 'vorbei' : s <= t ? 'laeuft' : 'offen';
      return { ...b, zustand };
    })
    .sort((a, b) => ms(a.start_time) - ms(b.start_time));
}

/** Als Nächstes = erster Termin, der noch nicht vorbei ist (läuft oder offen); dazu bis zu drei danach. */
export function alsNaechstes(liste, anzahlDanach = 3) {
  const i = (liste || []).findIndex((b) => b.zustand !== 'vorbei');
  if (i < 0) return { termin: null, danach: [] };
  return { termin: liste[i], danach: liste.slice(i + 1, i + 1 + anzahlDanach) };
}

/** Minuten bis zum Beginn (aufgerundet, nie negativ). */
export function minutenBis(startIso, jetzt = new Date()) {
  const s = ms(startIso);
  if (s === null) return null;
  return Math.max(0, Math.ceil((s - jetzt.getTime()) / 60000));
}

/** Kurztext für den Abstand: „läuft“, „in 15 Min“, „in 2 Std 5 Min“. */
export function abstandText(termin, jetzt = new Date()) {
  if (!termin) return '';
  if (termin.zustand === 'laeuft') return 'läuft';
  const m = minutenBis(termin.start_time, jetzt);
  if (m === null) return '';
  if (m < 60) return `in ${m} Min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `in ${h} Std ${r} Min` : `in ${h} Std`;
}

/** Dauer in Minuten (0, wenn unbekannt). */
export function dauerMin(termin) {
  const s = ms(termin?.start_time), e = ms(termin?.end_time);
  return s !== null && e !== null && e > s ? Math.round((e - s) / 60000) : 0;
}

/** Tageszeile: „13 Termine, davon 2 Hausbesuche“ / „1 Termin“ / „Keine Termine“. */
export function tageszeile(liste) {
  const n = (liste || []).length;
  if (!n) return 'Keine Termine';
  const hb = liste.filter((b) => b.hausbesuch).length;
  const basis = `${n} ${n === 1 ? 'Termin' : 'Termine'}`;
  return hb ? `${basis}, davon ${hb} ${hb === 1 ? 'Hausbesuch' : 'Hausbesuche'}` : basis;
}

/**
 * „Zu erledigen“: nur Zeilen mit Zahl > 0, in fester Reihenfolge (dringend zuerst).
 * Zahlen kommen aus dem, was die Praxis schon geladen hat; null/undefined = unbekannt → keine Zeile.
 */
export function zuErledigen({ anfragen, voUeberfaellig, voBald } = {}) {
  const zeilen = [];
  const zahl = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : 0);
  if (zahl(voUeberfaellig) > 0) zeilen.push({ id: 'vo-ueberfaellig', titel: 'Verordnung überfällig', text: 'Gültigkeit abgelaufen, bitte prüfen', zahl: zahl(voUeberfaellig), ton: 'bad', ziel: 'verordnungen' });
  if (zahl(voBald) > 0) zeilen.push({ id: 'vo-bald', titel: 'Verordnung läuft ab', text: 'in den nächsten 7 Tagen', zahl: zahl(voBald), ton: 'warn', ziel: 'verordnungen' });
  if (zahl(anfragen) > 0) zeilen.push({ id: 'anfragen', titel: 'Online-Anfragen', text: 'warten auf Antwort', zahl: zahl(anfragen), ton: 'info', ziel: 'anfragen' });
  return zeilen;
}

/**
 * Baut die Termin-Abfrage des Tages auf ein Supabase-Abfrageobjekt (rein, mit Doppel testbar).
 * Codex-Befund V6.F01 (26.10.2026): RLS lässt Angestellte Teamtermine derselben Praxis lesen
 * (SCHEMA-RLS bookings_owner_read / „Employees can view team bookings“). Deshalb filtert die
 * Abfrage für Angestellte schon auf user_id = eigene uid — keine Kollegentermine in der Antwort.
 * @returns {object|null} null = nicht abfragen (Rolle unbekannt oder uid fehlt)
 */
export function terminAbfrage(abfrage, { rolle, uid, ownerId, von, bisExklusiv } = {}) {
  if (!abfrage || !ownerId || !von || !bisExklusiv) return null;
  if (rolle !== 'owner' && rolle !== 'employee') return null;
  if (rolle === 'employee' && !uid) return null;
  let q = abfrage
    .select('id,user_id,lead_id,start_time,end_time,customer_name,status,hausbesuch,group_parent_id,services(title,is_internal)')
    .eq('owner_id', ownerId);
  if (rolle === 'employee') q = q.eq('user_id', uid);
  return q.gte('start_time', von).lt('start_time', bisExklusiv).neq('status', 'cancelled').order('start_time');
}
