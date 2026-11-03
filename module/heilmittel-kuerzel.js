/**
 * module/heilmittel-kuerzel.js — Einheitliche Kurznamen für Heilmittel
 *
 * Quelle: bestehender GKV_LEISTUNGSKATALOG (keine duplizierte Liste).
 * Unbekannte Codes bleiben als Code unverändert stehen.
 */

const BEKANNTE_KUERZEL = {
  'X0501': 'KG',
  'X1201': 'MT',
  'X0201': 'MLD45',
  'X0202': 'MLD60',
  'X0507': 'KGG',
  'X0710': 'BOB',
  'X0711': 'VOJ',
  'X0712': 'PNF',
  'X0702': 'Muko',
  'X0106': 'KMT',
  'X1104': 'TRK',
  '78010': 'pod. Beh. kl.',
  '78020': 'pod. Beh. gr.',
  '78030': 'Hornhautbeh.',
  '78040': 'Nagelbeh.',
  '78100': 'Spange',
  '78110': 'Spange',
  '78610': 'Spange',
};

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

  const codeDirekt = typeof itemOderCode === 'string'
    ? itemOderCode
    : (itemOderCode.code || itemOderCode.heilmittel_position || '');

  const code = String(codeDirekt || '').trim();

  let bezeichnungVorne = '';
  const bez = typeof itemOderCode === 'object' ? String(itemOderCode.bezeichnung || '').trim() : '';
  if (bez && bez.includes(' – ')) {
    bezeichnungVorne = bez.split(' – ')[0].trim();
  } else if (typeof itemOderCode === 'string' && itemOderCode.includes(' – ')) {
    bezeichnungVorne = itemOderCode.split(' – ')[0].trim();
  }

  const kat = katalog || (typeof window !== 'undefined' ? window.GKV_LEISTUNGSKATALOG : null);
  const eintraege = kat
    ? (Array.isArray(kat) ? kat : Object.values(kat).filter(Boolean).flat())
    : [];

  // 1. Zuerst Code im Katalog / bekannte Kürzel prüfen (auch wenn Bezeichnung "X0501 – Krankengymnastik" lautet)
  // Bei 5-stelligen Abrechnungsnummern (z. B. 20501, 10501, 60501, 80501) Vorlage-X-Code (X0501) als Kandidat ergänzen
  const kandidaten = [];
  for (const c of [code, bezeichnungVorne].filter(Boolean)) {
    kandidaten.push(c);
    const clean = c.toUpperCase().replace(/\s+/g, '');
    if (/^[1268]\d{4}$/.test(clean)) {
      kandidaten.push('X' + clean.slice(1));
    }
  }
  for (const c of kandidaten) {
    const clean = c.toUpperCase().replace(/\s+/g, '');
    if (eintraege.length > 0) {
      const gefunden = eintraege.find(e => e && e.code && String(e.code).trim().toUpperCase().replace(/\s+/g, '') === clean);
      if (gefunden && gefunden.kuerzel) {
        return gefunden.kuerzel;
      }
    }
    if (BEKANNTE_KUERZEL[clean]) {
      return BEKANNTE_KUERZEL[clean];
    }
  }

  // 2. Falls kein Katalogtreffer für Code: bezeichnungVorne als Kürzel nutzen (z.B. "MT – Manuelle Therapie" ohne Code)
  if (bezeichnungVorne) {
    return bezeichnungVorne;
  }

  return code || bez || (typeof itemOderCode === 'string' ? itemOderCode : '');
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

  // Wenn bereits lesbarer Titel vorhanden (kein X-Code / HPNR am Anfang)
  const hm = String(rx.heilmittel || '').trim();
  if (hm && !/^[X0-9][0-9]{4}/i.test(hm)) {
    return hm;
  }

  const single = (Array.isArray(rx.heilmittel_items) && rx.heilmittel_items.length === 1)
    ? rx.heilmittel_items[0]
    : rx;
  const k = kuerzelAusKatalog(single, katalog);
  return k || rx.heilmittel || rx.heilmittel_position || '—';
}

/**
 * Ermittelt das Kürzel für eine Sitzung (unter Beachtung von heilmittel_index).
 *
 * @param {object} sess  Sitzungsobjekt (z.B. { heilmittel_index: 1 })
 * @param {object} rx    Verordnungsobjekt (mit heilmittel_items oder heilmittel/heilmittel_position)
 * @param {string} [fallbackCode] Fallback, falls weder sess noch rx vorhanden
 * @param {object|Array} [katalog]
 * @returns {string} Kurzcode (z.B. 'MT', 'KG')
 */
export function ermittleSitzungKuerzel(sess, rx, fallbackCode = '', katalog) {
  if (sess && rx) {
    const multi = Array.isArray(rx.heilmittel_items) && rx.heilmittel_items.length > 0;
    if (multi && sess.heilmittel_index != null && rx.heilmittel_items[sess.heilmittel_index]) {
      return kuerzelAusKatalog(rx.heilmittel_items[sess.heilmittel_index], katalog);
    }
    if (rx.heilmittel_position || rx.heilmittel) {
      return kuerzelAusKatalog(rx.heilmittel_position || rx.heilmittel, katalog);
    }
  } else if (rx) {
    if (rx.heilmittel_position || rx.heilmittel) {
      return kuerzelAusKatalog(rx.heilmittel_position || rx.heilmittel, katalog);
    }
  }
  return fallbackCode ? kuerzelAusKatalog(fallbackCode, katalog) : '';
}

