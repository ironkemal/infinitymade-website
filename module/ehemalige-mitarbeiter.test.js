import test from 'node:test';
import assert from 'node:assert/strict';
import { loeschbarAb, ehemaligeListe, ehemaligeHtml } from './ehemalige-mitarbeiter.js';

test('Frist: 31.12. des dritten Jahres nach dem Austrittsjahr', () => {
  assert.equal(loeschbarAb('2026-11-02'), '2029-12-31');
  assert.equal(loeschbarAb('2026-01-01'), '2029-12-31');
  assert.equal(loeschbarAb(null), null);
  assert.equal(loeschbarAb('kaputt'), null);
});

test('Liste: nur Ehemalige mit Daten, faellige zuerst, Zaehlung Abwesenheiten', () => {
  const profile = [{ id: 'a', business_name: 'Anna' }, { id: 'b', email: 'bert@x.de' }, { id: 'c', business_name: 'Leer' }];
  const anst = [{ employee_id: 'a', austritt_am: '2026-10-01' }, { employee_id: 'b', austritt_am: '2021-03-01' }];
  const abw = [{ employee_id: 'a' }, { employee_id: 'a' }, { employee_id: 'b' }];
  const l = ehemaligeListe(profile, anst, abw, '2026-11-02');
  assert.deepEqual(l.map(e => e.id), ['b', 'a']);
  assert.equal(l[0].faellig, true);
  assert.equal(l[0].name, 'bert');
  assert.equal(l[1].abwesenheiten, 2);
  assert.equal(l[1].loeschbar, '2029-12-31');
});

test('Liste: nur Abwesenheiten ohne Anstellung -> Frist unbekannt, trotzdem loeschbar', () => {
  const l = ehemaligeListe([{ id: 'x', business_name: 'X' }], [], [{ employee_id: 'x' }], '2026-11-02');
  assert.equal(l.length, 1);
  assert.equal(l[0].loeschbar, null);
  assert.match(ehemaligeHtml(l), /Austrittsdatum fehlt/);
});

test('HTML: leer ohne Eintraege, escaped Namen, Frist-Text', () => {
  assert.equal(ehemaligeHtml([]), '');
  const html = ehemaligeHtml([{ id: 'a', name: '<b>Anna', austritt: '2026-10-01', loeschbar: '2029-12-31', faellig: false, abwesenheiten: 1, anstellung: true }]);
  assert.ok(!html.includes('<b>Anna'));
  assert.match(html, /löschbar ab 31\.12\.2029/);
  assert.match(html, /1 Abwesenheit, Anstellung/);
});
