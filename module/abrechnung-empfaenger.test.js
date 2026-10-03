import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  empfaengerFehlerText,
  pruefeAntwort,
  empfaengerVorabPruefen,
  meldungsText,
  renderOwnerCertExpiryBanner,
  renderEmpfaengerCertMetadata,
  openDasGuideModalController,
  onDasGuideModalClosed,
  resetDasGuideModalStateForTest,
} from './abrechnung-empfaenger.js';

test('empfaengerFehlerText: 409 Empfänger ohne Hinweis bekommt Neu-erzeugen-Satz', () => {
  const t = empfaengerFehlerText({ error: 'Papierannahmestelle geändert.', code: 'PAPIERANNAHMESTELLE_GEAENDERT' }, 409);
  assert.match(t, /neu erzeugen/);
});

test('empfaengerFehlerText: Backendtext mit Hinweis wird nicht doppelt ergänzt', () => {
  const t = empfaengerFehlerText({ error: 'X geändert. Bitte die Abrechnung neu erzeugen.', code: 'EMPFAENGER_GEAENDERT' }, 409);
  assert.equal(t.match(/neu erzeugen/g).length, 1);
});

test('empfaengerFehlerText: anderer Fehler bleibt unverändert', () => {
  assert.equal(empfaengerFehlerText({ error: 'Kein DTA-Inhalt vorhanden' }, 409), 'Kein DTA-Inhalt vorhanden');
  assert.equal(empfaengerFehlerText({}, 500), 'HTTP 500');
});

test('pruefeAntwort: stichtagWarnung → Warn-Toast, kein Wurf', () => {
  const toasts = [];
  const j = pruefeAntwort({ ok: true }, { ok: true, stichtagWarnung: [{ code: 'QUARTALSWECHSEL', stufe: 'warnung', text: 'Quartal prüfen.' }] },
    (m, t) => toasts.push([m, t]));
  assert.equal(j.ok, true);
  assert.deepEqual(toasts, [['Hinweis: Quartal prüfen.', 'warning']]);
});

test('pruefeAntwort: !ok wirft', () => {
  assert.throws(() => pruefeAntwort({ ok: false, status: 409 }, { error: 'E', code: 'EMPFAENGER_GEAENDERT' }), /neu erzeugen/);
});

test('empfaengerVorabPruefen: Block wirft, Warnung toastet, Ausfall blockiert nicht', async () => {
  const antwort = body => async () => ({ ok: true, json: async () => body });
  await assert.rejects(empfaengerVorabPruefen({ apiBase: 'x', token: 't', abrechnungId: '1',
    fetchFn: antwort({ blockiert: true, meldungen: [{ code: 'KEINE_DATENANNAHMESTELLE', stufe: 'block', text: 'Keine Stelle.' }] }) }), /Keine Stelle\. .*neu erzeugen/);
  const toasts = [];
  await empfaengerVorabPruefen({ apiBase: 'x', token: 't', abrechnungId: '1', showToast: m => toasts.push(m),
    fetchFn: antwort({ blockiert: false, meldungen: [{ code: 'QUARTALSWECHSEL', stufe: 'warnung', text: 'Q prüfen.' }] }) });
  assert.deepEqual(toasts, ['Hinweis: Q prüfen.']);
  assert.equal(await empfaengerVorabPruefen({ apiBase: 'x', token: 't', abrechnungId: '1', fetchFn: async () => { throw new Error('net'); } }), null);
  assert.equal(await empfaengerVorabPruefen({ apiBase: 'x', token: 't', abrechnungId: '1', fetchFn: async () => ({ ok: false }) }), null);
});

test('meldungsText filtert nach Stufe', () => {
  assert.equal(meldungsText([{ stufe: 'block', text: 'a' }, { stufe: 'warnung', text: 'b' }], 'warnung'), 'b');
  assert.equal(meldungsText(null), '');
});

// -------------------------------------------------------------
// DOM Mock Helpers
// -------------------------------------------------------------

