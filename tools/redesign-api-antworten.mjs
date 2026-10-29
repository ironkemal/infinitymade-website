/**
 * redesign-api-antworten.mjs — synthetische Backend-Antworten (/api/...) für Harness und Demo-Server.
 * Eigene Datei ohne Playwright-Abhängigkeit, damit tools/browser-probe/physio-demo/server.mjs
 * auch in einer frischen Kopie ohne node_modules startet (29.10.2026).
 */
export const API_ANTWORTEN = {
  '/api/startseite/tag': o => ({ status: 'ok', grund: null, minimumMin: 30, luecken: [{
    userId: o.rolle === 'employee' ? '10000000-0000-4000-8000-000000000002' : '10000000-0000-4000-8000-000000000001',
    freiMin: 60, intervalle: [{ von: '11:00', bis: '12:00' }],
    starts: ['11:00', '11:15', '11:30'].map(start => ({ start, serviceId: '10000000-0000-4000-8000-000000000020',
      businessId: null, dauerMin: 30, pufferMin: 0, rasterMin: 15, art: 'frei' }))
  }] }),
  '/api/startseite/woche': { status: 'ok', grund: null, gebuchtMin: 150, arbeitsMin: 1260, quote: 150 / 1260 },
  '/api/booking-request/list': { requests: [] },
  '/api/attendance/report': { records: [] },
  // V6.F03: Startseite-Geld (nur Inhaber; Angestellte bekämen 403 — das Frontend fragt sie gar nicht an).
  '/api/startseite/zusammenfassung': (o) => (o.rolle === 'employee' ? { bloecke: {} } : { bloecke: { geld: { status: 'ok', daten: {
    scope: 'mandant', monat: '2026-10',
    umfang: { patient: 'Kassiert diesen Monat (erfasst im Kassenbuch)' },
    kassiert: { patient: { bekanntCent: 184250, gesamtCent: 184250, unbekanntAnzahl: 0, gruende: [] },
      kasse: { bekanntCent: 412080, gesamtCent: 412080, unbekanntAnzahl: 0, gruende: [] } },
    offen: { zuzahlung: { bekanntCent: 8640, gesamtCent: null, unbekanntAnzahl: 1, gruende: ['PATIENT_SOLL_UNBEKANNT'],
      patientBekanntCent: 4620, kasseBekanntCent: 4020, klaerungBekanntCent: 0 },
      privat: { bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: null, gruende: ['PRIVAT_NICHT_GELADEN'] },
      ausfall: { bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: null, gruende: ['AUSFALL_NICHT_GELADEN'] } },
    anomalien: [] } }, mahnungen: { status: 'ok', daten: { scope: 'mandant',
      umfang: 'Bereits gemahnte Forderungen; höchste Stufe; aktueller belegter Rest',
      stufen: [
        { stufe: 1, anzahl: 2, bekanntAnzahl: 2, rest: { bekanntCent: 7500, gesamtCent: 7500, unbekanntAnzahl: 0 } },
        { stufe: 2, anzahl: null, bekanntAnzahl: 1, rest: { bekanntCent: 2500, gesamtCent: null, unbekanntAnzahl: 1 } },
        { stufe: 3, anzahl: 0, bekanntAnzahl: 0, rest: { bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0 } }
      ], anomalien: [] } }, abrechnung: { status: 'ok', daten: {
        bereit: { anzahl: 3, bekanntCent: 12345, gesamtCent: null, unbekanntAnzahl: 2,
          gruende: [{ code: 'BEFREIUNG_UNGEKLAERT', anzahl: 2 }, { code: 'HEILMITTEL_ZUORDNUNG_UNGEKLAERT', anzahl: 1 }] },
        abgesetzt: { anzahl: 4 }, teilabgesetzt: { anzahl: 1 }, scope: 'mandant', ungefaehr: true,
        quelle: 'prescriptions.abrechnung_status', umfang: 'praxisweit; Kassenanteil-Schätzung; kein Transaktionssnapshot'
      } } } }),
};
