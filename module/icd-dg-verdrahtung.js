/**
 * icd-dg-verdrahtung.js — ICD ↔ Diagnosegruppe in der Muster-13-Maske.
 *
 * Aus dashboard.js herausgeloest (26.09.2026, vorher `_wireDgIcdPair`) —
 * Kuşatma, und damit die Automatik erstmals mit einem Test abgesichert ist
 * (module/icd-dg-verdrahtung.test.js). Regeln und Abgleich bleiben, wo sie
 * waren: `icd-dg-match.js` (reiner Matcher) und `diagnosegruppen-regeln.js`
 * (Tabelle `diagnosegruppen`). Hier steht nur, WANN was ins Feld geschrieben
 * und welcher Hinweis gezeigt wird.
 *
 * Neu gegenueber dem Stand in dashboard.js (Ops #304, Nachtrag 26.09.2026):
 *
 *  - Beide ICD-Felder zaehlen. Muster 13 hat zwei (rzIcd, rzIcd2 → icd10,
 *    icd10_2). E11.74 im ersten und L60.0 im zweiten Feld setzte DF, obwohl
 *    UI1/UI2 ebenso in Frage kommen — die DG steht auf der Verordnung
 *    (Podologie-Vertrag Anlage 3 Ziffer 5 j), nicht in der Software.
 *  - Mehrere Kodes im ersten Feld wandern beim Verlassen ins zweite, wenn es
 *    leer ist. `icd10` haelt genau einen Kode: der Preflight prueft ihn als
 *    einen (api-backend/billing/dta/preflight.js, V:01002), und die DIA-
 *    Segmente werden aus [icd10, icd10_2] gebaut (abrechnung.routes.js) —
 *    „E11.74, L60.0" in einem Feld fiel erst in der Abrechnung auf.
 *    Fachlich abgenommen: `podoloji`, 26.09.2026 (ein Kode je Zeile wie auf
 *    dem Papier; Leerzeichen als Trenner kommt in der Praxis vor).
 *  - EINZIGER automatischer Schreiber von `rzDg` (26.09.2026). Bis dahin schrieb
 *    auch module/verordnung-podo.js (`dgAuswahlEingrenzen`) — zwei Schreiber mit
 *    zwei Kriterien, wer zuerst aus dem Netz kam, gewann (d/d2 live kaputt).
 *    Die zwei Gruende fuer den zweiten sind hier geloest: DG geleert → neuer
 *    Vorschlag (Szenario c), und der Fachbereich darf eine Funktion sein, die
 *    den der Maske liefert — der Mandanten-Bereich war bei `praxis`
 *    (interdisziplinaer) regellos, die Automatik dort stumm.
 */

import { parseIcdList, matchIcdToDg, soleIcdForDg, dgVorschlag, normDgCode } from '../icd-dg-match.js?v=20260925a';
import { loadDgIcdRules, getDgIcdRules, dgOptionenSperren } from './diagnosegruppen-regeln.js?v=20260918';

/**
 * Kodes aus einem ICD-Feld, auch leerzeichengetrennt („E11.74 L60.0").
 * `parseIcdList` trennt nur an Komma/Semikolon/Zeilenumbruch — ein Leerzeichen
 * gehoert bei „E11.74 – Titel" zum Anzeigetext. Deshalb erst den Titel
 * abschneiden, dann am Leerraum trennen. Doppelte Kodes zaehlen einmal.
 */
export function icdKodesAusFeld(roh) {
  const teile = String(roh ?? '').split(/[,;\n]/)
    .map(s => s.split(/\s[–—-]\s/)[0])
    .flatMap(s => s.trim().split(/\s+/));
  return [...new Set(parseIcdList(teile))];
}

