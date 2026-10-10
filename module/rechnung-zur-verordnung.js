/**
 * rechnung-zur-verordnung.js — Menü- und Navigationsbrücke zur Rechnung aus Verordnungen.
 *
 * Hintergrund & Entscheidung (gkv-302, 09.10.2026, KHS §4):
 * Bisher erzeugte der Drucken-Weg über GET /prescription/:id/rechnung flüchtige
 * RE-<uuid8>-Belege ohne GoBD-Nummernkreis und ohne DB-Eintrag. Bei GKV-Rezepten
 * bestand akute Doppelabrechnungsgefahr (dieselbe Leistung ging an Kasse und Patient).
 *
 * Dieser alte RE-Weg ist geschlossen. Rechnungen (Privat, Selbstzahler, BG) entstehen
 * ausschließlich im Rechnungs-Editor (Tabelle invoices, fortlaufender Nummernkreis,
 * GoBD-Festschreibung). Für GKV-Verordnungen wird im Druckmenü kein Rechnungseintrag
 * mehr angeboten. rechnung_sonder entfällt ersatzlos.
 */

import { istKasse, istBg, rezeptartLabel } from './rezeptart.js?v=20261006a';
import { bgFehltFuerRechnung, bgAusZeile } from './bg-angaben.js?v=20261009rs';

const UUID_REGEX = /^[0-9a-f-]{36}$/i;

/**
 * Erzeugt den Menüeintrag im Drucken-Menü einer Verordnungskarte.
 * Für Kassenverordnungen wird nichts gerendert (keine Doppelabrechnung).
 *
 * @param {string|null|undefined} rezeptart
 * @returns {string} HTML-String
 */
export function rechnungMenueEintrag(rezeptart) {
  if (istKasse(rezeptart)) return '';
  const label = rezeptartLabel(rezeptart);
  return `<div style="border-top:1px solid var(--border,#2d3a4a);margin:3px 0;"></div><div class="rx-drucken-item" data-type="rechnung" style="padding:7px 14px;cursor:pointer;font-size:12px;color:var(--text-main,#e2e8f0);white-space:nowrap;">📄 Rechnung (${label})</div>`;
}

/**
 * Sucht die ID der jüngsten nicht stornierten Rechnung zu einer Verordnung.
 *
 * @param {object} supabase
 * @param {string} rxId UUID der Verordnung
 * @returns {Promise<string|null>} Rechnungs-ID oder null
 */
export async function sucheRechnungZurVerordnung(supabase, rxId) {
  if (!supabase || typeof rxId !== 'string' || !UUID_REGEX.test(rxId)) return null;
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id')
      .or(`prescription_id.eq.${rxId},verordnung_id.eq.${rxId}`)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data || !data.length) return null;
    return data[0]?.id || null;
  } catch {
    return null;
  }
}

/**
 * Öffnet die passende Rechnungsansicht / den Editor für eine Verordnung.
 *
 * 1. Vorhandene Rechnung -> im Editor öffnen ('vorhanden')
 * 2. Podologische Verordnung -> über rechnungAusVerordnung() vorbefüllen ('neu')
 * 3. Sonst -> leeren Editor öffnen, Patient vorwählen und Hinweis ('leer')
 *
 * @param {{ rxId: string, leadId?: string|null }} param0
 * @param {object} deps
 * @returns {Promise<'vorhanden'|'neu'|'leer'>}
 */
export async function oeffneRechnungZurVerordnung({ rxId, leadId }, deps = {}) {
  const {
    supabase,
    switchPanel,
    openInvEditor,
    rechnungAusVerordnung,
    podVerordnungVorhanden,
    toast,
  } = deps;

  const vorhandeneId = await sucheRechnungZurVerordnung(supabase, rxId);
  if (vorhandeneId) {
    if (switchPanel) switchPanel('rechnungen');
    if (openInvEditor) await openInvEditor(vorhandeneId);
    return 'vorhanden';
  }

  if (podVerordnungVorhanden && podVerordnungVorhanden(rxId)) {
    if (rechnungAusVerordnung) await rechnungAusVerordnung(rxId);
    return 'neu';
  }

  if (switchPanel) switchPanel('rechnungen');
  if (openInvEditor) await openInvEditor(null);
  if (typeof document !== 'undefined') {
    const sel = document.getElementById('invPatientSelect');
    if (sel && leadId != null) {
      sel.value = leadId;
      sel.dispatchEvent(new Event('change'));
    }
  }
  if (toast) toast('Bitte im Editor die Verordnung auswählen und Leistungen ergänzen.', 'info');
  return 'leer';
}

/**
 * Prüft beim Speichern einer Rechnung, ob BG-Bedingungen erfüllt sind.
 * Blockiert das Speichern mit einer verständlichen Fehlermeldung, falls nicht.
 *
 * @param {{ supabase: object, invoiceType?: string|null, prescriptionId?: string|null }} param0
 * @returns {Promise<string|null>} Fehlermeldung oder null wenn erlaubt
 */
export async function bgSperreBeimSpeichern({ supabase, invoiceType, prescriptionId }) {
  if (invoiceType !== 'bg') return null;
  if (!prescriptionId) {
    return 'Eine BG-Rechnung braucht eine BG-Verordnung (UV-Träger, Anschrift, Unfalltag). Bitte im Editor die Verordnung auswählen.';
  }
  if (!supabase) {
    return 'BG-Angaben der Verordnung konnten nicht geprüft werden — bitte erneut versuchen.';
  }
  try {
    const { data: rx, error } = await supabase
      .from('prescriptions')
      .select('rezeptart, bg_traeger_name, bg_traeger_anschrift, bg_unfalltag')
      .eq('id', prescriptionId)
      .maybeSingle();

    if (error || !rx) {
      return 'BG-Angaben der Verordnung konnten nicht geprüft werden — bitte erneut versuchen.';
    }
    if (!istBg(rx.rezeptart)) {
      return 'Die gewählte Verordnung ist keine BG-Verordnung — BG-Rechnung nicht möglich.';
    }
    const fehlt = bgFehltFuerRechnung(bgAusZeile(rx));
    if (fehlt && fehlt.length > 0) {
      return `Für die BG-Rechnung fehlen Angaben in der Verordnung: ${fehlt.join(', ')}. Bitte in der Verordnung ergänzen.`;
    }
    return null;
  } catch {
    return 'BG-Angaben der Verordnung konnten nicht geprüft werden — bitte erneut versuchen.';
  }
}
