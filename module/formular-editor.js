/**
 * formular-editor.js — Einstellungen -> "Eigene Formulare" (nur Owner) & Editor für Unterschriftsfelder.
 *
 * Ermöglicht das Hochladen eigener PDF-Formulare, Speichern im Bucket `patient-documents`,
 * Registrieren in `praxis_formulare` und Festlegen von quadratischen Signaturfeldern
 * (in Prozent, seite 1-basiert, Ursprung oben links).
 */

import { rendereSeiten } from './formular-pdf-ansicht.js?v=20261031b';

'use strict';

export const MAX_FORMULAR_GROESSE = 10 * 1024 * 1024; // 10 MB
export const MAX_SIGNATUR_FELDER = 10;

/**
 * Wandelt Pixel-Koordinaten in Prozentwerte bezogen auf die Seitenabmessungen um.
 *
 * @param {{px?:number, py?:number, pw?:number, ph?:number, x?:number, y?:number, w?:number, h?:number}} k - Pixelwerte
 * @param {number} seitenBreitePx - Breite der Seite in Pixeln
 * @param {number} seitenHoehePx - Höhe der Seite in Pixeln
 * @returns {{x:number, y:number, w:number, h:number}}
 */
export function pixelZuProzent(k = {}, seitenBreitePx = 0, seitenHoehePx = 0) {
  if (!seitenBreitePx || !seitenHoehePx) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const px = k.px !== undefined ? k.px : (k.x || 0);
  const py = k.py !== undefined ? k.py : (k.y || 0);
  const pw = k.pw !== undefined ? k.pw : (k.w || 0);
  const ph = k.ph !== undefined ? k.ph : (k.h || 0);

  return {
    x: Math.round(((px / seitenBreitePx) * 100) * 1000) / 1000,
    y: Math.round(((py / seitenHoehePx) * 100) * 1000) / 1000,
    w: Math.round(((pw / seitenBreitePx) * 100) * 1000) / 1000,
    h: Math.round(((ph / seitenHoehePx) * 100) * 1000) / 1000,
  };
}

/**
 * Wandelt Prozentwerte (0..100) in ganzzahlige Pixel bezogen auf Seitenbreite b und -höhe h um.
 *
 * @param {{x?:number, y?:number, w?:number, h?:number}} feld - Prozentwerte
 * @param {number} b - Seitenbreite in Pixeln
 * @param {number} h - Seitenhöhe in Pixeln
 * @returns {{px:number, py:number, pw:number, ph:number}}
 */
export function prozentZuPixel(feld = {}, b = 0, h = 0) {
  const fx = Number(feld.x) || 0;
  const fy = Number(feld.y) || 0;
  const fw = Number(feld.w) || 0;
  const fh = Number(feld.h) || 0;

  return {
    px: Math.round((fx / 100) * b),
    py: Math.round((fy / 100) * h),
    pw: Math.round((fw / 100) * b),
    ph: Math.round((fh / 100) * h),
  };
}

/**
 * Berechnet die Höhe in Prozent so, dass das Feld in Pixeln quadratisch ist.
 * Formel: hProzent = wProzent * (seitenBreite / seitenHoehe)
 *
 * @param {number} wProzent - Breite in Prozent
 * @param {number} seitenBreite - Seitenbreite in Pixeln
 * @param {number} seitenHoehe - Seitenhöhe in Pixeln
 * @returns {number}
 */
export function quadratischH(wProzent, seitenBreite, seitenHoehe) {
  if (!seitenBreite || !seitenHoehe || !wProzent) return 0;
  const res = Number(wProzent) * (Number(seitenBreite) / Number(seitenHoehe));
  return Math.round(res * 1000) / 1000;
}

