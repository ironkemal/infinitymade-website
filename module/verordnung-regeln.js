/**
 * verordnung-regeln.js — die Regeln der Heilmittelverordnung, an EINER Stelle.
 *
 * Herkunft
 * ────────
 * Ops-Karte 76 „Verordnung prüfen — ein Klick, ein Urteil". Die Karte war
 * ursprünglich als KI-Prüfung gedacht. Entscheidung Kemal (03.09.2026):
 * **keine KI.** Die Regeln stehen in der Richtlinie, sie sind endlich und
 * eindeutig — ein Regelwerk ist billiger, schneller und vor allem
 * nachvollziehbar. Eine KI kann nicht sagen, WARUM sie etwas beanstandet;
 * eine Regel kann den Paragrafen danebenschreiben, und genau das braucht der
 * Anwender, wenn er mit der Kasse diskutiert.
 *
 * Die offene Frage dabei war: **was passiert, wenn sich das Gesetz ändert?**
 * Darauf antwortet diese Datei. Sie ist die einzige Adresse für jede Zahl und
 * jede Liste, die aus einer Richtlinie stammt. Jeder Eintrag trägt
 *   - `quelle` — welches Dokument, welcher Abschnitt
 *   - `stand`  — Fassung und Inkrafttreten
 * Ändert sich eine Richtlinie, wird `REGELSTAND` unten durchgegangen; jede
 * Zeile dort sagt, wo die zugehörigen Werte stehen. Es gibt hier keine
 * belegfreie Zahl — steht keine Quelle daneben, gehört der Wert nicht hierher.
 *
 * Warum manche Regeln hier und andere in der Datenbank stehen
 * ──────────────────────────────────────────────────────────
 * Laufzeitquelle für die Diagnosegruppen ist die Tabelle `diagnosegruppen`
 * (Spalten `hoechstmenge`, `icd_accept`, `icd_exclude`, `icd_enforcement` …).
 * Was dort gepflegt ist, gewinnt immer. Der Stand am 03.09.2026:
 *
 *   physiotherapy  28 Gruppen — `hoechstmenge` gepflegt, `icd_accept` leer
 *   podologie       5 Gruppen — `icd_accept` gepflegt, `hoechstmenge` LEER
 *   ergotherapie   10 Gruppen — beides leer
 *   logopaedie     14 Gruppen — beides leer
 *
 * Die Podologie-Höchstmengen standen deshalb bisher hartkodiert in
 * `verordnung-podo.js`. Sie stehen jetzt hier, als benannter Rückfall mit
 * Quelle, und `verordnung-podo.js` liest sie von hier — eine Zahl, ein Ort.
 * Sobald `diagnosegruppen.hoechstmenge` für Podologie gefüllt ist, verliert
 * der Rückfall seine Wirkung von selbst (die DB gewinnt).
 *
 * Was hier NICHT hingehört
 * ────────────────────────
 * Abrechnungspositionen (HPNR 78xxx), Preise und die Frage, ob eine Leistung
 * abrechenbar ist. Das ist die Abrechnungsseite und wohnt in
 * `module/podologie-positionen.js` bzw. der Preistabelle. Hier steht nur, was
 * auf der VERORDNUNG stehen darf.
 */

// ─── [Q1] HeilM-RL i. d. F. vom 15.05.2025, iK 05.08.2025 ───────────────────
//         Heilmittelkatalog Teil II „Massnahmen der Podologischen Therapie",
//         Diagnosegruppen DF (S. 73), NF (S. 74), QF (S. 75),
//         UI 1 (S. 76), UI 2 (S. 77).
//         Datei: `verordnung rezept/HeilM-RL_2025-05-15_iK-2025-08-05.txt`
const Q1 = 'HeilM-RL 15.05.2025 (iK 05.08.2025), Heilmittelkatalog Teil II Podologie';

