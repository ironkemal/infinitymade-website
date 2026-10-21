import test from 'node:test';
import assert from 'node:assert/strict';
import {
  oeffneZahlungseingang,
  istZahlungUnklar,
  UNGEWISSER_BUCHUNGS_HINWEIS,
} from './rechnung-zahlungseingang.js';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.children = [];
    this.parentElement = null;
    this.disabled = false;
    this.checked = false;
    this._value = '';
    this.textContent = '';
  }

  get value() {
    if (this._value !== '') return this._value;
    if (this.tagName === 'SELECT') {
      const opt = this.children.find(c => c.tagName === 'OPTION');
      if (opt) return opt.getAttribute('value') || opt.value || opt.textContent;
    }
    return this._value;
  }
  set value(v) {
    this._value = String(v ?? '');
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'id') this.id = String(val);
    if (name === 'value') this._value = String(val);
    if (name === 'name') this.name = String(val);
    if (name === 'checked') this.checked = true;
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  removeEventListener(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== fn);
  }

  dispatchEvent(event) {
    const fns = (this.listeners[event.type] || []).slice();
    for (const fn of fns) {
      fn({ target: this, preventDefault() {}, stopPropagation() {} });
    }
  }

  click() {
    this.dispatchEvent({ type: 'click' });
  }

  focus() {}
  select() {}

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
    }
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    function matchNode(node) {
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        if (node.getAttribute('id') === id || node.id === id) return true;
      } else if (selector === 'input[name="_zeRestModus"]') {
        if (node.tagName.toLowerCase() === 'input' && node.getAttribute('name') === '_zeRestModus') return true;
      } else if (selector === 'input[name="_zeRestModus"]:checked') {
        if (node.tagName.toLowerCase() === 'input' && node.getAttribute('name') === '_zeRestModus' && node.checked) return true;
      }
      return false;
    }

    function traverse(node) {
      for (const child of node.children) {
        if (matchNode(child)) results.push(child);
        traverse(child);
      }
    }
    traverse(this);
    return results;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    parseHtmlInto(html, this);
  }

  get innerHTML() {
    return this._innerHTML || '';
  }
}

function parseHtmlInto(html, root) {
  const tagRegex = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z0-9\-]+)([^>]*)>|([^<]+)/g;
  const stack = [root];
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const [full, isClosing, tagName, attrStr, text] = match;
    if (full.startsWith('<!--')) continue;
    if (text) {
      const top = stack[stack.length - 1];
      if (top) top.textContent += text.trim();
      continue;
    }
    if (isClosing) {
      if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === tagName.toLowerCase()) {
        stack.pop();
      }
      continue;
    }

    const el = new FakeElement(tagName);
    const attrRegex = /([a-zA-Z0-9\-_]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      const name = attrMatch[1];
      const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      el.setAttribute(name, val);
      if (name === 'checked' || attrMatch[0] === 'checked') {
        el.checked = true;
      }
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.appendChild(el);
    }

    const voidTags = ['input', 'br', 'hr', 'img', 'meta', 'link'];
    if (!voidTags.includes(tagName.toLowerCase()) && !attrStr.endsWith('/')) {
      stack.push(el);
    }
  }
}

function initFakeDom() {
  const body = new FakeElement('body');
  const listeners = {};
  const doc = {
    body,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => {
      function findId(node) {
        if (node.getAttribute('id') === id || node.id === id) return node;
        for (const c of node.children) {
          const f = findId(c);
          if (f) return f;
        }
        return null;
      }
      return findId(body);
    },
  };
  const win = {
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: (t, f) => {
      if (listeners[t]) listeners[t] = listeners[t].filter(fn => fn !== f);
    },
    dispatchEvent: (e) => {
      for (const fn of (listeners[e.type] || [])) fn(e);
    },
  };

  const origDoc = globalThis.document;
  const origWin = globalThis.window;
  const origFetch = globalThis.fetch;
  const origStorage = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };

  globalThis.document = doc;
  globalThis.window = win;

  return {
    doc,
    win,
    storage,
    restore() {
      if (origStorage !== undefined) globalThis.localStorage = origStorage;
      else delete globalThis.localStorage;
      if (origDoc !== undefined) globalThis.document = origDoc;
      else delete globalThis.document;
      if (origWin !== undefined) globalThis.window = origWin;
      else delete globalThis.window;
      if (origFetch !== undefined) globalThis.fetch = origFetch;
      else delete globalThis.fetch;
    },
  };
}

const standardKonten = [
  { code: '1000', label: 'Kasse', aktiv: true, kategorie: 'bar' },
  { code: '1200', label: 'Bank', aktiv: true, kategorie: 'ueberweisung' },
];

function deferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSIONSTESTS
// ─────────────────────────────────────────────────────────────────────────────

test('RACE 1: Bounded Token Phase: never-settled token times out, unlocks controls, and late token resolution NEVER issues POST', async () => {
  const dom = initFakeDom();
  try {
    let lateResolve;
    const neverSettledToken = new Promise((resolve) => {
      lateResolve = resolve;
    });

    let fetchAttempted = false;
    globalThis.fetch = async () => {
      fetchAttempted = true;
      return { ok: true, status: 200, json: async () => ({}) };
    };

    // Fake timers: simulate 8001ms passing
    const origSetTimeout = globalThis.setTimeout;
    let scheduledCallback = null;
    globalThis.setTimeout = (cb, delay) => {
      if (delay === 8000) {
        scheduledCallback = cb;
        return 999;
      }
      return origSetTimeout(cb, delay);
    };

    const dialogPromise = oeffneZahlungseingang({
      rechnung: { id: 'inv-token-timeout-unique', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: () => neverSettledToken,
      showToast: () => {},
    });

    const buchenBtn = globalThis.document.getElementById('_zeBuchen');
    const betragEl = globalThis.document.getElementById('_zeBetrag');

    buchenBtn.click();
    assert.equal(buchenBtn.disabled, true);
    assert.equal(buchenBtn.textContent, '…');

    // Token-Timeout feuert vor POST
    assert.ok(scheduledCallback, '8s Token-Timeout wurde registriert');
    scheduledCallback();
    await new Promise(process.nextTick);

    // Dialog muss entsperrt sein, da VOR POST abgebrochen
    assert.equal(buchenBtn.disabled, false);
    assert.equal(buchenBtn.textContent, 'Buchen');
    assert.equal(betragEl.disabled, false);
    assert.equal(istZahlungUnklar('inv-token-timeout-unique'), false);

    // Spätes Auflösen des alten Token-Promises darf KEINESFALLS einen POST triggern!
    lateResolve('very-late-jwt');
    await new Promise(process.nextTick);
    assert.equal(fetchAttempted, false, 'Late token resolution darf niemals POST senden');

    globalThis.setTimeout = origSetTimeout;
    globalThis.document.getElementById('_zeAbbrechen').click();
    await dialogPromise;
  } finally {
    dom.restore();
  }
});

test('RACE 2: Input/Change-Versuche während POST in-flight reaktivieren Buchen NICHT', async () => {
  const dom = initFakeDom();
  try {
    const fetchDeferred = deferredPromise();
    globalThis.fetch = () => fetchDeferred.promise;

    const dialogPromise = oeffneZahlungseingang({
      rechnung: { id: 'inv-inflight-unique', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'mock-jwt',
      showToast: () => {},
    });

    const buchenBtn = globalThis.document.getElementById('_zeBuchen');
    const betragEl = globalThis.document.getElementById('_zeBetrag');

    buchenBtn.click();
    await new Promise(process.nextTick);

    assert.equal(buchenBtn.disabled, true);
    assert.equal(buchenBtn.textContent, '…');

    betragEl.value = '50';
    betragEl.dispatchEvent({ type: 'input' });

    assert.equal(buchenBtn.disabled, true);
    assert.equal(buchenBtn.textContent, '…');

    fetchDeferred.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        zahlung_id: '550e8400-e29b-41d4-a716-446655440000',
        payment_status: 'paid',
        beleg_nr: 1,
      }),
    });

    const res = await dialogPromise;
    assert.equal(res, true);
  } finally {
    dom.restore();
  }
});

test('RACE 3: Programmatischer Mehrfach-Klick löst exakt einen einzigen POST aus', async () => {
  const dom = initFakeDom();
  try {
    let postCallCount = 0;
    const fetchDeferred = deferredPromise();
    globalThis.fetch = async () => {
      postCallCount++;
      return fetchDeferred.promise;
    };

    const dialogPromise = oeffneZahlungseingang({
      rechnung: { id: 'inv-multi-unique', total_patient: 80 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'mock-jwt',
      showToast: () => {},
    });

    const buchenBtn = globalThis.document.getElementById('_zeBuchen');

    buchenBtn.click();
    buchenBtn.click();
    buchenBtn.click();
    await new Promise(process.nextTick);

    assert.equal(postCallCount, 1);

    fetchDeferred.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        zahlung_id: '550e8400-e29b-41d4-a716-446655440001',
        payment_status: 'paid',
        beleg_nr: 2,
      }),
    });

    const res = await dialogPromise;
    assert.equal(res, true);
    assert.equal(postCallCount, 1);
  } finally {
    dom.restore();
  }
});

