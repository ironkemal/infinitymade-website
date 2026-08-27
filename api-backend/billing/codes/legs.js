// § 302 SGB V — Leistungserbringergruppenschlüssel (LEGS) für Heilmittel.
//
// WARUM ES DIESE DATEI GIBT
// -------------------------
// Der LEGS wurde vorher aus der Postleitzahl der Praxis abgeleitet:
// `buildTarifkennzeichen(getBundeslandFromPlz(profile.zip))` ergab für eine
// Praxis in NRW den Tarifbereich '08' und damit z. B. den LEGS '7108000'.
// Diesen Schlüssel gibt es in keinem Heilmittelvertrag. Jede so erzeugte
// DTA-Datei trug einen ungültigen LEGS — unabhängig davon, ob die PLZ
// richtig erkannt wurde.
//
// Der LEGS ist KEINE geografische Angabe. Anlage 1 TP5 V21, 5.5.3.3
// (SLLA:B, EHE-Segment):
//
//   „Die Kennzeichnung ‚Leistungserbringergruppe' wird für die Abrechnung
//    benötigt, da hierüber die Zuordnung zur gültigen vertraglichen
//    Vereinbarung und damit zu den Abrechnungspositionsnummern erfolgt.
//    Jede Vereinbarung sieht entsprechende Kennzeichen vor. Dieses ist
//    entsprechend den Vergütungsregeln anzugeben."
//
// Quelle ist also der Vertrag, nicht der Ort. Alle vier §125-Verträge sind
// bundeseinheitlich, deshalb steht im Tarifbereich (Stelle 3–4) überall '00'.
// Variabel ist der Status des Leistungserbringers, nicht das Bundesland.
//
// AUFBAU (Anlage 3 TP5 V21, §8.1.5 S. 12 und §8.1.5.2 S. 17–19)
// -------------------------------------------------------------
//   Stelle 1–2  Abrechnungscode
//   Stelle 3–7  Tarifkennzeichen, davon
//     Stelle 3–4  Tarifbereich   ('00' = bundeseinheitlich, gültig Ost und West)
//     Stelle 5–7  Sondertarif    (501 = ZL, 511/531/541 = §124 Abs. 5 je Bereich)
//
// QUELLEN je Fachbereich (§125 Abs. 1 SGB V, jeweils Anlage 2, Seite 1)
// ---------------------------------------------------------------------
//   Physio  Handbücher/20251201_Physiotherapie_Vertrag_125_Anlage_2_barrierefrei.txt:12
//   Ergo    Handbücher/20240531_Ergo_Anlage_2_..._BF.txt:20
//   SSSST   Handbücher/20260212_Vertrag_125_sssst_Anlage_2_...txt:14-16
//   Podo    Podoloji/Leistungen/20250617_Podologie_Anlage_2.txt:49-52
//
// Im Physio- und Ergo-Vertrag steht dazu ausdrücklich:
// „Bitte im maschinellen Datenaustausch angeben!!!"

// Status des Leistungserbringers. Bestimmt den Sondertarif.
//   ZL  = zugelassener Leistungserbringer, § 124 Abs. 1 i. V. m. Abs. 2 SGB V
//   KH  = Krankenhaus,   § 124 Abs. 5 SGB V
//   KUR = Kurbetrieb,    § 124 Abs. 5 SGB V
//   SON = sonstige Einrichtung, § 124 Abs. 5 SGB V (nur Physio und Ergo)
export const LE_STATUS = Object.freeze({
  ZL: 'ZL',
  KH: 'KH',
  KUR: 'KUR',
  SON: 'SON',
});

