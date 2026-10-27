// Physio/Ergo/Logo: erbrachte Sitzungen → abrechenbare Leistungszeilen.
//
// EINE Quelle für den §302-Mapper (abrechnung.routes.js, mapPrescriptionToDtaShape)
// und die Zuzahlungs-Druckwege (zuzahlung/erbrachte-sitzungen.js). Bis 27.10.2026
// kannten beide nur „eine Sitzung = eine Zeile rx.heilmittel_position"; ergänzendes
// Heilmittel und Hausbesuch-Pauschale wurden nie abgerechnet, Doppelbehandlung gab
// es nicht. Würden DTA und ZU-Beleg getrennt rechnen, zöge die Kasse eine
// Zuzahlung ab, die der Patient nie quittiert bekam.
//
// Regeln (gkv-302, wissensbank/SPEC-RULES.md „Physio: Zusatzpositionen", 26./27.10.2026):
//   • vorrangig: je Sitzung rx.heilmittel_position; Doppelbehandlung → Anzahl 2
//     (HeilM-RL §12 Abs. 8; Anlage 1 TP5 V21 §5.5.3.3: gleiche Position am selben
//     Tag in EINER EHE zusammenfassen).
//   • ergänzend: eigene Zeile am selben Tag, wenn die Sitzung ergaenzend_erbracht
//     trägt; nie doppelt. Höchstens ergaenzend_einheiten (bzw. vorrangige Einheiten).
//   • Hausbesuch: Pauschale je Tag, an dem der Termin tatsächlich ein Hausbesuch war
//     (bookings.hausbesuch) UND die Verordnung „Hausbesuch: ja" trägt (Anlage 2
//     B(4)/(5)). Ort → X9950 häuslich / X9951 soziale Einrichtung / X9922 Tages-,
//     Kurzzeitpflege, betreutes Wohnen. Ohne Ort (Altbestand) häuslich.

export const HAUSBESUCH_POSITION = Object.freeze({
  haeuslich: 'X9950',
  soziale_einrichtung: 'X9951',
  tagespflege_kurzzeit_betreut: 'X9922',
});

function fehler(msg, code) {
  const e = new Error(msg);
  e.status = 422; e.code = code;
  return e;
}

/**
 * @param {object} rx        prescriptions-Zeile (heilmittel_position, ergaenzend_position,
 *                           ergaenzend_einheiten, vorrangig_einheiten, anzahl_einheiten,
 *                           doppelbehandlung, hausbesuch, hausbesuch_ort, id)
 * @param {Array}  sessions  erbrachte Sitzungen, chronologisch: { id, done_at,
 *                           ergaenzend_erbracht?, bookings?: { hausbesuch? } }
 * @returns {Array<{ id:string, sessionId:string, done_at:string|null, code:string,
 *                   anzahl:number, art:'vorrangig'|'ergaenzend'|'hausbesuch', session:object }>}
 */
export function physioLeistungszeilen(rx, sessions) {
  const zeilen = [];
  const vorrangig = rx?.heilmittel_position || '';
  const anzahlVorrangig = rx?.doppelbehandlung ? 2 : 1;
  const ergMax = Number(rx?.ergaenzend_einheiten) || Number(rx?.vorrangig_einheiten) || Number(rx?.anzahl_einheiten) || Infinity;
  const hbOrt = HAUSBESUCH_POSITION[rx?.hausbesuch_ort] || HAUSBESUCH_POSITION.haeuslich;
  let ergAnzahl = 0;

  // Doppelbehandlung bei ungerader Menge: nie mehr Einheiten abrechnen als verordnet
  // (7 Einheiten → 2+2+2+1). gkv-302 27.10.2026: Höchstmenge wächst durch Doppel nicht.
  const verordnet = Number(rx?.vorrangig_einheiten) || Number(rx?.anzahl_einheiten) || Infinity;
  let verbraucht = 0;

  for (const s of sessions || []) {
    const basis = { sessionId: s.id, done_at: s.done_at || null, session: s };
    const anzahl = Math.max(1, Math.min(anzahlVorrangig, verordnet - verbraucht));
    verbraucht += anzahl;
    zeilen.push({ ...basis, id: s.id, code: vorrangig, anzahl, art: 'vorrangig' });

    if (s.ergaenzend_erbracht) {
      if (!rx?.ergaenzend_position) {
        throw fehler(`Verordnung ${String(rx?.id || '').slice(0, 8)}: ergänzendes Heilmittel erbracht, aber ohne Positionsnummer. ` +
          'Bitte in der Verordnung die Position des ergänzenden Heilmittels eintragen.', 'ERGAENZEND_POSITION_FEHLT');
      }
      ergAnzahl += 1;
      if (ergAnzahl > ergMax) {
        throw fehler(`Verordnung ${String(rx?.id || '').slice(0, 8)}: ergänzendes Heilmittel ${ergAnzahl}× erbracht, verordnet ${ergMax}×.`,
          'ERGAENZEND_UEBER_MENGE');
      }
      zeilen.push({ ...basis, id: `${s.id}:erg`, code: rx.ergaenzend_position, anzahl: 1, art: 'ergaenzend' });
    }

    // Hausbesuch ohne „ja" auf der Verordnung ist nicht abrechenbar — keine Zeile.
    if (rx?.hausbesuch && s.bookings?.hausbesuch) {
      zeilen.push({ ...basis, id: `${s.id}:hb`, code: hbOrt, anzahl: 1, art: 'hausbesuch' });
    }
  }
  return zeilen;
}
