import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validiereBarcodeErfassung, computedMitErfassung } from './rezept-erfassung.js';

const quelle = { quelle:'barcode', format:'PDF417', parser_version:'KBV-BFB-4.80-M13-10', bestaetigt:true };
test('Barcode-Provenienz braucht Papierbestätigung und feste Formatversion', () => {
  assert.deepEqual(validiereBarcodeErfassung(quelle), quelle);
  for (const input of [{...quelle,bestaetigt:false}, {...quelle,format:'QR'}, {...quelle,parser_version:'09'},
                       {...quelle,patient:'Nicht speichern'}, {}, 'barcode']) {
    assert.throws(() => validiereBarcodeErfassung(input), /Papier/);
  }
});
test('Revalidierung erhält Provenienz und markiert Bearbeitung, ohne alte Berechnung zu behalten', () => {
  const created = computedMitErfassung({gueltig_bis:'2026-12-01'}, quelle);
  assert.throws(() => computedMitErfassung({gueltig_bis:'2026-12-02'}, null, created), /erneut/);
  const edited = computedMitErfassung({gueltig_bis:'2026-12-02'}, quelle, created);
  assert.equal(edited.erfassung.quelle,'barcode+korrigiert');
  assert.equal(edited.gueltig_bis,'2026-12-02');
  assert.equal(created.erfassung.quelle,'barcode');
  assert.equal(computedMitErfassung(null,quelle,edited).erfassung.quelle,'barcode+korrigiert');
  assert.equal(computedMitErfassung(null),null);
});
test('Backend-Mapping im API-Image ist identisch mit kanonischer Browserquelle', async () => {
  const [canonical, image] = await Promise.all([
    readFile(new URL('../../module/podologie-heilmittel-position.js', import.meta.url)),
    readFile(new URL('./podologie-heilmittel-position.js', import.meta.url)),
  ]);
  assert.deepEqual(image,canonical,'node tools/vendor/build-barcode.mjs ausführen');
});
