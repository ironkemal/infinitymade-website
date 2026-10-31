// formular-pdf.js — Signaturfelder in Formular-PDFs einbetten (K6 Teil A).
//
// Pure Logik für:
//   - Umrechnung Prozent (oben-links) in PDF-Punkte (unten-links) mit Bereichsprüfung
//   - Validierung von Signatur-PNGs (Magic-Bytes, IHDR-Header, Dimensionen, max 400 KB)
//   - Einbetten von PNG-Signaturen mit pdf-lib unter Erhalt des Seitenverhältnisses und MediaBox-Offset
//   - Fußzeile auf der letzten Seite („Elektronisch unterschrieben am...")

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const MAX_PNG_BYTES = 400 * 1024; // 400 KB = 409.600 Bytes
export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PDF_SEITEN = 100;
export const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Prüft, ob ein Puffer oder Base64-String ein gültiges PNG ist.
 * Kriterien:
 *   - dekodiert <= 400 KB, Länge >= 33 Bytes
 *   - beginnt mit PNG-Magic-Bytes 89 50 4E 47 0D 0A 1A 0A
 *   - Chunk-Typ 'IHDR' an Bytes 12..15
 *   - Breite und Höhe je 1..4096 (readUInt32BE an 16 und 20)
 *   - Gesamtpixel (Breite * Höhe) <= 4.000.000
 *
 * @param {Buffer|Uint8Array|string} eingabe
 * @returns {{ ok: true, buffer: Buffer, groesse_bytes: number } | { ok: false, fehler: string }}
 */
export function pruefePng(eingabe) {
  if (!eingabe) {
    return { ok: false, fehler: 'Keine Signaturdaten übergeben.' };
  }

  let buf;
  if (typeof eingabe === 'string') {
    const bereinigt = eingabe.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '').trim();
    if (!bereinigt || !/^[A-Za-z0-9+/=]+$/.test(bereinigt)) {
      return { ok: false, fehler: 'Signatur ist kein gültiges Base64.' };
    }
    try {
      buf = Buffer.from(bereinigt, 'base64');
    } catch {
      return { ok: false, fehler: 'Signatur konnte nicht dekodiert werden.' };
    }
  } else if (Buffer.isBuffer(eingabe)) {
    buf = eingabe;
  } else if (eingabe instanceof Uint8Array) {
    buf = Buffer.from(eingabe.buffer, eingabe.byteOffset, eingabe.byteLength);
  } else {
    return { ok: false, fehler: 'Ungültiger Datentyp für Signatur-Bild.' };
  }

  if (buf.length < 33) {
    return { ok: false, fehler: 'Signatur-Datei ist zu kurz für ein gültiges PNG (mindestens 33 Bytes erforderlich).' };
  }

  if (buf.length > MAX_PNG_BYTES) {
    return { ok: false, fehler: 'Signatur-PNG ist zu groß (maximal 400 KB erlaubt).' };
  }

  for (let i = 0; i < PNG_MAGIC_BYTES.length; i++) {
    if (buf[i] !== PNG_MAGIC_BYTES[i]) {
      return { ok: false, fehler: 'Ungültiges Dateiformat: Signatur muss ein PNG sein.' };
    }
  }

  // Chunk-Typ 'IHDR' an Bytes 12..15
  const chunkType = buf.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') {
    return { ok: false, fehler: 'Ungültiges PNG: IHDR-Header fehlt.' };
  }

  // Breite und Höhe aus IHDR-Chunk (readUInt32BE 16 und 20)
  const breite = buf.readUInt32BE(16);
  const hoehe = buf.readUInt32BE(20);

  if (breite < 1 || breite > 4096 || hoehe < 1 || hoehe > 4096) {
    return { ok: false, fehler: 'Ungültige Bildabmessungen: Breite und Höhe müssen zwischen 1 und 4096 Pixel liegen.' };
  }

  if (breite * hoehe > 4_000_000) {
    return { ok: false, fehler: 'Bildauflösung zu hoch (maximal 4.000.000 Pixel erlaubt).' };
  }

  return { ok: true, buffer: buf, groesse_bytes: buf.length };
}

/**
 * Rechnet ein Signaturfeld von Prozent (Ursprung oben-links) in PDF-Punkte (Ursprung unten-links) um.
 * Grenzen: x,y >= 0, w,h > 0, x+w <= 100.01, y+h <= 100.01 sonst Fehler.
 *
 * @param {{ seite?: number, x: number, y: number, w: number, h: number }} feld
 * @param {number} seitenBreite - Breite der PDF-Seite in Punkten
 * @param {number} seitenHoehe - Höhe der PDF-Seite in Punkten
 * @returns {{ x: number, y: number, w: number, h: number, width: number, height: number }}
 */
