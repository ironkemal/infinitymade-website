import test from 'node:test';
import assert from 'node:assert/strict';
import { stempelPfad, pruefeStempelDatei, zielGroesse, stempelHochladen, stempelEntfernen, ladeStempelDataUrl, STEMPEL_MAX_BYTES } from './stempel.js';

const OWNER = '11111111-1111-1111-1111-111111111111';

test('Pfad: <owner>/stempel.png, fester Name (upsert)', () => {
  assert.equal(stempelPfad(OWNER), `${OWNER}/stempel.png`);
  assert.throws(() => stempelPfad('../x'), /ungültig/);
  assert.throws(() => stempelPfad(''), /ungültig/);
});

test('Datei: nur PNG/JPEG, nie SVG/WebP/PDF, nicht leer, Eingang höchstens 10 MB', () => {
  assert.equal(pruefeStempelDatei({ type: 'image/png', size: 1000 }).ok, true);
  assert.equal(pruefeStempelDatei({ type: 'image/jpeg', size: 1000 }).ok, true);
  for (const type of ['image/svg+xml', 'image/webp', 'application/pdf', 'text/html', '']) {
    const r = pruefeStempelDatei({ type, size: 1000 });
    assert.equal(r.ok, false, type);
    assert.match(r.meldung, /PNG oder JPEG/);
  }
  assert.equal(pruefeStempelDatei({ type: 'image/png', size: 0 }).ok, false);
  assert.equal(pruefeStempelDatei({ type: 'image/png', size: 11 * 1024 * 1024 }).ok, false);
  assert.equal(pruefeStempelDatei(null).ok, false);
});

test('zielGroesse: nur verkleinern, Seitenverhältnis bleibt, nie 0', () => {
  assert.deepEqual(zielGroesse(2400, 1200), { w: 1200, h: 600 });
  assert.deepEqual(zielGroesse(600, 300), { w: 600, h: 300 });
  assert.deepEqual(zielGroesse(1000, 1), { w: 1000, h: 1 });
  assert.deepEqual(zielGroesse(5000, 2), { w: 1200, h: 1 });
});

function sbStub({ uploadFehler = null, updateZeilen = [{ id: OWNER }], removeFehler = null, download = null } = {}) {
  const log = [];
  const bucket = {
    upload: async (pfad, blob, opt) => { log.push(['upload', pfad, opt]); return { error: uploadFehler }; },
    remove: async (pfade) => { log.push(['remove', pfade]); return { error: removeFehler }; },
    download: async (pfad) => { log.push(['download', pfad]); return download || { data: null, error: new Error('nix') }; },
  };
  const sb = {
    storage: { from: (b) => { log.push(['bucket', b]); return bucket; } },
    from: (tab) => ({ update: (w) => ({ eq: () => ({ select: async () => { log.push(['profil', tab, w]); return { data: updateZeilen, error: null }; } }) }) }),
  };
  return { sb, log };
}
const blobStub = { size: 1234, type: 'image/png' };

test('Hochladen: privater Bucket, fester Pfad, upsert, PNG, danach Pfad (keine URL) ins Profil', async () => {
  const { sb, log } = sbStub();
  const r = await stempelHochladen(sb, { ownerId: OWNER, file: { type: 'image/jpeg', size: 5000 } }, { kodiere: async () => blobStub });
  assert.equal(r.ok, true);
  assert.deepEqual(log[0], ['bucket', 'praxis-stempel']);
  assert.deepEqual(log[1], ['upload', `${OWNER}/stempel.png`, { upsert: true, contentType: 'image/png' }]);
  assert.deepEqual(log[2], ['profil', 'profiles', { praxis_stempel_path: `${OWNER}/stempel.png` }]);
});

test('Hochladen: nach dem Kodieren zu groß -> abgelehnt, nichts hochgeladen', async () => {
  const { sb, log } = sbStub();
  const r = await stempelHochladen(sb, { ownerId: OWNER, file: { type: 'image/png', size: 5000 } },
    { kodiere: async () => ({ size: STEMPEL_MAX_BYTES + 1, type: 'image/png' }) });
  assert.equal(r.ok, false);
  assert.match(r.meldung, /zu groß/);
  assert.equal(log.length, 0);
});

test('Hochladen: falscher Typ -> abgelehnt ohne Kodieren; Upload-Fehler -> Meldung, Profil bleibt', async () => {
  let kodiert = false;
  const { sb } = sbStub();
  const a = await stempelHochladen(sb, { ownerId: OWNER, file: { type: 'image/svg+xml', size: 10 } }, { kodiere: async () => { kodiert = true; return blobStub; } });
  assert.equal(a.ok, false); assert.equal(kodiert, false);
  const s2 = sbStub({ uploadFehler: new Error('403') });
  const b = await stempelHochladen(s2.sb, { ownerId: OWNER, file: { type: 'image/png', size: 10 } }, { kodiere: async () => blobStub });
  assert.equal(b.ok, false);
  assert.ok(!s2.log.some(l => l[0] === 'profil'));
});

test('Hochladen: Profil-Update trifft 0 Zeilen -> ok:false (kein stilles ok)', async () => {
  const { sb } = sbStub({ updateZeilen: [] });
  const r = await stempelHochladen(sb, { ownerId: OWNER, file: { type: 'image/png', size: 10 } }, { kodiere: async () => blobStub });
  assert.equal(r.ok, false);
});

test('Entfernen: Datei weg, Pfad im Profil null', async () => {
  const { sb, log } = sbStub();
  const r = await stempelEntfernen(sb, { ownerId: OWNER });
  assert.equal(r.ok, true);
  assert.deepEqual(log.find(l => l[0] === 'remove'), ['remove', [`${OWNER}/stempel.png`]]);
  assert.deepEqual(log.find(l => l[0] === 'profil')[2], { praxis_stempel_path: null });
});

test('Data-URL: Typ wird fest gesetzt (nicht aus der Datei), Pfad muss dem Schema entsprechen', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const { sb } = sbStub({ download: { data: { arrayBuffer: async () => bytes.buffer, type: 'text/html' }, error: null } });
  const u = await ladeStempelDataUrl(sb, `${OWNER}/stempel.png`);
  assert.match(u, /^data:image\/png;base64,iVBORw==$/);
  assert.equal(await ladeStempelDataUrl(sb, 'https://evil/x.png'), '');
  assert.equal(await ladeStempelDataUrl(sb, ''), '');
});

test('Data-URL: JPEG-Pfad -> image/jpeg; Downloadfehler -> leerer String, kein Wurf', async () => {
  const s = sbStub({ download: { data: { arrayBuffer: async () => new Uint8Array([255, 216]).buffer }, error: null } });
  assert.match(await ladeStempelDataUrl(s.sb, `${OWNER}/stempel.jpg`), /^data:image\/jpeg;base64,/);
  const f = sbStub();
  assert.equal(await ladeStempelDataUrl(f.sb, `${OWNER}/stempel.png`), '');
});
