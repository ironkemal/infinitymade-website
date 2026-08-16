// Praxura Ops-Dashboard — Shell: Auth, Router, gemeinsame Helfer
// Sürüm sabitlenmiş: "@2" yazmak, CDN'in bir gün yeni bir küçük sürümü sessizce
// göndermesi ve oturum davranışının bizden habersiz değişmesi demekti.
import { createClient } from './vendor/supabase-js.js?v=20260813';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20260811a';

const AUTH_STORAGE_KEY = 'praxura-ops-auth';

/** Web Locks: supabase oturum yenilemeyi sekmeler arasında kilitle sıraya sokar.
 *  Kilidi tutan sekme onu bırakmazsa (asılı bir istek, uyuyan sekme, çöken kod),
 *  diğer sekme AÇILIŞTA sonsuza kadar bekler — ekran bomboş kalır ve ancak
 *  çıkış+giriş sonrası düzelir. Bu yüzden kilidi süreli alıyoruz: alınamazsa iş
 *  kilitsiz yürür. En kötü ihtimalle iki sekme aynı anda belirteç yeniler —
 *  sonsuza kadar beklemekten iyidir. */
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

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: AUTH_STORAGE_KEY,
    lock: boundedLock
  }
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

// Yakalanmamış hata sessizce yutulmasın — ekranda görelim ki teşhis edilebilsin.
// Re-entrancy koruması: toast'ın kendisi patlarsa hata→toast→hata döngüsüne girmeyelim.
let reporting = false;
function report(label, err) {
  console.error(`[ops:${label}]`, err);
  if (reporting) return;
  reporting = true;
  try { toast('Fehler: ' + (err?.message || err), true); } catch {}
  setTimeout(() => { reporting = false; }, 1000);
}
window.addEventListener('error', (e) => report('uncaught', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => report('promise', e.reason));

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
  if (name === 'finance') name = 'ausgaben';
  if (!views[name]) name = 'todo';
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === name));
  $$('.view').forEach(v => { v.hidden = v.id !== `view-${name}`; });
  if (location.hash.replace('#', '') !== name) location.hash = name;

  const v = views[name];
  if (!v) return;                 // görünüm yüklenememiş — çökme yerine boş sekme
  if (v.mounted) return;
  // mounted'ı ancak başarıdan SONRA işaretle: mount patlarsa sekme kalıcı olarak
  // ölü kalmasın, bir sonraki tıklamada yeniden denensin.
  try { v.mount(); v.mounted = true; }
  catch (e) { fail('Ansicht ' + name, e); }
}

/** Görünür sekmeyi baştan kurmaya zorla — oturum tazelendikten sonra kullanılır. */
export function remountCurrent() {
  const name = location.hash.replace('#', '') || 'todo';
  if (views[name]) { views[name].mounted = false; showView(name); }
}

// ── Auth ───────────────────────────────────────────────────────────────

/** Gerçekten "bu oturum geçersiz" mi, yoksa sadece ağ mı takıldı?
 *  Ağ hatasında oturumu SİLMEK, geçici bir aksaklığı zorunlu yeniden girişe
 *  çeviriyordu — sadece sunucu açıkça reddettiğinde çıkış yapıyoruz. */
const isAuthRejection = (err) =>
  err?.status === 401 || err?.status === 403 ||
  /invalid|expired|not_?found|jwt|token/i.test(err?.code || err?.name || '');

/** "Hiç oturum yok" — bir arıza değil, sadece giriş yapılmamış demek.
 *  supabase bunu duruma göre bazen döndürür bazen fırlatır; ikisini de aynı sayıyoruz. */
const isSessionMissing = (err) =>
  err?.name === 'AuthSessionMissingError' || /session missing/i.test(err?.message || '');

