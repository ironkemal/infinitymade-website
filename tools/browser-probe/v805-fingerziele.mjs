#!/usr/bin/env node
/**
 * v805-fingerziele.mjs — Fingerziele, Überdeckung und Abschneiden je Panel im neuen Design (V8.05).
 *
 *   node tools/browser-probe/v805-fingerziele.mjs --lauf vor [--breite 390,768,1024] [--rolle owner|employee|beide]
 *        [--theme hell|dunkel|beide] [--panels a,b]
 *   → JSON auf stdout (Zusammenfassung) und .redesign-shots/v805-<lauf>.json (alle Funde). Immer Exit 0
 *     (Messwerkzeug, keine Abnahme-Schranke); Exit 2 bei Bedienfehler.
 *
 * Warum
 * ─────
 * redesign-smoke misst nur den Seitenüberlauf. V3.01 (v301-bausteine.mjs) misst Fingerziele nur im
 * Katalog, nicht in den echten Panels. Diese Probe misst in der synthetischen Praxis
 * (tools/redesign-harness.mjs, ohne Login, nur lesend) je Panel:
 *   - ueberlauf   documentElement.scrollWidth > clientWidth (oder #mainArea)
 *   - ziel        sichtbares Bedienelement im Panel mit Höhe oder Breite < 44 px
 *                 (Inline-Links im Fließtext ausgenommen, WCAG 2.5.8; Checkbox/Radio/Schalter → die Label-Fläche)
 *   - ueberlappt  zwei Bedienelemente, deren Flächen sich > 2 px in beide Richtungen schneiden (keins Vorfahr des anderen)
 *   - verdeckt    Mitte eines Bedienelements im ersten Bildschirm liegt unter einem fremden Element
 *   - abgeschnitten  Bedienelement ragt aus einem Vorfahren mit overflow hidden/clip oder rechts aus dem Viewport
 * Arten der Ziele: knopf · feld · filter · tab · auswahl · link · zeile (Tabellenzeile mit onclick) · sonst.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PANELS, WURZEL, oeffneDashboard, ruhe, starteBrowser, starteServer, wechsle } from '../redesign-harness.mjs';

process.env.REDESIGN_PORT ||= '18805';
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const liste = (w, alle) => (w === 'beide' ? alle : String(w).split(',').map((s) => s.trim()).filter(Boolean));
const lauf = arg('lauf');
if (!lauf || !/^[\w.-]+$/.test(lauf)) { console.error('--lauf <name> fehlt'); process.exit(2); }
const breiten = liste(arg('breite', '390'), []).map(Number);
const rollen = liste(arg('rolle', 'beide'), ['owner', 'employee']);
const themes = liste(arg('theme', 'beide'), ['hell', 'dunkel']);
const panels = arg('panels') ? liste(arg('panels'), []) : PANELS;

const MISS = (pid) => {
  const panel = document.getElementById('panel-' + pid);
  const d = document.documentElement, m = document.getElementById('mainArea');
  const ueber = { dok: d.scrollWidth - d.clientWidth, main: m ? m.scrollWidth - m.clientWidth : 0 };
  if (!panel) return { ueber, ziele: [], paare: [], verdeckt: [], ab: [] };
  const SEL = 'button, a[href], input:not([type="hidden"]), select, textarea, [onclick], [role="button"], [role="tab"], summary, label.toggle-switch';
  const sichtbar = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    // Zugeklapptes <details> (Chrome: content-visibility) zählt als unsichtbar.
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) return false;
    const det = el.closest('details:not([open])');
    if (det && !el.closest('summary')) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      if (e !== el && parseFloat(cs.opacity) === 0) return false;
    }
    return true;
  };
  const sig = (el) => {
    const k = [...el.classList].slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id.replace(/[-_]?\d+.*$/, '') : '') + (k ? '.' + k : '')
      + (el.type && el.tagName === 'INPUT' ? '[' + el.type + ']' : '');
  };
  const art = (el) => {
    if (el.tagName === 'TR' || el.closest('tr') === el) return 'zeile';
    if (el.matches('.filter-btn, .ov-count-btn, .sv-btn, .chip, [class*="filter"]')) return 'filter';
    if (el.matches('.tab-btn, .pd-tab, [role="tab"], [class*="tab"]')) return 'tab';
    if (el.matches('input[type="checkbox"], input[type="radio"], label.toggle-switch, label')) return 'auswahl';
    if (el.matches('input, select, textarea')) return 'feld';
    if (el.matches('button, [role="button"], [class*="btn"]')) return 'knopf';
    if (el.matches('a')) return 'link';
    return 'sonst';
  };
  const roh = [...panel.querySelectorAll(SEL)];
  const gesehen = new Set();
  const ziele = [];
  for (const el0 of roh) {
    let el = el0;
    // Checkbox/Radio/versteckter Schaltereingang: die Trefferfläche ist das Label.
    if (el0.matches('input[type="checkbox"], input[type="radio"]')) {
      const lab = el0.closest('label') || (el0.id && document.querySelector(`label[for="${CSS.escape(el0.id)}"]`));
      if (lab) el = lab;
    }
    if (gesehen.has(el)) continue;
    gesehen.add(el);
    if (!sichtbar(el)) continue;
    const cs = getComputedStyle(el);
    // Inline-Link im Fließtext (Elternteil enthält eigenen Text): WCAG 2.5.8 nimmt ihn aus.
    if (cs.display === 'inline' && el.tagName === 'A' && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect();
    // Sichtbare Fläche: Schnitt mit allen Vorfahren, die ihren Inhalt beschneiden (Scrollbereiche eingeschlossen).
    let v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const c = getComputedStyle(e);
      if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
      const p = e.getBoundingClientRect();
      v = { left: Math.max(v.left, p.left), top: Math.max(v.top, p.top), right: Math.min(v.right, p.right), bottom: Math.min(v.bottom, p.bottom) };
    }
    ziele.push({ el, r, v, art: art(el), sig: sig(el), text: (el.textContent || el.placeholder || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) });
  }
  const klein = ziele.filter((z) => z.r.height < 43.5 || z.r.width < 43.5)
    .map((z) => ({ art: z.art, sig: z.sig, text: z.text, w: Math.round(z.r.width), h: Math.round(z.r.height) }));
  const paare = [];
  for (let i = 0; i < ziele.length; i++) for (let j = i + 1; j < ziele.length; j++) {
    const a = ziele[i], b = ziele[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    // Nur die sichtbaren Flächen vergleichen: im Scrollbereich weggescrollte Teile überdecken nichts.
    const x = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left);
    const y = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
    if (x > 2 && y > 2) paare.push({ a: a.sig, b: b.sig, at: a.text, bt: b.text, x: Math.round(x), y: Math.round(y) });
  }
  const vh = innerHeight, vw = innerWidth;
  const verdeckt = [];
  for (const z of ziele) {
    if (z.v.right - z.v.left < 4 || z.v.bottom - z.v.top < 4) continue;   // weggescrollt/beschnitten: kein Treffer möglich
    const cx = (z.v.left + z.v.right) / 2, cy = (z.v.top + z.v.bottom) / 2;
    if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue;
    const oben = document.elementFromPoint(cx, cy);
    if (!oben || z.el.contains(oben) || oben.contains(z.el)) continue;
    // Label-Fläche: Eingang darin zählt als eigen.
    if (oben.closest('label') === z.el) continue;
    verdeckt.push({ sig: z.sig, text: z.text, von: (oben.id ? '#' + oben.id : oben.tagName.toLowerCase()) + '.' + [...oben.classList].slice(0, 2).join('.') });
  }
  const ab = [];
  for (const z of ziele) {
    if (z.r.right > vw + 1 && !z.el.closest('.table-wrap, [style*="overflow"]')) {
      // Rechts aus dem Viewport ohne eigenen Scrollbereich dazwischen.
      let scroller = false;
      for (let e = z.el.parentElement; e && e !== panel; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll') { scroller = true; break; } }
      if (!scroller) { ab.push({ sig: z.sig, text: z.text, grund: `rechts ${Math.round(z.r.right)} > ${vw}` }); continue; }
    }
    for (let e = z.el.parentElement; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const ox = cs.overflowX, oy = cs.overflowY;
      if (ox === 'visible' && oy === 'visible') continue;
      if (ox === 'auto' || ox === 'scroll' || oy === 'auto' || oy === 'scroll') break;   // Scrollbereich: erreichbar
      const p = e.getBoundingClientRect();
      const ueberX = (ox !== 'visible') && (z.r.left < p.left - 1 || z.r.right > p.right + 1);
      const ueberY = (oy !== 'visible') && (z.r.top < p.top - 1 || z.r.bottom > p.bottom + 1);
      if (ueberX || ueberY) { ab.push({ sig: z.sig, text: z.text, grund: `aus ${e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].slice(0, 2).join('.')} (${ueberX ? 'x' : ''}${ueberY ? 'y' : ''})` }); }
      break;
    }
  }
  return { ueber, ziele: klein, paare, verdeckt, ab, gezaehlt: ziele.length };
};

const server = await starteServer();
const browser = await starteBrowser();
const funde = [];
const proPanel = {};
try {
  for (const rolle of rollen) for (const theme of themes) for (const breite of breiten) {
    const { kontext, page } = await oeffneDashboard(browser, { basis: server.basis, breite, theme, design: 'neu', szenario: 'voll', rolle });
    await ruhe(page, 1000);
    const shell = await page.evaluate(() => document.documentElement.getAttribute('data-design') + '/' + document.documentElement.getAttribute('data-px-shell'));
    for (const panel of panels) {
      const ok = await wechsle(page, panel);
      const k = `${rolle}/${theme}/${breite}/${panel}`;
      if (!ok) { proPanel[k] = { erreicht: false }; continue; }
      const m = await page.evaluate(MISS, panel);
      const f = (artFund, daten) => funde.push({ rolle, theme, breite, panel, fund: artFund, ...daten });
      if (m.ueber.dok > 1 || m.ueber.main > 1) f('ueberlauf', m.ueber);
      for (const z of m.ziele) f('ziel', z);
      for (const p of m.paare) f('ueberlappt', p);
      for (const v of m.verdeckt) f('verdeckt', v);
      for (const a of m.ab) f('abgeschnitten', a);
      proPanel[k] = { erreicht: true, gezaehlt: m.gezaehlt, ueberlauf: Math.max(m.ueber.dok, m.ueber.main), ziel: m.ziele.length, ueberlappt: m.paare.length, verdeckt: m.verdeckt.length, abgeschnitten: m.ab.length };
    }
    await kontext.close();
    process.stderr.write(`${rolle}/${theme}/${breite} (${shell}) gemessen\n`);
  }
} finally { await browser.close(); await server.stop(); }

const summe = {};
for (const x of funde) { const s = (summe[`${x.breite}`] ||= {}); s[x.fund] = (s[x.fund] || 0) + 1; }
const zielArt = {};
for (const x of funde.filter((x) => x.fund === 'ziel')) { const s = (zielArt[`${x.breite}`] ||= {}); s[x.art] = (s[x.art] || 0) + 1; }
await mkdir(join(WURZEL, '.redesign-shots'), { recursive: true });
await writeFile(join(WURZEL, '.redesign-shots', `v805-${lauf}.json`), JSON.stringify({ lauf, zeit: new Date().toISOString(), proPanel, funde }, null, 2));
console.log(JSON.stringify({ lauf, summe, zielArt, nichtErreicht: Object.entries(proPanel).filter(([, v]) => !v.erreicht).map(([k]) => k) }, null, 2));
process.exit(0);
