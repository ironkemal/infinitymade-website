// § 302 DTA file builder — Anlage 1 V21 format, Heilmittel (Leistungsbereich B).
//
// Dateieinheit ist DAV × Kassenart (Kap. 5.3.1) — nicht Kostenträger. Innerhalb
// der Datei wird zweistufig gruppiert: je Kostenträger-IK, darin je Karten-IK.
// Jede Karten-IK-Gruppe ist EINE Gesamtrechnung mit eigener SLGA und eigenen
// GES-Summen. Die Summe der ganzen Datei steht in keinem GES-Segment.
//
// Output structure:
//   UNA
//   UNB ... B ...                              // Leistungsbereich B
//     [UNH SLGA:21:0:0]                        // nur bei Sammelrechnung:
//       FKT('J', IK-KK leer) REC GES* NAM      //   kein UST
//     [UNT]
//     UNH SLGA:21:0:0                          // je Karten-IK eine Gesamtrechnung
//       FKT('', IK-KK gesetzt) REC [UST] [SKO]* GES* NAM
//     UNT
//     UNH SLLA:21:0:0
//       FKT REC INV [URI] NAD [IMG] [EVO]
//         (EHE [TXT] [MWS])+
//       ZHE DIA+ [SKZ] (BES | GZF)
//     UNT
//     ... SLLA je Abrechnungsfall dieser Gesamtrechnung ...
//     ... naechste Gesamtrechnung ...
//   UNZ
//
// Die frühere Annahme „eine Krankenkasse je Datei" (Faz A2) ist damit
// aufgehoben. Sie war nicht bloss eine Vereinfachung: der Builder nahm
// prescriptions[0] fuer die ganze Datei und rechnete die GES-Summen ueber
// alle Rezepte — mit einer zweiten Karten-IK ergab das still falsche Summen.

import { UNA_HEADER } from './encoding.js';
import { calcSessionZuzahlung } from '../zuzahlung/calculator.js';
import {
  buildUNB, buildUNH, buildUNT, buildUNZ,
} from './envelope.js';
import {
  buildSLGA_FKT, buildSLGA_REC, buildSLGA_UST, buildSLGA_SKO,
  buildSLGA_GES, buildSLGA_NAM,
  buildSLLA_FKT, buildSLLA_REC, buildSLLA_INV, buildSLLA_URI,
  buildSLLA_NAD, buildSLLA_IMG, buildSLLA_EVO,
  buildSLLA_EHE, buildSLLA_TXT, buildSLLA_MWS,
  buildSLLA_ZHE, buildSLLA_DIA, buildSLLA_SKZ,
  buildSLLA_BES, buildSLLA_GZF,
} from './segments.js';
import { buildLogischerDateiname, buildPhysikalischerDateiname } from './filename.js';
import {
  validateVerarbeitungskennzeichen,
  validateVerordnungsart,
  validateZuzahlungskennzeichen,
  isPhysioAbrechnungscode,
} from '../codes/anlage3_v22.js';
import { preflight as runPreflight } from './preflight.js';

const num = (v) => Number(v) || 0;
const r2 = (v) => +Number(v).toFixed(2);

// ---------------------------------------------------------------------------
// Input shape (per prescription):
// {
//   patient: { kvnr, versichertenstatus, nachname, vorname, geburtsdatum,
//              strasse?, plz?, ort?, laenderkennzeichen?, belegnummer },
//   doctor:  { lanr, bsnr },
//   verordnung: {
//     ausstellungsdatum, icd10, diagnosetext?, diagnosegruppe,
//     verordnungsart, verordnungsbesonderheiten?, unfallkennzeichen?,
//     hausbesuch?, leitsymptomatik, patLeitsymptomatik?,
//     dringend, heilmittelBereich = '1', therapiefrequenz,
//     zuzahlungskennzeichen,        // '0'=zuzahlungspflichtig, '1'=befreit
//     kostentraegerIk, krankenkasseIk,
//     genehmigung?: { kennzeichen, datum, art },
//     evoId?,
//   },
//   tarif:   { abrechnungscode = '22', tarifkennzeichen },
//   sessions: [{ positionsnummer, datumLeistung, anzahl?, einzelbetrag, zuzahlungProPos? }],
// }
// ---------------------------------------------------------------------------

