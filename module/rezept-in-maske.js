/**
 * rezept-in-maske.js — das gescannte Rezept landet in der Muster-13-Maske.
 *
 * Warum es das gibt
 * ─────────────────
 * Bis zum 06.09.2026 oeffnete ein Scan ein EIGENES Fenster
 * (`#rezeptConfirmModal`) mit einem zweiten Feldsatz und einem zweiten
 * Speicherweg. Ab hier gibt es nur noch eine Maske: was die KI gelesen hat,
 * wird in dieselbe Muster-13-Maske geschrieben, die auch von Hand gefuellt
 * wird — nur eben schon ausgefuellt.
 *
 * Diese Datei ist die Naht. Sie rechnet nichts aus und zeichnet kein Formular;
 * sie ruft in der richtigen Reihenfolge auf, was es schon gibt:
 *
 *   1. `oeffneMaske()`      — die Maske zuruecksetzen, oeffnen, Listen laden
 *   2. `fuelleMuster13()`   — der Verordnungsteil (module/verordnung-maske.js)
 *   3. Patientenkopf        — was auf dem Papier steht
 *   4. `patientAbgleich…()` — wem gehoert das Papier?
 *   5. Der Befund als Zeile unter dem Suchfeld
 *
 * Reihenfolge ist nicht beliebig: `openRezeptModal()` setzt ALLE Felder
 * zurueck (dashboard.js) — wer vorher fuellt, fuellt ins Nichts.
 *
 * Das Papier gewinnt gegen die Akte
 * ─────────────────────────────────
 * Wird ein bestehender Patient erkannt, wird sein Datensatz NICHT ueber den
 * Kopf gezogen. Auf dem Rezept steht, was der Arzt eingetragen hat — Kasse und
 * Versichertennummer koennen sich seit dem letzten Besuch geaendert haben, und
 * abgerechnet wird gegen das Papier. Dieselbe Regel wendet
 * `maskeEinbetten()` beim Bearbeiten an. Der Abgleich der Stammdaten passiert
 * spaeter und mit Rueckfrage (module/verordnung-patient-abgleich.js).
 */

import { fuelleMuster13, setzeScanHerkunft, setzePatientNeu } from './verordnung-maske.js?v=20260906';
import {
  ocrAlsVerordnung, ocrAlsPatientkopf, ocrAlsPatientensuche, patientAbgleichAusOcr,
} from './verordnung-aus-ocr.js?v=20260906';

const g = (id) => document.getElementById(id);

/** „Anna Bauer · 08.03.1975" — so steht ein Patient im Suchfeld. */
function patientLabel(lead) {
  const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim()
    || lead?.title || '';
  const geb = lead?.geburtsdatum || lead?.metadata?.geburtsdatum || '';
  return geb ? `${name} · ${geb}` : name;
}

/**
 * Die Zeile unter dem Suchfeld. Sie sagt, was mit dem Patienten passiert —
 * und zwar BEVOR gespeichert wird, nicht danach.
 *
 * Kemal, 06.09.2026: „illa soru sormasına gerek yok ama … çalışan görsün."
 * Deshalb fragt hier nichts nach; nur bei echter Mehrdeutigkeit haelt es an,
 * weil dann kein Vorschlag besser ist als der falsche.
 */
const BEFUND_TEXT = {
  gefunden:   { text: 'Bestehender Patient gefunden',              farbe: 'var(--success)' },
  mehrdeutig: { text: 'Mehrere Treffer — bitte Patient wählen',    farbe: 'var(--warning, #b45309)' },
  neu:        { text: 'Neuer Patient — wird beim Speichern angelegt', farbe: 'var(--warning, #b45309)' },
  unbekannt:  { text: 'Patient nicht erkannt — bitte wählen',      farbe: 'var(--warning, #b45309)' },
};

export function zeigePatientBefund(status, lead) {
  const hinweis = g('rzPatientHint');
  if (!hinweis) return;
  const eintrag = BEFUND_TEXT[status];
  if (!eintrag) { hinweis.textContent = ''; hinweis.style.color = ''; return; }
  hinweis.textContent = status === 'gefunden' && lead
    ? `${eintrag.text}: ${patientLabel(lead)}`
    : eintrag.text;
  hinweis.style.color = eintrag.farbe;
}

