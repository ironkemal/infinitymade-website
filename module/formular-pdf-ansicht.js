/**
 * formular-pdf-ansicht.js — Lokale PDF-Seitenanzeige für Formulare (Editor & Signieren).
 *
 * Rendert PDF-Seiten untereinander auf HTML5-Canvas-Elemente mit lokalem vendor/pdfjs
 * (kein CDN). Jede Seite erhält ein überlagertes Overlay-Element für Signaturfelder.
 */

'use strict';

export const MAX_CANVAS_PIXEL = 12_000_000;

let pdfLibPromise = null;

async function ladePdfLib() {
  if (!pdfLibPromise) {
    pdfLibPromise = import('../vendor/pdfjs/pdf.mjs').catch((err) => {
      pdfLibPromise = null;
      console.error('[formular-pdf-ansicht] Fehler beim Laden von pdf.mjs', err);
      throw new Error('Lokaler PDF-Betrachter konnte nicht geladen werden.');
    });
  }
  return pdfLibPromise;
}

/**
 * Berechnet den Renderskalierungsfaktor unter Beachtung einer Canvas-Gesamtpixel-Obergrenze.
 * Verhindert Speicherüberläufe bei extrem hochauflösenden Displays (High-DPR) oder großen Seiten.
 *
 * @param {number} zielBreitePx - Gewünschte Anzeigebreite in CSS-Pixeln
 * @param {number} baseBreitePx - Originalbreite des PDF-Viewports (scale=1)
 * @param {number} [dpr=1] - Device Pixel Ratio
 * @param {number} [maxPixel=12000000] - Maximale Pixelanzahl für den Canvas
 * @param {number|null} [baseHoehePx=null] - Originalhöhe des PDF-Viewports (optional)
 * @returns {number}
 */
export function berechneRenderScale(zielBreitePx = 0, baseBreitePx = 0, dpr = 1, maxPixel = MAX_CANVAS_PIXEL, baseHoehePx = null) {
  if (!zielBreitePx || !baseBreitePx || zielBreitePx <= 0 || baseBreitePx <= 0) return 1;

  const layoutScale = zielBreitePx / baseBreitePx;
  let renderScale = layoutScale * (dpr || 1);

  // Falls keine Höhe übergeben wurde, Standard-Verhältnis 1.4142 (DIN A4) annehmen
  const hoehe = (baseHoehePx && baseHoehePx > 0) ? baseHoehePx : baseBreitePx * 1.4142;
  const breite = baseBreitePx;

  const totalPixels = (breite * renderScale) * (hoehe * renderScale);
  if (totalPixels > maxPixel) {
    const maxAllowedScale = Math.sqrt(maxPixel / (breite * hoehe));
    renderScale = Math.min(renderScale, maxAllowedScale);
  }

  return Math.round(renderScale * 10000) / 10000;
}

/**
 * Rendert die Seiten eines PDF-Dokuments untereinander in den angegebenen Container.
 *
 * @param {HTMLElement} container - DOM-Container für die Seiten
 * @param {Uint8Array|ArrayBuffer} pdfBytes - Binärdaten des PDFs
 * @param {object} [options]
 * @param {number} [options.maxWidth] - Maximale Breite in Pixeln
 * @param {AbortSignal} [options.signal] - Signal zum vorzeitigen Abbrechen des Rendervorgangs
 * @param {number} [options.maxPixel] - Canvas-Pixelobergrenze (Standard 12_000_000)
 * @returns {Promise<{doc: object, numPages: number, seiten: Array<{seiteNum: number, seiteEl: HTMLElement, overlayEl: HTMLElement, canvas: HTMLCanvasElement, breitePx: number, hoehePx: number}>, destroy: Function}>}
 */
