import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leseCsv, ordneSpaltenZu } from './patienten-import.js';
import {
  VO_SPALTEN,
  VO_VORLAGE_CSV,
  VO_VORLAGE_CSV_PHYSIO,
  voFehlendePflicht,
  pruefeVerordnungen,
  voRumpf,
  leseNagel,
  janein,
  setzeDefaultPhysioKatalog,
  voImportSchluessel,
  normalizeVoCode,
  codesAusVerordnung,
} from './verordnung-import.js';
import { PHYSIO_POSITIONS } from '../api-backend/billing/codes/physio_positions.js';

setzeDefaultPhysioKatalog(PHYSIO_POSITIONS);

const patienten = [
  { id: 'p1', first_name: 'Erika', last_name: 'Muster', geburtsdatum: '1950-02-01', versichertennummer: 'A123456780', krankenkasse_ik: '104212505', krankenkasse: 'AOK' },
  { id: 'p2', first_name: 'Çağlar', last_name: 'Şahin', geburtsdatum: '1985-06-15', versichertennummer: 'B987654321', krankenkasse_ik: '104212505', krankenkasse: 'TK' },
];
const k = (extra = {}) => ({ patienten, vorhandeneVo: new Set(), heute: '2026-10-20', katalog: PHYSIO_POSITIONS, ...extra });
const zuVon = (csv) => ordneSpaltenZu(leseCsv(csv)[0], VO_SPALTEN);

test('Vorlage (Podologie): alle Spalten erkannt, Zeile übernehmbar', () => {
  const zu = zuVon(VO_VORLAGE_CSV);
  assert.deepEqual(voFehlendePflicht(zu, 'podo'), []);
  const e = pruefeVerordnungen(VO_VORLAGE_CSV, zu, k({ bereich: 'podo' }));
  assert.equal(e.ok, 1, JSON.stringify(e.zeilen[0].fehler));
  const v = e.zeilen[0].verordnung;
  assert.equal(v.patient.id, 'p1');
  assert.equal(v.dg, 'DF'); assert.equal(v.buchstabe, 'c');
  assert.equal(v.heilmittel, 'Podologische Komplexbehandlung');
  assert.equal(v.anzahl, 6);
});

test('Ablehnung (Podologie): Frist abgelaufen, schon erbracht, abgerechnet, ohne Unterschrift, unbekannter Patient', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;Diagnosegruppe;Leitsymptomatik;Anzahl;Unterschrift;Erbracht;Abgerechnet\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;01.08.2026;123456601;DF;a;6;ja;0;nein\n'   // Frist abgelaufen
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;NF;a;6;ja;2;nein\n'   // schon behandelt (Podo Schritt 2)
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;QF;a;6;ja;0;ja\n'     // abgerechnet
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;DF;b;6;nein;0;nein\n' // ohne Unterschrift
    + 'Fremd;Hans;01.01.1960;15.10.2026;123456601;DF;a;6;ja;0;nein\n';    // Patient fehlt
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'podo' }));
  assert.equal(e.ok, 1);
  assert.match(e.zeilen[0].fehler.join(), /Beginnfrist/);
  assert.deepEqual(e.zeilen[1].fehler, []);   // Schritt 2: teilweise erbracht wird bei Podo übernommen
  assert.ok(e.zeilen[1].hinweise.some(h => /Teilweise erbracht/.test(h)));
  assert.match(e.zeilen[2].fehler.join(), /abgerechnet/);
  assert.match(e.zeilen[3].fehler.join(), /Unterschrift/);
  assert.match(e.zeilen[4].fehler.join(), /Patientenstamm/);
});

