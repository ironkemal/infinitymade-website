// Praxura Ops — kleine gemeinsame Bausteine für die Betriebs-Ansichten
// (Kunden, Support, Boxen, Übersicht, Team). Modal/Toast/esc kommen aus app.js.
import { esc, state } from './app.js?v=20261120a';

/** Tabelle/Spalte fehlt → Migration noch nicht ausgeführt (kein echter Fehler). */
export function isMissingSchema(err) {
  if (!err) return false;
  const code = err.code || '';
  return code === 'PGRST205' || code === '42P01' || code === 'PGRST204' || code === '42703' ||
    /schema cache|does not exist|Could not find the table/i.test(err.message || '');
}

export function setupNotice(file = 'schema-rollen-betrieb.sql') {
  return `<div class="notice">
    <strong>Datenbank noch nicht vorbereitet.</strong>
    Diese Ansicht braucht <code>ops/${esc(file)}</code>. Einmal im Supabase-SQL-Editor
    des <em>Ops</em>-Projekts ausführen (nicht im Produktprojekt), dann neu laden.
  </div>`;
}

/** <option>-Liste aus {wert: label}. */
export function options(map, selected, { empty } = {}) {
  const head = empty !== undefined ? `<option value="">${esc(empty)}</option>` : '';
  return head + Object.entries(map).map(([v, l]) =>
    `<option value="${esc(v)}" ${String(selected ?? '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
}

export function memberOptions(selected, { empty = '— niemand —', filter } = {}) {
  const ms = state.members.filter(m => m.active !== false && (!filter || filter(m)));
  return `<option value="">${esc(empty)}</option>` + ms.map(m =>
    `<option value="${m.id}" ${selected === m.id ? 'selected' : ''}>${esc(m.display_name)}</option>`).join('');
}

/** Farbige Kennzeichnung. tone: ok | warn | bad | info | mute | gold */
export const pill = (text, tone = 'mute') => `<span class="pill pill-${tone}">${esc(text)}</span>`;

export function memberChip(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return '<span class="hint">—</span>';
  return `<span class="chip"><i style="background:${esc(m.color)}"></i>${esc(m.display_name)}</span>`;
}

/** Ganze Tage bis Datum (negativ = vorbei). null, wenn kein Datum. */
export function daysUntil(d) {
  if (!d) return null;
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}

export function relDays(d) {
  const n = daysUntil(d);
  if (n === null) return '';
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'gestern';
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
}

/** Felder mit data-f="spalte" einsammeln. Leere Strings → null, data-num → Zahl. */
export function readFields(root) {
  const out = {};
  root.querySelectorAll('[data-f]').forEach(el => {
    let v = el.type === 'checkbox' ? el.checked : el.value.trim();
    if (v === '' ) v = el.hasAttribute('data-keep-empty') ? '' : null;
    else if (el.hasAttribute('data-num')) v = Number(String(v).replace(',', '.'));
    out[el.dataset.f] = v;
  });
  return out;
}

export const fld = (label, inner, cls = '') => `<label class="fld ${cls}"><span>${esc(label)}</span>${inner}</label>`;
export const inp = (f, v, attrs = '') => `<input data-f="${f}" value="${esc(v ?? '')}" ${attrs}>`;
export const txt = (f, v, attrs = '') => `<textarea data-f="${f}" data-keep-empty ${attrs}>${esc(v ?? '')}</textarea>`;
export const sel = (f, inner) => `<select data-f="${f}">${inner}</select>`;

/** Leerer Zustand mit optionaler Aktion. */
export const empty = (text) => `<p class="empty">${esc(text)}</p>`;

/** Einfacher Debounce für Suchfelder. */
export function debounce(fn, ms = 200) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Ansichtseinstellungen (Filter, Modus) pro Browser merken. Nur Komfort —
 *  fehlt localStorage (privates Fenster), gelten die Vorgaben. */
export function persistUi(key, defaults) {
  const ui = { ...defaults };
  try { Object.assign(ui, JSON.parse(localStorage.getItem(key) || '{}')); } catch {}
  const save = () => { try { localStorage.setItem(key, JSON.stringify(ui)); } catch {} };
  return [ui, save];
}
