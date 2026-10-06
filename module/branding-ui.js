/**
 * branding-ui.js — Ergänzungen der Branding-Einstellungen (KHS M2.4):
 * Inhabername, Praxisstempel (privater Bucket) und die gebündelte Liste „Was fehlt noch?".
 *
 * Das Logo, die Fußzeile und die Rechnungsdaten bleiben, wo sie sind (dashboard.js /
 * Rechnungsdaten) — diese Datei kommt dazu, statt sie umzubauen (`dashboard.js` darf nicht
 * wachsen). Quelle für „fehlt" ist `module/branding.js`, derselbe Maßstab wie der
 * Einrichtungsring (M2.6).
 *
 * Verdrahtung: `mountBrandingExtras(ctx)` einmal aus dashboard.js. Gezeichnet wird, sobald
 * der Abschnitt sichtbar wird (IntersectionObserver) und nach jeder Änderung.
 */
import { brandingAus, brandingLuecken } from './branding.js?v=20261006e';
import { stempelHochladen, stempelEntfernen, ladeStempelDataUrl } from './stempel.js?v=20261006e';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {object} ctx
 * @param {object} ctx.supabase
 * @param {() => ?string} ctx.ownerId     Id der Praxis (Owner), nicht des angemeldeten Mitarbeiters
 * @param {() => boolean} ctx.istOwner    Nur der Owner darf schreiben
 * @param {() => object}  ctx.profil      Profilzeile der PRAXIS (`ownerProfile || currentProfile`)
 * @param {(patch: object) => void} ctx.profilAktualisieren   hält den lokalen Zustand aktuell
 * @param {(msg: string, art?: string) => void} ctx.toast
 */
export function mountBrandingExtras(ctx, doc = document) {
  const wurzel = doc.getElementById('brandingExtras');
  if (!wurzel || wurzel.dataset.verdrahtet) return;
  wurzel.dataset.verdrahtet = '1';
  const $ = (id) => doc.getElementById(id);
  const darf = () => !!ctx.istOwner();

  async function zeichneLuecken() {
    const b = brandingAus(ctx.profil());
    const l = brandingLuecken(b);
    const ziel = $('brandingLuecken');
    if (!ziel) return;
    const zeile = (x) => `<li><a href="#" data-sprung="${esc(x.ziel)}">${esc(x.label)}</a></li>`;
    ziel.innerHTML = !l.pflicht.length && !l.soll.length
      ? '<div class="form-hint" style="color:var(--success,#22c55e);">✓ Alle Angaben für Ihre Rechnungen sind vorhanden.</div>'
      : `${l.pflicht.length ? `<div class="form-hint"><strong>Für Rechnungen nötig:</strong></div><ul class="branding-liste">${l.pflicht.map(zeile).join('')}</ul>` : ''}`
        + `${l.soll.length ? `<div class="form-hint"><strong>Empfohlen:</strong></div><ul class="branding-liste">${l.soll.map(zeile).join('')}</ul>` : ''}`;
    ziel.querySelectorAll('[data-sprung]').forEach((a) => a.addEventListener('click', (ev) => {
      ev.preventDefault();
      doc.getElementById(a.dataset.sprung)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  async function zeichneStempel() {
    const b = brandingAus(ctx.profil());
    const img = $('brandingStempelImg'); const box = $('brandingStempelPreview');
    const entf = $('brandingStempelRemoveBtn');
    const url = b.stempelPfad ? await ladeStempelDataUrl(ctx.supabase, b.stempelPfad) : '';
    if (img) img.src = url;
    if (box) box.style.display = url ? '' : 'none';
    if (entf) entf.style.display = url && darf() ? '' : 'none';
    const inh = $('brandingInhaber');
    if (inh) { inh.value = b.inhaber; inh.disabled = !darf(); }
    ['brandingStempelUploadBtn'].forEach((id) => { const e = $(id); if (e) e.disabled = !darf(); });
    const hinweis = $('brandingStempelRechte');
    if (hinweis) hinweis.hidden = darf();
  }

  async function alles() { await Promise.all([zeichneLuecken(), zeichneStempel()]); }

  $('brandingStempelUploadBtn')?.addEventListener('click', () => $('brandingStempelInput')?.click());
  $('brandingStempelInput')?.addEventListener('change', async (ev) => {
    const datei = ev.target.files?.[0]; ev.target.value = '';
    if (!datei || !darf()) return;
    const r = await stempelHochladen(ctx.supabase, { ownerId: ctx.ownerId(), file: datei });
    if (!r.ok) { ctx.toast(r.meldung, 'error'); return; }
    ctx.profilAktualisieren({ praxis_stempel_path: r.pfad });
    ctx.toast('Stempel gespeichert', 'success');
    await alles();
  });
  $('brandingStempelRemoveBtn')?.addEventListener('click', async () => {
    if (!darf()) return;
    const r = await stempelEntfernen(ctx.supabase, { ownerId: ctx.ownerId() });
    if (!r.ok) { ctx.toast(r.meldung, 'error'); return; }
    ctx.profilAktualisieren({ praxis_stempel_path: null });
    ctx.toast('Stempel entfernt', 'success');
    await alles();
  });
  $('brandingInhaber')?.addEventListener('change', async (ev) => {
    if (!darf()) return;
    const wert = ev.target.value.trim().slice(0, 200) || null;
    const { data, error } = await ctx.supabase.from('profiles').update({ praxis_inhaber: wert }).eq('id', ctx.ownerId()).select('id');
    if (error || !(data || []).length) { ctx.toast('Der Name konnte nicht gespeichert werden.', 'error'); return; }
    ctx.profilAktualisieren({ praxis_inhaber: wert });
    ctx.toast('Gespeichert', 'success');
    await zeichneLuecken();
  });

  const abschnitt = $('settingsBrandingSection');
  if (abschnitt && typeof IntersectionObserver === 'function') {
    new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) alles(); }).observe(abschnitt);
  } else { alles(); }
  return { aktualisieren: alles };
}