test('UI (Podologie): nur a), Höchstmenge 4 bei UI2, Nagel fehlt als Hinweis, b) wird abgelehnt', () => {
  const csv = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;DG;Leitsymptomatik;Anzahl\n'
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;UI 2;;6\n'
    + 'Muster;Erika;01.02.1950;16.10.2026;123456601;UI1;b;4\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'podo' }));
  const [a, b] = e.zeilen;
  assert.deepEqual(a.fehler, []);
  assert.equal(a.verordnung.heilmittel, 'Nagelspangenbehandlung');
  assert.ok(a.hinweise.some(h => /Höchstmenge|Mehr als 4/.test(h)));
  assert.ok(a.hinweise.some(h => /Nagel fehlt/.test(h)));
  assert.match(b.fehler.join(), /kennt Leitsymptomatik b/);
});

test('Dublette (Podologie): in Praxura vorhanden und doppelt in Datei', () => {
  const csv = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;DG;Heilmittel;Anzahl\n'
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;DF;Hornhautabtragung;6\n'
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;DF;Hornhautabtragung;6\n'
    + 'Muster;Erika;01.02.1950;14.10.2026;123456601;DF;Hornhautabtragung;6\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'podo', vorhandeneVo: new Set(['p1|2026-10-14|123456601|DF']) }));
  assert.deepEqual(e.zeilen[0].fehler, []);
  assert.match(e.zeilen[1].fehler.join(), /doppelt in Datei/);
  assert.match(e.zeilen[2].fehler.join(), /schon in Praxura/);
});

test('voRumpf: Patient-ID, Bereich podo, Leitsymptomatik-Code, Kasse aus der Akte', () => {
  const zu = zuVon(VO_VORLAGE_CSV);
  const v = pruefeVerordnungen(VO_VORLAGE_CSV, zu, k({ bereich: 'podo' })).zeilen[0].verordnung;
  const r = voRumpf(v, '2026-10-20');
  assert.equal(r.patient_id, 'p1');
  assert.equal(r.patient_neu, false);
  assert.equal(r.parsed.rezept.therapiebereich, 'podo');
  assert.equal(r.parsed.rezept.leitsymptomatik, '0010');
  assert.equal(r.parsed.rezept.unterschrift_vorhanden, true);
  assert.equal(r.parsed.patient.krankenkasse_ik, '104212505');
  assert.equal(r.parsed.arzt.lanr, '123456601');
  assert.match(r.parsed.rezept.therapieziele, /Altsystem übernommen am 20\.10\.2026 \(VO-Nr\. 4711\)/);
});

test('Hilfen: Nagel und ja/nein', () => {
  assert.equal(leseNagel('u1 li'), 'U1 links');
  assert.equal(leseNagel('U5 rechts'), 'U5 rechts');
  assert.equal(leseNagel('Zeh'), null);
  assert.equal(janein('X'), true); assert.equal(janein('nein'), false); assert.equal(janein('vielleicht'), null);
});

test('Zuordnung nur über Name + Geburtsdatum, nie KVNR allein (canli-test 21.10.2026)', () => {
  const zwei = [
    { id: 'falsch', first_name: 'Anna', last_name: 'Andere', geburtsdatum: '1960-01-01', versichertennummer: 'A123456780' },
    { id: 'richtig', first_name: 'Erna', last_name: 'Import', geburtsdatum: '1955-05-05', versichertennummer: '' },
  ];
  const csv = 'Nachname;Vorname;Geburtsdatum;Versichertennummer;Krankenkasse;Ausstellungsdatum;LANR;DG;Leitsymptomatik;Anzahl\n'
    + 'Import;Erna;05.05.1955;A123456780;AOK;15.10.2026;123456601;DF;a;6\n'
    + 'Unbekannt;Hans;01.01.1950;A123456780;AOK;15.10.2026;123456601;DF;a;6\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'podo', patienten: zwei }));
  assert.equal(e.zeilen[0].verordnung.patient.id, 'richtig');
  assert.match(e.zeilen[1].fehler.join(), /Patientenstamm/);
});

