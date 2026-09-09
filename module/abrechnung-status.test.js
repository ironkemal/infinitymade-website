/**
 * Tests für module/abrechnung-status.js.
 *
 * Der Kern ist `aggregierterDateiStatus()`: sie entscheidet, ob eine Datei
 * als „Abgesetzt" (rot) oder „Teilweise abgesetzt" (orange) erscheint —
 * genau die Unterscheidung, die der Auftrag ("10 hasta yollandı, 1'i
 * reddoldu, 9'unun parası geldi") verlangt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATEI_STATUS, dateiStatusInfo, aggregierterDateiStatus, dateiStatusBadge } from './abrechnung-status.js';

test('DATEI_STATUS deckt alle rohen abrechnung.status-Werte aus dem Schema ab', () => {
  // db/SCHEMA.sql: CHECK status IN (erstellt, heruntergeladen, gesendet, accepted, rejected, paid)
  const rohwerte = ['erstellt', 'heruntergeladen', 'gesendet', 'accepted', 'rejected', 'paid'];
  const keys = DATEI_STATUS.map(s => s.key);
  for (const w of rohwerte) assert.ok(keys.includes(w), `${w} fehlt in DATEI_STATUS`);
});

test('aggregierterDateiStatus: rejected mit rejected_count < prescription_count wird teilweise', () => {
  assert.equal(
    aggregierterDateiStatus({ status: 'rejected', rejected_count: 1, prescription_count: 10 }),
    'teilweise_abgesetzt',
  );
});

test('aggregierterDateiStatus: rejected_count === prescription_count bleibt vollständig abgesetzt', () => {
  assert.equal(
    aggregierterDateiStatus({ status: 'rejected', rejected_count: 10, prescription_count: 10 }),
    'rejected',
  );
});

test('aggregierterDateiStatus: rejected ohne verwertbare Zähler bleibt vollständig abgesetzt', () => {
  // Fehlende/0-Zähler dürfen NICHT als "teilweise" gedeutet werden — sonst
  // verschwindet eine echte Vollabsetzung in der harmloseren orangen Zeile.
  assert.equal(aggregierterDateiStatus({ status: 'rejected' }), 'rejected');
  assert.equal(aggregierterDateiStatus({ status: 'rejected', rejected_count: 0, prescription_count: 0 }), 'rejected');
});

test('aggregierterDateiStatus: andere Status werden unverändert durchgereicht', () => {
  for (const s of ['erstellt', 'heruntergeladen', 'gesendet', 'accepted', 'paid']) {
    assert.equal(aggregierterDateiStatus({ status: s, rejected_count: 3, prescription_count: 10 }), s);
  }
});

test('aggregierterDateiStatus: keine Zeile ergibt "erstellt" als sicheren Anfangszustand', () => {
  assert.equal(aggregierterDateiStatus(null), 'erstellt');
  assert.equal(aggregierterDateiStatus(undefined), 'erstellt');
});

test('dateiStatusInfo: unbekannter Wert wird sichtbar er selbst, nicht auf einen falschen Status geschönt', () => {
  const info = dateiStatusInfo('irgendwas_neues');
  assert.equal(info.key, 'irgendwas_neues');
  assert.equal(info.label, 'irgendwas_neues');
});

test('dateiStatusBadge: kurz-Modus zeigt die kurze Beschriftung', () => {
  const lang = dateiStatusBadge('teilweise_abgesetzt');
  const kurz = dateiStatusBadge('teilweise_abgesetzt', { kurz: true });
  assert.match(lang, /Teilweise abgesetzt/);
  assert.match(kurz, />Teilweise</);
});

test('dateiStatusBadge: escaped HTML im Hilfe-Text (keine XSS-Lücke über einen künftigen dynamischen Grund)', () => {
  const html = dateiStatusBadge('rejected');
  assert.doesNotMatch(html, /<script/);
});

test('Absetzung und Teilabsetzung tragen dieselben Farben wie auf der Verordnungsachse (abrechnungsstatus.js)', () => {
  // App-weite Konsistenz: dieselbe Bedeutung, dieselbe Farbe auf beiden Bildschirmen.
  const rejected = DATEI_STATUS.find(s => s.key === 'rejected');
  const teilweise = DATEI_STATUS.find(s => s.key === 'teilweise_abgesetzt');
  assert.equal(rejected.farbe, '#be185d');   // abrechnungsstatus.js: 'abgesetzt'
  assert.equal(teilweise.farbe, '#ea580c');  // abrechnungsstatus.js: 'teilabsetzung'
});
