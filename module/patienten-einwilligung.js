/**
 * patienten-einwilligung.js — digitale Einwilligung mit Unterschrift
 *
 * Konsey 2026-08-14 · konsey/tutanak/2026-08-14-patienten-uebergabe-einwilligung.md
 * Auslöser: Beta-Kunde Beta-2 — „ich habe so einen Stapel Papier".
 *
 * Der Ablauf, wie ihn `podoloji` beschrieben hat
 * ──────────────────────────────────────────────
 * Empfang → Einwilligung unterschreiben → Anamnese GEMEINSAM mit der Podologin.
 * Das Tablet wird vorbereitet, bevor der Patient da ist. Die Podologin dreht
 * sich mit Handschuhen nicht mehr zum Bildschirm um.
 *
 * EIN Ablauf, ZWEI Bildschirme, ZWEI Unterschriften
 * ─────────────────────────────────────────────────
 * Das ist keine Design-Laune, es ist eine bindende Auflage von `legal-de`:
 *   Bildschirm 1  Behandlungsvertrag + Ausfallregelung  (§ 630d BGB)
 *   Bildschirm 2  Datenschutz-Einwilligung              (Art. 7 DSGVO)
 * Zusammenlegen wäre ein Koppelungsverbots-Risiko: Bildschirm 1 ist Bedingung
 * der Behandlung, Bildschirm 2 ist freiwillig und jederzeit widerruflich. Wer
 * beides in eine Unterschrift presst, macht die zweite unwirksam.
 * `podoloji` wollte EINE Unterschrift („Klick-Ökonomie") — abgelehnt. Der
 * Kompromiss ist die Form: ein Fluss, ein „Weiter", zwei Fingerabdrücke.
 *
 * Was hier bewusst NICHT passiert
 * ───────────────────────────────
 *  · Keine IP-Adresse. Auf dem Praxis-Tablet ist das der Praxisrouter —
 *    Beweiswert null, also Art. 5 Abs. 1 lit. c (Datenminimierung).
 *    `consent_log` hat so eine Spalte; das Muster wird NICHT übernommen.
 *  · Keine Signaturdynamik (Druck, Geschwindigkeit, Strichzeiten). Nur das
 *    fertige Rasterbild. Dynamik würde die Diskussion um Art. 9 (biometrisches
 *    Datum) eröffnen — unnötiges Risiko für null Mehrwert.
 *  · Keine QES, kein Signaturdienstleister. Für § 630d BGB und Art. 7 DSGVO
 *    gilt keine Schriftform (§ 126 BGB); die einfache elektronische Signatur
 *    genügt und ist nach eIDAS Art. 25 vor Gericht nicht zurückweisbar.
 *
 * Nachweis (Art. 7 Abs. 1 DSGVO)
 * ──────────────────────────────
 * Gespeichert wird nicht „Häkchen gesetzt", sondern der VOLLE Text, den der
 * Patient gesehen hat — als `text_snapshot`, dazu `text_version` und
 * `text_sha256`. Ändert die Praxis später den Vorlagentext, bleibt der alte
 * Nachweis unberührt. Die DB verhindert Änderungen zusätzlich per Trigger
 * (`trg_patient_consents_immutable`) und Löschen 10 Jahre lang (§ 630f Abs. 3 BGB).
 */

import { EINWILLIGUNG_TEXTE, renderEinwilligungText, sha256Hex } from './einwilligung-texte.js?v=20260814';

const BUCKET = 'patient-documents';   // existiert bereits, keine neue Infrastruktur

// Reihenfolge des Ablaufs. Der Behandlungsvertrag zuerst — ohne ihn keine
// Behandlung; die Datenschutz-Einwilligung danach, freiwillig.
const FLOW = ['behandlungsvertrag', 'datenschutz'];

let deps = {};
let _root = null;
let _state = null;

