/**
 * patient-dokumente.js — Dokumente-Upload und -Verwaltung in der Patientenakte.
 *
 * K7: Dokumente-Upload in der Patientenakte (Physio · Ergo · Logo · Podo).
 * Ermöglicht das Hochladen, Kategorisieren, Öffnen und Weich-Löschen (mit Pflicht-Grund)
 * von Dokumenten (PDF, PNG, JPG, WEBP bis 10 MB) in den Supabase Storage-Bucket
 * `patient-documents` und die Tabelle `patient_dokumente` (§ 630f BGB).
 */

import { oeffneFormularAuswahl } from './formular-unterschreiben.js?v=20261031b';

'use strict';

/** Alle zulässigen Kategorien für die Anzeige (inkl. formular_signiert). */
export const KATEGORIEN = {
  befund_extern: 'Externer Befund',
  arztbrief: 'Arztbrief',
  bildgebung: 'Bildgebung',
  foto: 'Foto',
  formular_signiert: 'Unterschriebenes Formular',
  sonstiges: 'Sonstiges',
};

/** Erlaubte MIME-Typen und zugehörige Dateiendungen. */
const ERLAUBTE_TYPEN = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
};

const MAX_DATEI_GROESSE = 10485760; // 10 MB (10 * 1024 * 1024 Bytes)

/**
 * HTML-Escaping zur sicheren Darstellung von Nutzerdaten.
 *
 * @param {*} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Dateinamen auf [A-Za-z0-9._-] reduzieren und auf max. 80 Zeichen begrenzen.
 *
 * @param {string} name
 * @returns {string}
 */
export function saubererName(name) {
  if (typeof name !== 'string') return 'datei';
  const bereinigt = name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
  return bereinigt || 'datei';
}

/**
 * Berechnet den eindeutigen Storage-Pfad für ein Dokument.
 * Schema: `${ownerId}/${leadId}/dokumente/${uuid}-${saubererName}`
 *
 * @param {{ownerId:string, leadId:string, name:string, uuid?:string}} opts
 * @returns {string}
 */
export function bauePfad({ ownerId, leadId, name, uuid }) {
  const u = uuid || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'id');
  const dateiname = saubererName(name);
  return `${ownerId}/${leadId}/dokumente/${u}-${dateiname}`;
}

/**
 * Validiert Datei vor dem Upload: Größe (<= 10 MB, > 0), MIME und Dateiendung.
 *
 * @param {{name?:string, size?:number, type?:string}} datei
 * @returns {{ok:true}|{ok:false, fehler:string}}
 */
export function pruefeDatei(datei) {
  if (!datei || typeof datei !== 'object') {
    return { ok: false, fehler: 'Keine Datei ausgewählt.' };
  }
  const { name, size, type } = datei;
  if (!name || size == null || !type) {
    return { ok: false, fehler: 'Dateiangaben unvollständig.' };
  }
  if (typeof size !== 'number' || size <= 0) {
    return { ok: false, fehler: 'Datei ist leer.' };
  }
  if (size > MAX_DATEI_GROESSE) {
    return { ok: false, fehler: 'Datei zu gross (maximal 10 MB erlaubt).' };
  }
  const endungen = ERLAUBTE_TYPEN[type];
  if (!endungen) {
    return { ok: false, fehler: 'Dateityp nicht erlaubt (nur PDF, PNG, JPG und WEBP).' };
  }
  const teile = String(name).split('.');
  const ext = teile.length > 1 ? teile.pop().toLowerCase() : '';
  if (!ext || !endungen.includes(ext)) {
    return { ok: false, fehler: 'Dateiendung passt nicht zum Dateityp.' };
  }
  return { ok: true };
}

/**
 * Erzeugt einen SHA-256 Hash als Hex-String (64 Zeichen, Kleinbuchstaben) aus einem Puffer.
 *
 * @param {ArrayBuffer|ArrayBufferView} buffer
 * @returns {Promise<string>}
 */
export async function hexSha256(buffer) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto subtle ist nicht verfügbar');
  }
  const hashBuffer = await subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Formatiert Dateigrößen lesbar auf Deutsch (B, KB, MB).
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatiereGroesse(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) {
    const kb = (b / 1024).toFixed(1).replace('.', ',');
    return `${kb} KB`;
  }
  const mb = (b / (1024 * 1024)).toFixed(1).replace('.', ',');
  return `${mb} MB`;
}

