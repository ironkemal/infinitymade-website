// „Mein Profil“ (Phase 7b, 23.11.2026): Name + Foto selbst pflegen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { profilPatch, SECTION_ID } from './mein-profil.js';
import { MITARBEITER_ABSCHNITTE, NACHGELADEN } from './einstellungen-nav.js';

test('Inhaber: nur Vor-/Nachname, nie business_name (= Praxisname)', () => {
  const r = profilPatch('owner', { vorname: '  Anna ', nachname: 'Muster\n', anzeigename: 'X' });
  assert.deepEqual(r, { ok: true, patch: { owner_first_name: 'Anna', owner_last_name: 'Muster' } });
  assert.deepEqual(profilPatch('owner', { vorname: '', nachname: '' }), { ok: true, patch: { owner_first_name: null, owner_last_name: null } });
  assert.equal(profilPatch('owner', { vorname: 'x'.repeat(81) }).ok, false);
});

test('Mitarbeiter: nur Anzeigename (business_name), Pflicht, begrenzt, Steuerzeichen raus', () => {
  assert.deepEqual(profilPatch('employee', { anzeigename: ' Synthetische\tTherapeutin ' }), { ok: true, patch: { business_name: 'Synthetische Therapeutin' } });
  assert.equal(profilPatch('employee', { anzeigename: '   ' }).ok, false);
  assert.equal(profilPatch('employee', { anzeigename: 'x'.repeat(81) }).ok, false);
  const p = profilPatch('employee', { anzeigename: 'A', vorname: 'B' });
  assert.deepEqual(Object.keys(p.ok ? p.patch : {}), ['business_name']);
});

test('für Mitarbeiter sichtbar, in „Mein Konto“, in dashboard.js vor der Navigation gerendert', () => {
  assert.ok(MITARBEITER_ABSCHNITTE.has(SECTION_ID));
  assert.equal(NACHGELADEN[SECTION_ID], 'konto');
  const src = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  const i = src.indexOf('renderMeinProfil({'); const j = src.indexOf('einstellungenKategorienAufbauen({');
  assert.ok(i > 0 && i < j, 'renderMeinProfil vor einstellungenKategorienAufbauen');
});

test('Foto nur in den eigenen Ordner, JPEG, fester Name', async () => {
  const { ladeProfilfotoHoch } = await import('./praxis-logo-upload.js');
  let gesehen;
  const sb = { storage: { from: (b) => { assert.equal(b, 'avatars'); return { async upload(path, blob, opts) { gesehen = { path, opts }; return {}; }, getPublicUrl: () => ({ data: { publicUrl: 'https://example.org/a.jpg' } }) }; } } };
  const uid = '11111111-1111-4111-8111-111111111111';
  const url = await ladeProfilfotoHoch(sb, uid, new Blob(['x'], { type: 'image/jpeg' }));
  assert.match(url, /^https:\/\/example\.org\/a\.jpg\?t=\d+$/);
  assert.deepEqual(gesehen, { path: `${uid}/profilfoto.jpg`, opts: { upsert: true, contentType: 'image/jpeg' } });
  await assert.rejects(ladeProfilfotoHoch(sb, '../fremd', new Blob(['x'], { type: 'image/jpeg' })));
  await assert.rejects(ladeProfilfotoHoch(sb, uid, new Blob(['x'], { type: 'image/png' })));
});
