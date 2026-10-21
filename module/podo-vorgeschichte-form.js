/**
 * podo-vorgeschichte-form.js — Vorgeschichte aus dem Altsystem erfassen.
 *
 * Warum (VO-Import Schritt 2, 21.10.2026): Spalten (Migration 0086) und Regeln
 * (module/podo-vorgeschichte.js) gibt es; je Nagel lässt sich die Vorgeschichte
 * aber nicht sinnvoll per CSV übergeben. Dieser kleine Block steht im
 * Behandlungsbildschirm NUR bei aus dem Altsystem übernommenen Verordnungen —
 * dort, wo die Praxis beim Wechsel die Tage nachträgt.
 *
 * Erfasst werden nur Daten von VOs, die das Altsystem SELBST abgerechnet hat
 * (Hinweis im Block) — sonst sperrt sich die eigene 78040/Erstbefundung selbst.
 */

import { pruefeVorgeschichte, NAEGEL } from './podo-vorgeschichte.js?v=20261021v';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FELD = 'padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid);color:var(--text-main);font-size:13px;';

/** HTML des Blocks (zusammengeklappt). */
export function vorgeschichteFormHtml(lead, nagel) {
  const n = (lead?.podo_vorgeschichte_naegel || {})[nagel] || {};
  const datum = (id, wert, label) => `<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--text-muted);">${esc(label)}
      <input type="date" id="${id}" value="${esc(wert || '')}" style="${FELD}"></label>`;
  return `<details id="podVgBlock" style="border:1px solid var(--border);border-radius:8px;padding:8px 12px;">
    <summary style="cursor:pointer;font-size:13px;font-weight:600;">Vorgeschichte aus dem Altsystem${lead?.podo_vorgeschichte_erfasst_am ? ' <span style="font-weight:400;color:var(--text-muted);">· erfasst</span>' : ''}</summary>
    <p style="font-size:12px;color:var(--text-muted);margin:8px 0;line-height:1.45;">Nur Leistungen von Verordnungen, die Ihr bisheriges Programm <b>selbst abgerechnet</b> hat. Damit bietet Praxura 78040 bzw. eine Erstbefundung nicht erneut an.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
      ${datum('podVgErste', lead?.podo_vorgeschichte_erste_beh_am, 'Erste Behandlung')}
      ${datum('podVg78040', lead?.podo_vorgeschichte_78040_am, 'Eingangsbefundung 78040')}
      ${datum('podVg78100', lead?.podo_vorgeschichte_78100_am, 'Letzte Erstbefundung groß (78100) — gleich an welchem Nagel')}
    </div>
    ${NAEGEL.includes(nagel) ? `<div style="margin-top:10px;font-size:12px;color:var(--text-muted);">Nagel ${esc(nagel)}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:4px;">
      <label style="display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--text-muted);">Letzte Erstbefundung
        <select id="podVgNagelCode" style="${FELD}"><option value="">—</option>
          ${['78100', '78110'].map(c => `<option value="${c}" ${n.erstbefundung?.code === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      ${datum('podVgNagelAm', n.erstbefundung?.am, 'am')}
      ${datum('podVgNagel78520', n.abschluss_78520_am, 'Serie abgeschlossen (78520)')}
    </div>` : ''}
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px;">
      <button type="button" class="btn-ghost" id="podVgSpeichern" style="padding:6px 12px;">Vorgeschichte speichern</button>
      <span id="podVgMeldung" style="font-size:12px;"></span>
    </div>
  </details>`;
}

/**
 * Block füllen und Speichern verdrahten.
 * Sichtbar, wenn die VO übernommen wurde (`immer`) ODER der Patient aus dem Altsystem
 * stammt (Patienten-Import: metadata.import_batch/altsystem_nr) ODER schon eine
 * Vorgeschichte hat — podoloji 21.10.2026 (PE-009): sonst fehlt der Block, sobald ein
 * übernommener Patient mit einer NEUEN Praxura-VO kommt, und 78040 wird doppelt abgerechnet.
 * @param {{ sb, ownerId:string, leadId:string, nagel:?string, wrap:HTMLElement, immer?:boolean, nachSpeichern?:Function }} o
 */
export async function montiereVorgeschichte({ sb, ownerId, leadId, nagel, wrap, immer = false, nachSpeichern }) {
  if (!wrap || !leadId) return;
  const { data: lead } = await sb.from('leads')
    .select('podo_vorgeschichte_erste_beh_am, podo_vorgeschichte_78040_am, podo_vorgeschichte_78100_am, podo_vorgeschichte_naegel, podo_vorgeschichte_erfasst_am, metadata')
    .eq('id', leadId).eq('owner_id', ownerId).maybeSingle();
  const ausAltsystem = !!(lead?.metadata?.import_batch || lead?.metadata?.altsystem_nr || lead?.podo_vorgeschichte_erfasst_am);
  if (!immer && !ausAltsystem) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = vorgeschichteFormHtml(lead || {}, nagel || '');
  const $ = (id) => wrap.querySelector('#' + id);
  $('podVgSpeichern')?.addEventListener('click', async () => {
    const meldung = $('podVgMeldung');
    const naegel = { ...(lead?.podo_vorgeschichte_naegel || {}) };
    if (NAEGEL.includes(nagel)) {
      const code = $('podVgNagelCode')?.value, am = $('podVgNagelAm')?.value, ab = $('podVgNagel78520')?.value;
      naegel[nagel] = { ...(code && am ? { erstbefundung: { code, am } } : {}), ...(ab ? { abschluss_78520_am: ab } : {}) };
    }
    const { werte, fehler } = pruefeVorgeschichte({ ersteBeh: $('podVgErste')?.value, am78040: $('podVg78040')?.value, am78100: $('podVg78100')?.value, naegel });
    if (fehler.length) { meldung.style.color = 'var(--danger,#b42318)'; meldung.textContent = fehler.join(' · '); return; }
    // Leere Felder bewusst leeren (null), sonst bliebe ein gelöschtes Datum stehen.
    const patch = {
      podo_vorgeschichte_erste_beh_am: werte.podo_vorgeschichte_erste_beh_am || null,
      podo_vorgeschichte_78040_am: werte.podo_vorgeschichte_78040_am || null,
      podo_vorgeschichte_78100_am: werte.podo_vorgeschichte_78100_am || null,
      podo_vorgeschichte_naegel: werte.podo_vorgeschichte_naegel || null,
      podo_vorgeschichte_erfasst_am: new Date().toISOString(),
    };
    const { error } = await sb.from('leads').update(patch).eq('id', leadId).eq('owner_id', ownerId);
    meldung.style.color = error ? 'var(--danger,#b42318)' : 'var(--success,#15803d)';
    meldung.textContent = error ? 'Speichern fehlgeschlagen.' : 'Gespeichert ✓';
    if (!error) nachSpeichern?.();
  });
}
