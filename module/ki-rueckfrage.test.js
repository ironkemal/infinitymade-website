import test from 'node:test';
import assert from 'node:assert/strict';
import { zeigeKiRueckfrageDialog } from './ki-rueckfrage.js';

function createModalFixture() {
  const elements = new Map();

  const titleEl = { textContent: '', innerHTML: '' };
  const textEl = {
    textContent: '',
    children: [],
    appendChild(child) { this.children.push(child); }
  };
  const modal = { hidden: true };

  elements.set('confirmModalText', textEl);
  elements.set('confirmModal', modal);

  const fakeDoc = {
    getElementById: (id) => elements.get(id) || null,
    activeElement: { focus: () => {} },
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        style: { cssText: '' },
        attributes: new Map(),
        children: [],
        textContent: '',
        value: '',
        focusCalled: false,
        setAttribute(k, v) { this.attributes.set(k, v); },
        getAttribute(k) { return this.attributes.get(k); },
        appendChild(child) { this.children.push(child); },
        focus() { this.focusCalled = true; }
      };
      return el;
    }
  };

  let mockDialogResolve;
  const dialogPromise = new Promise(r => mockDialogResolve = r);

  const deps = {
    document: fakeDoc,
    zeigeBestaetigungsDialog: () => dialogPromise
  };

  return { fakeDoc, textEl, deps, mockDialogResolve };
}

test('injection renders text: malicious HTML or script tags in challenge candidates are strictly textContent', async () => {
  const f = createModalFixture();
  const maliciousCandidate = {
    id: 'c_attack_1',
    text: '<script>alert("pwned")</script><img src=x onerror=alert(1)>',
    type: 'PERSON'
  };

  const expiresAt=Date.now()+60000;
  const p = zeigeKiRueckfrageDialog({
    challengeId: 'a'.repeat(64)+'.'+expiresAt,
    expiresAt,
    candidates: [maliciousCandidate]
  }, f.deps);

  const candidatesContainer = f.textEl.children.find(c => c.tagName === 'DIV');
  assert.ok(candidatesContainer);

  const candRow = candidatesContainer.children[0];
  assert.ok(candRow);

  const labelWrap = candRow.children.find(c => c.tagName === 'DIV');
  const textSpan = labelWrap.children[0];
  const typeSpan = labelWrap.children[1];

  assert.equal(textSpan.textContent, '<script>alert("pwned")</script><img src=x onerror=alert(1)>');
  assert.equal(textSpan.children.length, 0);

  assert.equal(typeSpan.textContent, 'Typ: PERSON');
  assert.equal(typeSpan.children.length, 0);

  f.mockDialogResolve(false);
  const res = await p;
  assert.equal(res, null);
});

test('cancel closes via Abbrechen button with null and cleans up handlers', async () => {
  const f = createModalFixture();

  const expiresAt=Date.now()+60000;
  const p = zeigeKiRueckfrageDialog({
    challengeId: 'a'.repeat(64)+'.'+expiresAt,
    expiresAt,
    candidates: [{ id: 'c_1', text: 'Dr. Müller', type: 'PERSON' }]
  }, f.deps);

  f.mockDialogResolve(false);

  const res = await p;
  assert.equal(res, null);
});

test('explicit confirmation returns structured choices with maskieren by default', async () => {
  const f = createModalFixture();

  const expiresAt=Date.now()+60000;
  const p = zeigeKiRueckfrageDialog({
    challengeId: 'a'.repeat(64)+'.'+expiresAt,
    expiresAt,
    candidates: [
      { id: 'c_1', text: 'Max Mustermann', type: 'PERSON' },
      { id: 'c_2', text: 'Praxis Dr. K', type: 'ORGANIZATION' }
    ]
  }, f.deps);

  const candidatesContainer = f.textEl.children.find(c => c.tagName === 'DIV');
  const select1 = candidatesContainer.children[0].children.find(c => c.tagName === 'SELECT');
  const select2 = candidatesContainer.children[1].children.find(c => c.tagName === 'SELECT');
  assert.equal(select1.focusCalled, true);

  select2.value = 'kein_name';
  f.mockDialogResolve(true);

  const res = await p;

  assert.deepEqual(res, {
    challengeId: 'a'.repeat(64)+'.'+expiresAt,
    choices: [
      { id: 'c_1', action: 'maskieren' },
      { id: 'c_2', action: 'kein_name' }
    ]
  });
});
