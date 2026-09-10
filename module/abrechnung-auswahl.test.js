// Geprüft wird der rechnende und regelnde Teil von abrechnung-auswahl.js —
// nicht das Zeichnen. Die vier hier getesteten Funktionen sind die, bei denen
// ein Fehler Geld kostet statt nur hässlich auszusehen:
//
//   kassenanteil()  — die alte Podologie-Liste beschriftete eine Spalte
//                     „Kassenanteil" und zeigte darin die PATIENTEN-Zuzahlung.
//   podoSperren()   — Spiegel der Backend-Sperren; weicht sie ab, ist die
//                     Vorschau wertlos.
//   baueGruppen()   — dieselbe Kasse in zwei Fachbereichen sind ZWEI Dateien.
//   auswahlStand()  — die Zahl der Umschläge, die vor dem Klick dasteht.
//
// Dazu fünf Bauart-Tests, die aus `podologie-abrechnung.test.js` MITGEZOGEN
// sind (09.09.2026): die Eigenschaften, die sie schützen, sind mit dem Code
// hierher gewandert. Sie prüfen die Quelle, nicht das Verhalten — begründet
// dort, kurz: der Doppelklick-Schutz ist am heutigen Stand nicht mehr
// unterscheidungsfähig, die Ursache aber schon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kassenanteil, podoSperren, gruppenKey, baueGruppen, auswahlStand, imZeitraum,
         keineDokumentierteBehandlung, podoStrukturBlocker }
  from './abrechnung-auswahl.js';

const quelle = readFileSync(new URL('./abrechnung-auswahl.js', import.meta.url), 'utf8');

test('kassenanteil zieht die Zuzahlung ab und wird nie negativ', () => {
  assert.equal(kassenanteil(100, 22.5), 77.5);
  assert.equal(kassenanteil(0, 0), 0);
  // Zuzahlung > Brutto kann bei der 10-Euro-Pauschale rechnerisch vorkommen;
  // eine negative Forderung gegen die Kasse gibt es nicht.
  assert.equal(kassenanteil(8, 10), 0);
  assert.equal(kassenanteil('1234.56', '34.56'), 1200);
  assert.equal(kassenanteil(null, undefined), 0);
});

test('podoSperren greift nur bei UI1/UI2', () => {
  assert.deepEqual(podoSperren({ diagnosegruppe: 'DF', icd10: ['E11.4'] }, ['78030']), []);
  assert.deepEqual(podoSperren({ diagnosegruppe: 'NF-a', icd10: [] }, ['78030']), []);
});

test('podoSperren: UI1 laesst nur L60.0 zu', () => {
  const g = podoSperren({ diagnosegruppe: 'UI1', icd10: ['M20.1'] }, []);
  assert.equal(g.length, 1);
  assert.match(g[0], /L60\.0/);
  assert.deepEqual(podoSperren({ diagnosegruppe: 'UI1', icd10: ['L60.0'] }, []), []);
  // Ohne ICD wird nicht geraten — lieber keine Regel als eine falsche.
  assert.deepEqual(podoSperren({ diagnosegruppe: 'UI2', icd10: [] }, []), []);
});

test('podoSperren: Befundpauschale ist bei Nagelspange nicht abrechenbar', () => {
  const g = podoSperren({ diagnosegruppe: 'UI2', icd10: ['L60.0'] }, ['78110', '78030']);
  assert.equal(g.length, 1);
  assert.match(g[0], /78030/);
  // Beide Sperren zugleich
  assert.equal(podoSperren({ diagnosegruppe: 'UI1', icd10: ['M20.1'] }, ['88030']).length, 2);
});

test('keineDokumentierteBehandlung: leer oder fehlend heisst blockiert', () => {
  assert.equal(keineDokumentierteBehandlung([]), true);
  assert.equal(keineDokumentierteBehandlung(undefined), true);
  assert.equal(keineDokumentierteBehandlung(['78030']), false);
});

test('podoStrukturBlocker: fehlender Patient, Arzt, Versichertennummer und Behandlung — alle vier gleichzeitig', () => {
  const v = { patient_id: null, arzt_id: null, versichertennummer: null, leads: {} };
  const gruende = podoStrukturBlocker(v, []);
  assert.equal(gruende.length, 4);
});

