/** M3: decode locally. Only committed same-origin libraries are loaded.
 * Images/PDFs never leave this browser; unreadable input falls back to typing.
 */
import { parseMuster13Barcode } from './rezept-barcode.js?v=20261007m3';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 12_000_000;
// Testbox 23.11.2026: Musterbilder aus dem Internet und handschriftliche Verordnungen haben KEINEN Barcode —
// nur vom Arztprogramm gedruckte Muster 13 tragen den 2D-Barcode (PDF417). Das muss die Meldung sagen.
const KEIN_BARCODE = 'Auf dem Bild wurde kein Muster-13-Barcode gefunden. Nur vom Arztprogramm gedruckte Verordnungen tragen diesen Barcode — handschriftliche Verordnungen und Musterbilder nicht. Ist er vorhanden, bitte schärfer und näher fotografieren; sonst von Hand erfassen.';
let libs;
let pdfLib;

export function decodeLatin15(bytes) {
  const ersetzt = { 164:'€',166:'Š',168:'š',180:'Ž',184:'ž',188:'Œ',189:'œ',190:'Ÿ' };
  let text = '';
  for (const byte of bytes) text += ersetzt[byte] || String.fromCharCode(byte);
  return text;
}

export function pruefeScanDatei(datei) {
  if (!datei || datei.size > MAX_BYTES || !/^(image\/(?:png|jpeg|webp|bmp|gif)|application\/pdf)$/.test(datei.type)) {
    throw new Error('Bitte ein Bild oder PDF bis 20 MB auswählen.');
  }
}

function scanBytes(dataUri) {
  if (typeof dataUri !== 'string' || dataUri.length > Math.ceil(MAX_BYTES * 4 / 3) + 100) {
    throw new Error('Bitte ein Bild oder PDF bis 20 MB auswählen.');
  }
  const match = /^data:(image\/(?:png|jpeg|webp|bmp|gif)|application\/pdf);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUri);
  if (!match || match[2].length % 4) throw new Error('Ungültige Bild- oder PDF-Datei.');
  let raw;
  try { raw = atob(match[2]); } catch { throw new Error('Ungültige Bild- oder PDF-Datei.'); }
  if (!raw.length || raw.length > MAX_BYTES) throw new Error('Bitte ein Bild oder PDF bis 20 MB auswählen.');
  return { mime:match[1], bytes:Uint8Array.from(raw, c=>c.charCodeAt(0)) };
}

async function zxing() {
  if (!libs) libs = import('../vendor/zxing.js?v=20261007m3').then(lib => {
    // PDF417 without ECI defaults to Latin-1 in ZXing. KBV defines Latin-15.
    // Keep other explicitly tagged encodings intact; do not recode Unicode.
    lib.StringEncoding.customDecoder = (bytes, encoding) =>
      /^(ISO-8859-(1|15)|ISO8859_(1|15))$/i.test(encoding)
        ? decodeLatin15(bytes) : new TextDecoder(encoding, { fatal:true }).decode(bytes);
    return lib;
  }).catch(() => { libs = null; throw new Error('Lokaler Barcode-Leser nicht verfügbar. Bitte von Hand erfassen.'); });
  return libs;
}

