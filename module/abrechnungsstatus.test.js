import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  statusDialogVorgabe, oeffneStatusDialog, DIALOG_WAEHLEN, DIALOG_BEREIT_GESPERRT, DIALOG_KEINE_BEHANDLUNG,
  ladeStatusJePatient, physioListenStatus, listenStatusBadge,
} from './abrechnungsstatus.js';

const sbMit = (data) => ({ from: () => {
  const q = { select: () => q, eq: () => q, not: async () => ({ data, error: null }) };
  return q;
} });

test('Patientenliste: Physio-Verordnungen werden nicht als „keine Verordnung" unterschlagen', async () => {
  const karte = await ladeStatusJePatient(sbMit([
    { id: 'rx1', patient_id: 'p1', status: 'in_therapy', therapie_bereich: 'physio', abrechnung_status: null },
    { id: 'rx2', patient_id: 'p2', status: 'completed', therapie_bereich: null, abrechnung_status: 'bereit' },
  ]), 'owner');
  assert.deepEqual(karte.get('p1'), { status: 'aktiv', verordnungId: 'rx1', bearbeitung: 'in_therapy', quelle: 'physio', anzahl: 1, offen: 1 });
  assert.equal(karte.get('p2').status, 'abrechenbar');
  assert.equal(karte.has('p3'), false);
});

test('Patient mit Podo- und Physio-Verordnung behält die podologische, änderbare Zeile', async () => {
  const karte = await ladeStatusJePatient(sbMit([
    { id: 'rx1', patient_id: 'p1', status: 'in_therapy', therapie_bereich: 'physio', abrechnung_status: null },
    { id: 'rx2', patient_id: 'p1', status: 'confirmed', therapie_bereich: 'podo', abrechnung_status: 'bereit' },
  ]), 'owner');
  assert.equal(karte.get('p1').verordnungId, 'rx2');
  assert.equal(karte.get('p1').quelle, undefined);
});

test('physioListenStatus: Abrechnungsachse schlägt Bearbeitungsachse', () => {
  assert.equal(physioListenStatus({ status: 'confirmed', abrechnung_status: null }), 'aktiv');
  assert.equal(physioListenStatus({ status: 'completed', abrechnung_status: null }), 'abrechenbar');
  assert.equal(physioListenStatus({ status: 'in_therapy', abrechnung_status: 'bereit' }), 'abrechenbar');
  assert.equal(physioListenStatus({ status: 'cancelled', abrechnung_status: null }), 'storniert');
});

test('listenStatusBadge: Physio zeigt „Bestätigt" statt „In Behandlung", solange nichts in Abrechnung ist', () => {
  assert.match(listenStatusBadge({ status: 'aktiv', bearbeitung: 'confirmed', quelle: 'physio' }), />Bestätigt</);
  assert.match(listenStatusBadge({ status: 'abrechenbar', bearbeitung: 'completed', quelle: 'physio' }), />Bereit</);
  assert.match(listenStatusBadge({ status: 'aktiv', bearbeitung: null, quelle: 'physio' }), />In Behandlung</);
});

test('statusDialogVorgabe: nur aktiv mit genau 0 Behandlungen sperrt „Bereit"', () => {
  assert.deepEqual(statusDialogVorgabe('aktiv', 0), { ohneBehandlung: true, gesperrt: ['abrechenbar'] });
  assert.deepEqual(statusDialogVorgabe(undefined, 0), { ohneBehandlung: true, gesperrt: ['abrechenbar'] });
  assert.deepEqual(statusDialogVorgabe('aktiv', 1), { ohneBehandlung: false, gesperrt: [] });
  assert.deepEqual(statusDialogVorgabe('aktiv', undefined), { ohneBehandlung: false, gesperrt: [] });   // unbekannt = wie bisher
  assert.deepEqual(statusDialogVorgabe('abgesetzt', 0), { ohneBehandlung: false, gesperrt: [] });
});

function fakeDom() {
  const els = {};
  const stub = (sel) => (els[sel] ||= { style: {}, textContent: '', disabled: false, value: '', addEventListener() {}, remove() {}, });
  const overlay = { style: {}, addEventListener() {}, remove() {}, html: '',
    set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; },
    querySelector: stub };
  globalThis.document = { createElement: () => overlay, body: { appendChild() {} } };
  return { overlay, els };
}

test('Dialog: 0 Behandlungen → „Bitte wählen" vorgewählt, „Bereit" disabled, Übernehmen disabled, Hilfetext', () => {
  const { overlay, els } = fakeDom();
  oeffneStatusDialog({ id: 'x', status: 'aktiv' }, { behandlungen: 0 });
  assert.match(overlay.html, new RegExp(`<option value="" selected>${DIALOG_WAEHLEN}</option>`));
  assert.ok(overlay.html.includes(`<option value="abrechenbar" disabled>${DIALOG_BEREIT_GESPERRT}</option>`));
  assert.ok(!/<option value="storniert"[^>]*selected/.test(overlay.html) && !/<option value="archiviert"[^>]*selected/.test(overlay.html));
  // zielEl.value ist im Fake '' (= Platzhalter)
  assert.equal(els['#as-ok'].disabled, true);
  assert.equal(els['#as-hilfe'].textContent, DIALOG_KEINE_BEHANDLUNG);
});

test('Dialog: ab 1 Behandlung oder unbekannt → Verhalten wie bisher (kein Platzhalter, „Bereit" wählbar)', () => {
  for (const behandlungen of [1, 3, undefined]) {
    const { overlay } = fakeDom();
    oeffneStatusDialog({ id: 'x', status: 'aktiv' }, { behandlungen });
    assert.ok(!overlay.html.includes(DIALOG_WAEHLEN));
    assert.ok(!/value="abrechenbar" disabled/.test(overlay.html));
    assert.match(overlay.html, /<option value="abrechenbar">/);
  }
});
