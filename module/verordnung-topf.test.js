// Die Übersetzung zwischen podologischem Wortschatz und der einen
// Verordnungstabelle. Jeder Fall hier ist ein Fall, in dem ein stiller
// Übersetzungsfehler Geld kostet.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ausTopf, inTopf, statusAusTopf, statusInTopf,
  fuehrtSitzungsbuch, PODO_ARBEITSLISTE_OR, TOPF,
} from './verordnung-topf.js';

test('Zieltabelle steht an einer Stelle', () => {
  assert.equal(TOPF, 'prescriptions');
});

// ── Statusachse ─────────────────────────────────────────────────────────────

test('NULL heisst aktiv — nicht "unbekannt"', () => {
  assert.equal(statusAusTopf(null), 'aktiv');
  assert.equal(statusAusTopf(undefined), 'aktiv');
  assert.equal(statusAusTopf(''), 'aktiv');
});

test('die drei Werte, die es in der Podologie nie gab, heissen abgerechnet', () => {
  // Der teure Fehler waere, sie auf 'aktiv' fallen zu lassen: dann stuende
  // eine eingereichte Verordnung wieder in der Arbeitsliste.
  assert.equal(statusAusTopf('in_abrechnung'), 'abgerechnet');
  assert.equal(statusAusTopf('accepted'),      'abgerechnet');
  assert.equal(statusAusTopf('paid'),          'abgerechnet');
});

test('Hin und zurueck aendert den Status nicht', () => {
  for (const s of ['aktiv', 'abrechenbar', 'abgesetzt', 'teilabsetzung', 'storniert', 'archiviert']) {
    assert.equal(statusAusTopf(statusInTopf(s)), s, `Rundreise fuer ${s}`);
  }
});

test('aktiv wird NULL, nicht der Text "aktiv"', () => {
  assert.equal(statusInTopf('aktiv'), null);
});

test('unbekannter Status wird undefined — "nicht anfassen", nicht "loeschen"', () => {
  assert.equal(statusInTopf('phantasiewert'), undefined);
  assert.equal(statusInTopf(null), undefined);
});

test('die Arbeitsliste trifft NULL — sonst faellt jede laufende Verordnung raus', () => {
  assert.match(PODO_ARBEITSLISTE_OR, /abrechnung_status\.is\.null/);
  assert.match(PODO_ARBEITSLISTE_OR, /teilabsetzung/);
  assert.match(PODO_ARBEITSLISTE_OR, /rejected/);
});

// ── Zeilen lesen ────────────────────────────────────────────────────────────

test('ausTopf benennt um, ohne das Original zu verlieren', () => {
  const r = ausTopf({
    id: 'x', patient_id: 'lead-1', anzahl_einheiten: 6, frequenz: '1x pro Woche',
    behandlungsbeginn: '2026-09-01', gueltig_bis: '2026-09-30',
    is_dringend: true, bericht_angefordert: false,
    icd10: 'E11.74', icd10_2: null, status: 'confirmed', abrechnung_status: null,
  });
  assert.equal(r.lead_id, 'lead-1');
  assert.equal(r.behandlungseinheiten, 6);
  assert.equal(r.therapiefrequenz, '1x pro Woche');
  assert.equal(r.behandlungsstart, '2026-09-01');
  assert.equal(r.beginn_spaetestens, '2026-09-30');
  assert.equal(r.dringend, true);
  assert.equal(r.therapiebericht, false);
  // Die Zieltabellen-Namen bleiben erreichbar — schrittweiser Umzug moeglich.
  assert.equal(r.patient_id, 'lead-1');
  assert.equal(r.anzahl_einheiten, 6);
});

test('ausTopf tauscht die Statusachse und rettet die Bearbeitungsachse', () => {
  const r = ausTopf({ status: 'confirmed', abrechnung_status: 'bereit' });
  assert.equal(r.status, 'abrechenbar', 'status ist ab hier die Abrechnungsachse');
  assert.equal(r.bearbeitung_status, 'confirmed', 'die alte Achse darf nicht verschwinden');
});

test('ICD wird zur Liste, Leerwerte fallen raus', () => {
  assert.deepEqual(ausTopf({ icd10: 'E11.74', icd10_2: 'M20.1' }).icd10, ['E11.74', 'M20.1']);
  assert.deepEqual(ausTopf({ icd10: 'E11.74', icd10_2: null }).icd10, ['E11.74']);
  assert.deepEqual(ausTopf({ icd10: null, icd10_2: null }).icd10, []);
});

