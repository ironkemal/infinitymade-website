import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueSnapshot, erzeugePasswort, erzeugeBerichtPdf, berichtDateiname, datumDE, istSchemaFehler, ladeSnapshot } from './therapiebericht.js';

const rxPodo = {
  therapie_bereich: 'podo', ausstellungsdatum: '2026-09-01', diagnosegruppe: 'DF',
  icd10: 'E11.74', icd10_2: null, diagnose_freitext: '', heilmittel: 'Podologische Komplexbehandlung', anzahl_einheiten: 6,
};

test('Passwort: Länge, nur eindeutige Zeichen, zufällig', () => {
  const a = erzeugePasswort();
  assert.equal(a.length, 10);
  assert.ok(!/[0O1lI]/.test(a), a);
  assert.notEqual(a, erzeugePasswort());
});

test('Snapshot Podologie: Behandlungen sortiert, HPNR als Klartext, Befund erster/letzter, keine Preise', () => {
  const s = baueSnapshot({
    profil: { business_name: 'Praxis X', street: 'Hauptstr.', house_number: '1', zip: '53721', city: 'Siegburg', phone: '02241' },
    rx: rxPodo,
    lead: { first_name: 'Erika', last_name: 'Muster', geburtsdatum: '1950-02-03' },
    arzt: { arzt_name: 'Dr. A', fax: '0221 1', email: 'a@b.de' },
    behandlungen: [
      { behandlungsdatum: '2026-09-20', hpnr_codes: ['78010'] },
      { behandlungsdatum: '2026-09-06', hpnr_codes: ['78040', '78010'], lokalisation: 'li. Großzehe' },
    ],
    befunde: [
      { erstellt_am: '2026-09-20T10:00:00Z', wagner_grad: 0, notiz: 'reizlos', ist_aktuell: true },
      { erstellt_am: '2026-09-06T10:00:00Z', wagner_grad: 1, notiz: 'Rhagade', ist_aktuell: true },
    ],
  });
  assert.equal(s.praxis.plzOrt, '53721 Siegburg');
  assert.equal(s.patient.name, 'Erika Muster');
  assert.deepEqual(s.behandlungen.map(b => b.datum), ['2026-09-06', '2026-09-20']);
  assert.ok(s.behandlungen[0].massnahmen.includes('Eingangsbefundung'));
  assert.equal(s.befund.erster.wagner_grad, 1);
  assert.equal(s.befund.letzter.notiz, 'reizlos');
  assert.ok(!JSON.stringify(s).includes('preis'));
});

test('Snapshot Physio: Sitzungen ohne Befund', () => {
  const s = baueSnapshot({ rx: { therapie_bereich: 'physio' }, behandlungen: [{ done_at: '2026-10-01T09:00:00Z' }, { done_at: null }] });
  assert.equal(s.behandlungen.length, 1);
  assert.equal(s.befund, null);
});

test('Snapshot Physio: mit Befunden und Messreihen', () => {
  const physioBefunde = [
    {
      id: 'bef-1',
      befundart: 'erst',
      befund_datum: '2026-09-01',
      ist_aktuell: true,
      created_at: '2026-09-01T08:00:00Z',
      daten: {
        bericht: {
          regionen: ['HWS'],
          positive_tests: [{ region: 'HWS', test: 'Spurling', seite: 'rechts' }],
          adl: ['Sitzen'],
          massnahmen: ['Krankengymnastik'],
          ziele: [{ text: 'Schmerzfreiheit', erreicht: null }],
          empfehlung: { folge_vo: 'ja', eigentraining: true },
        },
      },
    },
    {
      id: 'bef-2',
      befundart: 'abschluss',
      befund_datum: '2026-10-01',
      ist_aktuell: true,
      created_at: '2026-10-01T08:00:00Z',
      daten: {
        bericht: {
          regionen: ['HWS'],
          positive_tests: [],
          adl: ['Sitzen schmerzfrei'],
          massnahmen: ['Krankengymnastik', 'MT'],
          ziele: [{ text: 'Schmerzfreiheit', erreicht: 'ja' }],
          verlauf: 'besser',
          empfehlung: { folge_vo: 'nein', eigentraining: true },
        },
      },
    },
  ];
  const physioMessungen = [
    { befund_id: 'bef-1', typ: 'VAS', koerperteil: 'HWS', wert: 8 },
    { befund_id: 'bef-2', typ: 'VAS', koerperteil: 'HWS', wert: 2 },
  ];

  const s = baueSnapshot({
    rx: { therapie_bereich: 'physio' },
    lead: { first_name: 'Max', last_name: 'Mustermann' },
    behandlungen: [{ done_at: '2026-09-05T10:00:00Z' }],
    physioBefunde,
    physioMessungen,
  });

  assert.ok(s.befund);
  assert.ok(s.befund.erst);
  assert.equal(s.befund.erst.datum, '2026-09-01');
  assert.equal(s.befund.erst.nrs.HWS, 8);
  assert.ok(s.befund.aktuell);
  assert.equal(s.befund.aktuell.datum, '2026-10-01');
  assert.equal(s.befund.aktuell.nrs.HWS, 2);
  assert.equal(s.befund.verlauf, 'besser');
  assert.equal(s.befund.veraenderungen.length, 1);
  assert.deepEqual(s.befund.veraenderungen[0], {
    art: 'nrs',
    label: 'HWS',
    seite: null,
    vorher: 8,
    jetzt: 2,
  });
});

