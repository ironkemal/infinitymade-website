import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalisiereKonten,
  kontenAusProfil,
  aktiveKonten,
  findeKonto,
  kontoAnzeige,
  STANDARD_KONTEN,
  KONTEN_MAX,
} from './buchungskonten.js';

test('normalisiereKonten: leere/kaputte Eingabe ergibt eine leere Liste', () => {
  assert.deepEqual(normalisiereKonten(null), []);
  assert.deepEqual(normalisiereKonten('1000'), []);
  assert.deepEqual(normalisiereKonten([null, 42, 'x']), []);
});

test('normalisiereKonten: Konto ohne Nummer oder ohne Bezeichnung fliegt raus', () => {
  const raus = normalisiereKonten([
    { code: '1000', label: 'Kasse' },
    { code: '', label: 'Ohne Nummer' },
    { code: '1200', label: '   ' },
  ]);
  assert.deepEqual(raus, [{ code: '1000', label: 'Kasse', aktiv: true }]);
});

test('normalisiereKonten: doppelte Nummern werden verworfen, der erste gewinnt', () => {
  const raus = normalisiereKonten([
    { code: '1200', label: 'Bank' },
    { code: '1200', label: 'Nochmal Bank' },
  ]);
  assert.equal(raus.length, 1);
  assert.equal(raus[0].label, 'Bank');
});

test('normalisiereKonten: Leerzeichen in der Nummer werden entfernt, nicht nur aussen', () => {
  const raus = normalisiereKonten([{ code: ' 12 00 ', label: '  Bank  ' }]);
  assert.deepEqual(raus, [{ code: '1200', label: 'Bank', aktiv: true }]);
});

test('normalisiereKonten: aktiv ist standardmaessig true, nur explizites false deaktiviert', () => {
  const raus = normalisiereKonten([
    { code: '1', label: 'Ohne Angabe' },
    { code: '2', label: 'Deaktiviert', aktiv: false },
    { code: '3', label: 'Aktiv', aktiv: true },
  ]);
  assert.deepEqual(raus.map(k => k.aktiv), [true, false, true]);
});

test('normalisiereKonten: mehr als KONTEN_MAX Konten werden abgeschnitten', () => {
  const viele = Array.from({ length: KONTEN_MAX + 5 }, (_, i) => ({ code: String(i), label: 'K' + i }));
  assert.equal(normalisiereKonten(viele).length, KONTEN_MAX);
});

test('kontenAusProfil: ohne gepflegte Konten gilt der Standardrahmen', () => {
  assert.deepEqual(kontenAusProfil(null), STANDARD_KONTEN.map(k => ({ ...k })));
  assert.deepEqual(kontenAusProfil({ buchungskonten: [] }), STANDARD_KONTEN.map(k => ({ ...k })));
  assert.deepEqual(kontenAusProfil({ buchungskonten: [{ code: '', label: '' }] }),
    STANDARD_KONTEN.map(k => ({ ...k })));
});

test('kontenAusProfil: gepflegte Konten verdraengen den Standardrahmen vollstaendig', () => {
  const eigene = kontenAusProfil({ buchungskonten: [{ code: '1600', label: 'Sparkasse' }] });
  assert.deepEqual(eigene, [{ code: '1600', label: 'Sparkasse', aktiv: true }]);
});

test('kontenAusProfil: der Standardrahmen wird kopiert, nicht durchgereicht', () => {
  const a = kontenAusProfil(null);
  a[0].label = 'Veraendert';
  assert.equal(STANDARD_KONTEN[0].label, 'Kasse');
});

test('aktiveKonten: liefert nur aktive Konten fuer das Auswahlfeld', () => {
  const profile = { buchungskonten: [
    { code: '1000', label: 'Kasse' },
    { code: '1210', label: 'Altes Konto', aktiv: false },
  ] };
  assert.deepEqual(aktiveKonten(profile).map(k => k.code), ['1000']);
});

test('findeKonto: findet auch deaktivierte Konten, damit alte Buchungen lesbar bleiben', () => {
  const profile = { buchungskonten: [{ code: '1210', label: 'Altes Konto', aktiv: false }] };
  assert.equal(findeKonto(profile, '1210').label, 'Altes Konto');
  assert.equal(findeKonto(profile, ' 1210 ').label, 'Altes Konto');
  assert.equal(findeKonto(profile, '9999'), null);
  assert.equal(findeKonto(profile, ''), null);
});

test('findeKonto: greift auch im Standardrahmen', () => {
  assert.equal(findeKonto(null, '8700').label, 'Erlösschmälerung');
});

test('kontoAnzeige: Nummer und Bezeichnung, ohne Nullwerte', () => {
  assert.equal(kontoAnzeige({ code: '1000', label: 'Kasse' }), '1000 Kasse');
  assert.equal(kontoAnzeige(null), '');
});