function neueLeinwand(width, height) {
  width=Math.floor(width);height=Math.floor(height);
  if (!width || !height || width * height > MAX_PIXELS) throw new Error('Bild zu groß. Bitte ein kleineres Bild auswählen.');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

/**
 * Box-Test 22.11.2026 (Pflichtpunkt 4, „PDF-Scan scheitert“): Renderstufen für PDF-Seiten.
 * Vorher fest höchstens Faktor 3 (≈ 216 dpi bei A4) — ein Scanner-PDF mit 300 dpi verlor dabei
 * Auflösung, kleinere Barcodes (≈ 40 mm) wurden als Bild erkannt, als PDF nicht (belegt mit
 * synthetischem Scan). Jetzt erst die schnelle Stufe 3, dann die größte, die MAX_PIXELS erlaubt.
 * @param {number} breite @param {number} hoehe  Seitengröße bei Faktor 1 (pt)
 * @returns {number[]}
 */
export function pdfStufen(breite, hoehe) {
  const max = Math.sqrt(MAX_PIXELS / (breite * hoehe));
  const schnell = Math.min(3, max);
  return max > schnell * 1.15 ? [schnell, max] : [schnell];
}

/**
 * Große Fotos (z. B. 48 MP) werden auf MAX_PIXELS verkleinert statt abgelehnt. Vorher warf
 * neueLeinwand „Bild zu groß“, und der Bildzweig schrieb daraus „Kein unterstützter
 * Muster-13-Barcode erkannt“ — die eigentliche Ursache war für den Nutzer unsichtbar.
 * @param {number} breite @param {number} hoehe @returns {{ breite: number, hoehe: number }}
 */
export function bildMass(breite, hoehe) {
  const f = Math.min(1, Math.sqrt(MAX_PIXELS / (breite * hoehe)));
  return { breite: Math.floor(breite * f), hoehe: Math.floor(hoehe * f) };
}

function abbrechen(signal) {
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
}

async function leseLeinwand(canvas, signal) {
  const lib = await zxing();
  const gefunden = new Set();
  const hints = new Map([[lib.DecodeHintType.TRY_HARDER,true]]);
  for (let turn=0;turn<4;turn++) {
    abbrechen(signal);
    const rotated = neueLeinwand(turn%2 ? canvas.height:canvas.width, turn%2 ? canvas.width:canvas.height);
    try {
      const ctx=rotated.getContext('2d',{willReadFrequently:true});
      ctx.translate(rotated.width/2,rotated.height/2); ctx.rotate(turn*Math.PI/2);
      ctx.drawImage(canvas,-canvas.width/2,-canvas.height/2);
      const rgba=ctx.getImageData(0,0,rotated.width,rotated.height).data;
      const grey=new Uint8ClampedArray(rotated.width*rotated.height);
      for(let i=0,j=0;i<rgba.length;i+=4,j++) grey[j]=(rgba[i]+2*rgba[i+1]+rgba[i+2])/4;
      const bitmap=new lib.BinaryBitmap(new lib.HybridBinarizer(new lib.RGBLuminanceSource(grey,rotated.width,rotated.height)));
      try {
        for(const result of new lib.PDF417Reader().decodeMultiple(bitmap,hints) || []) gefunden.add(result.getText());
      } catch { /* No valid PDF417 at this orientation; never log image or exception. */ }
    } finally { rotated.width=rotated.height=0; }
    // Let close/cancel events run between CPU-bound decoder passes.
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return gefunden;
}

export async function scanneRezeptLokal(dataUri, { signal } = {}) {
  const { mime,bytes }=scanBytes(dataUri);
  abbrechen(signal);
  const gefunden=new Map();
  async function lesen(canvas) {
    for(const text of await leseLeinwand(canvas,signal)) {
      if(!gefunden.has(text)) gefunden.set(text,canvas.toDataURL('image/png'));
    }
    if(gefunden.size>1) throw new Error('Mehrere unterschiedliche Barcodes erkannt. Bitte nur ein Rezept auswählen.');
  }
  if(mime==='application/pdf') {
    if(!pdfLib) pdfLib=import('../vendor/pdfjs/pdf.mjs').catch(()=>{pdfLib=null;throw new Error('Lokaler PDF-Leser nicht verfügbar.');});
    const pdf=await pdfLib;
    abbrechen(signal);
    pdf.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
    const task=pdf.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:false,disableFontFace:true,disableAutoFetch:true,
      standardFontDataUrl:new URL('../vendor/pdfjs/standard_fonts/',import.meta.url).href});
    const stop=()=>{void task.destroy();};
    signal?.addEventListener('abort',stop,{once:true});
    try {
      const doc=await task.promise;
      if(doc.numPages>5) throw new Error('Bitte ein PDF mit höchstens fünf Seiten auswählen.');
      for(let i=1;i<=doc.numPages;i++) {
        abbrechen(signal);
        const page=await doc.getPage(i);
        const base=page.getViewport({scale:1});
        try {
          for(const scale of pdfStufen(base.width,base.height)) {
            abbrechen(signal);
            const viewport=page.getViewport({scale});
            const canvas=neueLeinwand(viewport.width,viewport.height);
            const vorher=gefunden.size;
            try { await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise; await lesen(canvas); }
            finally { canvas.width=canvas.height=0; }
            if(gefunden.size>vorher) break; // auf dieser Seite gefunden → keine teurere Stufe
          }
        } finally { page.cleanup(); }
      }
    } finally { signal?.removeEventListener('abort',stop); await task.destroy(); }
  } else {
    const image=new Image();
    try {
      image.src=dataUri;
      await image.decode();
      abbrechen(signal);
      const mass=bildMass(image.naturalWidth,image.naturalHeight);
      const canvas=neueLeinwand(mass.breite,mass.hoehe);
      try { canvas.getContext('2d').drawImage(image,0,0,mass.breite,mass.hoehe); await lesen(canvas); }
      finally {canvas.width=canvas.height=0;}
    } catch(error) {
      if(error.name==='AbortError') throw error;
      // Eigene, verständliche Meldungen (mehrere Barcodes, Leser nicht verfügbar) durchreichen;
      // nur unlesbare Bilddaten werden zu „kein Barcode“.
      if(error instanceof Error && /Mehrere unterschiedliche|nicht verfügbar|zu groß/.test(error.message)) throw error;
      throw new Error(KEIN_BARCODE);
    } finally {image.removeAttribute('src');}
  }
  abbrechen(signal);
  if(gefunden.size!==1) throw new Error(KEIN_BARCODE);
  const [text,preview]=gefunden.entries().next().value;
  return {...parseMuster13Barcode(text),dataUri:preview,storage_path:null,ocr_confidence:null};
}

// Only numeric aggregates, local to this browser. No identities or raw input.
const counters={barcode_ok:0,fallback_manuell:0};
function ladeZaehler() {
  try {
    const saved=JSON.parse(localStorage.getItem('praxura_barcode_zaehler') || '{}');
    for(const key of Object.keys(counters)) counters[key]=Number.isSafeInteger(saved?.[key]) && saved[key]>=0 ? saved[key]:0;
  } catch { /* Storage may be disabled; retain in-memory numeric counts. */ }
}
export function zaehleBarcode(name) {
  if(!Object.hasOwn(counters,name)) return;
  ladeZaehler();
  counters[name]=Math.min(Number.MAX_SAFE_INTEGER,counters[name]+1);
  try {
    localStorage.setItem('praxura_barcode_zaehler',JSON.stringify(counters));
  } catch { /* In-memory counts still work when storage is blocked. */ }
}
export function leseBarcodeZaehler() {ladeZaehler();return {...counters};}
