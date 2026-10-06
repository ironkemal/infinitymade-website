import { createClient } from './vendor/supabase-js.js?v=20260813';
import { SUPABASE_URL, SUPABASE_ANON_KEY, IST_KUTU, API_BASE } from './supabase-config.js';
import { minPasswortLaenge, MIN_MITARBEITER } from './module/passwort-regel.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const T = {
  de: {
    title: 'Anmelden',
    sub: 'Willkommen zurück. Geben Sie Ihre Zugangsdaten ein.',
    lbl_email: 'E-Mail',
    lbl_pass: 'Passwort',
    submit: 'Anmelden',
    forgot: 'Passwort vergessen?',
    back: '← Zurück zur Startseite',
    err_credentials: 'E-Mail oder Passwort ist falsch.',
    err_generic: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    loading: 'Wird geladen…',
    reg_text: 'Noch kein Konto?',
    reg_btn: 'Jetzt starten',
    // email not confirmed
    confirm_banner: 'Ihre E-Mail-Adresse wurde noch nicht bestätigt. Bitte klicken Sie den Link in der Bestätigungs-E-Mail.',
    resend_btn: 'Bestätigungsmail erneut senden',
    resend_sending: 'Wird gesendet…',
    resend_success: 'E-Mail wurde gesendet. Bitte prüfen Sie Ihr Postfach (auch Spam).',
    resend_error: 'Fehler beim Senden. Bitte versuchen Sie es erneut.',
    // forgot password panel
    reset_sub: 'Geben Sie Ihre E-Mail-Adresse ein — wir schicken Ihnen einen Reset-Link.',
    lbl_reset_email: 'E-Mail',
    reset_submit: 'Link senden',
    reset_back: '← Zurück zur Anmeldung',
    reset_success: 'E-Mail wurde gesendet. Bitte prüfen Sie Ihr Postfach.',
    reset_error: 'Fehler beim Senden. Bitte versuchen Sie es erneut.',
    // new password panel
    newpw_title: 'Neues Passwort',
    newpw_sub: 'Wählen Sie ein neues Passwort für Ihr Konto.',
    lbl_new_pw: 'Neues Passwort',
    lbl_new_pw2: 'Passwort bestätigen',
    newpw_submit: 'Passwort ändern',
    newpw_saving: 'Wird gespeichert…',
    newpw_mismatch: 'Die Passwörter stimmen nicht überein.',
    newpw_short: (min = 12) => `Das Passwort muss mindestens ${min} Zeichen lang sein.`,
    newpw_success: 'Passwort geändert. Sie werden weitergeleitet…',
    newpw_error: 'Fehler beim Ändern des Passworts. Bitte versuchen Sie es erneut.',
  },
};

// Produkt ist nur Deutsch (Entscheidung 28.09.2026) — kein Sprachumschalter, kein infinity_lang.
const lang = 'de';

function applyLang() {
  const t = T[lang];
  document.documentElement.lang = lang;
  document.getElementById('title').textContent = t.title;
  document.getElementById('sub').textContent = t.sub;
  document.getElementById('lbl_email').textContent = t.lbl_email;
  document.getElementById('lbl_pass').textContent = t.lbl_pass;
  document.getElementById('submitBtn').textContent = t.submit;
  document.getElementById('forgotLink').textContent = t.forgot;
  // In der Box entfernt (IST_KUTU, siehe unten) — ungeschützter Zugriff hier
  // würfe sonst einen TypeError und bräche alles danach ab (O-68, onprem-Review 12.09.2026).
  if (!IST_KUTU) {
    document.getElementById('backLink').textContent = t.back;
    document.getElementById('regText').textContent = t.reg_text;
    document.getElementById('regBtn').textContent = t.reg_btn;
  }
  // confirm banner
  document.getElementById('confirmBannerText').textContent = t.confirm_banner;
  document.getElementById('resendBtn').textContent = t.resend_btn;
  // reset panel
  document.getElementById('resetSub').textContent = t.reset_sub;
  document.getElementById('lbl_reset_email').textContent = t.lbl_reset_email;
  document.getElementById('resetSubmitBtn').textContent = t.reset_submit;
  document.getElementById('resetBackLink').textContent = t.reset_back;
  // new-pw panel
  document.getElementById('newPwTitle').textContent = t.newpw_title;
  document.getElementById('newPwSub').textContent = t.newpw_sub;
  document.getElementById('lbl_new_pw').textContent = t.lbl_new_pw;
  document.getElementById('lbl_new_pw2').textContent = t.lbl_new_pw2;
  document.getElementById('newPwSubmitBtn').textContent = t.newpw_submit;
}

