// Boxen & Wartung — Kutu-Register (Seriennummer, Praxis, Version, Lizenz,
// Backup) + Wartungsprotokoll + Runbooks (= Wissensbank-Einträge mit #runbook).
//
// "zuletzt gemeldet" ist in Phase 1 MANUELL. Eine Box steht im Praxisnetz und ist
// von außen nicht erreichbar — Uptime Kuma kann sie nicht anpingen. Später kommt
// der Wert aus merkez (boxes.ip_am: die Box meldet sich signiert, nur ausgehend).
// Diese Synchronisation ist eine onprem-Entscheidung und hier NICHT gebaut.
import { sb, state, $, esc, md, toast, fail, fmtDate, fmtDateTime, openModal, closeModal, goTo } from './app.js?v=20261120a';
import { canWrite, canRead } from './rollen.js?v=20261120a';
import {
  isMissingSchema, setupNotice, options, pill, memberChip, daysUntil, relDays,
  readFields, fld, inp, txt, sel, empty, debounce,
  persistUi,
} from './kit.js?v=20261120a';
import {
  BOX_STATUS, BOX_TONE, BOX_KANAL, WARTUNG_ART, WARTUNG_ERG, WARTUNG_TONE, SCHWELLE,
  TICKET_STATUS, TICKET_TONE, fmtNr,
} from './begriffe.js?v=20261120a';

let openBound = false, ready = Promise.resolve(), root, boxen = [], kunden = [], runbooks = [], missing = false, channel = null;
const [ui, saveUi] = persistUi('ops-boxen-ui', { q: '', status: '', nurProbleme: false });

const kundeName = (id) => kunden.find(k => k.id === id)?.name || '';
const inBetrieb = (b) => ['installiert', 'aktiv', 'wartung', 'defekt'].includes(b.status);

/** Warnungen einer Box — eine Quelle für Tabelle, Kennzahlen und Übersicht. */
export function boxWarnungen(b) {
  const w = [];
  if (!inBetrieb(b)) return w;
  const lz = daysUntil(b.lizenz_bis);
  if (lz !== null && lz < 0) w.push({ k: 'lizenz', tone: 'bad', t: 'Lizenz abgelaufen' });
  else if (lz !== null && lz <= SCHWELLE.lizenz) w.push({ k: 'lizenz', tone: 'warn', t: `Lizenz endet ${relDays(b.lizenz_bis)}` });
  const wt = daysUntil(b.letzte_wartung);
  if (wt === null || -wt > SCHWELLE.wartung) w.push({ k: 'wartung', tone: 'warn', t: wt === null ? 'Nie gewartet' : `Wartung ${relDays(b.letzte_wartung)}` });
  const bk = daysUntil(b.backup_geprueft_am);
  if (bk === null || -bk > SCHWELLE.backup) w.push({ k: 'backup', tone: bk === null ? 'bad' : 'warn', t: bk === null ? 'Backup nie geprüft' : `Backup geprüft ${relDays(b.backup_geprueft_am)}` });
  if (b.status === 'defekt') w.push({ k: 'defekt', tone: 'bad', t: 'Defekt' });
  return w;
}

