import test from 'node:test';
import assert from 'node:assert/strict';
import {
  baueZuBelegZeile,
  zuDruckDaten,
  zuBelegVeraltet,
  baueGegenbeleg,
} from './zu-beleg.js';

test('baueZuBelegZeile: erzeugt INSERT-Objekt mit korrekten Pflichtfeldern und OHNE Nummer/Datum', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const rx = {
    id: '22222222-2222-2222-2222-222222222222',
    patient_id: '33333333-3333-3333-3333-333333333333',
    heilmittel: 'Podologische Komplexbehandlung',
    leads: {
      first_name: 'Erika',
      last_name: 'Mustermann',
      street: 'Musterweg 1',
      plz: '53721',
      city: 'Siegburg',
      geburtsdatum: '1965-04-12',
      versichertennummer: 'A123456789',
      krankenkasse: 'AOK Rheinland',
    },
  };
  const praxisDruck = {
    name: 'Praxis für Podologie',
    strasse: 'Hauptstr. 10',
    plz_ort: '53721 Siegburg',
    telefon: '02241 123456',
    ik: '123456789',
    steuernummer: '220/123/4567',
    ust_id: 'DE123456789',
  };
  const patientDruck = {
    vorname: 'Erika',
    nachname: 'Mustermann',
    strasse: 'Musterweg 1',
    plz: '53721',
    ort: 'Siegburg',
    geburtsdatum: '1965-04-12',
    kvnr: 'A123456789',
  };
  const verordnungDruck = {
    ausstellungsdatum: '2026-09-15',
    krankenkasse: 'AOK Rheinland',
    arzt: 'Dr. Med. Schmidt',
  };
  const printSessions = [
    {
      session_id: 's-1',
      datum: '2026-10-01',
      position: '78010',
      bezeichnung: 'Podologische Komplexbehandlung',
      brutto: 45.0,
      zuzahlung: 4.5,
    },
    {
      session_id: 's-2',
      datum: '2026-10-08',
      position: '78010',
      bezeichnung: 'Podologische Komplexbehandlung',
      brutto: 45.0,
      zuzahlung: 4.5,
    },
  ];
  const totals = {
    brutto: 90.0,
    prozZuzahlung: 9.0,
    pauschZuzahlung: 10.0,
    gesZuzahlung: 19.0,
  };

  const zeile = baueZuBelegZeile({
    tenantId,
    rx,
    praxisDruck,
    patientDruck,
    verordnungDruck,
    printSessions,
    totals,
    zahlungszielTage: 14,
    hinweisText: 'Hinweis gesetzliche Zuzahlung',
    invoiceFooterText: 'Danke für Ihr Vertrauen',
    logoUrl: 'https://example.com/logo.png',
    bankverbindung: 'IBAN: DE123456789',
  });

  // Trigger-Vergabe: diese Felder dürfen im INSERT NICHT existieren!
  assert.equal(zeile.invoice_number, undefined, 'invoice_number darf nicht im INSERT sein');
  assert.equal(zeile.rechnung_nr, undefined, 'rechnung_nr darf nicht im INSERT sein');
  assert.equal(zeile.issued_at, undefined, 'issued_at darf nicht im INSERT sein');
  assert.equal(zeile.lead_id, undefined, 'lead_id darf nicht im INSERT sein (nur patient_id)');

  // Status & Typ
  assert.equal(zeile.owner_id, tenantId);
  assert.equal(zeile.patient_id, rx.patient_id);
  assert.equal(zeile.prescription_id, rx.id);
  assert.equal(zeile.verordnung_id, null);
  assert.equal(zeile.patient_name, 'Erika Mustermann');
  assert.equal(zeile.invoice_type, 'zuzahlung');
  assert.equal(zeile.status, 'sent');
  assert.equal(zeile.payment_status, 'pending');

  // Beträge & Zeitraum
  assert.equal(zeile.subtotal, 90.0);
  assert.equal(zeile.kassenzuzahlung, 19.0);
  assert.equal(zeile.total_patient, 19.0);
  assert.equal(zeile.leistung_von, '2026-10-01');
  assert.equal(zeile.leistung_bis, '2026-10-08');

  // line_items Struktur
  assert.equal(zeile.line_items.length, 2);
  assert.equal(zeile.line_items[0].session_id, 's-1');
  assert.equal(zeile.line_items[0].datum, '2026-10-01');
  assert.equal(zeile.line_items[0].brutto, 45.0);
  assert.equal(zeile.line_items[0].zuzahlung, 4.5);
  assert.equal(zeile.line_items[0].unit_price, 45.0);
  assert.equal(zeile.line_items[0].price, 45.0);
  assert.equal(zeile.line_items[0].quantity, 1);

  // Snapshots
  assert.equal(zeile.aussteller_snapshot.v, 1);
  assert.equal(zeile.aussteller_snapshot.zu.zahlungszielTage, 14);
  assert.equal(zeile.aussteller_snapshot.zu.bankverbindung, 'IBAN: DE123456789');
  assert.equal(zeile.aussteller_snapshot.zu.hinweisText, 'Hinweis gesetzliche Zuzahlung');
  assert.equal(zeile.empfaenger_snapshot.v, 1);
  assert.equal(zeile.empfaenger_snapshot.art, 'patient');
  assert.equal(zeile.empfaenger_snapshot.name, 'Erika Mustermann');
  assert.deepEqual(zeile.empfaenger_snapshot.zu.totals, totals);
});

