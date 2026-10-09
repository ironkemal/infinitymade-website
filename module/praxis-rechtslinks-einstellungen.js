/**
 * praxis-rechtslinks-einstellungen.js — Owner-Einstellung „Impressum & Datenschutz
 * Ihrer Online-Terminseite" (K2b.15, 09.10.2026).
 *
 * Warum: Die Praxis betreibt ihre Online-Terminseite selbst (booking.html,
 * booking-request.html) und ist dort Verantwortliche — in der Box wie im SaaS
 * (legal-de 09.10.2026, compliance/LEGAL_DECISIONS.md). Hier hinterlegt sie die
 * Adressen ihres Impressums und ihrer Datenschutzerklärung; die Patientenseiten
 * lesen sie über den RPC public_praxis_angaben (0073), nie direkt.
 *
 * Gespeichert in profiles (Owner-Level, auch Einzelpraxen ohne businesses-Zeile).
 * Der DB-CHECK (0073) erzwingt https/≤500; hier wird vorher mit httpsUrl geprüft,
 * damit die Fehlermeldung verständlich ist. Baut seinen Abschnitt selbst und hängt
 * ihn unter „Profil" ein — dashboard.html/dashboard.js wachsen nicht.
 *
 * @param {object}   deps
 * @param {object}   deps.supabase
 * @param {object}   deps.profile    currentProfile — wird bei Erfolg nachgezogen
 * @param {Function} deps.userId     () => id des angemeldeten Owners
 * @param {Function} deps.showToast
 */
import { httpsUrl } from './branding.js?v=20261009k15';

export const OWNER_HINWEIS = 'Ihre Online-Terminseite betreiben Sie als Praxis selbst: Tragen Sie die Adressen Ihres '
  + 'Impressums und Ihrer Datenschutzerklärung ein – ohne Eintrag erscheint ein automatisch aus Ihren Praxisdaten '
  + 'erzeugter Datenschutzhinweis, aber kein Impressum, für das Sie bei einer öffentlich erreichbaren Seite selbst '
  + 'verantwortlich sind.';

export const ANSCHRIFT_HINWEIS = 'Praxisname und Anschrift (oben unter „Profil") erscheinen auf Ihrer öffentlichen '
  + 'Terminseite. Fehlen sie, ist die Online-Terminvereinbarung gesperrt.';

/** Eingabe → Wert für die DB. '' → null; ungültig → undefined (nicht speichern). */
export function urlFuerDb(eingabe) {
  const roh = String(eingabe ?? '').trim();
  if (!roh) return null;
  return httpsUrl(roh) || undefined;
}

const FELDER = [
  ['praxis_impressum_url', 'setPraxisImpressumUrl', 'Adresse Ihres Impressums', 'https://www.ihre-praxis.de/impressum'],
  ['praxis_datenschutz_url', 'setPraxisDatenschutzUrl', 'Adresse Ihrer Datenschutzerklärung', 'https://www.ihre-praxis.de/datenschutz'],
];

function abschnittBauen(doc) {
  const sec = doc.createElement('div');
  sec.className = 'settings-section';
  sec.id = 'settingsRechtslinksSection';
  const titel = doc.createElement('div');
  titel.className = 'settings-section-title';
  titel.textContent = 'Impressum & Datenschutz Ihrer Online-Terminseite';
  const body = doc.createElement('div');
  body.className = 'settings-section-body';
  const hinweis = doc.createElement('p');
  hinweis.style.cssText = 'font-size:13px;color:var(--text-muted);margin:0 0 12px;line-height:1.5;';
  hinweis.textContent = OWNER_HINWEIS;
  body.append(hinweis);
  for (const [, id, label, ph] of FELDER) {
    const g = doc.createElement('div');
    g.className = 'form-group';
    const l = doc.createElement('label');
    l.className = 'form-label';
    l.htmlFor = id;
    l.textContent = label;
    const i = doc.createElement('input');
    i.className = 'form-input';
    i.id = id;
    i.type = 'url';
    i.maxLength = 500;
    i.placeholder = ph;
    i.autocomplete = 'off';
    g.append(l, i);
    body.append(g);
  }
  const anschrift = doc.createElement('p');
  anschrift.style.cssText = 'font-size:12px;color:var(--text-muted);margin:0 0 12px;';
  anschrift.textContent = ANSCHRIFT_HINWEIS;
  const btn = doc.createElement('button');
  btn.className = 'btn-primary';
  btn.id = 'setRechtslinksSaveBtn';
  btn.type = 'button';
  btn.textContent = 'Speichern';
  body.append(anschrift, btn);
  sec.append(titel, body);
  return sec;
}

export function renderRechtslinksSettings(deps, doc = document) {
  if (deps.profile?.role !== 'owner') return;
  const profil = doc.getElementById('settingsProfileSection');
  if (!profil) return;
  let sec = doc.getElementById('settingsRechtslinksSection');
  if (!sec) {
    sec = abschnittBauen(doc);
    profil.after(sec);
    doc.getElementById('setRechtslinksSaveBtn').addEventListener('click', () => speichern(deps, doc));
  }
  for (const [spalte, id] of FELDER) doc.getElementById(id).value = deps.profile?.[spalte] || '';
}

async function speichern(deps, doc) {
  const patch = {};
  for (const [spalte, id, label] of FELDER) {
    const wert = urlFuerDb(doc.getElementById(id).value);
    if (wert === undefined) {
      deps.showToast(`${label}: bitte eine vollständige https-Adresse eingeben (z. B. https://www.ihre-praxis.de/…).`, 'error');
      return;
    }
    patch[spalte] = wert;
  }
  const btn = doc.getElementById('setRechtslinksSaveBtn');
  btn.disabled = true;
  try {
    const { error } = await deps.supabase.from('profiles').update(patch).eq('id', deps.userId());
    if (error) throw error;
    if (deps.profile) Object.assign(deps.profile, patch);
    deps.showToast('Gespeichert.', 'success');
  } catch (e) {
    console.error('[rechtslinks] speichern', e);
    deps.showToast('Speichern fehlgeschlagen: ' + (e?.message || e), 'error');
  } finally {
    btn.disabled = false;
  }
}
