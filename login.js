import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

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
    reg_btn: 'Get Started',
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
    newpw_short: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
    newpw_success: 'Passwort geändert. Sie werden weitergeleitet…',
    newpw_error: 'Fehler beim Ändern des Passworts. Bitte versuchen Sie es erneut.',
  },
  en: {
    title: 'Sign in',
    sub: 'Welcome back. Enter your credentials.',
    lbl_email: 'Email',
    lbl_pass: 'Password',
    submit: 'Sign in',
    forgot: 'Forgot password?',
    back: '← Back to home',
    err_credentials: 'Invalid email or password.',
    err_generic: 'Something went wrong. Please try again.',
    loading: 'Loading…',
    reg_text: 'No account yet?',
    reg_btn: 'Get Started',
    confirm_banner: 'Your email address has not been confirmed yet. Please click the link in the confirmation email.',
    resend_btn: 'Resend confirmation email',
    resend_sending: 'Sending…',
    resend_success: 'Email sent. Please check your inbox (including spam).',
    resend_error: 'Failed to send. Please try again.',
    reset_sub: 'Enter your email address — we will send you a reset link.',
    lbl_reset_email: 'Email',
    reset_submit: 'Send link',
    reset_back: '← Back to sign in',
    reset_success: 'Email sent. Please check your inbox.',
    reset_error: 'Failed to send. Please try again.',
    newpw_title: 'New password',
    newpw_sub: 'Choose a new password for your account.',
    lbl_new_pw: 'New password',
    lbl_new_pw2: 'Confirm password',
    newpw_submit: 'Change password',
    newpw_saving: 'Saving…',
    newpw_mismatch: 'Passwords do not match.',
    newpw_short: 'Password must be at least 8 characters.',
    newpw_success: 'Password changed. Redirecting…',
    newpw_error: 'Failed to change password. Please try again.',
  },
  tr: {
    title: 'Giriş Yap',
    sub: 'Tekrar hoş geldiniz. Bilgilerinizi girin.',
    lbl_email: 'E-posta',
    lbl_pass: 'Şifre',
    submit: 'Giriş Yap',
    forgot: 'Şifremi unuttum',
    back: '← Anasayfaya dön',
    err_credentials: 'E-posta veya şifre hatalı.',
    err_generic: 'Bir hata oluştu. Lütfen tekrar deneyin.',
    loading: 'Yükleniyor…',
    reg_text: 'Henüz hesabın yok mu?',
    reg_btn: 'Get Started',
    confirm_banner: 'E-posta adresiniz henüz doğrulanmadı. Lütfen doğrulama e-postasındaki bağlantıya tıklayın.',
    resend_btn: 'Doğrulama e-postasını yeniden gönder',
    resend_sending: 'Gönderiliyor…',
    resend_success: 'E-posta gönderildi. Gelen kutunuzu kontrol edin (spam dahil).',
    resend_error: 'Gönderilemedi. Lütfen tekrar deneyin.',
    reset_sub: 'E-posta adresinizi girin — size bir sıfırlama bağlantısı göndereceğiz.',
    lbl_reset_email: 'E-posta',
    reset_submit: 'Bağlantı gönder',
    reset_back: '← Giriş sayfasına dön',
    reset_success: 'E-posta gönderildi. Gelen kutunuzu kontrol edin.',
    reset_error: 'Gönderilemedi. Lütfen tekrar deneyin.',
    newpw_title: 'Yeni Şifre',
    newpw_sub: 'Hesabınız için yeni bir şifre seçin.',
    lbl_new_pw: 'Yeni şifre',
    lbl_new_pw2: 'Şifreyi onayla',
    newpw_submit: 'Şifreyi değiştir',
    newpw_saving: 'Kaydediliyor…',
    newpw_mismatch: 'Şifreler eşleşmiyor.',
    newpw_short: 'Şifre en az 8 karakter olmalıdır.',
    newpw_success: 'Şifre değiştirildi. Yönlendiriliyor…',
    newpw_error: 'Şifre değiştirilemedi. Lütfen tekrar deneyin.',
  }
};

let lang = localStorage.getItem('infinity_lang') || 'de';

function applyLang() {
  const t = T[lang];
  document.documentElement.lang = lang;
  document.getElementById('title').textContent = t.title;
  document.getElementById('sub').textContent = t.sub;
  document.getElementById('lbl_email').textContent = t.lbl_email;
  document.getElementById('lbl_pass').textContent = t.lbl_pass;
  document.getElementById('submitBtn').textContent = t.submit;
  document.getElementById('forgotLink').textContent = t.forgot;
  document.getElementById('backLink').textContent = t.back;
  document.getElementById('regText').textContent = t.reg_text;
  document.getElementById('regBtn').textContent = t.reg_btn;
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
  document.querySelectorAll('.lang-switch button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
}

// ── View helpers ─────────────────────────────────────────────────────────────
const loginForm     = document.getElementById('loginForm');
const registerBlock = document.querySelector('.register-block');
const resetPanel    = document.getElementById('resetPanel');
const newPwPanel    = document.getElementById('newPwPanel');

function showView(view) {
  loginForm.style.display     = view === 'login'  ? '' : 'none';
  registerBlock.style.display = view === 'login'  ? '' : 'none';
  resetPanel.style.display    = view === 'reset'  ? '' : 'none';
  newPwPanel.style.display    = view === 'newpw'  ? '' : 'none';
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

document.querySelectorAll('.lang-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang;
    localStorage.setItem('infinity_lang', lang);
    applyLang();
  });
});

applyLang();

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
  // Pre-fill with whatever email the user typed in the login form
  const loginEmail = document.getElementById('email').value.trim();
  if (loginEmail) document.getElementById('resetEmail').value = loginEmail;
  showView('reset');
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

  if (pw.length < 8) { showPanelMsg('newPwMsg', t.newpw_short, 'error'); return; }
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
