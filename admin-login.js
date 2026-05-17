import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

// Dedicated admin auth — isolated from tenant app.
// Uses a separate localStorage key so a logged-in tenant on app.infinitymade.de
// CANNOT leak their session into admin.infinitymade.de and vice versa.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'sb-admin-auth' }
});

const ADMIN_HOME = '/';        // admin.infinitymade.de/  → rewritten to admin.html
const TENANT_LOGIN = 'https://app.infinitymade.de/login.html';

const msg = document.getElementById('message');
function showMsg(text, type) { msg.textContent = text; msg.className = `msg show ${type}`; }
function clearMsg() { msg.className = 'msg'; msg.textContent = ''; }

async function isAdmin(userId) {
  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

// If already signed in as admin → straight to admin home.
// If signed in as non-admin → sign out (wrong session leaked in) and let them log in fresh.
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  if (await isAdmin(session.user.id)) {
    window.location.href = ADMIN_HOME;
  } else {
    await supabase.auth.signOut();
  }
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('submitBtn');

  btn.disabled = true;
  btn.textContent = 'Wird geladen…';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showMsg('E-Mail oder Passwort ist falsch.', 'error');
    btn.disabled = false;
    btn.textContent = 'Anmelden';
    return;
  }

  // Verify admin AFTER auth succeeds — never reveal admin status before correct credentials.
  if (!(await isAdmin(data.user.id))) {
    await supabase.auth.signOut();
    showMsg('Kein Administrator-Zugang für dieses Konto.', 'error');
    btn.disabled = false;
    btn.textContent = 'Anmelden';
    setTimeout(() => { window.location.href = TENANT_LOGIN; }, 2000);
    return;
  }

  window.location.href = ADMIN_HOME;
});
