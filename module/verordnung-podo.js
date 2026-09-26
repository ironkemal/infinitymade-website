/**
 * verordnung-podo.js — Podologie-Feinschliff der Muster-13-Maske (`rezeptModal`).
 *
 * Herkunft
 * ────────
 * Ops-Karte „Verordnung: vier Felder automatisch füllen + Eingaben prüfen"
 * (Bildschirmfreigabe Beta-2, 12.08.2026). Neuer Code kommt in eine neue
 * Datei — `dashboard.js` wächst nicht mehr (Konsey 2026-08-13).
 *
 * Geltungsbereich
 * ───────────────
 * ALLES hier greift ausschliesslich, wenn im Formular oben rechts
 * „Podologische Therapie" angekreuzt ist (`rzTherapieBereich === 'podo'`).
 * Physio/Ergo/Logo/Ernährung bleiben unberührt — die Kataloge, ICD-Kodes und
 * Höchstmengen dieser Bereiche sind andere. Wird der Bereich umgestellt,
 * werden alle Eingriffe zurückgenommen (`_aufraeumen`).
 *
 * Quellenlage — jede Regel unten ist belegt, nichts ist geraten
 * ─────────────────────────────────────────────────────────────
 * [Q1] HeilM-RL i. d. F. vom 15.05.2025, iK 05.08.2025 — Heilmittelkatalog
 *      Teil II „Massnahmen der Podologischen Therapie", Diagnosegruppen
 *      DF (S. 73), NF (S. 74), QF (S. 75), UI 1 (S. 76), UI 2 (S. 77).
 *      Datei: `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt`
 * [Q2] Anlage 3 (notwendige Angaben auf der Heilmittelverordnung)
 *      i. d. F. vom 16.06.2025 zum Vertrag nach § 125 Abs. 1 SGB V Podologie,
 *      Abschnitt 3 e) „Dringlicher Behandlungsbedarf" und f)
 *      „Behandlungseinheiten". Datei:
 *      `wissensbank/podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:390-435`
 * [Q3] Anlage 1a Leistungsbeschreibung i. d. F. vom 17.06.2024, Teil 2
 *      Nr. 4.2 „Podologische Befundung" (78030). Datei:
 *      `wissensbank/podologie/20240725_Anlage_1a_Leistungsbeschreibung_lesefassung_b.txt:475-492`
 *
 * Was NICHT hier steht
 * ────────────────────
 * Die Befund-Position (78030/78040) wird bewusst nicht in das Heilmittelfeld
 * der Verordnung geschrieben — siehe Kommentar bei `POD_BEFUND_HINWEIS`.
 */

import { parseIcdList, dgsAcceptingIcd } from '../icd-dg-match.js?v=20260810e';
import { behandlungsbeginnFrist, BEHANDLUNGSBEGINN_TAGE } from './heilmittel-fristen.js?v=20260814';
import { NAGEL_WERTE, nagelLabel } from './eingangsbefundung-regel.js?v=20260920s';
import { sitzungsplan } from './sitzungsplan.js?v=20260914';
import { TOPF } from './verordnung-topf.js?v=20260920t';
import { POD_KATALOG, POD_HOECHSTMENGE, POD_ORIENTIEREND, dgWurzel } from './verordnung-regeln.js?v=20260918';

// [Q1] Heilmittelkatalog Podologische Therapie, Höchstmenge und orientierende
// Menge je Diagnosegruppe stehen zentral in `verordnung-regeln.js` — dort
// steht auch die Quellenlage (Q1) und die Warnung zur Abrechnungsseite
// (78020 „gross" erst bei Therapiezeit >20 Min, FAK Podologie Q25).

// Die 14/28-Tage-Frist ist NICHT podologiespezifisch: [Q2] Abschnitt 3 e)
// wiederholt nur HeilM-RL § 15, der im allgemeinen Teil steht. Sie wohnt
// deshalb in `heilmittel-fristen.js` und gilt für alle Fachbereiche.
//
// ⚠ Begriffsschärfung gegenüber der Ops-Karte: Das sind keine
// Gültigkeitsfristen der Verordnung, sondern Fristen für den
// BEHANDLUNGSBEGINN. Wird die Frist versäumt, verliert die Verordnung ihre
// Gültigkeit — das Ergebnis ist dasselbe, die Beschriftung im Formular muss
// aber ehrlich sein, sonst dokumentieren wir eine Frist, die es nicht gibt.

// [Q3] Anlage 1a Teil 2 Nr. 4.2, „Besonderheiten": Die podologische
// Befundung (78030) erfolgt „bei Massnahmen der Podologie in den
// Diagnosegruppen DF, NF und QF im Vorfeld JEDER Behandlung" (Ausnahme:
// Eingangsbefundung 78040).
//
// Daraus folgt der Umgang mit Beta-2s Wunsch „Befund kommt immer mit":
// Der Befund ist KEIN vom Arzt verordnetes Heilmittel und steht nicht auf
// Muster 13 — er ist eine Leistung, die wir erbringen und abrechnen. In das
// Feld „verordnetes Heilmittel" gehört er deshalb nicht; dort würde er die
// Verordnung inhaltlich falsch machen. Die Automatik dafür existiert bereits
// an der richtigen Stelle: in der Podologie-Abrechnung wird 78030 bei allen
// Diagnosegruppen ausser UI1/UI2 vorangekreuzt (dashboard.js, `podHpnrChecks`).
// Hier zeigen wir nur den Hinweis, damit in der Verordnungsmaske sichtbar ist,
// was später mitläuft.
const POD_BEFUND_HINWEIS =
  'Podologische Befundung (78030) läuft bei DF/NF/QF vor jeder Behandlung mit — '
  + 'wird in der Abrechnung automatisch gesetzt, nicht auf der Verordnung.';

// Bei UI1/UI2 ist 78030 nicht abrechenbar (FAK Podologie #11) — dann kein Hinweis.
const POD_BEFUND_DGS = ['DF', 'NF', 'QF'];

const $ = (id) => document.getElementById(id);

/**
 * Podologie-Modus des Formulars. Der Bereich hängt an den Ankreuzfeldern oben
 * rechts im Muster 13 (`setM13Therapy` schreibt ihn in das versteckte Feld).
 */
function istPodo() {
  return ($('rzTherapieBereich')?.value || '') === 'podo';
}

// ─── Der Block unter der Heilmitteltabelle ──────────────────────────────────
//
// Kemal, 18.09.2026: „bir Heilmittel seçildikten sonra sayfanın uzayıp …
// gelmesi lazım" — die Podologie-Zeilen (Angaben, Sitzungsplan, Hinweise)
// müssen die Maske verlängern, nicht in ihr stecken bleiben.
//
// Ursache, warum sie es bisher nicht taten: alle drei hingen an
// `$('rzAnzahl').closest('div').parentElement` — das ist die ERSTE
// `.m13-hmline`, ein Raster mit zwei Spalten (`1fr 96px`). Jedes angehängte
// Element wurde damit zur dritten, vierten, fünften Rasterzelle und landete
// abwechselnd in der breiten und in der 96 px schmalen Spalte. Sie stehen jetzt
// in EINEM Block direkt hinter `.m13-hmtable`, über die volle Breite.
//
// Die Reihenfolge (Angaben → Sitzungsplan → Hinweise) legt `order` fest, nicht
// die Reihenfolge der Erzeugung — die hing bisher davon ab, welcher Zweig von
// `aktualisieren()` zuerst lief.

