/**
 * geld.js — die eine Stelle für Euro-Formatierung und -Eingabe.
 *
 * Warum es das gibt
 * ─────────────────
 * `fmtEur` stand bis zum 08.09.2026 **fünfmal** im Frontend, alle als lokale
 * Funktion in der Datei, die sie zufällig zuerst brauchte: `dashboard.js`
 * (vier eigenständige Kopien — `:18204` benannt, `:20123`/`:20264`/`:20342`
 * als lokale Arrow-Funktionen, keine davon exportiert) und
 * `module/podologie-abrechnung.js:974` (Kopie Nummer fünf). Eine sechste,
 * `formatEur()` in `dashboard.js:14877`, tut etwas ANDERES: sie rundet mit
 * `toFixed(2)` und ersetzt nur den Dezimalpunkt — **ohne Tausenderpunkt**.
 * `1234,50 €` statt `1.234,50 €`. Auf einem Bildschirm, der Kassenbeträge
 * zeigt, ist das kein Stilbruch, sondern ein zweites, leicht falsches
 * Format neben dem richtigen.
 *
 * `api-backend/billing/pdf/*.template.js` hat sechs weitere eigene Kopien
 * (Ausfall-, Begleitzettel-, Mahnung-, Rechnung-, RZG-Quittung-, Zuzahlung-
 * Vorlage). Das ist **kein Migrationsziel**: das Backend ist ein eigenes
 * Docker-Image mit eigener COPY-Liste und kann `module/` nicht importieren
 * (wie `module/geschlecht.js` — dort gilt dieselbe Regel — im eigenen
 * Kopfkommentar sagt).
 *
 * Diese Datei ist Auslöser der geplanten §302-Bildschirm-Zusammenlegung
 * (`ABRECHNUNG_BILDSCHIRM_PLAN.md`, Phase 0.1): neuer Code auf diesem
 * Bildschirm speist sich ausschliesslich hier. Die fünf alten Kopien
 * wandern beim nächsten Anfassen der jeweiligen Stelle hierher — nicht
 * auf einmal, aber jede neue Kopie ist ab jetzt ein Rückschritt.
 *
 * `parseEur` ist das Gegenstück für Eingabefelder (z. B. eine erfasste
 * Zahlung, Phase 4 desselben Plans). Bestehende Ad-hoc-Parser im Code
 * (`module/ausfallrechnung.js`, `module/ausfall-einstellungen.js`,
 * `dashboard.js:4740`) ersetzen nur `,` durch `.` und verstehen keinen
 * Tausenderpunkt — für Beträge unter 1.000 € reicht das zufällig, für eine
 * Sammelrechnungssumme nicht mehr zuverlässig.
 */

/**
 * Formatiert eine Zahl als deutschen Euro-Betrag: Tausenderpunkt,
 * Komma-Dezimaltrennzeichen, zwei Nachkommastellen, „ €" am Ende.
 *
 * `null`/`undefined`/`NaN`/nicht-numerische Eingaben werden als 0 € gezeigt —
 * ein leeres Feld ist auf einer Rechnung eher Fehlerquelle als Klarheit.
 *
 * @param {number|string|null|undefined} n
 * @returns {string} z. B. "1.234,50 €"
 */
export function fmtEur(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/**
 * Liest einen von Menschen getippten Euro-Betrag zurück in eine Zahl.
 *
 * Toleriert die Formate, die in diesem Projekt tatsächlich vorkommen:
 *   "1.234,50"  — deutsch, mit Tausenderpunkt (fmtEur-Ausgabe ohne „ €")
 *   "1234,50"   — deutsch, ohne Tausenderpunkt
 *   "1234.50"   — englisch getippt (z. B. Zahlenblock-Gewohnheit)
 *   "1.234"     — Tausenderpunkt ohne Nachkommastellen
 *   "1234"      — reine Ganzzahl
 * Ein „ €"-Anhang und umgebende Leerzeichen werden ignoriert.
 *
 * Ein einzelner Punkt ist mehrdeutig (Dezimal- oder Tausendertrennzeichen).
 * Auflösung: folgen genau drei Ziffern, ist es ein Tausenderpunkt (deutsche
 * Konvention); folgen ein oder zwei Ziffern, ist es ein Dezimalpunkt.
 *
 * @param {string} eingabe
 * @returns {number|null} die Zahl, oder `null` wenn nicht eindeutig lesbar
 */
export function parseEur(eingabe) {
  if (typeof eingabe === 'number') return Number.isFinite(eingabe) ? eingabe : null;
  if (typeof eingabe !== 'string') return null;

  let s = eingabe.trim().replace(/€/g, '').replace(/\s/g, '');
  if (!s) return null;

  const hatKomma = s.includes(',');
  const punkte = (s.match(/\./g) || []).length;

  if (hatKomma && punkte > 0) {
    // "1.234,50" — Punkt ist Tausendertrennzeichen, Komma ist Dezimal.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hatKomma) {
    // "1234,50" — nur Komma, das ist der Dezimaltrenner.
    s = s.replace(',', '.');
  } else if (punkte > 1) {
    // "1.234.567" — nur Tausenderpunkte, keine Nachkommastellen.
    s = s.replace(/\./g, '');
  } else if (punkte === 1) {
    const nachDemPunkt = s.split('.')[1];
    if (nachDemPunkt.length === 3) {
      // "1.234" — Tausenderpunkt ohne Dezimalstellen.
      s = s.replace('.', '');
    }
    // sonst: "1234.5" / "1234.50" — bereits gültiges Dezimalformat.
  }

  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
