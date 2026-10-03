/**
 * module/abrechnung-empfaenger.js — Empfänger-Prüfung am Übermittlungstag (Frontend)
 *
 * Gegenstück zu api-backend/billing/kostentraeger/stichtag-pruefung.js (37b8f51, Oturum B).
 * Das Backend blockiert dta-bytes / upload-signed mit HTTP 409
 * (EMPFAENGER_GEAENDERT, PAPIERANNAHMESTELLE_GEAENDERT, KEINE_DATENANNAHMESTELLE), wenn
 * sich die Annahmestelle seit dem Erstellen geändert hat, und meldet Warnungen
 * (z. B. QUARTALSWECHSEL) als `stichtagWarnung` in upload-signed / mark-sent.
 *
 * Der Header X-Praxura-Stichtag-Warnung von dta-bytes ist cross-origin nicht lesbar
 * (kein Access-Control-Expose-Headers) — deshalb fragt das Frontend die Warnungen VOR dem
 * Signieren über GET /empfaenger-pruefung ab, mit Klartext statt Codes.
 */

const NEU_ERZEUGEN = 'Bitte die Abrechnung neu erzeugen (Storno + neue Abrechnung).';

/** Meldungstexte einer Stufe, zu einem Satzblock verbunden. */
export function meldungsText(meldungen, stufe) {
  return (Array.isArray(meldungen) ? meldungen : [])
    .filter(m => m && (!stufe || m.stufe === stufe) && m.text)
    .map(m => m.text)
    .join(' ');
}

/** Fehlertext aus einer Backend-Antwort; bei Empfänger-Blocks mit Hinweis auf Neu-Erzeugen. */
export function empfaengerFehlerText(json, status) {
  const basis = json?.error || ('HTTP ' + status);
  const istEmpfaenger = status === 409 && /GEAENDERT|DATENANNAHMESTELLE|STICHTAG/.test(json?.code || '');
  if (!istEmpfaenger || /neu erzeugen/i.test(basis)) return basis;
  return basis + ' ' + NEU_ERZEUGEN;
}

/**
 * Wirft bei !res.ok mit lesbarem Text; zeigt `stichtagWarnung` (nur Warnung, kein Block)
 * als Toast. Gibt das JSON zurück.
 */
export function pruefeAntwort(res, json, showToast) {
  if (!res.ok) throw new Error(empfaengerFehlerText(json, res.status));
  const warnung = meldungsText(json?.stichtagWarnung, 'warnung');
  if (warnung && typeof showToast === 'function') showToast('Hinweis: ' + warnung, 'warning');
  return json;
}

/**
 * Vorab-Prüfung vor Download/Signieren. Block → Error; Warnungen → Toast.
 * Fällt die Prüfung selbst aus (Netz, 500), wird nicht blockiert — dta-bytes prüft
 * serverseitig ohnehin noch einmal.
 */
