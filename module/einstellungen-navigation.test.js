import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KATEGORIEN, kategorieVon, sichtbareKategorien, aktiveKategorie } from './einstellungen-navigation.js';

test('bekannte Abschnitte landen in Melihs Kategorien', () => {
  assert.equal(kategorieVon({ id: 'settingsSystemSection' }), 'system');
  assert.equal(kategorieVon({ id: 'settingsDatevSection' }), 'datev');
  assert.equal(kategorieVon({ id: 'settingsRechtslinksSection' }), 'recht');
  assert.equal(kategorieVon({ id: 'settingsBusinessesSection' }), 'standorte');
  assert.equal(kategorieVon({ id: 'settingsKiSection' }), 'ki');
  assert.equal(kategorieVon({ id: '', titelSchluessel: 'set_password' }), 'konto');
});

test('unbekannter (neuer) Abschnitt geht nie verloren: Allgemein', () => {
  assert.equal(kategorieVon({ id: 'settingsNeuSection' }), 'allgemein');
  assert.equal(kategorieVon({}), 'allgemein');
});

test('jede Abschnitts-ID in dashboard.html ist zugeordnet (Drift-Wächter)', () => {
  const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  const start = html.indexOf('id="panel-settings"');
  const block = html.slice(start, html.indexOf('</section>', start));
  const ids = [...block.matchAll(/class="settings-section"[^>]*id="([A-Za-z]+)"|id="([A-Za-z]+)"[^>]*class="settings-section"/g)].map((m) => m[1] || m[2]);
  assert.ok(ids.length >= 15, `nur ${ids.length} Abschnitte gefunden`);
  const src = readFileSync(new URL('./einstellungen-navigation.js', import.meta.url), 'utf8');
  for (const id of ids) assert.ok(src.includes(`${id}:`), `${id} fehlt in NACH_ID — sonst landet er stumm in „Allgemein“`);
});

test('nur Kategorien mit sichtbarem Abschnitt, Reihenfolge fest', () => {
  const s = sichtbareKategorien([
    { kategorie: 'system', sichtbar: false },
    { kategorie: 'konto', sichtbar: true },
    { kategorie: 'allgemein', sichtbar: true },
  ]);
  assert.deepEqual(s.map((k) => k.id), ['allgemein', 'konto']);
  assert.equal(KATEGORIEN[0].id, 'allgemein');
});

test('gemerkte Kategorie nur, wenn noch sichtbar', () => {
  const sichtbar = [{ id: 'allgemein', label: 'A' }, { id: 'konto', label: 'K' }];
  assert.equal(aktiveKategorie('konto', sichtbar), 'konto');
  assert.equal(aktiveKategorie('system', sichtbar), 'allgemein');
  assert.equal(aktiveKategorie(null, []), 'allgemein');
});
