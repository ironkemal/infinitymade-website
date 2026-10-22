// QR-Code als SVG (22.10.2026, „App für Mitarbeiter"). Erzeugt lokal über
// vendor/qrcode.js (gepinnter @zxing/library-Schreiber) — kein CDN, kein Netz.
// Ein Pfad statt n² Rechtecken: klein genug für Download und Druck.
import { QRCodeWriter, BarcodeFormat, EncodeHintType, QRCodeErrorCorrectionLevel } from '../vendor/qrcode.js';

/** Text → BitMatrix-Zeilen als boolean[][] (ohne Rand). */
export function qrMatrix(text) {
  const hints = new Map([
    [EncodeHintType.ERROR_CORRECTION, QRCodeErrorCorrectionLevel.M],
    [EncodeHintType.MARGIN, 0],
  ]);
  const bits = new QRCodeWriter().encode(String(text), BarcodeFormat.QR_CODE, 0, 0, hints);
  const n = bits.getWidth();
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => bits.get(x, y)));
}

/** Text → SVG-Quelltext. Ruhezone 4 Module (QR-Norm), schwarz auf weiß — auch im Dark Theme. */
export function qrSvg(text, { rand = 4, titel = '' } = {}) {
  const m = qrMatrix(text);
  const n = m.length + 2 * rand;
  let d = '';
  m.forEach((zeile, y) => zeile.forEach((an, x) => { if (an) d += `M${x + rand} ${y + rand}h1v1h-1z`; }));
  const t = titel ? `<title>${titel.replace(/[<&>"]/g, (c) => `&#${c.charCodeAt(0)};`)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img">${t}`
    + `<rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
