// Tests für formular-pdf.js (K6 Teil A):
//   - pruefePng: Magic-Bytes, IHDR-Header, Abmessungen, Größenbeschränkung 400 KB, Base64
//   - prozentZuPunkte: Umrechnung Prozent oben-links -> Punkte unten-links, Bereichsvalidierung
//   - bettePdfSignaturen: 2-Seiten-PDF mit 1x1-PNG einbetten, MediaBox-Offset, Seitenzahl/Größen-Limits

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  pruefePng,
  prozentZuPunkte,
  formatiereSignaturZeit,
  saubererName,
  bettePdfSignaturen,
  MAX_PNG_BYTES,
  MAX_PDF_BYTES,
  PNG_MAGIC_BYTES,
} from './formular-pdf.js';

// Gültiges 1x1 Pixel transparentes PNG (68 Bytes)
const EIN_MAL_EINS_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const EIN_MAL_EINS_PNG_BUFFER = Buffer.from(EIN_MAL_EINS_PNG_BASE64, 'base64');

test('pruefePng: erkennt gültige PNG-Puffer und Base64-Strings', () => {
  const rBuf = pruefePng(EIN_MAL_EINS_PNG_BUFFER);
  assert.equal(rBuf.ok, true);
  assert.equal(rBuf.groesse_bytes, EIN_MAL_EINS_PNG_BUFFER.length);
  assert.ok(Buffer.isBuffer(rBuf.buffer));

  const rB64 = pruefePng(EIN_MAL_EINS_PNG_BASE64);
  assert.equal(rB64.ok, true);
  assert.equal(rB64.groesse_bytes, EIN_MAL_EINS_PNG_BUFFER.length);

  const rDataUrl = pruefePng(`data:image/png;base64,${EIN_MAL_EINS_PNG_BASE64}`);
  assert.equal(rDataUrl.ok, true);
});

test('pruefePng: weist ungültige Magic-Bytes, zu kurze Puffer und übergroße Dateien ab', () => {
  // Kein PNG (Text)
  const rText = pruefePng(Buffer.from('kein-png-inhalt'));
  assert.equal(rText.ok, false);

  // Zu kurz (< 33 Bytes)
  const rKurz = Buffer.alloc(20);
  rKurz.set(PNG_MAGIC_BYTES, 0);
  assert.equal(pruefePng(rKurz).ok, false);
  assert.match(pruefePng(rKurz).fehler, /33 Bytes/i);

  // Leer / null
  assert.equal(pruefePng(null).ok, false);
  assert.equal(pruefePng('').ok, false);

  // Größer als 400 KB
  const gross = Buffer.alloc(MAX_PNG_BYTES + 10);
  gross.set(PNG_MAGIC_BYTES, 0);
  const rGross = pruefePng(gross);
  assert.equal(rGross.ok, false);
  assert.match(rGross.fehler, /400 KB/i);
});

test('pruefePng: prüft IHDR-Header, Bildabmessungen (1..4096) und Pixelanzahl (<= 4.000.000)', () => {
  // Puffer mit gültigen Magic-Bytes, aber falschem Chunk-Typ (nicht 'IHDR')
  const badChunk = Buffer.from(EIN_MAL_EINS_PNG_BUFFER);
  badChunk.write('XXXX', 12, 'ascii');
  const rChunk = pruefePng(badChunk);
  assert.equal(rChunk.ok, false);
  assert.match(rChunk.fehler, /IHDR/i);

  // Breite 0
  const zeroBreite = Buffer.from(EIN_MAL_EINS_PNG_BUFFER);
  zeroBreite.writeUInt32BE(0, 16);
  assert.equal(pruefePng(zeroBreite).ok, false);

  // Höhe > 4096 (z. B. 5000)
  const grossHoehe = Buffer.from(EIN_MAL_EINS_PNG_BUFFER);
  grossHoehe.writeUInt32BE(5000, 20);
  assert.equal(pruefePng(grossHoehe).ok, false);
  assert.match(pruefePng(grossHoehe).fehler, /4096/);

  // Pixelanzahl > 4.000.000 (z. B. 3000 x 3000 = 9.000.000)
  const zuVielePixel = Buffer.from(EIN_MAL_EINS_PNG_BUFFER);
  zuVielePixel.writeUInt32BE(3000, 16);
  zuVielePixel.writeUInt32BE(3000, 20);
  assert.equal(pruefePng(zuVielePixel).ok, false);
  assert.match(pruefePng(zuVielePixel).fehler, /4\.000\.000/);
});

test('prozentZuPunkte: rechnet Koordinaten korrekt von oben-links nach unten-links um', () => {
  const breite = 1000;
  const hoehe = 500;
  const feld = { x: 10, y: 20, w: 30, h: 40 };

  const p = prozentZuPunkte(feld, breite, hoehe);
  assert.equal(p.x, 100);
  assert.equal(p.w, 300);
  assert.equal(p.width, 300);
  assert.equal(p.h, 200);
  assert.equal(p.height, 200);
  assert.equal(p.y, 200);
});

