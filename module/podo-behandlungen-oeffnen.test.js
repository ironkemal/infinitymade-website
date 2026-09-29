// Reform-Sprint S1.4/S1.7 (29.09.2026). "Termin starten" auf einem
// podologischen Termin muss die Tagesbehandlung mit der Verordnung UND dem
// Termin-Datum öffnen, statt den Physio-Sitzungsbuch-Weg zu laufen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oeffnePodoBehandlungen, terminIstPodo, terminDatum, terminInZukunft, terminStartenPodo } from './podo-behandlungen-oeffnen.js';

function fakeDeps({ vords = [], confirmResult = true } = {}) {
  const calls = { setPodVorwahl: [], switchPanel: [], closeBkActionPanel: 0, showToast: [], showConfirmModal: [], sbLimit: [] };
  const sb = {
    from(table) {
      assert.equal(table, 'prescriptions');
      return {
        select() { return this; },
        eq() { return this; },
        or() { return this; },
        order() { return this; },
        limit(n) { calls.sbLimit.push(n); return Promise.resolve({ data: vords.slice(0, n) }); },
      };
    },
  };
  return {
    calls,
    deps: {
      sb,
      ownerId: 'owner-1',
      showToast: (msg, type) => calls.showToast.push({ msg, type }),
      closeBkActionPanel: () => { calls.closeBkActionPanel++; },
      setPodVorwahl: (id, opt) => calls.setPodVorwahl.push([id, opt]),
      switchPanel: (id) => { calls.switchPanel.push(id); return Promise.resolve(); },
      showConfirmModal: (opt) => { calls.showConfirmModal.push(opt); return Promise.resolve(confirmResult); },
    },
  };
}

// ── vordId bekannt (vom Termin, bookings.verordnung_id) ─────────────────────

test('vordId gegeben: keine Suche, setPodVorwahl(vordId, { datum })', async () => {
  const { deps, calls } = fakeDeps();
  await oeffnePodoBehandlungen('lead-1', { vordId: 'vord-42', datum: '2026-09-29' }, deps);
  assert.deepEqual(calls.setPodVorwahl, [['vord-42', { datum: '2026-09-29' }]]);
  assert.deepEqual(calls.switchPanel, ['podologie-billing']);
  assert.equal(calls.closeBkActionPanel, 1);
});

// ── ohne vordId: altes Verhalten unverändert ────────────────────────────────

test('kein vordId, kein datum: Suche läuft, setPodVorwahl(id, { datum: undefined }) — altes Verhalten (setPodVorwahl liest das als null)', async () => {
  const { deps, calls } = fakeDeps({ vords: [{ id: 'vord-7', abrechnung_status: null, ausstellungsdatum: '2026-09-01' }] });
  await oeffnePodoBehandlungen('lead-1', {}, deps);
  assert.deepEqual(calls.setPodVorwahl, [['vord-7', { datum: undefined }]]);
  assert.deepEqual(calls.switchPanel, ['podologie-billing']);
});

// Bugfix (Koordinator, 29.09.2026): der Suchpfad (kein vordId — Termin noch
// keiner Verordnung zugeordnet) hat `datum` bisher verschluckt. Für einen
// podologischen Termin ohne verordnung_id (S1.7-Fall) öffnete "Termin starten"
// die Tagesbehandlung dadurch immer mit dem heutigen Datum statt mit dem
// Termin-Datum.
test('kein vordId, ABER datum gegeben: setPodVorwahl(sorgeErgebnisId, { datum }) — Datum geht im Suchpfad nicht verloren', async () => {
  const { deps, calls } = fakeDeps({ vords: [{ id: 'vord-7', abrechnung_status: null, ausstellungsdatum: '2026-09-01' }] });
  await oeffnePodoBehandlungen('lead-1', { datum: '2026-09-29' }, deps);
  assert.deepEqual(calls.setPodVorwahl, [['vord-7', { datum: '2026-09-29' }]]);
  assert.deepEqual(calls.switchPanel, ['podologie-billing']);
});

test('kein vordId und keine laufende Verordnung: Warnung, Panel bleibt zu', async () => {
  const { deps, calls } = fakeDeps({ vords: [] });
  await oeffnePodoBehandlungen('lead-1', {}, deps);
  assert.equal(calls.showToast.length, 1);
  assert.equal(calls.showToast[0].type, 'warning');
  assert.deepEqual(calls.switchPanel, []);
  assert.equal(calls.closeBkActionPanel, 0);
});

// ── ohne leadId ──────────────────────────────────────────────────────────────

