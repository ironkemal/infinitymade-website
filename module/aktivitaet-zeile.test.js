import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aktivitaetZeileHtml } from './aktivitaet-zeile.js';

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;

test('aktivitaetZeileHtml: rendert alle 5 Typen mit SVG und ohne Emojis', () => {
  const faelle = [
    { type: 'booking', name: 'Anna Beispiel', ts: '2026-11-19T18:00:00Z' },
    { type: 'note', name: 'Bernd Test', ts: '2026-11-19T17:00:00Z' },
    { type: 'invoice', invoice_number: 'RE-2026-12', total_patient: 42.5, name: 'Clara', ts: '2026-11-19T16:00:00Z' },
    { type: 'fahrt', distance_km: 12, ts: '2026-11-19T15:00:00Z' },
    { type: 'lead', name: 'Dieter Neu', ts: '2026-11-19T14:00:00Z' },
  ];
  for (const f of faelle) {
    const html = aktivitaetZeileHtml(f, { formatTimestamp: () => 'Heute 18:00 Uhr' });
    assert.ok(html.includes('<svg '), `${f.type} nutzt SVG`);
    assert.equal(EMOJI_RE.test(html), false, `${f.type} ohne Emoji`);
    assert.ok(html.includes('Heute 18:00 Uhr'));
  }
});

test('aktivitaetZeileHtml: maskiert HTML in Patientennamen gegen XSS', () => {
  const html = aktivitaetZeileHtml({ type: 'booking', name: '<img src=x onerror=alert(1)>' });
  assert.equal(html.includes('<img'), false);
  assert.ok(html.includes('&lt;img'));
});
