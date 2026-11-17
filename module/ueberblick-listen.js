// Überblick-Karten „Rezept-Fristen" und „Aktuelle Abwesenheiten" (QA TEST-Physio 17.11.2026, Fund 8).
//
// Rezept-Fristen: eine Patientin mit fünf Verordnungen gleichen Datums stand fünfmal wortgleich
// da („bis 01.12.2026"). Gleiche Meldungen werden jetzt zu einer Zeile mit Anzahl zusammengefasst.
// Abwesenheiten: zeigte alles mit Ende ab heute — auch Juli im Folgejahr — und Datum ohne Jahr.
// Jetzt nur laufende oder in den nächsten 30 Tagen beginnende, Datum TT.MM.JJJJ.
import { datumDe } from './datum.js?v=20261001a';

/**
 * @param {{type:string, text:string}[]} alerts  text ist bereits HTML-escaped
 * @returns {{type:string, text:string}[]}
 */
export function fristenGruppieren(alerts) {
  /** @type {Map<string, {type:string, text:string, anzahl:number}>} */
  const gruppen = new Map();
  for (const a of alerts || []) {
    const k = `${a.type}|${a.text}`;
    const g = gruppen.get(k);
    if (g) g.anzahl++; else gruppen.set(k, { ...a, anzahl: 1 });
  }
  return [...gruppen.values()].map(g => ({ type: g.type, text: g.anzahl > 1 ? `${g.text} · ${g.anzahl} Verordnungen` : g.text }));
}

const TYP = { urlaub: 'Urlaub', krank: 'Krank', frei: 'Frei', elternzeit: 'Elternzeit' };

/** @param {string|null|undefined} typ */
export function abwesenheitTyp(typ) {
  return TYP[/** @type {keyof typeof TYP} */ (String(typ || ''))] || String(typ || 'Abwesend');
}

/**
 * @template {{start_date?:string|null, end_date?:string|null}} T
 * @param {T[]} zeilen
 * @param {string} heute  'YYYY-MM-DD' (Berlin)
 * @param {number} [tageVoraus]
 * @returns {T[]}
 */
export function aktuelleAbwesenheiten(zeilen, heute, tageVoraus = 30) {
  const bis = new Date(`${heute}T12:00:00Z`);
  bis.setUTCDate(bis.getUTCDate() + tageVoraus);
  const grenze = bis.toISOString().slice(0, 10);
  return (zeilen || []).filter(z => String(z.end_date || '').slice(0, 10) >= heute && String(z.start_date || '').slice(0, 10) <= grenze);
}

/** @param {string|null|undefined} wert  ISO-Datum oder Zeitstempel */
export function datumMitJahr(wert) {
  return datumDe(String(wert || '').slice(0, 10), '—');
}