test('Rundreise: baueZuBelegZeile -> simulate DB -> zuDruckDaten liefert identische Druckwerte', () => {
  const tenantId = 't-1';
  const rx = { id: 'rx-1', patient_id: 'p-1', patient_name: 'Hans Peter' };
  const praxisDruck = {
    name: 'Praxis Podologie',
    strasse: 'Talstr. 5',
    plz_ort: '53721 Siegburg',
    telefon: '02241 9999',
    ik: '999888777',
    steuernummer: '220/111',
    ust_id: 'DE999',
  };
  const patientDruck = {
    vorname: 'Hans',
    nachname: 'Peter',
    strasse: 'Waldweg 2',
    plz: '53721',
    ort: 'Siegburg',
    geburtsdatum: '1980-01-01',
    kvnr: 'K123',
  };
  const verordnungDruck = {
    ausstellungsdatum: '2026-10-01',
    krankenkasse: 'Barmer',
    arzt: 'Dr. Test',
  };
  const printSessions = [
    { session_id: 's-1', datum: '2026-10-02', position: '78010', bezeichnung: 'Behandlung', brutto: 40.0, zuzahlung: 4.0 },
  ];
  const totals = { brutto: 40.0, prozZuzahlung: 4.0, pauschZuzahlung: 10.0, gesZuzahlung: 14.0 };

  const insertObj = baueZuBelegZeile({
    tenantId,
    rx,
    praxisDruck,
    patientDruck,
    verordnungDruck,
    printSessions,
    totals,
    zahlungszielTage: 21,
    hinweisText: 'Mein Hinweistext',
    invoiceFooterText: 'Mein Footer',
    logoUrl: 'https://logo.url/logo.png',
    bankverbindung: 'Bank X, IBAN: DE99',
  });

  // DB-Simulation: Trigger setzt id, invoice_number und issued_at
  const dbRow = {
    ...insertObj,
    id: 'inv-uuid-1',
    invoice_number: 'ZU-2026-0042',
    issued_at: '2026-10-10',
  };

  const druck = zuDruckDaten(dbRow);

  assert.deepEqual(druck.praxis, praxisDruck);
  assert.deepEqual(druck.patient, patientDruck);
  assert.deepEqual(druck.verordnung, verordnungDruck);
  assert.deepEqual(druck.sessions, printSessions);
  assert.deepEqual(druck.totals, totals);
  assert.equal(druck.bankverbindung, 'Bank X, IBAN: DE99');
  assert.equal(druck.logoUrl, 'https://logo.url/logo.png');
  assert.equal(druck.invoiceFooterText, 'Mein Footer');
  assert.equal(druck.hinweisText, 'Mein Hinweistext');

  assert.equal(druck.rechnung.nummer, 'ZU-2026-0042');
  assert.equal(druck.rechnung.datum, '2026-10-10');
  // 2026-10-10 + 21 Tage = 2026-10-31
  const faellig = new Date(druck.rechnung.faelligkeit);
  assert.equal(faellig.getFullYear(), 2026);
  assert.equal(faellig.getMonth(), 9); // Oktober = 9 (0-indexed)
  assert.equal(faellig.getDate(), 31);
});

test('zuBelegVeraltet: erkennt Änderungen der Sitzungsmenge oder des Betrags', () => {
  const row = {
    kassenzuzahlung: 14.0,
    line_items: [
      { session_id: 's-1', brutto: 40.0, zuzahlung: 4.0 },
    ],
  };

  // 1. Gleich -> false
  assert.equal(
    zuBelegVeraltet(row, {
      printSessions: [{ session_id: 's-1', brutto: 40.0, zuzahlung: 4.0 }],
      totals: { gesZuzahlung: 14.0 },
    }),
    false,
    'Gleiche Sitzungen und Betrag dürfen nicht als veraltet gelten'
  );

  // 2. Neue Sitzung -> true
  assert.equal(
    zuBelegVeraltet(row, {
      printSessions: [
        { session_id: 's-1', brutto: 40.0, zuzahlung: 4.0 },
        { session_id: 's-2', brutto: 40.0, zuzahlung: 4.0 },
      ],
      totals: { gesZuzahlung: 18.0 },
    }),
    true,
    'Zusätzliche Sitzung muss als veraltet erkannt werden'
  );

  // 3. Andere Sitzung bei gleicher Anzahl -> true
  assert.equal(
    zuBelegVeraltet(row, {
      printSessions: [{ session_id: 's-other', brutto: 40.0, zuzahlung: 4.0 }],
      totals: { gesZuzahlung: 14.0 },
    }),
    true,
    'Veränderte Sitzungs-ID muss als veraltet erkannt werden'
  );

  // 4. Gleiche Sitzungen, aber Betrag geändert (z. B. Befreiung oder Tarifänderung) -> true
  assert.equal(
    zuBelegVeraltet(row, {
      printSessions: [{ session_id: 's-1', brutto: 40.0, zuzahlung: 0.0 }],
      totals: { gesZuzahlung: 0.0 },
    }),
    true,
    'Geänderter Zuzahlungsbetrag muss als veraltet erkannt werden'
  );

  // 5. row ist null/undefined -> true
  assert.equal(zuBelegVeraltet(null, {}), true);
});