async function loadMe() {
  // getSession() yalnızca yereldeki kaydı okur — süresi dolmuş bir belirteci de
  // "geçerli" diye döndürür. getUser() sunucuya sorar; böylece ölü oturumu burada
  // yakalarız, sorgular 401 döndürüp uygulama sessizce boş kalmaz.
  let user = null, authErr = null;
  try {
    ({ data: { user } = {}, error: authErr } = await sb.auth.getUser());
  } catch (e) {
    // ⚠️ Oturum yokken getUser() hata DÖNDÜRMEZ, hata FIRLATIR (AuthSessionMissingError).
    // Bu, en tepedeki await'i düşürüyordu: ne showApp ne showLogin çalışıyor, sayfa
    // bomboş kalıyordu — ve yalnızca Abmelden+yeniden giriş kurtarıyordu, çünkü
    // signOut() olayı showLogin'i tetikliyordu. Burada sessizce "giriş yapılmamış"a çeviriyoruz.
    if (isSessionMissing(e)) return null;
    throw e;
  }
  if (authErr || !user) {
    if (isSessionMissing(authErr)) return null;               // sadece giriş yapılmamış
    if (authErr && isAuthRejection(authErr)) await sb.auth.signOut().catch(() => {});
    else if (authErr) throw authErr;          // ağ sorunu → başlangıç bunu ayrı ele alır
    return null;
  }

  const { data, error } = await sb.from('ops_members').select('*').order('display_name');
  if (error) { fail('Mitglieder', error); return null; }

  state.members = data || [];
  state.me = state.members.find(m => m.id === user.id) || null;

  if (!state.me) {
    // Oturum var ama üye kaydı yok → RLS hiçbir şey göstermez, boş ekran yerine açıkça söyle.
    await sb.auth.signOut();
    showLogin('Dieser Account ist kein Ops-Mitglied. Bitte in ops_members eintragen.');
    return null;
  }
  return state.me;
}

function showLogin(msg) {
  $('#boot').hidden = true;
  $('#app').hidden = true;
  $('#login').hidden = false;
  const err = $('#loginErr');
  if (msg) { err.textContent = msg; err.hidden = false; } else { err.hidden = true; }
}

async function showApp() {
  // Görünümler yüklenmeden kabuğu AÇMA. Aksi hâlde import takılırsa kullanıcı
  // üst çubuğu görür, panoyu göremez ve sekmeler ölü olur — teşhis edilemeyen
  // bir "boş uygulama" hâli. Önce yükle, sonra göster.
  const modules = [
    ['todo',      './board.js?v=20260811a',     'mountTodo'],
    ['wissen',    './wissen.js?v=20260811a',    'mountWissen'],
    ['decisions', './decisions.js?v=20260811a', 'mountDecisions'],
    ['meetings',  './meetings.js?v=20260811a',  'mountMeetings'],
    ['ausgaben',  './finance.js?v=20260815b',   'mountFinance'],
    ['fahrtenbuch', './fahrtenbuch.js?v=20260816b', 'mountFahrtenbuch'],
    ['files',     './files.js?v=20260811a',     'mountFiles']
  ];

  // Her görünüm tek tek ve süreli yüklenir: biri patlar ya da asılırsa
  // diğerleri çalışmaya devam etsin, uygulama sessizce ölmesin.
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
  $('#who').textContent = state.me.display_name;

  if (broken.length) toast('Ansicht nicht geladen: ' + broken.join(', '), true);

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
  try { if (await loadMe()) await showApp(); }
  catch (e) { console.error('[ops:login]', e); showLogin('Laden fehlgeschlagen: ' + (e?.message || e)); }
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

// ── Oturum dayanıklılığı ───────────────────────────────────────────────
// Belirti: sekme uzun süre açık kalınca pano boşalıyor, ancak çıkış+giriş
// yapınca düzeliyordu. Sebebi: erişim belirteci sessizce ölüyor, sorgular
// 401 dönüyor ve ekranda hiçbir şey söylenmiyordu.

sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    showLogin('Sitzung beendet — bitte neu anmelden.');
  } else if (event === 'TOKEN_REFRESHED' && state.me) {
    // Yeni belirteçle veriyi tazele; realtime soketi de yeni belirteci alsın.
    remountCurrent();
  }
});