/**
 * Begrenzt ein Feld auf die Seitenabmessungen [0, 100] und klemmt die Breite zwischen min und max.
 * Die Höhe h wird nicht auf denselben Maximalwert wie w gedeckelt, damit im Querformat quadratische
 * Felder (h > 40%) korrekt abgebildet und am unteren Rand geklemmt werden können.
 *
 * @param {object} feld - { x, y, w, h, seite }
 * @param {number} [min=6] - Min. Breite in Prozent
 * @param {number} [max=40] - Max. Breite in Prozent
 * @returns {object}
 */
export function begrenzeFeld(feld = {}, min = 6, max = 40) {
  const minW = Math.max(0, Number(min) || 6);
  const maxW = Math.min(100, Number(max) || 40);

  let w = Number(feld.w !== undefined ? feld.w : minW);
  w = Math.max(minW, Math.min(maxW, w));
  if (w > 100) w = 100;

  let h = Number(feld.h !== undefined ? feld.h : minW);
  if (h > 100) h = 100;
  if (h < 0) h = 0;

  let x = Number(feld.x) || 0;
  let y = Number(feld.y) || 0;

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > 100) x = Math.max(0, 100 - w);
  if (y + h > 100) y = Math.max(0, 100 - h);

  return {
    ...feld,
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
    w: Math.round(w * 1000) / 1000,
    h: Math.round(h * 1000) / 1000,
  };
}

/**
 * Validiert eine ausgewählte Formular-Datei: nur PDF und <= 10 MB.
 *
 * @param {{name?:string, size?:number, type?:string}} datei
 * @returns {{ok:true}|{ok:false, fehler:string}}
 */
export function pruefeFormularDatei(datei) {
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
  if (size > MAX_FORMULAR_GROESSE) {
    return { ok: false, fehler: 'Datei zu gross (maximal 10 MB erlaubt).' };
  }
  if (type !== 'application/pdf') {
    return { ok: false, fehler: 'Nur PDF-Dateien sind erlaubt (application/pdf).' };
  }
  const teile = String(name).split('.');
  const ext = teile.length > 1 ? teile.pop().toLowerCase() : '';
  if (ext !== 'pdf') {
    return { ok: false, fehler: 'Die Datei muss die Endung .pdf haben.' };
  }
  return { ok: true };
}

/**
 * Berechnet den SHA-256 Hash eines ArrayBuffers im Browser als Hex-String.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function berechneSha256(arrayBuffer) {
  const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Bereinigt Dateinamen auf sichere Zeichen.
 *
 * @param {string} name
 * @returns {string}
 */
export function saubererName(name) {
  if (typeof name !== 'string') return 'formular.pdf';
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'formular.pdf';
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
 * Rendert den Einstellungs-Abschnitt "Eigene Formulare" unter dem Fax-Abschnitt.
 *
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {object} deps.profile
 * @param {Function} deps.userId
 * @param {Function} [deps.getOwnerId]
 * @param {Function} deps.showToast
 * @param {Document} [doc=document]
 */
export function renderFormulareSettings(deps, doc = document) {
  if (deps?.profile?.role !== 'owner') return;

  const anker = doc.getElementById('settingsFaxSection')
    || doc.getElementById('settingsRechtslinksSection')
    || doc.getElementById('settingsProfileSection');

  if (!anker) return;

  let sec = doc.getElementById('settingsFormulareSection');
  if (!sec) {
    sec = abschnittBauen(deps, doc);
    anker.after(sec);
  }

  ladeFormulareListe(deps, doc);
}

function abschnittBauen(deps, doc) {
  const sec = doc.createElement('div');
  sec.className = 'settings-section';
  sec.id = 'settingsFormulareSection';

  const titel = doc.createElement('div');
  titel.className = 'settings-section-title';
  titel.textContent = 'Eigene Formulare';

  const body = doc.createElement('div');
  body.className = 'settings-section-body';

  const hinweis = doc.createElement('p');
  hinweis.style.cssText = 'font-size:13px;color:var(--text-muted);margin:0 0 16px;line-height:1.5;';
  hinweis.textContent = 'Laden Sie eigene PDF-Formulare hoch und legen Sie Unterschriftsfelder fest. '
    + 'Die Formulare können direkt in der Patientenakte oder am Kiosk unterschrieben werden.';
  body.append(hinweis);

  const actionRow = doc.createElement('div');
  actionRow.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;';

  const uploadLabel = doc.createElement('label');
  uploadLabel.className = 'btn-primary';
  uploadLabel.id = 'btnFormularHochladen';
  uploadLabel.style.cssText = 'min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 20px;cursor:pointer;font-weight:600;box-sizing:border-box;border-radius:6px;user-select:none;';
  uploadLabel.innerHTML = '<span>Formular hochladen</span><input type="file" id="formularFileInput" accept="application/pdf,.pdf" style="display:none;">';

  const rechtshinweis = doc.createElement('span');
  rechtshinweis.style.cssText = 'font-size:12px;color:var(--text-muted);line-height:1.4;flex:1;min-width:200px;';
  rechtshinweis.textContent = 'Inhalt verantwortet die Praxis. Praxura prüft den Text der Formulare nicht.';

  actionRow.append(uploadLabel, rechtshinweis);
  body.append(actionRow);

  const listeBox = doc.createElement('div');
  listeBox.id = 'formulareListeContainer';
  listeBox.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  body.append(listeBox);

  sec.append(titel, body);

  const fileInput = uploadLabel.querySelector('#formularFileInput');
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    zeigeUploadModal(deps, doc, file, () => {
      fileInput.value = '';
      ladeFormulareListe(deps, doc);
    });
  });

  return sec;
}

