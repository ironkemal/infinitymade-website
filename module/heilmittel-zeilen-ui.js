/**
 * heilmittel-zeilen-ui.js — Dynamische Heilmittelzeilen in Muster 13 (Ops #202).
 *
 * Verwaltet bis zu drei vorrangige Heilmittelzeilen für Physiotherapie und
 * Ergotherapie (HeilM-RL § 12 Abs. 2 S. 1).
 *
 * Regeln:
 * - Zeile 1 (#rzHm, #rzAnzahl) bleibt immer bestehen.
 * - Zeilen 2 und 3 werden dynamisch vor der Ergänzendes-Heilmittel-Zeile eingefügt.
 * - Jede Zeile besitzt Heilmittel-Katalogsuche, Anzahl-Feld und Doppelbehandlung-Checkbox.
 * - Bei nur einer Zeile wird die bestehende #rzDoppel-Checkbox in den Optionen genutzt.
 * - Bei >= 2 Zeilen erhält jede Zeile ihre eigene Doppelbehandlung-Option.
 * - Touch-Ziele min. 44px, Tastaturnavigation per Enter.
 */

'use strict';

import { attachHeilmittelSearch } from '../katalog-suche.js?v=20261001a';
import { heilmittelKatalogVorschlaege, heilmittelAuswahlUebernehmen } from './verordnung-podo.js?v=20261021v';
import { normalizeBereich } from './heilmittel-zeilen.js';

let _tableEl = null;
let _addBtnEl = null;
let _extraLinesWrap = null;
let _bereichFn = () => 'physio';
let _onAenderung = null;
let _supabase = null;

function $(id) {
  return document.getElementById(id);
}

function istMehrfachErlaubt() {
  const b = normalizeBereich(_bereichFn ? _bereichFn() : '');
  return b === 'physio' || b === 'ergo';
}

function anzahlZeilen() {
  const extras = _extraLinesWrap ? _extraLinesWrap.querySelectorAll('.m13-hmline-extra').length : 0;
  return 1 + extras;
}

export function aktualisiereAddBtnSichtbarkeit() {
  const btnWrap = $('rzHmAddLineWrap');
  if (!btnWrap) return;
  const erlaubt = istMehrfachErlaubt();
  const count = anzahlZeilen();
  btnWrap.style.display = (erlaubt && count < 3) ? 'block' : 'none';

  // Doppelbehandlung-Anzeige für Zeile 1 umschalten
  const d1Wrap = $('rzHmRow1DoppelWrap');
  const d1Placeholder = $('rzHmRow1DelPlaceholder');
  const table = _tableEl || $('rzHmTable');
  const rzDoppelEl = $('rzDoppel');
  const rzDoppelWrap = $('rzDoppelWrap') || rzDoppelEl?.closest('label');

  if (count > 1) {
    if (d1Wrap) d1Wrap.style.display = 'inline-flex';
    if (d1Placeholder) d1Placeholder.style.display = 'inline-block';
    if (table) table.classList.add('is-multi');
    if (rzDoppelWrap) rzDoppelWrap.style.display = 'none';
  } else {
    if (d1Wrap) d1Wrap.style.display = 'none';
    if (d1Placeholder) d1Placeholder.style.display = 'none';
    if (table) table.classList.remove('is-multi');
    if (rzDoppelWrap) rzDoppelWrap.style.display = '';
    const d1 = $('rzDoppelRow1');
    if (d1 && rzDoppelEl) rzDoppelEl.checked = !!d1.checked;
  }
}

function baueZeileHtml(index) {
  const numId = index;
  return `
    <div>
      <div class="m13-cap">${numId}. Heilmittel</div>
      <input class="m13-v" id="rzHm${numId}" autocomplete="off" placeholder="">
      <input type="hidden" id="rzHmPosition${numId}">
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
      <input class="m13-v m13-center" id="rzAnzahl${numId}" type="number" min="1" placeholder="" style="flex:1;min-width:0;max-width:54px;">
      <label class="m13-th m13-hm-doppel" id="rzHmRow${numId}DoppelWrap" style="font-size:11px;margin:0;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;" title="Doppelbehandlung">
        <input type="checkbox" id="rzDoppelRow${numId}" class="m13-cbx"><span class="m13-chk"></span> <span style="font-size:11px;margin-left:2px;">Doppelb.</span>
      </label>
      <button type="button" class="m13-hm-del-btn" data-del-zeile="${numId}" aria-label="Heilmittelzeile entfernen" style="min-width:44px;min-height:44px;border:none;background:transparent;color:var(--danger,#dc2626);cursor:pointer;font-size:20px;display:inline-flex;align-items:center;justify-content:center;padding:0;line-height:1;">×</button>
    </div>
  `;
}

