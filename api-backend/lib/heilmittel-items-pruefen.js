/**
 * api-backend/lib/heilmittel-items-pruefen.js
 *
 * Validiert heilmittel_items auf dem Server für Verordnungen / Muster 13.
 *
 * Regeln:
 * - null oder undefined -> gültig
 * - Kein Array -> 422
 * - Altes Podologie-Format (Strings oder Objekte ohne einheiten) -> bleibt unverändert gültig
 * - Strukturiertes Format mit Einheiten:
 *   - Maximal 3 Elemente
 *   - Jedes Element: {code: /^[A-Z0-9]{4,6}$/, einheiten: 1..60 (Ganzzahl), doppelbehandlung: bool, bezeichnung: string<=80}
 *   - Gleicher code darf nicht mehrfach vorkommen
 *   - Mehrere Heilmittel (>1) nur in Physiotherapie und Ergotherapie (physio, ergo und Varianten)
 *   - anzahl_einheiten = Summe aller Einheiten
 */

const RE_CODE = /^[A-Z0-9]{4,6}$/;

export function normalizeBereich(bereich) {
  const b = String(bereich || '').trim().toLowerCase();
  if (['physio', 'physiotherapie', 'physiotherapy'].includes(b)) return 'physio';
  if (['ergo', 'ergotherapie', 'ergotherapy'].includes(b)) return 'ergo';
  if (['podo', 'podologie', 'podiatry'].includes(b)) return 'podo';
  if (['stimme', 'logo', 'logopaedie', 'logopädie', 'logotherapy', 'speech therapy', 'speech-therapy', 'speech'].includes(b)) return 'logo';
  if (['ernaehrung', 'ernährung', 'ernaehrungstherapie', 'ernährungstherapie'].includes(b)) return 'ernaehrung';
  return b;
}

export function pruefeHeilmittelItems(items, { therapie_bereich } = {}) {
  if (items === null || items === undefined) {
    return { ok: true, items: null, summeEinheiten: null };
  }

  if (!Array.isArray(items)) {
    return {
      ok: false,
      status: 422,
      error: 'Ungültiges Format für Heilmittel-Positionen: Array oder null erwartet.'
    };
  }

  if (items.length === 0) {
    return { ok: true, items: null, summeEinheiten: null };
  }

  // Altes Podologie-Format prüfen:
  // Wenn Einträge Strings sind oder Objekte, bei denen KEIN Eintrag einheiten hat
  const hatEinheiten = items.some(it => it && typeof it === 'object' && it.einheiten != null && String(it.einheiten).trim() !== '');
  if (!hatEinheiten) {
    return { ok: true, items, summeEinheiten: null, isLegacy: true };
  }

  if (items.length > 3) {
    return {
      ok: false,
      status: 422,
      error: 'Maximal 3 vorrangige Heilmittel zulässig.'
    };
  }

  const normBereich = normalizeBereich(therapie_bereich);
  if (items.length > 1 && normBereich !== 'physio' && normBereich !== 'ergo') {
    return {
      ok: false,
      status: 422,
      error: 'Mehrere vorrangige Heilmittel sind nur in der Physiotherapie und Ergotherapie zulässig.'
    };
  }

  const seenCodes = new Set();
  let summeEinheiten = 0;
  const bereinigt = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== 'object' || Array.isArray(it)) {
      return {
        ok: false,
        status: 422,
        error: `Heilmittel an Position ${i + 1} ist kein gültiges Objekt.`
      };
    }

    const code = String(it.code || '').trim().toUpperCase();
    if (!RE_CODE.test(code)) {
      return {
        ok: false,
        status: 422,
        error: `Ungültige Positionsnummer „${it.code || ''}“ an Position ${i + 1}: 4 bis 6 alphanumerische Zeichen erwartet.`
      };
    }

    if (seenCodes.has(code)) {
      return {
        ok: false,
        status: 422,
        error: `Die Positionsnummer „${code}“ darf nicht mehrfach verordnet werden.`
      };
    }
    seenCodes.add(code);

    const einheiten = Number(it.einheiten);
    if (!Number.isInteger(einheiten) || einheiten < 1 || einheiten > 60) {
      return {
        ok: false,
        status: 422,
        error: `Ungültige Einheitenanzahl für Position „${code}“: ganze Zahl zwischen 1 und 60 erwartet.`
      };
    }
    summeEinheiten += einheiten;

    if (it.doppelbehandlung !== undefined && typeof it.doppelbehandlung !== 'boolean') {
      return {
        ok: false,
        status: 422,
        error: `Ungültiger Wert für Doppelbehandlung bei Position „${code}“: Boolean erwartet.`
      };
    }

    if (it.bezeichnung !== undefined && it.bezeichnung !== null) {
      if (typeof it.bezeichnung !== 'string' || it.bezeichnung.length > 80) {
        return {
          ok: false,
          status: 422,
          error: `Bezeichnung für Position „${code}“ darf maximal 80 Zeichen lang sein.`
        };
      }
    }

    bereinigt.push({
      code,
      einheiten,
      doppelbehandlung: Boolean(it.doppelbehandlung),
      ...(it.bezeichnung ? { bezeichnung: it.bezeichnung.trim() } : {})
    });
  }

  return {
    ok: true,
    items: bereinigt.length > 1 ? bereinigt : (bereinigt.length === 1 ? bereinigt : null),
    summeEinheiten
  };
}
