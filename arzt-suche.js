/**
 * arzt-suche.js — THE shared Arzt (doctor) picker for the whole app.
 *
 * Gegenstück zum Ärzte-Register: dort werden die Ärzte gesammelt (resolveArzt →
 * api-backend/lib/arzt-registry.js), hier kommen sie in die Formulare zurück.
 * Ohne das eine ist das andere nutzlos.
 *
 * Vorher hingen alle Arzt-Felder an einer <datalist> (`aerzteDatalist`,
 * `podArztList`). Die konnte NUR nach dem Namen suchen — genau das, was der
 * Anwender nicht tippen will. Wer die ersten Ziffern der LANR eingab, bekam
 * keinen Treffer, und übernommen wurde ohnehin nur der Name; LANR/BSNR mussten
 * per exaktem Namensvergleich nachgereicht werden und blieben stehen, wenn man
 * den Arzt wechselte.
 *
 * Dieses Modul sucht über Name, LANR, BSNR, Telefon/Fax, Fachrichtung und
 * Adresse und übergibt beim Klick das ganze Arzt-Objekt — die Felder werden
 * gemeinsam gefüllt.
 *
 * Kein eigenes Dropdown mehr bauen: das generische kommt aus katalog-suche.js,
 * genau wie beim ICD-/Heilmittel-Feld.
 *
 * Usage:
 *   attachArztSearch(inputEl, {
 *     loadAerzte: async () => [...],   // Aufrufer besitzt die Query
 *     onSelect:   arzt => {...},
 *     writes:     'name' | 'lanr',     // was im Feld selbst landet
 *   });
 */

'use strict';

import { attachAutocomplete } from './katalog-suche.js?v=20260814a';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const digits = s => String(s ?? '').replace(/\D/g, '');

/**
 * Trifft der Arzt die Eingabe? Zahlen werden nur gegen Zahlenfelder geprüft,
 * damit "523" nicht über eine Hausnummer in der Adresse zufällig trifft.
 * @param {object} a  Zeile aus `aerzte`
 * @param {string} q  bereits getrimmt
 */
export function arztMatchesQuery(a, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  const d = digits(s);
  if (d && d === s.replace(/[\s/+()-]/g, '')) {
    // Reine Zifferneingabe → Nummernfelder, und zwar von vorne: so wie der
    // Anwender die LANR abliest.
    return [a.lanr, a.bsnr, a.telefon, a.fax].some(v => digits(v).includes(d));
  }
  return [a.arzt_name, a.fachrichtung, a.adresse, a.email, a.lanr, a.bsnr]
    .some(v => String(v ?? '').toLowerCase().includes(s));
}

/** Nummern-Prefixtreffer nach oben, danach Namensanfang, sonst alphabetisch. */
function rankAerzte(rows, q) {
  const s = String(q || '').trim().toLowerCase();
  const d = digits(s);
  const score = a => {
    if (d && (digits(a.lanr).startsWith(d) || digits(a.bsnr).startsWith(d))) return 0;
    if (s && String(a.arzt_name || '').toLowerCase().startsWith(s)) return 1;
    return 2;
  };
  return rows.slice().sort((a, b) =>
    score(a) - score(b) ||
    String(a.arzt_name || '').localeCompare(String(b.arzt_name || ''), 'de'));
}

/** Einzeiliges Label für Hinweise ("Bekannter Arzt · …"). */
export function arztMetaText(a) {
  return [
    a?.lanr    ? `LANR ${a.lanr}` : null,
    a?.bsnr    ? `BSNR ${a.bsnr}` : null,
    a?.telefon ? `Tel. ${a.telefon}` : null,
    a?.fachrichtung || null,
  ].filter(Boolean).join(' · ');
}

/**
 * @param {HTMLInputElement} inputEl
 * @param {object}   cfg
 * @param {Function} cfg.loadAerzte  async () => Array — owner-weites Register
 * @param {Function} [cfg.onSelect]  (arzt) => void
 * @param {'name'|'lanr'} [cfg.writes]  Wert, der ins Feld selbst geschrieben wird
 * @param {number}   [cfg.limit]
 */
export function attachArztSearch(inputEl, cfg = {}) {
  if (!inputEl) return;
  const { loadAerzte, onSelect = null, writes = 'name', limit = 25 } = cfg;
  if (typeof loadAerzte !== 'function') return;

  attachAutocomplete(inputEl, {
    ariaLabel: 'Arzt-Vorschläge',
    // 0 = ein Klick ins leere Feld listet das Register. Bei drei Ziffern ist
    // die Liste ohnehin kurz — das ist die eigentliche Anforderung.
    minChars: 0,
    onSelect,
    fetchItems: async (q) => {
      let rows = [];
      try { rows = (await loadAerzte()) || []; }
      catch (e) { console.warn('[arzt-suche] load:', e); return []; }
      return rankAerzte(rows.filter(a => arztMatchesQuery(a, q)), q).slice(0, limit);
    },
    toText: a => (writes === 'lanr' ? (a.lanr || '') : (a.arzt_name || '')),
    renderItem: a =>
      `<span class="icd-code">${esc(a.lanr || '—')}</span>` +
      `<span class="icd-title">${esc(a.arzt_name || '')}` +
      (a.fachrichtung || a.telefon
        ? `<span style="display:block;font-size:11px;opacity:.65;">` +
          esc([a.fachrichtung, a.telefon].filter(Boolean).join(' · ')) + `</span>`
        : '') +
      `</span>` +
      (a.bsnr ? `<span class="icd-badge">BSNR ${esc(a.bsnr)}</span>` : ''),
  });
}
