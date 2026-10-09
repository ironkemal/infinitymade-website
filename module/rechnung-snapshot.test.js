// Rechnungs-Snapshot (Migration 0075): Feldauswahl + Parität Frontend ↔ api-backend/lib/rechnung-snapshot.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ausstellerSnapshot } from './branding.js';
import { empfaengerSnapshot } from './bg-angaben.js';
import { rechnungSnapshots, EMPFAENGER_PATIENT_SPALTEN } from './rechnung-snapshot.js';
import * as server from '../api-backend/lib/rechnung-snapshot.js';

const PROFIL = {
  business_name: 'Podologie Am Markt', praxis_inhaber: '', owner_first_name: 'Erika', owner_last_name: 'Muster',
  street: 'Marktstr.', house_number: '5a', plz: '', zip: '53721', city: 'Siegburg',
  phone: '02241 1234', email: 'praxis@example.de', ik_number: '123456789',
  iban: 'DE02120300000000202051', bic: 'BYLADEM1001', bank_name: 'Testbank', // secret-scan: ignore (Fake-Testwert)
  steuernummer: '220/5000/1234', stripe_customer_id: 'cus_x', praxis_logo_url: 'https://x.example/logo.png',
};
const PATIENT = {
  first_name: 'Max', last_name: 'Beispiel', title: 'Max Beispiel', geburtsdatum: '1950-03-04',
  street: 'Weg 1', plz: '53721', city: 'Siegburg', krankenkasse: 'AOK', versichertennummer: 'A123456789',
  iban: 'DE89370400440532013000', phone: '0170', email: 'max@example.de', // secret-scan: ignore (Fake-Testwert)
};
const BG_RX = {
  rezeptart: 'bg', bg_traeger_name: 'BG ETEM', bg_traeger_anschrift: 'Postfach 1\n50968 Köln',
  bg_unfalltag: '2026-09-01', bg_aktenzeichen: 'AZ-7', icd10: 'M79.6', diagnosegruppe: 'DF',
};

test('ausstellerSnapshot: normalisiert (PLZ aus zip, Hausnummer, Inhaber aus Assistent), nur gedruckte Felder', () => {
  const a = ausstellerSnapshot(PROFIL);
  assert.deepEqual(a, {
    v: 1, name: 'Podologie Am Markt', inhaber: 'Erika Muster', strasse: 'Marktstr. 5a', plzOrt: '53721 Siegburg',
    telefon: '02241 1234', email: 'praxis@example.de', ik: '123456789',
    bank: { name: 'Testbank', iban: 'DE02120300000000202051', bic: 'BYLADEM1001' },
  });
  assert.ok(!JSON.stringify(a).includes('cus_x'));
  assert.ok(!JSON.stringify(a).includes('220/5000'), 'Steuernummer hat eigene Snapshot-Spalte');
});

test('empfaengerSnapshot: Patient ohne IBAN/Telefon/E-Mail; ohne Patient null', () => {
  const e = empfaengerSnapshot({ patient: PATIENT, rx: null, invoiceType: 'privat' });
  assert.deepEqual(e, {
    v: 1, art: 'patient', name: 'Max Beispiel', strasse: 'Weg 1', plzOrt: '53721 Siegburg',
    geburtsdatum: '1950-03-04', krankenkasse: 'AOK', versichertennummer: 'A123456789',
  });
  assert.ok(!/DE89|0170|max@/.test(JSON.stringify(e)));
  assert.equal(empfaengerSnapshot({ patient: null }), null);
});

test('empfaengerSnapshot: BG = UV-Träger + Bezug, keine Diagnose; BG-Typ ohne BG-Verordnung = Patient', () => {
  const e = empfaengerSnapshot({ patient: PATIENT, rx: BG_RX, invoiceType: 'bg' });
  assert.equal(e.art, 'bg');
  assert.deepEqual(e.empfaenger, ['BG ETEM', 'Postfach 1', '50968 Köln']);
  assert.deepEqual(e.bezug, ['Versicherte Person: Max Beispiel (geb. 04.03.1950)', 'Unfalltag: 01.09.2026', 'Aktenzeichen: AZ-7']);
  assert.ok(!/M79|DF/.test(JSON.stringify(e)));
  assert.equal(empfaengerSnapshot({ patient: PATIENT, rx: { rezeptart: 'gkv' }, invoiceType: 'bg' }).art, 'patient');
});

