/**
 * podo-heilmittel-katalog.js — Maßnahme a/b/c ↔ Abrechnungsposition (Podologie).
 *
 * Bis 30.09.2026 stand die Tabelle privat in podologie-abrechnung.js (nicht importierbar:
 * `document.addEventListener` im Modulrumpf). Die Verordnungsprüfung braucht dieselbe Zuordnung
 * (Reform Podoloji (a): 78010/78020 gegen Leitsymptomatik) — ein Ort, keine zweite Tabelle.
 * Nicht verwechseln mit `POD_KATALOG` in verordnung-regeln.js (Katalogtext je Diagnosegruppe).
 */

// ⚠ Positionszuordnung — hier wird am häufigsten zu viel abgerechnet:
// Hornhautabtragung ODER Nagelbearbeitung allein werden IMMER mit 78010 zzgl.
// 78030 abgerechnet, auch bei mehr als 20 Minuten Therapiezeit
// (FAK Podologie Q25). 78020 „Podologische Behandlung (groß)" ist
// ausschließlich bei verordneter Komplexbehandlung mit Therapiezeit über
// 20 Minuten abrechenbar — sonst Retaxation (~15 € je Sitzung).
// Siehe wissensbank/SPEC-RULES.md und Podoloji/podologie-hpnr-reference.js.
export const POD_HEILMITTEL_KATALOG = {
  a: {
    heilmittel:      'Hornhautabtragung',
    leitsymptomatik: 'Hyperkeratose (schmerzlos und schmerzhaft)',
    hpnr:            '78010',
    hpnrGross:       null,
  },
  b: {
    heilmittel:      'Nagelbearbeitung',
    leitsymptomatik: 'Pathologisches Nagelwachstum (Verdickung, Tendenz zum Einwachsen)',
    hpnr:            '78010',
    hpnrGross:       null,
  },
  c: {
    heilmittel:      'Podologische Komplexbehandlung',
    leitsymptomatik: 'Hyperkeratose und pathologisches Nagelwachstum',
    hpnr:            '78010',
    hpnrGross:       '78020',   // nur bei Therapiezeit > 20 Min
  },
};
export const POD_HEILMITTEL_DGS  = ['DF', 'NF', 'QF'];  // UI1/UI2 haben keinen a/b/c-Katalog
