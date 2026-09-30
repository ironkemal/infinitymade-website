import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMULARE, formular, fachbereichAusSektor, istSichtbar, istPflicht, validiere, antwortAusForm, spaltenAusFelder,
  anzeigeZeilen, baueInsert, bestaetigungsKopie, rozetsAusFelder, begrenzeRozets, konsistenzHinweis, risikoKopie,
  vorschlaegeAusRisiken, kioskHinweis, kioskOptionLabel, risikoZeilen, befundRisikoHinweis, DIABETES_KONFLIKT_NOTIZ, ENTWURF_HINWEIS,
} from './anamnese-formulare.js';

const podo = FORMULARE.podo;
const feld = (id) => podo.felder.find((f) => f.id === id);
const MINIMAL = { diabetes: 'nein', gerinnung: ['nein'], allergien: ['keine'] };

test('Sektor → Fachbereich', () => {
  assert.equal(fachbereichAusSektor('podologie'), 'podo');
  assert.equal(fachbereichAusSektor('ergotherapie'), 'ergo');
  assert.equal(fachbereichAusSektor('logopaedie'), 'logo');
  assert.equal(fachbereichAusSektor('physiotherapy'), 'physio');
  assert.equal(fachbereichAusSektor('praxis'), 'physio');
  assert.equal(fachbereichAusSektor(undefined), 'physio');
  assert.equal(formular('quatsch').fachbereich, 'physio');
});

test('Podo: 20 Eingabefelder in 6 Gruppen (Unterfelder „ja + Seite" nicht mitgezählt)', () => {
  assert.equal(podo.felder.filter((f) => !f.unter).length, 20);
  assert.deepEqual(podo.gruppen.map((g) => g.id), ['A', 'B', 'C', 'D', 'E', 'F']);
  for (const f of podo.felder) assert.ok(podo.gruppen.some((g) => g.id === f.gruppe), f.id);
});

test('Podo: genau drei feste Pflichtfelder', () => {
  assert.deepEqual(podo.felder.filter((f) => f.pflicht).map((f) => f.id), ['diabetes', 'gerinnung', 'allergien']);
});

test('legal-de: Infektion nur Praxis, nicht Pflicht, keine Einzeldiagnosen', () => {
  const f = feld('infektion');
  assert.equal(f.nurPraxis, true);
  assert.equal(istPflicht(f, { diabetes: 'typ2' }), false);
  assert.deepEqual(f.optionen.map((o) => o.w), ['nein', 'mrsa', 'andere', 'unbekannt']);
  assert.equal(f.optionen[1].l, 'multiresistenter Erreger (z. B. MRSA)');
  assert.equal(f.optionen[2].l, 'andere übertragbare Infektion');
  assert.equal(f.optionen[3].l, 'weiß nicht / lieber persönlich besprechen');
  assert.doesNotMatch(JSON.stringify(f.optionen), /HIV|Hepatitis/i);
  assert.equal(istSichtbar(f, {}, { kiosk: true }), false);
  assert.equal(istSichtbar(f, {}, { kiosk: false }), true);
});

test('Validierung: leeres Formular → die drei Pflichtfelder', () => {
  assert.deepEqual(validiere(podo, {}).map((e) => e.id), ['diabetes', 'gerinnung', 'allergien']);
});

test('Validierung: Nichtdiabetiker — 3 Antworten genügen', () => {
  assert.deepEqual(validiere(podo, MINIMAL), []);
});

test('Validierung: Diabetes ≠ nein → Gruppe B Pflicht, „unbekannt" zählt als Antwort', () => {
  const ohneB = validiere(podo, { ...MINIMAL, diabetes: 'typ2' }).map((e) => e.id);
  assert.deepEqual(ohneB, ['neuropathie', 'pavk', 'ulkus', 'amputation', 'niere']);
  const mitUnbekannt = { ...MINIMAL, diabetes: 'typ2', neuropathie: 'unbekannt', pavk: 'nein', ulkus: 'nein', amputation: 'nein', niere: 'unbekannt' };
  assert.deepEqual(validiere(podo, mitUnbekannt), []);
});

