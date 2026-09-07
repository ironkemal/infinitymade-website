/**
 * verordnung-maske.js — die Muster-13-Maske als EIN Exemplar, an zwei Orten.
 *
 * Befund (Kemal, 06.09.2026)
 * ──────────────────────────
 *   „Alt tarafta onunla alakalı daha detaylı bilgi açıyorum, burada hiçbir şey
 *    değiştiremiyorum ve hataların neyle alakalı olduğu yazmıyor. … Orada hani
 *    biz artı sembolüne bastığımızda gördüğümüz şeklin aynısını alt tarafta
 *    istiyoruz ve değiştirilebilir olsun."
 *
 * Die untere Hälfte der Seite „Verordnungen" zeigte die gespeicherte
 * Verordnung als Text: lesbar, aber nicht anfassbar. Wer einen Fehler sah,
 * musste ihn woanders korrigieren — und die Ausrufezeichen der Liste zeigten
 * ohnehin nur DASS etwas nicht stimmt, nicht WAS.
 *
 * Warum umziehen und nicht kopieren
 * ─────────────────────────────────
 * Die naheliegende Lösung wäre, das Muster-13-Markup ein zweites Mal in die
 * Seite zu schreiben. Das geht nicht: die Maske hängt an ihren IDs. Daran
 * hängen die Katalogsuchen (`DIAGNOSE_FIELDS` / `HEILMITTEL_FIELDS` in
 * dashboard.js, per Delegation auf `document`), die Kästchenlogik
 * (`wireM13Toggles`), die Patientensuche (module/rezept-patientenfeld.js),
 * `saveRezept()` und der Prüfknopf. Ein zweites Exemplar hiesse doppelte IDs —
 * `getElementById` trifft dann das erste, und die sichtbare Maske bliebe leer.
 * Zwei Exemplare hiessen ausserdem: jede künftige Änderung am Formular muss an
 * zwei Stellen gemacht werden, und eine davon wird vergessen.
 *
 * Deshalb wird der KNOTEN umgehängt. `#rzMaskeWrap` wohnt in `#rzMaskeHeim`
 * (dem Rumpf des Rezept-Modals) und zieht auf Anforderung in die untere Hälfte
 * der Verordnungsseite um. Es bleibt bei einem Exemplar, einer Verdrahtung,
 * einem Speicherweg.
 *
 * Die Brücke zu dashboard.js
 * ──────────────────────────
 * Ein paar Dinge kann nur `dashboard.js`: den Patientenkopf aus `leads` füllen,
 * die Kästchen der Leitsymptomatik setzen, die Frequenzliste bedienen. Diese
 * Funktionen sind dort nicht exportiert (die Datei ist ein Modul-Skript ohne
 * Exporte). Statt sie über `window` zu holen, meldet `dashboard.js` sie EINMAL
 * beim Start hier an — `setzeMaskeBruecke()`. Wer die Brücke nicht angemeldet
 * hat, bekommt eine leere Maske und keinen stillen Fehler.
 */

import { loescheMarkierungen } from './verordnung-feldmarker.js?v=20260906';
import { podoVerordnungsfelder, podoMaskeNachziehen } from './verordnung-podo.js?v=20260906';
import { verordnungFuerBackend, verordnungFuerAendern } from './verordnung-an-backend.js?v=20260907';
import { pruefeNeueMenge } from './verordnung-einheiten.js?v=20260902';

/**
 * Woher der Inhalt der Maske stammt, wenn er gescannt wurde.
 *
 * Ohne das ginge beim Zusammenlegen der beiden Masken etwas verloren, das
 * vorher da war: der zweite Speicherweg band das Foto ueber `storage_path` an
 * die Verordnung. Faellt er weg, haette eine gescannte Verordnung kein Bild
 * mehr — und der Beleg zur Abrechnung waere weg.
 *
 * `null` heisst: von Hand eingetippt (`quelle` bleibt dann `papier`).
 */
let _scanHerkunft = null;

