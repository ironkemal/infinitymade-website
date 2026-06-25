/**
 * Podologie HPNR Referansdosyası
 * Kaynak: GKV-SV Heilmittelpositionsnummernverzeichnis (gültig ab 01.01.2026, Stand 15.12.2025)
 *         + FAK Podologie (23.05.2023) + Anlage 3 §125 SGB V (16.06.2025)
 *
 * Prefix kuralı: 78xxx = Podologe (ambulant), 68xxx = Krankenhaus, 88xxx = Kurort
 * Bizim scope'umuz: 78xxx (ambulant Praxis)
 */

// ─── Diagnosegruppen ───────────────────────────────────────────────────────────

export const DIAGNOSEGRUPPEN = {
  DF: {
    code: 'DF',
    label: 'Diabetisches Fußsyndrom',
    untergruppen: ['a', 'b', 'c'],
    icd10: ['E10.74', 'E10.75', 'E11.74', 'E11.75', 'E12.74', 'E12.75', 'E13.74', 'E13.75', 'E14.74', 'E14.75', 'G63.2'],
    befundpauschale_erlaubt: true,   // 78030 billable
    nagelspange_erlaubt: false,
    beschreibung: 'a=leicht/b=mittel/c=schwer',
  },
  NF: {
    code: 'NF',
    label: 'Neuropathisches Fußsyndrom',
    untergruppen: null,
    icd10: ['G60.0', 'G63.2', 'E10.40', 'E11.40'],  // Beispiele, nicht abschließend
    befundpauschale_erlaubt: true,
    nagelspange_erlaubt: false,
  },
  QF: {
    code: 'QF',
    label: 'Querschnittslähmung',
    untergruppen: null,
    icd10: ['G82.0', 'G82.1', 'G82.2', 'G82.3', 'G82.4', 'G82.5'],
    befundpauschale_erlaubt: true,
    nagelspange_erlaubt: false,
  },
  UI1: {
    code: 'UI1',
    label: 'Unguis incarnatus Stufe 1',
    untergruppen: null,
    icd10: ['L60.0'],  // NUR L60.0 erlaubt!
    befundpauschale_erlaubt: false,  // 78030 NICHT billable! (FAQ #11)
    nagelspange_erlaubt: false,
    lokalisation_pflicht: true,  // Zehe muss dokumentiert werden (Anlage 3)
  },
  UI2: {
    code: 'UI2',
    label: 'Unguis incarnatus Stufe 2-3 + Nagelspange',
    untergruppen: null,
    icd10: ['L60.0'],  // NUR L60.0 erlaubt!
    befundpauschale_erlaubt: false,  // 78030 NICHT billable! (FAQ #11)
    nagelspange_erlaubt: true,   // 78610/78620 erlaubt
    lokalisation_pflicht: true,  // Zehe muss dokumentiert werden (Anlage 3)
  },
};

// ─── HPNR Positionsnummern ─────────────────────────────────────────────────────

