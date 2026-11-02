import test from 'node:test';
import assert from 'node:assert/strict';
import { mitteilungHtml } from './sondertag-mitteilung.js';

test('Mail-Abschnitt: Empfaenger vorausgewaehlt (abwaehlbar), Mustertext, Knopf mit Anzahl, Namen escaped', () => {
  const html = mitteilungHtml({ weg: 'smtp', mail: [{ bookingId: 'b1', start: '2026-12-24T09:00:00Z', name: '<i>A' }], anruf: [], bereits: [],
    beispiel: { betreff: 'Terminabsage – P', text: 'Guten Tag' } });
  assert.match(html, /class="stm-wahl" value="b1" checked/);
  assert.match(html, /Freigeben und senden \(1\)/);
  assert.match(html, /Mustertext ansehen/);
  assert.ok(!html.includes('<i>A'));
});

test('Ohne Versandweg: Hinweis, kein Sende-Knopf; ohne Einwilligung: Hinweis Telefon', () => {
  const ohne = mitteilungHtml({ weg: null, mail: [], anruf: [{}], bereits: [] });
  assert.match(ohne, /nicht eingerichtet/);
  assert.ok(!ohne.includes('stmSenden'));
  assert.match(mitteilungHtml({ weg: 'gmail', mail: [], anruf: [{}], bereits: [] }), /Niemand hat in E-Mail-Mitteilungen eingewilligt/);
  assert.match(mitteilungHtml({ weg: 'gmail', mail: [], anruf: [], bereits: [{}, {}] }), /Bereits per E-Mail informiert: 2/);
  assert.equal(mitteilungHtml(null), '');
});
