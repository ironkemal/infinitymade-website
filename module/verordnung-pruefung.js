/**
 * verordnung-pruefung.js — ein Klick, ein Urteil über eine Verordnung.
 *
 * Herkunft
 * ────────
 * Ops-Karte 76. Gewünscht war ein Knopf „Verordnung prüfen" in der von Hand
 * ausgefüllten Verordnungsmaske: einmal drücken, und man weiss, ob die
 * Angaben zusammenpassen. Beta-1 (Podologe, 08.08.2026) braucht ihn für sich
 * selbst nicht — „für die anderen Podologen ist das aber was wert". Also ein
 * Angebot, keine Pflicht: der Knopf blockiert nichts, er beantwortet eine
 * Frage, wenn man sie stellt.
 *
 * Warum kein KI-Aufruf (Entscheidung Kemal, 03.09.2026)
 * ────────────────────────────────────────────────────
 * Die Regeln stehen in der Richtlinie. Sie sind endlich, eindeutig und
 * schriftlich — ein Regelwerk ist dafür billiger, schneller und vor allem
 * belegbar. Jeder Befund unten trägt seine Quelle mit; „die KI meint" hätte
 * dem Anwender gegenüber der Kasse nichts genützt. Die Regeldaten selbst
 * wohnen in `verordnung-regeln.js` und in der Tabelle `diagnosegruppen` —
 * eine Gesetzesänderung ist damit eine Daten-, keine Codeänderung.
 *
 * Ein Motor, vier Fachbereiche
 * ────────────────────────────
 * Nicht vier Motoren. Der Unterschied zwischen Podologie und Logopädie ist
 * kein Unterschied im Prüfablauf, sondern in den Regeldaten. Was für einen
 * Bereich nicht erfasst ist, wird NICHT geprüft und offen als Lücke gemeldet
 * (`ungeprueft`) — eine grüne Meldung, die in Wahrheit nur zwei von sechs
 * Prüfungen abgedeckt hat, wäre schlimmer als gar keine.
 *
 * Was dieser Motor NICHT tut
 * ──────────────────────────
 * - Er speichert nicht und blockiert das Speichern nicht. Auf Papier steht,
 *   was der Arzt verordnet hat; eine Verordnung mit 7 Einheiten existiert und
 *   muss erfassbar bleiben ([Q2] Abschnitt 3 f: erbringen und abrechnen darf
 *   man nur die zulässige Menge, der Arzt ist zu informieren).
 * - Er prüft nicht die Abrechnung (HPNR-Kombinationen, Preise, Zuzahlung).
 *   Das ist die Abrechnungsseite; sie hat ihre eigenen Prüfungen.
 * - Er trifft keine therapeutische Entscheidung. Alle Mengen- und
 *   Fristbefunde sind Verwaltungshinweise zur Abrechnungsvorbereitung
 *   (EU-MDR: keine klinische Bewertung).
 */

import { parseIcdList, matchIcdToDg } from '../icd-dg-match.js?v=20260903';
import { behandlungsbeginnFrist, BEHANDLUNGSBEGINN_TAGE } from './heilmittel-fristen.js?v=20260814';
import { dgWurzel, bereichSchluessel } from './verordnung-regeln.js?v=20260903';

/** Dringlichkeit der Meldung. `blocker` heisst: so geht die Verordnung nicht durch. */
export const SCHWERE = { blocker: 'blocker', warnung: 'warnung', hinweis: 'hinweis' };

/**
 * Pflichtangaben der Heilmittelverordnung.
 *
 * Quelle: Anlage 3 zum Vertrag nach § 125 Abs. 1 SGB V („notwendige Angaben
 * auf der Heilmittelverordnung"), Abschnitt 3. Die Einstufung folgt der
 * Praxis der §302-Abgabe: was die Datenannahmestelle zurückweist, ist hier
 * `blocker`; was nur die Preisfindung stört, ist `warnung`.
 *
 * `nurGkv` heisst: bei Selbstzahler- und Privatverordnungen entfällt die
 * Angabe — dort gibt es weder Kasse noch Versichertennummer.
 */