function createMockElement(id = '') {
  const el = {
    id,
    hidden: false,
    textContent: '',
    innerHTML: '',
    style: {},
    className: '',
    children: [],
    ownerDocument: null,
    replaceChildren(...newChildren) {
      el.children = [...newChildren];
      el.textContent = '';
      el.innerHTML = '';
    },
    appendChild(child) {
      el.children.push(child);
      return child;
    },
    querySelector(selector) {
      const cls = selector.replace(/^\./, '');
      const find = node => {
        if (node.className?.includes(cls)) return node;
        for (const c of node.children || []) {
          const res = find(c);
          if (res) return res;
        }
        return null;
      };
      return find(el);
    },
    querySelectorAll(selector) {
      const cls = selector.replace(/^\./, '');
      const list = [];
      const collect = node => {
        if (node.className?.includes(cls)) list.push(node);
        for (const c of node.children || []) collect(c);
      };
      collect(el);
      return list;
    },
  };
  return el;
}

function createMockDoc() {
  const elements = new Map();
  const doc = {
    createElement(tag) {
      const el = createMockElement();
      el.tagName = tag.toUpperCase();
      el.ownerDocument = doc;
      return el;
    },
    getElementById(id) {
      if (!elements.has(id)) {
        const el = createMockElement(id);
        el.ownerDocument = doc;
        elements.set(id, el);
      }
      return elements.get(id);
    },
  };
  return { doc, elements };
}

// -------------------------------------------------------------
// Tests: renderOwnerCertExpiryBanner
// -------------------------------------------------------------

test('Owner-Ablaufbanner: Mitarbeiter-Rolle -> Banner bleibt versteckt, DB wird nicht abgefragt', async () => {
  const { doc } = createMockDoc();
  const bannerEl = doc.getElementById('cert-expiry-banner');
  let dbCalled = false;
  const supabase = {
    from() {
      dbCalled = true;
      return {};
    },
  };

  await renderOwnerCertExpiryBanner({
    currentProfile: { id: 'emp-1', role: 'employee' },
    supabase,
    doc,
  });

  assert.equal(bannerEl.hidden, true);
  assert.equal(dbCalled, false);
});

test('Owner-Ablaufbanner: Fehlendes Datum (cert_valid_to null) -> Banner bleibt versteckt', async () => {
  const { doc } = createMockDoc();
  const bannerEl = doc.getElementById('cert-expiry-banner');
  const supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { cert_valid_to: null } }) }) }) }),
  };

  await renderOwnerCertExpiryBanner({
    currentProfile: { id: 'owner-1', role: 'owner' },
    supabase,
    doc,
  });

  assert.equal(bannerEl.hidden, true);
});

test('Owner-Ablaufbanner: Ungültiges Datum -> Banner bleibt versteckt', async () => {
  const { doc } = createMockDoc();
  const bannerEl = doc.getElementById('cert-expiry-banner');
  const supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { cert_valid_to: 'kein-datum' } }) }) }) }),
  };

  await renderOwnerCertExpiryBanner({
    currentProfile: { id: 'owner-1', role: 'owner' },
    supabase,
    doc,
  });

  assert.equal(bannerEl.hidden, true);
});

test('Owner-Ablaufbanner: 30-Tage-Grenze (31 Tage -> verborgen; 30 Tage -> sichtbar)', async () => {
  const { doc } = createMockDoc();
  const bannerEl = doc.getElementById('cert-expiry-banner');
  const now = new Date('2026-10-01T12:00:00.000Z').getTime();

  // 31 Tage verbleibend: kein Banner (Frisch-Zustand)
  const date31 = new Date(now + 31 * 86400000).toISOString();
  let supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { cert_valid_to: date31 } }) }) }) }),
  };
  await renderOwnerCertExpiryBanner({ currentProfile: { id: 'owner-1', role: 'owner' }, supabase, doc, now });
  assert.equal(bannerEl.hidden, true, 'Bei >30 Tagen darf kein Banner angezeigt werden');

  // Genau 30 Tage verbleibend: Banner wird sichtbar
  const date30 = new Date(now + 30 * 86400000).toISOString();
  supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { cert_valid_to: date30 } }) }) }) }),
  };
  await renderOwnerCertExpiryBanner({ currentProfile: { id: 'owner-1', role: 'owner' }, supabase, doc, now });
  assert.equal(bannerEl.hidden, false, 'Bei 30 Tagen muss Banner sichtbar sein');
  assert.match(bannerEl.innerHTML, /30 Tage/);
  assert.match(bannerEl.innerHTML, /var\(--warning-text/);
});