test('podoStrukturBlocker: vollstaendige Verordnung mit Behandlung ist sauber', () => {
  const v = {
    patient_id: 'p1', arzt_id: 'a1', versichertennummer: 'A123456789',
    leads: { last_name: 'Mustermann' },
  };
  assert.deepEqual(podoStrukturBlocker(v, ['78030']), []);
});

test('podoStrukturBlocker: Versichertennummer darf auch von der Kartei kommen', () => {
  const v = { patient_id: 'p1', arzt_id: 'a1', versichertennummer: null, leads: { last_name: 'X', versichertennummer: 'A1' } };
  assert.deepEqual(podoStrukturBlocker(v, ['78030']), []);
});

test('baueGruppen trennt dieselbe Kasse nach Fachbereich', () => {
  const zeilen = [
    { bereich: 'physio', id: 'a', ik: '101', brutto: 100, zuzahlung: 20 },
    { bereich: 'podo',   id: 'b', ik: '101', brutto: 50,  zuzahlung: 15 },
    { bereich: 'physio', id: 'c', ik: '101', brutto: 40,  zuzahlung: 10 },
  ];
  const g = baueGruppen(zeilen, (ik) => 'Kasse ' + ik);
  assert.equal(g.length, 2, 'zwei Gruppen = zwei Dateien = zwei Umschlaege');
  const phys = g.find(x => x.bereich === 'physio');
  const podo = g.find(x => x.bereich === 'podo');
  assert.equal(phys.key, gruppenKey('physio', '101'));
  assert.equal(phys.granularitaet, 'rezept');
  assert.equal(podo.granularitaet, 'kasse');
  assert.equal(phys.zeilen.length, 2);
  assert.equal(phys.brutto, 140);
  assert.equal(phys.zuzahlung, 30);
  assert.equal(phys.soll, 110);
  assert.equal(podo.soll, 35);
});

test('auswahlStand zaehlt Dateien, Zeilen und das Soll', () => {
  const g = baueGruppen([
    { bereich: 'physio', id: 'a', ik: '101', brutto: 100, zuzahlung: 20 },
    { bereich: 'physio', id: 'c', ik: '101', brutto: 40,  zuzahlung: 10 },
    { bereich: 'podo',   id: 'b', ik: '202', brutto: 50,  zuzahlung: 15 },
  ]);
  const podoKey = gruppenKey('podo', '202');

  assert.deepEqual(auswahlStand(g, new Set()), { gruppen: 0, zeilen: 0, soll: 0, iks: [] });

  // Physio waehlt einzelne Rezepte …
  const nurEins = auswahlStand(g, new Set(['a']));
  assert.equal(nurEins.gruppen, 1);
  assert.equal(nurEins.zeilen, 1);
  assert.equal(nurEins.soll, 80);

  // … die Podologie die ganze Kasse.
  const beides = auswahlStand(g, new Set(['a', 'c', podoKey]));
  assert.equal(beides.gruppen, 2);
  assert.equal(beides.zeilen, 3);
  assert.equal(beides.soll, 145);
  assert.deepEqual([...beides.iks].sort(), ['101', '202']);
});

test('auswahlStand nimmt eine Podologie-Gruppe nur ganz oder gar nicht', () => {
  const g = baueGruppen([
    { bereich: 'podo', id: 'b1', ik: '202', brutto: 50, zuzahlung: 15 },
    { bereich: 'podo', id: 'b2', ik: '202', brutto: 30, zuzahlung: 5 },
  ]);
  // Eine einzelne Zeilen-Id waehlt in der Podologie NICHTS aus — der
  // Gruppenschluessel ist dort der einzige Schalter.
  assert.equal(auswahlStand(g, new Set(['b1'])).gruppen, 0);
  assert.equal(auswahlStand(g, new Set([gruppenKey('podo', '202')])).zeilen, 2);
});

// ── Bauart (Quelltext) — mitgezogen aus podologie-abrechnung.test.js ────────