const PFLICHTFELDER = [
  { feld: 'versichertennummer', label: 'Versichertennummer', schwere: SCHWERE.blocker, nurGkv: true },
  { feld: 'kasseIk',            label: 'Krankenkasse (IK)',  schwere: SCHWERE.blocker, nurGkv: true },
  { feld: 'ausstellungsdatum',  label: 'Ausstellungsdatum',  schwere: SCHWERE.blocker },
  { feld: 'diagnosegruppe',     label: 'Diagnosegruppe',     schwere: SCHWERE.blocker },
  { feld: 'heilmittel',         label: 'Verordnetes Heilmittel', schwere: SCHWERE.blocker },
  { feld: 'arztLanr',           label: 'Arztnummer (LANR)',  schwere: SCHWERE.warnung, nurGkv: true },
  { feld: 'arztBsnr',           label: 'Betriebsstättennummer (BSNR)', schwere: SCHWERE.warnung, nurGkv: true },
  { feld: 'frequenz',           label: 'Behandlungsfrequenz', schwere: SCHWERE.warnung },
];

const QUELLE_PFLICHT = 'Anlage 3 §125 SGB V, Abschnitt 3';
const QUELLE_FRIST   = 'HeilM-RL § 15 Abs. 1 und 2';

/** ISO-Datum von heute, ohne Zeitzonenrutsch. */
function heuteIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** „YYYY-MM-DD"? Datumsfelder werden als Zeichenkette verglichen — das ist
 *  bei ISO-Daten korrekt und umgeht jede Zeitzonenfrage. */
