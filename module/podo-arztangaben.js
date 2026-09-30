/**
 * podo-arztangaben.js — Arzt-Nr. und Unterschrift/Stempel der podologischen
 * Verordnung: wann darf die Behandlung beginnen?
 *
 * Reform S3.7 (29.09.2026, gkv-302 + wissensbank, wissensbank/SPEC-RULES.md):
 * Podologie-Vertrag Anlage 3 Ziffer 3 + Ziffer 5 a) — ohne Arzt-Nr. (LANR) oder
 * ohne Arztstempel/Unterschrift darf die Behandlung nicht beginnen. KEIN
 * Override. Das Speichern der VERORDNUNG bleibt erlaubt (was auf dem Papier
 * steht, wird erfasst und danach vom Arzt ergaenzt) — gesperrt ist die
 * Behandlung und der Status „Bereit".
 * BSNR fehlt und LANR-Pruefziffer sind nur Warnungen.
 *
 * Spiegel: api-backend/billing/utils/arztangaben.js (Server-Riegel fuer
 * „Bereit") — beide gemeinsam aendern. Spalten in `prescriptions`:
 * doctor_lanr, unterschrift_vorhanden (ausTopf laesst sie unveraendert).
 * Nur fuer therapie_bereich 'podo'; Physio/Ergo/Logo bleiben unberuehrt.
 */

import { lanrPruefzifferWarnung } from './lanr-pruefung.js?v=20260929r';

export const LANR_ERSATZWERT = '999999999';

/**
 * Der EINE Sperr-Text (Reform P3-2, 30.09.2026): nennt, was auf der Verordnung fehlt.
 * Banner, Speichern-Hinweis und Behandlungs-Sperre lesen alle hier; kein zweiter Wortlaut.
 * @param {{lanrFehlt:boolean, unterschriftFehlt:boolean}} lage  aus arztangabenLage()
 * @returns {string} '' wenn nichts fehlt
 */
export function sperreTextAusLage(lage) {
  const { lanrFehlt, unterschriftFehlt } = lage || {};
  if (!lanrFehlt && !unterschriftFehlt) return '';
  const was = (lanrFehlt && unterschriftFehlt) ? 'Arzt-Nr. (LANR) und Unterschrift/Stempel fehlen'
    : lanrFehlt ? 'Arzt-Nr. (LANR) fehlt'
    : 'Unterschrift/Stempel des Arztes fehlt';
  return `Behandlung gesperrt: ${was} (Podologie-Vertrag Anlage 3). `
    + 'Bitte vom Arzt ergänzen lassen und in der Verordnung nachtragen.';
}

export const BSNR_HINWEIS = 'BSNR fehlt — kann vom Arztstempel übernommen werden.';

/** @returns {{lanrFehlt:boolean, unterschriftFehlt:boolean}} */
export function arztangabenLage({ lanr, unterschrift } = {}) {
  const l = String(lanr || '').trim();
  return { lanrFehlt: !l || l === LANR_ERSATZWERT, unterschriftFehlt: unterschrift !== true };
}

/** Saubere Verordnung aus `prescriptions` (podo). null/andere Bereiche: nie gesperrt. */
export function behandlungGesperrt(rx) {
  if (!rx || rx.therapie_bereich !== 'podo') return { gesperrt: false, text: '' };
  const a = arztangabenLage({ lanr: rx.doctor_lanr, unterschrift: rx.unterschrift_vorhanden });
  const gesperrt = a.lanrFehlt || a.unterschriftFehlt;
  return { gesperrt, text: sperreTextAusLage(a) };
}

/**
 * Hinweise fuer das Speichern der Verordnung (Muster-13-Maske). Blockiert
 * NICHTS — die Maske zeigt sie im „Trotzdem speichern?"-Dialog.
 * `satz` (Behandlungssperre) nur wenn Arzt-Nr. oder Unterschrift fehlt;
 * `hinweise`: LANR-Pruefziffer und BSNR (beide nur Warnung). Nur Podologie.
 * @returns {{hinweise:string[], satz:string}}
 */
export function podoArztHinweise({ bereich, lanr, bsnr, unterschrift } = {}) {
  if (bereich !== 'podo') return { hinweise: [], satz: '' };
  const a = arztangabenLage({ lanr, unterschrift });
  const hinweise = [];
  const pz = lanrPruefzifferWarnung(lanr);
  if (pz) hinweise.push(pz);
  if (!String(bsnr || '').trim()) hinweise.push(BSNR_HINWEIS);
  return { hinweise, satz: sperreTextAusLage(a) };
}