const REIHENFOLGE = { rzPodoFelder: 1, rzPodoSitzungsplan: 2, rzPodoHinweis: 3 };

function blockEl() {
  let el = $('rzPodoBlock');
  if (el) return el;
  const tabelle = $('rzHm')?.closest('.m13-hmtable');
  if (!tabelle) return null;
  el = document.createElement('div');
  el.id = 'rzPodoBlock';
  el.style.cssText = 'display:flex;flex-direction:column;';
  tabelle.after(el);
  return el;
}

/** Hängt ein Element in den Block und setzt seine Position darin. */
function inBlock(el) {
  const block = blockEl();
  if (!block) return false;
  el.style.order = String(REIHENFOLGE[el.id] ?? 9);
  block.appendChild(el);
  return true;
}

// ─── Anzeigezeile unter dem Formular ────────────────────────────────────────
// Ein einziger Hinweisstreifen für alle Meldungen dieses Moduls, damit die
// Maske nicht mit fünf Warnzeilen zugestellt wird.

function hinweisEl() {
  let el = $('rzPodoHinweis');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'rzPodoHinweis';
  el.style.cssText = 'font-size:11px;line-height:1.5;margin-top:6px;color:var(--text-muted);';
  return inBlock(el) ? el : null;
}

function zeigeHinweise(zeilen) {
  const el = hinweisEl();
  if (!el) return;
  const sichtbar = zeilen.filter(Boolean);
  el.innerHTML = sichtbar
    .map(z => `<div style="color:${z.farbe || 'var(--text-muted)'};">${z.text}</div>`)
    .join('');
  el.style.display = sichtbar.length ? 'block' : 'none';
}

// ─── 1. Leitsymptomatik a/b/c → verordnetes Heilmittel ──────────────────────
//
// Die Ankreuzfelder tragen dieselben Buchstaben wie der OCR-Pfad
// (`api-backend/ai/tasks/rezept-ocr.js:28-30`, `leitsymptomatik_boxes`) —
// kein zweites Schema.
//
// Das Feld FOLGT den Ankreuzfeldern, solange es uns gehört: umgehakt heisst
// neuer Text, abgehakt heisst leer. Sobald der Anwender selbst tippt, geben
// wir das Feld ab und fassen es nicht mehr an — auf dem Papier steht, was der
// Arzt verordnet hat, und das gewinnt immer gegen unsere Ableitung. Zurück
// bekommen wir es erst, wenn er es wieder leert.

function gewaehlteLeitsymptome() {
  return ['a', 'b', 'c'].filter(b => $(`rzLs${b.toUpperCase()}`)?.checked);
}

// ─── 1b. Leitsymptomatik-Kästchen beschriften ───────────────────────────────
//
// Kemal, 18.09.2026: Muster 13 zeigt an den Kästchen nur „a b c" — welches
// davon die Komplexbehandlung ist, sieht man nicht, obwohl das System sie
// selbst automatisch ins Heilmittelfeld schreibt (`leitsymptomatikAnwenden()`
// unten). Hier wird NUR angezeigt, was dort ohnehin schon steht — derselbe
// `POD_KATALOG`, kein zweites Wörterbuch.
//
// UI 1 / UI 2 kennen laut Katalog nur a); b) und c) werden dort versteckt
// statt eine Ankreuzung zuzulassen, die laut `leitsymptomatikAnwenden()`
// ohnehin zur Fehlermeldung („kennt nur die Leitsymptomatik a)") führt —
// verstecken ist ehrlicher als anklickbar lassen und dann meckern.

