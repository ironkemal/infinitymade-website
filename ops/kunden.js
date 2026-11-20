// Kunden & Vertrieb — Praxen, Pipeline, Aktivitäten, Angebote.
// Kunde = Praxis (B2B). ⛔ Keine Patientendaten. Angebote/Rechnungen selbst
// entstehen im Buchhaltungsprogramm; hier stehen nur Status, Nummer und Link.
import { sb, state, $, esc, toast, fail, fmtDate, fmtDateTime, openModal, closeModal, goTo } from './app.js?v=20261120a';
import { canWrite, canRead } from './rollen.js?v=20261120a';
import {
  isMissingSchema, setupNotice, options, memberOptions, pill, memberChip, daysUntil, relDays,
  readFields, fld, inp, txt, sel, empty, debounce,
  persistUi,
} from './kit.js?v=20261120a';
import {
  STAGES, FUNNEL, STAGE_TONE, FACH, QUELLE, DOK_STATUS, DOK_TONE, AKT_ART, ANGEBOT_STATUS, ANGEBOT_TONE,
  TICKET_STATUS, TICKET_TONE, OPEN_STATUS, BOX_STATUS, BOX_TONE, fmtNr,
} from './begriffe.js?v=20261120a';

let openBound = false, ready = Promise.resolve(), root, kunden = [], missing = false, channel = null;
const [ui, saveUi] = persistUi('ops-kunden-ui', { mode: 'pipeline', q: '', fach: '', owner: '', inaktiv: false });