test('Jede Spalte der eigenen Vorlage wird erkannt', () => {
  const kopf = leseCsv(VO_VORLAGE_CSV)[0];
  const zu = zuVon(VO_VORLAGE_CSV);
  const zugeordnet = new Set(Object.values(zu));
  const fehlt = kopf.filter((_, i) => !zugeordnet.has(i));
  assert.deepEqual(fehlt, []);
});

test('Fall B (Podologie): Frist am ersten Behandlungstag, Menge, Zuzahlungs-Vermerk (gkv-302 21.10.2026)', () => {
  const csv = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;DG;Leitsymptomatik;Anzahl;Erbracht;Erster Behandlungstag;Zuzahlung bereits kassiert (EUR)\n'
    + 'Muster;Erika;01.02.1950;01.07.2026;123456601;DF;c;6;3;20.07.2026;12,50\n'
    + 'Muster;Erika;01.02.1950;02.07.2026;123456601;DF;c;6;3;15.08.2026;\n'
    + 'Muster;Erika;01.02.1950;03.07.2026;123456601;DF;c;6;7;;\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'podo' }));
  assert.deepEqual(e.zeilen[0].fehler, []);
  assert.equal(e.zeilen[0].verordnung.zuzahlungAlt, 12.5);
  assert.equal(e.zeilen[0].verordnung.erbracht, 3);
  assert.match(e.zeilen[1].fehler.join(), /nach der Beginnfrist/);
  assert.match(e.zeilen[2].fehler.join(), /Mehr Einheiten erbracht/);
  assert.match(voRumpf(e.zeilen[0].verordnung, '2026-10-21').parsed.rezept.therapieziele, /Teilweise im Altsystem erbracht: 3/);
});

// ═══════════════════════════════════════════════════════════════════════════
// PHYSIO-KOLU TESTS (Aufgabe W6)
// ═══════════════════════════════════════════════════════════════════════════

test('Physio: Vorlage CSV wird erkannt und ist übernehmbar', () => {
  const zu = zuVon(VO_VORLAGE_CSV_PHYSIO);
  assert.deepEqual(voFehlendePflicht(zu, 'physio'), []);
  const e = pruefeVerordnungen(VO_VORLAGE_CSV_PHYSIO, zu, k({ bereich: 'physio' }));
  assert.equal(e.ok, 1, JSON.stringify(e.zeilen[0].fehler));
  assert.equal(e.rot, 0);
  const v = e.zeilen[0].verordnung;
  assert.equal(v.patient.id, 'p1');
  assert.equal(v.dg, 'WS');
  assert.equal(v.heilmittel_position, 'X0501');
  assert.equal(v.anzahl, 6);
  assert.equal(v.heilmittel_items.length, 1);
  assert.equal(v.heilmittel_items[0].code, 'X0501');
});

test('Physio: Zeilenfarben (grün ok / gelb Hinweis / rot Fehler)', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;BSNR;Diagnosegruppe;ICD-10;Heilmittel;Anzahl;Frequenz;Unterschrift;Erbracht;Abgerechnet\n';
  const csv = kopf
    // Zeile 1: Grün (alles vollständig und gültig)
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;123456700;WS;M54.5;X0501;6;1-2x wtl.;ja;0;nein\n'
    // Zeile 2: Gelb (BSNR fehlt -> Hinweis, aber übernehmbar)
    + 'Muster;Erika;01.02.1950;16.10.2026;123456601;;WS;M54.5;X0501;6;1-2x wtl.;ja;0;nein\n'
    // Zeile 3: Rot (LANR fehlt -> Pflichtfehler)
    + 'Muster;Erika;01.02.1950;17.10.2026;;123456700;WS;M54.5;X0501;6;1-2x wtl.;ja;0;nein\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  assert.equal(e.zeilen.length, 3);
  // Zeile 1: grün
  assert.equal(e.zeilen[0].fehler.length, 0);
  assert.equal(e.zeilen[0].hinweise.length, 0);
  // Zeile 2: gelb
  assert.equal(e.zeilen[1].fehler.length, 0);
  assert.ok(e.zeilen[1].hinweise.length > 0);
  // Zeile 3: rot
  assert.ok(e.zeilen[2].fehler.length > 0);

  assert.equal(e.ok, 2);
  assert.equal(e.gelb, 1);
  assert.equal(e.rot, 1);
});