test('Parität: Server-Spiegel liefert dieselben Snapshots', () => {
  for (const p of [PROFIL, {}, { ...PROFIL, plz: '10115', praxis_inhaber: 'Dr. X' }]) {
    assert.deepEqual(server.ausstellerSnapshot(p), ausstellerSnapshot(p));
  }
  const faelle = [
    { patient: PATIENT, rx: null, invoiceType: 'privat' },
    { patient: PATIENT, rx: BG_RX, invoiceType: 'bg' },
    { patient: { ...PATIENT, geburtsdatum: null, first_name: '', last_name: '' }, rx: BG_RX, invoiceType: 'bg' },
    { patient: { title: 'Nur Titel' }, rx: null, invoiceType: null },
    { patient: null, rx: null, invoiceType: null },
  ];
  for (const f of faelle) assert.deepEqual(server.empfaengerSnapshot(f), empfaengerSnapshot(f));
});

test('rechnungSnapshots: liest Patient + Verordnung, Lesefehler → Empfänger null statt Abbruch', async () => {
  const abfragen = [];
  const supa = (fehler = false) => ({
    from: (tab) => ({
      select: (sp) => ({
        eq: (_k, id) => ({
          maybeSingle: async () => {
            abfragen.push({ tab, sp, id });
            if (fehler) return { data: null, error: { message: 'x' } };
            return { data: tab === 'leads' ? PATIENT : BG_RX, error: null };
          },
        }),
      }),
    }),
  });
  const r = await rechnungSnapshots(supa(), { profil: PROFIL, patientId: 'p1', rezeptId: 'r1', invoiceType: 'bg' });
  assert.equal(r.aussteller_snapshot.name, 'Podologie Am Markt');
  assert.equal(r.empfaenger_snapshot.art, 'bg');
  assert.deepEqual(abfragen.map((a) => a.tab).sort(), ['leads', 'prescriptions']);
  assert.equal(abfragen.find((a) => a.tab === 'leads').sp, EMPFAENGER_PATIENT_SPALTEN);

  const err = console.error; console.error = () => {};
  try {
    const r2 = await rechnungSnapshots(supa(true), { profil: PROFIL, patientId: 'p1', rezeptId: null, invoiceType: 'privat' });
    assert.equal(r2.empfaenger_snapshot, null);
    assert.equal(r2.aussteller_snapshot.ik, '123456789');
  } finally { console.error = err; }
});

test('praxisKopf (Server-Renderings): Praxis-E-Mail vor Ersatz, PLZ plz|zip, Hausnummer, kein Ersatz = leer', () => {
  const p = { business_name: 'Fußpflege Muster', street: 'Hauptstr.', house_number: '5a', plz: '53721', city: 'Siegburg', phone: '0221', ik_number: '123456789', email: 'praxis@example.de' };
  assert.deepEqual(server.praxisKopf(p, { ersatzEmail: 'mitarbeiter@example.de' }),
    { name: 'Fußpflege Muster', strasse: 'Hauptstr. 5a', plz_ort: '53721 Siegburg', telefon: '0221', ik: '123456789', email: 'praxis@example.de' });
  assert.equal(server.praxisKopf({ ...p, email: null, plz: null, zip: '50667' }, { ersatzEmail: 'inhaber@example.de' }).email, 'inhaber@example.de');
  assert.equal(server.praxisKopf({ ...p, plz: null, zip: '50667' }).plz_ort, '50667 Siegburg');
  assert.equal(server.praxisKopf({ email: '' }).email, '');
  assert.equal(server.praxisKopf(null).name, 'Praxis');
});
