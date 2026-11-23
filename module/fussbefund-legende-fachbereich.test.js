// Pflichtpunkt 2 (Box-Test 22.11.2026): „Legende der Fußgrafik“ nur für Podologie-Inhaber.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Legende bleibt für Physio-Inhaber und Mitarbeiter verborgen', async () => {
  const section = { hidden: false };
  globalThis.document = /** @type {any} */ ({ getElementById: (id) => (id === 'settingsLegendeSection' ? section : null) });
  try {
    const { renderLegendeSettings } = await import('./fussbefund.js');
    const keinDb = { from() { throw new Error('darf für Physio nicht laden'); } };
    await renderLegendeSettings({ profile: { role: 'owner' }, sector: () => 'physiotherapy', supabase: keinDb, ownerId: () => 'o' });
    assert.equal(section.hidden, true);
    section.hidden = false;
    await renderLegendeSettings({ profile: { role: 'employee' }, sector: () => 'podologie', supabase: keinDb, ownerId: () => 'o' });
    assert.equal(section.hidden, true);
  } finally {
    delete globalThis.document;
  }
});