export const HPNR_PODOLOGIE = {

  // Standard-Leistungen (alle Diagnosegruppen außer wo angegeben)
  '78010': {
    hpnr: '78010',
    leistungsart: 'Podologische Behandlung',
    leistung: 'Podologische Komplexbehandlung (Hornhautabtragung + Nagelbehandlung)',
    diagnosegruppen: ['DF', 'NF', 'QF'],
    kombinierbar_mit_78030: true,
    kombinierbar_mit_78040: false,  // nicht am gleichen Tag wie 78040
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    notiz: 'Standardbehandlung für DFS/NF/QF. Auch wenn Behandlung >20 Min — KEINE höhere Position',
  },

  '78020': {
    hpnr: '78020',
    leistungsart: 'Podologische Behandlung',
    leistung: 'Hornhautabtragung',
    diagnosegruppen: ['DF', 'NF', 'QF'],
    kombinierbar_mit_78030: true,
    kombinierbar_mit_78040: false,
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
  },

  '78030': {
    hpnr: '78030',
    leistungsart: 'Befundpauschale',
    leistung: 'Befundpauschale — je Behandlungstag',
    diagnosegruppen: ['DF', 'NF', 'QF'],  // NICHT UI1/UI2 (FAQ #11)
    kombinierbar_mit_78010: true,
    kombinierbar_mit_78020: true,
    kombinierbar_mit_78040: false,  // 78040 und 78030 nicht am gleichen Tag
    kombinierbar_mit_ui1_ui2: false,  // STRIKT VERBOTEN
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    notiz: 'Pflicht bei jedem Behandlungstag außer UI1/UI2. Nicht am gleichen Tag wie 78040.',
  },

  '78040': {
    hpnr: '78040',
    leistungsart: 'Eingangsbefundung',
    leistung: 'Eingangsbefundung — einmalig je Patient (Lebenszeit)',
    diagnosegruppen: ['DF', 'NF', 'QF'],
    kombinierbar_mit_78030: false,  // NICHT am gleichen Tag wie 78030
    einmalig_pro_patient: true,     // Nur 1x im Leben des Patienten abrechenbar
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    notiz: 'Einmalig je Patient (Lebenszeit). Nicht zusammen mit 78030 am selben Tag.',
  },

  // Nagelspange (neu ab 01.10.2025 — ersetzt 78210/78220/78230/78300/78400)
  '78610': {
    hpnr: '78610',
    leistungsart: 'Nagelspange',
    leistung: 'Nagelkorrekturspange anlegen (nach DIN 14021)',
    diagnosegruppen: ['UI2'],
    kombinierbar_mit_78030: false,
    lokalisation_pflicht: true,
    gueltig_ab: '2025-10-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    aenderung: 'Neu aufgenommen 11.04.2025 (HPNR-Liste 2025/2026)',
    ersetzt: ['78210', '78220', '78230', '78300', '78400'],
    notiz: 'Ersetzt alle alten Nagelspange-Codes ab 01.10.2025. Lokalisation (Zehe) im Begründungsfeld.',
  },

  '78620': {
    hpnr: '78620',
    leistungsart: 'Nagelspange',
    leistung: 'Aufschlag für besonderen Aufwand (+15 Min, bei Kinder <14 J. oder Nagel UI2/UI3)',
    diagnosegruppen: ['UI1', 'UI2'],
    kombinierbar_mit_78030: false,
    lokalisation_pflicht: true,
    gueltig_ab: '2025-10-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV Anlage 1c (16.06.2025)',
    aenderung: 'Neu aufgenommen 01.07.2025 (Anlage 1c)',
    max_pro_termin: 2,
    notiz: 'Aufschlag bei Kinder <14 Jahren ODER Nagelschweregrad UI2/3. Max 2x je Behandlungstermin.',
  },

  // Therapiebericht UI2
  '78530': {
    hpnr: '78530',
    leistungsart: 'Therapiebericht',
    leistung: 'Therapiebericht UI 2',
    diagnosegruppen: ['UI2'],
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    notiz: 'Therapiebericht an verordnenden Arzt. Nur bei Diagnosegruppe UI2. Keine Zuzahlung.',
  },

  // Erstbefundung UI1/UI2
  '78100': {
    hpnr: '78100',
    leistungsart: 'Erstbefundung',
    leistung: 'Erstbefundung groß (UI)',
    diagnosegruppen: ['UI1', 'UI2'],
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    notiz: '1x pro Kalenderjahr (ab Anlage 1c 01.07.2025: nicht mehr nur Erstpatienten). 45 Min.',
  },
  '78110': {
    hpnr: '78110',
    leistungsart: 'Erstbefundung',
    leistung: 'Erstbefundung klein (UI)',
    diagnosegruppen: ['UI1', 'UI2'],
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    notiz: '20 Min. Alternativ zu 78100.',
  },
  '78510': {
    hpnr: '78510',
    leistungsart: 'Nagelspange',
    leistung: 'Indikationsspezifische Kontrolle Sitz- und Passgenauigkeit',
    diagnosegruppen: ['UI1', 'UI2'],
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    notiz: '15 Min.',
  },
  '78520': {
    hpnr: '78520',
    leistungsart: 'Nagelspange',
    leistung: 'Behandlungsabschluss / Entfernung Nagelkorrekturspange',
    diagnosegruppen: ['UI1', 'UI2'],
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    notiz: '25 Min.',
  },

  // Hausbesuche (eigenständige HPNR — KEIN Zuschlag auf 78xxx)
  '79933': {
    hpnr: '79933',
    leistungsart: 'Hausbesuch',
    leistung: 'Hausbesuch (ärztl. verordnet), inkl. Wegegeld',
    diagnosegruppen: ['DF', 'NF', 'QF', 'UI1', 'UI2'],
    voraussetzung: 'Feld "Hausbesuch = Ja" auf Muster 13 muss angekreuzt sein',
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
  },
  '79934': {
    hpnr: '79934',
    leistungsart: 'Hausbesuch',
    leistung: 'Hausbesuch in soz. Einrichtung, inkl. Wegegeld',
    diagnosegruppen: ['DF', 'NF', 'QF', 'UI1', 'UI2'],
    voraussetzung: 'Feld "Hausbesuch = Ja" auf Muster 13 muss angekreuzt sein',
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
  },
};