/**
 * Die Herkunft setzen. Ruft `module/rezept-in-maske.js` nach dem Fuellen.
 * Immer NACH `maskeHeimschicken()`, das sie wieder verwirft.
 */
export function setzeScanHerkunft(herkunft) { _scanHerkunft = herkunft || null; }

/**
 * Die Maske hat „Neuer Patient" gemeldet — es gibt noch keine `patient_id`.
 *
 * Ohne diese Nachricht koennte eine gescannte Verordnung fuer einen
 * unbekannten Patienten gar nicht gespeichert werden: der Riegel in
 * `saveRezept()` verlangt eine Auswahl, und der Server suchte sonst doch
 * wieder selbst statt anzulegen.
 */
let _patientNeu = false;
export function setzePatientNeu(neu) { _patientNeu = !!neu; }
export function istPatientNeu() { return _patientNeu; }

/** Woher der Inhalt stammt — `null` heisst: von Hand eingetippt. */
export function scanHerkunft() { return _scanHerkunft; }

/** Der aktuell in der Maske bearbeitete Datensatz — `null` heisst „neu". */
let _bearbeitung = null;   // siehe maskeEinbetten()

/** Von `dashboard.js` angemeldete Helfer, siehe Kopf. */
let _bruecke = null;

/**
 * Die Helfer aus `dashboard.js` anmelden. Einmal beim Start.
 *
 * @param {object} b
 * @param {(leadId:string)=>Promise<void>} b.fuellePatient   `fillRzPatientFromLead`
 * @param {(prefix:string,code:any,text:any,boxes?:any)=>void} b.lsApply
 * @param {(key:string)=>void} b.setTherapiebereich          `setM13Therapy`
 * @param {(ja:boolean)=>void} b.setHausbesuch               `setM13Hausbesuch`
 * @param {(id:string,wert:string)=>void} b.setFrequenz      `setFreqValue`
 */
export function setzeMaskeBruecke(b) { _bruecke = b || null; }

/** Die id der gerade bearbeiteten Verordnung — `saveRezept()` fragt hier. */
export function bearbeitungsId() { return _bearbeitung?.id || null; }

/** Der ganze Bearbeitungszustand (für Sonderfälle wie `heilmittel_items`). */
export function bearbeitung() { return _bearbeitung; }

/**
 * Hat jemand in der eingebetteten Maske etwas geändert und noch nicht
 * gespeichert?
 *
 * Wichtig für die Aufrufer, die die untere Hälfte von SELBST neu zeichnen —
 * `module/verordnung-liste.js` tut das, sobald irgendwo ein Termin gebucht,
 * verschoben oder zugeordnet wird (`bookings:changed`, auch über die
 * Realtime-Verbindung, also durch eine ANDERE Person). Ein Neuzeichnen
 * überschreibt die Maske mit dem Stand aus der Datenbank; wer gerade tippt,
 * verliert seine Eingabe, ohne dass etwas passiert wäre, das ihn betrifft.
 */
export function istVeraendert() { return _bearbeitung?.veraendert === true; }

/** Steht die Maske gerade in der Seite statt im Modal? */
export function istEingebettet() {
  const wrap = document.getElementById('rzMaskeWrap');
  return !!wrap && wrap.parentElement?.id !== 'rzMaskeHeim';
}

/* ═══════════════════════════════════════════════════════════════════════════
   Umzug
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Die Maske zurück ins Modal holen.
 *
 * Wird von `openRezeptModal()` als ERSTES aufgerufen. Ohne das öffnete sich
 * ein leeres Modal, sobald die Maske gerade unten in der Seite stand — und
 * genau dieser Weg ist der häufige: erst eine Verordnung aufschlagen, dann
 * „+ Neue Verordnung" drücken.
 */
