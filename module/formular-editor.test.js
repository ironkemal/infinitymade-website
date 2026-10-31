import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pixelZuProzent,
  prozentZuPixel,
  begrenzeFeld,
  quadratischH,
  pruefeFormularDatei,
  saubererName,
  MAX_FORMULAR_GROESSE,
} from './formular-editor.js';

test('pixelZuProzent: normiert Pixelwerte korrekt in Prozent der Seitenabmessungen', () => {
  const p = pixelZuProzent({ px: 100, py: 200, pw: 50, ph: 100 }, 1000, 2000);
  assert.equal(p.x, 10);
  assert.equal(p.y, 10);
  assert.equal(p.w, 5);
  assert.equal(p.h, 5);

  // Schutz vor Nulldivision
  assert.deepEqual(pixelZuProzent({ px: 10, py: 10, pw: 10, ph: 10 }, 0, 0), { x: 0, y: 0, w: 0, h: 0 });
});

test('prozentZuPixel: wandelt Prozentangaben in gerundete Pixelwerte um', () => {
  const pix = prozentZuPixel({ x: 10, y: 25, w: 20, h: 15 }, 800, 1200);
  assert.equal(pix.px, 80);
  assert.equal(pix.py, 300);
  assert.equal(pix.pw, 160);
  assert.equal(pix.ph, 180);
});

test('quadratischH: berechnet die Höhe in Prozent für ein in Pixeln quadratisches Feld', () => {
  // DIN A4: 800px Breite, 1000px Höhe
  // Bei 20% Breite (= 160px) muss die Höhe ebenfalls 160px betragen.
  // 160px von 1000px entspricht genau 16%
  const h1 = quadratischH(20, 800, 1000);
  assert.equal(h1, 16);

  // Quadratische Seite (500x500): Prozent Breite = Prozent Höhe
  assert.equal(quadratischH(30, 500, 500), 30);

  // Ungültige Maße liefern 0
  assert.equal(quadratischH(20, 0, 1000), 0);
  assert.equal(quadratischH(20, 800, 0), 0);
});

test('begrenzeFeld: klemmt Breite zwischen min und max', () => {
  // Unter min (Standard 6)
  const f1 = begrenzeFeld({ x: 10, y: 10, w: 2, h: 2 }, 6, 40);
  assert.equal(f1.w, 6);

  // Über max (Standard 40)
  const f2 = begrenzeFeld({ x: 10, y: 10, w: 55, h: 55 }, 6, 40);
  assert.equal(f2.w, 40);

  // Innerhalb der Grenzen
  const f3 = begrenzeFeld({ x: 10, y: 10, w: 25, h: 25 }, 6, 40);
  assert.equal(f3.w, 25);
});

test('begrenzeFeld: Querformat 1000x700, w=40 -> h=57.14, y so geklemmt dass y+h<=100', () => {
  // Querformat: 1000x700, w = 40% (400px).
  // Für quadratisches Feld in Pixeln: h = 400 / 700 = 57.143%
  const h = quadratischH(40, 1000, 700);
  assert.equal(Math.round(h * 100) / 100, 57.14);

  // begrenzeFeld darf h NICHT auf 40 deckeln!
  // Wenn y=50 ist, waere y+h = 107.14 > 100 -> y muss auf 100 - 57.143 = 42.857 geklemmt werden.
  const geklemmt = begrenzeFeld({ x: 10, y: 50, w: 40, h });
  assert.equal(geklemmt.w, 40);
  assert.equal(Math.round(geklemmt.h * 100) / 100, 57.14);
  assert.equal(Math.round(geklemmt.y * 100) / 100, 42.86);
  assert.ok(geklemmt.y + geklemmt.h <= 100.001);
});

test('begrenzeFeld: hält das Feld vollständig innerhalb der Seite (0..100)', () => {
  // Links/Oben über den Rand
  const f1 = begrenzeFeld({ x: -10, y: -5, w: 20, h: 20 });
  assert.equal(f1.x, 0);
  assert.equal(f1.y, 0);

  // Rechts über den Rand: x + w > 100
  const f2 = begrenzeFeld({ x: 85, y: 10, w: 20, h: 20 });
  assert.equal(f2.w, 20);
  assert.equal(f2.x, 80); // 100 - 20

  // Unten über den Rand: y + h > 100
  const f3 = begrenzeFeld({ x: 10, y: 95, w: 20, h: 15 });
  assert.equal(f3.h, 15);
  assert.equal(f3.y, 85); // 100 - 15
});

test('pruefeFormularDatei: akzeptiert gültige PDF-Dateien bis 10 MB', () => {
  assert.deepEqual(pruefeFormularDatei({ name: 'vertrag.pdf', size: 1024, type: 'application/pdf' }), { ok: true });
  assert.deepEqual(pruefeFormularDatei({ name: 'aufklaerung.PDF', size: MAX_FORMULAR_GROESSE, type: 'application/pdf' }), { ok: true });
});

test('pruefeFormularDatei: lehnt ungültige Typen, Größen und Namen ab', () => {
  // Zu groß
  const resGross = pruefeFormularDatei({ name: 'gross.pdf', size: MAX_FORMULAR_GROESSE + 1, type: 'application/pdf' });
  assert.equal(resGross.ok, false);
  assert.match(resGross.fehler, /zu gross/);

  // Leer
  const resLeer = pruefeFormularDatei({ name: 'leer.pdf', size: 0, type: 'application/pdf' });
  assert.equal(resLeer.ok, false);
  assert.match(resLeer.fehler, /leer/);

  // Falscher MIME
  const resMime = pruefeFormularDatei({ name: 'bild.png', size: 1000, type: 'image/png' });
  assert.equal(resMime.ok, false);
  assert.match(resMime.fehler, /Nur PDF/);

  // Falsche Endung
  const resEndung = pruefeFormularDatei({ name: 'datei.docx', size: 1000, type: 'application/pdf' });
  assert.equal(resEndung.ok, false);
  assert.match(resEndung.fehler, /Endung \.pdf/);

  // Fehlendes Objekt
  assert.equal(pruefeFormularDatei(null).ok, false);
  assert.equal(pruefeFormularDatei({}).ok, false);
});

test('saubererName: entfernt unsichere Sonderzeichen', () => {
  assert.equal(saubererName('mein formular (final) #1.pdf'), 'mein_formular__final___1.pdf');
  assert.equal(saubererName(''), 'formular.pdf');
  assert.equal(saubererName(null), 'formular.pdf');
});