// ── View helpers ─────────────────────────────────────────────────────────────
const loginForm     = document.getElementById('loginForm');
const registerBlock = document.querySelector('.register-block');
const resetPanel    = document.getElementById('resetPanel');
const newPwPanel    = document.getElementById('newPwPanel');
const erstPanel     = document.getElementById('erstPanel');

function showView(view) {
  loginForm.style.display     = view === 'login'  ? '' : 'none';
  registerBlock.style.display = view === 'login'  ? '' : 'none';
  resetPanel.style.display    = view === 'reset'  ? '' : 'none';
  newPwPanel.style.display    = view === 'newpw'  ? '' : 'none';
  erstPanel.style.display     = view === 'erst'   ? '' : 'none';
  // Erstanmeldung bringt eigene Überschrift mit — "Anmelden" darüber wäre doppelt
  document.getElementById('title').style.display = view === 'erst' ? 'none' : '';
  document.getElementById('sub').style.display   = view === 'erst' ? 'none' : '';
}

function showMsg(text, type) {
  msg.textContent = text;
  msg.className = `msg show ${type}`;
}
function clearMsg() {
  msg.className = 'msg';
  msg.textContent = '';
}

function showPanelMsg(panelMsgId, text, type) {
  const el = document.getElementById(panelMsgId);
  el.textContent = text;
  el.className = `msg show ${type}`;
}

let pendingResendEmail = '';

applyLang();

// O-58 (a), 12.09.2026: in der Box gibt es weder /vorregistrierung.html noch
// /impressum.html · /datenschutz.html · /agb.html (nicht gepackt, Faz 2.0)
// noch eine sinnvolle Rückkehr zur SaaS-Marketingseite. Entfernen statt
// verstecken — showView() togglet .register-block sonst zwischen Login/Reset
// wieder sichtbar.
if (IST_KUTU) {
  registerBlock.remove();
  document.getElementById('backHome')?.remove();
  document.getElementById('saasFooter')?.remove();
}

const ADMIN_URL = 'https://admin.praxura.de/';

async function isAdmin(userId) {
  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function routeAfterAuth(userId) {
  if (await isAdmin(userId)) { window.location.href = ADMIN_URL; return; }
  window.location.href = 'dashboard.html';
}

// PASSWORD_RECOVERY fires when user clicks the reset-password email link (PKCE flow)
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') showView('newpw');
});

const msg = document.getElementById('message');

// Detect implicit-flow recovery token in URL hash (non-PKCE fallback)
const hashParams = new URLSearchParams(window.location.hash.slice(1));
if (hashParams.get('type') === 'recovery') {
  showView('newpw');
} else {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await routeAfterAuth(session.user.id);
}

// ── Login form ────────────────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();
  document.getElementById('confirmBanner').style.display = 'none';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('submitBtn');
  const t = T[lang];

  btn.disabled = true;
  btn.textContent = t.loading;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const isNotConfirmed = /not confirmed|email_not_confirmed/i.test(error.message)
      || error.code === 'email_not_confirmed';

    if (isNotConfirmed) {
      pendingResendEmail = email;
      document.getElementById('confirmBannerText').textContent = T[lang].confirm_banner;
      document.getElementById('resendBtn').textContent = T[lang].resend_btn;
      document.getElementById('confirmBanner').style.display = '';
    } else {
      const text = /invalid|credentials/i.test(error.message) ? t.err_credentials : t.err_generic;
      showMsg(text, 'error');
    }
    btn.disabled = false;
    btn.textContent = t.submit;
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  await routeAfterAuth(user.id);
});

// ── Resend confirmation email ─────────────────────────────────────────────────
document.getElementById('resendBtn').addEventListener('click', async () => {
  const t = T[lang];
  const btn = document.getElementById('resendBtn');
  btn.disabled = true;
  btn.textContent = t.resend_sending;

  const { error } = await supabase.auth.resend({ type: 'signup', email: pendingResendEmail });

  if (error) {
    btn.textContent = t.resend_error;
    btn.disabled = false;
  } else {
    document.getElementById('confirmBannerText').textContent = t.resend_success;
    btn.style.display = 'none';
  }
});

