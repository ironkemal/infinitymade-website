// Das Modell hinter den „+"-Zeilen der Terminmaske (Ops 235). An der Summe
// haengt die Slotlaenge und damit die Doppelbuchungssperre der Datenbank —
// jeder Fall hier ist entweder ein zu kurzer Block oder eine falsche Position
// auf der Abrechnung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  neueZeile, gesamtDauer, begrenzeAnzahl, fuegeZeileHinzu, entferneZeile,
  hpnrVonDienst, mitBefundungsvorschlag, STANDARD_DAUER_MIN, MAX_ANZAHL,
} from './termin-leistungen.js';

// Ein kleiner Katalog, wie ihn `servicesCache` fuehrt.
const DIENSTE = [
  { id: 's-beh-kl', gkv_position_nr: '78010', duration_minutes: 35, title: 'Behandlung klein' },
  { id: 's-beh-gr', gkv_position_nr: '78020', duration_minutes: 50, title: 'Behandlung gross' },
  { id: 's-bef',    gkv_position_nr: '78030', duration_minutes: null, title: 'Befundung' },
  { id: 's-eing',   gkv_position_nr: '78040', duration_minutes: 20, title: 'Eingangsbefundung' },
  { id: 's-nsp',    gkv_position_nr: '78610', duration_minutes: 45, title: 'Nagelspange' },
  { id: 's-alt',    code: 'P01',              duration_minutes: 50, title: 'Alte Podo-Leistung' },
];

// ── Dauer ────────────────────────────────────────────────────────────────────

test('Dauer ist die Summe der Zeilen — das ist die Laenge des Kalenderblocks', () => {
  const zeilen = [neueZeile('s-beh-gr'), neueZeile('s-eing')];
  assert.equal(gesamtDauer(zeilen, DIENSTE), 70, '50 + 20');
});

test('Anzahl multipliziert die Dauer', () => {
  const zeilen = [{ ...neueZeile('s-beh-kl'), anzahl: 3 }];
  assert.equal(gesamtDauer(zeilen, DIENSTE), 105);
});

test('Leistung ohne Dauer faellt auf den Standard, nicht auf 0', () => {
  // 78030 fuehrt keine Regelleistungszeit. Mit 0 waere der Block zu kurz und
  // der naechste Patient laege darin.
  assert.equal(gesamtDauer([neueZeile('s-bef')], DIENSTE), STANDARD_DAUER_MIN);
});

test('leere Liste und unbekannte Leistung ergeben nie 0 Minuten', () => {
  assert.equal(gesamtDauer([], DIENSTE), STANDARD_DAUER_MIN);
  assert.equal(gesamtDauer([neueZeile('gibt-es-nicht')], DIENSTE), STANDARD_DAUER_MIN);
  assert.equal(gesamtDauer(null, null), STANDARD_DAUER_MIN);
  assert.equal(gesamtDauer([neueZeile(null)], DIENSTE), STANDARD_DAUER_MIN);
});

test('Anzahl wird begrenzt statt geglaubt', () => {
  assert.equal(begrenzeAnzahl(0), 1);
  assert.equal(begrenzeAnzahl(-4), 1);
  assert.equal(begrenzeAnzahl('abc'), 1);
  assert.equal(begrenzeAnzahl(null), 1);
  assert.equal(begrenzeAnzahl(999), MAX_ANZAHL, 'ein verrutschter Tastendruck sperrt nicht den Tag');
  assert.equal(begrenzeAnzahl('3'), 3);
});

// ── Zeilen ───────────────────────────────────────────────────────────────────

test('dieselbe Leistung zweimal erhoeht die Anzahl statt eine Zeile zu doppeln', () => {
  let z = [neueZeile('s-beh-kl')];
  z = fuegeZeileHinzu(z, 's-beh-kl');
  assert.equal(z.length, 1);
  assert.equal(z[0].anzahl, 2, 'die Abrechnung fuehrt je Position eine Menge');
});

test('eine andere Leistung bekommt eine eigene Zeile', () => {
  const z = fuegeZeileHinzu([neueZeile('s-beh-gr')], 's-eing');
  assert.equal(z.length, 2);
  assert.equal(z[1].serviceId, 's-eing');
});

test('„+" ohne Auswahl legt eine leere Zeile an', () => {
  const z = fuegeZeileHinzu([neueZeile('s-beh-kl')]);
  assert.equal(z.length, 2);
  assert.equal(z[1].serviceId, null);
});

test('Hinzufuegen laesst die Eingabeliste unberuehrt', () => {
  const vorher = [neueZeile('s-beh-kl')];
  fuegeZeileHinzu(vorher, 's-eing');
  assert.equal(vorher.length, 1, 'kein verstecktes Mutieren');
});

test('die erste Zeile laesst sich nicht entfernen — service_id ist Pflicht', () => {
  const z = entferneZeile([neueZeile('s-beh-kl'), neueZeile('s-eing')], 0);
  assert.equal(z.length, 2);
});

