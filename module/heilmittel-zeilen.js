/**
 * module/heilmittel-zeilen.js — Validierungsregeln für Verordnungszeilen
 * (Heilmittel nach Maßgabe des Kataloges).
 *
 * HeilM-RL § 12 Abs. 2 S. 1: Bis zu drei vorrangige Heilmittel je Verordnung,
 * nur für Physiotherapie und Ergotherapie.
 */

export function normalizeBereich(bereich) {
  const b = String(bereich || '').trim().toLowerCase();
  if (['physio', 'physiotherapie', 'physiotherapy'].includes(b)) return 'physio';
  if (['ergo', 'ergotherapie', 'ergotherapy'].includes(b)) return 'ergo';
  if (['podo', 'podologie', 'podiatry'].includes(b)) return 'podo';
  if (['stimme', 'logo', 'logopaedie', 'logopädie', 'logotherapy', 'speech therapy', 'speech-therapy', 'speech'].includes(b)) return 'logo';
  if (['ernaehrung', 'ernährung', 'ernaehrungstherapie', 'ernährungstherapie'].includes(b)) return 'ernaehrung';
  return b;
}

/**
 * Prüft vorrangige und ergänzende Heilmittelzeilen einer Verordnung.
 *
 * @param {object} opts
 * @param {string} [opts.bereich]
 * @param {Array<{code?:string, bezeichnung?:string, einheiten?:number|string, doppelbehandlung?:boolean}>} [opts.zeilen]
 * @param {object|Array|null} [opts.ergaenzend]  {code?:string, bezeichnung?:string, einheiten?:number|string, doppelbehandlung?:boolean}
 * @returns {{ fehler: string[], warnungen: string[] }}
 */
export function pruefeHeilmittelZeilen({ bereich, zeilen = [], ergaenzend = null } = {}) {
  const fehler = [];
  const warnungen = [];
  const normBereich = normalizeBereich(bereich);

  const vorrangig = Array.isArray(zeilen) ? zeilen : [];

  const aktiveZeilen = vorrangig.filter(z => {
    if (!z) return false;
    const hasCode = Boolean(z.code && String(z.code).trim());
    const hasBez = Boolean(z.bezeichnung && String(z.bezeichnung).trim());
    const hasEinh = z.einheiten != null && String(z.einheiten).trim() !== '';
    return hasCode || hasBez || hasEinh;
  });

  // 1. Bereichsprüfung: Mehrere vorrangige Zeilen nur in Physio und Ergo
  const istMehrfach = aktiveZeilen.length > 1;
  if (istMehrfach && normBereich !== 'physio' && normBereich !== 'ergo') {
    fehler.push('Mehrere vorrangige Heilmittel sind nur in der Physiotherapie und Ergotherapie zulässig.');
  }

  // 2. Maximal 3 vorrangige Heilmittel
  if (aktiveZeilen.length > 3) {
    fehler.push('Maximal 3 vorrangige Heilmittel sind zulässig.');
  }

  // 3. Prüfungen je vorrangige Zeile
  const geseheneCodes = new Set();
  let summeVorrangigEinheiten = 0;

  for (const z of aktiveZeilen) {
    const code = String(z.code || '').trim().toUpperCase();
    const bez = String(z.bezeichnung || '').trim();
    const einhRoh = z.einheiten != null ? String(z.einheiten).trim() : '';
    const einh = parseInt(einhRoh, 10);

    // Einheit vorhanden, aber Heilmittel (Code und Bezeichnung) leer
    if (einhRoh !== '' && !code && !bez) {
      fehler.push('Bitte geben Sie für jede Zeile mit Einheiten auch ein Heilmittel an.');
    }

    // Einheit <= 0 oder leer
    if (einhRoh === '' || isNaN(einh) || einh <= 0) {
      fehler.push('Die Anzahl der Behandlungseinheiten muss größer als 0 sein.');
    } else {
      summeVorrangigEinheiten += einh;
    }

    // Gleicher Code / gleiches Heilmittel doppelt
    const ident = code || bez.toLowerCase();
    if (ident) {
      if (geseheneCodes.has(ident)) {
        fehler.push('Das Heilmittel darf nicht mehrfach angegeben werden.');
      } else {
        geseheneCodes.add(ident);
      }
    }
  }

  // 4. Ergänzendes Heilmittel prüfen
  if (ergaenzend) {
    if (Array.isArray(ergaenzend) && ergaenzend.length > 1) {
      fehler.push('Maximal ein ergänzendes Heilmittel ist zulässig.');
    }

    const ergObj = Array.isArray(ergaenzend) ? ergaenzend[0] : ergaenzend;
    const ergCode = String(ergObj?.code || '').trim();
    const ergBez = String(ergObj?.bezeichnung || '').trim();
    const ergEinhRoh = ergObj?.einheiten != null ? String(ergObj.einheiten).trim() : '';
    const ergEinh = parseInt(ergEinhRoh, 10);
    const hatErg = Boolean(ergCode || ergBez || ergEinhRoh !== '');

    if (hatErg) {
      if (aktiveZeilen.length === 0 || summeVorrangigEinheiten === 0) {
        fehler.push('Ein ergänzendes Heilmittel erfordert mindestens ein vorrangiges Heilmittel.');
      }

      if (ergEinhRoh !== '' && !isNaN(ergEinh) && ergEinh > 0) {
        if (aktiveZeilen.length > 0 && ergEinh > summeVorrangigEinheiten) {
          fehler.push('Die Einheiten des ergänzenden Heilmittels dürfen die Summe der vorrangigen Heilmittel nicht übersteigen.');
        }
      }

      if (ergObj?.doppelbehandlung) {
        fehler.push('Doppelbehandlung ist für ergänzende Heilmittel nicht zulässig.');
      }
    }
  }

  return { fehler, warnungen };
}