export function prozentZuPunkte(feld, seitenBreite, seitenHoehe) {
  if (!feld || typeof feld !== 'object') {
    throw new Error('Ungültiges Signaturfeld übergeben.');
  }

  const x = Number(feld.x);
  const y = Number(feld.y);
  const w = Number(feld.w);
  const h = Number(feld.h);

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    throw new Error('Signaturfeld-Koordinaten müssen numerisch sein.');
  }

  if (x < 0 || y < 0 || w <= 0 || h <= 0 || (x + w) > 100.01 || (y + h) > 100.01) {
    throw new Error('Signaturfeld liegt außerhalb der zulässigen Grenzen (x,y >= 0, w,h > 0, x+w <= 100.01, y+h <= 100.01).');
  }

  const boxW = (w / 100) * seitenBreite;
  const boxH = (h / 100) * seitenHoehe;
  const boxX = (x / 100) * seitenBreite;
  // Ursprung oben links in PDF-Punkte unten links:
  // Von oben gemessen: y_von_oben = (y / 100) * seitenHoehe
  // Unten im PDF-Koordinatensystem: seitenHoehe - y_von_oben - boxH = seitenHoehe - ((y + h) / 100) * seitenHoehe
  const boxY = seitenHoehe - ((y + h) / 100) * seitenHoehe;

  return {
    x: boxX,
    y: boxY,
    w: boxW,
    h: boxH,
    width: boxW,
    height: boxH,
  };
}

/**
 * Formatiert ein Datum für die Fußzeile auf Berliner Zeit: <TT.MM.JJJJ HH:MM>.
 *
 * @param {Date} [datum]
 * @returns {string}
 */
export function formatiereSignaturZeit(datum = new Date()) {
  const d = datum instanceof Date && !Number.isNaN(datum.getTime()) ? datum : new Date();
  const teile = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type) => teile.find((p) => p.type === type)?.value || '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

/**
 * Bereinigt einen Titel für Dateinamen (Umlaute ersetzen, nur sichere Zeichen).
 *
 * @param {string} titel
 * @returns {string}
 */
export function saubererName(titel) {
  if (!titel || typeof titel !== 'string') return 'formular';
  let s = titel.trim()
    .replace(/ä/g, 'ae').replace(/Ä/g, 'ae')
    .replace(/ö/g, 'oe').replace(/Ö/g, 'oe')
    .replace(/ü/g, 'ue').replace(/Ü/g, 'ue')
    .replace(/ß/g, 'ss');
  s = s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return s.toLowerCase() || 'formular';
}