test('Zusatzzeilen lassen sich entfernen, unsinnige Indizes tun nichts', () => {
  const start = [neueZeile('s-beh-kl'), neueZeile('s-eing')];
  assert.equal(entferneZeile(start, 1).length, 1);
  assert.equal(entferneZeile(start, 7).length, 2);
  assert.equal(entferneZeile(start, -1).length, 2);
});

// ── HPNR aus der Leistung ────────────────────────────────────────────────────

test('HPNR kommt aus gkv_position_nr, sonst aus code', () => {
  assert.equal(hpnrVonDienst(DIENSTE[0]), '78010');
  assert.equal(hpnrVonDienst(DIENSTE[5]), 'P01', 'aeltere Handanlagen fuehren nur code');
  assert.equal(hpnrVonDienst(null), '');
  assert.equal(hpnrVonDienst({}), '');
});

// ── Befundungsvorschlag ──────────────────────────────────────────────────────

test('neuer Patient + Behandlung → Eingangsbefundung kommt als zweite Zeile', () => {
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-gr')], dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(r.zeilen.length, 2);
  assert.equal(r.zeilen[1].serviceId, 's-eing');
  assert.equal(r.zeilen[1].auto, true);
  assert.match(r.rueckfrage, /01\.11\.2023/, 'die offene Frage wird durchgereicht');
});

test('die vorgeschlagene Zeile verlaengert den Block', () => {
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-gr')], dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(gesamtDauer(r.zeilen, DIENSTE), 70, '50 Behandlung + 20 Eingangsbefundung');
});

test('laufende Serie → 78030 statt 78040', () => {
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-kl')], dienste: DIENSTE, datum: '2026-09-03',
    behandlungen: [{ behandlungsdatum: '2026-08-04', hpnr_codes: ['78030', '78010'] }],
  });
  assert.equal(r.zeilen[1].serviceId, 's-bef');
});

test('Nagelspange bekommt keine Zeile, nur einen Hinweis', () => {
  // Beta-1, 31.08.2026: „beim Nagel gibt es das nicht."
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-nsp')], dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(r.zeilen.length, 1);
  assert.equal(r.grund, 'nagelzweig');
  assert.match(r.hinweis, /78110/);
});

test('ein neuer Vorschlag raeumt den alten weg — aber nie eine Handauswahl', () => {
  // Erst neuer Patient (78040 vorgeschlagen), dann Wechsel auf Nagelspange.
  const ersteRunde = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-gr')], dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(ersteRunde.zeilen.length, 2);

  const gewechselt = [{ ...ersteRunde.zeilen[0], serviceId: 's-nsp' }, ersteRunde.zeilen[1]];
  const zweiteRunde = mitBefundungsvorschlag({
    zeilen: gewechselt, dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(zweiteRunde.zeilen.length, 1, 'die automatische 78040 muss weg');

  // Dieselbe Zeile von Hand gesetzt bleibt dagegen stehen.
  const vonHand = [{ ...ersteRunde.zeilen[0], serviceId: 's-nsp' },
                   { ...ersteRunde.zeilen[1], auto: false }];
  const dritteRunde = mitBefundungsvorschlag({
    zeilen: vonHand, dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(dritteRunde.zeilen.length, 2, 'was der Podologe selbst gewaehlt hat, bleibt');
});

test('schon von Hand gewaehlte Befundung wird nicht ein zweites Mal gesetzt', () => {
  const zeilen = [neueZeile('s-beh-gr'), { ...neueZeile('s-eing'), auto: false }];
  const r = mitBefundungsvorschlag({
    zeilen, dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(r.zeilen.length, 2);
  assert.equal(r.grund, 'schon_gewaehlt');
});

test('nicht eingerichtete Befundung → Hinweis statt stiller Luecke', () => {
  const ohneEingang = DIENSTE.filter(d => d.id !== 's-eing');
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-gr')], dienste: ohneEingang, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(r.zeilen.length, 1);
  assert.equal(r.grund, 'leistung_fehlt');
  assert.match(r.hinweis, /78040/);
});

test('Selbstzahler und leere Hauptzeile schlagen nichts vor', () => {
  const selbst = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-gr')], dienste: DIENSTE, datum: '2026-09-03', selbstzahler: true,
  });
  assert.equal(selbst.zeilen.length, 1);
  assert.equal(selbst.grund, 'selbstzahler');

  const leer = mitBefundungsvorschlag({
    zeilen: [neueZeile(null)], dienste: DIENSTE, datum: '2026-09-03',
  });
  assert.equal(leer.grund, 'keine_leistung');
});

test('alte Positionsnummer meldet sich, statt wortlos nichts zu tun', () => {
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-alt')], dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(r.zeilen.length, 1);
  assert.equal(r.grund, 'legacy_positionsnummer');
  assert.match(r.hinweis, /P01/);
});
