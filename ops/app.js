// Praxura Ops-Dashboard / Cockpit — Shell: Auth, RBAC, Router, i18n, gemeinsame Helfer
import { createClient } from './vendor/supabase-js.js?v=20260813';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20261127a';
import { t, setLang, onLangChange, applyI18n, registerLangSync, LANGS } from './i18n.js?v=20261127c';

const AUTH_STORAGE_KEY = 'praxura-ops-auth';
const VALID_ROLES = ['founder', 'tech', 'support', 'sales'];

const VIEW_ROLES = {
  cockpit:     ['founder', 'tech', 'support', 'sales'],
  customers:   ['founder', 'tech', 'support', 'sales'],
  tickets:     ['founder', 'tech', 'support', 'sales'],
  boxes:       ['founder', 'tech'],
  'ki-costs':  ['founder', 'tech'],
  todo:        ['founder', 'tech', 'support', 'sales'],
  ausgaben:    ['founder'],
  meetings:    ['founder', 'tech', 'support', 'sales'],
  decisions:   ['founder', 'tech', 'support', 'sales'],
  wissen:      ['founder', 'tech', 'support', 'sales'],
  fahrtenbuch: ['founder'],
  files:       ['founder', 'tech', 'support', 'sales'],
};

const VIEW_I18N = {
  cockpit:     'nav.cockpit',
  customers:   'nav.customers',
  tickets:     'nav.tickets',
  boxes:       'nav.boxes',
  'ki-costs':  'nav.kiCosts',
  todo:        'nav.todo',
  ausgaben:    'nav.ausgaben',
  meetings:    'nav.meetings',
  decisions:   'nav.decisions',
  wissen:      'nav.wissen',
  fahrtenbuch: 'nav.fahrtenbuch',
  files:       'nav.files',
};

async function boundedLock(name, acquireTimeout, fn) {
  if (!globalThis.navigator?.locks || !globalThis.AbortSignal?.timeout) return fn();
  try {
    return await navigator.locks.request(
      name, { signal: AbortSignal.timeout(acquireTimeout > 0 ? acquireTimeout : 5000) }, fn);
  } catch (e) {
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
      console.warn('[ops:auth] Sperre nicht erhalten, laufe ohne:', name);
      return fn();
    }
    throw e;
  }
}

export const sb = (globalThis.__praxuraOpsSb ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: AUTH_STORAGE_KEY,
    lock: boundedLock
  }
}));

// ── Zustand (geteilt über evtl. abweichende Modul-Query-Versionen) ─────
export const state = (globalThis.__praxuraOpsState ??= {
  me: null,            // ops_members satırı
  members: [],         // tüm üyeler
  schemaHasRole: true, // nur false nach explizitem 42703-Fallback in loadMe()
});

export const memberById = (id) => state.members.find(m => m.id === id) || null;

export function myRole() {
  const r = state.me?.role;
  if (VALID_ROLES.includes(r)) return r;
  if (state.schemaHasRole === false) return 'founder';
  return 'support';
}

export function canAccessView(name, role = myRole()) {
  const allowed = VIEW_ROLES[name];
  if (!allowed) return false;
  return allowed.includes(role);
}

// ── Helfer ─────────────────────────────────────────────────────────────

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, isErr = false) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('err', isErr);
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, isErr ? 5000 : 2600);
}

let reporting = false;
function report(label, err) {
  console.error(`[ops:${label}]`, err);
  if (reporting) return;
  reporting = true;
  try { toast('Fehler: ' + (err?.message || err), true); } catch {}
  setTimeout(() => { reporting = false; }, 1000);
}

export function fail(where, error) {
  console.error(`[ops:${where}]`, error);
  toast(`${where}: ${error?.message || 'Fehler'}`, true);
}

export const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '';

export const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '';

export function md(src) {
  const lines = String(src ?? '').split('\n');
  let out = '', inList = false, inCode = false;
  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');

  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      if (inList) { out += '</ul>'; inList = false; }
      out += inCode ? '</pre>' : '<pre>';
      inCode = !inCode;
      continue;
    }
    if (inCode) { out += esc(raw) + '\n'; continue; }

    const li = raw.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!inList) { out += '<ul>'; inList = true; }
      out += `<li>${inline(li[1])}</li>`;
      continue;
    }
    if (inList) { out += '</ul>'; inList = false; }

    const h = raw.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const n = Math.min(h[1].length + 2, 6); out += `<h${n}>${inline(h[2])}</h${n}>`; continue; }
    if (!raw.trim()) continue;
    out += `<p>${inline(raw)}</p>`;
  }
  if (inList) out += '</ul>';
  if (inCode) out += '</pre>';
  return out;
}