/**
 * Bettet Signaturen in ein bestehendes PDF ein.
 *
 * Ablauf:
 *  - Prüft PDF-Größe (<= 10 MB) vor dem Laden
 *  - Lädt PDF und prüft Seitenzahl (1 <= Seiten <= 100)
 *  - Prüft Seitennummern der Felder (1-basiert, ganzzahlig, innerhalb des Dokuments)
 *  - Bettet jedes PNG ein und passt es zentriert unter Beibehaltung des Seitenverhältnisses ein
 *  - Berücksichtigt MediaBox-Ursprung (x, y)
 *  - Verändert auf jeder Seite nichts außer den Signaturen
 *  - Fügt auf der letzten Seite eine kleine Fußzeile hinzu, sofern Platz vorhanden ist
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @param {Array<{ seite: number, x: number, y: number, w: number, h: number }>} felder
 * @param {Array<Buffer|Uint8Array|string|{ buffer?: Buffer }>} pngs
 * @param {{ zeitpunkt?: Date }} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function bettePdfSignaturen(pdfBytes, felder, pngs, options = {}) {
  if (!pdfBytes || (pdfBytes.length ?? 0) === 0) {
    throw new Error('PDF-Daten fehlen.');
  }

  if (pdfBytes.length > MAX_PDF_BYTES) {
    throw new Error('PDF-Datei ist zu groß (maximal 10 MB erlaubt).');
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  if (pageCount === 0) {
    throw new Error('Das PDF-Dokument enthält keine Seiten.');
  }

  if (pageCount > MAX_PDF_SEITEN) {
    throw new Error('PDF-Dokument hat mehr als 100 Seiten.');
  }

  // Vorab: Alle Felder auf gültige Seitennummern prüfen
  for (let i = 0; i < felder.length; i++) {
    const f = felder[i];
    const seite = Number(f.seite);
    if (!Number.isInteger(seite) || seite < 1 || seite > pageCount) {
      throw new Error(`Ungültige Seitennummer: ${f.seite}`);
    }
  }

  // Signaturen zeichnen
  for (let i = 0; i < felder.length; i++) {
    const f = felder[i];
    const seite = Number(f.seite);
    const pageIndex = seite - 1;
    const page = pdfDoc.getPage(pageIndex);

    // MediaBox berücksichtigen
    const mediaBox = page.getMediaBox ? page.getMediaBox() : null;
    const mediaX = mediaBox ? mediaBox.x : 0;
    const mediaY = mediaBox ? mediaBox.y : 0;
    const seitenBreite = mediaBox ? mediaBox.width : page.getWidth();
    const seitenHoehe = mediaBox ? mediaBox.height : page.getHeight();

    const box = prozentZuPunkte(f, seitenBreite, seitenHoehe);

    let rawPng = pngs[i];
    if (rawPng && typeof rawPng === 'object' && 'buffer' in rawPng && !Buffer.isBuffer(rawPng) && !(rawPng instanceof Uint8Array)) {
      rawPng = rawPng.buffer;
    }
    const check = pruefePng(rawPng);
    if (!check.ok) {
      throw new Error(`Signatur ${i}: ${check.fehler}`);
    }

    const pngImage = await pdfDoc.embedPng(check.buffer);
    const imgW = pngImage.width;
    const imgH = pngImage.height;

    // In das Feld einpassen: Seitenverhältnis erhalten, zentriert im Feld
    const scale = Math.min(box.w / imgW, box.h / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    const offsetX = (box.w - drawW) / 2;
    const offsetY = (box.h - drawH) / 2;

    const drawX = mediaX + box.x + offsetX;
    const drawY = mediaY + box.y + offsetY;

    page.drawImage(pngImage, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    });
  }

  // Kleine Fußzeile auf der letzten Seite:
  // „Elektronisch unterschrieben am <TT.MM.JJJJ HH:MM> – Inhalt verantwortet die Praxis"
  // (Helvetica via StandardFonts, 7pt, grau, unterer Rand, nur wenn Platz)
  const lastPage = pdfDoc.getPage(pageCount - 1);
  const lastMediaBox = lastPage.getMediaBox ? lastPage.getMediaBox() : null;
  const lastMediaX = lastMediaBox ? lastMediaBox.x : 0;
  const lastMediaY = lastMediaBox ? lastMediaBox.y : 0;
  const pWidth = lastMediaBox ? lastMediaBox.width : lastPage.getWidth();
  const pHeight = lastMediaBox ? lastMediaBox.height : lastPage.getHeight();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 7;
  const zeit = options.zeitpunkt instanceof Date ? options.zeitpunkt : new Date();
  const zeitStr = formatiereSignaturZeit(zeit);
  const fusszeile = `Elektronisch unterschrieben am ${zeitStr} – Inhalt verantwortet die Praxis`;

  const textWidth = helvetica.widthOfTextAtSize(fusszeile, fontSize);
  const textHeight = helvetica.heightAtSize(fontSize);
  const marginY = 15;

  // Prüfen, ob Platz am unteren Rand vorhanden ist (Höhe ausreichend und keine Signatur kollidiert)
  let hatPlatz = pHeight >= 40 && pWidth >= textWidth + 20;
  if (hatPlatz) {
    const textX = (pWidth - textWidth) / 2;
    for (const f of felder) {
      if (Number(f.seite) === pageCount) {
        const b = prozentZuPunkte(f, pWidth, pHeight);
        const overlapX = b.x < textX + textWidth && b.x + b.w > textX;
        const overlapY = b.y < marginY + textHeight && b.y + b.h > marginY;
        if (overlapX && overlapY) {
          hatPlatz = false;
          break;
        }
      }
    }

    if (hatPlatz) {
      try {
        lastPage.drawText(fusszeile, {
          x: lastMediaX + textX,
          y: lastMediaY + marginY,
          size: fontSize,
          font: helvetica,
          color: rgb(0.45, 0.45, 0.45),
        });
      } catch {
        // Rückfall bei Zeichenkodierungsproblemen mit dem Gedankenstrich
        lastPage.drawText(fusszeile.replace(/–/g, '-'), {
          x: lastMediaX + textX,
          y: lastMediaY + marginY,
          size: fontSize,
          font: helvetica,
          color: rgb(0.45, 0.45, 0.45),
        });
      }
    }
  }

  return await pdfDoc.save();
}
