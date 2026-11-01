/**
 * physio-befund-logik.js — Reine Logik und Transformationen fuer den Physio-Befund.
 *
 * Importiert den Datenkatalog (physio-befund-katalog.js).
 * Enthaelt Zustandsinitialisierung, Validierung, Aufteilung in physio_befunde.daten (jsonb)
 * und messreihen (Zeilen fuer NRS/ROM/Kraft), Ruecklese-Logik sowie Befundvergleiche.
 *
 * Keine DOM-Abhaengigkeiten, keine Netzwerkaufrufe.
 */

import { alsBerlinDatum } from './berlin-datum.js';
import {
  FORM_VERSION,
  BEFUNDARTEN,
  REGIONEN,
  SEITEN,
  NRS_ZEITEN,
  INSPEKTION,
  PALPATION,
  ROM_BEWEGUNGEN,
  KRAFT_GRUPPEN,
  TESTS,
  TEST_ERGEBNISSE,
  ADL,
  MASSNAHMEN,
  VERLAUF,
  ZIEL_ERREICHT,
} from './physio-befund-katalog.js';

/**
 * Vorauswahl der Verordnung: die juengste laufende, sonst die juengste nicht
 * stornierte. Erwartet die Liste absteigend nach created_at.
 */
export function standardVerordnungId(verordnungen) {
  const liste = verordnungen || [];
  const laufend = liste.find((v) => ['parsed', 'confirmed', 'in_therapy'].includes(v.status));
  const treffer = laufend || liste.find((v) => v.status !== 'cancelled');
  return treffer ? treffer.id : null;
}

/**
 * Erzeugt einen initialen, leeren Befund-Zustand.
 */
export function neuerBefundZustand({ befundart = 'erst', datum = null, therapeutId = null } = {}) {
  return {
    befundart: befundart || 'erst',
    datum: datum || alsBerlinDatum(new Date()),
    therapeutId: therapeutId || null,
    regionen: {},
    inspektion: { auswahl: [], text: '' },
    palpation: { auswahl: [], text: '' },
    adl: { auswahl: [], gehstrecke_m: null, sitzdauer_min: null },
    ziele: [
      { text: '', erreicht: null },
    ],
    therapieplan: { massnahmen: [], hausaufgaben: '' },
    verlauf: null,
    empfehlung: { folge_vo: null, eigentraining: false },
    notiz: '',
  };
}

/**
 * Findet eine Region im Katalog anhand von ID oder Label (unterstuetzt auch 'Huefte').
 */
function findeRegion(regionIdOderLabel) {
  if (!regionIdOderLabel) return null;
  return REGIONEN.find(r => r.id === regionIdOderLabel || r.label === regionIdOderLabel)
    || (regionIdOderLabel === 'Huefte' ? REGIONEN.find(r => r.id === 'Hüfte') : null)
    || null;
}

/**
 * Validiert den Befund-Zustand gemaess den klinischen Pflichtregeln.
 * @returns {{ ok: boolean, fehler: string[] }}
 */