test('ohne leadId: Warnung, keine Suche, kein Panelwechsel', async () => {
  const { deps, calls } = fakeDeps();
  await oeffnePodoBehandlungen(null, { vordId: 'vord-1' }, deps);
  assert.equal(calls.showToast.length, 1);
  assert.deepEqual(calls.switchPanel, []);
  assert.deepEqual(calls.setPodVorwahl, []);
});

// ── Podo/Fizyo-Entscheidung ──────────────────────────────────────────────────

test('verordnung_id gesetzt → immer podologisch, unabhängig vom Tab', () => {
  assert.equal(terminIstPodo({ verordnung_id: 'v1', lead_id: 'l1' }, 'physio'), true);
  assert.equal(terminIstPodo({ verordnung_id: 'v1' }, 'podologie'), true);
});

test('keine verordnung_id, Podologie-Tab, mit Patient → podologisch', () => {
  assert.equal(terminIstPodo({ lead_id: 'l1' }, 'podologie'), true);
});

test('keine verordnung_id, Podologie-Tab, ohne Patient → nicht podologisch', () => {
  assert.equal(terminIstPodo({ lead_id: null }, 'podologie'), false);
});

test('keine verordnung_id, anderer Fachbereich → Physio-Weg unverändert', () => {
  assert.equal(terminIstPodo({ lead_id: 'l1' }, 'physio'), false);
  assert.equal(terminIstPodo({}, 'ergotherapie'), false);
});

// ── Termin-Datum: Europe/Berlin, DST-Grenze ─────────────────────────────────

test('Termin-Datum ohne start_time: undefined', () => {
  assert.equal(terminDatum({}), undefined);
  assert.equal(terminDatum(null), undefined);
});

test('Termin-Datum: normaler Vormittagstermin', () => {
  assert.equal(terminDatum({ start_time: '2026-09-29T09:00:00Z' }), '2026-09-29');
});

test('Termin-Datum an der Berliner Sommerzeit-Grenze (29.03.2026, Umstellung CET→CEST): 22:30 UTC ist schon der nächste Tag', () => {
  // 29.03.2026 ist die Umstellungsnacht (letzter Sonntag im März). Ab 01:00 UTC
  // gilt CEST (+2). Um 22:30 UTC ist Berlin bei +2 also 00:30 des Folgetags.
  assert.equal(terminDatum({ start_time: '2026-03-29T22:30:00Z' }), '2026-03-30');
});

// ── terminStartenPodo: Datum + vordId zusammen ──────────────────────────────

test('terminStartenPodo leitet Datum aus start_time ab und reicht verordnung_id durch', async () => {
  const { deps, calls } = fakeDeps();
  await terminStartenPodo({ lead_id: 'lead-9', verordnung_id: 'vord-9', start_time: '2026-09-29T09:00:00Z' }, deps);
  assert.deepEqual(calls.setPodVorwahl, [['vord-9', { datum: '2026-09-29' }]]);
});

test('terminStartenPodo ohne verordnung_id (Termin noch nicht zugeordnet): sucht laufende Verordnung UND gibt das Termin-Datum mit — sonst öffnet Tagesbehandlung mit dem heutigen statt dem Termin-Datum', async () => {
  const { deps, calls } = fakeDeps({ vords: [{ id: 'vord-3' }] });
  await terminStartenPodo({ lead_id: 'lead-9', start_time: '2026-09-29T09:00:00Z' }, deps);
  assert.deepEqual(calls.setPodVorwahl, [['vord-3', { datum: '2026-09-29' }]]);
});

// ── terminInZukunft: reiner String-Vergleich ────────────────────────────────

test('terminInZukunft: Termin nach heute -> true', () => {
  assert.equal(terminInZukunft('2026-10-05', '2026-09-29'), true);
});

test('terminInZukunft: Termin = heute -> false (keine Rückfrage für den heutigen Termin)', () => {
  assert.equal(terminInZukunft('2026-09-29', '2026-09-29'), false);
});

test('terminInZukunft: Termin vor heute -> false', () => {
  assert.equal(terminInZukunft('2026-09-20', '2026-09-29'), false);
});

test('terminInZukunft: ohne datum/heute -> false, kein Wurf', () => {
  assert.equal(terminInZukunft(undefined, '2026-09-29'), false);
  assert.equal(terminInZukunft('2026-09-29', undefined), false);
});

// ── terminStartenPodo: Rückfrage bei zukünftigem Termin ─────────────────────
// Weit in der Zukunft (2099), damit der Test nicht irgendwann von echtem
// Zeitablauf eingeholt wird und "in der Zukunft" plötzlich falsch wird.