// ─── [Q2] Anlage 3 zum Vertrag nach § 125 Abs. 1 SGB V Podologie,
//         i. d. F. vom 16.06.2025, Abschnitt 3 f) „Behandlungseinheiten".
//         Datei: `Podoloji/Leistungen/20250617_Podologie_Anlage_3_Lesefassung.txt:390-435`
const Q2 = 'Anlage 3 §125 SGB V Podologie 16.06.2025, Abschnitt 3 f)';

/**
 * Leitsymptomatik → verordnetes Heilmittel, je Diagnosegruppe.
 *
 * [Q1] Leitsymptomatik und vorrangiges Heilmittel tragen in der Richtlinie
 * denselben Buchstaben: a↔a, b↔b, c↔c. Für DF, NF und QF ist der Katalog
 * wortgleich. UI 1 und UI 2 kennen nur eine Leitsymptomatik a) mit der
 * Nagelspangenbehandlung als vorrangigem Heilmittel.
 *
 * ⚠ Nicht mit der Abrechnungsseite verwechseln: verordnet wird
 * „Podologische Komplexbehandlung"; ob daraus 78020 („gross") oder
 * 78010 + 78030 wird, entscheidet die Therapiezeit (FAK Podologie Q25).
 * Auf der Verordnung steht der Katalogtext, nicht der Abrechnungsbegriff.
 */
export const POD_KATALOG = {
  DF:  { a: 'Hornhautabtragung', b: 'Nagelbearbeitung', c: 'Podologische Komplexbehandlung' },
  NF:  { a: 'Hornhautabtragung', b: 'Nagelbearbeitung', c: 'Podologische Komplexbehandlung' },
  QF:  { a: 'Hornhautabtragung', b: 'Nagelbearbeitung', c: 'Podologische Komplexbehandlung' },
  UI1: { a: 'Nagelspangenbehandlung' },
  UI2: { a: 'Nagelspangenbehandlung' },
};

/**
 * Höchstmenge je Verordnung — Rückfall, solange `diagnosegruppen.hoechstmenge`
 * für Podologie leer ist.
 *
 * [Q1] ⚠ Hier lag eine Besprechung daneben: „Nagelspange geht bis acht" gilt
 * nur für UI 1. UI 2 ist auf 4 je Verordnung begrenzt; die bis zu 8 Einheiten
 * sind dort die ORIENTIERENDE Menge über mehrere Verordnungen hinweg und
 * setzen eine Wiedervorstellung beim verordnenden Arzt voraus. Eine pauschale
 * 8 würde bei UI 2 Absetzungen produzieren.
 */
export const POD_HOECHSTMENGE = { DF: 6, NF: 6, QF: 6, UI1: 8, UI2: 4 };

/**
 * Orientierende Behandlungsmenge über mehrere Verordnungen hinweg.
 * [Q1] Kein hartes Limit je Verordnung — nur ein Hinweistext.
 */
export const POD_ORIENTIEREND = { UI1: 8, UI2: 8 };

/**
 * Wurzel einer Diagnosegruppe: „DF-a" → „DF", „UI 1" → „UI1".
 * Die Untergruppe a/b/c ist Leitsymptomatik, keine eigene Gruppe.
 */
export function dgWurzel(raw) {
  const v = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!v) return '';
  return v.startsWith('DF') ? 'DF' : v.split('-')[0];
}

/**
 * Fachbereich-Schlüssel vereinheitlichen. Die Tabelle `diagnosegruppen`
 * schreibt „physiotherapy" (englisch, historisch), der Rest deutsch.
 * @returns {'podologie'|'physiotherapy'|'ergotherapie'|'logopaedie'|string}
 */
export function bereichSchluessel(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  if (v.startsWith('podo')) return 'podologie';
  if (v.startsWith('physio')) return 'physiotherapy';
  if (v.startsWith('ergo')) return 'ergotherapie';
  // 'stimme' ist der Wert der Muster-13-Ankreuzfelder für
  // „Stimm-, Sprech-, Sprach- und Schlucktherapie".
  if (v.startsWith('logo') || v.startsWith('sprach') || v.startsWith('stimm')) return 'logopaedie';
  return v;
}