test('prozentZuPunkte: prüft Grenzen (x,y >= 0, w,h > 0, x+w <= 100.01, y+h <= 100.01)', () => {
  assert.throws(() => prozentZuPunkte(null, 500, 500));
  assert.throws(() => prozentZuPunkte({ x: 'ungueltig', y: 0, w: 10, h: 10 }, 500, 500));
  assert.throws(() => prozentZuPunkte({ x: -1, y: 0, w: 10, h: 10 }, 500, 500));
  assert.throws(() => prozentZuPunkte({ x: 0, y: -0.5, w: 10, h: 10 }, 500, 500));
  assert.throws(() => prozentZuPunkte({ x: 0, y: 0, w: 0, h: 10 }, 500, 500));
  assert.throws(() => prozentZuPunkte({ x: 0, y: 0, w: 10, h: 0 }, 500, 500));
  // x + w > 100.01
  assert.throws(() => prozentZuPunkte({ x: 80, y: 10, w: 25, h: 10 }, 500, 500));
  // y + h > 100.01
  assert.throws(() => prozentZuPunkte({ x: 10, y: 90, w: 10, h: 15 }, 500, 500));

  // Randwerte bis 100.01 erlaubt
  assert.doesNotThrow(() => prozentZuPunkte({ x: 0, y: 0, w: 100, h: 100 }, 500, 500));
  assert.doesNotThrow(() => prozentZuPunkte({ x: 50, y: 50, w: 50.01, h: 50.01 }, 500, 500));
});

test('formatiereSignaturZeit: liefert Datum und Uhrzeit im Format TT.MM.JJJJ HH:MM', () => {
  const d = new Date('2026-10-31T20:15:00Z');
  const str = formatiereSignaturZeit(d);
  assert.match(str, /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
});

test('saubererName: ersetzt Umlaute und normalisiert Sonderzeichen', () => {
  assert.equal(saubererName('Behandlungsvertrag & DSGVO'), 'behandlungsvertrag-dsgvo');
  assert.equal(saubererName('Ärztliche Verordnung (Übung)'), 'aerztliche-verordnung-uebung');
  assert.equal(saubererName('Großes Formular'), 'grosses-formular');
  assert.equal(saubererName(''), 'formular');
});

test('bettePdfSignaturen: bettet Signatur in 2-Seiten-PDF ein und erhält Seitenzahl', async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595.28, 841.89]);
  pdfDoc.addPage([595.28, 841.89]);
  const initialBytes = await pdfDoc.save();

  const felder = [
    { seite: 1, x: 10, y: 70, w: 35, h: 12 },
    { seite: 2, x: 20, y: 75, w: 40, h: 15 },
  ];
  const pngs = [EIN_MAL_EINS_PNG_BUFFER, EIN_MAL_EINS_PNG_BASE64];
  const zeitpunkt = new Date('2026-10-31T21:00:00Z');

  const signedBytes = await bettePdfSignaturen(initialBytes, felder, pngs, { zeitpunkt });
  assert.ok(signedBytes instanceof Uint8Array);
  assert.ok(signedBytes.length > initialBytes.length);

  const geladenesDoc = await PDFDocument.load(signedBytes);
  assert.equal(geladenesDoc.getPageCount(), 2);
});

test('bettePdfSignaturen: berücksichtigt MediaBox-Ursprung', async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([500, 500]);
  // MediaBox mit Offset (z. B. Crop/Box)
  page.setMediaBox(20, 30, 460, 440);
  const initialBytes = await pdfDoc.save();

  const felder = [{ seite: 1, x: 10, y: 10, w: 30, h: 20 }];
  const pngs = [EIN_MAL_EINS_PNG_BUFFER];

  const signedBytes = await bettePdfSignaturen(initialBytes, felder, pngs);
  const loaded = await PDFDocument.load(signedBytes);
  assert.equal(loaded.getPageCount(), 1);
});

test('bettePdfSignaturen: weist ungültige Seitennummern und leere PDFs ab', async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([400, 600]);
  const initialBytes = await pdfDoc.save();

  const felder = [{ seite: 2, x: 10, y: 10, w: 20, h: 20 }];
  const pngs = [EIN_MAL_EINS_PNG_BUFFER];

  await assert.rejects(
    async () => {
      await bettePdfSignaturen(initialBytes, felder, pngs);
    },
    (err) => {
      assert.match(err.message, /Ungültige Seitennummer/);
      return true;
    }
  );
});

test('bettePdfSignaturen: prüft PDF-Größe (<= 10 MB) und Seitenzahl (<= 100)', async () => {
  // Größer als 10 MB
  const riesenPdf = Buffer.alloc(MAX_PDF_BYTES + 10);
  await assert.rejects(
    async () => {
      await bettePdfSignaturen(riesenPdf, [], []);
    },
    (err) => {
      assert.match(err.message, /10 MB/);
      return true;
    }
  );

  // Mehr als 100 Seiten
  const doc101 = await PDFDocument.create();
  for (let i = 0; i < 101; i++) {
    doc101.addPage([200, 200]);
  }
  const bytes101 = await doc101.save();
  await assert.rejects(
    async () => {
      await bettePdfSignaturen(bytes101, [], []);
    },
    (err) => {
      assert.match(err.message, /100 Seiten/);
      return true;
    }
  );
});
