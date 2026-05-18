// § 302 DTA file builder — Anlage 1 V21 format, Heilmittel (Leistungsbereich B).
//
// Output structure (Gesamtrechnung, single Krankenkasse per file):
//   UNA
//   UNB ... B ...                              // Leistungsbereich B
//     UNH SLGA:21:0:0
//       FKT REC [UST] [SKO]* GES* NAM
//     UNT
//     UNH SLLA:21:0:0
//       FKT REC INV [URI] NAD [IMG] [EVO]
//         (EHE [TXT] [MWS])+
//       ZHE DIA+ [SKZ] (BES | GZF)
//     UNT
//     ... repeat SLLA per Abrechnungsfall ...
//   UNZ
//
// Faz A2 simplifying assumption: one Krankenkasse per file (batch-per-KK).

import { UNA_HEADER } from './encoding.js';
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
import { buildDtaFilename } from './filename.js';
import {
  validateVerarbeitungskennzeichen,
  validateVerordnungsart,
  validateZuzahlungskennzeichen,
  isPhysioAbrechnungscode,
} from '../codes/anlage3_v22.js';

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
    prozZuzahlung = r2(sessions.reduce(
      (a, s) => a + num(s.zuzahlungProPos || s.einzelbetrag * 0.10) * num(s.anzahl || 1), 0));
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
}) {
  const lines = [
    ...buildSLGA_FKT({
      vkz,
      sammelrechnung:           '',
      ikLeistungserbringer:     absender.ik,
      ikKostentraeger:          kostentraegerIk,
      ikKrankenkasse:           krankenkasseIk || kostentraegerIk,
      ikAbsenderDatei:          absender.ik,
    }),
    ...buildSLGA_REC({
      sammelRechnungsnummer: rechnung.sammelRechnungsnummer,
      einzelRechnungsnummer: rechnung.einzelRechnungsnummer || '0',
      rechnungsdatum:        rechnung.datum,
      rechnungsart:          rechnung.rechnungsart || '1',
    }),
  ];
  if (ust) lines.push(...buildSLGA_UST(ust));
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
}) {
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

  const filename = buildDtaFilename({
    absenderIk:     absender.ik,
    laufendeNummer: rechnung.datennummer,
    kind: kind === 'echt' ? 'echt' : 'test',
  });
  const testIndikator = kind === 'echt' ? '2' : kind === 'erprobung' ? '1' : '0';
  const erstellungsdatum = rechnung.datum || new Date();

  // Aggregate per-Versichertenstatus
  const perStatus = new Map();
  let allBrutto = 0, allGesZ = 0, allProzZ = 0, allPauschZ = 0;
  const fallTotals = prescriptions.map(p => {
    const t = calcAbrechnungsfallTotals(p);
    allBrutto += t.brutto;
    allGesZ   += t.gesZuzahlung;
    allProzZ  += t.prozZuzahlung;
    allPauschZ+= t.pauschZuzahlung;
    const vs = (p.patient.versichertenstatus || '1').slice(0, 1);
    const cur = perStatus.get(vs) || { brutto: 0, gesZuzahlung: 0, netto: 0 };
    cur.brutto += t.brutto;
    cur.gesZuzahlung += t.gesZuzahlung;
    cur.netto += t.netto;
    perStatus.set(vs, cur);
    return t;
  });
  const gesamt = {
    brutto:       r2(allBrutto),
    gesZuzahlung: r2(allGesZ),
    netto:        r2(allBrutto - allGesZ),
  };
  const perStatusRows = [...perStatus.entries()].map(([status, t]) => ({
    status,
    brutto: r2(t.brutto),
    gesZuzahlung: r2(t.gesZuzahlung),
    netto: r2(t.netto),
  }));

  // Assume single Krankenkasse per file (Faz A2).
  const kostentraegerIk = prescriptions[0].verordnung.kostentraegerIk;
  const krankenkasseIk  = prescriptions[0].verordnung.krankenkasseIk || kostentraegerIk;

  let nachrRef = 0;
  const allLines = [];

  // SLGA
  nachrRef += 1;
  const slga = buildSLGAMessage({
    rechnung, absender, empfaenger, kostentraegerIk, krankenkasseIk,
    vkz,
    perStatusTotals: perStatusRows,
    gesamtTotals:    gesamt,
    nachrichtenreferenz: nachrRef,
    ust, skonto, rechnungssteller,
  });
  allLines.push(...slga.lines);

  // SLLA × n
  for (const p of prescriptions) {
    nachrRef += 1;
    const slla = buildSLLAMessage({
      prescription: p, rechnung, absender, empfaenger, vkz,
      nachrichtenreferenz: nachrRef,
    });
    allLines.push(...slla.lines);
  }

  // UNB / UNZ wrap
  const unb = buildUNB({
    absenderIk:          absender.ik,
    empfaengerIk:        empfaenger.ik,
    erstellungsdatum,
    datennummer:         rechnung.datennummer,
    leistungsbereich:    'B',
    anwendungsreferenz:  rechnung.anwendungsreferenz || filename,
    testIndikator,
  });
  const unz = buildUNZ({ messageCount: nachrRef, datennummer: rechnung.datennummer });

  const content      = UNA_HEADER + unb + allLines.join('') + unz;
  const segmentCount = (content.match(/'/g) || []).length - 1;
  const byteLength   = Buffer.byteLength(content, 'latin1');

  return {
    filename,
    content,
    segmentCount,
    messageCount: nachrRef,
    byteLength,
    totals: { ...gesamt, prescriptions: prescriptions.length, fallTotals },
  };
}
