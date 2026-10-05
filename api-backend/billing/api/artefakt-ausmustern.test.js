import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entferneUnsignierteDta, musterAus } from './artefakt-ausmustern.js';
import { ABRECHNUNG_VERSION_FELDER } from './artefakt-version.js';

const O = 'o1', A = 'ab1';
const felder = Object.fromEntries(ABRECHNUNG_VERSION_FELDER.split(',').map(k => [k, null]));
const header = (o = {}) => ({ ...felder, id: A, owner_id: O, updated_at: '2026-10-05T10:00:00.1Z', status: 'erstellt',
  storage_path: 'o1/ab1/d.dta', dta_sha256: 'a'.repeat(64), signed_storage_path: 'o1/ab1/s.p7m', signed_sha256: 'b'.repeat(64), ...o });

function bau({ hdr = header(), regs, claimErr = null, removeErr = null, doneOk = true, headerUpdateEmpty = false } = {}) {
  const log = [];
  let h = { ...hdr };
  const registry = regs || [
    { id: 'rd', storage_path: 'o1/ab1/d.dta', role: 'dta', state: 'published' },
    { id: 'rs', storage_path: 'o1/ab1/s.p7m', role: 'signed', state: 'published' }];
  const db = {
    from(t) {
      const f = [];
      const b = {
        select() { return b; }, eq(c, v) { f.push([c, v]); return b; }, is(c, v) { f.push([c, v]); return b; },
        update(p) { log.push(['update', p]); b._p = p; return b; },
        select2() { return b; },
        async maybeSingle() { const m = registry.find(r => f.every(([c, v]) => r[c] === undefined || r[c] === v)); return { data: m || null, error: null }; },
        then(res) { if (t === 'abrechnung') { if (headerUpdateEmpty) return Promise.resolve({ data: [], error: null }).then(res); h = { ...h, ...b._p, updated_at: 'neu' }; return Promise.resolve({ data: [{ ...h }], error: null }).then(res); } return Promise.resolve({ data: [], error: null }).then(res); },
      };
      return b;
    },
    async rpc(n, a) { log.push([n]); if (n === 'artefakt_retire_claim') return claimErr ? { data: null, error: { message: claimErr } } : { data: 'tok', error: null }; if (n === 'artefakt_retire_done') return { data: a.p_error ? false : doneOk, error: null }; return { data: null, error: null }; },
    storage: { from: () => ({ async remove(p) { log.push(['remove', p]); return removeErr ? { error: { message: removeErr } } : { data: p.map(x => ({ name: x })), error: null }; } }) },
  };
  return { db, log, hdr: () => h };
}
const lauf = (t, extra = {}) => entferneUnsignierteDta({ db: t.db, ownerId: O, abrechnungId: A, ladeHeader: async () => t.hdr(), ...extra });

test('Erfolg: Header-Referenz geloest, Claim, genau EIN remove (nur die DTA), Abschluss', async () => {
  const t = bau();
  const r = await lauf(t);
  assert.deepEqual(r, { entfernt: true });
  assert.deepEqual(t.log.filter(l => l[0] === 'remove'), [['remove', ['o1/ab1/d.dta']]]);
  assert.equal(t.hdr().storage_path, null);
  assert.equal(t.hdr().dta_sha256, 'a'.repeat(64), 'SHA-256 bleibt');
  assert.equal(t.hdr().signed_storage_path, 'o1/ab1/s.p7m');
  const reihenfolge = t.log.map(l => l[0]);
  assert.ok(reihenfolge.indexOf('update') < reihenfolge.indexOf('artefakt_retire_claim'));
  assert.ok(reihenfolge.indexOf('artefakt_retire_claim') < reihenfolge.indexOf('remove'));
});

test('nie nach Versand: gesendet/accepted/paid -> keine Aenderung', async () => {
  for (const status of ['gesendet', 'accepted', 'rejected', 'paid']) {
    const t = bau({ hdr: header({ status }) });
    assert.equal((await lauf(t)).entfernt, false);
    assert.equal(t.log.length, 0);
  }
});

test('DTA nicht registriert oder Signatur nicht veroeffentlicht -> nichts anfassen', async () => {
  let t = bau({ regs: [{ id: 'rs', storage_path: 'o1/ab1/s.p7m', role: 'signed', state: 'published' }] });
  assert.equal((await lauf(t)).grund, 'dta_nicht_registriert');
  assert.equal(t.log.length, 0);
  t = bau({ regs: [{ id: 'rd', storage_path: 'o1/ab1/d.dta', role: 'dta', state: 'published' }, { id: 'rs', storage_path: 'o1/ab1/s.p7m', role: 'signed', state: 'reserved' }] });
  assert.equal((await lauf(t)).grund, 'signatur_nicht_veroeffentlicht');
  assert.equal(t.log.length, 0);
});

test('Header-Konflikt (CAS leer): kein Claim, kein remove', async () => {
  const t = bau({ headerUpdateEmpty: true });
  const r = await lauf(t);
  assert.equal(r.entfernt, false);
  assert.ok(!t.log.some(l => l[0] === 'remove' || l[0] === 'artefakt_retire_claim'));
});

test('remove scheitert: Fehler quittiert (retire_done mit Fehlertext), wiederholbar, nichts verloren', async () => {
  const t = bau({ removeErr: 'storage down' });
  const r = await lauf(t);
  assert.equal(r.entfernt, false);
  assert.equal(r.wiederholbar, true);
  assert.ok(t.log.some(l => l[0] === 'artefakt_retire_done'));
});

test('Claim verweigert (DB-Regel): kein remove', async () => {
  const t = bau({ claimErr: 'Pfad noch referenziert' });
  const r = await lauf(t);
  assert.equal(r.entfernt, false);
  assert.ok(!t.log.some(l => l[0] === 'remove'));
});

test('musterAus: bereits ausgemustert (Claim liefert NULL) ist ok ohne remove', async () => {
  const db = { rpc: async () => ({ data: null, error: null }), storage: { from: () => ({ remove: async () => { throw new Error('darf nicht'); } }) } };
  assert.deepEqual(await musterAus({ db, ownerId: O, registryId: 'r', pfad: 'p' }), { ok: true, bereitsAusgemustert: true });
});
