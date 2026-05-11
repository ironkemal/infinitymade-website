import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

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

let calYear, calMonth;

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];

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

  const empBlock = document.getElementById('selEmpBlock');
  if (state.employeeName) {
    empBlock.classList.add('show');
    document.getElementById('selEmpVal').textContent = state.employeeName;
  }
  const srvBlock = document.getElementById('selSrvBlock');
  if (state.serviceTitle) {
    srvBlock.classList.add('show');
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
  document.getElementById('bizOwner').textContent  = '';

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
      initCalendar();
      goStep('datetime');
    });
  });
}

function initCalendar() {
  const today = new Date();
  calYear  = today.getFullYear();
  calMonth = today.getMonth();
  document.getElementById('btnToForm').disabled = true;
  document.getElementById('slotsDayLabel').style.display = 'none';
  document.getElementById('slotsList').innerHTML = '<div class="slots-empty">Bitte Datum wählen</div>';

  document.getElementById('calPrev').onclick = () => {
    const now = new Date();
    if (calYear === now.getFullYear() && calMonth <= now.getMonth()) return;
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  };
  document.getElementById('calNext').onclick = () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  };

  renderCalendar();
  const todayStr = today.toISOString().split('T')[0];
  selectDay(todayStr);
}

function renderCalendar() {
  document.getElementById('calMonthLabel').innerHTML =
    `${MONTHS[calMonth]} <em>${calYear}</em>`;

  const today = new Date(); today.setHours(0,0,0,0);
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  for (let i = 0; i < firstDow; i++) {
    const el = document.createElement('div');
    el.className = 'cal-cell empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(calYear, calMonth, d);
    const dateStr = date.toISOString().split('T')[0];
    const isPast  = date < today;
    const isToday = date.getTime() === today.getTime();
    const isSel   = dateStr === state.selectedDate;

    const btn = document.createElement('button');
    btn.className = 'cal-cell';
    btn.textContent = d;

    if (isPast) {
      btn.classList.add('past');
    } else {
      btn.classList.add('avail');
      if (isToday) btn.classList.add('today');
      if (isSel)   btn.classList.add('selected');
      if (isSel)   btn.classList.add('has-dot');
      btn.addEventListener('click', () => selectDay(dateStr));
    }
    grid.appendChild(btn);
  }
}

async function selectDay(dateStr) {
  state.selectedDate = dateStr;
  state.selectedTime = null;
  document.getElementById('btnToForm').disabled = true;
  renderCalendar();

  const date = new Date(dateStr);
  const label = `${DAYS_SHORT[date.getDay()]} ${date.getDate()}`;
  const dayLabelEl = document.getElementById('slotsDayLabel');
  dayLabelEl.textContent = label;
  dayLabelEl.style.display = 'block';

  const list = document.getElementById('slotsList');
  list.innerHTML = '<div class="slots-empty">Lade…</div>';

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
    list.innerHTML = '';

    if (data.slots && data.slots.length) {
      data.slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.className = 'slot-btn';
        btn.innerHTML = `<span class="slot-dot"></span>${slot}`;
        btn.addEventListener('click', () => {
          document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('picked'));
          btn.classList.add('picked');
          state.selectedTime = slot;
          document.getElementById('btnToForm').disabled = false;
          updateSidebar();
        });
        list.appendChild(btn);
      });
    } else {
      list.innerHTML = '<div class="slots-empty">Keine Termine verfügbar.</div>';
    }
  } catch(e) {
    list.innerHTML = '<div class="slots-empty" style="color:#ef4444;">Fehler beim Laden.</div>';
  }
  updateSidebar();
}

document.getElementById('backToEmp').addEventListener('click', () => goStep('employees'));
document.getElementById('backToSrv').addEventListener('click', () => goStep('services'));
document.getElementById('backToCal').addEventListener('click', () => goStep('datetime'));
document.getElementById('btnToForm').addEventListener('click', () => goStep('form'));

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
