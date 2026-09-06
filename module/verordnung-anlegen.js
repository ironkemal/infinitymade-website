/**
 * verordnung-anlegen.js — „wie soll die Verordnung ins Programm kommen?"
 *
 * Warum es das gibt
 * ─────────────────
 * Es gibt drei Wege, eine Verordnung zu erfassen: fotografieren, eine Datei
 * hochladen, oder von Hand eintippen. Zwei davon standen im Scan-Fenster, der
 * dritte hing an einer ganz anderen Stelle — und im Seitenbereich des Termins
 * gab es ueberhaupt keinen Weg: stand dort schon eine Verordnung, fehlte der
 * Knopf zum Anlegen komplett (`rendereVeroKarten` zeichnete ihn nur im leeren
 * Fall, und der Seitenbereich reichte `onAnlegen` gar nicht erst durch).
 *
 * Kemal, 06.09.2026: der „+" gehoert dorthin, ob eine Verordnung da ist oder
 * nicht — und dahinter dieselben drei Wege, die am Ende ohnehin in derselben
 * Maske landen.
 *
 * Diese Datei haelt nur die WAHL. Was die drei Wege dann tun, bleibt beim
 * Aufrufer: fotografieren und hochladen fuehren in den OCR-Pfad
 * (`dashboard.js`), von Hand fuehrt in die Muster-13-Maske. Der Patient wird
 * dabei durchgereicht, damit „von Hand" nicht wieder bei der leeren
 * Patientensuche anfaengt — er steht ja schon fest, wenn man aus dem Termin
 * kommt.
 */

/** Patient, fuer den die Wahl geoeffnet wurde — `null` heisst „noch offen". */
let _leadId = null;

const g = (id) => document.getElementById(id);

/**
 * Die Wahl oeffnen.
 *
 * @param {?string} leadId  Patient aus dem Zusammenhang (Termin, Akte) oder
 *                          `null`, wenn ohne Bezug angelegt wird.
 */
export function oeffneAnlegenWahl(leadId = null) {
  _leadId = leadId || null;
  const fehler = g('rxScanError');
  if (fehler) fehler.style.display = 'none';
  const wahl = g('rxScanChooser');
  if (wahl) wahl.style.display = '';
  const kamera = g('rxScanCamera');
  if (kamera) kamera.style.display = 'none';
  const arbeit = g('rxScanProcessing');
  if (arbeit) arbeit.style.display = 'none';
  const modal = g('rezeptScanModal');
  if (modal) modal.hidden = false;
}

/** Die Wahl schliessen. Der gemerkte Patient bleibt — der naechste Weg braucht ihn. */
export function schliesseAnlegenWahl() {
  const modal = g('rezeptScanModal');
  if (modal) modal.hidden = true;
}

/** Der Patient, fuer den die Wahl zuletzt geoeffnet wurde. */
export function anlegenFuerLead() { return _leadId; }

/**
 * Den dritten Weg verdrahten: „von Hand eintippen".
 *
 * @param {(leadId:?string)=>void} oeffneMaske  meist `openRezeptModal(null, id)`
 */
export function verdrahteAnlegenWahl(oeffneMaske) {
  g('rxScanManuellBtn')?.addEventListener('click', () => {
    schliesseAnlegenWahl();
    oeffneMaske(_leadId);
  });
}
