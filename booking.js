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

  const empBlock = document.getElementById('selEmpBlock');
  if (state.employeeName) {
    empBlock.classList.add('show');
    document.getElementById('selEmpVal').textContent = state.employeeName;
  } else {
    empBlock.classList.remove('show');
  }

  const srvBlock = document.getElementById('selSrvBlock');
  if (state.serviceTitle) {
    srvBlock.classList.add('show');
    document.getElementById('selSrvVal').textContent = `${state.serviceTitle} (${state.durationMinutes} Min)`;
    document.getElementById('bizDuration').textContent = state.durationMinutes + ' Min';
  } else {
    srvBlock.classList.remove('show');
    document.getElementById('bizDuration').textContent = '–';
  }

  const dateBlock = document.getElementById('selDateBlock');
  if (state.selectedDate && state.selectedTime) {
    dateBlock.classList.add('show');
    const d = new Date(state.selectedDate).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    document.getElementById('selDateVal').textContent = `${d} · ${state.selectedTime} Uhr`;
  } else {
    dateBlock.classList.remove('show');
  }
}

async function init() {
  console.log('[booking] identifier:', identifier);
  if (!identifier) { showError('Ungültiger Buchungslink.'); return; }
  const isUUID = s => s.length === 36 && s.includes('-');
  let q = supabase.from('profiles_public').select('id,business_name,company_code,owner_first_name,owner_last_name,accepts_bookings,role,owner_id');
  if (isUUID(identifier)) {
    q = q.eq('id', identifier);
  } else if (identifier.toUpperCase().startsWith('INF-')) {
    q = q.eq('company_code', identifier.toUpperCase());
  } else if (identifier.toLowerCase().includes('booking.html?u=')) {
    q = q.ilike('booking_slug', `%${identifier.toLowerCase().split('booking.html?u=')[1]}`);
  } else {
    q = q.ilike('booking_slug', `%/booking.html?u=${identifier.toLowerCase()}`);
  }
  const { data: profile, error } = await q.maybeSingle();
  if (error) console.error('[booking] supabase error:', error);
  if (!profile) { showError('Unternehmen nicht gefunden.'); return; }

  const isEmployee = profile.role === 'employee' && profile.owner_id;
  state.ownerId = isEmployee ? profile.owner_id : profile.id;
  state.employeeId = isEmployee ? profile.id : null;
  state.companyName = profile.business_name;
  document.getElementById('bizAvatar').textContent = profile.business_name.charAt(0).toUpperCase();
  document.getElementById('bizName').textContent = profile.business_name;

  const ownerName = profile.owner_first_name && profile.owner_last_name
    ? profile.owner_first_name + ' ' + profile.owner_last_name
    : '';
  document.getElementById('bizOwner').textContent = ownerName;

  if (profile.accepts_bookings === false) {
    document.getElementById('empList').innerHTML = '<div class="slots-empty">Dieses Unternehmen nimmt derzeit keine Online-Termine an.<br>Bitte kontaktieren Sie uns telefonisch.</div>';
    return;
  }

  if (isEmployee) {
    state.employeeName = profile.business_name || profile.email?.split('@')[0] || 'Mitarbeiter';
    state.ownerId = profile.owner_id || profile.id;
    updateSidebar();
    document.getElementById('backToEmp').style.display = 'none';
    await loadServices(state.employeeId);
    return;
  }

  updateSidebar();

  const { data: employees } = await supabase.from('profiles_public')
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
      state.employeeId = btn.dataset.id;
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
    // Check if service has multiple durations in price_config
    const hasMultipleDurations = s.price_config?.durations && Object.keys(s.price_config.durations).length > 1;
    // Get the first available duration as default, or use duration_minutes
    const defaultDuration = hasMultipleDurations
      ? Object.keys(s.price_config.durations).filter(k => s.price_config.durations[k].active)[0]
      : s.duration_minutes;
    const durationLabel = hasMultipleDurations ? 'Auswahl' : (defaultDuration ? defaultDuration + ' Min' : '');

    return `<button class="list-btn srv-btn" data-id="${s.id}" data-title="${s.title}" data-dur="${defaultDuration || 30}" data-buf="${s.buffer_time || 0}" data-has-durations="${hasMultipleDurations}">
      <div class="list-btn-title">${s.title}</div>
      <div class="list-btn-sub">${durationLabel}${s.buffer_time ? ' + ' + s.buffer_time + ' Min Puffer' : ''}${s.price ? ' · ' + s.price : ''}</div>
    </button>`;
  }).join('');

  document.querySelectorAll('.srv-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.srv-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.serviceId = btn.dataset.id;
      state.serviceTitle = btn.dataset.title;
      state.bufferMinutes = parseInt(btn.dataset.buf) || 0;
      state.selectedDate = null;
      state.selectedTime = null;

      // Check if service has multiple durations (physio)
      // Use data attribute if available to avoid extra query
      const hasDurations = btn.dataset.hasDurations === 'true';
      let durations, durKeys;

      if (hasDurations) {
        // Already know it has durations, fetch price_config
        const { data: srvData } = await supabase.from('services').select('price_config').eq('id', state.serviceId).single();
        durations = srvData?.price_config?.durations;
        durKeys = durations ? Object.keys(durations).filter(k => durations[k].active) : [];
      } else {
        // Single duration service - use button data
        state.durationMinutes = parseInt(btn.dataset.dur) || 30;
        updateSidebar();
        mountBookingCalendar();
        goStep('datetime');
        return;
      }

      // Show duration selection step
      document.getElementById('durList').innerHTML = durKeys.map(k => `
        <button class="list-btn dur-btn" data-dur="${k}">
          <div class="list-btn-title">${k} Minuten</div>
          <div class="list-btn-sub">${durations[k].price ? durations[k].price + ' €' : 'Preis nicht festgelegt'}</div>
        </button>
      `).join('');
      document.querySelectorAll('.dur-btn').forEach(b => {
        b.addEventListener('click', () => {
          document.querySelectorAll('.dur-btn').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          state.durationMinutes = parseInt(b.dataset.dur);
          updateSidebar();
          mountBookingCalendar();
          goStep('datetime');
        });
      });
      goStep('duration');
    });
  });
}

