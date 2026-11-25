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

test('avatarPfadAusUrl: nur eigener avatars-Pfad aus öffentlicher URL, sonst null', async () => {
  const { avatarPfadAusUrl } = await import('./praxis-logo-upload.js');
  const uid = '11111111-1111-4111-8111-111111111111';
  assert.equal(avatarPfadAusUrl(`https://storage.example/storage/v1/object/public/avatars/${uid}/1732000000000.jpg`), `${uid}/1732000000000.jpg`);
  assert.equal(avatarPfadAusUrl(`https://storage.example/storage/v1/object/public/avatars/${uid}/profilfoto.jpg?t=123`), `${uid}/profilfoto.jpg`);
  for (const u of [null, '', 'https://evil.example/a.jpg', `https://x/storage/v1/object/public/andere/${uid}/a.jpg`, `https://x/storage/v1/object/public/avatars/${uid}/../a.jpg`, `https://x/storage/v1/object/public/avatars/kein-uuid/a.jpg`]) {
    assert.equal(avatarPfadAusUrl(u), null, String(u));
  }
});

test('Team-Detail „Profilbild entfernen“ löscht die Datei vor dem Leeren des Verweises', () => {
  const src = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  const i = src.indexOf("getElementById('empAvatarRemoveBtn').onclick");
  const block = src.slice(i, src.indexOf("showToast('Profilbild entfernt')", i));
  assert.ok(block.indexOf("await entferneProfilfoto(supabase, empId, m.avatar_url)") > 0 && block.indexOf("await entferneProfilfoto(supabase, empId, m.avatar_url)") < block.indexOf("update({ avatar_url: null })"));
});

test('Entfernen berücksichtigt Mitarbeiterordner, Storage-Adresse und Fehler', async () => {
  const { entferneProfilfoto } = await import('./praxis-logo-upload.js');
  const uid = '11111111-1111-4111-8111-111111111111';
  const basis = 'https://storage.example/storage/v1/object/public/avatars/';
  const fest = `${uid}/profilfoto.jpg`;
  const alt = `${uid}/1732000000000.jpg`;
  let entfernt;
  const bucket = {
    getPublicUrl: (pfad) => ({ data: { publicUrl: basis + pfad } }),
    remove: async (pfade) => { entfernt = pfade; return {}; },
  };
  const sb = { storage: { from: () => bucket } };
  await entferneProfilfoto(sb, uid, basis + alt + '?t=1');
  assert.deepEqual(entfernt, [fest, alt]);
  for (const url of [basis + fest, basis + alt.replace('11111111-', '22222222-'),
    basis + uid + '/praxis-logo.png', (basis + alt).replace('storage.example', 'anders.example')]) {
    await entferneProfilfoto(sb, uid, url);
    assert.deepEqual(entfernt, [fest]);
  }
  bucket.remove = async () => ({ error: true });
  await assert.rejects(entferneProfilfoto(sb, uid, basis + alt), /nicht entfernt/);
});
