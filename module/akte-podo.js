/**
 * akte-podo.js — die Patientenakte in der Podologie: 11 Reiter → 6 (Reform S4, Paket 3).
 *
 * Warum es das gibt
 * ─────────────────
 * Konsey S0 (30.09.2026): die Akte hatte elf gleichgewichtete Reiter, von denen ein
 * Podologe die Hälfte nie öffnet (Messreihen, Überweisung als eigener Reiter,
 * Mail …). Podologie zeigt jetzt sechs:
 *
 *   Verlauf · Anamnese · Fußbefund · Verordnungen · Dokumente · Rechnungen
 *
 * NICHTS wird gelöscht. Die Reiter, die entfallen, sind ihrem Zweck nach
 * eingezogen — ihre Panels ziehen als aufklappbare Abschnitte um:
 *
 *   Notizen                              → Abschnitt unter dem Verlauf
 *   Termine (inkl. Abgesagte-Schalter)   → Abschnitt unter dem Verlauf
 *   Einwilligungen · Überweisung · Mail  → Reiter „Dokumente"
 *   Rezepte                              → Reiter „Verordnungen" (dasselbe Panel, andere Beschriftung)
 *   Messreihen                           → in der Podologie ausgeblendet (physio-Sache)
 *
 * Das Umziehen ist reines DOM-Verschieben derselben Elemente: ihre `id`s bleiben,
 * die vorhandenen Lader in dashboard.js (`loadPatientDetailNotes` …) füllen sie
 * unverändert. Es gibt keine zweite Lade-Logik.
 *
 * Physio · Ergo · Logo: Verhalten unverändert. Der Plan unten liefert für sie
 * exakt die frühere Sichtbarkeit (Rezepte + Messreihen sichtbar, Fußbefund weg).
 *
 * Dazu die zwei Kopf-Knöpfe „+ Termin" / „+ Verordnung" (nur Podologie), die
 * die vorhandenen Abläufe mit vorgewähltem Patienten öffnen.
 */

'use strict';

/** Reiter in der Podologie, in Anzeige-Reihenfolge. */
export const PODO_AKTE_REITER = ['verlauf', 'anamnese', 'fussbefund', 'rezepte', 'dokumente', 'rechnungen'];

/** Alle Reiter der Akte (Werte von `data-tab`). */
const ALLE_REITER = ['verlauf', 'notes', 'anamnese', 'einwilligung', 'ueberweisung', 'rezepte',
  'messreihen', 'fussbefund', 'dokumente', 'rechnungen', 'termine', 'mail'];

/**
 * Welche Reiter sind sichtbar, wie heisst „rezepte"?
 * Rein, ohne DOM — die Tabelle, die der Test festnagelt.
 *
 * @param {{isPhysio:boolean, isPodo:boolean}} f  Fachbereich (`isPhysio` = Praxis-Sektor wie bisher)
 * @returns {{sichtbar: Record<string,boolean>, rezepteText: string}}
 */
export function akteReiterPlan({ isPhysio, isPodo }) {
  const sichtbar = {};
  for (const t of ALLE_REITER) sichtbar[t] = true;
  if (isPodo) {
    // Nur die sechs. Alles andere entfällt als Reiter (Panels ziehen um, s. Kopf).
    for (const t of ALLE_REITER) sichtbar[t] = PODO_AKTE_REITER.includes(t);
  } else {
    // Bisheriges Verhalten (dashboard.js vor S4 P3): Rezepte/Messreihen nur Physio, Fußbefund nur Podo.
    sichtbar.rezepte = !!isPhysio;
    sichtbar.messreihen = !!isPhysio;
    sichtbar.fussbefund = false;
    sichtbar.dokumente = false;
  }
  return { sichtbar, rezepteText: isPodo ? 'Verordnungen' : 'Rezepte' };
}

/**
 * Wohin zieht welches Panel in der Podologie? [Panel-Id, Ziel-Container-Id].
 * Die Container stehen in dashboard.html (`hidden`, bis sie hier freigegeben werden).
 */
export const PODO_PANEL_UMZUG = [
  ['pdPanelNotes',        'pdVerlaufNotizenHost'],
  ['pdPanelTermine',      'pdVerlaufTermineHost'],
  ['pdPanelEinwilligung', 'pdDokEinwilligungHost'],
  ['pdPanelUeberweisung', 'pdDokUeberweisungHost'],
  ['pdPanelMail',         'pdDokMailHost'],
];
/** Die Abschnitts-Hüllen (`<details hidden>`), die für die Podologie sichtbar werden. */
const PODO_ABSCHNITTE = ['pdVerlaufNotizenBox', 'pdVerlaufTermineBox', 'pdDokEinwilligungBox', 'pdDokUeberweisungBox', 'pdDokMailBox'];

