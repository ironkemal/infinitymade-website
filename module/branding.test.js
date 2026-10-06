import test from 'node:test';
import assert from 'node:assert/strict';
import { brandingAus, terminzettelPraxis, brandingLuecken, STEMPEL_PFAD_RE } from './branding.js';

const VOLL = {
  business_name: ' Praxis Nord ', praxis_inhaber: 'Erika Muster', street: 'Hauptstr.', house_number: '5',
  plz: '53721', city: 'Siegburg', phone: '02241 1', email: 'a@b.de', ik_number: '123456789',
  praxis_logo_url: 'https://x/logo.png', praxis_stempel_path: '11111111-1111-1111-1111-111111111111/stempel.png',
  iban: 'DE02 1234', bic: 'ABCDEFGH', bank_name: 'Bank', steuernummer: '1/2/3', ust_id: null,
  tax_exempt_note: '§ 4 Nr. 14 UStG', invoice_footer_text: 'Danke',
};

test('brandingAus: ein einheitliches Objekt, getrimmt, plz/zip-Drift aufgelöst', () => {
  const b = brandingAus(VOLL);
  assert.equal(b.name, 'Praxis Nord');
  assert.equal(b.strasse, 'Hauptstr. 5');
  assert.equal(b.plzOrt, '53721 Siegburg');
  assert.equal(b.bank.iban, 'DE02 1234');
  assert.equal(b.steuer.hinweis, '§ 4 Nr. 14 UStG');
  assert.equal(b.stempelPfad, '11111111-1111-1111-1111-111111111111/stempel.png');
  const z = brandingAus({ business_name: 'X', zip: '50667', city: 'Köln' });
  assert.equal(z.plzOrt, '50667 Köln', 'zip statt plz');
});

test('brandingAus: leeres/fehlendes Profil wirft nicht, alles leer', () => {
  for (const p of [null, undefined, {}]) {
    const b = brandingAus(p);
    assert.equal(b.name, '');
    assert.equal(b.logoUrl, '');
    assert.equal(b.stempelPfad, '');
    assert.equal(b.strasse, '');
  }
});

test('Stempelpfad: nur <uuid>/stempel.png|jpg wird übernommen, Fremdes nie (kein URL-Schmuggel)', () => {
  assert.ok(STEMPEL_PFAD_RE.test('11111111-1111-1111-1111-111111111111/stempel.jpg'));
  assert.equal(brandingAus({ praxis_stempel_path: 'https://evil/x.png' }).stempelPfad, '');
  assert.equal(brandingAus({ praxis_stempel_path: '../etc/stempel.png' }).stempelPfad, '');
});

test('Logo: nur https-URLs, kein javascript:/data:', () => {
  assert.equal(brandingAus({ praxis_logo_url: 'javascript:alert(1)' }).logoUrl, '');
  assert.equal(brandingAus({ praxis_logo_url: 'data:image/svg+xml,<svg/>' }).logoUrl, '');
  assert.equal(brandingAus({ praxis_logo_url: ' https://a/b.png ' }).logoUrl, 'https://a/b.png');
});

test('terminzettelPraxis liefert genau den bisherigen Vertrag', () => {
  assert.deepEqual(terminzettelPraxis(brandingAus(VOLL)).praxis, {
    name: 'Praxis Nord', strasse: 'Hauptstr. 5', ort: '53721 Siegburg', telefon: '02241 1',
    iban: 'DE02 1234', bic: 'ABCDEFGH', bank: 'Bank',
  });
});

test('terminzettelPraxis: Telefon fällt auf WhatsApp-Nummer zurück (Altverhalten)', () => {
  const b = brandingAus({ business_name: 'X', whatsapp_number: '0170' });
  assert.equal(terminzettelPraxis(b).praxis.telefon, '0170');
});

test('Lücken: volles Profil = nichts fehlt (Pflicht und Soll)', () => {
  const l = brandingLuecken(brandingAus(VOLL));
  assert.deepEqual(l.pflicht, []);
  assert.deepEqual(l.soll, []);
  assert.deepEqual(l.optional, []);
});

test('Lücken: leeres Profil — Pflicht nach legal-de F7, jeder Eintrag mit Ziel', () => {
  const l = brandingLuecken(brandingAus({}));
  assert.deepEqual(l.pflicht.map(x => x.schluessel), ['name', 'anschrift', 'inhaber', 'steuer_id', 'steuer_hinweis']);
  assert.deepEqual(l.soll.map(x => x.schluessel), ['bank', 'telefon', 'ik']);
  assert.deepEqual(l.optional.map(x => x.schluessel), ['logo', 'stempel', 'fusszeile']);
  assert.ok([...l.pflicht, ...l.soll, ...l.optional].every(x => x.label && x.ziel));
});

test('Lücken: Steuernummer ODER USt-IdNr. genügt; nur Leerzeichen zählt als leer', () => {
  const nurUst = brandingLuecken(brandingAus({ ...VOLL, steuernummer: '  ', ust_id: 'DE123' }));
  assert.ok(!nurUst.pflicht.some(x => x.schluessel === 'steuer_id'));
  const leer = brandingLuecken(brandingAus({ ...VOLL, steuernummer: '  ', ust_id: '' }));
  assert.ok(leer.pflicht.some(x => x.schluessel === 'steuer_id'));
  const halbeAnschrift = brandingLuecken(brandingAus({ ...VOLL, street: ' ' }));
  assert.ok(halbeAnschrift.pflicht.some(x => x.schluessel === 'anschrift'));
});