test('Physio: Zeile ohne Frequenz ist GELB (Hinweis), nicht grün', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;BSNR;Diagnosegruppe;ICD-10;Heilmittel;Anzahl;Frequenz;Unterschrift;Erbracht;Abgerechnet\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;123456700;WS;M54.5;X0501;6;;ja;0;nein\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  assert.equal(e.zeilen.length, 1);
  assert.equal(e.zeilen[0].fehler.length, 0);
  assert.ok(e.zeilen[0].hinweise.some(h => h.includes('Frequenz fehlt')));
  assert.equal(e.gelb, 1);
});

test('Physio: Bereits begonnene VO ist ROT („Bereits begonnene Verordnungen bitte von Hand anlegen.")', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;Diagnosegruppe;Heilmittel;Anzahl;Unterschrift;Erbracht;Abgerechnet\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X0501;6;ja;2;nein\n'
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X0501;6;ja;0;nein\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  assert.equal(e.rot, 1);
  assert.match(e.zeilen[0].fehler.join(), /Bereits begonnene Verordnungen bitte von Hand anlegen/);
  assert.equal(e.zeilen[1].fehler.length, 0);
});

test('Physio: 3 Heilmittel (vorrangig 1-3) -> Summe Einheiten & Items geprüft', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;Diagnosegruppe;Heilmittel;Anzahl;Heilmittel 2;Anzahl 2;Heilmittel 3;Anzahl 3\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X0501;6;X1201;6;X0201;6\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  assert.equal(e.zeilen[0].fehler.length, 0, e.zeilen[0].fehler.join(', '));
  const v = e.zeilen[0].verordnung;
  assert.equal(v.anzahl, 18);
  assert.equal(v.heilmittel_items.length, 3);
  assert.equal(v.heilmittel_items[0].code, 'X0501');
  assert.equal(v.heilmittel_items[1].code, 'X1201');
  assert.equal(v.heilmittel_items[2].code, 'X0201');
  assert.equal(v.heilmittel_position, 'X0501'); // Spiegel von items[0]
});

test('Physio: >3 Heilmittel ist ROT (Maximal 3 vorrangige Heilmittel zulässig)', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;Diagnosegruppe;Heilmittel;Anzahl;Heilmittel 2;Anzahl 2;Heilmittel 3;Anzahl 3;Heilmittel 4;Anzahl 4\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X0501;6;X1201;6;X0201;6;X0106;6\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  assert.ok(e.zeilen[0].fehler.length > 0);
  assert.match(e.zeilen[0].fehler.join(), /Maximal 3 vorrangige Heilmittel/);
  assert.equal(e.rot, 1);
});

test('Physio: Unbekannter Heilmittel-Code ist ROT', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;Diagnosegruppe;Heilmittel;Anzahl\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;UNBEKANNT_XYZ;6\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  assert.ok(e.zeilen[0].fehler.length > 0);
  assert.match(e.zeilen[0].fehler.join(), /unbekannt/);
  assert.equal(e.rot, 1);
});

