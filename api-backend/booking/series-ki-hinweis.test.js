// Box-Test 22.11.2026, Pflichtpunkt 5: KI-Serientermine — KI aus darf kein „Fehler“ sein.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kiHinweisFuerSerie } from './series.js';

test('KI lief: kein Hinweis; KI aus: ausgeschaltet; sonst: nicht erreichbar', () => {
  assert.equal(kiHinweisFuerSerie('ok', null), '');
  assert.match(kiHinweisFuerSerie('error', 'AI_MODE_AUS'), /ausgeschaltet — Vorschlag nach festen Regeln/);
  assert.match(kiHinweisFuerSerie('error', 'AI_OWNER_DISABLED'), /ausgeschaltet/);
  assert.match(kiHinweisFuerSerie('error', 'AI_UNAVAILABLE'), /nicht erreichbar/);
});

test('ai-suggest-series: jede res.json-Antwort mit selected trägt success:true', () => {
  const src = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const start = src.indexOf("app.post('/api/booking/ai-suggest-series'");
  const ende = src.indexOf('\napp.', start + 10);
  const route = src.slice(start, ende);
  const antworten = [...route.matchAll(/res\.json\(\{[\s\S]{0,80}/g)].map(m => m[0]);
  assert.ok(antworten.length >= 3, 'Antworten gefunden');
  for (const a of antworten) if (/selected/.test(a)) assert.match(a, /success:\s*true/, a);
  assert.match(route, /kiHinweisFuerSerie\(seriesStatus, seriesError\)/);
});