test('Validierung: Allergien-Freitext allein reicht; HbA1c/Diabetologe nie Pflicht', () => {
  assert.deepEqual(validiere(podo, { diabetes: 'nein', gerinnung: ['nein'], allergien_text: 'Jod' }), []);
  const voll = { ...MINIMAL, diabetes: 'typ1', neuropathie: 'nein', pavk: 'nein', ulkus: 'nein', amputation: 'nein', niere: 'nein' };
  assert.deepEqual(validiere(podo, voll), []);
  assert.equal(istPflicht(feld('hba1c_wert'), voll), false);
  assert.equal(istPflicht(feld('diabetologe'), voll), false);
});

test('Validierung: Kiosk prüft die nurPraxis-Felder nicht (und Physio/Ergo/Logo haben keine Pflicht)', () => {
  assert.deepEqual(validiere(podo, MINIMAL, { kiosk: true }), []);
  assert.deepEqual(validiere(FORMULARE.physio, {}), []);
  assert.deepEqual(validiere(FORMULARE.ergo, {}), []);
  assert.deepEqual(validiere(FORMULARE.logo, {}), []);
});

test('Sichtbarkeit: Diabetes-Untergruppe, Ulkus/Amputation-Seite, Dialysetage, Diabetologe', () => {
  assert.equal(istSichtbar(feld('diabetes_seit'), { diabetes: 'nein' }), false);
  assert.equal(istSichtbar(feld('diabetes_seit'), { diabetes: 'typ1' }), true);
  assert.equal(istSichtbar(feld('ulkus_seite'), { ulkus: 'nein' }), false);
  assert.equal(istSichtbar(feld('ulkus_seite'), { ulkus: 'ja' }), true);
  assert.equal(istSichtbar(feld('amputation_hoehe'), { amputation: 'ja' }), true);
  assert.equal(istSichtbar(feld('dialysetage'), { niere: 'insuffizienz' }), false);
  assert.equal(istSichtbar(feld('dialysetage'), { niere: 'dialyse' }), true);
  assert.equal(istSichtbar(feld('diabetologe'), {}), false);
  assert.equal(istSichtbar(feld('diabetologe'), { diabetes: 'typ2' }), true);
  assert.equal(istSichtbar(feld('neuropathie'), {}), true, 'Gruppe B ist immer sichtbar (auch Nichtdiabetiker haben pAVK)');
});

test('antwortAusForm: getypte Werte, unsichtbare Felder fallen weg', () => {
  const { felder, spalten } = antwortAusForm(podo, {
    diabetes: 'typ2', diabetes_seit: '2015', hba1c_wert: '7,4', hba1c_datum: '2026-08-01', diabetes_therapie: ['tabletten', 'insulin'],
    ulkus: 'nein', ulkus_seite: 'links',            // Seite bleibt verwaist → muss weg
    amputation_hoehe: 'Zehe', amputation: 'nein',    // dito
    gerinnung: ['doak'], allergien: ['latex'], allergien_text: ' Jod ',
    hausarzt: { name: ' Dr. Muster ', telefon: '0221 1' },
  });
  assert.equal(felder.diabetes_seit, 2015);
  assert.equal(felder.hba1c_wert, 7.4);
  assert.equal(felder.hba1c_datum, '2026-08-01');
  assert.deepEqual(felder.diabetes_therapie, ['tabletten', 'insulin']);
  assert.equal('ulkus_seite' in felder, false);
  assert.equal('amputation_hoehe' in felder, false);
  assert.equal(felder.allergien_text, 'Jod');
  assert.equal('hausarzt' in felder, false, 'Hausarzt lebt in den festen Spalten');
  assert.equal(spalten.arzt_name, 'Dr. Muster');
  assert.equal(spalten.arzt_nummer, '0221 1');
});

test('antwortAusForm: Nicht-Diabetiker verliert Diabetes-Untergruppe; Zahl außerhalb des Bereichs wird verworfen', () => {
  const a = antwortAusForm(podo, { diabetes: 'nein', diabetes_seit: '2015', hba1c_wert: '7' }).felder;
  assert.equal('diabetes_seit' in a, false);
  assert.equal('hba1c_wert' in a, false);
  const b = antwortAusForm(podo, { diabetes: 'typ1', hba1c_wert: '99' }).felder;
  assert.equal('hba1c_wert' in b, false);
  const c = antwortAusForm(podo, { diabetes: 'typ1', diabetes_seit: 'abc' }).felder;
  assert.equal('diabetes_seit' in c, false);
});

