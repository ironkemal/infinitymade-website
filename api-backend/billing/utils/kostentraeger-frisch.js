// ============================================================================
// Kostenträger-IK bei §302-DTA-Erzeugung frisch aus Karten-IK ableiten.
//
// Bislang vertrauten die Erzeugungswege (POST /abrechnung/create,
// create-podologie, preflight) blind dem in `prescriptions.kostentraeger_ik`
// gespeicherten Wert. Hatte sich der Abrechnungsweg eines Kostenträgers
// geändert (z.B. Fusion oder neuer abrechnender_kt_ik), ging die Datei an
// eine veraltete IK.
//
// Diese Routine leitet für jede Zeile mit gültiger 9-stelliger Karten-IK
// (`krankenkasse_ik`) die Kostenträger-IK zum Erzeugungszeitpunkt frisch gegen
// den aktuellen Datenbestand ab (lib/rezept-felder.js: kostentraegerIkAufloesen).
// Ein Namens-Rückfall wird bewusst vermieden (nur krankenkasse_ik übergeben).
//
// gkv-302, 30.09.2026 B1.
// ============================================================================

import { kostentraegerIkAufloesen } from '../../lib/rezept-felder.js';
import { istKartenIk } from './karten-ik.js';

export const KOSTENTRAEGER_NICHT_AUFLOESBAR_CODE = 'KOSTENTRAEGER_NICHT_AUFLOESBAR';
export const KOSTENTRAEGER_IK_NEU_CODE = 'KOSTENTRAEGER_IK_NEU';

/**
 * Leitet die Kostenträger-IK für jede Verordnung frisch aus der Karten-IK ab.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<object>} zeilen
 * @param {{ aufloeser?: Function }} [options]
 * @returns {Promise<{ warnungen: Array<object> }>}
 */
export async function kostentraegerFrischAbleiten(supabase, zeilen, { aufloeser = kostentraegerIkAufloesen } = {}) {
  const warnungen = [];
  const cache = new Map();

  for (const zeile of (zeilen || [])) {
    if (!zeile) continue;
    // Nur bei gültiger 9-stelliger Karten-IK auflösen; sonst Zeile unberührt
    // lassen — der Mapper weist sie mit KARTEN_IK_FEHLT ohnehin ab.
    if (!istKartenIk(zeile.krankenkasse_ik)) continue;

    const kartenIk = String(zeile.krankenkasse_ik);
    let neu;
    if (cache.has(kartenIk)) {
      neu = cache.get(kartenIk);
    } else {
      // DİKKAT: nur `krankenkasse_ik` übergeben — kein `krankenkasse` (Name),
      // damit kein Namens-Rückfall greift.
      neu = await aufloeser(supabase, { krankenkasse_ik: kartenIk });
      cache.set(kartenIk, neu);
    }

    if (neu === null) {
      const kurzId = String(zeile.id ?? '').slice(0, 8);
      const vorname = zeile.leads?.first_name;
      const nachname = zeile.leads?.last_name;
      const patientName = [vorname, nachname].map(s => String(s ?? '').trim()).filter(Boolean).join(' ');
      const patientZusatz = patientName ? ` (${patientName})` : '';

      const err = new Error(
        `Verordnung ${kurzId}${patientZusatz}: Zur IK der Versichertenkarte ${kartenIk} wurde in der aktuellen Kostenträgerdatei kein Kostenträger gefunden — Verordnung prüfen bzw. Kostenträgerdatei aktualisieren.`
      );
      err.status = 422;
      err.code = KOSTENTRAEGER_NICHT_AUFLOESBAR_CODE;
      err.prescriptionId = zeile.id;
      throw err;
    }

    if (neu !== zeile.kostentraeger_ik) {
      const alt = zeile.kostentraeger_ik;
      zeile.kostentraeger_ik = neu;
      const kurzId = String(zeile.id ?? '').slice(0, 8);
      warnungen.push({
        code: KOSTENTRAEGER_IK_NEU_CODE,
        prescriptionId: zeile.id,
        alt,
        neu,
        text: `Verordnung ${kurzId}: Kostenträger-IK laut aktueller Kostenträgerdatei ${neu} statt gespeicherter ${alt} — es wird mit ${neu} abgerechnet.`,
      });
    }
  }

  return { warnungen };
}
