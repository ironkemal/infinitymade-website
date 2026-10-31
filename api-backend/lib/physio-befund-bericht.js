// Physio-Befund im Therapiebericht (K8 Teil C, rein ohne I/O).
//
// Formt physio_befunde- und messreihen-Zeilen in einen strukturierten Befund-Block um
// und erzeugt die kompakten Textzeilen fuer das PDF des Therapieberichts.

function normalisiereTyp(typ) {
  const t = String(typ || '').trim().toUpperCase();
  if (t === 'VAS' || t === 'NRS') return 'nrs';
  if (t === 'ROM') return 'rom';
  if (t === 'KRAFT' || t === 'MFT') return 'mft';
  return null;
}

function parseWert(wert) {
  if (typeof wert === 'number') return wert;
  if (wert == null || wert === '') return null;
  const num = Number(wert);
  return isNaN(num) ? wert : num;
}

function sortChronologisch(a, b) {
  const da = String(a.befund_datum || a.created_at || '').slice(0, 10);
  const db = String(b.befund_datum || b.created_at || '').slice(0, 10);
  if (da !== db) return da.localeCompare(db);
  const ca = String(a.created_at || '');
  const cb = String(b.created_at || '');
  return ca.localeCompare(cb);
}

function extrahiereMessungenFuerBefund(befund, messungen, alleBefunde) {
  if (!befund || !Array.isArray(messungen)) return [];
  return messungen.filter(m => {
    if (!m) return false;
    if (m.befund_id != null && befund.id != null) {
      return m.befund_id === befund.id;
    }
    return alleBefunde.length === 1;
  });
}

function baueEinzelBefund(b, bMessungen, istAktuell = false) {
  const bericht = b.daten?.bericht || b.daten || {};
  const regionen = Array.isArray(bericht.regionen) ? bericht.regionen : [];
  const positive_tests = Array.isArray(bericht.positive_tests) ? bericht.positive_tests : [];
  const adl = Array.isArray(bericht.adl) ? bericht.adl : [];
  const ziele = Array.isArray(bericht.ziele) ? bericht.ziele : [];

  const nrs = {};
  const nrs_messungen = [];
  const rom = [];
  const mft = [];

  for (const m of bMessungen) {
    const art = normalisiereTyp(m.typ);
    const label = String(m.koerperteil || '').trim();
    const seite = m.seite ? String(m.seite).trim() : null;
    const wert = parseWert(m.wert);
    if (wert == null) continue;

    if (art === 'nrs') {
      nrs[label] = wert;
      nrs_messungen.push({ label, seite, wert });
    } else if (art === 'rom') {
      rom.push({ label, seite, wert });
    } else if (art === 'mft') {
      mft.push({ label, seite, wert });
    }
  }

  const out = {
    datum: String(b.befund_datum || b.created_at || '').slice(0, 10),
    regionen,
    nrs,
    nrs_messungen,
    rom,
    mft,
    positive_tests,
    adl,
    ziele,
  };

  if (istAktuell) {
    out.verlauf = bericht.verlauf ?? null;
    out.massnahmen = Array.isArray(bericht.massnahmen) ? bericht.massnahmen : [];
    out.empfehlung = bericht.empfehlung ?? null;
  }

  return out;
}

/**
 * Filtert Befunde bevorzugt fuer die uebergebene Verordnungs-ID.
 * 1. Gibt es Befunde mit prescription_id === prescriptionId -> nimm nur diese.
 * 2. Sonst Fallback auf Befunde mit prescription_id == null.
 * 3. Befunde mit anderer prescription_id nie.
 *
 * @param {Array} befunde
 * @param {string|null} prescriptionId
 * @returns {Array}
 */
export function filtereBefundeFuerVo(befunde = [], prescriptionId = null) {
  const list = (befunde || []).filter(b => b && b.ist_aktuell !== false);
  if (!prescriptionId) {
    return list.filter(b => b.prescription_id == null);
  }
  const passend = list.filter(b => b.prescription_id === prescriptionId);
  if (passend.length > 0) {
    return passend;
  }
  return list.filter(b => b.prescription_id == null);
}

