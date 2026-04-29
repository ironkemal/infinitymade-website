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
    reset_prompt: 'Bitte geben Sie Ihre E-Mail-Adresse ein:',
    reset_success: 'Wir haben Ihnen eine E-Mail mit Anweisungen geschickt.',
    loading: 'Wird geladen…'
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
    reset_prompt: 'Please enter your email address:',
    reset_success: 'We have sent you an email with instructions.',
    loading: 'Loading…'
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
    reset_prompt: 'Lütfen e-posta adresinizi girin:',
    reset_success: 'Yönergeleri içeren bir e-posta gönderdik.',
    loading: 'Yükleniyor…'
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
  document.querySelectorAll('.lang-switch button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
}

document.querySelectorAll('.lang-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang;
    localStorage.setItem('infinity_lang', lang);
    applyLang();
  });
});

applyLang();

const { data: { session } } = await supabase.auth.getSession();
if (session) window.location.href = '/dashboard.html';

const msg = document.getElementById('message');
function showMsg(text, type) {
  msg.textContent = text;
  msg.className = `msg show ${type}`;
}
function clearMsg() {
  msg.className = 'msg';
  msg.textContent = '';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('submitBtn');
  const t = T[lang];

  btn.disabled = true;
  btn.textContent = t.loading;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const text = /invalid|credentials/i.test(error.message) ? t.err_credentials : t.err_generic;
    showMsg(text, 'error');
    btn.disabled = false;
    btn.textContent = t.submit;
    return;
  }

  window.location.href = '/dashboard.html';
});

document.getElementById('forgotLink').addEventListener('click', async (e) => {
  e.preventDefault();
  const t = T[lang];
  const email = prompt(t.reset_prompt);
  if (!email) return;
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login.html`
  });
  showMsg(t.reset_success, 'success');
});
