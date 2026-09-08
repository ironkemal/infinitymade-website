import test from 'node:test';
import assert from 'node:assert/strict';
import {
  offenerBetrag,
  belegTypFuer,
  erzeugtKassenbuchBeleg,
  ausbuchungUeberKorrektur,
  planeZahlung,
} from './rechnung-zahlungseingang.js';

const basis = { rechnungsbetrag: 100, gegenkontoCode: '1200' };

test('offenerBetrag: Rechnungsbetrag minus bereits Gebuchtes', () => {
  assert.equal(offenerBetrag({ rechnungsbetrag: 100, bereitsGebucht: 30 }), 70);
  assert.equal(offenerBetrag({ rechnungsbetrag: 100 }), 100);
});

test('offenerBetrag: rechnet in Cent, keine Gleitkomma-Reste', () => {
  assert.equal(offenerBetrag({ rechnungsbetrag: 0.3, bereitsGebucht: 0.1 }), 0.2);
});

// ── Die zwei Verdrahtungsregeln ─────────────────────────────────────────────

test('belegTypFuer: rezeptgebundene Rechnung bucht als zuzahlung, damit das Mahnwesen sie sieht', () => {
  assert.equal(belegTypFuer(true), 'zuzahlung');
});

test('belegTypFuer: rezeptlose Privatrechnung bucht als rechnung', () => {
  assert.equal(belegTypFuer(false), 'rechnung');
});

test('erzeugtKassenbuchBeleg: nur Bargeld (1000) landet im Kassenbuch', () => {
  assert.equal(erzeugtKassenbuchBeleg('1000'), true);
  assert.equal(erzeugtKassenbuchBeleg(' 1000 '), true);
  assert.equal(erzeugtKassenbuchBeleg('1200'), false);
  assert.equal(erzeugtKassenbuchBeleg('8700'), false);
  assert.equal(erzeugtKassenbuchBeleg(null), false);
});

test('ausbuchungUeberKorrektur: nur bei Rezeptbezug, sonst reine Ledger-Zeile', () => {
  assert.equal(ausbuchungUeberKorrektur(true), true);
  assert.equal(ausbuchungUeberKorrektur(false), false);
});

// ── planeZahlung: Ablehnungen ───────────────────────────────────────────────

test('planeZahlung: Rechnung ohne Betrag wird abgelehnt', () => {
  const p = planeZahlung({ ...basis, rechnungsbetrag: 0, eingegangen: 10 });
  assert.equal(p.ok, false);
  assert.match(p.fehler, /keinen Betrag/);
});

test('planeZahlung: ohne Gegenkonto wird abgelehnt', () => {
  const p = planeZahlung({ rechnungsbetrag: 100, eingegangen: 10, gegenkontoCode: '' });
  assert.equal(p.ok, false);
  assert.match(p.fehler, /Gegenkonto/);
});

test('planeZahlung: Betrag 0 oder negativ wird abgelehnt', () => {
  assert.equal(planeZahlung({ ...basis, eingegangen: 0 }).ok, false);
  assert.equal(planeZahlung({ ...basis, eingegangen: -5 }).ok, false);
  assert.equal(planeZahlung({ ...basis, eingegangen: 'abc' }).ok, false);
});

test('planeZahlung: Ueberzahlung ist ein harter Fehler, kein Guthaben', () => {
  const p = planeZahlung({ ...basis, eingegangen: 100.01 });
  assert.equal(p.ok, false);
  assert.match(p.fehler, /Mehr als offen/);
  assert.match(p.fehler, /100,00/);
});

test('planeZahlung: auf eine bereits vollstaendig gebuchte Rechnung geht nichts mehr', () => {
  const p = planeZahlung({ ...basis, bereitsGebucht: 100, eingegangen: 10 });
  assert.equal(p.ok, false);
  assert.match(p.fehler, /bereits alles gebucht/);
});

// ── planeZahlung: Buchungen ─────────────────────────────────────────────────

