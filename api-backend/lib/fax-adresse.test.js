import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAX_MUSTER_RE,
  pruefeFaxMuster,
  faxNummerNormalisieren,
  baueFaxAdresse,
} from './fax-adresse.js';

test('pruefeFaxMuster: gültige Muster werden akzeptiert', () => {
  const g1 = pruefeFaxMuster('{nummer}@fax.provider.de');
  assert.equal(g1.ok, true);
  assert.equal(g1.muster, '{nummer}@fax.provider.de');

  const g2 = pruefeFaxMuster('fax-{nummer}@mail2fax.com');
  assert.equal(g2.ok, true);
  assert.equal(g2.muster, 'fax-{nummer}@mail2fax.com');

  const g3 = pruefeFaxMuster('0049{nummer}@fax.service.net');
  assert.equal(g3.ok, true);
  assert.equal(g3.muster, '0049{nummer}@fax.service.net');

  // Whitespace am Rand wird getrimmt
  const g4 = pruefeFaxMuster('  {nummer}@fax.provider.de  ');
  assert.equal(g4.ok, true);
  assert.equal(g4.muster, '{nummer}@fax.provider.de');
});

test('pruefeFaxMuster: Injektionen und ungültige Muster werden abgewiesen', () => {
  // Muster mit zwei {nummer}
  const mZwei = pruefeFaxMuster('{nummer}.{nummer}@fax.de');
  assert.equal(mZwei.ok, false);
  assert.match(mZwei.fehler, /genau einmal/);

  // Zweiter Empfänger
  const mZweiEmpf = pruefeFaxMuster('{nummer}@fax.de, zweiter@empfaenger.de');
  assert.equal(mZweiEmpf.ok, false);

  // Komma im Muster
  const mKomma = pruefeFaxMuster('{nummer},test@fax.de');
  assert.equal(mKomma.ok, false);

  // Semikolon im Muster
  const mSemi = pruefeFaxMuster('{nummer};test@fax.de');
  assert.equal(mSemi.ok, false);

  // Zeilenumbruch (CR/LF)
  const mCRLF = pruefeFaxMuster('{nummer}@fax.de\r\nBcc: evil@test.de');
  assert.equal(mCRLF.ok, false);

  // Fehlende Domain / ungültige Domain
  assert.equal(pruefeFaxMuster('{nummer}@').ok, false);
  assert.equal(pruefeFaxMuster('{nummer}@keinedomain').ok, false);
  assert.equal(pruefeFaxMuster('{nummer}@.de').ok, false);
  assert.equal(pruefeFaxMuster('{nummer}@fax.d').ok, false);

  // Fehlendes {nummer}
  const mOhne = pruefeFaxMuster('info@fax.provider.de');
  assert.equal(mOhne.ok, false);
  assert.match(mOhne.fehler, /Platzhalter \{nummer\}/);

  // Leer / Whitespace
  assert.equal(pruefeFaxMuster('').ok, false);
  assert.equal(pruefeFaxMuster('   ').ok, false);
  assert.equal(pruefeFaxMuster(null).ok, false);
  assert.equal(pruefeFaxMuster(undefined).ok, false);

  // Über 200 Zeichen
  const lang = '{nummer}@' + 'a'.repeat(195) + '.de';
  assert.ok(lang.length > 200);
  const mLang = pruefeFaxMuster(lang);
  assert.equal(mLang.ok, false);
  assert.match(mLang.fehler, /maximal 200/);

  // Verbotene Zeichen < > { }
  assert.equal(pruefeFaxMuster('<{nummer}>@fax.de').ok, false);
  assert.equal(pruefeFaxMuster('{nummer}{extra}@fax.de').ok, false);
});

test('faxNummerNormalisieren: + wird 00, Nicht-Ziffern entfernt, Länge 6-20', () => {
  assert.equal(faxNummerNormalisieren('+49 221 123456'), '0049221123456');
  assert.equal(faxNummerNormalisieren('0221 / 123 456-78'), '022112345678');
  assert.equal(faxNummerNormalisieren('(0221) 123456'), '0221123456');
  assert.equal(faxNummerNormalisieren('123456'), '123456'); // Min 6
  assert.equal(faxNummerNormalisieren('12345678901234567890'), '12345678901234567890'); // Max 20

  // Zu kurz (< 6)
  assert.equal(faxNummerNormalisieren('12345'), null);
  assert.equal(faxNummerNormalisieren(''), null);
  assert.equal(faxNummerNormalisieren(null), null);
  assert.equal(faxNummerNormalisieren('abc'), null);

  // Zu lang (> 20)
  assert.equal(faxNummerNormalisieren('123456789012345678901'), null);

  // Injektion in Nummer: Nicht-Ziffern werden komplett entfernt
  assert.equal(faxNummerNormalisieren('0221 123\r\nBcc: x@y.de'), '0221123');
});

test('baueFaxAdresse: erfolgreicher Zusammenbau und Injektionsabwehr', () => {
  const muster = '{nummer}@fax.provider.de';

  // Gültig
  assert.equal(baueFaxAdresse(muster, '0221 123456'), '0221123456@fax.provider.de');
  assert.equal(baueFaxAdresse(muster, '+49 221 123456'), '0049221123456@fax.provider.de');

  // Injektion in Nummer: CR/LF/Header werden gefiltert, Ziffern bleiben sicher
  assert.equal(baueFaxAdresse(muster, '0221 123\r\nBcc: x@y.de'), '0221123@fax.provider.de');

  // Nummer ohne ausreichende Ziffern bei Injektionsversuch
  assert.equal(baueFaxAdresse(muster, '\r\nBcc: x@y.de'), null);

  // Injektionen im Muster schlagen fehl
  assert.equal(baueFaxAdresse('{nummer}.{nummer}@fax.de', '0221 123456'), null);
  assert.equal(baueFaxAdresse('{nummer}@fax.de, test@test.de', '0221 123456'), null);
  assert.equal(baueFaxAdresse('{nummer},extra@fax.de', '0221 123456'), null);
  assert.equal(baueFaxAdresse('{nummer}@fax.de\r\nBcc: evil@test.de', '0221 123456'), null);
  assert.equal(baueFaxAdresse('{nummer}@keinedomain', '0221 123456'), null);
  assert.equal(baueFaxAdresse('ohne-platzhalter@fax.de', '0221 123456'), null);
});
