/**
 * befundpauschale-regeln.js — 78030/78040 ohne Behandlung.
 *
 * Warum es das gibt
 * ─────────────────
 * Podologie-Reform-Sprint S1.6 (gkv-302-Hinweis, 28.09.2026): 78030
 * (Podologische Befundung) und 78040 (Podologische Eingangsbefundung) sind
 * an eine tatsächlich erbrachte Behandlung gebunden — nicht als eigenständige,
 * frei abrechenbare Leistung gedacht.
 *
 *   FAK Podologie, Stand 24.05.2023, Nr. 6/7
 *   (`wissensbank/podologie/20230524_Podologie_FAK_bf.txt`, Z.42-47):
 *     „Ja, die Befundposition 78030 ist zu jeder der Abrechnungspositionen
 *      „Behandlung groß" oder „Behandlung klein" abrechenbar." — (a) unten
 *      ist daraus ABGELEITET (Bindung an 78010/78020 aus FAK Nr. 7), kein
 *      wörtliches Verbot für den Fall OHNE Behandlung.
 *   Anlage 1a Leistungsbeschreibung, Lesefassung
 *   (`…Anlage_1a_Leistungsbeschreibung_lesefassung_b.txt`, Z.458-462 + Z.83-84):
 *     „…ist ohne gesonderte Verordnung zusätzlich zur podologischen Behandlung
 *      einmalig eine podologische Eingangsbefundung … durchzuführen." und
 *      „erfolgt vor der ersten Abgabe einer podologischen Leistung und kann
 *      am gleichen Tag … durchgeführt werden." — (b) unten ist ein
 *      RÜCKSCHLUSS aus „zusätzlich zur podologischen Behandlung", kein
 *      ausdrücklicher Verbotssatz.
 *
 * Regeln:
 *   (a) 78030 an einem Tag OHNE 78010/78020 AM SELBEN TAG  → harte Sperre,
 *       nicht übersteuerbar.
 *   (b) 78040 irgendwo in der Verordnung, aber KEIN Tag der GANZEN Verordnung
 *       hat 78010/78020 → Sperre, aber mit „Trotzdem übernehmen" umgehbar
 *       (Rückschluss, keine wörtliche Quellenaussage).
 *   (c) 78040 an einem Tag allein, aber ein ANDERER Tag derselben Verordnung
 *       hat 78010/78020 → frei, keine Sperre.
 *
 * UI1/UI2 (Nagelspange) sind NICHT Teil dieser Regel — die haben eigene
 * Sperren (ICD L60.0, Befundpauschale generell verboten), gespiegelt in
 * `abrechnung.routes.js` / `module/abrechnung-auswahl.js` `podoSperren()`.
 *
 * Reine Funktion — kein DOM, kein Netz, keine DB. Nimmt die Seansliste EINER
 * Verordnung (ein Tag = eine dokumentierte Behandlung mit ihren HPNR-Kodes)
 * und gibt zwei getrennte Gründelisten zurück, damit der Aufrufer entscheiden
 * kann, welche hart und welche übersteuerbar sind.
 */

// Tedavi (Behandlung) im Sinne dieser Regel — bewusst NUR diese zwei Kodes,
// keine Erweiterung ohne neue Quellenprüfung (gkv-302).
export const TEDAVI_POSITIONEN = ['78010', '78020'];

const BEFUNDUNG = '78030';           // Podologische Befundung
const EINGANGSBEFUNDUNG = '78040';   // Podologische Eingangsbefundung

function normPositionen(positionen) {
  return (Array.isArray(positionen) ? positionen : []).map(p => String(p ?? '').trim());
}

/** TT.MM. — genug zur Unterscheidung innerhalb einer max. 84 Tage gültigen Verordnung. */
function formatDatumKurz(datum) {
  const s = String(datum ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}.${m[2]}.`;
  return s || 'unbekanntem Datum';
}

/**
 * @param {Array<{datum: string, positionen: string[]}>} sessions
 *   Ein Eintrag je dokumentiertem Behandlungstag EINER Verordnung.
 * @returns {{ hart: string[], uebersteuerbar: string[] }}
 *   `hart`: Regel (a) — kein Übersteuern möglich.
 *   `uebersteuerbar`: Regel (b) — mit „Trotzdem übernehmen" umgehbar.
 */
export function befundpauschaleRegeln(sessions) {
  const tage = Array.isArray(sessions) ? sessions : [];
  const hart = [];
  const uebersteuerbar = [];

  const hatTedavi = (positionen) =>
    normPositionen(positionen).some(p => TEDAVI_POSITIONEN.includes(p));

  // (a) 78030 an einem Tag, aber am SELBEN Tag keine 78010/78020.
  for (const tag of tage) {
    const pos = normPositionen(tag?.positionen);
    if (pos.includes(BEFUNDUNG) && !hatTedavi(pos)) {
      hart.push(
        `78030 (Befundung) am ${formatDatumKurz(tag?.datum)} ohne Behandlung 78010/78020 — nicht abrechenbar.`
      );
    }
  }

  // (b) 78040 irgendwo, aber KEIN Tag der ganzen Verordnung hat 78010/78020.
  const hatIrgendein78040 = tage.some(tag => normPositionen(tag?.positionen).includes(EINGANGSBEFUNDUNG));
  const hatIrgendeineTedavi = tage.some(tag => hatTedavi(tag?.positionen));
  if (hatIrgendein78040 && !hatIrgendeineTedavi) {
    uebersteuerbar.push(
      '78040 (Eingangsbefundung) in einer Verordnung ohne Behandlung 78010/78020 — nicht abrechenbar.'
    );
  }

  return { hart, uebersteuerbar };
}