/**
 * Das Ergebnis eines Scans in die Maske uebernehmen.
 *
 * @param {object} payload  Antwort von `/rezept/upload`
 *                          (`{ parsed, storage_path, ocr_confidence, dataUri }`)
 * @param {object} deps
 * @param {() => Promise<void>} deps.oeffneMaske  `openRezeptModal(null, null)`
 * @param {() => Array}         deps.patienten    geladene Patienten der Praxis
 * @returns {Promise<{status:string, kandidaten:Array}>} der Patientenbefund
 */
export async function uebernehmeRezeptInMaske(payload, deps = {}) {
  const parsed = payload?.parsed || {};

  // 1. Maske aufmachen — setzt alle Felder zurueck und laedt die Listen.
  await deps.oeffneMaske?.();

  // 2. Der Verordnungsteil. `alsVorlage: false`, damit auch das LEERE
  //    ankommt: was die KI nicht gelesen hat, soll leer stehen und nicht der
  //    Rest einer vorherigen Eingabe sein.
  fuelleMuster13(ocrAlsVerordnung(parsed), { alsVorlage: false });

  // Beleg und Vertrauen an die Maske haengen — sie schreibt sie mit.
  // Erst hier, denn `oeffneMaske()` oben wirft die Herkunft weg.
  setzeScanHerkunft({
    storage_path: payload?.storage_path || null,
    ocr_confidence: payload?.ocr_confidence ?? null,
  });

  // 3. Der Patientenkopf — direkt vom Papier, nicht aus der Akte (siehe Kopf).
  for (const [id, wert] of Object.entries(ocrAlsPatientkopf(parsed))) {
    const el = g(id);
    if (el) el.value = wert;
  }

  // 4. Wem gehoert das Papier?
  const befund = patientAbgleichAusOcr(ocrAlsPatientensuche(parsed), deps.patienten?.() || []);
  const treffer = befund.status === 'gefunden' ? befund.kandidaten[0] : null;

  const idFeld = g('rzPatientId');
  if (idFeld) idFeld.value = treffer?.id || '';
  const suchFeld = g('rzPatientSearch');
  // Bei Mehrdeutigkeit bleibt das Feld leer: ein Name darin saehe aus wie eine
  // getroffene Entscheidung, und genau die steht ja noch aus.
  if (suchFeld) suchFeld.value = treffer ? patientLabel(treffer) : '';

  // Nur ein klares „neu" darf den Server anlegen lassen. Bei „mehrdeutig"
  // oder „unbekannt" waehlt erst der Mensch — sonst entstuende bei jedem
  // unsicheren Scan eine Karteileiche.
  setzePatientNeu(befund.status === 'neu');

  // 5. Das Foto dazu — korrigieren heisst vergleichen.
  zeigeScanBeleg(payload?.dataUri || null, payload?.ocr_confidence ?? null);

  // 6. Sagen, was passiert ist.
  zeigePatientBefund(befund.status, treffer);

  return befund;
}

// ─── Der Beleg: das Foto neben den Feldern ──────────────────────────────────
//
// Im alten Bestaetigungsfenster stand das Rezept links und die Felder rechts —
// wer korrigierte, verglich. Ohne das Bild muesste die Praxis zwischen Papier
// und Bildschirm hin und her schauen, obwohl das Foto schon im Programm ist.
//
// Der Streifen wird erzeugt, nicht ins Markup geschrieben: er gehoert nur zum
// gescannten Rezept. Von Hand eingetippt gibt es kein Bild, und ein leerer
// Rahmen saehe aus wie ein Fehler. Er lebt INNERHALB von `#rzMaskeWrap`, damit
// er den Umzug in die Seite mitmacht (module/verordnung-maske.js).