test('Physio: Dublette (gleicher Patient, gleiches Datum, gleiche Position) -> gelb/wird übersprungen', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;Diagnosegruppe;Heilmittel;Anzahl\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X0501;6\n'
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X0501;6\n'
    + 'Muster;Erika;01.02.1950;14.10.2026;123456601;WS;X0501;6\n';
  // p1 hat am 14.10.2026 schon X0501 in Praxura
  const e = pruefeVerordnungen(csv, zuVon(csv), k({
    bereich: 'physio',
    vorhandeneVo: new Set(['p1|2026-10-14|X0501']),
  }));
  // Zeile 0: Erstes Vorkommen -> ok
  assert.equal(e.zeilen[0].fehler.length, 0);
  assert.equal(e.zeilen[0].istDublette, false);
  // Zeile 1: Doppelt in Datei -> gelb (kein Fehler), istDublette = true
  assert.equal(e.zeilen[1].fehler.length, 0);
  assert.equal(e.zeilen[1].istDublette, true);
  assert.match(e.zeilen[1].hinweise.join(), /doppelt in Datei.*übersprungen/);
  // Zeile 2: Schon in Praxura -> gelb (kein Fehler), istDublette = true
  assert.equal(e.zeilen[2].fehler.length, 0);
  assert.equal(e.zeilen[2].istDublette, true);
  assert.match(e.zeilen[2].hinweise.join(), /existiert bereits.*übersprungen/);

  assert.equal(e.ok, 1); // Nur Zeile 0 wird übernommen
  assert.equal(e.rot, 0); // Keine roten Fehler
});

test('Physio: 2 Heilmittel Dublette berücksichtigt ALLE Codes unabhängig von der Reihenfolge', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;Diagnosegruppe;Heilmittel;Anzahl;Heilmittel 2;Anzahl Einheiten 2;Unterschrift;Erbracht;Abgerechnet\n';
  const csv = kopf
    // Zeile 1: X0501 + X1201
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X0501;6;X1201;6;ja;0;nein\n'
    // Zeile 2: Nur X0501 (darf NICHT als Dublette von Zeile 1 markiert werden!)
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X0501;6;;;ja;0;nein\n'
    // Zeile 3: X1201 + X0501 (gleiche Codes in umgekehrter Reihenfolge -> echte Dublette von Zeile 1!)
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X1201;6;X0501;6;ja;0;nein\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  assert.equal(e.zeilen.length, 3);
  // Zeile 1: ok
  assert.equal(e.zeilen[0].istDublette, false);
  // Zeile 2: nur 1 HM, keine Dublette von Zeile 1!
  assert.equal(e.zeilen[1].istDublette, false);
  // Zeile 3: echte Dublette von Zeile 1 (Reihenfolge X1201 + X0501 ist egal)
  assert.equal(e.zeilen[2].istDublette, true);
  assert.match(e.zeilen[2].hinweise.join(), /doppelt in Datei/);
});

test('Physio: Türkische und deutsche Sonderzeichen + UTF-8 BOM', () => {
  const bomCsv = '\uFEFFNachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;BSNR;Diagnosegruppe;ICD-10;Heilmittel;Anzahl;Unterschrift;Erbracht;Abgerechnet\n'
    + 'Şahin;Çağlar;15.06.1985;15.10.2026;123456601;123456700;WS;M54.5;X0501;6;ja;0;nein\n';
  const e = pruefeVerordnungen(bomCsv, zuVon(bomCsv), k({ bereich: 'physio' }));
  assert.equal(e.zeilen.length, 1);
  assert.equal(e.zeilen[0].fehler.length, 0, e.zeilen[0].fehler.join());
  assert.equal(e.zeilen[0].verordnung.patient.id, 'p2');
  assert.equal(e.zeilen[0].verordnung.csvName, 'Şahin, Çağlar');
  assert.equal(e.ok, 1);
});

test('Physio: voRumpf trägt therapie_bereich physio und heilmittel_items', () => {
  const csv = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;Diagnosegruppe;Heilmittel;Anzahl;Heilmittel 2;Anzahl 2\n'
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;WS;X0501;6;X1201;6\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  const v = e.zeilen[0].verordnung;
  const r = voRumpf(v, '2026-10-20');
  assert.equal(r.patient_id, 'p1');
  assert.equal(r.parsed.rezept.therapiebereich, 'physio');
  assert.equal(r.parsed.rezept.heilmittel_position, 'X0501');
  assert.equal(r.parsed.rezept.anzahl_einheiten, 12);
  assert.equal(r.parsed.rezept.heilmittel_items.length, 2);
  assert.equal(r.parsed.rezept.heilmittel_items[0].code, 'X0501');
  assert.equal(r.parsed.rezept.heilmittel_items[1].code, 'X1201');
});