/**
 * Was ein Fachbereich an Regeln mitbringt — und was nicht.
 *
 * `pflichtIcd`: hängt die Diagnosegruppe an einem ICD-Kode? Podologie ja
 * (DF/NF/QF/UI1/UI2 sind über den ICD bestimmt). Physio, Ergo und Logopädie
 * verordnen über die Diagnosegruppe; ein ICD steht dort oft, ist aber nicht
 * das Ordnungsmerkmal. Ein fehlender ICD ist deshalb dort kein Fehler der
 * Verordnung — wohl aber einer für die §302-Abgabe, und genau so wird er
 * gemeldet: als Hinweis, nicht als Blocker.
 *
 * `leitsymptomatikKatalog`: nur dort gesetzt, wo wir den Katalog wirklich
 * abgebildet haben. Fehlt er, wird die Leitsymptomatik NICHT geprüft und das
 * offen gesagt, statt stillschweigend „alles in Ordnung" zu melden.
 */
export const BEREICHE = {
  podologie: {
    label: 'Podologische Therapie',
    pflichtIcd: true,
    leitsymptomatikKatalog: POD_KATALOG,
    hoechstmengeRueckfall: POD_HOECHSTMENGE,
    orientierendeMenge: POD_ORIENTIEREND,
    quelle: Q1,
    stand: 'HeilM-RL 15.05.2025, iK 05.08.2025',
  },
  physiotherapy: {
    label: 'Physiotherapie',
    pflichtIcd: false,
    leitsymptomatikKatalog: null,
    hoechstmengeRueckfall: null,   // steht in der DB
    orientierendeMenge: null,
    quelle: 'HeilM-RL 15.05.2025, Heilmittelkatalog Teil I',
    stand: 'HeilM-RL 15.05.2025, iK 05.08.2025',
  },
  ergotherapie: {
    label: 'Ergotherapie',
    pflichtIcd: false,
    leitsymptomatikKatalog: null,
    hoechstmengeRueckfall: null,   // NOCH NICHT erfasst — s. REGELSTAND
    orientierendeMenge: null,
    quelle: 'HeilM-RL 15.05.2025, Heilmittelkatalog Teil III',
    stand: 'noch nicht erfasst',
  },
  logopaedie: {
    label: 'Stimm-, Sprech-, Sprach- und Schlucktherapie',
    pflichtIcd: false,
    leitsymptomatikKatalog: null,
    hoechstmengeRueckfall: null,   // NOCH NICHT erfasst — s. REGELSTAND
    orientierendeMenge: null,
    quelle: 'HeilM-RL 15.05.2025, Heilmittelkatalog Teil IV',
    stand: 'noch nicht erfasst',
  },
};

/**
 * Regelsatz für einen Fachbereich bauen: Datenbankzeilen gewinnen, der
 * Rückfall aus dieser Datei füllt nur die Lücken.
 *
 * @param {string} bereich   'podologie' | 'physiotherapy' | 'ergotherapie' | 'logopaedie'
 * @param {Array}  dbZeilen  Zeilen aus `diagnosegruppen` (aktiv, dieser Bereich)
 * @returns {{bereich:string, profil:object|null, gruppen:object, luecken:string[]}}
 *          `gruppen` ist nach Gruppenkürzel geschlüsselt; `luecken` benennt,
 *          was mangels Regeldaten NICHT geprüft werden kann.
 */