export function mountBoxen() {
  root = $('#view-boxen');
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Boxen &amp; Wartung</h1><p>Jede ausgelieferte Box: wo sie steht, welche Version, wann zuletzt gewartet und gesichert.</p></div>
      <div class="spacer"></div>
      <div class="page-actions">${canWrite('boxen') ? '<button class="btn btn-primary" id="bNew">+ Box</button>' : ''}</div>
    </div>
    <div id="bNotice"></div>
    <div class="stats" id="bStats"></div>
    <div class="filters">
      <input type="search" id="bQ" placeholder="Suchen: Seriennummer, Praxis, Version …" value="${esc(ui.q)}">
      <select id="bStatus">${options(BOX_STATUS, ui.status, { empty: 'Alle Status' })}</select>
      <label class="chk-inline"><input type="checkbox" id="bProb" ${ui.nurProbleme ? 'checked' : ''}><span>Nur mit Handlungsbedarf</span></label>
    </div>
    <div id="bBody"></div>
    <div class="grid-2" style="margin-top:18px">
      <div class="panel" id="bRunbooks"></div>
      <div class="panel">
        <div class="panel-head"><h2>Überwachung bei Boxen</h2></div>
        <p class="card-body" style="margin:0">Eine Box steht im Netz der Praxis und ist von außen nicht erreichbar —
        Uptime Kuma kann sie nicht anpingen. Die Box muss sich selbst melden (nur ausgehend).
        Bis die Meldung aus <code>merkez</code> hier ankommt, wird „zuletzt gemeldet" von Hand gepflegt.</p>
      </div>
    </div>`;

  root.querySelector('#bNew')?.addEventListener('click', () => editBox(null));
  root.querySelector('#bQ').addEventListener('input', debounce((e) => { ui.q = e.target.value; saveUi(); render(); }));
  root.querySelector('#bStatus').addEventListener('change', (e) => { ui.status = e.target.value; saveUi(); render(); });
  root.querySelector('#bProb').addEventListener('change', (e) => { ui.nurProbleme = e.target.checked; saveUi(); render(); });
  root.onclick = (e) => {
    const r = e.target.closest('[data-box]'); if (r) openBox(r.dataset.box);
    const rb = e.target.closest('[data-runbook]'); if (rb) openRunbook(rb.dataset.runbook);
  };
  if (!openBound) { openBound = true; window.addEventListener('ops:open', async (e) => {
    if (e.detail?.view !== 'boxen') return;
    await ready;
    if (e.detail.wartung) editWartung(e.detail.id, { ticket_id: e.detail.ticket_id });
    else if (e.detail.id) openBox(e.detail.id);
  }); }

  ready = load();
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('ops_boxen_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_boxen' }, () => load())
    .subscribe();
}

async function load() {
  const [b, k, r] = await Promise.all([
    sb.from('ops_boxen').select('*').order('seriennummer'),
    canRead('kunden') ? sb.from('ops_kunden').select('id,name').order('name') : { data: [] },
    canRead('wissen') ? sb.from('ops_wissen').select('id,title,body,tags,updated_at').contains('tags', ['runbook']).order('title') : { data: [] },
  ]);
  if (b.error) {
    if (isMissingSchema(b.error)) { missing = true; $('#bNotice').innerHTML = setupNotice(); $('#bBody').innerHTML = ''; return; }
    return fail('Boxen laden', b.error);
  }
  missing = false; $('#bNotice').innerHTML = '';
  boxen = b.data || []; kunden = k.data || []; runbooks = r.data || [];
  render();
}

function render() {
  if (missing) return;
  const betrieb = boxen.filter(inBetrieb);
  const count = (key) => betrieb.filter(b => boxWarnungen(b).some(w => w.k === key)).length;
  $('#bStats').innerHTML = `
    <div class="stat is-ok"><span class="stat-label">In Betrieb</span><span class="stat-value">${betrieb.length}</span><span class="stat-sub">${boxen.filter(b => ['lager', 'vorbereitet'].includes(b.status)).length} im Lager / vorbereitet</span></div>
    <div class="stat ${count('lizenz') ? 'is-warn' : ''}"><span class="stat-label">Lizenz endet ≤ ${SCHWELLE.lizenz} T.</span><span class="stat-value">${count('lizenz')}</span><span class="stat-sub">Verlängerung ansprechen</span></div>
    <div class="stat ${count('backup') ? 'is-bad' : ''}"><span class="stat-label">Backup nicht geprüft</span><span class="stat-value">${count('backup')}</span><span class="stat-sub">älter als ${SCHWELLE.backup} Tage</span></div>
    <div class="stat ${count('wartung') ? 'is-warn' : ''}"><span class="stat-label">Wartung fällig</span><span class="stat-value">${count('wartung')}</span><span class="stat-sub">über ${SCHWELLE.wartung} Tage her</span></div>
    <div class="stat ${count('defekt') ? 'is-bad' : ''}"><span class="stat-label">Defekt</span><span class="stat-value">${count('defekt')}</span><span class="stat-sub">${betrieb.filter(b => b.status === 'wartung').length} in Wartung</span></div>`;

  const q = ui.q.trim().toLowerCase();
  const list = boxen.filter(b =>
    (!ui.status || b.status === ui.status) &&
    (!ui.nurProbleme || boxWarnungen(b).length) &&
    (!q || [b.seriennummer, b.merkez_name, b.version, kundeName(b.kunde_id), b.hardware].some(v => String(v || '').toLowerCase().includes(q))));

  $('#bBody').innerHTML = !boxen.length
    ? `<div class="panel">${empty('Noch keine Box erfasst. Jede ausgelieferte oder vorbereitete Box hier eintragen.')}</div>`
    : !list.length ? `<div class="panel">${empty('Keine Box für diesen Filter.')}</div>`
    : `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Box</th><th>Praxis</th><th>Status</th><th>Version</th><th>Lizenz bis</th><th>Letzte Wartung</th><th>Backup geprüft</th><th>Zuletzt gemeldet</th><th>Hinweise</th></tr></thead>
      <tbody>${list.map(b => {
        const w = boxWarnungen(b);
        return `<tr data-box="${b.id}">
          <td><span class="strong">${esc(b.seriennummer)}</span><span class="sub">${esc(b.merkez_name || '')}</span></td>
          <td>${esc(kundeName(b.kunde_id) || '—')}</td>
          <td>${pill(BOX_STATUS[b.status], BOX_TONE[b.status])}</td>
          <td>${esc(b.version || '—')} <span class="sub">${esc(b.kanal)}</span></td>
          <td>${b.lizenz_bis ? fmtDate(b.lizenz_bis) : '—'}</td>
          <td>${b.letzte_wartung ? fmtDate(b.letzte_wartung) : '—'}</td>
          <td>${b.backup_geprueft_am ? fmtDate(b.backup_geprueft_am) : '—'}</td>
          <td>${b.zuletzt_gemeldet ? fmtDateTime(b.zuletzt_gemeldet) : '<span class="hint">—</span>'}</td>
          <td>${w.map(x => pill(x.t, x.tone)).join(' ') || pill('ok', 'ok')}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;

  $('#bRunbooks').innerHTML = `<div class="panel-head"><h2>Runbooks</h2><div class="spacer"></div>
      <span class="hint">Wissensbank-Einträge mit Tag <code>runbook</code></span></div>
    <div class="list">${runbooks.map(r => `<button class="list-row" data-runbook="${r.id}">
      <div class="list-main"><div class="list-title">${esc(r.title)}</div><div class="list-sub">aktualisiert ${fmtDate(r.updated_at)}</div></div>
      <span class="list-end">öffnen</span></button>`).join('') || empty('Noch kein Runbook. In der Wissensbank einen Eintrag mit Tag „runbook" anlegen (z. B. „Box neu starten", „Backup prüfen", „Update einspielen").')}</div>`;
}

function openRunbook(id) {
  const r = runbooks.find(x => x.id === id); if (!r) return;
  openModal({ title: r.title, wide: true, bodyHTML: `<div class="card-body">${md(r.body)}</div>`,
    actions: [{ label: 'Schließen', onClick: () => true }] });
}

// ── Formulare ──────────────────────────────────────────────────────────

const kundeOpts = (sel_) => `<option value="">— keine —</option>` + kunden.map(k =>
  `<option value="${k.id}" ${sel_ === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('');

function editBox(b) {
  const x = b || {};
  const toLocal = (d) => { if (!d) return ''; const t = new Date(d); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 16); };
  openModal({
    title: b ? `${b.seriennummer} bearbeiten` : 'Neue Box',
    wide: true,
    bodyHTML: `<div class="form-grid">
      ${fld('Seriennummer *', inp('seriennummer', x.seriennummer, 'required placeholder="z. B. PX-2026-001"'))}
      ${fld('Name in merkez', inp('merkez_name', x.merkez_name, 'placeholder="z. B. sonne-tal-42 (aus der Einrichtung)"'))}
      ${canRead('kunden') ? fld('Praxis', sel('kunde_id', kundeOpts(x.kunde_id))) : ''}
      ${fld('Status', sel('status', options(BOX_STATUS, x.status || 'lager')))}
      ${fld('Kanal', sel('kanal', options(BOX_KANAL, x.kanal || 'stable')))}
      ${fld('Version', inp('version', x.version, 'placeholder="Image-Version"'))}
      ${fld('Hardware', inp('hardware', x.hardware, 'placeholder="Modell, RAM, Platte"'))}
      ${fld('Standort in der Praxis', inp('standort', x.standort, 'placeholder="z. B. Empfang, Serverschrank"'))}
      ${fld('Installiert am', inp('installiert_am', x.installiert_am, 'type="date"'))}
      ${fld('Lizenz bis', inp('lizenz_bis', x.lizenz_bis, 'type="date"'))}
      ${fld('Zuletzt gemeldet (manuell)', `<input data-f="zuletzt_gemeldet" type="datetime-local" value="${toLocal(x.zuletzt_gemeldet)}">`)}
      ${fld('Fernzugang', inp('fernzugang', x.fernzugang, 'placeholder="Werkzeug + ID — KEIN Passwort"'))}
      ${fld('Notizen', txt('notizen', x.notizen, 'rows="3"'), 'span-2')}
    </div>
    <p class="hint" style="margin:0">⛔ Keine Passwörter oder Schlüssel hier eintragen — die gehören in den Passwort-Tresor.</p>`,
    actions: [
      { label: 'Abbrechen', onClick: () => { if (b) setTimeout(() => openBox(b.id), 0); return true; } },
      { label: 'Speichern', kind: 'primary', onClick: async () => {
        const v = readFields($('#modalBody'));
        if (!v.seriennummer) { toast('Seriennummer fehlt', true); return false; }
        v.notizen = v.notizen ?? '';
        v.zuletzt_gemeldet = v.zuletzt_gemeldet ? new Date(v.zuletzt_gemeldet).toISOString() : null;
        const q = b
          ? sb.from('ops_boxen').update(v).eq('id', b.id).select().single()
          : sb.from('ops_boxen').insert({ ...v, created_by: state.me.id }).select().single();
        const { data, error } = await q;
        if (error) { fail('Box speichern', error); return false; }
        toast('Gespeichert'); await load();
        setTimeout(() => openBox(data.id), 0);
        return true;
      } },
    ],
  });
}

function editWartung(boxId, preset = {}) {
  const b = boxen.find(x => x.id === boxId);
  if (!b) return toast('Box nicht gefunden', true);
  const rbOpts = `<option value="">— keins —</option>` + runbooks.map(r => `<option value="${r.id}">${esc(r.title)}</option>`).join('');
  openModal({
    title: `Wartung · ${b.seriennummer}`,
    bodyHTML: `<div class="form-grid">
      ${fld('Datum', inp('datum', new Date().toISOString().slice(0, 10), 'type="date"'))}
      ${fld('Art', sel('art', options(WARTUNG_ART, 'fernwartung')))}
      ${fld('Ergebnis', sel('ergebnis', options(WARTUNG_ERG, 'erledigt')))}
      ${fld('Dauer (Minuten)', inp('dauer_min', '', 'type="number" min="0" data-num'))}
      ${fld('Nach Runbook', sel('runbook_id', rbOpts), 'span-2')}
      ${fld('Was wurde gemacht?', txt('beschreibung', '', 'rows="4" placeholder="Schritte, Befund, offene Punkte — keine Patientendaten"'), 'span-2')}
    </div>
    <input type="hidden" data-f="ticket_id" value="${esc(preset.ticket_id || '')}">`,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      { label: 'Speichern', kind: 'primary', onClick: async () => {
        const v = readFields($('#modalBody'));
        v.beschreibung = v.beschreibung ?? '';
        if (!v.datum) delete v.datum;
        const { error } = await sb.from('ops_wartung').insert({ ...v, box_id: b.id, durchgefuehrt_von: state.me.id });
        if (error) { fail('Wartung speichern', error); return false; }
        if (v.ticket_id) {
          await sb.from('ops_ticket_eintraege').insert({
            ticket_id: v.ticket_id, art: 'notiz', created_by: state.me.id,
            text: `Wartung protokolliert: ${WARTUNG_ART[v.art]} — ${WARTUNG_ERG[v.ergebnis]}${v.beschreibung ? '\n' + v.beschreibung : ''}` });
        }
        toast('Wartung protokolliert'); await load();
        setTimeout(() => openBox(b.id), 0);
        return true;
      } },
    ],
  });
}

// ── Detail ─────────────────────────────────────────────────────────────

async function openBox(id) {
  const b = boxen.find(x => x.id === id);
  if (!b) return toast('Box nicht gefunden', true);
  const [w, t] = await Promise.all([
    canRead('wartung') ? sb.from('ops_wartung').select('*').eq('box_id', id).order('datum', { ascending: false }).limit(100) : { data: [] },
    canRead('tickets') ? sb.from('ops_tickets').select('id,nr,titel,status,created_at').eq('box_id', id).order('created_at', { ascending: false }).limit(20) : { data: [] },
  ]);
  const warn = boxWarnungen(b);
  const log = (w.data || []).map(x => `<div class="tl-item"><span class="dot" style="background:${x.ergebnis === 'erledigt' ? 'var(--green)' : x.ergebnis === 'teilweise' ? 'var(--amber)' : 'var(--red)'}"></span><div>
    <div class="meta">${fmtDate(x.datum)} · ${esc(WARTUNG_ART[x.art])} · ${esc(WARTUNG_ERG[x.ergebnis])}${x.dauer_min ? ' · ' + x.dauer_min + ' min' : ''} · ${esc(state.members.find(m => m.id === x.durchgefuehrt_von)?.display_name || '')}</div>
    <div class="body">${esc(x.beschreibung)}</div></div></div>`).join('');
  const tix = (t.data || []).map(x => `<button class="list-row" data-goto-ticket="${x.id}">
    <div class="list-main"><div class="list-title">${fmtNr('T', x.nr)} ${esc(x.titel)}</div><div class="list-sub">${fmtDate(x.created_at)}</div></div>
    ${pill(TICKET_STATUS[x.status], TICKET_TONE[x.status])}</button>`).join('');

  openModal({
    title: `Box ${b.seriennummer}`,
    wide: true,
    bodyHTML: `
      ${warn.length ? `<div>${warn.map(x => pill(x.t, x.tone)).join(' ')}</div>` : ''}
      <div class="detail">
        <div>
          <dl class="kv">
            <dt>Status</dt><dd>${pill(BOX_STATUS[b.status], BOX_TONE[b.status])}</dd>
            <dt>Name in merkez</dt><dd>${esc(b.merkez_name || '—')}</dd>
            <dt>Praxis</dt><dd>${b.kunde_id && canRead('kunden') ? `<a href="#" data-goto-kunde>${esc(kundeName(b.kunde_id))}</a>` : '—'}</dd>
            <dt>Version / Kanal</dt><dd>${esc(b.version || '—')} · ${esc(b.kanal)}</dd>
            <dt>Hardware</dt><dd>${esc(b.hardware || '—')}</dd>
            <dt>Standort</dt><dd>${esc(b.standort || '—')}</dd>
            <dt>Installiert</dt><dd>${b.installiert_am ? fmtDate(b.installiert_am) : '—'}</dd>
            <dt>Lizenz bis</dt><dd>${b.lizenz_bis ? fmtDate(b.lizenz_bis) + ' · ' + relDays(b.lizenz_bis) : '—'}</dd>
            <dt>Letzte Wartung</dt><dd>${b.letzte_wartung ? fmtDate(b.letzte_wartung) : '—'}</dd>
            <dt>Backup geprüft</dt><dd>${b.backup_geprueft_am ? fmtDate(b.backup_geprueft_am) : '—'}</dd>
            <dt>Zuletzt gemeldet</dt><dd>${b.zuletzt_gemeldet ? fmtDateTime(b.zuletzt_gemeldet) : '—'} <span class="hint">(manuell)</span></dd>
            <dt>Fernzugang</dt><dd>${esc(b.fernzugang || '—')}</dd>
          </dl>
          ${b.notizen ? `<div class="card-body" style="white-space:pre-wrap;margin-top:12px">${esc(b.notizen)}</div>` : ''}
        </div>
        <div class="detail-side">
          ${canRead('wartung') ? `<div class="section-t">Wartungsprotokoll</div><div class="timeline-mini">${log || empty('Noch keine Wartung protokolliert.')}</div>` : ''}
          ${canRead('tickets') ? `<div class="section-t">Tickets zu dieser Box</div><div class="list">${tix || empty('Keine Tickets.')}</div>` : ''}
        </div>
      </div>`,
    actions: [
      { label: 'Schließen', onClick: () => true },
      ...(canWrite('tickets') ? [{ label: 'Ticket anlegen', onClick: () => { setTimeout(() => goTo('support', { neu: true, box_id: b.id, kunde_id: b.kunde_id }), 0); return true; } }] : []),
      ...(canWrite('wartung') ? [{ label: 'Wartung erfassen', onClick: () => { setTimeout(() => editWartung(b.id), 0); return true; } }] : []),
      ...(canWrite('boxen') ? [{ label: 'Bearbeiten', kind: 'primary', onClick: () => { setTimeout(() => editBox(b), 0); return true; } }] : []),
    ],
    onOpen: (body) => {
      body.querySelector('[data-goto-kunde]')?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); goTo('kunden', { id: b.kunde_id }); });
      body.querySelectorAll('[data-goto-ticket]').forEach(x => x.addEventListener('click', () => { closeModal(); goTo('support', { id: x.dataset.gotoTicket }); }));
    },
  });
}
