/**
 * ohne-emoji.js — keine Emojis in der Oberfläche des neuen Designs (Melih 26.10.2026, hohe Priorität:
 * „keine Emojis … soll nicht nach KI aussehen“; STATUS V3.W).
 *
 * Nur im neuen Design (geladen über module/shell-neu.js); das alte Design bleibt unverändert.
 * Rund 120 Bild-Emojis stehen verteilt in dashboard.js, dashboard.html und ~30 Modulen. Statt sie
 * jetzt in allen Quelltexten zu ersetzen (beide Designs, Altvergleich), werden sie hier beim Rendern
 * zentral behandelt:
 *  - bedeutungstragende Zeichen → monochromes SVG aus der bestehenden Icon-Sprache (currentColor),
 *  - reine Dekoration → entfernt (samt Leerzeichen dahinter),
 *  - würde ein Element dadurch leer (Knopf nur aus Emoji, ohne Ersatzsymbol), bleibt das Original.
 * Typografische Zeichen wie ✓ ✕ ✗ → ← sind keine Emojis und bleiben.
 * Eingabefelder, <option>-Texte (kein SVG möglich: nur entfernen), Skripte und Styles werden geachtet.
 * Später ersetzen die Bereichspakete die Zeichen direkt im Quelltext; dann wird dieses Modul kleiner.
 */