function calcAbrechnungsfallTotals(item) {
  const { sessions, verordnung } = item;
  const brutto = r2(sessions.reduce((a, s) => a + num(s.einzelbetrag) * num(s.anzahl || 1), 0));
  let prozZuzahlung = 0, pauschZuzahlung = 0;
  if (verordnung.zuzahlungskennzeichen === '0') {
    // Zweite Zuzahlungsformel entfernt (Aufgabe 2): hier stand
    // `s.zuzahlungProPos || s.einzelbetrag * 0.10`. Bei einer Zuzahlung von
    // GENAU 0 € — also einer zuzahlungsfreien Position — ist 0 falsy, dadurch
    // kippte die Rechnung in den 10-%-Zweig und meldete der Kasse eine
    // Zuzahlung, die es nicht gibt. Die Regel steht jetzt nur noch in
    // zuzahlung/calculator.js.
    prozZuzahlung = r2(sessions.reduce(
      (a, s) => a + calcSessionZuzahlung({
        preis_eur: num(s.einzelbetrag),
        zuzahlung_eur_position: s.zuzahlungProPos,
      }) * num(s.anzahl || 1), 0));
    pauschZuzahlung = Math.min(10.00, r2(brutto - prozZuzahlung));
    if (pauschZuzahlung < 0) pauschZuzahlung = 0;
  }
  const gesZuzahlung = r2(prozZuzahlung + pauschZuzahlung);
  const netto = r2(brutto - gesZuzahlung);
  return { brutto, prozZuzahlung, pauschZuzahlung, gesZuzahlung, netto };
}