test('Owner-Ablaufbanner: Negativ / Abgelaufen (0 oder negative Tage -> rot / abgelaufen)', async () => {
  const { doc } = createMockDoc();
  const bannerEl = doc.getElementById('cert-expiry-banner');
  const now = new Date('2026-10-01T12:00:00.000Z').getTime();

  const expiredDate = new Date(now - 2 * 86400000).toISOString();
  const supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { cert_valid_to: expiredDate } }) }) }) }),
  };

  await renderOwnerCertExpiryBanner({ currentProfile: { id: 'owner-1', role: 'owner' }, supabase, doc, now });
  assert.equal(bannerEl.hidden, false);
  assert.match(bannerEl.innerHTML, /abgelaufen/);
  assert.match(bannerEl.innerHTML, /var\(--danger/);
});

// -------------------------------------------------------------
// Tests: renderEmpfaengerCertMetadata
// -------------------------------------------------------------

test('renderEmpfaengerCertMetadata: Escaped Subject — HTML-Injektion wird über textContent verhindert', () => {
  const { doc } = createMockDoc();
  const container = doc.createElement('div');
  const xssSubject = '<img src=x onerror=alert(1)>CN=BadSubject, OU=IK123456789';

  renderEmpfaengerCertMetadata(container, {
    status: 'geprueft',
    ik: '123456789',
    subject: xssSubject,
    validTo: '2027-12-31T23:59:59.000Z',
    fingerprintSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    geprueftAm: '2026-10-03T10:00:00.000Z',
  });

  const subjectSpan = container.children[0].children[1].children.find(c => c.textContent?.includes('BadSubject'));
  assert.ok(subjectSpan);
  assert.equal(subjectSpan.textContent, xssSubject);
  // Keine aktiven HTML-Kindelemente durch Injection
  assert.equal(subjectSpan.children?.length || 0, 0);
});

