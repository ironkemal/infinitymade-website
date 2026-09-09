import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalisiereKonten,
  kontenAusProfil,
  aktiveKonten,
  findeKonto,
  kontoAnzeige,
  istZahlungskategorie,
  STANDARD_KONTEN,
  KONTEN_MAX,
  KONTO_KATEGORIEN,
  ZAHLART_JE_KATEGORIE,
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
  assert.deepEqual(raus, [{ code: '1000', label: 'Kasse', aktiv: true, kategorie: 'sonstiges' }]);
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
  assert.deepEqual(raus, [{ code: '1200', label: 'Bank', aktiv: true, kategorie: 'sonstiges' }]);
});

test('normalisiereKonten: aktiv ist standardmaessig true, nur explizites false deaktiviert', () => {
  const raus = normalisiereKonten([
    { code: '1', label: 'Ohne Angabe' },
    { code: '2', label: 'Deaktiviert', aktiv: false },
    { code: '3', label: 'Aktiv', aktiv: true },
  ]);
  assert.deepEqual(raus.map(k => k.aktiv), [true, false, true]);
});

test('normalisiereKonten: kategorie unbekannt/fehlend faellt auf sonstiges zurueck (Ops #271)', () => {
  const raus = normalisiereKonten([
    { code: '1', label: 'Ohne Angabe' },
    { code: '2', label: 'Kaputter Wert', kategorie: 'bitcoin' },
    { code: '3', label: 'Karte', kategorie: 'karte' },
  ]);
  assert.deepEqual(raus.map(k => k.kategorie), ['sonstiges', 'sonstiges', 'karte']);
});

test('istZahlungskategorie: trennt Zahlungskonten von reinen Ausbuchungskonten', () => {
  assert.equal(istZahlungskategorie('bar'), true);
  assert.equal(istZahlungskategorie('karte'), true);
  assert.equal(istZahlungskategorie('ueberweisung'), true);
  assert.equal(istZahlungskategorie('paypal'), true);
  assert.equal(istZahlungskategorie('sonstiges'), false);
  assert.equal(istZahlungskategorie(undefined), false);
});

test('ZAHLART_JE_KATEGORIE: karte mappt auf das historische ec, Rest 1:1', () => {
  assert.equal(ZAHLART_JE_KATEGORIE.karte, 'ec');
  assert.equal(ZAHLART_JE_KATEGORIE.bar, 'bar');
  assert.equal(ZAHLART_JE_KATEGORIE.ueberweisung, 'ueberweisung');
  assert.equal(ZAHLART_JE_KATEGORIE.paypal, 'paypal');
  assert.equal(ZAHLART_JE_KATEGORIE.sonstiges, 'sonstiges');
});

test('STANDARD_KONTEN: Karte und PayPal sind Teil des Standardrahmens (Ops #271/#273)', () => {
  const karte = STANDARD_KONTEN.find(k => k.code === '1220');
  const paypal = STANDARD_KONTEN.find(k => k.code === '1250');
  assert.equal(karte.kategorie, 'karte');
  assert.equal(paypal.kategorie, 'paypal');
  assert.ok(KONTO_KATEGORIEN.includes(karte.kategorie));
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
  assert.deepEqual(eigene, [{ code: '1600', label: 'Sparkasse', aktiv: true, kategorie: 'sonstiges' }]);
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