export function validiere(state) {
  const fehler = [];

  if (!state || typeof state !== 'object') {
    return { ok: false, fehler: ['Ungültiger Befundzustand.'] };
  }

  // 1. Befundart Pflicht
  if (!state.befundart || !BEFUNDARTEN.some(b => b.id === state.befundart)) {
    fehler.push('Befundart ist ein Pflichtfeld (Erstbefund, Zwischenbefund oder Abschlussbefund).');
  }

  // 1b. Datum Pflicht & Format YYYY-MM-DD & gueltig
  if (
    !state.datum ||
    typeof state.datum !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(state.datum) ||
    Number.isNaN(new Date(state.datum + 'T00:00:00Z').getTime())
  ) {
    fehler.push('Befunddatum ist ein Pflichtfeld (Format JJJJ-MM-TT).');
  }

  // 2. Mindestens eine Region
  const regKeys = state.regionen ? Object.keys(state.regionen) : [];
  if (regKeys.length === 0) {
    fehler.push('Mindestens eine Region muss erfasst werden.');
  }

  // 3. Regionen validieren: nrs.aktuell Pflicht (ganzzahlig 0-10), Wertebereiche pruefen
  for (const regKey of regKeys) {
    const reg = state.regionen[regKey];
    const rKatalog = findeRegion(regKey) || { label: regKey, id: regKey };

    // NRS aktuell Pflicht
    const nrsAktuell = reg?.nrs?.aktuell;
    if (
      nrsAktuell === null ||
      nrsAktuell === undefined ||
      nrsAktuell === '' ||
      Number.isNaN(Number(nrsAktuell)) ||
      !Number.isInteger(Number(nrsAktuell)) ||
      Number(nrsAktuell) < 0 ||
      Number(nrsAktuell) > 10
    ) {
      fehler.push(`Schmerz (NRS aktuell) für Region ${rKatalog.label} ist Pflicht (ganzzahlig 0–10).`);
    }

    // NRS Ruhe / Belastung / Nacht pruefen (0-10)
    for (const zeit of ['ruhe', 'belastung', 'nacht']) {
      const zVal = reg?.nrs?.[zeit];
      if (zVal !== null && zVal !== undefined && zVal !== '') {
        const num = Number(zVal);
        if (Number.isNaN(num) || num < 0 || num > 10) {
          fehler.push(`NRS ${zeit} für Region ${rKatalog.label} muss zwischen 0 und 10 liegen.`);
        }
      }
    }

    // ROM pruefen (0-360)
    for (const [bewId, bVal] of Object.entries(reg?.rom || {})) {
      if (!bVal || typeof bVal !== 'object') continue;
      for (const s of ['links', 'rechts', 'beidseits']) {
        const val = bVal[s];
        if (val !== null && val !== undefined && val !== '') {
          const num = Number(val);
          if (Number.isNaN(num) || num < 0 || num > 360) {
            fehler.push(`ROM-Wert für ${rKatalog.label} (${bewId}, ${s}) muss zwischen 0° und 360° liegen.`);
          }
        }
      }
    }

    // Kraft pruefen (MFT 0-5)
    for (const [grpId, gVal] of Object.entries(reg?.kraft || {})) {
      if (!gVal || typeof gVal !== 'object') continue;
      for (const s of ['links', 'rechts', 'beidseits']) {
        const val = gVal[s];
        if (val !== null && val !== undefined && val !== '') {
          const num = Number(val);
          if (Number.isNaN(num) || num < 0 || num > 5) {
            fehler.push(`Kraft-Wert (MFT) für ${rKatalog.label} (${grpId}, ${s}) muss zwischen 0 und 5 liegen.`);
          }
        }
      }
    }
  }

  // 4. Erstbefund: mindestens 1 Ziel mit Text
  if (state.befundart === 'erst') {
    const hatZiel = Array.isArray(state.ziele) && state.ziele.some(z => typeof z?.text === 'string' && z.text.trim().length > 0);
    if (!hatZiel) {
      fehler.push('Beim Erstbefund muss mindestens ein Behandlungsziel mit Text formuliert werden.');
    }
  }

  // 5. Zwischen-/Abschlussbefund: verlauf Pflicht
  if (state.befundart === 'zwischen' || state.befundart === 'abschluss') {
    if (!state.verlauf || !['besser', 'gleich', 'schlechter'].includes(state.verlauf)) {
      fehler.push('Beim Zwischen- und Abschlussbefund ist der Verlauf Pflicht (besser/gleich/schlechter).');
    }
  }

  // 6. Abschlussbefund: empfehlung.folge_vo Pflicht
  if (state.befundart === 'abschluss') {
    if (!state.empfehlung || !['ja', 'nein'].includes(state.empfehlung.folge_vo)) {
      fehler.push('Beim Abschlussbefund ist die Empfehlung für eine Folge-Verordnung Pflicht (ja/nein).');
    }
  }

  return {
    ok: fehler.length === 0,
    fehler,
  };
}

/**
 * Baut das jsonb-Objekt fuer physio_befunde.daten zusammen.
 * Schliesst alle Messwerte (NRS, ROM, MFT) und 'vorher' strikt aus.
 */
