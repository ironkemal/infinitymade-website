import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { terminAuswahlLaden, leererEditorZustand, terminLeistungen, terminBeschriftung, preisAusService } from './rechnung-editor.js';

// Pinnt die Auslassung, die den Versichertentyp-Leck verursacht hat
// (Ops-Meldung, 09.09.2026): nach einer Privatrechnung blieb
// invPatientInsuranceType stehen, weil resetInvEditor() es nicht zurücksetzte.
test('leererEditorZustand() setzt invPatientInsuranceType auf null', () => {
  const zustand = leererEditorZustand();
  assert.deepEqual(zustand, {
    invLines: [], invPatientId: null, invPrescriptionId: null,
    invVerordnungId: null, invBehandlungIds: [], invPatientInsuranceType: null,
  });
});

test('Terminauswahl der Rechnung enthält keine abgesagten Termine', async () => {
  const sb = createClient('https://test.invalid', 'test-key', { auth: { persistSession: false }, global: {
    fetch: async url => {
      const u = new URL(url);
      let data = [];
      if (u.pathname.endsWith('/leads')) data = { title: 'Testpatient' };
      if (u.pathname.endsWith('/bookings')) {
        assert.equal(u.searchParams.get('owner_id'), 'eq.praxis');
        assert.equal(u.searchParams.get('status'), 'neq.cancelled');
        data = [{ id: 'aktiv', status: 'confirmed' }, { id: 'abgesagt', status: 'cancelled' }]
          .filter(b => b.status !== 'cancelled');
      }
      return new Response(JSON.stringify(data));
    },
  } });
  assert.deepEqual(await terminAuswahlLaden(sb, { ownerId: 'praxis', leadId: 'patient' }), [{ id: 'aktiv', status: 'confirmed' }]);
});

/* ── Ops 59e8e698: der Kombi-Termin auf der Selbstzahlerrechnung ──────────── */

test('die Abfrage holt booking_leistungen mit — sonst fehlt die zweite Leistung', async () => {
  let gesehen = '';
  const sb = createClient('https://test.invalid', 'test-key', { auth: { persistSession: false }, global: {
    fetch: async url => {
      const u = new URL(url);
      if (u.pathname.endsWith('/bookings')) gesehen = u.searchParams.get('select') || '';
      return new Response(JSON.stringify(u.pathname.endsWith('/leads') ? {} : []));
    },
  } });
  await terminAuswahlLaden(sb, { ownerId: 'praxis', leadId: 'patient' });
  assert.match(gesehen, /booking_leistungen/);
  assert.match(gesehen, /anzahl/);
  assert.match(gesehen, /sort_order/);
});

test('zwei Leistungen an einem Termin werden zwei Zeilen — in sort_order', () => {
  const zeilen = terminLeistungen({
    id: 'b1', service_id: 's1',
    services: { title: 'Behandlung', price: 40 },
    booking_leistungen: [
      { anzahl: 1, sort_order: 1, services: { title: 'Eingangsbefundung', price: 15, duration_minutes: 10 } },
      { anzahl: 1, sort_order: 0, services: { title: 'Behandlung', price: 40, duration_minutes: 30 } },
    ],
  });
  assert.deepEqual(zeilen.map(z => z.title), ['Behandlung', 'Eingangsbefundung']);
  assert.equal(zeilen.reduce((s, z) => s + z.unit_price * z.quantity, 0), 55);
});

test('anzahl wird als Menge übernommen, nicht als zweite Zeile', () => {
  const zeilen = terminLeistungen({
    booking_leistungen: [{ anzahl: 3, sort_order: 0, services: { title: 'Spange', price: 20 } }],
  });
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].quantity, 3);
});

// Termine von ausserhalb der Terminmaske (Backend, Serie, Warteliste,
// Termin-Anfrage) schreiben keine booking_leistungen-Zeile. Ohne Rückfall wäre
// ihre Rechnung leer — schlimmer als die Lücke, die die Karte beschreibt.
test('ohne booking_leistungen zählt die Hauptleistung des Termins', () => {
  const zeilen = terminLeistungen({
    service_id: 's1', services: { title: 'Podologie', price: 0, duration_minutes: 30,
      price_config: { durations: { 30: { active: true, price: 32.5 } } } },
    booking_leistungen: [],
  });
  assert.deepEqual(zeilen, [{ title: 'Podologie', unit_price: 32.5, quantity: 1, duration: 30 }]);
});

