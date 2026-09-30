/**
 * podo-behandlungsposition-regel.js — Vorbelegung der Behandlungsposition
 * (78010/78020) im Tagesbehandlungs-Formular.
 *
 * Reform-Sprint S1.5 (28.09.2026). Eigene Datei nach demselben Muster wie
 * `eingangsbefundung-regel.js`: reine Regel, kein DOM, kein `ctx` — dadurch
 * in node importierbar und neben ihrem Test testbar. `podologie-abrechnung.js`
 * selbst laesst sich nicht importieren (`document.addEventListener` im
 * Modulrumpf).
 *
 * Vorher (`module/podologie-abrechnung.js:743-752`, `autoChecked`/`geplant`)
 * wurde nur die im TERMIN geplante Position vorbelegt (`geplanteHpnr`). Wer
 * ohne gebuchten Termin dokumentierte — typisch die 2. Sitzung einer Serie —
 * bekam 78010 leer, obwohl das Rezept die Behandlung eindeutig trägt.
 *
 * Fatura-Regel (gkv-302, Quelle Anlage 1a Podologie Teil 2 Ziff. 1-3 + FAK
 * Podologie Q25):
 *   a) Hornhautabtragung        → immer 78010
 *   b) Nagelbearbeitung         → immer 78010
 *   c) Podologische Komplexbehandlung → 78010 als Vorschlag; 78020 nur bei
 *      Therapiezeit > 20 Minuten AN DIESEM TAG — das entscheidet der
 *      Podologe je Sitzung, nicht das Rezept. Deshalb wird c) hier NICHT auf
 *      78020 vorbelegt, obwohl 78020 für c) grundsätzlich zulässig ist
 *      (die Sperre gegen 78020 bei a)/b) sitzt separat in
 *      `podologie-abrechnung.js`, Prüfung beim Speichern).
 *
 * Ist die Maßnahme unbekannt (sehr alte Verordnung ohne `leitsymptomatik`
 * und ohne `massnahme` in den `heilmittel_items` — s.
 * `podVordMassnahme()`-Doku in `podologie-abrechnung.js`), wird die rohe
 * Rezeptposition übernommen, aber nur wenn sie 78010 oder 78020 ist; sonst
 * lieber keine Vorbelegung als eine falsche.
 *
 * Reform Podoloji (b), 30.09.2026: In DF/NF/QF ist die Behandlung Teil des Tages
 * (Anlage 1a: Befundung ODER Behandlung, 78010 ist der Regelfall). Ist weder Maßnahme noch
 * Rezeptposition bekannt, wird trotzdem 78010 vorbelegt — eine leere Vorbelegung ließ
 * Tagesbehandlungen ohne Position durchrutschen (QA-Beispiel 3e256b9a). UI1/UI2 unverändert.
 */

import { POD_HEILMITTEL_DGS } from './podo-heilmittel-katalog.js?v=20261001g';

/** Diagnosegruppen mit a/b/c-Katalog — eine Tabelle, s. podo-heilmittel-katalog.js. */
const DGS_MIT_BEHANDLUNG = POD_HEILMITTEL_DGS;

/**
 * @param {'a'|'b'|'c'|''} massnahme  aus `podVordMassnahme(vord)`
 * @param {string} [rohPosition]      `heilmittel_position || erstePositionAusItems(heilmittel_items)`
 * @param {string} [dg]               Diagnosegruppe (Wurzel, z. B. 'DF'; 'DF-a' wird gelesen)
 * @returns {'78010'|'78020'|''}
 */
export function behandlungspositionVorschlag(massnahme, rohPosition = '', dg = '') {
  if (massnahme === 'a' || massnahme === 'b' || massnahme === 'c') return '78010';
  const roh = String(rohPosition || '').trim();
  if (roh === '78010' || roh === '78020') return roh;
  const wurzel = String(dg || '').trim().toUpperCase().split(/[\s\-–]/)[0];
  return DGS_MIT_BEHANDLUNG.includes(wurzel) ? '78010' : '';
}