function istIsoDatum(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function deDatum(iso) {
  if (!istIsoDatum(iso)) return String(iso ?? '');
  const [j, m, t] = iso.split('-');
  return `${t}.${m}.${j}`;
}

function leer(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === '';
}

/**
 * Angekreuzte Leitsymptomatik auf eine Buchstabenliste bringen. Erlaubt sind
 * `['a','c']`, `{a:true,c:true}` und `"ac"` — die drei Formen, in denen sie
 * in der App vorkommt (Maske, OCR-Antwort, gespeicherter Wert).
 */
function leitsymptomatikListe(roh) {
  if (Array.isArray(roh)) return roh.map(x => String(x).toLowerCase()).filter(x => 'abcd'.includes(x));
  if (roh && typeof roh === 'object') return ['a', 'b', 'c', 'd'].filter(l => roh[l] === true);
  const s = String(roh || '').toLowerCase();
  if (/^[01]{4}$/.test(s)) return ['a', 'b', 'c', 'd'].filter((_, i) => s[i] === '1');
  return ['a', 'b', 'c', 'd'].filter(l => s.includes(l));
}

/**
 * Eine Verordnung prüfen.
 *
 * @param {object} vo  Normalisierte Verordnung:
 *   {bereich, icd, diagnosegruppe, leitsymptomatik, heilmittel, heilmittelPosition,
 *    anzahl, frequenz, ausstellungsdatum, behandlungsbeginn, dringend,
 *    versichertennummer, kasseIk, arztLanr, arztBsnr, rezeptart}
 * @param {{bereich:string, profil:object|null, gruppen:object, luecken:string[]}} regelsatz
 *   aus `regelnFuerBereich()`.
 * @param {{heute?:string}} [opt]  `heute` nur für Tests.
 * @returns {{ok:boolean, sauber:boolean, befunde:Array, geprueft:string[], ungeprueft:string[]}}
 *   `ok` = kein Blocker. `sauber` = überhaupt kein Befund.
 *   `ungeprueft` benennt, was mangels Regeldaten nicht geprüft werden konnte.
 */
export function pruefeVerordnung(vo, regelsatz, opt = {}) {
  const befunde = [];
  const geprueft = [];
  const ungeprueft = [...(regelsatz?.luecken || [])];
  const heute = opt.heute || heuteIso();

  const melde = (schwere, code, text, feld, quelle) =>
    befunde.push({ schwere, code, text, feld: feld || null, quelle: quelle || null });

  const bereich = bereichSchluessel(vo?.bereich || regelsatz?.bereich);
  const gruppen = regelsatz?.gruppen || {};
  const profil = regelsatz?.profil || null;
  // Kassenrezept? Die beiden Masken schreiben unterschiedliche Werte
  // ('gkv' bzw. 'kassen'), leer heisst ebenfalls Kasse. Alles andere —
  // privat, BG, Selbstzahler — kennt weder Kasse noch Versichertennummer,
  // dort dürfen diese Felder nicht als fehlend gemeldet werden.
  const istGkv = ['gkv', 'kassen', ''].includes(String(vo?.rezeptart ?? '').trim().toLowerCase());

  // ── 1. Pflichtangaben ────────────────────────────────────────────────────
  geprueft.push('Pflichtangaben');
  for (const p of PFLICHTFELDER) {
    if (p.nurGkv && !istGkv) continue;
    if (leer(vo?.[p.feld])) {
      melde(p.schwere, `PFLICHT_${p.feld.toUpperCase()}`, `${p.label} fehlt.`, p.feld, QUELLE_PFLICHT);
    }
  }
  const anzahl = Number(vo?.anzahl);
  if (!Number.isFinite(anzahl) || anzahl <= 0) {
    melde(SCHWERE.blocker, 'PFLICHT_ANZAHL', 'Anzahl der Behandlungseinheiten fehlt oder ist ungültig.', 'anzahl', QUELLE_PFLICHT);
  }

  // Der ICD ist nur dort Pflicht, wo die Diagnosegruppe an ihm hängt
  // (Podologie). Sonst fehlt er nicht der Verordnung, sondern der späteren
  // §302-Abgabe — das ist ein Hinweis, kein Fehler auf dem Formular.
  const icdCodes = parseIcdList(typeof vo?.icd === 'string' ? vo.icd : (vo?.icd || []).join(' '));
  if (!icdCodes.length) {
    if (profil?.pflichtIcd) {
      melde(SCHWERE.blocker, 'PFLICHT_ICD', 'ICD-10-Kode fehlt — in der Podologie bestimmt er die Diagnosegruppe.', 'icd', QUELLE_PFLICHT);
    } else if (istGkv) {
      melde(SCHWERE.hinweis, 'ICD_FEHLT', 'Kein ICD-10-Kode erfasst. Für die §302-Abgabe wird er benötigt.', 'icd', QUELLE_PFLICHT);
    }
  }

  if (leer(vo?.heilmittelPosition) && istGkv) {
    melde(SCHWERE.warnung, 'POSITION_FEHLT',
      'Dem Heilmittel ist keine Positionsnummer zugeordnet. Zuzahlung und Abrechnungspreis lassen sich damit nicht exakt ermitteln.',
      'heilmittelPosition', QUELLE_PFLICHT);
  }

  // ── 2. Diagnosegruppe bekannt ────────────────────────────────────────────
  const dg = dgWurzel(vo?.diagnosegruppe);
  const regel = dg ? gruppen[dg] : null;
  if (Object.keys(gruppen).length) {
    geprueft.push('Diagnosegruppe');
    if (dg && !regel) {
      melde(SCHWERE.blocker, 'DG_UNBEKANNT',
        `Die Diagnosegruppe „${vo.diagnosegruppe}" gehört nicht zum Fachbereich ${profil?.label || bereich}.`,
        'diagnosegruppe', profil?.quelle);
    }
  }

  // ── 3. ICD ⇄ Diagnosegruppe ──────────────────────────────────────────────
  // Einziger Matcher im Haus: `icd-dg-match.js`. Kein zweites Regelwerk.
  if (regel && regel.icd_accept.length && icdCodes.length) {
    geprueft.push('ICD ⇄ Diagnosegruppe');
    const treffer = matchIcdToDg(icdCodes, regel);
    if (treffer.status === 'mismatch') {
      const hart = regel.icd_enforcement === 'hard_before_dta';
      let text = `${icdCodes.join(', ')} passt nicht zur Diagnosegruppe ${dg}.`;
      if (treffer.hints.length) text += ` ${treffer.hints.join('; ')}`;
      if (hart) text += ' Die Kasse setzt diese Kombination ab.';
      melde(hart ? SCHWERE.blocker : SCHWERE.warnung, 'ICD_DG_MISMATCH', text, 'icd', profil?.quelle);
    } else if (treffer.status === 'unsicher') {
      melde(SCHWERE.warnung, 'ICD_DG_UNSICHER',
        `${treffer.matched.join(', ')} ist für ${dg} nicht eindeutig. ${treffer.hints.join('; ')}`.trim(),
        'icd', profil?.quelle);
    }
    if (treffer.excluded.length) {
      melde(SCHWERE.hinweis, 'ICD_AUSGESCHLOSSEN',
        `Ausgeschlossen für ${dg}: ${treffer.excluded.join(', ')}.`, 'icd', profil?.quelle);
    }
  }

  // ── 4. Höchstmenge je Verordnung ─────────────────────────────────────────
  // [Q2] Abschnitt 3 f): überschreitet die ärztliche Verordnung die
  // Höchstmenge, darf nur die zulässige Menge erbracht und abgerechnet
  // werden — der Arzt ist zu informieren. Also warnen, nicht blockieren.
  if (regel && regel.hoechstmenge != null && Number.isFinite(anzahl) && anzahl > 0) {
    geprueft.push('Höchstmenge');
    if (anzahl > regel.hoechstmenge) {
      const orient = regel.orientierendeMenge;
      let text = `Höchstmenge für ${dg} ist ${regel.hoechstmenge} Einheiten je Verordnung (verordnet: ${anzahl}). `
               + `Abrechenbar sind maximal ${regel.hoechstmenge}, die Ärztin oder der Arzt ist zu informieren.`;
      if (orient && orient > regel.hoechstmenge) {
        text += ` Die ${orient} Einheiten sind die orientierende Menge über mehrere Verordnungen hinweg — `
              + 'dafür ist eine Wiedervorstellung beim verordnenden Arzt nötig.';
      }
      melde(SCHWERE.warnung, 'UEBER_HOECHSTMENGE', text, 'anzahl', regel.hoechstmengeQuelle);
    }
  }

  // ── 5. Leitsymptomatik ⇄ verordnetes Heilmittel ──────────────────────────
  const katalog = regel?.leitsymptomatik || null;
  if (katalog) {
    geprueft.push('Leitsymptomatik');
    const gewaehlt = leitsymptomatikListe(vo?.leitsymptomatik).filter(l => l !== 'd');
    const fremd = gewaehlt.filter(l => !katalog[l]);

    if (!gewaehlt.length) {
      melde(SCHWERE.warnung, 'LS_FEHLT',
        'Keine Leitsymptomatik angekreuzt. Sie gehört zu den notwendigen Angaben.',
        'leitsymptomatik', profil?.quelle);
    } else if (fremd.length && !katalog.c) {
      // UI 1 und UI 2 kennen nur a). b) oder c) dort ist kein Auslassen der
      // Automatik, sondern ein Fehler auf der Verordnung.
      melde(SCHWERE.blocker, 'LS_UNBEKANNT',
        `${dg} kennt nur die Leitsymptomatik a) — ${fremd.map(l => `${l})`).join(' und ')} gibt es in dieser Diagnosegruppe nicht.`,
        'leitsymptomatik', profil?.quelle);
    } else {
      // In DF/NF/QF ist „a und b" genau das, was der Katalog als c)
      // („Hyperkeratose und pathologisches Nagelwachstum") führt.
      let buchstabe = gewaehlt[0];
      if (gewaehlt.includes('c')) buchstabe = 'c';
      else if (gewaehlt.length > 1 && katalog.c) buchstabe = 'c';

      const erwartet = katalog[buchstabe];
      const steht = String(vo?.heilmittel || '').trim();
      if (erwartet && steht && steht.toLowerCase() !== erwartet.toLowerCase()) {
        melde(SCHWERE.warnung, 'LS_HEILMITTEL_ABWEICHUNG',
          `Aus der Leitsymptomatik ${buchstabe}) folgt „${erwartet}" — im Heilmittelfeld steht „${steht}".`,
          'heilmittel', profil?.quelle);
      }
      if (gewaehlt.includes('c') && gewaehlt.length > 1) {
        melde(SCHWERE.hinweis, 'LS_REDUNDANT',
          'c) umfasst a) und b) bereits — die zusätzlichen Kreuze ändern nichts.',
          'leitsymptomatik', profil?.quelle);
      }
    }
  }

  // ── 6. Fristen und Datumslogik ───────────────────────────────────────────
  // [Q] HeilM-RL § 15: Behandlungsbeginn innerhalb von 28 Kalendertagen,
  // bei dringlichem Behandlungsbedarf 14. Wird die Frist versäumt, verliert
  // die Verordnung ihre Gültigkeit (Abs. 2).
  const ausst = vo?.ausstellungsdatum;
  if (istIsoDatum(ausst)) {
    geprueft.push('Fristen');
    const tage = vo?.dringend ? BEHANDLUNGSBEGINN_TAGE.dringend : BEHANDLUNGSBEGINN_TAGE.normal;
    const frist = behandlungsbeginnFrist(ausst, !!vo?.dringend);

    if (ausst > heute) {
      melde(SCHWERE.blocker, 'AUSSTELLUNG_ZUKUNFT',
        `Das Ausstellungsdatum (${deDatum(ausst)}) liegt in der Zukunft.`, 'ausstellungsdatum', QUELLE_FRIST);
    }

    const beginn = vo?.behandlungsbeginn;
    if (istIsoDatum(beginn)) {
      if (beginn < ausst) {
        melde(SCHWERE.blocker, 'BEGINN_VOR_AUSSTELLUNG',
          `Der Behandlungsbeginn (${deDatum(beginn)}) liegt vor dem Ausstellungsdatum (${deDatum(ausst)}).`,
          'behandlungsbeginn', QUELLE_FRIST);
      } else if (frist && beginn > frist) {
        melde(SCHWERE.warnung, 'FRIST_VERSAEUMT',
          `Der Behandlungsbeginn (${deDatum(beginn)}) liegt nach dem spätesten Beginn ${deDatum(frist)} `
          + `(${tage} Kalendertage ab Ausstellung${vo?.dringend ? ', dringlicher Behandlungsbedarf' : ''}). `
          + 'Damit hat die Verordnung ihre Gültigkeit verloren — bitte mit der verordnenden Praxis klären.',
          'behandlungsbeginn', QUELLE_FRIST);
      }
    } else if (frist && frist < heute) {
      melde(SCHWERE.warnung, 'FRIST_ABGELAUFEN',
        `Der späteste Behandlungsbeginn war der ${deDatum(frist)} (${tage} Kalendertage ab Ausstellung). `
        + 'Ohne begonnene Behandlung ist die Verordnung nicht mehr gültig.',
        'ausstellungsdatum', QUELLE_FRIST);
    } else if (frist) {
      melde(SCHWERE.hinweis, 'FRIST_LAEUFT',
        `Behandlungsbeginn spätestens am ${deDatum(frist)} (${tage} Kalendertage ab Ausstellung`
        + `${vo?.dringend ? ', dringlicher Behandlungsbedarf' : ''}).`,
        'ausstellungsdatum', QUELLE_FRIST);
    }
  }

  const blocker = befunde.filter(b => b.schwere === SCHWERE.blocker);
  const echteBefunde = befunde.filter(b => b.schwere !== SCHWERE.hinweis);

  return {
    ok: blocker.length === 0,
    sauber: echteBefunde.length === 0,
    befunde,
    geprueft,
    ungeprueft,
  };
}

/** Befunde nach Dringlichkeit zählen — für Knopfbeschriftung und Kurzurteil. */
export function zaehleBefunde(ergebnis) {
  const z = { blocker: 0, warnung: 0, hinweis: 0 };
  for (const b of ergebnis?.befunde || []) z[b.schwere] = (z[b.schwere] || 0) + 1;
  return z;
}