function d(id) { return document.getElementById(id); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function heute() { return new Date().toLocaleDateString('de-DE'); }

function patientName(p) {
  if (!p) return '';
  const n = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return n || p.title || '';
}

// =====================================================================
// Mount
// =====================================================================

/**
 * @param {object} injected { supabase, getOwnerId, getProfile, getBusinessId,
 *                            getSessionUserId, showToast }
 */
export function mountEinwilligung(injected = {}) {
  deps = { showToast: (m) => console.log(m), ...injected };
  ensureRoot();
}

function ensureRoot() {
  if (_root && document.body.contains(_root)) return _root;
  _root = document.createElement('div');
  _root.id = 'einwilligungOverlay';
  _root.hidden = true;
  // z-index über dem Kiosk-Overlay (99999), unter dessen PIN-Modal (100000)
  // liegt es bewusst NICHT: die Einwilligung darf den Kiosk-Ausstieg verdecken.
  _root.style.cssText =
    'position:fixed;inset:0;z-index:99998;background:var(--bg-main);'
    + 'display:flex;flex-direction:column;overflow:auto;';
  document.body.appendChild(_root);
  return _root;
}

// =====================================================================
// Ablauf
// =====================================================================

/**
 * Startet den Einwilligungs-Ablauf für einen Patienten.
 * @param {object} opts { patientId, patient?, types? }
 */
export async function openEinwilligungFlow(opts = {}) {
  const { patientId } = opts;
  if (!patientId) { deps.showToast('Kein Patient ausgewählt.', 'error'); return; }

  let patient = opts.patient;
  if (!patient) {
    const { data, error } = await deps.supabase
      .from('leads')
      .select('id, title, first_name, last_name, geburtsdatum')
      .eq('id', patientId)
      .maybeSingle();               // .single() liefert 406, wenn nichts da ist
    if (error || !data) { deps.showToast('Patient konnte nicht geladen werden.', 'error'); return; }
    patient = data;
  }

  const profile = deps.getProfile?.() || {};
  _state = {
    patient,
    profile,
    step: 0,
    types: Array.isArray(opts.types) && opts.types.length ? opts.types : FLOW.slice(),
    optionen: [],
    gespeichert: [],
  };

  ensureRoot().hidden = false;
  document.body.style.overflow = 'hidden';
  renderStep();
}

function closeFlow() {
  if (_root) { _root.hidden = true; _root.innerHTML = ''; }
  document.body.style.overflow = '';
  _state = null;
}

function ctxFor() {
  const p = _state.profile || {};
  return {
    // Spaltennamen gegen db/SCHEMA.sql (Tabelle profiles) geprüft — nicht raten.
    praxis_name: p.business_name
      || [p.owner_first_name, p.owner_last_name].filter(Boolean).join(' ')
      || 'die Praxis',
    praxis_adresse: [p.street, [p.plz, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    patient_name: patientName(_state.patient),
    patient_geburtsdatum: _state.patient.geburtsdatum
      ? new Date(_state.patient.geburtsdatum).toLocaleDateString('de-DE')
      : '—',
    datum: heute(),
    profile: p,
    optionen: _state.optionen,
  };
}

function renderStep() {
  const type = _state.types[_state.step];
  const def = EINWILLIGUNG_TEXTE[type];
  if (!def) { closeFlow(); return; }

  const total = _state.types.length;
  const nr = _state.step + 1;

  // Schriftgrößen ab 18px, kurze Blöcke, Unterschriftenfeld über die volle
  // Breite: das Tablet landet bei 70- bis 80-jährigen, oft diabetischen
  // Patienten — kleine Typo und langes Scrollen sind dort keine Kosmetik.
  const optionenHtml = Array.isArray(def.optionen) && def.optionen.length
    ? `<fieldset style="border:1px solid var(--border);border-radius:12px;padding:16px;margin:20px 0;">
         <legend style="font-size:17px;font-weight:700;color:var(--text-main);padding:0 8px;">Freiwillig — bitte ankreuzen</legend>
         ${def.optionen.map(o => `
           <label style="display:flex;gap:12px;align-items:flex-start;padding:12px 4px;font-size:18px;line-height:1.5;color:var(--text-main);cursor:pointer;">
             <input type="checkbox" class="ew-option" value="${esc(o.key)}" style="width:26px;height:26px;flex:0 0 auto;margin-top:2px;">
             <span>${esc(o.label)}</span>
           </label>`).join('')}
         <p style="margin:8px 4px 0;font-size:15px;color:var(--text-muted);">
           Ihre Behandlung ändert sich nicht, wenn Sie hier nichts ankreuzen.
         </p>
       </fieldset>`
    : '';

  _root.innerHTML = `
    <div style="max-width:760px;margin:0 auto;width:100%;box-sizing:border-box;padding:24px 20px 40px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;">
        <div style="font-size:15px;font-weight:600;color:var(--text-muted);">Schritt ${nr} von ${total}</div>
        <button id="ewAbbrechen" style="padding:10px 16px;min-height:44px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:15px;cursor:pointer;">Abbrechen</button>
      </div>

      <h2 style="margin:0 0 6px;font-size:26px;line-height:1.25;color:var(--text-main);">${esc(def.titel)}</h2>
      <p style="margin:0 0 20px;font-size:16px;color:var(--text-muted);">
        ${esc(patientName(_state.patient))} &middot; ${esc(heute())}
      </p>

      <ul style="list-style:none;padding:0;margin:0 0 20px;">
        ${def.kurzfassung.map(k => `
          <li style="display:flex;gap:12px;align-items:flex-start;padding:12px 14px;margin-bottom:8px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:12px;font-size:19px;line-height:1.45;color:var(--text-main);">
            <span aria-hidden="true" style="color:var(--primary);flex:0 0 auto;">&#10003;</span>
            <span>${esc(ersetzeAnzeige(k))}</span>
          </li>`).join('')}
      </ul>

      ${optionenHtml}

      <details style="margin-bottom:24px;border:1px solid var(--border);border-radius:12px;background:var(--bg-card-solid);">
        <summary style="padding:16px;font-size:18px;font-weight:600;color:var(--text-main);cursor:pointer;">Vollständigen Text lesen</summary>
        <pre id="ewVolltext" style="margin:0;padding:0 16px 16px;font-family:inherit;font-size:16px;line-height:1.6;color:var(--text-main);white-space:pre-wrap;word-break:break-word;"></pre>
      </details>

      <div style="margin-bottom:8px;font-size:18px;font-weight:600;color:var(--text-main);">
        Bitte hier unterschreiben
      </div>
      <div style="position:relative;border:2px dashed var(--border-strong);border-radius:12px;background:var(--bg-card-solid);touch-action:none;">
        <canvas id="ewCanvas" style="display:block;width:100%;height:200px;border-radius:10px;touch-action:none;"></canvas>
        <div id="ewHinweis" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;color:var(--text-faint);font-size:17px;">
          Mit dem Finger unterschreiben
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
        <button id="ewLoeschen" style="flex:1 1 160px;padding:14px;min-height:52px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:17px;cursor:pointer;">Nochmal</button>
        <button id="ewWeiter" style="flex:2 1 220px;padding:14px;min-height:52px;background:var(--primary);border:none;border-radius:10px;color:var(--bg-card-solid);font-size:18px;font-weight:700;cursor:pointer;">
          ${nr < total ? 'Weiter' : 'Fertig'}
        </button>
      </div>
      <div id="ewFehler" role="alert" style="margin-top:10px;min-height:22px;color:var(--danger);font-size:16px;"></div>
    </div>`;

  aktualisiereVolltext();

  _root.querySelectorAll('.ew-option').forEach(cb => {
    cb.addEventListener('change', () => {
      _state.optionen = Array.from(_root.querySelectorAll('.ew-option:checked')).map(x => x.value);
      aktualisiereVolltext();       // Auswahl ist Teil des unterschriebenen Textes
    });
  });

  const pad = signaturePad(d('ewCanvas'), d('ewHinweis'));
  d('ewLoeschen').addEventListener('click', () => pad.clear());
  d('ewAbbrechen').addEventListener('click', () => {
    if (window.confirm('Ablauf abbrechen? Bereits unterschriebene Erklärungen bleiben gespeichert.')) closeFlow();
  });
  d('ewWeiter').addEventListener('click', () => weiter(pad, type));

  _root.scrollTop = 0;
}

function ersetzeAnzeige(s) {
  const c = ctxFor();
  return String(s).replace(/\{\{(\w+)\}\}/g, (_, k) => c[k] ?? '');
}

function aktualisiereVolltext() {
  const type = _state.types[_state.step];
  const pre = d('ewVolltext');
  if (pre) pre.textContent = renderEinwilligungText(type, ctxFor()).text;
}

async function weiter(pad, type) {
  const fehler = d('ewFehler');
  const btn = d('ewWeiter');
  const setzeFehler = (m) => { if (fehler) fehler.textContent = m || ''; };
  setzeFehler('');

  if (pad.isEmpty()) {
    setzeFehler('Bitte unterschreiben Sie im Feld oben.');
    return;
  }

  btn.disabled = true;
  try {
    await speichereEinwilligung(type, pad);
    _state.gespeichert.push(type);

    if (_state.step + 1 < _state.types.length) {
      _state.step += 1;
      renderStep();
    } else {
      deps.showToast('Einwilligung gespeichert.');
      const patientId = _state.patient.id;
      closeFlow();
      // Liste im Patientenblatt aktualisieren, falls sichtbar
      const box = d('pdEinwilligungContent');
      if (box) renderEinwilligungListe(box, patientId);
    }
  } catch (e) {
    console.error('[einwilligung]', e);
    setzeFehler('Speichern fehlgeschlagen: ' + (e.message || 'unbekannter Fehler'));
  } finally {
    btn.disabled = false;
  }
}

async function speichereEinwilligung(type, pad) {
  const ownerId = deps.getOwnerId?.();
  if (!ownerId) throw new Error('Kein Inhaber-Kontext');

  const gerendert = renderEinwilligungText(type, ctxFor());
  const sha = await sha256Hex(gerendert.text);

  // Unterschrift als Raster-PNG. Bewusst kein Vektor mit Zeitachse — siehe
  // Dateikopf (Art. 9 / Signaturdynamik).
  const blob = await pad.toPngBlob();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${ownerId}/${_state.patient.id}/einwilligung_${type}_${stamp}.png`;

  const { error: upErr } = await deps.supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: false });
  if (upErr) throw new Error('Unterschrift konnte nicht abgelegt werden: ' + upErr.message);

  const row = {
    owner_id: ownerId,
    business_id: deps.getBusinessId?.() || null,
    patient_id: _state.patient.id,
    consent_type: type,
    text_version: gerendert.version,
    text_sha256: sha,
    text_snapshot: gerendert.text,
    signature_path: path,
    signed_name: patientName(_state.patient),
    captured_by_user_id: deps.getSessionUserId?.() || null,
    device_label: geraetLabel(),
  };

  const { error } = await deps.supabase.from('patient_consents').insert(row);
  if (error) {
    // Verwaiste Datei nicht liegen lassen.
    try { await deps.supabase.storage.from(BUCKET).remove([path]); } catch { /* egal */ }
    throw new Error(error.message);
  }
}

function geraetLabel() {
  try {
    const w = window.screen?.width || 0, h = window.screen?.height || 0;
    return `${navigator.platform || 'unknown'} ${w}x${h}`;
  } catch { return 'unknown'; }
}

// =====================================================================
// Unterschriftenfeld — Pointer Events, ohne Fremdbibliothek
// =====================================================================
// Kein `signature_pad` von einem CDN: G8 verbietet neue Drittanbieter-Skripte,
// weil jede zusätzliche Cloud-Kette die On-Prem-Migration teurer macht.

function signaturePad(canvas, hinweis) {
  const ctx = canvas.getContext('2d');
  let zeichnet = false;
  let leer = true;
  let letzte = null;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    // Vorhandene Zeichnung retten, sonst löscht ein Rotieren die Unterschrift.
    const alt = leer ? null : canvas.toDataURL('image/png');
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--text-main').trim() || '#1A1611';
    if (alt) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = alt;
    }
  }
  resize();
  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    zeichnet = true;
    letzte = pos(e);
    canvas.setPointerCapture?.(e.pointerId);
    // Einzelner Tipp soll auch einen Punkt hinterlassen.
    ctx.beginPath();
    ctx.arc(letzte.x, letzte.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
    leer = false;
    if (hinweis) hinweis.style.display = 'none';
  });

  canvas.addEventListener('pointermove', e => {
    if (!zeichnet) return;
    e.preventDefault();
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(letzte.x, letzte.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    letzte = p;
  });

  const stop = () => { zeichnet = false; letzte = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', stop);

  return {
    isEmpty: () => leer,
    clear() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      leer = true;
      if (hinweis) hinweis.style.display = '';
    },
    dataUrl: () => canvas.toDataURL('image/png'),
    toPngBlob() {
      return new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG-Erzeugung fehlgeschlagen'))), 'image/png');
      });
    },
    destroy() { window.removeEventListener('resize', onResize); },
  };
}

// =====================================================================
// Patientenblatt — Liste, Suche, Kopie
// =====================================================================
// Ohne diese beiden Dinge (Kopie für den Patienten, Wiederfinden im Blatt)
// druckt die Podologin weiter Papier und das ganze Modul verfehlt seinen Zweck.
// Deshalb sind sie laut Konsey ausdrücklich v1-Umfang, nicht Backlog.

const TYP_LABEL = {
  behandlungsvertrag: 'Behandlungsvertrag + Ausfallregelung',
  datenschutz: 'Datenschutz-Einwilligung',
  selbstzahler: 'Selbstzahler-Vereinbarung',
  foto: 'Foto-Einwilligung',
};

export async function renderEinwilligungListe(container, patientId) {
  if (!container) return;
  container.innerHTML = '<div style="padding:16px;color:var(--text-muted);">Wird geladen…</div>';

  const { data, error } = await deps.supabase
    .from('patient_consents')
    .select('id, consent_type, text_version, text_sha256, consented_at, signature_path, signed_name, revoked_at, revoke_reason')
    .eq('patient_id', patientId)
    .order('consented_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="padding:16px;color:var(--danger);">Fehler: ${esc(error.message)}</div>`;
    return;
  }

  const rows = data || [];
  const typen = Object.keys(TYP_LABEL).filter(t => rows.some(r => r.consent_type === t));

  container.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">
      <button id="ewNeuBtn" class="btn-primary" style="font-size:13px;">Einwilligung einholen</button>
      <input id="ewSuche" type="search" placeholder="Suchen (Typ, Datum, Version)…"
        style="flex:1 1 200px;min-width:160px;padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;color:var(--text-main);font-size:13px;">
      <select id="ewTypFilter" style="padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;color:var(--text-main);font-size:13px;">
        <option value="">Alle Typen</option>
        ${typen.map(t => `<option value="${esc(t)}">${esc(TYP_LABEL[t])}</option>`).join('')}
      </select>
    </div>
    <div id="ewListe"></div>`;

  const liste = container.querySelector('#ewListe');

  function zeichne() {
    const q = (container.querySelector('#ewSuche')?.value || '').toLowerCase().trim();
    const typ = container.querySelector('#ewTypFilter')?.value || '';
    const gefiltert = rows.filter(r => {
      if (typ && r.consent_type !== typ) return false;
      if (!q) return true;
      const hay = [
        TYP_LABEL[r.consent_type] || r.consent_type,
        r.text_version,
        new Date(r.consented_at).toLocaleDateString('de-DE'),
        r.signed_name || '',
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });

    if (!gefiltert.length) {
      liste.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">
        ${rows.length ? 'Keine Treffer.' : 'Für diesen Patienten liegt noch keine digitale Einwilligung vor.'}
      </div>`;
      return;
    }

    liste.innerHTML = gefiltert.map(r => {
      const dt = new Date(r.consented_at);
      const widerrufen = !!r.revoked_at;
      return `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 14px;margin-bottom:8px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card-solid);${widerrufen ? 'opacity:0.65;' : ''}">
        <div style="flex:1 1 240px;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--text-main);">
            ${esc(TYP_LABEL[r.consent_type] || r.consent_type)}
            ${widerrufen ? '<span style="margin-left:6px;font-size:11px;font-weight:700;color:var(--danger);">WIDERRUFEN</span>' : ''}
          </div>
          <div style="font-size:12px;color:var(--text-muted);">
            ${dt.toLocaleDateString('de-DE')} ${dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            &middot; ${esc(r.text_version)}
            &middot; SHA-256 ${esc((r.text_sha256 || '').slice(0, 12))}…
          </div>
        </div>
        <button class="btn-ghost ew-pdf" data-id="${esc(r.id)}" style="font-size:12px;padding:6px 10px;">Kopie / PDF</button>
        ${widerrufen ? '' : `<button class="btn-ghost ew-widerruf" data-id="${esc(r.id)}" style="font-size:12px;padding:6px 10px;color:var(--danger);">Widerruf</button>`}
      </div>`;
    }).join('');

    liste.querySelectorAll('.ew-pdf').forEach(b =>
      b.addEventListener('click', () => kopieOeffnen(rows.find(x => x.id === b.dataset.id))));
    liste.querySelectorAll('.ew-widerruf').forEach(b =>
      b.addEventListener('click', () => widerrufen(rows.find(x => x.id === b.dataset.id), container, patientId)));
  }

  container.querySelector('#ewSuche')?.addEventListener('input', zeichne);
  container.querySelector('#ewTypFilter')?.addEventListener('change', zeichne);
  container.querySelector('#ewNeuBtn')?.addEventListener('click', () => openEinwilligungFlow({ patientId }));
  zeichne();
}