/**
 * Wandelt Physio-Befunde und Messreihen in den strukturierten Befund-Block um.
 *
 * @param {Object} params
 * @param {Array} params.befunde - Liste der physio_befunde des Patienten (nur ist_aktuell)
 * @param {Array} params.messungen - messreihen-Zeilen aller dieser Befunde (nach befund_id)
 * @param {string|null} [params.prescriptionId=null] - Verordnungs-ID zur Bevorzugung
 * @returns {Object|null}
 */
export function baueBefundBlock({ befunde = [], messungen = [], prescriptionId = null } = {}) {
  const gefiltert = filtereBefundeFuerVo(befunde, prescriptionId);
  if (!gefiltert.length) return null;

  const sortiert = [...gefiltert].sort(sortChronologisch);

  // Erster = aeltester Erstbefund (befundart 'erst'; sonst aeltester Befund)
  const aeltesterErst = sortiert.find(b => b.befundart === 'erst');
  const erster = aeltesterErst || sortiert[0];

  // Letzter = juengster Befund (nur wenn ungleich dem ersten)
  const juengster = sortiert[sortiert.length - 1];
  const letzter = (juengster && juengster !== erster && (juengster.id ? juengster.id !== erster.id : true))
    ? juengster
    : null;

  const bMessungenErster = extrahiereMessungenFuerBefund(erster, messungen, sortiert);
  const erst = baueEinzelBefund(erster, bMessungenErster, false);

  let aktuell = null;
  let bMessungenLetzter = [];
  if (letzter) {
    bMessungenLetzter = extrahiereMessungenFuerBefund(letzter, messungen, sortiert);
    aktuell = baueEinzelBefund(letzter, bMessungenLetzter, true);
  }

  // Veraenderungen: nur geaenderte Werte zwischen erst und aktuell, gleiche koerperteil+seite+typ
  const veraenderungen = [];
  if (aktuell) {
    const messListeErster = bMessungenErster.map(m => ({
      art: normalisiereTyp(m.typ),
      label: String(m.koerperteil || '').trim(),
      seite: m.seite ? String(m.seite).trim() : null,
      wert: parseWert(m.wert),
    })).filter(m => m.art && m.wert != null);

    const messListeLetzter = bMessungenLetzter.map(m => ({
      art: normalisiereTyp(m.typ),
      label: String(m.koerperteil || '').trim(),
      seite: m.seite ? String(m.seite).trim() : null,
      wert: parseWert(m.wert),
    })).filter(m => m.art && m.wert != null);

    for (const mL of messListeLetzter) {
      const mE = messListeErster.find(e =>
        e.art === mL.art &&
        e.label.toLowerCase() === mL.label.toLowerCase() &&
        (e.seite || null) === (mL.seite || null)
      );
      if (mE) {
        const geaendert = (typeof mE.wert === 'number' && typeof mL.wert === 'number')
          ? mE.wert !== mL.wert
          : String(mE.wert) !== String(mL.wert);
        if (geaendert) {
          veraenderungen.push({
            art: mL.art,
            label: mL.label,
            seite: mL.seite,
            vorher: mE.wert,
            jetzt: mL.wert,
          });
        }
      }
    }

    const artOrder = { nrs: 1, rom: 2, mft: 3 };
    veraenderungen.sort((a, b) => (artOrder[a.art] || 99) - (artOrder[b.art] || 99));
  }

  const erstBericht = erster.daten?.bericht || erster.daten || {};
  const aktBericht = letzter ? (letzter.daten?.bericht || letzter.daten || {}) : null;

  const massnahmen = aktBericht && Array.isArray(aktBericht.massnahmen) && aktBericht.massnahmen.length > 0
    ? aktBericht.massnahmen
    : (Array.isArray(erstBericht.massnahmen) ? erstBericht.massnahmen : []);

  const empfehlung = aktBericht && aktBericht.empfehlung
    ? aktBericht.empfehlung
    : (erstBericht.empfehlung ?? null);

  const verlauf = aktBericht ? (aktBericht.verlauf ?? null) : null;

  return {
    erst,
    aktuell,
    veraenderungen,
    massnahmen,
    empfehlung,
    verlauf,
  };
}

