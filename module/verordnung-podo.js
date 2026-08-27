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
 *      Datei: `verordnung rezept/HeilM-RL_2025-05-15_iK-2025-08-05.txt`
 * [Q2] Anlage 3 (notwendige Angaben auf der Heilmittelverordnung)
 *      i. d. F. vom 16.06.2025 zum Vertrag nach § 125 Abs. 1 SGB V Podologie,
 *      Abschnitt 3 e) „Dringlicher Behandlungsbedarf" und f)
 *      „Behandlungseinheiten". Datei:
 *      `Podoloji/Leistungen/20250617_Podologie_Anlage_3_Lesefassung.txt:390-435`
 * [Q3] Anlage 1a Leistungsbeschreibung i. d. F. vom 17.06.2024, Teil 2
 *      Nr. 4.2 „Podologische Befundung" (78030). Datei:
 *      `Podoloji/Leistungen/20240725_Anlage_1a_Leistungsbeschreibung_lesefassung_b.txt:475-492`
 *
 * Was NICHT hier steht
 * ────────────────────
 * Die Befund-Position (78030/78040) wird bewusst nicht in das Heilmittelfeld
 * der Verordnung geschrieben — siehe Kommentar bei `POD_BEFUND_HINWEIS`.
 */

import { parseIcdList, dgsAcceptingIcd } from '../icd-dg-match.js?v=20260810e';
import { behandlungsbeginnFrist, BEHANDLUNGSBEGINN_TAGE } from './heilmittel-fristen.js?v=20260814';

// ─── [Q1] Heilmittelkatalog Podologische Therapie ────────────────────────────
//
// Leitsymptomatik und vorrangiges Heilmittel tragen in der Richtlinie
// denselben Buchstaben: a↔a, b↔b, c↔c. Für DF, NF und QF ist der Katalog
// wortgleich. UI 1 und UI 2 haben nur eine Leitsymptomatik a) und als
// vorrangiges Heilmittel die Nagelspangenbehandlung.
//
// ⚠ Beta-2 sagte „C ist die podologische Behandlung gross". Das ist die
// ABRECHNUNGSSEITE und gilt nur eingeschränkt: verordnet wird
// „Podologische Komplexbehandlung"; als 78020 („gross") ist sie nur bei
// Therapiezeit über 20 Minuten abrechenbar, sonst 78010 zzgl. 78030
// (FAK Podologie Q25). Das Verordnungsfeld trägt deshalb den Katalogtext,
// nicht den Abrechnungsbegriff.
const POD_KATALOG = {
  DF: { a: 'Hornhautabtragung', b: 'Nagelbearbeitung', c: 'Podologische Komplexbehandlung' },
  NF: { a: 'Hornhautabtragung', b: 'Nagelbearbeitung', c: 'Podologische Komplexbehandlung' },
  QF: { a: 'Hornhautabtragung', b: 'Nagelbearbeitung', c: 'Podologische Komplexbehandlung' },
  UI1: { a: 'Nagelspangenbehandlung' },
  UI2: { a: 'Nagelspangenbehandlung' },
};

// [Q1] Höchstmenge je Verordnung. ⚠ Hier lag die Besprechung daneben:
// „Nagelspange geht bis acht" stimmt nur für UI 1. UI 2 ist auf 4 je VO
// begrenzt; die bis zu 8 Einheiten sind dort die ORIENTIERENDE
// Behandlungsmenge über mehrere Verordnungen hinweg und setzen eine
// Wiedervorstellung beim verordnenden Arzt voraus. Eine pauschale 8 würde
// bei UI 2 Absetzungen produzieren.
const POD_HOECHSTMENGE = { DF: 6, NF: 6, QF: 6, UI1: 8, UI2: 4 };

// [Q1] Nur ein Hinweistext für die orientierende Menge, keine harte Grenze.
const POD_ORIENTIEREND = { UI1: 8, UI2: 8 };

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

/** Wurzel einer Diagnosegruppe: "DF-a" → "DF"; NF/QF/UI1/UI2 unverändert. */
function dgRoot(raw) {
  const v = String(raw || '').trim().toUpperCase();
  if (!v) return '';
  return v.startsWith('DF') ? 'DF' : v.split('-')[0];
}

/**
 * Podologie-Modus des Formulars. Der Bereich hängt an den Ankreuzfeldern oben
 * rechts im Muster 13 (`setM13Therapy` schreibt ihn in das versteckte Feld).
 */
function istPodo() {
  return ($('rzTherapieBereich')?.value || '') === 'podo';
}

// ─── Anzeigezeile unter dem Formular ────────────────────────────────────────
// Ein einziger Hinweisstreifen für alle Meldungen dieses Moduls, damit die
// Maske nicht mit fünf Warnzeilen zugestellt wird.

