/**
 * podologie-abrechnung.js — Verordnungen und Tagesbehandlungen der Podologie.
 *
 * Herkunft
 * ────────
 * Reiner Umzug aus `dashboard.js` (Zeilen 23351–24617), Stand 27.08.2026.
 * Grundlage ist die Einkreisungs-Entscheidung des Konseys vom 13.08.2026:
 * `dashboard.js` wächst nicht mehr, und was angefasst wird, zieht um. Die
 * Podologie war als zusammenhängender Block der erste Kandidat.
 *
 * ⚠ An Aussehen und Verhalten wurde NICHTS geändert. Auch bekannte Fehler
 * sind mitgezogen worden, statt sie unterwegs zu reparieren — ein Umzug, bei
 * dem gleichzeitig repariert wird, lässt sich hinterher nicht mehr prüfen.
 * Bekannt und absichtlich unangetastet: der Zuhörer auf `#podBillingContent`
 * (§302-Knöpfe) hängt sich bei jedem Rendern erneut an ein statisches Element
 * und sammelt sich dadurch an. Dafür gibt es eine eigene Karte.
 *
 * Was NICHT mitgekommen ist
 * ─────────────────────────
 * `rechnungAusVerordnung()` bleibt in `dashboard.js`. Die Funktion SCHREIBT in
 * `invLines`, `invVerordnungId`, `invBehandlungIds` und
 * `invPatientInsuranceType` — Modul-Variablen des Rechnungseditors. Import-
 * Bindungen sind in ES-Modulen schreibgeschützt, eine Zuweisung von hier aus
 * wäre ein TypeError. Sie kommt als `ctx.rechnungAusVerordnung` herein und
 * holt sich die Verordnung über den Export `getPodVerordnung()`.
 *
 * Die ICD-Regeln der Diagnosegruppen sind in `diagnosegruppen-regeln.js`
 * gelandet, nicht hier: die Tabelle `diagnosegruppen` gehört nicht der
 * Podologie, `_wireDgIcdPair` bedient damit auch Rezept-Formular und
 * Rezept-Scan.
 *
 * Nicht verwechseln
 * ─────────────────
 * `POD_HEILMITTEL_KATALOG` hier und `POD_KATALOG` in `verordnung-podo.js`
 * halten ähnliche Angaben, gehören aber zu zwei verschiedenen Bildschirmen.
 * Nicht zusammenlegen.
 *
 * Verdrahtung
 * ───────────
 * `dashboard.js` ruft `mountPodologieAbrechnung(podoCtx())` auf. `podoCtx()`
 * liefert die Abhängigkeiten; `leads` und `services` kommen als GETTER, weil
 * `leadsCache` und `ownerServices` in dashboard.js neu zugewiesen werden — als
 * Wert übergeben hielte dieses Modul für immer das leere Array vom ersten
 * Aufruf.
 */

import { parseIcdList, matchIcdToDg, soleIcdForDg } from '../icd-dg-match.js?v=20260810e';
import { searchHeilmittel, heilmittelOptionsHtml } from '../katalog-suche.js?v=20260817';
import { attachPatientSearch } from '../patient-suche.js?v=20260817';
import { statusBadge as abrStatusBadge, oeffneStatusDialogFuer } from './abrechnungsstatus.js?v=20260815';
import { rechnungButtonHtml } from './rechnung-bruecke.js?v=20260816';
import { belegnummerRosette } from './belegnummer.js?v=20260817';
import { wireArztFeld } from './arzt-register.js?v=20260816';
import { loadDgIcdRules, podDiagOptionsHtml } from './diagnosegruppen-regeln.js?v=20260827';

let ctx = null;                 // Abhängigkeiten aus dashboard.js, gesetzt in mountPodologieAbrechnung()

// ===== PODOLOGIE BILLING =====

// HPNR-Positionen kommen aus `heilmittel_katalog` (RPC search_heilmittel),
// erzeugt aus den Abrechnungs-Codedateien. Die früher hier fest verdrahtete
// Liste kannte nur 13 Kodes und keine Gültigkeitsdaten — dadurch fehlten der
// Hausbesuch (79933/79934) bei UI1/UI2, und abgelöste Positionen hätten nicht
// von den gültigen unterschieden werden können.
let _hpnrByDiag = new Map();   // diagRoot -> [{code,label,preis_eur,…}]
let _podCurrentHpnr = [];      // die aktuell gerenderte Liste

async function podLoadHpnr(diagRoot, datum = null) {
  const key = `${diagRoot}|${datum || ''}`;
  if (_hpnrByDiag.has(key)) return _hpnrByDiag.get(key);
  const rows = await searchHeilmittel(ctx.supabase, '', {
    bereich: 'podologie', diagnosegruppe: diagRoot || null, datum, limit: 100,
  });
  _hpnrByDiag.set(key, rows);
  return rows;
}

/** Label für eine HPNR aus dem geladenen Katalog (Fallback: der Kode selbst). */
function hpnrLabel(code) {
  const cur = _podCurrentHpnr.find(r => r.code === code);
  if (cur) return cur.label;
  for (const rows of _hpnrByDiag.values()) {
    const hit = rows.find(r => r.code === code);
    if (hit) return hit.label;
  }
  return code;
}

function podDiagRoot(diagCode) {
  if (!diagCode) return '';
  if (diagCode.startsWith('DF')) return 'DF';
  return diagCode; // NF, QF, UI1, UI2
}

// ─── Muster 13, Feld g: verordnetes Heilmittel ────────────────────────────────
//
// Quelle: HeilM-RL (Stand 15.05.2025, iK 05.08.2025), Heilmittelkatalog
// Podologische Therapie. Für DF, NF und QF ist der Katalog wortgleich; UI1/UI2
// haben keinen a/b/c-Katalog (dort läuft die Nagelspangenbehandlung).
// Leitsymptomatik und Heilmittel sind in der Richtlinie parallel buchstabiert:
// a↔a, b↔b, c↔c.
//
// ⚠ Positionszuordnung — hier wird am häufigsten zu viel abgerechnet:
// Hornhautabtragung ODER Nagelbearbeitung allein werden IMMER mit 78010 zzgl.
// 78030 abgerechnet, auch bei mehr als 20 Minuten Therapiezeit
// (FAK Podologie Q25). 78020 „Podologische Behandlung (groß)" ist
// ausschließlich bei verordneter Komplexbehandlung mit Therapiezeit über
// 20 Minuten abrechenbar — sonst Retaxation (~15 € je Sitzung).
// Siehe Handbücher/SPEC-RULES.md und Podoloji/podologie-hpnr-reference.js.
const POD_HEILMITTEL_KATALOG = {
  a: {
    heilmittel:      'Hornhautabtragung',
    leitsymptomatik: 'Hyperkeratose (schmerzlos und schmerzhaft)',
    hpnr:            '78010',
    hpnrGross:       null,
  },
  b: {
    heilmittel:      'Nagelbearbeitung',
    leitsymptomatik: 'Pathologisches Nagelwachstum (Verdickung, Tendenz zum Einwachsen)',
    hpnr:            '78010',
    hpnrGross:       null,
  },
  c: {
    heilmittel:      'Podologische Komplexbehandlung',
    leitsymptomatik: 'Hyperkeratose und pathologisches Nagelwachstum',
    hpnr:            '78010',
    hpnrGross:       '78020',   // nur bei Therapiezeit > 20 Min
  },
};
const POD_HEILMITTEL_DGS  = ['DF', 'NF', 'QF'];  // UI1/UI2 haben keinen a/b/c-Katalog
const POD_BEFUNDPAUSCHALE = '78030';             // Pflicht je Behandlungstag, außer UI1/UI2

/**
 * Verordnetes Heilmittel einer Verordnung als Buchstabe a|b|c, sonst ''.
 * Neue Verordnungen führen ihn in `leitsymptomatik`; ältere nur in den
 * einzelnen `heilmittel_items` — und ganz alte gar nicht, dann bleibt es leer
 * und es wird nicht geprüft (lieber keine Regel als eine falsche).
 *
 * Altbestand steht als "DF-a" in der Spalte (die Diagnosegruppe war mit
 * eingetragen); der Buchstabe dahinter ist dieselbe Leitsymptomatik.
 * Das gilt für JEDE Diagnosegruppe mit a/b/c-Katalog, nicht nur DF — ein
 * Altbestand "NF-c" muss genauso gelesen werden, sonst fällt bei ihm die
 * 78020-Sperre still aus (Retaxationsrisiko, ~15 € je Sitzung).
 */