test('zukünftiger Termin + Rückfrage "Heute behandeln" bestätigt -> Datum wird auf heute gesetzt, Rest läuft normal', async () => {
  const { deps, calls } = fakeDeps({ vords: [], confirmResult: true });
  await terminStartenPodo({ lead_id: 'lead-9', verordnung_id: 'vord-9', start_time: '2099-01-15T09:00:00Z' }, deps);
  assert.equal(calls.showConfirmModal.length, 1);
  const modal = calls.showConfirmModal[0];
  assert.equal(modal.title, 'Termin liegt in der Zukunft');
  assert.equal(modal.message, 'Der Termin ist am 15.01.2099. Trotzdem heute behandeln?');
  assert.equal(modal.confirmText, 'Heute behandeln');
  assert.equal(modal.cancelText, 'Abbrechen');
  // vordId war bekannt -> keine Suche, direkt geöffnet, aber mit dem HEUTIGEN Datum.
  assert.equal(calls.setPodVorwahl.length, 1);
  const [id, opt] = calls.setPodVorwahl[0];
  assert.equal(id, 'vord-9');
  assert.notEqual(opt.datum, '2099-01-15'); // nicht mehr das Termin-Datum
  assert.equal(opt.datum, new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }));
});

test('zukünftiger Termin + Rückfrage abgebrochen -> nichts wird geöffnet', async () => {
  const { deps, calls } = fakeDeps({ vords: [], confirmResult: false });
  await terminStartenPodo({ lead_id: 'lead-9', verordnung_id: 'vord-9', start_time: '2099-01-15T09:00:00Z' }, deps);
  assert.equal(calls.showConfirmModal.length, 1);
  assert.deepEqual(calls.setPodVorwahl, []);
  assert.deepEqual(calls.switchPanel, []);
  assert.equal(calls.closeBkActionPanel, 0);
});

test('heutiger/vergangener Termin: keine Rückfrage, showConfirmModal wird nie aufgerufen', async () => {
  const { deps, calls } = fakeDeps({ vords: [] });
  await terminStartenPodo({ lead_id: 'lead-9', verordnung_id: 'vord-9', start_time: '2020-01-01T09:00:00Z' }, deps);
  assert.deepEqual(calls.showConfirmModal, []);
  assert.deepEqual(calls.setPodVorwahl, [['vord-9', { datum: '2020-01-01' }]]);
});

// ── terminStartenPodo: mehrere laufende Verordnungen, Termin noch unzugeordnet ──

test('terminStartenPodo: genau EINE laufende Verordnung -> wird wie bisher automatisch vorgewählt', async () => {
  const { deps, calls } = fakeDeps({ vords: [{ id: 'vord-solo' }] });
  await terminStartenPodo({ lead_id: 'lead-9', start_time: '2026-09-29T09:00:00Z' }, deps);
  assert.deepEqual(calls.sbLimit, [2]); // terminStartenPodo fragt mehrdeutig ab
  assert.deepEqual(calls.setPodVorwahl, [['vord-solo', { datum: '2026-09-29' }]]);
  assert.deepEqual(calls.showToast, []);
});

test('terminStartenPodo: ZWEI laufende Verordnungen -> KEINE automatische Auswahl, Liste öffnet leer + Hinweis-Toast', async () => {
  const { deps, calls } = fakeDeps({ vords: [{ id: 'vord-a' }, { id: 'vord-b' }] });
  await terminStartenPodo({ lead_id: 'lead-9', start_time: '2026-09-29T09:00:00Z' }, deps);
  assert.deepEqual(calls.setPodVorwahl, [[null, { datum: '2026-09-29' }]]);
  assert.deepEqual(calls.switchPanel, ['podologie-billing']);
  assert.equal(calls.showToast.length, 1);
  assert.equal(calls.showToast[0].type, 'info');
  assert.match(calls.showToast[0].msg, /Mehrere laufende Verordnungen/);
});

test('"Leistungen des Tages"-Knopf (kein mehrdeutigFragen): ZWEI laufende Verordnungen ändern nichts — erste wird gewählt wie bisher', async () => {
  const { deps, calls } = fakeDeps({ vords: [{ id: 'vord-a' }, { id: 'vord-b' }] });
  await oeffnePodoBehandlungen('lead-9', {}, deps); // kein mehrdeutigFragen — altes Verhalten
  assert.deepEqual(calls.sbLimit, [1]);
  assert.deepEqual(calls.setPodVorwahl, [['vord-a', { datum: undefined }]]);
  assert.deepEqual(calls.showToast, []);
});
