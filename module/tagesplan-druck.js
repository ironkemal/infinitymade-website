/**
 * module/tagesplan-druck.js — Druckbarer Praxis-Tagesplan (DIN A4).
 *
 * Warum es das gibt (Praxisinhaber-Prüfung, 23.11.2026)
 * ─────────────────────────────────────────────────────
 * `module/termin-druck.js` druckt den DIN-A5-Terminzettel für den einzelnen
 * Patienten. Im Praxisalltag fehlte der druckbare Tagesplan für:
 *   1. Rezeption / Offline-Notfall (WLAN- oder Strom-Wackler)
 *   2. Einzelnen Therapeuten (Klemmbrett im Behandlungsraum)
 *   3. Hausbesuchs-Tour (Adresse & Telefon kompakt auf einem Blatt)
 *
 * Datenschutz & On-Premise (G8):
 * - Reiner Browser-Druck (`window.print()`), keine Server-Abhängigkeit, 100 % Box-fähig.
 * - `datensparsam` ist standardmäßig aktiv: keine Diagnosen, kein ICD, keine Freitext-Notizen.
 * - Null Emojis (Handwerk-Regel 4).
 */

import { berlinTagesgrenzen } from './berlin-datum.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function uhrzeitBerlin(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(d);
}

function datumLangDe(datumIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datumIso || '').slice(0, 10));
  if (!m) return String(datumIso || '');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function adresseAusTermin(t) {
  const teile = [t?.strasse, [t?.plz, t?.ort].filter(Boolean).join(' ')].map(s => String(s || '').trim()).filter(Boolean);
  return teile.join(', ');
}

/**
 * Filtert stornierte Termine & Gruppen-Kindzeilen, wendet Modus-/Behandlerfilter an,
 * sortiert chronologisch und gruppiert nach Behandler.
 *
 * @param {Array<Record<string, any>>} termine
 * @param {{ modus?: 'praxis'|'therapeut'|'hausbesuch', therapeutId?: string|null }} [opts]
 * @returns {Array<{ therapeutId: string, therapeutName: string, eintraege: Array<Record<string, any>> }>}
 */
export function gruppiereTagesplanTermine(termine, { modus = 'praxis', therapeutId = null } = {}) {
  const aktiv = (Array.isArray(termine) ? termine : []).filter((t) => {
    if (!t || !t.start_time) return false;
    if (t.status === 'cancelled' || t.group_parent_id) return false;
    if (modus === 'hausbesuch' && !t.hausbesuch) return false;
    if (modus === 'therapeut' && therapeutId && String(t.user_id || '') !== String(therapeutId)) return false;
    return true;
  });

  aktiv.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

  /** @type {Map<string, { therapeutId: string, therapeutName: string, eintraege: Array<Record<string, any>> }>} */
  const gruppen = new Map();
  for (const t of aktiv) {
    const tid = String(t.user_id || 'unzugeordnet');
    const name = String(t.therapeutName || 'Ohne Zuordnung').trim() || 'Ohne Zuordnung';
    let g = gruppen.get(tid);
    if (!g) {
      g = { therapeutId: tid, therapeutName: name, eintraege: [] };
      gruppen.set(tid, g);
    }
    g.eintraege.push(t);
  }
  return [...gruppen.values()].sort((a, b) => a.therapeutName.localeCompare(b.therapeutName, 'de-DE'));
}

const MODUS_TITEL = {
  praxis: 'Praxis-Tagesplan',
  therapeut: 'Behandler-Tagesplan',
  hausbesuch: 'Hausbesuchs-Tour',
};

/**
 * Erzeugt das druckfertige DIN-A4-HTML für den Tagesplan (rein, unit-testbar).
 *
 * @param {object} opts
 * @param {{ name?: string, strasse?: string, ort?: string, telefon?: string }} [opts.praxis]
 * @param {string} opts.datumIso   'YYYY-MM-DD'
 * @param {'praxis'|'therapeut'|'hausbesuch'} [opts.modus]
 * @param {string|null} [opts.therapeutId]
 * @param {Array<Record<string, any>>} opts.termine
 * @param {boolean} [opts.datensparsam]  Standard true (keine Notizen/Diagnosen)
 * @param {string} [opts.erstelltUm]     z. B. '07:45'
 * @returns {string}
 */
