import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ist78040EmpfangsnachweisEligible,
  getEmpfangsnachweisStatusInfo,
  renderEmpfangsnachweisHost,
  mountEmpfangsnachweise,
  mountEmpfangsnachweis,
} from './podo-empfangsnachweis.js';

/**
 * Minimal fake DOM node for Node.js unit testing.
 */
class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.listeners = {};
    this.classList = new Set();
    this.children = [];
    this.parentElement = null;
    this._value = '';
    this.checked = false;
    this.disabled = false;
    this.isConnected = true;
    this._innerHTML = '';
    this.textContent = '';
  }

  get value() {
    return this._value;
  }
  set value(v) {
    this._value = String(v ?? '');
  }

  getAttribute(name) {
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (key in this.dataset) return this.dataset[key];
    }
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = String(val);
    }
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  click() {
    if (this.disabled) return;
    const fns = this.listeners['click'] || [];
    for (const fn of fns) {
      fn({ target: this, preventDefault() {} });
    }
  }

  submit() {
    const fns = this.listeners['submit'] || [];
    for (const fn of fns) {
      fn({ target: this, preventDefault() {} });
    }
  }

  querySelector(selector) {
    const res = this.querySelectorAll(selector);
    return res[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    function walk(node) {
      for (const child of node.children) {
        if (matches(child, selector)) {
          results.push(child);
        }
        walk(child);
      }
    }
    walk(this);
    return results;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    this.textContent = '';
    parseHtmlInto(html, this);
  }

  get innerHTML() {
    return this._innerHTML;
  }
}

function matches(el, selector) {
  if (selector.startsWith('.')) {
    return el.classList.has(selector.slice(1));
  }
  if (selector.startsWith('#')) {
    return el.getAttribute('id') === selector.slice(1);
  }
  return el.tagName.toLowerCase() === selector.toLowerCase();
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
      top.textContent += text;
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
      if (name === 'class') {
        val.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
      }
      if (name === 'value') {
        el.value = val;
      }
      if (name === 'type') {
        el.type = val;
      }
    }

    const parent = stack[stack.length - 1];
    parent.children.push(el);
    el.parentElement = parent;

    const voidTags = ['input', 'br', 'hr', 'img', 'meta', 'link'];
    if (!voidTags.includes(tagName.toLowerCase()) && !attrStr.endsWith('/')) {
      stack.push(el);
    }
  }
}

function makeCtx(role = 'owner', token = 'mock-jwt-token', overrides = {}) {
  return {
    apiBase: 'https://api.test.example/api',
    getProfile: () => (role ? { role } : null),
    getOwnerId: () => 'owner-123',
    getSessionUserId: () => 'user-123',
    escapeHtml: s => String(s ?? ''),
    showToast: () => {},
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: token ? { access_token: token } : null } }),
      },
    },
    ...overrides,
  };
}

function makeNachweisFixture(beh, status = 'bestaetigt', extras = {}) {
  return {
    behandlung_id: beh.id,
    hpnr_code: '78040',
    behandlungsdatum: beh.behandlungsdatum || '2026-10-01',
    status,
    ...extras,
  };
}

test('Eligibility: only concrete non-cancelled 78040 treatments eligible without mutation', () => {
  const originalEligible = { id: 'b1', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };
  const copyBefore = JSON.stringify(originalEligible);
  assert.equal(ist78040EmpfangsnachweisEligible(originalEligible), true);
  assert.equal(JSON.stringify(originalEligible), copyBefore, 'Eligibility check must not mutate original');

  assert.equal(ist78040EmpfangsnachweisEligible({ id: 'b2', hpnr_codes: ['78010'] }), false);
  assert.equal(ist78040EmpfangsnachweisEligible({ id: 'b3', hpnr_codes: ['78040'], storniert_am: '2026-10-02' }), false);
  assert.equal(ist78040EmpfangsnachweisEligible({ id: 'b4', hpnr_codes: '78040' }), false);
  assert.equal(ist78040EmpfangsnachweisEligible(null), false);
});