test('antwortAusForm: exklusive Option („keine"/„nein") räumt die anderen', () => {
  const { felder } = antwortAusForm(podo, { gerinnung: ['ass', 'nein'], allergien: ['latex', 'keine'], einschraenkungen: ['sehen', 'keine'] });
  assert.deepEqual(felder.gerinnung, ['nein']);
  assert.deepEqual(felder.allergien, ['keine']);
  assert.deepEqual(felder.einschraenkungen, ['keine']);
});

test('antwortAusForm: Kiosk lässt Infektion nie durch (auch wenn geschickt)', () => {
  const k = antwortAusForm(podo, { infektion: 'mrsa' }, { kiosk: true }).felder;
  assert.equal('infektion' in k, false);
  const p = antwortAusForm(podo, { infektion: 'mrsa' }).felder;
  assert.equal(p.infektion, 'mrsa');
});

test('Spalten: Ortsfeste Werte für Terminkarte/Druck/rezept-save', () => {
  const { spalten } = antwortAusForm(podo, {
    diabetes: 'typ2', neuropathie: 'ja', pavk: 'nein', ulkus: 'ja', amputation: 'nein', niere: 'dialyse',
    gerinnung: ['phenprocoumon'], weitere_medikamente: ['kortison'], weitere_medikamente_text: 'Metformin',
    allergien: ['latex', 'pflaster'], rauchen: 'frueher', anliegen: 'Nagelspange', bemerkungen: 'Hausbesuch nur vormittags',
    hausarzt: { name: 'Dr. A', telefon: '1' },
  });
  assert.equal(spalten.vorerkrankungen, 'Diabetes Typ 2; Neuropathie; früheres Fußulkus; Dialyse');
  assert.equal(spalten.medikamente, 'Gerinnungshemmung: Phenprocoumon (Marcumar); Kortison, Metformin');
  assert.equal(spalten.allergien, 'Latex, Pflaster-Kleber');
  assert.equal(spalten.raucher, false);
  assert.equal(spalten.hauptbeschwerde, 'Nagelspange');
  assert.equal(spalten.notizen, 'Hausbesuch nur vormittags');
  assert.equal(spaltenAusFelder(podo, { allergien: ['keine'] }).allergien, 'keine Allergien');
  assert.equal(spaltenAusFelder(podo, { rauchen: 'ja' }).raucher, true);
  assert.equal('medikamente' in spaltenAusFelder(podo, { gerinnung: ['nein'] }), false);
});

test('Rozets: rot vor orange, Reihenfolge der Tabelle', () => {
  const r = rozetsAusFelder({ neuropathie: 'ja', pavk: 'ja', gerinnung: ['doak'], allergien: ['latex', 'metall'], weitere_medikamente: ['kortison'] });
  assert.deepEqual(r.map((x) => x.key), ['gerinnung', 'allergie', 'pavk', 'neuropathie', 'immun']);
  assert.deepEqual(r.map((x) => x.stufe), ['rot', 'rot', 'rot', 'orange', 'orange']);
  assert.equal(r[1].label, 'Allergie: Latex, Metall / Nickel');
});

test('Rozets: ASS nur orange, Phenprocoumon/DOAK/Heparin rot', () => {
  assert.deepEqual(rozetsAusFelder({ gerinnung: ['ass'] }).map((x) => x.stufe), ['orange']);
  for (const g of ['phenprocoumon', 'doak', 'heparin']) assert.equal(rozetsAusFelder({ gerinnung: [g] })[0].stufe, 'rot');
  assert.equal(rozetsAusFelder({ gerinnung: ['ass', 'doak'] }).length, 1, 'ein Rozet, rot gewinnt');
});

