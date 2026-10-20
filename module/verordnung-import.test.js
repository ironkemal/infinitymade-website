import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leseCsv, ordneSpaltenZu } from './patienten-import.js';
import { VO_SPALTEN, VO_VORLAGE_CSV, voFehlendePflicht, pruefeVerordnungen, voRumpf, leseNagel, janein } from './verordnung-import.js';

const patienten = [{ id: 'p1', first_name: 'Erika', last_name: 'Muster', geburtsdatum: '1950-02-01', versichertennummer: 'A123456780', krankenkasse_ik: '104212505', krankenkasse: 'AOK' }];
const k = (extra = {}) => ({ patienten, vorhandeneVo: new Set(), heute: '2026-10-20', ...extra });
const zuVon = (csv) => ordneSpaltenZu(leseCsv(csv)[0], VO_SPALTEN);

test('Vorlage: alle Spalten erkannt, Zeile übernehmbar', () => {
  const zu = zuVon(VO_VORLAGE_CSV);
  assert.deepEqual(voFehlendePflicht(zu), []);
  const e = pruefeVerordnungen(VO_VORLAGE_CSV, zu, k());
  assert.equal(e.ok, 1, JSON.stringify(e.zeilen[0].fehler));
  const v = e.zeilen[0].verordnung;
  assert.equal(v.patient.id, 'p1');
  assert.equal(v.dg, 'DF'); assert.equal(v.buchstabe, 'c');
  assert.equal(v.heilmittel, 'Podologische Komplexbehandlung');
  assert.equal(v.anzahl, 6);
});

test('Ablehnung: Frist abgelaufen, schon erbracht, abgerechnet, ohne Unterschrift, unbekannter Patient', () => {
  const kopf = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;Diagnosegruppe;Leitsymptomatik;Anzahl;Unterschrift;Erbracht;Abgerechnet\n';
  const csv = kopf
    + 'Muster;Erika;01.02.1950;01.08.2026;123456601;DF;a;6;ja;0;nein\n'   // Frist abgelaufen
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;NF;a;6;ja;2;nein\n'   // schon behandelt
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;QF;a;6;ja;0;ja\n'     // abgerechnet
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;DF;b;6;nein;0;nein\n' // ohne Unterschrift
    + 'Fremd;Hans;01.01.1960;15.10.2026;123456601;DF;a;6;ja;0;nein\n';    // Patient fehlt
  const e = pruefeVerordnungen(csv, zuVon(csv), k());
  assert.equal(e.ok, 0);
  assert.match(e.zeilen[0].fehler.join(), /Beginnfrist/);
  assert.match(e.zeilen[1].fehler.join(), /Schon behandelt/);
  assert.match(e.zeilen[2].fehler.join(), /abgerechnet/);
  assert.match(e.zeilen[3].fehler.join(), /Unterschrift/);
  assert.match(e.zeilen[4].fehler.join(), /Patientenstamm/);
});

test('UI: nur a), Höchstmenge 4 bei UI2, Nagel fehlt als Hinweis, b) wird abgelehnt', () => {
  const csv = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;DG;Leitsymptomatik;Anzahl\n'
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;UI 2;;6\n'
    + 'Muster;Erika;01.02.1950;16.10.2026;123456601;UI1;b;4\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k());
  const [a, b] = e.zeilen;
  assert.deepEqual(a.fehler, []);
  assert.equal(a.verordnung.heilmittel, 'Nagelspangenbehandlung');
  assert.ok(a.hinweise.some(h => /Höchstmenge|Mehr als 4/.test(h)));
  assert.ok(a.hinweise.some(h => /Nagel fehlt/.test(h)));
  assert.match(b.fehler.join(), /kennt Leitsymptomatik b/);
});

test('Dublette: in Praxura vorhanden und doppelt in Datei', () => {
  const csv = 'Nachname;Vorname;Geburtsdatum;Ausstellungsdatum;LANR;DG;Heilmittel;Anzahl\n'
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;DF;Hornhautabtragung;6\n'
    + 'Muster;Erika;01.02.1950;15.10.2026;123456601;DF;Hornhautabtragung;6\n'
    + 'Muster;Erika;01.02.1950;14.10.2026;123456601;DF;Hornhautabtragung;6\n';
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ vorhandeneVo: new Set(['p1|2026-10-14|123456601|DF']) }));
  assert.deepEqual(e.zeilen[0].fehler, []);
  assert.match(e.zeilen[1].fehler.join(), /doppelt in Datei/);
  assert.match(e.zeilen[2].fehler.join(), /schon in Praxura/);
});

test('voRumpf: Patient-ID, Bereich podo, Leitsymptomatik-Code, Kasse aus der Akte', () => {
  const zu = zuVon(VO_VORLAGE_CSV);
  const v = pruefeVerordnungen(VO_VORLAGE_CSV, zu, k()).zeilen[0].verordnung;
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
  const e = pruefeVerordnungen(csv, zuVon(csv), k({ patienten: zwei }));
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