export function maskeHeimschicken() {
  const wrap = document.getElementById('rzMaskeWrap');
  const heim = document.getElementById('rzMaskeHeim');
  _bearbeitung = null;
  _scanHerkunft = null;
  _patientNeu = false;
  // Der Belegstreifen gehoert zum Scan. Wer die Maske von Hand oeffnet,
  // soll nicht das Foto der vorherigen Verordnung sehen.
  const beleg = document.getElementById('rzScanBeleg');
  if (beleg) beleg.hidden = true;
  if (!wrap || !heim) return;
  hinweisEntfernen();
  loescheMarkierungen(wrap);
  document.getElementById('rzPruefErgebnis')?.style.setProperty('display', 'none');
  const abbrechen = document.getElementById('rzAbbrechenBtn');
  if (abbrechen) abbrechen.hidden = false;
  const speichern = document.getElementById('rzSaveBtn');
  if (speichern) { speichern.disabled = false; speichern.title = ''; }
  if (wrap.parentElement !== heim) heim.appendChild(wrap);
}

/**
 * Die Maske in einen Bereich der Seite holen und mit einer gespeicherten
 * Verordnung füllen.
 *
 * @param {object} opt
 * @param {HTMLElement} opt.host   Zielbereich (bekommt die Maske angehängt).
 * @param {object} opt.rx          Zeile aus `prescriptions`, ROH (Spaltennamen
 *                                 der Tabelle, nicht die podologischen Aliase).
 * @returns {Promise<boolean>}     `false`, wenn die Maske nicht da ist.
 */
