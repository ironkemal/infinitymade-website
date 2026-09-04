/**
 * einreichbar.js — Darf diese Verordnung in eine §302-DTA-Datei?
 *
 * Warum eigenes Modul
 * ───────────────────
 * Die Antwort haengt an einem Zustandsmodell, das an zwei Stellen gebraucht
 * wird (Erzeugung der DTA-Datei, Statuswechsel von Hand) und das bisher an
 * keiner Stelle geprueft war. Am 28.08.2026 fiel auf: /abrechnung/create-podologie
 * nahm dieselben Verordnungs-Ids beliebig oft an und legte jedes Mal eine
 * weitere `abrechnung`-Zeile samt DTA-Datei an — ein doppelter Abrechnungsfall
 * bei der Kasse, ohne Fehlermeldung. Ausgeloest wurde das vom Zuhoerer-Fehler
 * in `module/podologie-abrechnung.js` (ein Klick, N Anfragen).
 *
 * Als Routenteil waere die Regel nicht pruefbar: die Routendatei baut beim
 * Laden einen Supabase-Client aus Umgebungsvariablen. Hier ist sie eine reine
 * Funktion und liegt neben ihrem Test, wie der Rest von billing/.
 *
 * Zustaende: siehe `billing/api/verordnung-status.routes.js` (UEBERGAENGE).
 */

/**
 * Zustaende, aus denen heraus eingereicht werden darf.
 *
 * 'abgesetzt' und 'teilabsetzung' stehen bewusst DRIN: nach einer Kassen-
 * rueckmeldung ist die Korrektur und die erneute Einreichung der vorgesehene
 * Weg, und die Arbeitsliste im Frontend bietet ihn absichtlich an
 * (`.in('status', ['aktiv','abrechenbar','abgesetzt','teilabsetzung'])`).
 *
 * 'abgerechnet' steht bewusst DRAUSSEN: dieser Zustand bedeutet „liegt bereits
 * in einer DTA-Datei". Ein zweites Mal einreichen hiesse denselben Fall zweimal
 * abrechnen.
 *
 * 'storniert' und 'archiviert' sind abgeschlossen.
 *
 * ⚠️ SPIEGEL: dieselbe Liste steht im Frontend in
 * `module/podologie-abrechnung.js` (`loadPodologieBilling`, `.in('status', …)`).
 * Zwei Deploys — Vercel dort, Docker hier —, ein gemeinsamer Import ginge nur
 * ueber einen Build-Schritt, den es nicht gibt. Wer eine aendert, aendert
 * BEIDE: sonst zeigt die Arbeitsliste eine Verordnung an, die hier beim
 * Abrechnen mit 409 zurueckgewiesen wird. (fonksiyon-ustasi, 28.08.2026)
 */
export const VERORDNUNG_EINREICHBAR = ['aktiv', 'abrechenbar', 'abgesetzt', 'teilabsetzung'];

/**
 * @param {string|null|undefined} status Wert aus `verordnungen.status`.
 * @returns {boolean}
 *
 * NULL zaehlt als 'aktiv': die Spalte hat zwar DEFAULT 'aktiv', ist aber
 * nullable. Eine alte Zeile ohne Status ist eine laufende Behandlung, keine
 * eingereichte — sie darf nicht an der Abrechnung gehindert werden.
 */
export function istEinreichbar(status) {
  return VERORDNUNG_EINREICHBAR.includes(status || 'aktiv');
}

/**
 * PostgREST-Filter fuer dasselbe, als atomarer Anspruch beim UPDATE benutzbar.
 * `.in()` allein traefe die NULL-Zeilen nicht.
 * @returns {string}
 */
export function einreichbarFilter() {
  return `status.in.(${VERORDNUNG_EINREICHBAR.join(',')}),status.is.null`;
}

// ── Seit 04.09.2026: EIN Verordnungstopf ────────────────────────────────────
//
// Podologie und Physio/Ergo/Logo stehen seit der Zusammenlegung der zwei
// Verordnungstöpfe in derselben Tabelle (`prescriptions`). Die Spalte heisst
// dort `abrechnung_status`, nicht `status`, und ihre Werte sind andere
// (bereit/in_abrechnung/gesendet/accepted/rejected/paid/…). Alles OBEN in
// dieser Datei — `VERORDNUNG_EINREICHBAR`, `istEinreichbar`,
// `einreichbarFilter` — spricht weiter die podologische Statusachse
// (aktiv/abrechenbar/abgesetzt/…), weil `/abrechnung/create-podologie` und
// die Frontend-Arbeitsliste sie so lesen und schreiben.
//
// SPIEGEL von `module/verordnung-topf.js` (`AUS_TOPF`/`statusAusTopf`) im
// Frontend-Repo. Zwei Deploys, kein gemeinsamer Import (der Docker-Build
// schliesst `module/` nicht ein) — wer eine Tabelle aendert, aendert beide.

/** alter verordnungen.status → prescriptions.abrechnung_status */
const NACH_ABRECHNUNG_STATUS = Object.freeze({
  aktiv: null, abrechenbar: 'bereit', abgerechnet: 'gesendet', abgesetzt: 'rejected',
  teilabsetzung: 'teilabsetzung', storniert: 'storniert', archiviert: 'archiviert',
});

/**
 * prescriptions.abrechnung_status → podologische Statusachse.
 *
 * Nicht die reine Umkehrung: `in_abrechnung`/`accepted`/`paid` gab es im
 * podologischen Zweig nie — sie bedeuten dort „ist raus", also `abgerechnet`.
 * Sie auf `aktiv` fallen zu lassen wäre der teure Fehler: eine bereits
 * eingereichte Verordnung stünde wieder in der Arbeitsliste.
 *
 * @param {string|null} abrechnungStatus
 * @returns {string}
 */
export function statusAusAbrechnungStatus(abrechnungStatus) {
  if (!abrechnungStatus) return 'aktiv';
  const AUS = {
    bereit: 'abrechenbar', in_abrechnung: 'abgerechnet', gesendet: 'abgerechnet',
    accepted: 'abgerechnet', paid: 'abgerechnet', rejected: 'abgesetzt',
    teilabsetzung: 'teilabsetzung', storniert: 'storniert', archiviert: 'archiviert',
  };
  return AUS[abrechnungStatus] || 'aktiv';
}

/**
 * Podologische Statusachse → prescriptions.abrechnung_status.
 * `undefined` heisst „nicht anfassen" — kein blindes `null` in ein UPDATE
 * schreiben, das eine bereits eingereichte Verordnung zurückholen würde.
 *
 * @param {?string} status
 * @returns {string|null|undefined}
 */
export function abrechnungStatusAusStatus(status) {
  if (status == null) return undefined;
  return Object.prototype.hasOwnProperty.call(NACH_ABRECHNUNG_STATUS, status)
    ? NACH_ABRECHNUNG_STATUS[status] : undefined;
}

/**
 * `einreichbarFilter()` auf die Spalte `abrechnung_status` übersetzt — für den
 * atomaren UPDATE-Anspruch in `/abrechnung/create-podologie` (die Tabelle
 * `prescriptions` kennt keine Spalte `status` in der podologischen Bedeutung
 * mehr, dort heisst die Bearbeitungsachse `status` UND meint etwas anderes).
 * @returns {string}
 */
export function einreichbarFilterAbrechnungStatus() {
  const werte = [...new Set(
    VERORDNUNG_EINREICHBAR.map(abrechnungStatusAusStatus).filter(v => v != null)
  )];
  return `abrechnung_status.in.(${werte.join(',')}),abrechnung_status.is.null`;
}
