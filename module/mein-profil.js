/**
 * mein-profil.js — Einstellungen → Mein Konto → „Mein Profil“ (Phase 7b, 23.11.2026).
 *
 * Warum: Konzept (wissensbank/sitzungen/2026-11-23_einstellungen-informationsarchitektur.md): Mitarbeiter sollen
 * Namen und Foto selbst pflegen, bisher konnte das nur der Inhaber im Team-Detail. Kein neues Recht nötig:
 * profiles_update_own (id = auth.uid()) und avatars/<uid>/ (Storage-Policy avatars_own_*) erlauben es schon.
 *
 * Rollen: Inhaber → Vor-/Nachname (owner_first_name/last_name; business_name ist beim Inhaber der Praxisname!),
 * Mitarbeiter → Anzeigename (business_name, so zeigt ihn die Team-Liste). Foto für alle (avatar_url).
 */
import { ladeProfilfotoHoch, bildAlsQuadratJpeg, entferneProfilfoto } from './praxis-logo-upload.js?v=20261124cx1';

export const SECTION_ID = 'settingsMeinProfilSection';
const MAX = 80;

/**
 * Reine Hilfe: Update-Patch je Rolle; nur die erlaubten Spalten, getrimmt, begrenzt.
 * @param {'owner'|'employee'|string|null|undefined} rolle
 * @param {{ vorname?: string, nachname?: string, anzeigename?: string }} werte
 * @returns {{ ok: true, patch: Record<string, string|null> } | { ok: false, fehler: string }}
 */