test('kein Zuhoerer haengt an #abAuswahlContent', () => {
  // Das Element steht statisch in dashboard.html; zeichne() tauscht nur sein
  // innerHTML. Ein hier registrierter Zuhoerer sammelt sich bei jedem
  // Neuzeichnen an — genau der Fehler vom 28.08.2026, der aus einem Klick
  // N Anfragen und N DTA-Dateien gemacht haette.
  const treffer = quelle.match(/getElementById\(\s*['"]abAuswahlContent['"]\s*\)\s*\??\.\s*addEventListener/g);
  assert.equal(treffer, null, 'An `document` haengen, delegiert — nicht an den Container.');
});

test('die Zuhoerer werden genau einmal registriert', () => {
  // Anders als in podologie-abrechnung.js stehen sie NICHT auf Modulebene,
  // sondern hinter einem Einmal-Riegel in _wireEinmal(). Grund: Modulebene
  // hiesse `document.addEventListener` beim Import — dann liesse sich diese
  // Datei in node nicht laden und die rechnenden Teile oben waeren untestbar.
  // Der Riegel gibt dieselbe Garantie.
  assert.ok(/let\s+_wired\s*=\s*false;/.test(quelle), 'Einmal-Riegel `_wired` fehlt.');
  assert.ok(/function\s+_wireEinmal\(\)\s*\{\s*\n\s*if\s*\(_wired\)\s*return;\s*\n\s*_wired\s*=\s*true;/.test(quelle),
    '_wireEinmal() muss beim zweiten Aufruf sofort zurueckkehren.');
  const registrierungen = (quelle.match(/document\.addEventListener\(/g) || []).length;
  assert.equal(registrierungen, 2, `Erwartet: je ein click- und ein change-Zuhoerer. Gefunden: ${registrierungen}.`);
});

test('die Erstellen-Knoepfe haben die zweite disabled-Bremse', () => {
  // Sie faengt einen Doppelklick ab, auch wenn die erste (`_st.busy`) haelt.
  assert.ok(/ab-erstellen-btn'\);\s*\n\s*if\s*\(einzeln\s*&&\s*!einzeln\.disabled\)/.test(quelle),
    'Einzel-Erstellen ohne disabled-Pruefung.');
  assert.ok(/#abSammelBtn'\);\s*\n\s*if\s*\(sammel\s*&&\s*!sammel\.disabled\)/.test(quelle),
    'Der Sammelknopf stoesst N Abrechnungen an — ohne die Bremse werden aus einem Doppelklick 2N Dateien.');
  assert.ok(/ab-fehler-btn'\);\s*\n\s*if\s*\(fehler\s*&&\s*!fehler\.disabled\)/.test(quelle),
    '"Trotzdem uebernehmen" ist ein eigener Netzaufruf und braucht dieselbe Bremse.');
});

test('der Sammellauf laeuft nacheinander, nicht parallel', () => {
  // Jede Anfrage leitet ihre Datennummer aus der Zahl der schon vorhandenen
  // abrechnung-Zeilen ab. Parallel gestartet lesen mehrere denselben Stand und
  // vergeben denselben Dateinamen — die Kasse ordnet dann nichts mehr zu.
  assert.ok(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*gruppen\.length[\s\S]{0,900}?await\s+_sendeGruppe\(/.test(quelle),
    'Die Schleife muss jede Gruppe abwarten (await im Rumpf), kein Promise.all.');
  assert.ok(!/Promise\.all\([\s\S]{0,200}gruppen/.test(quelle),
    'Promise.all ueber die Gruppen wuerde doppelte Datennummern erzeugen.');
});

test('Podologie geht nur ueber create-podologie, Physio nur ueber create', () => {
  // Der Physio-Weg baut mit dem PHYSIO-Mapper (Positionsnummern statt
  // podologischer 78xxx-HPNR). Eine Verwechslung faellt erst als Absetzung auf.
  assert.ok(/g\.bereich === 'podo'\s*\n?\s*\?\s*`\$\{ctx\.apiBase\}\/billing\/abrechnung\/create-podologie`/.test(quelle),
    'Die Endpunktwahl muss am Fachbereich haengen, nicht an etwas anderem.');
});

test('imZeitraum: leer heisst alles, ohne Datum heisst raus', () => {
  assert.equal(imZeitraum('2026-03-15', '', ''), true);
  assert.equal(imZeitraum(null, '', ''), true, 'ohne Filter faellt niemand heraus');
  assert.equal(imZeitraum('2026-03-15', '2026-03-01', '2026-03-31'), true);
  assert.equal(imZeitraum('2026-02-28', '2026-03-01', ''), false);
  assert.equal(imZeitraum('2026-04-01', '', '2026-03-31'), false);
  // Ein Rezept ohne Ausstellungsdatum laesst sich keinem Lauf zuordnen —
  // stillschweigend mitzunehmen waere das Falsche (gkv-302, Ops #265).
  assert.equal(imZeitraum(null, '2026-03-01', ''), false);
});