test('baueGegenbeleg: negiert alle Beträge, verweist auf storno_von und enthält keine Nummer/Datum', () => {
  const orig = {
    id: 'orig-inv-id',
    owner_id: 'owner-1',
    patient_id: 'pat-1',
    prescription_id: 'rx-1',
    patient_name: 'Max Mustermann',
    invoice_number: 'ZU-2026-0010',
    rechnung_nr: 10,
    issued_at: '2026-10-05',
    subtotal: 100.0,
    kassenzuzahlung: 20.0,
    total_patient: 20.0,
    line_items: [
      {
        title: 'Komplexbehandlung',
        quantity: 1,
        unit_price: 50.0,
        price: 50.0,
        session_id: 's-1',
        datum: '2026-10-01',
        brutto: 50.0,
        zuzahlung: 5.0,
      },
      {
        title: 'Komplexbehandlung',
        quantity: 1,
        unit_price: 50.0,
        price: 50.0,
        session_id: 's-2',
        datum: '2026-10-03',
        brutto: 50.0,
        zuzahlung: 5.0,
      },
    ],
    aussteller_snapshot: { v: 1, name: 'Praxis' },
    empfaenger_snapshot: { v: 1, name: 'Max' },
    leistung_von: '2026-10-01',
    leistung_bis: '2026-10-03',
  };

  const gegen = baueGegenbeleg(orig);

  assert.equal(gegen.owner_id, 'owner-1');
  assert.equal(gegen.patient_id, 'pat-1');
  assert.equal(gegen.prescription_id, 'rx-1');
  assert.equal(gegen.patient_name, 'Max Mustermann');
  assert.equal(gegen.invoice_type, 'zuzahlung');
  assert.equal(gegen.status, 'sent');
  assert.equal(gegen.storno_von, 'orig-inv-id');
  assert.equal(gegen.notes, 'Storno zu ZU-2026-0010');

  // Beträge müssen alle negiert sein!
  assert.equal(gegen.subtotal, -100.0);
  assert.equal(gegen.kassenzuzahlung, -20.0);
  assert.equal(gegen.total_patient, -20.0);

  assert.equal(gegen.line_items.length, 2);
  assert.equal(gegen.line_items[0].unit_price, -50.0);
  assert.equal(gegen.line_items[0].price, -50.0);
  assert.equal(gegen.line_items[0].brutto, -50.0);
  assert.equal(gegen.line_items[0].zuzahlung, -5.0);

  // Keine invoice_number / rechnung_nr / issued_at im INSERT!
  assert.equal(gegen.invoice_number, undefined);
  assert.equal(gegen.rechnung_nr, undefined);
  assert.equal(gegen.issued_at, undefined);

  // Snapshots & Zeiträume übernommen
  assert.deepEqual(gegen.aussteller_snapshot, orig.aussteller_snapshot);
  assert.deepEqual(gegen.empfaenger_snapshot, orig.empfaenger_snapshot);
  assert.equal(gegen.leistung_von, '2026-10-01');
  assert.equal(gegen.leistung_bis, '2026-10-03');
});

test('baueZuBelegZeile: schon kassiertes Rezept -> Beleg entsteht bezahlt (keine offene ZU neben kassierter Zuzahlung)', () => {
  const z = baueZuBelegZeile({
    tenantId: 'o1',
    rx: { id: 'rx1', patient_id: 'p1', zuzahlung_kassiert_am: '2026-10-10T08:00:00Z', zuzahlung_zahlart: 'ec' },
    printSessions: [{ session_id: 's1', datum: '2026-10-01', brutto: 40, zuzahlung: 4 }],
    totals: { gesZuzahlung: 14 },
  });
  assert.equal(z.status, 'paid');
  assert.equal(z.payment_status, 'paid');
  assert.equal(z.paid_at, '2026-10-10T08:00:00Z');
  assert.equal(z.payment_method, 'karte');
  const offen = baueZuBelegZeile({ tenantId: 'o1', rx: { id: 'rx1', patient_id: 'p1' }, printSessions: [], totals: {} });
  assert.equal(offen.status, 'sent');
});
