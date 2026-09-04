/**
 * arzt-register.js — Das Ärzte-Register: Liste, Schnellanlage und Zuweiser-Statistik.
 *
 * Herkunft
 * ────────
 * Ops-Karte „Ärzte: Schnellanlage aus der Verordnung + Zuweiser-Statistik"
 * (Bildschirmfreigabe, Punkte 1–4). Neuer Code kommt in eine neue Datei —
 * `dashboard.js` wächst nicht mehr (Konsey 2026-08-13). `wireArztFeld` ist bei
 * dieser Gelegenheit aus `dashboard.js` hierher ausgewandert, weil genau dort
 * das Pluszeichen andockt (Kuschatung, Beschluss vom 13.08.).
 *
 * Was hier passiert und warum
 * ───────────────────────────
 * 1. `wireArztFeld` — jedes Arzt-Feld einer Verordnungsmaske hängt am
 *    gemeinsamen Picker (`arzt-suche.js`) und bekommt daneben ein „+".
 *    Bisher war ein unbekannter Arzt eine Sackgasse: Verordnung verlassen,
 *    Einstellungen öffnen, Arzt anlegen, Verordnung neu beginnen. Das „+"
 *    öffnet eine kleine Maske über der Verordnung; danach steht der Arzt im
 *    Formular und die Eingabe geht weiter.
 *      Beta-2: „du könntest zum Beispiel hier ein Pluszeichen machen, daneben
 *      kommt eine neue Maske auf, und dann gebe ich Betriebsstättennummer und
 *      Arztnummer ein."
 *
 * 2. Suche über Name ODER Nummer steckt in `arzt-suche.js` (reine Ziffern
 *    treffen nur Nummernfelder, Präfixtreffer nach oben). Hier wird sie nur
 *    zusätzlich an das BSNR-Feld gehängt — die LANR hing schon dran.
 *      Beta-2: „auf der Verordnung sind meistens bei den Ärzten viele Namen,
 *      und dann gebe ich einfach die Nummer ein, z.B. 338"
 *
 * 3. Die Liste zeigt Nachname · Vorname · Arzt-Nr. · Betriebs-Nr. · Fachgebiet.
 *    Vorher stand alles in einer Zeile zusammengefasst; beim Überfliegen sucht
 *    man aber eine Spalte, keinen Fließtext.
 *
 * 4. Klick auf eine Zeile → Zuweiser-Statistik: je Jahr, wie viele Patienten
 *    dieser Arzt geschickt hat, darunter die Patienten selbst.
 *      Beta-2: „im Jahre 22 hat er 24 Patienten geschickt, 24 waren schon 70
 *      Patienten, diese Ärztin"
 *    Das ist eine Auswertung — sie liest ausschließlich und schreibt nichts.
 *
 * Warum Vor-/Nachname getrennt DARGESTELLT, aber nicht getrennt GESPEICHERT
 * ────────────────────────────────────────────────────────────────────────
 * `aerzte.arzt_name` ist ein Feld, und an ihm hängen eine UNIQUE-Bedingung
 * (`owner_id, arzt_name`), der Abgleich im Register (`api-backend/lib/
 * arzt-registry.js`) und jede bestehende Verordnung. Ein Aufspalten in zwei
 * Spalten wäre eine Migration mit Datenwanderung für einen reinen
 * Anzeigewunsch. Deshalb wird beim Rendern geteilt (`splitArztName`) und der
 * gespeicherte Wert bleibt unangetastet.
 *
 * Zwei Datentöpfe, eine Statistik
 * ───────────────────────────────
 * Verordnungen liegen je nach Fachbereich in `prescriptions` (Physio/Ergo/Logo)
 * ODER in `verordnungen` (Podologie) — beide mit `arzt_id`. Die Statistik
 * fragt beide ab und zählt zusammen; nur einen Topf zu lesen hieße, je nach
 * Praxis die halbe Wahrheit zu zeigen.
 */

'use strict';

// Dieselbe Version wie in `dashboard.js` — eine abweichende Query-Zeichenkette
// wäre für den Browser ein zweites Modul.
import { attachArztSearch, arztMetaText } from '../arzt-suche.js?v=20260817';

