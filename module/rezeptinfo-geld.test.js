import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findePosition, ermittleGeldstand, euroZustand, zahlerTyp, preisAusLeistung,
} from './rezeptinfo-geld.js';

const KATALOG = [
  { code: 'X0501', title: 'Krankengymnastik', price: 30 },
  { code: 'X1201', title: 'Manuelle Therapie', price: 40 },
];
const POS = { preis: 30, zuzahlung: null, frei: false };

// ── Wer zahlt? ─────────────────────────────────────────────────────────────
// Raten kostet in beide Richtungen Geld, deshalb gibt es „unbekannt" als
// eigenen Zustand — und nicht als stille Vorgabe.

test('die Verordnung schlägt den Patientenstamm', () => {
  assert.equal(zahlerTyp({ insurance_type: 'gkv' }, { rezeptart: 'privat' }), 'privat');
  assert.equal(zahlerTyp({ insurance_type: 'privat' }, { rezeptart: 'kassen' }), 'gkv');
});

test('ohne Angabe an der Verordnung entscheidet der Patient', () => {
  assert.equal(zahlerTyp({ insurance_type: 'privat' }, {}), 'privat');
  assert.equal(zahlerTyp({ insurance_type: 'gkv' }, {}), 'gkv');
});

test('selbstzahler und BG laufen wie privat', () => {
  assert.equal(zahlerTyp(null, { rezeptart: 'selbstzahler' }), 'privat');
  assert.equal(zahlerTyp(null, { rezeptart: 'bg' }), 'privat');
});

test('steht nirgends etwas, wird nicht geraten', () => {
  assert.equal(zahlerTyp(null, null), 'unbekannt');
  assert.equal(zahlerTyp({}, {}), 'unbekannt');
  assert.equal(zahlerTyp({ insurance_type: null }, { rezeptart: null }), 'unbekannt');
});

// ── Position finden ────────────────────────────────────────────────────────

test('Position wird in beiden Schreibweisen gefunden', () => {
  assert.equal(findePosition({ heilmittel_position: 'X0501' }, { katalog: KATALOG }).preis, 30);
  assert.equal(findePosition({ heilmittel_position: '20501' }, { katalog: KATALOG }).preis, 30);
});

test('unbekannte Position wird nicht geraten', () => {
  assert.equal(findePosition({ heilmittel_position: '99999' }, { katalog: KATALOG }), null);
  assert.equal(findePosition({}, { katalog: KATALOG }), null);
});

test('der Podologie-Katalog hat Vorrang und bringt die Zuzahlung mit', () => {
  const karte = new Map([['78010', { preis: 25, zuzahlung: 2.5 }]]);
  const p = findePosition({ heilmittel_position: '78010' }, { podoKarte: karte, katalog: KATALOG });
  assert.equal(p.quelle, 'podologie');
  assert.equal(p.zuzahlung, 2.5);
  assert.equal(p.frei, false);
});

// `zuzahlung: null` heisst im Podologie-Katalog „zuzahlungsfrei" (78220, 78530)
// — nicht „unbekannt". Die beiden dürfen nicht ineinanderlaufen.
test('zuzahlungsfreie Podologie-Position wird als frei erkannt', () => {
  const karte = new Map([['78220', { preis: 12, zuzahlung: null }]]);
  assert.equal(findePosition({ heilmittel_position: '78220' }, { podoKarte: karte }).frei, true);
});

// ── GKV: 10 % je Einheit + 10 € je Verordnung (§ 61 SGB V) ─────────────────

test('sechs Einheiten à 30 € ergeben 18 € Anteil plus 10 € Pauschale', () => {
  const st = ermittleGeldstand({ rx: { anzahl_einheiten: 6 }, erbracht: 6, zahler: 'gkv', position: POS });
  assert.equal(st.brutto, 180);
  assert.equal(st.gesamt, 28);
});

// Die Pauschale hängt an der Verordnung, nicht an der Sitzung — beim Abbruch
// sinkt nur der Prozentanteil.
test('Abbruch nach drei Sitzungen senkt den Anteil, nicht die Pauschale', () => {
  const st = ermittleGeldstand({ rx: { anzahl_einheiten: 6 }, erbracht: 3, zahler: 'gkv', position: POS });
  assert.equal(st.brutto, 90);
  assert.equal(st.pauschale, 10);
  assert.equal(st.gesamt, 19);
});

test('Befreiung setzt alles auf null', () => {
  const st = ermittleGeldstand({
    rx: { anzahl_einheiten: 6, zuzahlung_befreit: true }, erbracht: 6, zahler: 'gkv', position: POS });
  assert.equal(st.gesamt, 0);
  assert.equal(st.befreit, true);
});

