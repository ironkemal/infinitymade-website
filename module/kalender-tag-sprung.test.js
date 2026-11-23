// Live-Test 23.11.2026 (P1): Seit „Woche als Standard“ setzt switchPanel('calendar') am Ende 'week'.
// „Tag öffnen“ (Überblick-Kachel, Tageszentrale) muss deshalb switchPanel abwarten und DANACH 'day' setzen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');

test('jeder oeffneKalenderTag wartet auf switchPanel, bevor er die Tagesansicht setzt', () => {
  const stellen = [...src.matchAll(/oeffneKalenderTag:\s*(async\s*)?\(tagIso\)\s*=>\s*\{(.*?setCalendarView\('day'\))/g)];
  assert.ok(stellen.length >= 2, 'oeffneKalenderTag-Definitionen nicht gefunden');
  for (const [, istAsync, rumpf] of stellen) {
    assert.ok(istAsync, 'oeffneKalenderTag muss async sein');
    const warte = rumpf.indexOf("await switchPanel('calendar')");
    const tag = rumpf.indexOf("setCalendarView('day')");
    assert.ok(warte >= 0 && tag > warte, `Reihenfolge falsch: ${rumpf.trim().slice(0, 120)}`);
  }
});

test('switchPanel setzt beim Öffnen des Kalenders die Woche (Pflichtpunkt 1)', () => {
  assert.match(src, /setCalendarView\('week'\); \/\/ Pflichtpunkt 1/);
});
