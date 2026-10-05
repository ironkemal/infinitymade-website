import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateiversionenHtml } from './abrechnung-artefakte.js';

const v = (o = {}) => ({ id: 'r1', dateiname: 'TSOL0004.p7m', rolle: 'signed', bezeichnung: 'Signierte Datei', status: 'published', aktuell: true, erstelltAm: '2026-10-01T10:00:00Z', pruefung: 'SHA-256 erfasst', herunterladbar: true, aufbewahrung: 'Noch nicht eingereicht', wiedervorlage: false, ...o });

test('leere Liste: erklaerender Text', () => {
  assert.match(dateiversionenHtml({ versionen: [] }), /noch keine Dateiversionen/);
});
test('Zeile mit Download-Knopf, aktuell-Markierung, Aufbewahrungstext', () => {
  const h = dateiversionenHtml({ versionen: [v()] });
  assert.match(h, /data-artefakt-dl="r1"/);
  assert.match(h, /aktuell/);
  assert.match(h, /Noch nicht eingereicht/);
  assert.match(h, /nie automatisch gelöscht/);
});
test('Wiedervorlage wird angezeigt, nicht herunterladbare Version ohne Knopf', () => {
  const h = dateiversionenHtml({ versionen: [v({ wiedervorlage: true }), v({ id: 'r2', status: 'retired', herunterladbar: false })] });
  assert.match(h, /Wiedervorlage/);
  assert.ok(!h.includes('data-artefakt-dl="r2"'));
  assert.match(h, /ausgemustert/);
});
test('HTML wird escaped (kein XSS ueber Bezeichnung/ID)', () => {
  const h = dateiversionenHtml({ versionen: [v({ bezeichnung: '<img src=x onerror=1>', id: '"><script>' })] });
  assert.ok(!h.includes('<img'));
  assert.ok(!h.includes('"><script>'));
});

test('Dateiname und Name fuer den Download stehen im Knopf, keine Tabelle (kein Querscrollen)', () => {
  const h = dateiversionenHtml({ versionen: [v()] });
  assert.match(h, /TSOL0004\.p7m/);
  assert.match(h, /data-artefakt-name="TSOL0004\.p7m"/);
  assert.ok(!h.includes('<table'));
});
