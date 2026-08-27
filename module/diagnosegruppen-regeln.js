/**
 * diagnosegruppen-regeln.js — ICD-Prüfregeln und Bezeichnungen der Diagnosegruppen.
 *
 * Herkunft
 * ────────
 * Herausgelöst aus `dashboard.js` (Konsey 2026-08-13: „angefasst heisst umgezogen").
 * Der Umzug des Podologie-Abrechnungsblocks hat diesen Teil mitgenommen — aber
 * NICHT in das Podologie-Modul.
 *
 * Warum eine eigene Datei und nicht `podologie-abrechnung.js`?
 * ───────────────────────────────────────────────────────────
 * Die Tabelle `diagnosegruppen` gehört nicht der Podologie. `_wireDgIcdPair` in
 * dashboard.js verdrahtet damit auch das Rezept-Formular und den Rezept-Scan.
 * Läge die Regeltabelle im Podologie-Modul, müsste das Rezept-Formular aus der
 * Podologie lesen — eine Abhängigkeit in die falsche Richtung. Heute filtert
 * `loadDgIcdRules` zwar auf `bereich === 'podologie'`, das ist aber eine
 * Datenfrage, keine Zuständigkeitsfrage.
 *
 * Abhängigkeiten
 * ──────────────
 * `supabase` wird als Parameter übergeben (Muster wie `abrechnungsstatus.js`),
 * `escapeHtml` ist eine wortgleiche lokale Kopie aus dashboard.js — bewusst
 * nicht die Fassung aus `abrechnungsstatus.js`, die escapt zusätzlich `'` und
 * verhält sich bei leerem Wert anders.
 */

import { parseIcdList, matchIcdToDg } from '../icd-dg-match.js?v=20260810e';

/** Wortgleiche Kopie aus dashboard.js — reiner Umzug, kein anderes Verhalten. */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ICD-Prüfregeln je Diagnosegruppe — Quelle ist die Tabelle `diagnosegruppen`
// (Spalten icd_accept / icd_exclude / icd_auto_select / icd_accept_unsicher /
// icd_enforcement), geladen beim ersten Aufruf. Fällt die Abfrage fehl (z. B.
// weil die Migration noch nicht eingespielt ist), wird still auf "keine Regeln"
// zurückgefallen — dann wird nicht gewarnt.
let _dgIcdRules   = null;  // { [dgCode]: { icd_accept, icd_exclude, ... } } (podologie)
let _podDiagGroups = null;  // [{code,label,untergruppen}] aus der Tabelle

export async function loadDgIcdRules(sb) {
  if (_dgIcdRules) return _dgIcdRules;
  const { data, error } = await sb
    .from('diagnosegruppen')
    .select('code, label, untergruppen, icd_accept, icd_exclude, icd_auto_select, icd_accept_unsicher, icd_enforcement, bereich, sort')
    .eq('aktiv', true)
    .order('sort');
  if (error) { console.warn('[diagnosegruppen] load failed:', error.message); return {}; }
  _dgIcdRules = Object.fromEntries(
    (data || [])
      .filter(r => r.bereich === 'podologie')
      .map(r => [r.code, {
        icd_accept:          r.icd_accept          || [],
        icd_exclude:         r.icd_exclude         || [],
        icd_auto_select:     r.icd_auto_select     || [],
        icd_accept_unsicher: r.icd_accept_unsicher || [],
        icd_enforcement:     r.icd_enforcement     || 'warn',
      }])
  );
  _podDiagGroups = (data || []).filter(r => r.bereich === 'podologie');
  return _dgIcdRules;
}

// Optionen der Podologie-Diagnosegruppe. Bezeichnungen kommen aus der Tabelle
// `diagnosegruppen` (HeilM-RL-Wortlaut) — vorher standen hier fest verdrahtete,
// teils falsche Kurztexte. DF hat die Untergruppen a/b/c.
export function podDiagOptionsHtml(selected = '') {
  const groups = _podDiagGroups && _podDiagGroups.length
    ? _podDiagGroups
    : [ // Notnagel, falls die Tabelle nicht geladen werden konnte
        { code:'DF',  label:'Diabetisches Fußsyndrom', untergruppen:['a','b','c'] },
        { code:'NF',  label:'Neuropathisches Fußsyndrom', untergruppen:null },
        { code:'QF',  label:'Querschnittslähmung', untergruppen:null },
        { code:'UI1', label:'Unguis incarnatus Stadium 1', untergruppen:null },
        { code:'UI2', label:'Unguis incarnatus Stadium 2 oder 3', untergruppen:null },
      ];
  const opt = (val, text) =>
    `<option value="${escapeHtml(val)}"${val === selected ? ' selected' : ''}>${escapeHtml(text)}</option>`;
  return groups.flatMap(g =>
    (g.untergruppen && g.untergruppen.length)
      ? g.untergruppen.map(u => opt(`${g.code}-${u}`, `${g.code}-${u} – ${g.label} Typ ${u}`))
      : [opt(g.code, `${g.code} – ${g.label}`)]
  ).join('');
}

/**
 * Prüft einen einzelnen Kode gegen die Regel einer DG.
 * Rückgabe true, wenn der Kode nicht ausgeschlossen ist UND auf icd_accept passt,
 * oder wenn keine Regeln vorhanden sind (kein Pool = keine Warnung).
 * Interne Hilfsfunktion — außen nur noch matchIcdToDg verwenden.
 */
function _icdMatchesDgRule(code, dg) {
  const rule = (_dgIcdRules || {})[dg];
  if (!rule || !rule.icd_accept || rule.icd_accept.length === 0) return true;
  const codes = parseIcdList(code);
  if (codes.length === 0) return true;
  return matchIcdToDg(codes, rule).status === 'ok';
}

// ES-Modul-Bindungen sind schreibgeschützt: `_dgIcdRules` darf nur über diese
// Getter nach draussen, sonst hält der Aufrufer den Stand vom Importzeitpunkt.
/** Die geladenen ICD-Regeln je Diagnosegruppe — `null`, solange nichts geladen wurde. */
export function getDgIcdRules() { return _dgIcdRules; }
/** Die Diagnosegruppen-Zeilen aus der Tabelle — `null`, solange nichts geladen wurde. */
export function getPodDiagGroups() { return _podDiagGroups; }
