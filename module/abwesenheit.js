/**
 * abwesenheit.js — Abwesenheiten (`time_offs`) für Wochen- und Monatsansicht.
 *
 * Warum es das gibt
 * ─────────────────
 * Den "Abwesend"-Hinweis gab es bisher nur in der Tagesansicht (dashboard.js,
 * renderDayView, seit 25.08.2026 als `.dv-absent`-Balken). Woche und Monat
 * lasen `time_offs` gar nicht — ein Mitarbeiter im Urlaub verschwand einfach
 * aus der Wochenübersicht, ohne dass sichtbar war, warum die Spalte leer blieb.
 * Rückmeldung 18.09.2026: Blocker-Buttons ("Pause"/"Privat"/"Fortbildung")
 * werden aus der Terminmaske entfernt, weil Abwesenheit schon über den
 * Mitarbeiter-Bereich (`time_offs`) läuft — dafür muss die aber überall im
 * Kalender sichtbar sein, nicht nur im Tag.
 *
 * Warum ein echter Tagesabgleich statt Datums-Slicing
 * ────────────────────────────────────────────────────
 * `start_date`/`end_date` sind timestamptz (db/SCHEMA.sql), aber die
 * schreibenden Stellen sind uneinheitlich: manche schreiben ein reines Datum
 * (→ 00:00 UTC), eine Stelle einen festen `+01:00`-Offset (rutscht im
 * Sommer). Ein Stringvergleich auf die ersten 10 Zeichen würde bei genau
 * diesen Einträgen den letzten Tag verlieren. Der Abgleich läuft deshalb über
 * echte `Date`-Objekte und den vollen Kalendertag (00:00–23:59:59) — dieselbe
 * Semantik, mit der die Tagesansicht schon lädt (dashboard.js: `dStart`/`dEnd`).
 *
 * Das Modul kennt weder `supabase` noch den Zustand des Kalenders — beides
 * kommt als Argument herein, wie bei `kalender-woche.js` / `kalender-monat.js`
 * (Konsey 2026-08-13: neuer Code kommt in ein eigenes Modul, `dashboard.js`
 * wächst nicht).
 */

/** Lädt alle Abwesenheiten der Mitarbeiter, die den Zeitraum [von, bis] schneiden. */
export async function ladeAbwesenheiten(supabase, { empIds, vonISO, bisISO }) {
  if (!empIds?.length) return [];
  const { data } = await supabase.from('time_offs')
    .select('employee_id,start_date,end_date,reason,note,type')
    .in('employee_id', empIds)
    .lte('start_date', bisISO)
    .gte('end_date', vonISO);
  return data || [];
}

/**
 * Trifft ein Abwesenheits-Eintrag den Kalendertag `tagISO` (YYYY-MM-DD)?
 *
 * Die Tagesgrenzen werden bewusst in UTC gebildet, nicht in der lokalen
 * Zeitzone des ausführenden Rechners/Browsers: ein reines Datum wie
 * "2026-09-10" wird von Postgres als 00:00 UTC gespeichert. Würde man die
 * Tagesgrenze hier lokal (z. B. Europe/Berlin, UTC+2) berechnen, verschiebt
 * sich der Vergleich um die Offset-Stunden und ein einzelner Tag wirkt einen
 * Tag zu lang — die Browser-Zeitzone des jeweiligen Rechners darf das Ergebnis
 * nicht verändern.
 */
function trifftTag(eintrag, tagISO) {
  const tagStart = new Date(`${tagISO}T00:00:00Z`).getTime();
  const tagEnd = new Date(`${tagISO}T23:59:59Z`).getTime();
  const von = new Date(eintrag.start_date).getTime();
  const bis = new Date(eintrag.end_date).getTime();
  return von <= tagEnd && bis >= tagStart;
}

/** Ist `empId` an `tagISO` abwesend? */
export function istAbwesend(abwesenheiten, empId, tagISO) {
  return (abwesenheiten || []).some(t => t.employee_id === empId && trifftTag(t, tagISO));
}

/** Alle Mitarbeiter-Ids, die an `tagISO` abwesend sind (ohne Duplikate). */
export function abwesendeMitarbeiterIds(abwesenheiten, tagISO) {
  return [...new Set((abwesenheiten || []).filter(t => trifftTag(t, tagISO)).map(t => t.employee_id))];
}

/** Anzeigetext für einen Eintrag: reason vor note vor Typ-Label. */
const TYP_LABEL = { urlaub: 'Urlaub', krank: 'Krank', frei: 'Frei', elternzeit: 'Elternzeit' };
export function abwesenheitsGrund(abwesenheiten, empId, tagISO) {
  const eintrag = (abwesenheiten || []).find(t => t.employee_id === empId && trifftTag(t, tagISO));
  if (!eintrag) return null;
  return eintrag.reason || eintrag.note || TYP_LABEL[eintrag.type] || 'Abwesend';
}
