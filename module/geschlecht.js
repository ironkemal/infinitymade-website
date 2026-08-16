/**
 * geschlecht.js — die eine Stelle, an der das Geschlecht eines Patienten
 * kodiert, gelesen und beschriftet wird.
 *
 * Warum es das gibt
 * ─────────────────
 * `leads.geschlecht` ist seit jeher auf drei Werte begrenzt:
 *
 *     CHECK (geschlecht = ANY (ARRAY['m', 'f', 'd']))
 *
 * Nur wusste das nicht jeder Schreiber. Am 16.08.2026 lagen im Code drei
 * verschiedene Kodierungen nebeneinander, und zwei davon liefen in genau
 * diesen Constraint:
 *
 *   1. Die Schnellanlage (`#sfGeschlecht`) schrieb „männlich" / „weiblich" /
 *      „divers" ausgeschrieben. Jeder Patient, bei dem jemand das Geschlecht
 *      auswählte, liess sich nicht mehr anlegen — der INSERT scheiterte am
 *      CHECK, sichtbar nur als allgemeine Fehlermeldung.
 *   2. Die Rezept-OCR lieferte „w" für weiblich (deutsch gedacht), nicht „f".
 *      Damit scheiterte im KI-Rezept-Ablauf das Anlegen jeder Patientin.
 *   3. Die Therapeutinnen-Vorauswahl verglich `geschlecht === 'weiblich'` —
 *      ein Wert, den die Spalte nie enthalten kann. Der Zweig war tot, der
 *      Wunsch „bitte eine Behandlerin" wurde still ignoriert.
 *
 * Alle drei sind derselbe Fehler: Kodierung an der Verwendungsstelle geraten,
 * statt sie an einer Stelle festzulegen. Diese Datei ist diese Stelle.
 *
 * Warum `m` / `f` / `d` und nicht etwas Schöneres
 * ───────────────────────────────────────────────
 * Weil es der Bestand ist. Die Werte stehen im CHECK, in der Patientenakte
 * und in den vorhandenen Datensätzen. Sie zu ändern wäre eine Migration mit
 * Risiko und ohne Gewinn. `d` = divers deckt § 22 Abs. 3 PStG ab; „unbekannt"
 * ist NULL und braucht keinen eigenen Code — der CHECK lässt NULL ohnehin
 * durch, und ein Patient ohne Angabe ist der Normalfall.
 *
 * Für die Datenbank gilt bewusst weiter `text` + CHECK und kein ENUM: jede
 * andere begrenzte Spalte dieses Schemas (`status`, `rezept_typ`,
 * `insurance_type`, `fahrt_status`) ist so gebaut, und ein ENUM lässt sich
 * später nur umständlich erweitern. Konsistenz schlägt hier Reinheit
 * (db/README.md: „eine davon übernehmen, nichts Neues erfinden").
 *
 * Das Backend kann diese Datei nicht importieren — `api-backend/` ist ein
 * eigenes Docker-Image mit eigener COPY-Liste. Die gleiche Logik liegt dort
 * in `api-backend/lib/geschlecht.js`; wer hier etwas ändert, ändert es dort mit.
 */

/** Die einzigen erlaubten Werte in `leads.geschlecht`. NULL heisst „keine Angabe". */
export const GESCHLECHT_CODES = ['m', 'f', 'd'];

export const GESCHLECHT_LABELS = {
  m: 'männlich',
  f: 'weiblich',
  d: 'divers',
};

// Was aus der Welt hereinkommt, auf den Bestand abgebildet. Grosszügig, weil
// die Quellen sich nicht abstimmen: die OCR denkt deutsch („w"), Altformulare
// schrieben aus, Fremdsysteme liefern englisch.
const ALIASE = {
  m: 'm', maennlich: 'm', männlich: 'm', mann: 'm', male: 'm', herr: 'm', '1': 'm',
  f: 'f', w: 'f', weiblich: 'f', frau: 'f', female: 'f', '2': 'f',
  d: 'd', divers: 'd', x: 'd', other: 'd', anderes: 'd', '3': 'd',
};

/**
 * Bringt einen beliebigen Eingabewert auf `'m' | 'f' | 'd'` — oder `null`.
 *
 * `null` ist ausdrücklich ein gültiges Ergebnis und nicht als Fehler zu
 * behandeln: „keine Angabe" ist bei den meisten Patienten der Zustand. Was
 * hier `null` zurückgibt, darf so in die Datenbank; was einen Code
 * zurückgibt, überlebt den CHECK garantiert.
 *
 * **Jeder Schreibpfad auf `leads.geschlecht` muss hier durch.**
 */
export function normalisiereGeschlecht(wert) {
  if (wert == null) return null;
  const k = String(wert).trim().toLowerCase();
  if (!k) return null;
  return ALIASE[k] || null;
}

/** Anzeigetext für die Oberfläche. Ohne Angabe ein Gedankenstrich. */
export function geschlechtLabel(wert, leer = '—') {
  const code = normalisiereGeschlecht(wert);
  return code ? GESCHLECHT_LABELS[code] : leer;
}

/**
 * Briefanrede: „Frau" / „Herr" — oder Leerstring.
 *
 * Bei `d` und bei fehlender Angabe bewusst KEINE Anrede: der Aufrufer weicht
 * dann auf eine neutrale Begrüssung aus. Jemanden falsch anzureden ist der
 * schlechtere Fehler, und für „divers" gibt es keine etablierte Briefanrede.
 */
export function anredeFuerGeschlecht(wert) {
  const code = normalisiereGeschlecht(wert);
  if (code === 'f') return 'Frau';
  if (code === 'm') return 'Herr';
  return '';
}

/**
 * Optionen für ein `<select>`. Beide Geschlechtsfelder der Anwendung
 * (Patientenakte, Schnellanlage) werden hieraus gefüllt — vorher hatte jedes
 * seine eigene, handgeschriebene Liste, und genau da lief die Kodierung
 * auseinander.
 */
export function geschlechtOptionenHtml(gewaehlt = '', leerLabel = '— bitte wählen —') {
  const code = normalisiereGeschlecht(gewaehlt);
  return `<option value="">${leerLabel}</option>`
    + GESCHLECHT_CODES.map(c =>
      `<option value="${c}"${c === code ? ' selected' : ''}>${GESCHLECHT_LABELS[c]}</option>`
    ).join('');
}

/**
 * Füllt alle bekannten Geschlechts-Auswahlfelder aus derselben Quelle.
 * Einmal beim Start aufrufen; die Felder stehen in `dashboard.html`.
 */
export function fuelleGeschlechtSelects(ids = ['lead-geschlecht', 'sfGeschlecht']) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.tagName !== 'SELECT') return;
    const vorher = el.value;
    el.innerHTML = geschlechtOptionenHtml(vorher, id === 'sfGeschlecht' ? '— unbekannt —' : '— bitte wählen —');
  });
}