function buildSLLAMessage({
  prescription,
  rechnung,
  absender,
  empfaenger,
  vkz,
  nachrichtenreferenz,
}) {
  const { patient, doctor, verordnung, tarif, sessions, urspruenglich } = prescription;
  const totals = calcAbrechnungsfallTotals(prescription);

  const lines = [
    ...buildSLLA_FKT({
      vkz,
      ikLeistungserbringer: absender.ik,
      ikKostentraeger:      verordnung.kostentraegerIk,
      // Karten-IK fehlt (NULL), bis eine echte Kostenträgerdatei sie liefert —
      // dann ist Kostenträger-IK die beste verfügbare Näherung, kein Bug (db-ustasi, 05.09.2026).
      ikKrankenkasse:       verordnung.krankenkasseIk || verordnung.kostentraegerIk,
      ikRechnungssteller:   rechnung.rechnungsstellerIk && rechnung.rechnungsstellerIk !== absender.ik
                              ? rechnung.rechnungsstellerIk : '',
    }),
    ...buildSLLA_REC({
      sammelRechnungsnummer: rechnung.sammelRechnungsnummer,
      einzelRechnungsnummer: rechnung.einzelRechnungsnummer || '0',
      rechnungsdatum:        rechnung.datum,
      rechnungsart:          rechnung.rechnungsart || '1',
    }),
    ...buildSLLA_INV({
      versichertennummer:           patient.kvnr,
      versichertenstatus:           patient.versichertenstatus,
      beleginformation:             '',
      belegnummer:                  patient.belegnummer,
      kennzeichenBesondereVersorgung: '',
    }),
  ];

  if (vkz !== '01' && urspruenglich) {
    lines.push(...buildSLLA_URI({
      origIkLeistungserbringer: urspruenglich.ikLeistungserbringer,
      origSammelRechnungsnummer: urspruenglich.sammelRechnungsnummer,
      origEinzelRechnungsnummer: urspruenglich.einzelRechnungsnummer || '0',
      origRechnungsdatum:        urspruenglich.rechnungsdatum,
      origBelegnummer:           urspruenglich.belegnummer,
    }));
  }

  lines.push(...buildSLLA_NAD({
    nachname:           patient.nachname,
    vorname:            patient.vorname,
    geburtsdatum:       patient.geburtsdatum,
    strasse:            patient.strasse,
    plz:                patient.plz,
    ort:                patient.ort,
    laenderkennzeichen: patient.laenderkennzeichen,
  }));

  if (verordnung.imageLink) {
    lines.push(...buildSLLA_IMG(verordnung.imageLink));
  }
  if (verordnung.evoId) {
    lines.push(...buildSLLA_EVO({ evoId: verordnung.evoId }));
  }

  for (const s of sessions) {
    lines.push(...buildSLLA_EHE({
      abrechnungscode:  tarif.abrechnungscode || '22',
      tarifkennzeichen: tarif.tarifkennzeichen,
      positionsnummer:  s.positionsnummer,
      anzahl:           s.anzahl || 1,
      einzelbetrag:     s.einzelbetrag,
      datumLeistung:    s.datumLeistung,
      zuzahlung:        s.zuzahlungProPos != null ? s.zuzahlungProPos : '',
      kilometer:        s.kilometer != null ? s.kilometer : '',
    }));
    if (s.text)    lines.push(...buildSLLA_TXT({ text: s.text }));
    if (s.mwsSatz) lines.push(...buildSLLA_MWS({ satz: s.mwsSatz, betrag: s.mwsBetrag }));
  }

  lines.push(...buildSLLA_ZHE({
    bsnr:                          doctor?.bsnr || '999999999',
    lanr:                          doctor?.lanr || '999999999',
    verordnungsdatum:              verordnung.ausstellungsdatum,
    zuzahlungskennzeichen:         verordnung.zuzahlungskennzeichen,
    diagnosegruppe:                verordnung.diagnosegruppe || '9999',
    verordnungsartHeilmittel:      verordnung.verordnungsart,
    verordnungsbesonderheiten:     verordnung.verordnungsbesonderheiten || '',
    unfallkennzeichen:             verordnung.unfallkennzeichen || '',
    bvgSonstigesSer:               verordnung.bvgSonstigesSer || '',
    therapieberichtAngefordert:    verordnung.therapieberichtAngefordert ? '1' : '',
    hausbesuch:                    verordnung.hausbesuch ? '1' : '',
    leitsymptomatik:               verordnung.leitsymptomatik,
    patientenLeitsymptomatik:      verordnung.patLeitsymptomatik || '',
    dringlicherBehandlungsbedarf:  verordnung.dringend ? '1' : '0',
    heilmittelBereich:             verordnung.heilmittelBereich || '1',
    therapiefrequenz:              verordnung.therapiefrequenz,
  }));

  // DIA (M, 1..n) — at least one. If we have only ICD-10, emit one row.
  lines.push(...buildSLLA_DIA({
    icd10: verordnung.icd10 || '',
    text:  verordnung.diagnosetext || '',
  }));

  if (verordnung.genehmigung) {
    lines.push(...buildSLLA_SKZ({
      genehmigungskennzeichen: verordnung.genehmigung.kennzeichen,
      genehmigungsdatum:       verordnung.genehmigung.datum,
      artGenehmigung:          verordnung.genehmigung.art,
    }));
  }

  if (vkz === '03') {
    lines.push(...buildSLLA_GZF({
      gesZuzahlungForderung:    totals.gesZuzahlung,
      prozZuzahlungForderung:   totals.prozZuzahlung,
      pauschZuzahlungForderung: totals.pauschZuzahlung,
    }));
  } else {
    lines.push(...buildSLLA_BES({
      brutto:          totals.brutto,
      gesZuzahlung:    totals.gesZuzahlung || '',
      prozZuzahlung:   totals.prozZuzahlung || '',
      pauschZuzahlung: totals.pauschZuzahlung || '',
      // pauschKorrektur only for VKZ '04'
      pauschKorrektur: vkz === '04' && prescription.pauschKorrektur != null
                         ? prescription.pauschKorrektur : '',
    }));
  }

  const unh = buildUNH({ nachrichtenreferenz, nachrichtenart: 'SLLA' });
  const unt = buildUNT({ segmentCount: lines.length + 2, nachrichtenreferenz });
  return { lines: [unh, ...lines, unt], totals };
}

