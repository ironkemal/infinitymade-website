/**
 * rechte-ohne-standort.js — Reiter „Berechtigungen" der Mitarbeiterkarte, solange die
 * Praxis noch keinen Standort hat (O-251, Testbox 22.11.2026).
 *
 * Warum: Berechtigungen und Mitarbeiter-Login hängen an einer Zeile in
 * employee_business_assignments, also an einem Standort. Ohne Standort brach
 * loadEmpPermissions() still ab und der Reiter blieb auch für den Inhaber unsichtbar.
 * „Berechtigungen speichern" hätte ohnehin ins Leere geschrieben (braucht currentBusiness).
 * Melih 22.11.2026: Reiter für Inhaber in allen Paketen sichtbar, ohne Standort erklären
 * statt still verstecken — mit einem Knopf, der direkt zum Anlegen des Standorts führt.
 *
 * Reine DOM-Logik, keine Daten, kein Netz. dashboard.js ruft nur rechteReiterVorbereiten().
 */

export const HINWEIS_ID = 'empPermOhneStandort';
const MARKE = 'ohneStandort';

/**
 * Bereitet den Reiter vor. Mit Standort: Formular wie bisher (Rückgabe true → Aufrufer
 * lädt die Rechte). Ohne Standort: Reiter sichtbar, Formular aus, Hinweis an (false).
 * Blendet nur wieder ein, was es selbst ausgeblendet hat — `empStandortWrap` bleibt in
 * der Hand von renderEmpStandortList().
 *
 * @param {Document} doc
 * @param {{ hatStandort: boolean, onStandortAnlegen?: () => void }} o
 * @returns {boolean}
 */
export function rechteReiterVorbereiten(doc, { hatStandort, onStandortAnlegen }) {
  const inhalt = doc.getElementById('tab-permissions');
  if (!inhalt) return hatStandort;
  const formular = Array.from(inhalt.children).filter(el => el.id !== HINWEIS_ID);

  if (hatStandort) {
    doc.getElementById(HINWEIS_ID)?.remove();
    for (const el of formular) {
      const html = /** @type {HTMLElement} */ (el);
      if (html.dataset[MARKE] === '1') { html.hidden = false; delete html.dataset[MARKE]; }
    }
    return true;
  }

  const knopf = doc.getElementById('empTabPermissions');
  if (knopf) knopf.hidden = false;
  for (const el of formular) {
    const html = /** @type {HTMLElement} */ (el);
    if (!html.hidden) { html.hidden = true; html.dataset[MARKE] = '1'; }
  }
  if (!doc.getElementById(HINWEIS_ID)) {
    const hinweis = doc.createElement('div');
    hinweis.id = HINWEIS_ID;
    hinweis.className = 'form-group';
    hinweis.innerHTML = '<div class="form-hint" style="font-size:13px;color:var(--text-main);line-height:1.5;margin-bottom:10px;">'
      + 'Berechtigungen gelten immer für einen Standort. Ihre Praxis hat noch keinen Standort angelegt — '
      + 'deshalb kann sich dieser Mitarbeiter noch nicht anmelden. Legen Sie zuerst einen Standort an und '
      + 'speichern Sie danach hier die Berechtigungen — damit wird der Mitarbeiter dem Standort zugeordnet.</div>'
      + '<button class="btn-primary" type="button" data-standort-anlegen>Standort anlegen</button>';
    hinweis.querySelector('[data-standort-anlegen]')?.addEventListener('click', () => onStandortAnlegen?.());
    inhalt.prepend(hinweis);
  }
  return false;
}

/**
 * Springt zu Einstellungen → Geschäfte und öffnet dort das Formular „Neues Geschäft".
 * Ist der Abschnitt (paketbedingt) nicht sichtbar, bleibt es beim Sprung in die Einstellungen.
 *
 * @param {{ wechslePanel: (id: string) => unknown, doc?: Document, warte?: (ms: number) => Promise<void> }} o
 */
export async function standortAnlegenOeffnen({ wechslePanel, doc = document, warte = ms => new Promise(r => setTimeout(r, ms)) }) {
  await wechslePanel('settings');
  await warte(150); // renderBusinessesSection() läuft beim Panelwechsel asynchron
  const abschnitt = doc.getElementById('settingsBusinessesSection');
  if (!abschnitt || abschnitt.hidden) return false;
  abschnitt.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  /** @type {HTMLElement|null} */ (doc.getElementById('addBusinessBtn'))?.click();
  return true;
}