const P = (d) => `<svg class="px-sym" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const SVG = {
  warn: P('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  druck: P('<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>'),
  loeschen: P('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  stift: P('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  suche: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  kalender: P('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  dokument: P('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
  post: P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  uhr: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  punkt: '<svg class="px-sym" viewBox="0 0 24 24" width="0.7em" height="0.7em" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>',
  stern: P('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  auto: P('<path d="M5 17h14M6 17l1.5-6h9L18 17"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>'),
  personen: P('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.7"/>'),
  gebaeude: P('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-4h4v4"/>'),
  ort: P('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  geld: P('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
  blitz: P('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
};
/** Zeichen → Ersatz-Schlüssel. Fehlt ein Zeichen hier, ist es Dekoration und fällt weg. */
const ERSATZ = {
  '⚠': 'warn', '🖨': 'druck', '🗑': 'loeschen', '✏': 'stift', '✎': 'stift', '✍': 'stift', '🔍': 'suche',
  '📅': 'kalender', '🗓': 'kalender', '📋': 'dokument', '📄': 'dokument', '🧾': 'dokument', '✉': 'post', '📧': 'post',
  '⏳': 'uhr', '⏰': 'uhr', '🕐': 'uhr', '🔴': 'punkt', '🟡': 'punkt', '🟢': 'punkt', '⭐': 'stern', '🚗': 'auto', '🚙': 'auto',
  '👥': 'personen', '🏢': 'gebaeude', '📍': 'ort', '💶': 'geld', '💰': 'geld', '⚡': 'blitz',
};

// Bewusst eng: Emoji-Ebene (ab U+1F000) plus eine feste Liste aus der Grundebene. ©, ®, ™, Pfeile wie
// ↩ und typografische ✓ ✕ ✗ bleiben, obwohl Unicode manche davon „Extended_Pictographic“ nennt.
const KLASSE = '[\\u{1F000}-\\u{1FAFF}⚠⚡⏳⏰⌛⌚✏✎✉✍⭐✔✅❌⚕❗❓☎☀✨❤⛔]';
const BILD = new RegExp(`${KLASSE}\\uFE0F?`, 'u');
const TEIL = new RegExp(`(${KLASSE})\\uFE0F?(\\s?)`, 'gu');
/** Bildzeichen mit typografischem Gegenstück: als Text behalten. */
const ALS_TEXT = { '✔': '✓', '✅': '✓', '❌': '✕' };

/**
 * Reine Hilfe (testbar): zerlegt einen Text in Teile { text } und { symbol } ohne Emojis.
 * @returns {Array<{text?: string, symbol?: string}>|null}  null = kein Emoji enthalten
 */
export function zerlege(text) {
  const s = String(text ?? '');
  if (!BILD.test(s)) return null;
  const teile = [];
  let rest = 0;
  for (const m of s.matchAll(TEIL)) {
    const [ganz, zeichen, raum] = m;
    if (m.index > rest) teile.push({ text: s.slice(rest, m.index) });
    if (ALS_TEXT[zeichen]) teile.push({ text: ALS_TEXT[zeichen] + raum });
    else if (ERSATZ[zeichen]) teile.push({ symbol: ERSATZ[zeichen] }, ...(raum ? [{ text: raum }] : []));
    rest = m.index + ganz.length;
  }
  if (rest < s.length) teile.push({ text: s.slice(rest) });
  // Zusammenfassen und überzählige Leerzeichen am Rand der Dekor-Lücken glätten.
  const out = [];
  for (const t of teile) {
    const letzter = out[out.length - 1];
    if (t.text !== undefined && letzter?.text !== undefined) letzter.text += t.text;
    else out.push({ ...t });
  }
  return out.filter((t) => t.symbol || t.text);
}

/** Reine Hilfe: nur Text, ohne Emojis (für <option>, title usw.). */
export function nurText(text) {
  const teile = zerlege(text);
  if (!teile) return String(text ?? '');
  return teile.filter((t) => t.text !== undefined).map((t) => t.text).join('').replace(/\s{2,}/g, ' ').trim();
}

const AUSLASSEN = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'svg']);

function bearbeite(knoten) {
  const el = knoten.parentElement;
  if (!el || AUSLASSEN.has(el.tagName) || el.closest('[contenteditable="true"], textarea, script, style')) return;
  const teile = zerlege(knoten.nodeValue);
  if (!teile) return;
  if (el.tagName === 'OPTION' || el.tagName === 'TITLE') { knoten.nodeValue = nurText(knoten.nodeValue); return; }
  const bleibtEtwas = teile.some((t) => t.symbol || t.text.trim()) || (el.textContent.replace(knoten.nodeValue, '').trim() !== '') || el.querySelector('svg, img');
  if (!bleibtEtwas) return; // Element würde leer: Original lassen
  const frag = document.createDocumentFragment();
  for (const t of teile) {
    if (t.symbol) { const span = document.createElement('span'); span.className = 'px-sym-wrap'; span.innerHTML = SVG[t.symbol]; frag.appendChild(span); }
    else frag.appendChild(document.createTextNode(t.text));
  }
  knoten.replaceWith(frag);
}

function durchlaufe(wurzel) {
  if (!wurzel) return;
  if (wurzel.nodeType === 3) { bearbeite(wurzel); return; }
  if (wurzel.nodeType !== 1 || AUSLASSEN.has(wurzel.tagName)) return;
  const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (BILD.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const liste = [];
  while (gang.nextNode()) liste.push(gang.currentNode);
  liste.forEach(bearbeite);
  for (const el of wurzel.querySelectorAll?.('[title]') || []) if (BILD.test(el.title)) el.title = nurText(el.title);
}

let laeuft = false;
/** Einmal starten: jetziger Inhalt + alles, was dashboard.js später rendert. */
export function emojisAus() {
  if (laeuft || typeof document === 'undefined') return;
  laeuft = true;
  durchlaufe(document.body);
  let offen = new Set();
  let geplant = false;
  const abarbeiten = () => { geplant = false; const l = offen; offen = new Set(); l.forEach((n) => n.isConnected && durchlaufe(n)); };
  new MutationObserver((liste) => {
    for (const m of liste) {
      if (m.type === 'characterData') offen.add(m.target);
      else m.addedNodes.forEach((n) => offen.add(n));
    }
    if (!geplant && offen.size) { geplant = true; queueMicrotask(abarbeiten); }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