test('Render host: produces markup only for eligible treatments with fail-safe escaping absent ctx.escapeHtml', () => {
  // 1. Normal ctx with escapeHtml
  const ctx = makeCtx();
  const beh78040 = { id: 'beh-78040-xyz', hpnr_codes: ['78040'] };
  const html = renderEmpfangsnachweisHost(beh78040, ctx);
  assert.match(html, /class="podo-empfangsnachweis-host"/);
  assert.match(html, /data-beh-id="beh-78040-xyz"/);
  assert.match(html, /Papiernachweis: ungeprüft/);

  // 2. Ineligible treatment -> empty string
  const behNon78040 = { id: 'beh-other', hpnr_codes: ['78010'] };
  assert.equal(renderEmpfangsnachweisHost(behNon78040, ctx), '');

  // 3. Absent ctx.escapeHtml -> fails safe, escapes XSS chars
  const ctxNoEscape = { apiBase: 'https://api.test.example/api' };
  const behXss = { id: 'beh-" onclick="alert(1)" <tag>&', hpnr_codes: ['78040'] };
  const htmlEscaped = renderEmpfangsnachweisHost(behXss, ctxNoEscape);
  assert.match(htmlEscaped, /data-beh-id="beh-&quot; onclick=&quot;alert\(1\)&quot; &lt;tag&gt;&amp;"/);
});

test('Pure status formatting helper covers null, confirmed, withdrawn and invalid', () => {
  assert.deepEqual(getEmpfangsnachweisStatusInfo(null), {
    status: 'ungeprueft',
    label: 'Papiernachweis: ungeprüft',
    initials: null,
    isConfirmed: false,
    isWithdrawn: false,
  });

  assert.deepEqual(getEmpfangsnachweisStatusInfo({ status: 'bestaetigt', therapeuteninitialen: 'MK' }), {
    status: 'bestaetigt',
    label: 'Papiernachweis geprüft (MK)',
    initials: 'MK',
    isConfirmed: true,
    isWithdrawn: false,
  });

  assert.deepEqual(getEmpfangsnachweisStatusInfo({ status: 'widerrufen' }), {
    status: 'widerrufen',
    label: 'Papiernachweis widerrufen',
    initials: null,
    isConfirmed: false,
    isWithdrawn: true,
  });

  // Unknown status mapped to ungeprueft
  assert.deepEqual(getEmpfangsnachweisStatusInfo({ status: 'unbekannt' }), {
    status: 'ungeprueft',
    label: 'Papiernachweis: ungeprüft',
    initials: null,
    isConfirmed: false,
    isWithdrawn: false,
  });
});

test('GET status: handles null, confirmed, load errors and rejects malformed DB status', async () => {
  const ctx = makeCtx('owner');
  const beh = { id: 'beh-1', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };

  // 1. GET returns null nachweis -> ungeprueft
  const host1 = new FakeElement('div');
  mountEmpfangsnachweis(host1, beh, ctx, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ nachweis: null }),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host1.innerHTML, /Papiernachweis: ungeprüft/);

  // 2. GET returns confirmed nachweis
  const host2 = new FakeElement('div');
  mountEmpfangsnachweis(host2, beh, ctx, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'AB' }) }),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host2.innerHTML, /Papiernachweis geprüft \(AB\)/);

  // 3. GET fails with 500 error -> 'Status nicht geladen' with retry button
  const host3 = new FakeElement('div');
  mountEmpfangsnachweis(host3, beh, ctx, async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: 'internal' }),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host3.innerHTML, /Status nicht geladen/);
  assert.ok(host3.querySelector('.podo-nachweis-retry-btn'));

  // 4. GET returns 200 but malformed/invented status -> rejected, renders error
  const host4 = new FakeElement('div');
  mountEmpfangsnachweis(host4, beh, ctx, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ nachweis: makeNachweisFixture(beh, 'erfunden_status') }),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host4.innerHTML, /Status nicht geladen/);
});