/** Setzt den sichtbaren Text NACH dem Kästchen, ohne Checkbox/Span anzufassen. */
function _lsLabelText(label, text) {
  let textNode = Array.from(label.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
  if (!textNode) {
    textNode = document.createTextNode('');
    label.appendChild(textNode);
  }
  textNode.textContent = ` ${text}`;
}

function leitsymptomatikBeschriften() {
  const podo = istPodo();
  const root = podo ? dgWurzel($('rzDg')?.value) : null;
  const katalog = root ? POD_KATALOG[root] : null;

  for (const buchstabe of ['a', 'b', 'c']) {
    const cb = $(`rzLs${buchstabe.toUpperCase()}`);
    const label = cb?.closest('label.m13-th');
    if (!cb || !label) continue;

    // Physio/Ergo/Logo, oder Podologie ohne (erkannte) Diagnosegruppe: der
    // Katalog ist unbekannt — Originalbeschriftung, nichts verstecken.
    if (!podo || !katalog) {
      label.style.display = '';
      _lsLabelText(label, buchstabe);
      continue;
    }

    const text = katalog[buchstabe];
    if (!text) {
      label.style.display = 'none';
      if (cb.checked) cb.checked = false;   // sonst bliebe ein verstecktes Kreuz aktiv
      continue;
    }
    label.style.display = '';
    _lsLabelText(label, `${buchstabe}) ${text}`);
  }
}

/**
 * Schreibt in ein Feld, ohne dass der eigene input-Wächter das als Handeingabe
 * missversteht. Ohne diese Klammer löschte der Wächter die `auto`-Markierung
 * beim ersten eigenen Schreibvorgang — das Feld galt sofort als „vom Anwender
 * angefasst" und die Automatik war nach einem einzigen Treffer tot.
 */
function schreibe(el, wert) {
  el.dataset.podSchreibt = '1';
  el.value = wert;
  if (wert) el.dataset.auto = '1'; else delete el.dataset.auto;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  delete el.dataset.podSchreibt;
}

/**
 * Heilmittel-Text UND Positionsnummer gemeinsam leeren. Beide werden immer
 * im selben Schritt gesetzt (s. `leitsymptomatikAnwenden()`) — wird der Text
 * ungültig (Ankreuzung passt nicht mehr zur Diagnosegruppe, DG geleert), darf
 * die zuvor abgeleitete Position nicht überleben. Eine verwaiste 78010 ist
 * eine falsche Nummer, die genau in die Zuzahlung einfliesst.
 */
function raeumeHmUndPosition(hm) {
  schreibe(hm, '');
  const pos = $('rzHmPosition');
  if (pos) pos.value = '';
}

/**
 * @returns {{farbe?:string,text:string}|null} Meldung, falls die Ankreuzung
 *          nicht zum Katalog der gewählten Diagnosegruppe passt.
 */
function leitsymptomatikAnwenden() {
  const hm = $('rzHm');
  if (!hm || !istPodo()) return null;

  const root = dgWurzel($('rzDg')?.value);
  const katalog = POD_KATALOG[root];
  const gewaehlt = gewaehlteLeitsymptome();

  // Das Feld gehört uns nur, wenn es leer ist oder zuletzt von uns kam.
  const unser = !hm.value.trim() || hm.dataset.auto === '1';

  // Nichts angekreuzt → unser Eintrag verschwindet wieder. Genau das ist
  // gemeint mit „nochmal auf c drücken und es ist weg".
  if (gewaehlt.length === 0) {
    if (unser && hm.value) raeumeHmUndPosition(hm);
    return null;
  }

  // Ohne Diagnosegruppe wissen wir nicht, aus welchem Katalog wir schöpfen —
  // ein zuvor von uns abgeleitetes Heilmittel+Position ist jetzt ungültig.
  if (!katalog) {
    if (unser && hm.value) raeumeHmUndPosition(hm);
    return null;
  }

  // [Q1] UI 1 und UI 2 kennen nur eine Leitsymptomatik a). b) oder c) gibt es
  // dort nicht — das ist keine stille Nicht-Ableitung, sondern ein Fehler auf
  // der Verordnung, der zur Absetzung führt.
  const fremd = gewaehlt.filter(b => !katalog[b]);
  if (fremd.length && !katalog.c) {
    if (unser && hm.value) raeumeHmUndPosition(hm);
    return {
      farbe: 'var(--danger,#ef4444)',
      text: `${root} kennt nur die Leitsymptomatik a) — ${fremd.map(b => b + ')').join(' und ')} `
          + 'gibt es in dieser Diagnosegruppe nicht.',
    };
  }

  // Mehrfachankreuzung: In DF/NF/QF ist „a und b" genau das, was der Katalog
  // als c) „Hyperkeratose und pathologisches Nagelwachstum" führt — also die
  // Komplexbehandlung.
  let buchstabe = gewaehlt[0];
  let meldung = null;
  if (gewaehlt.includes('c')) {
    buchstabe = 'c';
    // c) deckt a) und b) bereits ab; zusätzlich angekreuzt ist es redundant.
    if (gewaehlt.length > 1) {
      meldung = { text: 'c) umfasst a) und b) bereits — die zusätzlichen Kreuze ändern nichts.' };
    }
  } else if (gewaehlt.length > 1) {
    if (katalog.c) {
      buchstabe = 'c';   // a + b = Komplexbehandlung
    } else {
      if (unser && hm.value) raeumeHmUndPosition(hm);
      return {
        farbe: 'var(--danger,#ef4444)',
        text: `Mehrere Leitsymptomatiken angekreuzt — ${root} hat dafür kein eigenes Heilmittel.`,
      };
    }
  }

  const text = katalog[buchstabe];
  if (!text) return meldung;

  // Handeingabe gewinnt: nicht überschreiben, aber sagen, dass wir etwas
  // anderes abgeleitet hätten — sonst merkt niemand den Widerspruch.
  if (!unser) {
    return hm.value.trim() === text ? meldung : {
      text: `Aus der Leitsymptomatik ${buchstabe}) folgt „${text}" — das Heilmittelfeld wurde von Hand geändert.`,
    };
  }

  // [gkv-302, 18.09.2026] a)/b) sind laut FAK Podologie Q25 IMMER 78010 —
  // 78020 ist dort nie abrechenbar, also keine Vermutung, sondern die einzig
  // mögliche Nummer. c) „Podologische Komplexbehandlung" bleibt offen: ob
  // 78010 oder 78020 gilt, entscheidet die Therapiezeit am Behandlungstag
  // (>20 Min), nicht die Verordnung — siehe sitzungsplan.js:38-43.
  const hpnrSicher = (buchstabe === 'a' || buchstabe === 'b') && POD_BEFUND_DGS.includes(root);
  if (hm.value !== text) {
    schreibe(hm, text);
    const pos = $('rzHmPosition');
    if (pos) pos.value = hpnrSicher ? '78010' : '';
  }
  if (buchstabe === 'c' && !meldung) {
    meldung = { text: '„Podologische Komplexbehandlung": Position steht erst am Behandlungstag fest — '
      + '78010 bis 20 Minuten Therapiezeit, sonst 78020 (FAK Podologie Q25).' };
  }
  return meldung;
}

// ─── 1c. Heilmittelfeld-Dropdown: Katalogtexte neben den Positionsnummern ───
//
// Kemal, 18.09.2026: „sistemde komplex var ama dropdownda yok". Das Feld
// `rzHm` bekam bisher nur die HPNR-Liste (78010, 78020, 78030 …) aus dem
// Leistungskatalog, während `leitsymptomatikAnwenden()` den Text des
// HeilM-RL-Katalogs („Podologische Komplexbehandlung") hineinschrieb — zwei
// verschiedene Wörterbücher im selben Feld: das System konnte „Komplex"
// schreiben, der Anwender konnte es nicht wählen.
//
// Die drei Zeilen kommen VOR die HPNR-Liste (`extraItems` in katalog-suche.js)
// und sind kein zweiter Schreibweg: Wahl = Kästchen a)/b)/c) ankreuzen, den
// Rest schreibt weiterhin allein `leitsymptomatikAnwenden()`.

/**
 * Katalogzeilen für das `rzHm`-Dropdown. Leer ausserhalb der Podologie oder
 * ohne erkannte Diagnosegruppe — ohne Katalog gibt es nichts vorzuschlagen.
 */
export function heilmittelKatalogVorschlaege() {
  if (!istPodo()) return [];
  const katalog = POD_KATALOG[dgWurzel($('rzDg')?.value)];
  if (!katalog) return [];
  return Object.entries(katalog).map(([buchstabe, label]) => ({
    __ls: buchstabe, code: '', label, kuerzel: buchstabe.toUpperCase(),
  }));
}

/**
 * Eine Katalogzeile wurde im Dropdown gewählt: Kästchen ankreuzen, fertig.
 *
 * Das Feld wird vorher geleert (und nicht mit dem Text vorbelegt), weil
 * `leitsymptomatikAnwenden()` die Positionsnummer nur schreibt, wenn sich der
 * Text ändert — stünde er schon da, bliebe bei a)/b) die 78010 aus. Ein leeres
 * Feld ist ausserdem immer „unser", die Automatik übernimmt es also ohne
 * Handeingabe-Warnung.
 *
 * @param {'a'|'b'|'c'} buchstabe
 */
function leitsymptomatikAusDropdownWaehlen(buchstabe) {
  const hm = $('rzHm');
  const kaestchen = $(`rzLs${String(buchstabe).toUpperCase()}`);
  if (!hm || !kaestchen) return;
  schreibe(hm, '');
  if (!kaestchen.checked) {
    kaestchen.checked = true;
    kaestchen.dispatchEvent(new Event('change', { bubbles: true }));   // AUSLOESER → lauf()
  } else if (_lauf) {
    setTimeout(_lauf, 0);   // schon angekreuzt: Automatik trotzdem neu anstossen
  }
}

/**
 * 78020 („Behandlung groß") ist nur bei c) Komplexbehandlung abrechenbar; bei
 * a)/b) ist es immer 78010, auch über 20 Minuten (FAK Podologie Q25). Wer 78020
 * trotzdem aus der HPNR-Liste wählt, bekommt einen Hinweis — keinen Block: die
 * Verordnung trägt keine Therapiezeit, endgültig entscheidet die Abrechnung
 * (`module/podologie-abrechnung.js`, dort greift die harte Sperre).
 *
 * @param {string} code  gewählte Positionsnummer aus dem Dropdown
 */
function pruefeHpnrWahl(code) {
  if (!istPodo() || code !== '78020') return;
  const gewaehlt = gewaehlteLeitsymptome();
  if (gewaehlt.includes('c') || !gewaehlt.some(b => b === 'a' || b === 'b')) return;
  zeigeHinweise([{
    farbe: 'var(--warning,#f59e0b)',
    text: '78020 ist nur bei verordneter Komplexbehandlung (c) abrechenbar — bei '
        + 'Hornhautabtragung oder Nagelbearbeitung allein immer 78010 (FAK Podologie Q25).',
  }]);
}

/**
 * Die eine Stelle, an der `dashboard.js` eine Wahl aus dem `rzHm`-Dropdown
 * weiterreicht. Katalogzeile → Kästchen ankreuzen; HPNR → in das Positionsfeld
 * schreiben (bisheriges Verhalten) und 78020 gegen a)/b) prüfen. Steht hier
 * statt in `dashboard.js`, weil die Datei nicht wachsen darf (Konsey 2026-08-13).
 *
 * @param {{__ls?:string, code?:string}} it   gewählte Zeile
 * @param {string} posFeldId                  ID des Positionsfeldes (`rzHmPosition`)
 */
export function heilmittelAuswahlUebernehmen(it, posFeldId) {
  if (it?.__ls) { leitsymptomatikAusDropdownWaehlen(it.__ls); return; }
  const pos = $(posFeldId);
  if (pos) pos.value = it?.code ?? '';
  pruefeHpnrWahl(it?.code);
}

// ─── 2. IK des Leistungserbringers ─────────────────────────────────────────
//
// Die IK der Praxis ist auf jeder Verordnung dieselbe. Quelle ist die
// Einstellung „Abrechnung" (`profiles.ik_number`); ist dort nichts gepflegt,
// greifen wir auf die IK aus dem hinterlegten Zertifikat zurück
// (`terapeut_zertifikat.ik_nummer`) — dieselbe Reihenfolge wie in den
// Einstellungen selbst.

async function ikVorbelegen(supabase, ctx) {
  const feld = $('rzIkLE');
  if (!feld || !istPodo()) return;
  if (feld.value.trim() && feld.dataset.auto !== '1') return;  // Hand geht vor

  let ik = String(ctx?.getProfile?.()?.ik_number || '').trim();

  if (!ik) {
    const ownerId = ctx?.getOwnerId?.();
    if (ownerId) {
      const { data } = await supabase
        .from('terapeut_zertifikat')
        .select('ik_nummer')
        .eq('owner_id', ownerId)
        .maybeSingle();          // optionaler Lookup — niemals .single(), das gibt 406
      ik = String(data?.ik_nummer || '').trim();
    }
  }

  if (!ik) return;
  feld.value = ik;
  feld.dataset.auto = '1';
}

// ─── 3. ICD → gültige Diagnosegruppen ──────────────────────────────────────
//
// Regelquelle ist die Tabelle `diagnosegruppen` (Spalten icd_accept /
// icd_exclude), dieselbe, aus der die Podologie-Abrechnung schöpft. Der
// Abgleich läuft über `icd-dg-match.js` — kein zweiter Matcher.
//
// L60.0 (Unguis incarnatus) lässt danach genau UI1 und UI2 zu; alle anderen
// Gruppen verschwinden aus der Auswahl, statt nur nach unten sortiert zu
// werden (`strict`, wie in der Podologie-Abrechnung bereits üblich).

let _podRegeln = null;

async function podRegelnLaden(supabase) {
  if (_podRegeln) return _podRegeln;
  const { data, error } = await supabase
    .from('diagnosegruppen')
    .select('code, label, icd_accept, icd_exclude, icd_auto_select, icd_accept_unsicher, icd_enforcement, bereich, sort, aktiv')
    .eq('aktiv', true)
    .eq('bereich', 'podologie')
    .order('sort');
  if (error) { console.warn('[verordnung-podo] diagnosegruppen:', error.message); return {}; }
  _podRegeln = Object.fromEntries((data || []).map(r => [r.code, {
    label:               r.label,
    icd_accept:          r.icd_accept          || [],
    icd_exclude:         r.icd_exclude         || [],
    icd_auto_select:     r.icd_auto_select     || [],
    icd_accept_unsicher: r.icd_accept_unsicher || [],
    icd_enforcement:     r.icd_enforcement     || 'warn',
  }]));
  return _podRegeln;
}

async function dgAuswahlEingrenzen(supabase) {
  const icdFeld = $('rzIcd');
  const dgFeld  = $('rzDg');
  if (!icdFeld || !dgFeld || !istPodo()) return null;

  // Beide ICD-Felder von Muster 13 zählen — wie in module/icd-dg-verdrahtung.js.
  const codes = parseIcdList([icdFeld.value, $('rzIcd2')?.value].filter(Boolean).join(', '));
  if (!codes.length) { dgFeld.removeAttribute('data-pod-erlaubt'); return null; }

  const regeln = await podRegelnLaden(supabase);
  const erlaubt = dgsAcceptingIcd(codes, regeln);
  if (!erlaubt.length) return null;   // keine Regel trifft → nicht einengen

  // Die erlaubten Gruppen wandern als Attribut ans Feld. `attachDiagnoseSearch`
  // liest sie über die Option `nurCodes` (Verdrahtung in dashboard.js,
  // DIAGNOSE_FIELDS.rzDg) — das Suchmodul selbst bleibt unverändert und wird
  // nur parametriert. Als Attribut ist im DOM sichtbar, warum die Liste kurz ist.
  dgFeld.setAttribute('data-pod-erlaubt', erlaubt.join(','));

  // Die Diagnosegruppe selbst schreibt hier niemand mehr (26.09.2026): das tut
  // allein module/icd-dg-verdrahtung.js. Zwei Schreiber mit zwei Kriterien
  // haben sich um `rzDg` ein Rennen geliefert — wessen Regelabfrage zuerst
  // zurückkam, gewann, und ein von hier geschriebenes DF wurde bei E11.74 +
  // L60.0 nie zurückgenommen (Ops #304, d/d2). Aus demselben Grund steht auch
  // der Hinweis „passt nicht / zulässig" nur noch dort, am ICD-Feld.
  return { erlaubt, regeln };
}

// ─── 4. Behandlungseinheiten ───────────────────────────────────────────────
//
// [Q2] Abschnitt 3 f): Die Behandlungsmenge darf die im Heilmittelkatalog
// angegebene Höchstmenge je Verordnung nicht überschreiten. Überschreitet die
// ärztliche Verordnung sie, darf der Leistungserbringer nur so viele
// Einheiten erbringen und abrechnen, wie zulässig sind — der Arzt ist zu
// informieren. Deshalb wird hier gewarnt und NICHT hart geblockt: eine
// Verordnung mit 7 Einheiten existiert auf Papier und muss erfassbar bleiben.

function einheitenPruefen() {
  const feld = $('rzAnzahl');
  if (!feld || !istPodo()) return null;

  const root = dgWurzel($('rzDg')?.value);
  const max  = POD_HOECHSTMENGE[root];
  if (!max) return null;

  feld.setAttribute('max', String(max));
  feld.setAttribute('min', '1');

  const wert = parseInt(feld.value, 10);
  if (!Number.isFinite(wert)) return null;

  if (wert < 1) {
    return { farbe: 'var(--danger,#ef4444)', text: 'Mindestens 1 Behandlungseinheit.' };
  }
  if (wert > max) {
    const orient = POD_ORIENTIEREND[root];
    const zusatz = orient && orient > max
      ? ` Die ${orient} Einheiten sind die orientierende Behandlungsmenge über mehrere `
        + 'Verordnungen — dafür ist eine Wiedervorstellung beim verordnenden Arzt nötig.'
      : '';
    return {
      farbe: 'var(--danger,#ef4444)',
      text: `Höchstmenge für ${root} ist ${max} Einheiten je Verordnung — abrechenbar sind `
          + `maximal ${max}, die Ärztin/der Arzt ist zu informieren.${zusatz}`,
    };
  }
  return null;
}

// ─── 5. Schnellauswahl für Behandlungseinheiten ────────────────────────────
//
// Ops #211: die Höchstmenge selbst kam schon aus POD_HOECHSTMENGE (s.o.),
// offen war nur, sie tippfrei anklickbar zu machen. Zeigt 1..max als Chips;
// max ist je Diagnosegruppe verschieden (UI2 z. B. nur 4), deshalb wird bei
// jedem DG-Wechsel neu gerendert statt einmalig aufgebaut.

function schnellauswahlEl() {
  let el = $('rzAnzahlSchnellwahl');
  if (el) return el;
  const zeile = $('rzAnzahl')?.closest('div');
  if (!zeile) return null;
  el = document.createElement('div');
  el.id = 'rzAnzahlSchnellwahl';
  el.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;';
  zeile.appendChild(el);
  return el;
}

function schnellauswahlRendern() {
  const feld = $('rzAnzahl');
  const root = dgWurzel($('rzDg')?.value);
  const max = POD_HOECHSTMENGE[root];
  if (!feld || !istPodo() || !max) { const el = $('rzAnzahlSchnellwahl'); if (el) el.innerHTML = ''; return; }

  const el = schnellauswahlEl();
  if (!el) return;
  const aktuell = parseInt(feld.value, 10);
  el.innerHTML = '';
  for (let n = 1; n <= max; n++) {
    const aktiv = aktuell === n;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(n);
    btn.style.cssText = 'font-size:11px;padding:2px 7px;border-radius:10px;cursor:pointer;'
      + `border:1px solid var(--border-color,#ccc);background:${aktiv ? 'var(--accent,#2563eb)' : 'transparent'};`
      + `color:${aktiv ? '#fff' : 'var(--text-main)'};`;
    btn.addEventListener('click', () => {
      feld.value = String(n);
      feld.dispatchEvent(new Event('input', { bubbles: true }));
    });
    el.appendChild(btn);
  }
}

// ─── 6. Dringlicher Behandlungsbedarf ──────────────────────────────────────

function fristHinweis() {
  if (!istPodo()) return null;
  const ausst = $('rzAusstDate')?.value;
  if (!ausst) return null;
  const dringend = !!$('rzDringend')?.checked;
  const frist = behandlungsbeginnFrist(ausst, dringend);
  if (!frist) return null;
  const tage = dringend ? BEHANDLUNGSBEGINN_TAGE.dringend : BEHANDLUNGSBEGINN_TAGE.normal;
  return {
    farbe: dringend ? 'var(--warning,#f59e0b)' : 'var(--text-muted)',
    text: `Behandlungsbeginn spätestens am ${new Date(frist).toLocaleDateString('de-DE')} `
        + `(${tage} Kalendertage ab Ausstellung)${dringend ? ' — dringlicher Behandlungsbedarf' : ''}. `
        + 'Wird die Frist versäumt, verliert die Verordnung ihre Gültigkeit.',
  };
}

// ─── 7. Ergänzendes Heilmittel ausblenden ──────────────────────────────────
//
// In der Podologie kommt das ergänzende Heilmittel praktisch nicht vor; das
// Feld kostet in jeder Erfassung Aufmerksamkeit. Es wird deshalb NUR
// ausgeblendet — Wert und Rechenweg bleiben, weil das ergänzende Heilmittel
// in die Zuzahlung eingeht und Beta-2 ausdrücklich verlangt hat, dass am Ende
// der richtige Betrag herauskommt. Ausgeblendet und leer verhält sich die
// Zuzahlung exakt wie vorher; entfernt man die Logik, tut sie es nicht mehr.

function ergaenzendesUmschalten() {
  const feld = $('rzHmErg');
  const zeile = feld?.closest('div')?.parentElement;
  if (!feld || !zeile) return;
  const verstecken = istPodo();
  zeile.style.display = verstecken ? 'none' : '';
  // Beim Wechsel nach Podologie ein versehentlich gefülltes Feld nicht
  // heimlich mitschleppen — sonst rechnet die Zuzahlung mit etwas,
  // das niemand mehr sehen kann.
  if (verstecken && feld.value.trim()) {
    feld.value = '';
    const anz = $('rzAnzahlErg');
    if (anz) anz.value = '';
  }
}

// ─── [Q4] Podologische Zusatzangaben an der Verordnung ─────────────────────
//
// Drei Angaben gehoeren zur podologischen Verordnung, standen aber bis zum
// 06.09.2026 nur im getrennten Formular der Abrechnungsseite. Es gab also zwei
// Wege, eine Verordnung anzulegen, und nur einer von beiden kannte sie. Seit
// die Muster-13-Maske der einzige Weg ist, stehen sie hier — und zwar NUR im
// Podologie-Modus, damit die Maske fuer Physio/Ergo/Logo nicht mit Feldern
// zuwaechst, die dort nichts bedeuten.
//
//   nagel              ABRECHNUNGSRELEVANT. § 3b lit. a der Aenderungs-
//                      vereinbarung vom 16.06.2025: die Erstbefundung
//                      (78100/78110) gibt es EINMAL je Nagelspangen-Serie, und
//                      die Serie haengt allein am Nagel — ueber Verordnungen
//                      hinweg. Ohne dieses Feld kann `darfErstbefundungNagel()`
//                      (module/eingangsbefundung-regel.js) die Serie nicht
//                      erkennen, und die Kasse setzt die zweite Erstbefundung
//                      ab. Nur bei UI 1 / UI 2 sichtbar — nur dort gibt es
//                      ueberhaupt eine Nagelspange.
//   wagner_grad        (18.09.2026 aus der Maske ENTFERNT, Kemal.) Stand bis dahin
//                      als klinische Dokumentation (§ 630f BGB) unabhaengig von
//                      der Diagnosegruppe sichtbar (Konsey 2026-08-10). Die Spalte
//                      bleibt, siehe podoVerordnungsfelder(). Offen als Produkt-
//                      frage: hat Wagner ueberhaupt noch einen Erfassungsort?
//   behandlungsanlass  Freitext, vorbelegt mit dem Katalogtext.
//
// Werte und Beschriftungen des Nagels kommen aus
// module/eingangsbefundung-regel.js — dieselbe Liste, die auch die Abrechnung
// liest. Ein zweites Schema waere genau der Fehler, den diese Zusammenlegung
// beseitigen soll.

/** Der Durchlauf aus `mountVerordnungPodo` — fuer `podoMaskeNachziehen()`. */
let _lauf = null;

const POD_ANLASS_DEFAULT = 'Podologische Komplexbehandlung';

/** Nur die Nagelspangen-Diagnosegruppen fuehren einen Nagel. */
const POD_NAGEL_DGS = ['UI1', 'UI2'];

const FELD_STIL = 'width:100%;padding:7px 9px;border-radius:6px;border:1px solid var(--border);'
  + 'background:var(--bg-card-solid);color:var(--text-main);font-size:13px;';
const LABEL_STIL = 'font-size:12px;color:var(--text-muted);display:block;margin-bottom:3px;';

/**
 * Der Block mit den drei Feldern. Wird einmal erzeugt und lebt INNERHALB der
 * Maske — sie zieht zwischen Modal und Seite um (module/verordnung-maske.js),
 * und die Felder muessen mitreisen.
 */
function podoFelderEl() {
  let el = $('rzPodoFelder');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'rzPodoFelder';
  el.style.cssText = 'margin-top:10px;padding:10px;border:1px dashed var(--border);'
    + 'border-radius:8px;gap:8px;display:none;';
  el.innerHTML = `
    <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Podologische Angaben</div>
    <div id="rzPodoNagelWrap" style="display:none;">
      <label style="${LABEL_STIL}" for="rzPodoNagel">Behandelter Zehennagel <span style="color:var(--danger,#ef4444);">*</span></label>
      <select id="rzPodoNagel" style="${FELD_STIL}">
        <option value="">— Nagel wählen —</option>
        ${NAGEL_WERTE.map(w => `<option value="${w}">${nagelLabel(w)}</option>`).join('')}
      </select>
      <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Eine Verordnung = ein Nagel. Der Nagel hält die Behandlungsserie über mehrere Verordnungen zusammen.</div>
    </div>
    <div>
      <label style="${LABEL_STIL}" for="rzPodoAnlass">Behandlungsanlass</label>
      <input type="text" id="rzPodoAnlass" placeholder="${POD_ANLASS_DEFAULT}" style="${FELD_STIL}">
    </div>`;
  return inBlock(el) ? el : null;
}

/**
 * Sichtbarkeit nachziehen und melden, wenn der Nagel bei einer Nagelspangen-
 * Verordnung fehlt.
 *
 * @returns {{farbe?:string,text:string}|null}
 */
function podoFelderAktualisieren() {
  const el = podoFelderEl();
  if (!el) return null;

  if (!istPodo()) { el.style.display = 'none'; return null; }
  el.style.display = 'grid';

  const brauchtNagel = POD_NAGEL_DGS.includes(dgWurzel($('rzDg')?.value));
  const wrap = $('rzPodoNagelWrap');
  if (wrap) wrap.style.display = brauchtNagel ? 'block' : 'none';

  // Ausserhalb der Nagelspange traegt die Verordnung keinen Nagel — ein
  // stehengebliebener Wert waere schlicht falsch.
  if (!brauchtNagel) { const n = $('rzPodoNagel'); if (n) n.value = ''; return null; }

  if (!$('rzPodoNagel')?.value) {
    return {
      farbe: 'var(--danger,#ef4444)',
      text: 'Bei UI 1 / UI 2 gehört der behandelte Zehennagel auf die Verordnung — '
          + 'ohne ihn lässt sich die Erstbefundung (78100/78110) nicht je Serie begrenzen.',
    };
  }
  return null;
}

/**
 * Die Werte fuer die Nutzlast (module/verordnung-maske.js).
 * Ausserhalb der Podologie ein leeres Objekt — die Spalten bleiben unberuehrt.
 *
 * ⚠️ `wagner_grad` steht bewusst NICHT mehr drin (18.09.2026, Kemal — das Feld
 * kostete Platz und wurde nie ausgefuellt). Die Spalte selbst bleibt: sie ist
 * kein Schreibweg mehr, aber Altbestand liest sie weiterhin
 * (module/verordnung-detail.js). Wuerde hier `wagner_grad: null`
 * zurueckgegeben, loeschte ein simples Abspeichern jeden vorhandenen Wert —
 * und bei einer laut Migration 0020 bereits festgeschriebenen Verordnung
 * schluege das Update sogar fehl (der Trigger bewacht genau diese Spalte).
 * Der Schluessel fehlt deshalb komplett statt auf `null` zu stehen.
 *
 * @returns {{nagel?:?string, behandlungsanlass?:?string}}
 */
export function podoVerordnungsfelder() {
  if (!istPodo()) return {};
  const brauchtNagel = POD_NAGEL_DGS.includes(dgWurzel($('rzDg')?.value));
  return {
    nagel: brauchtNagel ? ($('rzPodoNagel')?.value || null) : null,
    behandlungsanlass: ($('rzPodoAnlass')?.value || '').trim() || POD_ANLASS_DEFAULT,
  };
}

// ─── [Q3] Sitzungsplan-Vorschau ────────────────────────────────────────────
//
// Kemal, 14.09.2026: „genelde erstbefund sonra normal befund kalan her
// hizmette oluyor" — am ersten Behandlungstag laeuft die Eingangsbefundung
// (78040) mit, an jedem weiteren die Befundung (78030). Das stimmt und stand
// in `wissensbank/SPEC-RULES.md` schon als Tabelle; sichtbar war es in der
// Verordnungsmaske nirgends.
//
// ⚠️ ANZEIGE, kein Schreibweg. Hier entsteht keine Abrechnungszeile und kein
// Kaestchen wird gesetzt — das bleibt allein in der Podologie-Abrechnung, wo
// alle Sperren mitlaufen. Die Rechnung selbst steht in `module/sitzungsplan.js`
// neben ihrem Test, die REGEL unveraendert in `eingangsbefundung-regel.js`.
//
// Dies ist ausdruecklich NICHT die Stelle, an der mehrere Heilmittel auf die
// Verordnung kommen: HeilM-RL § 12 Abs. 2 S. 1 erlaubt das Aufteilen der
// Verordnungseinheiten auf bis zu drei vorrangige Heilmittel nur fuer
// Physiotherapie und Ergotherapie; S. 2 ist fuer Stimm-, Sprech-, Sprach- und
// Schlucktherapie eine eigene Regel (Behandlungszeiten, Einzel-/Gruppe). Die
// Podologie steht in keinem der Saetze; ihr Katalog bildet „beides zugleich"
// als eigenes Heilmittel ab (c) Komplexbehandlung, § 27a Abs. 4 Nr. 3).

/**
 * Antwort auf die Altbestandsfrage — war der Patient schon VOR dem 01.11.2023
 * in podologischer Behandlung? `null` = nicht beantwortet.
 *
 * Seit Ops #244 (Migration 0018) wird die Antwort in
 * `leads.podologie_altbestand_vor_2023` / `..._beantwortet_am` festgeschrieben
 * (siehe `altbestandAusLeads()` / `beantworteAltbestand()` unten) — dieses
 * Modul haelt nur noch den lokalen Zwischenstand fuer die laufende Vorschau,
 * nicht mehr die einzige Quelle der Antwort.
 */
let _altbestand = null;

/** Behandlungshistorie je Patient — eine Rundreise, nicht eine je Tastendruck. */
let _behsCache = { patientId: null, werte: [] };

/** Antwort aus `leads` (Ops #244) — eine Abfrage je Patient, nicht je Tastendruck. */
let _altbestandCache = { patientId: null, wert: null };

/**
 * Alle `podologie_behandlungen` dieses Patienten, ueber ALLE seine
 * Verordnungen. Gekuerzte Fassung von `podPatientBehandlungen()`
 * (module/podologie-abrechnung.js) — dort liegt sie am Abrechnungsbildschirm,
 * hier an der Maske; beide fragen dasselbe.
 */
async function podoHistorie(supabase, ctx, patientId) {
  if (!patientId || !supabase) return [];
  if (_behsCache.patientId === patientId) return _behsCache.werte;

  const ownerId = ctx?.getOwnerId?.();
  if (!ownerId) return [];

  // `therapie_bereich` gehoert dazu, seit beide Verordnungstoepfe eine Tabelle
  // sind — ohne ihn kaemen Physio-Verordnungen mit in die Liste.
  const { data: vords } = await supabase.from(TOPF).select('id')
    .eq('owner_id', ownerId).eq('therapie_bereich', 'podo').eq('patient_id', patientId);
  if (!vords?.length) { _behsCache = { patientId, werte: [] }; return []; }

  const { data: behs } = await supabase.from('podologie_behandlungen')
    .select('behandlungsdatum, hpnr_codes')
    .eq('owner_id', ownerId)
    .is('storniert_am', null)          // stornierte Behandlungen zaehlen nicht (Migration 0026)
    .in('verordnung_id', vords.map(v => v.id))
    .order('behandlungsdatum', { ascending: true });

  _behsCache = { patientId, werte: behs || [] };
  return _behsCache.werte;
}

/**
 * Bereits beantwortete Altbestandsfrage aus `leads` laden (Ops #244) — einmal
 * je Patient, nicht bei jedem Tastendruck. `null` = unbeantwortet/unbekannt.
 */
async function altbestandAusLeads(supabase, ctx, patientId) {
  if (!patientId || !supabase) return null;
  if (_altbestandCache.patientId === patientId) return _altbestandCache.wert;

  const ownerId = ctx?.getOwnerId?.();
  if (!ownerId) return null;

  const { data } = await supabase.from('leads')
    .select('podologie_altbestand_vor_2023')
    .eq('id', patientId).eq('owner_id', ownerId).maybeSingle();

  const wert = data?.podologie_altbestand_vor_2023 ?? null;
  _altbestandCache = { patientId, wert };
  return wert;
}

/**
 * Antwort in `leads` festschreiben (Ops #244). Die Vorschau reagiert sofort
 * ueber `_altbestand`; das Schreiben laeuft nebenlaeufig — ein Fehler blockiert
 * die Anzeige nicht, wird aber nicht verschluckt (Konsole).
 */
async function beantworteAltbestand(supabase, ctx, patientId, wert) {
  if (!patientId || !supabase) return;
  const ownerId = ctx?.getOwnerId?.();
  if (!ownerId) return;

  const { error } = await supabase.from('leads')
    .update({
      podologie_altbestand_vor_2023: wert,
      podologie_altbestand_beantwortet_am: new Date().toISOString(),
    })
    .eq('id', patientId).eq('owner_id', ownerId);

  if (error) console.warn('[verordnung-podo] Altbestand speichern:', error.message);
}

function sitzungsplanEl() {
  let el = $('rzPodoSitzungsplan');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'rzPodoSitzungsplan';
  el.style.cssText = 'margin-top:6px;padding:6px 10px;border-left:2px solid var(--border);'
    + 'border-radius:4px;background:var(--bg-card);display:none;';
  return inBlock(el) ? el : null;
}

/** Text fuer die Anzeige entschaerfen — Katalogtexte kommen aus der Datenbank. */
function h(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * Die Vorschau zeichnen. Laeuft im Zusammenlauf mit, sobald Podologie gesetzt
 * ist; ohne Diagnosegruppe oder ohne Menge bleibt der Kasten leer statt zu
 * raten.
 */
async function sitzungsplanAktualisieren(supabase, ctx) {
  const el = sitzungsplanEl();
  if (!el) return false;

  if (!istPodo()) { el.style.display = 'none'; _altbestand = null; return false; }

  const patientId = $('rzPatientId')?.value || '';
  // Ein Patientenwechsel macht die Antwort zur vorigen Person ungueltig.
  if (_behsCache.patientId && _behsCache.patientId !== patientId) _altbestand = null;

  let behandlungen = [];
  try { behandlungen = await podoHistorie(supabase, ctx, patientId); }
  catch (e) { console.warn('[verordnung-podo] Historie:', e?.message); }

  // Schon einmal beantwortet? Dann nicht erneut fragen — aus `leads` laden.
  if (_altbestand === null && patientId) {
    try { _altbestand = await altbestandAusLeads(supabase, ctx, patientId); }
    catch (e) { console.warn('[verordnung-podo] Altbestand laden:', e?.message); }
  }

  const plan = sitzungsplan({
    diagnosegruppe: $('rzDg')?.value || '',
    anzahl: $('rzAnzahl')?.value,
    behandlungen,
    // Der erste Behandlungstag ist noch nicht gebucht; das Ausstellungsdatum
    // ist die beste bekannte Naeherung und entscheidet nur, ob eine frueher
    // erbrachte Behandlung VOR diesem Tag liegt.
    datum: $('rzAusstDate')?.value || '',
    podologieVor2023: _altbestand,
  });

  // Kemal, 18.09.2026: „göstermeyince sanki yok, elle manuel yapmam gerek gibi
  // bir fikir oluyor." Bei DF/NF/QF gehört die Befundung IMMER dazu (Anlage 1a
  // Teil 2 Nr. 4.2) und wird von allein eingeplant — das muss man SEHEN, sonst
  // sucht der Anwender einen Knopf, den er nie drücken muss. Deshalb steht der
  // Kasten schon nach der Diagnosegruppe da, nicht erst mit der Menge.
  //
  // Die grüne Bestätigung gilt nur, wo sie stimmt: DF/NF/QF, und entweder ist
  // noch keine Menge da (dann gilt die Regel allgemein) oder die Rechnung hat
  // wirklich Zeilen geliefert. Im Nagelzweig (UI1/UI2) laeuft KEINE Automatik —
  // dort entscheidet die Praxis (eingangsbefundung-regel.js) — und ein gruenes
  // Haekchen waere gelogen.
  const root = dgWurzel($('rzDg')?.value);
  const mengeDa = Number.parseInt($('rzAnzahl')?.value, 10) >= 1;
  const automatisch = POD_BEFUND_DGS.includes(root) && (!mengeDa || plan.zeilen.length > 0);
  if (!plan.anwendbar && !plan.hinweis && !automatisch) { el.style.display = 'none'; return false; }

  const zeilen = plan.zeilen.map(z => `
    <div style="display:flex;gap:6px;align-items:baseline;margin-top:2px;">
      <span style="flex:0 0 auto;font-weight:600;color:var(--text-main);font-size:11px;">${h(z.titel)}</span>
      <span style="color:var(--text-muted);font-size:11px;">${h(z.text)}</span>
    </div>`).join('');

  // Die Altbestandsfrage nur zeigen, wenn die Regel sie stellt — beantwortet
  // oder im Nagelzweig verschwindet sie wieder.
  const frage = plan.rueckfrage ? `
    <div style="margin-top:5px;padding-top:5px;border-top:1px solid var(--border);">
      <div style="font-size:11px;color:var(--text-main);">${h(plan.rueckfrage)}</div>
      <div style="display:flex;gap:12px;margin-top:3px;font-size:11px;color:var(--text-muted);">
        <label style="display:flex;gap:4px;align-items:center;cursor:pointer;">
          <input type="radio" name="rzPodoVor2023" value="nein"${_altbestand === false ? ' checked' : ''}> Nein
        </label>
        <label style="display:flex;gap:4px;align-items:center;cursor:pointer;">
          <input type="radio" name="rzPodoVor2023" value="ja"${_altbestand === true ? ' checked' : ''}> Ja
        </label>
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">
        Wird beim Auswählen dauerhaft am Patienten gespeichert (Ops #244).
      </div>
    </div>` : '';

  const gruen = 'var(--success,#22c55e)';
  el.style.borderLeftColor = automatisch ? gruen : 'var(--border)';
  el.style.borderLeftWidth = automatisch ? '3px' : '2px';
  const kopf = automatisch
    ? `<div style="font-size:12px;font-weight:700;color:${gruen};">✓ Befund ist eingeplant — Sie müssen nichts ergänzen</div>`
    : `<div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Befund</div>`;
  // Ohne Menge gibt es noch keinen Plan je Einheit — die Regel im Klartext.
  const ohneMenge = automatisch && !mengeDa ? `
    <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
      Die Befundung (78030) läuft vor jeder Behandlung mit, bei der Erstbehandlung zuerst die
      Eingangsbefundung (78040). Sobald die Behandlungseinheiten eingetragen sind, steht hier der Plan je Einheit.
    </div>` : '';

  el.innerHTML = `
    ${kopf}
    ${ohneMenge}
    ${zeilen}
    ${plan.hinweis ? `<div style="font-size:10px;color:var(--text-muted);margin-top:3px;">${h(plan.hinweis)}</div>` : ''}
    ${frage}
    <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">
      Nicht auf dem Papier-Rezept: Die Befundung erscheint an den Einheiten im Terminbereich und wird beim
      Buchen als zweite Leistung ergänzt. Abgerechnet wird sie in der Abrechnung.
    </div>`;
  el.style.display = 'block';

  el.querySelectorAll('input[name="rzPodoVor2023"]').forEach(r => {
    r.addEventListener('change', () => {
      _altbestand = r.value === 'ja';
      _altbestandCache = { patientId, wert: _altbestand };
      beantworteAltbestand(supabase, ctx, patientId, _altbestand);
      podoMaskeNachziehen();
    });
  });

  // Sagt dem Zusammenlauf, ob der alte Einzeiler-Hinweis noch gebraucht wird.
  return plan.zeilen.length > 0 || automatisch;
}

// ─── Zusammenlauf ──────────────────────────────────────────────────────────

async function aktualisieren(supabase, ctx) {
  ergaenzendesUmschalten();
  leitsymptomatikBeschriften();

  if (!istPodo()) {
    podoFelderAktualisieren();
    await sitzungsplanAktualisieren(supabase, ctx);
    zeigeHinweise([]);
    return;
  }

  await ikVorbelegen(supabase, ctx);
  await dgAuswahlEingrenzen(supabase);   // nur die Auswahlliste einengen, s. dort
  const lsMeldung = leitsymptomatikAnwenden();

  const zeilen = [lsMeldung];

  zeilen.push(einheitenPruefen());
  schnellauswahlRendern();
  zeilen.push(fristHinweis());

  // Der Sitzungsplan sagt dasselbe wie `POD_BEFUND_HINWEIS`, nur genauer (er
  // kennt auch die Eingangsbefundung und die Sitzungszahl). Solange er steht,
  // waere der Einzeiler daneben eine zweite, gröbere Fassung derselben Aussage
  // — er kommt nur zurueck, wenn noch keine Menge eingetragen ist.
  const planSteht = await sitzungsplanAktualisieren(supabase, ctx);

  const root = dgWurzel($('rzDg')?.value);
  if (!planSteht && POD_BEFUND_DGS.includes(root)) zeilen.push({ text: POD_BEFUND_HINWEIS });

  zeilen.push(podoFelderAktualisieren());

  zeigeHinweise(zeilen);
}

/** Eingriffe zurücknehmen, wenn der Bereich weg von Podologie wechselt. */
function _aufraeumen() {
  ['rzHm', 'rzIkLE', 'rzDg'].forEach(id => {
    const el = $(id);
    if (el && el.dataset.auto === '1') { el.value = ''; delete el.dataset.auto; }
  });
  $('rzDg')?.removeAttribute('data-pod-erlaubt');
  $('rzAnzahl')?.removeAttribute('max');
  const schnellwahl = $('rzAnzahlSchnellwahl');
  if (schnellwahl) schnellwahl.innerHTML = '';
  ['rzPodoNagel', 'rzPodoAnlass'].forEach(id => { const e = $(id); if (e) e.value = ''; });
  const felder = $('rzPodoFelder');
  if (felder) felder.style.display = 'none';
  const plan = $('rzPodoSitzungsplan');
  if (plan) { plan.style.display = 'none'; plan.innerHTML = ''; }
  _altbestand = null;
  _behsCache = { patientId: null, werte: [] };
  zeigeHinweise([]);
}

/**
 * Einhängen. Wird einmal beim Start aufgerufen; die Maske selbst wird von
 * `openRezeptModal` befüllt, deshalb hängen die Auslöser am Dokument und
 * nicht am Modal (das Modal existiert dauerhaft im DOM, nur `hidden`).
 *
 * @param {object} supabase  Client aus dashboard.js
 * @param {{getOwnerId:Function, getProfile:Function}} ctx
 */
export function mountVerordnungPodo(supabase, ctx = {}) {
  const modal = $('rezeptModal');
  if (!modal) return;

  // ⚠ Die Zuhoerer haengen an der MASKE, nicht am Modal.
  //
  // Seit dem 06.09.2026 zieht `#rzMaskeWrap` in die untere Haelfte der Seite
  // „Verordnungen" um (module/verordnung-maske.js). Zuhoerer am Modal sehen
  // dort nichts mehr: die Ereignisse entstehen im umgezogenen Knoten, und der
  // liegt dann ausserhalb. Genau so faellt eine Automatik lautlos aus — die
  // Maske sieht vollstaendig aus, nur passiert nichts mehr. Am Knoten selbst
  // angemeldet, reisen die Zuhoerer mit.
  const maske = $('rzMaskeWrap') || modal;

  let letzterBereich = null;

  const lauf = () => {
    const jetzt = $('rzTherapieBereich')?.value || '';
    if (letzterBereich === 'podo' && jetzt !== 'podo') _aufraeumen();
    letzterBereich = jetzt;
    aktualisieren(supabase, ctx).catch(e => console.warn('[verordnung-podo]', e));
  };

  // Handeingaben lösen die Automatik-Markierung, damit wir nichts
  // überschreiben. `podSchreibt` klammert die eigenen Schreibvorgänge aus —
  // ohne diese Prüfung hob sich die Automatik beim ersten Treffer selbst auf.
  maske.addEventListener('input', (e) => {
    const el = e.target;
    if (el?.dataset?.podSchreibt === '1') return;
    if (el?.dataset?.auto === '1') delete el.dataset.auto;
  }, true);

  const AUSLOESER = ['rzLsA', 'rzLsB', 'rzLsC', 'rzLsD', 'rzDg', 'rzIcd', 'rzIcd2',
                     'rzAnzahl', 'rzAusstDate', 'rzDringend', 'rzPodoNagel'];
  ['change', 'input'].forEach(ev => maske.addEventListener(ev, (e) => {
    if (AUSLOESER.includes(e.target?.id || '')) lauf();
  }, true));

  // Leert der Anwender das Heilmittelfeld von Hand, gehört es wieder uns —
  // sonst müsste er die Maske schliessen, um die Automatik zurückzuholen.
  $('rzHm')?.addEventListener('input', (e) => {
    if (e.target.dataset.podSchreibt === '1') return;
    if (!e.target.value.trim()) setTimeout(lauf, 0);
  });

  // Der Fachbereich wird per Klick auf die Ankreuzfelder gesetzt
  // (`setM13Therapy`), nicht über ein change-Ereignis.
  maske.addEventListener('click', (e) => {
    if (e.target?.closest?.('.m13-th')) setTimeout(lauf, 0);
  });

  // Beim Öffnen des Modals einmal durchlaufen. Steht die Maske in der Seite,
  // gibt es kein `hidden` das umspringt — dort ruft module/verordnung-maske.js
  // `podoMaskeNachziehen()` (siehe unten).
  new MutationObserver(() => { if (!modal.hidden) setTimeout(lauf, 0); })
    .observe(modal, { attributes: true, attributeFilter: ['hidden'] });

  _lauf = lauf;
}

/**
 * Einen Durchlauf anstossen, ohne dass das Modal aufgeht.
 *
 * Wird von `maskeEinbetten()` gerufen, wenn die Maske in die Seite gezogen
 * und mit einer gespeicherten Verordnung gefuellt wurde. Ohne diesen Anstoss
 * blieben im eingebetteten Zustand die podologischen Felder unsichtbar — und
 * damit liesse sich `nagel` beim Bearbeiten nicht setzen.
 */
export function podoMaskeNachziehen() {
  if (_lauf) setTimeout(_lauf, 0);
}