test('Termin ganz ohne Leistung liefert keine Zeile statt einer leeren', () => {
  assert.deepEqual(terminLeistungen({ id: 'b1' }), []);
  assert.deepEqual(terminLeistungen(null), []);
});

test('preisAusService: price schlägt price_config, sonst erste aktive Stufe', () => {
  assert.equal(preisAusService({ price: 40, price_config: { durations: { 30: { active: true, price: 99 } } } }), 40);
  assert.equal(preisAusService({ price_config: { durations: { 20: { active: false, price: 10 }, 30: { active: true, price: 25 } } } }), 25);
  assert.equal(preisAusService(null), 0);
});

test('die Beschriftung nennt beide Leistungen und ihre Summe', () => {
  const esc = s => String(s);
  const eur = n => n.toFixed(2) + ' €';
  const txt = terminBeschriftung({
    start_time: '2026-09-16T08:00:00Z',
    booking_leistungen: [
      { anzahl: 1, sort_order: 0, services: { title: 'Behandlung', price: 40, duration_minutes: 30 } },
      { anzahl: 2, sort_order: 1, services: { title: 'Eingangsbefundung', price: 15, duration_minutes: 10 } },
    ],
  }, { escapeHtml: esc, formatEur: eur });
  assert.match(txt, /Behandlung \+ 2× Eingangsbefundung/);
  assert.match(txt, /70\.00 €/);
  assert.match(txt, /40 Min/);
});

/* ── openInvEditor Lifecycle & Race Regression Tests (VM source extraction) ── */

import fs from 'node:fs';
import vm from 'node:vm';

const dashboardSrc = fs.readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');