export async function maskeEinbetten({ host, rx }) {
  const wrap = document.getElementById('rzMaskeWrap');
  if (!wrap || !host || !rx?.id) return false;

  _bearbeitung = {
    id: rx.id,
    therapieBereich: rx.therapie_bereich || '',
    hatItems: Array.isArray(rx.heilmittel_items) && rx.heilmittel_items.length > 0,
    belegnummer: rx.belegnummer || null,
    abrechnungStatus: rx.abrechnung_status || null,
    // Wie viele Einheiten schon geleistet sind — der Riegel gegen „weniger
    // verordnet als erbracht" (siehe `pruefeNeueMenge`).
    erbracht: erbrachteEinheiten(rx),
    anzahl: rx.anzahl_einheiten ?? null,
    riegel: schreibRiegel(rx),
  };

  host.appendChild(wrap);

  // Im Modal beendet „Abbrechen" die Eingabe. In der Seite gäbe es nichts zu
  // schliessen — der Knopf würde nur so aussehen, als täte er etwas.
  const abbrechen = document.getElementById('rzAbbrechenBtn');
  if (abbrechen) abbrechen.hidden = true;

  hinweisSetzen(_bearbeitung);

  // Eine bereits eingereichte Verordnung wird nicht mehr geändert — der Knopf
  // verschwindet nicht, er sagt warum. Verschwände er, hielte man die Maske
  // für kaputt.
  const speichern = document.getElementById('rzSaveBtn');
  if (speichern) {
    speichern.disabled = !!_bearbeitung.riegel;
    speichern.title = _bearbeitung.riegel || '';
  }

  // Erst der Patientenkopf (er überschreibt Kasse/Vers.-Nr. aus der Akte),
  // danach die Werte der Verordnung — die stehen auf dem Papier und haben
  // Vorrang vor dem, was in der Akte gepflegt ist.
  if (rx.patient_id && _bruecke?.fuellePatient) {
    try { await _bruecke.fuellePatient(rx.patient_id); }
    catch (e) { console.warn('[verordnung-maske] Patientenkopf:', e?.message); }
  }
  fuelleMuster13(rx, { alsVorlage: false });
  // Die podologische Feinschliff-Automatik haengt sonst am `hidden` des
  // Modals — das springt hier nie um. Ohne diesen Anstoss blieben die
  // podologischen Felder in der eingebetteten Maske unsichtbar.
  podoMaskeNachziehen();

  // Erst NACH dem Füllen scharf schalten — die Zuweisungen oben lösen selbst
  // `input`-Ereignisse aus (die Katalogsuchen feuern sie), und die zählen
  // nicht als Änderung durch den Anwender.
  _bearbeitung.veraendert = false;
  if (!wrap.dataset.aenderungWachtEcht) {
    wrap.dataset.aenderungWachtEcht = '1';
    const merken = () => { if (_bearbeitung) _bearbeitung.veraendert = true; };
    wrap.addEventListener('input', merken, true);
    wrap.addEventListener('change', merken, true);
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Riegel
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Abrechnungsstände, ab denen die Verordnung dem Haus nicht mehr allein
 * gehört. Spiegel der Zuordnung in `module/verordnung-topf.js` (AUS_TOPF):
 * alles, was dort „abgerechnet", „storniert" oder „archiviert" ergibt.
 */
const EINGEREICHT = Object.freeze([
  'in_abrechnung', 'gesendet', 'accepted', 'paid', 'storniert', 'archiviert',
]);

/**
 * Darf diese gespeicherte Verordnung über die Maske noch geändert werden?
 *
 * Bis heute gab es diesen Weg nicht — `saveRezept()` legte nur an, und die
 * einzige nachträgliche Änderung war die verordnete Menge im podologischen
 * Zweig (module/verordnung-einheiten.js) mit genau diesem Riegel davor. Mit
 * einer editierbaren Maske ist plötzlich JEDES Feld änderbar, also muss der
 * Riegel mit: eine Verordnung, die schon bei der Kasse war, wird nicht
 * rückwirkend umgeschrieben.
 *
 * ⚠️ Wie dort gilt: in der Datenbank hält das NICHTS auf. Ein Riegel im
 * Browser ist eine Hilfe für den Anwender, keine Sicherung.
 *
 * @param {object} rx  Zeile aus `prescriptions`
 * @returns {string|null}  Grund der Sperre, sonst `null`
 */
export function schreibRiegel(rx) {
  if (!rx) return 'Verordnung nicht gefunden.';
  // Die eingefrorene Belegnummer ist das härtere Signal: sie wird bei der
  // DTA-Erzeugung EINMAL vergeben (Anlage 1 TP5 V21 Kap. 7.3) und danach nie
  // wieder geändert. Ein Status lässt sich zurücksetzen, diese Nummer nicht.
  if (rx.belegnummer) {
    return `Diese Verordnung wurde bereits an die Kasse übermittelt (Beleg ${rx.belegnummer}) — `
         + 'ihre Angaben sind festgeschrieben.';
  }
  if (EINGEREICHT.includes(rx.abrechnung_status)) {
    return `Diese Verordnung steht auf „${rx.abrechnung_status}" — sie lässt sich nicht mehr ändern.`;
  }
  return null;
}

/** Wie viele Einheiten sind schon geleistet? Beide Zweige zählen anders. */
function erbrachteEinheiten(rx) {
  if (Array.isArray(rx?.podologie_behandlungen)) return rx.podologie_behandlungen.length;
  if (Array.isArray(rx?.prescription_sessions)) {
    return rx.prescription_sessions.filter(s => s.status === 'done' || s.status === 'completed').length;
  }
  return 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Befüllen
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Der Klartext des Heilmittels, wenn die Spalte leer ist.
 *
 * Die podologische Maske schreibt das verordnete Heilmittel nach
 * `heilmittel_items` (jsonb) und lässt `heilmittel` leer — dieselbe Fundstelle
 * wie in `voAusGespeicherterVerordnung()` (module/verordnung-pruefung.js).
 */
function heilmittelAusItems(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return items
    .map(i => (typeof i === 'string' ? i : (i?.bezeichnung || i?.code || '')))
    .filter(Boolean)
    .join(' · ');
}

function erstePositionAusItems(items) {
  if (!Array.isArray(items) || !items.length) return '';
  const erste = items[0];
  return (typeof erste === 'string' ? erste : erste?.code) || '';
}

/**
 * Eine Verordnungszeile in die Muster-13-Felder schreiben.
 *
 * Hierher gezogen aus `uebernimmVerordnung()` (module/termin-aktionen.js), das
 * dieselbe Abbildung schon seit dem 17.08.2026 enthielt — es gibt sie jetzt
 * einmal statt zweimal. Der Unterschied zwischen beiden Verwendungen steckt in
 * `alsVorlage`:
 *
 *   `alsVorlage: true`   Folgeverordnung. Datum, Unterschrift und Zuzahlung
 *                        gehören zum neuen Papier und werden NICHT übernommen.
 *   `alsVorlage: false`  Dieselbe Verordnung wird bearbeitet — alles kommt mit.
 *
 * @param {object} rx  Zeile aus `prescriptions` (rohe Spaltennamen)
 * @param {{alsVorlage?:boolean}} [opt]
 */
export function fuelleMuster13(rx, opt = {}) {
  if (!rx) return;
  const alsVorlage = opt.alsVorlage !== false;
  const g = (id) => document.getElementById(id);
  // Bei einer Vorlage werden nur gefüllte Werte gesetzt (die Maske ist frisch
  // zurückgesetzt); beim Bearbeiten muss auch ein LEERER Wert ankommen, sonst
  // bliebe der Rest der vorherigen Verordnung stehen.
  const setz = (id, wert) => {
    const el = g(id);
    if (!el) return;
    if (alsVorlage) { if (wert != null && wert !== '') el.value = wert; }
    else el.value = wert == null ? '' : wert;
  };
  const haken = (id, wert) => { const el = g(id); if (el) el.checked = !!wert; };

  setz('rzArztName', rx.aerzte?.arzt_name || '');
  setz('rzLanr', rx.doctor_lanr || rx.aerzte?.lanr || '');
  setz('rzBsnr', rx.doctor_bsnr || rx.aerzte?.bsnr || '');
  setz('rzIcd', rx.icd10 || '');
  setz('rzDiagnoseText', rx.diagnose_freitext || '');
  setz('rzDg', rx.diagnosegruppe || '');
  _bruecke?.lsApply?.('rz', rx.leitsymptomatik || null, rx.pat_leitsymptomatik || null);
  setz('rzHm', rx.heilmittel_feld_text || rx.heilmittel || heilmittelAusItems(rx.heilmittel_items));
  setz('rzHmPosition', rx.heilmittel_position || erstePositionAusItems(rx.heilmittel_items));
  setz('rzAnzahl', rx.vorrangig_einheiten || rx.anzahl_einheiten || '');
  setz('rzHmErg', rx.ergaenzendes_heilmittel || '');
  setz('rzAnzahlErg', rx.ergaenzend_einheiten || '');
  setz('rzHinweise', rx.hinweise || '');
  _bruecke?.setFrequenz?.('rzFreq', rx.frequenz || '');
  _bruecke?.setTherapiebereich?.(rx.therapie_bereich || '');
  _bruecke?.setHausbesuch?.(!!rx.hausbesuch);
  haken('rzDringend', rx.is_dringend);
  haken('rzBlanko', rx.is_blanko);
  haken('rzLhbBvb', rx.is_lhb_bvb);
  haken('rzBerichtAngefordert', rx.bericht_angefordert);
  // Zuzahlungsbefreiung ist eine Eigenschaft des Patienten im laufenden Jahr,
  // nicht des Papiers — sie darf auch in eine Folgeverordnung mit.
  haken('rzZuzahlungBefreit', rx.zuzahlung_befreit);

  if (alsVorlage) return;

  // Nur beim Bearbeiten: was zu DIESEM Papier gehört.
  setz('rzPatientId', rx.patient_id || '');
  setz('rzAusstDate', rx.ausstellungsdatum || '');
  setz('rzZuzahlung', rx.zuzahlung_eur ?? '');
  setz('rzBerichtStatus', rx.bericht_status || 'offen');
  // Podologische Zusatzangaben — die Felder legt module/verordnung-podo.js
  // an, sobald der Bereich auf Podologie steht. Steht er nicht darauf,
  // greift `setz` ins Leere und tut nichts.
  setz('rzPodoNagel', rx.nagel || '');
  setz('rzPodoWagner', rx.wagner_grad == null ? '' : String(rx.wagner_grad));
  setz('rzPodoAnlass', rx.behandlungsanlass || '');
  haken('rzUnterschrift', rx.unterschrift_vorhanden);
  // Die Kasse der Verordnung schlägt die aus der Akte: auf dem Papier steht,
  // wer damals zuständig war.
  if (rx.kostentraeger_ik) setz('rzPatKasseIk', rx.kostentraeger_ik);
  if (rx.versichertennummer) setz('rzPatVersNr', rx.versichertennummer);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Modushinweis
   ═══════════════════════════════════════════════════════════════════════════ */

const HINWEIS_ID = 'rzModusHinweis';

function hinweisEntfernen() {
  document.getElementById(HINWEIS_ID)?.remove();
}

/**
 * Eine Zeile über der Maske, die sagt, was „Speichern" hier bedeutet.
 *
 * Ohne sie sieht die eingebettete Maske exakt aus wie die zum Anlegen — und
 * niemand könnte erkennen, ob der Knopf eine zweite Verordnung erzeugt oder
 * die vorhandene ändert.
 */
function hinweisSetzen(zustand) {
  hinweisEntfernen();
  const wrap = document.getElementById('rzMaskeWrap');
  if (!wrap) return;

  const el = document.createElement('div');
  el.id = HINWEIS_ID;
  el.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;'
    + 'margin:0 0 12px;padding:8px 12px;border-radius:8px;'
    + 'border:1px solid var(--border);background:var(--bg-card);'
    + 'font-size:12px;color:var(--text-muted);';

  let text = zustand?.riegel
    ? zustand.riegel
    : 'Gespeicherte Verordnung — „Speichern" schreibt die Änderungen zurück.';
  // Der einzige Teil der Verordnung, den diese Maske NICHT führt: die
  // podologischen Positionen (78xxx) liegen in `heilmittel_items` und werden
  // beim Speichern hier bewusst nicht angefasst. Das gehört gesagt, sonst hält
  // man das Heilmittelfeld für die Abrechnungsgrundlage — ist es dort nicht.
  if (zustand?.hatItems) {
    text += ' Die podologischen Positionen (78xxx) bleiben unverändert — '
          + 'sie werden in der Podologie-Abrechnung gepflegt.';
  }
  el.textContent = text;
  wrap.insertBefore(el, wrap.firstChild);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Schreiben
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Darf gerade geschrieben werden? Beide Riegel in einem Griff.
 *
 * Wird von `saveRezept()` als ERSTES gerufen, vor der Rückfrage nach den
 * leeren Pflichtfeldern — eine gesperrte Verordnung soll gar nicht erst nach
 * fehlenden Angaben gefragt werden.
 *
 * @returns {string|null}  Grund, warum nicht — sonst `null`.
 */
export function pruefeAenderungErlaubt() {
  if (!_bearbeitung) return null;                 // Anlegen ist immer erlaubt
  if (_bearbeitung.riegel) return _bearbeitung.riegel;

  const roh = document.getElementById('rzAnzahl')?.value;
  const neu = parseInt(roh, 10);
  if (!Number.isFinite(neu) || neu === _bearbeitung.anzahl) return null;
  // Weniger verordnen als schon erbracht wurde, ergäbe eine Verordnung, die
  // mehr geleistet hat als verordnet war — in der Abrechnung eine Absetzung.
  // Derselbe Riegel wie beim Ändern der Menge in der Leseansicht.
  return pruefeNeueMenge(neu, _bearbeitung.erbracht);
}

/**
 * Die Felder der Maske als Nutzlast für `prescriptions`.
 *
 * Stand bis zum 06.09.2026 als Objektliteral mitten in `saveRezept()`. Hierher
 * gezogen, weil dieselbe Abbildung jetzt zwei Ziele hat (anlegen und
 * zurückschreiben) und weil `dashboard.js` nicht wächst (Konsey 2026-08-13).
 *
 * Was NICHT drinsteht, steht mit Absicht nicht drin:
 *   `status`     — über den Bearbeitungsstand entscheidet der Ablauf,
 *                  nicht dieses Formular.
 *   `owner_id`   — gehört zum Anlegen, nicht zum Ändern.
 *   `heilmittel_items` — die podologischen Positionen (78xxx) werden in der
 *                  Podologie-Abrechnung gepflegt; ein Muster-13-Feld kann eine
 *                  mehrzeilige Positionsliste nicht abbilden und würde sie
 *                  beim Speichern auf eine Zeile eindampfen.
 *
 * @param {object} v  Was `dashboard.js` schon ausgerechnet hat
 */
/**
 * Die Felder des Patientenkopfes, so wie sie in der Maske stehen.
 * Der Server bekommt sie, um einen unbekannten Patienten anzulegen.
 */
export function patientkopfAusMaske() {
  const kopf = {};
  for (const id of ['rzPatVorname', 'rzPatName', 'rzPatGeb', 'rzPatVersNr', 'rzPatStatus',
                    'rzPatKasse', 'rzPatKasseIk', 'rzPatStrasse', 'rzPatOrt', 'rzArztName']) {
    kopf[id] = document.getElementById(id)?.value || '';
  }
  return kopf;
}

export function nutzlastAusMaske(v) {
  const el = (id) => document.getElementById(id);
  const txt = (id) => (el(id)?.value || '').trim();
  const an = (id) => !!el(id)?.checked;

  return {
    patient_id: v.patientId,
    arzt_id: v.arztId,
    ausstellungsdatum: v.ausstDate,
    icd10: v.icd10,
    gueltig_bis: v.gueltigBis,
    anzahl_einheiten: v.anzahl,
    is_dringend: v.isDringend,
    doctor_lanr: v.lanr,
    doctor_bsnr: v.bsnr,
    leitsymptomatik: v.leitsymptomatik?.code ?? null,
    pat_leitsymptomatik: v.leitsymptomatik?.patText ?? null,
    diagnosegruppe: txt('rzDg') || null,
    heilmittel: txt('rzHm') || null,
    heilmittel_position: txt('rzHmPosition') || null,
    frequenz: txt('rzFreq') || null,
    hausbesuch: an('rzHausbesuch'),
    is_blanko: an('rzBlanko'),
    is_lhb_bvb: an('rzLhbBvb'),
    zuzahlung_befreit: an('rzZuzahlungBefreit'),
    zuzahlung_eur: parseFloat(el('rzZuzahlung')?.value) || null,
    bericht_angefordert: an('rzBerichtAngefordert'),
    bericht_status: el('rzBerichtStatus')?.value || 'offen',
    diagnose_freitext: txt('rzDiagnoseText') || null,
    ergaenzendes_heilmittel: txt('rzHmErg') || null,
    ergaenzend_einheiten: parseInt(txt('rzAnzahlErg'), 10) || null,
    therapie_bereich: txt('rzTherapieBereich') || null,
    hinweise: txt('rzHinweise') || null,
    unterschrift_vorhanden: an('rzUnterschrift'),
    kostentraeger_ik: txt('rzPatKasseIk') || null,
    // Podologische Zusatzangaben (nagel/wagner_grad/behandlungsanlass).
    // Ausserhalb der Podologie ein leeres Objekt — die Spalten bleiben
    // unberuehrt. Bis zum 06.09.2026 fuellte sie nur das getrennte
    // Formular der Abrechnungsseite; `nagel` ist abrechnungsrelevant
    // (§ 3b lit. a, Erstbefundung je Nagelspangen-Serie).
    ...podoVerordnungsfelder(),
    // Gescannt? Dann gehoeren Beleg, Vertrauen und Herkunft dazu — sonst
    // bleibt `quelle` auf dem Vorgabewert `papier`.
    ..._scanHerkunft ? {
      image_storage_path: _scanHerkunft.storage_path || null,
      ocr_confidence: _scanHerkunft.ocr_confidence ?? null,
      quelle: 'ocr',
    } : {},
  };
}

/**
 * Anlegen oder zurückschreiben — je nachdem, ob die Maske gerade eine
 * gespeicherte Verordnung meint.
 *
 * @returns {Promise<{id:string, aktualisiert:boolean}>}
 * @throws bei Datenbankfehler oder wenn die Zeilensicherheit den Schreibzugriff
 *   verweigert.
 */
/**
 * Schickt den Rumpf zum Server — gemeinsame Stelle fuer ANLEGEN
 * (`POST /rezept/confirm`) und AENDERN (`PATCH /rezept/:id`, Ops #289).
 * Beide brauchen dieselbe Session-/Adress-Pruefung und denselben Fehlerpfad;
 * eine zweite Kopie hiesse, dass eine kuenftige Korrektur (z.B. Timeout,
 * anderer Fehlertext) nur in einer der beiden Routen ankommt.
 *
 * Ein Netzfehler MUSS durchschlagen. Faellt der Server aus, darf die Maske
 * nicht „gespeichert" melden — sonst tippt die Praxis eine Verordnung ab,
 * die nirgends steht. (onprem O-44, Auflage 3.)
 */
async function sendeAnServer(supabase, { methode, pfad, rumpf }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Nicht angemeldet');
  const basis = _bruecke?.apiBasis;
  if (!basis) throw new Error('Keine API-Adresse angemeldet (setzeMaskeBruecke)');

  const antwort = await fetch(`${basis}${pfad}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify(rumpf),
  });
  let json = null;
  try { json = await antwort.json(); } catch { /* kein JSON — gleich unten */ }
  if (!antwort.ok || !json?.success) {
    throw new Error(json?.error || `Speichern fehlgeschlagen (${antwort.status})`);
  }
  return json;
}

export async function schreibeVerordnung(supabase, v) {
  const nutzlast = nutzlastAusMaske(v);
  // `proceed_anyway` merkt sich, dass jemand über Lücken hinweg gespeichert
  // hat. Beim Zurückschreiben darf ein sauberer Durchlauf diese Spur nicht
  // löschen — sie gehört zum Vorgang, nicht zum letzten Klick.
  const editId = _bearbeitung?.id || null;
  if (v.overridden || !editId) nutzlast.proceed_anyway = !!v.overridden;

  if (!editId) {
    // ANLEGEN laeuft seit dem 06.09.2026 ueber den Server — derselbe Weg, den
    // der Scan schon immer ging. Nur dort wird ein unbekannter Patient
    // angelegt, das Foto an die Verordnung gehaengt und festgehalten, dass
    // jemand ueber Warnungen hinweg gespeichert hat. (Beschluss 06.09.2026;
    // onprem O-44, guvenlik S-18.)
    const rumpf = verordnungFuerBackend({
      nutzlast, patientFelder: patientkopfAusMaske(),
      patientNeu: _patientNeu, scan: _scanHerkunft, overridden: !!v.overridden,
    });
    const json = await sendeAnServer(supabase, { methode: 'POST', pfad: '/rezept/confirm', rumpf });
    return { id: json.prescription_id, aktualisiert: false, patientId: json.patient_id || null };
  }

  // AENDERN laeuft seit Ops #289 auch ueber den Server — derselbe Grund wie
  // bei ANLEGEN, nur nachgezogen: bis dahin schrieb dieser Zweig direkt aus
  // dem Browser nach Supabase, geschuetzt allein durch die Zeilensicherheit.
  const rumpf = verordnungFuerAendern({
    nutzlast, patientFelder: patientkopfAusMaske(), overridden: !!v.overridden,
  });
  const json = await sendeAnServer(supabase, { methode: 'PATCH', pfad: `/rezept/${editId}`, rumpf });
  _bearbeitung.anzahl = nutzlast.anzahl_einheiten;
  // Gespeichert heisst: die Maske und die Datenbank sagen wieder dasselbe —
  // ein Neuzeichnen von aussen darf jetzt wieder durch (siehe `istVeraendert`).
  _bearbeitung.veraendert = false;
  return { id: editId, aktualisiert: true, patientId: json.patient_id || null };
}
