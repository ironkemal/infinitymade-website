import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLeak, messe } from './messen.mjs';

test('oracle detects short names without harmless substring matches', () => {
  assert.equal(checkLeak({type:'NAME',value:'Li'}, 'Li kommt').isLeak, true);
  assert.equal(checkLeak({type:'NAME',value:'Ann'}, 'Planung und Annahme').isLeak, false);
  assert.equal(checkLeak({type:'NAME',value:'Anna Müller'}, 'Müller kommt').isLeak, true);
});
test('oracle normalizes canonical Unicode and compatibility forms', () => {
  assert.equal(checkLeak({type:'NAME',value:'Éva'}, 'E\u0301va kommt').isLeak, true);
  assert.equal(checkLeak({type:'KVNR',value:'A123456789'}, 'Ａ１２３４５６７８９').isLeak, true);
  assert.throws(()=>checkLeak({type:'NAME',value:'Li'}, null), /string/);
});
test('measurement rejects missing, wrong-type or empty output for nonempty text', () => {
  const dir=mkdtempSync(join(tmpdir(),'praxura-oracle-'));
  const corpusPath=join(dir,'corpus.json');
  writeFileSync(corpusPath,JSON.stringify([{id:'invalid-output',task:'unit',text:'Li kommt',entities:[],pii_truth:[{type:'NAME',value:'Li'}]}]));
  try {
    for (const result of [undefined,{}, {masked:42}, {masked:''}, {masked:'   '}]) {
      assert.throws(()=>messe(()=>result,{corpusPath,writeJson:false,silent:true}),/Invalid\/empty/);
    }
  } finally { rmSync(dir,{recursive:true}); }
});
