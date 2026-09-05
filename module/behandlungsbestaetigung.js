/**
 * behandlungsbestaetigung.js — Bescheinigung über wahrgenommene Behandlungstermine.
 *
 * Warum es das gibt
 * ─────────────────
 * Beta-2, 05.09.2026 (Ops-Kart #272): Patienten brauchen für das Finanzamt
 * eine Bestätigung der wahrgenommenen Termine in einem Zeitraum (Fahrten-
 * Steuerabsetzung). Rahmen nach Rücksprache mit legal-de und dem podoloji-
 * Agenten (05.09.2026):
 *
 *   - Name bewusst "Behandlungsbestätigung", nicht "Fahrtenbestätigung" —
 *     bestätigt wird der Termin, nicht die Fahrt.
 *   - NUR Termindaten. Keine Diagnose, kein ICD, keine Verordnung, keine
 *     Kasse, keine Beträge/km — sonst Art. 5 Abs. 1 lit. c DSGVO verletzt
 *     UND § 5 StBerG-Risiko (unbefugte Steuerhilfe durch eine Kilometer-
 *     /Betragsrechnung).
 *   - Nur wahrgenommene Termine: kein Hausbesuch (Patient war nicht in der
 *     Praxis), kein No-Show, kein cancelled/pending, keine Zukunft.
 *   - Kein Consent-Schritt. Rechtsgrundlage ist § 630g Abs. 1/2 BGB i.V.m.
 *     Art. 15 Abs. 3 DSGVO (Herausgabe an den Betroffenen selbst) — eine
 *     Einwilligungs-Checkbox würde eine falsche, widerrufliche Rechts-
 *     grundlage vortäuschen (Art. 7 Abs. 3 DSGVO).
 *   - Client-seitig wie module/termin-druck.js: kein Server, kein Speichern,
 *     kein Versand aus der Software heraus. Passt zu G8 (on-premise-tauglich,
 *     kein neuer Vercel-Endpunkt bei 12/12 belegten Funktionen).
 *
 * Was hier NICHT passiert
 * ───────────────────────
 * Keine km- oder Betragsrechnung, keine Übermittlung ans Finanzamt aus der
 * Software heraus, keine Speicherung des erzeugten PDFs (es ist jederzeit aus
 * `bookings` neu erzeugbar — GoBD/§147 AO betreffen dieses Dokument nicht).
 */

