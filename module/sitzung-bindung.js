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

/**
 * Serie an eine Physio-Verordnung binden (29.10.2026, Physio-Demo PHY-03).
 *
 * Warum: Wählt der Empfang im Terminformular eine Verordnung und bucht eine Serie,
 * entstanden die Termine bisher OHNE Bezug zu den Sitzungszeilen — ein Einzeltermin
 * band dagegen seine Einheit. Verknüpft wurde nur über „Einheiten als Serie
 * verteilen“ (KI-Weg). Fachlich (physio + gkv-302, 29.10.2026): freie Sitzungen in
 * Datumsreihenfolge belegen, Überhang warnen statt blockieren, NIE Zeilen über die
 * verordnete Zahl hinaus anlegen (anders als linkBookingsToPrescriptionSessions).
 * Ausgeschlossen: Podologie (eigener Weg), abgeschlossene Verordnungen, Blanko ohne
 * Anzahl, abgelaufen ohne Behandlungsbeginn. Frequenz-/Fristprüfung bleiben wo sie sind.
 *
 * @param {object} supabase
 * @param {{prescriptionId:string, created:Array<{id:string,start_time?:string,date?:string}>, gleicheSitzungenAb:Function, heute?:string}} o
 * @returns {Promise<{ok:boolean, gebunden:number, ueberhang:number, meldung:string}>}
 */
export async function bindeSerieAnVerordnung(supabase, { prescriptionId, created, gleicheSitzungenAb, heute } = {}) {
  const termine = (created || []).filter((c) => c?.id)
    .sort((a, b) => String(a.start_time || a.date || '').localeCompare(String(b.start_time || b.date || '')));
  const nichts = (meldung = '') => ({ ok: true, gebunden: 0, ueberhang: 0, meldung });
  if (!supabase || !prescriptionId || !termine.length) return nichts();

  const { data: rx, error: rxFehler } = await supabase.from('prescriptions')
    .select('id, status, anzahl_einheiten, gueltig_bis, behandlungsbeginn, therapie_bereich')
    .eq('id', prescriptionId).maybeSingle();
  if (rxFehler || !rx) return { ok: false, gebunden: 0, ueberhang: termine.length, meldung: 'Termine gespeichert, aber die Verordnung war nicht lesbar — Einheiten bitte im Verordnungs-Panel zuordnen.' };
  if (rx.therapie_bereich === 'podo') return nichts();
  if (['completed', 'billed', 'cancelled'].includes(rx.status)) return nichts('Termine gespeichert. Die gewählte Verordnung ist abgeschlossen — es wurden keine Einheiten zugeordnet.');
  if (!Number.isInteger(rx.anzahl_einheiten) || rx.anzahl_einheiten <= 0) return nichts('Termine gespeichert. Die Verordnung nennt keine Anzahl Einheiten — bitte Einheiten von Hand zuordnen.');
  const tag = heute || new Date().toISOString().slice(0, 10);
  if (rx.gueltig_bis && rx.gueltig_bis < tag && !rx.behandlungsbeginn) return nichts('Termine gespeichert. Die Verordnung ist ohne Behandlungsbeginn abgelaufen — es wurden keine Einheiten zugeordnet.');

  if (typeof gleicheSitzungenAb === 'function') {
    await gleicheSitzungenAb({ supabase, prescriptionId, anzahlEinheiten: rx.anzahl_einheiten, status: rx.status });
  }
  const { data: freie, error: freiFehler } = await supabase.from('prescription_sessions')
    .select('id, session_number').eq('prescription_id', prescriptionId)
    .is('booking_id', null).eq('status', 'planned').order('session_number', { ascending: true });
  if (freiFehler) return { ok: false, gebunden: 0, ueberhang: termine.length, meldung: 'Termine gespeichert, aber die freien Einheiten waren nicht lesbar — bitte im Verordnungs-Panel zuordnen.' };

  let gebunden = 0;
  const fehler = [];
  const paare = Math.min(termine.length, (freie || []).length);
  for (let i = 0; i < paare; i++) {
    const r = await bindeSitzungenAnTermin(supabase, termine[i].id, [freie[i].id]);
    gebunden += r.gebunden;
    if (!r.ok) fehler.push(r.meldung);
  }
  const ueberhang = termine.length - gebunden;
  if (fehler.length) return { ok: false, gebunden, ueberhang, meldung: fehler[0] };
  const meldung = ueberhang > 0
    ? `${gebunden} von ${termine.length} Terminen mit der Verordnung verknüpft. ${ueberhang} ${ueberhang === 1 ? 'Termin bleibt' : 'Termine bleiben'} ohne Verordnung — Folgeverordnung nötig.`
    : '';
  return { ok: true, gebunden, ueberhang, meldung };
}
