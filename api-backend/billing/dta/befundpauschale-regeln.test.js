import test from 'node:test';
import assert from 'node:assert/strict';
import { befundpauschaleRegeln, TEDAVI_POSITIONEN } from './befundpauschale-regeln.js';

// ── (a) 78030 ohne 78010/78020 AM SELBEN TAG → hart ────────────────────────

test('78030 allein an einem Tag ist eine harte Sperre', () => {
  const r = befundpauschaleRegeln([{ datum: '2026-09-01', positionen: ['78030'] }]);
  assert.equal(r.hart.length, 1);
  assert.match(r.hart[0], /78030/);
  assert.match(r.hart[0], /01\.09\./);
  assert.equal(r.uebersteuerbar.length, 0);
});

test('78030 mit 78010 am selben Tag ist frei', () => {
  const r = befundpauschaleRegeln([{ datum: '2026-09-01', positionen: ['78030', '78010'] }]);
  assert.equal(r.hart.length, 0);
  assert.equal(r.uebersteuerbar.length, 0);
});

test('78030 mit 78020 am selben Tag ist frei', () => {
  const r = befundpauschaleRegeln([{ datum: '2026-09-01', positionen: ['78030', '78020'] }]);
  assert.equal(r.hart.length, 0);
});

test('78030 an einem Tag, Behandlung an ANDEREM Tag rettet NICHT — (a) ist tagesbezogen', () => {
  const r = befundpauschaleRegeln([
    { datum: '2026-09-01', positionen: ['78030'] },
    { datum: '2026-09-08', positionen: ['78010'] },
  ]);
  assert.equal(r.hart.length, 1);
});

test('mehrere Tage mit 78030 ohne Behandlung ergeben mehrere harte Gründe', () => {
  const r = befundpauschaleRegeln([
    { datum: '2026-09-01', positionen: ['78030'] },
    { datum: '2026-09-08', positionen: ['78030'] },
  ]);
  assert.equal(r.hart.length, 2);
});

// ── (b) 78040 irgendwo, aber KEIN Tag der Verordnung hat 78010/78020 → übersteuerbar ──

test('78040 in einer Verordnung ganz ohne Behandlung ist übersteuerbar, nicht hart', () => {
  const r = befundpauschaleRegeln([{ datum: '2026-09-01', positionen: ['78040'] }]);
  assert.equal(r.hart.length, 0);
  assert.equal(r.uebersteuerbar.length, 1);
  assert.match(r.uebersteuerbar[0], /78040/);
});

test('78040 an einem Tag, 78030 an einem anderen — beide Regeln feuern getrennt', () => {
  const r = befundpauschaleRegeln([
    { datum: '2026-09-01', positionen: ['78040'] },
    { datum: '2026-09-08', positionen: ['78030'] },
  ]);
  assert.equal(r.hart.length, 1);          // 78030 ohne Behandlung am 08.09.
  assert.equal(r.uebersteuerbar.length, 1); // 78040 ohne jede Behandlung in der Verordnung
});

// ── (c) 78040 an einem Tag, Behandlung an einem ANDEREN Tag → frei ────────

test('78040 an einem Tag, 78010 an einem anderen Tag derselben Verordnung ist frei', () => {
  const r = befundpauschaleRegeln([
    { datum: '2026-09-01', positionen: ['78040'] },
    { datum: '2026-09-08', positionen: ['78010'] },
  ]);
  assert.equal(r.hart.length, 0);
  assert.equal(r.uebersteuerbar.length, 0);
});

test('78040 zusammen mit 78020 am selben Tag ist ohnehin frei', () => {
  const r = befundpauschaleRegeln([{ datum: '2026-09-01', positionen: ['78040', '78020'] }]);
  assert.equal(r.hart.length, 0);
  assert.equal(r.uebersteuerbar.length, 0);
});

// ── Normalfall: reine Behandlungsserie ohne Befund-Positionen ─────────────

test('reine Behandlungsserie ohne 78030/78040 loest nichts aus', () => {
  const r = befundpauschaleRegeln([
    { datum: '2026-09-01', positionen: ['78010'] },
    { datum: '2026-09-08', positionen: ['78010'] },
    { datum: '2026-09-15', positionen: ['78020'] },
  ]);
  assert.equal(r.hart.length, 0);
  assert.equal(r.uebersteuerbar.length, 0);
});

// ── Randfälle ───────────────────────────────────────────────────────────

test('leere Seansliste loest nichts aus', () => {
  const r = befundpauschaleRegeln([]);
  assert.equal(r.hart.length, 0);
  assert.equal(r.uebersteuerbar.length, 0);
});

test('undefined/null wird wie leer behandelt', () => {
  assert.deepEqual(befundpauschaleRegeln(undefined), { hart: [], uebersteuerbar: [] });
  assert.deepEqual(befundpauschaleRegeln(null), { hart: [], uebersteuerbar: [] });
});

test('fehlende/leere positionen an einem Tag loesen nichts aus', () => {
  const r = befundpauschaleRegeln([{ datum: '2026-09-01', positionen: [] }, { datum: '2026-09-02' }]);
  assert.equal(r.hart.length, 0);
  assert.equal(r.uebersteuerbar.length, 0);
});

test('Positionsliste bekannt und exportiert (Regressionsschutz gegen stille Erweiterung)', () => {
  assert.deepEqual(TEDAVI_POSITIONEN, ['78010', '78020']);
});

test('Datum ohne ISO-Form wird trotzdem als Text im Grund angezeigt (kein Crash)', () => {
  const r = befundpauschaleRegeln([{ datum: 'kaputt', positionen: ['78030'] }]);
  assert.equal(r.hart.length, 1);
  assert.match(r.hart[0], /kaputt/);
});

// ── S1.12: 78040 nur einmal je Verordnung, nie mit 78030 am selben Tag ──────

test('78040 an zwei Behandlungstagen → hart (nur einmalig)', () => {
  const r = befundpauschaleRegeln([
    { datum: '2026-09-01', positionen: ['78040', '78010'] },
    { datum: '2026-09-08', positionen: ['78040', '78010'] },
  ]);
  assert.equal(r.hart.length, 1);
  assert.match(r.hart[0], /78040.*mehrfach.*01\.09\..*08\.09\..*einmalig/);
});

test('78040 nur an einem Tag → keine Mehrfach-Sperre', () => {
  const r = befundpauschaleRegeln([
    { datum: '2026-09-01', positionen: ['78040', '78010'] },
    { datum: '2026-09-08', positionen: ['78030', '78010'] },
  ]);
  assert.deepEqual(r, { hart: [], uebersteuerbar: [] });
});

test('78040 und 78030 am selben Tag → hart', () => {
  const r = befundpauschaleRegeln([
    { datum: '2026-09-01', positionen: ['78040', '78030', '78010'] },
  ]);
  assert.equal(r.hart.length, 1);
  assert.match(r.hart[0], /78040.*78030.*01\.09\..*zusammen/);
});