function hinweisEl() {
  let el = $('rzPodoHinweis');
  if (el) return el;
  const anker = $('rzAnzahl')?.closest('div')?.parentElement || $('rzHm')?.parentElement;
  if (!anker) return null;
  el = document.createElement('div');
  el.id = 'rzPodoHinweis';
  el.style.cssText = 'font-size:11px;line-height:1.5;margin-top:6px;color:var(--text-muted);';
  anker.appendChild(el);
  return el;
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
 * @returns {{farbe?:string,text:string}|null} Meldung, falls die Ankreuzung
 *          nicht zum Katalog der gewählten Diagnosegruppe passt.
 */
function leitsymptomatikAnwenden() {
  const hm = $('rzHm');
  if (!hm || !istPodo()) return null;

  const root = dgRoot($('rzDg')?.value);
  const katalog = POD_KATALOG[root];
  const gewaehlt = gewaehlteLeitsymptome();

  // Das Feld gehört uns nur, wenn es leer ist oder zuletzt von uns kam.
  const unser = !hm.value.trim() || hm.dataset.auto === '1';

  // Nichts angekreuzt → unser Eintrag verschwindet wieder. Genau das ist
  // gemeint mit „nochmal auf c drücken und es ist weg".
  if (gewaehlt.length === 0) {
    if (unser && hm.value) schreibe(hm, '');
    return null;
  }

  // Ohne Diagnosegruppe wissen wir nicht, aus welchem Katalog wir schöpfen.
  if (!katalog) return null;

  // [Q1] UI 1 und UI 2 kennen nur eine Leitsymptomatik a). b) oder c) gibt es
  // dort nicht — das ist keine stille Nicht-Ableitung, sondern ein Fehler auf
  // der Verordnung, der zur Absetzung führt.
  const fremd = gewaehlt.filter(b => !katalog[b]);
  if (fremd.length && !katalog.c) {
    if (unser && hm.value) schreibe(hm, '');
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
      if (unser && hm.value) schreibe(hm, '');
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

  if (hm.value !== text) {
    schreibe(hm, text);
    // Positionsnummer nicht raten: die hängt am Katalog-Suchmodul. Ein leeres
    // Feld ist besser als eine falsche Nummer (die landet im DTA).
    const pos = $('rzHmPosition');
    if (pos) pos.value = '';
  }
  return meldung;
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

  const codes = parseIcdList(icdFeld.value);
  if (!codes.length) { dgFeld.removeAttribute('data-pod-erlaubt'); return null; }

  const regeln = await podRegelnLaden(supabase);
  const erlaubt = dgsAcceptingIcd(codes, regeln);
  if (!erlaubt.length) return null;   // keine Regel trifft → nicht einengen

  // Die erlaubten Gruppen wandern als Attribut ans Feld. `attachDiagnoseSearch`
  // liest sie über die Option `nurCodes` (Verdrahtung in dashboard.js,
  // DIAGNOSE_FIELDS.rzDg) — das Suchmodul selbst bleibt unverändert und wird
  // nur parametriert. Als Attribut ist im DOM sichtbar, warum die Liste kurz ist.
  dgFeld.setAttribute('data-pod-erlaubt', erlaubt.join(','));

  // Steht schon eine Gruppe drin, die der Kode nicht zulässt, wird sie
  // nicht still ersetzt — der Arzt hat sie so verordnet. Wir melden nur.
  const aktuell = dgRoot(dgFeld.value);
  const passt = !aktuell || erlaubt.includes(aktuell);

  // Genau eine Möglichkeit und noch nichts gewählt → übernehmen.
  if (!aktuell && erlaubt.length === 1) schreibe(dgFeld, erlaubt[0]);

  return { erlaubt, passt, aktuell, regeln };
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

  const root = dgRoot($('rzDg')?.value);
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

// ─── Zusammenlauf ──────────────────────────────────────────────────────────

async function aktualisieren(supabase, ctx) {
  ergaenzendesUmschalten();

  if (!istPodo()) { zeigeHinweise([]); return; }

  await ikVorbelegen(supabase, ctx);
  const dgLage = await dgAuswahlEingrenzen(supabase);
  const lsMeldung = leitsymptomatikAnwenden();

  const zeilen = [lsMeldung];

  if (dgLage && dgLage.erlaubt.length) {
    if (!dgLage.passt) {
      zeilen.push({
        farbe: 'var(--danger,#ef4444)',
        text: `${dgLage.aktuell} passt nicht zum eingegebenen ICD-Kode. Zulässig: `
            + dgLage.erlaubt.join(' oder ') + '.',
      });
    } else if (dgLage.erlaubt.length > 1 && !dgLage.aktuell) {
      zeilen.push({ text: `Zulässige Diagnosegruppen für diesen ICD-Kode: ${dgLage.erlaubt.join(' oder ')}.` });
    }
  }

  zeilen.push(einheitenPruefen());
  zeilen.push(fristHinweis());

  const root = dgRoot($('rzDg')?.value);
  if (POD_BEFUND_DGS.includes(root)) zeilen.push({ text: POD_BEFUND_HINWEIS });

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
  modal.addEventListener('input', (e) => {
    const el = e.target;
    if (el?.dataset?.podSchreibt === '1') return;
    if (el?.dataset?.auto === '1') delete el.dataset.auto;
  }, true);

  const AUSLOESER = ['rzLsA', 'rzLsB', 'rzLsC', 'rzLsD', 'rzDg', 'rzIcd',
                     'rzAnzahl', 'rzAusstDate', 'rzDringend'];
  ['change', 'input'].forEach(ev => modal.addEventListener(ev, (e) => {
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
  modal.addEventListener('click', (e) => {
    if (e.target?.closest?.('.m13-th')) setTimeout(lauf, 0);
  });

  // Beim Öffnen der Maske einmal durchlaufen.
  new MutationObserver(() => { if (!modal.hidden) setTimeout(lauf, 0); })
    .observe(modal, { attributes: true, attributeFilter: ['hidden'] });
}