test('RACE 4: Abbrechen und Overlay-Klick bleiben während Submission blockiert', async () => {
  const dom = initFakeDom();
  try {
    const fetchDeferred = deferredPromise();
    globalThis.fetch = () => fetchDeferred.promise;

    let resolved = false;
    const dialogPromise = oeffneZahlungseingang({
      rechnung: { id: 'inv-block-close-unique', total_patient: 60 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'mock-jwt',
      showToast: () => {},
    }).then(r => { resolved = true; return r; });

    const buchenBtn = globalThis.document.getElementById('_zeBuchen');
    const abbrechenBtn = globalThis.document.getElementById('_zeAbbrechen');
    const overlay = globalThis.document.getElementById('_zeModal');

    buchenBtn.click();
    await new Promise(process.nextTick);

    abbrechenBtn.click();
    assert.equal(resolved, false);
    assert.ok(globalThis.document.getElementById('_zeModal'));

    overlay.dispatchEvent({ type: 'click', target: overlay });
    assert.equal(resolved, false);

    globalThis.window.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.equal(resolved, false);

    fetchDeferred.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        zahlung_id: '550e8400-e29b-41d4-a716-446655440002',
        payment_status: 'paid',
        beleg_nr: 3,
      }),
    });

    const res = await dialogPromise;
    assert.equal(res, true);
    assert.equal(globalThis.document.getElementById('_zeModal'), null);
  } finally {
    dom.restore();
  }
});

test('RACE 5: Payload behält eingefrorene Werte trotz DOM-Änderung während Token-Wartezeit', async () => {
  const dom = initFakeDom();
  try {
    let capturedBody = null;
    const tokenDeferred = deferredPromise();

    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          zahlung_id: '550e8400-e29b-41d4-a716-446655440003',
          payment_status: 'paid',
          beleg_nr: 4,
        }),
      };
    };

    const dialogPromise = oeffneZahlungseingang({
      rechnung: { id: 'inv-freeze-unique', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: () => tokenDeferred.promise,
      showToast: () => {},
    });

    const buchenBtn = globalThis.document.getElementById('_zeBuchen');
    const betragEl = globalThis.document.getElementById('_zeBetrag');
    const kontoEl = globalThis.document.getElementById('_zeKonto');

    buchenBtn.click();

    betragEl.value = '10.00';
    kontoEl.value = '1200';

    tokenDeferred.resolve('jwt-freeze');
    await new Promise(process.nextTick);

    const res = await dialogPromise;
    assert.equal(res, true);

    assert.equal(capturedBody.eingegangener_betrag, 100);
    assert.equal(capturedBody.gegenkonto_code, '1000');
  } finally {
    dom.restore();
  }
});

test('RACE 6: Reopen pending: Zweiter oeffneZahlungseingang-Aufruf während laufender Buchung zerstört aktives Modal NICHT', async () => {
  const dom = initFakeDom();
  try {
    const fetchDeferred = deferredPromise();
    globalThis.fetch = () => fetchDeferred.promise;

    const dialog1 = oeffneZahlungseingang({
      rechnung: { id: 'inv-reopen-pending', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'jwt',
      showToast: () => {},
    });

    const modal1 = globalThis.document.getElementById('_zeModal');
    modal1.querySelector('#_zeBuchen').click();
    await new Promise(process.nextTick);

    assert.equal(modal1.dataset.submitting, 'true');

    // Zweiter Aufruf versucht den Dialog zu öffnen, während modal1 submitting ist
    const dialog2Res = await oeffneZahlungseingang({
      rechnung: { id: 'inv-reopen-pending', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'jwt',
      showToast: () => {},
    });

    assert.equal(dialog2Res, false);
    assert.equal(globalThis.document.getElementById('_zeModal'), modal1, 'Aktives Modal wurde NICHT zerstört');

    fetchDeferred.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        zahlung_id: '550e8400-e29b-41d4-a716-446655440004',
        payment_status: 'paid',
        beleg_nr: 5,
      }),
    });

    const res1 = await dialog1;
    assert.equal(res1, true);
  } finally {
    dom.restore();
  }
});