test('renderEmpfaengerCertMetadata: Unbekannter/Fehlender/Ungültiger Status ist NIEMALS grün (nie var(--success))', () => {
  const { doc } = createMockDoc();

  const statuses = ['ungueltig', 'nicht_pruefbar', 'fehlend', 'unbekannt', null, undefined];
  for (const st of statuses) {
    const container = doc.createElement('div');
    renderEmpfaengerCertMetadata(container, { status: st, ik: '123456789' });
    const badge = container.querySelector('.dg-cert-status-badge');
    assert.ok(badge);
    assert.doesNotMatch(badge.style.background || '', /var\(--success/, `Status ${st} darf niemals grün sein`);
    assert.doesNotMatch(badge.style.color || '', /var\(--success/, `Status ${st} darf niemals grün sein`);
  }

  // Nur geprueft ist grün
  const okContainer = doc.createElement('div');
  renderEmpfaengerCertMetadata(okContainer, { status: 'geprueft', ik: '123456789' });
  const okBadge = okContainer.querySelector('.dg-cert-status-badge');
  assert.ok(okBadge);
  assert.match(okBadge.style.background, /var\(--success-dim/);
  assert.match(okBadge.style.color, /var\(--success/);
});

test('renderEmpfaengerCertMetadata: blockiert true -> Rote Blockwarnung, Zertifikatsstatus bleibt separate Info (keine grüne Versandfreigabe)', () => {
  const { doc } = createMockDoc();
  const container = doc.createElement('div');

  renderEmpfaengerCertMetadata(
    container,
    {
      status: 'geprueft',
      ik: '661430035',
      subject: 'C=DE, O=ITSG TrustCenter, OU=IK661430035, CN=Test Empfaenger',
      validTo: '2028-01-01T00:00:00.000Z',
      fingerprintSha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      geprueftAm: '2026-10-03T10:00:00.000Z',
    },
    {
      blockiert: true,
      meldungen: [
        {
          stufe: 'block',
          code: 'EMPFAENGER_STICHTAG_BLOCK',
          text: 'Empfänger-IK ist zum Stichtag nicht mehr zuständig. Bitte erzeugen Sie die Abrechnung neu.',
        },
      ],
    }
  );

  // Status-Badge zeigt Zertifikats-PKI-Status als separate Information
  const badge = container.querySelector('.dg-cert-status-badge');
  assert.ok(badge);
  assert.equal(badge.textContent, 'Geprüft (PKI gültig)');

  // Aber es gibt eine rote Blockwarnung, KEINE grüne Versandfreigabe
  const hinweisEl = container.children[0].children[2];
  assert.ok(hinweisEl);
  assert.match(hinweisEl.textContent, /Empfänger-IK ist zum Stichtag nicht mehr zuständig/);
  assert.match(hinweisEl.style.background, /var\(--danger-dim/);
  assert.match(hinweisEl.style.color, /var\(--danger/);
});

// -------------------------------------------------------------
// Tests: openDasGuideModalController (Rennschutz & Asynchronität)
// -------------------------------------------------------------

test('openDasGuideModalController: Sofort-Reset vor await (loadingquick) — kein alter Rechnungs-/Zertifikatsstand', async () => {
  resetDasGuideModalStateForTest();
  const { doc } = createMockDoc();
  const header = doc.getElementById('dasGuideHeader');
  const certMeta = doc.getElementById('dasGuideCertMeta');
  const state = { abrechnungId: 'old-id', abrechnung: { dateiname: 'alte-rechnung.dta' } };

  let resolveDb;
  const dbPromise = new Promise(r => { resolveDb = r; });
  const supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => dbPromise }) }) }),
    auth: { async getSession() { return { data: { session: null } }; } },
  };

  const openPromise = openDasGuideModalController({
    abrechnungId: 'new-id',
    supabase,
    state,
    doc,
  });

  // Vor dem ersten await:
  assert.equal(state.abrechnung, null, 'state.abrechnung muss vor await geleert sein');
  assert.equal(header.textContent, 'Laden…');
  const loadingBadge = certMeta.querySelector('.dg-cert-status-badge');
  assert.equal(loadingBadge?.textContent, 'Wird geladen…');

  // Async abschließen
  resolveDb({ data: null, error: null });
  await openPromise;
});

test('openDasGuideModalController: Request-Fehlschlag -> saubere Fehlermeldung, niemals grün', async () => {
  resetDasGuideModalStateForTest();
  const { doc } = createMockDoc();
  const certMeta = doc.getElementById('dasGuideCertMeta');
  const state = {};

  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: 'ab-1', empfaenger_ik: '661430035', prescription_count: 5 },
            error: null,
          }),
        }),
      }),
    }),
    auth: { async getSession() { return { data: { session: { access_token: 'tok' } } }; } },
  };

  const failingFetch = async () => ({ ok: false, status: 500 });

  await openDasGuideModalController({
    abrechnungId: 'ab-1',
    supabase,
    apiBase: 'http://test',
    state,
    doc,
    fetchFn: failingFetch,
  });

  const badge = certMeta.querySelector('.dg-cert-status-badge');
  assert.equal(badge?.textContent, 'Nicht geprüft');
  assert.match(badge?.style.color || '', /var\(--danger/);
});

test('openDasGuideModalController: A -> B Reorder Race (spätere Antwort von A überschreibt nicht B)', async () => {
  resetDasGuideModalStateForTest();
  const { doc } = createMockDoc();
  const header = doc.getElementById('dasGuideHeader');
  const state = {};

  let resolveA;
  const pA = new Promise(r => { resolveA = r; });

  const supabase = {
    from: () => ({
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: async () => {
            if (val === 'id-A') return pA;
            return { data: { id: 'id-B', dateiname: 'Rechnung-B.dta' }, error: null };
          },
        }),
      }),
    }),
    auth: { async getSession() { return { data: { session: null } }; } },
  };

  // 1. Abrechnung A öffnen (langsam)
  const promiseA = openDasGuideModalController({
    abrechnungId: 'id-A',
    supabase,
    state,
    doc,
    escapeHtml: s => s,
  });

  // 2. Abrechnung B öffnen (schnell)
  await openDasGuideModalController({
    abrechnungId: 'id-B',
    supabase,
    state,
    doc,
    escapeHtml: s => s,
  });

  assert.equal(state.abrechnung?.id, 'id-B');
  assert.match(header.innerHTML, /Rechnung-B\.dta/);

  // 3. Jetzt löst verzögertes A auf
  resolveA({ data: { id: 'id-A', dateiname: 'Rechnung-A.dta' }, error: null });
  await promiseA;

  // Stand B bleibt erhalten!
  assert.equal(state.abrechnung?.id, 'id-B');
  assert.match(header.innerHTML, /Rechnung-B\.dta/);
});

