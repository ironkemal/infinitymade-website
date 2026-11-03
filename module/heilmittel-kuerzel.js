/**
 * module/heilmittel-kuerzel.js — Einheitliche Kurznamen für Heilmittel
 *
 * Quelle: bestehender GKV_LEISTUNGSKATALOG (keine duplizierte Liste).
 * Unbekannte Codes bleiben als Code unverändert stehen.
 */

/**
 * Ermittelt das Kürzel für ein Heilmittel-Item oder einen Code anhand des Katalogs.
 *
 * @param {string|object} itemOderCode  Code (z.B. 'X0501') oder Item ({ code, kuerzel, bezeichnung })
 * @param {object|Array}  [katalog]     GKV_LEISTUNGSKATALOG oder Array von Leistungseinträgen
 * @returns {string}                    Kürzel (z.B. 'KG', 'MT') oder unveränderter Code/Text
 */
export function kuerzelAusKatalog(itemOderCode, katalog) {
  if (!itemOderCode) return '';

  if (typeof itemOderCode === 'object' && itemOderCode.kuerzel) {
    return String(itemOderCode.kuerzel).trim();
  }

  const roh = typeof itemOderCode === 'string'
    ? itemOderCode
    : (itemOderCode.code || itemOderCode.heilmittel_position || itemOderCode.bezeichnung || '');
  const code = String(roh || '').trim();
  if (!code) return '';

  // Wenn Bezeichnung im Format "KG – Krankengymnastik" vorliegt
  if (typeof itemOderCode === 'object' && itemOderCode.bezeichnung && itemOderCode.bezeichnung.includes(' – ')) {
    const kuerzelVorne = itemOderCode.bezeichnung.split(' – ')[0].trim();
    if (kuerzelVorne) return kuerzelVorne;
  }

  const kat = katalog || (typeof window !== 'undefined' ? window.GKV_LEISTUNGSKATALOG : null);
  if (kat) {
    const clean = code.toUpperCase().replace(/\s+/g, '');
    const eintraege = Array.isArray(kat)
      ? kat
      : Object.values(kat).filter(Boolean).flat();
    const gefunden = eintraege.find(e => e && e.code && String(e.code).trim().toUpperCase().replace(/\s+/g, '') === clean);
    if (gefunden && gefunden.kuerzel) {
      return gefunden.kuerzel;
    }
  }

  return code;
}

/**
 * Formatiert den Titel einer Verordnung für Karten (Termin- & Patientenkarte).
 * Wenn mehrere Heilmittel vorhanden sind: alle Kurznamen + Einheit (z.B. "KG 5 · MT 5").
 *
 * @param {object}       rx
 * @param {object|Array} [katalog]
 * @returns {string}
 */
export function formatMultiHeilmittelTitel(rx, katalog) {
  if (!rx) return '—';
  const multiItems = Array.isArray(rx.heilmittel_items) && rx.heilmittel_items.length > 1
    ? rx.heilmittel_items
    : null;

  if (multiItems) {
    return multiItems.map(it => {
      const k = kuerzelAusKatalog(it, katalog);
      const e = it.einheiten || it.anzahl || '';
      return e ? `${k} ${e}` : k;
    }).join(' · ');
  }

  return rx.heilmittel || rx.heilmittel_position || '—';
}