export function baueDaten(state) {
  if (!state || typeof state !== 'object') return {};

  const cleanRegionen = {};

  for (const [rKey, rVal] of Object.entries(state.regionen || {})) {
    const rKatalog = findeRegion(rKey);
    const regId = rKatalog ? rKatalog.id : rKey;

    // Tests filtern: nur Eintraege ungleich 'nicht'
    const cleanTests = {};
    for (const [tId, tObj] of Object.entries(rVal?.tests || {})) {
      if (tObj && typeof tObj === 'object') {
        const sides = {};
        for (const [sKey, sVal] of Object.entries(tObj)) {
          if (sVal && sVal !== 'nicht') {
            sides[sKey] = sVal;
          }
        }
        if (Object.keys(sides).length > 0) {
          cleanTests[tId] = sides;
        }
      } else if (typeof tObj === 'string' && tObj !== 'nicht') {
        cleanTests[tId] = tObj;
      }
    }

    // ROM filtern: nur schmerzhaft-Flags duerfen ins jsonb, KEINE Zahlenwerte
    const cleanRom = {};
    for (const [bewId, bObj] of Object.entries(rVal?.rom || {})) {
      if (bObj && typeof bObj === 'object') {
        if (bObj.schmerzhaft && typeof bObj.schmerzhaft === 'object') {
          const schmerz = {};
          for (const [sKey, isSchm] of Object.entries(bObj.schmerzhaft)) {
            if (isSchm) schmerz[sKey] = true;
          }
          if (Object.keys(schmerz).length > 0) {
            cleanRom[bewId] = { schmerzhaft: schmerz };
          }
        } else if (bObj.schmerzhaft === true) {
          cleanRom[bewId] = { schmerzhaft: true };
        }
      }
    }

    const regEintrag = {
      seite: rVal?.seite || null,
      charakter: Array.isArray(rVal?.charakter) ? [...rVal.charakter] : [],
    };

    if (Object.keys(cleanRom).length > 0) {
      regEintrag.rom = cleanRom;
    }
    if (Object.keys(cleanTests).length > 0) {
      regEintrag.tests = cleanTests;
    }

    cleanRegionen[regId] = regEintrag;
  }

  const posTests = positiveTests(state).map(pt => ({
    region: pt.region,
    test: pt.test,
    seite: typeof pt.seite === 'string' ? pt.seite.toLowerCase() : 'beidseits',
  }));

  const adlLabels = (Array.isArray(state.adl?.auswahl) ? state.adl.auswahl : []).map(id => {
    const kat = ADL.find(a => a.id === id || a.label === id);
    return kat ? kat.label : id;
  });

  const massnahmenLabels = (Array.isArray(state.therapieplan?.massnahmen) ? state.therapieplan.massnahmen : []).map(id => {
    const kat = MASSNAHMEN.find(m => m.id === id || m.label === id);
    return kat ? kat.label : id;
  });

  const inspektionLabels = (Array.isArray(state.inspektion?.auswahl) ? state.inspektion.auswahl : []).map(id => {
    const kat = INSPEKTION.find(i => i.id === id || i.label === id);
    return kat ? kat.label : id;
  });

  const palpationLabels = (Array.isArray(state.palpation?.auswahl) ? state.palpation.auswahl : []).map(id => {
    const kat = PALPATION.find(p => p.id === id || p.label === id);
    return kat ? kat.label : id;
  });

  const regionenLabels = Object.keys(state.regionen || {}).map(rKey => {
    const r = findeRegion(rKey);
    return r ? r.label : rKey;
  });

  const zieleArray = Array.isArray(state.ziele)
    ? state.ziele.map(z => ({ text: z?.text || '', erreicht: z?.erreicht ?? null }))
    : [];

  const empfehlungObj = {
    folge_vo: state.empfehlung?.folge_vo ?? null,
    eigentraining: !!state.empfehlung?.eigentraining,
  };

  return {
    regionen: cleanRegionen,
    inspektion: {
      auswahl: Array.isArray(state.inspektion?.auswahl) ? [...state.inspektion.auswahl] : [],
      text: typeof state.inspektion?.text === 'string' ? state.inspektion.text : '',
    },
    palpation: {
      auswahl: Array.isArray(state.palpation?.auswahl) ? [...state.palpation.auswahl] : [],
      text: typeof state.palpation?.text === 'string' ? state.palpation.text : '',
    },
    adl: {
      auswahl: Array.isArray(state.adl?.auswahl) ? [...state.adl.auswahl] : [],
      gehstrecke_m: typeof state.adl?.gehstrecke_m === 'number' ? state.adl.gehstrecke_m : null,
      sitzdauer_min: typeof state.adl?.sitzdauer_min === 'number' ? state.adl.sitzdauer_min : null,
    },
    ziele: zieleArray,
    therapieplan: {
      massnahmen: Array.isArray(state.therapieplan?.massnahmen) ? [...state.therapieplan.massnahmen] : [],
      hausaufgaben: typeof state.therapieplan?.hausaufgaben === 'string' ? state.therapieplan.hausaufgaben : '',
    },
    verlauf: state.verlauf ?? null,
    empfehlung: empfehlungObj,
    notiz: typeof state.notiz === 'string' ? state.notiz : '',
    bericht: {
      positive_tests: posTests,
      adl: adlLabels,
      massnahmen: massnahmenLabels,
      ziele: zieleArray,
      verlauf: state.verlauf ?? null,
      empfehlung: empfehlungObj,
      inspektion: inspektionLabels,
      palpation: palpationLabels,
      regionen: regionenLabels,
    },
  };
}

