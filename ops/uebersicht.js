// Übersicht — Startseite pro Rolle: was ist heute dran, was brennt, was ist passiert.
// Liest nur; jede Kachel/Zeile springt in die zuständige Ansicht.
// Phase 1: nur Ops-Datenbank. Live-Daten (Sentry, Kuma, merkez) kommen später
// über einen eigenen Server-Endpunkt — hier bewusst NICHT eingebaut.
import { sb, state, $, esc, fmtDate, fmtDateTime, goTo } from './app.js?v=20261120a';
import { canRead, ROLES, role } from './rollen.js?v=20261120a';
import { isMissingSchema, setupNotice, pill, daysUntil, relDays, empty } from './kit.js?v=20261120a';
import {
  STAGES, STAGE_TONE, FUNNEL, PRIO, PRIO_COLOR, PRIO_ORDER, TICKET_STATUS, TICKET_TONE, OPEN_STATUS,
  WARTUNG_ART, AKT_ART, EINTRAG_ART, fmtNr,
} from './begriffe.js?v=20261120a';
import { boxWarnungen } from './boxen.js?v=20261120a';

let root, bound = false;

const nameOf = (id) => state.members.find(m => m.id === id)?.display_name || '';

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
}

/** Abfrage, die bei fehlender Tabelle leise leer zurückgibt und das merkt. */
async function q(enabled, build, flags) {
  if (!enabled) return [];
  const { data, error } = await build();
  if (error) { if (isMissingSchema(error)) flags.missing = true; else console.warn('[ops:uebersicht]', error); return []; }
  return data || [];
}

export function mountUebersicht() {
  root = $('#view-uebersicht');
  root.onclick = (e) => {
    const g = e.target.closest('[data-go]');
    if (!g) return;
    e.preventDefault();
    goTo(g.dataset.go, g.dataset.id ? { id: g.dataset.id } : undefined);
  };
  // Übersicht wird bei jedem Besuch frisch berechnet (sie ist nur eine Zusammenfassung).
  if (!bound) { bound = true; window.addEventListener('hashchange', () => { if (location.hash === '#uebersicht') render(); }); }
  render();
}