/** @type {object|null} Von `initArztRegister` gesetzter Zugang zur Dashboard-Umgebung. */
let ctx = null;

/**
 * @param {object} c
 *   supabase, escapeHtml, showToast, openModal, closeModal
 *   getOwnerId()          → uuid des Inhabers
 *   ladeAerzte()          → Promise<Array>  (Register, owner-weit)
 *   aerzte()              → Array           (aktueller Cache, synchron)
 *   resolveArzt(input, q) → Promise<{arzt, arzt_id, created, enriched}|null>
 *   bearbeiten(id) / loeschen(id)
 *   patientName(lead)     → string
 */
export function initArztRegister(c) { ctx = c; }

// ───────────────────────────────────────────────────────────────────────────
// Namen
// ───────────────────────────────────────────────────────────────────────────

// Namenszusätze gehören zum Nachnamen, nicht zum Vornamen: „Anna von der Leyen"
// hat den Nachnamen „von der Leyen". Ohne diese Liste stünde „Leyen" in der
// Spalte und die Sortierung landete unter L statt unter V.
const NAMENSZUSAETZE = new Set([
  'von', 'van', 'de', 'del', 'della', 'di', 'da', 'du', 'der', 'den', 'dem',
  'zu', 'zum', 'zur', 'am', 'im', 'ten', 'ter', 'vom', 'la', 'le', 'el', 'al',
]);

/**
 * `arzt_name` in Nachname/Vorname zerlegen — nur für die Anzeige.
 *
 * Titel bleiben bewusst beim Vornamen („Dr. med. Anna"). Sie wegzuwerfen wäre
 * in einer Ärzteliste ein Informationsverlust, und in eine eigene Spalte
 * gehören sie nicht: der Anwender sucht nach Nachname und Nummer.
 *
 * @param {string} name
 * @returns {{nachname: string, vorname: string}}
 */
export function splitArztName(name) {
  const roh = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!roh) return { nachname: '', vorname: '' };

  // „Müller, Anna" — die Praxis schreibt es oft so, und dann ist es eindeutig.
  const komma = roh.indexOf(',');
  if (komma > 0) {
    return {
      nachname: roh.slice(0, komma).trim(),
      vorname:  roh.slice(komma + 1).trim(),
    };
  }

  const teile = roh.split(' ');
  if (teile.length === 1) return { nachname: teile[0], vorname: '' };

  let ab = teile.length - 1;
  while (ab > 1 && NAMENSZUSAETZE.has(teile[ab - 1].toLowerCase())) ab--;

  return {
    nachname: teile.slice(ab).join(' '),
    vorname:  teile.slice(0, ab).join(' '),
  };
}

const esc = (s) => (ctx?.escapeHtml ? ctx.escapeHtml(String(s ?? '')) : String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));

// ───────────────────────────────────────────────────────────────────────────
// 1 + 2: Arzt-Feld einer Verordnungsmaske
// ───────────────────────────────────────────────────────────────────────────

/**
 * Ein Arzt-Feld an den gemeinsamen Picker hängen (arzt-suche.js) und das „+"
 * daneben setzen.
 *
 * Die Nummernfelder werden bei einer Auswahl bewusst ÜBERSCHRIEBEN: wer einen
 * Arzt anklickt, meint diesen Arzt. Die alte „nur füllen, wenn leer"-Regel ließ
 * beim Wechsel die LANR des vorigen Arztes stehen — eine falsche LANR ist ein
 * Absetzungsgrund, ein leeres Feld nicht.
 *
 * @param {object} f  {name, lanr, bsnr, tel, id, hint} — Element-IDs,
 *                    alle optional außer `name`
 * @param {boolean} [f.plus=true]  Schnellanlage-Knopf anbieten
 */
