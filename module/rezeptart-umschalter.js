/**
 * rezeptart-umschalter.js — die Segmentleiste „Abrechnung über" in der
 * Muster-13-Maske (KHS M2.1, PE-006 A, 05.10.2026).
 *
 * Vertrag mit dem Rest: der gewählte Wert steht als `data-rezeptart` an
 * `#rzMaskeWrap` — `module/verordnung-podo.js` (`rezeptart()`), die Prüfung und
 * `nutzlastAusMaske()` lesen dort. Diese Datei ändert nur Attribut, Klasse und
 * die Leiste selbst; Feldwerte werden NIE gelöscht (Umschalten ist umkehrbar,
 * eine eingetragene Diagnosegruppe bleibt bei Privat stehen).
 *
 * „Eingeklappt, nicht versteckt": bei nicht-Kasse trägt die Maske die Klasse
 * `m13-gkv-zu`, die alle `.m13-gkv`-Elemente ausblendet; der Knopf
 * `#rzGkvToggle` holt sie zurück (`data-gkv-offen`).
 */
import {
  normalisiereRezeptart, brauchtGkvAngaben, rezeptartLabel, istBg, umschaltSperre,
} from './rezeptart.js?v=20261006a';

export const GKV_ZU_KLASSE = 'm13-gkv-zu';

/** Attribut und Klassen an der Maske setzen. Gibt die normalisierte Art zurück. */
export function wendeArtAn(wrap, art) {
  const a = normalisiereRezeptart(art);
  if (!wrap) return a;
  wrap.dataset.rezeptart = a;
  if (brauchtGkvAngaben(a)) delete wrap.dataset.gkvOffen;   // zurück auf Kasse: alles sichtbar, Wahl vergessen
  const zu = !brauchtGkvAngaben(a) && wrap.dataset.gkvOffen !== '1';
  wrap.classList.toggle(GKV_ZU_KLASSE, zu);
  wrap.classList.toggle('m13-art-bg', istBg(a));
  return a;
}

/** Leiste (Knöpfe, Aufklapp-Knopf, Hinweis) an den Zustand der Maske anpassen. */
export function leisteZeichnen(doc, wrap) {
  const leiste = doc.getElementById('rzArtLeiste');
  if (!leiste || !wrap) return;
  const art = normalisiereRezeptart(wrap.dataset.rezeptart);
  const sperre = wrap.dataset.artSperre || '';
  leiste.querySelectorAll('[data-art]').forEach((b) => {
    const an = b.dataset.art === art;
    b.setAttribute('aria-checked', an ? 'true' : 'false');
    b.tabIndex = an ? 0 : -1;
    b.classList.toggle('on', an);
    b.disabled = !!sperre && !an;
  });
  const toggle = doc.getElementById('rzGkvToggle');
  if (toggle) {
    toggle.hidden = brauchtGkvAngaben(art);
    const offen = wrap.dataset.gkvOffen === '1';
    toggle.textContent = offen ? 'GKV-Angaben einklappen' : 'GKV-Angaben anzeigen (Krankenkasse, Diagnosegruppe …)';
    toggle.setAttribute('aria-expanded', offen ? 'true' : 'false');
  }
  const hinweis = doc.getElementById('rzArtHinweis');
  if (hinweis) {
    hinweis.textContent = sperre;
    hinweis.hidden = !sperre;
  }
}

/** Art setzen + Leiste und podologische Felder nachziehen. */
export function setzeArt(doc, art, { nachziehen } = {}) {
  const wrap = doc.getElementById('rzMaskeWrap');
  const a = wendeArtAn(wrap, art);
  leisteZeichnen(doc, wrap);
  if (typeof nachziehen === 'function') nachziehen();
  return a;
}

/** Sperre (belegnummer / Rechnung) an der Maske merken und die Leiste anpassen. */
export function setzeSperre(doc, { belegnummer = null, offeneRechnung = false } = {}) {
  const wrap = doc.getElementById('rzMaskeWrap');
  if (!wrap) return null;
  const grund = umschaltSperre({ belegnummer, offeneRechnung });
  if (grund) wrap.dataset.artSperre = grund; else delete wrap.dataset.artSperre;
  leisteZeichnen(doc, wrap);
  return grund;
}

/**
 * Klicks verdrahten (idempotent). Ein Klick auf eine Art meldet ein
 * `change`-Ereignis, das die Maske als „verändert" zählt
 * (`verordnung-maske.js`, aenderungWachtEcht) — ohne das ginge die Änderung
 * beim Neuzeichnen von aussen verloren.
 */
export function verdrahteLeiste(doc, { nachziehen } = {}) {
  const leiste = doc.getElementById('rzArtLeiste');
  if (!leiste || leiste.dataset.verdrahtet) return;
  leiste.dataset.verdrahtet = '1';
  leiste.addEventListener('click', (ev) => {
    const wrap = doc.getElementById('rzMaskeWrap');
    const knopf = ev.target.closest?.('[data-art]');
    if (knopf && wrap) {
      if (wrap.dataset.artSperre) { leisteZeichnen(doc, wrap); return; }
      // Eine bewusste Abweichung von „Kasse" (Privat/Selbstzahler/BG) schützt vor der Vorauswahl aus dem Patienten.
      // „Kasse" ist der Normalzustand: wer nur herumklickt und bei Kasse landet, hat nichts gewählt
      // (Live-Nachtest N2-a: Pfeiltasten hin und zurück sperrten die Vorauswahl).
      if (knopf.dataset.art === 'kassen') delete wrap.dataset.artManuell; else wrap.dataset.artManuell = '1';
      setzeArt(doc, knopf.dataset.art, { nachziehen });
      knopf.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (ev.target.closest?.('#rzGkvToggle') && wrap) {
      if (wrap.dataset.gkvOffen === '1') delete wrap.dataset.gkvOffen; else wrap.dataset.gkvOffen = '1';
      wendeArtAn(wrap, wrap.dataset.rezeptart);
      leisteZeichnen(doc, wrap);
    }
  });
  // Pfeiltasten wie bei einer Radiogruppe.
  leiste.addEventListener('keydown', (ev) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const knoepfe = [...leiste.querySelectorAll('[data-art]')].filter((b) => !b.disabled);
    const i = knoepfe.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    if (i < 0) return;
    const n = knoepfe[(i + (ev.key === 'ArrowRight' ? 1 : knoepfe.length - 1)) % knoepfe.length];
    n.focus(); n.click(); ev.preventDefault();
  });
}

export { rezeptartLabel };
