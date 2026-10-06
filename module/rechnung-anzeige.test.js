import test from 'node:test';
import assert from 'node:assert/strict';
import { rechnungsTitel, istNichtKasse, PRIVAT_ANZEIGE } from './rechnung-anzeige.js';

test('Klartext für 78010/78020, nie „Komplexbehandlung“', () => {
  assert.match(rechnungsTitel('78020', null, 'Podologische Behandlung (groß)'), /Hornhaut und Nägel\), Therapiezeit über 20 Minuten/);
  assert.match(rechnungsTitel('78010', null, 'x'), /Therapiezeit bis 20 Minuten/);
  for (const t of Object.values(PRIVAT_ANZEIGE)) assert.doesNotMatch(t, /Komplex|groß|klein/);
});

test('bewusst benannte eigene Leistung gewinnt; unveränderter Katalogtitel nicht', () => {
  assert.equal(rechnungsTitel('78020', 'Meine große Behandlung', 'k'), 'Meine große Behandlung');
  assert.match(rechnungsTitel('78020', 'Podologische Behandlung (groß)', 'k'), /Hornhaut/);
  assert.match(rechnungsTitel('78020', ' Podologische Behandlung (groß) ', 'k'), /Hornhaut/);
});

test('andere Kodes: eigene Leistung, sonst Katalogtitel, sonst der Kode', () => {
  assert.equal(rechnungsTitel('78030', 'Befund-Eigen', 'Podologische Befundung'), 'Befund-Eigen');
  assert.equal(rechnungsTitel('78030', null, 'Podologische Befundung'), 'Podologische Befundung');
  assert.equal(rechnungsTitel('99999', null, null), '99999');
});

test('istNichtKasse: privat/selbstzahler/bg ja, Kasse/NULL/gkv nein', () => {
  for (const a of ['privat', 'Selbstzahler', ' BG ']) assert.equal(istNichtKasse(a), true, a);
  for (const a of [null, undefined, '', 'kassen', 'gkv']) assert.equal(istNichtKasse(a), false, String(a));
});