async function ladeFormulareListe(deps, doc) {
  const container = doc.getElementById('formulareListeContainer');
  if (!container) return;

  const ownerId = typeof deps.getOwnerId === 'function'
    ? deps.getOwnerId()
    : (deps.profile?.owner_id || (typeof deps.userId === 'function' ? deps.userId() : deps.userId));

  if (!ownerId) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">Inhaber-Kontext fehlt.</div>';
    return;
  }

  container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:12px 0;">Formulare werden geladen...</div>';

  try {
    const { data: formulare, error } = await deps.supabase
      .from('praxis_formulare')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('aktiv', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!formulare || formulare.length === 0) {
      container.innerHTML = `
        <div style="padding:24px;border:1px dashed var(--border);border-radius:8px;background:var(--bg-card-solid);text-align:center;color:var(--text-muted);font-size:14px;">
          Noch keine eigenen Formulare vorhanden. Laden Sie ein PDF-Formular hoch, um zu beginnen.
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    for (const f of formulare) {
      const card = doc.createElement('div');
      card.className = 'formular-karte';
      card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card-solid);box-sizing:border-box;flex-wrap:wrap;';

      const links = doc.createElement('div');
      links.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px;';

      const titelZeile = doc.createElement('div');
      titelZeile.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

      const titelText = doc.createElement('span');
      titelText.style.cssText = 'font-weight:600;font-size:15px;color:var(--text-main);';
      titelText.textContent = f.titel || 'Unbenanntes Formular';
      titelZeile.append(titelText);

      if (f.ist_einwilligung) {
        const badge = doc.createElement('span');
        badge.style.cssText = 'background:var(--primary-dim);color:var(--primary);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;';
        badge.textContent = 'Einwilligung';
        titelZeile.append(badge);
      }

      const felderAnzahl = Array.isArray(f.signatur_felder) ? f.signatur_felder.length : 0;
      const details = doc.createElement('div');
      details.style.cssText = 'font-size:12px;color:var(--text-muted);';
      details.textContent = `${felderAnzahl} Unterschriftsfeld${felderAnzahl === 1 ? '' : 'er'} definiert`;

      links.append(titelZeile, details);

      const rechts = doc.createElement('div');
      rechts.style.cssText = 'display:flex;align-items:center;gap:8px;';

      const editBtn = doc.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn';
      editBtn.style.cssText = 'min-height:44px;padding:0 16px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card-solid);color:var(--text-main);cursor:pointer;font-size:13px;font-weight:500;';
      editBtn.textContent = 'Unterschriftsfelder festlegen';
      editBtn.addEventListener('click', () => {
        oeffneFormularEditor({
          deps,
          ownerId,
          formular: f,
          onGespeichert: () => ladeFormulareListe(deps, doc),
        });
      });

      const delBtn = doc.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn';
      delBtn.style.cssText = 'min-height:44px;padding:0 14px;border:1px solid var(--danger);border-radius:6px;background:var(--danger-dim);color:var(--danger);cursor:pointer;font-size:13px;font-weight:500;';
      delBtn.textContent = 'Entfernen';
      delBtn.addEventListener('click', async () => {
        const best = window.confirm(`Möchten Sie das Formular „${f.titel}" wirklich entfernen?`);
        if (!best) return;

        delBtn.disabled = true;
        try {
          const { error: delErr } = await deps.supabase
            .from('praxis_formulare')
            .update({ aktiv: false })
            .eq('id', f.id)
            .eq('owner_id', ownerId);

          if (delErr) throw delErr;
          deps.showToast('Formular entfernt.');
          ladeFormulareListe(deps, doc);
        } catch (err) {
          console.error('[formular-editor] Fehler beim Deaktivieren', err);
          deps.showToast('Entfernen fehlgeschlagen: ' + (err.message || err), 'error');
        } finally {
          delBtn.disabled = false;
        }
      });

      rechts.append(editBtn, delBtn);
      card.append(links, rechts);
      container.append(card);
    }
  } catch (err) {
    console.error('[formular-editor] Fehler beim Laden der Formulare', err);
    container.innerHTML = `<div style="font-size:13px;color:var(--danger);padding:12px 0;">Fehler beim Laden: ${escapeHtml(err.message || err)}</div>`;
  }
}

