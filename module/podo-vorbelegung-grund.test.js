// Konsey 30.09.2026 (Podologie-Reform S4, 2b): jede Vorbelegung nennt ihren Grund.
import test from 'node:test';
import assert from 'node:assert/strict';
import { befundGrundText, tagesVorbelegungGrund, verordnetZeile } from './podo-vorbelegung-grund.js';

const eingangJa = { erlaubt: true, grund: '', schonAm: null, ersteAm: null };
const basis = { isUI: false, eingang: eingangJa, hausbesuch: false, geplant: false, rezeptPosition: '78010' };

test('Tagesbehandlung: 78040 am ersten Behandlungstag nennt die Erstinanspruchnahme', () => {
  assert.match(tagesVorbelegungGrund({ ...basis, code: '78040' }), /erste Behandlung/);
});

test('Tagesbehandlung: 78030 nennt das Datum der ersten Behandlung', () => {
  const g = tagesVorbelegungGrund({
    ...basis, code: '78030',
    eingang: { erlaubt: false, grund: 'nicht_erste_behandlung', schonAm: null, ersteAm: '2026-08-14' },
  });
  assert.match(g, /14\.08\.2026/);
});

test('Tagesbehandlung: 78030 nach erfasster Eingangsbefundung nennt deren Tag', () => {
  const g = tagesVorbelegungGrund({
    ...basis, code: '78030',
    eingang: { erlaubt: false, grund: 'schon_abgerechnet', schonAm: '2026-09-02', ersteAm: '2026-09-02' },
  });
  assert.match(g, /02\.09\.2026/);
});

test('Tagesbehandlung: 79933 = Hausbesuch laut Verordnung; Behandlungsposition = laut Verordnung', () => {
  assert.equal(tagesVorbelegungGrund({ ...basis, code: '79933', hausbesuch: true }), 'Hausbesuch laut Verordnung');
  assert.equal(tagesVorbelegungGrund({ ...basis, code: '78010' }), 'Behandlungsposition laut Verordnung');
});

test('Tagesbehandlung: nur im Termin geplant', () => {
  assert.match(tagesVorbelegungGrund({ ...basis, code: '78610', geplant: true }), /Termin/);
});

test('Nagelzweig UI1/UI2 hat keinen Befundungsgrund; unbekannte Position keinen Grund', () => {
  assert.equal(tagesVorbelegungGrund({ ...basis, code: '78030', isUI: true, rezeptPosition: '' }), '');
  assert.equal(tagesVorbelegungGrund({ ...basis, code: '78999', rezeptPosition: '' }), '');
});

test('Termin/Serie: Befundungsvorschlag kennt alle vier Gruende der Regel', () => {
  for (const k of ['erstinanspruchnahme', 'nicht_erste_behandlung', 'eingangsbefundung_verbraucht', 'kein_anspruch_altbestand']) {
    assert.ok(befundGrundText(k).length > 10, k);
  }
  assert.equal(befundGrundText('irgendwas'), '');
  assert.equal(befundGrundText(undefined), '');
});

test('„Verordnet: 78xxx": Rohwert sichtbar, Abweichung von der Vorbelegung benannt', () => {
  assert.equal(verordnetZeile('78010', '78010'), 'Verordnet: 78010');
  assert.equal(verordnetZeile('78020', '78010'), 'Verordnet: 78020 — vorbelegt: 78010');
  assert.match(verordnetZeile('', ''), /keine Position/);
  assert.match(verordnetZeile(null, '78010'), /vorbelegt: 78010/);
});