export function fuegeHeilmittelZeileHinzu(vorbelegung = null) {
  if (!istMehrfachErlaubt()) return null;
  if (!_extraLinesWrap) _extraLinesWrap = $('rzHmExtraLines');
  if (!_extraLinesWrap) return null;

  const count = anzahlZeilen();
  if (count >= 3) return null;

  const neueNummer = count + 1; // 2 oder 3
  const zeile = document.createElement('div');
  zeile.className = 'm13-hmline m13-hmline-extra';
  zeile.dataset.zeile = String(neueNummer);
  zeile.innerHTML = baueZeileHtml(neueNummer);

  _extraLinesWrap.appendChild(zeile);

  const hmInput = zeile.querySelector(`#rzHm${neueNummer}`);
  const posInput = zeile.querySelector(`#rzHmPosition${neueNummer}`);
  const anzahlInput = zeile.querySelector(`#rzAnzahl${neueNummer}`);
  const doppelCb = zeile.querySelector(`#rzDoppelRow${neueNummer}`);
  const delBtn = zeile.querySelector('.m13-hm-del-btn');

  // Wenn wir von 1 auf 2 Zeilen gehen, Doppel-Status von Zeile 1 aus #rzDoppel übernehmen
  if (count === 1) {
    const rzDoppel = $('rzDoppel');
    const d1 = $('rzDoppelRow1');
    if (rzDoppel && d1) d1.checked = !!rzDoppel.checked;
  }

  if (vorbelegung) {
    if (hmInput && vorbelegung.bezeichnung) hmInput.value = vorbelegung.bezeichnung;
    if (posInput && vorbelegung.code) posInput.value = vorbelegung.code;
    if (anzahlInput && vorbelegung.einheiten != null) anzahlInput.value = vorbelegung.einheiten;
    if (doppelCb && vorbelegung.doppelbehandlung != null) doppelCb.checked = !!vorbelegung.doppelbehandlung;
  }

  if (_supabase && hmInput) {
    attachHeilmittelSearch(hmInput, _supabase, {
      bereich: _bereichFn,
      extraItems: heilmittelKatalogVorschlaege,
      onSelect: (it) => heilmittelAuswahlUebernehmen(it, posInput ? posInput.id : null),
    });
  }

  // Tastaturnavigation per Enter
  if (hmInput && anzahlInput) {
    hmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        anzahlInput.focus();
      }
    });
  }

  if (anzahlInput) {
    anzahlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (neueNummer === 2 && anzahlZeilen() < 3) {
          const z3 = fuegeHeilmittelZeileHinzu();
          if (z3) {
            const nextHm = z3.querySelector('input[id^="rzHm"]');
            if (nextHm) nextHm.focus();
          }
        } else {
          const erg = $('rzHmErg');
          if (erg) erg.focus();
        }
      }
    });
  }

  if (delBtn) {
    delBtn.addEventListener('click', () => {
      entferneHeilmittelZeile(zeile);
    });
  }

  aktualisiereAddBtnSichtbarkeit();
  if (typeof _onAenderung === 'function') _onAenderung();
  return zeile;
}

export function entferneHeilmittelZeile(zeileEl) {
  if (!zeileEl || !zeileEl.parentElement) return;
  zeileEl.remove();

  // Neunummerierung der Extra-Zeilen falls nötig
  if (_extraLinesWrap) {
    const extras = _extraLinesWrap.querySelectorAll('.m13-hmline-extra');
    extras.forEach((el, idx) => {
      const nummer = idx + 2;
      el.dataset.zeile = String(nummer);
      const cap = el.querySelector('.m13-cap');
      if (cap) cap.textContent = `${nummer}. Heilmittel`;
      const hmInput = el.querySelector('input[id^="rzHm"]');
      if (hmInput) hmInput.id = `rzHm${nummer}`;
      const posInput = el.querySelector('input[id^="rzHmPosition"]');
      if (posInput) posInput.id = `rzHmPosition${nummer}`;
      const anzahlInput = el.querySelector('input[id^="rzAnzahl"]');
      if (anzahlInput) anzahlInput.id = `rzAnzahl${nummer}`;
      const doppelInput = el.querySelector('input[id^="rzDoppelRow"]');
      if (doppelInput) doppelInput.id = `rzDoppelRow${nummer}`;
    });
  }

  // Wenn nur noch Zeile 1 übrig: rzDoppel synchronisieren
  if (anzahlZeilen() === 1) {
    const d1 = $('rzDoppelRow1');
    const rzDoppel = $('rzDoppel');
    if (d1 && rzDoppel) rzDoppel.checked = !!d1.checked;
  }

  aktualisiereAddBtnSichtbarkeit();
  if (typeof _onAenderung === 'function') _onAenderung();
}

export function leereHeilmittelZeilen() {
  if (_extraLinesWrap) {
    _extraLinesWrap.innerHTML = '';
  }
  const d1 = $('rzDoppelRow1');
  if (d1) d1.checked = false;
  aktualisiereAddBtnSichtbarkeit();
}