test('Race condition: multiple loadStatus requests reject older responses', async () => {
  const ctx = makeCtx('owner');
  const beh = { id: 'beh-race', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };
  const host = new FakeElement('div');

  let resolveFirst;
  let resolveSecond;
  let callCount = 0;

  const fetchFn = async () => {
    callCount++;
    const id = callCount;
    if (id === 1) {
      return new Promise(res => {
        resolveFirst = () => res({
          ok: true,
          status: 200,
          json: async () => ({ nachweis: makeNachweisFixture(beh, 'widerrufen') }),
        });
      });
    }
    return new Promise(res => {
      resolveSecond = () => res({
        ok: true,
        status: 200,
        json: async () => ({ nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'FAST' }) }),
      });
    });
  };

  mountEmpfangsnachweis(host, beh, ctx, fetchFn);
  await new Promise(resolve => setTimeout(resolve, 0));

  // Trigger second load request (simulate retry/reload)
  mountEmpfangsnachweis(host, beh, ctx, fetchFn);
  await new Promise(resolve => setTimeout(resolve, 0));

  // Resolve second request first
  resolveSecond();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host.innerHTML, /Papiernachweis geprüft \(FAST\)/);

  // Resolve first request later -> must be rejected, FAST must remain
  resolveFirst();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host.innerHTML, /Papiernachweis geprüft \(FAST\)/);
  assert.doesNotMatch(host.innerHTML, /Papiernachweis widerrufen/);
});

test('Auth refusal: team, employee and null profile disallows writes', async () => {
  const beh = { id: 'beh-emp', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };
  const fetchRead = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ nachweis: null }),
  });

  // Employee cannot write
  const hostEmployee = new FakeElement('div');
  mountEmpfangsnachweis(hostEmployee, beh, makeCtx('employee'), fetchRead);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(hostEmployee.innerHTML, /Papiernachweis: ungeprüft/);
  assert.equal(hostEmployee.querySelector('.podo-nachweis-btn-start-confirm'), null);

  // Team cannot write
  const hostTeam = new FakeElement('div');
  mountEmpfangsnachweis(hostTeam, beh, makeCtx('team'), fetchRead);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(hostTeam.innerHTML, /Papiernachweis: ungeprüft/);
  assert.equal(hostTeam.querySelector('.podo-nachweis-btn-start-confirm'), null);

  // Null profile fails closed
  const hostNull = new FakeElement('div');
  mountEmpfangsnachweis(hostNull, beh, makeCtx(null, null), fetchRead);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(hostNull.innerHTML, /Status nicht geladen/);
});

test('Race condition: role rechecked after session await prevents POST if role changed', async () => {
  let role = 'owner';
  let postCalls = 0;

  let resolveSession;
  const ctx = {
    apiBase: 'https://api.test.example/api',
    getProfile: () => (role ? { role } : null),
    supabase: {
      auth: {
        getSession: async () => new Promise(res => {
          resolveSession = () => res({ data: { session: { access_token: 'valid-jwt' } } });
        }),
      },
    },
  };

  const beh = { id: 'beh-role-race', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };
  const host = new FakeElement('div');
  mountEmpfangsnachweis(host, beh, ctx, async (url, opts) => {
    if (opts?.method === 'POST') {
      postCalls++;
      return { ok: true, status: 200, json: async () => ({ nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'OK' }) }) };
    }
    return { ok: true, status: 200, json: async () => ({ nachweis: null }) };
  });

  // Fast-resolve initial load
  resolveSession();
  await new Promise(resolve => setTimeout(resolve, 0));

  host.querySelector('.podo-nachweis-btn-start-confirm').click();
  host.querySelector('.podo-nachweis-initials-input').value = 'OK';
  host.querySelector('.podo-nachweis-checkbox').checked = true;

  // Click submit while owner
  host.querySelector('.podo-nachweis-submit-confirm-btn').click();

  // Role changes to 'employee' while awaiting session
  role = 'employee';
  resolveSession();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(postCalls, 0, 'POST must not be sent if role changed away from owner during session await');
  assert.match(host.querySelector('.podo-nachweis-form-error').textContent, /Nur Praxisinhaber dürfen den Nachweis erfassen/);
});