function buildSLGAMessage({
  rechnung, absender, empfaenger, kostentraegerIk, krankenkasseIk,
  vkz, perStatusTotals, gesamtTotals, nachrichtenreferenz,
  ust, skonto, rechnungssteller,
  sammelrechnung = '',            // 'J' = Sammelrechnungs-SLGA, '' = Gesamtrechnungs-SLGA
}) {
  const istSammel = sammelrechnung === 'J';
  const lines = [
    ...buildSLGA_FKT({
      vkz,
      sammelrechnung,
      ikLeistungserbringer:     absender.ik,
      ikKostentraeger:          kostentraegerIk,
      // Karten-IK fehlt (NULL), bis eine echte Kostenträgerdatei sie liefert —
      // dann ist Kostenträger-IK die beste verfügbare Näherung, kein Bug (db-ustasi, 05.09.2026).
      // In der Sammelrechnungs-SLGA bleibt das Feld leer (Kap. 5.5.2 S. 32).
      ikKrankenkasse:           istSammel ? '' : (krankenkasseIk || kostentraegerIk),
      ikAbsenderDatei:          absender.ik,
    }),
    ...buildSLGA_REC({
      sammelRechnungsnummer: rechnung.sammelRechnungsnummer,
      einzelRechnungsnummer: rechnung.einzelRechnungsnummer || '0',
      rechnungsdatum:        rechnung.datum,
      rechnungsart:          rechnung.rechnungsart || '1',
    }),
  ];
  // UST gehoert NICHT in die Sammelrechnungs-SLGA (Kap. 5.5.2 S. 34).
  if (ust && !istSammel) lines.push(...buildSLGA_UST(ust));
  if (Array.isArray(skonto)) for (const s of skonto) lines.push(...buildSLGA_SKO(s));

  // GES rows: '00' = total, then per-Versichertenstatus
  const gesRows = [{ status: '00', ...gesamtTotals }, ...perStatusTotals];
  if (gesRows.length < 2) {
    // ensure min 2 — duplicate '00' as per-status fallback if no breakdown known
    gesRows.push({ status: '1', ...gesamtTotals });
  }
  lines.push(...buildSLGA_GES(gesRows.map(r => ({
    status:          r.status,
    rechnungsbetrag: r.netto,            // Gesamtrechnungsbetrag = Brutto - Zuzahlung
    brutto:          r.brutto,
    zuzahlung:       r.gesZuzahlung,
  }))));

  lines.push(...buildSLGA_NAM({
    name1: rechnungssteller?.name || absender.name || 'Praxis',
    name2: rechnungssteller?.kontakt || '',
    name3: rechnungssteller?.telefon || '',
    name4: rechnungssteller?.email || '',
  }));

  const unh = buildUNH({ nachrichtenreferenz, nachrichtenart: 'SLGA' });
  const unt = buildUNT({ segmentCount: lines.length + 2, nachrichtenreferenz });
  return { lines: [unh, ...lines, unt] };
}