'use strict';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const DE = (iso) => {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Termine eines Patienten in einem Zeitraum, gefiltert auf das, was in eine
 * steuerliche Bescheinigung darf: wahrgenommen, in der Praxis, vergangen.
 * (Filter nach legal-de, 05.09.2026 — siehe Dateikopf.)
 *
 * Obergrenze ist die kleinere von "Ende des Bis-Tages" und "jetzt" — sonst
 * würde ein für heute Abend geplanter, noch nicht stattgefundener Termin
 * mit hineinrutschen (Tagesgrenze allein reicht nicht, siehe canli-test
 * 05.09.2026: "keine Zukunft" muss auf die Uhrzeit gehen, nicht nur den Tag).
 *
 * @returns {Promise<Array<{start_time:string}>>}
 */
export async function ladeBescheinigungTermine(sb, ownerId, leadId, { von, bis } = {}) {
  const jetzt = new Date();
  const bisEndeTag = bis ? new Date(`${bis}T23:59:59`) : jetzt;
  const obergrenze = bisEndeTag < jetzt ? bisEndeTag : jetzt;

  const { data, error } = await sb.from('bookings')
    .select('start_time')
    .eq('owner_id', ownerId).eq('lead_id', leadId)
    .eq('hausbesuch', false)
    .eq('no_show', false)
    .in('status', ['confirmed', 'completed'])
    .gte('start_time', von ? `${von}T00:00:00` : '1900-01-01T00:00:00')
    .lte('start_time', obergrenze.toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Öffnet den Browser-Druckdialog mit der Bescheinigung. Kein Server, kein
 * Speichern — siehe Dateikopf.
 *
 * @param {object} opts
 * @param {object} opts.praxis         { name, strasse, ort, telefon }
 * @param {string} opts.patientName
 * @param {string} [opts.geburtsdatum] ISO — Identitätsmerkmal fürs Finanzamt
 * @param {Array}  opts.termine        [{ start_time }]
 * @param {string} opts.von            ISO-Datum, Beginn des Zeitraums
 * @param {string} opts.bis            ISO-Datum, Ende des Zeitraums
 * @param {string} [opts.logoUrl]
 * @returns {boolean} false, wenn der Popup-Blocker das Fenster verhindert hat
 */
export function druckeBehandlungsbestaetigung({
  praxis = {}, patientName = '', geburtsdatum = '', termine = [],
  von = '', bis = '', logoUrl = '',
}) {
  if (!termine.length) return false;

  const zeilen = termine.map(t => {
    const d = new Date(t.start_time);
    if (isNaN(d)) return '';
    const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `<tr>
      <td class="datum">${escapeHtml(d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }))}</td>
      <td class="uhr">${escapeHtml(uhr)}</td>
    </tr>`;
  }).filter(Boolean).join('');

  const logoHtml = logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="">` : '';
  const heute = DE(new Date());

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Behandlungsbestätigung</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
         color: #111; margin: 0; font-size: 11pt; line-height: 1.5; }
  .kopf { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 1.5pt solid #111; padding-bottom: 5mm; margin-bottom: 8mm; }
  .praxis { font-size: 12pt; font-weight: 700; }
  .praxis span { display: block; font-size: 9pt; font-weight: 400; color: #444; }
  .logo { max-height: 20mm; max-width: 55mm; display: block; margin-bottom: 3mm; }
  h1 { font-size: 14pt; margin: 0 0 8mm; }
  .angaben { margin-bottom: 6mm; }
  .angaben div { margin-bottom: 1mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  th { text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: .04em;
       color: #555; border-bottom: .5pt solid #999; padding: 1.5mm 2mm 1.5mm 0; }
  td { padding: 1.8mm 2mm 1.8mm 0; border-bottom: .3pt solid #ddd; }
  .datum { width: 55mm; }
  .anzahl { font-weight: 600; margin-bottom: 8mm; }
  .hinweis { font-size: 9pt; color: #444; margin-bottom: 12mm; }
  .hinweis p { margin: 0 0 2mm; }
  .unterschrift { display: flex; justify-content: space-between; margin-top: 16mm; }
  .unterschrift .feld { width: 60mm; border-top: .5pt solid #111; padding-top: 2mm; font-size: 9pt; color: #444; }
  @media screen { body { padding: 15mm; max-width: 210mm; margin: 0 auto; } }
</style></head><body>
  ${logoHtml}
  <div class="kopf">
    <div class="praxis">${escapeHtml(praxis.name || '')}
      <span>${escapeHtml([praxis.strasse, praxis.ort].filter(Boolean).join(' · '))}</span>
      <span>${escapeHtml(praxis.telefon || '')}</span>
    </div>
  </div>
  <h1>Bescheinigung über wahrgenommene Behandlungstermine</h1>
  <div class="angaben">
    <div><strong>Patient/in:</strong> ${escapeHtml(patientName)}</div>
    ${geburtsdatum ? `<div><strong>Geburtsdatum:</strong> ${DE(geburtsdatum)}</div>` : ''}
    <div><strong>Zeitraum:</strong> ${DE(von)} – ${DE(bis)}</div>
  </div>
  <table>
    <thead><tr><th>Datum</th><th>Uhrzeit</th></tr></thead>
    <tbody>${zeilen}</tbody>
  </table>
  <div class="anzahl">Anzahl der wahrgenommenen Termine: ${termine.length}</div>
  <div class="hinweis">
    <p>Bestätigt wird ausschließlich, dass die vorstehend aufgeführten Termine in unserer Praxis wahrgenommen wurden. Angaben zu Diagnose, Befund oder Behandlungsinhalt sind nicht Gegenstand dieser Bescheinigung.</p>
    <p>Diese Bescheinigung ist keine steuerliche Beratung. Über die Anerkennung von Fahrtkosten entscheidet allein das Finanzamt.</p>
  </div>
  <div class="unterschrift">
    <div class="feld">Ort, Datum: ${escapeHtml(heute)}</div>
    <div class="feld">Stempel / Unterschrift</div>
  </div>
  <script>window.addEventListener('load', function () { window.print(); });<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  // Popup-Blocker: still zu scheitern wäre der schlimmste Fall — der Anwender
  // klickt und nichts passiert. Siehe module/termin-druck.js, gleiches Muster.
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

/**
 * Baut Knopf + Datumsbereich-Formular in ein Zielelement. Beim Klick auf
 * "PDF erstellen" werden die Termine geladen und der Druckdialog geöffnet.
 * Das ist die Schnittstelle für patientenkarte.js / dashboard.js.
 *
 * @param {HTMLElement} el
 * @param {object} deps { sb, ownerId, lead, praxis, logoUrl, name }
 *   `deps.name(lead)` optional — wie in renderStammdaten, für die Namensanzeige.
 */
export function mountBehandlungsbestaetigung(el, deps = {}) {
  if (!el) return;
  const heute = new Date().toISOString().slice(0, 10);
  const vorMonat = new Date();
  vorMonat.setMonth(vorMonat.getMonth() - 3);
  const startWert = vorMonat.toISOString().slice(0, 10);

  el.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" id="bbToggle" style="font-size:12px;">
      Behandlungsbestätigung
    </button>
    <div id="bbForm" hidden style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;
         margin-top:8px;padding:10px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;">
      <div>
        <label style="display:block;font-size:11px;color:var(--text-muted);margin-bottom:2px;">Von</label>
        <input type="date" id="bbVon" value="${startWert}" max="${heute}" style="font-size:13px;">
      </div>
      <div>
        <label style="display:block;font-size:11px;color:var(--text-muted);margin-bottom:2px;">Bis</label>
        <input type="date" id="bbBis" value="${heute}" max="${heute}" style="font-size:13px;">
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="bbErzeugen" style="font-size:12px;">PDF erstellen</button>
      <span id="bbFehler" style="font-size:12px;color:#dc2626;"></span>
    </div>`;

  el.querySelector('#bbToggle').addEventListener('click', () => {
    el.querySelector('#bbForm').hidden = !el.querySelector('#bbForm').hidden;
  });

  el.querySelector('#bbErzeugen').addEventListener('click', async () => {
    const fehlerEl = el.querySelector('#bbFehler');
    fehlerEl.textContent = '';
    const von = el.querySelector('#bbVon').value;
    const bis = el.querySelector('#bbBis').value;
    if (!von || !bis || von > bis) {
      fehlerEl.textContent = 'Zeitraum prüfen.';
      return;
    }
    try {
      const termine = await ladeBescheinigungTermine(deps.sb, deps.ownerId, deps.lead.id, { von, bis });
      if (!termine.length) {
        fehlerEl.textContent = 'Keine wahrgenommenen Termine in diesem Zeitraum.';
        return;
      }
      const name = deps.name ? deps.name(deps.lead)
        : `${deps.lead.first_name || ''} ${deps.lead.last_name || ''}`.trim();
      const ok = druckeBehandlungsbestaetigung({
        praxis: deps.praxis || {},
        patientName: name,
        geburtsdatum: deps.lead.geburtsdatum || deps.lead.metadata?.geburtsdatum || '',
        termine, von, bis,
        logoUrl: deps.logoUrl || '',
      });
      if (!ok) fehlerEl.textContent = 'Popup wurde blockiert — bitte Popups für diese Seite erlauben.';
    } catch (e) {
      fehlerEl.textContent = 'Fehler beim Laden der Termine.';
    }
  });
}