// ── Modal ──────────────────────────────────────────────────────────────

let modalEsc = null;

export function openModal({ title, bodyHTML, actions = [], onOpen }) {
  const back = $('#modalBack');
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHTML;

  const foot = $('#modalFoot');
  foot.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger left' : 'btn-ghost');
    b.textContent = a.label;
    b.onclick = async () => {
      b.disabled = true;
      try { if (await a.onClick?.() !== false) closeModal(); }
      finally { b.disabled = false; }
    };
    foot.appendChild(b);
  }

  back.hidden = false;
  modalEsc = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', modalEsc);
  onOpen?.($('#modalBody'));
  $('#modalBody').querySelector('input, textarea')?.focus();
}

export function closeModal() {
  $('#modalBack').hidden = true;
  $('#modalBody').innerHTML = '';
  if (modalEsc) { document.removeEventListener('keydown', modalEsc); modalEsc = null; }
}

export function confirmDialog(title, text, onYes) {
  openModal({
    title,
    bodyHTML: `<p style="margin:0;color:var(--text-dim)">${esc(text)}</p>`,
    actions: [
      { label: t('common.cancel'), onClick: () => true },
      { label: t('common.delete'), kind: 'primary', onClick: onYes }
    ]
  });
}

// ── Sidebar & Mobile Drawer ────────────────────────────────────────────

function setSidebarOpen(open) {
  const sidebar = $('#sidebar');
  const backdrop = $('#sidebarBackdrop');
  if (sidebar) sidebar.classList.toggle('is-open', open);
  if (backdrop) backdrop.hidden = !open;
}

function applyRoleGating() {
  const role = myRole();
  $$('.nav-item[data-view]').forEach((el) => {
    el.hidden = !canAccessView(el.dataset.view, role);
  });
  $$('.nav-group').forEach((grp) => {
    const visible = $$('.nav-item[data-view]', grp).some((el) => !el.hidden);
    grp.hidden = !visible;
  });
}

function updateUserBadge() {
  if (!state.me) return;
  const role = myRole();
  const who = $('#who');
  const pill = $('#rolePill');
  if (who) who.textContent = state.me.display_name;
  if (pill) {
    pill.textContent = t(`role.${role}`);
    pill.className = `role-pill role-${role}`;
  }
}

// ── Router ─────────────────────────────────────────────────────────────

const views = (globalThis.__praxuraOpsViews ??= {});
let activeViewName = 'cockpit';

export function registerView(name, mount) { views[name] = { mount, mounted: false }; }

export function showView(name) {
  if (name === 'finance' || name === 'finanzen') name = 'ausgaben';
  const role = myRole();
  if (!canAccessView(name, role) || !views[name]) {
    name = canAccessView('cockpit', role) && views.cockpit ? 'cockpit' : 'todo';
  }
  activeViewName = name;

  $$('.nav-item[data-view], .tab[data-view]').forEach(el =>
    el.classList.toggle('is-active', el.dataset.view === name));
  $$('.view').forEach(v => { v.hidden = v.id !== `view-${name}`; });

  const titleEl = $('#viewTitle');
  if (titleEl) titleEl.textContent = t(VIEW_I18N[name] || 'nav.cockpit');

  setSidebarOpen(false);
  if (location.hash.replace('#', '') !== name) location.hash = name;

  const v = views[name];
  if (!v) return;
  if (v.mounted) return;
  try { v.mount(); v.mounted = true; }
  catch (e) { fail('Ansicht ' + name, e); }
}

export function remountCurrent() {
  const name = location.hash.replace('#', '') || 'cockpit';
  const target = views[name] ? name : 'cockpit';
  if (views[target]) { views[target].mounted = false; showView(target); }
}

// ── Auth ───────────────────────────────────────────────────────────────

const isAuthRejection = (err) =>
  err?.status === 401 || err?.status === 403 ||
  /invalid|expired|not_?found|jwt|token/i.test(err?.code || err?.name || '');

