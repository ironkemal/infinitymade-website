import { test } from 'node:test';
import assert from 'node:assert/strict';
import { begruessung, heutigeTermine, alsNaechstes, minutenBis, abstandText, dauerMin, tageszeile, zuErledigen } from './startseite-rechnen.js';

const jetzt = new Date('2026-10-23T08:15:00Z'); // 10:15 Berlin (Sommerzeit)
const t = (id, von, bis, extra = {}) => ({ id, start_time: von, end_time: bis, status: 'confirmed', user_id: 'u1', ...extra });

test('begruessung nach Stunde', () => {
  assert.equal(begruessung(7), 'Guten Morgen');
  assert.equal(begruessung(11), 'Guten Morgen');
  assert.equal(begruessung(12), 'Guten Tag');
  assert.equal(begruessung(18), 'Guten Abend');
  assert.equal(begruessung('x'), 'Guten Tag');
});

test('heutigeTermine: filtert Absagen, Blocker, Gruppen-Kinder; sortiert; Zustand nach Uhr', () => {
  const rohe = [
    t('c', '2026-10-23T09:00:00Z', '2026-10-23T09:30:00Z'),
    t('a', '2026-10-23T06:00:00Z', '2026-10-23T06:45:00Z'),
    t('b', '2026-10-23T08:00:00Z', '2026-10-23T08:30:00Z'),
    t('x', '2026-10-23T07:00:00Z', '2026-10-23T07:30:00Z', { status: 'cancelled' }),
    t('y', '2026-10-23T07:00:00Z', '2026-10-23T07:30:00Z', { services: { is_internal: true } }),
    t('z', '2026-10-23T07:00:00Z', '2026-10-23T07:30:00Z', { group_parent_id: 'c' }),
    t('ohne', 'kaputt', null),
  ];
  const l = heutigeTermine(rohe, { jetzt });
  assert.deepEqual(l.map((b) => [b.id, b.zustand]), [['a', 'vorbei'], ['b', 'laeuft'], ['c', 'offen']]);
});

test('heutigeTermine: Angestellte nur eigene; ohne uid nichts', () => {
  const rohe = [t('a', '2026-10-23T09:00:00Z', '2026-10-23T09:30:00Z'), t('b', '2026-10-23T09:00:00Z', '2026-10-23T09:30:00Z', { user_id: 'u2' })];
  assert.deepEqual(heutigeTermine(rohe, { jetzt, uid: 'u2', nurEigene: true }).map((b) => b.id), ['b']);
  assert.deepEqual(heutigeTermine(rohe, { jetzt, nurEigene: true }), []);
  assert.deepEqual(heutigeTermine(null), []);
});

test('alsNaechstes: erster nicht vorbeier Termin, bis zu drei danach', () => {
  const l = heutigeTermine([
    t('a', '2026-10-23T06:00:00Z', '2026-10-23T06:45:00Z'),
    t('b', '2026-10-23T09:00:00Z', '2026-10-23T09:30:00Z'),
    t('c', '2026-10-23T10:00:00Z', '2026-10-23T10:30:00Z'),
  ], { jetzt });
  const n = alsNaechstes(l);
  assert.equal(n.termin.id, 'b');
  assert.deepEqual(n.danach.map((b) => b.id), ['c']);
  assert.deepEqual(alsNaechstes([{ zustand: 'vorbei' }]), { termin: null, danach: [] });
});

test('minutenBis, abstandText, dauerMin', () => {
  assert.equal(minutenBis('2026-10-23T08:30:00Z', jetzt), 15);
  assert.equal(minutenBis('2026-10-23T08:00:00Z', jetzt), 0);
  assert.equal(abstandText({ zustand: 'offen', start_time: '2026-10-23T08:30:00Z' }, jetzt), 'in 15 Min');
  assert.equal(abstandText({ zustand: 'offen', start_time: '2026-10-23T10:20:00Z' }, jetzt), 'in 2 Std 5 Min');
  assert.equal(abstandText({ zustand: 'offen', start_time: '2026-10-23T09:15:00Z' }, jetzt), 'in 1 Std');
  assert.equal(abstandText({ zustand: 'laeuft' }, jetzt), 'läuft');
  assert.equal(dauerMin(t('a', '2026-10-23T08:00:00Z', '2026-10-23T08:45:00Z')), 45);
  assert.equal(dauerMin({}), 0);
});

test('tageszeile: Einzahl, Mehrzahl, Hausbesuche', () => {
  assert.equal(tageszeile([]), 'Keine Termine');
  assert.equal(tageszeile([{}]), '1 Termin');
  assert.equal(tageszeile([{ hausbesuch: true }, {}, { hausbesuch: true }]), '3 Termine, davon 2 Hausbesuche');
  assert.equal(tageszeile([{ hausbesuch: true }, {}]), '2 Termine, davon 1 Hausbesuch');
});

test('zuErledigen: nur Zahlen > 0, dringend zuerst, unbekannt = keine Zeile', () => {
  assert.deepEqual(zuErledigen({ anfragen: 2, voUeberfaellig: 1, voBald: 0 }).map((z) => [z.id, z.zahl]), [['vo-ueberfaellig', 1], ['anfragen', 2]]);
  assert.deepEqual(zuErledigen({ anfragen: '', voUeberfaellig: null, voBald: undefined }), []);
  assert.deepEqual(zuErledigen(), []);
});
