import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  statusDialogVorgabe, oeffneStatusDialog, DIALOG_WAEHLEN, DIALOG_BEREIT_GESPERRT, DIALOG_KEINE_BEHANDLUNG,
} from './abrechnungsstatus.js';

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

// QA TEST-Physio 17.11.2026, Fund 2: Physio-Verordnungen fehlten in der Patientenliste.
test('ladeStatusJePatient: zählt alle Fachbereiche, Statuswechsel-Ziel nur podologisch', async () => {
  const { ladeStatusJePatient } = await import('./abrechnungsstatus.js');
  const aufrufe = [];
  const zeilen = [
    { id: 'p1', patient_id: 'anna', abrechnung_status: null, therapie_bereich: 'physio', status: 'in_therapy' },
    { id: 'p2', patient_id: 'anna', abrechnung_status: 'bereit', therapie_bereich: 'physio', status: 'completed' },
    { id: 'p3', patient_id: 'bernd', abrechnung_status: null, therapie_bereich: 'physio', status: 'cancelled' },
    { id: 'd1', patient_id: 'clara', abrechnung_status: 'bereit', therapie_bereich: 'podo', status: 'confirmed' },
  ];
  const kette = {
    select() { return kette; },
    eq(spalte, wert) { aufrufe.push(['eq', spalte, wert]); return kette; },
    not() { return Promise.resolve({ data: zeilen, error: null }); },
  };
  const karte = await ladeStatusJePatient({ from: () => kette }, 'owner-1');
  assert.ok(!aufrufe.some(([, spalte]) => spalte === 'therapie_bereich'), 'kein Fachbereichsfilter');
  assert.equal(karte.get('anna').status, 'abrechenbar');
  assert.equal(karte.get('anna').verordnungId, null, 'Physio: kein Statuswechsel aus der Liste');
  assert.equal(karte.get('anna').anzahl, 2);
  assert.equal(karte.get('bernd').status, 'storniert');
  assert.equal(karte.get('clara').verordnungId, 'd1');
});