// Alte Nagelspange-Codes — ab 01.10.2025 ungültig
export const HPNR_PODOLOGIE_DEPRECATED = {
  '78210': { label: 'Nagelkeil (alt)', ungueltig_ab: '2025-10-01', ersetzt_durch: '78610' },
  '78220': { label: 'Nagelkeil (alt)', ungueltig_ab: '2025-10-01', ersetzt_durch: '78610' },
  '78230': { label: 'Nagelkeil (alt)', ungueltig_ab: '2025-10-01', ersetzt_durch: '78610' },
  '78300': { label: 'Nagelspange (alt)', ungueltig_ab: '2025-10-01', ersetzt_durch: '78610' },
  '78400': { label: 'Nagelspange (alt)', ungueltig_ab: '2025-10-01', ersetzt_durch: '78610' },
};

// ─── Verordnungs-Regeln (Muster 13) ───────────────────────────────────────────

export const VERORDNUNG_REGELN = {
  behandlungsstart: {
    normal_tage: 28,        // Ab Ausstellungsdatum (Tag 0 = Ausstellungstag)
    dringend_tage: 14,      // Bei dringlichem Behandlungsbedarf
    zaehlweise: 'Tag der Ausstellung = Tag 0, nächster Tag = Tag 1',
  },
  frequenzabweichung: {
    erlaubte_werktage: 2,   // ±2 Werktage ohne Rücksprache mit Arzt erlaubt (FAQ #22)
  },
  unterbrechung: {
    max_wochen_ohne_ungueltig: 12,  // Unterbrechungen <12 Wochen lassen Rezept gültig
    notiz: 'Bei >12 Wochen Unterbrechung wird Verordnung ungültig (FAQ)',
  },
  pflichtfelder: [
    { feld: 'personalienfeld', pflicht: true, beschreibung: 'Name, GdB, Versicherungsnummer, KK, LANR, BSNR, Datum' },
    { feld: 'behandlungseinheiten', pflicht: true, beschreibung: 'Anzahl Behandlungen' },
    { feld: 'heilmittel_g1', pflicht: true, beschreibung: 'Heilmittelangabe (g1)' },
    { feld: 'therapiefrequenz_i', pflicht: true, beschreibung: 'Behandlungsfrequenz' },
    { feld: 'diagnosegruppe_j', pflicht: true, beschreibung: 'DF/NF/QF/UI1/UI2' },
    { feld: 'icd10_k', pflicht: true, beschreibung: 'ICD-10 Code(s)' },
    { feld: 'leitsymptomatik_l', pflicht: true, beschreibung: 'a/b/c oder Freitext' },
    { feld: 'arztunterschrift_n', pflicht: true, beschreibung: 'Arzt Unterschrift + Stempel' },
    { feld: 'bestaetigung_o', pflicht: true, beschreibung: 'Rückseite: Patientenunterschrift' },
    { feld: 'rechnungsdaten_p', pflicht: true, beschreibung: 'IK Leistungserbringer' },
    { feld: 'leistungserbringer_stempel_r', pflicht: true, beschreibung: 'Praxis-Stempel' },
  ],
  optionale_felder: [
    { feld: 'hausbesuch', beschreibung: 'Wenn angekreuzt: 79933 (ärztl. verordnet) oder 79934 (soz. Einrichtung) abrechenbar' },
    { feld: 'therapiebericht', beschreibung: 'Wenn verordnet: Bericht an Arzt schicken' },
    { feld: 'begruendung', beschreibung: 'Pflicht bei UI1/UI2: Lokalisation der Zehe' },
  ],
};