export function fuelleHeilmittelZeilen(items) {
  leereHeilmittelZeilen();
  if (!Array.isArray(items) || !items.length) return;

  const hatEinheiten = items.some(it => it && typeof it === 'object' && it.einheiten != null);
  if (!hatEinheiten) return;

  // Zeile 1 füllen
  const item1 = items[0];
  if (item1) {
    const hm1 = $('rzHm');
    const pos1 = $('rzHmPosition');
    const anz1 = $('rzAnzahl');
    const dop1 = $('rzDoppelRow1');
    const dopAll = $('rzDoppel');

    if (hm1 && item1.bezeichnung != null) hm1.value = item1.bezeichnung;
    if (pos1 && item1.code != null) pos1.value = item1.code;
    if (anz1 && item1.einheiten != null) anz1.value = item1.einheiten;
    if (dop1) dop1.checked = !!item1.doppelbehandlung;
    if (dopAll) dopAll.checked = !!item1.doppelbehandlung;
  }

  // Zeilen 2 und 3 füllen
  for (let i = 1; i < Math.min(items.length, 3); i++) {
    const it = items[i];
    if (it) {
      fuegeHeilmittelZeileHinzu({
        bezeichnung: it.bezeichnung || it.text || '',
        code: it.code || '',
        einheiten: it.einheiten,
        doppelbehandlung: it.doppelbehandlung,
      });
    }
  }

  aktualisiereAddBtnSichtbarkeit();
}

export function liesHeilmittelZeilenAusMaske() {
  const g = (id) => $(id);
  const v = (id) => (g(id)?.value || '').trim();
  const c = (id) => !!g(id)?.checked;

  const count = anzahlZeilen();
  const isMulti = count > 1;

  const zeilen = [];

  // Zeile 1
  const t1 = v('rzHm');
  const p1 = v('rzHmPosition');
  const a1 = parseInt(v('rzAnzahl'), 10) || null;
  const d1 = isMulti ? c('rzDoppelRow1') : c('rzDoppel');

  if (t1 || p1 || a1) {
    zeilen.push({
      bezeichnung: t1,
      code: p1 || t1,
      einheiten: a1,
      doppelbehandlung: d1,
    });
  }

  // Zeilen 2 und 3
  if (_extraLinesWrap) {
    const extras = _extraLinesWrap.querySelectorAll('.m13-hmline-extra');
    extras.forEach((el) => {
      const num = el.dataset.zeile;
      const t = v(`rzHm${num}`);
      const p = v(`rzHmPosition${num}`);
      const a = parseInt(v(`rzAnzahl${num}`), 10) || null;
      const d = c(`rzDoppelRow${num}`);
      if (t || p || a) {
        zeilen.push({
          bezeichnung: t,
          code: p || t,
          einheiten: a,
          doppelbehandlung: d,
        });
      }
    });
  }

  if (zeilen.length > 1) {
    const sumEinheiten = zeilen.reduce((sum, z) => sum + (Number(z.einheiten) || 0), 0);
    return {
      items: zeilen,
      spiegel: {
        heilmittel: zeilen[0].bezeichnung,
        heilmittel_position: zeilen[0].code,
        vorrangig_einheiten: zeilen[0].einheiten,
        doppelbehandlung: zeilen[0].doppelbehandlung,
        anzahl_einheiten: sumEinheiten,
      },
    };
  }

  return {
    items: null,
    spiegel: {
      heilmittel: t1 || null,
      heilmittel_position: p1 || null,
      vorrangig_einheiten: a1,
      doppelbehandlung: d1,
      anzahl_einheiten: a1,
    },
  };
}

export function initialisiereHeilmittelZeilen({ tableEl, addBtnEl, bereichFn, onAenderung, supabase }) {
  _tableEl = tableEl || $('rzHmTable');
  _addBtnEl = addBtnEl || $('rzHmAddLine');
  _extraLinesWrap = $('rzHmExtraLines');
  _bereichFn = typeof bereichFn === 'function' ? bereichFn : () => 'physio';
  _onAenderung = onAenderung || null;
  _supabase = supabase || null;

  if (_addBtnEl) {
    _addBtnEl.onclick = (e) => {
      e.preventDefault();
      const z = fuegeHeilmittelZeileHinzu();
      if (z) {
        const input = z.querySelector('input[id^="rzHm"]');
        if (input) input.focus();
      }
    };
  }

  // Enter-Taste auf Zeile 1 verdrahten
  const hm1 = $('rzHm');
  const anz1 = $('rzAnzahl');
  if (hm1 && anz1) {
    hm1.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        anz1.focus();
      }
    });
    anz1.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (anzahlZeilen() < 3 && istMehrfachErlaubt()) {
          const z2 = fuegeHeilmittelZeileHinzu();
          if (z2) {
            const nextHm = z2.querySelector('input[id^="rzHm"]');
            if (nextHm) nextHm.focus();
          }
        } else {
          const erg = $('rzHmErg');
          if (erg) erg.focus();
        }
      }
    });
  }

  aktualisiereAddBtnSichtbarkeit();
}