test('Race condition: detached / stale mount during session await prevents POST', async () => {
  let postCalls = 0;
  let resolveSession;
  const ctx = {
    apiBase: 'https://api.test.example/api',
    getProfile: () => ({ role: 'owner' }),
    supabase: {
      auth: {
        getSession: async () => new Promise(res => {
          resolveSession = () => res({ data: { session: { access_token: 'valid-jwt' } } });
        }),
      },
    },
  };

  const beh = { id: 'beh-detach-race', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };
  const host = new FakeElement('div');
  mountEmpfangsnachweis(host, beh, ctx, async (url, opts) => {
    if (opts?.method === 'POST') {
      postCalls++;
      return { ok: true, status: 200, json: async () => ({ nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'OK' }) }) };
    }
    return { ok: true, status: 200, json: async () => ({ nachweis: null }) };
  });

  resolveSession();
  await new Promise(resolve => setTimeout(resolve, 0));

  host.querySelector('.podo-nachweis-btn-start-confirm').click();
  host.querySelector('.podo-nachweis-initials-input').value = 'OK';
  host.querySelector('.podo-nachweis-checkbox').checked = true;

  // Submit clicked
  host.querySelector('.podo-nachweis-submit-confirm-btn').click();

  // Host detached while awaiting session
  host.isConnected = false;
  resolveSession();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(postCalls, 0, 'Detached host must never fire POST request after session await');
});

test('Confirm workflow: max16 initials, checkbox validation, cancel and successful POST', async () => {
  let postCalls = 0;
  let lastPostBody = null;
  let toastMessages = [];

  const ctx = makeCtx('owner', 'mock-jwt-token', {
    showToast: (msg) => toastMessages.push(msg),
  });

  const beh = { id: 'beh-conf-1', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };

  const fetchFn = async (url, opts) => {
    if (opts?.method === 'POST') {
      postCalls++;
      lastPostBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          nachweis: makeNachweisFixture(beh, 'bestaetigt', {
            therapeuteninitialen: lastPostBody.therapeuteninitialen,
          }),
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ nachweis: null }) };
  };
  const host = new FakeElement('div');
  mountEmpfangsnachweis(host, beh, ctx, fetchFn);
  await new Promise(resolve => setTimeout(resolve, 0));

  host.querySelector('.podo-nachweis-btn-start-confirm').click();
  const initialsInput = host.querySelector('.podo-nachweis-initials-input');
  const checkbox = host.querySelector('.podo-nachweis-checkbox');
  const submitBtn = host.querySelector('.podo-nachweis-submit-confirm-btn');
  const cancelBtn = host.querySelector('.podo-nachweis-cancel-btn');
  const errorEl = host.querySelector('.podo-nachweis-form-error');

  // 1. Submit without initials -> validation error
  submitBtn.click();
  assert.equal(postCalls, 0);
  assert.match(errorEl.textContent, /Therapeuteninitialen erforderlich \(1–16 Zeichen\)/);

  // 2. Initials > 16 chars -> validation error (matching SQL max 16)
  initialsInput.value = '12345678901234567'; // 17 chars
  checkbox.checked = true;
  submitBtn.click();
  assert.equal(postCalls, 0);
  assert.match(errorEl.textContent, /Therapeuteninitialen erforderlich \(1–16 Zeichen\)/);

  // 3. Initials valid but checkbox unchecked -> validation error
  initialsInput.value = '1234567890123456'; // 16 chars (exact max allowed)
  checkbox.checked = false;
  submitBtn.click();
  assert.equal(postCalls, 0);
  assert.match(errorEl.textContent, /Prüfung des Originalpapiers/);

  // 4. Cancel button resets to display without POST
  cancelBtn.click();
  assert.equal(postCalls, 0);
  assert.match(host.innerHTML, /Papiernachweis: ungeprüft/);

  // 5. Valid confirm with max16 initials
  host.querySelector('.podo-nachweis-btn-start-confirm').click();
  host.querySelector('.podo-nachweis-initials-input').value = 'INITIALS-16CHAR';
  host.querySelector('.podo-nachweis-checkbox').checked = true;
  host.querySelector('.podo-nachweis-submit-confirm-btn').click();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(postCalls, 1);
  assert.deepEqual(lastPostBody, {
    status: 'bestaetigt',
    therapeuteninitialen: 'INITIALS-16CHAR',
  });
  assert.equal(toastMessages.length, 1);
  assert.match(host.innerHTML, /Papiernachweis geprüft \(INITIALS-16CHAR\)/);
});