export function wireArztFeld(f) {
  const nameEl = document.getElementById(f.name);
  const lanrEl = f.lanr ? document.getElementById(f.lanr) : null;
  const bsnrEl = f.bsnr ? document.getElementById(f.bsnr) : null;
  const telEl  = f.tel  ? document.getElementById(f.tel)  : null;
  const idEl   = f.id   ? document.getElementById(f.id)   : null;
  const hintEl = f.hint ? document.getElementById(f.hint) : null;

  const uebernehmen = (a) => {
    if (!a) return;
    if (nameEl && nameEl.value !== a.arzt_name) nameEl.value = a.arzt_name || nameEl.value;
    if (lanrEl) lanrEl.value = a.lanr || '';
    if (bsnrEl) bsnrEl.value = a.bsnr || '';
    if (telEl)  telEl.value  = a.telefon || a.fax || a.lanr || '';
    if (idEl)   idEl.value   = a.id || '';
    if (hintEl) {
      const meta = arztMetaText(a);
      hintEl.textContent = meta ? `Bekannter Arzt · ${meta}` : 'Bekannter Arzt';
      hintEl.style.display = 'block';
    }
  };

  const ladeAerzte = () => ctx.ladeAerzte();

  // Panels wie die Podologie-Verordnung rendern per innerHTML neu; sollte ein
  // Feld doch einmal überleben, darf es keinen zweiten Listener bekommen.
  if (nameEl && nameEl.dataset.arztWired !== '1') {
    nameEl.dataset.arztWired = '1';
    attachArztSearch(nameEl, { loadAerzte: ladeAerzte, onSelect: uebernehmen });
    // Freitext ohne Auswahl: Bindung lösen, damit beim Speichern ein neuer Arzt
    // entsteht statt den zuletzt gewählten zu überschreiben.
    nameEl.addEventListener('input', () => {
      const val = nameEl.value.trim();
      const treffer = (ctx.aerzte() || []).find(a => a.arzt_name === val);
      if (treffer) return;                       // onSelect hat schon gefüllt
      if (idEl) idEl.value = '';
      if (hintEl) {
        hintEl.textContent = val ? 'Neuer Arzt — wird beim Speichern ins Ärzte-Register aufgenommen.' : '';
        hintEl.style.display = val ? 'block' : 'none';
      }
    });
  }

  // Beta-1s Weg: die ersten Ziffern der LANR tippen, Namen anklicken.
  // Dieselbe Sucheingabe hängt an der BSNR — auf dem Rezept steht die
  // Betriebsstättennummer oben, und wer sie abliest, will nicht erst zum
  // Namensfeld zurückspringen.
  for (const [el, writes] of [[lanrEl, 'lanr'], [bsnrEl, 'bsnr']]) {
    if (!el || el.dataset.arztWired === '1') continue;
    el.dataset.arztWired = '1';
    attachArztSearch(el, { loadAerzte: ladeAerzte, writes, onSelect: uebernehmen });
  }

  if (f.plus !== false && nameEl) {
    plusKnopf(nameEl, async () => {
      const arzt = await oeffneArztSchnellanlage({ vorbelegung: {
        name: nameEl.value.trim(),
        lanr: lanrEl?.value.trim() || '',
        bsnr: bsnrEl?.value.trim() || '',
      } });
      if (arzt) uebernehmen(arzt);
    });
  }
}

/**
 * Das „+" neben ein Eingabefeld setzen, ohne dessen Layout zu kippen: das Feld
 * wandert in einen Flex-Container, der Knopf daneben. Absolute Positionierung
 * wäre in der Muster-13-Nachbildung (`.m13-*`) sonst über den Rand gelaufen.
 */
function plusKnopf(inputEl, onClick) {
  if (inputEl.dataset.arztPlus === '1') return;
  inputEl.dataset.arztPlus = '1';

  const wrap = document.createElement('span');
  wrap.className = 'arzt-plus-wrap';
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'arzt-plus-btn';
  btn.textContent = '+';
  btn.title = 'Arzt anlegen — ohne die Verordnung zu verlassen';
  btn.setAttribute('aria-label', 'Arzt anlegen');
  btn.addEventListener('click', onClick);
  wrap.appendChild(btn);
}

// ───────────────────────────────────────────────────────────────────────────
// 1: Schnellanlage
// ───────────────────────────────────────────────────────────────────────────