const isSessionMissing = (err) =>
  err?.name === 'AuthSessionMissingError' || /session missing/i.test(err?.message || '');

const isUndefinedColumnError = (err) =>
  Boolean(err && (err.code === '42703' || /column\s+.*\s+does not exist/i.test(String(err.message || ''))));

async function loadMe() {
  let user = null, authErr = null;
  try {
    ({ data: { user } = {}, error: authErr } = await sb.auth.getUser());
  } catch (e) {
    if (isSessionMissing(e)) return null;
    throw e;
  }
  if (authErr || !user) {
    if (isSessionMissing(authErr)) return null;
    if (authErr && isAuthRejection(authErr)) await sb.auth.signOut().catch(() => {});
    else if (authErr) throw authErr;
    return null;
  }

  let { data, error } = await sb
    .from('ops_members')
    .select('id, email, display_name, color, role, is_active, preferred_lang')
    .order('display_name');

  if (error && isUndefinedColumnError(error)) {
    state.schemaHasRole = false;
    ({ data, error } = await sb
      .from('ops_members')
      .select('id, email, display_name, color, created_at')
      .order('display_name'));
  } else if (!error) {
    state.schemaHasRole = true;
  }

  if (error) { fail('Mitglieder', error); return null; }

  state.members = data || [];
  state.me = state.members.find(m => m.id === user.id) || null;

  if (!state.me) {
    await sb.auth.signOut();
    showLogin('Dieser Account ist kein Ops-Mitglied. Bitte in ops_members eintragen.');
    return null;
  }
  if (state.me.is_active === false) {
    await sb.auth.signOut();
    showLogin('Dieser Ops-Account ist deaktiviert.');
    return null;
  }

  // Gespeicherte Sprache aus ops_members übernehmen, falls lokal noch nicht gesetzt
  try {
    const localSaved = localStorage.getItem('praxura-ops-lang');
    if (!localSaved && state.me.preferred_lang && LANGS.includes(state.me.preferred_lang)) {
      setLang(state.me.preferred_lang, { syncDb: false });
    }
  } catch { /* ignore */ }

  return state.me;
}

function showLogin(msg) {
  $('#boot').hidden = true;
  $('#app').hidden = true;
  $('#login').hidden = false;
  const err = $('#loginErr');
  if (msg) { err.textContent = msg; err.hidden = false; } else { err.hidden = true; }
}

const TIMEOUT = Symbol('timeout');
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise(r => setTimeout(() => r(TIMEOUT), ms))]);

async function showApp() {
  const modules = [
    ['cockpit',     './cockpit-home.js?v=20261127c', 'mountCockpit'],
    ['customers',   './customers.js?v=20261127c',    'mountCustomers'],
    ['tickets',     './tickets.js?v=20261127c',      'mountTickets'],
    ['boxes',       './boxes.js?v=20261127c',        'mountBoxes'],
    ['ki-costs',    './ki-costs.js?v=20261127c',     'mountKiCosts'],
    ['todo',        './board.js?v=20261023blocker1', 'mountTodo'],
    ['wissen',      './wissen.js?v=20260811a',       'mountWissen'],
    ['decisions',   './decisions.js?v=20260811a',    'mountDecisions'],
    ['meetings',    './meetings.js?v=20260811a',     'mountMeetings'],
    ['ausgaben',    './finance.js?v=20260816j',      'mountFinance'],
    ['fahrtenbuch', './fahrtenbuch.js?v=20260816b',  'mountFahrtenbuch'],
    ['files',       './files.js?v=20260811a',        'mountFiles'],
  ];

  const broken = [];
  await Promise.all(modules.map(async ([name, path, fn]) => {
    const mod = await withTimeout(import(path).catch(e => ({ __err: e })), 15000);
    if (mod === TIMEOUT || mod?.__err) {
      broken.push(name);
      console.error('[ops:view ' + name + ']', mod === TIMEOUT ? 'Zeitüberschreitung' : mod.__err);
      return;
    }
    registerView(name, mod[fn]);
  }));

  $('#boot').hidden = true;
  $('#login').hidden = true;
  $('#app').hidden = false;

  applyRoleGating();
  updateUserBadge();
  applyI18n(document);

  if (broken.length) toast('Ansicht nicht geladen: ' + broken.join(', '), true);

  showView(location.hash.replace('#', '') || 'cockpit');
}

