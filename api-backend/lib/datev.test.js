import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalisiereEinstellungen, fehlendeAngaben, buchungenAus, erzeugeExtfCsv,
  wirtschaftsjahr, belegfeld, EXTF_SPALTEN,
} from './datev.js';

const E = normalisiereEinstellungen({ beraternummer: '1234567', mandantennummer: '10001' });

test('Einstellungen: Vorschläge SKR03, SKR04 umgeschaltet, Unsinn verworfen', () => {
  assert.equal(E.geldkonten.kasse, '1000');
  assert.equal(E.erloeskonten.gkv, '8100');
  const v4 = normalisiereEinstellungen({ kontenrahmen: 'SKR04', erloeskonten: { gkv: '4105' }, wj_beginn: '13-01' });
  assert.equal(v4.geldkonten.bank, '1800');
  assert.equal(v4.erloeskonten.gkv, '4105');
  assert.equal(v4.wj_beginn, '01-01');
  assert.deepEqual(fehlendeAngaben(normalisiereEinstellungen({})).length, 2);
  assert.deepEqual(fehlendeAngaben(E), []);
});

test('Buchungen: Belegliste + GKV, Storno als Haben auf dem Konto des Originals, Abschreibung fehlt', () => {
  const b = buchungenAus({
    belege: [
      { id: 'a', beleg_nr: 7, type: 'zuzahlung', zahlart: 'bar', amount_eur: 10, created_at: '2026-03-31T22:30:00Z' },
      { id: 'b', beleg_nr: 8, type: 'rechnung', zahlart: 'ueberweisung', amount_eur: 80, created_at: '2026-04-02T10:00:00Z', invoice_id: 'i1' },
      { id: 'c', beleg_nr: 9, type: 'storno', zahlart: 'ueberweisung', amount_eur: -80, created_at: '2026-04-03T10:00:00Z', storno_von: 'b' },
    ],
    invoiceTypen: new Map([['i1', 'selbstzahler']]),
    invoiceNr: new Map([['i1', 'RE-2026-001']]),
    originale: new Map([['b', { type: 'rechnung', invoice_id: 'i1' }]]),
    gkv: [
      { art: 'zahlung', betrag_eur: 500, datum: '2026-04-10', einzel_rechnungsnummer: 'A.1' },
      { art: 'ruecklastschrift', betrag_eur: -50, datum: '2026-04-11', einzel_rechnungsnummer: 'A.1' },
      { art: 'abschreibung', betrag_eur: 20, datum: '2026-04-12' },
    ],
  }, normalisiereEinstellungen({ beraternummer: '1234567', mandantennummer: '1', erloeskonten: { selbstzahler: '8101' } }));
  assert.equal(b.length, 5);
  assert.equal(b[0].datum, '2026-04-01', 'Berliner Tag, nicht UTC');
  assert.equal(b[0].konto, '1000');
  const storno = b.find(x => x.belegfeld1 === '9');
  assert.equal(storno.sh, 'H');
  assert.equal(storno.betrag, 80);
  assert.equal(storno.gegenkonto, '8101');
  assert.equal(storno.konto, '1200');
  assert.ok(!/Muster|Erika/.test(JSON.stringify(b)));
  assert.equal(b.filter(x => x.text.startsWith('GKV')).map(x => x.sh).join(), 'S,H');
});

test('Wirtschaftsjahr und Belegfeld', () => {
  assert.deepEqual(wirtschaftsjahr('2026-03-01', '07-01'), { beginn: '2025-07-01', naechster: '2026-07-01' });
  assert.equal(belegfeld('A.1 ä;x'), 'A-1---x');
  assert.equal(belegfeld('x'.repeat(40)).length, 36);
});

test('EXTF: Kopf 31 Felder, 125 Spalten je Zeile, CRLF, Latin-1, Komma, TTMM', () => {
  const buf = erzeugeExtfCsv(
    [{ betrag: 1234.5, sh: 'S', konto: '1200', gegenkonto: '8100', datum: '2026-04-09', belegfeld1: 'RE-1', text: 'Zuzahlung Beleg 1 "x" Grüße' }],
    { einstellungen: E, von: '2026-04-01', bis: '2026-04-30', erzeugtAm: new Date('2026-10-22T10:00:00Z') });
  const s = buf.toString('latin1');
  assert.ok(s.endsWith('\r\n'));
  const z = s.split('\r\n');
  assert.equal(z[0].split(';').length, 31);
  assert.match(z[0], /^"EXTF";700;21;"Buchungsstapel";13;20261022120000000;;"";"";"";1234567;10001;20260101;4;20260401;20260430;/);
  assert.equal(z[1].split(';').length, 125);
  assert.equal(z[2].split(';').length, 125);
  assert.match(z[2], /^1234,50;"S";"EUR";;;;1200;8100;;0904;"RE-1";;;"Zuzahlung Beleg 1 ""x"" Grüße";/);
  assert.ok(buf.includes(Buffer.from([0xfc])), 'ü als 0xFC');
});

test('EXTF: Zeitraum über das Wirtschaftsjahr wird abgelehnt', () => {
  assert.throws(() => erzeugeExtfCsv([], { einstellungen: E, von: '2026-12-01', bis: '2027-01-31' }), e => e.status === 400);
});

test('Spaltenüberschriften = Zeile 2 der offiziellen DATEV-Musterdatei (falls lokal vorhanden)', (t) => {
  const hier = path.dirname(fileURLToPath(import.meta.url));
  const muster = path.join(hier, '..', '..', 'wissensbank', 'gemeinsam', 'datev-format', 'Musterdaten_EXTF_Buchungsstapel.csv');
  if (!fs.existsSync(muster)) { t.skip('Musterdatei nicht im Checkout (gitignored, wissensbank W-13)'); return; }
  const zeile2 = fs.readFileSync(muster, 'utf8').split(/\r?\n/)[1];
  assert.equal(EXTF_SPALTEN.join(';'), zeile2);
});