const NEUN_ZIFFERN = /^\d{9}$/;

/**
 * Kleine Maske über der Verordnung. Sie legt den Arzt über dasselbe Register an
 * wie die Einstellungen (`resolveArzt`) — eine zweite „gibt es den schon?"-Logik
 * würde Doppelte erzeugen, sobald jemand denselben Arzt zweimal von Hand tippt.
 *
 * @param {{vorbelegung?: {name?:string, lanr?:string, bsnr?:string}}} [opt]
 * @returns {Promise<object|null>} der angelegte/gefundene Arzt
 */
export function oeffneArztSchnellanlage(opt = {}) {
  return new Promise(resolve => {
    const v = opt.vorbelegung || {};
    const el = (id) => document.getElementById(id);
    const nameF = el('arztQuickName');
    const bsnrF = el('arztQuickBsnr');
    const lanrF = el('arztQuickLanr');
    const fachF = el('arztQuickFach');
    const fehler = el('arztQuickError');
    const okBtn = el('arztQuickOk');
    const abBtn = el('arztQuickCancel');
    const zuBtn = document.querySelector('#arztQuickModal .modal-close');
    if (!nameF || !okBtn) { resolve(null); return; }

    nameF.value = v.name || '';
    // Reihenfolge im Formular = Reihenfolge auf dem Rezept: BSNR steht links
    // von der LANR. Beta-2 liest von links nach rechts ab.
    bsnrF.value = v.bsnr || '';
    lanrF.value = v.lanr || '';
    fachF.value = '';
    fehler.textContent = '';
    fehler.hidden = true;

    // Escape wird auch global abgefangen (dashboard.js schließt dort den
    // obersten Dialog). Ohne eigenen Horcher bliebe dieses Promise dann für
    // immer offen und der Aufrufer wartete auf einen Arzt, der nie kommt.
    const globalEsc = (e) => { if (e.key === 'Escape') schliessen(null); };

    const schliessen = (wert) => {
      okBtn.onclick = null; abBtn.onclick = null;
      if (zuBtn) zuBtn.onclick = null;
      nameF.onkeydown = bsnrF.onkeydown = lanrF.onkeydown = fachF.onkeydown = null;
      document.removeEventListener('keydown', globalEsc);
      ctx.closeModal('arztQuickModal');
      resolve(wert);
    };
    document.addEventListener('keydown', globalEsc);

    const meckern = (text, feld) => {
      fehler.textContent = text;
      fehler.hidden = false;
      feld?.focus();
    };

    const speichern = async () => {
      const name = nameF.value.trim();
      const bsnr = bsnrF.value.replace(/\s/g, '');
      const lanr = lanrF.value.replace(/\s/g, '');
      if (!name) return meckern('Bitte einen Namen eingeben.', nameF);
      // Neun Ziffern, sonst gar nicht: eine falsche LANR ist ein
      // Absetzungsgrund, ein leeres Feld nur eine Nacherfassung.
      if (bsnr && !NEUN_ZIFFERN.test(bsnr)) return meckern('Die Betriebsstätten-Nr. (BSNR) hat genau 9 Ziffern.', bsnrF);
      if (lanr && !NEUN_ZIFFERN.test(lanr)) return meckern('Die Arzt-Nr. (LANR) hat genau 9 Ziffern.', lanrF);

      okBtn.disabled = true;
      const out = await ctx.resolveArzt({
        name, bsnr: bsnr || null, lanr: lanr || null,
        fachrichtung: fachF.value.trim() || null,
        // `quelle` kennt drei Werte: ocr, rezept, manuell. Hier hat ein Mensch
        // getippt — kein vierter Wert für denselben Sachverhalt.
      }, 'manuell');
      okBtn.disabled = false;

      if (!out?.arzt_id) return meckern('Der Arzt konnte nicht gespeichert werden.', nameF);
      ctx.showToast(out.created
        ? `Arzt „${out.arzt?.arzt_name}" ins Register aufgenommen.`
        : `„${out.arzt?.arzt_name}" war bereits im Register — Daten ergänzt.`);
      schliessen(out.arzt || null);
    };

    const taste = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); speichern(); }
      if (e.key === 'Escape') { e.preventDefault(); schliessen(null); }
    };
    nameF.onkeydown = bsnrF.onkeydown = lanrF.onkeydown = fachF.onkeydown = taste;
    okBtn.onclick = speichern;
    abBtn.onclick = () => schliessen(null);
    if (zuBtn) zuBtn.onclick = () => schliessen(null);

    ctx.openModal('arztQuickModal');
    setTimeout(() => (nameF.value ? bsnrF : nameF).focus(), 50);
  });
}