test('Malformed POST success response: fail with retry, no invented state, no toast', async () => {
  let toastCalls = 0;
  const ctx = makeCtx('owner', 'mock-jwt-token', {
    showToast: () => toastCalls++,
  });

  const fetchFn = async (url, opts) => {
    if (opts?.method === 'POST') {
      // Server returns HTTP 200 but missing or invalid nachweis payload
      return {
        ok: true,
        status: 200,
        json: async () => ({ nachweis: null }), // invalid result!
      };
    }
    return { ok: true, status: 200, json: async () => ({ nachweis: null }) };
  };

  const beh = { id: 'beh-malformed', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };
  const host = new FakeElement('div');
  mountEmpfangsnachweis(host, beh, ctx, fetchFn);
  await new Promise(resolve => setTimeout(resolve, 0));

  host.querySelector('.podo-nachweis-btn-start-confirm').click();
  host.querySelector('.podo-nachweis-initials-input').value = 'XY';
  host.querySelector('.podo-nachweis-checkbox').checked = true;

  const submitBtn = host.querySelector('.podo-nachweis-submit-confirm-btn');
  submitBtn.click();
  await new Promise(resolve => setTimeout(resolve, 0));

  // Must NOT show success toast!
  assert.equal(toastCalls, 0);
  // Must NOT invent confirmed state!
  assert.doesNotMatch(host.innerHTML, /Papiernachweis geprüft/);
  // Form remains open showing error and retry enabled
  assert.match(host.querySelector('.podo-nachweis-form-error').textContent, /Fehler beim Speichern/);
  assert.equal(submitBtn.disabled, false);
});

test('Double click prevention sends only one POST', async () => {
  let postCalls = 0;
  let resolvePost;
  const beh = { id: 'beh-dc', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };

  const fetchFn = async (url, opts) => {
    if (opts?.method === 'POST') {
      postCalls++;
      return new Promise(resolve => {
        resolvePost = () => resolve({
          ok: true,
          status: 200,
          json: async () => ({ nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'DC' }) }),
        });
      });
    }
    return { ok: true, status: 200, json: async () => ({ nachweis: null }) };
  };

  const ctx = makeCtx('owner');
  const host = new FakeElement('div');
  mountEmpfangsnachweis(host, beh, ctx, fetchFn);
  await new Promise(resolve => setTimeout(resolve, 0));

  host.querySelector('.podo-nachweis-btn-start-confirm').click();
  host.querySelector('.podo-nachweis-initials-input').value = 'DC';
  host.querySelector('.podo-nachweis-checkbox').checked = true;

  const submitBtn = host.querySelector('.podo-nachweis-submit-confirm-btn');
  submitBtn.click();
  submitBtn.click(); // Immediate second click while pending

  await new Promise(resolve => setTimeout(resolve, 0)); // Session lookup resolves before fetch.
  assert.equal(postCalls, 1);
  assert.equal(submitBtn.disabled, true);

  resolvePost();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host.innerHTML, /Papiernachweis geprüft \(DC\)/);
});

test('Withdrawal workflow: reason length validation, cancel, and POST withdrawal', async () => {
  let lastPostBody = null;
  const beh = { id: 'beh-with', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };
  const fetchFn = async (url, opts) => {
    if (opts?.method === 'POST') {
      lastPostBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ nachweis: makeNachweisFixture(beh, 'widerrufen', { grund: lastPostBody.grund }) }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'MK' }) }),
    };
  };

  const ctx = makeCtx('owner');
  const host = new FakeElement('div');
  mountEmpfangsnachweis(host, beh, ctx, fetchFn);
  await new Promise(resolve => setTimeout(resolve, 0));

  host.querySelector('.podo-nachweis-btn-start-widerruf').click();
  const textarea = host.querySelector('.podo-nachweis-grund-input');
  const submitWithdraw = host.querySelector('.podo-nachweis-submit-withdraw-btn');
  const cancelBtn = host.querySelector('.podo-nachweis-cancel-btn');
  const errorEl = host.querySelector('.podo-nachweis-form-error');

  // Reason empty / whitespace validation (1–500)
  textarea.value = '   ';
  submitWithdraw.click();
  assert.match(errorEl.textContent, /1–500 Zeichen/);
  assert.equal(lastPostBody, null);

  // Cancel button resets to confirmed display without POST
  cancelBtn.click();
  assert.equal(lastPostBody, null);
  assert.match(host.innerHTML, /Papiernachweis geprüft \(MK\)/);

  // Valid reason submit
  host.querySelector('.podo-nachweis-btn-start-widerruf').click();
  host.querySelector('.podo-nachweis-grund-input').value = 'Originalbeleg unvollständig';
  host.querySelector('.podo-nachweis-submit-withdraw-btn').click();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.deepEqual(lastPostBody, {
    status: 'widerrufen',
    grund: 'Originalbeleg unvollständig',
  });
  assert.match(host.innerHTML, /Papiernachweis widerrufen/);
});