test('planeZahlung: Vollzahlung ergibt eine Buchung und Status paid', () => {
  const p = planeZahlung({ ...basis, eingegangen: 100 });
  assert.equal(p.ok, true);
  assert.equal(p.restbetrag, 0);
  assert.equal(p.neuerStatus, 'paid');
  assert.deepEqual(p.buchungen, [{ art: 'zahlung', betrag_eur: 100, gegenkonto_code: '1200' }]);
});

test('planeZahlung: Teilzahlung offen lassen ergibt Status partial und keine Ausbuchung', () => {
  const p = planeZahlung({ ...basis, eingegangen: 60 });
  assert.equal(p.ok, true);
  assert.equal(p.restbetrag, 40);
  assert.equal(p.neuerStatus, 'partial');
  assert.equal(p.buchungen.length, 1);
});

test('planeZahlung: Ausbuchen erzeugt eine zweite Zeile auf dem Ausbuchungskonto', () => {
  const p = planeZahlung({ ...basis, eingegangen: 60, restbetragModus: 'ausbuchen' });
  assert.equal(p.ok, true);
  assert.equal(p.neuerStatus, 'paid');
  assert.deepEqual(p.buchungen, [
    { art: 'zahlung',    betrag_eur: 60, gegenkonto_code: '1200' },
    { art: 'ausbuchung', betrag_eur: 40, gegenkonto_code: '8700' },
  ]);
});

test('planeZahlung: Ausbuchungskonto ist waehlbar', () => {
  const p = planeZahlung({
    ...basis, eingegangen: 60, restbetragModus: 'ausbuchen', ausbuchungskontoCode: '4900',
  });
  assert.equal(p.buchungen[1].gegenkonto_code, '4900');
});

test('planeZahlung: ohne Restbetrag entsteht keine Ausbuchungszeile, auch wenn ausbuchen gewaehlt ist', () => {
  const p = planeZahlung({ ...basis, eingegangen: 100, restbetragModus: 'ausbuchen' });
  assert.equal(p.buchungen.length, 1);
  assert.equal(p.neuerStatus, 'paid');
});

test('planeZahlung: zweite Teilzahlung rechnet gegen das bereits Gebuchte', () => {
  const p = planeZahlung({ ...basis, bereitsGebucht: 60, eingegangen: 40 });
  assert.equal(p.ok, true);
  assert.equal(p.offenVorher, 40);
  assert.equal(p.restbetrag, 0);
  assert.equal(p.neuerStatus, 'paid');
});

test('planeZahlung: Barzahlung meldet den Kassenbuch-Beleg, Bank nicht', () => {
  assert.equal(planeZahlung({ ...basis, gegenkontoCode: '1000', eingegangen: 10 }).kassenbuchBeleg, true);
  assert.equal(planeZahlung({ ...basis, eingegangen: 10 }).kassenbuchBeleg, false);
});

test('planeZahlung: Ausbuchen auf rezeptgebundener Rechnung wird abgelehnt und auf die Korrektur verwiesen', () => {
  const p = planeZahlung({
    ...basis, eingegangen: 60, restbetragModus: 'ausbuchen', hatRezeptbezug: true,
  });
  assert.equal(p.ok, false);
  assert.match(p.fehler, /Zuzahlung korrigieren/);
});

test('planeZahlung: ohne Rezeptbezug ist Ausbuchen der normale Weg', () => {
  const p = planeZahlung({
    ...basis, eingegangen: 60, restbetragModus: 'ausbuchen', hatRezeptbezug: false,
  });
  assert.equal(p.ok, true);
  assert.equal(p.buchungen.length, 2);
});

test('planeZahlung: Teilzahlung auf rezeptgebundener Rechnung bleibt erlaubt, nur nicht das Ausbuchen', () => {
  const p = planeZahlung({ ...basis, eingegangen: 60, hatRezeptbezug: true });
  assert.equal(p.ok, true);
  assert.equal(p.neuerStatus, 'partial');
});

test('planeZahlung: krumme Betraege ergeben keine Rundungsreste', () => {
  const p = planeZahlung({ rechnungsbetrag: 33.33, gegenkontoCode: '1200', eingegangen: 11.11 });
  assert.equal(p.restbetrag, 22.22);
});