function extractFunctionDecl(src, fnName) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${fnName}\\s*\\([\\s\\S]*?\\n\\}`).exec(src);
  if (!match) throw new Error(`Function ${fnName} not found in dashboard.js`);
  return match[0];
}

function createEditorHarness({
  delayedCatalog = false,
  delayedPatients = false,
  loadPatientsError = null,
  catalogError = null,
  initialCache = [],
} = {}) {
  const events = [];
  const dom = {
    invPatientSelect: { id: 'invPatientSelect', value: '', disabled: false, focusCalls: 0, focus() { this.focusCalls++; } },
    invEditor: { id: 'invEditor', hidden: true },
    invListWrap: { id: 'invListWrap', hidden: false },
    invLineBody: { id: 'invLineBody', innerHTML: '' },
    invEigenPct: { id: 'invEigenPct', value: 10 },
    invKasse: { id: 'invKasse', value: 10 },
    invNotes: { id: 'invNotes', value: '' },
    invPrintBtn: { id: 'invPrintBtn', disabled: true },
    invDmrzBtn: { id: 'invDmrzBtn', disabled: true },
    invSaveBtn: { id: 'invSaveBtn' },
  };

  let resolveCatalog;
  const catalogPromise = new Promise(resolve => { resolveCatalog = resolve; });
  let resolvePatients;
  const patientsPromise = new Promise(resolve => { resolvePatients = resolve; });

  const sandbox = {
    events,
    dom,
    document: {
      getElementById(id) {
        return dom[id] || null;
      },
    },
    window: { _currentInvoiceId: null },
    leererEditorZustand,
    leereTerminAuswahl() { events.push('leereTerminAuswahl'); },
    setzeSpeichernText(btn, isUpdate) { events.push(`setzeSpeichernText:${isUpdate}`); },
    calcInvTotals() { events.push('calcInvTotals'); },
    zeigeRechnungsModus(modus) {
      events.push(`zeigeRechnungsModus:${modus}`);
      dom.invEditor.hidden = (modus !== 'editor');
      dom.invListWrap.hidden = (modus !== 'liste');
    },
    loadInvPatients: async () => {
      events.push('loadInvPatients:start');
      if (loadPatientsError) throw loadPatientsError;
      if (delayedPatients) await patientsPromise;
      events.push('loadInvPatients:end');
    },
    ensureLeistungskatalog: async () => {
      events.push('ensureLeistungskatalog:start');
      if (catalogError) throw catalogError;
      if (delayedCatalog) await catalogPromise;
      events.push('ensureLeistungskatalog:end');
    },
    invListCache: initialCache,
    loadRechnungen: async () => { events.push('loadRechnungen'); },
    showToast(msg, type) { events.push(`showToast:${type}:${msg}`); },
    renderInvLines() { events.push('renderInvLines'); },
    updateInvForInsuranceType() { events.push('updateInvForInsuranceType'); },
    invLines: [],
    invPatientId: null,
    invPrescriptionId: null,
    invVerordnungId: null,
    invBehandlungIds: [],
    invPatientInsuranceType: null,
    console,
  };

  const context = vm.createContext(sandbox);
  const code = `
    ${extractFunctionDecl(dashboardSrc, 'resetInvEditor')}
    ${extractFunctionDecl(dashboardSrc, 'openInvEditor')}
    ${extractFunctionDecl(dashboardSrc, 'closeInvEditor')}
    globalThis.resetInvEditor = resetInvEditor;
    globalThis.openInvEditor = openInvEditor;
    globalThis.closeInvEditor = closeInvEditor;
  `;
  vm.runInContext(code, context);

  return { context, events, dom, resolveCatalog, resolvePatients };
}

test('openInvEditor: reset erfolgt synchron zuerst, Editor bleibt während Laden verborgen', async () => {
  const { context, events, dom, resolveCatalog } = createEditorHarness({ delayedCatalog: true });
  context.invPatientInsuranceType = 'privat';

  const openPromise = context.openInvEditor();

  // Während Promise.all wartet:
  assert.equal(context.invPatientInsuranceType, null, 'Zustand muss sofort synchron zurückgesetzt sein');
  assert.equal(dom.invEditor.hidden, true, 'Editor muss während der Initialisierung verborgen sein (alle Controls gesperrt)');
  assert.ok(events.indexOf('leereTerminAuswahl') !== -1, 'resetInvEditor() muss vor Laden ausgeführt worden sein');
  assert.ok(events.indexOf('leereTerminAuswahl') < events.indexOf('zeigeRechnungsModus:liste'), 'reset vor liste-Modus');
  assert.ok(events.indexOf('zeigeRechnungsModus:liste') < events.indexOf('loadInvPatients:start'), 'liste-Modus vor asynchronem Laden');

  // Asynchrone Bereitschaft herstellen:
  resolveCatalog();
  await openPromise;

  assert.equal(dom.invEditor.hidden, false, 'Editor wird erst nach Abschluss aller Initialisierungen sichtbar');

  // Benutzer wählt Privatpatient: Zustand darf nach Bereitschaft nicht mehr gelöscht werden
  context.invPatientInsuranceType = 'privat';
  dom.invPatientSelect.value = 'qa-privat-patient';
  assert.equal(context.invPatientInsuranceType, 'privat', 'Privat-Status bleibt nach erreichter Bereitschaft erhalten');
});

test('openInvEditor: bestehende Rechnung wird vollständig geladen BEVOR Editor sichtbar wird', async () => {
  const testInv = {
    id: 'inv-qa-42',
    patient_id: 'pat-123',
    line_items: [{ title: 'Podologische Behandlung', unit_price: 36.10, quantity: 1 }],
    eigenanteil_pct: 0,
    kassenzuzahlung: 0,
    notes: 'QA Test',
    invoice_type: 'privat',
  };
  const { context, dom, resolveCatalog } = createEditorHarness({
    delayedCatalog: true,
    initialCache: [testInv],
  });

  const openPromise = context.openInvEditor('inv-qa-42');
  assert.equal(dom.invEditor.hidden, true, 'Editor bleibt während des Ladens verborgen');

  resolveCatalog();
  await openPromise;

  assert.equal(dom.invEditor.hidden, false);
  assert.equal(context.invPatientInsuranceType, 'privat');
  assert.equal(context.invPatientId, 'pat-123');
  assert.equal(dom.invPatientSelect.value, 'pat-123');
});

test('closeInvEditor während Initialisierung bricht Session ab und verhindert spätere Anzeige', async () => {
  const { context, dom, resolveCatalog } = createEditorHarness({ delayedCatalog: true });

  const openPromise = context.openInvEditor();
  assert.equal(dom.invEditor.hidden, true);

  // Benutzer schließt vor Fertigstellung
  context.closeInvEditor();

  resolveCatalog();
  await openPromise;

  assert.equal(dom.invEditor.hidden, true, 'Editor darf nach Abbruch nicht wieder sichtbar werden');
});

test('Reopen während Initialisierung überschreibt neuere Session nicht', async () => {
  const inv1 = { id: 'inv-1', patient_id: 'pat-1', line_items: [], invoice_type: 'kasse' };
  const inv2 = { id: 'inv-2', patient_id: 'pat-2', line_items: [], invoice_type: 'privat' };
  const { context, dom, resolveCatalog, resolvePatients } = createEditorHarness({
    delayedCatalog: true,
    delayedPatients: true,
    initialCache: [inv1, inv2],
  });

  const p1 = context.openInvEditor('inv-1');
  const p2 = context.openInvEditor('inv-2');

  // Session 1 beendet später als Session 2 Start
  resolveCatalog();
  resolvePatients();

  await Promise.all([p1, p2]);

  assert.equal(context.window._currentInvoiceId, 'inv-2', 'Neuere Session inv-2 muss aktiv bleiben');
  assert.equal(context.invPatientInsuranceType, 'privat');
  assert.equal(context.invPatientId, 'pat-2');
});

test('loadInvPatients wirft Fehler wenn Supabase einen Fehler liefert', async () => {
  const sbMock = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                order: async () => ({ data: null, error: new Error('PGRST500: internal server error') }),
              };
            },
          };
        },
      };
    },
  };
  const sandbox = {
    getOwnerId: () => 'test-owner',
    supabase: sbMock,
    document: { getElementById: () => ({ innerHTML: '' }) },
    displayNameWithBirth: l => l.first_name,
    escapeHtml: s => s,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(extractFunctionDecl(dashboardSrc, 'loadInvPatients') + '\nglobalThis.loadInvPatients = loadInvPatients;', context);

  await assert.rejects(
    async () => { await context.loadInvPatients(); },
    /PGRST500/
  );
});

test('openInvEditor fängt Fehler von loadInvPatients ab, bleibt in liste und zeigt feste deutsche Fehlermeldung', async () => {
  const { context, events, dom } = createEditorHarness({
    loadPatientsError: new Error('PGRST_SENSITIVE_DB_LEAK'),
  });

  await context.openInvEditor();

  assert.equal(dom.invEditor.hidden, true, 'Editor darf bei Fehler nicht gerendert werden');
  assert.equal(dom.invListWrap.hidden, false, 'Modus muss auf liste bleiben');
  const errorToasts = events.filter(e => e.startsWith('showToast:error:'));
  assert.equal(errorToasts.length, 1);
  assert.equal(errorToasts[0], 'showToast:error:Rechnung konnte nicht geladen werden.', 'Feste deutsche Fehlermeldung');
  assert.ok(!events.some(e => e.includes('PGRST_SENSITIVE_DB_LEAK')), 'Keine Rohdaten im Toast');
});

test('openInvEditor fängt Fehler von ensureLeistungskatalog ab und bleibt in liste', async () => {
  const { context, events, dom } = createEditorHarness({
    catalogError: new Error('Catalog fetch failure'),
  });

  await context.openInvEditor();

  assert.equal(dom.invEditor.hidden, true, 'Editor darf bei Katalogfehler nicht gerendert werden');
  const errorToasts = events.filter(e => e.startsWith('showToast:error:'));
  assert.equal(errorToasts.length, 1);
  assert.equal(errorToasts[0], 'showToast:error:Rechnung konnte nicht geladen werden.');
});


test('Echter Leistungskatalog-Ladepfad propagiert Supabase-Fehler', async () => {
  const failure = new Error('catalog unavailable');
  const query = { select() { return this; }, or() { return this; }, then(resolve) { resolve({ data: null, error: failure }); } };
  const sandbox = { servicesCache: [], ownerServices: [], katalogNachladen: () => true, GKV_LEISTUNGSKATALOG: {}, getSector: () => 'privat', getOwnerId: () => 'owner', bizScope: q => q, supabase: { from: () => query }, console };
  const context = vm.createContext(sandbox);
  vm.runInContext(extractFunctionDecl(dashboardSrc, 'loadServices') + '\n' + extractFunctionDecl(dashboardSrc, 'ensureLeistungskatalog') + '\nglobalThis.ensure = ensureLeistungskatalog;', context);
  await assert.rejects(context.ensure(), /catalog unavailable/);
});