test('Rozets: rot = Ulkus, Amputation, Dialyse, pAVK; Niereninsuffizienz allein und „unbekannt" warnen nicht', () => {
  assert.deepEqual(rozetsAusFelder({ ulkus: 'ja', amputation: 'ja', niere: 'dialyse', pavk: 'ja' }).map((x) => x.label),
    ['Z. n. Ulkus', 'Amputation', 'Dialyse', 'pAVK']);
  assert.deepEqual(rozetsAusFelder({ niere: 'insuffizienz', pavk: 'unbekannt', ulkus: 'nein', neuropathie: 'unbekannt' }), []);
});

test('Rozets: Infektion nur als neutrales „Hygiene" (nie die Diagnose)', () => {
  const r = rozetsAusFelder({ infektion: 'mrsa' });
  assert.deepEqual(r.map((x) => x.label), ['Hygiene']);
  assert.equal(r[0].stufe, 'orange');
  assert.deepEqual(rozetsAusFelder({ infektion: 'andere' }).map((x) => x.label), ['Hygiene']);
  assert.deepEqual(rozetsAusFelder({ infektion: 'unbekannt' }), []);
  assert.deepEqual(rozetsAusFelder({ infektion: 'nein' }), []);
  assert.doesNotMatch(JSON.stringify(rozetsAusFelder({ infektion: 'mrsa' })), /MRSA|Hepatitis|HIV|Infektion/i);
});

test('Rozets: begrenzt auf 3, Rest als +n', () => {
  const alle = rozetsAusFelder({ gerinnung: ['doak'], allergien: ['latex'], ulkus: 'ja', pavk: 'ja', neuropathie: 'ja' });
  assert.equal(alle.length, 5);
  const b = begrenzeRozets(alle);
  assert.equal(b.sichtbar.length, 3);
  assert.equal(b.mehr, 2);
  assert.deepEqual(begrenzeRozets(alle.slice(0, 2)), { sichtbar: alle.slice(0, 2), mehr: 0 });
  assert.deepEqual(rozetsAusFelder({}), []);
});

test('Konsistenz: DF + Diabetes nein/leer → Hinweis; sonst nichts', () => {
  assert.equal(konsistenzHinweis({ dgWurzel: 'DF', row: { felder: { diabetes: 'nein' } } }), DIABETES_KONFLIKT_NOTIZ);
  assert.equal(konsistenzHinweis({ dgWurzel: 'DF', row: { felder: {} } }), DIABETES_KONFLIKT_NOTIZ);
  assert.equal(konsistenzHinweis({ dgWurzel: 'DF', row: { felder: { diabetes: 'typ2' } } }), '');
  assert.equal(konsistenzHinweis({ dgWurzel: 'NF', row: { felder: { diabetes: 'nein' } } }), '');
  assert.equal(konsistenzHinweis({ dgWurzel: 'DF', row: null }), '', 'ohne Anamnese gibt es die „fehlt"-Notiz, keinen zweiten Hinweis');
});

test('INSERT-Nutzlast: Fachbereich/felder/form_version/quelle — nie version, ist_aktuell, geprueft_*', () => {
  const p = baueInsert({ def: podo, ownerId: 'o', patientId: 'p', aufnahmedatum: '2026-09-30', felder: { diabetes: 'nein' }, spalten: { allergien: 'x' }, quelle: 'kiosk', userId: 'u' });
  assert.equal(p.fachbereich, 'podo');
  assert.deepEqual(p.felder, { diabetes: 'nein' });
  assert.equal(p.form_version, 1);
  assert.equal(p.quelle, 'kiosk');
  assert.equal(p.allergien, 'x');
  for (const k of ['version', 'ist_aktuell', 'geprueft_am', 'geprueft_von', 'id']) assert.equal(k in p, false, k);
  assert.equal(baueInsert({ def: podo, ownerId: 'o', patientId: 'p', felder: {}, spalten: {}, quelle: 'egal' }).quelle, 'praxis');
});