// ───────────────────────────────────────────────────────────────────────────
// 3: Die Liste
// ───────────────────────────────────────────────────────────────────────────

/**
 * Register als Tabelle rendern. Wird für jeden Ort aufgerufen, an dem sie
 * steht (Panel „Ärzte" und Einstellungen) — eine Liste, ein Renderer.
 *
 * @param {string} containerId  leeres <div>, das die Tabelle aufnimmt
 * @param {string} [suche]      Freitext über Name, Nummern und Fachgebiet
 */
export function renderArztRegister(containerId, suche = '') {
  const host = document.getElementById(containerId);
  if (!host) return;

  const q = String(suche || '').trim().toLowerCase();
  const zif = q.replace(/\D/g, '');
  const alle = ctx.aerzte() || [];
  const rows = alle
    .filter(a => {
      if (!q) return true;
      if (zif && zif === q) {
        return [a.lanr, a.bsnr].some(n => String(n ?? '').includes(zif));
      }
      return [a.arzt_name, a.fachrichtung, a.lanr, a.bsnr, a.praxis_name]
        .some(x => String(x ?? '').toLowerCase().includes(q));
    })
    .map(a => ({ ...a, ...splitArztName(a.arzt_name) }))
    .sort((a, b) => a.nachname.localeCompare(b.nachname, 'de') ||
                    a.vorname.localeCompare(b.vorname, 'de'));

  if (!alle.length) {
    host.innerHTML = '<p class="text-muted">Noch keine Ärzte im Register. Sie entstehen beim Erfassen einer Verordnung von selbst.</p>';
    return;
  }
  if (!rows.length) {
    host.innerHTML = `<p class="text-muted">Kein Arzt passt zu „${esc(suche)}".</p>`;
    return;
  }

  host.innerHTML = `
    <div class="table-wrap">
      <table class="data-table arzt-register-table">
        <thead>
          <tr>
            <th>Nachname</th>
            <th>Vorname</th>
            <th>Arzt-Nr. (LANR)</th>
            <th>Betriebs-Nr. (BSNR)</th>
            <th>Fachgebiet</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(a => `
            <tr data-arzt-id="${esc(a.id)}" class="arzt-zeile" tabindex="0"
                title="Zuweisungen dieses Arztes ansehen">
              <td><strong>${esc(a.nachname || a.arzt_name)}</strong></td>
              <td>${esc(a.vorname) || '<span class="text-muted">—</span>'}</td>
              <td class="mono">${esc(a.lanr) || '<span class="text-muted">—</span>'}</td>
              <td class="mono">${esc(a.bsnr) || '<span class="text-muted">—</span>'}</td>
              <td>${esc(a.fachrichtung) || '<span class="text-muted">—</span>'}</td>
              <td class="arzt-zeile-aktionen">
                <button class="btn-outline" data-arzt-edit="${esc(a.id)}">Bearbeiten</button>
                <button class="btn-danger" data-arzt-del="${esc(a.id)}">Löschen</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  // Delegation statt inline-onclick: aus einem ES-Modul heraus gibt es kein
  // `window.editAerzte`, und die Zeile selbst ist ohnehin klickbar.
  host.onclick = (e) => {
    const edit = e.target.closest('[data-arzt-edit]');
    if (edit) { e.stopPropagation(); ctx.bearbeiten(edit.dataset.arztEdit); return; }
    const del = e.target.closest('[data-arzt-del]');
    if (del) { e.stopPropagation(); ctx.loeschen(del.dataset.arztDel); return; }
    const zeile = e.target.closest('[data-arzt-id]');
    if (zeile) oeffneArztDetail(zeile.dataset.arztId);
  };
  host.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    const zeile = e.target.closest?.('[data-arzt-id]');
    if (zeile) { e.preventDefault(); oeffneArztDetail(zeile.dataset.arztId); }
  };
}