// Sekmeye geri dönüldüğünde oturumu doğrula ve veriyi tazele.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !state.me) return;
  let user = null, error = null;
  try { ({ data: { user }, error } = await sb.auth.getUser()); }
  catch (e) { console.warn('[ops:auth] getUser beim Tabwechsel', e); return; }  // ağ: dokunma
  if (error || !user) {
    if (error && !isAuthRejection(error)) return;   // ağ sorunu → oturuma dokunma
    const { error: refreshErr } = await sb.auth.refreshSession();
    if (refreshErr) {
      await sb.auth.signOut().catch(() => {});
      showLogin('Sitzung abgelaufen — bitte neu anmelden.');
      return;
    }
  }
  remountCurrent();
});

// ── Başlangıç ──────────────────────────────────────────────────────────
// Kural: bu blok NE OLURSA OLSUN bir şey göstermek zorunda. Eskiden oturum
// kontrolü takılırsa (kilit, ağ, CDN) ne uygulama ne giriş ekranı açılıyordu;
// sayfa bomboş kalıyor ve ancak Abmelden + yeniden giriş kurtarıyordu.

const boot = $('#boot'), bootMsg = $('#bootMsg'), bootReload = $('#bootReload');
bootReload.onclick = () => location.reload();
const slow = setTimeout(() => {
  bootMsg.textContent = 'Dauert ungewöhnlich lange …';
  bootReload.hidden = false;
}, 5000);

/** Yerelde kayıtlı bir oturum var mı — ağa çıkmadan, asılı kalmadan. */
function hasStoredSession() {
  try { return !!localStorage.getItem(AUTH_STORAGE_KEY); } catch { return false; }
}

const TIMEOUT = Symbol('timeout');
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise(r => setTimeout(() => r(TIMEOUT), ms))]);

/** ⚠️ BU FONKSİYON MODÜL GÖVDESİNDE `await` EDİLMEZ — sebebi hayati:
 *
 *  showApp() görünümleri `import('./board.js')` ile yüklüyor. board.js de bu
 *  dosyayı (`app.js`) import ediyor. Eğer start() en tepede await edilirse,
 *  app.js "hâlâ çalışıyor" durumunda kalır; board.js app.js'in bitmesini bekler,
 *  app.js de board.js'in gelmesini → KARŞILIKLI KİLİT. Hata yok, konsol boş,
 *  sonsuza kadar bekler.
 *
 *  Belirtisi tam olarak şuydu: sayfa yenilenince üst çubuk geliyor ama pano boş
 *  kalıyor ve hiçbir sekme açılmıyordu; çıkış+giriş düzeltiyordu, çünkü orada
 *  showApp() bir tıklama olayından çağrılıyor ve app.js çoktan bitmiş oluyor.
 *
 *  Await etmeden çağırınca modül değerlendirmesi hemen biter, dinamik import
 *  çözülür, döngü kurulmaz. */
async function start() {
  try {
    if (SUPABASE_URL.includes('PROJE_REF')) {
      showLogin('config.js noch nicht ausgefüllt — Supabase-URL und Anon-Key eintragen (siehe SETUP.md).');
      return;
    }
    // 12 sn: yavaş bağlantıya yeter, sonsuz beklemeye izin vermez.
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
    // Ağ/CDN/beklenmedik hata: oturumu SİLMEDEN giriş ekranını göster.
    console.error('[ops:start]', e);
    showLogin('Start fehlgeschlagen: ' + (e?.message || e) + ' — bitte neu laden.');
  } finally {
    clearTimeout(slow);
    boot.hidden = true;
  }
}

start();   // ← await YOK. Yukarıdaki açıklamayı okumadan await ekleme.