export async function empfaengerVorabPruefen({ apiBase, token, abrechnungId, showToast, fetchFn = fetch }) {
  let json;
  try {
    const res = await fetchFn(`${apiBase}/billing/abrechnung/${abrechnungId}/empfaenger-pruefung`, {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }
  if (json?.blockiert) {
    const block = meldungsText(json.meldungen, 'block') || 'Abrechnung heute nicht übermittelbar.';
    throw new Error(/neu erzeugen/i.test(block) ? block : block + ' ' + NEU_ERZEUGEN);
  }
  const warnung = meldungsText(json?.meldungen, 'warnung');
  if (warnung && typeof showToast === 'function') showToast('Hinweis: ' + warnung, 'warning');
  return json;
}

/**
 * B: Zertifikatsablauf-Warnung für den Inhaber (30-Tage-Grenze).
 * Aus dashboard.js:1059-1081 extrahiert (Konsey-Umzingelung / Dashboard-Größenlimit).
 */
export async function renderOwnerCertExpiryBanner({
  currentProfile,
  supabase,
  doc = typeof document !== 'undefined' ? document : null,
  now = Date.now(),
} = {}) {
  const el = doc?.getElementById('cert-expiry-banner');
  if (el) el.hidden = true; // Vor dem Laden sicherheitshalber verstecken

  if (!currentProfile || currentProfile.role !== 'owner') return;
  const ownerId = currentProfile.id;
  if (!ownerId || !supabase) return;

  const { data: cert } = await supabase
    .from('terapeut_zertifikat')
    .select('cert_valid_to')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (!cert?.cert_valid_to) return;
  const validTo = new Date(cert.cert_valid_to);
  if (isNaN(validTo.getTime())) return; // Ungültiges Datum abfangen

  const daysLeft = Math.ceil((validTo.getTime() - now) / 86400000);
  if (daysLeft > 30) return; // Noch mehr als 30 Tage gültig -> kein Banner

  if (!el) return;
  const formatted = validTo.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  const isDanger = daysLeft <= 0;
  const color = isDanger ? 'var(--danger)' : 'var(--warning-text)';
  const bg = isDanger ? 'var(--danger-dim)' : 'var(--warning-dim)';
  const border = isDanger ? 'var(--danger)' : 'var(--warning)';
  el.innerHTML = `
    <div style="margin:8px 0;padding:12px 14px;border-radius:8px;background:${bg};border:1px solid ${border};font-size:13px;line-height:1.5;color:var(--text-main);">
      <strong style="color:${color};">⚠ ITSG-Zertifikat</strong> — läuft ${isDanger ? `<strong>abgelaufen (${formatted})</strong>` : `am <strong>${formatted}</strong> ab (${daysLeft} Tag${daysLeft === 1 ? '' : 'e'})`}.
      Bitte frühzeitig über Ihre KV/ITSG erneuern.
    </div>`;
  el.hidden = false;
}

// ---------------------------------------------------------------------------
// DAS-Guide Generation & Lebenszyklus-Controller
// ---------------------------------------------------------------------------

let _activeGuideGen = 0;
let _isGuideModalOpen = false;

/** Wird beim Schließen des DAS-Guide-Modals aufgerufen, um asynchrone Antworten zu verwerfen. */
export function onDasGuideModalClosed() {
  _isGuideModalOpen = false;
  _activeGuideGen++;
}

/** Liefert den aktuellen internen Generationen- und Öffnungszustand (für Tests). */
export function getDasGuideModalState() {
  return { gen: _activeGuideGen, open: _isGuideModalOpen };
}

/** Setzt den Zustand zurück (für Tests). */
export function resetDasGuideModalStateForTest() {
  _activeGuideGen = 0;
  _isGuideModalOpen = false;
}

/**
 * Rendert den Empfängerzertifikats-Metadatenblock sicher (textContent statt injected HTML).
 * Positiv NUR bei serverStatus === 'geprueft'.
 */
export function renderEmpfaengerCertMetadata(containerEl, empfCert, { isLoading = false, errorMsg = null, blockiert = false, meldungen = [] } = {}) {
  if (!containerEl) return;
  containerEl.replaceChildren();

  const wrap = containerEl.ownerDocument
    ? containerEl.ownerDocument.createElement('div')
    : (typeof document !== 'undefined' ? document.createElement('div') : null);
  if (!wrap) return;

  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  // 1. Titelzeile + Status-Badge
  const topRow = containerEl.ownerDocument.createElement('div');
  topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;';

  const titleEl = containerEl.ownerDocument.createElement('strong');
  titleEl.style.cssText = 'font-size:12px;color:var(--text-main);';
  titleEl.textContent = 'Empfängerzertifikat (§ 302 Verschlüsselung)';
  topRow.appendChild(titleEl);

  const badgeEl = containerEl.ownerDocument.createElement('span');
  badgeEl.className = 'dg-cert-status-badge';
  badgeEl.style.cssText = 'font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;display:inline-block;';

  const status = empfCert?.status;

  if (isLoading) {
    badgeEl.textContent = 'Wird geladen…';
    badgeEl.style.background = 'var(--bg-hover)';
    badgeEl.style.color = 'var(--text-muted)';
    badgeEl.style.border = '1px solid var(--border)';
  } else if (errorMsg) {
    badgeEl.textContent = 'Nicht geprüft';
    badgeEl.style.background = 'var(--danger-dim)';
    badgeEl.style.color = 'var(--danger)';
    badgeEl.style.border = '1px solid var(--danger)';
  } else if (status === 'geprueft') {
    badgeEl.textContent = 'Geprüft (PKI gültig)';
    badgeEl.style.background = 'var(--success-dim)';
    badgeEl.style.color = 'var(--success)';
    badgeEl.style.border = '1px solid var(--success)';
  } else if (status === 'ungueltig') {
    badgeEl.textContent = 'Ungültig';
    badgeEl.style.background = 'var(--danger-dim)';
    badgeEl.style.color = 'var(--danger)';
    badgeEl.style.border = '1px solid var(--danger)';
  } else if (status === 'nicht_pruefbar') {
    badgeEl.textContent = 'Nicht prüfbar';
    badgeEl.style.background = 'var(--warning-dim)';
    badgeEl.style.color = 'var(--warning-text)';
    badgeEl.style.border = '1px solid var(--warning)';
  } else if (status === 'fehlend') {
    badgeEl.textContent = 'Zertifikat fehlt';
    badgeEl.style.background = 'var(--bg-hover)';
    badgeEl.style.color = 'var(--text-muted)';
    badgeEl.style.border = '1px solid var(--border)';
  } else {
    badgeEl.textContent = 'Nicht geprüft';
    badgeEl.style.background = 'var(--bg-hover)';
    badgeEl.style.color = 'var(--text-muted)';
    badgeEl.style.border = '1px solid var(--border)';
  }
  topRow.appendChild(badgeEl);
  wrap.appendChild(topRow);

  // 2. Metadaten-Felder
  const grid = containerEl.ownerDocument.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:3px;font-size:11.5px;color:var(--text-muted);margin-top:2px;';

  function addField(label, value) {
    const lblEl = containerEl.ownerDocument.createElement('span');
    lblEl.style.fontWeight = '600';
    lblEl.style.color = 'var(--text-main)';
    lblEl.textContent = label + ':';

    const valEl = containerEl.ownerDocument.createElement('span');
    valEl.style.fontFamily = label.includes('SHA') ? 'var(--mono, monospace)' : 'inherit';
    valEl.style.wordBreak = 'break-all';
    valEl.textContent = value || '—';

    grid.appendChild(lblEl);
    grid.appendChild(valEl);
  }

  const rawValidTo = empfCert?.validTo;
  let formattedValidTo = '—';
  if (rawValidTo) {
    const vtDate = new Date(rawValidTo);
    formattedValidTo = !isNaN(vtDate.getTime())
      ? vtDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })
      : String(rawValidTo);
  }

  const rawGeprueftAm = empfCert?.geprueftAm;
  let formattedGeprueftAm = '—';
  if (rawGeprueftAm) {
    const gaDate = new Date(rawGeprueftAm);
    formattedGeprueftAm = !isNaN(gaDate.getTime())
      ? gaDate.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
      : String(rawGeprueftAm);
  }

  addField('Empfänger-IK', empfCert?.ik);
  addField('Zertifikatsinhaber', empfCert?.subject);
  addField('Gültig bis', formattedValidTo);
  addField('SHA-256 (Fingerprint)', empfCert?.fingerprintSha256);
  addField('Geprüft am', formattedGeprueftAm);

  wrap.appendChild(grid);

  // 3. Hinweiszeile bei Fehlern / Warnungen / Übermittlungsblockaden
  const blockMeldung = blockiert
    ? (meldungsText(meldungen, 'block') || 'Versand für diese Abrechnung blockiert (z. B. Stichtagswechsel).')
    : null;
  const hinweisText = errorMsg || blockMeldung || empfCert?.hinweis;
  if (hinweisText) {
    const hinweisEl = containerEl.ownerDocument.createElement('div');
    hinweisEl.style.cssText = 'margin-top:4px;padding:6px 8px;border-radius:4px;font-size:11px;line-height:1.4;';
    if (status === 'ungueltig' || errorMsg || blockiert) {
      hinweisEl.style.background = 'var(--danger-dim)';
      hinweisEl.style.color = 'var(--danger)';
      hinweisEl.style.border = '1px solid var(--danger)';
    } else if (status === 'nicht_pruefbar') {
      hinweisEl.style.background = 'var(--warning-dim)';
      hinweisEl.style.color = 'var(--warning-text)';
      hinweisEl.style.border = '1px solid var(--warning)';
    } else {
      hinweisEl.style.background = 'var(--bg-hover)';
      hinweisEl.style.color = 'var(--text-muted)';
      hinweisEl.style.border = '1px solid var(--border)';
    }
    hinweisEl.textContent = hinweisText;
    wrap.appendChild(hinweisEl);
  }

  containerEl.appendChild(wrap);
}