test('ausTopf vertraegt null', () => {
  assert.equal(ausTopf(null), null);
});

// ── Zeilen schreiben ────────────────────────────────────────────────────────

test('inTopf schreibt die Zieltabellennamen', () => {
  const p = inTopf({
    owner_id: 'o1', lead_id: 'lead-1', behandlungseinheiten: 3,
    therapiefrequenz: '1x alle 4 Wochen', dringend: false, therapiebericht: true,
    behandlungsstart: '2026-09-02', beginn_spaetestens: '2026-09-30',
    icd10: ['E11.74'], wagner_grad: 0, rezeptart: 'kassen',
  });
  assert.equal(p.patient_id, 'lead-1');
  assert.equal(p.anzahl_einheiten, 3);
  assert.equal(p.frequenz, '1x alle 4 Wochen');
  assert.equal(p.is_dringend, false);
  assert.equal(p.bericht_angefordert, true);
  assert.equal(p.behandlungsbeginn, '2026-09-02');
  assert.equal(p.gueltig_bis, '2026-09-30');
  assert.equal(p.icd10, 'E11.74');
  assert.equal(p.icd10_2, null);
  assert.equal(p.therapie_bereich, 'podo');
});

test('inTopf schreibt abrechnung_status NUR wenn das Formular ihn meint', () => {
  // Der teure Fall: ein Formular ohne Statusfeld darf eine eingereichte
  // Verordnung nicht zurueck auf "aktiv" holen.
  assert.equal('abrechnung_status' in inTopf({ owner_id: 'o1' }), false);
  assert.equal(inTopf({ owner_id: 'o1', status: 'aktiv' }).abrechnung_status, null);
  assert.equal(inTopf({ owner_id: 'o1', status: 'abrechenbar' }).abrechnung_status, 'bereit');
});

test('inTopf nimmt ICD auch als Einzelwert', () => {
  assert.equal(inTopf({ icd10: 'E11.74' }).icd10, 'E11.74');
});

test('inTopf fasst OCR- und PHI-Spalten nicht an', () => {
  const p = inTopf({ owner_id: 'o1', lead_id: 'l1' });
  for (const feld of ['ocr_raw_response', 'icd10_enc', 'phi_encrypted', 'image_storage_path',
                      'zuzahlung_kassiert_am', 'status']) {
    assert.equal(feld in p, false, `${feld} darf aus diesem Formular nicht geschrieben werden`);
  }
});

test('Rundreise Zeile: lesen, schreiben, wieder lesen', () => {
  const zeile = {
    owner_id: 'o1', patient_id: 'l1', anzahl_einheiten: 6, frequenz: '1x/Wo',
    is_dringend: true, bericht_angefordert: false, behandlungsbeginn: '2026-09-01',
    gueltig_bis: '2026-09-29', icd10: 'E11.74', icd10_2: null,
    abrechnung_status: 'bereit', wagner_grad: 2, hausbesuch: true,
  };
  const zurueck = ausTopf(inTopf(ausTopf(zeile)));
  assert.equal(zurueck.behandlungseinheiten, 6);
  assert.equal(zurueck.dringend, true);
  assert.equal(zurueck.status, 'abrechenbar');
  assert.deepEqual(zurueck.icd10, ['E11.74']);
  assert.equal(zurueck.wagner_grad, 2);
  assert.equal(zurueck.hausbesuch, true);
});

// ── Sitzungsbuch ────────────────────────────────────────────────────────────

test('Podologie fuehrt kein Einheiten-Hauptbuch', () => {
  assert.equal(fuehrtSitzungsbuch('podologie'), false);
  assert.equal(fuehrtSitzungsbuch('physiotherapy'), true);
  assert.equal(fuehrtSitzungsbuch('ergotherapie'), true);
  assert.equal(fuehrtSitzungsbuch('logopaedie'), true);
  // Unbekannter/fehlender Sektor: lieber das Buch fuehren als es stillschweigend
  // weglassen — ein leeres Buch faellt auf, ein fehlendes nicht.
  assert.equal(fuehrtSitzungsbuch(null), true);
  assert.equal(fuehrtSitzungsbuch(undefined), true);
});
