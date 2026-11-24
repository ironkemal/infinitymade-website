/**
 * module/abwesenheit-termine.js — 07:30-Uhr-Krankheits- & Abwesenheits-Assistent.
 *
 * Warum es das gibt (Praxisinhaber-Prüfung 23.11.2026, Option C)
 * ──────────────────────────────────────────────────────────────
 * Bisher zeigte `abwesenheitFreigeben()` bei überschneidenden Terminen nur die
 * Anzahl („12 Termine überschneiden sich. Bitte die betroffenen Termine umplanen.“)
 * und ließ die Rezeption alle Termine einzeln im Kalender suchen.
 *
 * Dieser Assistent öffnet direkt nach dem Eintragen einer Abwesenheit, zeigt alle
 * betroffenen Termine chronologisch und bietet pro Termin:
 *   1. 1-Klick-Vertretung — schlägt ausschließlich wirklich freie Kollegen vor
 *      (nicht abwesend, keine Terminüberschneidung, bevorzugt passende Leistung
 *      aus `employee_services`).
 *   2. 1-Klick-Absage (`status = 'cancelled'`) mit direktem `tel:`-Anruflink.
 *   3. 1-Klick-Anrufliste drucken (DIN A4, Browser-Druck, G8-konform, datensparsam —
 *      niemals Diagnose, niemals Krankheitsgrund des Mitarbeiters!).
 *
 * Null Emojis (Handwerk-Regel 4). Reine Funktionen oben (vollständig unit-testbar),
 * Dialog & Supabase-Verdrahtung unten.
 */

import { berlinTagesgrenzen, alsBerlinDatum } from './berlin-datum.js';
import { istAbwesend, ladeAbwesenheiten } from './abwesenheit.js?v=20261031';
import { emit } from './signal.js?v=20260813';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function zeitDe(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(d);
}

function uhrzeitDe(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(d);
}

function telHref(nummer) {
  const sauber = String(nummer || '').replace(/[^\d+]/g, '');
  return sauber.length >= 4 ? `tel:${sauber}` : '';
}

function zeitUeberschneidet(startA, endA, startB, endB) {
  const a0 = Date.parse(startA);
  const a1 = Date.parse(endA || startA);
  const b0 = Date.parse(startB);
  const b1 = Date.parse(endB || startB);
  if ([a0, a1, b0, b1].some(Number.isNaN)) return false;
  const effA1 = a1 > a0 ? a1 : a0 + 30 * 60000;
  const effB1 = b1 > b0 ? b1 : b0 + 30 * 60000;
  return a0 < effB1 && effA1 > b0;
}

const WOCHENTAG_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function berlinWochentagUndMinuten(startIso, endIso) {
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return null;
  const eRaw = endIso ? new Date(endIso) : null;
  const e = eRaw && !Number.isNaN(eRaw.getTime()) && eRaw.getTime() > s.getTime()
    ? eRaw
    : new Date(s.getTime() + 30 * 60000);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const teile = (d) => Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  const pS = teile(s);
  const pE = teile(e);
  const tag = WOCHENTAG_INDEX[/** @type {keyof typeof WOCHENTAG_INDEX} */ (pS.weekday)];
  if (tag === undefined) return null;
  const vonMin = Number(pS.hour) * 60 + Number(pS.minute);
  const bisMin = Number(pE.hour) * 60 + Number(pE.minute);
  return { tag, vonMin, bisMin: bisMin > vonMin ? bisMin : vonMin + 30 };
}