test('mountEmpfangsnachweise mounts matching hosts and ignores uneligible', async () => {
  const root = new FakeElement('div');
  root.innerHTML = `
    <div class="podo-empfangsnachweis-host" data-beh-id="beh-1"></div>
    <div class="podo-empfangsnachweis-host" data-beh-id="beh-2"></div>
  `;

  const behandlungen = [
    { id: 'beh-1', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' },
    { id: 'beh-2', hpnr_codes: ['78010'] },
  ];

  const fetchFn = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ nachweis: null }),
  });

  const ctx = makeCtx('owner');
  mountEmpfangsnachweise(root, behandlungen, ctx, fetchFn);
  await new Promise(resolve => setTimeout(resolve, 0));

  const host1 = root.querySelectorAll('.podo-empfangsnachweis-host')[0];
  const host2 = root.querySelectorAll('.podo-empfangsnachweis-host')[1];

  assert.match(host1.innerHTML, /Papiernachweis: ungeprüft/);
  assert.equal(host2.innerHTML, '');
});

test('Regression: GET response with empty object {} renders Status nicht geladen', async () => {
  const ctx = makeCtx('owner');
  const beh = { id: 'beh-empty-obj', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };
  const host = new FakeElement('div');
  mountEmpfangsnachweis(host, beh, ctx, async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host.innerHTML, /Status nicht geladen/);
  assert.ok(host.querySelector('.podo-nachweis-retry-btn'));
});

test('Regression: GET rejects contract mismatches (wrong treatment, date, HPNR, initials type)', async () => {
  const ctx = makeCtx('owner');
  const beh = { id: 'beh-contract', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };

  // 1. Wrong behandlung_id
  const host1 = new FakeElement('div');
  mountEmpfangsnachweis(host1, beh, ctx, async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      nachweis: makeNachweisFixture({ id: 'beh-WRONG', behandlungsdatum: '2026-10-01' }, 'bestaetigt', { therapeuteninitialen: 'OK' }),
    }),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host1.innerHTML, /Status nicht geladen/);

  // 2. Wrong behandlungsdatum
  const host2 = new FakeElement('div');
  mountEmpfangsnachweis(host2, beh, ctx, async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      nachweis: { ...makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'OK' }), behandlungsdatum: '2026-09-01' },
    }),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host2.innerHTML, /Status nicht geladen/);

  // 3. Wrong HPNR
  const host3 = new FakeElement('div');
  mountEmpfangsnachweis(host3, beh, ctx, async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      nachweis: { ...makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'OK' }), hpnr_code: '78010' },
    }),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host3.innerHTML, /Status nicht geladen/);

  // 4. Non-string initials
  const host4 = new FakeElement('div');
  mountEmpfangsnachweis(host4, beh, ctx, async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 12345 }),
    }),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host4.innerHTML, /Status nicht geladen/);

  // 5. Initials too long (>16)
  const host5 = new FakeElement('div');
  mountEmpfangsnachweis(host5, beh, ctx, async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'A'.repeat(17) }),
    }),
  }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(host5.innerHTML, /Status nicht geladen/);
});

