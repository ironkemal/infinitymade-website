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
 * @param {{ aufloeser?: Function, preflight?: boolean }} [options]
 *   `preflight: true` — nicht auflösbare Zeilen werfen nicht, sondern landen in
 *   `fehler` (Zeile behält ihre gespeicherte IK, wird aber in `aufgeloest` NICHT
 *   geführt); alle übrigen Zeilen werden weiter frisch abgeleitet.
 *   Ohne Flag (create / create-podologie) bleibt es beim harten 422.
 * @returns {Promise<{ warnungen: Array<object>, fehler: Array<object>, aufgeloest: Set<*> }>}
 */
export async function kostentraegerFrischAbleiten(supabase, zeilen, { aufloeser = kostentraegerIkAufloesen, preflight = false } = {}) {
  const warnungen = [];
  const fehler = [];
  const aufgeloest = new Set();
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
      if (!preflight) throw err;
      fehler.push({
        prescriptionId: zeile.id,
        severity: 'stop',
        code: KOSTENTRAEGER_NICHT_AUFLOESBAR_CODE,
        text: err.message,
      });
      continue;
    }
    aufgeloest.add(zeile.id);

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

  return { warnungen, fehler, aufgeloest };
}

/**
 * Schreibt frisch abgeleitete Kostenträger-IKs (Warnungen KOSTENTRAEGER_IK_NEU)
 * nach `prescriptions.kostentraeger_ik` zurück — sonst gruppiert die
 * Arbeitsliste (abrechnung-auswahl.js) weiter nach der gespeicherten IK und
 * der Nutzer landet für immer im 409 KOSTENTRAEGER_GEAENDERT.
 *
 * Nur Zeilen, die noch frei editierbar sind: `abrechnung_status = 'bereit'`
 * UND `belegnummer IS NULL` (Tor von prescriptions_festschreibung(), GoBD).
 * Die Update-Bedingung steht zusätzlich im WHERE (`abrechnung_status`,
 * `belegnummer`, `owner_id`), damit ein paralleler Lauf nichts Festgeschriebenes
 * trifft. Best effort: Fehler werden geloggt, nie geworfen.
 *
 * @returns {Promise<string[]>} ids, die tatsächlich zurückgeschrieben wurden
 */
export async function kostentraegerIkZurueckschreiben(supabase, zeilen, warnungen, ownerId) {
  const geschrieben = [];
  for (const w of (warnungen || [])) {
    if (w.code !== KOSTENTRAEGER_IK_NEU_CODE) continue;
    const zeile = (zeilen || []).find(z => z && z.id === w.prescriptionId);
    if (!zeile || zeile.abrechnung_status !== 'bereit' || zeile.belegnummer) continue;
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .update({ kostentraeger_ik: w.neu })
        .eq('id', w.prescriptionId)
        .eq('owner_id', ownerId)
        .eq('abrechnung_status', 'bereit')
        .is('belegnummer', null)
        .select('id');
      if (error) { console.warn('[kostentraeger-frisch] Rückschreiben fehlgeschlagen:', error.message); continue; }
      if (data && data.length) geschrieben.push(w.prescriptionId);
    } catch (e) {
      console.warn('[kostentraeger-frisch] Rückschreiben fehlgeschlagen:', e?.message);
    }
  }
  return geschrieben;
}

/**
 * Antwortkörper für 409 KOSTENTRAEGER_GEAENDERT. Der Hinweis „Liste neu laden"
 * stimmt nur, wenn die frische IK tatsächlich gespeichert wurde — sonst käme
 * der Nutzer im Kreis (gkv-302 Auflage 1, 30.09.2026).
 */
export function kostentraegerGeaendertAntwort(id, alt, neu, zurueckgeschrieben) {
  const kurz = String(id ?? '').slice(0, 8);
  const text = zurueckgeschrieben
    ? `Verordnung ${kurz}: Der Kostenträger hat sich geändert (gespeichert ${alt}, aktuell ${neu}) — die Verordnung wurde aktualisiert. Bitte Liste neu laden und die Verordnung unter dem neuen Kostenträger erneut auswählen.`
    : `Verordnung ${kurz}: Der Kostenträger hat sich geändert (gespeichert ${alt}, aktuell ${neu}), die Verordnung ist aber bereits festgeschrieben bzw. nicht mehr „bereit" und kann nicht automatisch aktualisiert werden — Neu-Laden allein hilft hier nicht; bitte Verordnung prüfen oder den Support kontaktieren.`;
  return { error: text, code: 'KOSTENTRAEGER_GEAENDERT' };
}