function belegEl() {
  let el = g('rzScanBeleg');
  if (el) return el;
  const wrap = g('rzMaskeWrap');
  if (!wrap) return null;
  el = document.createElement('div');
  el.id = 'rzScanBeleg';
  el.hidden = true;
  el.style.cssText = 'margin:0 0 12px;border:1px solid var(--border);border-radius:10px;'
    + 'background:var(--bg-card-solid);overflow:hidden;';
  el.innerHTML = `
    <button type="button" id="rzBelegKnopf" style="width:100%;display:flex;align-items:center;
      justify-content:space-between;gap:10px;padding:8px 12px;border:0;background:transparent;
      color:var(--text-main);font-size:12px;font-weight:600;cursor:pointer;">
      <span>Gescanntes Rezept</span>
      <span style="display:flex;align-items:center;gap:10px;">
        <span id="rzBelegVertrauen" style="font-weight:500;color:var(--text-muted);"></span>
        <span id="rzBelegPfeil" style="color:var(--text-muted);">▾</span>
      </span>
    </button>
    <div id="rzBelegBild" style="padding:0 12px 12px;">
      <img id="rzBelegImg" alt="Gescanntes Rezept"
        style="width:100%;max-height:42vh;object-fit:contain;border-radius:6px;background:#fff;">
    </div>`;
  wrap.insertBefore(el, wrap.firstChild);
  g('rzBelegKnopf')?.addEventListener('click', () => {
    const bild = g('rzBelegBild');
    if (!bild) return;
    const zu = bild.style.display === 'none';
    bild.style.display = zu ? '' : 'none';
    const pfeil = g('rzBelegPfeil');
    if (pfeil) pfeil.textContent = zu ? '▾' : '▸';
  });
  return el;
}

/**
 * Das Foto an die Maske haengen — oder den Streifen verstecken.
 *
 * @param {?string} dataUri     Bild aus dem Scan
 * @param {?number} vertrauen   `ocr_confidence` (0…1)
 */
export function zeigeScanBeleg(dataUri, vertrauen) {
  const el = belegEl();
  if (!el) return;
  if (!dataUri) { el.hidden = true; return; }
  const img = g('rzBelegImg');
  if (img) img.src = dataUri;
  const v = g('rzBelegVertrauen');
  if (v) {
    // Ein Prozentwert ohne Massstab sagt wenig — deshalb steht daneben, was er
    // fuer die Praxis bedeutet: gegenlesen oder durchwinken.
    v.textContent = vertrauen == null
      ? ''
      : `KI-Vertrauen ${Math.round(vertrauen * 100)}%${vertrauen < 0.8 ? ' — bitte gegenlesen' : ''}`;
    v.style.color = vertrauen != null && vertrauen < 0.8
      ? 'var(--warning, #b45309)' : 'var(--text-muted)';
  }
  el.hidden = false;
}

// ─── Nach dem Speichern: die Termine ────────────────────────────────────────
//
// Ein gescanntes Rezept endete bisher nicht beim Speichern, sondern im
// Kalender: das Bestaetigungsfenster sprang danach in die Terminplanung und
// legte die Serie an. Dieser Schritt gehoert zum Scan-Weg dazu — wer ein
// Rezept einscannt, will als naechstes Termine machen.
//
// Fuer die von Hand getippte Verordnung bleibt es beim alten Verhalten (Maske
// zu, fertig). Die Praxis kennt das so, und der Beschluss war, an der
// bewaehrten Handeingabe nichts zu aendern.

/** Zahl aus einem Feld — leer und Unsinn ergeben `null`, nicht `NaN`. */
function zahl(id) {
  const n = parseInt(g(id)?.value, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Die Vorgaben fuer das Buchungsfenster aus der Maske lesen.
 *
 * @param {{prescriptionId:string, patientId:?string}} gespeichert
 * @returns {object} Vorgabesatz, wie ihn `openBookingFromRxPreset` erwartet
 */
export function terminVorgabeAusMaske({ prescriptionId, patientId }) {
  const name = [g('rzPatVorname')?.value, g('rzPatName')?.value]
    .filter(Boolean).join(' ').trim();
  return {
    prescription_id: prescriptionId,
    patient_id: patientId || null,
    anzahl: zahl('rzAnzahl'),
    frequenz: g('rzFreq')?.value || null,
    heilmittel: g('rzHm')?.value || null,
    heilmittel_position: g('rzHmPosition')?.value || null,
    // Die Leistung waehlte frueher das Bestaetigungsfenster; in der Maske gibt
    // es dieses Feld (noch) nicht — das Buchungsfenster schlaegt dann selbst
    // eine passende vor, wie bei jedem anderen Termin auch.
    service_id: null,
    hausbesuch: !!g('rzHausbesuch')?.checked,
    is_dringend: !!g('rzDringend')?.checked,
    is_blanko: !!g('rzBlanko')?.checked,
    patient_name: name,
  };
}
