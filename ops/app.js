// Praxura Ops-Dashboard — Shell: Auth, Router, gemeinsame Helfer
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20260808';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'praxura-ops-auth' }
});

// ── Zustand ────────────────────────────────────────────────────────────
export const state = {
  me: null,          // ops_members satırı
  members: [],       // tüm üyeler
};

export const memberById = (id) => state.members.find(m => m.id === id) || null;

// ── Helfer ─────────────────────────────────────────────────────────────

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, isErr = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', isErr);
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, isErr ? 5000 : 2600);
}

/** Supabase hatasını yut ve göster — her çağrıyı sarmalıyoruz ki UI sessizce ölmesin. */
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

/** Çok küçük markdown — başlık, kalın, kod, liste, link. Kütüphane yüklemeye değmez. */
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
// openModal({ title, body, actions }) → actions: [{label, kind, onClick}]
// onClick true dönerse (veya Promise<true>) modal kapanır.

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
      { label: 'Abbrechen', onClick: () => true },
      { label: 'Löschen', kind: 'primary', onClick: onYes }
    ]
  });
}

// ── Router ─────────────────────────────────────────────────────────────

const views = {};   // name → { mount(), mounted }

export function registerView(name, mount) { views[name] = { mount, mounted: false }; }

export function showView(name) {
  if (!views[name]) name = 'todo';
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === name));
  $$('.view').forEach(v => { v.hidden = v.id !== `view-${name}`; });
  location.hash = name;
  const v = views[name];
  if (!v.mounted) { v.mounted = true; v.mount(); }
}

// ── Auth ───────────────────────────────────────────────────────────────

async function loadMe() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data, error } = await sb.from('ops_members').select('*').order('display_name');
  if (error) { fail('Mitglieder', error); return null; }

  state.members = data || [];
  state.me = state.members.find(m => m.id === session.user.id) || null;

  if (!state.me) {
    // Oturum var ama üye kaydı yok → RLS hiçbir şey göstermez, boş ekran yerine açıkça söyle.
    await sb.auth.signOut();
    showLogin('Dieser Account ist kein Ops-Mitglied. Bitte in ops_members eintragen.');
    return null;
  }
  return state.me;
}

function showLogin(msg) {
  $('#app').hidden = true;
  $('#login').hidden = false;
  const err = $('#loginErr');
  if (msg) { err.textContent = msg; err.hidden = false; } else { err.hidden = true; }
}

async function showApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#who').textContent = state.me.display_name;

  // Görünümler yüklendikten sonra route
  const { mountTodo }      = await import('./board.js?v=20260808');
  const { mountWissen }    = await import('./wissen.js?v=20260808');
  const { mountDecisions } = await import('./decisions.js?v=20260808');
  const { mountMeetings }  = await import('./meetings.js?v=20260808');
  const { mountFiles }     = await import('./files.js?v=20260808');

  registerView('todo', mountTodo);
  registerView('wissen', mountWissen);
  registerView('decisions', mountDecisions);
  registerView('meetings', mountMeetings);
  registerView('files', mountFiles);

  showView(location.hash.replace('#', '') || 'todo');
}

// ── Start ──────────────────────────────────────────────────────────────

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true; btn.textContent = 'Anmelden …';
  const { error } = await sb.auth.signInWithPassword({
    email: $('#loginEmail').value.trim(),
    password: $('#loginPass').value
  });
  btn.disabled = false; btn.textContent = 'Anmelden';
  if (error) { showLogin('Anmeldung fehlgeschlagen: ' + error.message); return; }
  if (await loadMe()) showApp();
});

$('#logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

$('#tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (t) showView(t.dataset.view);
});

$('#modalClose').addEventListener('click', closeModal);
$('#modalBack').addEventListener('click', (e) => { if (e.target.id === 'modalBack') closeModal(); });
window.addEventListener('hashchange', () => showView(location.hash.replace('#', '')));

if (SUPABASE_URL.includes('PROJE_REF')) {
  showLogin('config.js noch nicht ausgefüllt — Supabase-URL und Anon-Key eintragen (siehe SETUP.md).');
} else if (await loadMe()) {
  await showApp();
} else {
  showLogin();
}