/**
 * Widerruf nach Art. 7 Abs. 3 DSGVO. Der Nachweis wird NICHT gelöscht —
 * er wird markiert. Löschen wäre auch technisch blockiert (§ 630f, 10 Jahre).
 */
async function widerrufen(row, container, patientId) {
  if (!row) return;
  if (row.consent_type === 'behandlungsvertrag') {
    deps.showToast('Der Behandlungsvertrag ist keine widerrufliche Einwilligung nach Art. 7 DSGVO. Bitte die Behandlung regulär beenden.', 'error');
    return;
  }
  const grund = window.prompt('Widerruf festhalten. Grund (optional):', '');
  if (grund === null) return;

  const { error } = await deps.supabase
    .from('patient_consents')
    .update({ revoked_at: new Date().toISOString(), revoke_reason: grund || null })
    .eq('id', row.id);

  if (error) { deps.showToast('Widerruf fehlgeschlagen: ' + error.message, 'error'); return; }
  deps.showToast('Widerruf vermerkt.');
  renderEinwilligungListe(container, patientId);
}

/**
 * Kopie für den Patienten. Druckfenster statt PDF-Bibliothek: der Browser
 * kann „Als PDF speichern" und wir schleppen keine neue Abhängigkeit ein (G8).
 * Gedruckt wird der eingefrorene `text_snapshot`, nicht der aktuelle Vorlagentext.
 */
