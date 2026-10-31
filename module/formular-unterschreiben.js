/**
 * formular-unterschreiben.js — Formular am Patienten ausfüllen und digital signieren.
 *
 * Ruft das Backend POST /api/dokument/formular-signieren auf.
 * Stellt Vollbild-PDF-Ansicht und Touch-optimierte Zeichenfläche für Unterschriften bereit.
 */

import { API_BASE } from '../supabase-config.js';
import { signaturePad } from './patienten-einwilligung.js?v=20261031a';
import { rendereSeiten } from './formular-pdf-ansicht.js?v=20261031b';

'use strict';

/**
 * Prüft, ob alle definierten Signaturfelder unterschrieben wurden.
 *
 * @param {Array} felder - Array der Feld-Definitionen [{ seite, x, y, w, h }]
 * @param {Array|object} unterschriften - Array oder Map der Unterschriften (PNG Base64 / Data-URLs)
 * @returns {boolean}
 */
export function alleUnterschrieben(felder, unterschriften) {
  if (!Array.isArray(felder) || felder.length === 0) return false;
  if (!unterschriften) return false;

  for (let i = 0; i < felder.length; i++) {
    const val = Array.isArray(unterschriften) ? unterschriften[i] : unterschriften[i];
    if (!val) return false;
    if (typeof val === 'string' && val.trim().length === 0) return false;
  }
  return true;
}

/**
 * Erzeugt den JSON-Body für den Aufruf von POST /dokument/formular-signieren.
 * Entfernt den Data-URL-Präfix ('data:image/png;base64,') von allen Signaturen.
 *
 * @param {object} opts
 * @param {string} opts.formularId
 * @param {string} opts.leadId
 * @param {Array|object} opts.unterschriften
 * @param {string} [opts.signedName]
 * @returns {{formular_id: string, lead_id: string, signaturen: Array<{feld_index: number, png_base64: string}>, signed_name?: string}}
 */
export function baueSignierBody({ formularId, leadId, unterschriften, signedName } = {}) {
  const fId = String(formularId || '').trim();
  const lId = String(leadId || '').trim();

  const list = Array.isArray(unterschriften)
    ? unterschriften
    : Object.keys(unterschriften || {})
        .sort((a, b) => Number(a) - Number(b))
        .map(k => unterschriften[k]);

  const signaturen = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    const str = typeof raw === 'string' ? raw : (raw?.png_base64 || '');
    const clean = String(str || '').replace(/^data:[^;]+;base64,/, '').trim();
    signaturen.push({
      feld_index: i,
      png_base64: clean,
    });
  }

  const res = {
    formular_id: fId,
    lead_id: lId,
    signaturen,
  };

  const name = typeof signedName === 'string' ? signedName.trim() : '';
  if (name) {
    res.signed_name = name;
  }

  return res;
}