/**
 * Tagesbehandlung ohne Behandlungsposition (Reform Podoloji (b)2, 30.09.2026).
 * In DF/NF/QF fehlt 78010/78020 → kein Fehler, aber eine Rückfrage: es wird dann nur die
 * Befundung dokumentiert. UI1/UI2 (Nagelspange) kennen 78010/78020 nicht → nie fragen.
 * @param {string} dg      Diagnosegruppe (Wurzel)
 * @param {string[]} checks angekreuzte HPNR
 */
export function ohneBehandlungsposition(dg, checks) {
  const wurzel = String(dg || '').trim().toUpperCase().split(/[\s\-–]/)[0];
  if (!DGS_MIT_BEHANDLUNG.includes(wurzel)) return false;
  const c = Array.isArray(checks) ? checks : [];
  return c.length > 0 && !c.includes('78010') && !c.includes('78020');
}

export const OHNE_BEHANDLUNG_FRAGE =
  'Keine Behandlungsposition (78010/78020) gewählt — es wird nur die Befundung dokumentiert. Ist das so gewollt?';

export const LS_FEHLT_NOTIZ =
  'Auf der Verordnung fehlt die Leitsymptomatik — im Einvernehmen mit der verordnenden Praxis ergänzen '
  + '(ohne neue Unterschrift), sonst wird die Abrechnungsdatei abgewiesen.';

/**
 * Nicht blockierende Notiz am Kopf der Tagesbehandlung (Podoloji (b)3). Nur DF/NF/QF —
 * bei UI1/UI2 leitet sich die Leitsymptomatik aus der Diagnosegruppe ab.
 * @returns {string} Notiz oder ''
 */
export function leitsymptomatikNotiz({ dg, massnahme, roh, freitext } = {}) {
  const wurzel = String(dg || '').trim().toUpperCase().split(/[\s\-–]/)[0];
  if (!DGS_MIT_BEHANDLUNG.includes(wurzel)) return '';
  if (massnahme || String(roh || '').trim() || String(freitext || '').trim()) return '';
  return LS_FEHLT_NOTIZ;
}

/**
 * Leitsymptomatik-Buchstabe (a/b/c) aus dem gespeicherten Rohwert.
 *
 * P1 canli-test 30.09.2026: Die Muster-13-Maske speichert die an4-Bitmaske
 * („0010" = c, Reihenfolge a-b-c-patientenindividuell, `lsCollect()` in
 * dashboard.js); gelesen wurden nur „c" und „DF-c". Folge: bei jeder in der
 * Maske erfassten Verordnung fehlte das Therapiezeit-Feld (c) UND die
 * 78020-Sperre für a)/b) fiel still aus.
 *
 * Mehrere Kreuze: enthält die Menge c, gilt c (Komplexbehandlung umfasst a+b);
 * sonst nur bei genau einem Kreuz dessen Buchstabe, sonst '' (lieber keine
 * Regel als eine geratene).
 *
 * @param {string} roh   `prescriptions.leitsymptomatik`
 * @returns {'a'|'b'|'c'|''}
 */
export function massnahmeAusLeitsymptomatik(roh) {
  const v = String(roh ?? '').trim().toLowerCase();
  const dgs = POD_HEILMITTEL_DGS.map(d => d.toLowerCase()).join('|');
  const direkt = (v.match(new RegExp(`^(?:(?:${dgs})-)?([abc])$`)) || [])[1];
  if (direkt) return direkt;
  if (/^[01]{4}$/.test(v)) {
    const gesetzt = ['a', 'b', 'c'].filter((l, i) => v[i] === '1');
    if (gesetzt.includes('c')) return 'c';
    return gesetzt.length === 1 ? gesetzt[0] : '';
  }
  return '';
}