function hhmmZuMinuten(wert) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(wert || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Ermittelt alle wirklich freien Kollegen für einen betroffenen Termin (rein, unit-testbar).
 *
 * Kriterien:
 *  - nicht der abwesende Mitarbeiter selbst
 *  - am Tag des Termins nicht selbst abwesend (`istAbwesend`)
 *  - wenn `workingHours` für den Kollegen gepflegt sind: der Termin liegt innerhalb
 *    seiner aktiven Dienstzeit am jeweiligen Berliner Wochentag (schützt vor
 *    Vorschlägen an Teilzeit-Tagen oder nach Feierabend!)
 *  - keine Überschneidung mit einem anderen aktiven Termin (`status !== 'cancelled'`)
 *  - Leistungs-Abgleich über `employee_services`
 *
 * @param {object} p
 * @param {{ start_time: string, end_time?: string|null, service_id?: string|null }} p.termin
 * @param {Array<{ id: string, name: string }>} p.team
 * @param {Array<{ employee_id: string, service_id: string }>} [p.employeeServices]
 * @param {Array<{ user_id: string, day_of_week: number, start_time: string, end_time: string, is_active?: boolean|null }>} [p.workingHours]
 * @param {Array<{ id?: string, user_id: string, start_time: string, end_time?: string|null, status?: string|null }>} [p.alleTermine]
 * @param {Array<{ employee_id: string, start_date: string, end_date: string }>} [p.abwesenheiten]
 * @param {string} p.abwesenderId
 * @returns {Array<{ id: string, name: string, passtLeistung: boolean }>}
 */
export function findeFreieVertreter({
  termin,
  team = [],
  employeeServices = [],
  workingHours = [],
  alleTermine = [],
  abwesenheiten = [],
  abwesenderId,
}) {
  if (!termin?.start_time) return [];
  const tagIso = alsBerlinDatum(termin.start_time);
  const terminSlot = berlinWochentagUndMinuten(termin.start_time, termin.end_time);

  const serviceMap = new Map();
  for (const es of employeeServices || []) {
    if (!es?.employee_id || !es?.service_id) continue;
    let set = serviceMap.get(es.employee_id);
    if (!set) { set = new Set(); serviceMap.set(es.employee_id, set); }
    set.add(String(es.service_id));
  }
  const hatServicePflege = serviceMap.size > 0 && !!termin.service_id;

  /** @type {Map<string, Array<{ day_of_week: number, start_time: string, end_time: string, is_active?: boolean|null }>>} */
  const whMap = new Map();
  for (const w of workingHours || []) {
    if (!w?.user_id) continue;
    let arr = whMap.get(w.user_id);
    if (!arr) { arr = []; whMap.set(w.user_id, arr); }
    arr.push(w);
  }

  const kandidaten = [];
  for (const m of team || []) {
    if (!m?.id || String(m.id) === String(abwesenderId)) continue;
    if (tagIso && istAbwesend(abwesenheiten, m.id, tagIso)) continue;

    // Arbeitszeit prüfen, sofern für diesen Kollegen Dienstzeiten hinterlegt sind.
    const eigeneWh = whMap.get(m.id);
    if (eigeneWh?.length && terminSlot) {
      const imDienst = eigeneWh.some((w) => {
        if (w.is_active === false) return false;
        if (Number(w.day_of_week) !== terminSlot.tag) return false;
        const wVon = hhmmZuMinuten(w.start_time);
        const wBis = hhmmZuMinuten(w.end_time);
        return wVon !== null && wBis !== null && wVon <= terminSlot.vonMin && wBis >= terminSlot.bisMin;
      });
      if (!imDienst) continue;
    }

    const belegt = (alleTermine || []).some((b) =>
      b
      && String(b.user_id) === String(m.id)
      && b.status !== 'cancelled'
      && zeitUeberschneidet(termin.start_time, termin.end_time, b.start_time, b.end_time)
    );
    if (belegt) continue;

    const leistungen = serviceMap.get(m.id);
    const passtLeistung = !hatServicePflege || !leistungen || leistungen.has(String(termin.service_id));
    if (hatServicePflege && leistungen && !passtLeistung) continue;

    kandidaten.push({
      id: m.id,
      name: String(m.name || 'Kolleg:in').trim(),
      passtLeistung: hatServicePflege ? !!leistungen?.has(String(termin.service_id)) : true,
    });
  }

  return kandidaten.sort((a, b) => {
    if (a.passtLeistung !== b.passtLeistung) return a.passtLeistung ? -1 : 1;
    return a.name.localeCompare(b.name, 'de-DE');
  });
}

/**
 * Erzeugt eine datensparsame DIN-A4-Anrufliste zum Drucken (rein, unit-testbar).
 * Bewusst OHNE Diagnose und OHNE Krankheitsgrund des Mitarbeiters (Art. 9 DSGVO).
 *
 * @param {object} opts
 * @param {string} [opts.therapeutName]
 * @param {string} opts.von  'YYYY-MM-DD'
 * @param {string} opts.bis  'YYYY-MM-DD'
 * @param {Array<{ start_time: string, end_time?: string|null, patientName: string, telefon?: string, leistung?: string, statusLabel?: string }>} opts.termine
 * @returns {string}
 */
export function erstelleAnruflisteHtml({ therapeutName = '', von = '', bis = '', termine = [] } = {}) {
  const zeitraum = von === bis ? von : `${von} bis ${bis}`;
  const zeilen = (termine || []).map((t) => `
    <tr>
      <td class="al-zeit">${esc(zeitDe(t.start_time))}${t.end_time ? `–${esc(uhrzeitDe(t.end_time))}` : ''}</td>
      <td class="al-name">${esc(t.patientName || 'Ohne Name')}</td>
      <td class="al-tel">${esc(t.telefon || 'Keine Nummer')}</td>
      <td>${esc(t.leistung || 'Termin')}</td>
      <td class="al-check">${t.statusLabel ? esc(t.statusLabel) : '&#9744; Erreicht &nbsp; &#9744; Umgelegt'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Anrufliste Terminumplanung (${esc(zeitraum)})</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111827; font-size: 11px; margin: 0; }
    header { border-bottom: 1.5px solid #111827; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { font-size: 15px; margin: 0; }
    .al-sub { color: #4b5563; font-size: 10.5px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
    .al-zeit, .al-tel { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .al-name { font-weight: 600; }
    .al-check { white-space: nowrap; font-size: 10px; }
    footer { margin-top: 14px; font-size: 9.5px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 6px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Anrufliste — Terminumplanung</h1>
      <div class="al-sub">Zeitraum: ${esc(zeitraum)}${therapeutName ? ` · Behandler: ${esc(therapeutName)}` : ''}</div>
    </div>
    <div class="al-sub">${(termine || []).length} ${(termine || []).length === 1 ? 'Termin' : 'Termine'}</div>
  </header>
  <table>
    <thead>
      <tr>
        <th style="width:22%;">Termin</th>
        <th style="width:24%;">Patient</th>
        <th style="width:18%;">Telefon</th>
        <th style="width:18%;">Leistung</th>
        <th style="width:18%;">Status</th>
      </tr>
    </thead>
    <tbody>${zeilen || '<tr><td colspan="5">Keine offenen Termine.</td></tr>'}</tbody>
  </table>
  <footer>Hinweis: Am Telefon neutral über Terminverlegung informieren — keine Gesundheitsdaten von Mitarbeitenden nennen. Nach Erledigung datenschutzgerecht entsorgen.</footer>
  <script>window.addEventListener('load', function () { window.print(); });<\/script>
</body>
</html>`;
}

/**
 * Öffnet den interaktiven 07:30-Uhr-Vertretungs- & Absage-Assistenten für alle Termine
 * eines Mitarbeiters in einem Abwesenheitszeitraum.
 *
 * @param {{
 *   supabase: any,
 *   ownerId: string,
 *   empId: string,
 *   von: string,
 *   bis: string,
 *   showToast?: (msg: string, typ?: string) => void,
 *   showConfirmModal?: (opts: object) => Promise<boolean>|boolean,
 * }} deps
 */
export async function oeffneAbwesenheitAssistent({
  supabase,
  ownerId,
  empId,
  von,
  bis,
  showToast = () => {},
  showConfirmModal = null,
} = {}) {
  if (!supabase || !ownerId || !empId || typeof document === 'undefined') return;
  const start = berlinTagesgrenzen(von);
  const ende = berlinTagesgrenzen(bis);
  if (!start || !ende) return;

  const [betrRes, alleRes, teamRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, user_id, service_id, start_time, end_time, status, customer_name, customer_phone, leads!lead_id(first_name, last_name, phone, handy), services(title)')
      .eq('owner_id', ownerId)
      .eq('user_id', empId)
      .in('status', ['confirmed', 'pending'])
      .is('group_parent_id', null)
      .lt('start_time', ende.bisExklusiv)
      .gt('end_time', start.von)
      .order('start_time', { ascending: true })
      .limit(150),
    supabase
      .from('bookings')
      .select('id, user_id, start_time, end_time, status')
      .eq('owner_id', ownerId)
      .neq('status', 'cancelled')
      .lt('start_time', ende.bisExklusiv)
      .gt('end_time', start.von)
      .limit(600),
    supabase
      .from('profiles')
      .select('id, business_name, email, is_active')
      .or(`id.eq.${ownerId},owner_id.eq.${ownerId}`),
  ]);

  if (betrRes.error) {
    showToast('Betroffene Termine konnten nicht geladen werden.', 'error');
    return;
  }
  const betroffene = Array.isArray(betrRes.data) ? betrRes.data : [];
  if (!betroffene.length) return;

  const team = (Array.isArray(teamRes.data) ? teamRes.data : [])
    .filter(p => p && p.is_active !== false)
    .map(p => ({ id: p.id, name: String(p.business_name || p.email || 'Kolleg:in').trim() }));
  const teamIds = team.map(m => m.id);

  const [svcRes, whRes, alleAbwesenheiten] = teamIds.length
    ? await Promise.all([
        supabase.from('employee_services').select('employee_id, service_id').in('employee_id', teamIds),
        supabase.from('working_hours').select('user_id, day_of_week, start_time, end_time, is_active').in('user_id', teamIds),
        ladeAbwesenheiten(supabase, { empIds: teamIds, vonISO: start.von, bisISO: ende.bisExklusiv }).catch(() => []),
      ])
    : [{ data: [] }, { data: [] }, []];

  const alleTermine = Array.isArray(alleRes.data) ? [...alleRes.data] : [];
  const empServices = Array.isArray(svcRes.data) ? svcRes.data : [];
  const workingHours = Array.isArray(whRes.data) ? whRes.data : [];
  const therapeutName = team.find(m => String(m.id) === String(empId))?.name || '';

  const eintraege = betroffene.map((b) => {
    const l = b.leads || null;
    const patientName = [l?.first_name, l?.last_name].filter(Boolean).join(' ').trim() || b.customer_name || 'Ohne Name';
    const telefon = String(l?.handy || l?.phone || b.customer_phone || '').trim();
    return {
      ...b,
      patientName,
      telefon,
      leistung: b.services?.title || 'Behandlung',
      erledigt: null, // null | { art: 'uebertragen'|'abgesagt', text: string }
    };
  });

  document.getElementById('_abwAssistentModal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = '_abwAssistentModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.62);z-index:10020;display:flex;align-items:center;justify-content:center;padding:16px;';

  const schliessen = () => {
    document.removeEventListener('keydown', onEsc);
    overlay.remove();
  };
  function onEsc(e) { if (e.key === 'Escape') schliessen(); }
  document.addEventListener('keydown', onEsc);

  const render = () => {
    const offen = eintraege.filter(e => !e.erledigt).length;
    const uebertragen = eintraege.filter(e => e.erledigt?.art === 'uebertragen').length;
    const abgesagt = eintraege.filter(e => e.erledigt?.art === 'abgesagt').length;

    const zeilenHtml = eintraege.map((e, idx) => {
      const tel = telHref(e.telefon);
      if (e.erledigt) {
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid var(--border);opacity:0.72;font-size:13px;">
            <div>
              <strong>${esc(e.patientName)}</strong>
              <span style="color:var(--text-muted);margin-left:6px;">${esc(zeitDe(e.start_time))} · ${esc(e.leistung)}</span>
            </div>
            <span style="font-size:12px;font-weight:600;color:${e.erledigt.art === 'uebertragen' ? 'var(--success,#16a34a)' : 'var(--text-muted)'};">${esc(e.erledigt.text)}</span>
          </div>`;
      }

      const freie = findeFreieVertreter({
        termin: e,
        team,
        employeeServices: empServices,
        workingHours,
        alleTermine,
        abwesenheiten: alleAbwesenheiten,
        abwesenderId: empId,
      });

      const vertreterHtml = freie.length
        ? `<select data-abw-sel="${idx}" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input,var(--bg-card));color:var(--text-main);font-size:12px;max-width:170px;">
            ${freie.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}
          </select>
          <button type="button" data-abw-move="${idx}" class="btn-secondary" style="padding:5px 10px;font-size:12px;white-space:nowrap;">Übertragen</button>`
        : `<span style="font-size:12px;color:var(--text-muted);">Kein freier Vertreter</span>`;

      return `
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid var(--border);font-size:13px;">
          <div style="min-width:200px;flex:1;">
            <div><strong>${esc(e.patientName)}</strong> · <span style="font-variant-numeric:tabular-nums;">${esc(zeitDe(e.start_time))}</span></div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              ${esc(e.leistung)}${tel ? ` · <a href="${esc(tel)}" style="color:var(--accent,#b1891b);text-decoration:none;">${esc(e.telefon)}</a>` : ' · keine Telefonnummer'}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${vertreterHtml}
            <button type="button" data-abw-cancel="${idx}" style="padding:5px 10px;border:1px solid var(--danger,#dc2626);border-radius:6px;background:transparent;color:var(--danger,#dc2626);cursor:pointer;font-size:12px;font-family:inherit;white-space:nowrap;">Absagen</button>
          </div>
        </div>`;
    }).join('');

    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="_abwAssTitle"
        style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:12px;max-width:740px;width:100%;max-height:86vh;display:flex;flex-direction:column;color:var(--text-main);font-family:inherit;overflow:hidden;">
        <div style="padding:18px 20px 12px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div>
            <div id="_abwAssTitle" style="font-size:16px;font-weight:700;">Betroffene Termine umplanen (${eintraege.length})</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              ${therapeutName ? `${esc(therapeutName)} · ` : ''}${esc(von === bis ? von : `${von} bis ${bis}`)} — freie Vertreter werden automatisch nach Abwesenheit, Zeitkonflikt und Leistung geprüft.
            </div>
          </div>
          <button type="button" id="_abwPrintBtn" class="btn-secondary" style="padding:6px 12px;font-size:12px;white-space:nowrap;">Anrufliste drucken</button>
        </div>
        <div style="overflow-y:auto;flex:1;border-top:1px solid var(--border);border-bottom:1px solid var(--border);">
          ${zeilenHtml}
        </div>
        <div style="padding:12px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:12px;">
          <span style="color:var(--text-muted);">${offen} offen · ${uebertragen} übertragen · ${abgesagt} abgesagt</span>
          <button type="button" id="_abwCloseBtn" class="btn-primary" style="padding:7px 16px;font-size:13px;">Schließen</button>
        </div>
      </div>`;

    overlay.querySelector('#_abwCloseBtn').onclick = schliessen;
    overlay.querySelector('#_abwPrintBtn').onclick = () => {
      const html = erstelleAnruflisteHtml({
        therapeutName,
        von,
        bis,
        termine: eintraege.map(e => ({ ...e, statusLabel: e.erledigt?.text || '' })),
      });
      const win = window.open('', '_blank', 'width=860,height=700');
      if (!win) {
        showToast('Popup-Blocker blockiert das Druckfenster.', 'warning');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
    };

    overlay.querySelectorAll('[data-abw-move]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-abw-move'));
        const eintrag = eintraege[idx];
        const sel = overlay.querySelector(`[data-abw-sel="${idx}"]`);
        const zielId = sel?.value;
        if (!eintrag || !zielId) return;
        btn.disabled = true;
        const { error } = await supabase
          .from('bookings')
          .update({ user_id: zielId })
          .eq('id', eintrag.id)
          .eq('owner_id', ownerId);
        if (error) {
          showToast('Termin konnte nicht übertragen werden: ' + error.message, 'error');
          btn.disabled = false;
          return;
        }
        // Lokale Belegungsliste sofort aktualisieren, damit der nächste Termin keinen Doppel-Vorschlag macht!
        const lokal = alleTermine.find(t => t.id === eintrag.id);
        if (lokal) lokal.user_id = zielId;
        else alleTermine.push({ id: eintrag.id, user_id: zielId, start_time: eintrag.start_time, end_time: eintrag.end_time, status: eintrag.status });
        const zielName = team.find(m => String(m.id) === String(zielId))?.name || 'Vertretung';
        eintrag.erledigt = { art: 'uebertragen', text: `Übertragen an ${zielName}` };
        emit('bookings:changed', { source: 'abwesenheit-assistent', action: 'reassign', id: eintrag.id });
        showToast(`Termin übertragen an ${zielName}`);
        render();
      });
    });

    overlay.querySelectorAll('[data-abw-cancel]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-abw-cancel'));
        const eintrag = eintraege[idx];
        if (!eintrag) return;
        const ok = showConfirmModal
          ? await showConfirmModal({
              title: 'Termin absagen?',
              message: `Termin für ${eintrag.patientName} (${zeitDe(eintrag.start_time)}) wirklich als abgesagt markieren? Bitte Patienten anschließend telefonisch informieren.`,
              confirmText: 'Termin absagen',
              cancelText: 'Zurück',
              variant: 'danger',
            })
          : window.confirm(`Termin für ${eintrag.patientName} wirklich absagen?`);
        if (!ok) return;
        btn.disabled = true;
        const { error } = await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('id', eintrag.id)
          .eq('owner_id', ownerId);
        if (error) {
          showToast('Termin konnte nicht abgesagt werden: ' + error.message, 'error');
          btn.disabled = false;
          return;
        }
        const lokal = alleTermine.find(t => t.id === eintrag.id);
        if (lokal) lokal.status = 'cancelled';
        eintrag.erledigt = { art: 'abgesagt', text: 'Abgesagt (bitte anrufen)' };
        emit('bookings:changed', { source: 'abwesenheit-assistent', action: 'cancel', id: eintrag.id });
        showToast('Termin abgesagt');
        render();
      });
    });
  };

  overlay.onclick = (e) => { if (e.target === overlay) schliessen(); };
  document.body.appendChild(overlay);
  render();
}
