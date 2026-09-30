// Podologischer Behandlungstag — Serverseite (reine Funktionen, kein DB-Zugriff).
//
// Gegenstück zu module/podo-behandlungstag-regel.js (Frontend). Das Modul lässt sich
// in Node nicht importieren (Import mit ?v=-Suffix), deshalb steht die Regel hier ein
// zweites Mal — INHALTLICH GLEICH halten (fonksiyon-ustasi 30.09.2026). Test:
// behandlungstage.test.js.
//
// gkv-302 30.09.2026 (Podologie-Reform S4, Zusatz 5 + 6):
//   • „Bereit zur Abrechnung" setzt mindestens einen abrechenbaren Behandlungstag
//     voraus: nicht storniert UND 78010/78020/78610 enthalten; derselbe Kalendertag
//     zählt einmal. Befund (78030/78040), Kontrolle oder Zuschlag (78620) allein
//     machen keinen Behandlungstag.
//   • Je Tag nur EINE Behandlung (HeilM-RL § 12 Abs. 8). 78610 Nagelkorrekturspange
//     darf bis zu 2× je Tag (Anlage 2 § 2 c); 78620 ist Aufschlag, keine Einheit.
//
// ⚠️ Nicht dasselbe wie billing/dta/befundpauschale-regeln.js TEDAVI_POSITIONEN
// (['78010','78020'], ohne 78610) — dort geht es um die Befundpauschale. Ob beide
// Mengen zusammengehören, ist bei gkv-302 offen (fonksiyon-ustasi 30.09.2026).

export const ABRECHENBARE_BEHANDLUNG = new Set(['78010', '78020', '78610']);

/** Gruppe je Position für die Tageshöchstzahl. 78010 und 78020 sind beide „die" Behandlung. */
const GRUPPE = { '78010': 'behandlung', '78020': 'behandlung', '78610': 'nagelspange' };
export const TAGESHOECHSTZAHL = { behandlung: 1, nagelspange: 2 };

const tagVon = (v) => String(v || '').slice(0, 10);

/**
 * Anzahl abrechenbarer Behandlungstage (wie abrechenbareBehandlungstage im Frontend).
 * @param {Array<{behandlungsdatum:string, hpnr_codes:?string[], storniert_am?:?string}>} behandlungen
 */
export function abrechenbareBehandlungstage(behandlungen) {
  const tage = new Set();
  for (const b of behandlungen || []) {
    if (!b || b.storniert_am || !tagVon(b.behandlungsdatum)) continue;
    const codes = Array.isArray(b.hpnr_codes) ? b.hpnr_codes : [];
    if (codes.some(c => ABRECHENBARE_BEHANDLUNG.has(String(c).trim()))) tage.add(tagVon(b.behandlungsdatum));
  }
  return tage.size;
}

/**
 * Zählt je Kalendertag und Gruppe, wie oft eine Behandlung vorkommt.
 * @param {Array} items
 * @param {(x)=>string} datumFn  @param {(x)=>string} posFn  @param {(x)=>number} [anzahlFn]
 * @returns {Array<{datum:string, gruppe:string, anzahl:number}>}
 */
export function behandlungstageJeDatum(items, datumFn, posFn, anzahlFn = () => 1) {
  const zaehler = new Map();
  for (const x of items || []) {
    const gruppe = GRUPPE[String(posFn(x) ?? '').trim()];
    const datum = tagVon(datumFn(x));
    if (!gruppe || !datum) continue;
    const n = Number(anzahlFn(x) ?? 1);
    const key = datum + '|' + gruppe;
    zaehler.set(key, (zaehler.get(key) || 0) + (Number.isFinite(n) && n > 0 ? n : 1));
  }
  return [...zaehler].map(([k, anzahl]) => {
    const [datum, gruppe] = k.split('|');
    return { datum, gruppe, anzahl };
  });
}
