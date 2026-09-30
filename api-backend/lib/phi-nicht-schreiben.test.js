// Reform 3.12 (30.09.2026): der rohe OCR-Payload und die halbfertigen
// Feldverschluesselungs-Spalten werden nicht mehr geschrieben. Quelltext-Waechter:
// server.js ist nicht importierbar (startet Express), also wird der Text der beiden
// Handler geprueft. Faellt er, hat jemand die Spalten wieder eingebaut.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const quelle = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'server.js'), 'utf8');

function handler(start, ende) {
  const a = quelle.indexOf(start);
  assert.ok(a >= 0, `${start} nicht gefunden`);
  const b = quelle.indexOf(ende, a + start.length);
  assert.ok(b > a, `${ende} nicht gefunden`);
  return quelle.slice(a, b);
}

const confirmText = handler("app.post('/api/rezept/confirm'", "app.post('/api/rezept/save'");
const patchText = handler("app.patch('/api/rezept/:id'", "\napp.", );

for (const [name, text] of [['confirm', confirmText], ['patch', patchText]]) {
  test(`/rezept ${name}: keine Roh-/Schattenspalten im Schreibpfad`, () => {
    for (const feld of ['ocr_raw_response', 'ocr_raw_enc', 'icd10_enc', 'phi_encrypted', 'encryptPHI', 'encryptionAvailable']) {
      assert.equal(text.includes(feld), false, `${feld} darf im ${name}-Handler nicht vorkommen`);
    }
  });
  test(`/rezept ${name}: OCR-Payload wird nicht in Logs umgeleitet`, () => {
    assert.equal(/console\.\w+\([^)]*\bparsed\b/.test(text), false);
    assert.equal(/(captureException|captureMessage|setExtra|setContext)\([^)]*\bparsed\b/.test(text), false);
  });
}

test('server.js: encryptPHI-Import entfernt, phi-encrypt.js bleibt', () => {
  assert.equal(quelle.includes("from './lib/phi-encrypt.js'"), false);
  assert.ok(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'phi-encrypt.js'), 'utf8').includes('encryptPHI'));
});