/**
 * Das Panel „Ärzte" einmalig verdrahten: Reiter und Suchfeld.
 *
 * Der Reiter „In der Nähe finden" ist die alte Google-Maps-Akquise. Sie bleibt,
 * steht aber nicht mehr vorn: wer im Alltag auf „Ärzte" klickt, sucht den Arzt,
 * der gerade verordnet hat — nicht einen, den er noch nie gesehen hat.
 */
export function mountArztPanel() {
  const panel = document.getElementById('panel-doctors');
  if (!panel || panel.dataset.arztPanelWired === '1') return;
  panel.dataset.arztPanelWired = '1';

  const reiter = panel.querySelectorAll('[data-arzt-tab]');
  reiter.forEach(btn => btn.addEventListener('click', () => {
    reiter.forEach(b => b.classList.toggle('active', b === btn));
    const gewaehlt = btn.dataset.arztTab;
    document.getElementById('arztTabRegister').hidden = gewaehlt !== 'register';
    document.getElementById('arztTabSuche').hidden    = gewaehlt !== 'suche';
  }));

  const suche = document.getElementById('arztRegisterSuche');
  suche?.addEventListener('input', () => renderArztRegister('arztRegisterList', suche.value));
}

// ───────────────────────────────────────────────────────────────────────────
// 4: Zuweiser-Statistik
// ───────────────────────────────────────────────────────────────────────────

/**
 * Alle Verordnungen eines Arztes holen und auf {patientId, jahr} normalisieren.
 *
 * Seit 04.09.2026 EIN Verordnungstopf (`prescriptions`) — Physio/Ergo/Logo UND
 * Podologie stehen darin, beide mit `patient_id`. Vorher zwei parallele
 * Abfragen (`prescriptions` + `verordnungen`); seit der Zusammenlegung wäre
 * das eine Doppelzählung derselben Zeilen gewesen.
 *
 * `ausstellungsdatum` ist das fachlich richtige Datum (wann hat der Arzt
 * verordnet), nicht `created_at` (wann haben wir es eingetippt). Fehlt es,
 * fällt die Zeile auf `created_at` zurück, damit sie nicht aus der Statistik
 * verschwindet.
 */
async function ladeZuweisungen(arztId) {
  const owner = ctx.getOwnerId();
  const { data, error } = await ctx.supabase.from('prescriptions')
    .select('id,patient_id,ausstellungsdatum,created_at')
    .eq('owner_id', owner).eq('arzt_id', arztId);
  if (error) console.warn('[arzt-register] prescriptions:', error);

  return (data || []).map(r => {
    const datum = r.ausstellungsdatum || r.created_at || null;
    return {
      patientId: r.patient_id || null,
      datum,
      jahr: datum ? String(datum).slice(0, 4) : '—',
    };
  });
}

/** Patientennamen zu den gefundenen IDs holen. */
async function ladePatienten(ids) {
  const liste = [...new Set(ids.filter(Boolean))];
  if (!liste.length) return new Map();
  const { data, error } = await ctx.supabase.from('leads')
    .select('id,first_name,last_name,title,geburtsdatum,patientennummer')
    .in('id', liste);
  if (error) { console.warn('[arzt-register] leads:', error); return new Map(); }
  return new Map((data || []).map(l => [l.id, l]));
}

/**
 * Detailansicht: „Im Jahr 2022 hat er 24 Patienten geschickt" — und wer das war.
 *
 * Gezählt werden UNTERSCHIEDLICHE Patienten je Jahr, nicht Verordnungen. Wer
 * dreimal im Jahr eine Folgeverordnung bekommt, ist ein zugewiesener Patient,
 * keine drei. Die Zahl der Verordnungen steht daneben, weil sie die Auslastung
 * beschreibt und nicht dieselbe Frage beantwortet.
 */
