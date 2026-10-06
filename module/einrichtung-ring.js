/**
 * einrichtung-ring.js — der kleine Ring in der Kopfleiste (KHS M2.6).
 * Rechnung: `module/einrichtung-fortschritt.js`. Hier nur Zeichnung und Klick.
 *
 * - Nur für die Inhaberin / den Inhaber (Mitarbeiter können nichts nachtragen).
 * - Bei 100 % unsichtbar. Blockiert nie etwas; ein Klick öffnet die Liste, ein Klick auf einen
 *   Eintrag springt zur Einstellung.
 * - Farben nur über Theme-Variablen.
 */
import { einrichtungFortschritt, ringStrich } from './einrichtung-fortschritt.js?v=20261006g';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = 11;

/**
 * @param {object} ctx
 * @param {() => ?object} ctx.profil      Profilzeile der Praxis
 * @param {() => boolean} ctx.istOwner
 * @param {(zielId: string) => void} ctx.springe   öffnet die Einstellungen und scrollt zum Abschnitt
 */
export function mountEinrichtungRing(ctx, doc = document) {
  const knopf = doc.getElementById('einrichtungRing');
  const pop = doc.getElementById('einrichtungPopover');
  if (!knopf || !pop || knopf.dataset.verdrahtet) return null;
  knopf.dataset.verdrahtet = '1';

  function zeichne() {
    const p = ctx.profil();
    if (!p || !p.id || !ctx.istOwner()) { knopf.hidden = true; pop.hidden = true; return; }
    const r = einrichtungFortschritt(p);
    if (!r.fehlend.length) { knopf.hidden = true; pop.hidden = true; return; }
    const s = ringStrich(r.prozent, R);
    knopf.hidden = false;
    knopf.setAttribute('aria-label', `Einrichtung zu ${r.prozent} Prozent abgeschlossen — Liste öffnen`);
    knopf.innerHTML = `<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <circle cx="15" cy="15" r="${R}" fill="none" stroke="var(--border)" stroke-width="3"/>
        <circle cx="15" cy="15" r="${R}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round"
          stroke-dasharray="${s.umfang.toFixed(2)}" stroke-dashoffset="${s.versatz.toFixed(2)}" transform="rotate(-90 15 15)"/>
      </svg><span class="einrichtung-ring-text">${r.prozent} %</span>`;
    const zeile = (x) => `<li><button type="button" data-ziel="${esc(x.zielAnsicht)}">${esc(x.label)}<small>${x.stufe === 'pflicht' ? 'für Rechnungen nötig' : 'empfohlen'}</small></button></li>`;
    pop.innerHTML = `<div class="einrichtung-pop-kopf">Einrichtung zu ${r.prozent} % abgeschlossen</div>
      <ul>${r.fehlend.map(zeile).join('')}</ul>
      <div class="einrichtung-pop-fuss">Das blockiert nichts — Sie können jederzeit weiterarbeiten.</div>`;
  }

  knopf.addEventListener('click', () => {
    zeichne();
    pop.hidden = !pop.hidden;
    knopf.setAttribute('aria-expanded', pop.hidden ? 'false' : 'true');
  });
  pop.addEventListener('click', (ev) => {
    const b = ev.target.closest?.('[data-ziel]');
    if (!b) return;
    pop.hidden = true; knopf.setAttribute('aria-expanded', 'false');
    ctx.springe(b.dataset.ziel);
  });
  doc.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !pop.hidden) { pop.hidden = true; knopf.focus(); } });
  doc.addEventListener('click', (ev) => { if (!pop.hidden && !pop.contains(ev.target) && !knopf.contains(ev.target)) pop.hidden = true; });

  zeichne();
  // Das Profil kommt nach dem Laden der Seite; danach reicht ein ruhiger Takt + das Signal der Branding-Seite.
  doc.addEventListener('praxis-profil:geaendert', zeichne);
  const takt = setInterval(zeichne, 30000);
  setTimeout(zeichne, 1500); setTimeout(zeichne, 5000);
  return { aktualisieren: zeichne, stop: () => clearInterval(takt) };
}