/**
 * Wie sollen die zwei ICD-Felder stehen? Rein, ohne DOM.
 *
 * @returns {{ feld1: string, feld2: string, verschoben: boolean, zuViele: boolean }}
 *   `verschoben` — Feld 1 trug zwei Kodes, Feld 2 war leer: je Feld einer.
 *   `zuViele`    — mehr Kodes als Felder; nichts wird angefasst, nur gemeldet.
 */
export function icdAufZweiFelder(roh1, roh2) {
  const feld1 = String(roh1 ?? ''), feld2 = String(roh2 ?? '');
  const k1 = icdKodesAusFeld(feld1);
  const bleibt = { feld1, feld2, verschoben: false, zuViele: false };
  if (k1.length < 2) return bleibt;
  if (k1.length > 2 || feld2.trim()) return { ...bleibt, zuViele: true };
  return { feld1: k1[0], feld2: k1[1], verschoben: true, zuViele: false };
}

/**
 * Verdrahtet das ICD-Feld (und optional das zweite) mit der Diagnosegruppe.
 * Idempotent (data-Marke am ICD-Feld). Wird fuer die Podologie-Maske nach
 * jedem Re-Render erneut aufgerufen (die Elemente werden neu erzeugt).
 *
 * @param {object} o
 * @param {string} o.icdId     - erstes ICD-Feld (z.B. 'rzIcd')
 * @param {string} [o.icd2Id]  - zweites ICD-Feld (z.B. 'rzIcd2')
 * @param {string} o.dgId      - Diagnosegruppe (z.B. 'rzDg'), <select> oder Text
 * @param {string} [o.warnId]  - Element fuer den Hinweis
 * @param {string|(()=>string)} [o.bereich] - Fachbereich, oder Funktion, die
 *   ihn bei jeder Auswertung liefert (Ankreuzfeld der Maske). Nur Podologie hat
 *   heute echte icd_accept-Regeln (s. module/diagnosegruppen-regeln.js).
 * @param {object} o.supabase
 * @param {(k:string)=>string} o.t - i18n aus dashboard.js
 */