function bindShellEvents() {
  window.addEventListener('error', (e) => report('uncaught', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => report('promise', e.reason));

  registerLangSync(async (lang) => {
    if (!state.me?.id) return;
    if (!('preferred_lang' in state.me)) return;
    const { error } = await sb.from('ops_members').update({ preferred_lang: lang }).eq('id', state.me.id);
    if (!error) state.me.preferred_lang = lang;
  });

  onLangChange(() => {
    updateUserBadge();
    const titleEl = $('#viewTitle');
    if (titleEl) titleEl.textContent = t(VIEW_I18N[activeViewName] || 'nav.cockpit');
  });

  document.addEventListener('click', (e) => {
    const langBtn = e.target.closest('.lang-btn[data-lang]');
    if (langBtn) {
      setLang(langBtn.dataset.lang);
      return;
    }
    const navBtn = e.target.closest('.nav-item[data-view], .tab[data-view]');
    if (navBtn) {
      showView(navBtn.dataset.view);
    }
  });

  $('#menuBtn')?.addEventListener('click', () => setSidebarOpen(true));
  $('#sidebarClose')?.addEventListener('click', () => setSidebarOpen(false));
  $('#sidebarBackdrop')?.addEventListener('click', () => setSidebarOpen(false));

  $('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn');
    btn.disabled = true; btn.textContent = 'Anmelden …';
    const { error } = await sb.auth.signInWithPassword({
      email: $('#loginEmail').value.trim(),
      password: $('#loginPass').value
    });
    btn.disabled = false; btn.textContent = t('auth.login');
    if (error) { showLogin('Anmeldung fehlgeschlagen: ' + error.message); return; }
    try { if (await loadMe()) await showApp(); }
    catch (err) { console.error('[ops:login]', err); showLogin('Laden fehlgeschlagen: ' + (err?.message || err)); }
  });

  $('#logoutBtn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
  });

  $('#modalClose')?.addEventListener('click', closeModal);
  window.addEventListener('hashchange', () => showView(location.hash.replace('#', '')));

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      showLogin('Sitzung beendet — bitte neu anmelden.');
    } else if (event === 'TOKEN_REFRESHED' && state.me) {
      remountCurrent();
    }
  });

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !state.me) return;
    let user = null, error = null;
    try { ({ data: { user }, error } = await sb.auth.getUser()); }
    catch (e) { console.warn('[ops:auth] getUser beim Tabwechsel', e); return; }
    if (error || !user) {
      if (error && !isAuthRejection(error)) return;
      const { error: refreshErr } = await sb.auth.refreshSession();
      if (refreshErr) {
        await sb.auth.signOut().catch(() => {});
        showLogin('Sitzung abgelaufen — bitte neu anmelden.');
        return;
      }
    }
    remountCurrent();
  });
}

function hasStoredSession() {
  try { return !!localStorage.getItem(AUTH_STORAGE_KEY); } catch { return false; }
}

async function start() {
  const boot = $('#boot'), bootMsg = $('#bootMsg'), bootReload = $('#bootReload');
  if (bootReload) bootReload.onclick = () => location.reload();
  const slow = setTimeout(() => {
    if (bootMsg) bootMsg.textContent = 'Dauert ungewöhnlich lange …';
    if (bootReload) bootReload.hidden = false;
  }, 5000);

  applyI18n(document);
  bindShellEvents();

  try {
    if (SUPABASE_URL.includes('PROJE_REF')) {
      showLogin('config.js noch nicht ausgefüllt — Supabase-URL und Anon-Key eintragen (siehe SETUP.md).');
      return;
    }
    const me = await withTimeout(loadMe(), 12000);
    if (me === TIMEOUT) {
      showLogin(hasStoredSession()
        ? 'Sitzung konnte nicht geprüft werden (Verbindung?). Neu laden oder hier neu anmelden.'
        : 'Keine Verbindung zu Supabase. Bitte neu laden.');
    } else if (me) {
      await showApp();
    } else {
      showLogin();
    }
  } catch (e) {
    console.error('[ops:start]', e);
    showLogin('Start fehlgeschlagen: ' + (e?.message || e) + ' — bitte neu laden.');
  } finally {
    clearTimeout(slow);
    if (boot) boot.hidden = true;
  }
}

if (!globalThis.__praxuraOpsBooted) {
  globalThis.__praxuraOpsBooted = true;
  start();
}