function zeigeUploadModal(deps, doc, file, onFertig) {
  const check = pruefeFormularDatei({ name: file.name, size: file.size, type: file.type });
  if (!check.ok) {
    deps.showToast(check.fehler, 'error');
    return;
  }

  const modal = doc.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  const dialog = doc.createElement('div');
  dialog.style.cssText = 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:10px;padding:24px;width:100%;max-width:480px;box-sizing:border-box;box-shadow:0 8px 30px rgba(0,0,0,0.25);';

  const stdTitel = file.name.replace(/\.pdf$/i, '');

  dialog.innerHTML = `
    <h3 style="margin:0 0 12px;font-size:18px;font-weight:700;">Formular hochladen</h3>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
      Datei: <strong>${escapeHtml(file.name)}</strong> (${Math.round(file.size / 1024)} KB)
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label class="form-label" style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;">Titel des Formulars</label>
      <input type="text" id="fuModalTitel" class="form-input" value="${escapeHtml(stdTitel)}" style="width:100%;min-height:44px;padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text-main);box-sizing:border-box;">
    </div>
    <div style="margin-bottom:20px;display:flex;align-items:center;gap:10px;">
      <input type="checkbox" id="fuModalEinwilligung" style="width:20px;height:20px;cursor:pointer;">
      <label for="fuModalEinwilligung" style="font-size:13px;cursor:pointer;user-select:none;">
        Ist eine Einwilligung (wird als Einwilligung protokolliert)
      </label>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;line-height:1.4;">
      Inhalt verantwortet die Praxis. Praxura prüft den Text der Formulare nicht.
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;">
      <button type="button" id="fuModalAbbrechen" class="btn" style="min-height:44px;padding:0 18px;border:1px solid var(--border);border-radius:6px;background:none;color:var(--text-muted);cursor:pointer;">Abbrechen</button>
      <button type="button" id="fuModalSpeichern" class="btn-primary" style="min-height:44px;padding:0 20px;border-radius:6px;cursor:pointer;font-weight:600;">Hochladen</button>
    </div>
  `;

  modal.appendChild(dialog);
  doc.body.appendChild(modal);

  const schliessen = () => {
    modal.remove();
  };

  dialog.querySelector('#fuModalAbbrechen').addEventListener('click', schliessen);

  dialog.querySelector('#fuModalSpeichern').addEventListener('click', async () => {
    const titelVal = (dialog.querySelector('#fuModalTitel').value || '').trim();
    if (!titelVal) {
      deps.showToast('Bitte einen Titel angeben.', 'error');
      dialog.querySelector('#fuModalTitel').focus();
      return;
    }

    const istEinwilligung = !!dialog.querySelector('#fuModalEinwilligung').checked;
    const saveBtn = dialog.querySelector('#fuModalSpeichern');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Wird hochgeladen...';

    const ownerId = typeof deps.getOwnerId === 'function'
      ? deps.getOwnerId()
      : (deps.profile?.owner_id || (typeof deps.userId === 'function' ? deps.userId() : deps.userId));

    const userId = typeof deps.userId === 'function' ? deps.userId() : deps.userId;

    try {
      const buffer = await file.arrayBuffer();
      const sha256 = await berechneSha256(buffer);
      const uuid = crypto.randomUUID();
      const sName = saubererName(file.name);
      const storagePath = `${ownerId}/formulare/${uuid}-${sName}`;

      const { error: upErr } = await deps.supabase.storage
        .from('patient-documents')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false });

      if (upErr) throw upErr;

      const row = {
        owner_id: ownerId,
        titel: titelVal,
        storage_path: storagePath,
        pdf_sha256: sha256,
        signatur_felder: [],
        ist_einwilligung: istEinwilligung,
        consent_type: 'praxis_formular',
        created_by: userId || null,
      };

      const { data: inserted, error: insErr } = await deps.supabase
        .from('praxis_formulare')
        .insert(row)
        .select('*')
        .maybeSingle();

      if (insErr) {
        try {
          await deps.supabase.storage.from('patient-documents').remove([storagePath]);
        } catch (_) {}
        throw insErr;
      }

      deps.showToast('Formular hochgeladen.');
      schliessen();
      if (typeof onFertig === 'function') onFertig();

      if (inserted) {
        oeffneFormularEditor({
          deps,
          ownerId,
          formular: inserted,
          onGespeichert: onFertig,
        });
      }
    } catch (err) {
      console.error('[formular-editor] Upload-Fehler', err);
      deps.showToast('Upload fehlgeschlagen: ' + (err.message || err), 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Hochladen';
    }
  });
}

