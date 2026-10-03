import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('podo-empfangsnachweis-gates harness runs via spawnSync with --experimental-test-module-mocks', () => {
  const harnessAbs = fileURLToPath(new URL('./podo-empfangsnachweis-gates.harness.mjs', import.meta.url));
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ['--experimental-test-module-mocks', '--test', '--test-reporter=tap', harnessAbs], {
    env: childEnv,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (res.status !== 0) {
    console.error('STDOUT:', res.stdout);
    console.error('STDERR:', res.stderr);
  }

  assert.equal(res.status, 0, `Harness exited with code ${res.status}: ${res.stderr || res.stdout}`);
  assert.match(res.stdout, /# pass/);
});