export function regelnFuerBereich(bereich, dbZeilen = []) {
  const key = bereichSchluessel(bereich);
  const profil = BEREICHE[key] || null;
  const gruppen = {};
  const rueckfall = profil?.hoechstmengeRueckfall || {};

  for (const z of dbZeilen || []) {
    const code = dgWurzel(z?.code);
    if (!code) continue;
    const ausDb = z.hoechstmenge != null;
    gruppen[code] = {
      code,
      label:               z.label || '',
      hoechstmenge:        ausDb ? z.hoechstmenge : (rueckfall[code] ?? null),
      hoechstmengeQuelle:  ausDb ? 'diagnosegruppen.hoechstmenge'
                                 : (rueckfall[code] != null ? Q2 : null),
      orientierendeMenge:  profil?.orientierendeMenge?.[code] ?? null,
      icd_accept:          z.icd_accept          || [],
      icd_exclude:         z.icd_exclude         || [],
      icd_accept_unsicher: z.icd_accept_unsicher || [],
      icd_enforcement:     z.icd_enforcement     || 'warn',
      untergruppen:        z.untergruppen        || [],
      leitsymptomatik:     profil?.leitsymptomatikKatalog?.[code] || null,
    };
  }

  // Was können wir für diesen Bereich NICHT prüfen? Ehrlich benennen — eine
  // grüne Meldung ohne diese Angabe wäre ein Versprechen, das die Regeldaten
  // nicht decken.
  const luecken = [];
  const alle = Object.values(gruppen);
  if (!alle.length) {
    luecken.push('Für diesen Fachbereich sind keine Diagnosegruppen hinterlegt.');
  } else {
    if (!alle.some(g => g.hoechstmenge != null)) {
      luecken.push('Höchstmengen je Verordnung sind für diesen Fachbereich noch nicht erfasst.');
    }
    if (!alle.some(g => g.icd_accept.length)) {
      luecken.push('Die ICD-Zuordnung der Diagnosegruppen ist für diesen Fachbereich noch nicht erfasst.');
    }
    if (!profil?.leitsymptomatikKatalog) {
      luecken.push('Der Leitsymptomatik-Katalog ist für diesen Fachbereich noch nicht erfasst.');
    }
  }

  return { bereich: key, profil, gruppen, luecken };
}

/**
 * REGELSTAND — die Durchgehliste bei einer neuen Richtlinie.
 *
 * Beim Erscheinen einer neuen HeilM-RL oder einer neuen Anlage 3 wird diese
 * Liste von oben nach unten abgearbeitet. Jede Zeile nennt den Ort des Werts;
 * gibt es keinen Eintrag, ist die Regel nicht erfasst und wird auch nicht
 * geprüft.
 *
 * ⚠ Geltende Fassung heute: HeilM-RL 15.05.2025, in Kraft seit 05.08.2025.
 *   Für §302/DTA gilt separat Anlage 1+3 TP5 **V21** bis 31.01.2027
 *   (V22/V10 ab 01.02.2027) — eine ANDERE Versionsachse, sie steht in
 *   `Handbücher/SPEC-RULES.md`, nicht hier.
 */
export const REGELSTAND = [
  { regel: 'Behandlungsbeginn 14/28 Kalendertage', ort: 'module/heilmittel-fristen.js', quelle: 'HeilM-RL § 15' },
  { regel: 'Höchstmenge je Verordnung',            ort: 'diagnosegruppen.hoechstmenge (DB); Rückfall Podologie: POD_HOECHSTMENGE hier', quelle: `${Q1} / ${Q2}` },
  { regel: 'Orientierende Behandlungsmenge',       ort: 'POD_ORIENTIEREND hier', quelle: Q1 },
  { regel: 'Leitsymptomatik → Heilmittel',         ort: 'POD_KATALOG hier',      quelle: Q1 },
  { regel: 'ICD ⇄ Diagnosegruppe',                 ort: 'diagnosegruppen.icd_accept / icd_exclude (DB)', quelle: Q1 },
  { regel: 'Pflichtangaben der Verordnung',        ort: 'PFLICHTFELDER in module/verordnung-pruefung.js', quelle: 'Anlage 3 §125 SGB V, Abschnitt 3' },
];