/**
 * Öffnet den Vollbild-Editor zum Festlegen von Signaturfeldern auf dem PDF.
 */
export async function oeffneFormularEditor({ deps, ownerId, formular, onGespeichert }) {
  if (!formular) return;

  const doc = document;
  const overlay = doc.createElement('div');
  overlay.className = 'formular-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg-main);display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;';

  overlay.innerHTML = `
    <div style="min-height:56px;padding:8px 16px;border-bottom:1px solid var(--border);background:var(--bg-card-solid);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-sizing:border-box;z-index:10;">
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:240px;">
        <span style="font-weight:700;font-size:16px;color:var(--text-main);">Formular-Editor:</span>
        <input type="text" id="feFormTitel" value="${escapeHtml(formular.titel)}" class="form-input" style="flex:1;min-height:40px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text-main);font-size:14px;box-sizing:border-box;">
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;user-select:none;white-space:nowrap;">
          <input type="checkbox" id="feIstEinwilligung" ${formular.ist_einwilligung ? 'checked' : ''} style="width:18px;height:18px;">
          <span>Einwilligung</span>
        </label>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button type="button" id="feFeldHinzufuegen" class="btn" style="min-height:44px;padding:0 16px;border:1px solid var(--primary);border-radius:6px;background:var(--primary-dim);color:var(--primary);cursor:pointer;font-weight:600;font-size:13px;">
          + Unterschriftsfeld hinzufügen
        </button>
        <button type="button" id="feSpeichern" class="btn-primary" style="min-height:44px;padding:0 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">
          Speichern
        </button>
        <button type="button" id="feSchliessen" class="btn" style="min-height:44px;padding:0 16px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card-solid);color:var(--text-muted);cursor:pointer;font-size:13px;">
          Schließen
        </button>
      </div>
    </div>
    <div id="fePdfScrollContainer" style="flex:1;overflow-y:auto;overflow-x:hidden;padding:24px 16px;background:var(--bg-main);box-sizing:border-box;">
      <div id="fePdfLadeHinweis" style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">
        PDF-Seiten werden gerendert...
      </div>
      <div id="fePdfSeitenHost"></div>
    </div>
  `;

  doc.body.appendChild(overlay);

  let abgebrochen = false;
  let pdfViewer = null;
  const abortController = new AbortController();

  let felder = Array.isArray(formular.signatur_felder)
    ? JSON.parse(JSON.stringify(formular.signatur_felder))
    : [];

  const hostEl = overlay.querySelector('#fePdfSeitenHost');
  const scrollContainer = overlay.querySelector('#fePdfScrollContainer');
  const ladeHinweis = overlay.querySelector('#fePdfLadeHinweis');

  const cleanup = () => {
    abgebrochen = true;
    abortController.abort();
    doc.removeEventListener('keydown', onKeyDown);
    if (pdfViewer && typeof pdfViewer.destroy === 'function') {
      pdfViewer.destroy();
    }
    overlay.remove();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };
  doc.addEventListener('keydown', onKeyDown);

  overlay.querySelector('#feSchliessen').addEventListener('click', cleanup);

  try {
    const { data: fileBlob, error: dlErr } = await deps.supabase.storage
      .from('patient-documents')
      .download(formular.storage_path);

    if (abgebrochen) return;

    let blob = fileBlob;
    if (dlErr || !fileBlob) {
      const { data: signData, error: signErr } = await deps.supabase.storage
        .from('patient-documents')
        .createSignedUrl(formular.storage_path, 300);

      if (abgebrochen) return;
      if (signErr || !signData?.signedUrl) {
        throw new Error('PDF-Datei konnte nicht aus dem Speicher geladen werden.');
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

    zeichneFelder();
  } catch (err) {
    if (abgebrochen) return;
    console.error('[formular-editor] Render-Fehler', err);
    ladeHinweis.innerHTML = `<span style="color:var(--danger);">Fehler beim Laden des PDFs: ${escapeHtml(err.message || err)}</span>`;
  }

  function ermittleSichtbareSeite() {
    if (!pdfViewer || !pdfViewer.seiten || pdfViewer.seiten.length === 0) return 1;
    const containerTop = scrollContainer.scrollTop;
    for (const s of pdfViewer.seiten) {
      const top = s.seiteEl.offsetTop;
      const bottom = top + s.seiteEl.offsetHeight;
      if (bottom > containerTop + 60) {
        return s.seiteNum;
      }
    }
    return 1;
  }

  function aktualisiereAddButtonStatus() {
    const btnAdd = overlay.querySelector('#feFeldHinzufuegen');
    if (!btnAdd) return;
    const voll = felder.length >= MAX_SIGNATUR_FELDER;
    btnAdd.disabled = voll;
    btnAdd.style.opacity = voll ? '0.5' : '1';
    btnAdd.style.cursor = voll ? 'not-allowed' : 'pointer';
  }

  function zeichneFelder() {
    if (!pdfViewer || !pdfViewer.seiten) return;

    aktualisiereAddButtonStatus();

    for (const s of pdfViewer.seiten) {
      s.overlayEl.innerHTML = '';
      s.overlayEl.style.pointerEvents = 'none';
    }

    felder.forEach((f, idx) => {
      const sNum = Number(f.seite) || 1;
      const seiteObj = pdfViewer.seiten.find(s => s.seiteNum === sNum) || pdfViewer.seiten[0];
      if (!seiteObj) return;

      const box = doc.createElement('div');
      box.className = 'fe-signatur-kasten';
      box.style.cssText = `
        position:absolute;
        left:${f.x}%;
        top:${f.y}%;
        width:${f.w}%;
        height:${f.h}%;
        border:2px dashed var(--primary);
        background:var(--primary-dim);
        border-radius:4px;
        box-sizing:border-box;
        cursor:move;
        touch-action:none;
        pointer-events:auto;
        display:flex;
        align-items:center;
        justify-content:center;
        user-select:none;
      `;

      const beschriftung = doc.createElement('span');
      beschriftung.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-main);pointer-events:none;text-align:center;line-height:1.2;padding:2px;';
      beschriftung.textContent = `Unterschrift ${idx + 1}`;
      box.appendChild(beschriftung);

      const delBtn = doc.createElement('button');
      delBtn.type = 'button';
      delBtn.title = 'Feld entfernen';
      delBtn.style.cssText = 'position:absolute;top:2px;right:2px;width:28px;height:28px;border:1px solid var(--danger);border-radius:4px;background:var(--danger-dim);color:var(--danger);cursor:pointer;font-size:15px;font-weight:bold;display:flex;align-items:center;justify-content:center;padding:0;z-index:2;';
      delBtn.innerHTML = '&times;';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        felder.splice(idx, 1);
        zeichneFelder();
      });
      box.appendChild(delBtn);

      const griff = doc.createElement('div');
      griff.className = 'fe-resize-griff';
      griff.title = 'Größe anpassen';
      griff.style.cssText = 'position:absolute;right:0;bottom:0;width:28px;height:28px;cursor:nwse-resize;touch-action:none;display:flex;align-items:flex-end;justify-content:flex-end;padding:3px;z-index:2;box-sizing:border-box;';
      griff.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" style="pointer-events:none;"><path d="M11 1v10H1" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
      box.appendChild(griff);

      verdrahteBoxEvents(box, griff, f, seiteObj);

      seiteObj.overlayEl.appendChild(box);
    });
  }

  function verdrahteBoxEvents(box, griff, feld, seiteObj) {
    const bPx = seiteObj.breitePx;
    const hPx = seiteObj.hoehePx;

    // 1. Verschieben per Pointer-Events
    box.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.fe-resize-griff') || e.target.closest('button')) return;
      e.preventDefault();
      try {
        box.setPointerCapture?.(e.pointerId);
      } catch (_) {}

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const startX = feld.x;
      const startY = feld.y;

      const onPointerMove = (ev) => {
        const dxPx = ev.clientX - startClientX;
        const dyPx = ev.clientY - startClientY;
        const dxPct = (dxPx / bPx) * 100;
        const dyPct = (dyPx / hPx) * 100;

        const neu = begrenzeFeld({
          ...feld,
          x: startX + dxPct,
          y: startY + dyPct,
        }, 6, 40);

        feld.x = neu.x;
        feld.y = neu.y;
        box.style.left = `${neu.x}%`;
        box.style.top = `${neu.y}%`;
      };

      const onPointerUp = (ev) => {
        try {
          if (ev && ev.pointerId !== undefined) {
            box.releasePointerCapture?.(ev.pointerId);
          }
        } catch (_) {}
        box.removeEventListener('pointermove', onPointerMove);
        box.removeEventListener('pointerup', onPointerUp);
        box.removeEventListener('pointercancel', onPointerUp);
      };

      box.addEventListener('pointermove', onPointerMove);
      box.addEventListener('pointerup', onPointerUp);
      box.addEventListener('pointercancel', onPointerUp);
    });

    // 2. Skalieren per Pointer-Events (bleibt quadratisch in Pixeln)
    griff.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        griff.setPointerCapture?.(e.pointerId);
      } catch (_) {}

      const startClientX = e.clientX;
      const startWPx = (feld.w / 100) * bPx;

      const onResizeMove = (ev) => {
        const dxPx = ev.clientX - startClientX;
        const neuWPx = startWPx + dxPx;
        const neuWPct = (neuWPx / bPx) * 100;

        // Breite vorab durch Restplatz begrenzen
        const maxW = Math.min(40, 100 - feld.x, (100 - feld.y) * (bPx / hPx));
        const w = Math.max(6, Math.min(neuWPct, maxW));
        const h = quadratischH(w, bPx, hPx);

        if (feld.y + h > 100) {
          feld.y = Math.max(0, 100 - h);
          box.style.top = `${feld.y}%`;
        }

        feld.w = Math.round(w * 1000) / 1000;
        feld.h = Math.round(h * 1000) / 1000;

        box.style.width = `${feld.w}%`;
        box.style.height = `${feld.h}%`;
      };

      const onResizeUp = (ev) => {
        try {
          if (ev && ev.pointerId !== undefined) {
            griff.releasePointerCapture?.(ev.pointerId);
          }
        } catch (_) {}
        griff.removeEventListener('pointermove', onResizeMove);
        griff.removeEventListener('pointerup', onResizeUp);
        griff.removeEventListener('pointercancel', onResizeUp);
      };

      griff.addEventListener('pointermove', onResizeMove);
      griff.addEventListener('pointerup', onResizeUp);
      griff.addEventListener('pointercancel', onResizeUp);
    });
  }

  overlay.querySelector('#feFeldHinzufuegen').addEventListener('click', () => {
    if (felder.length >= MAX_SIGNATUR_FELDER) {
      deps.showToast('Maximal 10 Unterschriftsfelder erlaubt.', 'error');
      return;
    }

    if (!pdfViewer || !pdfViewer.seiten || pdfViewer.seiten.length === 0) return;

    const seiteNum = ermittleSichtbareSeite();
    const seiteObj = pdfViewer.seiten.find(s => s.seiteNum === seiteNum) || pdfViewer.seiten[0];
    const bPx = seiteObj.breitePx;
    const hPx = seiteObj.hoehePx;

    const startW = 20;
    const startH = quadratischH(startW, bPx, hPx);

    const neuesFeld = begrenzeFeld({
      seite: seiteNum,
      x: 25,
      y: 25,
      w: startW,
      h: startH,
    }, 6, 40);

    felder.push(neuesFeld);
    zeichneFelder();
  });

  overlay.querySelector('#feSpeichern').addEventListener('click', async () => {
    const titelVal = (overlay.querySelector('#feFormTitel').value || '').trim();
    if (!titelVal) {
      deps.showToast('Bitte einen Formulartitel angeben.', 'error');
      overlay.querySelector('#feFormTitel').focus();
      return;
    }

    if (felder.length > MAX_SIGNATUR_FELDER) {
      deps.showToast('Maximal 10 Unterschriftsfelder erlaubt.', 'error');
      return;
    }

    const istEinwilligung = !!overlay.querySelector('#feIstEinwilligung').checked;
    const saveBtn = overlay.querySelector('#feSpeichern');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Wird gespeichert...';

    try {
      const saubereFelder = felder.map(f => ({
        seite: Number(f.seite) || 1,
        x: Math.round(Number(f.x) * 1000) / 1000,
        y: Math.round(Number(f.y) * 1000) / 1000,
        w: Math.round(Number(f.w) * 1000) / 1000,
        h: Math.round(Number(f.h) * 1000) / 1000,
      }));

      const patch = {
        titel: titelVal,
        ist_einwilligung: istEinwilligung,
        signatur_felder: saubereFelder,
      };

      const { error: upErr } = await deps.supabase
        .from('praxis_formulare')
        .update(patch)
        .eq('id', formular.id)
        .eq('owner_id', ownerId);

      if (upErr) throw upErr;

      deps.showToast('Formular gespeichert.');
      cleanup();
      if (typeof onGespeichert === 'function') onGespeichert();
    } catch (err) {
      console.error('[formular-editor] Fehler beim Speichern', err);
      deps.showToast('Speichern fehlgeschlagen: ' + (err.message || err), 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Speichern';
    }
  });
}
