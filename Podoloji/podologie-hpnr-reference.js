/**
 * Podologie HPNR Referansdosyası
 * Kaynak: GKV-SV Heilmittelpositionsnummernverzeichnis (gültig ab 01.01.2026, Stand 15.12.2025)
 *         + FAK Podologie (23.05.2023) + Anlage 3 §125 SGB V (16.06.2025)
 *
 * Prefix kuralı: 78xxx = Podologe (ambulant), 68xxx = Krankenhaus, 88xxx = Kurort
 * Bizim scope'umuz: 78xxx (ambulant Praxis)
 */

// ─── Diagnosegruppen ───────────────────────────────────────────────────────────
//
// ⛔ NICHT AUTORITATIV — NICHT ALS DATENQUELLE KOPIEREN.
//   Diese Datei wird nirgends importiert und dient nur als Nachschlagewerk.
//   Maßgeblich ist die Tabelle `diagnosegruppen` mit den Spalten
//   `icd_accept` / `icd_exclude` / `icd_auto_select` / `icd_accept_unsicher`;
//   die Backend-Kopie derselben Regeln steht in
//   `api-backend/ai/validators/diagnosegruppen.json` (Abschnitt `podologie`).
//   Bei Abweichung gilt die Tabelle.
//
//   Das Feld `icd10_prefixes` unten ist bewusst nur noch eine grobe Merkhilfe.
//   Ein reines Präfixmodell kann die Regeln nicht abbilden, weil zwei Dinge
//   fehlen:
//     • Ausschlüsse — G63.2* (diabetische Polyneuropathie) gehört zu DF, nicht
//       zu NF; ein Präfix „G63." würde es fälschlich NF zuschlagen.
//     • Endständigkeit — G82.0 ist in ICD-10-GM 2026 nur eine
//       Gruppenüberschrift („G82.0-"); abrechenbar sind erst die fünfstelligen
//       Kodes. G82.6-! ist ein Ausrufezeichenkode (funktionale Höhe der
//       Schädigung) und niemals Hauptdiagnose.
//   Deshalb wurde die Spalte `icd_prefixes` in der Tabelle 2026-08-10 durch das
//   Regexmodell ersetzt.
//
//   Korrektur 2026-08-10: E1x.40/.41 und G63.2* standen hier fälschlich bei NF.
//   Diabetische Neuropathie ist DF (HeilM-RL § 27 Abs. 1 Nr. 1); NF ist
//   ausdrücklich die NICHT diabetische Neuropathie (§ 27 Abs. 1 Nr. 2a).

export const DIAGNOSEGRUPPEN = {
  DF: {
    code: 'DF',
    label: 'Diabetisches Fußsyndrom',
    untergruppen: ['a', 'b', 'c'],
    // E1x.74/.75 = diabetisches Fußsyndrom; E1x.40/.41 = neurologische
    // Komplikationen (diabetische Neuropathie); G63.2* = diabetische
    // Polyneuropathie, Sternkode und ohne Primärkode E1x.4x† nicht kodierfähig.
    icd10_prefixes: ['E10.74', 'E10.75', 'E11.74', 'E11.75', 'E12.74', 'E12.75', 'E13.74', 'E13.75', 'E14.74', 'E14.75',
                     'E10.40', 'E10.41', 'E11.40', 'E11.41', 'E12.40', 'E12.41', 'E13.40', 'E13.41', 'E14.40', 'E14.41',
                     'G63.2'],
    befundpauschale_erlaubt: true,   // 78030 billable
    nagelspange_erlaubt: false,
    beschreibung: 'a=leicht/b=mittel/c=schwer',
  },
  NF: {
    code: 'NF',
    label: 'Krankhafte Schädigung am Fuß als Folge einer sensiblen oder sensomotorischen Neuropathie',
    untergruppen: null,
    // NF ist die NICHT diabetische Neuropathie. G60/G61/G62 komplett sowie
    // G63.0/.1/.3–.6/.8* — G63.2* ausdrücklich NICHT (das ist DF).
    // ⛔ Diabetes-Kodes (E10–E14) gehören nie zu NF.
    icd10_prefixes: ['G60', 'G61', 'G62', 'G63.0', 'G63.1', 'G63.3', 'G63.4', 'G63.5', 'G63.6', 'G63.8'],
    befundpauschale_erlaubt: true,
    nagelspange_erlaubt: false,
  },
  QF: {
    code: 'QF',
    label: 'Krankhafte Schädigung am Fuß als Folge eines Querschnittsyndroms',
    untergruppen: null,
    // abrechenbar: G82.00–G82.59 (fünfstellig!) sowie S14.1-/S24.1-/S34.1-/T09.3.
    // ⛔ G82.6-! ist ein Ausrufezeichenkode (funktionale Höhe der Schädigung)
    //    und niemals Hauptdiagnose; G82.0–G82.6 ohne fünfte Stelle sind
    //    Gruppenüberschriften und nicht endständig.
    icd10_prefixes: ['G82.0', 'G82.1', 'G82.2', 'G82.3', 'G82.4', 'G82.5', 'S14.1', 'S24.1', 'S34.1', 'T09.3'],
    befundpauschale_erlaubt: true,
    nagelspange_erlaubt: false,
  },
  UI1: {
    code: 'UI1',
    label: 'Unguis incarnatus Stufe 1',
    untergruppen: null,
    icd10_prefixes: ['L60.0'],  // NUR L60.0 erlaubt!
    befundpauschale_erlaubt: false,  // 78030 NICHT billable! (FAQ #11)
    nagelspange_erlaubt: false,
    lokalisation_pflicht: true,  // Zehe muss dokumentiert werden (Anlage 3)
  },
  UI2: {
    code: 'UI2',
    label: 'Unguis incarnatus Stufe 2-3 + Nagelspange',
    untergruppen: null,
    icd10_prefixes: ['L60.0'],  // NUR L60.0 erlaubt!
    befundpauschale_erlaubt: false,  // 78030 NICHT billable! (FAQ #11)
    nagelspange_erlaubt: true,   // 78610/78620 erlaubt
    lokalisation_pflicht: true,  // Zehe muss dokumentiert werden (Anlage 3)
  },
};