test('Snapshot Physio: bevorzugte VO-Zuordnung (prescription_id === rx.id)', () => {
  const bVo1 = {
    id: 'bef-1',
    prescription_id: 'rx-123',
    befundart: 'erst',
    befund_datum: '2026-09-01',
    ist_aktuell: true,
    daten: { bericht: { regionen: ['HWS'] } },
  };
  const bFremd = {
    id: 'bef-2',
    prescription_id: 'rx-999',
    befundart: 'erst',
    befund_datum: '2026-08-01',
    ist_aktuell: true,
    daten: { bericht: { regionen: ['LWS'] } },
  };

  const s = baueSnapshot({
    rx: { id: 'rx-123', therapie_bereich: 'physio' },
    physioBefunde: [bVo1, bFremd],
  });

  assert.ok(s.befund);
  assert.deepEqual(s.befund.erst.regionen, ['HWS']);
});

test('PDF-Smoke-Test: erzeugeBerichtPdf fuer Physio mit Befund erzeugt valides PDF', async () => {
  const snapshot = baueSnapshot({
    profil: { business_name: 'Physio Praxis Vital', owner_first_name: 'Anna', owner_last_name: 'Schmidt' },
    rx: { therapie_bereich: 'physio', diagnose_freitext: 'Zervikobrachialsyndrom', heilmittel: 'Krankengymnastik' },
    lead: { first_name: 'Max', last_name: 'Mustermann' },
    physioBefunde: [
      {
        id: 'b-1',
        befundart: 'erst',
        befund_datum: '2026-09-01',
        ist_aktuell: true,
        daten: {
          bericht: {
            regionen: ['HWS'],
            positive_tests: [{ region: 'HWS', test: 'Spurling', seite: 'rechts' }],
            adl: ['Schlafen', 'Arbeiten'],
            massnahmen: ['KG', 'MT'],
            ziele: [{ text: 'Schmerzlinderung', erreicht: 'teilweise' }],
            verlauf: 'besser',
            empfehlung: { folge_vo: 'ja', eigentraining: true },
          },
        },
      },
    ],
    physioMessungen: [
      { befund_id: 'b-1', typ: 'VAS', koerperteil: 'HWS', wert: 6 },
    ],
  });

  assert.ok(snapshot.befund?.erst);
  const pdfBuffer = await erzeugeBerichtPdf({ snapshot, verlauf: 'Patient macht gute Fortschritte' });
  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.ok(pdfBuffer.length > 0);
  const pdfStr = pdfBuffer.toString('latin1');
  assert.ok(pdfStr.startsWith('%PDF'));
});