async function kopieOeffnen(row) {
  if (!row) return;

  const { data: voll, error } = await deps.supabase
    .from('patient_consents')
    .select('text_snapshot, text_version, text_sha256, consented_at, signed_name, signature_path, revoked_at')
    .eq('id', row.id)
    .maybeSingle();
  if (error || !voll) { deps.showToast('Kopie konnte nicht geladen werden.', 'error'); return; }

  let sigUrl = '';
  if (voll.signature_path) {
    const { data: s } = await deps.supabase.storage.from(BUCKET).createSignedUrl(voll.signature_path, 300);
    sigUrl = s?.signedUrl || '';
  }

  const dt = new Date(voll.consented_at);
  const win = window.open('', '_blank');
  if (!win) { deps.showToast('Bitte Pop-ups für diese Seite erlauben.', 'error'); return; }

  win.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
    <title>Einwilligung ${esc(voll.text_version)}</title>
    <style>
      body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.6;
             color: #111; max-width: 18cm; margin: 1.5cm auto; padding: 0 1cm; }
      pre  { font-family: inherit; font-size: 11.5pt; white-space: pre-wrap; word-break: break-word; margin: 0; }
      .sig { margin-top: 28px; border-top: 1px solid #999; padding-top: 8px; }
      .sig img { max-width: 8cm; max-height: 3cm; display: block; }
      .meta { margin-top: 24px; font-size: 9pt; color: #555; border-top: 1px dotted #bbb; padding-top: 8px; }
      .rev  { margin-top: 16px; padding: 8px 10px; border: 1px solid #a33; color: #a33; font-size: 10pt; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <pre>${esc(voll.text_snapshot)}</pre>
    ${voll.revoked_at ? `<div class="rev">Diese Einwilligung wurde am ${new Date(voll.revoked_at).toLocaleDateString('de-DE')} widerrufen.</div>` : ''}
    <div class="sig">
      ${sigUrl ? `<img src="${esc(sigUrl)}" alt="Unterschrift">` : '<em>Unterschrift nicht verfügbar</em>'}
      <div>${esc(voll.signed_name || '')} &middot; ${dt.toLocaleDateString('de-DE')} ${dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    <div class="meta">
      Textversion: ${esc(voll.text_version)}<br>
      Pr&uuml;fsumme (SHA-256): ${esc(voll.text_sha256)}<br>
      Aufbewahrung 10 Jahre gem&auml;&szlig; &sect; 630f Abs. 3 BGB.
    </div>
    <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });<\/script>
    </body></html>`);
  win.document.close();
}