async function api(supabase, pfad, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Bitte erneut anmelden.');

  const res = await fetch(`${API_BASE.replace(/\/+$/, '')}${pfad}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json.error || `Fehler ${res.status}`);
    e.code = json.code;
    throw e;
  }
  return json;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Öffnet eine Kachel-Auswahl aktiver Formulare für den Patienten.
 *
 * @param {object} opts
 * @param {object} opts.supabase
 * @param {string} [opts.ownerId] - Optional: Inhaber-ID für explizite Filterung
 * @param {string} opts.leadId - Patienten-ID
 * @param {Function} opts.showToast
 * @param {Function} [opts.onFertig]
 * @param {boolean} [opts.nurEinwilligungen=false]
 */
export async function oeffneFormularAuswahl({ supabase, ownerId, leadId, showToast, onFertig, nurEinwilligungen = false }) {
  if (!leadId) {
    showToast?.('Patienten-ID fehlt.', 'error');
    if (typeof onFertig === 'function') onFertig();
    return;
  }

  let query = supabase
    .from('praxis_formulare')
    .select('*')
    .eq('aktiv', true);

  // Mandantenfilter: falls ownerId übergeben wurde, explizit filtern (sonst greift RLS)
  if (ownerId) {
    query = query.eq('owner_id', ownerId);
  }

  if (nurEinwilligungen) {
    query = query.eq('ist_einwilligung', true);
  }

  query = query.order('titel', { ascending: true });

  const { data: formulare, error } = await query;

  if (error) {
    console.error('[formular-unterschreiben] Fehler beim Laden der Formulare', error);
    showToast?.('Formulare konnten nicht geladen werden: ' + (error.message || error), 'error');
    if (typeof onFertig === 'function') onFertig();
    return;
  }

  // Filter: Nur Formulare mit vorhandenem Speicherpfad und mindestens 1 Signaturfeld
  const gueltigeFormulare = (formulare || []).filter(f =>
    Boolean(f.storage_path) &&
    Array.isArray(f.signatur_felder) &&
    f.signatur_felder.length > 0
  );

  if (gueltigeFormulare.length === 0) {
    if (nurEinwilligungen) {
      if (typeof onFertig === 'function') onFertig();
      return;
    }
    showToast?.('Noch keine eigenen Formulare angelegt (Einstellungen).');
    if (typeof onFertig === 'function') onFertig();
    return;
  }

  const doc = document;
  const overlay = doc.createElement('div');
  overlay.className = 'formular-auswahl-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  const modal = doc.createElement('div');
  modal.style.cssText = 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:12px;padding:24px;width:100%;max-width:580px;max-height:85vh;display:flex;flex-direction:column;box-sizing:border-box;box-shadow:0 10px 35px rgba(0,0,0,0.3);';

  const titelText = nurEinwilligungen ? 'Einwilligung unterschreiben' : 'Formular unterschreiben lassen';
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px;">
      <div>
        <h3 style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(titelText)}</h3>
        <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted);">Tippen Sie auf ein Formular, um den Unterschriftsprozess zu starten:</p>
      </div>
      <button type="button" id="faSchliessenBtn" style="background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;padding:4px 8px;border-radius:4px;">&times;</button>
    </div>
    <div id="faKachelnListe" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding-right:4px;margin-bottom:16px;"></div>
    <div style="display:flex;justify-content:flex-end;gap:10px;">
      <button type="button" id="faAbbrechenBtn" class="btn" style="min-height:44px;padding:0 20px;border:1px solid var(--border);border-radius:6px;background:none;color:var(--text-muted);cursor:pointer;">Abbrechen</button>
      <button type="button" id="faFertigBtn" class="btn-primary" style="min-height:44px;padding:0 24px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">Fertig</button>
    </div>
  `;

  overlay.appendChild(modal);
  doc.body.appendChild(overlay);

  const kachelnListe = modal.querySelector('#faKachelnListe');

  const cleanup = () => {
    overlay.remove();
  };

  const fertigAktion = () => {
    cleanup();
    if (typeof onFertig === 'function') onFertig();
  };

  modal.querySelector('#faSchliessenBtn').addEventListener('click', fertigAktion);
  modal.querySelector('#faAbbrechenBtn').addEventListener('click', fertigAktion);
  modal.querySelector('#faFertigBtn').addEventListener('click', fertigAktion);

  for (const f of gueltigeFormulare) {
    const kachel = doc.createElement('button');
    kachel.type = 'button';
    kachel.className = 'formular-kachel';
    kachel.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-main);color:var(--text-main);text-align:left;cursor:pointer;min-height:56px;box-sizing:border-box;transition:border-color 0.15s ease;';

    const links = doc.createElement('div');
    links.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    const tRow = doc.createElement('div');
    tRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    const t = doc.createElement('span');
    t.style.cssText = 'font-weight:600;font-size:15px;';
    t.textContent = f.titel || 'Unbenannt';
    tRow.appendChild(t);

    if (f.ist_einwilligung) {
      const b = doc.createElement('span');
      b.style.cssText = 'background:var(--primary-dim);color:var(--primary);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;';
      b.textContent = 'Einwilligung';
      tRow.appendChild(b);
    }
    links.appendChild(tRow);

    const fCnt = Array.isArray(f.signatur_felder) ? f.signatur_felder.length : 0;
    const sub = doc.createElement('span');
    sub.style.cssText = 'font-size:12px;color:var(--text-muted);';
    sub.textContent = `${fCnt} Unterschriftsfeld${fCnt === 1 ? '' : 'er'}`;
    links.appendChild(sub);

    const pfeil = doc.createElement('span');
    pfeil.style.cssText = 'font-size:18px;color:var(--text-muted);font-weight:bold;';
    pfeil.innerHTML = '&rsaquo;';

    kachel.append(links, pfeil);

    kachel.addEventListener('click', () => {
      if (nurEinwilligungen) {
        // Kiosk-Fluss: Auswahl verbergen, nach Abschluss oder Abbrechen wieder anzeigen
        overlay.style.display = 'none';
        oeffneFormularUnterschrift({
          supabase,
          ownerId,
          leadId,
          formular: f,
          showToast,
          onFertig: async () => {
            overlay.style.display = 'flex';
          },
          onAbbrechen: () => {
            overlay.style.display = 'flex';
          },
        });
      } else {
        // Patientenakte: Auswahl schließen, nach Abschluss/Abbrechen nur Formular-Overlay beenden
        cleanup();
        oeffneFormularUnterschrift({
          supabase,
          ownerId,
          leadId,
          formular: f,
          showToast,
          onFertig,
        });
      }
    });

    kachelnListe.appendChild(kachel);
  }
}