// ── Forgot password: show panel ───────────────────────────────────────────────
document.getElementById('forgotLink').addEventListener('click', (e) => {
  e.preventDefault();
  // Kein Mailversand mehr: Hinweis statt resetPasswordForEmail
  // Box (O-142): kein Mailversand, kein Support-Postfach — der Inhaber setzt
  // sein Passwort am Server mit reset-owner-passwort.sh zurueck (O-107).
  showMsg(IST_KUTU
    ? 'Mitarbeiter: Bitte lassen Sie sich von Ihrer Praxisleitung einen neuen Einrichtungscode geben. Praxisinhaber: Passwort am Server mit „sudo bash reset-owner-passwort.sh“ neu setzen (siehe Installationsanleitung).'
    : 'Mitarbeiter: Bitte lassen Sie sich von Ihrer Praxisleitung einen neuen Einrichtungscode geben. Praxisinhaber: Bitte wenden Sie sich an kontakt@praxura.de.', 'error');
});

document.getElementById('resetBackLink').addEventListener('click', (e) => {
  e.preventDefault();
  showView('login');
});

document.getElementById('resetSubmitBtn').addEventListener('click', async () => {
  const t = T[lang];
  const email = document.getElementById('resetEmail').value.trim();
  const btn = document.getElementById('resetSubmitBtn');
  if (!email) return;

  btn.disabled = true;
  btn.textContent = t.resend_sending;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login.html`,
  });

  if (error) {
    showPanelMsg('resetMsg', t.reset_error, 'error');
  } else {
    showPanelMsg('resetMsg', t.reset_success, 'success');
  }
  btn.disabled = false;
  btn.textContent = t.reset_submit;
});

// ── New password form (after recovery link click) ─────────────────────────────
document.getElementById('newPwSubmitBtn').addEventListener('click', async () => {
  const t = T[lang];
  const pw  = document.getElementById('newPw').value;
  const pw2 = document.getElementById('newPw2').value;
  const btn = document.getElementById('newPwSubmitBtn');

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  let role;
  if (userId) {
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    role = prof?.role;
  }
  const min = minPasswortLaenge(role);

  if (pw.length < min) { showPanelMsg('newPwMsg', t.newpw_short(min), 'error'); return; }
  if (pw !== pw2)    { showPanelMsg('newPwMsg', t.newpw_mismatch, 'error'); return; }

  btn.disabled = true;
  btn.textContent = t.newpw_saving;

  const { error } = await supabase.auth.updateUser({ password: pw });

  if (error) {
    showPanelMsg('newPwMsg', t.newpw_error, 'error');
    btn.disabled = false;
    btn.textContent = t.newpw_submit;
  } else {
    showPanelMsg('newPwMsg', t.newpw_success, 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1800);
  }
});

// ── Erstanmeldung mit Einrichtungscode ────────────────────────────────────────
document.getElementById('erstLink').addEventListener('click', (e) => {
  e.preventDefault();
  clearMsg();
  const loginEmail = document.getElementById('email').value.trim();
  if (loginEmail) document.getElementById('erstEmail').value = loginEmail;
  showView('erst');
});
document.getElementById('erstBackLink').addEventListener('click', (e) => {
  e.preventDefault();
  showView('login');
});
document.getElementById('erstSubmitBtn').addEventListener('click', async () => {
  const email = document.getElementById('erstEmail').value.trim();
  const code = document.getElementById('erstCode').value.trim();
  const pw = document.getElementById('erstPw').value;
  const pw2 = document.getElementById('erstPw2').value;
  const btn = document.getElementById('erstSubmitBtn');
  if (!email || !code) { showPanelMsg('erstMsg', 'Bitte E-Mail-Adresse und Einrichtungscode eingeben.', 'error'); return; }
  if (pw.length < MIN_MITARBEITER) { showPanelMsg('erstMsg', `Das Passwort muss mindestens ${MIN_MITARBEITER} Zeichen lang sein.`, 'error'); return; }
  if (pw !== pw2) { showPanelMsg('erstMsg', 'Die Passwörter stimmen nicht überein.', 'error'); return; }
  btn.disabled = true;
  try {
    const res = await fetch(API_BASE + '/team/erstanmeldung', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, passwort: pw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showPanelMsg('erstMsg', data.error || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.', 'error'); return; }
    document.getElementById('erstPw').value = '';
    document.getElementById('erstPw2').value = '';
    document.getElementById('erstCode').value = '';
    document.getElementById('email').value = email;
    showView('login');
    showMsg('Passwort gesetzt. Sie können sich jetzt anmelden.', 'success');
  } catch (err) {
    showPanelMsg('erstMsg', 'Verbindung zum Server fehlgeschlagen. Bitte versuchen Sie es erneut.', 'error');
  } finally {
    btn.disabled = false;
  }
});
