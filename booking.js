import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API_URL = 'https://n8n.infinitymade.de'; 

const urlParams = new URLSearchParams(window.location.search);
let identifier = urlParams.get('u') || urlParams.get('c'); 

let state = {
  ownerId: null,
  companyName: null,
  employeeId: null,
  employeeName: null,
  serviceId: null,
  serviceTitle: null,
  durationMinutes: null,
  selectedDate: null,
  selectedTime: null
};

window.goStep = function(stepId) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${stepId}`).classList.add('active');
};

async function init() {
  if (identifier) identifier = identifier.trim();

  const isUUID = (str) => typeof str === 'string' && str.length === 36 && str.includes('-');

  const showError = (title, desc) => {
    document.getElementById('bizName').textContent = "Fehler";
    document.getElementById('bizLogo').textContent = "!";
    document.getElementById('bizLogo').style.background = "var(--danger)";
    document.getElementById('step-employees').innerHTML = `
      <div style="text-align:center; padding: 40px 0; background: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid var(--danger);">
        <div style="font-size:50px; margin-bottom:15px;">🔍</div>
        <h3 style="color:#fff; margin-bottom:10px;">${title}</h3>
        <p style="color:var(--text-secondary);">${desc}</p>
      </div>`;
  };

  if (!identifier || identifier === 'null') {
    showError("Link ungültig", "Bitte prüfen Sie den Buchungslink. Es wurde kein gültiges Unternehmen angegeben.");
    return;
  }

  // Load Company Profile by UUID or company_code
  let query = supabase.from('profiles').select('id, business_name, company_code');
  if (isUUID(identifier)) {
    query = query.eq('id', identifier);
  } else {
    query = query.eq('company_code', identifier.toUpperCase());
  }

  const { data: profile } = await query.maybeSingle();
  if (profile && profile.business_name) {
    state.ownerId = profile.id;
    state.companyName = profile.business_name;
    document.getElementById('bizName').textContent = profile.business_name;
    document.getElementById('bizLogo').textContent = profile.business_name.charAt(0).toUpperCase();
  } else {
    showError("Unternehmen nicht gefunden", "Das gesuchte Unternehmen existiert nicht oder der Link ist veraltet.");
    return;
  }

  // Load Employees (Owner + their employees)
  const { data: employees, error } = await supabase.from('profiles')
    .select('id, business_name, email, role')
    .or(`id.eq.${state.ownerId},owner_id.eq.${state.ownerId}`);
    
  const eList = document.getElementById('publicEmployeeList');
  if (error || !employees || employees.length === 0) {
    eList.innerHTML = '<p style="color:var(--text-secondary)">Keine Mitarbeiter gefunden.</p>';
    return;
  }

  // Render Employee List
  eList.innerHTML = employees.map(emp => `
    <button class="list-btn employee-btn" id="emp-${emp.id}">
      <div style="font-weight:600; font-size:16px;">${emp.business_name || emp.email.split('@')[0]}</div>
      <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">
        ${emp.role === 'owner' ? 'Geschäftsführung' : 'Mitarbeiter'}
      </div>
    </button>
  `).join('');

  // Attach events
  employees.forEach(emp => {
    document.getElementById(`emp-${emp.id}`).addEventListener('click', (e) => {
      document.querySelectorAll('.employee-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      state.employeeId = emp.id;
      state.employeeName = emp.business_name || emp.email.split('@')[0];
      
      updateSelectedInfo();
      loadServicesForEmployee(emp.id);
    });
  });
}

async function loadServicesForEmployee(empId) {
  const sList = document.getElementById('publicServicesList');
  sList.innerHTML = '<p style="color:var(--text-secondary)">Dienstleistungen werden geladen...</p>';
  
  // Fetch services assigned to this employee
  const { data, error } = await supabase
    .from('employee_services')
    .select('services(*)')
    .eq('employee_id', empId);
    
  if (error || !data || data.length === 0) {
    sList.innerHTML = '<p style="color:var(--text-secondary)">Keine Dienstleistungen für diese Person verfügbar.</p>';
    window.goStep('services');
    return;
  }

  sList.innerHTML = data.map(d => {
    const s = d.services;
    return `
    <button class="list-btn service-btn" id="srv-${s.id}">
      <div style="font-weight:600; font-size:16px;">${s.title}</div>
      <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">
        ${s.duration_minutes} Minuten ${s.price ? '• ' + s.price : ''}
      </div>
    </button>
  `}).join('');

  data.forEach(d => {
    const s = d.services;
    document.getElementById(`srv-${s.id}`).addEventListener('click', (e) => {
      document.querySelectorAll('.service-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      state.serviceId = s.id;
      state.serviceTitle = s.title;
      state.durationMinutes = s.duration_minutes;
      
      updateSelectedInfo();
      
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('datePicker').min = today;
      if (!state.selectedDate) document.getElementById('datePicker').value = today;
      
      fetchSlots();
      window.goStep('datetime');
    });
  });
  
  window.goStep('services');
}

function updateSelectedInfo() {
  const info = document.getElementById('selectedInfo');
  info.style.display = 'block';
  
  if(state.employeeName) {
    document.getElementById('row-emp').style.display = 'flex';
    document.getElementById('selEmp').textContent = state.employeeName;
  }
  
  if(state.serviceTitle) {
    document.getElementById('row-srv').style.display = 'flex';
    document.getElementById('selServiceTitle').textContent = `${state.serviceTitle} (${state.durationMinutes} Min)`;
  }
  
  if (state.selectedDate && state.selectedTime) {
    document.getElementById('row-date').style.display = 'flex';
    const d = new Date(state.selectedDate).toLocaleDateString('de-DE');
    document.getElementById('selDate').textContent = `${d} um ${state.selectedTime} Uhr`;
  } else {
    document.getElementById('row-date').style.display = 'none';
  }
}

document.getElementById('datePicker').addEventListener('change', (e) => {
  state.selectedDate = e.target.value;
  state.selectedTime = null;
  document.getElementById('btnNextToForm').disabled = true;
  updateSelectedInfo();
  fetchSlots();
});

async function fetchSlots() {
  const date = document.getElementById('datePicker').value;
  if (!date) return;
  state.selectedDate = date;

  const container = document.getElementById('slotsContainer');
  container.innerHTML = '<p style="color:var(--text-secondary)">Zeiten werden berechnet...</p>';
  
  try {
    const res = await fetch(`${API_URL}/api/booking/get-slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.employeeId, date: date, duration: state.durationMinutes })
    });
    
    if(!res.ok) throw new Error('API Error');
    const data = await res.json();
    
    if (data.slots && data.slots.length > 0) {
      container.innerHTML = data.slots.map(slot => `
        <button class="slot-btn" onclick="selectTime('${slot}')">${slot}</button>
      `).join('');
    } else {
      container.innerHTML = '<p style="grid-column: 1/-1; color:var(--text-secondary);">An diesem Tag sind keine Termine verfügbar.</p>';
    }
  } catch (err) {
    container.innerHTML = '<p style="color:var(--danger)">Fehler beim Laden der Zeiten.</p>';
  }
}

window.selectTime = function(time) {
  state.selectedTime = time;
  document.querySelectorAll('.slot-btn').forEach(b => {
    if (b.textContent === time) b.classList.add('selected');
    else b.classList.remove('selected');
  });
  document.getElementById('btnNextToForm').disabled = false;
  updateSelectedInfo();
};

document.getElementById('btnNextToForm').addEventListener('click', () => {
  window.goStep('form');
});

document.getElementById('bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Wird gebucht...';
  
  const payload = {
    ownerId: state.ownerId,
    userId: state.employeeId,
    serviceId: state.serviceId,
    date: state.selectedDate,
    time: state.selectedTime,
    customerName: document.getElementById('custName').value,
    customerEmail: document.getElementById('custEmail').value,
    customerPhone: document.getElementById('custPhone').value
  };
  
  try {
    const res = await fetch(`${API_URL}/api/booking/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if(!res.ok) throw new Error('Buchung fehlgeschlagen');
    window.goStep('success');
  } catch (err) {
    alert('Fehler: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Termin verbindlich buchen';
  }
});

// Start
init();