test('openDasGuideModalController: Close / Reopen Race (geschlossenes Modal wird nie durch späten Async wiederbelebt)', async () => {
  resetDasGuideModalStateForTest();
  const { doc } = createMockDoc();
  const header = doc.getElementById('dasGuideHeader');
  const state = {};

  let resolveDb;
  const pDb = new Promise(r => { resolveDb = r; });

  const supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => pDb }) }) }),
    auth: { async getSession() { return { data: { session: null } }; } },
  };

  let modalOpened = false;
  const openModal = () => { modalOpened = true; };

  const promise = openDasGuideModalController({
    abrechnungId: 'id-1',
    supabase,
    state,
    doc,
    openModal,
  });

  assert.equal(modalOpened, true);

  // Modal wird vom Nutzer geschlossen bevor DB antwortet
  onDasGuideModalClosed();
  modalOpened = false;

  // DB liefert jetzt Daten
  resolveDb({ data: { id: 'id-1', dateiname: 'Late.dta' }, error: null });
  await promise;

  // Modal darf nicht wieder geöffnet worden sein, und State wurde nicht gesetzt
  assert.equal(modalOpened, false);
  assert.equal(state.abrechnung, null);
});

for (const sameId of [false, true]) {
  test(`openDasGuideModalController: verzögerter CERTfetch überschreibt ${sameId ? 'Close/Reopen derselben ID' : 'Abrechnung B'} nicht`, async () => {
    resetDasGuideModalStateForTest();
    const { doc } = createMockDoc();
    const state = {};
    const certMeta = doc.getElementById('dasGuideCertMeta');
    let resolveOld;
    let signalFetch;
    const fetchStarted = new Promise(resolve => { signalFetch = resolve; });
    const oldFetch = new Promise(resolve => { resolveOld = resolve; });
    const supabase = {
      from: () => ({ select: () => ({ eq: (_, id) => ({ maybeSingle: async () => ({
        data: { id, dateiname: `${id}.dta`, empfaenger_ik: '661430035' }, error: null,
      }) }) }) }),
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    };
    const oldRequest = openDasGuideModalController({
      abrechnungId: 'id-A', supabase, state, doc, apiBase: 'http://test',
      fetchFn: () => { signalFetch(); return oldFetch; },
    });
    await fetchStarted;
    if (sameId) onDasGuideModalClosed();
    const activeId = sameId ? 'id-A' : 'id-B';
    await openDasGuideModalController({
      abrechnungId: activeId, supabase, state, doc, apiBase: 'http://test',
      fetchFn: async () => ({ ok: true, json: async () => ({ empfCert: {
        status: 'fehlend', ik: '661430035', subject: 'Neue Antwort',
      } }) }),
    });
    const currentMetadata = certMeta.children[0];
    assert.equal(certMeta.querySelector('.dg-cert-status-badge')?.textContent, 'Zertifikat fehlt');
    resolveOld({ ok: true, json: async () => ({ empfCert: {
      status: 'geprueft', ik: '661430035', subject: 'Veraltete Antwort',
    } }) });
    await oldRequest;
    assert.equal(state.abrechnung.id, activeId);
    assert.equal(certMeta.children[0], currentMetadata, 'Späte Zertifikatsantwort darf den neuen DOM-Stand nicht ersetzen');
    assert.equal(certMeta.querySelector('.dg-cert-status-badge')?.textContent, 'Zertifikat fehlt');
  });
}
