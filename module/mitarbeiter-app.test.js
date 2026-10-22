// App für Mitarbeiter (22.10.2026, onprem O-214): QR-Inhalt, Plattformweiche, Druckblatt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg } from './qr-svg.js';
import { plattform, praxisNameAus } from './app-installieren.js';
import { appAdresse, druckblattHtml } from './mitarbeiter-app-einstellungen.js';
import { QRCodeReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource } from '@zxing/library';

function decode(text) {
  const m = qrMatrix(text);
  const skala = 4, rand = 4, n = (m.length + 2 * rand) * skala;
  const lum = new Uint8ClampedArray(n * n).fill(255);
  m.forEach((zeile, y) => zeile.forEach((an, x) => {
    if (!an) return;
    for (let dy = 0; dy < skala; dy++) for (let dx = 0; dx < skala; dx++)
      lum[((y + rand) * skala + dy) * n + (x + rand) * skala + dx] = 0;
  }));
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, n, n)));
  return new QRCodeReader().decode(bitmap).getText();
}

test('QR liest sich zurück als genau die App-Adresse', () => {
  const url = appAdresse('https://kohl-paket-52.box.praxura.de');
  assert.equal(url, 'https://kohl-paket-52.box.praxura.de/app.html');
  assert.equal(decode(url), url);
});

test('appAdresse: kein doppelter Schrägstrich', () => {
  assert.equal(appAdresse('https://praxis.example/'), 'https://praxis.example/app.html');
});

test('qrSvg: weißer Grund, Titel escaped', () => {
  const svg = qrSvg('https://x.example/app.html', { titel: 'A<b>' });
  assert.match(svg, /^<svg /);
  assert.match(svg, /fill="#fff"/);
  assert.ok(!svg.includes('<b>'));
});

test('plattform: iPhone, iPad (als Mac), Android, PC, installiert', () => {
  assert.equal(plattform({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }), 'ios');
  assert.equal(plattform({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchPunkte: 5 }), 'ios');
  assert.equal(plattform({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchPunkte: 0 }), 'andere');
  assert.equal(plattform({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }), 'android');
  assert.equal(plattform({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), 'andere');
  assert.equal(plattform({ ua: 'Android', standalone: true }), 'installiert');
});

test('praxisNameAus: Manifest-Name oder „Praxura"', () => {
  assert.equal(praxisNameAus({ name: ' Podologie Test ' }), 'Podologie Test');
  assert.equal(praxisNameAus({}), 'Praxura');
  assert.equal(praxisNameAus(null), 'Praxura');
});

test('Druckblatt: Praxisname escaped, QR und Adresse drin, kein Code/Jeton', () => {
  const html = druckblattHtml({ praxisName: 'Fuß & <Co>', adresse: 'https://b.example/app.html', svg: '<svg></svg>' });
  assert.match(html, /Fuß &amp; &lt;Co&gt;/);
  assert.match(html, /https:\/\/b\.example\/app\.html/);
  assert.match(html, /<svg><\/svg>/);
  assert.ok(!/jeton|einrichtungscode/i.test(html));
});
