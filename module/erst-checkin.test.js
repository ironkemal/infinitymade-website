// Pflichtpunkt 7 + legal-de 23.11.2026: Einstempeln beim allerersten Login nur per Klick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { erstCheckinAnbieten, checkInAusfuehren } from './erst-checkin.js';

function speicher() { /** @type {Record<string,string>} */ const m = {}; return { getItem: (/** @type {string} */ k) => m[k] ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => { m[k] = v; }, m }; }
function sb(/** @type {any[]|null} */ zeilen) {
  return { from: () => { const k = { select: () => k, eq: () => k, limit: async () => (zeilen ? { data: zeilen, error: null } : { data: null, error: { message: 'x' } }) }; return k; } };
}
/** Minimal-DOM: hält das eingehängte Modal, Klick per data-erst. */
function dom() {
  /** @type {any} */ let modal = null;
  const doc = /** @type {any} */ ({
    getElementById: () => null, addEventListener() {}, removeEventListener() {},
    body: { appendChild: (/** @type {any} */ m) => { modal = m; } },
    createElement: () => {
      /** @type {Record<string, Function>} */ const klick = {};
      const el = /** @type {any} */ ({ style: {}, setAttribute() {}, remove() { modal = null; }, innerHTML: '',
        querySelector: (/** @type {string} */ q) => {
          const m = /data-erst="(\w+)"/.exec(q);
          if (m) return { addEventListener: (/** @type {string} */ _e, /** @type {Function} */ f) => { klick[m[1]] = f; }, focus() {} };
          if (q === '#erstCheckinStandort') return el.innerHTML.includes('<select') ? { value: el.wahl } : null;
          return null;
        } });
      el.klick = klick; return el;
    },
  });
  return { doc, modal: () => modal };
}
const standorte = [{ id: 'A', business_name: 'Praxis <A>' }, { id: 'B', business_name: 'Praxis B' }];
const basis = (/** @type {any} */ extra) => ({ userId: 'u1', apiBase: '/api', getToken: async () => 't', standorte: standorte.slice(0, 1), ...extra });

test('ohne Standort, mit Merker oder mit vorhandener Anwesenheit: kein Dialog', async () => {
  assert.equal(await erstCheckinAnbieten(basis({ supabase: sb([]), standorte: [] })), 'kein-standort');
  const s = speicher(); s.setItem('praxura_erst_checkin_u1', 'x');
  assert.equal(await erstCheckinAnbieten(basis({ supabase: sb([]), speicher: s })), 'gemerkt');
  const s2 = speicher();
  assert.equal(await erstCheckinAnbieten(basis({ supabase: sb([{ id: 1 }]), speicher: s2 })), 'schon-eingestempelt');
  assert.ok(s2.m.praxura_erst_checkin_u1, 'merkt sich, damit nicht jedes Mal abgefragt wird');
  assert.equal(await erstCheckinAnbieten(basis({ supabase: sb(null), speicher: speicher() })), 'unbekannt', 'Lesefehler → nicht fragen');
});

test('„Später“ legt nichts an und fragt auf diesem Gerät nicht erneut', async () => {
  const d = dom(), s = speicher(); let aufrufe = 0;
  const lauf = erstCheckinAnbieten(basis({ supabase: sb([]), doc: d.doc, speicher: s, fetchImpl: async () => { aufrufe++; return /** @type {any} */ ({}); } }));
  await new Promise(r => setImmediate(r));
  assert.match(d.modal().innerHTML, /Praxis &lt;A&gt;/, 'Standortname maskiert');
  d.modal().klick.spaeter();
  assert.equal(await lauf, 'spaeter');
  assert.equal(aufrufe, 0);
  assert.ok(s.m.praxura_erst_checkin_u1);
});

test('„Jetzt einstempeln“ mit Auswahl bei mehreren Standorten sendet die gewählte business_id', async () => {
  const d = dom(); /** @type {any[]} */ const gesendet = []; const toasts = [];
  const fetchImpl = async (/** @type {string} */ url, /** @type {any} */ init) => { gesendet.push([url, JSON.parse(init.body), init.headers.Authorization]); return /** @type {any} */ ({ ok: true, status: 200, json: async () => ({ ok: true }) }); };
  const lauf = erstCheckinAnbieten(basis({ supabase: sb([]), standorte, aktuellerStandortId: 'B', doc: d.doc, speicher: speicher(), fetchImpl, showToast: (/** @type {string} */ m) => toasts.push(m) }));
  await new Promise(r => setImmediate(r));
  assert.match(d.modal().innerHTML, /<option value="B" selected>/, 'aktueller Standort vorgewählt');
  d.modal().wahl = 'A';
  d.modal().klick.ja();
  assert.equal(await lauf, 'eingestempelt');
  assert.deepEqual(gesendet, [['/api/attendance/check-in', { business_id: 'A' }, 'Bearer t']]);
  assert.deepEqual(toasts, ['Eingestempelt ✓']);
});

test('checkInAusfuehren: 409 = bereits, Fehlertext durchreichen', async () => {
  const antwort = (/** @type {number} */ status, /** @type {any} */ body) => async () => /** @type {any} */ ({ ok: status < 300, status, json: async () => body });
  assert.deepEqual(await checkInAusfuehren({ apiBase: '', token: 't', businessId: 'A', fetchImpl: antwort(409, {}) }), { ok: true, bereits: true });
  assert.deepEqual(await checkInAusfuehren({ apiBase: '', token: 't', businessId: 'A', fetchImpl: antwort(404, { error: 'Standort nicht gefunden' }) }), { ok: false, fehler: 'Standort nicht gefunden' });
});