async function render() {
  const me = state.me;
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  root.innerHTML = `
    <div class="page-head">
      <div><h1>${greeting()}, ${esc(me.display_name)}</h1>
      <p>${esc(today)} · ${esc(state.rolesReady ? ROLES[role()]?.label : 'Admin')}</p></div>
    </div>
    <div id="uNotice"></div>
    <div class="stats" id="uStats"><div class="stat"><span class="stat-label">Laden …</span></div></div>
    <div class="grid-2" id="uPanels"></div>`;

  const flags = { missing: false };
  const in14 = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

  const [todos, tickets, kunden, boxen, akt, eint, wart, belege] = await Promise.all([
    q(canRead('todo'), () => sb.from('ops_todos').select('id,title,priority,assignee,done,seq_no,category,created_at').eq('done', false).limit(2000), flags),
    q(canRead('tickets'), () => sb.from('ops_tickets').select('id,nr,titel,status,prioritaet,assignee,faellig_am,kunde_id').in('status', OPEN_STATUS).limit(1000), flags),
    q(canRead('kunden'), () => sb.from('ops_kunden').select('id,name,stage,owner,naechster_schritt,naechster_termin').limit(2000), flags),
    q(canRead('boxen'), () => sb.from('ops_boxen').select('*').limit(2000), flags),
    q(canRead('vertrieb'), () => sb.from('ops_kunden_aktivitaeten').select('id,kunde_id,art,text,am,created_by').order('am', { ascending: false }).limit(8), flags),
    q(canRead('tickets'), () => sb.from('ops_ticket_eintraege').select('id,ticket_id,art,text,created_at,created_by').order('created_at', { ascending: false }).limit(8), flags),
    q(canRead('wartung'), () => sb.from('ops_wartung').select('id,box_id,art,ergebnis,datum,created_at,durchgefuehrt_von').order('created_at', { ascending: false }).limit(8), flags),
    q(canRead('finanzen'), () => sb.from('ops_finance_expenses').select('id,status').eq('status', 'review_needed').limit(500), flags),
  ]);

  const notes = [];
  if (!state.rolesReady) notes.push(`<div class="notice"><strong>Rollen sind noch nicht eingerichtet</strong> — alle Mitglieder sehen derzeit alles.
    <code>ops/schema-rollen-betrieb.sql</code> im Ops-Projekt ausführen, dann neu laden.</div>`);
  else if (flags.missing) notes.push(setupNotice());
  $('#uNotice').innerHTML = notes.join('');

  // ── Kennzahlen ───────────────────────────────────────────────────────
  const myTodos = todos.filter(t => t.assignee === me.id);
  const urgentT = tickets.filter(t => ['kritisch', 'hoch'].includes(t.prioritaet));
  const overT = tickets.filter(t => t.faellig_am && new Date(t.faellig_am) < new Date());
  const pipe = kunden.filter(k => FUNNEL.includes(k.stage) && k.stage !== 'live');
  const dueK = kunden.filter(k => k.naechster_termin && daysUntil(k.naechster_termin) <= 0 && !['live', 'verloren'].includes(k.stage));
  const boxProb = boxen.filter(b => boxWarnungen(b).length);

  const tiles = [];
  if (canRead('todo')) tiles.push(`<button class="stat" data-go="todo"><span class="stat-label">Meine offenen Aufgaben</span><span class="stat-value">${myTodos.length}</span><span class="stat-sub">${myTodos.filter(t => t.priority === 'hoch').length} mit Priorität hoch</span></button>`);
  if (canRead('tickets')) tiles.push(`<button class="stat ${urgentT.length ? 'is-bad' : ''}" data-go="support"><span class="stat-label">Offene Tickets</span><span class="stat-value">${tickets.length}</span><span class="stat-sub">${urgentT.length} kritisch/hoch · ${overT.length} über Ziel</span></button>`);
  if (canRead('kunden')) tiles.push(`<button class="stat ${dueK.length ? 'is-warn' : ''}" data-go="kunden"><span class="stat-label">Pipeline</span><span class="stat-value">${pipe.length}</span><span class="stat-sub">${dueK.length} Schritt(e) fällig · ${kunden.filter(k => k.stage === 'live').length} live</span></button>`);
  if (canRead('boxen')) tiles.push(`<button class="stat ${boxProb.length ? 'is-warn' : 'is-ok'}" data-go="boxen"><span class="stat-label">Boxen mit Handlungsbedarf</span><span class="stat-value">${boxProb.length}</span><span class="stat-sub">von ${boxen.filter(b => ['installiert', 'aktiv', 'wartung', 'defekt'].includes(b.status)).length} in Betrieb</span></button>`);
  if (canRead('finanzen')) tiles.push(`<button class="stat ${belege.length ? 'is-warn' : ''}" data-go="ausgaben"><span class="stat-label">Belege prüfen</span><span class="stat-value">${belege.length}</span><span class="stat-sub">Status „Prüfung nötig"</span></button>`);
  $('#uStats').innerHTML = tiles.join('') || '';

  // ── Panels ───────────────────────────────────────────────────────────
  const panels = [];

  // Heute für mich
  const mine = [];
  tickets.filter(t => t.assignee === me.id).forEach(t => mine.push({
    o: PRIO_ORDER[t.prioritaet], go: 'support', id: t.id,
    html: `<span class="prio-dot" style="background:${PRIO_COLOR[t.prioritaet]}"></span>
      <div class="list-main"><div class="list-title">${fmtNr('T', t.nr)} ${esc(t.titel)}</div><div class="list-sub">Ticket · ${esc(TICKET_STATUS[t.status])}</div></div>
      ${t.faellig_am ? `<span class="list-end">${esc(fmtDateTime(t.faellig_am))}</span>` : ''}` }));
  kunden.filter(k => k.owner === me.id && k.naechster_termin && daysUntil(k.naechster_termin) <= 1 && !['live', 'verloren'].includes(k.stage)).forEach(k => mine.push({
    o: daysUntil(k.naechster_termin) < 0 ? 0 : 1, go: 'kunden', id: k.id,
    html: `<span class="prio-dot" style="background:var(--gold)"></span>
      <div class="list-main"><div class="list-title">${esc(k.name)}</div><div class="list-sub">Vertrieb · ${esc(k.naechster_schritt || 'nächster Schritt')}</div></div>
      <span class="list-end">${esc(relDays(k.naechster_termin))}</span>` }));
  myTodos.filter(t => t.priority === 'hoch').slice(0, 8).forEach(t => mine.push({
    o: 2, go: 'todo',
    html: `<span class="prio-dot" style="background:var(--red)"></span>
      <div class="list-main"><div class="list-title">${t.seq_no ? '#' + t.seq_no + ' ' : ''}${esc(String(t.title).split(' — ')[0])}</div><div class="list-sub">Aufgabe${t.category ? ' · ' + esc(t.category) : ''}</div></div>` }));
  if (canRead('todo') || canRead('tickets') || canRead('kunden')) {
    panels.push(panel('Heute für mich', mine.sort((a, b) => a.o - b.o).slice(0, 12)
      .map(x => `<button class="list-row" data-go="${x.go}" ${x.id ? `data-id="${x.id}"` : ''}>${x.html}</button>`).join(''),
      'Nichts Dringendes für dich. Gute Gelegenheit für die Pipeline oder offene Aufgaben.'));
  }

  if (canRead('tickets')) {
    const top = [...tickets].sort((a, b) => (PRIO_ORDER[a.prioritaet] - PRIO_ORDER[b.prioritaet]) || (a.faellig_am || '9').localeCompare(b.faellig_am || '9')).slice(0, 8);
    panels.push(panel('Dringendste Tickets', top.map(t => `<button class="list-row" data-go="support" data-id="${t.id}">
      <span class="prio-dot" style="background:${PRIO_COLOR[t.prioritaet]}" title="${esc(PRIO[t.prioritaet])}"></span>
      <div class="list-main"><div class="list-title">${fmtNr('T', t.nr)} ${esc(t.titel)}</div><div class="list-sub">${esc(nameOf(t.assignee) || 'niemand zuständig')}</div></div>
      ${pill(TICKET_STATUS[t.status], TICKET_TONE[t.status])}</button>`).join(''), 'Keine offenen Tickets.', 'support'));
  }

  if (canRead('kunden')) {
    const next = kunden.filter(k => k.naechster_termin && k.naechster_termin <= in14 && !['live', 'verloren', 'pausiert'].includes(k.stage))
      .sort((a, b) => a.naechster_termin.localeCompare(b.naechster_termin)).slice(0, 8);
    panels.push(panel('Nächste Vertriebsschritte (14 Tage)', next.map(k => `<button class="list-row" data-go="kunden" data-id="${k.id}">
      <div class="list-main"><div class="list-title">${esc(k.name)}</div><div class="list-sub">${esc(k.naechster_schritt || '—')} · ${esc(nameOf(k.owner))}</div></div>
      ${pill(STAGES[k.stage], STAGE_TONE[k.stage])}
      <span class="list-end" style="${daysUntil(k.naechster_termin) < 0 ? 'color:#f28f8b' : ''}">${esc(relDays(k.naechster_termin))}</span></button>`).join(''),
      'Keine terminierten Schritte. Leads ohne nächsten Schritt bleiben liegen.', 'kunden'));
  }

  if (canRead('boxen')) {
    panels.push(panel('Boxen mit Handlungsbedarf', boxProb.slice(0, 8).map(b => `<button class="list-row" data-go="boxen" data-id="${b.id}">
      <div class="list-main"><div class="list-title">${esc(b.seriennummer)}</div><div class="list-sub">${esc(b.version || '')}</div></div>
      <span class="list-pills">${boxWarnungen(b).slice(0, 2).map(w => pill(w.t, w.tone)).join('')}</span></button>`).join(''),
      boxen.length ? 'Alle Boxen in Ordnung.' : 'Noch keine Box erfasst.', 'boxen'));
  }

  // Zuletzt passiert
  const feed = [
    ...akt.map(a => ({ t: a.am, go: 'kunden', id: a.kunde_id, txt: `${AKT_ART[a.art] || a.art}: ${a.text}`, who: a.created_by })),
    ...eint.map(e => ({ t: e.created_at, go: 'support', id: e.ticket_id, txt: `Ticket · ${EINTRAG_ART[e.art] || e.art}: ${e.text}`, who: e.created_by })),
    ...wart.map(w => ({ t: w.created_at, go: 'boxen', id: w.box_id, txt: `Wartung · ${WARTUNG_ART[w.art]} (${w.ergebnis})`, who: w.durchgefuehrt_von })),
  ].sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 10);
  if (akt.length || eint.length || wart.length || canRead('tickets')) {
    panels.push(panel('Zuletzt passiert', feed.map(f => `<button class="list-row" data-go="${f.go}" data-id="${f.id}">
      <div class="list-main"><div class="list-title">${esc(String(f.txt).slice(0, 140))}</div><div class="list-sub">${esc(fmtDateTime(f.t))} · ${esc(nameOf(f.who))}</div></div></button>`).join(''),
      'Noch nichts protokolliert.'));
  }

  if (!panels.length) panels.push(`<div class="panel">${empty('Für deine Rolle gibt es hier noch keine Kennzahlen.')}</div>`);
  $('#uPanels').innerHTML = panels.join('');
}

function panel(title, inner, emptyText, go) {
  return `<section class="panel">
    <div class="panel-head"><h2>${esc(title)}</h2><div class="spacer"></div>
      ${go ? `<a href="#${go}" class="hint" data-go="${go}">alle →</a>` : ''}</div>
    <div class="list">${inner || empty(emptyText)}</div>
  </section>`;
}