/**
 * Erzeugt den festen Koerperteil-Namen fuer messreihen:
 * "<Regionslabel>" oder "<Regionslabel> · <zusatzLabel>".
 */
export function koerperteilName(regionId, zusatzLabel = '') {
  const reg = findeRegion(regionId);
  const rLabel = reg ? reg.label : regionId;
  const z = typeof zusatzLabel === 'string' ? zusatzLabel.trim() : '';
  return z ? `${rLabel} · ${z}` : rLabel;
}

/**
 * Erzeugt das Array von Insert-Objekten fuer die Tabelle `messreihen`.
 * Leere/null Werte erzeugen keine Zeile.
 */
export function baueMessreihenZeilen(state, ctx = {}) {
  const {
    ownerId = null,
    leadId = null,
    prescriptionId = null,
    befundId = null,
    erfasstVon = null,
    gemessenAm = null,
  } = ctx;

  let gemessen_am = gemessenAm;
  if (!gemessen_am) {
    if (state?.datum && typeof state.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(state.datum)) {
      const d = new Date(state.datum + 'T12:00:00Z');
      gemessen_am = !Number.isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
    } else {
      gemessen_am = new Date().toISOString();
    }
  }
  const zeilen = [];

  const baseZeile = {
    owner_id: ownerId,
    lead_id: leadId,
    prescription_id: prescriptionId || null,
    befund_id: befundId || null,
    erfasst_von: erfasstVon || null,
    gemessen_am,
  };

  for (const [rKey, rVal] of Object.entries(state?.regionen || {})) {
    const regKatalog = findeRegion(rKey);
    const regId = regKatalog ? regKatalog.id : rKey;
    const regLabel = regKatalog ? regKatalog.label : rKey;
    const regSeite = rVal?.seite || null;

    // 1. NRS aktuell (koerperteil = Regionslabel)
    const nrsAktuell = rVal?.nrs?.aktuell;
    if (nrsAktuell !== null && nrsAktuell !== undefined && nrsAktuell !== '' && !Number.isNaN(Number(nrsAktuell))) {
      zeilen.push({
        ...baseZeile,
        typ: 'VAS',
        koerperteil: regLabel,
        wert: Number(nrsAktuell),
        einheit: 'Punkte',
        seite: regSeite,
        notiz: null,
      });
    }

    // NRS ruhe, belastung, nacht (koerperteil = "<Regionslabel> · Ruhe" usw.)
    for (const zeit of NRS_ZEITEN) {
      const zVal = rVal?.nrs?.[zeit.id];
      if (zVal !== null && zVal !== undefined && zVal !== '' && !Number.isNaN(Number(zVal))) {
        zeilen.push({
          ...baseZeile,
          typ: 'VAS',
          koerperteil: koerperteilName(regId, zeit.label),
          wert: Number(zVal),
          einheit: 'Punkte',
          seite: regSeite,
          notiz: null,
        });
      }
    }

    // 2. ROM
    const katBewegungen = ROM_BEWEGUNGEN[regId] || [];
    for (const [bewKey, bewVal] of Object.entries(rVal?.rom || {})) {
      if (!bewVal || typeof bewVal !== 'object') continue;
      const bKatalog = katBewegungen.find(b => b.id === bewKey || b.label === bewKey);
      const bLabel = bKatalog ? bKatalog.label : bewKey;
      const isSeitig = bKatalog ? bKatalog.seitig : true;

      if (!isSeitig) {
        const val = bewVal.beidseits ?? bewVal.links ?? bewVal.rechts;
        if (val !== null && val !== undefined && val !== '' && !Number.isNaN(Number(val))) {
          const isSchm = !!(bewVal.schmerzhaft?.beidseits || bewVal.schmerzhaft?.links || bewVal.schmerzhaft?.rechts || bewVal.schmerzhaft === true);
          zeilen.push({
            ...baseZeile,
            typ: 'ROM',
            koerperteil: koerperteilName(regId, bLabel),
            wert: Number(val),
            einheit: 'Grad',
            seite: 'beidseits',
            notiz: isSchm ? 'schmerzhaft' : null,
          });
        }
      } else {
        for (const s of ['links', 'rechts', 'beidseits']) {
          const val = bewVal[s];
          if (val !== null && val !== undefined && val !== '' && !Number.isNaN(Number(val))) {
            const isSchm = !!(bewVal.schmerzhaft?.[s] || (bewVal.schmerzhaft === true));
            zeilen.push({
              ...baseZeile,
              typ: 'ROM',
              koerperteil: koerperteilName(regId, bLabel),
              wert: Number(val),
              einheit: 'Grad',
              seite: s,
              notiz: isSchm ? 'schmerzhaft' : null,
            });
          }
        }
      }
    }

    // 3. Kraft (MFT)
    const katKraft = KRAFT_GRUPPEN[regId] || [];
    for (const [grpKey, grpVal] of Object.entries(rVal?.kraft || {})) {
      if (!grpVal || typeof grpVal !== 'object') continue;
      const gKatalog = katKraft.find(g => g.id === grpKey || g.label === grpKey);
      const gLabel = gKatalog ? gKatalog.label : grpKey;
      const isSeitig = gKatalog ? gKatalog.seitig : true;

      if (!isSeitig) {
        const val = grpVal.beidseits ?? grpVal.links ?? grpVal.rechts;
        if (val !== null && val !== undefined && val !== '' && !Number.isNaN(Number(val))) {
          zeilen.push({
            ...baseZeile,
            typ: 'kraft',
            koerperteil: koerperteilName(regId, gLabel),
            wert: Number(val),
            einheit: 'MFT',
            seite: 'beidseits',
            notiz: null,
          });
        }
      } else {
        for (const s of ['links', 'rechts', 'beidseits']) {
          const val = grpVal[s];
          if (val !== null && val !== undefined && val !== '' && !Number.isNaN(Number(val))) {
            zeilen.push({
              ...baseZeile,
              typ: 'kraft',
              koerperteil: koerperteilName(regId, gLabel),
              wert: Number(val),
              einheit: 'MFT',
              seite: s,
              notiz: null,
            });
          }
        }
      }
    }
  }

  return zeilen;
}

