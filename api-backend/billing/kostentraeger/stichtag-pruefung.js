// Empfänger-Prüfung am Übermittlungstag (§ 302 SGB V, Quartalswechsel)
//
// Eine Abrechnung wird z. B. am 30.09. erzeugt (Empfänger = Datenannahmestelle
// nach Stand 30.09., gespeichert in abrechnung.empfaenger_ik, Datei für diesen
// Empfänger verschlüsselt) und erst am 02.10. übermittelt.
// Zum 01.10. kann die Kostenträgerdatei den Empfänger (DTA) oder die
// Papierannahmestelle (Begleitzettel/Belege) geändert haben.
//
// Stichtag ist der ÜBERMITTLUNGSTAG in Berliner Zeit (gkv-302 01.10.2026:
// Anlage 1 TP5 V21 Kap. 8; BAHN-BKK Infoschreiben). Seit Migration 0046
// bleiben alte Zeilen mit valid_to stehen — man kann den Empfänger zu
// jedem Tag auflösen.

import { berlinHeute, istStichtag } from '../../lib/berlin-tag.js';
import { ladeAnnahmestelle, ladePapierannahmestelle } from './annahmestelle.js';

const BERLIN_TAG_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Wandelt ein Date-Objekt oder einen Timestamp-String in den Berliner Kalendertag 'YYYY-MM-DD'.
 *
 * @param {Date|string|null|undefined} dateOderString
 * @returns {string|null} 'YYYY-MM-DD' oder null bei ungültiger Eingabe
 */
export function berlinTagVon(dateOderString) {
  if (!dateOderString) return null;
  if (typeof dateOderString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOderString)) {
    return dateOderString;
  }
  const d = dateOderString instanceof Date ? dateOderString : new Date(dateOderString);
  if (Number.isNaN(d.getTime())) return null;
  return BERLIN_TAG_FORMAT.format(d);
}

/**
 * Ermittelt das Kalenderquartal eines Tages 'YYYY-MM-DD'.
 *
 * @param {string} tag 'YYYY-MM-DD'
 * @returns {string} z. B. 'Q4/2026' oder ''
 */
export function quartalVon(tag) {
  if (typeof tag !== 'string') return '';
  const m = tag.match(/^(\d{4})-(\d{2})/);
  if (!m) return '';
  const jahr = m[1];
  const monat = parseInt(m[2], 10);
  if (monat < 1 || monat > 12) return '';
  const q = Math.ceil(monat / 3);
  return `Q${q}/${jahr}`;
}

/**
 * Vergleicht zwei Anschrift-Objekte auf Gleichheit.
 *
 * @param {object|null} a
 * @param {object|null} b
 * @returns {boolean}
 */
export function anschriftGleich(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    String(a.plz ?? '').trim() === String(b.plz ?? '').trim() &&
    String(a.ort ?? '').trim().toLowerCase() === String(b.ort ?? '').trim().toLowerCase() &&
    String(a.strasse ?? '').trim().toLowerCase() === String(b.strasse ?? '').trim().toLowerCase() &&
    String(a.art ?? '').trim() === String(b.art ?? '').trim()
  );
}

/**
 * Reine, testbare Kernfunktion zur Bewertung von Empfänger- und Anschriftänderungen
 * zwischen dem Erstelltag der Abrechnung und dem heutigen Übermittlungstag.
 *
 * @param {object} param0
 * @param {string} param0.gespeichertIk       In der Abrechnung gespeicherte Empfänger-IK (DTA)
 * @param {object} param0.heuteDas            Rückgabe von ladeAnnahmestelle() zum Stichtag heute
 * @param {object} [param0.papierDamals]      Rückgabe von ladePapierannahmestelle() zum Erstelltag
 * @param {object} [param0.papierHeute]       Rückgabe von ladePapierannahmestelle() zum Stichtag heute
 * @param {string} [param0.erstelltTag]       Berliner Kalendertag 'YYYY-MM-DD' bei Erstellung
 * @param {string} [param0.heuteTag]          Berliner Kalendertag 'YYYY-MM-DD' heute
 * @returns {{ blockiert: boolean, meldungen: Array<{ code: string, stufe: 'block'|'warnung', text: string }> }}
 */
