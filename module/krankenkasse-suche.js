/**
 * krankenkasse-suche.js — Kassenauswahl, die die eigene Praxis kennt.
 *
 * Warum es das gibt
 * ─────────────────
 * Die Kassenauswahl war ein `<input list="leadKkDatalist">` mit 93 gesetzlichen
 * Kassen in alphabetischer Reihenfolge. Zwei Probleme:
 *
 *   1. `<datalist>` ist im Haus untersagt (CLAUDE.md → Frontend). Es sieht auf
 *      jedem Browser anders aus, lässt sich nicht gestalten, kann nichts
 *      gruppieren und öffnet neben unseren eigenen Dropdowns ein zweites,
 *      fremdes Menü.
 *   2. Alphabetisch heisst: „AOK Bayern" steht in der Nähe von „actimonda",
 *      und die fünf Kassen, aus denen fast alle Patienten dieser Praxis kommen,
 *      sind über die ganze Liste verteilt. Nausad im Beta-Gespräch (12.08.2026):
 *      seine Patienten sind ganz überwiegend AOK Bayern, Barmer, SBK, TK, HEK
 *      und ein paar BKKs.
 *
 * Woher die Reihenfolge kommt
 * ───────────────────────────
 * NICHT aus einer gepflegten Liste im Code. Eine fest verdrahtete Top-5 wäre
 * für Nürnberg richtig und für Flensburg falsch, und niemand würde sie je
 * nachziehen. Stattdessen zählt diese Datei, welche Kassen in der Kartei DIESER
 * Praxis tatsächlich vorkommen (`leads.krankenkasse`) — die Liste stimmt damit
 * ab dem zwanzigsten Patienten von selbst und bleibt richtig, wenn die Praxis
 * umzieht oder den Schwerpunkt wechselt.
 *
 * Solange noch keine Patienten da sind, bleibt es bei alphabetisch; dann gibt
 * es schlicht nichts zu bevorzugen.
 *
 * Die Dropdown-Mechanik kommt aus `katalog-suche.js` (`attachAutocomplete`) —
 * dieselbe Tastatursteuerung, Positionierung und Trennlogik wie bei Diagnosen
 * und Heilmitteln. Hier steht nur, WAS angezeigt wird, nicht WIE.
 */

'use strict';

import { attachAutocomplete } from '../katalog-suche.js?v=20260817';

/** @type {{ownerId: string, kassen: Array, haeufig: Map}|null} */
let cache = null;

/**
 * Alle Kassen + die Häufigkeit in der eigenen Kartei.
 * @param sb        Supabase-Client
 * @param ownerId   Mandant
 */
export async function ladeKassen(sb, ownerId) {
  if (cache && cache.ownerId === ownerId) return cache;

  const [alle, eigene] = await Promise.all([
    sb.from('krankenkassen').select('name, abbreviation, ik_number, type').order('name'),
    // Nur das Namensfeld — es geht um Häufigkeit, nicht um Patientendaten.
    sb.from('leads').select('krankenkasse').eq('owner_id', ownerId).not('krankenkasse', 'is', null),
  ]);

  if (alle.error) {
    console.warn('[krankenkasse-suche] Kassenliste:', alle.error.message);
    return { ownerId, kassen: [], haeufig: new Map() };
  }

  const haeufig = new Map();
  for (const z of (eigene.data || [])) {
    const k = normalisiere(z.krankenkasse);
    if (k) haeufig.set(k, (haeufig.get(k) || 0) + 1);
  }

  const kassen = (alle.data || []).map(k => ({
    name: k.name,
    kurz: k.abbreviation || null,
    ik:   k.ik_number || null,
    typ:  k.type || 'gesetzlich',
    anzahl: haeufig.get(normalisiere(k.name)) || 0,
  }));

  cache = { ownerId, kassen, haeufig };
  return cache;
}

/** Cache wegwerfen — nach dem Anlegen von Patienten ändert sich die Reihenfolge. */
export function verwerfeKassenCache() { cache = null; }

function normalisiere(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Treffer suchen. Praxiseigene Kassen zuerst (nach Häufigkeit), danach der Rest
 * alphabetisch.
 */
// Grenze grosszuegig: es gibt 94 Kassen in der Tabelle, und die Liste ist
// alphabetisch. Mit einer Obergrenze von 30 brach sie mitten im „B" ab — der
// Anwender sah ein Fuenftel des Bestandes und hielt die Datenquelle fuer falsch.
// Das Dropdown scrollt ohnehin (max-height in dashboard.css), also kostet die
// vollstaendige Liste nichts ausser ein paar Zeilen DOM.
export function sucheKassen(kassen, query, limit = 300) {
  const q = normalisiere(query);
  const passt = q
    ? kassen.filter(k => normalisiere(k.name).includes(q) || normalisiere(k.kurz).includes(q))
    : kassen.slice();

  return passt
    .sort((a, b) => (b.anzahl - a.anzahl) || a.name.localeCompare(b.name, 'de'))
    .slice(0, limit);
}

/**
 * Hängt die Kassenauswahl an ein Textfeld.
 *
 * @param {HTMLInputElement} inputEl
 * @param {object} cfg
 * @param {object} cfg.sb           Supabase-Client
 * @param {Function} cfg.ownerId    () => string
 * @param {Function} [cfg.onSelect] (kasse) => void — bekommt auch die IK-Nummer
 */
export function attachKrankenkasseSuche(inputEl, cfg = {}) {
  if (!inputEl) return;
  const { sb, ownerId, onSelect = null } = cfg;

  // Das alte <datalist> würde sonst als zweites Menü danebenstehen.
  inputEl.removeAttribute('list');
  inputEl.setAttribute('autocomplete', 'off');

  attachAutocomplete(inputEl, {
    minChars: 0,          // leeres Feld zeigt die Kassen der Praxis — der Normalfall
    ariaLabel: 'Krankenkassen',
    separatorLabel: 'Weitere Kassen',
    // Trenner genau dort, wo die eigenen Kassen aufhören.
    needsSeparator: (prev, cur) => prev.anzahl > 0 && cur.anzahl === 0,

    fetchItems: async (query) => {
      const { kassen } = await ladeKassen(sb, ownerId());
      return sucheKassen(kassen, query);
    },

    toText: k => k.name,

    renderItem: k => {
      const ik = k.ik ? `<span style="color:var(--text-muted);font-size:11px;">IK ${k.ik}</span>` : '';
      // Die Zahl erklärt die Reihenfolge. Ohne sie wirkt eine nicht-alphabetische
      // Liste wie ein Fehler.
      const zaehler = k.anzahl > 0
        ? `<span style="color:var(--text-muted);font-size:11px;">${k.anzahl}×</span>`
        : '';
      return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">
                <span>${esc(k.name)}${k.kurz && k.kurz !== k.name ? ` <span style="color:var(--text-muted);font-size:11px;">${esc(k.kurz)}</span>` : ''}</span>
                <span style="display:flex;gap:8px;white-space:nowrap;">${zaehler}${ik}</span>
              </div>`;
    },

    onSelect: k => { if (onSelect) onSelect(k); },
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