test('PDF mit Passwort ist AES-256-verschlüsselt, ohne Passwort offen', async () => {
  const snapshot = baueSnapshot({ rx: rxPodo, lead: { first_name: 'Erika', last_name: 'Muster' } });
  const zu = (await erzeugeBerichtPdf({ snapshot, verlauf: 'gut', empfehlung_code: 'fortsetzung' }, { passwort: 'Abcdefgh23' })).toString('latin1');
  assert.ok(zu.startsWith('%PDF-1.7'));
  assert.match(zu, /\/Filter \/Standard/);
  assert.match(zu, /\/V 5/);
  const offen = (await erzeugeBerichtPdf({ snapshot })).toString('latin1');
  assert.ok(offen.startsWith('%PDF'));
  assert.ok(!/\/Encrypt/.test(offen));
});

test('Dateiname ohne Patientennamen', () => {
  const n = berichtDateiname({ patient: { name: 'Erika Muster' } }, new Date('2026-10-22T12:00:00Z'));
  assert.equal(n, 'Therapiebericht_2026-10-22.pdf');
});

test('datumDE', () => {
  assert.equal(datumDE('2026-01-05'), '05.01.2026');
  assert.equal(datumDE(''), '');
});

test('PDF mit faxDeckblatt: erzeugt offenes PDF mit TELEFAX auf Seite 1', async () => {
  const snapshot = baueSnapshot({
    profil: { business_name: 'Praxis X', street: 'Hauptstr.', house_number: '1', zip: '53721', city: 'Siegburg', phone: '02241 123', fax: '02241 999' },
    rx: rxPodo,
    lead: { first_name: 'Erika', last_name: 'Muster', geburtsdatum: '1950-02-03' },
    arzt: { arzt_name: 'Dr. Med. Test', fax: '0221 444', telefon: '0221 555' },
  });
  assert.equal(snapshot.praxis.fax, '02241 999');
  const mitDeckblatt = (await erzeugeBerichtPdf({ snapshot }, { faxDeckblatt: true })).toString('latin1');
  assert.ok(mitDeckblatt.startsWith('%PDF'));
  assert.ok(!/\/Encrypt/.test(mitDeckblatt));
  // Seiteninhalt ist komprimiert: das Deckblatt zeigt sich als zusätzliche Seite.
  const ohne = (await erzeugeBerichtPdf({ snapshot })).toString('latin1');
  const seiten = (t) => Number(/\/Count (\d+)/.exec(t)[1]);
  assert.equal(seiten(mitDeckblatt), seiten(ohne) + 1);
});

test('istSchemaFehler: fängt fehlende Tabellen (42P01, PGRST205) und Spalten (42703, PGRST204) ab', () => {
  assert.equal(istSchemaFehler({ code: '42P01' }), true);
  assert.equal(istSchemaFehler({ code: 'PGRST205' }), true);
  assert.equal(istSchemaFehler({ code: '42703' }), true);
  assert.equal(istSchemaFehler({ code: 'PGRST204' }), true);
  assert.equal(istSchemaFehler({ code: '23505' }), false);
  assert.equal(istSchemaFehler(null), false);
});

test('ladeSnapshot: Fehlertoleranz bei Postgres 42703 und PostgREST PGRST204 (kein Abbruch)', async () => {
  const mockRx = {
    id: 'rx-1',
    owner_id: 'tenant-1',
    patient_id: 'pat-1',
    therapie_bereich: 'physio',
  };

  const erstelleMock = (errorCode) => ({
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        in() { return this; },
        async maybeSingle() {
          if (table === 'prescriptions') return { data: mockRx, error: null };
          if (table === 'profiles') return { data: { business_name: 'Test Praxis' }, error: null };
          if (table === 'leads') return { data: { first_name: 'Max', last_name: 'Mustermann' }, error: null };
          return { data: null, error: null };
        },
        then(resolve) {
          if (table === 'physio_befunde') {
            return resolve({ data: null, error: { code: errorCode, message: 'schema error' } });
          }
          if (table === 'prescription_sessions') {
            return resolve({ data: [], error: null });
          }
          return resolve({ data: [], error: null });
        },
        catch() { return this; },
      };
    },
  });

  const res1 = await ladeSnapshot(erstelleMock('42703'), 'tenant-1', 'rx-1');
  assert.ok(res1.snapshot);
  assert.equal(res1.snapshot.befund, null);

  const res2 = await ladeSnapshot(erstelleMock('PGRST204'), 'tenant-1', 'rx-1');
  assert.ok(res2.snapshot);
  assert.equal(res2.snapshot.befund, null);
});
