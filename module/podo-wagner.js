/**
 * podo-wagner.js — Wagner-Grad (0–5, diabetisches Fußsyndrom) als salt-okunur Rozet.
 *
 * Konsey S0 2a (30.09.2026): Der Wagner-Grad wird EINMAL erfasst — im Fußbefund
 * (`pat_fussbefund.wagner_grad`, smallint 0–5, NULL = nicht erhoben; Migration 0047) — und
 * nur ANGEZEIGT: im Kopf der Patientenakte und der Tagesbehandlung, mit dem Datum des
 * Befunds („Wagner 1 · 12.09.2026"). In die Verordnungsmaske kommt er nicht zurück.
 *
 * Quelle: der jüngste gültige Fußbefund MIT Wagner-Wert (`ist_aktuell = true`, `erstellt_am`
 * absteigend). Ein neuerer Befund ohne Wert („nicht erhoben") löscht den Anzeigewert nicht —
 * er sagt nur, dass an dem Tag nicht eingestuft wurde. Gibt es keinen, fällt die Anzeige für
 * die Übergangszeit auf `prescriptions.wagner_grad` zurück (Altbestand, dorthin wird nicht
 * mehr geschrieben).
 *
 * Nur bei DG = DF oder ICD E10/E11 — sonst wäre die Zahl ohne Bedeutung und nur Lärm.
 * Rozet-Regel wie `anamnese-rozet.js` (legal-de 30.09.2026): Akten-Kopf und Tagesbehandlung,
 * nirgends sonst (Kalender, Mail, PDF, Abrechnung).
 */

import { datumDe } from './datum.js?v=20261001a';

/** Kurzbeschreibung nach Wagner — nur als Tooltip; die Stufe selbst ist die Aussage. */
export const WAGNER_TEXT = {
  0: 'keine Läsion, Risikofuß',
  1: 'oberflächliche Läsion',
  2: 'tiefe Läsion bis Sehne/Kapsel',
  3: 'tiefe Läsion mit Abszess/Osteomyelitis',
  4: 'begrenzte Nekrose',
  5: 'Nekrose des gesamten Fußes',
};

/** Auswahl im Fußbefund: „nicht erhoben" (NULL) + 0..5. */
export const WAGNER_OPTIONEN = [
  { wert: '', label: 'nicht erhoben' },
  ...[0, 1, 2, 3, 4, 5].map((n) => ({ wert: String(n), label: `Wagner ${n}` })),
];

/**
 * Feldwert → Zahl 0..5 oder null (= nicht erhoben). Alles andere (Text, 6, −1, 1.5) → null.
 * @param {*} roh  Select-Wert (String) oder Spaltenwert
 * @returns {?number}
 */
export function wagnerWert(roh) {
  if (roh === null || roh === undefined || roh === '') return null;
  const n = Number(roh);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : null;
}

/**
 * Gilt die Anzeige für diesen Patienten? DG-Wurzel DF ('DF', 'DF-a' …) oder ICD E10/E11(.x).
 * @param {{dgs?:string[], icd10?:string[]}} p
 */
export function wagnerRelevant({ dgs = [], icd10 = [] } = {}) {
  const dgHit = dgs.some((d) => String(d || '').trim().toUpperCase().split(/[\s\-–]/)[0] === 'DF');
  const icdHit = icd10.some((c) => /^E1[01](\.|$|\s)/i.test(String(c || '').trim()));
  return dgHit || icdHit;
}

/**
 * Anzeigewert bestimmen: Befund vor Verordnung.
 * @param {{befund?:?{wagner_grad:*, erstellt_am:*}, vord?:?{wagner_grad:*, ausstellungsdatum:*}}} q
 * @returns {?{grad:number, datum:string, quelle:'befund'|'verordnung'}}
 */
export function wagnerAnzeige({ befund = null, vord = null } = {}) {
  const b = wagnerWert(befund?.wagner_grad);
  if (b !== null) return { grad: b, datum: datumDe(befund.erstellt_am, ''), quelle: 'befund' };
  const v = wagnerWert(vord?.wagner_grad);
  if (v !== null) return { grad: v, datum: datumDe(vord.ausstellungsdatum, ''), quelle: 'verordnung' };
  return null;
}

/**
 * @param {?{grad:number, datum:string, quelle:string}} a
 * @param {(s:string)=>string} esc
 * @returns {string} leer ohne Wert
 */
export function wagnerRozetHtml(a, esc) {
  if (!a) return '';
  const stufe = a.grad >= 3 ? 'rot' : a.grad >= 1 ? 'orange' : 'mehr';
  const text = `Wagner ${a.grad}${a.datum ? ` · ${a.datum}` : ''}`;
  const titel = `${WAGNER_TEXT[a.grad]} — ${a.quelle === 'befund' ? 'aus dem Fußbefund' : 'aus der Verordnung (Altbestand)'}`;
  return `<span class="anam-rozets" data-wagner-rozet><span class="anam-rozet anam-rozet--${stufe}" title="${esc(titel)}">${esc(text)}</span></span>`;
}

/**
 * Lädt, was das Rozet braucht, und liefert fertiges HTML ('' = nichts anzeigen).
 * Jeder Fehler → '' (ein Rozet darf nie den Bildschirm kippen).
 * @param {object} sb        Supabase-Client
 * @param {string} ownerId
 * @param {string} leadId
 * @param {(s:string)=>string} esc
 * @returns {Promise<string>}
 */
export async function ladeWagnerRozet(sb, ownerId, leadId, esc) {
  if (!sb || !leadId) return '';
  try {
    const { data: vs } = await sb.from('prescriptions')
      .select('diagnosegruppe, icd10, icd10_2, wagner_grad, ausstellungsdatum')
      .eq('patient_id', leadId)
      .order('ausstellungsdatum', { ascending: false, nullsFirst: false })
      .limit(30);
    const liste = vs || [];
    const relevant = wagnerRelevant({
      dgs: liste.map((v) => v.diagnosegruppe),
      icd10: liste.flatMap((v) => [v.icd10, v.icd10_2]),
    });
    if (!relevant) return '';
    const { data: befund } = await sb.from('pat_fussbefund')
      .select('wagner_grad, erstellt_am')
      .eq('owner_id', ownerId).eq('lead_id', leadId).eq('ist_aktuell', true)
      .not('wagner_grad', 'is', null)
      .order('erstellt_am', { ascending: false }).limit(1).maybeSingle();
    const vord = liste.find((v) => wagnerWert(v.wagner_grad) !== null) || null;
    return wagnerRozetHtml(wagnerAnzeige({ befund, vord }), esc);
  } catch { return ''; }
}
