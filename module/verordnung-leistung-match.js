/**
 * verordnung-leistung-match.js — welche Leistung meint eine Verordnung?
 *
 * Ops #306, 18.09.2026. Beta-1 (Podologe), live §302-Test: „jetzt übernimmt er
 * nur Nagelspange auf falsch" (02:05:41). Ursache in `dashboard.js`: ohne
 * Treffer gab die alte Fassung `list[0].id` zurück — irgendeine Leistung, meist
 * zufällig die erste eingerichtete — und `zeigeDienstleistungsfeld()` blendete
 * das Feld danach aus, weil ein (falscher) Wert ja gesetzt war. Die Praxis sah
 * die Auswahl nie und konnte sie nicht korrigieren.
 *
 * Reine Funktion, kein DOM — deshalb hier und nicht in `dashboard.js`
 * (Konsey 2026-08-13: die Datei wächst nicht mehr) und mit `node --test`
 * prüfbar, ohne einen Browser zu simulieren.
 */

/**
 * @param {{heilmittel?:?string, heilmittel_position?:?string}} rx  Verordnungszeile
 * @param {Array<{id:string, title?:?string, code?:?string, gkv_position_nr?:?string}>} dienste
 * @returns {?string} Leistungs-ID oder `null` — nie geraten.
 */
export function passendeLeistungId(rx, dienste) {
  if (!Array.isArray(dienste) || !dienste.length) return null;

  // 1) HPNR/Positionsnummer — eindeutig und textunabhängig, deshalb zuerst.
  const hpnr = String(rx?.heilmittel_position || '').trim().toLowerCase();
  if (hpnr) {
    const byHpnr = dienste.find(s =>
      String(s.gkv_position_nr || '').trim().toLowerCase() === hpnr ||
      String(s.code || '').trim().toLowerCase() === hpnr);
    if (byHpnr) return byHpnr.id;
  }

  // 2) Freitext, beidseitig geprüft: `heilmittel` ist der lange Verordnungstext
  // („Podologische Behandlung (groß)"), `service.title` die kurze
  // Praxis-Bezeichnung — eine einseitige `.includes()`-Prüfung fand die kurze
  // Zeichenkette nie in der langen.
  const hmLower = String(rx?.heilmittel || '').trim().toLowerCase();
  if (hmLower) {
    const byText = dienste.find(s => {
      const titel = String(s.title || '').trim().toLowerCase();
      const code = String(s.code || '').trim().toLowerCase();
      return (titel && (hmLower.includes(titel) || titel.includes(hmLower))) ||
             (code && (hmLower.includes(code) || code.includes(hmLower)));
    });
    if (byText) return byText.id;
  }

  return null;
}