// Fachbereich → LE-Status → 7-stelliger LEGS.
//
// Bei Physio und Podo hängt der ZL-Schlüssel zusätzlich an der Qualifikation
// der Praxis (Masseur vs. Physiotherapeut, Podologe vs. med. Fußpfleger).
// Deshalb ist ZL dort ein Objekt und kein einzelner Wert.
export const LEGS_BY_FACHBEREICH = Object.freeze({
  physiotherapy: Object.freeze({
    ZL: Object.freeze({
      masseur:        '2100501',  // Masseur / med. Bademeister
      physiotherapie: '2200501',  // Physiotherapeut / Krankengymnast — Regelfall
    }),
    ZL_DEFAULT: 'physiotherapie',
    KH:  '2700511',
    KUR: '2800511',
    SON: '2900511',
  }),
  ergotherapie: Object.freeze({
    ZL:  '2600501',
    KH:  '2700531',
    KUR: '2800531',
    SON: '2900531',
  }),
  logopaedie: Object.freeze({
    // SSSST = Stimm-, Sprech-, Sprach- und Schlucktherapie.
    // Drei ZL-Schlüssel nach Ausbildung; 2300501 ist der Regelfall (Logopäde).
    ZL: Object.freeze({
      logopaedie:     '2300501',
      sprachtherapie: '2400501',
      atem_stimme:    '2500501',
    }),
    ZL_DEFAULT: 'logopaedie',
    // Der SSSST-Vertrag führt keine § 124 Abs. 5 Schlüssel — es gibt dort
    // keine KH-/Kur-Variante. Absichtlich nicht belegt.
  }),
  podologie: Object.freeze({
    ZL: Object.freeze({
      podologe:       '7100501',  // Podologe — Regelfall
      med_fusspfleger:'7200501',  // med. Fußpfleger, § 10 Abs. 4 bis 6 PodG
    }),
    ZL_DEFAULT: 'podologe',
    KH:  '2700541',
    KUR: '2800541',
    // Kein '29…541' im Podologie-Vertrag — dort sind nur KH und Kurbetrieb
    // aufgeführt. Absichtlich nicht belegt.
  }),
});

/**
 * Liefert den vollständigen 7-stelligen LEGS.
 *
 * @param {string} fachbereich  'physiotherapy' | 'ergotherapie' | 'logopaedie' | 'podologie'
 * @param {object} [opts]
 * @param {string} [opts.status='ZL']      LE_STATUS-Wert
 * @param {string} [opts.qualifikation]    nur bei ZL und nur dort, wo der Vertrag
 *                                         mehrere ZL-Schlüssel kennt; ohne Angabe
 *                                         greift ZL_DEFAULT (der Regelfall).
 * @returns {string} 7 Stellen, z. B. '7100501'
 */
export function legsFuer(fachbereich, opts = {}) {
  const eintrag = LEGS_BY_FACHBEREICH[fachbereich];
  if (!eintrag) {
    throw new Error(
      `Unbekannter Fachbereich für LEGS: "${fachbereich}". ` +
      `Erlaubt: ${Object.keys(LEGS_BY_FACHBEREICH).join(', ')}`
    );
  }

  const status = opts.status || LE_STATUS.ZL;
  const wert = eintrag[status];

  if (!wert) {
    throw new Error(
      `Für "${fachbereich}" ist der Status "${status}" vertraglich nicht vorgesehen. ` +
      `Belegt: ${Object.keys(eintrag).filter((k) => k !== 'ZL_DEFAULT').join(', ')}`
    );
  }

  // Status mit nur einem Schlüssel (KH/KUR/SON, Ergo-ZL).
  if (typeof wert === 'string') return wert;

  // ZL mit mehreren Qualifikationen.
  const qual = opts.qualifikation || eintrag.ZL_DEFAULT;
  const legs = wert[qual];
  if (!legs) {
    throw new Error(
      `Unbekannte Qualifikation "${qual}" für "${fachbereich}". ` +
      `Erlaubt: ${Object.keys(wert).join(', ')}`
    );
  }
  return legs;
}

/** Stelle 1–2 des LEGS. */
export function abrechnungscodeAusLegs(legs) {
  return legs.slice(0, 2);
}

/** Stelle 3–7 des LEGS. */
export function tarifkennzeichenAusLegs(legs) {
  return legs.slice(2);
}

// Alle vertraglich zulässigen LEGS, flach. Die Preflight-Prüfung schlägt
// gegen diese Menge — ein formal gültiger, aber vertraglich nicht
// existierender Wert wie '7108000' fällt dort auf.
export const GUELTIGE_LEGS = Object.freeze(
  [...new Set(
    Object.values(LEGS_BY_FACHBEREICH).flatMap((eintrag) =>
      Object.entries(eintrag)
        .filter(([k]) => k !== 'ZL_DEFAULT')
        .flatMap(([, v]) => (typeof v === 'string' ? [v] : Object.values(v)))
    )
  )].sort()
);

export function istGueltigerLegs(legs) {
  return GUELTIGE_LEGS.includes(legs);
}
