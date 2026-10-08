import test from 'node:test';
import assert from 'node:assert/strict';
import { mountKiEinstellungen } from './ki-einstellungen.js';

function createContainerFixture() {
  let html = '';
  const listeners = new Map();

  const container = {
    get innerHTML() { return html; },
    set innerHTML(val) {
      html = val;
      listeners.clear();
    },
    querySelector: (selector) => {
      if (selector === '#kiOwnerOptInToggle') {
        const isChecked = html.includes('id="kiOwnerOptInToggle" checked') || html.includes('checked ');
        const isDisabled = html.includes('id="kiOwnerOptInToggle"') && html.includes('disabled');

        return {
          checked: isChecked,
          disabled: isDisabled,
          addEventListener: (evt, fn) => {
            if (!listeners.has(evt)) listeners.set(evt, []);
            listeners.get(evt).push(fn);
          },
          dispatchFakeEvent: (evt) => {
            const arr = listeners.get(evt) || [];
            for (const fn of arr) fn();
          }
        };
      }
      return null;
    }
  };

  return { container, listeners };
}

test('ki-einstellungen: renders standard off explanatory status and distinct operator/mail blocks', async () => {
  const { container } = createContainerFixture();

  await mountKiEinstellungen(container, {
    isOwner: () => true,
    getSessionToken: async () => 'fake-token',
    apiBase: '/api/ai',
    fetchImpl: async()=>({ok:true,json:async()=>({success:true,active:false,mode:'aus'})})
  });

  const content = container.innerHTML;

  // Asserts standard off explanatory status
  assert.ok(content.includes('○ Deaktiviert'));
  assert.ok(content.includes('Standardmäßig deaktiviert'));

  // Asserts distinct operator readiness block
  assert.ok(content.includes('Betreiber-Bereitschaft (Technik)'));
  assert.ok(content.includes('Technische Freigabe ausstehend'));
  assert.ok(!content.includes('AI_ACTIVATION_READY'));

  // Asserts distinct mail readiness block
  assert.ok(content.includes('E-Mail-Assistent (B2C / B2B)'));
  assert.ok(content.includes('Noch nicht freigegeben'));
  assert.ok(!content.includes('AI_MAIL_READY'));

  // Asserts clear statement regarding anonymity (no guarantee, direct provider, no relay)
  assert.ok(content.includes('pseudonymisiert'));
  assert.ok(content.includes('keine Garantie vollständiger Anonymität'));
  assert.ok(content.includes('kein zentrales Relay'));
});

test('ki-einstellungen: employee sees disabled checkbox with owner-only notice', async () => {
  const { container } = createContainerFixture();

  await mountKiEinstellungen(container, {
    isOwner: () => false, // Non-owner (employee)
    getRole: () => 'employee',
    getSessionToken: async () => 'emp-token',
    apiBase: '/api/ai',
    fetchImpl: async()=>({ok:true,json:async()=>({success:true,active:false,mode:'aus'})})
  });

  const content = container.innerHTML;

  // Assert disabled attribute and explanatory hint
  assert.ok(content.includes('disabled'));
  assert.ok(content.includes('Nur der Praxisinhaber darf die KI-Einwilligung aktivieren oder widerrufen'));
});
