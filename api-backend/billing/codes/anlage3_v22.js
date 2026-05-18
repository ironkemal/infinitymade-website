// § 302 SGB V — Anlage 3 V22 (Schlüsselverzeichnis), gültig ab 01.02.2027.
// Source PDF: handbücher/Anlage_3_TP5_V22_20260218.pdf
//
// All canonical code lists for §302 EDIFACT generation. Position numbers
// (§8.2.1) are NOT included — they live in the externally maintained
// "Bundeseinheitliches Heilmittelpositionsnummernverzeichnis" from GKV-SV.

export const VERARBEITUNGSKENNZEICHEN = Object.freeze({
  '01': 'Abrechnung ohne Besonderheiten',
  '02': 'Nachforderung',
  '03': 'Zuzahlungsforderung',
  '04': 'Korrekturrechnung',
  '10': 'Wiederaufnahme',
});

export const RECHNUNGSART = Object.freeze({
  '1': 'Abrechnung von Leistungserbringer, Zahlung an IK Leistungserbringer',
  '2': 'Abrechnung über Abrechnungsstelle (ohne Inkasso), Zahlung an IK LE',
  '3': 'Abrechnung über Abrechnungsstelle (mit Inkasso), Zahlung an IK Abrechnungsstelle',
});

export const ZUZAHLUNGSKENNZEICHEN = Object.freeze({
  '0': 'keine gesetzliche Zuzahlung',
  '1': 'Zuzahlungsbefreit',
  '2': 'keine Zuzahlung trotz schriftlicher Zahlungsaufforderung',
  '3': 'Zuzahlungspflichtig',
  '4': 'Übergang zuzahlungspflichtig → zuzahlungsfrei',
  '5': 'Übergang zuzahlungsfrei → zuzahlungspflichtig',
});

export const UNFALLKENNZEICHEN = Object.freeze({
  '1': 'Arbeitsunfall / Wegeunfall / Berufskrankheit',
  '2': 'sonstige Unfallfolgen',
  '3': 'Sonstiges (BVFG, BEG, HHG, OEG, IfSG, SVG)',
});

export const VERORDNUNGSBESONDERHEITEN = Object.freeze({
  '1': 'Verordnung von Zahnarzt/Kieferorthopäden',
  '2': 'Verordnung im Zusammenhang mit Schwangerschaft/Entbindung',
  '4': 'Verordnung im Rahmen des Entlassmanagements',
  '7': 'Verordnung im Rahmen der Terminservicestellen',
  '8': 'Empfehlung nach § 40 Abs. 6 SGB XI (nur Hilfsmittel)',
  '9': 'Verordnung im Rahmen eines Modellvorhabens nach § 64d SGB V',
});

export const VERORDNUNGSART_HEILMITTEL = Object.freeze({
  '03': 'orientierende Behandlungsmenge gemäß Heilmittelkatalog (§7 Abs.1-5 HeilM-RL)',
  '04': 'besonderer Verordnungsbedarf / langfristiger Heilmittelbedarf (§7 Abs.6 HeilM-RL)',
  '05': 'Blankoverordnung (§13a HeilM-RL)',
});

export const SUMMENSTATUS = Object.freeze({
  '00': 'Gesamtsumme aller Status',
  '11': 'Mitglieder (Status beginnt mit 1)',
  '31': 'Angehörige (Status beginnt mit 3)',
  '51': 'Rentner (Status beginnt mit 5)',
  '99': 'nicht zuzuordnende Status',
});

export const BELEGINFORMATION = Object.freeze({
  '0': 'keine Belegübermittlung zum Fall',
  '1': 'Belege per Post übermittelt',
  '2': 'Belege elektronisch übermittelt',
});

// §8.1.5.1 — Abrechnungscode (LE-Code). Heilmittel = Leistungsbereich B.
export const ABRECHNUNGSCODE = Object.freeze({
  '11': { label: 'Apotheke (§126 SGB V)', leistungsbereich: 'A' },
  '12': { label: 'Augenoptiker',          leistungsbereich: 'A' },
  '13': { label: 'Augenarzt',             leistungsbereich: 'A' },
  '14': { label: 'Hörgeräteakustiker',    leistungsbereich: 'A' },
  '15': { label: 'Orthopädiemechaniker / Bandagist / Sanitätshaus', leistungsbereich: 'A' },
  '16': { label: 'Orthopädieschuhmacher', leistungsbereich: 'A' },
  '17': { label: 'Orthopäde',             leistungsbereich: 'A' },
  '19': { label: 'sonstiger Hilfsmittellieferant', leistungsbereich: 'A' },
  '21': { label: 'Masseur / Med. Badebetrieb',  leistungsbereich: 'B' },
  '22': { label: 'Krankengymnast / Physiotherapeut', leistungsbereich: 'B' },
  '23': { label: 'Logopäde / Sprachtherapeut',  leistungsbereich: 'B' },
  '24': { label: 'Sprachheilpädagoge',          leistungsbereich: 'B' },
  '25': { label: 'Sonstiger Sprachtherapeut',   leistungsbereich: 'B' },
  '26': { label: 'Ergotherapeut',               leistungsbereich: 'B' },
  '27': { label: 'Krankenhaus',                 leistungsbereich: 'B' },
  '28': { label: 'Kurbetrieb',                  leistungsbereich: 'B' },
  '29': { label: 'Sonstige therapeutische Heilperson', leistungsbereich: 'B' },
  '71': { label: 'Podologe',                    leistungsbereich: 'B' },
  '72': { label: 'Med. Fußpfleger (§10 Abs.4-6 PodG)', leistungsbereich: 'B' },
  '73': { label: 'Ernährungstherapie (seltene Stoffwechselerkrankungen)', leistungsbereich: 'B' },
  '74': { label: 'Ernährungstherapie (Mukoviszidose)', leistungsbereich: 'B' },
  '31': { label: 'HKP — freigemeinnützig (Sozialstation)', leistungsbereich: 'C' },
  '32': { label: 'HKP — privatgewerblich',  leistungsbereich: 'C' },
  '33': { label: 'HKP — öffentlich',        leistungsbereich: 'C' },
  '34': { label: 'HKP — Sonstige Pflegedienste', leistungsbereich: 'C' },
  '50': { label: 'Hebamme / Entbindungspfleger', leistungsbereich: 'F' },
  // ... rest omitted for brevity — see anlage3_v22_full.json for complete list
});