export function profilPatch(rolle, werte) {
  const sauber = (/** @type {unknown} */ v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (rolle === 'owner') {
    const vorname = sauber(werte.vorname); const nachname = sauber(werte.nachname);
    if (vorname.length > MAX || nachname.length > MAX) return { ok: false, fehler: `Höchstens ${MAX} Zeichen je Feld.` };
    return { ok: true, patch: { owner_first_name: vorname || null, owner_last_name: nachname || null } };
  }
  const name = sauber(werte.anzeigename);
  if (!name) return { ok: false, fehler: 'Bitte einen Namen eintragen — so erscheinen Sie im Team und im Kalender.' };
  if (name.length > MAX) return { ok: false, fehler: `Höchstens ${MAX} Zeichen.` };
  return { ok: true, patch: { business_name: name } };
}

/** @param {Document} doc @param {string} tag @param {Record<string, string>} [attr] @param {string} [text] */
function el(doc, tag, attr = {}, text) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Abschnitt bauen bzw. aktualisieren. Wird bei jedem Öffnen der Einstellungen aufgerufen.
 * @param {{ supabase: any, profile: () => any, userId: () => string|null|undefined, showToast: (m: string, t?: string) => void,
 *           nachSpeichern?: () => void, vorschlagName?: () => string|null|undefined, doc?: Document }} deps
 */
export function renderMeinProfil(deps) {
  const doc = deps.doc || document;
  const p = deps.profile?.() || null;
  const uid = deps.userId?.();
  const inhalt = doc.querySelector('#panel-settings .settings-sections');
  if (!p || !uid || !inhalt) return null;
  const istOwner = p.role === 'owner';

  let sec = doc.getElementById(SECTION_ID);
  if (!sec) {
    sec = el(doc, 'div', { class: 'settings-section', id: SECTION_ID });
    sec.append(el(doc, 'div', { class: 'settings-section-title' }, 'Mein Profil'), el(doc, 'div', { class: 'settings-section-body' }));
    // oben in „Mein Konto“, nach Bereichstitel + Kurzbeschreibung
    const gruppe = inhalt.querySelector('.settings-group[data-einst="konto"]');
    const nach = gruppe?.querySelector(':scope > .settings-group-hint') || gruppe?.querySelector(':scope > .settings-group-label');
    if (nach) nach.after(sec); else (gruppe || inhalt).append(sec);
  }
  const body = /** @type {HTMLElement} */ (sec.querySelector('.settings-section-body'));
  body.replaceChildren();

  // Foto
  const fotoZeile = el(doc, 'div', { style: 'display:flex;align-items:center;gap:14px;margin-bottom:14px;' });
  const bild = el(doc, 'div', { class: 'mein-profil-foto', style: 'width:64px;height:64px;border-radius:50%;overflow:hidden;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--text-muted);flex:0 0 auto;' });
  const anzeigeName = istOwner ? [p.owner_first_name, p.owner_last_name].filter(Boolean).join(' ') : (p.business_name || '');
  if (p.avatar_url && /^https:\/\//.test(p.avatar_url)) {
    const img = el(doc, 'img', { alt: 'Ihr Profilfoto', style: 'width:100%;height:100%;object-fit:cover;' });
    img.setAttribute('src', p.avatar_url);
    bild.append(img);
  } else bild.textContent = (anzeigeName || '?').trim().charAt(0).toUpperCase() || '?';
  const datei = el(doc, 'input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', id: 'meinProfilFotoDatei', hidden: '' });
  const wahl = el(doc, 'button', { type: 'button', class: 'btn btn-secondary', id: 'meinProfilFotoBtn' }, p.avatar_url ? 'Foto ändern' : 'Foto hochladen');
  const weg = el(doc, 'button', { type: 'button', class: 'btn-ghost', id: 'meinProfilFotoWeg' }, 'Foto entfernen');
  if (!p.avatar_url) weg.hidden = true;
  const knoepfe = el(doc, 'div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' });
  knoepfe.append(wahl, weg);
  fotoZeile.append(bild, knoepfe, datei);
  body.append(fotoZeile);

  // Name
  /** @type {Record<string, HTMLInputElement>} */
  const felder = {};
  const feld = (/** @type {string} */ key, /** @type {string} */ label, /** @type {string} */ wert) => {
    const g = el(doc, 'div', { class: 'form-group' });
    const id = `meinProfil_${key}`;
    g.append(el(doc, 'label', { class: 'form-label', for: id }, label));
    const i = /** @type {HTMLInputElement} */ (el(doc, 'input', { class: 'form-input', id, type: 'text', maxlength: String(MAX), autocomplete: key === 'nachname' ? 'family-name' : key === 'vorname' ? 'given-name' : 'name' }));
    i.value = wert || '';
    g.append(i); felder[key] = i; return g;
  };
  if (istOwner) {
    const reihe = el(doc, 'div', { class: 'form-row' });
    reihe.append(feld('vorname', 'Vorname', p.owner_first_name), feld('nachname', 'Nachname', p.owner_last_name));
    body.append(reihe);
  } else {
    // Ältere Konten ohne business_name: Name aus der Anmeldung vorschlagen (gespeichert wird erst per Klick).
    body.append(feld('anzeigename', 'Ihr Name im Team', p.business_name || String(deps.vorschlagName?.() || '').slice(0, MAX)));
  }
  body.append(el(doc, 'p', { class: 'form-hint', style: 'margin:0 0 10px;' }, istOwner
    ? 'So stehen Sie in Begrüßung, Team und auf Belegen als Inhaber/in. Den Praxisnamen ändern Sie unter „Praxisdaten“.'
    : 'So sehen Kolleginnen und Kollegen Sie im Team und im Kalender.'));
  const speichern = el(doc, 'button', { type: 'button', class: 'btn btn-primary', id: 'meinProfilSpeichern' }, 'Speichern');
  body.append(speichern);

  const fertig = (/** @type {Record<string, unknown>} */ patch) => {
    Object.assign(p, patch);
    try { doc.dispatchEvent(new (doc.defaultView || globalThis).Event('praxis-profil:geaendert')); } catch { /* Zusatz */ }
    try { deps.nachSpeichern?.(); } catch { /* Zusatz */ }
  };

  speichern.addEventListener('click', async () => {
    const r = profilPatch(p.role, { vorname: felder.vorname?.value, nachname: felder.nachname?.value, anzeigename: felder.anzeigename?.value });
    if (!r.ok) { deps.showToast(r.fehler, 'error'); return; }
    speichern.setAttribute('disabled', '');
    try {
      const { error } = await deps.supabase.from('profiles').update(r.patch).eq('id', uid);
      if (error) throw error;
      fertig(r.patch);
      deps.showToast('Profil gespeichert ✓', 'success');
    } catch { deps.showToast('Profil konnte nicht gespeichert werden.', 'error'); }
    finally { speichern.removeAttribute('disabled'); }
  });

  wahl.addEventListener('click', () => datei.click());
  datei.addEventListener('change', async () => {
    const f = /** @type {HTMLInputElement} */ (datei).files?.[0];
    /** @type {HTMLInputElement} */ (datei).value = '';
    if (!f) return;
    wahl.setAttribute('disabled', '');
    try {
      const blob = await bildAlsQuadratJpeg(f);
      const url = await ladeProfilfotoHoch(deps.supabase, uid, blob);
      const { error } = await deps.supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
      if (error) throw new Error('Foto konnte nicht gespeichert werden.');
      fertig({ avatar_url: url });
      deps.showToast('Foto gespeichert ✓', 'success');
      renderMeinProfil(deps);
    } catch (e) { deps.showToast(/** @type {any} */ (e)?.message || 'Foto konnte nicht gespeichert werden.', 'error'); }
    finally { wahl.removeAttribute('disabled'); }
  });

  weg.addEventListener('click', async () => {
    weg.setAttribute('disabled', '');
    try {
      await entferneProfilfoto(deps.supabase, uid, p.avatar_url);
      const { error } = await deps.supabase.from('profiles').update({ avatar_url: null }).eq('id', uid);
      if (error) throw error;
      fertig({ avatar_url: null });
      deps.showToast('Foto entfernt.', 'success');
      renderMeinProfil(deps);
    } catch { deps.showToast('Foto konnte nicht entfernt werden.', 'error'); }
    finally { weg.removeAttribute('disabled'); }
  });
  return sec;
}
