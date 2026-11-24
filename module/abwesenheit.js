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

import { berlinTagesgrenzen } from './berlin-datum.js';

/**
 * @typedef {{ employee_id: string, start_date: string, end_date: string, reason?: string | null, note?: string | null, type?: string | null }} AbwesenheitEintrag
 */

/**
 * Lädt alle Abwesenheiten der Mitarbeiter, die den Zeitraum [von, bis] schneiden.
 * @param {any} supabase
 * @param {{ empIds: string[], vonISO: string, bisISO: string }} params
 * @returns {Promise<AbwesenheitEintrag[]>}
 */
export async function ladeAbwesenheiten(supabase, { empIds, vonISO, bisISO }) {
  if (!empIds?.length) return [];
  const brauchtTeamRpc = empIds.some(id => !grundSichtbar(id));
  if (brauchtTeamRpc && typeof supabase?.rpc === 'function') {
    const { data: teamRows, error: rpcErr } = await supabase.rpc('team_abwesenheiten', {
      p_von: vonISO,
      p_bis: bisISO,
    });
    if (!rpcErr && Array.isArray(teamRows)) {
      const zielSet = new Set(empIds);
      const eigeneIds = empIds.filter(id => grundSichtbar(id));
      /** @type {AbwesenheitEintrag[]} */
      let eigeneZeilen = [];
      if (eigeneIds.length) {
        const { data: ownData } = await supabase.from('time_offs')
          .select('id,employee_id,start_date,end_date,reason,note,type')
          .in('employee_id', eigeneIds)
          .lte('start_date', bisISO)
          .gte('end_date', vonISO);
        eigeneZeilen = ownData || [];
      }
      const eigeneSet = new Set(eigeneIds);
      const kollegenZeilen = teamRows.filter(
        /** @param {AbwesenheitEintrag} r */
        r => zielSet.has(r.employee_id) && !eigeneSet.has(r.employee_id)
      );
      return [...eigeneZeilen, ...kollegenZeilen];
    }
  }
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
 *
 * @param {AbwesenheitEintrag} eintrag
 * @param {string} tagISO
 * @returns {boolean}
 */
function trifftTag(eintrag, tagISO) {
  const tagStart = new Date(`${tagISO}T00:00:00Z`).getTime();
  const tagEnd = new Date(`${tagISO}T23:59:59Z`).getTime();
  const von = new Date(eintrag.start_date).getTime();
  const bis = new Date(eintrag.end_date).getTime();
  return von <= tagEnd && bis >= tagStart;
}

/**
 * Ist `empId` an `tagISO` abwesend?
 * @param {AbwesenheitEintrag[] | null | undefined} abwesenheiten
 * @param {string} empId
 * @param {string} tagISO
 * @returns {boolean}
 */
export function istAbwesend(abwesenheiten, empId, tagISO) {
  return (abwesenheiten || []).some(t => t.employee_id === empId && trifftTag(t, tagISO));
}

/**
 * Alle Mitarbeiter-Ids, die an `tagISO` abwesend sind (ohne Duplikate).
 * @param {AbwesenheitEintrag[] | null | undefined} abwesenheiten
 * @param {string} tagISO
 * @returns {string[]}
 */
export function abwesendeMitarbeiterIds(abwesenheiten, tagISO) {
  return [...new Set((abwesenheiten || []).filter(t => trifftTag(t, tagISO)).map(t => t.employee_id))];
}

// Kollegen sehen nur „Abwesend": Krankheit ist ein Gesundheitsdatum (legal-de, 31.10.2026).
// Nur Anzeige. Die Lesegrenze in der Datenbank ist ein eigener Schritt (Physio/PLANUNG-UMSETZUNG.md).
let grundSichtbar = (/** @type {string} */ _empId) => true;
/** @param {(empId: string) => boolean} pruefe */
export function setzeGrundSichtbar(pruefe) {
  grundSichtbar = pruefe;
}

/** Anzeigetext für einen Eintrag: reason vor note vor Typ-Label. */
/** @type {Record<string, string>} */
const TYP_LABEL = { urlaub: 'Urlaub', krank: 'Krank', frei: 'Frei', elternzeit: 'Elternzeit' };

/**
 * @param {AbwesenheitEintrag[] | null | undefined} abwesenheiten
 * @param {string} empId
 * @param {string} tagISO
 * @returns {string | null}
 */
export function abwesenheitsGrund(abwesenheiten, empId, tagISO) {
  const eintrag = (abwesenheiten || []).find(t => t.employee_id === empId && trifftTag(t, tagISO));
  if (!eintrag) return null;
  if (!grundSichtbar(empId)) return 'Abwesend';
  return eintrag.reason || eintrag.note || TYP_LABEL[eintrag.type || ''] || 'Abwesend';
}

// Eine Abwesenheit gilt einschließlich Endtag. Nur die Zahl betroffener Termine laden.
/** @param {{supabase:any,ownerId:string,empId:string,von:string,bis:string,
 * showToast:(meldung:string,art:string)=>void,showConfirmModal:(optionen:object)=>Promise<boolean>|boolean}} deps */
export async function abwesenheitFreigeben({ supabase, ownerId, empId, von, bis, showToast, showConfirmModal }) {
  const start = berlinTagesgrenzen(von), ende = berlinTagesgrenzen(bis);
  if (!start || !ende || !empId || bis < von) {
    showToast('Bitte Mitarbeiter:in und gültigen Zeitraum wählen. Das Ende darf nicht vor dem Beginn liegen.', 'error');
    return false;
  }
  try {
    const { count, error } = await supabase.from('bookings').select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId).eq('user_id', empId).in('status', ['confirmed','pending']).is('group_parent_id', null)
      .lt('start_time', ende.bisExklusiv).gt('end_time', start.von);
    if (error || count == null) throw new Error();
    if (!count) return true;
    const bestaetigt = await showConfirmModal({
      title: 'Geplante Termine im Zeitraum',
      message: count + (count === 1 ? ' Termin überschneidet sich' : ' Termine überschneiden sich')
        + ' mit der Abwesenheit. Nach dem Speichern öffnet sich der Umplanungs-Assistent für Vertretung & Anrufliste.',
      confirmText: 'Abwesenheit eintragen & Termine planen',
      cancelText: 'Zeitraum ändern',
      variant: 'warning',
    });
    if (bestaetigt && typeof document !== 'undefined') {
      // Kurz nach dem Rückgabewert öffnen, damit der Aufrufer den time_offs-Eintrag
      // zuerst speichert und sein Eingabe-Modal sauber schließt (kein dashboard.js-Wachstum).
      setTimeout(() => {
        import('./abwesenheit-termine.js?v=20261124c2')
          .then(({ oeffneAbwesenheitAssistent }) => oeffneAbwesenheitAssistent({
            supabase, ownerId, empId, von, bis, showToast, showConfirmModal,
          }))
          .catch(() => {});
      }, 220);
    }
    return !!bestaetigt;
  } catch {
    showToast('Termine konnten nicht geprüft werden. Bitte erneut versuchen.', 'error');
    return false;
  }
}
