// V8.01: design/seiten.css erkennt Status-/Bereichsetiketten an ihrem festen Inline-Muster.
// Ändert sich abrechnungsstatus.js (Farbe/Aufbau), schlägt dieser Test an — dann das CSS nachziehen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../design/seiten.css', import.meta.url), 'utf8');

test('Etiketten-Muster aus abrechnungsstatus.js passen zu design/seiten.css', async () => {
  await import('./test-browser-config.mjs');
  const m = await import('../module/abrechnungsstatus.js');
  const klein = m.statusBadge('abrechenbar');
  const gross = m.statusBadgeGross('podologie', 'abgesetzt');
  assert.ok(klein.includes('padding:2px 8px;border-radius:10px;background:'));
  assert.ok(gross.includes('padding:5px 14px;border-radius:14px;background:'));
  for (const [key, farbe] of [['abrechenbar', '#2563eb'], ['abgesetzt', '#be185d'], ['teilabsetzung', '#ea580c']]) {
    assert.ok(m.statusBadge(key).includes(`color:${farbe};`), `${key} trägt ${farbe}`);
    assert.ok(css.includes(`[style*="color:${farbe}"]::before`), `CSS-Ton für ${farbe}`);
  }
  // Neutral bleiben: In Behandlung, Abgerechnet, Entwurf, Abgelehnt dürfen keine Ton-Farbe teilen.
  for (const key of ['aktiv', 'abgerechnet', 'parsed', 'rejected', 'confirmed', 'storniert']) {
    const h = m.statusBadge(key);
    assert.ok(!['#2563eb', '#be185d', '#ea580c'].some((f) => h.includes(`color:${f};`)), `${key} neutral`);
  }
  assert.ok(m.bereichBadge('physio').includes('text-transform:uppercase;color:#15803d;'));
  assert.ok(m.bereichBadge('podologie', { gross: true }).includes('text-transform:uppercase;color:#0e7490;'));
});

test('Merkmal- und Kassenart-Muster stehen noch so im Quelltext', () => {
  const detail = readFileSync(new URL('../module/verordnung-detail.js', import.meta.url), 'utf8');
  const liste = readFileSync(new URL('../module/patientenliste.js', import.meta.url), 'utf8');
  assert.ok(detail.includes('padding:2px 8px;border-radius:12px;border:1px solid ${farbe}'));
  assert.ok(detail.includes("BITTE_PRUEFEN_FARBE]") && detail.includes("'#ef4444'"));
  assert.ok(liste.includes('padding:1px 5px;border-radius:8px;margin-left:5px;'));
  assert.ok(css.includes('[style*="border:1px solid #ef4444"]::before') && css.includes('[style*="border:1px solid #f59e0b"]::before'));
});