export function buildDtaFile({
  absender,         // { ik, name }
  empfaenger,       // { ik, name }
  rechnung,         // { sammelRechnungsnummer, einzelRechnungsnummer?, datum, datennummer, rechnungsart?, anwendungsreferenz? }
  prescriptions,    // array
  kind = 'echt',    // 'echt' | 'test' | 'erprobung'
  vkz = '01',
  rechnungssteller, // optional override for NAM
  ust,              // optional UST segment
  skonto,           // optional SKO segments array
  preflight = true, // run DMRZ-style preflight before building; set false to skip (dev only)
  // --- Dateieinheit (Anlage 1 TP5 V21, Kap. 5.3.1) -------------------------
  davIk,            // IK der Datenannahmestelle, für die diese Datei bestimmt ist
  kassenart,        // 'AO'|'EK'|'BK'|'IK'|'BN'|'LK'|'GK'|'SB'
  // Sammelrechnung (Rechnungsart 3). Der Weg ist gebaut, aber bewusst
  // ABGESCHALTET: heute ruft ihn kein Produktivpfad auf. Er steht hier, damit
  // die Struktur beim ersten echten Sammelrechnungs-Fall nicht neu erfunden
  // werden muss. Einzel- und Sammelrechnung duerfen nicht in derselben Datei
  // stehen (Kap. 5.3.2) — deshalb ein Schalter fuer die ganze Datei, nicht je Gruppe.
  sammelrechnung = false,
}) {
  if (preflight) {
    const pf = runPreflight({ absender, empfaenger, rechnung, prescriptions, vkz });
    if (!pf.ok) {
      const summary = pf.errors.slice(0, 5).map(e => `[${e.code}] ${e.where}: ${e.message}`).join('; ');
      const err = new Error(`Preflight failed (${pf.errors.length} errors): ${summary}`);
      err.preflight = pf;
      throw err;
    }
  }
  if (!absender?.ik || !empfaenger?.ik) throw new Error('absender.ik and empfaenger.ik are required');
  if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
    throw new Error('at least one prescription required');
  }
  validateVerarbeitungskennzeichen(vkz);
  prescriptions.forEach((p, i) => {
    if (!p.verordnung?.verordnungsart) {
      throw new Error(`prescription[${i}].verordnung.verordnungsart required`);
    }
    validateVerordnungsart(p.verordnung.verordnungsart);
    validateZuzahlungskennzeichen(p.verordnung.zuzahlungskennzeichen);
    const ac = p.tarif?.abrechnungscode || '22';
    if (!isPhysioAbrechnungscode(ac)) {
      throw new Error(`prescription[${i}].tarif.abrechnungscode "${ac}" is not a Heilmittel code (Leistungsbereich B)`);
    }
  });

  // --- Dateieinheit pruefen (Kap. 5.3.1) -----------------------------------
  //
  // Eine DTA-Datei gehoert genau EINER Datenannahmestelle und EINER Kassenart.
  // Kommt ein Gemisch herein, ist das kein Fall zum Zurechtbiegen: welche
  // Zeile in welche Datei gehoert, kann der Builder nicht wissen — das weiss
  // nur der Aufrufer, der die Kassen ausgewaehlt hat. Also abweisen statt
  // still die erste nehmen. (Genau der Fehler, den der alte Code eine Ebene
  // tiefer machte: prescriptions[0].kostentraegerIk fuer die ganze Datei.)
  //
  // Solange die Rezepte die beiden Felder nicht tragen — heute ist das so —
  // ist die Pruefung wirkungslos und aendert nichts an der Ausgabe.
  const davSet = new Set(), kassenartSet = new Set();
  for (const p of prescriptions) {
    if (p.verordnung.davIk)     davSet.add(p.verordnung.davIk);
    if (p.verordnung.kassenart) kassenartSet.add(p.verordnung.kassenart);
  }
  if (davIk)     davSet.add(davIk);
  if (kassenart) kassenartSet.add(kassenart);
  if (davSet.size > 1) {
    throw new Error(
      `Datei enthält mehrere Datenannahmestellen (${[...davSet].join(', ')}). ` +
      `Eine DTA-Datei gilt genau einer DAV × Kassenart — Anlage 1 TP5 V21, Kap. 5.3.1.`
    );
  }
  if (kassenartSet.size > 1) {
    throw new Error(
      `Datei enthält mehrere Kassenarten (${[...kassenartSet].join(', ')}). ` +
      `Eine DTA-Datei gilt genau einer DAV × Kassenart — Anlage 1 TP5 V21, Kap. 5.3.1.`
    );
  }

  const testIndikator = kind === 'echt' ? '2' : kind === 'erprobung' ? '1' : '0';
  const erstellungsdatum = rechnung.datum || new Date();

  // Zwei getrennte Namen (gkv-302 Audit 10.09.2026, Anhang 1 zur Anlage 1 TP5
  // Kap. 4) — vorher trug ein einziger 16-stelliger String beide Rollen und
  // erfuellte keine davon spezifikationsgemaess:
  //   logischerDateiname     → UNB-Anwendungsreferenz (unten) + kuenftige Auftragsdatei
  //   physikalischerDateiname → Storage-Dateiname, `abrechnung.dateiname`, Download
  const logischerDateiname = buildLogischerDateiname({
    absenderIk:       absender.ik,
    rolle:            'S', // Selbstabrechner — Praxura ist kein Abrechnungsdienstleister
    abrechnungsmonat: (erstellungsdatum instanceof Date ? erstellungsdatum : new Date(erstellungsdatum)).getMonth() + 1,
  });
  // Transfernummer ist auf 1..999 begrenzt (§4.3) — `rechnung.datennummer`
  // (Jahreszaehler, siehe abrechnung.routes.js) waechst darueber hinaus.
  // Modulo ist eine bewusste Uebergangsloesung: die Spezifikation schweigt
  // zum Ueberlauf, und solange keine Auftragsdatei/DFUE existiert, ist dieser
  // Name nur ein Storage-/Anzeige-Label, keine an den Empfaenger gemeldete
  // fortlaufende Nummer. Vor einer echten Direktuebermittlung braucht das
  // einen eigenen, dauerhaften Zaehler je Empfaenger (selbe Baustelle wie
  // Bulgu 7 — Datenaustauschreferenz).
  const transfernummer = ((Math.max(1, Number(rechnung.datennummer) || 1) - 1) % 999) + 1;
  const physikalischerDateiname = buildPhysikalischerDateiname({
    kind:           kind === 'echt' ? 'echt' : 'test',
    transfernummer,
  });
  const filename = physikalischerDateiname;

  // Betraege je Abrechnungsfall — in der Reihenfolge der Eingabe. Diese
  // Reihenfolge ist bindend: der Aufrufer haelt `prescriptions[i]` und seine
  // DB-Zeilen ueber den Index zusammen (abrechnung.routes.js, Belegnummer
  // einfrieren). Die Gruppierung unten arbeitet deshalb mit Indizes und
  // sortiert das Eingabe-Array nicht um.
  const fallTotals = prescriptions.map(calcAbrechnungsfallTotals);

  // Karten-IK der Zeile. Fehlt sie (NULL), ist die Kostenträger-IK die beste
  // verfügbare Näherung (db-ustasi, 05.09.2026) — dieselbe Ersatzregel wie im
  // FKT-Segment, damit Gruppierung und Segmentinhalt nicht auseinanderlaufen.
  const kartenIkVon = (p) => p.verordnung.krankenkasseIk || p.verordnung.kostentraegerIk;

  // Summen ueber eine Indexmenge — nie ueber die ganze Datei.
  //
  // Der Kern des Fehlers, den dieser Umbau behebt: die GES-Zeilen wurden aus
  // ALLEN Rezepten der Datei gebildet und in die eine SLGA geschrieben. Bei
  // einer zweiten Karten-IK sieht dann jede Kasse die Summe der jeweils
  // anderen mit. Das ist keine Dateiabweisung, sondern still falsche Zahlen —
  // die teurere Sorte Fehler.
  function summenFuer(indizes) {
    const perStatus = new Map();
    let brutto = 0, gesZ = 0;
    for (const i of indizes) {
      const t = fallTotals[i];
      brutto += t.brutto;
      gesZ   += t.gesZuzahlung;
      const vs = (prescriptions[i].patient.versichertenstatus || '1').slice(0, 1);
      const cur = perStatus.get(vs) || { brutto: 0, gesZuzahlung: 0, netto: 0 };
      cur.brutto       += t.brutto;
      cur.gesZuzahlung += t.gesZuzahlung;
      cur.netto        += t.netto;
      perStatus.set(vs, cur);
    }
    return {
      gesamt: { brutto: r2(brutto), gesZuzahlung: r2(gesZ), netto: r2(brutto - gesZ) },
      perStatus: [...perStatus.entries()].map(([status, t]) => ({
        status,
        brutto:       r2(t.brutto),
        gesZuzahlung: r2(t.gesZuzahlung),
        netto:        r2(t.netto),
      })),
    };
  }

  // Zwei Ebenen: Kostenträger-IK → Karten-IK → Rezeptindizes.
  // Map haelt die Einfuegereihenfolge fest; bei genau einer Karten-IK — dem
  // heutigen Normalfall — entsteht daraus exakt eine Gruppe mit den Rezepten
  // in Eingabereihenfolge, also zeichengleich die bisherige Ausgabe.
  const nachKostentraeger = new Map();
  prescriptions.forEach((p, i) => {
    const ktIk     = p.verordnung.kostentraegerIk;
    const kartenIk = kartenIkVon(p);
    if (!nachKostentraeger.has(ktIk)) nachKostentraeger.set(ktIk, new Map());
    const nachKarte = nachKostentraeger.get(ktIk);
    if (!nachKarte.has(kartenIk)) nachKarte.set(kartenIk, []);
    nachKarte.get(kartenIk).push(i);
  });

  let nachrRef = 0;
  let einzelZaehler = 0;
  const allLines = [];
  const gruppen = [];

  for (const [ktIk, nachKarte] of nachKostentraeger) {
    // Erst die Gesamtrechnungen dieses Kostenträgers rechnen, dann — falls
    // Sammelrechnung — die Sammel-SLGA daraus aufaddieren. Aufaddiert werden
    // die bereits gerundeten Gruppensummen, nicht die Rohwerte: sonst kann die
    // Sammel-SLGA um einen Cent von der Summe ihrer Gesamtrechnungen abweichen.
    const teile = [...nachKarte.entries()].map(([kartenIk, indizes]) => ({
      kartenIk, indizes, ...summenFuer(indizes),
    }));

    if (sammelrechnung) {
      const sammelPerStatus = new Map();
      let sBrutto = 0, sGesZ = 0, sNetto = 0;
      for (const t of teile) {
        sBrutto += t.gesamt.brutto;
        sGesZ   += t.gesamt.gesZuzahlung;
        sNetto  += t.gesamt.netto;
        for (const row of t.perStatus) {
          const cur = sammelPerStatus.get(row.status) || { brutto: 0, gesZuzahlung: 0, netto: 0 };
          cur.brutto       += row.brutto;
          cur.gesZuzahlung += row.gesZuzahlung;
          cur.netto        += row.netto;
          sammelPerStatus.set(row.status, cur);
        }
      }
      nachrRef += 1;
      allLines.push(...buildSLGAMessage({
        rechnung, absender, empfaenger,
        kostentraegerIk: ktIk,
        krankenkasseIk:  '',            // Mussfeld-Verbot in der Sammel-SLGA
        vkz,
        perStatusTotals: [...sammelPerStatus.entries()].map(([status, t]) => ({
          status, brutto: r2(t.brutto), gesZuzahlung: r2(t.gesZuzahlung), netto: r2(t.netto),
        })),
        gesamtTotals: { brutto: r2(sBrutto), gesZuzahlung: r2(sGesZ), netto: r2(sNetto) },
        nachrichtenreferenz: nachrRef,
        ust, skonto, rechnungssteller,
        sammelrechnung: 'J',
      }).lines);
    }

    for (const teil of teile) {
      // Ohne Sammelrechnung bleibt die Einzelrechnungsnummer, was sie heute
      // ist ('0'); mit Sammelrechnung zaehlt sie je Gesamtrechnung hoch und
      // muss in SLGA und den zugehoerigen SLLA gleich lauten.
      const einzelNr = sammelrechnung
        ? String(++einzelZaehler)
        : (rechnung.einzelRechnungsnummer || '0');
      const rechnungFuerGruppe = { ...rechnung, einzelRechnungsnummer: einzelNr };

      nachrRef += 1;
      allLines.push(...buildSLGAMessage({
        rechnung: rechnungFuerGruppe,
        absender, empfaenger,
        kostentraegerIk: ktIk,
        krankenkasseIk:  teil.kartenIk,
        vkz,
        perStatusTotals: teil.perStatus,
        gesamtTotals:    teil.gesamt,
        nachrichtenreferenz: nachrRef,
        ust, skonto, rechnungssteller,
        sammelrechnung: '',
      }).lines);

      for (const i of teil.indizes) {
        nachrRef += 1;
        allLines.push(...buildSLLAMessage({
          prescription: prescriptions[i],
          rechnung: rechnungFuerGruppe,
          absender, empfaenger, vkz,
          nachrichtenreferenz: nachrRef,
        }).lines);
      }

      gruppen.push({
        kostentraegerIk:       ktIk,
        kartenIk:              teil.kartenIk,
        einzelRechnungsnummer: einzelNr,
        prescriptionIndices:   [...teil.indizes],
        prescriptionCount:     teil.indizes.length,
        totals:                teil.gesamt,
      });
    }
  }

  // Dateisumme — geht in KEIN GES-Segment, sondern nur in die
  // `abrechnung`-Zeile und den Begleitzettel. Aus den gerundeten
  // Gruppensummen gebildet, damit Datei- und Gruppenebene zusammenpassen.
  const gesamt = {
    brutto:       r2(gruppen.reduce((a, g) => a + g.totals.brutto, 0)),
    gesZuzahlung: r2(gruppen.reduce((a, g) => a + g.totals.gesZuzahlung, 0)),
    netto:        r2(gruppen.reduce((a, g) => a + g.totals.netto, 0)),
  };

  // UNB / UNZ wrap
  const unb = buildUNB({
    absenderIk:          absender.ik,
    empfaengerIk:        empfaenger.ik,
    erstellungsdatum,
    datennummer:         rechnung.datennummer,
    leistungsbereich:    'B',
    anwendungsreferenz:  rechnung.anwendungsreferenz || logischerDateiname,
    testIndikator,
  });
  const unz = buildUNZ({ messageCount: nachrRef, datennummer: rechnung.datennummer });

  const content      = UNA_HEADER + unb + allLines.join('') + unz;
  const segmentCount = (content.match(/'/g) || []).length - 1;
  const byteLength   = Buffer.byteLength(content, 'latin1');

  return {
    filename,
    // Fuer eine kuenftige Auftragsdatei (Anhang 2 zur Anlage 1 TP5, Kap. 9,
    // §3.1 — Nutzdatendatei geht nie allein) — der logische Name muss dort
    // im Feld "Dateiname" identisch zur UNB-Anwendungsreferenz stehen.
    logischerDateiname,
    content,
    segmentCount,
    messageCount: nachrRef,
    byteLength,
    totals: { ...gesamt, prescriptions: prescriptions.length, fallTotals },
    // Je Gesamtrechnung eine Zeile, in Erzeugungsreihenfolge. Der Aufrufer
    // braucht das fuer den Begleitzettel: pro Gesamtrechnung einer, und darin
    // die Karten-IK dieser Gruppe — nicht die des ersten Rezepts.
    gruppen,
    davIk:     davIk     || null,
    kassenart: kassenart || null,
    sammelrechnung: !!sammelrechnung,
  };
}