/**
 * Controller zum Öffnen des DAS-Guide-Modals mit Rennschutz (Generation Tracking)
 * und sauberem Sofort-Reset vor asynchronen Ladevorgängen.
 */
export async function openDasGuideModalController({
  abrechnungId,
  forceStep,
  supabase,
  apiBase,
  state,
  kkMap,
  escapeHtml,
  dgStatusToStep,
  dgRender,
  openModal,
  fetchFn = typeof fetch !== 'undefined' ? fetch : null,
  doc = typeof document !== 'undefined' ? document : null,
}) {
  if (!abrechnungId) return;

  _isGuideModalOpen = true;
  const currentGen = ++_activeGuideGen;

  // 1. Sofort-Reset VOR jedem await: kein alter Rechnungs-/Zertifikatsstand sichtbar
  if (state) {
    state.abrechnungId = abrechnungId;
    state.abrechnung = null;
  }

  const header = doc?.getElementById('dasGuideHeader');
  if (header) {
    header.textContent = 'Laden…';
  }

  const certMetaEl = doc?.getElementById('dasGuideCertMeta');
  if (certMetaEl) {
    renderEmpfaengerCertMetadata(certMetaEl, null, { isLoading: true });
  }

  if (typeof dgRender === 'function') {
    dgRender(1);
  }

  if (typeof openModal === 'function') {
    openModal('dasGuideModal');
  }

  // 2. Abrechnungszeile laden
  let ab = null;
  try {
    const { data, error } = await supabase
      .from('abrechnung')
      .select('id, dateiname, status, storage_path, signed_storage_path, signed_at, encrypted_storage_path, verschluesselt_am, verschluesselung_hinweis, zaa_uploaded_at, kostentraeger_ik, empfaenger_ik, prescription_count')
      .eq('id', abrechnungId)
      .maybeSingle();
    if (error) throw error;
    ab = data;
  } catch {
    if (currentGen !== _activeGuideGen || !_isGuideModalOpen) return;
    if (header) header.textContent = 'Fehler beim Laden der Abrechnung.';
    if (certMetaEl) renderEmpfaengerCertMetadata(certMetaEl, null, { errorMsg: 'Abrechnung konnte nicht geladen werden.' });
    return;
  }

  // Generation & Schließschutz prüfen
  if (currentGen !== _activeGuideGen || !_isGuideModalOpen) return;

  if (!ab) {
    if (header) header.textContent = 'Abrechnung nicht gefunden.';
    if (certMetaEl) renderEmpfaengerCertMetadata(certMetaEl, null, { errorMsg: 'Abrechnung existiert nicht.' });
    return;
  }

  if (state) {
    state.abrechnung = ab;
  }

  if (header) {
    const ik = ab.kostentraeger_ik || '—';
    const kk = kkMap?.get(ik)?.name || ik;
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s || '');
    header.innerHTML = `<strong>${esc(ab.dateiname || abrechnungId)}</strong> · ${esc(kk)} · ${ab.prescription_count || 0} Rezepte`;
  }

  const step = forceStep || (typeof dgStatusToStep === 'function' ? dgStatusToStep(ab) : 1);
  if (typeof dgRender === 'function') {
    dgRender(step);
  }

  // 3. Empfänger-Zertifikatsprüfung abrufen
  let token = null;
  try {
    const { data: sData } = await supabase.auth.getSession();
    token = sData?.session?.access_token || null;
  } catch {
    token = null;
  }

  if (currentGen !== _activeGuideGen || !_isGuideModalOpen) return;

  if (!token || !fetchFn) {
    if (certMetaEl) {
      renderEmpfaengerCertMetadata(certMetaEl, { ik: ab.empfaenger_ik }, { errorMsg: 'Nicht angemeldet — Empfängerzertifikat konnte nicht geprüft werden.' });
    }
    return;
  }

  let certJson = null;
  let certFetchFailed = false;
  try {
    const res = await fetchFn(`${apiBase}/billing/abrechnung/${abrechnungId}/empfaenger-pruefung`, {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) {
      certFetchFailed = true;
    } else {
      certJson = await res.json();
    }
  } catch {
    certFetchFailed = true;
  }

  if (currentGen !== _activeGuideGen || !_isGuideModalOpen) return;

  if (certFetchFailed || !certJson) {
    if (certMetaEl) {
      renderEmpfaengerCertMetadata(certMetaEl, { ik: ab.empfaenger_ik }, { errorMsg: 'Empfängerprüfung konnte nicht geladen werden.' });
    }
    return;
  }

  if (certMetaEl) {
    renderEmpfaengerCertMetadata(certMetaEl, certJson.empfCert || null, {
      blockiert: Boolean(certJson.blockiert),
      meldungen: certJson.meldungen || [],
    });
  }
}
