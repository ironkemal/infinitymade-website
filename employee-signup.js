import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const msg = document.getElementById('message');
function showMsg(text, type) {
  msg.textContent = text;
  msg.className = `msg show ${type}`;
}

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.className = 'msg';
  
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const companyCode = document.getElementById('company_code').value.trim().toUpperCase();
  const btn = document.getElementById('submitBtn');

  btn.disabled = true;
  btn.textContent = 'Lädt...';

  try {
    // 1. Verify Company Code via API (bypasses RLS)
    const res = await fetch('https://n8n.infinitymade.de/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: companyCode })
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Ungültiger Unternehmens-Code.');
    }
    
    const { ownerId } = await res.json();

    // 2. Sign Up
    const { data: authData, error: authErr } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: { full_name: name } // Save name in auth metadata
      }
    });

    if (authErr) throw authErr;

    // 3. Update Profile role & owner_id
    if (authData.user) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          role: 'employee',
          owner_id: ownerId,
          business_name: name // Use business_name as display name for simplicity in existing UI
        })
        .eq('id', authData.user.id);
        
      if (profileErr) {
        console.error('Profile update failed:', profileErr);
      }
    }

    showMsg('Konto erfolgreich erstellt! Sie werden weitergeleitet...', 'success');
    
    setTimeout(() => {
      window.location.href = 'kalender.html';
    }, 2000);

  } catch (error) {
    showMsg(error.message || 'Ein Fehler ist aufgetreten.', 'error');
    btn.disabled = false;
    btn.textContent = 'Konto erstellen';
  }
});
