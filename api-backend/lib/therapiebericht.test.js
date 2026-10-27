import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueSnapshot, erzeugePasswort, erzeugeBerichtPdf, berichtDateiname, datumDE } from './therapiebericht.js';

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
