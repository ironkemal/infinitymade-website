/** Review-only: applies prepared HTML patches in a temporary directory, never to product files. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const meta = JSON.parse(await readFile(new URL('./V10-KANDIDAT.json', import.meta.url), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const base = execFileSync('git', ['show', `${meta.baseCommit}:dashboard.html`], { cwd: root, encoding: 'utf8' });
assert.equal(hash(base), meta.htmlSha256.base);
assert.equal(hash(await readFile(join(root, 'dashboard.html'))), meta.htmlSha256.base, 'HTML-Kandidat veraltet: nach Integration neu erzeugen');
for (const [path, expected] of Object.entries(meta.protectedFiles)) {
  assert.equal(hash(await readFile(join(root, path))), expected, `${path}: Kandidat nach Integration neu erzeugen`);
}
const dir = await mkdtemp(join(tmpdir(), 'praxura-v10-boot-'));
await writeFile(join(dir, 'dashboard.html'), base);
const versions = { base };
for (const [version, file] of [['release', 'V10-RELEASE.patch'], ['rollback', 'V10-ROLLBACK.patch']]) {
  const patch = fileURLToPath(new URL(file, import.meta.url));
  const paths = execFileSync('git', ['apply', '--numstat', patch], { cwd: dir, encoding: 'utf8' }).trim().split('\n');
  assert.equal(paths.length, 1); assert.equal(paths[0].split('\t')[2], 'dashboard.html');
  execFileSync('git', ['apply', '--check', patch], { cwd: dir });
  execFileSync('git', ['apply', patch], { cwd: dir });
  versions[version] = await readFile(join(dir, 'dashboard.html'), 'utf8');
  assert.equal(hash(versions[version]), meta.htmlSha256[version]);
}
const states = [
  { name: 'frisches Profil', baseNeu: false },
  { name: 'Bestand dunkel', storage: { 'im-theme': 'dark' }, baseNeu: false },
  { name: 'gespeichertes Alt', storage: { 'px-design': 'alt' }, baseNeu: false },
  { name: 'Storage gesperrt', blocked: true, baseNeu: false },
  { name: 'OAuth-Rueckkehr', search: '?code=synthetic', baseNeu: false },
  { name: 'Kalender-Deep-Link', search: '?panel=calendar', hash: '#calendar', baseNeu: false },
  { name: 'gespeichertes Neu', storage: { 'px-design': 'neu' }, baseNeu: true },
  { name: 'explizites Neu', search: '?design=neu', baseNeu: true },
  { name: 'Alt vor gespeichertem Neu', search: '?design=alt', storage: { 'px-design': 'neu', 'im-theme': 'dark' }, baseNeu: false },
  { name: 'Alt trotz gesperrtem Storage', search: '?design=alt', blocked: true, baseNeu: false },
  { name: 'Neu trotz gesperrtem Storage', search: '?design=neu', blocked: true, baseNeu: true },
];
let cases = 0;
for (const [version, html] of Object.entries(versions)) {
  const script = html.match(/<script>(\(function\(\)\{var h=document\.documentElement;[\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'Originaler Head-Boot fehlt');
  for (const state of states) {
    const attrs = new Map(version === 'rollback' ? [['data-design', 'neu']] : []), store = { preference: 'behalten', ...state.storage }, before = { ...store }, writes = [];
    vm.runInNewContext(script, {
      document: { documentElement: { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k) } },
      location: { search: state.search || '', hash: state.hash || '' }, URLSearchParams,
      localStorage: {
        getItem(k) { if (state.blocked) throw new Error('synthetisch gesperrt'); return store[k] ?? null; },
        setItem(k, v) { writes.push(k); if (state.blocked) throw new Error('synthetisch gesperrt'); store[k] = v; },
        removeItem(k) { writes.push(k); if (state.blocked) throw new Error('synthetisch gesperrt'); delete store[k]; },
      },
    }, { timeout: 1000 });
    const expected = version === 'base' ? state.baseNeu : version === 'release' && state.search !== '?design=alt';
    assert.equal(attrs.get('data-design') === 'neu', expected, `${version}: ${state.name}`);
    assert.equal(attrs.get('data-theme'), !state.blocked && state.storage?.['im-theme'] === 'dark' ? 'dark' : undefined);
    if (version !== 'base') { assert.deepEqual(store, before); assert.deepEqual(writes, []); }
    cases++;
  }
}
// Current boot gateway follows only HTML attribute; stored Neu cannot bypass a global rollback.
const boot = await readFile(join(root, 'module/neu-start.js'), 'utf8');
assert.match(boot, /document\.documentElement\.dataset\.design === 'neu'/);
assert.doesNotMatch(boot, /localStorage|sessionStorage/);
console.log(JSON.stringify({ status: 'PASS', baseCommit: meta.baseCommit, cases, states: states.length, versions: Object.keys(versions), temporaryArtifact: dir, productFilesChanged: false, runtimeHeadersOrCustomerUpdateVerified: false }));
