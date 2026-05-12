import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];

function renderWorkingHours() {
  const container = document.getElementById('workingHoursList');
  container.innerHTML = DAYS.map((label, i) => `
    <div class="wh-row" data-day="${i}" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;min-width:80px;">
        <input type="checkbox" class="wh-active" checked />
        <span style="font-size:14px;font-weight:500;">${label}</span>
      </label>
      <div class="wh-times" style="display:flex;align-items:center;gap:6px;flex:1;">
        <input type="time" class="wh-start" value="09:00" required style="flex:1;min-width:90px;" />
        <span style="color:var(--text-muted);">–</span>
        <input type="time" class="wh-end" value="18:00" required style="flex:1;min-width:90px;" />
      </div>
    </div>
  `).join('');
}
renderWorkingHours();

function collectWorkingHours() {
  const rows = document.querySelectorAll('.wh-row');
  const hours = [];
  rows.forEach(row => {
    const day = parseInt(row.dataset.day);
    const isActive = row.querySelector('.wh-active').checked;
    const start = row.querySelector('.wh-start').value;
    const end = row.querySelector('.wh-end').value;
    hours.push({ day_of_week: day, is_active: isActive, start_time: start, end_time: end });
  });
  return hours;
}

// Auto-fill company code from URL
const params = new URLSearchParams(location.search);
const urlCode = params.get('code');
if (urlCode) {
  document.getElementById('company_code').value = urlCode.toUpperCase();
}

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
          business_name: name,
          plan: 'mitarbeiter',
          billing: null,
          plan_status: 'active'
        })
        .eq('id', authData.user.id);
        
      if (profileErr) {
        console.error('Profile update failed:', profileErr);
      }

      // 4. Save working hours
      const wh = collectWorkingHours();
      const whRows = wh.map(h => ({
        user_id: authData.user.id,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
        is_active: h.is_active
      }));
      const { error: whErr } = await supabase.from('working_hours').insert(whRows);
      if (whErr) {
        console.error('Working hours insert failed:', whErr);
      }
    }

    showMsg('Konto erfolgreich erstellt! Sie werden weitergeleitet...', 'success');
    
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2000);

  } catch (error) {
    showMsg(error.message || 'Ein Fehler ist aufgetreten.', 'error');
    btn.disabled = false;
    btn.textContent = 'Konto erstellen';
  }
});