export function bewerteEmpfaengerWechsel({
  gespeichertIk,
  heuteDas,
  papierDamals,
  papierHeute,
  erstelltTag,
  heuteTag,
}) {
  const meldungen = [];

  // 1. DTA-Empfänger prüfen
  if (!heuteDas || !heuteDas.ok) {
    meldungen.push({
      code: 'KEINE_DATENANNAHMESTELLE',
      stufe: 'block',
      text: heuteDas?.grund || 'Für diese Krankenkasse ist heute keine elektronische Datenannahmestelle hinterlegt.',
    });
  } else if (gespeichertIk && String(heuteDas.ik) !== String(gespeichertIk)) {
    // Ohne gespeicherte IK (Altbestand vor empfaenger_ik) gibt es nichts zu vergleichen —
    // dta-bytes meldet das fehlende Feld selbst; hier kein falscher Block "alt: null".
    meldungen.push({
      code: 'EMPFAENGER_GEAENDERT',
      stufe: 'block',
      text: `Die Datenannahmestelle für diese Krankenkasse hat sich seit dem Erstellen geändert (alt: ${gespeichertIk}, heute: ${heuteDas.ik}). Bitte die Abrechnung neu erzeugen.`,
    });
  } else {
    // Gleiche IK, aber created_at liegt in einem anderen Kalenderquartal (Berlin) als heute -> WARNUNG
    const qErstellt = quartalVon(erstelltTag);
    const qHeute    = quartalVon(heuteTag);
    if (qErstellt && qHeute && qErstellt !== qHeute) {
      meldungen.push({
        code: 'QUARTALSWECHSEL',
        stufe: 'warnung',
        text: `Erstellt im Quartal ${qErstellt}, Übermittlung im Quartal ${qHeute} — Anschrift/Zertifikat der Annahmestelle prüfen.`,
      });
    }
  }

  // 2. Papierannahmestelle prüfen
  // auflösen zum Berliner Tag von created_at UND zu heute.
  // IK verschieden -> BLOCK (Code PAPIERANNAHMESTELLE_GEAENDERT); gleiche IK, aber Anschrift verschieden -> WARNUNG.
  if (papierDamals?.ok && papierHeute?.ok) {
    if (String(papierDamals.ik) !== String(papierHeute.ik)) {
      meldungen.push({
        code: 'PAPIERANNAHMESTELLE_GEAENDERT',
        stufe: 'block',
        text: `Die Papierannahmestelle für diese Krankenkasse hat sich seit dem Erstellen geändert (alt: ${papierDamals.ik}, heute: ${papierHeute.ik}). Bitte die Abrechnung neu erzeugen.`,
      });
    } else if (!anschriftGleich(papierDamals.anschrift, papierHeute.anschrift)) {
      meldungen.push({
        code: 'PAPIERANNAHMESTELLE_ANSCHRIFT_GEAENDERT',
        stufe: 'warnung',
        text: 'Die Anschrift der Papierannahmestelle hat sich seit dem Erstellen geändert. Bitte Begleitzettel prüfen.',
      });
    }
  } else if (papierDamals?.ok && !papierHeute?.ok) {
    meldungen.push({
      code: 'PAPIERANNAHMESTELLE_GEAENDERT',
      stufe: 'block',
      text: `Die Papierannahmestelle für diese Krankenkasse ist heute nicht mehr hinterlegt (alt: ${papierDamals.ik}). Bitte die Abrechnung neu erzeugen.`,
    });
  } else if (!papierDamals?.ok && papierHeute?.ok) {
    meldungen.push({
      code: 'PAPIERANNAHMESTELLE_GEAENDERT',
      stufe: 'warnung',   // Altbestand ohne auflösbare Papierannahmestelle — kein Block (cold review 01.10.2026)
      text: `Die Papierannahmestelle für diese Krankenkasse hat sich seit dem Erstellen geändert (alt: nicht hinterlegt, heute: ${papierHeute.ik}). Bitte die Abrechnung neu erzeugen.`,
    });
  }

  const blockiert = meldungen.some(m => m.stufe === 'block');
  return { blockiert, meldungen };
}

/**
 * Führt die Stichtag-Prüfung für eine bestehende Abrechnungszeile asynchron gegen die DB durch.
 *
 * @param {object} supabase
 * @param {object} abrechnungZeile { kostentraeger_ik, empfaenger_ik, created_at }
 * @param {object} [opts]
 * @param {string} [opts.bereich]
 * @param {string} [opts.eigenerAbrechnungscode]
 * @param {string} [opts.heuteTag] 'YYYY-MM-DD'
 * @returns {Promise<{ blockiert: boolean, meldungen: Array<object>, gespeichertIk: string|null, heuteIk: string|null }>}
 */
export async function pruefeEmpfaenger(supabase, abrechnungZeile, {
  bereich,
  eigenerAbrechnungscode,
  heuteTag,
} = {}) {
  const heute = (heuteTag && istStichtag(heuteTag)) ? heuteTag : berlinHeute();
  const erstelltTag = (abrechnungZeile?.created_at ? berlinTagVon(abrechnungZeile.created_at) : null) || heute;

  const kostentraegerIk = abrechnungZeile?.kostentraeger_ik;
  const gespeichertIk   = abrechnungZeile?.empfaenger_ik;

  const [heuteDas, papierDamals, papierHeute] = await Promise.all([
    ladeAnnahmestelle(supabase, {
      kostentraegerIk,
      bereich,
      eigenerAbrechnungscode,
      stichtag: heute,
    }),
    ladePapierannahmestelle(supabase, {
      kostentraegerIk,
      bereich,
      eigenerAbrechnungscode,
      stichtag: erstelltTag,
    }),
    ladePapierannahmestelle(supabase, {
      kostentraegerIk,
      bereich,
      eigenerAbrechnungscode,
      stichtag: heute,
    }),
  ]);

  const bewertung = bewerteEmpfaengerWechsel({
    gespeichertIk,
    heuteDas,
    papierDamals,
    papierHeute,
    erstelltTag,
    heuteTag: heute,
  });

  return {
    ...bewertung,
    gespeichertIk: gespeichertIk || null,
    heuteIk: heuteDas?.ok ? heuteDas.ik : null,
  };
}