// ── Privat: die volle Leistung, aus den EIGENEN Preisen ────────────────────
// Der GKV-Satz wäre hier die falsche Zahl — privat wird frei kalkuliert und
// liegt in der Regel höher. Wer den Kassensatz übernimmt, rechnet unter Wert ab.

test('privat zählt die eigene Summe, ohne Prozentanteil und ohne Pauschale', () => {
  const st = ermittleGeldstand({
    rx: { anzahl_einheiten: 6 }, erbracht: 6, zahler: 'privat',
    privat: { summe: 285, positionen: 6, offenePreise: 0 },
  });
  assert.equal(st.gesamt, 285);
  assert.equal(st.brutto, 285);
  assert.equal(st.unbekannt, false);
});

test('privat ohne hinterlegte Preise meldet eine Lücke statt 0,00 €', () => {
  const st = ermittleGeldstand({
    rx: { anzahl_einheiten: 6 }, erbracht: 6, zahler: 'privat',
    privat: { summe: 0, positionen: 6, offenePreise: 6 },
  });
  assert.equal(st.unbekannt, true);
  assert.equal(st.offenePreise, 6);
});

test('Preis kommt erst aus price, sonst aus der ersten aktiven Dauer', () => {
  assert.equal(preisAusLeistung({ price: '32.50' }), 32.5);
  assert.equal(preisAusLeistung({ price: 0, price_config: { durations: {
    20: { active: false, price: '20.00' }, 30: { active: true, price: '45.00' } } } }), 45);
  assert.equal(preisAusLeistung(null), 0);
});

// ── Was der Knopf anbietet ─────────────────────────────────────────────────

test('GKV mit offenem Betrag bietet Kassieren an', () => {
  const rx = { anzahl_einheiten: 6 };
  const st = ermittleGeldstand({ rx, erbracht: 6, zahler: 'gkv', position: POS });
  const zz = euroZustand(rx, st);
  assert.equal(zz.aktion, 'kassieren');
  assert.equal(zz.label, 'Zuzahlung');
  assert.match(zz.text, /28,00/);
});

test('nach dem Kassieren führt der Knopf zum Beleg, nicht noch einmal zur Kasse', () => {
  const rx = { anzahl_einheiten: 6, zuzahlung_kassiert_am: '2026-09-03T10:00:00Z' };
  const st = ermittleGeldstand({ rx, erbracht: 6, zahler: 'gkv', position: POS });
  assert.equal(euroZustand(rx, st).aktion, 'beleg');
});

test('privat führt zum Rechnungsentwurf über den vollen Betrag', () => {
  const rx = { anzahl_einheiten: 6 };
  const st = ermittleGeldstand({ rx, erbracht: 6, zahler: 'privat', privat: { summe: 285, positionen: 6, offenePreise: 0 } });
  const zz = euroZustand(rx, st);
  assert.equal(zz.aktion, 'rechnung');
  assert.equal(zz.label, 'Rechnungsbetrag');
  assert.match(zz.text, /285,00/);
});

// Unbekannter Zahler: der Knopf fragt, statt eine Vorgabe zu wählen.
test('ohne Kassenstatus fragt der Knopf nach', () => {
  const rx = { anzahl_einheiten: 6 };
  const st = { ...ermittleGeldstand({ rx, erbracht: 6, zahler: 'gkv', position: POS }), zahler: 'unbekannt' };
  const zz = euroZustand(rx, st);
  assert.equal(zz.aktion, 'fragen');
  assert.equal(zz.text, '?');
});

// Ohne Preis darf der Knopf NICHTS anbieten — jeder Betrag wäre geraten, und
// der Patient zahlt ihn.
test('ohne Katalogpreis bleibt der GKV-Knopf ohne Handlung', () => {
  const rx = { anzahl_einheiten: 6 };
  const st = ermittleGeldstand({ rx, erbracht: 6, zahler: 'gkv', position: null });
  const zz = euroZustand(rx, st);
  assert.equal(zz.aktion, 'keine');
  assert.equal(zz.text, '—');
});

test('ohne eigene Preise bleibt der Privat-Knopf ohne Handlung', () => {
  const rx = { anzahl_einheiten: 6 };
  const st = ermittleGeldstand({ rx, erbracht: 6, zahler: 'privat', privat: { summe: 0, positionen: 3, offenePreise: 3 } });
  assert.equal(euroZustand(rx, st).aktion, 'keine');
});

test('gar keine Verordnung ergibt keine Handlung statt eines Absturzes', () => {
  assert.equal(euroZustand(null, null).aktion, 'keine');
});