export function mountKunden() {
  root = $('#view-kunden');
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Kunden &amp; Vertrieb</h1><p>Praxen von Lead bis Live — wer ist wo, was ist der nächste Schritt.</p></div>
      <div class="spacer"></div>
      <div class="page-actions">
        ${canWrite('kunden') ? '<button class="btn btn-primary" id="kNew">+ Praxis</button>' : ''}
      </div>
    </div>
    <div id="kNotice"></div>
    <div class="stats" id="kStats"></div>
    <div class="filters">
      <div class="seg" id="kMode">
        <button data-m="pipeline">Pipeline</button><button data-m="liste">Liste</button>
      </div>
      <input type="search" id="kQ" placeholder="Suchen: Praxis, Ort, Ansprechpartner …" value="${esc(ui.q)}">
      <select id="kFach">${options(FACH, ui.fach, { empty: 'Alle Fachbereiche' })}</select>
      <select id="kOwner">${memberOptions(ui.owner, { empty: 'Alle Verantwortlichen' })}</select>
      <label class="chk-inline"><input type="checkbox" id="kInaktiv" ${ui.inaktiv ? 'checked' : ''}><span>Pausiert/verloren zeigen</span></label>
    </div>
    <div id="kBody"></div>`;

  root.querySelector('#kNew')?.addEventListener('click', () => editKunde(null));
  root.querySelector('#kMode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    ui.mode = b.dataset.m; saveUi(); render();
  });
  root.querySelector('#kQ').addEventListener('input', debounce((e) => { ui.q = e.target.value; saveUi(); render(); }));
  root.querySelector('#kFach').addEventListener('change', (e) => { ui.fach = e.target.value; saveUi(); render(); });
  root.querySelector('#kOwner').addEventListener('change', (e) => { ui.owner = e.target.value; saveUi(); render(); });
  root.querySelector('#kInaktiv').addEventListener('change', (e) => { ui.inaktiv = e.target.checked; saveUi(); render(); });
  root.onclick = (e) => {
    const c = e.target.closest('[data-kunde]');
    if (c) openKunde(c.dataset.kunde);
  };

  if (!openBound) { openBound = true; window.addEventListener('ops:open', async (e) => {
    if (e.detail?.view !== 'kunden') return;
    await ready;
    if (e.detail.id) openKunde(e.detail.id);
    else if (e.detail.neu) editKunde(null);
  }); }

  ready = load();
  subscribe();
}

async function load() {
  const { data, error } = await sb.from('ops_kunden').select('*').order('updated_at', { ascending: false });
  if (error) {
    if (isMissingSchema(error)) { missing = true; $('#kNotice').innerHTML = setupNotice(); $('#kBody').innerHTML = ''; return; }
    return fail('Kunden laden', error);
  }
  missing = false; $('#kNotice').innerHTML = '';
  kunden = data || [];
  render();
}

function subscribe() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('ops_kunden_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_kunden' }, () => load())
    .subscribe();
}

function filtered() {
  const q = ui.q.trim().toLowerCase();
  return kunden.filter(k =>
    (ui.inaktiv || !['pausiert', 'verloren'].includes(k.stage)) &&
    (!ui.fach || k.fachbereich === ui.fach) &&
    (!ui.owner || k.owner === ui.owner) &&
    (!q || [k.name, k.stadt, k.plz, k.ansprechpartner, k.email, k.notizen, fmtNr('K', k.nr)]
      .some(v => String(v || '').toLowerCase().includes(q))));
}

function renderStats() {
  const active = kunden.filter(k => FUNNEL.includes(k.stage) && k.stage !== 'live');
  const due = kunden.filter(k => k.naechster_termin && daysUntil(k.naechster_termin) <= 0 && !['live', 'verloren'].includes(k.stage));
  const noStep = active.filter(k => !k.naechster_schritt && !k.naechster_termin);
  const live = kunden.filter(k => k.stage === 'live').length;
  const offen = kunden.filter(k => ['angebot', 'vertrag'].includes(k.stage)).length;
  $('#kStats').innerHTML = `
    <div class="stat"><span class="stat-label">Aktive Pipeline</span><span class="stat-value">${active.length}</span><span class="stat-sub">Lead bis Installation</span></div>
    <div class="stat ${offen ? 'is-warn' : ''}"><span class="stat-label">Angebot / Vertrag offen</span><span class="stat-value">${offen}</span><span class="stat-sub">kurz vor Abschluss</span></div>
    <div class="stat ${due.length ? 'is-bad' : ''}"><span class="stat-label">Nächster Schritt fällig</span><span class="stat-value">${due.length}</span><span class="stat-sub">heute oder überfällig</span></div>
    <div class="stat ${noStep.length ? 'is-warn' : ''}"><span class="stat-label">Ohne nächsten Schritt</span><span class="stat-value">${noStep.length}</span><span class="stat-sub">Leads, die liegen bleiben</span></div>
    <div class="stat is-ok"><span class="stat-label">Live-Praxen</span><span class="stat-value">${live}</span><span class="stat-sub">Box in Betrieb</span></div>`;
}

function terminTag(k) {
  if (!k.naechster_termin) return '';
  const n = daysUntil(k.naechster_termin);
  const tone = n < 0 ? 'bad' : n === 0 ? 'warn' : 'mute';
  return pill(`${fmtDate(k.naechster_termin)} · ${relDays(k.naechster_termin)}`, tone);
}

function render() {
  if (missing) return;
  renderStats();
  root.querySelectorAll('#kMode button').forEach(b => b.classList.toggle('is-on', b.dataset.m === ui.mode));
  const list = filtered();
  const body = $('#kBody');
  if (!kunden.length) {
    body.innerHTML = `<div class="panel">${empty('Noch keine Praxis erfasst. Leads aus Demo-Formular, Website oder Empfehlung hier anlegen.')}</div>`;
    return;
  }
  if (ui.mode === 'liste') { body.innerHTML = tableHTML(list); return; }

  const cols = [...FUNNEL, ...(ui.inaktiv ? ['pausiert', 'verloren'] : [])];
  body.innerHTML = `<div class="pipe">${cols.map(st => {
    const items = list.filter(k => k.stage === st)
      .sort((a, b) => (a.naechster_termin || '9999').localeCompare(b.naechster_termin || '9999'));
    return `<div class="pipe-col">
      <h3>${pill(STAGES[st], STAGE_TONE[st])}<span class="n">${items.length}</span></h3>
      ${items.map(cardHTML).join('') || '<p class="empty" style="padding:4px 2px">—</p>'}
    </div>`;
  }).join('')}</div>`;
}

function cardHTML(k) {
  return `<button class="pipe-card" data-kunde="${k.id}">
    <span class="t">${esc(k.name)}</span>
    <span class="m">${esc(FACH[k.fachbereich] || '')}${k.stadt ? ' · ' + esc(k.stadt) : ''}</span>
    ${k.naechster_schritt ? `<span class="m">→ ${esc(k.naechster_schritt)}</span>` : ''}
    <span class="m">${terminTag(k)} ${k.owner ? memberChip(k.owner) : ''}</span>
  </button>`;
}

function tableHTML(list) {
  if (!list.length) return `<div class="panel">${empty('Keine Treffer für diesen Filter.')}</div>`;
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Nr.</th><th>Praxis</th><th>Fachbereich</th><th>Phase</th><th>Nächster Schritt</th><th>Termin</th><th>Vertrag / AVV</th><th>Verantwortlich</th></tr></thead>
    <tbody>${list.map(k => `<tr data-kunde="${k.id}">
      <td class="num">${fmtNr('K', k.nr)}</td>
      <td><span class="strong">${esc(k.name)}</span><span class="sub">${esc([k.plz, k.stadt].filter(Boolean).join(' '))}</span></td>
      <td>${esc(FACH[k.fachbereich] || '')}</td>
      <td>${pill(STAGES[k.stage], STAGE_TONE[k.stage])}</td>
      <td>${esc(k.naechster_schritt || '')}</td>
      <td>${terminTag(k)}</td>
      <td>${pill(DOK_STATUS[k.vertrag_status], DOK_TONE[k.vertrag_status])} ${pill('AVV ' + DOK_STATUS[k.avv_status], DOK_TONE[k.avv_status])}</td>
      <td>${memberChip(k.owner)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

// ── Formular ───────────────────────────────────────────────────────────

function formHTML(k = {}) {
  return `<div class="form-grid">
    ${fld('Praxisname *', inp('name', k.name, 'required'), 'span-2')}
    ${fld('Fachbereich', sel('fachbereich', options(FACH, k.fachbereich || 'podologie')))}
    ${fld('Phase', sel('stage', options(STAGES, k.stage || 'lead')))}
    ${fld('Quelle', sel('quelle', options(QUELLE, k.quelle, { empty: '—' })))}
    ${fld('Verantwortlich', sel('owner', memberOptions(k.owner ?? state.me.id)))}
    ${fld('Ansprechpartner', inp('ansprechpartner', k.ansprechpartner))}
    ${fld('Telefon', inp('telefon', k.telefon, 'type="tel"'))}
    ${fld('E-Mail', inp('email', k.email, 'type="email"'))}
    ${fld('Website', inp('website', k.website, 'type="url" placeholder="https://"'))}
    ${fld('Adresse', inp('adresse', k.adresse), 'span-2')}
    ${fld('PLZ', inp('plz', k.plz, 'inputmode="numeric"'))}
    ${fld('Ort', inp('stadt', k.stadt))}
    ${fld('Standorte', inp('standorte', k.standorte, 'type="number" min="1" data-num'))}
    ${fld('Mitarbeitende', inp('mitarbeitende', k.mitarbeitende, 'type="number" min="1" data-num'))}
    ${fld('Nächster Schritt', inp('naechster_schritt', k.naechster_schritt, 'placeholder="z. B. Demo-Termin bestätigen"'))}
    ${fld('Fällig am', inp('naechster_termin', k.naechster_termin, 'type="date"'))}
    ${fld('Vertrag', sel('vertrag_status', options(DOK_STATUS, k.vertrag_status || 'offen')))}
    ${fld('AVV (Art. 28 DSGVO)', sel('avv_status', options(DOK_STATUS, k.avv_status || 'offen')))}
    ${fld('Grund (bei verloren)', inp('verloren_grund', k.verloren_grund), 'span-2')}
    ${fld('Notizen', txt('notizen', k.notizen, 'rows="4"'), 'span-2')}
  </div>
  <p class="hint" style="margin:0">⛔ Keine Patientendaten. Hier stehen nur Praxis- und Kontaktdaten.</p>`;
}

function editKunde(k) {
  openModal({
    title: k ? `${k.name} bearbeiten` : 'Neue Praxis',
    bodyHTML: formHTML(k || {}),
    wide: true,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      { label: 'Speichern', kind: 'primary', onClick: async () => {
        const v = readFields($('#modalBody'));
        if (!v.name) { toast('Praxisname fehlt', true); return false; }
        v.notizen = v.notizen ?? '';
        const q = k
          ? sb.from('ops_kunden').update(v).eq('id', k.id).select().single()
          : sb.from('ops_kunden').insert({ ...v, created_by: state.me.id }).select().single();
        const { data, error } = await q;
        if (error) { fail('Speichern', error); return false; }
        toast('Gespeichert');
        await load();
        setTimeout(() => openKunde(data.id), 0);
        return true;
      } },
    ],
  });
}

// ── Detail ─────────────────────────────────────────────────────────────

async function openKunde(id) {
  let k = kunden.find(x => x.id === id);
  if (!k) {
    const { data } = await sb.from('ops_kunden').select('*').eq('id', id).maybeSingle();
    if (!data) return toast('Praxis nicht gefunden', true);
    k = data;
  }
  const mayWrite = canWrite('kunden');
  const showSales = canRead('vertrieb');

  const [akt, ang, box, tix] = await Promise.all([
    showSales ? sb.from('ops_kunden_aktivitaeten').select('*').eq('kunde_id', id).order('am', { ascending: false }).limit(100) : { data: [] },
    showSales ? sb.from('ops_angebote').select('*').eq('kunde_id', id).order('datum', { ascending: false }) : { data: [] },
    canRead('boxen') ? sb.from('ops_boxen').select('id,seriennummer,status,version,lizenz_bis').eq('kunde_id', id) : { data: [] },
    canRead('tickets') ? sb.from('ops_tickets').select('id,nr,titel,status,prioritaet,created_at').eq('kunde_id', id).order('created_at', { ascending: false }).limit(20) : { data: [] },
  ]);

  const stageBar = `<div class="stages">${[...FUNNEL, 'pausiert', 'verloren'].map((s) => {
    const past = FUNNEL.indexOf(s) >= 0 && FUNNEL.indexOf(s) < FUNNEL.indexOf(k.stage);
    return `<button data-stage="${s}" class="${s === k.stage ? 'is-on' : past ? 'is-past' : ''}" ${mayWrite ? '' : 'disabled'}>${STAGES[s]}</button>`;
  }).join('')}</div>`;

  const info = `<dl class="kv">
    <dt>Nr.</dt><dd>${fmtNr('K', k.nr)}</dd>
    <dt>Fachbereich</dt><dd>${esc(FACH[k.fachbereich] || '')}${k.fachbereich !== 'podologie' ? ' <span class="hint">(Vertikal-Regel: erst Podologie fertig)</span>' : ''}</dd>
    <dt>Ansprechpartner</dt><dd>${esc(k.ansprechpartner || '—')}</dd>
    <dt>Telefon</dt><dd>${k.telefon ? `<a href="tel:${esc(k.telefon)}">${esc(k.telefon)}</a>` : '—'}</dd>
    <dt>E-Mail</dt><dd>${k.email ? `<a href="mailto:${esc(k.email)}">${esc(k.email)}</a>` : '—'}</dd>
    <dt>Website</dt><dd>${k.website ? `<a href="${esc(k.website)}" target="_blank" rel="noopener">${esc(k.website)}</a>` : '—'}</dd>
    <dt>Adresse</dt><dd>${esc([k.adresse, [k.plz, k.stadt].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—')}</dd>
    <dt>Größe</dt><dd>${k.standorte ? esc(k.standorte) + ' Standort(e)' : '—'}${k.mitarbeitende ? ' · ' + esc(k.mitarbeitende) + ' Mitarbeitende' : ''}</dd>
    <dt>Quelle</dt><dd>${esc(QUELLE[k.quelle] || '—')}</dd>
    <dt>Verantwortlich</dt><dd>${memberChip(k.owner)}</dd>
    <dt>Nächster Schritt</dt><dd>${esc(k.naechster_schritt || '—')} ${terminTag(k)}</dd>
    <dt>Vertrag / AVV</dt><dd>${pill(DOK_STATUS[k.vertrag_status], DOK_TONE[k.vertrag_status])} ${pill('AVV ' + DOK_STATUS[k.avv_status], DOK_TONE[k.avv_status])}</dd>
    ${k.stage === 'verloren' ? `<dt>Verloren weil</dt><dd>${esc(k.verloren_grund || '—')}</dd>` : ''}
  </dl>
  ${k.notizen ? `<div class="card-body" style="white-space:pre-wrap">${esc(k.notizen)}</div>` : ''}`;

  const boxes = (box.data || []).map(b => `<button class="list-row" data-goto-box="${b.id}">
      <div class="list-main"><div class="list-title">${esc(b.seriennummer)}</div><div class="list-sub">${esc(b.version || 'Version ?')}${b.lizenz_bis ? ' · Lizenz bis ' + fmtDate(b.lizenz_bis) : ''}</div></div>
      ${pill(BOX_STATUS[b.status], BOX_TONE[b.status])}</button>`).join('');
  const tickets = (tix.data || []).map(t => `<button class="list-row" data-goto-ticket="${t.id}">
      <div class="list-main"><div class="list-title">${fmtNr('T', t.nr)} ${esc(t.titel)}</div><div class="list-sub">${fmtDate(t.created_at)}</div></div>
      ${pill(TICKET_STATUS[t.status], TICKET_TONE[t.status])}</button>`).join('');
  const openTix = (tix.data || []).filter(t => OPEN_STATUS.includes(t.status)).length;

  const angebote = (ang.data || []).map(a => `<div class="list-row">
      <div class="list-main"><div class="list-title">${esc(a.nummer || 'ohne Nr.')} · ${fmtDate(a.datum)}</div>
      <div class="list-sub">${esc(a.leistungen || '')}${a.gueltig_bis ? ' · gültig bis ' + fmtDate(a.gueltig_bis) : ''}</div></div>
      ${a.link ? `<a class="btn btn-ghost" href="${esc(a.link)}" target="_blank" rel="noopener">Öffnen ↗</a>` : ''}
      ${mayWrite ? `<select data-ang-status="${a.id}">${options(ANGEBOT_STATUS, a.status)}</select>` : pill(ANGEBOT_STATUS[a.status], ANGEBOT_TONE[a.status])}
    </div>`).join('');

  const timeline = (akt.data || []).map(a => `<div class="tl-item"><span class="dot"></span><div>
      <div class="meta">${esc(AKT_ART[a.art] || a.art)} · ${fmtDateTime(a.am)} · ${esc(state.members.find(m => m.id === a.created_by)?.display_name || '')}</div>
      <div class="body">${esc(a.text)}</div></div></div>`).join('');

  openModal({
    title: `${k.name}`,
    wide: true,
    bodyHTML: `
      ${stageBar}
      <div class="detail">
        <div>${info}</div>
        <div class="detail-side">
          ${showSales ? `
          <div class="section-t">Verlauf</div>
          ${mayWrite ? `<div class="tl-add">
            <select id="aArt">${options(Object.fromEntries(Object.entries(AKT_ART).filter(([v]) => v !== 'stage')), 'notiz')}</select>
            <textarea id="aText" placeholder="Anruf, Mail, Ergebnis der Demo …"></textarea>
            <button class="btn" id="aAdd">+</button></div>` : ''}
          <div class="timeline-mini">${timeline || empty('Noch kein Eintrag.')}</div>
          <div class="section-t">Angebote</div>
          <div class="list">${angebote || empty('Kein Angebot.')}</div>
          ${mayWrite ? '<button class="btn btn-ghost" id="angNew">+ Angebot erfassen</button>' : ''}` : ''}
          ${canRead('boxen') ? `<div class="section-t">Boxen</div><div class="list">${boxes || empty('Keine Box zugeordnet.')}</div>` : ''}
          ${canRead('tickets') ? `<div class="section-t">Tickets ${openTix ? pill(openTix + ' offen', 'warn') : ''}</div>
            <div class="list">${tickets || empty('Keine Tickets.')}</div>
            ${canWrite('tickets') ? '<button class="btn btn-ghost" id="tixNew">+ Ticket für diese Praxis</button>' : ''}` : ''}
        </div>
      </div>`,
    actions: [
      { label: 'Schließen', onClick: () => true },
      ...(mayWrite ? [{ label: 'Bearbeiten', kind: 'primary', onClick: () => { setTimeout(() => editKunde(k), 0); return true; } }] : []),
    ],
    onOpen: (body) => {
      body.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', async () => {
        if (!mayWrite || b.dataset.stage === k.stage) return;
        const { error } = await sb.from('ops_kunden').update({ stage: b.dataset.stage }).eq('id', k.id);
        if (error) return fail('Phase', error);
        toast(`Phase: ${STAGES[b.dataset.stage]}`);
        await load(); openKunde(k.id);
      }));
      body.querySelector('#aAdd')?.addEventListener('click', async () => {
        const text = body.querySelector('#aText').value.trim();
        if (!text) return;
        const { error } = await sb.from('ops_kunden_aktivitaeten').insert({
          kunde_id: k.id, art: body.querySelector('#aArt').value, text, created_by: state.me.id });
        if (error) return fail('Eintrag', error);
        openKunde(k.id);
      });
      body.querySelectorAll('[data-ang-status]').forEach(s => s.addEventListener('change', async () => {
        const { error } = await sb.from('ops_angebote').update({ status: s.value }).eq('id', s.dataset.angStatus);
        if (error) fail('Angebot', error); else toast('Angebot aktualisiert');
      }));
      body.querySelector('#angNew')?.addEventListener('click', () => { closeModal(); editAngebot(k); });
      body.querySelector('#tixNew')?.addEventListener('click', () => { closeModal(); goTo('support', { neu: true, kunde_id: k.id }); });
      body.querySelectorAll('[data-goto-box]').forEach(b => b.addEventListener('click', () => { closeModal(); goTo('boxen', { id: b.dataset.gotoBox }); }));
      body.querySelectorAll('[data-goto-ticket]').forEach(b => b.addEventListener('click', () => { closeModal(); goTo('support', { id: b.dataset.gotoTicket }); }));
    },
  });
}