let bkScheduleDate = new Date();

async function loadBookingSlots(date) {
  bkScheduleDate = date;
  const labelEl = document.getElementById('bkDateLabel');
  const listEl = document.getElementById('bkSlotsList');
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const fmtDate = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  labelEl.textContent = isToday ? `Heute, ${fmtDate}` : fmtDate;
  listEl.innerHTML = '<div class="slots-empty">Laden…</div>';

  const tz = 'Europe/Berlin';
  const dStr = date.toLocaleDateString('sv-SE', { timeZone: tz });
  state.selectedDate = dStr;
  state.selectedTime = null;
  updateSidebar();

  const { data: customDay } = await supabase.from('custom_days')
    .select('type,note,start_time,end_time')
    .eq('owner_id', state.ownerId)
    .eq('date', dStr)
    .maybeSingle();

  const isFullDay = customDay && !customDay.start_time && !customDay.end_time;
  if (isFullDay && (customDay.type === 'closed' || customDay.type === 'holiday')) {
    listEl.innerHTML = `<div class="slots-empty">Geschlossen${customDay.note ? ': ' + customDay.note : ''}</div>`;
    return;
  }

  try {
    const res = await fetch(`${API}/booking/get-slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.employeeId,
        date: dStr,
        duration: state.durationMinutes,
        buffer: state.bufferMinutes,
        step: 30
      })
    });
    const data = await res.json();
    let slots = data.slots || [];
    const tz = 'Europe/Berlin';
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE', { timeZone: tz });
    const nowTimeStr = now.toLocaleTimeString('sv-SE', { timeZone: tz, hour12: false });
    const [nh, nm] = nowTimeStr.split(':').map(Number);
    const minTotalMin = nh * 60 + nm + 30;
    slots = slots.filter(slot => {
      if (dStr !== todayStr) return true;
      const [sh, sm] = slot.split(':').map(Number);
      return sh * 60 + sm >= minTotalMin;
    });
    if (!slots.length) {
      listEl.innerHTML = '<div class="slots-empty">Keine Termine verfügbar.</div>';
      return;
    }
    listEl.innerHTML = slots.map((slot) => {
      return `<button class="gap-card" data-time="${slot}">
        <div class="gap-card-top">
          <span class="gap-card-dur">${state.durationMinutes} Min</span>
        </div>
        <div class="gap-card-time">${slot} Uhr</div>
      </button>`;
    }).join('');
    listEl.querySelectorAll('.gap-card').forEach(btn => {
      btn.addEventListener('click', () => {
        listEl.querySelectorAll('.gap-card').forEach(b => b.classList.remove('picked'));
        btn.classList.add('picked');
        state.selectedTime = btn.dataset.time;
        updateSidebar();
        setTimeout(() => goStep('form'), 200);
      });
    });
  } catch (e) {
    listEl.innerHTML = '<div class="slots-empty">Fehler beim Laden.</div>';
  }
}

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

async function renderBookingCalendar(year, month) {
  const grid = document.getElementById('bkCalGrid');
  const label = document.getElementById('calMonthLabel');
  if (!grid || !label) return;

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  label.innerHTML = `${monthNames[month]} <em>${year}</em>`;

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const tz = 'Europe/Berlin';
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
  const todayParts = todayStr.split('-').map(Number);
  const todayY = todayParts[0], todayM = todayParts[1], todayD = todayParts[2];

  const userId = state.employeeId;
  const monthStartIso = new Date(year, month, 1).toISOString();
  const monthEndIso = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  let openDow = new Set([1, 2, 3, 4, 5]);
  let closedDates = new Set();
  let bookedDates = new Set();

  if (userId) {
    const [{ data: wh }, { data: cd }, { data: bks }] = await Promise.all([
      supabase.from('working_hours').select('day_of_week,is_active').eq('user_id', userId),
      supabase.from('custom_days').select('date,type,start_time,end_time').eq('owner_id', state.ownerId).gte('date', `${year}-${String(month + 1).padStart(2, '0')}-01`).lte('date', `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`),
      supabase.from('bookings').select('start_time').eq('user_id', userId).gte('start_time', monthStartIso).lte('start_time', monthEndIso).neq('status', 'cancelled')
    ]);
    openDow = new Set((wh || []).filter(w => w.is_active).map(w => w.day_of_week));
    (cd || []).forEach(c => {
      if (!c.start_time && !c.end_time && (c.type === 'closed' || c.type === 'holiday')) closedDates.add(c.date);
    });
    (bks || []).forEach(b => {
      const d = new Date(b.start_time).toLocaleDateString('sv-SE', { timeZone: tz });
      bookedDates.add(d);
    });
  }

  let html = '';
  for (let i = 0; i < startOffset; i++) html += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dStr = dateObj.toLocaleDateString('sv-SE', { timeZone: tz });
    const isPast = dStr < todayStr;
    const isToday = dStr === todayStr;
    const isSelected = bkScheduleDate && dateObj.toDateString() === new Date(bkScheduleDate.getFullYear(), bkScheduleDate.getMonth(), bkScheduleDate.getDate()).toDateString();
    const dow = dateObj.getDay();
    const isClosedDow = !openDow.has(dow);
    const isClosedDate = closedDates.has(dStr);
    const isBooked = bookedDates.has(dStr);

    let cls = 'cal-cell';
    if (isPast) cls += ' past';
    else if (isClosedDow || isClosedDate) cls += ' unavailable';
    else cls += ' avail';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';
    if (isBooked && !isPast && !isClosedDow && !isClosedDate) cls += ' booked';

    html += `<button class="${cls}" data-day="${d}" type="button">${d}</button>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.cal-cell.avail, .cal-cell.today, .cal-cell.booked').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.dataset.day);
      const selected = new Date(year, month, day);
      grid.querySelectorAll('.cal-cell').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      loadBookingSlots(selected);
    });
  });
}

