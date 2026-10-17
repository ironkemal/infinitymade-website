import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const begin = source.indexOf('if (process.env.SITE_URL &&');
const block = source.slice(begin, source.indexOf('\napp.use(cors(', begin));
test('Kundenbox: echte CORS-Initialisierung normalisiert URL zu Browser-Origin', () => {
  for (const url of ['https://box.example/', 'https://box.example/path', 'http://localhost:8081/setup/']) {
    const context = vm.createContext({ URL, ALLOWED_ORIGINS: [], process: { env: { SITE_URL: url } } });
    vm.runInContext(block, context);
    assert.equal(context.ALLOWED_ORIGINS[0], new URL(url).origin);
  }
});
test('Kundenbox: ungültige Origin-Konfiguration stoppt Start, leere bleibt unverändert', () => {
  for (const url of ['invalid', 'javascript:alert(1)', 'file:///tmp/box']) {
    assert.throws(() => vm.runInContext(block, vm.createContext({ URL, ALLOWED_ORIGINS: [], process: { env: { SITE_URL: url } } })));
  }
  const context = vm.createContext({ URL, ALLOWED_ORIGINS: [], process: { env: {} } });
  vm.runInContext(block, context); assert.equal(context.ALLOWED_ORIGINS.length, 0);
});
