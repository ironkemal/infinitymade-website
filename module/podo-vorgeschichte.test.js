import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorgeschichteAlsBehandlungen, pruefeVorgeschichte } from './podo-vorgeschichte.js';
import { darf78040, darf78100, darfErstbefundungNagel } from './eingangsbefundung-regel.js';

const lead = {
  podo_vorgeschichte_erste_beh_am: '2024-03-01',
  podo_vorgeschichte_78100_am: '2026-02-10',
  podo_vorgeschichte_naegel: { 'U1 links': { erstbefundung: { code: '78110', am: '2026-02-10' } }, 'U2 rechts': { erstbefundung: { code: '78100', am: '2025-01-05' }, abschluss_78520_am: '2025-06-01' } },
};

test('Altsystem-Patient ohne 78040: 78040 gesperrt (nicht erste Behandlung)', () => {
  const r = darf78040(vorgeschichteAlsBehandlungen(lead), '2026-10-21');
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'nicht_erste_behandlung');
});

test('78100 im selben Kalenderjahr gesperrt, im Folgejahr frei', () => {
  const v = vorgeschichteAlsBehandlungen(lead);
  assert.equal(darf78100(v, '2026-10-21').erlaubt, false);
  assert.equal(darf78100(v, '2027-01-10').erlaubt, true);
});

test('Nagel: laufende Serie gesperrt, abgeschlossene Serie frei', () => {
  const v = vorgeschichteAlsBehandlungen(lead);
  assert.equal(darfErstbefundungNagel(v.filter(b => b.nagel === 'U1 links'), 'U1 links', '2026-10-21').erlaubt, false);
  assert.equal(darfErstbefundungNagel(v.filter(b => b.nagel === 'U2 rechts'), 'U2 rechts', '2026-10-21').erlaubt, true);
});

test('pruefeVorgeschichte: Zukunft, unbekannter Nagel, falscher Code', () => {
  const { werte, fehler } = pruefeVorgeschichte({ ersteBeh: '2024-03-01', am78040: '2099-01-01', naegel: { 'U9 links': {}, 'U1 links': { erstbefundung: { code: '78010', am: '2026-01-01' } } } }, '2026-10-21');
  assert.equal(werte.podo_vorgeschichte_erste_beh_am, '2024-03-01');
  assert.equal(fehler.length, 3);
});