test('voImportSchluessel: X0501 und 20501 sind aequivalent (Positionen-Normalisierung)', () => {
  const k1 = voImportSchluessel({ patientId: 'p1', ausstellungsdatum: '2026-10-15', codes: ['X0501'] });
  const k2 = voImportSchluessel({ patientId: 'p1', ausstellungsdatum: '2026-10-15', codes: ['20501'] });
  const k3 = voImportSchluessel({ patientId: 'p1', ausstellungsdatum: '15.10.2026', codes: ['10501'] });
  assert.equal(k1, 'p1|2026-10-15|X0501');
  assert.equal(k2, 'p1|2026-10-15|X0501');
  assert.equal(k3, 'p1|2026-10-15|X0501');
  assert.equal(k1, k2);
  assert.equal(k2, k3);
});

test('voImportSchluessel: Mehrfach-Codes sortiert und reihenfolgeunabhaengig', () => {
  const kA = voImportSchluessel({ patientId: 'p1', ausstellungsdatum: '2026-10-15', codes: ['21201', 'X0501'] });
  const kB = voImportSchluessel({ patientId: 'p1', ausstellungsdatum: '2026-10-15', codes: ['20501', 'X1201'] });
  const kC = voImportSchluessel({ patientId: 'p1', ausstellungsdatum: '2026-10-15', codes: [{ code: 'X0501' }, { code: '21201' }] });
  assert.equal(kA, 'p1|2026-10-15|X0501+X1201');
  assert.equal(kA, kB);
  assert.equal(kB, kC);
});

test('voImportSchluessel: DB-Zeile mit heilmittel_items + heilmittel_position erzeugt gleichen Schluessel wie CSV-Zeile', () => {
  const dbRow = {
    patient_id: 'p1',
    ausstellungsdatum: '2026-10-15',
    heilmittel_position: '20501',
    heilmittel_items: [{ code: '20501', einheiten: 6 }, { code: '21201', einheiten: 6 }],
    ergaenzend_position: null,
    therapie_bereich: 'physio',
  };
  const dbCodes = codesAusVerordnung(dbRow);
  const dbKey = voImportSchluessel({
    patientId: dbRow.patient_id,
    ausstellungsdatum: dbRow.ausstellungsdatum,
    codes: dbCodes,
    bereich: dbRow.therapie_bereich,
  });

  const csvCodes = ['X0501', 'X1201'];
  const csvKey = voImportSchluessel({
    patientId: 'p1',
    ausstellungsdatum: '15.10.2026',
    codes: csvCodes,
    bereich: 'physio',
  });

  assert.equal(dbKey, 'p1|2026-10-15|X0501+X1201');
  assert.equal(csvKey, dbKey);
});