function podVordMassnahme(vord) {
  const roh = String(vord?.leitsymptomatik || '').trim().toLowerCase();
  const _dgPrefix = POD_HEILMITTEL_DGS.map(d => d.toLowerCase()).join('|');
  const direkt = (roh.match(new RegExp(`^(?:(?:${_dgPrefix})-)?([abc])$`)) || [])[1] || '';
  if (POD_HEILMITTEL_KATALOG[direkt]) return direkt;
  const items = Array.isArray(vord?.heilmittel_items) ? vord.heilmittel_items : [];
  const ausItem = items.map(i => i?.massnahme).find(m => POD_HEILMITTEL_KATALOG[m]);
  return ausItem || '';
}

let _podState = { selectedVordId: null, editVordId: null, verordnungen: [] };
let _podKkCache = [];

// Nur 'kassen' ist eine GKV-Verordnung. Für alles andere gibt es weder eine
// Diagnosegruppe nach HeilM-RL noch einen Kostenträger — die Abrechnungsfelder
// klappen weg und dürfen nie in eine §302-Datei geraten (Konsey 2026-08-10).
const POD_GKV_REZEPTART = 'kassen';
const POD_ANLASS_DEFAULT = 'Podologische Komplexbehandlung';

// Klicks der Verordnungsliste — EINMAL an `document`. Vorher hing der Zuhörer am
// Ende von loadPodologieBilling(), nach Kassenliste/Heilmittel/Katalogen: warf
// etwas dazwischen, waren die Knöpfe sichtbar aber tot ("Status lässt sich nicht
// klicken"). Am document ist er unabhängig davon, wie weit das Rendern kommt.
document.addEventListener('click', (e) => {
  if (!e.target.closest?.('#podVordList')) return;
  const stBtn = e.target.closest('.pod-vord-status');
  if (stBtn) {
    e.stopPropagation();
    oeffneStatusDialogFuer(stBtn.dataset.statusId, { supabase: ctx.supabase, onFertig: loadPodologieBilling })
      .catch(err => { console.error('[pod-status]', err); ctx.showToast(err.message || 'Status konnte nicht geöffnet werden', 'error'); });
    return;
  }
  const reBtn = e.target.closest('.pod-vord-rechnung');
  if (reBtn) {
    e.stopPropagation();
    ctx.rechnungAusVerordnung(reBtn.dataset.rechnungVordId)
      .catch(err => { console.error('[pod-rechnung]', err); ctx.showToast(err.message || 'Rechnung konnte nicht vorbereitet werden', 'error'); });
    return;
  }
  // Edit-Schaltfläche: Zeile NICHT als Behandlungsauswahl markieren
  const editBtn = e.target.closest('.pod-vord-edit');
  if (editBtn) {
    e.stopPropagation();
    _podState.editVordId = editBtn.dataset.editId;
    loadPodologieBilling();
    return;
  }
  const row = e.target.closest('[data-vord-id]');
  if (!row) return;
  _podState.selectedVordId = row.dataset.vordId === _podState.selectedVordId ? null : row.dataset.vordId;
  loadPodologieBilling();
});