test('RACE 7: Timeout (AbortError) sperrt Rechnung dauerhaft mit Belegjournal-Pflicht (kein reload-Ersatz)', async () => {
  const dom = initFakeDom();
  try {
    globalThis.fetch = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };

    const dialogPromise = oeffneZahlungseingang({
      rechnung: { id: 'inv-timeout-journal-unique', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'mock-jwt',
      showToast: () => {},
    });

    globalThis.document.getElementById('_zeBuchen').click();
    await new Promise(process.nextTick);

    const fehlerEl = globalThis.document.getElementById('_zeFehler');
    assert.match(fehlerEl.textContent, /Belegjournal/);
    assert.doesNotMatch(fehlerEl.textContent, /bzw\.\s*laden\s*neu/);
    assert.equal(istZahlungUnklar('inv-timeout-journal-unique'), true);

    globalThis.document.getElementById('_zeAbbrechen').click();
    await dialogPromise;

    // Wiedereröffnung der ungewissen Rechnung öffnet strikt gesperrt
    const p2 = oeffneZahlungseingang({
      rechnung: { id: 'inv-timeout-journal-unique', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'mock-jwt',
      showToast: () => {},
    });

    assert.equal(globalThis.document.getElementById('_zeBuchen').disabled, true);
    assert.equal(globalThis.document.getElementById('_zeBuchen').textContent, 'Buchung unklar');
    assert.match(globalThis.document.getElementById('_zeFehler').textContent, /Belegjournal/);

    globalThis.document.getElementById('_zeAbbrechen').click();
    await p2;
  } finally {
    dom.restore();
  }
});

test('RACE 8: Slow/hanging response body parse bricht ab und sperrt Rechnung fail-closed als unbestätigt', async () => {
  const dom = initFakeDom();
  try {
    globalThis.fetch = async (url, opts) => {
      return {
        ok: true,
        status: 200,
        json: () => new Promise((_, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('Body stream aborted by timeout');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      };
    };

    const origSetTimeout = globalThis.setTimeout;
    let postTimeoutCallback = null;
    globalThis.setTimeout = (cb, delay) => {
      if (delay === 8000) {
        postTimeoutCallback = cb;
        return 888;
      }
      return origSetTimeout(cb, delay);
    };

    const dialogPromise = oeffneZahlungseingang({
      rechnung: { id: 'inv-hanging-body-unique', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'jwt',
      showToast: () => {},
    });

    globalThis.document.getElementById('_zeBuchen').click();
    await new Promise(process.nextTick);

    // 8s Timeout feuert während json() hängt
    assert.ok(postTimeoutCallback);
    postTimeoutCallback();
    await new Promise(process.nextTick);

    assert.equal(istZahlungUnklar('inv-hanging-body-unique'), true);
    assert.equal(globalThis.document.getElementById('_zeBuchen').disabled, true);
    assert.match(globalThis.document.getElementById('_zeFehler').textContent, /Belegjournal/);

    globalThis.setTimeout = origSetTimeout;
    globalThis.document.getElementById('_zeAbbrechen').click();
    await dialogPromise;
  } finally {
    dom.restore();
  }
});

test('RACE 9: Ungültige Success-JSON Shapes ({}, null, { error }, fehlende payment_status/zahlung_id) sperren fail-closed', async () => {
  const dom = initFakeDom();
  try {
    const invalidShapes = [
      {},
      null,
      { error: 'unexpected' },
      { payment_status: 'paid' }, // fehlende zahlung_id
      { zahlung_id: '123', payment_status: 'unknown' }, // ungültiger status
    ];

    for (let i = 0; i < invalidShapes.length; i++) {
      const invId = `inv-shape-invalid-${i}`;
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => invalidShapes[i],
      });

      const dialogPromise = oeffneZahlungseingang({
        rechnung: { id: invId, total_patient: 100 },
        konten: standardKonten,
        apiBasis: 'https://test.api',
        token: async () => 'jwt',
        showToast: () => {},
      });

      globalThis.document.getElementById('_zeBuchen').click();
      await new Promise(process.nextTick);

      assert.equal(istZahlungUnklar(invId), true, `Shape ${JSON.stringify(invalidShapes[i])} muss uncertain sperren`);
      assert.equal(globalThis.document.getElementById('_zeBuchen').disabled, true);
      assert.match(globalThis.document.getElementById('_zeFehler').textContent, /Belegjournal/);

      globalThis.document.getElementById('_zeAbbrechen').click();
      await dialogPromise;
    }
  } finally {
    dom.restore();
  }
});

test('RACE 10: Server 500 sperrt fail-closed als unbestätigt', async () => {
  const dom = initFakeDom();
  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Database crash' }),
    });

    const p = oeffneZahlungseingang({
      rechnung: { id: 'inv-500-unique', total_patient: 50 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'jwt',
      showToast: () => {},
    });

    globalThis.document.getElementById('_zeBuchen').click();
    await new Promise(process.nextTick);

    assert.equal(istZahlungUnklar('inv-500-unique'), true);
    assert.equal(globalThis.document.getElementById('_zeBuchen').disabled, true);
    assert.match(globalThis.document.getElementById('_zeFehler').textContent, /Belegjournal/);

    globalThis.document.getElementById('_zeAbbrechen').click();
    await p;
  } finally {
    dom.restore();
  }
});