function editAngebot(k) {
  openModal({
    title: `Angebot für ${k.name}`,
    bodyHTML: `<div class="form-grid">
      ${fld('Angebotsnummer', inp('nummer', '', 'placeholder="aus Lexware/sevDesk"'))}
      ${fld('Status', sel('status', options(ANGEBOT_STATUS, 'entwurf')))}
      ${fld('Datum', inp('datum', new Date().toISOString().slice(0, 10), 'type="date"'))}
      ${fld('Gültig bis', inp('gueltig_bis', '', 'type="date"'))}
      ${fld('Leistungsumfang', txt('leistungen', '', 'rows="3" placeholder="Box, Installation, Schulung, Support …"'), 'span-2')}
      ${fld('Netto-Betrag (optional)', inp('betrag_netto', '', 'inputmode="decimal" data-num placeholder="leer lassen, solange Preise offen sind"'))}
      ${fld('Link zum Dokument', inp('link', '', 'type="url" placeholder="https://"'))}
    </div>`,
    actions: [
      { label: 'Abbrechen', onClick: () => { setTimeout(() => openKunde(k.id), 0); return true; } },
      { label: 'Speichern', kind: 'primary', onClick: async () => {
        const v = readFields($('#modalBody'));
        v.leistungen = v.leistungen ?? '';
        if (v.datum === null) delete v.datum;
        const { error } = await sb.from('ops_angebote').insert({ ...v, kunde_id: k.id, created_by: state.me.id });
        if (error) { fail('Angebot', error); return false; }
        await sb.from('ops_kunden_aktivitaeten').insert({
          kunde_id: k.id, art: 'angebot', text: `Angebot ${v.nummer || ''} erfasst (${ANGEBOT_STATUS[v.status]})`, created_by: state.me.id });
        if (FUNNEL.indexOf(k.stage) < FUNNEL.indexOf('angebot')) {
          await sb.from('ops_kunden').update({ stage: 'angebot' }).eq('id', k.id);
        }
        toast('Angebot gespeichert');
        await load();
        setTimeout(() => openKunde(k.id), 0);
        return true;
      } },
    ],
  });
}
