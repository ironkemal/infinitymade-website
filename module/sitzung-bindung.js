/**
 * sitzung-bindung.js — Sitzungszeilen an einen gerade angelegten Termin binden.
 *
 * Warum es das gibt (Ops-Karte 42a66a3b)
 * ─────────────────────────────────────
 * Beim Speichern der Terminmaske hängte `dashboard.js` die vorgemerkten
 * Sitzungszeilen (`window._pendingRxSession`) an den neuen Termin. Der Fehlerfall
 * stand dort in genau einer Zeile:
 *
 *     if (linkErr) console.error('[rx session link]', linkErr);
 *
 * Danach lief der Ablauf weiter und meldete am Ende `showToast(t('saved'))`.
 * Die Praxis sah „gespeichert", der Termin existierte auch — nur hing keine
 * Einheit daran. Seit dem 17.08.2026 traf das jeden Kombi-Termin: zwei Einheiten
 * derselben Verordnung auf einem Termin verletzten den damaligen Index
 * `uniq_prescription_sessions_booking (prescription_id, booking_id)`, und weil
 * beide Zeilen in EINEM Statement geschrieben wurden (`.in('id', …)`), wurde
 * keine von beiden gebunden. Vier Wochen lang, ohne eine einzige Meldung.
 *
 * Der Index ist seit Migration 0017 um `heilmittel_index` erweitert und lässt
 * den Kombi-Termin zu. Diese Datei ist die zweite Hälfte der Antwort: sie
 * sorgt dafür, dass ein Fehlschlag — aus welchem Grund auch immer — sichtbar
 * wird. Eine Sperre, die man reparieren kann, ist harmlos; eine Sperre, die
 * schweigt, kostet die Abrechnung.
 *
 * Deshalb wird nicht nur `error` geprüft, sondern auch NACHGEZÄHLT. PostgREST
 * meldet keinen Fehler, wenn ein UPDATE null Zeilen trifft — die Zeile kann
 * inzwischen gelöscht, von jemand anderem gebunden oder durch RLS unsichtbar
 * sein. „Kein Fehler" heisst nicht „geschrieben".
 *
 * Kein `status: 'done'` hier. Gebunden heisst geplant; erbracht wird die Einheit
 * erst beim Abhaken (`handleTerminStarten`). Wer das zusammenzieht, baut einen
 * Kalender, der stimmt, und eine Abrechnung, die nicht stattgefunden hat.
 */

/**
 * Bindet Sitzungszeilen an einen Termin.
 *
 * @param {object} supabase
 * @param {string} bookingId
 * @param {string[]} sessionIds
 * @returns {Promise<{ok:boolean, gebunden:number, erwartet:number, fehlend:string[], meldung:string}>}
 */
export async function bindeSitzungenAnTermin(supabase, bookingId, sessionIds) {
  const ids = [...new Set((sessionIds || []).filter(Boolean))];
  const erwartet = ids.length;
  if (!supabase || !bookingId || !erwartet) {
    return { ok: true, gebunden: 0, erwartet: 0, fehlend: [], meldung: '' };
  }

  const { data, error } = await supabase
    .from('prescription_sessions')
    .update({ booking_id: bookingId, status: 'planned' })
    .in('id', ids)
    .select('id');

  if (error) {
    return {
      ok: false, gebunden: 0, erwartet, fehlend: ids,
      meldung: bindungsFehlerText({ erwartet, gebunden: 0, dbMeldung: error.message }),
    };
  }

  const geschrieben = new Set((data || []).map(r => r.id));
  const fehlend = ids.filter(id => !geschrieben.has(id));
  return {
    ok: fehlend.length === 0,
    gebunden: geschrieben.size,
    erwartet,
    fehlend,
    meldung: fehlend.length
      ? bindungsFehlerText({ erwartet, gebunden: geschrieben.size, dbMeldung: '' })
      : '',
  };
}

/**
 * Der Satz, den die Praxis liest. Ausgelagert, damit er prüfbar ist und nicht
 * in drei Varianten im Code herumliegt.
 *
 * Er sagt ausdrücklich, was TROTZDEM passiert ist (der Termin steht) — sonst
 * legt jemand ihn ein zweites Mal an und hat dann zwei.
 */
export function bindungsFehlerText({ erwartet, gebunden, dbMeldung }) {
  const rest = Math.max(0, erwartet - gebunden);
  const kopf = gebunden > 0
    ? `Termin gespeichert, aber nur ${gebunden} von ${erwartet} Einheiten konnten zugeordnet werden`
    : `Termin gespeichert, aber ${rest === 1 ? 'die Einheit' : `die ${rest} Einheiten`} der Verordnung ${rest === 1 ? 'konnte' : 'konnten'} NICHT zugeordnet werden`;
  const schwanz = ' — bitte im Verordnungs-Panel prüfen und von Hand zuordnen.';
  return kopf + schwanz + (dbMeldung ? ` (${dbMeldung})` : '');
}