/**
 * Liest messreihen-Zeilen zurueck in das strukturierte Messwerte-Objekt.
 * Umkehrung von baueMessreihenZeilen.
 */
export function leseMesswerte(zeilen = []) {
  const result = {};
  if (!Array.isArray(zeilen)) return result;

  // Regionen nach Label-Laenge absteigend sortieren fuer praezisen Praefix-Vergleich
  const sortierteRegionen = [...REGIONEN].sort((a, b) => b.label.length - a.label.length);

  for (const row of zeilen) {
    if (!row || !row.koerperteil) continue;

    let matchedRegion = null;
    let zusatz = '';

    for (const r of sortierteRegionen) {
      if (row.koerperteil === r.label) {
        matchedRegion = r;
        zusatz = '';
        break;
      }
      const prefix = r.label + ' · ';
      if (row.koerperteil.startsWith(prefix)) {
        matchedRegion = r;
        zusatz = row.koerperteil.slice(prefix.length).trim();
        break;
      }
    }

    if (!matchedRegion) continue;
    const regionId = matchedRegion.id;

    if (!result[regionId]) {
      result[regionId] = {
        seite: null,
        nrs: { aktuell: null, ruhe: null, belastung: null, nacht: null },
        rom: {},
        kraft: {},
      };
    }

    const val = row.wert !== null && row.wert !== undefined ? Number(row.wert) : null;

    // 1. NRS
    if (row.typ === 'VAS') {
      if (!zusatz) {
        result[regionId].nrs.aktuell = val;
        if (matchedRegion.seitig && row.seite) {
          result[regionId].seite = row.seite;
        }
      } else {
        const zeit = NRS_ZEITEN.find(z => z.label === zusatz || z.id === zusatz.toLowerCase());
        if (zeit) {
          result[regionId].nrs[zeit.id] = val;
        }
        if (matchedRegion.seitig && row.seite && !result[regionId].seite) {
          result[regionId].seite = row.seite;
        }
      }
    }

    // 2. ROM
    else if (row.typ === 'ROM') {
      const katBewegungen = ROM_BEWEGUNGEN[regionId] || [];
      const bKatalog = katBewegungen.find(b => b.label === zusatz || b.id === zusatz);
      const bewId = bKatalog ? bKatalog.id : zusatz;

      if (!result[regionId].rom[bewId]) {
        result[regionId].rom[bewId] = {
          links: null,
          rechts: null,
          beidseits: null,
          schmerzhaft: { links: false, rechts: false, beidseits: false },
        };
      }

      const s = row.seite || 'beidseits';
      if (['links', 'rechts', 'beidseits'].includes(s)) {
        result[regionId].rom[bewId][s] = val;
        if (row.notiz === 'schmerzhaft' || (typeof row.notiz === 'string' && row.notiz.includes('schmerzhaft'))) {
          result[regionId].rom[bewId].schmerzhaft[s] = true;
        }
      }
    }

    // 3. Kraft
    else if (row.typ === 'kraft') {
      const katKraft = KRAFT_GRUPPEN[regionId] || [];
      const gKatalog = katKraft.find(g => g.label === zusatz || g.id === zusatz);
      const grpId = gKatalog ? gKatalog.id : zusatz;

      if (!result[regionId].kraft[grpId]) {
        result[regionId].kraft[grpId] = {
          links: null,
          rechts: null,
          beidseits: null,
        };
      }

      const s = row.seite || 'beidseits';
      if (['links', 'rechts', 'beidseits'].includes(s)) {
        result[regionId].kraft[grpId][s] = val;
      }
    }
  }

  return result;
}

