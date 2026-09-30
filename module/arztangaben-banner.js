/**
 * arztangaben-banner.js — Behandlungssperre-Hinweis LIVE im Verordnungsformular.
 *
 * Podologie-Vertrag Anlage 3: Ohne Arzt-Nr. (LANR) oder ohne Unterschrift/Stempel
 * darf die Behandlung nicht beginnen (siehe module/podo-arztangaben.js).
 * Das Speichern der Verordnung bleibt weiterhin erlaubt.
 *
 * Zeigt die Behandlungssperre live als Banner (#rzSperreBanner) direkt unterhalb
 * der Unterschrift-Zeile im Formular an, sobald der Zustand bekannt ist
 * (Bereich podo + arztangabenLage() meldet fehlende LANR oder Unterschrift).
 */

import { arztangabenLage, SPEICHERN_HINWEIS } from './podo-arztangaben.js?v=20260929r';

export const BANNER_ID = 'rzSperreBanner';

/**
 * Ermittelt den Banner-Text fuer die Behandlungssperre.
 * Reine Funktion, nutzt arztangabenLage().
 *
 * @param {{bereich?: string, lanr?: string, unterschrift?: boolean}} [param0]
 * @returns {string} Der Banner-Text oder leerer String (kein Banner).
 */
export function sperreBannerText({ bereich, lanr, unterschrift } = {}) {
  const b = String(bereich || '').trim().toLowerCase();
  if (b !== 'podo') return '';
  const lage = arztangabenLage({ lanr, unterschrift });
  if (lage.lanrFehlt || lage.unterschriftFehlt) {
    return SPEICHERN_HINWEIS;
  }
  return '';
}

/**
 * Liest die DOM-Felder (#rzTherapieBereich, #rzLanr, #rzUnterschrift)
 * und erzeugt, zeigt oder versteckt das Element #rzSperreBanner.
 * Idempotent, wirft nie, tut nichts wenn document oder Felder fehlen.
 */
export function aktualisiereArztSperreBanner() {
  try {
    if (typeof document === 'undefined' || !document) return;

    const lanrEl = document.getElementById('rzLanr');
    const unterschriftEl = document.getElementById('rzUnterschrift');
    const bereichEl = document.getElementById('rzTherapieBereich');

    if (!lanrEl || !unterschriftEl || !bereichEl) return;

    const bereich = bereichEl.value;
    const lanr = lanrEl.value;
    const unterschrift = Boolean(unterschriftEl.checked);

    const text = sperreBannerText({ bereich, lanr, unterschrift });
    let banner = document.getElementById(BANNER_ID);

    if (!text) {
      if (banner) {
        banner.style.display = 'none';
        banner.textContent = '';
      }
      return;
    }

    if (!banner) {
      const label = (typeof unterschriftEl.closest === 'function')
        ? (unterschriftEl.closest('label') || unterschriftEl.parentElement)
        : unterschriftEl.parentElement;
      const zeile = label ? label.parentElement : unterschriftEl.parentElement;
      if (!zeile) return;

      banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.setAttribute('role', 'status');
      banner.style.cssText =
        'display:block;margin-top:10px;padding:10px 14px;border-radius:8px;'
        + 'border:1px solid var(--warning);background:var(--warning-dim);color:var(--warning-text);'
        + 'font-size:13px;line-height:1.4;';

      if (typeof zeile.insertAdjacentElement === 'function') {
        zeile.insertAdjacentElement('afterend', banner);
      } else if (zeile.parentNode && typeof zeile.parentNode.insertBefore === 'function') {
        zeile.parentNode.insertBefore(banner, zeile.nextSibling);
      } else if (typeof zeile.appendChild === 'function') {
        zeile.appendChild(banner);
      }
    }

    banner.textContent = text;
    banner.style.display = 'block';
  } catch (_e) {
    // Idempotent und wirft nie
  }
}

let _installiert = false;

/**
 * Einmalige Installation: delegierte input- und change-Listener auf document,
 * die bei Aenderungen an #rzLanr, #rzUnterschrift oder #rzTherapieBereich aktualisieren.
 * Ruft anschliessend einmal aktualisiereArztSperreBanner() auf.
 */
export function installiereArztSperreBanner() {
  if (typeof document === 'undefined' || !document) return;
  if (_installiert) return;
  _installiert = true;

  const handler = (event) => {
    const target = event?.target;
    if (!target) return;
    const id = target.id;
    if (id === 'rzLanr' || id === 'rzUnterschrift' || id === 'rzTherapieBereich') {
      aktualisiereArztSperreBanner();
    }
  };

  if (typeof document.addEventListener === 'function') {
    document.addEventListener('input', handler);
    document.addEventListener('change', handler);

    document.addEventListener('click', (event) => {
      const target = event?.target;
      if (!target) return;
      if (target.id === 'rzUnterschrift' || (typeof target.closest === 'function' && target.closest('.m13-chk[data-th], .m13-therapies'))) {
        aktualisiereArztSperreBanner();
      }
    });
  }

  aktualisiereArztSperreBanner();
}

/** Nur fuer isolierte Unit-Tests */
export function _resetInstalliertFuerTest() {
  _installiert = false;
}