test('Bestätigen: Kopie als neue Version, Herkunft gesetzt, nichts Serverseitiges mitgeschickt', () => {
  const row = { id: 'A1', owner_id: 'o', patient_id: 'p', fachbereich: 'podo', felder: { diabetes: 'nein' }, form_version: 1, version: 3, ist_aktuell: true,
    quelle: 'kiosk', geprueft_am: null, geprueft_von: null, created_at: 'x', updated_at: 'y', updated_by: 'z', uebernommen_von: null, allergien: 'keine Allergien', aufnahmedatum: '2026-01-01' };
  const k = bestaetigungsKopie(row, { userId: 'U', heute: '2026-09-30' });
  assert.equal(k.uebernommen_von, 'A1');
  assert.equal(k.quelle, 'praxis');
  assert.equal(k.created_by, 'U');
  assert.equal(k.aufnahmedatum, '2026-09-30');
  assert.equal(k.allergien, 'keine Allergien');
  assert.deepEqual(k.felder, { diabetes: 'nein' });
  for (const x of ['id', 'version', 'ist_aktuell', 'geprueft_am', 'geprueft_von', 'created_at', 'updated_at', 'updated_by']) assert.equal(x in k, false, x);
  assert.equal(bestaetigungsKopie(null), null);
});

test('Anzeige: Podo aus felder (lesbar), Physio aus den festen Spalten', () => {
  const z = anzeigeZeilen(podo, { felder: { diabetes: 'typ2', gerinnung: ['nein'], allergien: ['latex'], allergien_text: 'Jod', hba1c_wert: 7.4, hba1c_datum: '2026-08-01', ulkus: 'ja', ulkus_seite: 'links' }, arzt_name: 'Dr. A', arzt_nummer: '1' });
  const t = Object.fromEntries(z.map((x) => [x.id, x.text]));
  assert.equal(t.diabetes, 'Typ 2');
  assert.equal(t.allergien, 'Latex, Jod');
  assert.equal(t.hba1c_wert, '7,4 %');
  assert.equal(t.hba1c_datum, '01.08.2026');
  assert.equal(t.ulkus, 'ja');
  assert.equal(t.ulkus_seite, 'links');
  assert.equal(t.hausarzt, 'Dr. A · 1');
  assert.equal('rauchen' in t, false, 'unbeantwortet und keine Pflicht → keine Zeile');
  const leer = anzeigeZeilen(podo, { felder: {} });
  assert.deepEqual(leer.filter((x) => x.text === '—').map((x) => x.id), ['diabetes', 'gerinnung', 'allergien'], 'Pflichtfelder ohne Antwort zeigen „—"');
  const p = anzeigeZeilen(FORMULARE.physio, { felder: {}, hauptbeschwerde: 'Rücken', schmerz_skala: 4, raucher: true, hausbesuch: false, notizen: 'n' });
  const pt = Object.fromEntries(p.map((x) => [x.id, x.text]));
  assert.equal(pt.hauptbeschwerde, 'Rücken');
  assert.equal(pt.schmerz_skala, '4');
  assert.equal(pt.raucher, 'Ja');
  assert.equal(pt.hausbesuch, 'Nein');
  assert.equal('beruf' in pt, false);
});

test('Fußbefund-Kopie: vier alte Schlüssel + Herkunft; ohne Anamnese null', () => {
  assert.equal(risikoKopie(null), null);
  const k = risikoKopie({ id: 'A1', version: 2, felder: { diabetes: 'typ2', gerinnung: ['ass'], allergien: ['keine'], infektion: 'nein' } });
  assert.deepEqual(k, { diabetes: true, allergien: false, infektionskrankheiten: false, gerinnungshemmer: true, anamnese_id: 'A1', anamnese_version: 2 });
  const k2 = risikoKopie({ id: 'A2', version: 1, felder: { diabetes: 'nein', gerinnung: ['nein'], allergien: ['latex'], infektion: 'mrsa' } });
  assert.deepEqual([k2.diabetes, k2.allergien, k2.infektionskrankheiten, k2.gerinnungshemmer], [false, true, true, false]);
  assert.equal(risikoKopie({ id: 'A3', felder: { allergien_text: 'Jod' } }).allergien, true);
});