/**
 * Uebernimmt den Datenstand eines Vorbefunds fuer einen neuen Zwischen- oder Abschlussbefund.
 * Messwerte bleiben leer (null). Das Ergebnis von leseMesswerte(vorMessungen) wird als state.vorher angehaengt.
 */
export function uebernehmeVonVorbefund({ befundart = 'zwischen', datum = null, therapeutId = null, vorDaten = {}, vorMessungen = [] } = {}) {
  const neuState = neuerBefundZustand({ befundart, datum, therapeutId });

  // Regionen aus vorDaten
  const regionen = {};
  for (const [rKey, rVal] of Object.entries(vorDaten?.regionen || {})) {
    const regKatalog = findeRegion(rKey);
    const regId = regKatalog ? regKatalog.id : rKey;

    // Tests tief kopieren
    const tests = {};
    for (const [tKey, tVal] of Object.entries(rVal?.tests || {})) {
      if (tVal && typeof tVal === 'object') {
        tests[tKey] = { ...tVal };
      } else {
        tests[tKey] = tVal;
      }
    }

    // Leere ROM-Huelle
    const rom = {};
    if (rVal?.rom) {
      for (const bewKey of Object.keys(rVal.rom)) {
        rom[bewKey] = {
          links: null,
          rechts: null,
          beidseits: null,
          schmerzhaft: { links: false, rechts: false, beidseits: false },
        };
      }
    }

    // Leere Kraft-Huelle
    const kraft = {};
    if (rVal?.kraft) {
      for (const grpKey of Object.keys(rVal.kraft)) {
        kraft[grpKey] = { links: null, rechts: null, beidseits: null };
      }
    }

    regionen[regId] = {
      seite: rVal?.seite || null,
      nrs: { aktuell: null, ruhe: null, belastung: null, nacht: null },
      charakter: Array.isArray(rVal?.charakter) ? [...rVal.charakter] : [],
      rom,
      kraft,
      tests,
    };
  }

  neuState.regionen = regionen;

  // Inspektion & Palpation
  if (vorDaten?.inspektion) {
    neuState.inspektion = {
      auswahl: Array.isArray(vorDaten.inspektion.auswahl) ? [...vorDaten.inspektion.auswahl] : [],
      text: vorDaten.inspektion.text || '',
    };
  }
  if (vorDaten?.palpation) {
    neuState.palpation = {
      auswahl: Array.isArray(vorDaten.palpation.auswahl) ? [...vorDaten.palpation.auswahl] : [],
      text: vorDaten.palpation.text || '',
    };
  }

  // ADL
  if (vorDaten?.adl) {
    neuState.adl = {
      auswahl: Array.isArray(vorDaten.adl.auswahl) ? [...vorDaten.adl.auswahl] : [],
      gehstrecke_m: vorDaten.adl.gehstrecke_m ?? null,
      sitzdauer_min: vorDaten.adl.sitzdauer_min ?? null,
    };
  }

  // Ziele: Text uebernehmen, erreicht zuruecksetzen
  if (Array.isArray(vorDaten?.ziele) && vorDaten.ziele.length > 0) {
    neuState.ziele = vorDaten.ziele.map(z => ({
      text: z?.text || '',
      erreicht: null,
    }));
  }

  // Therapieplan
  if (vorDaten?.therapieplan) {
    neuState.therapieplan = {
      massnahmen: Array.isArray(vorDaten.therapieplan.massnahmen) ? [...vorDaten.therapieplan.massnahmen] : [],
      hausaufgaben: vorDaten.therapieplan.hausaufgaben || '',
    };
  }

  // Vorherige Messwerte fuer graue Anzeige
  neuState.vorher = Array.isArray(vorMessungen) ? leseMesswerte(vorMessungen) : (vorMessungen || {});

  return neuState;
}