/**
 * Reiter, Beschriftung und Panel-Standorte für den Fachbereich setzen.
 * Idempotent — wird bei jedem Öffnen der Akte gerufen.
 *
 * @param {{isPhysio:boolean, isPodo:boolean}} f
 * @param {Document} [doc]
 */
export function setzeAkteReiter(f, doc = document) {
  const plan = akteReiterPlan(f);
  for (const tab of ALLE_REITER) {
    const btn = doc.querySelector(`.pd-tab[data-tab="${tab}"]`);
    if (btn) btn.style.display = plan.sichtbar[tab] ? '' : 'none';
  }
  const rez = doc.querySelector('.pd-tab[data-tab="rezepte"]');
  if (rez) rez.textContent = plan.rezepteText;

  // canli-test P1 30.09: `isPhysio` ist in der Podologie ebenfalls wahr (PRAXIS_SECTORS),
  // `loadPatientDetailRezepte` zeichnete deshalb die Physio-Liste unter die Karten —
  // dieselben Verordnungen doppelt, mit §302-Knöpfen. In der Podologie bleibt sie weg
  // (der Lader setzt nur `hidden`; `display:none !important` hält dagegen).
  for (const id of ['pdRezContent', 'pdRezLoading']) {
    const e = doc.getElementById(id);
    if (!e?.style) continue;
    if (f.isPodo) e.style.setProperty('display', 'none', 'important');
    else e.style.removeProperty('display');
  }

  if (!f.isPodo) return;

  // Panels einmalig umziehen. `pd-panel` → `pd-unter`: als Abschnitt gibt es kein
  // „aktives Panel", sie sind sichtbar, sobald ihr <details> offen ist.
  for (const [panelId, zielId] of PODO_PANEL_UMZUG) {
    const panel = doc.getElementById(panelId);
    const ziel = doc.getElementById(zielId);
    if (!panel || !ziel || panel.parentElement === ziel) continue;
    panel.classList.remove('pd-panel', 'active');
    panel.classList.add('pd-unter');
    ziel.appendChild(panel);
  }
  for (const id of PODO_ABSCHNITTE) {
    const box = doc.getElementById(id);
    if (box) box.hidden = false;
  }

  // „Verordnungen": das Rezepte-Panel hat für Physio einen Spinner + Liste, die es in
  // der Podologie nicht gibt (`loadPatientDetailRezepte` läuft dort nicht). Spinner weg,
  // Leer-Hinweis frei (er blendet sich per CSS aus, sobald die Übersicht Karten hat).
  const spin = doc.getElementById('pdRezLoading');
  if (spin) spin.hidden = true;
  const leer = doc.getElementById('pdRezLeer');
  if (leer) leer.hidden = false;
  const kopf = doc.getElementById('pdKopfAktionen');
  if (kopf) kopf.hidden = false;
}

/**
 * Kopf-Knöpfe „+ Termin" / „+ Verordnung" verdrahten (einmal, beim Start).
 *
 * @param {object} deps
 * @param {()=>?string} deps.leadId               aktuell geöffneter Patient
 * @param {(id:string)=>void} deps.closeModal
 * @param {(startStr:?string)=>Promise} deps.prefillBookingModal   dashboard.js — öffnet die Terminmaske leer
 * @param {(leadId:?string)=>void} deps.oeffneAnlegenWahl          Rezept-Anlegen-Wahl (Scan / Foto / von Hand)
 * @param {Document} [doc]
 */
export function verdrahteAkteKopf(deps, doc = document) {
  doc.getElementById('pdKopfTerminBtn')?.addEventListener('click', async () => {
    const id = deps.leadId();
    if (!id) return;
    deps.closeModal('patientDetailModal');
    // Dieselbe Terminmaske wie „Neuer Termin" im Kalender; der Patient wird über die
    // vorhandene Bruecke `_bkApplyLead` gesetzt (Name, Telefon, Hausbesuch, Verordnungskarten).
    await deps.prefillBookingModal(null);
    globalThis._bkApplyLead?.(id);
  });
  doc.getElementById('pdKopfVerordnungBtn')?.addEventListener('click', () => {
    const id = deps.leadId();
    if (!id) return;
    deps.closeModal('patientDetailModal');
    deps.oeffneAnlegenWahl(id);
  });
}