// ─── Validierungslogik (für Billing-Engine) ────────────────────────────────────

export const VALIDIERUNGS_REGELN = [
  {
    regel: 'ui_kein_78030',
    beschreibung: '78030 nicht bei UI1 oder UI2',
    check: (diagnosegruppe, hpnrList) =>
      ['UI1', 'UI2'].includes(diagnosegruppe) && hpnrList.includes('78030'),
    fehler: 'Befundpauschale (78030) ist bei Diagnosegruppe UI1/UI2 nicht abrechenbar.',
    quelle: 'FAK Podologie Q11',
  },
  {
    regel: 'ui_nur_l60',
    beschreibung: 'UI1/UI2 nur mit ICD-10 L60.0',
    check: (diagnosegruppe, icd10) =>
      ['UI1', 'UI2'].includes(diagnosegruppe) && icd10 !== 'L60.0',
    fehler: 'Diagnosegruppe UI1/UI2 erfordert ausschließlich ICD-10 L60.0.',
    quelle: 'Anlage 3, Abschnitt j',
  },
  {
    regel: '78040_nicht_mit_78030',
    beschreibung: '78040 und 78030 nicht am selben Tag',
    check: (hpnrList) => hpnrList.includes('78040') && hpnrList.includes('78030'),
    fehler: 'Eingangsbefundung (78040) und Befundpauschale (78030) nicht am gleichen Tag abrechenbar.',
    quelle: 'GKV Podologie Vertrag §125',
  },
  {
    regel: '78040_einmalig',
    beschreibung: '78040 nur einmal pro Patient im Leben',
    quelle: 'GKV Podologie Vertrag §125',
    notiz: 'Backend muss prüfen ob 78040 bereits für diesen Patienten abgerechnet wurde.',
  },
  {
    regel: 'nagelspange_nur_ui2',
    beschreibung: '78610/78620 nur bei UI2',
    check: (diagnosegruppe, hpnrList) =>
      !['UI2'].includes(diagnosegruppe) && (hpnrList.includes('78610') || hpnrList.includes('78620')),
    fehler: 'Nagelspange (78610/78620) nur bei Diagnosegruppe UI2 abrechenbar.',
    quelle: 'Änderungshistorie HPNR 2025',
  },
  {
    regel: 'ui_lokalisation_pflicht',
    beschreibung: 'UI1/UI2 braucht Zehenangabe im Begründungsfeld',
    quelle: 'Anlage 3, Begründungsfeld',
    notiz: 'Muss einmal pro Verordnung im Begründungsfeld dokumentiert sein.',
  },
  {
    regel: 'behandlungsstart_28_tage',
    beschreibung: 'Behandlung innerhalb 28 Tagen ab Ausstellungsdatum',
    quelle: 'FAK Q2',
  },
  {
    regel: 'alte_nagelspange_codes',
    beschreibung: '78210/78220/78230/78300/78400 ab 01.10.2025 ungültig',
    check: (hpnrList) =>
      hpnrList.some(c => ['78210','78220','78230','78300','78400'].includes(c)),
    fehler: 'Alte Nagelspange-Codes ungültig ab 01.10.2025. Bitte 78610/78620 verwenden.',
    quelle: 'HPNR-Liste 2025, Änderungshistorie 11.04.2025',
  },
  {
    regel: 'hausbesuch_zuschlag',
    beschreibung: '79933/79934 nur wenn HVO Hausbesuch-Feld angekreuzt',
    quelle: 'Anlage 3, Feld Hausbesuch (§c)',
  },
];
