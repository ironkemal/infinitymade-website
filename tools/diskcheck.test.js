import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDisk, diskcheckCli, parseDf } from './diskcheck.mjs';

const df = percent => `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/synthetic 1000 ${percent * 10} ${1000 - percent * 10} ${percent}% /synthetic path\n`;
const runner = (blocks, inodes, calls = []) => async (command, args) => {
  calls.push({ command, args });
  return { stdout: df(args[0] === '-Pk' ? blocks : inodes) };
};

test('Block- und Inodeschwellen werden unabhängig einschließlich Grenzwerten geprüft', async () => {
  for (const [blocks, inodes, expected] of [[79, 79, 0], [80, 10, 1], [10, 80, 1], [90, 10, 2], [10, 100, 2]]) {
    const calls = [];
    const result = await checkDisk({ path: '/synthetic path', run: runner(blocks, inodes, calls) });
    assert.equal(result.exitCode, expected);
    assert.deepEqual(calls, [
      { command: 'df', args: ['-Pk', '/synthetic path'] },
      { command: 'df', args: ['-Pi', '/synthetic path'] },
    ]);
  }
});

test('fehlerhafte, fehlende oder nicht unterstützte Messung wird niemals gesund', async () => {
  for (const stdout of ['', df(10) + df(20), df(10).replace('1000', '-'), 'Filesystem Inodes IUsed IFree IUse% Mounted on\n/dev/x - - - - /\n']) {
    const result = await checkDisk({ run: async () => ({ stdout }) });
    assert.equal(result.status, 'UNKNOWN');
    assert.equal(result.exitCode, 3);
  }
  assert.equal((await checkDisk({ run: async () => { throw new Error('private host details'); } })).exitCode, 3);
});

test('BSD-Inodeausgabe mit zusätzlichen Spalten und Dateisystemnamen wird gelesen', () => {
  const text = 'Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on\n/dev/x 1000 500 500 50% 90 10 90% /\n';
  assert.deepEqual(parseDf(text, 'inodes'), { total: 100, used: 90, free: 10, percent: 90 });
});

test('CLI validiert Argumente vor jedem Befehl und beschreibt fehlende Alarmierung', async () => {
  const forbidden = async () => { assert.fail('Kein Prozess bei ungültiger Eingabe'); };
  for (const args of [['--path', '-x'], ['--warning', '90', '--critical', '80'], ['--critical', '101'], ['--warning'], ['--oops', '1'], ['--warning', '80', '--warning', '81']]) {
    assert.equal((await diskcheckCli(args, forbidden)).exitCode, 3);
  }
  assert.match((await diskcheckCli(['--help'], forbidden)).help, /Keine Alarmierung/);
  assert.equal((await diskcheckCli(['--warning', '70', '--critical', '80'], runner(75, 10))).exitCode, 1);
});