/**
 * Vergleicht zwei Messwert-Staende (aktuell vs. vorher).
 * Gibt eine Liste geaenderter Werte mit delta zurueck.
 * @returns {Array<{ regionId: string, art: 'rom'|'kraft'|'nrs', label: string, seite: string|null, vorher: number|null, jetzt: number|null, delta: number|null }>}
 */
export function vergleich(aktuellMessungen, vorherMessungen) {
  const akt = Array.isArray(aktuellMessungen) ? leseMesswerte(aktuellMessungen) : (aktuellMessungen || {});
  const vor = Array.isArray(vorherMessungen) ? leseMesswerte(vorherMessungen) : (vorherMessungen || {});

  const ergebnis = [];
  const alleRegionIds = new Set([...Object.keys(akt), ...Object.keys(vor)]);

  for (const regId of alleRegionIds) {
    const regAkt = akt[regId] || {};
    const regVor = vor[regId] || {};

    // 1. NRS
    const nrsKeys = ['aktuell', 'ruhe', 'belastung', 'nacht'];
    for (const k of nrsKeys) {
      const vVal = regVor.nrs?.[k] ?? null;
      const jVal = regAkt.nrs?.[k] ?? null;

      if (vVal === null && jVal === null) continue;
      if (vVal !== jVal) {
        const delta = (jVal !== null && vVal !== null) ? Number((jVal - vVal).toFixed(2)) : null;
        let label = k;
        if (k === 'aktuell') {
          label = 'NRS aktuell';
        } else {
          const zKatalog = NRS_ZEITEN.find(z => z.id === k);
          if (zKatalog) label = zKatalog.label;
        }
        const seite = regAkt.seite || regVor.seite || null;
        ergebnis.push({
          regionId: regId,
          art: 'nrs',
          label,
          seite,
          vorher: vVal,
          jetzt: jVal,
          delta,
        });
      }
    }

    // 2. ROM
    const alleBewIds = new Set([
      ...Object.keys(regAkt.rom || {}),
      ...Object.keys(regVor.rom || {}),
    ]);
    const katBewegungen = ROM_BEWEGUNGEN[regId] || [];

    for (const bewId of alleBewIds) {
      const bAkt = regAkt.rom?.[bewId] || {};
      const bVor = regVor.rom?.[bewId] || {};
      const bKatalog = katBewegungen.find(b => b.id === bewId || b.label === bewId);
      const bLabel = bKatalog ? bKatalog.label : bewId;

      for (const s of ['links', 'rechts', 'beidseits']) {
        const vVal = bVor[s] ?? null;
        const jVal = bAkt[s] ?? null;

        if (vVal === null && jVal === null) continue;
        if (vVal !== jVal) {
          const delta = (jVal !== null && vVal !== null) ? Number((jVal - vVal).toFixed(2)) : null;
          ergebnis.push({
            regionId: regId,
            art: 'rom',
            label: bLabel,
            seite: s,
            vorher: vVal,
            jetzt: jVal,
            delta,
          });
        }
      }
    }

    // 3. Kraft
    const alleGrps = new Set([
      ...Object.keys(regAkt.kraft || {}),
      ...Object.keys(regVor.kraft || {}),
    ]);
    const katKraft = KRAFT_GRUPPEN[regId] || [];

    for (const grpId of alleGrps) {
      const gAkt = regAkt.kraft?.[grpId] || {};
      const gVor = regVor.kraft?.[grpId] || {};
      const gKatalog = katKraft.find(g => g.id === grpId || g.label === grpId);
      const gLabel = gKatalog ? gKatalog.label : grpId;

      for (const s of ['links', 'rechts', 'beidseits']) {
        const vVal = gVor[s] ?? null;
        const jVal = gAkt[s] ?? null;

        if (vVal === null && jVal === null) continue;
        if (vVal !== jVal) {
          const delta = (jVal !== null && vVal !== null) ? Number((jVal - vVal).toFixed(2)) : null;
          ergebnis.push({
            regionId: regId,
            art: 'kraft',
            label: gLabel,
            seite: s,
            vorher: vVal,
            jetzt: jVal,
            delta,
          });
        }
      }
    }
  }

  return ergebnis;
}