export async function rendereSeiten(container, pdfBytes, options = {}) {
  if (!container) throw new Error('Container fehlt.');
  if (!pdfBytes) throw new Error('PDF-Daten fehlen.');

  const signal = options.signal;
  let abgebrochen = Boolean(signal?.aborted);

  const seiten = [];
  let task = null;
  let doc = null;

  function destroyViewer() {
    abgebrochen = true;
    for (const s of seiten) {
      if (s.canvas) {
        s.canvas.width = 0;
        s.canvas.height = 0;
      }
    }
    try { doc?.destroy(); } catch (_) {}
    try { task?.destroy(); } catch (_) {}
  }

  if (signal) {
    signal.addEventListener('abort', () => {
      destroyViewer();
    }, { once: true });
  }

  if (abgebrochen) {
    destroyViewer();
    throw new Error('Rendern abgebrochen.');
  }

  const pdf = await ladePdfLib();
  if (abgebrochen) {
    destroyViewer();
    throw new Error('Rendern abgebrochen.');
  }

  pdf.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;
  const standardFontDataUrl = new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href;

  task = pdf.getDocument({
    data: pdfBytes,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    disableAutoFetch: true,
    standardFontDataUrl,
  });

  doc = await task.promise;
  if (abgebrochen) {
    destroyViewer();
    throw new Error('Rendern abgebrochen.');
  }

  container.innerHTML = '';

  const containerBreite = container.clientWidth || 700;
  const gewuenschteBreite = options.maxWidth ? Math.min(containerBreite - 32, options.maxWidth) : Math.min(containerBreite - 32, 800);
  const zielBreite = Math.max(260, gewuenschteBreite);
  const dpr = window.devicePixelRatio || 1;
  const maxPixel = options.maxPixel || MAX_CANVAS_PIXEL;

  for (let i = 1; i <= doc.numPages; i++) {
    if (abgebrochen || signal?.aborted) {
      destroyViewer();
      break;
    }

    const page = await doc.getPage(i);
    if (abgebrochen || signal?.aborted) {
      page.cleanup();
      destroyViewer();
      break;
    }

    const baseViewport = page.getViewport({ scale: 1 });
    const scale = zielBreite / baseViewport.width;
    const cssW = Math.round(baseViewport.width * scale);
    const cssH = Math.round(baseViewport.height * scale);

    const renderScale = berechneRenderScale(zielBreite, baseViewport.width, dpr, maxPixel, baseViewport.height);

    const seiteEl = document.createElement('div');
    seiteEl.className = 'formular-pdf-seite';
    seiteEl.dataset.seite = String(i);
    // Bewusst weiß (#FFFFFF): Standard-Papierhintergrund für PDF-Dokumente
    seiteEl.style.cssText = `position:relative;width:${cssW}px;height:${cssH}px;margin:0 auto 24px auto;background:#FFFFFF;box-shadow:0 2px 10px rgba(0,0,0,0.12);box-sizing:border-box;border-radius:4px;overflow:hidden;`;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `width:${cssW}px;height:${cssH}px;display:block;`;
    canvas.width = Math.round(baseViewport.width * renderScale);
    canvas.height = Math.round(baseViewport.height * renderScale);
    seiteEl.appendChild(canvas);

    const overlayEl = document.createElement('div');
    overlayEl.className = 'formular-pdf-seite-overlay';
    overlayEl.dataset.seite = String(i);
    overlayEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    seiteEl.appendChild(overlayEl);

    container.appendChild(seiteEl);

    const renderViewport = page.getViewport({ scale: renderScale });
    const renderContext = {
      canvasContext: canvas.getContext('2d'),
      viewport: renderViewport,
    };

    try {
      await page.render(renderContext).promise;
    } finally {
      page.cleanup();
    }

    seiten.push({
      seiteNum: i,
      seiteEl,
      overlayEl,
      canvas,
      breitePx: cssW,
      hoehePx: cssH,
    });
  }

  return {
    doc,
    numPages: doc.numPages,
    seiten,
    destroy() {
      destroyViewer();
    },
  };
}
