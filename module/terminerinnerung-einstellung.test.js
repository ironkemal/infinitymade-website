import test from 'node:test';
import assert from 'node:assert/strict';
import { schalterSichtbar, speichereSchalter, WIRKUNG_TEXT, VORAUSSETZUNG_TEXT } from './terminerinnerung-einstellung.js';

test('sichtbar nur fuer Inhaber UND nur wenn die Spalte im Profil existiert (SaaS ohne 0110: versteckt)', () => {
  assert.equal(schalterSichtbar({ role: 'owner', terminerinnerung_aktiv: false }), true);
  assert.equal(schalterSichtbar({ role: 'owner', terminerinnerung_aktiv: true }), true);
  assert.equal(schalterSichtbar({ role: 'owner' }), false);                                  // Spalte fehlt
  assert.equal(schalterSichtbar({ role: 'employee', terminerinnerung_aktiv: true }), false); // Mitarbeiter
  assert.equal(schalterSichtbar({ role: 'owner', terminerinnerung_aktiv: null }), false);
  assert.equal(schalterSichtbar(null), false);
});

test('speichereSchalter schreibt genau die Inhaber-Zeile und nur ein echtes boolean', async () => {
  const aufrufe = [];
  const supabase = { from(t) { return { update(w) { aufrufe.push({ t, w }); return { eq(k, v) { aufrufe.at(-1).eq = [k, v]; return Promise.resolve({ error: null }); } }; } }; } };
  assert.deepEqual(await speichereSchalter(supabase, 'owner-1', true), { ok: true });
  assert.deepEqual(aufrufe[0], { t: 'profiles', w: { terminerinnerung_aktiv: true }, eq: ['id', 'owner-1'] });
  await speichereSchalter(supabase, 'owner-1', 'ja');                   // kein boolean -> aus
  assert.equal(aufrufe[1].w.terminerinnerung_aktiv, false);
  assert.deepEqual(await speichereSchalter(supabase, null, true), { ok: false, fehler: 'Kein Benutzer angemeldet.' });
  assert.equal(aufrufe.length, 2, 'ohne Benutzer kein Schreibzugriff');
});

test('speichereSchalter meldet Datenbankfehler ohne Rohtext', async () => {
  const supabase = { from() { return { update() { return { eq: () => Promise.resolve({ error: { message: 'secret detail', code: '42501' } }) }; } }; } };
  const r = await speichereSchalter(supabase, 'o', true);
  assert.equal(r.ok, false); assert.doesNotMatch(r.fehler, /secret|42501/);
});

test('Texte: ehrlich zu Voraussetzung, Einwilligung und telefonischer Absage; kein Link versprochen', () => {
  assert.match(WIRKUNG_TEXT, /zugestimmt/); assert.match(WIRKUNG_TEXT, /telefonisch/);
  assert.match(WIRKUNG_TEXT, /keinen Namen/); assert.doesNotMatch(WIRKUNG_TEXT, /Link|absagen Sie per/i);
  assert.match(VORAUSSETZUNG_TEXT, /E-Mail-Versand/); assert.match(VORAUSSETZUNG_TEXT, /nicht über Praxura/);
});
