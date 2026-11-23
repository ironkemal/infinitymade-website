// KI-Aufgaben einzeln an/aus (Phase 7b, 23.11.2026) — Store, Zuordnung, Gateway, Route.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAufgabenSperreStore, aufgabeErlaubt, gruppeVonAufgabe, AUFGABEN_GRUPPEN, aufgabenListe } from './ki-aufgaben-sperre.js';
import { run as series } from './tasks/series-scheduler.js';

const id = '11111111-1111-4111-8111-111111111111';
const fremd = '22222222-2222-4222-8222-222222222222';
const owner = { role: 'owner', userId: id, tenantId: id };
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-aufg-')); fs.chmodSync(d, 0o700); return d; };

test('Store: fehlt → nichts gesperrt; Inhaber sperrt; Mitarbeiter darf nicht; ungültige Gruppe 400', async () => {
  const s = createAufgabenSperreStore({ directory: tmp() });
  assert.deepEqual(await s.read(id), { alleGesperrt: false, gesperrt: [], status: 'keine_sperre' });
  await s.set(owner, { gesperrt: ['serie', 'mail'] });
  const r = await s.read(id);
  assert.equal(r.alleGesperrt, false); assert.deepEqual(r.gesperrt, ['mail', 'serie']);
  await assert.rejects(s.set({ role: 'employee', userId: fremd, tenantId: id }, { gesperrt: [] }), { code: 'KI_OWNER_REQUIRED' });
  await assert.rejects(s.set(owner, { gesperrt: ['alles'] }), { code: 'KI_AUFGABEN_UNGUELTIG' });
  await assert.rejects(s.set(owner, { gesperrt: ['mail', 'mail'] }), { code: 'KI_AUFGABEN_UNGUELTIG' });
});

test('Store fail closed: kaputt, falsche Rechte, fremder Mandant, unbekannter Schlüssel → alles gesperrt; set überschreibt', async () => {
  const dir = tmp(); const s = createAufgabenSperreStore({ directory: dir });
  const pfad = path.join(dir, `${id}.aufgaben.json`);
  const schreib = (inhalt, mode = 0o600) => { fs.writeFileSync(pfad, inhalt); fs.chmodSync(pfad, mode); };
  schreib('{kaputt'); assert.equal((await s.read(id)).alleGesperrt, true);
  schreib(JSON.stringify({ tenantId: id, actorId: id, gesperrt: [], geaendertAm: 'x' }), 0o644); assert.equal((await s.read(id)).alleGesperrt, true);
  schreib(JSON.stringify({ tenantId: fremd, actorId: fremd, gesperrt: [], geaendertAm: 'x' })); assert.equal((await s.read(id)).alleGesperrt, true);
  schreib(JSON.stringify({ tenantId: id, actorId: id, gesperrt: [], geaendertAm: 'x', frei: true })); assert.equal((await s.read(id)).alleGesperrt, true);
  schreib('{kaputt'); await s.set(owner, { gesperrt: [] });
  assert.deepEqual(await s.read(id), { alleGesperrt: false, gesperrt: [], status: 'ok' });
  assert.equal((fs.statSync(pfad).mode & 0o777), 0o600);
  assert.equal((await s.read('kein-uuid')).alleGesperrt, true);
});

test('Jede Aufgabe, die executeKiTask ruft, ist einer Gruppe zugeordnet; ohne Gruppe = gesperrt', () => {
  const dir = new URL('./tasks/', import.meta.url);
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(new URL(f, dir), 'utf8');
    if (!src.includes('executeKiTask')) continue;
    for (const m of src.matchAll(/task:\s*'([a-z0-9-]+)'/g)) assert.ok(gruppeVonAufgabe(m[1]), `${f}: Aufgabe ${m[1]} ohne Gruppe`);
  }
  assert.equal(aufgabeErlaubt('neue-aufgabe', { alleGesperrt: false, gesperrt: [] }), false);
  assert.equal(aufgabeErlaubt('series-scheduler', { alleGesperrt: false, gesperrt: [] }), true);
  assert.equal(aufgabeErlaubt('series-scheduler', { alleGesperrt: false, gesperrt: ['serie'] }), false);
  assert.equal(aufgabeErlaubt('series-scheduler', { alleGesperrt: true, gesperrt: [] }), false);
  assert.equal(aufgabeErlaubt('series-scheduler', null), false);
  assert.ok(!Object.values(AUFGABEN_GRUPPEN).some((g) => g.aufgaben.includes('rezept-validate')), 'rezept-validate ruft kein Modell');
  assert.deepEqual(aufgabenListe({ alleGesperrt: false, gesperrt: ['diktat'] }).map((a) => [a.id, a.gesperrt]), [['mail', false], ['serie', false], ['diktat', true], ['rezept', false]]);
});

const cfg = { mode: 'jeton', valid: true, activationReady: true, mailReady: true, allowFreeText: false };
const payload = { count: 1, recurrence: 'weekly', sector: 'physiotherapy', targetDates: ['2026-10-09'], emptyDates: [], candidates: [{ date: '2026-10-09', time: '10:00', employeeId: 'emp-1', bucket: 0 }], employees: [{ id: 'emp-1', name: 'Synthetische Therapeutin', anrede: 'Frau' }], service: { title: 'Manuelle Therapie', duration: 30 }, customer: { id: 'c-1', name: 'Synthetischer Patient' }, preferences: { sameEmployee: 'always', preferredEmployee: 'emp-1' }, previousSelected: [] };

test('Gateway: gesperrte Aufgabe → AI_TASK_GESPERRT, kein Modellaufruf; freie Aufgabe läuft', async () => {
  let aufrufe = 0;
  const transport = async (o) => { aufrufe++; const p = JSON.parse(o.messages.find((m) => m.role === 'user').content); return { content: JSON.stringify({ selected: p.candidates.map(({ date, time, employeeId }) => ({ date, time, employeeId })), report: 'ok' }), model: 'x', deployment: 'y', usage: { total_tokens: 1 }, latency_ms: 1 }; };
  const kontext = (sperre) => ({ tenantId: id, userId: id, role: 'owner', dependencies: { config: cfg, ownerDecision: { enabled: true }, dictionary: [], transport, aufgabenSperre: sperre } });
  await assert.rejects(series(payload, kontext({ alleGesperrt: false, gesperrt: ['serie'] })), { code: 'AI_TASK_GESPERRT' });
  await assert.rejects(series(payload, kontext({ alleGesperrt: true, gesperrt: [] })), { code: 'AI_TASK_GESPERRT' });
  assert.equal(aufrufe, 0);
  const ok = await series(payload, kontext({ alleGesperrt: false, gesperrt: ['mail'] }));
  assert.equal(ok.selected.length, 1); assert.equal(aufrufe, 1);
});

test('Gateway: Sperre wird an jeder Stelle geprüft, an der die Freischaltung erneut geprüft wird', () => {
  const src = fs.readFileSync(new URL('./ki-gateway.js', import.meta.url), 'utf8');
  const owner = (src.match(/AI_OWNER_OPTIN_REQUIRED/g) || []).length;
  const sperre = (src.match(/await pruefeAufgabeFrei\(task, auth, dependencies\)/g) || []).length;
  assert.ok(owner >= 6 && sperre >= owner, `Freischaltungs-Prüfungen ${owner}, Sperr-Prüfungen ${sperre}`);
});
