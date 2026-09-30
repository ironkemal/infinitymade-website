import test from 'node:test';
import assert from 'node:assert/strict';
import { rozetHtml } from './anamnese-rozet.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

test('kein Rozet ohne Anamnese oder ohne Warnung', () => {
  assert.equal(rozetHtml(null, esc), '');
  assert.equal(rozetHtml({ id: 'a', felder: { diabetes: 'nein' } }, esc), '');
});

test('höchstens 3 einzeln, Rest „+n" mit allen Namen im Tooltip', () => {
  const h = rozetHtml({ id: 'a', geprueft_am: 'x', felder: { gerinnung: ['doak'], allergien: ['latex'], ulkus: 'ja', pavk: 'ja', neuropathie: 'ja' } }, esc);
  assert.equal((h.match(/anam-rozet--(rot|orange)"/g) || []).length, 3);
  assert.match(h, /anam-rozet--mehr" title="[^"]*Neuropathie[^"]*">\+2</);
  assert.match(h, /anam-rozet--rot/);
});

test('ungeprüft: Tipp-Knopf mit Anamnese-Id, nach Prüfung weg, abschaltbar', () => {
  const row = { id: 'A1', geprueft_am: null, felder: { pavk: 'ja' } };
  assert.match(rozetHtml(row, esc), /<button type="button" class="anam-rozet-ungeprueft" data-anamnese-pruefen="A1"/);
  assert.match(rozetHtml(row, esc, { pruefbar: false }), /<span class="anam-rozet-ungeprueft"/);
  assert.doesNotMatch(rozetHtml({ ...row, geprueft_am: '2026-09-30' }, esc), /ungeprüft/);
});

test('Infektion erscheint nur als „Hygiene" — nie als Diagnose', () => {
  const h = rozetHtml({ id: 'a', geprueft_am: 'x', felder: { infektion: 'mrsa' } }, esc);
  assert.match(h, />Hygiene</);
  assert.doesNotMatch(h, /MRSA|Infektion/);
});

test('HTML-Maskierung', () => {
  const h = rozetHtml({ id: '"><script>', geprueft_am: null, felder: { pavk: 'ja' } }, esc);
  assert.doesNotMatch(h, /<script>/);
});