/**
 * Verdrahtet die Dokumentenverwaltung in der Patientenakte.
 *
 * @param {{
 *   supabase: object,
 *   getOwnerId: () => string|string,
 *   showToast: (msg:string, typ?:string) => void,
 *   getLeadId: () => string|string,
 *   userId: () => string|null|string|null
 * }} deps
 * @param {Document} [doc]
 */
export function verdrahteDokumente(deps, doc = document) {
  const tab = doc.querySelector('.pd-tab[data-tab="dokumente"]');
  if (!tab) return;
  if (tab.dataset.pdDokWacht) return;
  tab.dataset.pdDokWacht = '1';

  async function ladeUndZeichne() {
    const host = doc.getElementById('pdDokListeHost');
    if (!host) return;

    const leadId = typeof deps?.getLeadId === 'function' ? deps.getLeadId() : deps?.getLeadId;
    if (!leadId) return;

    const ownerId = typeof deps?.getOwnerId === 'function' ? deps.getOwnerId() : deps?.getOwnerId;
    if (!ownerId) return;

    montiereHost(host, deps);

    if (host.dataset.lastLeadId !== leadId) {
      host.dataset.lastLeadId = leadId;
      const katSelect = host.querySelector('#pdDokKategorie');
      const notizInput = host.querySelector('#pdDokNotiz');
      const fileInput = host.querySelector('#pdDokFileInput');
      if (katSelect) katSelect.value = '';
      if (notizInput) notizInput.value = '';
      if (fileInput) fileInput.value = '';
    }

    await ladeDokumente(host, deps, { ownerId, leadId });
  }

  tab.addEventListener('click', () => {
    ladeUndZeichne();
  });
}

function montiereHost(host, deps) {
  if (host.dataset.montiert === '1') return;
  host.dataset.montiert = '1';

  host.innerHTML = `
    <div id="pdDokKopf" style="margin-bottom:16px;">
      <h4 style="margin:0 0 12px 0;font-size:15px;font-weight:600;color:var(--text-main);">Hochgeladene Dokumente</h4>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
        <select id="pdDokKategorie" class="form-input" style="min-height:44px;min-width:180px;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:14px;box-sizing:border-box;">
          <option value="">-- Kategorie wählen * --</option>
          <option value="befund_extern">Externer Befund</option>
          <option value="arztbrief">Arztbrief</option>
          <option value="bildgebung">Bildgebung</option>
          <option value="foto">Foto</option>
          <option value="sonstiges">Sonstiges</option>
        </select>
        <input type="text" id="pdDokNotiz" class="form-input" placeholder="Notiz (optional)" style="min-height:44px;flex:1;min-width:160px;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:14px;box-sizing:border-box;">
        <button type="button" class="btn" id="pdDokFormularSignBtn" style="min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 16px;cursor:pointer;font-weight:500;box-sizing:border-box;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:6px;">Formular unterschreiben lassen</button>
        <label class="btn btn-primary" id="pdDokUploadBtn" style="min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 16px;cursor:pointer;font-weight:500;box-sizing:border-box;user-select:none;">
          <span id="pdDokUploadBtnText">Datei hochladen</span>
          <input type="file" id="pdDokFileInput" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" style="display:none;">
        </label>
      </div>
    </div>
    <div id="pdDokListeContainer"></div>
  `;

  const katSelect = host.querySelector('#pdDokKategorie');
  const notizInput = host.querySelector('#pdDokNotiz');
  const uploadBtn = host.querySelector('#pdDokUploadBtn');
  const fileInput = host.querySelector('#pdDokFileInput');
  const uploadText = host.querySelector('#pdDokUploadBtnText');
  const signBtn = host.querySelector('#pdDokFormularSignBtn');
  signBtn?.addEventListener('click', () => {
    const leadId = typeof deps?.getLeadId === 'function' ? deps.getLeadId() : deps?.getLeadId;
    const ownerId = typeof deps?.getOwnerId === 'function' ? deps.getOwnerId() : deps?.getOwnerId;
    if (!leadId) {
      deps.showToast('Bitte zuerst einen Patienten auswählen.', 'error');
      return;
    }
    oeffneFormularAuswahl({
      supabase: deps.supabase,
      ownerId,
      leadId,
      showToast: deps.showToast,
      onFertig: () => ladeDokumente(host, deps, { ownerId, leadId }),
    });
  });

  uploadBtn.addEventListener('click', (e) => {
    if (!katSelect.value) {
      e.preventDefault();
      deps.showToast('Bitte zuerst eine Kategorie wählen.', 'error');
      katSelect.focus();
    }
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const kategorie = katSelect.value;
    if (!kategorie) {
      deps.showToast('Bitte eine Kategorie wählen.', 'error');
      e.target.value = '';
      return;
    }

    const check = pruefeDatei({ name: file.name, size: file.size, type: file.type });
    if (!check.ok) {
      deps.showToast(check.fehler, 'error');
      e.target.value = '';
      return;
    }

    const leadId = typeof deps?.getLeadId === 'function' ? deps.getLeadId() : deps?.getLeadId;
    const ownerId = typeof deps?.getOwnerId === 'function' ? deps.getOwnerId() : deps?.getOwnerId;
    if (!leadId || !ownerId) {
      deps.showToast('Patient oder Praxis fehlt.', 'error');
      e.target.value = '';
      return;
    }

    uploadBtn.style.pointerEvents = 'none';
    uploadBtn.style.opacity = '0.7';
    uploadText.textContent = 'Wird hochgeladen...';

    const pfad = bauePfad({ ownerId, leadId, name: file.name });
    const contentType = file.type || 'application/octet-stream';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const sha256 = await hexSha256(arrayBuffer);

      const { error: storageError } = await deps.supabase.storage
        .from('patient-documents')
        .upload(pfad, file, { contentType, upsert: false });
      if (storageError) throw storageError;

      const uid = typeof deps.userId === 'function' ? deps.userId() : deps.userId;
      const notiz = (notizInput.value || '').trim() || null;

      const { error: dbError } = await deps.supabase
        .from('patient_dokumente')
        .insert({
          owner_id: ownerId,
          lead_id: leadId,
          kategorie,
          storage_path: pfad,
          dateiname: file.name,
          mime_type: contentType,
          groesse_bytes: file.size,
          datei_sha256: sha256,
          notiz,
          created_by: uid || null,
        });

      if (dbError) {
        try {
          await deps.supabase.storage.from('patient-documents').remove([pfad]);
        } catch (_) {}
        throw dbError;
      }

      deps.showToast('Dokument hochgeladen.');
      katSelect.value = '';
      notizInput.value = '';
      fileInput.value = '';
      await ladeDokumente(host, deps, { ownerId, leadId });
    } catch (err) {
      deps.showToast('Fehler beim Hochladen: ' + (err?.message || err), 'error');
      fileInput.value = '';
    } finally {
      uploadBtn.style.pointerEvents = '';
      uploadBtn.style.opacity = '';
      uploadText.textContent = 'Datei hochladen';
    }
  });
}

