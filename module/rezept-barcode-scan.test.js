import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLatin15, pruefeScanDatei, scanneRezeptLokal, zaehleBarcode, leseBarcodeZaehler } from './rezept-barcode-scan.js';

test('Latin-15 decodes the eight replacements and umlauts without Unicode recoding', () => {
  assert.equal(decodeLatin15(Uint8Array.of(164,166,168,180,184,188,189,190,252,223)), '€ŠšŽžŒœŸüß');
});

test('Scanner rejects large and non-image/PDF inputs before loading decoder', async () => {
  for(const file of [{size:21*1024*1024,type:'image/png'}, {size:4,type:'text/html'}]) {
    assert.throws(()=>pruefeScanDatei(file), /20 MB/);
  }
  for(const uri of ['https://example.invalid/rezept.png', 'data:text/html;base64,eA==', 'data:image/png;base64,!']) {
    await assert.rejects(scanneRezeptLokal(uri), /Ungültige/);
  }
});

test('Aborted input never reaches image rendering or provider loading', async () => {
  const controller=new AbortController();controller.abort();
  await assert.rejects(scanneRezeptLokal('data:image/png;base64,eA==',{signal:controller.signal}), {name:'AbortError'});
});

test('Counters persist only two bounded numbers and ignore unknown keys', () => {
  const previous=globalThis.localStorage;
  let stored='{"barcode_ok":4,"fallback_manuell":-1,"patient":"synthetic"}';
  globalThis.localStorage={getItem:()=>stored,setItem:(_key,value)=>{stored=value;}};
  try {
    assert.deepEqual(leseBarcodeZaehler(),{barcode_ok:4,fallback_manuell:0});
    zaehleBarcode('barcode_ok');zaehleBarcode('patient');
    assert.deepEqual(JSON.parse(stored),{barcode_ok:5,fallback_manuell:0});
    stored='{"barcode_ok":9007199254740991,"fallback_manuell":0}';
    zaehleBarcode('barcode_ok');
    assert.equal(JSON.parse(stored).barcode_ok,Number.MAX_SAFE_INTEGER);
  } finally {globalThis.localStorage=previous;}
});
