// K2b.15 (09.10.2026) — Rechtstexte der Patientenseiten booking.html + booking-request.html.
//
// legal-de 09.10.2026 (compliance/LEGAL_DECISIONS.md, zwei Blöcke „Box: Patientenseiten" und
// „K2b.15 Rest"): Betreiberin und Verantwortliche ist die Praxis, in Box UND SaaS.
//   · Datenschutzhinweis nie ausblenden: praxis_datenschutz_url, sonst die erzeugten
//     „Datenschutzhinweise zur Online-Terminvereinbarung" (einwilligung-texte.js).
//   · Impressum nur als Link, wenn die Praxis eine URL hinterlegt hat — sonst Klartext Name · Anschrift.
//   · Fehlen Praxisname oder Anschrift, ist die Online-Terminvereinbarung „noch nicht eingerichtet".
// Daten kommen nur aus dem RPC public_praxis_angaben (0073) — nicht aus profiles_public, weil ein
// Spaltenrecht dort auch Mitarbeiterzeilen öffnen würde (guvenlik S-56, Vorabbewertung K2b.15).
// Alles Fremde geht mit textContent bzw. esc() in die Seite (guvenlik: Praxisname auf anon-Seite).

import { httpsUrl } from './branding.js?v=20261009k15';
import { renderTerminDatenschutz } from './einwilligung-texte.js?v=20261009k15c';
import { rechtslinksFuerKutu } from './ueber.js?v=20261009k15';

export const ANKER = '#datenschutzhinweise';
export const NICHT_EINGERICHTET = 'Die Online-Terminvereinbarung dieser Praxis ist noch nicht eingerichtet. Bitte vereinbaren Sie Ihren Termin telefonisch oder direkt in der Praxis.';

const t = (w) => String(w ?? '').trim();

/** RPC-Zeile → Anzeigeobjekt. Rein, testbar. */
export function praxisAngabenAus(zeile) {
  const z = zeile || {};
  const strasse = [t(z.strasse), t(z.hausnummer)].filter(Boolean).join(' ');
  const ort = [t(z.plz), t(z.ort)].filter(Boolean).join(' ');
  const name = t(z.praxis_name);
  return {
    name,
    inhaber: t(z.inhaber_name),
    anschrift: [strasse, ort].filter(Boolean).join(', '),
    impressumUrl: httpsUrl(z.impressum_url),
    datenschutzUrl: httpsUrl(z.datenschutz_url),
    vollstaendig: Boolean(name && t(z.strasse) && t(z.plz) && t(z.ort)),
  };
}

export async function ladePraxisAngaben(sb, ownerId, businessId = null) {
  if (!ownerId) return null;
  const { data, error } = await sb.rpc('public_praxis_angaben', { p_owner_id: ownerId, p_business_id: businessId || null });
  if (error) throw error;
  const zeile = Array.isArray(data) ? data[0] : data;
  return zeile ? praxisAngabenAus(zeile) : null;
}

function dialogOeffnen(doc, angaben, betrieb) {
  let dlg = doc.getElementById('datenschutzhinweise');
  if (!dlg) {
    const r = renderTerminDatenschutz(
      { praxis_name: angaben.name, inhaber_name: angaben.inhaber, praxis_anschrift: angaben.anschrift },
      { betrieb },
    );
    dlg = doc.createElement('dialog');
    dlg.id = 'datenschutzhinweise';
    dlg.setAttribute('aria-labelledby', 'datenschutzhinweise-titel');
    dlg.style.cssText = 'max-width:42rem;width:calc(100% - 2rem);max-height:85vh;border:none;border-radius:12px;padding:1.5rem;line-height:1.5;font-size:0.92rem;color:#222;background:#fff;';
    const h = doc.createElement('h2');
    h.id = 'datenschutzhinweise-titel';
    h.style.cssText = 'font-size:1.15rem;margin:0 0 1rem;';
    h.textContent = r.titel;
    dlg.append(h);
    for (const a of r.absaetze) {
      const h3 = doc.createElement('h3');
      h3.style.cssText = 'font-size:0.95rem;margin:1rem 0 0.25rem;';
      h3.textContent = a.ueberschrift;
      const p = doc.createElement('p');
      p.style.cssText = 'margin:0;white-space:pre-line;';
      p.textContent = a.text;
      dlg.append(h3, p);
    }
    const zu = doc.createElement('button');
    zu.type = 'button';
    zu.textContent = 'Schließen';
    zu.style.cssText = 'margin-top:1.25rem;padding:0.5rem 1.25rem;border-radius:8px;border:1px solid #ccc;background:#f5f5f5;cursor:pointer;';
    zu.addEventListener('click', () => dlg.close());
    dlg.append(zu);
    doc.body.append(dlg);
  }
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

/**
 * Lädt die Praxisangaben und verdrahtet Fußzeile ([data-rechtslinks="praxis"]),
 * Hinweislinks ([data-datenschutz-link]) und Praxisnamen ([data-praxis-name]).
 * @returns {Promise<{vollstaendig:boolean, angaben:object|null, grund:'rpc'|'angaben'|null}>}
 */
export async function praxisRechtstexteAnbringen({ sb, ownerId, businessId = null, istKutu = false, doc = globalThis.document }) {
  let angaben = null;
  let grund = 'angaben';
  try { angaben = await ladePraxisAngaben(sb, ownerId, businessId); } catch (e) {
    grund = 'rpc';   // fail-closed, aber unterscheidbar (onprem 09.10.): Box ohne 0073 / Netz
    console.error('[termin-rechtstexte] public_praxis_angaben fehlgeschlagen — Formular gesperrt:', e?.message || e);
  }
  if (!angaben) {
    rechtslinksFuerKutu(istKutu, doc);
    return { vollstaendig: false, angaben: null, grund };
  }
  const betrieb = istKutu ? 'kutu' : 'saas';
  const datenschutzHref = angaben.datenschutzUrl || ANKER;
  rechtslinksFuerKutu(istKutu, doc, { ...angaben, datenschutzHref });

  for (const a of doc.querySelectorAll('[data-datenschutz-link]')) {
    a.setAttribute('href', datenschutzHref);
    if (angaben.datenschutzUrl) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
    else { a.removeAttribute('target'); a.setAttribute('data-datenschutzhinweise', ''); }
  }
  for (const el of doc.querySelectorAll('[data-praxis-name]')) el.textContent = angaben.name || 'die Praxis';

  if (!angaben.datenschutzUrl) {
    doc.addEventListener('click', (e) => {
      const ziel = e.target?.closest?.('[data-datenschutzhinweise]');
      if (!ziel) return;
      e.preventDefault();
      dialogOeffnen(doc, angaben, betrieb);
    });
  }
  return { vollstaendig: angaben.vollstaendig, angaben, grund: angaben.vollstaendig ? null : 'angaben' };
}
