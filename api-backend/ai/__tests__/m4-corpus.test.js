import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { maskPII, scanneReste } from '../pii-mask.js';
import { evaluateCorpus } from '../../../spike/ki-maske/benchmark.mjs';

// The third corpus was sealed and evaluated after runtime freeze. Its later
// use here is regression, not another unseen validation. This gate prevents regression;
// it does not grant unrestricted free-text processing or provider activation.
const fixtures = [
  { file: 'korpus.json', hash: 'f46174856b2427c9379128209542a2fd1b22785a5aea1946cfa2b45c439c3948', cases: 60, truth: 151, leaks: 0, negative: 0, fp: 0, maximumBlocked: 1 },
  { file: 'korpus2.json', hash: '1cfd65625535df058d93dfebbf8286f63f79226b918a4f5db1b4883f5371f8e6', cases: 50, truth: 139, leaks: 15, negative: 7, fp: 1, maximumBlocked: 14 },
  { file: 'korpus3-cold.json', hash: '34909b0efe921e065c841b344a99a7e2e77fa91ed5e75fe4beaf2fb7b594f90b', cases: 42, truth: 156, leaks: 36, negative: 14, fp: 0, maximumBlocked: 1 }
];

for (const fixture of fixtures) test(`M4 corpus regression: ${fixture.file}`, async () => {
  const bytes = fs.readFileSync(new URL(`./fixtures/${fixture.file}`, import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), fixture.hash, 'Do not weaken the gate by changing the corpus');
  const document = JSON.parse(bytes);
  const { summary } = await evaluateCorpus(Array.isArray(document) ? document : document.cases, { maskFn: maskPII, scanFn: scanneReste });
  assert.equal(summary.cases, fixture.cases);
  assert.equal(summary.totalTruth, fixture.truth);
  assert.equal(summary.negativeCases, fixture.negative);
  assert.equal(summary.errors, 0);
  assert.equal(summary.roundtripFailures, 0);
  assert.ok(summary.effectiveLeaks <= fixture.leaks, 'Measured post-M4 baseline may decrease, never increase');
  assert.ok(summary.negativeFP <= fixture.fp);
  assert.ok(summary.blockedCases <= fixture.maximumBlocked, 'Blocking every case is not a quality improvement');
  assert.ok(summary.sentTruth >= fixture.truth / 2, 'Useful positive coverage must remain');
});
