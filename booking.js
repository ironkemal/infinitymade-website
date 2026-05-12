import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API = 'https://n8n.infinitymade.de/api';

const params = new URLSearchParams(location.search);
const identifier = (params.get('u') || params.get('c') || '').trim();

const state = {
  ownerId: null, companyName: null,
  employeeId: null, employeeName: null,
  serviceId: null, serviceTitle: null, durationMinutes: null, bufferMinutes: 0,
  selectedDate: null, selectedTime: null
};

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
  let q = supabase.from('profiles').select('id,business_name,company_code,owner_first_name,owner_last_name,accepts_bookings,role,owner_id');
  if (isUUID(identifier)) {
    q = q.eq('id', identifier);
  } else if (identifier.toUpperCase().startsWith('INF-')) {
    q = q.eq('company_code', identifier.toUpperCase());
  } else {
    q = q.ilike('booking_slug', `%/booking.html?u=${identifier.toLowerCase()}`);
  }
  const { data: profile } = await q.maybeSingle();
  if (!profile) { showError('Unternehmen nicht gefunden.'); return; }

  const isEmployee = profile.role === 'employee' && profile.owner_id;
  state.ownerId    = isEmployee ? profile.owner_id : profile.id;
  state.employeeId = isEmployee ? profile.id : null;
  state.companyName = profile.business_name;
  document.getElementById('bizAvatar').textContent = profile.business_name.charAt(0).toUpperCase();
  document.getElementById('bizName').textContent   = profile.business_name;

  const ownerName = profile.owner_first_name && profile.owner_last_name
    ? profile.owner_first_name + ' ' + profile.owner_last_name
    : '';
  document.getElementById('bizOwner').textContent = ownerName;

  if (profile.accepts_bookings === false) {
    document.getElementById('empList').innerHTML = '<div class="slots-empty">Dieses Unternehmen nimmt derzeit keine Online-Termine an.<br>Bitte kontaktieren Sie uns telefonisch.</div>';
    return;
  }

  const { data: employees } = await supabase.from('profiles')
    .select('id,business_name,email,role,avatar_url')
    .or(`id.eq.${state.ownerId},owner_id.eq.${state.ownerId}`);

  if (!employees || !employees.length) {
    document.getElementById('empList').innerHTML = '<div class="slots-empty">Keine Mitarbeiter verfügbar.</div>';
    return;
  }

  document.getElementById('empList').innerHTML = employees.map(e => {
    const name = e.business_name || e.email.split('@')[0];
    const initial = (name[0] || '?').toUpperCase();
    const avatar = e.avatar_url ? `<img src="${e.avatar_url}" alt="">` : initial;
    return `<button class="list-btn emp-btn" data-id="${e.id}" data-name="${name}">
      <div class="emp-avatar" style="width:52px;height:52px;border-radius:50%;background:var(--green-dim);color:var(--green);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0;overflow:hidden;margin:0 auto 8px;">${avatar}</div>
      <div class="list-btn-title">${name}</div>
      <div class="list-btn-sub">${e.role === 'owner' ? 'Geschäftsführung' : 'Mitarbeiter'}</div>
    </button>`;
  }).join('');

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

  if (isEmployee && state.employeeId) {
    const autoBtn = document.querySelector(`.emp-btn[data-id="${state.employeeId}"]`);
    if (autoBtn) autoBtn.click();
  }
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

let bkScheduleDate = new Date();

async function loadBookingSlots(date) {
  bkScheduleDate = date;
  const labelEl = document.getElementById('bkDateLabel');
  const listEl  = document.getElementById('bkSlotsList');
  const today = new Date();
  const dayDiff = Math.round((date - new Date(today.toDateString())) / 86400000);
  const isToday = dayDiff === 0;
  const fmtDate = new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(date);
  labelEl.textContent = isToday ? `Heute, ${fmtDate}` : fmtDate;
  listEl.innerHTML = '<div class="slots-empty">Laden…</div>';

  const tz = 'Europe/Berlin';
  const dStr = date.toLocaleDateString('sv-SE',{timeZone:tz});
  state.selectedDate = dStr;
  state.selectedTime = null;
  updateSidebar();

  try {
    const res = await fetch(`${API}/booking/get-slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:   state.employeeId,
        date:     dStr,
        duration: state.durationMinutes,
        buffer:   state.bufferMinutes,
        step:     30
      })
    });
    const data = await res.json();
    const slots = data.slots || [];
    if (!slots.length) {
      listEl.innerHTML = '<div class="slots-empty">Keine Termine verfügbar.</div>';
      return;
    }
    const colors = ['#ff8c42','#06d6a0','#118ab2','#ef476f','#9b5de5'];
    listEl.innerHTML = slots.map((slot, i) => {
      const color = colors[i % colors.length];
      return `<button class="slot-card" data-time="${slot}" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;background:${color}22;border:1px solid ${color}55;border-radius:12px;color:var(--text);font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;text-align:left;transition:border-color .12s;">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
        <span>${slot} Uhr</span>
        <span style="margin-left:auto;font-size:12px;color:var(--muted);font-weight:500;">${state.durationMinutes} Min</span>
      </button>`;
    }).join('');
    listEl.querySelectorAll('.slot-card').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedTime = btn.dataset.time;
        updateSidebar();
        goStep('form');
      });
    });
  } catch(e) {
    listEl.innerHTML = '<div class="slots-empty">Fehler beim Laden.</div>';
  }
}

document.getElementById('bkPrev').addEventListener('click', () => {
  const d = new Date(bkScheduleDate); d.setDate(d.getDate()-1); loadBookingSlots(d);
});
document.getElementById('bkNext').addEventListener('click', () => {
  const d = new Date(bkScheduleDate); d.setDate(d.getDate()+1); loadBookingSlots(d);
});
document.getElementById('bkToday').addEventListener('click', () => loadBookingSlots(new Date()));

async function mountBookingCalendar() {
  bkScheduleDate = new Date();
  await loadBookingSlots(bkScheduleDate);
}

document.getElementById('backToEmp').addEventListener('click', () => goStep('employees'));
document.getElementById('backToSrv').addEventListener('click', () => goStep('services'));
document.getElementById('backToCal').addEventListener('click', () => goStep('datetime'));

document.getElementById('bookingForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Wird gebucht…';
  try {
    const res = await fetch(`${API}/booking/create`, {
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