// ─── HPNR Positionsnummern ─────────────────────────────────────────────────────

export const HPNR_PODOLOGIE = {

  // Standard-Leistungen (alle Diagnosegruppen außer wo angegeben)
  //
  // ⚠ Maßnahme ≠ Leistung. Die drei Maßnahmen (Hornhautabtragung /
  //   Nagelbearbeitung / Podologische Komplexbehandlung) sind das, was der Arzt
  //   auf Muster 13 als Heilmittel a/b/c verordnet. Abgerechnet werden sie über
  //   die Leistungen 78010 bzw. 78020 — siehe HPNR_PODOLOGIE_NICHT_ABRECHENBAR.
  '78010': {
    hpnr: '78010',
    leistungsart: 'Maßnahmen der podologischen Therapie',
    leistung: 'Podologische Behandlung (klein)',
    kuerzel: 'pod. Beh. kl.',
    massnahmen: ['Hornhautabtragung', 'Nagelbearbeitung', 'Podologische Komplexbehandlung'],
    regelleistungszeit_min: 35,
    therapiezeit_min: 20,           // + 15 Min Vor-/Nachbereitung (delegationsfähig)
    diagnosegruppen: ['DF', 'NF', 'QF'],
    kombinierbar_mit_78030: true,
    kombinierbar_mit_78040: false,  // nicht am gleichen Tag wie 78040
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    verguetung: { ab_2025_07_01: 35.16, ab_2026_07_01: 36.10 },
    quelle_detail: 'Anlage 1a Teil 2 Ziff. 1/2/3; Anlage 2 §2 Z.72, §3 Z.321',
    notiz: 'Standardposition für ALLE drei Maßnahmen. Hornhautabtragung ODER Nagelbearbeitung allein => IMMER 78010 + 78030, auch bei >20 Min Therapiezeit (FAK Q25).',
  },

  '78020': {
    hpnr: '78020',
    leistungsart: 'Maßnahmen der podologischen Therapie',
    leistung: 'Podologische Behandlung (groß)',
    kuerzel: 'pod. Beh. gr.',
    massnahmen: ['Podologische Komplexbehandlung'],   // NUR Komplexbehandlung
    nur_bei_komplexbehandlung: true,
    mindest_therapiezeit_min: 21,                     // "mehr als 20 Minuten"
    regelleistungszeit_min: 50,
    therapiezeit_min: 35,
    diagnosegruppen: ['DF', 'NF', 'QF'],
    kombinierbar_mit_78030: true,
    kombinierbar_mit_78040: false,
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV',
    verguetung: { ab_2025_07_01: 50.55, ab_2026_07_01: 51.92 },
    quelle_detail: 'Anlage 1a Z.167-171 + Teil 2 Ziff. 3 (Z.348-372); Anlage 2 §2 Z.82, §3 Z.332',
    notiz: 'NUR wenn Arzt die Komplexbehandlung (Heilmittel c) verordnet hat UND Therapiezeit >20 Min. Bei Einzelmaßnahme (Heilmittel a oder b) NICHT abrechenbar — sonst Retaxation.',
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
    // „Grad 2/3" ist der Nagelschweregrad, KEINE Diagnosegruppe — eine
    // Diagnosegruppe UI3 gibt es nicht (Stadium 3 wird über UI2 verordnet).
    leistung: 'Aufschlag für besonderen Aufwand (+15 Min, bei Kindern <14 J. oder Nagelschweregrad 2/3)',
    diagnosegruppen: ['UI1', 'UI2'],
    kombinierbar_mit_78030: false,
    lokalisation_pflicht: true,
    gueltig_ab: '2025-10-01',
    gueltig_bis: '9999-12-31',
    grundlage: '§125 Abs. 1 SGB V',
    quelle: 'GKV-SV Anlage 1c (16.06.2025)',
    aenderung: 'Neu aufgenommen 01.07.2025 (Anlage 1c)',
    max_pro_termin: 2,
    notiz: 'Aufschlag bei Kindern <14 Jahren ODER Nagelschweregrad 2/3. Max 2x je Behandlungstermin. Nagelschweregrad ≠ Diagnosegruppe; UI3 existiert nicht.',
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

// ─── Maßnahmen-Ebene: existiert im Verzeichnis, ist aber NICHT abrechenbar ─────
//
// Die Positionsnummern 78001–78006 stehen im GKV-SV
// Heilmittelpositionsnummernverzeichnis (gültig ab 01.01.2026), sind aber NICHT
// Bestandteil der Vergütungsvereinbarung (Anlage 2 i.d.F. 01.07.2025) —
// kein Preis => nicht abrechenbar. Niemals in der SLLA senden: der Kostenträger
// setzt sie ab (Nullretaxation).
//
// Erkennungsmerkmal im Verzeichnis: Spalten `Grundlage` und `Eigentümer` leer.
// Nicht neu in 2026 (gültig ab 1900-01-01) — sie fehlten in dieser Datei bisher
// zu Recht, nur ohne dokumentierten Grund. Dieser Eintrag ist die Dokumentation.
export const HPNR_PODOLOGIE_NICHT_ABRECHENBAR = {
  '78001': { leistung: 'Hornhautabtragung',                          abrechnen_mit: ['78010', '78030'] },
  '78002': { leistung: 'Nagelbearbeitung',                           abrechnen_mit: ['78010', '78030'] },
  '78003': { leistung: 'Podologische Komplexbehandlung',             abrechnen_mit: ['78010', '78030'] },
  '78004': { leistung: 'Hornhautabtragung an einem Fuß',             abrechnen_mit: ['78010', '78030'] },
  '78005': { leistung: 'Nagelbearbeitung an einem Fuß',              abrechnen_mit: ['78010', '78030'] },
  '78006': { leistung: 'Podologische Komplexbehandlung an einem Fuß', abrechnen_mit: ['78010', '78030'] },
  _meta: {
    grund: 'Keine Vergütung in Anlage 2 (§125 Abs. 1 SGB V, i.d.F. 01.07.2025); Grundlage- und Eigentümer-Spalte im HPNR-Verzeichnis leer',
    quelle: 'Podologie_Positionsnummern_2026_Filtered.csv Z.2-19; Anlage 2 (0 Treffer für 7800x)',
    gueltig_ab: '1900-01-01',
    gueltig_bis: '9999-12-31',
    notiz: 'Maßnahmen-Ebene, nicht Leistungs-Ebene. Die Maßnahme wird über 78010/78020 abgerechnet.',
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
    regel: '78020_nur_komplexbehandlung',
    beschreibung: '78020 nur bei verordneter Podologischer Komplexbehandlung (Heilmittel c)',
    check: (verordnetesHeilmittel, hpnrList) =>
      hpnrList.includes('78020') && verordnetesHeilmittel !== 'Podologische Komplexbehandlung',
    fehler: 'Podologische Behandlung (groß) / 78020 ist nur bei verordneter Komplexbehandlung abrechenbar. Bei Hornhautabtragung oder Nagelbearbeitung allein ist immer 78010 zzgl. 78030 abzurechnen.',
    quelle: 'FAK Podologie Q25 (24.05.2023); Anlage 1a i.d.F. 17.06.2024, Teil 1 Z.167-171',
    notiz: 'Voraussetzung: das verordnete Heilmittel (Muster 13, Feld g1 — a/b/c) muss persistiert werden. Feld existiert in `verordnungen` noch NICHT.',
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
