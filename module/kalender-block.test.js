import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anzeigeName, therapiezeitEtikett, blockInhalt } from './kalender-block.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

test('anzeigeName: Vorname Nachname wird umgedreht, Komma und Einzelwort bleiben', () => {
  assert.equal(anzeigeName('Ingrid Baumann'), 'Baumann, Ingrid');
  assert.equal(anzeigeName('Anna Maria Vogel'), 'Vogel, Anna Maria');
  assert.equal(anzeigeName('Baumann, Ingrid'), 'Baumann, Ingrid');
  assert.equal(anzeigeName('Teamsitzung'), 'Teamsitzung');
});

const KATALOG = [{ code: '78010', therapiezeit: 20 }, { code: '78020', therapiezeit: 35 }, { code: 'X0501' }];

test('therapiezeitEtikett: liest die Minuten aus dem Katalog', () => {
  assert.equal(therapiezeitEtikett('78010', KATALOG), 'davon 20 Min am Patienten');
  assert.equal(therapiezeitEtikett('78020', KATALOG), 'davon 35 Min am Patienten');
  assert.equal(therapiezeitEtikett('X0501', KATALOG), '');
  assert.equal(therapiezeitEtikett(undefined, KATALOG), '');
  assert.equal(therapiezeitEtikett('78010'), '');
});

test('blockInhalt: Name, Leistung, Zeit, Therapiezeit, DG und Zähler', () => {
  const html = blockInhalt({
    customer_name: 'Ingrid Baumann · 1951-03-14',
    start_time: '2026-10-20T09:30:00', end_time: '2026-10-20T10:20:00',
    services: { title: 'Komplexbehandlung groß', code: '78020' },
    prescription_sessions: [{ session_number: 4, prescriptions: { diagnosegruppe: 'DF', anzahl_einheiten: 6 } }],
  }, [], { escapeHtml, katalog: KATALOG });
  assert.match(html, /Baumann, Ingrid/);
  assert.match(html, /Komplexbehandlung groß/);
  assert.match(html, /davon 35 Min am Patienten/);
  assert.match(html, /DF/);
  assert.match(html, /4\/6/);
  assert.doesNotMatch(html, /1951/);
});

test('blockInhalt: Namen werden maskiert', () => {
  const html = blockInhalt({ customer_name: '<b>x</b> y', services: { title: 'T' } }, [], { escapeHtml });
  assert.doesNotMatch(html, /<b>x/);
});

test('blockInhalt: nicht erschienen ist markiert, Gruppe zeigt Plätze', () => {
  assert.match(blockInhalt({ customer_name: 'A B', status: 'no_show', services: {} }, [], { escapeHtml }), /kb-nicht-erschienen/);
  const g = blockInhalt({ is_group: true, group_capacity: 4, services: { title: 'Gruppe' } }, [{ customer_name: 'X, Y' }], { escapeHtml });
  assert.match(g, /1\/4/);
  assert.match(g, /X/);
});
