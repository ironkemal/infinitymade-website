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
  assert.ok(content.includes('Nur der Praxisinhaber darf die KI freischalten oder die Freischaltung zurücknehmen'));
});

test('ki-einstellungen: KI aus zeigt Grund, was ohne KI weiter geht, und Betreiber-Hinweis (Box-Test 22.11.)', async () => {
  const { container } = createContainerFixture();
  await mountKiEinstellungen(container, {
    isOwner: () => true, getSessionToken: async () => 't', apiBase: '/api/ai',
    fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, active: false, mode: 'aus' }) }),
  });
  const html = container.innerHTML;
  assert.ok(html.includes('id="kiAusHinweis"'));
  assert.match(html, /Serientermine \(Vorschlag nach festen Regeln\)/);
  assert.match(html, /Rezept-Barcode-Scan \(lokal im Browser\)/);
  assert.match(html, /vom Betreiber ausgeschaltet/);
  assert.doesNotMatch(html, /<script|undefined|null<\/strong>/);
});

// Phase 7b KI-Stufe 1 (23.11.2026): Anbieter + Region nur lesend; „Freischaltung“ statt „Einwilligung“ (legal-de).
test('ki-einstellungen: zeigt Anbieter & Region escaped, ohne Anbieter keine Zeile', async () => {
  const { container } = createContainerFixture();
  await mountKiEinstellungen(container, {
    isOwner: () => true, getSessionToken: async () => 't', apiBase: '/api/ai',
    fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, active: false, mode: 'direkt', anbieter: { name: 'Microsoft Azure OpenAI<script>', region: 'swedencentral', euRegion: true } }) }),
  });
  assert.ok(container.innerHTML.includes('id="kiAnbieterZeile"'));
  assert.ok(container.innerHTML.includes('Microsoft Azure OpenAI&lt;script&gt; · swedencentral (EU)'));
  assert.ok(!container.innerHTML.includes('<script>'));
  assert.ok(container.innerHTML.includes('Freischaltung durch den Praxisinhaber'));
  assert.ok(!/Einwilligung/.test(container.innerHTML), 'kein „Einwilligung“ mehr in der Oberfläche');
  const leer = createContainerFixture();
  await mountKiEinstellungen(leer.container, { isOwner: () => true, getSessionToken: async () => 't', apiBase: '/api/ai', fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, active: false, mode: 'aus' }) }) });
  assert.ok(!leer.container.innerHTML.includes('kiAnbieterZeile'));
});

test('ki-einstellungen: Aufgaben-Schalter (Häkchen = erlaubt), escaped, nur für den Inhaber sichtbar', async () => {
  const antwort = { success: true, active: true, mode: 'direkt', aufgaben: [{ id: 'mail', label: 'E-Mail<b>', gesperrt: false }, { id: 'serie', label: 'Serientermine vorschlagen', gesperrt: true }] };
  const inhaber = createContainerFixture();
  await mountKiEinstellungen(inhaber.container, { isOwner: () => true, getSessionToken: async () => 't', apiBase: '/api/ai', fetchImpl: async () => ({ ok: true, json: async () => antwort }) });
  const html = inhaber.container.innerHTML;
  assert.ok(html.includes('id="kiAufgaben"'));
  assert.ok(html.includes('data-ki-aufgabe="mail" checked'));
  assert.ok(html.includes('data-ki-aufgabe="serie"  '), 'gesperrte Aufgabe ohne Häkchen');
  assert.ok(html.includes('E-Mail&lt;b&gt;') && !html.includes('E-Mail<b>'));
  const ma = createContainerFixture();
  await mountKiEinstellungen(ma.container, { isOwner: () => false, getSessionToken: async () => 't', apiBase: '/api/ai', fetchImpl: async () => ({ ok: true, json: async () => antwort }) });
  // Mitarbeiter laden die KI-Konfiguration nicht (owner-only) → kein Aufgaben-Kasten
  assert.ok(!ma.container.innerHTML.includes('id="kiAufgaben"'));
});