export function erstelleTagesplanHtml({
  praxis = {},
  datumIso,
  modus = 'praxis',
  therapeutId = null,
  termine = [],
  datensparsam = true,
  erstelltUm = '',
} = {}) {
  const gruppen = gruppiereTagesplanTermine(termine, { modus, therapeutId });
  const gesamt = gruppen.reduce((s, g) => s + g.eintraege.length, 0);
  const istHausbesuch = modus === 'hausbesuch';
  const titel = MODUS_TITEL[modus] || MODUS_TITEL.praxis;
  const datumText = datumLangDe(datumIso);

  const abschnitteHtml = !gruppen.length
    ? `<p class="tp-leer">Für diesen Tag liegen in der gewählten Ansicht keine Termine vor.</p>`
    : gruppen.map((g) => `
      <section class="tp-gruppe">
        <div class="tp-gruppe-kopf">
          <span>${esc(g.therapeutName)}</span>
          <span class="tp-gruppe-count">${g.eintraege.length} ${g.eintraege.length === 1 ? 'Termin' : 'Termine'}</span>
        </div>
        <table class="tp-tabelle">
          <thead>
            <tr>
              <th style="width:15%;">Zeit</th>
              <th style="width:${istHausbesuch ? '35%' : '30%'};">Patient</th>
              <th style="width:${istHausbesuch ? '30%' : '27%'};">${istHausbesuch ? 'Adresse & Telefon' : 'Leistung & Ort'}</th>
              <th style="width:${istHausbesuch ? '20%' : '28%'};">Abhaken</th>
            </tr>
          </thead>
          <tbody>
            ${g.eintraege.map((t) => {
              const zeit = `${uhrzeitBerlin(t.start_time)}${t.end_time ? `–${uhrzeitBerlin(t.end_time)}` : ''}`;
              const patient = t.patientName || t.customer_name || 'Unbekannt';
              const leistung = t.leistung || 'Behandlung';
              const raumOderHb = t.hausbesuch ? 'Hausbesuch' : (t.raum || '');
              const telefon = String(t.telefon || t.customer_phone || '').trim();
              const adresse = adresseAusTermin(t);
              const spalte3 = istHausbesuch
                ? `<div>${esc(adresse || 'Adresse fehlt')}</div>${telefon ? `<div class="tp-sub">Tel.: ${esc(telefon)}</div>` : ''}<div class="tp-sub">${esc(leistung)}</div>`
                : `<div>${esc(leistung)}</div>${raumOderHb ? `<div class="tp-sub">${esc(raumOderHb)}</div>` : ''}${telefon ? `<div class="tp-sub">Tel.: ${esc(telefon)}</div>` : ''}`;
              const notizZeile = !datensparsam && t.notes
                ? `<div class="tp-sub">Notiz: ${esc(t.notes)}</div>`
                : '';
              const statusMarker = t.status === 'completed'
                ? 'Erledigt'
                : t.status === 'no_show'
                  ? 'Nicht erschienen'
                  : '&#9744; Da &nbsp; &#9744; Rez. &nbsp; &#9744; Zuz.';
              return `
                <tr>
                  <td class="tp-zeit">${esc(zeit)}</td>
                  <td>
                    <div class="tp-name">${esc(patient)}</div>
                    ${t.verordnungHinweis ? `<div class="tp-sub">${esc(t.verordnungHinweis)}</div>` : ''}
                    ${notizZeile}
                  </td>
                  <td>${spalte3}</td>
                  <td class="tp-check">${statusMarker}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </section>`).join('');

  const standText = erstelltUm ? `Stand ${erstelltUm} Uhr` : 'Offline-Notfalldruck';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${esc(titel)} — ${esc(datumText)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111827; margin: 0; font-size: 11px; line-height: 1.4; }
    .tp-kopf { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.5px solid #111827; padding-bottom: 8px; margin-bottom: 14px; }
    .tp-praxis { font-size: 14px; font-weight: 700; }
    .tp-titel { font-size: 16px; font-weight: 700; margin-top: 2px; }
    .tp-meta { text-align: right; color: #4b5563; font-size: 10.5px; }
    .tp-gruppe { margin-bottom: 14px; break-inside: avoid; }
    .tp-gruppe-kopf { display: flex; justify-content: space-between; font-weight: 700; font-size: 12px; padding: 5px 8px; background: #f3f4f6; border: 1px solid #d1d5db; border-bottom: none; }
    .tp-gruppe-count { font-weight: 500; color: #4b5563; }
    .tp-tabelle { width: 100%; border-collapse: collapse; }
    .tp-tabelle th, .tp-tabelle td { border: 1px solid #d1d5db; padding: 5px 7px; vertical-align: top; text-align: left; }
    .tp-tabelle th { background: #fafafa; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #374151; }
    .tp-zeit { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
    .tp-name { font-weight: 600; }
    .tp-sub { color: #4b5563; font-size: 10px; margin-top: 2px; }
    .tp-check { white-space: nowrap; font-size: 10px; color: #374151; }
    .tp-leer { padding: 18px; border: 1px solid #d1d5db; color: #4b5563; text-align: center; }
    .tp-fuss { margin-top: 16px; padding-top: 6px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 9.5px; color: #6b7280; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <header class="tp-kopf">
    <div>
      ${praxis?.name ? `<div class="tp-praxis">${esc(praxis.name)}</div>` : ''}
      <div class="tp-titel">${esc(titel)} — ${esc(datumText)}</div>
    </div>
    <div class="tp-meta">
      <div>${gesamt} ${gesamt === 1 ? 'Termin' : 'Termine'}${datensparsam ? ' · Datensparsam' : ''}</div>
      <div>${esc(standText)}</div>
    </div>
  </header>
  ${abschnitteHtml}
  <footer class="tp-fuss">
    <span>Vertraulicher Praxis-Tagesplan — nach Dienstschluss sicher aufbewahren oder vernichten.</span>
    <span>${esc(praxis?.telefon || '')}</span>
  </footer>
  <script>window.addEventListener('load', function () { window.print(); });<\/script>
</body>
</html>`;
}

/**
 * Öffnet einen ruhigen Auswahl-Dialog und druckt anschließend den Tagesplan für das
 * gewählte Datum (100 % Browser-Druck, G8-konform, kein Server-PDF-Dienst).
 *
 * @param {object} opts
 * @param {any} opts.supabase
 * @param {string} opts.ownerId
 * @param {string} opts.datumIso  'YYYY-MM-DD'
 * @param {{ name?: string, telefon?: string }} [opts.praxis]
 * @param {string|null} [opts.aktuellerUserId]
 * @param {(msg: string, typ?: string) => void} [opts.toast]
 */
export async function oeffneTagesplanDruckDialog({
  supabase,
  ownerId,
  datumIso,
  praxis = {},
  aktuellerUserId = null,
  toast = () => {},
} = {}) {
  if (!supabase || !ownerId || typeof document === 'undefined') return;

  // Team + Praxisname/Telefon für die Behandler-Auswahl und Druckkopf laden.
  const { data: teamRows } = await supabase
    .from('profiles')
    .select('id, business_name, email, phone')
    .or(`id.eq.${ownerId},owner_id.eq.${ownerId}`);
  const ownerRow = (Array.isArray(teamRows) ? teamRows : []).find(p => String(p.id) === String(ownerId));
  const praxisInfo = {
    name: praxis?.name || ownerRow?.business_name || '',
    telefon: praxis?.telefon || ownerRow?.phone || '',
  };
  const team = (Array.isArray(teamRows) ? teamRows : [])
    .map(p => ({ id: p.id, name: String(p.business_name || p.email || 'Behandler').trim() }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));

  document.getElementById('_tpDruckModal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = '_tpDruckModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';

  const feld = 'width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:var(--bg-input,var(--bg-card));color:var(--text-main);font-size:13px;font-family:inherit;';
  const label = 'margin-bottom:4px;color:var(--text-muted);font-size:12px;';

  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="_tpTitle"
      style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:12px;padding:22px;max-width:410px;width:100%;color:var(--text-main);font-family:inherit;">
      <div id="_tpTitle" style="font-size:15px;font-weight:700;margin-bottom:4px;">Tagesplan drucken</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">DIN A4 für Rezeption, Klemmbrett, Hausbesuche oder als Offline-Notfallplan.</div>
      <div style="display:grid;gap:12px;">
        <label style="display:block;">
          <div style="${label}">Datum</div>
          <input id="_tpDatum" type="date" value="${esc(datumIso)}" style="${feld}">
        </label>
        <label style="display:block;">
          <div style="${label}">Ansicht</div>
          <select id="_tpModus" style="${feld}">
            <option value="praxis">Ganze Praxis (nach Behandler)</option>
            <option value="therapeut">Einzelner Behandler (Klemmbrett)</option>
            <option value="hausbesuch">Nur Hausbesuchs-Tour (mit Adresse)</option>
          </select>
        </label>
        <label id="_tpTherapeutWrap" style="display:none;">
          <div style="${label}">Behandler</div>
          <select id="_tpTherapeut" style="${feld}">
            ${team.map(m => `<option value="${esc(m.id)}" ${m.id === aktuellerUserId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
          </select>
        </label>
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-main);cursor:pointer;">
          <input id="_tpDatensparsam" type="checkbox" checked style="margin-top:2px;">
          <span>Datensparsam drucken (ohne Notizen / Diagnosen)</span>
        </label>
      </div>
      <div id="_tpErr" style="color:var(--danger,#dc2626);font-size:12px;margin-top:8px;display:none;"></div>
      <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">
        <button id="_tpCancel" type="button" style="padding:8px 14px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text-main);cursor:pointer;font-size:13px;font-family:inherit;">Abbrechen</button>
        <button id="_tpPrint" type="button" style="padding:8px 16px;border:none;border-radius:7px;background:var(--accent,#b1891b);color:#fff;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;">Druckansicht öffnen</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const schliessen = () => {
    document.removeEventListener('keydown', onEsc);
    overlay.remove();
  };
  function onEsc(e) { if (e.key === 'Escape') schliessen(); }
  document.addEventListener('keydown', onEsc);

  overlay.querySelector('#_tpCancel').onclick = schliessen;
  overlay.onclick = (e) => { if (e.target === overlay) schliessen(); };

  const modusEl = overlay.querySelector('#_tpModus');
  const thWrap = overlay.querySelector('#_tpTherapeutWrap');
  modusEl.onchange = () => { thWrap.style.display = modusEl.value === 'therapeut' ? 'block' : 'none'; };

  overlay.querySelector('#_tpPrint').onclick = async () => {
    const btn = overlay.querySelector('#_tpPrint');
    const errEl = overlay.querySelector('#_tpErr');
    const gewaehltesDatum = overlay.querySelector('#_tpDatum').value;
    const modus = modusEl.value;
    const therapeutId = modus === 'therapeut' ? overlay.querySelector('#_tpTherapeut').value : null;
    const datensparsam = !!overlay.querySelector('#_tpDatensparsam').checked;
    const grenzen = berlinTagesgrenzen(gewaehltesDatum);
    if (!grenzen) {
      errEl.textContent = 'Bitte ein gültiges Datum auswählen.';
      errEl.style.display = '';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Lädt…';
    errEl.style.display = 'none';

    try {
      const { data: rows, error } = await supabase
        .from('bookings')
        .select('id, user_id, start_time, end_time, status, customer_name, customer_phone, hausbesuch, notes, group_parent_id, leads!lead_id(first_name, last_name, phone, handy, street, plz, city), services(title), rooms(name)')
        .eq('owner_id', ownerId)
        .gte('start_time', grenzen.von)
        .lt('start_time', grenzen.bisExklusiv)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true })
        .limit(300);

      if (error) throw error;

      const teamMap = Object.fromEntries(team.map(m => [m.id, m.name]));
      const normiert = (rows || []).map(b => {
        const l = b.leads || null;
        const patientName = [l?.first_name, l?.last_name].filter(Boolean).join(' ').trim() || b.customer_name || 'Unbekannt';
        return {
          ...b,
          patientName,
          telefon: l?.handy || l?.phone || b.customer_phone || '',
          strasse: l?.street || '',
          plz: l?.plz || '',
          ort: l?.city || '',
          leistung: b.services?.title || 'Behandlung',
          raum: b.rooms?.name || '',
          therapeutName: teamMap[b.user_id] || 'Behandler',
        };
      });

      const jetztText = new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Berlin',
      }).format(new Date());

      const html = erstelleTagesplanHtml({
        praxis: praxisInfo,
        datumIso: gewaehltesDatum,
        modus,
        therapeutId,
        termine: normiert,
        datensparsam,
        erstelltUm: jetztText,
      });

      const win = window.open('', '_blank', 'width=920,height=740');
      if (!win) {
        toast('Popup-Blocker blockiert das Druckfenster — bitte Popups für Praxura zulassen.', 'warning');
        btn.disabled = false;
        btn.textContent = 'Druckansicht öffnen';
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      schliessen();
    } catch (err) {
      errEl.textContent = 'Tagesplan konnte nicht geladen werden: ' + (err?.message || 'Unbekannter Fehler');
      errEl.style.display = '';
      btn.disabled = false;
      btn.textContent = 'Druckansicht öffnen';
    }
  };
}