/**
 * Öffnet das Vollbild-Overlay zum Unterzeichnen des Formulars.
 *
 * @param {object} opts
 * @param {object} opts.supabase
 * @param {string} [opts.ownerId]
 * @param {string} opts.leadId - Patienten-ID
 * @param {object} opts.formular - Datensatz aus `praxis_formulare`
 * @param {Function} opts.showToast
 * @param {Function} [opts.onFertig]
 * @param {Function} [opts.onAbbrechen]
 * @param {boolean} [opts.vollbild=true]
 */
export async function oeffneFormularUnterschrift({ supabase, ownerId, leadId, formular, showToast, onFertig, onAbbrechen }) {
  if (!formular || !formular.storage_path) {
    showToast?.('Formular-Informationen unvollständig.', 'error');
    return;
  }

  const felder = Array.isArray(formular.signatur_felder) ? formular.signatur_felder : [];
  if (felder.length === 0) {
    showToast?.('Dieses Formular besitzt keine definierten Unterschriftsfelder (Einstellungen -> Eigene Formulare).', 'error');
    return;
  }

  const unterschriften = new Array(felder.length).fill(null);

  const doc = document;
  const overlay = doc.createElement('div');
  overlay.className = 'formular-unterschrift-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg-main);display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;';

  overlay.innerHTML = `
    <div style="min-height:56px;padding:8px 16px;border-bottom:1px solid var(--border);background:var(--bg-card-solid);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-sizing:border-box;z-index:10;">
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:200px;">
        <span style="font-weight:700;font-size:16px;color:var(--text-main);">${escapeHtml(formular.titel)}</span>
        ${formular.ist_einwilligung ? '<span style="background:var(--primary-dim);color:var(--primary);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Einwilligung</span>' : ''}
      </div>
      <div style="display:flex;align-items:center;gap:16px;">
        <div id="fuFortschrittText" style="font-weight:600;font-size:14px;color:var(--text-main);">
          0 von ${felder.length} Unterschriften
        </div>
        <button type="button" id="fuAbbrechenBtnTop" class="btn" style="min-height:44px;padding:0 16px;border:1px solid var(--border);border-radius:6px;background:none;color:var(--text-muted);cursor:pointer;font-size:13px;">
          Abbrechen
        </button>
      </div>
    </div>
    <div id="fuPdfScrollContainer" style="flex:1;overflow-y:auto;overflow-x:hidden;padding:24px 16px;background:var(--bg-main);box-sizing:border-box;">
      <div id="fuLadeHinweis" style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">
        Formular wird geladen...
      </div>
      <div id="fuPdfSeitenHost"></div>
    </div>
    <div style="min-height:64px;padding:12px 16px;border-top:1px solid var(--border);background:var(--bg-card-solid);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-sizing:border-box;z-index:10;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex:1;">
        <div style="display:flex;align-items:center;gap:8px;">
          <label for="fuSignedNameInput" style="font-size:13px;color:var(--text-muted);white-space:nowrap;">Name (Druckschrift):</label>
          <input type="text" id="fuSignedNameInput" class="form-input" placeholder="Vor- und Nachname" style="min-height:44px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text-main);font-size:14px;box-sizing:border-box;min-width:200px;">
        </div>
        <span style="font-size:12px;color:var(--text-muted);line-height:1.4;">Inhalt verantwortet die Praxis.</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button type="button" id="fuAbbrechenBtn" class="btn" style="min-height:44px;padding:0 18px;border:1px solid var(--border);border-radius:6px;background:none;color:var(--text-muted);cursor:pointer;font-size:13px;">
          Abbrechen
        </button>
        <button type="button" id="fuAbschliessenBtn" class="btn-primary" disabled style="min-height:44px;padding:0 24px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;opacity:0.5;">
          Abschließen
        </button>
      </div>
    </div>
  `;

  doc.body.appendChild(overlay);

  let abgebrochen = false;
  let pdfViewer = null;
  let aktivesPadCleanup = null;
  const abortController = new AbortController();

  const hostEl = overlay.querySelector('#fuPdfSeitenHost');
  const ladeHinweis = overlay.querySelector('#fuLadeHinweis');
  const fortschrittText = overlay.querySelector('#fuFortschrittText');
  const abschliessenBtn = overlay.querySelector('#fuAbschliessenBtn');
  const signedNameInput = overlay.querySelector('#fuSignedNameInput');

  const cleanup = () => {
    abgebrochen = true;
    abortController.abort();
    if (aktivesPadCleanup) {
      try { aktivesPadCleanup(); } catch (_) {}
    }
    doc.removeEventListener('keydown', onKeyDown);
    if (pdfViewer && typeof pdfViewer.destroy === 'function') {
      pdfViewer.destroy();
    }
    overlay.remove();
  };

  const abbrechenAktion = () => {
    cleanup();
    if (typeof onAbbrechen === 'function') {
      onAbbrechen();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (aktivesPadCleanup) {
        e.stopPropagation();
        e.preventDefault();
        aktivesPadCleanup();
        return;
      }
      abbrechenAktion();
    }
  };
  doc.addEventListener('keydown', onKeyDown);

  overlay.querySelector('#fuAbbrechenBtnTop').addEventListener('click', abbrechenAktion);
  overlay.querySelector('#fuAbbrechenBtn').addEventListener('click', abbrechenAktion);

  try {
    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from('patient-documents')
      .download(formular.storage_path);

    if (abgebrochen) return;

    let blob = fileBlob;
    if (dlErr || !fileBlob) {
      const { data: signData, error: signErr } = await supabase.storage
        .from('patient-documents')
        .createSignedUrl(formular.storage_path, 300);

      if (abgebrochen) return;
      if (signErr || !signData?.signedUrl) {
        throw new Error('PDF-Datei konnte nicht geladen werden.');
      }
      const res = await fetch(signData.signedUrl);
      if (abgebrochen) return;
      if (!res.ok) throw new Error('PDF-Download fehlgeschlagen');
      blob = await res.blob();
    }

    if (abgebrochen) return;
    const arrayBuffer = await blob.arrayBuffer();
    if (abgebrochen) return;
    const pdfBytes = new Uint8Array(arrayBuffer);

    ladeHinweis.style.display = 'none';
    pdfViewer = await rendereSeiten(hostEl, pdfBytes, { signal: abortController.signal });

    if (abgebrochen) {
      pdfViewer?.destroy();
      return;
    }

    platziereSignaturKaesten();
  } catch (err) {
    if (abgebrochen) return;
    console.error('[formular-unterschreiben] Render-Fehler', err);
    ladeHinweis.innerHTML = `<span style="color:var(--danger);">Fehler beim Laden des PDFs: ${escapeHtml(err.message || err)}</span>`;
  }

  function aktualisiereStatus() {
    let count = 0;
    for (const u of unterschriften) {
      if (u) count++;
    }
    fortschrittText.textContent = `${count} von ${felder.length} Unterschriften`;

    const alleDa = alleUnterschrieben(felder, unterschriften);
    abschliessenBtn.disabled = !alleDa;
    abschliessenBtn.style.opacity = alleDa ? '1' : '0.5';
  }

  function platziereSignaturKaesten() {
    if (!pdfViewer || !pdfViewer.seiten) return;

    felder.forEach((f, idx) => {
      const sNum = Number(f.seite) || 1;
      const seiteObj = pdfViewer.seiten.find(s => s.seiteNum === sNum) || pdfViewer.seiten[0];
      if (!seiteObj) return;

      const kasten = doc.createElement('div');
      kasten.className = 'fu-signatur-kasten';
      kasten.dataset.feldIndex = String(idx);
      kasten.style.cssText = `
        position:absolute;
        left:${f.x}%;
        top:${f.y}%;
        width:${f.w}%;
        height:${f.h}%;
        border:2px dashed var(--primary);
        background:var(--primary-dim);
        border-radius:6px;
        box-sizing:border-box;
        cursor:pointer;
        touch-action:none;
        pointer-events:auto;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        user-select:none;
        overflow:hidden;
      `;

      aktualisiereKastenInhalt(kasten, idx);

      kasten.addEventListener('click', () => {
        oeffneUnterschriftsPad(idx, (dataUrl) => {
          unterschriften[idx] = dataUrl;
          aktualisiereKastenInhalt(kasten, idx);
          aktualisiereStatus();
        });
      });

      seiteObj.overlayEl.appendChild(kasten);
    });
  }

  function aktualisiereKastenInhalt(kasten, idx) {
    kasten.innerHTML = '';
    const imgData = unterschriften[idx];
    if (imgData) {
      const img = doc.createElement('img');
      img.src = imgData;
      img.alt = 'Unterschrift';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;display:block;';
      kasten.appendChild(img);

      const aendernHinweis = doc.createElement('div');
      aendernHinweis.style.cssText = 'position:absolute;bottom:2px;right:2px;font-size:9px;color:var(--text-muted);background:var(--bg-card-solid);padding:1px 4px;border-radius:3px;border:1px solid var(--border);pointer-events:none;';
      aendernHinweis.textContent = 'Antippen zum Ändern';
      kasten.appendChild(aendernHinweis);
    } else {
      const label = doc.createElement('div');
      label.style.cssText = 'font-size:12px;font-weight:600;color:var(--primary);text-align:center;pointer-events:none;padding:4px;line-height:1.3;';
      label.innerHTML = `<div>Hier unterschreiben</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Feld ${idx + 1}</div>`;
      kasten.appendChild(label);
    }
  }

  function oeffneUnterschriftsPad(feldIndex, onUebernommen) {
    const padOverlay = doc.createElement('div');
    padOverlay.className = 'formular-pad-overlay';
    padOverlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg-main);display:flex;flex-direction:column;box-sizing:border-box;';

    padOverlay.innerHTML = `
      <div style="min-height:56px;padding:8px 16px;border-bottom:1px solid var(--border);background:var(--bg-card-solid);display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;">
        <div>
          <span style="font-weight:700;font-size:16px;color:var(--text-main);">Unterschrift leisten</span>
          <span style="font-size:13px;color:var(--text-muted);margin-left:8px;">(Feld ${feldIndex + 1} von ${felder.length})</span>
        </div>
        <button type="button" id="padCloseBtn" style="background:none;border:none;font-size:24px;color:var(--text-muted);cursor:pointer;padding:4px 8px;">&times;</button>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;padding:16px;box-sizing:border-box;">
        <div id="padCanvasWrapper" style="position:relative;flex:1;width:100%;border:2px dashed var(--border-strong);border-radius:8px;background:var(--bg-card-solid);display:flex;align-items:center;justify-content:center;touch-action:none;overflow:hidden;box-sizing:border-box;">
          <canvas id="padCanvas" style="width:100%;height:100%;touch-action:none;display:block;"></canvas>
          <div id="padHinweis" style="position:absolute;pointer-events:none;color:var(--text-muted);font-size:15px;user-select:none;">
            Hier mit Finger oder Stift unterschreiben
          </div>
        </div>
        <div id="padFehler" style="color:var(--danger);font-size:13px;margin-top:8px;min-height:18px;"></div>
      </div>
      <div style="min-height:64px;padding:12px 16px;border-top:1px solid var(--border);background:var(--bg-card-solid);display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;">
        <button type="button" id="padLoeschenBtn" class="btn" style="min-height:44px;padding:0 18px;border:1px solid var(--border);border-radius:6px;background:none;color:var(--text-main);cursor:pointer;font-size:14px;">
          Löschen
        </button>
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" id="padAbbrechenBtn" class="btn" style="min-height:44px;padding:0 18px;border:1px solid var(--border);border-radius:6px;background:none;color:var(--text-muted);cursor:pointer;font-size:14px;">
            Abbrechen
          </button>
          <button type="button" id="padUebernehmenBtn" class="btn-primary" style="min-height:44px;padding:0 22px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">
            Übernehmen
          </button>
        </div>
      </div>
    `;

    doc.body.appendChild(padOverlay);

    const canvas = padOverlay.querySelector('#padCanvas');
    const hinweis = padOverlay.querySelector('#padHinweis');
    const fehler = padOverlay.querySelector('#padFehler');
    const pad = signaturePad(canvas, hinweis);

    const padCleanup = () => {
      pad.destroy();
      padOverlay.remove();
      aktivesPadCleanup = null;
    };
    aktivesPadCleanup = padCleanup;

    padOverlay.querySelector('#padCloseBtn').addEventListener('click', padCleanup);
    padOverlay.querySelector('#padAbbrechenBtn').addEventListener('click', padCleanup);
    padOverlay.querySelector('#padLoeschenBtn').addEventListener('click', () => {
      pad.clear();
      fehler.textContent = '';
    });

    padOverlay.querySelector('#padUebernehmenBtn').addEventListener('click', () => {
      if (pad.isEmpty()) {
        fehler.textContent = 'Bitte leisten Sie zuerst eine Unterschrift.';
        return;
      }
      const dataUrl = pad.dataUrl();
      padCleanup();
      if (typeof onUebernommen === 'function') {
        onUebernommen(dataUrl);
      }
    });
  }

  abschliessenBtn.addEventListener('click', async () => {
    if (!alleUnterschrieben(felder, unterschriften)) {
      showToast?.('Bitte füllen Sie alle Unterschriftsfelder aus.', 'error');
      return;
    }

    abschliessenBtn.disabled = true;
    abschliessenBtn.textContent = 'Wird gespeichert...';

    const signedName = (signedNameInput.value || '').trim();
    const body = baueSignierBody({
      formularId: formular.id,
      leadId,
      unterschriften,
      signedName,
    });

    try {
      const antwort = await api(supabase, '/dokument/formular-signieren', {
        method: 'POST',
        body,
      });

      showToast?.('Unterschriebenes Formular in der Akte abgelegt.');
      cleanup();
      if (typeof onFertig === 'function') {
        onFertig(antwort);
      }
    } catch (err) {
      console.error('[formular-unterschreiben] Backend-Fehler', err);
      showToast?.('Signieren fehlgeschlagen: ' + (err.message || err), 'error');
      abschliessenBtn.disabled = false;
      abschliessenBtn.textContent = 'Abschließen';
    }
  });
}