test('Regression: POST response rejecting contract violations fails with error and no success toast', async () => {
  let toastCalls = 0;
  const ctx = makeCtx('owner', 'mock-jwt-token', {
    showToast: () => toastCalls++,
  });
  const beh = { id: 'beh-post-contract', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };

  const violations = [
    makeNachweisFixture({ id: 'wrong-id', behandlungsdatum: '2026-10-01' }, 'bestaetigt', { therapeuteninitialen: 'XY' }),
    { ...makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'XY' }), behandlungsdatum: '2026-11-11' },
    { ...makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'XY' }), hpnr_code: '78099' },
    { ...makeNachweisFixture(beh, 'bestaetigt'), therapeuteninitialen: ['not', 'string'] },
    makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'EXCEEDS16CHARACTERS' }),
  ];

  for (const badNachweis of violations) {
    const host = new FakeElement('div');
    mountEmpfangsnachweis(host, beh, ctx, async (url, opts) => {
      if (opts?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ nachweis: badNachweis }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ nachweis: null }) };
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    host.querySelector('.podo-nachweis-btn-start-confirm').click();
    host.querySelector('.podo-nachweis-initials-input').value = 'XY';
    host.querySelector('.podo-nachweis-checkbox').checked = true;

    const submitBtn = host.querySelector('.podo-nachweis-submit-confirm-btn');
    submitBtn.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(toastCalls, 0, 'No success toast on invalid contract');
    assert.doesNotMatch(host.innerHTML, /Papiernachweis geprüft/, 'Must not transition to confirmed UI');
    assert.match(host.querySelector('.podo-nachweis-form-error').textContent, /Fehler beim Speichern/);
    assert.equal(submitBtn.disabled, false);
  }
});

test('Regression: POST after remount rejects stale response, blocks duplicate form.submit, resolves new POST', async () => {
  let postCalls = 0;
  let resolveOldPost;
  let resolveNewPost;

  const ctx = makeCtx('owner');
  const beh = { id: 'beh-remount', hpnr_codes: ['78040'], behandlungsdatum: '2026-10-01' };
  const host = new FakeElement('div');

  const fetchFn = async (url, opts) => {
    if (opts?.method === 'POST') {
      postCalls++;
      if (postCalls === 1) {
        return new Promise(res => { resolveOldPost = res; });
      }
      return new Promise(res => { resolveNewPost = res; });
    }
    return { ok: true, status: 200, json: async () => ({ nachweis: null }) };
  };

  // 1. Initial mount and trigger old pending POST
  mountEmpfangsnachweis(host, beh, ctx, fetchFn);
  await new Promise(resolve => setTimeout(resolve, 0));

  host.querySelector('.podo-nachweis-btn-start-confirm').click();
  host.querySelector('.podo-nachweis-initials-input').value = 'OLD';
  host.querySelector('.podo-nachweis-checkbox').checked = true;
  host.querySelector('.podo-nachweis-submit-confirm-btn').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(postCalls, 1);

  // 2. Remount same host with valid GET
  mountEmpfangsnachweis(host, beh, ctx, fetchFn);
  await new Promise(resolve => setTimeout(resolve, 0));

  // 3. Start new pending POST
  host.querySelector('.podo-nachweis-btn-start-confirm').click();
  host.querySelector('.podo-nachweis-initials-input').value = 'NEW';
  host.querySelector('.podo-nachweis-checkbox').checked = true;
  host.querySelector('.podo-nachweis-submit-confirm-btn').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(postCalls, 2);

  const activeSubmitBtn = host.querySelector('.podo-nachweis-submit-confirm-btn');
  assert.equal(activeSubmitBtn.disabled, true);

  // 4. Resolve old POST -> must not corrupt active state
  resolveOldPost({
    ok: true,
    status: 200,
    json: async () => ({ nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'OLD' }) }),
  });
  await new Promise(resolve => setTimeout(resolve, 0));

  // 5. Dispatch newform.submit() directly (bypassing disabled property)
  const newForm = host.querySelector('form');
  if (newForm) {
    newForm.submit();
  } else {
    activeSubmitBtn.submit();
  }
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(postCalls, 2, 'Duplicate submit during pending POST must be ignored');
  assert.equal(activeSubmitBtn.disabled, true, 'Active controls must remain pending');

  // 6. Resolve new POST -> updates UI to NEW confirmed state
  resolveNewPost({
    ok: true,
    status: 200,
    json: async () => ({ nachweis: makeNachweisFixture(beh, 'bestaetigt', { therapeuteninitialen: 'NEW' }) }),
  });
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.match(host.innerHTML, /Papiernachweis geprüft \(NEW\)/);
  assert.doesNotMatch(host.innerHTML, /OLD/);
});