/**
 * Ermittelt alle Tests, die mit 'plus' markiert sind, mit ihren Katalog-Labels.
 * @param {object} daten Befundzustand oder physio_befunde.daten
 * @returns {Array<{ region: string, test: string, seite: string }>}
 */
export function positiveTests(daten) {
  const result = [];
  if (!daten || typeof daten !== 'object') return result;

  for (const [rKey, rVal] of Object.entries(daten.regionen || {})) {
    const regKatalog = findeRegion(rKey);
    const regId = regKatalog ? regKatalog.id : rKey;
    const regLabel = regKatalog ? regKatalog.label : rKey;

    const katTests = TESTS[regId] || [];

    for (const [tKey, tVal] of Object.entries(rVal?.tests || {})) {
      const tKatalog = katTests.find(t => t.id === tKey || t.label === tKey);
      const testLabel = tKatalog ? tKatalog.label : tKey;

      if (tVal && typeof tVal === 'object') {
        for (const [sKey, sVal] of Object.entries(tVal)) {
          if (sVal === 'plus') {
            const sKatalog = SEITEN.find(s => s.id === sKey.toLowerCase());
            const seiteLabel = sKatalog ? sKatalog.label : (sKey === 'links' ? 'Links' : sKey === 'rechts' ? 'Rechts' : 'Beidseits');
            result.push({
              region: regLabel,
              test: testLabel,
              seite: seiteLabel,
            });
          }
        }
      } else if (tVal === 'plus') {
        const isSeitig = tKatalog ? tKatalog.seitig : false;
        result.push({
          region: regLabel,
          test: testLabel,
          seite: isSeitig ? (rVal.seite || 'Beidseits') : 'Beidseits',
        });
      }
    }
  }

  return result;
}
