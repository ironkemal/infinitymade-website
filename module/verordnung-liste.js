/**
 * verordnung-liste.js — die Seite „Verordnungen".
 *
 * Kommt aus `dashboard.js` (`loadVerordnungen`) hierher, weil dort zwei Dinge
 * dazukommen mussten und die Datei nicht wachsen darf (Konsey 2026-08-13):
 *
 *   1. Die Nummer neben dem Namen. Bisher stand in der Liste nur „Kemal Demir".
 *      Wer aus zwei Metern auf den Bildschirm sieht, konnte nicht erkennen, um
 *      welche Verordnung desselben Patienten es geht. Jetzt steht dort
 *      `Kemal Demir  1-3` — Patient 1, dessen dritte Verordnung. Dieselbe
 *      Nummer steht auf der Rechnung und im DTA-Datensatz (Feld INV-4), also
 *      ist sie auch das, worüber man mit der Kasse spricht.
 *      Zusammensetzung und Vorrangregel: `module/belegnummer.js`.
 *
 *   2. Der Klick auf die Zeile. Eine gespeicherte Verordnung liess sich nicht
 *      mehr aufmachen; was in der Muster-13-Maske eingetragen worden war, war
 *      nach dem Speichern nur noch auf dem Papier zu finden. Die Zeile öffnet
 *      jetzt `module/verordnung-detail.js`.
 *
 * Topf: `prescriptions` (Physio · Ergo · Logopädie). Podologie hat mit
 * `verordnungen` einen eigenen Topf und eine eigene Liste in der
 * Podologie-Abrechnung — die beiden werden bewusst nicht zusammengelegt.
 */

import { belegnummerRosette } from './belegnummer.js?v=20260817';
import { zeigeVerordnungDetail } from './verordnung-detail.js?v=20260817';

const STATUS_LABEL = {
  parsed: 'Erfasst', confirmed: 'Bestätigt', in_therapy: 'In Therapie',
  completed: 'Abgeschlossen', billed: 'Abgerechnet', cancelled: 'Storniert'
};
const STATUS_COLOR = {
  parsed: '#f59e0b', confirmed: '#22c55e', in_therapy: '#38bdf8',
  completed: '#64748b', billed: '#3b82f6', cancelled: '#ef4444'
};

const SPALTEN = 7;

/**
 * Verordnungsliste laden und zeichnen.
 *
 * @param {object} ctx
 * @param {object} ctx.supabase
 * @param {string} ctx.ownerId
 * @param {(s:string)=>string} ctx.escapeHtml
 * @param {() => void} [ctx.onNeu]  Handler für „+ Neue Verordnung".
 */
export async function verordnungenListeLaden(ctx) {
  const { supabase, ownerId, escapeHtml } = ctx;
  const tbody = document.getElementById('vordTbody');
  const empty = document.getElementById('vordListEmpty');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="${SPALTEN}" style="text-align:center;padding:20px;color:var(--text-muted)">Lädt…</td></tr>`;

  const btn = document.getElementById('vordNeueBtn');
  if (btn && ctx.onNeu) btn.onclick = ctx.onNeu;
  // Einmal verdrahten, nicht bei jedem Laden erneut — sonst sammeln sich
  // Handler auf demselben Knopf an.
  const zu = document.getElementById('vordDetailClose');
  if (zu && !zu.dataset.verdrahtet) {
    zu.dataset.verdrahtet = '1';
    zu.addEventListener('click', () => {
      const p = document.getElementById('vordDetailPanel');
      if (p) p.hidden = true;
    });
  }

  // `patientennummer` gehört in den Join — ohne sie liesse sich die Nummer
  // nicht zusammensetzen, und `belegnummer` ist bei jeder noch nicht
  // abgerechneten Verordnung leer.
  const { data, error } = await supabase
    .from('prescriptions')
    .select('id, patient_id, ausstellungsdatum, icd10, heilmittel, anzahl_einheiten, status, gueltig_bis, belegnummer, verordnungsnummer, leads!patient_id(first_name, last_name, patientennummer)')
    .eq('owner_id', ownerId)
    .order('ausstellungsdatum', { ascending: false })
    .limit(200);

  if (error) { console.error('[verordnungenListeLaden]', error); tbody.innerHTML = ''; return; }

  if (!data || data.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  tbody.innerHTML = data.map(rx => {
    const patName = escapeHtml(
      `${rx.leads?.first_name || ''} ${rx.leads?.last_name || ''}`.trim() || '—'
    );
    const rosette = belegnummerRosette(rx, {
      patientennummer: rx.leads?.patientennummer,
      escapeHtml,
      titel: 'Patientennummer-Verordnungsnummer — dieselbe Nummer steht auf Rechnung und Abrechnungsdatei'
    });
    const date = rx.ausstellungsdatum ? new Date(rx.ausstellungsdatum).toLocaleDateString('de-DE') : '—';
    const gueltig = rx.gueltig_bis ? new Date(rx.gueltig_bis).toLocaleDateString('de-DE') : '—';
    const st = rx.status || 'parsed';
    const stLabel = STATUS_LABEL[st] || st;
    const stColor = STATUS_COLOR[st] || '#94a3b8';
    return `<tr class="vord-row" data-rx-id="${rx.id}" style="cursor:pointer" title="Verordnung öffnen">
      <td><span style="display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap;"><span style="font-weight:600;color:var(--text-main)">${patName}</span>${rosette}</span></td>
      <td style="white-space:nowrap">${date}</td>
      <td><code style="font-size:12px">${escapeHtml(rx.icd10 || '—')}</code></td>
      <td>${escapeHtml(rx.heilmittel || '—')}</td>
      <td style="text-align:center">${rx.anzahl_einheiten ?? '—'}</td>
      <td style="white-space:nowrap">${gueltig}</td>
      <td><span style="font-size:11px;font-weight:600;color:${stColor}">${escapeHtml(stLabel)}</span></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.vord-row').forEach(row => {
    row.addEventListener('click', () => zeigeVerordnungDetail({
      supabase,
      rxId: row.dataset.rxId,
      panel: document.getElementById('vordDetailPanel'),
      titel: document.getElementById('vordDetailName'),
      inhalt: document.getElementById('vordDetailContent'),
      escapeHtml
    }));
  });
}