document.getElementById('calPrevMonth').addEventListener('click', async () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  await renderBookingCalendar(calYear, calMonth);
});
document.getElementById('calNextMonth').addEventListener('click', async () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  await renderBookingCalendar(calYear, calMonth);
});

async function mountBookingCalendar() {
  bkScheduleDate = new Date();
  calYear = bkScheduleDate.getFullYear();
  calMonth = bkScheduleDate.getMonth();
  await renderBookingCalendar(calYear, calMonth);
  await loadBookingSlots(bkScheduleDate);
}

document.getElementById('backToEmp').addEventListener('click', () => goStep('employees'));
document.getElementById('backToSrv').addEventListener('click', () => goStep('services'));
document.getElementById('backToSrvDur')?.addEventListener('click', () => goStep('services'));
document.getElementById('backToCal').addEventListener('click', () => goStep('datetime'));

document.getElementById('bookingForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Wird gebucht…';
  try {
    const tz = 'Europe/Berlin';
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE', { timeZone: tz });
    const nowTimeStr = now.toLocaleTimeString('sv-SE', { timeZone: tz, hour12: false });
    const [nh, nm] = nowTimeStr.split(':').map(Number);
    const minTotalMin = nh * 60 + nm + 30;
    const [sh, sm] = state.selectedTime.split(':').map(Number);
    if (state.selectedDate === todayStr && sh * 60 + sm < minTotalMin) {
      alert('Bitte wählen Sie einen Termin mindestens 30 Minuten in der Zukunft.');
      btn.disabled = false; btn.textContent = 'Termin verbindlich buchen';
      return;
    }
    const res = await fetch(`${API}/booking/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerId: state.ownerId,
        userId: state.employeeId,
        serviceId: state.serviceId,
        date: state.selectedDate,
        time: state.selectedTime,
        customerName: document.getElementById('custName').value,
        customerEmail: document.getElementById('custEmail').value,
        customerPhone: document.getElementById('custPhone').value
      })
    });
    if (!res.ok) throw new Error('Buchung fehlgeschlagen');
    goStep('success');
  } catch (err) {
    alert('Fehler: ' + err.message);
    btn.disabled = false; btn.textContent = 'Termin verbindlich buchen';
  }
});

init();
