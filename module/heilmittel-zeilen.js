/**
 * module/heilmittel-zeilen.js — Validierungsregeln für Verordnungszeilen
 * (Heilmittel nach Maßgabe des Kataloges).
 *
 * HeilM-RL § 12 Abs. 2 S. 1: Bis zu drei vorrangige Heilmittel je Verordnung,
 * nur für Physiotherapie und Ergotherapie.
 */

import { kuerzelAusKatalog } from './heilmittel-kuerzel.js?v=20261103q';

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
 * @param {boolean} [opts.istEntwurf]  Wenn true, bleiben leere Einheitenfelder für Entwürfe zulässig (harte Formfehler wie doppelte Codes, Einheit 0, Ergänzend > Summe sperren weiterhin).
 * @returns {{ fehler: string[], warnungen: string[] }}
 */
export function pruefeHeilmittelZeilen({ bereich, zeilen = [], ergaenzend = null, istEntwurf = false } = {}) {
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
    if (einhRoh === '') {
      if (!istEntwurf) {
        fehler.push('Die Anzahl der Behandlungseinheiten muss größer als 0 sein.');
      }
    } else if (isNaN(einh) || einh <= 0) {
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

      if (ergEinhRoh !== '' && (isNaN(ergEinh) || ergEinh <= 0)) {
        fehler.push('Die Anzahl der ergänzenden Behandlungseinheiten muss größer als 0 sein.');
      } else if (ergEinhRoh !== '' && !isNaN(ergEinh) && ergEinh > 0) {
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

/**
 * Prüft Änderungen an Heilmittel-Positionen einer Verordnung (P0-2).
 * Kalem-Index ist Identität.
 * - Yapılmış VEYA termine bağlı seansı olan index'te: code değiştirilemez,
 *   kalem silinemez, Einheit < o kalemin kullanılanı olamaz.
 * - Satır silinince sonraki index'lerde yapılmış/bağlı seans varsa reddet.
 * - Açık-bağsız seanslı son kalem silinirse izin ver (o seanslar cancelled olur).
 *
 * @param {Array|object} altItems
 * @param {Array|object} neuItems
 * @param {Array} sitzungen
 * @returns {string|null} Fehlermeldung auf Deutsch oder null wenn erlaubt.
 */
function extrahiereCodeOderKuerzel(item) {
  if (!item) return { code: '', kuerzel: '' };
  let c = String(item.code || item.heilmittel_position || '').trim().toUpperCase();
  if (/^[1268]\d{4}$/.test(c)) {
    c = 'X' + c.slice(1);
  }
  if (!c) {
    const text = String(item.bezeichnung || item.heilmittel || '').trim();
    const m = text.match(/^(X\d{4}|\d{5})/i);
    if (m) {
      let cm = m[1].toUpperCase();
      if (/^[1268]\d{4}$/.test(cm)) cm = 'X' + cm.slice(1);
      c = cm;
    }
  }
  const k = kuerzelAusKatalog(item);
  return { code: c, kuerzel: k ? String(k).trim().toUpperCase() : '' };
}

export function pruefeItemsAenderung(altItems, neuItems, sitzungen) {
  const alt = Array.isArray(altItems) ? altItems : (altItems ? [altItems] : []);
  const neu = Array.isArray(neuItems) ? neuItems : (neuItems ? [neuItems] : []);
  const sess = Array.isArray(sitzungen) ? sitzungen : [];

  function getGenutzt(idx) {
    return sess.filter(s =>
      (s.heilmittel_index ?? 0) === idx &&
      s.status !== 'cancelled' &&
      (s.status === 'done' || s.status === 'completed' || Boolean(s.booking_id))
    );
  }

  const minLen = Math.min(alt.length, neu.length);
  for (let i = 0; i < minLen; i++) {
    const genutzt = getGenutzt(i);
    if (!genutzt.length) continue;

    const altInfo = extrahiereCodeOderKuerzel(alt[i]);
    const neuInfo = extrahiereCodeOderKuerzel(neu[i]);

    const codeWechsel = altInfo.code && neuInfo.code && altInfo.code !== neuInfo.code;
    const kuerzelWechsel = altInfo.kuerzel && neuInfo.kuerzel && altInfo.kuerzel !== neuInfo.kuerzel;

    if (codeWechsel || kuerzelWechsel) {
      const label = altInfo.kuerzel || altInfo.code || `Position ${i + 1}`;
      return `Heilmittel-Position ${i + 1} (${label}) kann nicht geändert werden, da bereits Behandlungen dokumentiert oder Termine gebunden sind.`;
    }

    const neuEinh = parseInt(neu[i]?.einheiten ?? neu[i]?.anzahl_einheiten, 10);
    if (Number.isFinite(neuEinh)) {
      const zielTermine = neu[i]?.doppelbehandlung ? Math.ceil(neuEinh / 2) : neuEinh;
      if (neuEinh < genutzt.length || zielTermine < genutzt.length) {
        return `Für Position ${i + 1} können nicht weniger als ${genutzt.length} Einheiten angegeben werden, da bereits ${genutzt.length} Behandlung${genutzt.length > 1 ? 'en dokumentiert oder Termine gebunden sind' : ' dokumentiert oder ein Termin gebunden ist'}.`;
      }
    }
  }

  if (alt.length > neu.length) {
    for (let k = neu.length; k < alt.length; k++) {
      const genutzt = getGenutzt(k);
      if (genutzt.length > 0) {
        return `Position ${k + 1} kann nicht gelöscht werden, da bereits Behandlungen dokumentiert oder Termine gebunden sind.`;
      }
    }
    const restGenutzt = sess.filter(s =>
      (s.heilmittel_index ?? 0) >= neu.length &&
      s.status !== 'cancelled' &&
      (s.status === 'done' || s.status === 'completed' || Boolean(s.booking_id))
    );
    if (restGenutzt.length > 0) {
      return 'Position kann nicht gelöscht werden, solange nachfolgende Positionen bereits erbrachte Behandlungen oder gebundene Termine haben.';
    }
  }

  return null;
}