export async function oeffneArztDetail(arztId) {
  const a = (ctx.aerzte() || []).find(x => x.id === arztId);
  if (!a) return;

  const titel = document.getElementById('arztDetailTitel');
  const meta  = document.getElementById('arztDetailMeta');
  const body  = document.getElementById('arztDetailBody');
  if (!body) return;

  const { nachname, vorname } = splitArztName(a.arzt_name);
  titel.textContent = nachname ? `${nachname}${vorname ? ', ' + vorname : ''}` : a.arzt_name;
  meta.textContent = arztMetaText(a) || '';
  body.innerHTML = '<p class="text-muted">Zuweisungen werden geladen …</p>';
  ctx.openModal('arztDetailModal');

  let zuw;
  try {
    zuw = await ladeZuweisungen(arztId);
  } catch (e) {
    console.error('[arzt-register] Statistik:', e);
    body.innerHTML = '<p class="text-muted">Die Zuweisungen konnten nicht geladen werden.</p>';
    return;
  }

  if (!zuw.length) {
    body.innerHTML = '<p class="text-muted">Von diesem Arzt liegt noch keine Verordnung vor.</p>';
    return;
  }

  // Jahr → {patienten:Set, verordnungen:number}
  const jeJahr = new Map();
  for (const z of zuw) {
    if (!jeJahr.has(z.jahr)) jeJahr.set(z.jahr, { patienten: new Set(), verordnungen: 0 });
    const e = jeJahr.get(z.jahr);
    e.verordnungen++;
    if (z.patientId) e.patienten.add(z.patientId);
  }
  const jahre = [...jeJahr.entries()].sort((x, y) => String(y[0]).localeCompare(String(x[0])));

  // Patient → {anzahl, letzte}
  const jePatient = new Map();
  for (const z of zuw) {
    if (!z.patientId) continue;
    const e = jePatient.get(z.patientId) || { anzahl: 0, letzte: null };
    e.anzahl++;
    if (!e.letzte || String(z.datum || '') > e.letzte) e.letzte = z.datum || e.letzte;
    jePatient.set(z.patientId, e);
  }
  const patienten = await ladePatienten([...jePatient.keys()]);

  const gesamtPatienten = jePatient.size;
  const ohneZuordnung = zuw.filter(z => !z.patientId).length;
  const datum = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('.') : '—');

  const zeilen = [...jePatient.entries()]
    .map(([id, e]) => ({ id, ...e, lead: patienten.get(id) }))
    .sort((x, y) => String(y.letzte || '').localeCompare(String(x.letzte || '')));

  body.innerHTML = `
    <p class="arzt-detail-summe">
      <strong>${gesamtPatienten}</strong> Patient${gesamtPatienten === 1 ? '' : 'en'} insgesamt ·
      <strong>${zuw.length}</strong> Verordnung${zuw.length === 1 ? '' : 'en'}
      ${ohneZuordnung ? ` · <span class="text-muted">${ohneZuordnung} ohne Patientenzuordnung</span>` : ''}
    </p>

    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Jahr</th><th>Patienten</th><th>Verordnungen</th></tr></thead>
        <tbody>
          ${jahre.map(([jahr, e]) => `
            <tr>
              <td><strong>${esc(jahr)}</strong></td>
              <td>${e.patienten.size}</td>
              <td class="text-muted">${e.verordnungen}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <h4 class="arzt-detail-h">Zugewiesene Patienten</h4>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nr.</th><th>Patient</th><th>Geburtsdatum</th><th>Verordnungen</th><th>Zuletzt</th></tr></thead>
        <tbody>
          ${zeilen.map(z => `
            <tr>
              <td class="text-muted">${esc(z.lead?.patientennummer ?? '—')}</td>
              <td>${esc(z.lead ? ctx.patientName(z.lead) : 'Patient nicht mehr vorhanden')}</td>
              <td>${esc(z.lead?.geburtsdatum ? datum(z.lead.geburtsdatum) : '—')}</td>
              <td>${z.anzahl}</td>
              <td>${esc(datum(z.letzte))}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
