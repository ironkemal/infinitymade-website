/**
 * fax-einstellungen.js — Owner-Einstellung „Fax-Versand (Fax-to-Mail)" (onprem O-231).
 *
 * Die Praxis hinterlegt das Adressmuster ihres Fax-Providers (z. B. {nummer}@fax.ihr-anbieter.de).
 * Praxura versendet nur aus einer Box mit eigenem Mail-Server; die Faxnummer des Arztes
 * ersetzt {nummer}. Ohne Muster oder ohne Mail-Server druckt die Praxis das Fax selbst.
 *
 * Gespeichert in profiles.fax_mail_muster (Owner-Level).
 *
 * @param {object}   deps
 * @param {object}   deps.supabase
 * @param {object}   deps.profile    currentProfile — wird bei Erfolg nachgezogen
 * @param {Function} deps.userId     () => id des angemeldeten Owners
 * @param {Function} deps.showToast
 */

import { renderFormulareSettings } from './formular-editor.js?v=20261031b';

export const FAX_MUSTER_RE = /^[A-Za-z0-9._+-]*\{nummer\}[A-Za-z0-9._+-]*@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

export const FAX_HINWEIS_TEXT = 'Hinterlegen Sie das Adressmuster Ihres Fax-Dienstes, z. B. {nummer}@fax.ihr-anbieter.de. '
  + 'Praxura versendet nur aus einer Box mit eigenem Mail-Server; die Faxnummer des Arztes ersetzt {nummer}. '
  + 'Ohne Muster oder ohne Mail-Server drucken Sie das Fax wie bisher selbst.';

/**
 * Clientseitige Prüfung des Fax-Adressmusters.
 * Leer oder Whitespace ergibt { ok: true, muster: null } (Spalte leeren).
 * Sonst wird {nummer} und das Adressformat geprüft.
 * @param {string} muster
 * @returns {{ ok: true, muster: string|null } | { ok: false, fehler: string }}
 */
export function pruefeFaxMusterClient(muster) {
  const roh = String(muster ?? '').trim();
  if (!roh) return { ok: true, muster: null };
  if (roh.length > 200) {
    return { ok: false, fehler: 'Das Fax-Adressmuster darf maximal 200 Zeichen lang sein.' };
  }
  const count = (roh.match(/\{nummer\}/g) || []).length;
  if (count === 0) {
    return { ok: false, fehler: 'Das Adressmuster muss den Platzhalter {nummer} enthalten.' };
  }
  if (count > 1) {
    return { ok: false, fehler: 'Das Adressmuster darf {nummer} nur genau einmal enthalten.' };
  }
  if (!FAX_MUSTER_RE.test(roh)) {
    return { ok: false, fehler: 'Ungültiges Fax-Adressmuster (z. B. {nummer}@fax.ihr-anbieter.de).' };
  }
  return { ok: true, muster: roh };
}

function abschnittBauen(doc) {
  const sec = doc.createElement('div');
  sec.className = 'settings-section';
  sec.id = 'settingsFaxSection';

  const titel = doc.createElement('div');
  titel.className = 'settings-section-title';
  titel.textContent = 'Fax-Versand (Fax-to-Mail)';

  const body = doc.createElement('div');
  body.className = 'settings-section-body';

  const hinweis = doc.createElement('p');
  hinweis.style.cssText = 'font-size:13px;color:var(--text-muted);margin:0 0 12px;line-height:1.5;';
  hinweis.textContent = FAX_HINWEIS_TEXT;
  body.append(hinweis);

  const g = doc.createElement('div');
  g.className = 'form-group';
  const l = doc.createElement('label');
  l.className = 'form-label';
  l.htmlFor = 'setFaxMailMuster';
  l.textContent = 'Adressmuster Ihres Fax-Dienstes';

  const i = doc.createElement('input');
  i.className = 'form-input';
  i.id = 'setFaxMailMuster';
  i.type = 'text';
  i.maxLength = 200;
  i.placeholder = '{nummer}@fax.ihr-anbieter.de';
  i.autocomplete = 'off';
  g.append(l, i);
  body.append(g);

  const btn = doc.createElement('button');
  btn.className = 'btn-primary';
  btn.id = 'setFaxSaveBtn';
  btn.type = 'button';
  btn.style.cssText = 'min-height:44px;padding:0 20px;';
  btn.textContent = 'Speichern';
  body.append(btn);

  sec.append(titel, body);
  return sec;
}

export function renderFaxSettings(deps, doc = document) {
  if (deps?.profile?.role !== 'owner') return;
  const anker = doc.getElementById('settingsRechtslinksSection') || doc.getElementById('settingsProfileSection');
  if (!anker) return;
  let sec = doc.getElementById('settingsFaxSection');
  if (!sec) {
    sec = abschnittBauen(doc);
    anker.after(sec);
    doc.getElementById('setFaxSaveBtn')?.addEventListener('click', () => speichern(deps, doc));
  }
  const input = doc.getElementById('setFaxMailMuster');
  if (input) input.value = deps.profile?.fax_mail_muster || '';
  renderFormulareSettings(deps, doc);
}

async function speichern(deps, doc) {
  const input = doc.getElementById('setFaxMailMuster');
  const res = pruefeFaxMusterClient(input ? input.value : '');
  if (!res.ok) {
    deps.showToast(res.fehler, 'error');
    return;
  }
  const btn = doc.getElementById('setFaxSaveBtn');
  if (btn) btn.disabled = true;
  try {
    const patch = { fax_mail_muster: res.muster };
    const id = typeof deps.userId === 'function' ? deps.userId() : deps.userId;
    const { error } = await deps.supabase.from('profiles').update(patch).eq('id', id);
    if (error) throw error;
    if (deps.profile) Object.assign(deps.profile, patch);
    deps.showToast('Gespeichert.', 'success');
  } catch (e) {
    console.error('[fax-einstellungen] speichern', e);
    deps.showToast('Speichern fehlgeschlagen: ' + (e?.message || e), 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