async function ladeDokumente(host, deps, { ownerId, leadId }) {
  const container = host.querySelector('#pdDokListeContainer');
  if (!container) return;

  container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:14px;"><div class="spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:8px;"></div>Dokumente werden geladen...</div>';

  try {
    const { data: dokumente, error } = await deps.supabase
      .from('patient_dokumente')
      .select('id, owner_id, lead_id, kategorie, storage_path, dateiname, mime_type, groesse_bytes, datei_sha256, notiz, created_at, created_by')
      .eq('owner_id', ownerId)
      .eq('lead_id', leadId)
      .is('geloescht_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!dokumente || dokumente.length === 0) {
      container.innerHTML = '<div class="pd-empty" style="padding:24px 12px;text-align:center;color:var(--text-muted);font-size:14px;border:1px dashed var(--border);border-radius:8px;">Noch keine Dokumente hochgeladen.</div>';
      return;
    }

    container.innerHTML = '';
    for (const doc of dokumente) {
      const zeile = document.createElement('div');
      zeile.className = 'pd-dok-zeile';
      zeile.dataset.id = doc.id;
      zeile.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);margin-bottom:10px;';

      const katLabel = KATEGORIEN[doc.kategorie] || doc.kategorie;
      const datumStr = doc.created_at ? new Date(doc.created_at).toLocaleDateString('de-DE') : '';
      const groesseStr = formatiereGroesse(doc.groesse_bytes);

      zeile.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;flex:1;">
            <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);white-space:nowrap;">
              ${escapeHtml(katLabel)}
            </span>
            <span style="font-weight:600;font-size:14px;color:var(--text-main);word-break:break-all;">
              ${escapeHtml(doc.dateiname)}
            </span>
            <span style="color:var(--text-muted);font-size:13px;white-space:nowrap;">
              ${escapeHtml(datumStr)}
            </span>
            <span style="color:var(--text-muted);font-size:13px;white-space:nowrap;">
              ${escapeHtml(groesseStr)}
            </span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button type="button" class="btn btn-secondary btn-sm pd-dok-oeffnen" style="min-height:44px;padding:0 14px;cursor:pointer;">Öffnen</button>
            <button type="button" class="btn btn-secondary btn-sm pd-dok-loeschen" style="min-height:44px;padding:0 14px;cursor:pointer;color:var(--text-muted);">Löschen</button>
          </div>
        </div>
        ${doc.notiz ? `<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">${escapeHtml(doc.notiz)}</div>` : ''}
        <div class="pd-dok-loesch-bereich" style="display:none;margin-top:8px;"></div>
      `;

      const oeffnenBtn = zeile.querySelector('.pd-dok-oeffnen');
      oeffnenBtn.addEventListener('click', async () => {
        try {
          oeffnenBtn.disabled = true;
          const { data: urlData, error: urlError } = await deps.supabase.storage
            .from('patient-documents')
            .createSignedUrl(doc.storage_path, 120);
          if (urlError || !urlData?.signedUrl) {
            throw urlError || new Error('URL konnte nicht erzeugt werden');
          }
          window.open(urlData.signedUrl, '_blank', 'noopener');
        } catch (err) {
          deps.showToast('Fehler beim Öffnen: ' + (err?.message || err), 'error');
        } finally {
          oeffnenBtn.disabled = false;
        }
      });

      const loeschenBtn = zeile.querySelector('.pd-dok-loeschen');
      const loeschBereich = zeile.querySelector('.pd-dok-loesch-bereich');
      loeschenBtn.addEventListener('click', () => {
        if (loeschBereich.style.display !== 'none') {
          loeschBereich.style.display = 'none';
          loeschBereich.innerHTML = '';
          return;
        }
        loeschBereich.style.display = 'block';
        loeschBereich.innerHTML = `
          <div style="padding:12px;background:var(--bg-main);border:1px solid var(--border);border-radius:6px;margin-top:6px;">
            <label style="display:block;font-size:13px;font-weight:500;margin-bottom:4px;color:var(--text-main);">
              Grund für das Löschen (Pflicht, min. 3 Zeichen):
            </label>
            <textarea class="form-input pd-dok-loeschgrund" style="width:100%;min-height:54px;padding:8px;font-size:13px;background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;margin-bottom:6px;resize:vertical;" placeholder="z. B. Falschem Patienten zugeordnet"></textarea>
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px 0;">
              Das Dokument wird ausgeblendet und bleibt aus Aufbewahrungsgründen gespeichert.
            </p>
            <div style="display:flex;gap:8px;align-items:center;">
              <button type="button" class="btn btn-danger btn-sm pd-dok-bestaetigen-loesch" style="min-height:44px;padding:0 14px;cursor:pointer;">
                Löschen bestätigen
              </button>
              <button type="button" class="btn btn-secondary btn-sm pd-dok-abbrechen-loesch" style="min-height:44px;padding:0 14px;cursor:pointer;">
                Abbrechen
              </button>
            </div>
          </div>
        `;
        const textarea = loeschBereich.querySelector('.pd-dok-loeschgrund');
        const confirmBtn = loeschBereich.querySelector('.pd-dok-bestaetigen-loesch');
        const cancelBtn = loeschBereich.querySelector('.pd-dok-abbrechen-loesch');

        cancelBtn.addEventListener('click', () => {
          loeschBereich.style.display = 'none';
          loeschBereich.innerHTML = '';
        });

        confirmBtn.addEventListener('click', async () => {
          const grund = (textarea.value || '').trim();
          if (grund.length < 3) {
            deps.showToast('Bitte geben Sie einen Löschgrund an (mindestens 3 Zeichen).', 'error');
            textarea.focus();
            return;
          }
          confirmBtn.disabled = true;
          cancelBtn.disabled = true;
          const uid = typeof deps.userId === 'function' ? deps.userId() : deps.userId;
          try {
            const { data: aktualisiert, error: updError } = await deps.supabase
              .from('patient_dokumente')
              .update({
                geloescht_at: new Date().toISOString(),
                geloescht_von: uid || null,
                loeschgrund: grund,
              })
              .eq('id', doc.id)
              .eq('owner_id', ownerId)
              .select('id');

            if (updError) throw updError;
            if (!aktualisiert || !aktualisiert.length) throw new Error('Keine Berechtigung oder Dokument nicht gefunden.');

            deps.showToast('Dokument gelöscht.');
            await ladeDokumente(host, deps, { ownerId, leadId });
          } catch (err) {
            deps.showToast('Fehler beim Löschen: ' + (err?.message || err), 'error');
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
          }
        });
        setTimeout(() => textarea.focus(), 50);
      });

      container.appendChild(zeile);
    }
  } catch (err) {
    container.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:14px;">Fehler beim Laden der Dokumente: ' + escapeHtml(err?.message || err) + '</div>';
  }
}