/**
 * Wandelt einen Befund-Block in kompakte Textzeilen fuer das PDF um.
 *
 * @param {Object} block
 * @returns {Array<string>}
 */
export function befundBlockZeilen(block) {
  if (!block || !block.erst) return [];
  const zeilen = [];

  const veraenderungen = Array.isArray(block.veraenderungen) ? block.veraenderungen : [];
  const behandelteMessungen = new Set();

  for (const v of veraenderungen) {
    const labelKey = String(v.label || '').toLowerCase();
    const seiteKey = v.seite ? String(v.seite).toLowerCase() : '';
    behandelteMessungen.add(`${v.art}|${labelKey}|${seiteKey}`);
    behandelteMessungen.add(`${v.art}|${labelKey}|`);

    if (v.art === 'nrs') {
      const seiteStr = v.seite ? ` (${v.seite})` : '';
      zeilen.push(`Schmerz (NRS) ${v.label}${seiteStr}: ${v.vorher} -> ${v.jetzt}`);
    } else if (v.art === 'rom') {
      const seiteStr = v.seite ? ` ${v.seite}` : '';
      const vGrad = String(v.vorher).endsWith('°') ? v.vorher : `${v.vorher}°`;
      const jGrad = String(v.jetzt).endsWith('°') ? v.jetzt : `${v.jetzt}°`;
      zeilen.push(`ROM ${v.label}${seiteStr}: ${vGrad} -> ${jGrad}`);
    } else if (v.art === 'mft') {
      const seiteStr = v.seite ? ` (${v.seite})` : '';
      zeilen.push(`Kraft (MFT) ${v.label}${seiteStr}: ${v.vorher} -> ${v.jetzt}`);
    }
  }

  // Einzelwerte, falls keine Veränderung vorlag oder nur ein Befund existiert
  const refBefund = block.aktuell || block.erst;
  if (refBefund) {
    if (Array.isArray(refBefund.nrs_messungen) && refBefund.nrs_messungen.length > 0) {
      for (const n of refBefund.nrs_messungen) {
        const labelKey = String(n.label || '').toLowerCase();
        const seiteKey = n.seite ? String(n.seite).toLowerCase() : '';
        const keyExact = `nrs|${labelKey}|${seiteKey}`;
        const keyBase = `nrs|${labelKey}|`;
        if (!behandelteMessungen.has(keyExact) && (!n.seite || !behandelteMessungen.has(keyBase))) {
          const seiteStr = n.seite ? ` (${n.seite})` : '';
          zeilen.push(`Schmerz (NRS) ${n.label}${seiteStr}: ${n.wert}`);
          behandelteMessungen.add(keyExact);
          behandelteMessungen.add(keyBase);
        }
      }
    } else if (refBefund.nrs && typeof refBefund.nrs === 'object') {
      for (const [region, wert] of Object.entries(refBefund.nrs)) {
        const labelKey = region.toLowerCase();
        const key = `nrs|${labelKey}|`;
        const schonBehandelt = Array.from(behandelteMessungen).some(k => k.startsWith(`nrs|${labelKey}|`));
        if (!schonBehandelt && !behandelteMessungen.has(key)) {
          zeilen.push(`Schmerz (NRS) ${region}: ${wert}`);
          behandelteMessungen.add(key);
        }
      }
    }

    if (Array.isArray(refBefund.rom)) {
      for (const r of refBefund.rom) {
        const labelKey = String(r.label || '').toLowerCase();
        const seiteKey = r.seite ? String(r.seite).toLowerCase() : '';
        const keyExact = `rom|${labelKey}|${seiteKey}`;
        const keyBase = `rom|${labelKey}|`;
        if (!behandelteMessungen.has(keyExact) && (!r.seite || !behandelteMessungen.has(keyBase))) {
          const seiteStr = r.seite ? ` ${r.seite}` : '';
          const grad = String(r.wert).endsWith('°') ? r.wert : `${r.wert}°`;
          zeilen.push(`ROM ${r.label}${seiteStr}: ${grad}`);
          behandelteMessungen.add(keyExact);
          behandelteMessungen.add(keyBase);
        }
      }
    }
    if (Array.isArray(refBefund.mft)) {
      for (const m of refBefund.mft) {
        const labelKey = String(m.label || '').toLowerCase();
        const seiteKey = m.seite ? String(m.seite).toLowerCase() : '';
        const keyExact = `mft|${labelKey}|${seiteKey}`;
        const keyBase = `mft|${labelKey}|`;
        if (!behandelteMessungen.has(keyExact) && (!m.seite || !behandelteMessungen.has(keyBase))) {
          const seiteStr = m.seite ? ` (${m.seite})` : '';
          zeilen.push(`Kraft (MFT) ${m.label}${seiteStr}: ${m.wert}`);
          behandelteMessungen.add(keyExact);
          behandelteMessungen.add(keyBase);
        }
      }
    }
  }

  const posTests = (block.aktuell?.positive_tests?.length ? block.aktuell.positive_tests : block.erst?.positive_tests) || [];
  if (posTests.length) {
    const formatted = posTests.map(t => {
      if (!t) return '';
      if (typeof t === 'string') return t;
      const name = t.test || t.name || t.region || '';
      return t.seite ? `${name} (${t.seite})` : name;
    }).filter(Boolean);
    if (formatted.length) {
      zeilen.push(`Pos. Tests: ${formatted.join(', ')}`);
    }
  }

  const adls = (block.aktuell?.adl?.length ? block.aktuell.adl : block.erst?.adl) || [];
  if (adls.length) {
    const formatted = adls.map(a => typeof a === 'string' ? a : (a?.label || String(a))).filter(Boolean);
    if (formatted.length) {
      zeilen.push(`ADL: ${formatted.join(', ')}`);
    }
  }

  const ziele = (block.aktuell?.ziele?.length ? block.aktuell.ziele : block.erst?.ziele) || [];
  if (ziele.length) {
    const formatted = ziele.map(z => {
      if (!z) return '';
      if (typeof z === 'string') return z;
      const txt = z.text || z.ziel || '';
      if (z.erreicht) return `${txt} (erreicht: ${z.erreicht})`;
      return txt;
    }).filter(Boolean);
    if (formatted.length) {
      zeilen.push(`Ziele: ${formatted.join(', ')}`);
    }
  }

  const verlauf = block.verlauf || block.aktuell?.verlauf;
  if (verlauf && typeof verlauf === 'string' && verlauf.trim()) {
    zeilen.push(`Verlauf: ${verlauf.trim()}`);
  }

  const massnahmen = block.massnahmen || block.aktuell?.massnahmen || block.erst?.massnahmen || [];
  if (Array.isArray(massnahmen) && massnahmen.length) {
    const formatted = massnahmen.map(m => typeof m === 'string' ? m : (m?.label || String(m))).filter(Boolean);
    if (formatted.length) {
      zeilen.push(`Massnahmen: ${formatted.join(', ')}`);
    }
  }

  const empf = block.empfehlung || block.aktuell?.empfehlung || block.erst?.empfehlung;
  if (empf) {
    if (typeof empf === 'string' && empf.trim()) {
      zeilen.push(`Empfehlung: ${empf.trim()}`);
    } else if (typeof empf === 'object') {
      const parts = [];
      if (empf.folge_vo) parts.push(`Folge-Verordnung: ${empf.folge_vo}`);
      if (empf.eigentraining) parts.push('Eigentraining');
      if (empf.text) parts.push(empf.text);
      if (parts.length) {
        zeilen.push(`Empfehlung: ${parts.join('; ')}`);
      }
    }
  }

  return zeilen;
}