// §8.1.14 — Leistungserbringer-Sammelgruppenschlüssel (UNB.S005)
export const SAMMELGRUPPE = Object.freeze({
  'A': 'Hilfsmittel',
  'B': 'Heilmittel',
  'C': 'Häusliche Krankenpflege',
  'D': 'Haushaltshilfe',
  'E': 'Krankentransportleistungen',
  'F': 'Hebammen',
  'G': 'nichtärztliche Dialysesachleistungen',
  'H': 'Rehabilitationssport',
  'I': 'Funktionstraining',
  'J': 'Sonstige Leistungserbringer',
  'K': 'Präventions-/Vorsorgeleistungen',
  'L': 'ergänzende Rehamaßnahmen',
  'M': 'Sozialpädiatrische Zentren / Frühförderstellen',
  'N': 'Soziotherapie',
  'O': 'SAPV',
  'P': '§132g SGB V',
  'Q': 'Kurzzeitpflege',
  'R': 'Außerklinische Intensivpflege (AKI)',
  'S': 'Modellvorhaben §64d SGB V',
});

// §8.1.17 — Art der Genehmigung (für SKZ-Segment). Stelle 1 = Leistungsbereich.
// Für Heilmittel relevant: B2 (langfristiger Heilmittelbedarf).
export const ART_GENEHMIGUNG_HEILMITTEL = Object.freeze({
  'B2': 'Genehmigung gem. §8 Abs.3 HeilM-RL (langfristiger Heilmittelbedarf)',
});

// §8.1.5.2 — Tarifkennzeichen, Stelle 1+2 (Tarifbereich = Bundesland/Region)
export const TARIFBEREICH = Object.freeze({
  '00': 'Bundeseinheitlicher Tarif (Ost+West)',
  '01': 'Baden-Württemberg',
  '02': 'Bayern',
  '03': 'Berlin Ost',
  '04': 'Bremen',
  '05': 'Hamburg',
  '06': 'Hessen',
  '07': 'Niedersachsen',
  '08': 'Nordrhein-Westfalen',
  '09': 'Rheinland-Pfalz',
  '10': 'Saarland',
  '11': 'Schleswig-Holstein',
  '12': 'Brandenburg',
  '13': 'Sachsen',
  '14': 'Sachsen-Anhalt',
  '15': 'Mecklenburg-Vorpommern',
  '16': 'Thüringen',
  '17': 'Stuttgart / Karlsruhe',
  '18': 'Freiburg / Tübingen',
  '19': 'Berlin West',
  '20': 'Nordrhein',
  '21': 'Westfalen-Lippe',
  '22': 'Lippe',
  '23': 'Berlin (gesamt)',
  '24': 'Bundeseinheitlicher Tarif (West)',
  '25': 'Bundeseinheitlicher Tarif (Ost)',
});

// Bundesland → tarifbereich code mapping (most common, gesetzlich)
// (Use for tarif lookup; physiotherapy tariffs are negotiated per Bundesland.)
export const BUNDESLAND_TO_TARIFBEREICH = Object.freeze({
  'BW': '01', 'BY': '02', 'BE': '23', 'BB': '12', 'HB': '04',
  'HH': '05', 'HE': '06', 'MV': '15', 'NI': '07', 'NW': '08',
  'RP': '09', 'SL': '10', 'SN': '13', 'ST': '14', 'SH': '11', 'TH': '16',
});

// Validation helpers ---------------------------------------------------------

export function isPhysioAbrechnungscode(code) {
  return ABRECHNUNGSCODE[code]?.leistungsbereich === 'B';
}

export function validateVerordnungsart(value) {
  if (!VERORDNUNGSART_HEILMITTEL[value]) {
    throw new Error(`Invalid Verordnungsart: "${value}". Allowed: ${Object.keys(VERORDNUNGSART_HEILMITTEL).join(', ')}`);
  }
}

export function validateVerarbeitungskennzeichen(value) {
  if (!VERARBEITUNGSKENNZEICHEN[value]) {
    throw new Error(`Invalid VKZ: "${value}". Allowed: ${Object.keys(VERARBEITUNGSKENNZEICHEN).join(', ')}`);
  }
}

export function validateZuzahlungskennzeichen(value) {
  if (!ZUZAHLUNGSKENNZEICHEN[value]) {
    throw new Error(`Invalid Zuzahlungskennzeichen: "${value}". Allowed: ${Object.keys(ZUZAHLUNGSKENNZEICHEN).join(', ')}`);
  }
}

export function buildTarifkennzeichen(bundesland, sondertarif = '000') {
  const t = BUNDESLAND_TO_TARIFBEREICH[bundesland];
  if (!t) throw new Error(`Unknown Bundesland: ${bundesland}`);
  if (!/^[A-Z0-9]{3}$/.test(sondertarif)) {
    throw new Error(`Sondertarif must be 3 chars, got "${sondertarif}"`);
  }
  return t + sondertarif;
}
