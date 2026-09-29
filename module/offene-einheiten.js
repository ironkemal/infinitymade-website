/**
 * offene-einheiten.js — Teilabrechnung einer podologischen Verordnung.
 *
 * Reform S2.3 (Kemal 28.09.2026, gkv-302 29.09.2026): Wer eine Verordnung mit
 * noch offenen Einheiten abrechnet, beendet sie. Die Restmenge lässt sich auf
 * dieser Verordnung weder erbringen noch abrechnen (Richtlinien § 302 § 7
 * Abs. 1, Podo-Anlage 3 p)/q); Korrekturverfahren UE Frage 1 — VKZ 02 rettet
 * das nicht). Deshalb nie ohne bewusste, protokollierte Bestätigung.
 *
 * Reine Funktionen, kein DOM. „Erbracht" = nicht stornierte Zeilen in
 * `podologie_behandlungen` — derselbe Zähler wie die automatische Bereit-
 * Markierung (podologie-abrechnung.js) und verordnung-status.routes.js.
 * Termine (`terminZaehler`) und HPNR-Summen sind KEIN Ersatz dafür.
 */

/**
 * @param {?number|string} verordnet  `prescriptions.behandlungseinheiten`
 * @param {number} erbracht           Anzahl nicht stornierter Behandlungen
 * @returns {number}  0, wenn die Menge unbekannt ist
 */
export function offeneEinheiten(verordnet, erbracht) {
  const v = Number(verordnet);
  if (!Number.isFinite(v) || v <= 0) return 0;
  const e = Math.max(0, Number(erbracht) || 0);
  return Math.max(0, v - e);
}

/**
 * Vorauswahl in der §302-Liste: eine Verordnung mit offenen Einheiten wird
 * nicht von selbst mitgenommen.
 */
export function vorausgewaehltPodo(zeile) {
  return !(Number(zeile?.offen) > 0);
}

/**
 * @param {Array<{id:string, patient?:string, nummer?:string, offen?:number}>} zeilen  gewählte Podo-Zeilen
 * @returns {Array<{id:string, patient:string, nummer:string, offen:number}>}
 */
export function offeneAuswahl(zeilen) {
  return (zeilen || [])
    .filter(z => Number(z?.offen) > 0)
    .map(z => ({ id: z.id, patient: z.patient || '—', nummer: z.nummer || '', offen: Number(z.offen) }));
}

/**
 * Text des Bestätigungsdialogs (freigegebener Wortlaut, gkv-302 29.09.2026).
 * „N Einheit(en)" bleibt bewusst so — kein Plural-Umbau.
 * @param {Array<{patient:string, nummer:string, offen:number}>} eintraege
 * @returns {{title:string, message:string, confirmText:string, cancelText:string}}
 */
export function bestaetigungsText(eintraege) {
  const liste = eintraege || [];
  const einzeln = liste.length <= 1;
  const kopf = einzeln ? '' : liste.map(e =>
    `${e.patient} · ${e.nummer}: ${e.offen} offen`).join('\n') + '\n\n';
  const koerper = einzeln
    ? `Es sind noch ${liste[0]?.offen ?? 0} Einheit(en) offen. `
    : 'Es sind noch Einheiten offen. ';
  return {
    title: 'Verordnung vorzeitig abrechnen?',
    message: kopf + koerper
      + 'Mit der Abrechnung wird die Verordnung beendet – die offenen Einheiten können auf dieser Verordnung nicht mehr erbracht oder abgerechnet werden. '
      + 'Bitte das Datum des Behandlungsabbruchs auf der Rückseite der Verordnung vermerken.'
      + '\n\nBereits erbrachte, aber noch nicht dokumentierte Einheiten bitte vorher nachtragen.',
    confirmText: 'Trotzdem abrechnen',
    cancelText: 'Abbrechen',
  };
}

/**
 * Fragt einmal für alle. Liefert die bestätigten Ids, `[]` wenn nichts offen
 * war, `null` bei Abbruch (oder wenn kein Dialog verfügbar ist — ohne Dialog
 * wird nie stillschweigend durchgewunken).
 * @param {Function} frage  showConfirmModal (Promise<boolean>)
 */
export async function frageOffeneEinheiten(zeilen, frage) {
  const offen = offeneAuswahl(zeilen);
  if (!offen.length) return [];
  if (typeof frage !== 'function') return null;
  const ok = await frage(bestaetigungsText(offen));
  return ok ? offen.map(e => e.id) : null;
}