test('Vorschläge aus altem Fußbefund: nie still — „nein" mit Übernehmen-Wert, „ja" nur als Hinweis', () => {
  const v = vorschlaegeAusRisiken({ diabetes: false, gerinnungshemmer: true, allergien: false, infektionskrankheiten: true });
  assert.deepEqual(v.diabetes, { text: 'Diabetes: nein', wert: 'nein' });
  assert.equal(v.gerinnung.wert, undefined);
  assert.match(v.gerinnung.text, /Präparat bitte wählen/);
  assert.deepEqual(v.allergien.wert, ['keine']);
  assert.equal(v.infektion.wert, undefined);
  assert.deepEqual(vorschlaegeAusRisiken(null), {});
  assert.deepEqual(vorschlaegeAusRisiken({ diabetes: 'x' }), {});
});

test('Risikoblock: nur beantwortete Risikofelder; Erklärhinweis bei abweichender Anamnese-Version', () => {
  const z = risikoZeilen({ felder: { diabetes: 'typ1', neuropathie: 'unbekannt', gerinnung: ['nein'], rauchen: 'ja' } });
  assert.deepEqual(z.map((x) => x.label), ['Diabetes mellitus', 'Neuropathie bekannt', 'Gerinnungshemmung']);
  assert.deepEqual(risikoZeilen(null), []);
  assert.equal(befundRisikoHinweis({ anamnese_id: 'A1', anamnese_version: 1 }, { id: 'A2', version: 2 }), 'Dieser Befund trägt den Stand der Anamnese Version 1 — inzwischen gibt es Version 2.');
  assert.equal(befundRisikoHinweis({ anamnese_id: 'A1' }, { id: 'A1' }), '');
  assert.match(befundRisikoHinweis({ diabetes: true, allergien: false }, null), /Diabetes/);
  assert.equal(befundRisikoHinweis(null, null), '');
});

test('Kiosk: Hinweis nur bei Podologin-Feldern; „unbekannt" heißt „weiß nicht"', () => {
  assert.match(kioskHinweis(feld('neuropathie')), /„weiß nicht"/);
  assert.match(kioskHinweis(feld('hba1c_wert')), /lassen Sie das Feld frei/);
  assert.match(kioskHinweis(feld('einschraenkungen')), /lassen Sie das Feld frei/);
  assert.equal(kioskHinweis(feld('diabetes')), '');
  const opt = feld('pavk').optionen.find((o) => o.w === 'unbekannt');
  assert.equal(kioskOptionLabel(feld('pavk'), opt, true), 'weiß nicht');
  assert.equal(kioskOptionLabel(feld('pavk'), opt, false), 'unbekannt');
  assert.equal(kioskOptionLabel(feld('diabetes'), { w: 'nein', l: 'nein' }, true), 'nein');
});

test('Ergo/Logo: Entwurf, gemeinsamer Kern + Fachfelder', () => {
  for (const fb of ['ergo', 'logo']) {
    const d = FORMULARE[fb];
    assert.equal(d.entwurf, true);
    for (const id of ['hauptanliegen', 'vorerkrankungen', 'medikamente', 'allergien', 'einschraenkungen', 'hausarzt', 'bemerkungen']) {
      assert.ok(d.felder.some((f) => f.id === id), `${fb}:${id}`);
    }
  }
  for (const id of ['adl', 'hilfsmittel', 'kognition']) assert.ok(FORMULARE.ergo.felder.some((f) => f.id === id), id);
  for (const id of ['bereiche', 'hoerstatus', 'hoergeraet', 'muttersprache']) assert.ok(FORMULARE.logo.felder.some((f) => f.id === id), id);
  assert.equal(FORMULARE.podo.entwurf, false);
  assert.match(ENTWURF_HINWEIS, /Entwurf — fachlich noch nicht abgestimmt/);
  // Ortsgebundene Kernfelder laufen in die festen Spalten
  const { spalten, felder } = antwortAusForm(FORMULARE.ergo, { hauptanliegen: 'Feinmotorik', medikamente: 'ASS', allergien: 'keine', adl: ['waschen'], hausarzt: { name: 'Dr. X', telefon: '2' } });
  assert.equal(spalten.hauptbeschwerde, 'Feinmotorik');
  assert.equal(spalten.medikamente, 'ASS');
  assert.equal(spalten.arzt_name, 'Dr. X');
  assert.deepEqual(felder.adl, ['waschen']);
});
