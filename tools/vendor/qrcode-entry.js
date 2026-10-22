// QR-Erzeugung im Browser (22.10.2026, „App für Mitarbeiter"): derselbe gepinnte
// @zxing/library wie der PDF417-Leser (vendor/zxing.js) — keine neue Abhängigkeit,
// kein CDN. Tiefe esm-Pfade statt des Paket-Index: der Index zieht alle Leser mit
// (416 KB), so bleibt nur der QR-Schreiber.
export { default as QRCodeWriter } from '@zxing/library/esm/core/qrcode/QRCodeWriter.js';
export { default as BarcodeFormat } from '@zxing/library/esm/core/BarcodeFormat.js';
export { default as EncodeHintType } from '@zxing/library/esm/core/EncodeHintType.js';
export { default as QRCodeErrorCorrectionLevel } from '@zxing/library/esm/core/qrcode/decoder/ErrorCorrectionLevel.js';