async function loadPodologieBilling() {
  const el = document.getElementById('podBillingContent');
  if (!el) return;
  el.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">Lade…</span>';

  // ICD-Prüfregeln der Diagnosegruppen — Voraussetzung für podValidateIcd10()
  await loadDgIcdRules(ctx.supabase);

  // Load kostentraeger for billing KK selection (IK numbers required)
  if (_podKkCache.length === 0) {
    const all = await ctx.loadKkList();
    _podKkCache = all.filter(k => k.ik);
  }

  const ownerId = ctx.getOwnerId();
  const { data: vords, error } = await ctx.supabase
    .from('verordnungen')
    // leads(patientennummer) nur für die Nummer neben dem Namen — `belegnummer`
    // ist bis zur Abrechnung leer, sie muss zusammengesetzt werden.
    .select('*, leads!lead_id(patientennummer)')
    .eq('owner_id', ownerId)
    // Abgesetzte gehören in die Arbeitsliste — sonst bleibt ausgefallenes Geld unsichtbar.
    .in('status', ['aktiv', 'abrechenbar', 'abgesetzt', 'teilabsetzung'])
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = `<p style="color:var(--danger)">Fehler: ${ctx.escapeHtml(error.message)}</p>`; return; }
  _podState.verordnungen = vords || [];

  const today = new Date(); today.setHours(0,0,0,0);

  function vordAlerts(v) {
    const alerts = [];
    if (!v.behandlungsstart) {
      let deadline = null;
      if (v.beginn_spaetestens) {
        deadline = new Date(v.beginn_spaetestens);
      } else if (v.ausstellungsdatum) {
        const issued = new Date(v.ausstellungsdatum);
        const frist = v.dringend ? 14 : 28;
        deadline = new Date(issued); deadline.setDate(deadline.getDate() + frist);
      }
      if (deadline && today > deadline) {
        const frist = v.dringend ? 14 : 28;
        alerts.push({ type: 'danger', msg: `Behandlungsfrist abgelaufen (${frist}-Tage-Regel)` });
      }
    }
    // Absetzungsgrund = Arbeitsanweisung für die Korrektur, gehört an die Zeile.
    if (v.absetzung_grund) alerts.push({ type: 'danger', msg: `Kasse: ${v.absetzung_grund.split('\n')[0]}` });
    return alerts;
  }

  const vordListHtml = _podState.verordnungen.length === 0
    ? `<p style="color:var(--text-muted);padding:12px 0;">${ctx.t('pod_no_vord')}</p>`
    : _podState.verordnungen.map(v => {
        const alerts = vordAlerts(v);
        const alertHtml = alerts.map(a =>
          `<div style="color:${a.type==='danger'?'#ef4444':'#f59e0b'};font-size:12px;margin-top:4px;">⚠ ${ctx.escapeHtml(a.msg)}</div>`
        ).join('');
        const isSelected = _podState.selectedVordId === v.id;
        const _hmLetter = podVordMassnahme(v);
        const _isGkv    = (v.rezeptart || 'kassen') === POD_GKV_REZEPTART;
        const _hmRozet  = (_isGkv && _hmLetter && POD_HEILMITTEL_KATALOG[_hmLetter])
          ? `<span style="font-size:12px;background:var(--bg-card-solid,#1f2937);padding:2px 8px;border-radius:12px;color:var(--text-main);border:1px solid var(--border);">` +
            ctx.escapeHtml((v.diagnosegruppe ? `${v.diagnosegruppe}-` : '') + `${_hmLetter} · ${POD_HEILMITTEL_KATALOG[_hmLetter].heilmittel}`) +
            `</span>`
          : '';
        return `<div class="pod-vord-row${isSelected?' pod-vord-selected':''}" data-vord-id="${v.id}" style="
          padding:12px 14px;border:1px solid ${isSelected?'var(--primary)':'var(--border-subtle,var(--border))'};
          border-radius:8px;cursor:pointer;background:${isSelected?'var(--bg-card)':'transparent'};
          margin-bottom:8px;transition:border-color .15s;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
              <span style="font-weight:600;color:var(--text-main);">${ctx.escapeHtml(v.patient_name || '—')}</span>${belegnummerRosette(v, { patientennummer: v.leads?.patientennummer, escapeHtml: ctx.escapeHtml, titel: 'Patientennummer-Verordnungsnummer — dieselbe Nummer steht auf Rechnung und Abrechnungsdatei' })}
              <span style="font-size:12px;background:var(--bg-card-solid,#1f2937);padding:2px 8px;border-radius:12px;color:var(--text-main);">${ctx.escapeHtml(
                _isGkv
                  ? (v.diagnosegruppe || '—')
                  : (v.behandlungsanlass || POD_ANLASS_DEFAULT)
              )}</span>
              ${_hmRozet}
              ${!_isGkv ? `<span style="font-size:11px;background:var(--bg-card-solid,#1f2937);border:1px solid var(--border);padding:2px 7px;border-radius:12px;color:var(--text-muted);">${ctx.escapeHtml(v.rezeptart)}</span>` : ''}
              ${v.status && v.status !== 'aktiv' ? abrStatusBadge(v.status) : ''}
              ${v.absetzung_betrag ? `<span style="font-size:11px;color:#c2410c;font-weight:600;">−${Number(v.absetzung_betrag).toFixed(2).replace('.', ',')} €</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <span style="font-size:12px;color:var(--text-muted);">${v.ausstellungsdatum ? new Date(v.ausstellungsdatum).toLocaleDateString('de-DE') : '—'}</span>
              <button class="pod-vord-edit" data-edit-id="${v.id}" style="padding:2px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:12px;cursor:pointer;white-space:nowrap;">${ctx.t('pod_edit')}</button>
              <button class="pod-vord-status" data-status-id="${v.id}" title="Abrechnungsstatus ändern" style="padding:2px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:12px;cursor:pointer;white-space:nowrap;">Status</button>
              ${rechnungButtonHtml(v, { label: ctx.t('pod_rechnung') })}
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">
            ${v.behandlungseinheiten ? `${v.behandlungseinheiten} Einheiten` : ''}
            ${v.therapiefrequenz ? ' · ' + ctx.escapeHtml(v.therapiefrequenz) : ''}
            ${v.dringend ? ' · <strong style="color:#ef4444;">Dringend</strong>' : ''}
            ${v.hausbesuch ? ' · Hausbesuch' : ''}
          </div>
          ${alertHtml}
        </div>`;
      }).join('');

  const selectedVord = _podState.verordnungen.find(v => v.id === _podState.selectedVordId);
  const diagRoot = selectedVord ? podDiagRoot(selectedVord.diagnosegruppe) : '';
  const isUI = diagRoot === 'UI1' || diagRoot === 'UI2';
  const todayStr = today.toISOString().split('T')[0];
  // Gültige Positionen zum Behandlungsdatum — abgelöste (z. B. Ross-Fraser)
  // filtert die RPC bereits heraus.
  const hpnrRows = diagRoot ? await podLoadHpnr(diagRoot, todayStr) : [];
  _podCurrentHpnr = hpnrRows;

  const behandlungFormHtml = selectedVord ? `
    <div class="card" style="margin-top:0;background:var(--bg-card);border:1px solid var(--border-subtle,var(--border));border-radius:10px;padding:18px;">
      <h4 style="margin:0 0 14px;color:var(--text-main);font-size:15px;">${ctx.t('pod_tagesbehandlung')} — ${ctx.escapeHtml(selectedVord.patient_name || '—')}</h4>
      <div style="display:grid;gap:12px;">
        <div>
          <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_behandlungsdatum')}</label>
          <input type="date" id="podBehDatum" value="${todayStr}" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
        </div>
        <div>
          <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:6px;">${ctx.t('pod_hpnr')}</label>
          <div id="podHpnrChecks" style="display:flex;flex-wrap:wrap;gap:8px;">
            ${hpnrRows.map(r => {
              const code = r.code;
              const isHausbesuch = selectedVord?.hausbesuch === true;
              const autoChecked =
                (diagRoot !== 'UI1' && diagRoot !== 'UI2' && code === '78030') ? 'checked' :
                (isHausbesuch && code === '79933') ? 'checked' : '';
              return `<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;background:var(--bg-card-solid,#1f2937);padding:5px 10px;border-radius:6px;border:1px solid var(--border);">
                <input type="checkbox" class="pod-hpnr-cb" value="${ctx.escapeHtml(code)}" ${autoChecked}> ${ctx.escapeHtml(code)} – ${ctx.escapeHtml(r.label)}
              </label>`;
            }).join('')}
          </div>
        </div>
        <div id="podLokalisationWrap" style="display:${isUI?'block':'none'};">
          <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_lokalisation')} <span style="color:#ef4444;">*</span></label>
          <input type="text" id="podLokalisation" placeholder="z. B. Zehe II rechts" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
        </div>
        <div>
          <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_notizen')}</label>
          <textarea id="podBehNotizen" rows="2" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;resize:vertical;"></textarea>
        </div>
        <div id="podBehError" style="color:#ef4444;font-size:13px;display:none;"></div>
        <button id="podSaveBehBtn" class="btn-primary" style="width:fit-content;">${ctx.t('pod_save_behandlung')}</button>
      </div>
    </div>` : `<div style="color:var(--text-muted);font-size:13px;padding:12px 0;">← Wählen Sie eine Verordnung aus der Liste.</div>`;

  const editVord = _podState.editVordId ? _podState.verordnungen.find(v => v.id === _podState.editVordId) : null;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">

      <!-- Links: Neue Verordnung + Liste -->
      <div>
        <div class="card" style="background:var(--bg-card);border:1px solid var(--border-subtle,var(--border));border-radius:10px;padding:18px;margin-bottom:16px;">
          <h4 style="margin:0 0 14px;color:var(--text-main);font-size:15px;">${editVord ? ctx.t('pod_edit_vord') : ctx.t('pod_new_vord')}</h4>
          <div style="display:grid;gap:10px;">
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_patient')}</label>
              <input type="text" id="podNewPatient" placeholder="Name suchen oder eingeben…" autocomplete="off" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              <input type="hidden" id="podNewLeadId">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">Versichertennummer</label>
              <input type="text" id="podNewVsnr" placeholder="z. B. A123456789" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">Verordnender Arzt</label>
              <input type="text" id="podNewArztName" placeholder="Arztname oder LANR suchen…" autocomplete="off" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              <input type="hidden" id="podNewArztId">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;">
                <input type="text" id="podNewArztLanr" inputmode="numeric" maxlength="9" placeholder="LANR (9-stellig)" autocomplete="off" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
                <input type="text" id="podNewArztBsnr" inputmode="numeric" maxlength="9" placeholder="BSNR (9-stellig)" autocomplete="off" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              </div>
              <div id="podArztHint" style="font-size:12px;color:var(--text-muted);margin-top:3px;display:none;"></div>
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_ausstelldatum')}</label>
              <input type="date" id="podNewAusstelldatum" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
            </div>
            <!-- Rezeptart steuert das Formular: bei allem außer 'kassen' wandern die
                 Abrechnungsfelder in den eingeklappten GKV-Block (Konsey 2026-08-10). -->
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_rezeptart')}</label>
              <select id="podNewRezeptart" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                <option value="kassen">Kassen-Rezept (GKV)</option>
                <option value="privat">Privat-Rezept</option>
                <option value="bg">BG-Rezept</option>
                <option value="selbstzahler">Selbstzahler</option>
              </select>
            </div>
            <div id="podBehandlungsanlassWrap" style="display:none;">
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_behandlungsanlass')}</label>
              <input type="text" id="podNewBehandlungsanlass" placeholder="${ctx.escapeHtml(POD_ANLASS_DEFAULT)}" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">${ctx.t('pod_behandlungsanlass_hint')}</div>
            </div>
            <details id="podGkvDetails" open style="border:1px solid var(--border);border-radius:6px;padding:0;background:transparent;">
              <summary id="podGkvSummary" style="display:none;cursor:pointer;padding:8px 10px;font-size:13px;color:var(--text-muted);list-style:none;">${ctx.t('pod_gkv_angaben')}</summary>
              <div id="podGkvBody" style="display:grid;gap:10px;padding:0;">
                <div>
                  <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">Krankenkasse</label>
                  <select id="podNewKk" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                    <option value="">— Krankenkasse wählen —</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_diagnosegruppe')}</label>
                  <select id="podNewDiag" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                    <option value="">— Wählen —</option>
                    ${podDiagOptionsHtml()}
                  </select>
                </div>
                <div>
                  <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_icd10_label')}</label>
                  <input type="text" id="podNewIcd10" placeholder="z. B. E11.74" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
                  <div id="podIcd10Warning" style="color:var(--warning);font-size:12px;margin-top:4px;display:none;"></div>
                  <div id="podL60Hint" style="display:none;margin-top:6px;padding:8px 10px;border-radius:6px;border:1px solid var(--warning);background:var(--bg-card-solid,#1f2937);font-size:13px;color:var(--text-main);">
                    <div style="margin-bottom:6px;color:var(--warning);font-weight:500;">${ctx.escapeHtml(ctx.t('pod_l60_hint'))}</div>
                    <div style="display:flex;gap:8px;">
                      <button type="button" id="podL60UI1Btn" style="flex:1;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;cursor:pointer;">${ctx.escapeHtml(ctx.t('pod_l60_ui1'))}</button>
                      <button type="button" id="podL60UI2Btn" style="flex:1;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;cursor:pointer;">${ctx.escapeHtml(ctx.t('pod_l60_ui2'))}</button>
                    </div>
                  </div>
                </div>
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;">
                  <input type="checkbox" id="podNewZuzahlBefreit"> Zuzahlung befreit
                </label>
              </div>
            </details>
            <!-- Wagner ist klinische Dokumentation (§630f BGB), kein Abrechnungsfeld —
                 bleibt unabhängig von der Rezeptart sichtbar (Konsey 2026-08-10). -->
            <div id="podWagnerWrap" style="display:none;">
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">Wagner-Klassifikation</label>
              <select id="podNewWagner" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                <option value="">— nicht angegeben —</option>
                <option value="0">Grad 0 – Risikofuß (keine offene Läsion)</option>
                <option value="1">Grad 1 – Oberflächliche Ulzeration</option>
                <option value="2">Grad 2 – Tiefes Ulkus (Sehne/Knochen)</option>
                <option value="3">Grad 3 – Tiefeninfektion / Abszess</option>
                <option value="4">Grad 4 – Begrenzte Gangrän</option>
                <option value="5">Grad 5 – Ausgedehnte Gangrän</option>
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div>
                <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_einheiten')}</label>
                <input type="number" id="podNewEinheiten" min="1" max="60" placeholder="z.B. 6" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              </div>
              <div>
                <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_frequenz')}</label>
                <select id="podNewFrequenz" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">${ctx.frequenzOptionsHtml()}</select>
              </div>
            </div>
            <div id="podBeginHintEl" style="font-size:13px;color:var(--text-muted);padding:6px 10px;background:var(--bg-card-solid,#1f2937);border-radius:6px;border:1px solid var(--border);display:none;"></div>
            <div id="podHeilmittelWrap" style="display:none;">
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_heilmittel_g')}</label>
              <select id="podNewHeilmittel" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                <option value="">— Wählen —</option>
                <option value="a">a) Hornhautabtragung</option>
                <option value="b">b) Nagelbearbeitung</option>
                <option value="c">c) Podologische Komplexbehandlung</option>
              </select>
              <label id="podHmGrossWrap" style="display:none;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;margin-top:6px;">
                <input type="checkbox" id="podHmGross"> ${ctx.t('pod_hm_gross')}
              </label>
              <div id="podLeitsymptHint" style="display:none;font-size:12px;color:var(--text-muted);margin-top:6px;padding:6px 10px;background:var(--bg-card-solid,#1f2937);border-radius:6px;border:1px solid var(--border);"></div>
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:6px;">${ctx.t('pod_heilmittel_items')}</label>
              <div id="podHeilmittelItems" style="display:flex;flex-direction:column;gap:6px;"></div>
              <button type="button" id="podAddHeilmittelBtn" style="margin-top:8px;padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;cursor:pointer;">+ Hinzufügen</button>
            </div>
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;">
                <input type="checkbox" id="podNewDringend"> ${ctx.t('pod_dringend')}
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;">
                <input type="checkbox" id="podNewHausbesuch"> ${ctx.t('pod_hausbesuch')}
              </label>
            </div>
            <div id="podNewError" style="color:#ef4444;font-size:13px;display:none;"></div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button id="podSaveVordBtn" class="btn-primary" style="width:fit-content;">${editVord ? ctx.t('pod_update') : ctx.t('pod_save')}</button>
              ${editVord ? `<button id="podCancelEditBtn" style="padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;cursor:pointer;">${ctx.t('pod_cancel_edit')}</button>` : ''}
            </div>
          </div>
        </div>

        <div class="card" style="background:var(--bg-card);border:1px solid var(--border-subtle,var(--border));border-radius:10px;padding:18px;">
          <h4 style="margin:0 0 12px;color:var(--text-main);font-size:15px;">${ctx.t('pod_active_vord')}</h4>
          <div id="podVordList">${vordListHtml}</div>
        </div>

        ${(() => {
          // Nur GKV-Verordnungen sind §302-fähig. Der Server lehnt alles andere
          // ohnehin ab (abrechnung.routes.js) — hier gar nicht erst anbieten.
          const abrechenbar = _podState.verordnungen.filter(v =>
            v.status === 'abrechenbar' && v.kostentraeger_ik && (v.rezeptart || 'kassen') === POD_GKV_REZEPTART);
          if (!abrechenbar.length) return '';
          // Group by KK
          const byKk = {};
          for (const v of abrechenbar) {
            if (!byKk[v.kostentraeger_ik]) byKk[v.kostentraeger_ik] = [];
            byKk[v.kostentraeger_ik].push(v);
          }
          return `<div class="card" style="background:var(--bg-card);border:1px solid #16a34a;border-radius:10px;padding:18px;margin-top:12px;">
            <h4 style="margin:0 0 12px;color:#16a34a;font-size:15px;">§302 Abrechnung bereit</h4>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${Object.entries(byKk).map(([ik, vords]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-card-solid,#1f2937);border-radius:8px;border:1px solid var(--border);">
                  <div>
                    <div style="font-size:13px;font-weight:600;color:var(--text-main);">${ctx.escapeHtml(ik)}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${vords.length} Verordnung${vords.length>1?'en':''} · ${vords.map(v=>ctx.escapeHtml(v.patient_name||'—')).join(', ')}</div>
                  </div>
                  <button class="pod-abr-btn btn-primary" data-kk-ik="${ctx.escapeHtml(ik)}" data-vord-ids="${ctx.escapeHtml(JSON.stringify(vords.map(v=>v.id)))}"
                    style="font-size:13px;padding:6px 14px;white-space:nowrap;">§302 erstellen</button>
                </div>`).join('')}
            </div>
            <div id="podAbrError" style="color:#ef4444;font-size:13px;margin-top:8px;display:none;"></div>
          </div>`;
        })()}
      </div>

      <!-- Rechts: Tagesbehandlung -->
      <div id="podBehPanel">
        ${behandlungFormHtml}
      </div>

    </div>`;

  // ---- Event Listeners ----

  document.getElementById('podSaveVordBtn')?.addEventListener('click', async () => {
    const patient    = document.getElementById('podNewPatient').value.trim();
    const datum      = document.getElementById('podNewAusstelldatum').value;
    const diagVal    = document.getElementById('podNewDiag').value;
    const einh       = parseInt(document.getElementById('podNewEinheiten').value) || null;
    const freq       = document.getElementById('podNewFrequenz').value.trim();
    const dring      = document.getElementById('podNewDringend').checked;
    const hausb      = document.getElementById('podNewHausbesuch').checked;
    const rezeptart  = document.getElementById('podNewRezeptart')?.value || 'kassen';
    const icd10Raw   = document.getElementById('podNewIcd10')?.value || '';
    const errEl      = document.getElementById('podNewError');

    // Diagnosegruppe ist nur bei GKV Pflicht — sie stammt aus der HeilM-RL und
    // gilt ausschließlich für Verordnungen zulasten der GKV. Früher war sie
    // immer Pflicht, weshalb bei Selbstzahlern erfundene Gruppen eingetragen
    // wurden (Konsey 2026-08-10).
    const istGkv = rezeptart === POD_GKV_REZEPTART;
    if (!patient || !datum || (istGkv && !diagVal)) {
      errEl.textContent = istGkv
        ? 'Bitte Patient, Datum und Diagnosegruppe ausfüllen.'
        : 'Bitte Patient und Datum ausfüllen.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';

    const diagRoot = podDiagRoot(diagVal);

    // ICD-10: read from form input (user may have edited it)
    const icd10 = icd10Raw.split(',').map(s => s.trim()).filter(Boolean);

    // Verordnetes Heilmittel (Muster 13 Feld g). Steuert 78010 ↔ 78020 und ist
    // gleichzeitig die Leitsymptomatik — beide tragen in der HeilM-RL denselben
    // Buchstaben.
    const hmLetter = POD_HEILMITTEL_KATALOG[document.getElementById('podNewHeilmittel')?.value]
      ? document.getElementById('podNewHeilmittel').value : '';

    // Heilmittel items from dynamic rows
    const heilmittelItems = [];
    document.querySelectorAll('#podHeilmittelItems .pod-hm-row').forEach(row => {
      const code = row.querySelector('.pod-hm-code')?.value;
      const anzahl = parseInt(row.querySelector('.pod-hm-anzahl')?.value) || 1;
      if (code) heilmittelItems.push({
        code, bezeichnung: hpnrLabel(code), anzahl,
        ...(hmLetter ? { massnahme: hmLetter } : {}),
      });
    });

    // Compute beginn_spaetestens
    const beginDate = new Date(datum);
    beginDate.setDate(beginDate.getDate() + (dring ? 14 : 28));
    const beginn_spaetestens = beginDate.toISOString().split('T')[0];

    const wagnerRaw = document.getElementById('podNewWagner')?.value;
    const wagnerGrad = (wagnerRaw !== '' && wagnerRaw != null) ? parseInt(wagnerRaw) : null;
    let leadId       = document.getElementById('podNewLeadId')?.value || null;
    const vsnr       = document.getElementById('podNewVsnr')?.value.trim() || null;

    // Ohne Patientenakte ist die Verordnung nicht abrechenbar: die §302-Erzeugung
    // weist sie zurück ("kein Patient aus der Kartei verknüpft"). `lead_id` wurde
    // nur beim Klick in der Vorschlagsliste gesetzt und beim Speichern sagte das
    // niemand — alle drei bisher angelegten Verordnungen haben deshalb keins.
    // Erst nachbinden (eindeutiger Name = vergessener Klick), dann sperren.
    if (!leadId && patient) {
      const treffer = ctx.leads().filter(l => ctx.displayName(l).trim().toLowerCase() === patient.trim().toLowerCase());
      if (treffer.length === 1) leadId = treffer[0].id;
    }
    if (!leadId && istGkv) {
      ctx.showToast('Bitte den Patienten aus der Liste auswählen — ohne Patientenakte lässt sich die Verordnung später nicht abrechnen.', 'error');
      document.getElementById('podNewPatient')?.focus();
      return;
    }

    // Arzt ins Register übernehmen — auch wenn er noch nicht in der Liste
    // stand. Ohne diesen Schritt sammelte die Podologie gar keine Ärzte.
    const arztNameIn = document.getElementById('podNewArztName')?.value.trim() || '';
    const arztLanrIn = (document.getElementById('podNewArztLanr')?.value || '').replace(/\D/g, '');
    const arztBsnrIn = (document.getElementById('podNewArztBsnr')?.value || '').replace(/\D/g, '');
    let arztId = document.getElementById('podNewArztId')?.value || null;
    if (arztNameIn || /^\d{9}$/.test(arztLanrIn)) {
      const arztOut = await ctx.resolveArzt({
        name: arztNameIn,
        lanr: arztLanrIn,
        bsnr: arztBsnrIn
      }, 'verordnung');
      if (arztOut?.arzt_id) {
        arztId = arztOut.arzt_id;
        ctx.toastArztErgebnis(arztOut);
      }
    }

    const kkIk       = document.getElementById('podNewKk')?.value || null;
    const zuzahlBef  = document.getElementById('podNewZuzahlBefreit')?.checked || false;

    const anlassRaw = document.getElementById('podNewBehandlungsanlass')?.value.trim() || '';

    const _payload = {
      owner_id: ctx.getOwnerId(),
      patient_name: patient,
      ausstellungsdatum: datum,
      // podDiagRoot('') liefert einen Leerstring — der würde am Fremdschlüssel
      // verordnungen_diagnosegruppe_fkey scheitern. Leer heißt NULL.
      diagnosegruppe: diagRoot || null,
      // Buchstabe a/b/c wie im übrigen System (prescriptions führt ihn ebenso).
      // Bisher stand hier "DF-a" — die Diagnosegruppe steht schon in der Spalte
      // daneben, der Buchstabe allein ist die Leitsymptomatik.
      leitsymptomatik: hmLetter || (diagVal.match(/-([abc])$/) || [])[1] || null,
      behandlungsanlass: istGkv ? null : (anlassRaw || POD_ANLASS_DEFAULT),
      icd10,
      behandlungseinheiten: einh,
      therapiefrequenz: freq || null,
      dringend: dring,
      hausbesuch: hausb,
      rezeptart,
      beginn_spaetestens,
      heilmittel_items: heilmittelItems,
      wagner_grad: wagnerGrad,
      lead_id: leadId,
      versichertennummer: vsnr,
      arzt_id: arztId,
      // Kostenträger und Zuzahlung gibt es nur in der GKV. Sonst hart auf
      // null/false — sonst schleppt ein vorher ausgewählter Wert aus dem
      // zugeklappten Block eine falsche Kasse in den Datensatz.
      kostentraeger_ik: istGkv ? kkIk : null,
      zuzahlung_befreit: istGkv ? zuzahlBef : false,
    };

    let _saveError;
    if (_podState.editVordId) {
      // UPDATE: status-Feld NICHT überschreiben — ein 'abrechenbar'-Datensatz
      // darf nicht auf 'aktiv' zurückfallen (Retaxation-Risiko).
      const { error: ue } = await ctx.supabase
        .from('verordnungen')
        .update(_payload)
        .eq('id', _podState.editVordId)
        .eq('owner_id', ctx.getOwnerId());
      _saveError = ue;
    } else {
      // INSERT: 'aktiv' als Startstatus
      const { error: ie } = await ctx.supabase
        .from('verordnungen')
        .insert({ ..._payload, status: 'aktiv' });
      _saveError = ie;
    }

    if (_saveError) {
      errEl.textContent = _saveError.message;
      errEl.style.display = 'block';
      return;
    }
    const _toastMsg = _podState.editVordId ? 'Verordnung aktualisiert ✓' : 'Verordnung gespeichert ✓';
    _podState.editVordId = null;
    ctx.showToast(_toastMsg);
    loadPodologieBilling();
  });

  // ---- New field helpers ----

  // Rezeptart → Formular. Bei GKV bleibt alles wie bisher (Block offen, Summary
  // versteckt). Sonst klappt der Block zu — versteckt, aber mit einem Klick
  // erreichbar: der Patient bringt sein Rezept oft erst später nach.
  function podApplyRezeptart() {
    const isGkv = (document.getElementById('podNewRezeptart')?.value || POD_GKV_REZEPTART) === POD_GKV_REZEPTART;
    const details = document.getElementById('podGkvDetails');
    const summary = document.getElementById('podGkvSummary');
    const anlass  = document.getElementById('podBehandlungsanlassWrap');
    if (details) {
      details.open = isGkv;
      details.style.border = isGkv ? 'none' : '1px solid var(--border)';
    }
    if (summary) summary.style.display = isGkv ? 'none' : 'block';
    if (anlass)  anlass.style.display  = isGkv ? 'none' : 'block';
  }

  function computeBeginHint() {
    const datum = document.getElementById('podNewAusstelldatum')?.value;
    const dring = document.getElementById('podNewDringend')?.checked;
    const el = document.getElementById('podBeginHintEl');
    if (!el) return;
    if (!datum) { el.style.display = 'none'; return; }
    const d = new Date(datum);
    d.setDate(d.getDate() + (dring ? 14 : 28));
    el.textContent = `📅 Beginn spätestens: ${d.toLocaleDateString('de-DE')}`;
    el.style.display = 'block';
  }

  async function podRenderHeilmittelRow(diagRootVal, preset = '', anzahl = 1) {
    const rows = await podLoadHpnr(diagRootVal);
    const options = heilmittelOptionsHtml(rows, preset, '— HPNR —').replace(/^<option value="">.*?<\/option>/, '');
    const row = document.createElement('div');
    row.className = 'pod-hm-row';
    row.style.cssText = 'display:flex;gap:6px;align-items:center;';
    row.innerHTML = `
      <select class="pod-hm-code" style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;appearance:none;">
        <option value="">— HPNR —</option>
        ${options}
      </select>
      <input type="number" class="pod-hm-anzahl" min="1" max="99" value="${anzahl}" style="width:64px;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;">
      <button type="button" class="pod-hm-remove" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--danger,#ef4444);font-size:14px;cursor:pointer;line-height:1;">×</button>`;
    return row;
  }

  async function podUpdateHeilmittelOptions() {
    const diagVal = document.getElementById('podNewDiag')?.value || '';
    const diagRootVal = podDiagRoot(diagVal);
    const rows = await podLoadHpnr(diagRootVal);
    document.querySelectorAll('#podHeilmittelItems .pod-hm-code').forEach(sel => {
      sel.innerHTML = heilmittelOptionsHtml(rows, sel.value, '— HPNR —');
    });
  }

  /**
   * Muster 13 Feld g (verordnetes Heilmittel) → Leitsymptomatik-Text und
   * HPNR-Zeilen vorbelegen. Alles bleibt von Hand änderbar: automatisch
   * gesetzte Zeilen tragen data-auto="1" und werden beim nächsten Lauf ersetzt;
   * sobald der Anwender eine Zeile anfasst, verliert sie die Markierung und
   * bleibt stehen.
   */
  async function podApplyHeilmittel(opts = {}) {
    const wrap      = document.getElementById('podHeilmittelWrap');
    const sel       = document.getElementById('podNewHeilmittel');
    const grossWrap = document.getElementById('podHmGrossWrap');
    const grossCb   = document.getElementById('podHmGross');
    const hintEl    = document.getElementById('podLeitsymptHint');
    const container = document.getElementById('podHeilmittelItems');
    if (!wrap || !sel || !container) return;

    const diagRootVal = podDiagRoot(document.getElementById('podNewDiag')?.value || '');
    const anwendbar   = POD_HEILMITTEL_DGS.includes(diagRootVal);
    wrap.style.display = anwendbar ? 'block' : 'none';
    if (!anwendbar) sel.value = '';

    const eintrag = POD_HEILMITTEL_KATALOG[sel.value];

    // „Behandlung groß" gibt es nur bei der Komplexbehandlung (FAK Q25).
    const grossMoeglich = !!(eintrag && eintrag.hpnrGross);
    if (grossWrap) grossWrap.style.display = grossMoeglich ? 'flex' : 'none';
    if (grossCb && !grossMoeglich) grossCb.checked = false;

    if (hintEl) {
      hintEl.textContent = eintrag
        ? `Leitsymptomatik ${sel.value}) ${eintrag.leitsymptomatik}`
        : '';
      hintEl.style.display = eintrag ? 'block' : 'none';
    }

    // Leitsymptomatik-Buchstabe in die Diagnosegruppe spiegeln — nur DF führt
    // Untergruppen im Auswahlfeld. NF/QF tragen den Buchstaben erst beim
    // Speichern (Spalte leitsymptomatik).
    if (eintrag && diagRootVal === 'DF') {
      const dgEl = document.getElementById('podNewDiag');
      const ziel = `DF-${sel.value}`;
      if (dgEl && dgEl.value !== ziel && [...dgEl.options].some(o => o.value === ziel)) {
        dgEl.value = ziel;
      }
    }

    // nurAnzeige: Im Bearbeitungsmodus nur Sichtbarkeit/Hinweis aktualisieren,
    // aber die bestehenden Heilmittel-Zeilen unangetastet lassen.
    if (opts.nurAnzeige) return;

    container.querySelectorAll('.pod-hm-row[data-auto="1"]').forEach(r => r.remove());
    if (!eintrag) return;

    const katalog   = await podLoadHpnr(diagRootVal);
    const einheiten = parseInt(document.getElementById('podNewEinheiten')?.value) || 1;
    const vorhanden = new Set(
      [...container.querySelectorAll('.pod-hm-code')].map(s => s.value).filter(Boolean));
    const codes = [
      (grossCb?.checked && eintrag.hpnrGross) ? eintrag.hpnrGross : eintrag.hpnr,
      POD_BEFUNDPAUSCHALE,
    ];

    for (const code of codes) {
      if (vorhanden.has(code)) continue;
      // Steht die Position im Katalog dieser Diagnosegruppe nicht zur Verfügung,
      // lieber gar keine Zeile als eine mit leerem Auswahlfeld.
      if (!katalog.some(r => r.code === code)) continue;
      const row = await podRenderHeilmittelRow(diagRootVal, code, einheiten);
      row.dataset.auto = '1';
      container.appendChild(row);
      vorhanden.add(code);
    }
  }

  function podValidateIcd10() {
    const diagVal = document.getElementById('podNewDiag')?.value || '';
    const diagRootVal = podDiagRoot(diagVal);
    const raw = document.getElementById('podNewIcd10')?.value || '';
    const warnEl = document.getElementById('podIcd10Warning');
    if (!warnEl) return;
    // Leeres ICD-Feld → keine Warnung (ICD ist nicht Pflicht)
    if (!raw.trim() || !diagRootVal) { warnEl.style.display = 'none'; return; }

    const rule = (_dgIcdRules || {})[diagRootVal];
    // Keine Regeln geladen (Migration noch nicht eingespielt) → still keine Warnung
    if (!rule || !rule.icd_accept || rule.icd_accept.length === 0) { warnEl.style.display = 'none'; return; }

    const codes = parseIcdList(raw);
    const result = matchIcdToDg(codes, rule);

    if (result.status === 'mismatch') {
      const isHard = rule.icd_enforcement === 'hard_before_dta';
      let msg = `${ctx.t('pod_icd_mismatch')}: ${codes.join(', ')} (${diagRootVal})`;
      if (result.hints.length > 0) msg += ` — ${result.hints.join('; ')}`;
      if (isHard) {
        msg += ' ⚠ ' + ctx.t('pod_icd_hard');
        warnEl.style.fontWeight = '600';
      } else {
        warnEl.style.fontWeight = '';
      }
      warnEl.textContent = msg;
      warnEl.style.display = 'block';
    } else {
      warnEl.style.display = 'none';
    }
  }

  // Wire up: Diagnosegruppe change (DG → ICD Gegenrichtung)
  document.getElementById('podNewDiag')?.addEventListener('change', () => {
    const diagVal = document.getElementById('podNewDiag').value;
    const diagRootVal = podDiagRoot(diagVal);
    const icd10El = document.getElementById('podNewIcd10');

    // DG → ICD: nur wenn ICD-Feld leer und genau ein Kode ableitbar (UI1/UI2 → L60.0)
    if (icd10El && !icd10El.value.trim()) {
      const rule = (_dgIcdRules || {})[diagRootVal];
      const sole = rule ? soleIcdForDg(rule) : null;
      if (sole) icd10El.value = sole;
    }

    // L60.0-Rückfrage ausblenden wenn Diagnosegruppe wechselt
    const l60hint = document.getElementById('podL60Hint');
    if (l60hint) l60hint.style.display = 'none';

    // Wagner nur bei DF
    const wagnerWrap = document.getElementById('podWagnerWrap');
    if (wagnerWrap) wagnerWrap.style.display = diagRootVal === 'DF' ? 'block' : 'none';

    // Untergruppe der Diagnosegruppe (DF-a/b/c) ist derselbe Buchstabe wie das
    // Heilmittel — Auswahlfeld nachziehen, damit beide nicht auseinanderlaufen.
    const hmSel = document.getElementById('podNewHeilmittel');
    const letter = (diagVal.match(/-([abc])$/) || [])[1];
    if (hmSel && letter && hmSel.value !== letter) hmSel.value = letter;

    // Erst die Optionen der bestehenden Zeilen auf die neue Diagnosegruppe
    // umstellen, dann die automatischen Zeilen neu setzen — umgekehrt würde die
    // Umstellung die frisch gesetzte Auswahl wieder überschreiben.
    podUpdateHeilmittelOptions().then(podApplyHeilmittel);
    podValidateIcd10();
  });

  // Wire up: verordnetes Heilmittel (Muster 13 Feld g) → HPNR + Leitsymptomatik
  document.getElementById('podNewHeilmittel')?.addEventListener('change', podApplyHeilmittel);
  document.getElementById('podHmGross')?.addEventListener('change', podApplyHeilmittel);
  podApplyHeilmittel();   // Erstzustand (Feld ist bei UI1/UI2 ausgeblendet)
  document.getElementById('podNewEinheiten')?.addEventListener('change', () => {
    const einh = parseInt(document.getElementById('podNewEinheiten')?.value) || 1;
    document.querySelectorAll('#podHeilmittelItems .pod-hm-row[data-auto="1"] .pod-hm-anzahl')
      .forEach(inp => { inp.value = einh; });
  });

  // podNewIcd10 verdrahtet sich beim Fokus selbst (DIAGNOSE_FIELDS) — wichtig,
  // weil dieses Panel bei jedem loadPodologieBilling() neu gerendert wird.

  // Patientensuche — gemeinsames Modul statt <datalist>. Damit findet man hier
  // endlich auch über Geburtsdatum und Telefonnummer, und die Zuordnung hängt
  // nicht mehr daran, dass der getippte Text exakt dem Label entspricht.
  const podPatientInput = document.getElementById('podNewPatient');
  if (podPatientInput) {
    attachPatientSearch(podPatientInput, {
      loadLeads: ctx.ensureLeadsCache,   // lädt selbst nach, statt auf das Patienten-Panel zu warten
      matches:   ctx.patientMatchesQuery,
      labelOf:   ctx.displayNameWithBirth,
      onSelect:  lead => {
        const leadIdEl = document.getElementById('podNewLeadId');
        const vsnrEl   = document.getElementById('podNewVsnr');
        const podKkSel = document.getElementById('podNewKk');
        if (leadIdEl) leadIdEl.value = lead.id;
        if (vsnrEl && !vsnrEl.value.trim()) vsnrEl.value = lead.versichertennummer || '';
        if (podKkSel && !podKkSel.value && lead.krankenkasse) {
          const matchedKk = _podKkCache.find(k => k.name === lead.krankenkasse);
          if (matchedKk) podKkSel.value = matchedKk.ik;
        }
      },
    });
    // Freitext ohne Auswahl → keine Lead-Bindung
    podPatientInput.addEventListener('input', () => {
      const leadIdEl = document.getElementById('podNewLeadId');
      if (leadIdEl && !podPatientInput.value.trim()) leadIdEl.value = '';
    });
  }

  // Wire up: KK select populate
  const podKkSel = document.getElementById('podNewKk');
  if (podKkSel && _podKkCache.length) {
    podKkSel.innerHTML = '<option value="">— Krankenkasse wählen —</option>' +
      _podKkCache.map(k => `<option value="${ctx.escapeHtml(k.ik)}">${ctx.escapeHtml(k.name)}</option>`).join('');
  }

  // ---- Bearbeitungsmodus: Formular mit vorhandenen Daten füllen ----
  // Muss NACH der KK-Befüllung stehen, da podNewKk-Optionen erst jetzt existieren.
  async function podFillEditForm(v) {
    const _set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const _chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    _set('podNewPatient',  v.patient_name || '');
    _set('podNewLeadId',   v.lead_id || '');
    _set('podNewVsnr',     v.versichertennummer || '');
    _set('podNewAusstelldatum', v.ausstellungsdatum || '');
    _set('podNewWagner',   v.wagner_grad != null ? String(v.wagner_grad) : '');
    _set('podNewEinheiten', v.behandlungseinheiten || '');
    _set('podNewFrequenz',  v.therapiefrequenz || '');
    _chk('podNewDringend',  v.dringend);
    _chk('podNewHausbesuch', v.hausbesuch);
    _chk('podNewZuzahlBefreit', v.zuzahlung_befreit);
    _set('podNewIcd10', (v.icd10 || []).join(', '));

    // Rezeptart zuerst setzen, dann Sichtbarkeit anpassen
    _set('podNewRezeptart', v.rezeptart || 'kassen');
    podApplyRezeptart();

    // Behandlungsanlass (nur Nicht-GKV)
    _set('podNewBehandlungsanlass', v.behandlungsanlass || '');

    // Arzt aus Tabelle lesen (§ 16390 Muster)
    if (v.arzt_id) {
      const { data: arzt } = await ctx.supabase
        .from('aerzte')
        .select('arzt_name,lanr,bsnr')
        .eq('id', v.arzt_id)
        .eq('owner_id', ctx.getOwnerId())
        .maybeSingle();
      if (arzt) {
        _set('podNewArztName', arzt.arzt_name || '');
        _set('podNewArztLanr', arzt.lanr || '');
        _set('podNewArztBsnr', arzt.bsnr || '');
        _set('podNewArztId',   v.arzt_id);
      }
    }

    // Krankenkasse
    _set('podNewKk', v.kostentraeger_ik || '');

    // Diagnosegruppe + Heilmittel-Buchstabe
    const letter = podVordMassnahme(v);
    const ziel   = letter ? `${v.diagnosegruppe}-${letter}` : (v.diagnosegruppe || '');
    const dgEl   = document.getElementById('podNewDiag');
    if (dgEl) {
      const hat = [...dgEl.options].some(o => o.value === ziel);
      dgEl.value = hat ? ziel : (v.diagnosegruppe || '');
      // Automatische ICD-Vorauswahl durch _wireDgIcdPair unterdrücken
      dgEl.dataset.manualOverride = '1';
    }

    // Heilmittel-Buchstabe (Muster 13 Feld g)
    _set('podNewHeilmittel', letter);

    // Therapiezeit > 20 Min (78020)
    const grossCb = document.getElementById('podHmGross');
    if (grossCb) grossCb.checked = (v.heilmittel_items || []).some(i => i?.code === '78020');

    // Bestehende Heilmittel-Zeilen laden (ohne data-auto — dürfen nicht auto-gelöscht werden)
    const diagRootVal = podDiagRoot(dgEl?.value || '');
    const container   = document.getElementById('podHeilmittelItems');
    if (container && Array.isArray(v.heilmittel_items)) {
      container.innerHTML = '';
      for (const item of v.heilmittel_items) {
        if (!item?.code) continue;
        const row = await podRenderHeilmittelRow(diagRootVal, item.code, item.anzahl || 1);
        // data-auto NICHT setzen — diese Zeilen wurden vom Arzt eingetragen
        container.appendChild(row);
      }
    }

    computeBeginHint();
    await podApplyHeilmittel({ nurAnzeige: true });
    // Werte wurden programmatisch gesetzt — das löst kein change-Event aus,
    // also die ICD-Prüfung einmal von Hand nachziehen.
    podValidateIcd10();
  }

  // Bewusst awaited: die Felder müssen stehen, BEVOR _wireDgIcdPair() weiter
  // unten seine Automatik anhängt — sonst kann die ICD→DG-Vorauswahl die
  // gespeicherte Diagnosegruppe überschreiben.
  if (editVord) {
    await podFillEditForm(editVord);
  }

  // Wire up: Arzt-Picker + Hinweis (gemeinsames Modul, siehe wireArztFeld)
  wireArztFeld({
    name: 'podNewArztName', lanr: 'podNewArztLanr', bsnr: 'podNewArztBsnr',
    id:   'podNewArztId',   hint: 'podArztHint',
  });

  // Wire up: Rezeptart change (steuert GKV-Block + Behandlungsanlass)
  document.getElementById('podNewRezeptart')?.addEventListener('change', podApplyRezeptart);
  podApplyRezeptart();

  // Wire up: Ausstelldatum change
  document.getElementById('podNewAusstelldatum')?.addEventListener('change', computeBeginHint);

  // Wire up: Dringend change
  document.getElementById('podNewDringend')?.addEventListener('change', computeBeginHint);

  // Wire up: ICD-10 bidirektional (ICD → DG auto-select, L60.0-Rückfrage, Warnung)
  ctx._wireDgIcdPair('podNewIcd10', 'podNewDiag', 'select', 'podIcd10Warning', 'podologie');

  // Wire up: L60.0 Rückfrage-Schaltflächen (inline onclick aus ES-Modul nicht erlaubt → addEventListener)
  function _podChooseUI(dg) {
    const dgEl   = document.getElementById('podNewDiag');
    const l60hint = document.getElementById('podL60Hint');
    if (dgEl) {
      // Optionen zurücksetzen, dann Wert setzen
      Array.from(dgEl.options).forEach(opt => { opt.style.display = ''; });
      dgEl.value = dg;
      dgEl.dataset.manualOverride = '1';
      dgEl.dispatchEvent(new Event('input',  { bubbles: true }));
      dgEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (l60hint) l60hint.style.display = 'none';
  }
  document.getElementById('podL60UI1Btn')?.addEventListener('click', () => _podChooseUI('UI1'));
  document.getElementById('podL60UI2Btn')?.addEventListener('click', () => _podChooseUI('UI2'));

  // Wire up: Add heilmittel row button
  document.getElementById('podAddHeilmittelBtn')?.addEventListener('click', async () => {
    const diagVal = document.getElementById('podNewDiag')?.value || '';
    const diagRootVal = podDiagRoot(diagVal);
    const container = document.getElementById('podHeilmittelItems');
    if (container) container.appendChild(await podRenderHeilmittelRow(diagRootVal));
  });

  // Wire up: Remove heilmittel row (event delegation)
  document.getElementById('podHeilmittelItems')?.addEventListener('click', e => {
    if (e.target.classList.contains('pod-hm-remove')) {
      e.target.closest('.pod-hm-row')?.remove();
    }
  });

  // Von Hand geänderte Zeile ist nicht mehr „automatisch" — sie darf beim
  // nächsten podApplyHeilmittel() nicht weggeräumt werden.
  document.getElementById('podHeilmittelItems')?.addEventListener('change', e => {
    const row = e.target.closest('.pod-hm-row');
    if (row) delete row.dataset.auto;
  });

  document.getElementById('podCancelEditBtn')?.addEventListener('click', () => {
    _podState.editVordId = null;
    loadPodologieBilling();
  });

  // Wire up: §302 Abrechnung erstellen buttons (event delegation on whole billing panel)
  document.getElementById('podBillingContent')?.addEventListener('click', async e => {
    const btn = e.target.closest('.pod-abr-btn');
    if (!btn) return;
    const kkIk     = btn.dataset.kkIk;
    const vordIds  = JSON.parse(btn.dataset.vordIds || '[]');
    const errEl    = document.getElementById('podAbrError');
    if (!kkIk || !vordIds.length) return;

    btn.disabled = true;
    btn.textContent = 'Wird erstellt…';
    if (errEl) errEl.style.display = 'none';

    try {
      const { data: { session } } = await ctx.supabase.auth.getSession();
      const res = await fetch('https://n8n.infinitymade.de/api/billing/abrechnung/create-podologie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ kostentraegerIk: kkIk, verordnungIds: vordIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (errEl) { errEl.textContent = json.error || 'Fehler beim Erstellen.'; errEl.style.display = 'block'; }
        btn.disabled = false; btn.textContent = '§302 erstellen';
        return;
      }
      ctx.showToast(`§302 DTA erstellt: ${json.rechnungsnummer} · ${json.sessionCount} Positionen ✓`);
      loadPodologieBilling();
    } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      btn.disabled = false; btn.textContent = '§302 erstellen';
    }
  });

  document.getElementById('podSaveBehBtn')?.addEventListener('click', async () => {
    const datum   = document.getElementById('podBehDatum').value;
    const checks  = [...document.querySelectorAll('.pod-hpnr-cb:checked')].map(cb => cb.value);
    const lokal   = (document.getElementById('podLokalisation')?.value || '').trim();
    const notiz   = document.getElementById('podBehNotizen').value.trim();
    const errEl   = document.getElementById('podBehError');

    // ICD-Regeln sicherstellen, BEVOR geprüft wird: _icdMatchesDgRule()
    // ist bei fehlenden Regeln absichtlich nachsichtig (nur Hinweis-Text), für
    // die harte UI1/UI2-Abrechnungsregel darf es das aber nicht sein.
    await loadDgIcdRules(ctx.supabase);

    const vord = _podState.verordnungen.find(v => v.id === _podState.selectedVordId);
    const dRoot = vord ? podDiagRoot(vord.diagnosegruppe) : '';
    const isUIx = dRoot === 'UI1' || dRoot === 'UI2';
    const icd10 = vord?.icd10 || [];
    const uiRule = (_dgIcdRules || {})[dRoot];

    // Validasyon
    let err = '';
    if (checks.length === 0) err = ctx.t('pod_kein_hpnr');
    else if (isUIx && checks.includes('78030')) err = 'Befundung (78030) kann bei UI1/UI2 nicht verwendet werden.';
    // Regeln nicht geladen → auf die feste Literal-Regel zurückfallen, nicht durchwinken.
    else if (isUIx && !(uiRule
              ? icd10.some(c => matchIcdToDg(parseIcdList(c), uiRule).status === 'ok')
              : icd10.some(c => String(c).trim().toUpperCase().startsWith('L60.0'))))
      err = 'UI1/UI2 erfordert ICD-10 L60.0.';
    else if (checks.includes('78040') && checks.includes('78030')) err = 'Eingangsbefundung (78040) und Befundung (78030) können nicht am gleichen Tag kombiniert werden.';
    else if ((checks.includes('78610') || checks.includes('78620')) && dRoot !== 'UI2') err = 'Nagelspange (78610/78620) ist nur bei UI2 zulässig.';
    // 78020 „Behandlung groß" gilt nur für die Komplexbehandlung. Bei einzeln
    // verordneter Hornhautabtragung oder Nagelbearbeitung ist immer 78010 zzgl.
    // 78030 abzurechnen — auch über 20 Minuten (FAK Podologie Q25). Sonst wird
    // die Differenz später zurückgefordert.
    else if (checks.includes('78020') && ['a', 'b'].includes(podVordMassnahme(vord)))
      err = `78020 ist nur bei verordneter Komplexbehandlung abrechenbar. Verordnet ist `
          + `„${POD_HEILMITTEL_KATALOG[podVordMassnahme(vord)].heilmittel}" — bitte 78010 zzgl. 78030 verwenden.`;
    else if (isUIx && !lokal) err = ctx.t('pod_lokalisation') + ' ist bei UI1/UI2 erforderlich.';

    if (err) { errEl.textContent = err; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';

    // 78040 Lebenszeit-Check: Einmalig je Patient (patientenübergreifend, alle Verordnungen)
    if (checks.includes('78040') && (vord?.lead_id || vord?.patient_name)) {
      let query = ctx.supabase.from('verordnungen').select('id').eq('owner_id', ctx.getOwnerId());
      if (vord.lead_id) {
        query = query.eq('lead_id', vord.lead_id);
      } else {
        query = query.eq('patient_name', vord.patient_name);
      }
      const { data: allVords } = await query;
      if (allVords?.length) {
        const { data: prev78040 } = await ctx.supabase
          .from('podologie_behandlungen').select('id, behandlungsdatum')
          .eq('owner_id', ctx.getOwnerId())
          .contains('hpnr_codes', ['78040'])
          .in('verordnung_id', allVords.map(v => v.id))
          .limit(1);
        if (prev78040?.length) {
          const prevDate = new Date(prev78040[0].behandlungsdatum).toLocaleDateString('de-DE');
          errEl.textContent = `Eingangsbefundung (78040) wurde für ${vord.patient_name} bereits am ${prevDate} abgerechnet – Lebenszeit-Leistung, nicht wiederholbar.`;
          errEl.style.display = 'block';
          return;
        }
      }
    }

    // beginn_spaetestens check: warn if first treatment is after deadline
    if (vord && !vord.behandlungsstart && datum) {
      let deadline = null;
      if (vord.beginn_spaetestens) {
        deadline = vord.beginn_spaetestens;
      } else if (vord.ausstellungsdatum) {
        const issued = new Date(vord.ausstellungsdatum);
        const frist = vord.dringend ? 14 : 28;
        issued.setDate(issued.getDate() + frist);
        deadline = issued.toISOString().split('T')[0];
      }
      if (deadline && datum > deadline) {
        const datumFormatted = new Date(datum).toLocaleDateString('de-DE');
        const deadlineFormatted = new Date(deadline).toLocaleDateString('de-DE');
        const proceed = await ctx.showConfirmModal({
          title: '⚠️ Datum nach Beginn spätestens',
          message: `Das gewählte Datum (${datumFormatted}) liegt nach dem Beginn spätestens (${deadlineFormatted}). Trotzdem fortfahren?`,
          confirmText: 'Trotzdem fortfahren',
          cancelText: 'Abbrechen'
        });
        if (!proceed) return;
      }
    }

    const { error } = await ctx.supabase.from('podologie_behandlungen').insert({
      owner_id: ctx.getOwnerId(),
      verordnung_id: _podState.selectedVordId,
      behandlungsdatum: datum,
      hpnr_codes: checks,
      diagnosegruppe: dRoot,
      lokalisation: lokal || null,
      notizen: notiz || null,
    });
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }

    // Status machine: wenn alle Einheiten verbraucht → abrechenbar
    if (vord?.behandlungseinheiten) {
      const { count } = await ctx.supabase
        .from('podologie_behandlungen')
        .select('*', { count: 'exact', head: true })
        .eq('verordnung_id', _podState.selectedVordId);
      if (count != null && count >= vord.behandlungseinheiten) {
        await ctx.supabase.from('verordnungen')
          .update({ status: 'abrechenbar' })
          // Nur aus 'aktiv' heraus: sonst holt eine nachgetragene Behandlung eine
          // bereits eingereichte oder stornierte Verordnung zurück in die Abrechnung.
          .eq('id', _podState.selectedVordId).eq('status', 'aktiv');
        ctx.showToast('Alle Einheiten aufgebraucht — Verordnung bereit zur Abrechnung ✓', 'info');
      } else {
        ctx.showToast('Behandlung gespeichert ✓');
      }
    } else {
      ctx.showToast('Behandlung gespeichert ✓');
    }

    loadPodologieBilling();
  });
}

// ── Öffentliche Schnittstelle ──────────────────────────────────────────────

/** Einstieg aus dem Router (`switchPanel('podologie-billing')`). */
export async function mountPodologieAbrechnung(deps) {
  ctx = deps;
  return loadPodologieBilling();
}

/**
 * Verordnung vorwählen, bevor das Panel öffnet — Sprung aus der Patientenakte.
 * Ersetzt den früheren Direktzugriff `_podState.selectedVordId = id` in dashboard.js.
 */
export function setPodVorwahl(id) {
  _podState.selectedVordId = id;
}

/**
 * Eine geladene Verordnung nach Kennung. Nur für `rechnungAusVerordnung()` in
 * dashboard.js, das nicht mit umziehen konnte und trotzdem an `_podState` muss.
 */
export function getPodVerordnung(id) {
  return _podState.verordnungen.find(v => v.id === id);
}
