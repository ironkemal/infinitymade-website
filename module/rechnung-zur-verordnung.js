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
import { bgFehltFuerRechnung, bgAusZeile } from './bg-angaben.js?v=20261010z';

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
  return `<div style="border-top:1px solid var(--border,#2d3a4a);margin:3px 0;"></div><div class="rx-drucken-item" data-type="rechnung" style="padding:7px 14px;cursor:pointer;font-size:12px;color:var(--text-main,#e2e8f0);white-space:nowrap;">📄 Rechnung · ${label}</div>`;
}

/**
 * Zuzahlungsrechnung + RZG-Quittung im Drucken-Menü — NUR bei Kassenverordnungen.
 * Zuzahlung gibt es nur in der GKV (§ 61 SGB V); bei Privat/Selbstzahler/BG wäre
 * eine Zuzahlungsquittung neben der Rechnung irreführend (gkv-302, 10.10.2026,
 * PE-006 B „Keine Zuzahlung" für BG; canli-test T29).
 *
 * @param {string|null|undefined} rezeptart
 * @returns {string} HTML-String
 */
export function zuzahlungMenueEintraege(rezeptart) {
  if (!istKasse(rezeptart)) return '';
  const stil = 'padding:7px 14px;cursor:pointer;font-size:12px;color:var(--text-main,#e2e8f0);white-space:nowrap;';
  return `<div class="rx-drucken-item" data-type="quittung_zuzahlung" style="${stil}">💶 Zuzahlungsrechnung</div>`
    + `<div class="rx-drucken-item" data-type="rzg_quittung" style="${stil}">🧾 RZG-Quittung</div>`;
}

/**
 * Das ganze „Drucken ▾"-Menü einer Verordnung als HTML — eine Quelle für die
 * Rezeptliste der Akte (dashboard.js `loadPatientDetailRezepte`) und für die
 * Verordnungskarte (module/verordnung-uebersicht.js). Vorher stand es inline
 * in dashboard.js und war in der Podologie unsichtbar, weil die Rezeptliste
 * dort ausgeblendet ist (podoloji 10.10.2026: 4 statt 2 Tippen bis zum Beleg).
 *
 * @param {{ id: string, rezeptart?: string|null, icon?: string, touch?: boolean, label?: string }} param0
 *   `label` = Knopftext (Akte-Karte: „Zuzahlung"/„Rechnung" je Kostenträger, podoloji 10.10.2026).
 *   `touch` = Knopf mit 44 px Mindesthöhe (Karte in der Akte, Telefon).
 * @returns {string} HTML-String
 */
export function druckenMenueHtml({ id, rezeptart, icon = '', touch = false, label = 'Drucken' } = {}) {
  const rxId = String(id ?? '').replace(/[^0-9a-zA-Z-]/g, '');
  const stil = 'padding:7px 14px;cursor:pointer;font-size:12px;color:var(--text-main,#e2e8f0);white-space:nowrap;';
  return `<div class="rx-drucken-wrap" style="position:relative;display:inline-block;" data-id="${rxId}">
            <button type="button" class="btn-ghost btn-sm rx-drucken-toggle" data-id="${rxId}" style="display:flex;align-items:center;gap:4px;${touch ? 'min-height:44px;' : ''}">
              ${icon ? `<span class="svg-icon" style="width:13px;height:13px;display:inline-flex;vertical-align:-2px;">${icon}</span>` : ''}
              ${label} ▾
            </button>
            <div class="rx-drucken-menu" style="display:none;position:absolute;right:0;top:100%;z-index:1000;background:var(--bg-card-solid,#1e2a3a);border:1px solid var(--border,#2d3a4a);border-radius:8px;min-width:190px;padding:4px 0;box-shadow:0 4px 16px rgba(0,0,0,.4);margin-top:2px;">
              ${zuzahlungMenueEintraege(rezeptart)}
              ${rechnungMenueEintrag(rezeptart)}
              <div style="border-top:1px solid var(--border,#2d3a4a);margin:3px 0;"></div>
              <div class="rx-drucken-item" data-type="rezeptvorderseite" style="${stil}">🗒 Rezeptvorderseite</div>
            </div>
          </div>`;
}

/**
 * Verdrahtet alle „Drucken ▾"-Menüs unterhalb von `root`: auf/zu, Außenklick
 * schließt, Klick auf einen Eintrag → `onEintrag(rxId, typ)`.
 * Mehrfach aufrufbar (nach jedem Neuzeichnen): der Außenklick-Zuhörer hängt
 * am Dokument und wird je `root` ersetzt, nicht gestapelt.
 *
 * @param {HTMLElement} root
 * @param {{ onEintrag?: (rxId: string, typ: string) => any }} [deps]
 */
export function verdrahteDruckenMenue(root, { onEintrag } = {}) {
  if (!root || typeof document === 'undefined') return;
  const alleZu = () => root.querySelectorAll('.rx-drucken-menu').forEach(m => { m.style.display = 'none'; });
  root.querySelectorAll('.rx-drucken-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.closest('.rx-drucken-wrap').querySelector('.rx-drucken-menu');
      const warOffen = menu.style.display === 'block';
      alleZu();
      menu.style.display = warOffen ? 'none' : 'block';
      // Karte unten am Bildrand: Menü ins Bild rollen statt unsichtbar aufklappen (canli-test 10.10.2026, P2).
      if (!warOffen) menu.scrollIntoView?.({ block: 'nearest' });
    });
  });
  root.querySelectorAll('.rx-drucken-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const wrap = item.closest('.rx-drucken-wrap');
      wrap.querySelector('.rx-drucken-menu').style.display = 'none';
      await onEintrag?.(wrap.dataset.id, item.dataset.type);
    });
    item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-hover,rgba(255,255,255,0.07))'; });
    item.addEventListener('mouseleave', () => { item.style.background = ''; });
  });
  document.removeEventListener('click', root._druckenOutsideHandler);
  root._druckenOutsideHandler = alleZu;
  document.addEventListener('click', alleZu);
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
      .or('invoice_type.is.null,invoice_type.neq.zuzahlung')
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
    ladePodVerordnung,
    toast,
  } = deps;

  const vorhandeneId = await sucheRechnungZurVerordnung(supabase, rxId);
  if (vorhandeneId) {
    if (switchPanel) switchPanel('rechnungen');
    if (openInvEditor) await openInvEditor(vorhandeneId);
    return 'vorhanden';
  }

  // Die Podologie-Abrechnung hält ihre Verordnungen nur, wenn das Panel in
  // dieser Sitzung schon offen war. Aus der Akte heraus ist das nicht sicher —
  // ohne Nachladen landete der Weg im leeren Editor (fonksiyon-ustasi 10.10.2026).
  if (ladePodVerordnung) await ladePodVerordnung(rxId);
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
  if (invoiceType === 'zuzahlung') {
    return 'Zuzahlungsbelege werden über den Druck am Rezept ausgestellt und sind nicht bearbeitbar.';
  }
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