export function verdrahteIcdDg({ icdId, icd2Id = null, dgId, warnId = null, bereich, supabase, t }) {
  const icdEl  = document.getElementById(icdId);
  const icd2El = icd2Id ? document.getElementById(icd2Id) : null;
  const dgEl   = document.getElementById(dgId);
  if (!icdEl || icdEl.dataset.dgIcdWired) return;
  icdEl.dataset.dgIcdWired = '1';

  // Meldung zum Aufteilen — lebt bis zur naechsten Aenderung am ICD.
  let feldHinweis = '';

  const bereichJetzt = () => (typeof bereich === 'function' ? bereich() : bereich);
  async function regelnLaden() {
    const b = bereichJetzt();
    if (!getDgIcdRules(b) || !Object.keys(getDgIcdRules(b)).length) await loadDgIcdRules(supabase, b);
    return getDgIcdRules(b) || {};
  }

  /**
   * Setzt die Diagnosegruppe programmatisch und löst dabei input/change aus,
   * damit abhängige Logik mitläuft. Die Marke `autoSetting` sorgt dafür, dass
   * das eigene Ereignis nicht als Eingabe des Anwenders gewertet wird.
   * Ersetzt wird nur ein leeres Feld oder der eigene frühere Vorschlag (`dgAuto`).
   * Jeder andere Wert — Papier, Scan, Bestand, Handeingabe — ist ärztliche
   * Angabe und bleibt stehen (Podologie-Vertrag Anlage 3 Ziffer 5 j, Ops #304).
   * `dgAuto` setzt auch module/verordnung-podo.js (dgAuswahlEingrenzen).
   */
  function _setDgProgrammatically(value) {
    if (!dgEl || (dgEl.value.trim() && dgEl.value !== dgEl.dataset.dgAuto)) return;
    if (dgEl.value === value) return;
    dgEl.dataset.autoSetting = '1';
    try {
      dgEl.value = value;
      if (value) dgEl.dataset.dgAuto = value; else delete dgEl.dataset.dgAuto;
      dgEl.dispatchEvent(new Event('input',  { bubbles: true }));
      dgEl.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      delete dgEl.dataset.autoSetting;
    }
  }

  /** Zwei Kodes im ersten Feld, zweites leer → je Feld einer (s. Kopf). */
  function aufteilen() {
    if (!icd2El) return;
    const r = icdAufZweiFelder(icdEl.value, icd2El.value);
    if (r.verschoben) {
      icdEl.value  = r.feld1;
      icd2El.value = r.feld2;
      // Nur `change`: ein `input` am zweiten Feld oeffnet dort die Katalogsuche.
      icd2El.dispatchEvent(new Event('change', { bubbles: true }));
      feldHinweis = t('pod_icd_nach_feld2');
    } else {
      feldHinweis = r.zuViele ? t('pod_icd_je_feld') : '';
    }
  }

  const alleKodes = () => parseIcdList([icdEl.value, icd2El?.value].filter(Boolean).join(', '));

  function zeige(warnEl, text, fett = false) {
    const voll = [feldHinweis, text].filter(Boolean).join(' · ');
    warnEl.textContent      = voll;
    warnEl.style.fontWeight = fett ? '600' : '';
    warnEl.style.display    = voll ? 'block' : 'none';
  }

  async function onIcdChange(commit) {
    const codes   = alleKodes();
    const warnEl  = warnId ? document.getElementById(warnId) : null;

    // Keine Kodes → kein Hinweis, keine Sperre
    if (codes.length === 0) {
      if (warnEl) zeige(warnEl, '');
      dgOptionenSperren(dgEl, null, { t });
      if (commit === true) _setDgProgrammatically('');   // eigenen Vorschlag zurücknehmen
      return;
    }

    // Regeln pro Bereich bei Bedarf nachladen. Ausserhalb Podologie sind
    // icd_accept-Regeln heute leer (bewusst, s. module/diagnosegruppen-regeln.js)
    // — macht den Ablauf dort automatisch wirkungslos, kein gesondertes Gate nötig.
    const rules = await regelnLaden();
    if (!Object.keys(rules).length) {
      // Bereich ohne ICD-Regeln (z. B. von Podologie auf Physio umgekreuzt):
      // der eigene Vorschlag hat keine Grundlage mehr.
      if (commit === true) _setDgProgrammatically('');
      if (warnEl) zeige(warnEl, '');
      return;
    }

    // Vorschlag und Sperren in einem Zug — die Regeln stehen in der Tabelle
    // `diagnosegruppen`. `normativ` heisst: jeder eingegebene Kode gehoert
    // normativ genau einer Gruppe (heute nur L60.0 → UI1/UI2), dann kommt die
    // Rueckfrage statt einer geratenen Auswahl.
    const v = dgVorschlag(codes, rules);
    // Unmoegliche Kombinationen sperren — mit Begruendung an der Option selbst.
    // Geraeumt wird nur beim Verlassen des Feldes, s. dgOptionenSperren.
    dgOptionenSperren(dgEl, v, { codes, t, raeumen: commit === true });

    // Eine vom Anwender gesetzte Diagnosegruppe wird nicht überschrieben — das
    // prüft _setDgProgrammatically. Hier darf NICHT abgebrochen werden, sonst
    // bliebe genau der interessante Fall ohne Hinweis: der Anwender hat die
    // Gruppe von Hand gewählt und der Kode passt nicht dazu.

    // Genau eine Gruppe passt und keine andere kommt in Frage (dgVorschlag) →
    // eintragen (beim <select> nur, wenn es die Option gibt). Sonst beim Verlassen
    // des Feldes den eigenen früheren Vorschlag zurücknehmen (E11.74, dann L60.0).
    const optExists = v.auto && (dgEl?.tagName !== 'SELECT' || Array.from(dgEl.options).some(o => o.value === v.auto));
    if (optExists) _setDgProgrammatically(v.auto);
    else if (commit === true) _setDgProgrammatically('');

    // Warnhinweis
    if (!warnEl || !dgEl) return;
    const dgRoot = normDgCode(dgEl.value);
    if (!dgRoot) {
      // Noch keine Gruppe gewaehlt: die passenden benennen statt schweigen.
      zeige(warnEl, v.kandidaten.length > 1 ? `${t('pod_dg_kandidaten')} ${v.kandidaten.join(', ')}` : '');
      return;
    }
    const rule = rules[dgRoot];
    if (!rule || !rule.icd_accept || !rule.icd_accept.length) { zeige(warnEl, ''); return; }
    const result = matchIcdToDg(codes, rule);
    if (result.status !== 'mismatch') { zeige(warnEl, ''); return; }
    const isHard = rule.icd_enforcement === 'hard_before_dta';
    let msg = `${t('pod_icd_mismatch')}: ${codes.join(', ')} (${dgRoot})`;
    if (result.hints.length > 0) msg += ` — ${result.hints.join('; ')}`;
    // Welche Gruppe stattdessen passt — stand bis 26.09.2026 in einer zweiten,
    // roten Zeile von module/verordnung-podo.js („Zulässig: …").
    if (v.kandidaten.length) msg += ` · ${t('pod_dg_kandidaten')} ${v.kandidaten.join(', ')}`;
    if (isHard) msg += ' ⚠ ' + t('pod_icd_hard');
    zeige(warnEl, msg, isHard);
  }

  // Übernimmt der Anwender einen Wert (Katalogauswahl oder Feld verlassen, beides
  // `change`), gehört er nicht mehr der Automatik. Bewusst nicht `input`: das feuern
  // auch der Fokus-Anstoß (focusin in dashboard.js) und verordnung-podo.js:schreibe() —
  // ein Klick ins Feld hat sonst die Automatik abgeschaltet (Ops #304).
  if (dgEl && !dgEl.dataset.dgManualWired) {
    dgEl.dataset.dgManualWired = '1';
    // Leert er das Feld, gehört es wieder der Automatik: sofort neu vorschlagen
    // (Szenario c — vorher erledigte das der zweite Schreiber in verordnung-podo.js).
    dgEl.addEventListener('change', () => {
      if (dgEl.dataset.autoSetting) return;
      delete dgEl.dataset.dgAuto;
      if (!dgEl.value.trim()) onIcdChange(true);
    });

    // Gegenrichtung DG → ICD: nur wo sich aus der Diagnosegruppe genau ein Kode
    // ableiten lässt. Das ist ausschließlich UI1/UI2 → L60.0; bei DF/NF/QF ist
    // der Pool nicht normativ, dort wird nichts eingetragen.
    dgEl.addEventListener('change', async () => {
      if (dgEl.dataset.autoSetting) return;          // kein Ping-Pong
      if (icdEl.value.trim()) return;                // Gefülltes Feld bleibt
      const rule = (await regelnLaden())[normDgCode(dgEl.value)];
      const sole = rule ? soleIcdForDg(rule) : null;
      if (!sole || icdEl.value.trim()) return;
      icdEl.value = sole;
      icdEl.dispatchEvent(new Event('input',  { bubbles: true }));
      icdEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  icdEl.addEventListener('input',  () => { feldHinweis = ''; onIcdChange(false); });
  icdEl.addEventListener('change', () => { aufteilen(); onIcdChange(true); });
  if (icd2El && !icd2El.dataset.dgIcdWired) {
    icd2El.dataset.dgIcdWired = '1';
    icd2El.addEventListener('input',  () => onIcdChange(false));
    icd2El.addEventListener('change', () => onIcdChange(true));
  }

  // Wenn Feld bereits befüllt: sofort prüfen
  if (icdEl.value.trim() || icd2El?.value.trim()) onIcdChange(true);
}