test('RACE 11: Explizite 4xx-Ablehnung erlaubt Korrektur und sperrt die Rechnung NICHT', async () => {
  const dom = initFakeDom();
  try {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'Konto ungültig' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          zahlung_id: '550e8400-e29b-41d4-a716-446655440005',
          payment_status: 'paid',
          beleg_nr: 99,
        }),
      };
    };

    const dialogPromise = oeffneZahlungseingang({
      rechnung: { id: 'inv-400-fix-unique', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'jwt',
      showToast: () => {},
    });

    const buchenBtn = globalThis.document.getElementById('_zeBuchen');
    buchenBtn.click();
    await new Promise(process.nextTick);

    assert.equal(buchenBtn.disabled, false);
    assert.equal(buchenBtn.textContent, 'Buchen');
    assert.equal(istZahlungUnklar('inv-400-fix-unique'), false);

    buchenBtn.click();
    await new Promise(process.nextTick);

    const res = await dialogPromise;
    assert.equal(res, true);
    assert.equal(callCount, 2);
  } finally {
    dom.restore();
  }
});

test('RACE 12: Rechnung B bleibt buchbar, auch wenn Rechnung A im Modul ungewiss gesperrt ist', async () => {
  const dom = initFakeDom();
  try {
    globalThis.fetch = async (url) => {
      if (url.includes('inv-A-unique')) {
        throw new Error('Network drop');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          zahlung_id: '550e8400-e29b-41d4-a716-446655440006',
          payment_status: 'paid',
          beleg_nr: 77,
        }),
      };
    };

    const pA = oeffneZahlungseingang({
      rechnung: { id: 'inv-A-unique', total_patient: 100 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'jwt',
      showToast: () => {},
    });
    globalThis.document.getElementById('_zeBuchen').click();
    await new Promise(process.nextTick);
    assert.equal(istZahlungUnklar('inv-A-unique'), true);
    globalThis.document.getElementById('_zeAbbrechen').click();
    await pA;

    const pB = oeffneZahlungseingang({
      rechnung: { id: 'inv-B-unique', total_patient: 50 },
      konten: standardKonten,
      apiBasis: 'https://test.api',
      token: async () => 'jwt',
      showToast: () => {},
    });
    const buchenB = globalThis.document.getElementById('_zeBuchen');
    assert.equal(buchenB.disabled, false);
    buchenB.click();
    await new Promise(process.nextTick);

    const resB = await pB;
    assert.equal(resB, true);
    assert.equal(istZahlungUnklar('inv-A-unique'), true);
  } finally {
    dom.restore();
  }
});


test('Persistente Sperre überlebt neue Modulinstanz; beschädigte Sperre bleibt gesperrt', async () => {
  const dom = initFakeDom();
  try {
    dom.storage.set('praxura:zahlung_lock:reload', JSON.stringify({ invoice_id: 'reload', status: 'in_flight' }));
    dom.storage.set('praxura:zahlung_lock:corrupt', '{');
    const fresh = await import('./rechnung-zahlungseingang.js?storage-regression');
    assert.equal(fresh.istZahlungUnklar('reload'), true);
    assert.equal(fresh.istZahlungUnklar('corrupt'), true);
    assert.equal(fresh.istZahlungUnklar('clean'), false);
    globalThis.localStorage.getItem = () => { throw new Error('denied'); };
    assert.equal(fresh.istZahlungUnklar('clean'), true);
  } finally { dom.restore(); }
});

test('Storage-Schreibfehler verhindert POST', async () => {
  const dom = initFakeDom();
  try {
    let posts = 0;
    globalThis.fetch = async () => { posts++; };
    globalThis.localStorage.setItem = () => { throw new Error('quota'); };
    const pending = oeffneZahlungseingang({ rechnung: { id: 'storage-fail', total_patient: 50 }, konten: standardKonten, apiBasis: 'https://test.api', token: async () => 'jwt', showToast: () => {} });
    document.getElementById('_zeBuchen').click();
    await new Promise(process.nextTick);
    assert.equal(posts, 0);
    assert.equal(document.getElementById('_zeBuchen').disabled, true);
    document.getElementById('_zeAbbrechen').click();
    assert.equal(await pending, false);
  } finally { dom.restore(); }
});
