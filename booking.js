import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { mountCalendar } from './calendar-widget.js?v=20260512h';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API = 'https://n8n.infinitymade.de';

const params = new URLSearchParams(location.search);
const identifier = (params.get('u') || params.get('c') || '').trim();

const state = {
  ownerId: null, companyName: null,
  employeeId: null, employeeName: null,
  serviceId: null, serviceTitle: null, durationMinutes: null, bufferMinutes: 0,
  selectedDate: null, selectedTime: null
};

let calWidget = null;

function goStep(id) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  document.getElementById('step-' + id).classList.add('active');
}

function showError(msg) {
  document.getElementById('bizName').textContent = 'Fehler';
  document.getElementById('empList').innerHTML = `<div style="color:#ef4444;font-size:14px;">${msg}</div>`;
}

function updateSidebar() {
  const hasSel = state.employeeName || state.serviceTitle || state.selectedTime;
  document.getElementById('selDivider').style.display = hasSel ? 'block' : 'none';

  if (state.employeeName) {
    document.getElementById('selEmpBlock').classList.add('show');
    document.getElementById('selEmpVal').textContent = state.employeeName;
  }
  if (state.serviceTitle) {
    document.getElementById('selSrvBlock').classList.add('show');
    document.getElementById('selSrvVal').textContent = `${state.serviceTitle} (${state.durationMinutes} Min)`;
    document.getElementById('bizDuration').textContent = state.durationMinutes + ' Min';
  }
  const dateBlock = document.getElementById('selDateBlock');
  if (state.selectedDate && state.selectedTime) {
    dateBlock.classList.add('show');
    const d = new Date(state.selectedDate).toLocaleDateString('de-DE', { weekday:'short', day:'numeric', month:'short' });
    document.getElementById('selDateVal').textContent = `${d} · ${state.selectedTime} Uhr`;
  } else {
    dateBlock.classList.remove('show');
  }
}

async function init() {
  if (!identifier) { showError('Ungültiger Buchungslink.'); return; }
  const isUUID = s => s.length === 36 && s.includes('-');
  let q = supabase.from('profiles').select('id,business_name,company_code');
  q = isUUID(identifier) ? q.eq('id', identifier) : q.eq('company_code', identifier.toUpperCase());
  const { data: profile } = await q.maybeSingle();
  if (!profile) { showError('Unternehmen nicht gefunden.'); return; }

  state.ownerId    = profile.id;
  state.companyName = profile.business_name;
  document.getElementById('bizAvatar').textContent = profile.business_name.charAt(0).toUpperCase();
  document.getElementById('bizName').textContent   = profile.business_name;

  const { data: employees } = await supabase.from('profiles')
    .select('id,business_name,email,role')
    .or(`id.eq.${state.ownerId},owner_id.eq.${state.ownerId}`);

  if (!employees || !employees.length) {
    document.getElementById('empList').innerHTML = '<div class="slots-empty">Keine Mitarbeiter verfügbar.</div>';
    return;
  }

  document.getElementById('empList').innerHTML = employees.map(e => `
    <button class="list-btn emp-btn" data-id="${e.id}" data-name="${e.business_name || e.email.split('@')[0]}">
      <div class="list-btn-title">${e.business_name || e.email.split('@')[0]}</div>
      <div class="list-btn-sub">${e.role === 'owner' ? 'Geschäftsführung' : 'Mitarbeiter'}</div>
    </button>`).join('');

  document.querySelectorAll('.emp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.employeeId   = btn.dataset.id;
      state.employeeName = btn.dataset.name;
      updateSidebar();
      loadServices(btn.dataset.id);
    });
  });
}

async function loadServices(empId) {
  document.getElementById('srvList').innerHTML = '<div class="slots-empty">Laden…</div>';
  goStep('services');

  const { data } = await supabase.from('employee_services').select('services(*)').eq('employee_id', empId);
  if (!data || !data.length) {
    document.getElementById('srvList').innerHTML = '<div class="slots-empty">Keine Dienstleistungen verfügbar.</div>';
    return;
  }

  document.getElementById('srvList').innerHTML = data.map(d => {
    const s = d.services;
    return `<button class="list-btn srv-btn" data-id="${s.id}" data-title="${s.title}" data-dur="${s.duration_minutes}" data-buf="${s.buffer_time || 0}">
      <div class="list-btn-title">${s.title}</div>
      <div class="list-btn-sub">${s.duration_minutes} Min${s.buffer_time ? ' + ' + s.buffer_time + ' Min Puffer' : ''}${s.price ? ' · ' + s.price : ''}</div>
    </button>`;
  }).join('');

  document.querySelectorAll('.srv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.srv-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.serviceId       = btn.dataset.id;
      state.serviceTitle    = btn.dataset.title;
      state.durationMinutes = parseInt(btn.dataset.dur);
      state.bufferMinutes   = parseInt(btn.dataset.buf) || 0;
      state.selectedDate    = null;
      state.selectedTime    = null;
      updateSidebar();
      mountBookingCalendar();
      goStep('datetime');
    });
  });
}

async function mountBookingCalendar() {
  const container = document.getElementById('calMount');
  container.innerHTML = '';

  let { data: wh } = await supabase.from('working_hours')
    .select('day_of_week,is_active').eq('user_id', state.employeeId);
  if ((wh || []).length === 0) {
    const { data: ownerWh } = await supabase.from('working_hours')
      .select('day_of_week,is_active').eq('user_id', state.ownerId);
    wh = ownerWh || [];
  }
  const offWeekdays = [];
  if ((wh || []).length > 0) {
    for (let d = 0; d < 7; d++) {
      const row = wh.find(w => w.day_of_week === d);
      if (!row || !row.is_active) offWeekdays.push(d);
    }
  }

  calWidget = mountCalendar(container, {
    minDate: new Date(),
    disabledWeekdays: offWeekdays,
    emptyText: 'Keine Termine verfügbar.',
    placeholder: 'Bitte Datum wählen',
    onDaySelect: async (dateStr) => {
      state.selectedDate = dateStr;
      state.selectedTime = null;
      updateSidebar();
      try {
        const res = await fetch(`${API}/api/booking/get-slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId:   state.employeeId,
            date:     dateStr,
            duration: state.durationMinutes,
            buffer:   state.bufferMinutes,
            step:     30
          })
        });
        const data = await res.json();
        return (data.slots || []).map(slot => ({
          label: slot,
          onClick: () => {
            state.selectedTime = slot;
            updateSidebar();
            goStep('form');
          }
        }));
      } catch(e) {
        return [];
      }
    }
  });
}

document.getElementById('backToEmp').addEventListener('click', () => goStep('employees'));
document.getElementById('backToSrv').addEventListener('click', () => goStep('services'));
document.getElementById('backToCal').addEventListener('click', () => goStep('datetime'));

document.getElementById('bookingForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Wird gebucht…';
  try {
    const res = await fetch(`${API}/api/booking/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerId:       state.ownerId,
        userId:        state.employeeId,
        serviceId:     state.serviceId,
        date:          state.selectedDate,
        time:          state.selectedTime,
        customerName:  document.getElementById('custName').value,
        customerEmail: document.getElementById('custEmail').value,
        customerPhone: document.getElementById('custPhone').value
      })
    });
    if (!res.ok) throw new Error('Buchung fehlgeschlagen');
    goStep('success');
  } catch(err) {
    alert('Fehler: ' + err.message);
    btn.disabled = false; btn.textContent = 'Termin verbindlich buchen';
  }
});

init();
