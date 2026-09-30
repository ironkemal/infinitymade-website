/**
 * anamnese-daten.js — Lesen und Schreiben der Tabelle `anamnese` (Supabase-Client wird übergeben).
 *
 * ⚠ ABHÄNGIG VON DER MIGRATION `anamnese_fachbereich_versionierung` (Sitzung B, Devir §1).
 *   Spalten: fachbereich · felder · form_version · version · ist_aktuell · quelle ·
 *   geprueft_am · geprueft_von · uebernommen_von. Ohne sie schlagen die Filter unten fehl —
 *   deshalb wird nichts gepusht, bevor die Migration live ist.
 *
 * Append-only (§ 630f BGB, wie `pat_fussbefund`): jede Speicherung ist ein INSERT; ein Trigger
 * vergibt `version`, setzt die alte Zeile auf `ist_aktuell=false`. UPDATE ist nur für
 * `geprueft_am`/`geprueft_von` (NULL → Wert) erlaubt. Jeder Leser filtert `ist_aktuell = true`.
 *
 * Die Lader werfen nie: `{ row, fehler }` (Fehler = `true`/Meldung, dann bleibt der Aufrufer stumm
 * statt „keine Anamnese" zu behaupten).
 */

import { bestaetigungsKopie } from './anamnese-formulare.js?v=20261001r';

function q(sb, leadId, fachbereich, ownerId) {
  let a = sb.from('anamnese').select('*').eq('patient_id', leadId).eq('ist_aktuell', true);
  if (ownerId) a = a.eq('owner_id', ownerId);
  if (fachbereich) a = a.eq('fachbereich', fachbereich);
  return a.order('created_at', { ascending: false });
}

/** Gültige Anamnese eines Fachbereichs. `ownerId` optional (Akte/Rozet lassen RLS entscheiden). */
export async function ladeAktuelle(sb, leadId, fachbereich, ownerId = null) {
  if (!sb || !leadId) return { row: null, fehler: !sb || !leadId };
  try {
    const { data, error } = await q(sb, leadId, fachbereich, ownerId).limit(1).maybeSingle();
    if (error) return { row: null, fehler: error.message || true };
    return { row: data || null, fehler: false };
  } catch (e) { return { row: null, fehler: (e && e.message) || true }; }
}

/** Alle gültigen Anamnesen des Patienten (höchstens eine je Fachbereich). */
export async function ladeAlleAktuellen(sb, leadId) {
  if (!sb || !leadId) return { rows: [], fehler: true };
  try {
    const { data, error } = await q(sb, leadId, null, null).limit(8);
    if (error) return { rows: [], fehler: error.message || true };
    return { rows: data || [], fehler: false };
  } catch (e) { return { rows: [], fehler: (e && e.message) || true }; }
}

/** Versionsverlauf eines Fachbereichs, neueste zuerst (nur Kopfdaten). */
export async function ladeVersionen(sb, leadId, fachbereich) {
  if (!sb || !leadId) return [];
  try {
    const { data } = await sb.from('anamnese')
      .select('id,version,created_at,quelle,geprueft_am,ist_aktuell,uebernommen_von')
      .eq('patient_id', leadId).eq('fachbereich', fachbereich)
      .order('version', { ascending: false }).limit(20);
    return data || [];
  } catch { return []; }
}

/**
 * Hat der Patient eine gültige Podo-Anamnese? `true`/`false`, `null` = nicht ermittelbar
 * (Fehler, kein Patient) — dann erscheint KEIN „fehlt"-Hinweis.
 */
export async function hatAktuelle(sb, leadId, fachbereich) {
  const { row, fehler } = await ladeAktuelle(sb, leadId, fachbereich);
  if (fehler) return null;
  return !!row;
}

/** INSERT einer neuen Version. @returns {{row?:object, error?:string}} */
export async function speichereNeu(sb, payload) {
  try {
    const { data, error } = await sb.from('anamnese').insert(payload).select('id,version,created_at').single();
    if (error) return { error: error.message || 'Speichern fehlgeschlagen' };
    return { row: data };
  } catch (e) { return { error: (e && e.message) || 'Speichern fehlgeschlagen' }; }
}

/** „Unverändert bestätigen": Kopie des gültigen Standes als neue Version. */
export async function bestaetige(sb, row, { userId, heute } = {}) {
  const payload = bestaetigungsKopie(row, { userId, heute });
  if (!payload) return { error: 'Keine Anamnese zum Bestätigen' };
  return speichereNeu(sb, payload);
}

/**
 * „Geprüft": einziges erlaubtes UPDATE (Trigger `anamnese_unveraenderlich`).
 * `.is('geprueft_am', null)` — eine schon geprüfte Zeile wird nicht überschrieben.
 */
export async function markiereGeprueft(sb, id, userId) {
  try {
    const { error } = await sb.from('anamnese')
      .update({ geprueft_am: new Date().toISOString(), geprueft_von: userId || null })
      .eq('id', id).is('geprueft_am', null);
    return error ? { error: error.message || 'Fehlgeschlagen' } : {};
  } catch (e) { return { error: (e && e.message) || 'Fehlgeschlagen' }; }
}

/**
 * Übergang: jüngster Fußbefund des Patienten mit `befund.risiken` — Quelle der VORSCHLÄGE für eine
 * noch nicht vorhandene Podo-Anamnese. @returns {{risiken:object, datum:string}|null}
 */
export async function ladeAltrisiken(sb, leadId) {
  if (!sb || !leadId) return null;
  try {
    const { data } = await sb.from('pat_fussbefund')
      .select('befund,erstellt_am')
      .eq('lead_id', leadId).eq('ist_aktuell', true)
      .order('erstellt_am', { ascending: false }).limit(10);
    const z = (data || []).find((r) => r?.befund?.risiken && typeof r.befund.risiken === 'object'
      && !r.befund.risiken.anamnese_id);
    return z ? { risiken: z.befund.risiken, datum: z.erstellt_am } : null;
  } catch { return null; }
}