test('W15 P1: Gleiche Datei zweimal importiert -> beim 2. Mal 0 uebernommen, alle Zeilen „bereits vorhanden"', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;BSNR;Diagnosegruppe;ICD-10;Heilmittel;Anzahl;Unterschrift;Erbracht;Abgerechnet\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;123456700;WS;M54.5;X0501;6;ja;0;nein\n'
    + 'Şahin;Çağlar;15.06.1985;16.10.2026;123456601;123456700;WS;M54.5;X0501;6;ja;0;nein\n';

  // 1. Import: saubere DB -> 2 werden übernommen
  const import1 = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio', vorhandeneVo: new Set() }));
  assert.equal(import1.ok, 2);
  assert.equal(import1.rot, 0);
  const uebernehmbar1 = import1.zeilen.filter(z => !z.fehler.length && !z.istDublette);
  assert.equal(uebernehmbar1.length, 2);

  // Simulation: Server hat die Rezepte gespeichert (Backend speichert 20501)
  const dbRows = [
    { patient_id: 'p1', ausstellungsdatum: '2026-10-15', heilmittel_position: '20501', heilmittel_items: [{ code: '20501' }], therapie_bereich: 'physio' },
    { patient_id: 'p2', ausstellungsdatum: '2026-10-16', heilmittel_position: '20501', heilmittel_items: [{ code: '20501' }], therapie_bereich: 'physio' },
  ];
  const vorhandeneVo = new Set();
  for (const r of dbRows) {
    vorhandeneVo.add(voImportSchluessel({
      patientId: r.patient_id,
      ausstellungsdatum: r.ausstellungsdatum,
      codes: codesAusVerordnung(r),
      bereich: r.therapie_bereich,
    }));
  }

  // 2. Import: dieselbe Datei erneut importiert
  const import2 = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio', vorhandeneVo }));
  const uebernehmbar2 = import2.zeilen.filter(z => !z.fehler.length && !z.istDublette);
  assert.equal(uebernehmbar2.length, 0, 'Beim 2. Import duerfen 0 Verordnungen uebernommen werden');
  assert.equal(import2.zeilen[0].istDublette, true);
  assert.equal(import2.zeilen[1].istDublette, true);
  assert.ok(import2.zeilen[0].hinweise.some(h => /bereits vorhanden|existiert bereits/.test(h)));
  assert.ok(import2.zeilen[1].hinweise.some(h => /bereits vorhanden|existiert bereits/.test(h)));
});

test('W15 P2: Ueberschreitung der Hoechstmenge in Physio (WS2: 12 > 6) zeigt gelb mit „wird als Entwurf übernommen"', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;BSNR;Diagnosegruppe;ICD-10;Heilmittel;Anzahl;Unterschrift;Erbracht;Abgerechnet\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;123456700;WS2;M54.5;X0501;12;ja;0;nein\n';

  const e = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  assert.equal(e.zeilen.length, 1);
  const z = e.zeilen[0];
  assert.equal(z.fehler.length, 0, 'Kein harter Fehler');
  assert.equal(z.istDublette, false);
  assert.equal(z.istEntwurf, true, 'Muss als Entwurf gekennzeichnet sein');
  assert.ok(z.hinweise.some(h => h.startsWith('wird als Entwurf übernommen:')), 'Hinweis mit „wird als Entwurf übernommen"');
  assert.ok(z.hinweise.some(h => /Höchstmenge überschritten/i.test(h)), 'Grund Höchstmenge genannt');
  assert.equal(e.gelb, 1, 'In gelb/Hinweis gezaehlt');
  assert.equal(e.rot, 0, 'Kein Blocker');
});

test('W15 P3: Dublette mit Höchstmenge-Überschreitung zeigt nur „übersprungen", nicht zugleich „Entwurf"', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;BSNR;Diagnosegruppe;ICD-10;Heilmittel;Anzahl;Unterschrift;Erbracht;Abgerechnet\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;123456700;WS2;M54.5;X0501;12;ja;0;nein\n';
  const erst = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio' }));
  assert.equal(erst.zeilen[0].istEntwurf, true);

  const vorhandeneVo = new Set([voImportSchluessel({
    patientId: 'p1', ausstellungsdatum: '2026-10-15', codes: ['20501'], bereich: 'physio',
  })]);
  const z = pruefeVerordnungen(csv, zuVon(csv), k({ bereich: 'physio', vorhandeneVo })).zeilen[0];
  assert.equal(z.istDublette, true);
  assert.equal(z.istEntwurf, false);
  assert.ok(z.hinweise.some(h => /bereits vorhanden/.test(h)));
  assert.ok(!z.hinweise.some(h => h.startsWith('wird als Entwurf übernommen')), 'kein Widerspruch zum Überspringen');
});
