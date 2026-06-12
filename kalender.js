import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let session = null;
let profile = null;
let teamMembers = [];
let calendar = null;

// ================= TRANSLATIONS =================
const T = {
  de: {
    nav_calendar: 'Kalender', nav_team: 'Mitarbeiter', nav_services: 'Dienstleistungen', nav_hours: 'Arbeitszeiten', nav_integrations: 'Integrationen', nav_dashboard: 'Zum Dashboard',
    title_calendar: 'Kalender', sub_calendar: 'Klicken Sie in den Kalender, um einen Termin zu erstellen.', btn_add_leave: 'Abwesenheit (Urlaub) eintragen', public_link: 'Buchungsseite ↗',
    title_team: 'Team', lbl_invite_code: 'Unternehmens-Code', sub_invite_code: 'Mitarbeiter können sich mit diesem Code registrieren.', lbl_emp_list: 'Ihre Mitarbeiter',
    title_services: 'Dienstleistungen', lbl_add_service: 'Neue Dienstleistung', lbl_srv_title: 'Name der Dienstleistung', lbl_srv_dur: 'Dauer (Minuten)', lbl_srv_price: 'Preis', lbl_srv_emps: 'Welche Mitarbeiter bieten das an?', btn_srv_save: 'Speichern', lbl_srv_list: 'Gespeicherte Dienstleistungen',
    title_hours: 'Arbeitszeiten', btn_save_hours: 'Speichern', title_integrations: 'Integrationen', sub_google: 'Termine werden synchronisiert und Google Meet Links automatisch erstellt.',
    lbl_leave_title: 'Abwesenheit (Urlaub) eintragen', lbl_leave_emp: 'Für wen?', lbl_leave_start: 'Start', lbl_leave_end: 'Ende', lbl_leave_reason: 'Grund (z.B. Urlaub, Krank)', btn_leave_cancel: 'Abbrechen', btn_leave_save: 'Speichern',
    lbl_manual_title: 'Neuer Termin', lbl_manual_emp: 'Mitarbeiter', lbl_manual_start: 'Von', lbl_manual_end: 'Bis', lbl_manual_cust: 'Kundenname', lbl_manual_phone: 'Telefon', btn_manual_cancel: 'Abbrechen', btn_manual_save: 'Termin eintragen',
    lbl_loading: 'LÄDT...', alert_hours_saved: 'Arbeitszeiten gespeichert!', alert_service_delete: 'Dienstleistung wirklich löschen?', status_connected: 'Verbunden', status_disconnected: 'Getrennt', btn_connect: 'Verbinden', btn_disconnect: 'Trennen', me: '(Sie)'
  },
  tr: {
    nav_calendar: 'Takvim', nav_team: 'Personel Yönetimi', nav_services: 'Hizmetler', nav_hours: 'Çalışma Saatlerim', nav_integrations: 'Entegrasyonlar', nav_dashboard: 'Ana Dashboard',
    title_calendar: 'Takvim', sub_calendar: 'Randevu oluşturmak için takvim üzerinde bir saate tıklayın.', btn_add_leave: 'İzin (Tatil) Ekle', public_link: 'Müşteri Linkiniz ↗',
    title_team: 'Ekip Yönetimi', lbl_invite_code: 'Şirket Davet Kodunuz', sub_invite_code: 'Çalışanlarınız kayıt olurken bu kodu kullanabilir.', lbl_emp_list: 'Personelleriniz',
    title_services: 'Hizmetler', lbl_add_service: 'Yeni Hizmet Ekle', lbl_srv_title: 'Hizmet Adı', lbl_srv_dur: 'Süre (Dakika)', lbl_srv_price: 'Fiyat', lbl_srv_emps: 'Hangi personeller verebilir?', btn_srv_save: 'Kaydet', lbl_srv_list: 'Kayıtlı Hizmetler',
    title_hours: 'Çalışma Saatlerim', btn_save_hours: 'Kaydet', title_integrations: 'Entegrasyonlar', sub_google: 'Randevular senkronize edilir ve otomatik Meet linki oluşturulur.',
    lbl_leave_title: 'İzin / Tatil (Beurlaubt) Ekle', lbl_leave_emp: 'Kimin İçin?', lbl_leave_start: 'Başlangıç', lbl_leave_end: 'Bitiş', lbl_leave_reason: 'Sebep (Örn: Tatil, Hastalık)', btn_leave_cancel: 'İptal', btn_leave_save: 'Kaydet',
    lbl_manual_title: 'Yeni Randevu Ekle', lbl_manual_emp: 'Personel', lbl_manual_start: 'Başlangıç', lbl_manual_end: 'Bitiş', lbl_manual_cust: 'Müşteri Adı Soyadı', lbl_manual_phone: 'Telefon', btn_manual_cancel: 'İptal', btn_manual_save: 'Randevuyu Kaydet',
    lbl_loading: 'YÜKLENİYOR...', alert_hours_saved: 'Saatler başarıyla kaydedildi!', alert_service_delete: 'Hizmeti silmek istediğinize emin misiniz?', status_connected: 'Bağlandı', status_disconnected: 'Bağlı Değil', btn_connect: 'Bağlan', btn_disconnect: 'Bağlantıyı Kes', me: '(Siz)'
  },
  en: {
    nav_calendar: 'Calendar', nav_team: 'Team Management', nav_services: 'Services', nav_hours: 'Working Hours', nav_integrations: 'Integrations', nav_dashboard: 'Back to Dashboard',
    title_calendar: 'Calendar', sub_calendar: 'Click on the calendar to create an appointment.', btn_add_leave: 'Add Leave (Time Off)', public_link: 'Booking Page ↗',
    title_team: 'Team', lbl_invite_code: 'Company Invite Code', sub_invite_code: 'Employees can use this code to join your company.', lbl_emp_list: 'Your Team Members',
    title_services: 'Services', lbl_add_service: 'Add New Service', lbl_srv_title: 'Service Name', lbl_srv_dur: 'Duration (Mins)', lbl_srv_price: 'Price', lbl_srv_emps: 'Which employees provide this?', btn_srv_save: 'Save', lbl_srv_list: 'Saved Services',
    title_hours: 'Working Hours', btn_save_hours: 'Save', title_integrations: 'Integrations', sub_google: 'Appointments are synced and Google Meet links are generated automatically.',
    lbl_leave_title: 'Add Leave (Time Off)', lbl_leave_emp: 'For Whom?', lbl_leave_start: 'Start Date', lbl_leave_end: 'End Date', lbl_leave_reason: 'Reason (e.g. Holiday, Sick)', btn_leave_cancel: 'Cancel', btn_leave_save: 'Save',
    lbl_manual_title: 'New Appointment', lbl_manual_emp: 'Employee', lbl_manual_start: 'Start', lbl_manual_end: 'End', lbl_manual_cust: 'Customer Name', lbl_manual_phone: 'Phone', btn_manual_cancel: 'Cancel', btn_manual_save: 'Save Appointment',
    lbl_loading: 'LOADING...', alert_hours_saved: 'Working hours saved successfully!', alert_service_delete: 'Are you sure you want to delete this service?', status_connected: 'Connected', status_disconnected: 'Disconnected', btn_connect: 'Connect', btn_disconnect: 'Disconnect', me: '(You)'
  }
};

let lang = localStorage.getItem('kalender_lang') || 'de';

function applyLang() {
  const t = T[lang];
  document.documentElement.lang = lang;
  
  // Apply all matching IDs
  for (const key in t) {
    const el = document.getElementById(key.replace(/_/g, '-'));
    if (el && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.textContent = t[key];
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.placeholder) el.placeholder = t[key];
  }

  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  
  if (calendar) {
    calendar.setOption('locale', lang);
  }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang;
    localStorage.setItem('kalender_lang', lang);
    applyLang();
  });
});

// ================= INIT =================
document.querySelectorAll('.nav-item[data-target]').forEach(el => {
  el.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    e.currentTarget.classList.add('active');
    document.querySelectorAll('.view-section').forEach(section => section.classList.remove('active'));
    document.getElementById(e.currentTarget.dataset.target).classList.add('active');
    if(e.currentTarget.dataset.target === 'view-calendar' && calendar) {
      setTimeout(() => calendar.render(), 100);
    }
  });
});

async function init() {
  applyLang();
  
  const { data } = await supabase.auth.getSession();
  if (!data.session) return window.location.href = 'login.html';
  session = data.session;
  
  const { data: pData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  profile = pData || { role: 'owner' };

  if (profile.role === 'owner' && !profile.company_code) {
    const baseStr = profile.business_name || session.user.email.split('@')[0];
    const code = 'INF-' + baseStr.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 10);
    const { error } = await supabase.from('profiles').update({ company_code: code }).eq('id', session.user.id);
    if (error) console.error("Kayıt hatası (Company Code):", error);
    profile.company_code = code;
  }

  // Booking URL uses company_code (owner) or owner's company_code (employee)
  let bookingId = profile.company_code;
  if (profile.role !== 'owner' && profile.owner_id) {
    const { data: ownerProf } = await supabase.from('profiles').select('company_code').eq('id', profile.owner_id).single();
    if (ownerProf && ownerProf.company_code) bookingId = ownerProf.company_code;
  }
  if (!bookingId) bookingId = profile.id;

  // Populate Buchungsseite (Booking Preview)
  const bookingUrl = window.location.origin + '/booking.html?u=' + bookingId;
  const bookingInput = document.getElementById('booking-url-input');
  if (bookingInput) bookingInput.value = bookingUrl;
  const iframe = document.getElementById('booking-preview-iframe');
  if (iframe) iframe.src = bookingUrl;
  const btnOpen = document.getElementById('btn-open-link');
  if (btnOpen) btnOpen.href = bookingUrl;
  
  const btnCopy = document.getElementById('btn-copy-link');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(bookingUrl);
      btnCopy.textContent = 'Kopiert!';
      setTimeout(() => btnCopy.textContent = 'Link kopieren', 2000);
    });
  }

  // Populate User Profile in Sidebar
  const sidebarName = document.getElementById('sidebar-user-name');
  if (sidebarName) sidebarName.textContent = profile.business_name || session.user.email.split('@')[0];
  const sidebarRole = document.getElementById('sidebar-user-role');
  if (sidebarRole) sidebarRole.textContent = profile.role === 'owner' ? 'Geschäftsführung' : 'Mitarbeiter';

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  if (profile.role === 'owner') {
    document.querySelectorAll('.owner-only').forEach(el => el.style.display = 'flex');
    const ccDisp = document.getElementById('company-code-display');
    if (ccDisp) ccDisp.textContent = profile.company_code;
  } else {
    // Hide Dashboard link for employees
    const dashLink = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('href') === 'dashboard.html');
    if (dashLink) dashLink.style.display = 'none';
  }

  await loadTeam();
  await Promise.all([
    initCalendar(),
    loadServices(),
    loadHours(),
    loadIntegrations()
  ]);

  document.getElementById('loader').style.display = 'none';
}

// ================= TEAM =================
async function loadTeam() {
  const ownerId = profile.role === 'owner' ? session.user.id : profile.owner_id;
  
  try {
    const res = await fetch(`https://n8n.infinitymade.de/api/team?owner_id=${ownerId}`);
    if (res.ok) {
      teamMembers = await res.json();
    } else {
      teamMembers = [];
    }
  } catch (err) {
    console.error("Team loading error:", err);
    teamMembers = [];
  }

  if (teamMembers.length === 0) {
    teamMembers = [{ id: session.user.id, email: session.user.email, business_name: profile.business_name || 'Admin', role: profile.role }];
  }

  if (profile.role === 'owner') {
    const list = document.getElementById('team-list');
    list.innerHTML = teamMembers.map(t => `
      <div style="padding:15px; border:1px solid var(--border); border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between; background:rgba(0,0,0,0.2);">
        <div>
          <div style="font-weight:600; font-size:16px;">${t.business_name || t.email.split('@')[0]} ${t.id === session.user.id ? T[lang].me : ''}</div>
          <div style="font-size:13px; color:var(--text-muted);">${t.email}</div>
        </div>
      </div>
    `).join('');
  }

  const selects = ['leave-employee', 'manual-employee'];
  selects.forEach(selId => {
    const el = document.getElementById(selId);
    if(el) el.innerHTML = teamMembers.map(t => `<option value="${t.id}">${t.business_name || t.email.split('@')[0]}</option>`).join('');
  });

  const serviceCheckboxes = document.getElementById('service-employee-checkboxes');
  if (serviceCheckboxes && profile.role === 'owner') {
    serviceCheckboxes.innerHTML = teamMembers.map(t => `
      <label style="display:flex; align-items:center; gap:8px; margin-bottom:5px; color: #fff;">
        <input type="checkbox" name="srv_employees" value="${t.id}" checked>
        ${t.business_name || t.email.split('@')[0]} ${t.id === session.user.id ? T[lang].me : ''}
      </label>
    `).join('');
  }
}

// ================= VISUAL CALENDAR =================
let manualSelectedDate = null;
async function initCalendar() {
  const calendarEl = document.getElementById('fullcalendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
    initialView: window.innerWidth < 768 ? 'timeGridDay' : 'resourceTimeGridDay',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,resourceTimeGridDay,timeGridDay' },
    buttonText: {
      today:              lang === 'tr' ? 'Bugün'       : lang === 'de' ? 'Heute'     : 'Today',
      month:              lang === 'tr' ? 'Ay'          : lang === 'de' ? 'Monat'     : 'Month',
      week:               lang === 'tr' ? 'Hafta'       : lang === 'de' ? 'Woche'     : 'Week',
      day:                lang === 'tr' ? 'Gün'         : lang === 'de' ? 'Tag'       : 'Day',
      resourceTimeGridDay: lang === 'tr' ? 'Tüm Ekip'  : lang === 'de' ? 'Team-Tag'  : 'Team Day',
    },
    locale: lang,
    resources: teamMembers.map(t => ({ id: t.id, title: t.business_name || t.email.split('@')[0] })),
    allDaySlot: true,
    slotMinTime: '06:00:00',
    slotMaxTime: '23:00:00',
    contentHeight: 'auto',
    expandRows: true,
    selectable: true, // Enables click-to-book
    select: function(info) {
      // User clicked and dragged on the calendar
      manualSelectedDate = info.startStr.split('T')[0];
      const startTime = info.startStr.includes('T') ? info.startStr.split('T')[1].substring(0,5) : '09:00';
      const endTime = info.endStr.includes('T') ? info.endStr.split('T')[1].substring(0,5) : '10:00';
      
      document.getElementById('manual-start').value = startTime;
      document.getElementById('manual-end').value = endTime;
      document.getElementById('manual-modal').classList.add('show');
      calendar.unselect();
    },
    events: async function(info, successCallback, failureCallback) {
      try {
        let query = supabase.from('bookings').select('*, services(title), profiles!bookings_user_id_fkey(business_name)')
          .gte('start_time', info.startStr)
          .lte('start_time', info.endStr);
          
        if (profile.role === 'owner') query = query.eq('owner_id', session.user.id);
        else query = query.eq('user_id', session.user.id);
        
        const { data: bookings } = await query;
        
        let leaveQuery = supabase.from('time_offs').select('*, profiles!time_offs_employee_id_fkey(business_name)')
          .gte('end_date', info.startStr)
          .lte('start_date', info.endStr);
          
        if (profile.role !== 'owner') leaveQuery = leaveQuery.eq('employee_id', session.user.id);
        else {
          const tids = teamMembers.map(t=>t.id);
          leaveQuery = leaveQuery.in('employee_id', tids);
        }
        
        const { data: leaves } = await leaveQuery;

        const events = [];
        const colors = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777'];

        (bookings || []).forEach(b => {
          const staffIdx = teamMembers.findIndex(t => t.id === b.user_id) || 0;
          events.push({
            id: b.id,
            resourceId: b.user_id,
            title: `${b.services?.title || 'Termin'} - ${b.customer_name} (${b.profiles?.business_name || 'Mitarbeiter'})`,
            start: b.start_time,
            end: b.end_time,
            backgroundColor: colors[staffIdx % colors.length],
            extendedProps: { ...b }
          });
        });

        (leaves || []).forEach(l => {
          events.push({
            id: 'leave_'+l.id,
            resourceId: l.employee_id,
            title: `❌ ${l.reason || 'Beurlaubt'} (${l.profiles?.business_name || ''})`,
            start: l.start_date,
            end: l.end_date,
            allDay: true,
            backgroundColor: '#ef4444' 
          });
        });

        successCallback(events);
      } catch(e) { failureCallback(e); }
    },
    eventClick: function(info) {
      const p = info.event.extendedProps;
      if (p.customer_name) {
        let txt = `Kunde: ${p.customer_name}\nTel: ${p.customer_phone || '-'}\nDienst: ${p.services?.title || 'Manuell'}`;
        alert(txt);
      }
    }
  });
  calendar.render();
}

// Manual Booking Save
document.getElementById('manual-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-manual-save');
  btn.disabled = true;

  const empId = document.getElementById('manual-employee').value;
  const start = document.getElementById('manual-start').value;
  const end = document.getElementById('manual-end').value;
  const custName = document.getElementById('manual-customer').value;
  const custPhone = document.getElementById('manual-phone').value;

  const start_time = `${manualSelectedDate}T${start}:00.000Z`;
  const end_time = `${manualSelectedDate}T${end}:00.000Z`;
  const ownerId = profile.role === 'owner' ? session.user.id : profile.owner_id;

  try {
    const res = await fetch('https://n8n.infinitymade.de/api/booking/manual-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, employeeId: empId, start_time, end_time, customerName: custName, customerPhone: custPhone })
    });
    if(!res.ok) throw new Error('Fehler beim Speichern');
    document.getElementById('manual-modal').classList.remove('show');
    document.getElementById('manual-form').reset();
    calendar.refetchEvents();
  } catch(err) {
    alert(err.message);
  }
  btn.disabled = false;
});

// ================= SERVICES =================
async function loadServices() {
  if (profile.role !== 'owner') return;
  const { data } = await supabase.from('services').select('*, employee_services(employee_id)').eq('owner_id', session.user.id);
  const container = document.getElementById('services-list');
  if (!data || data.length === 0) return container.innerHTML = '<p class="text-muted">Noch keine Dienstleistungen.</p>';
  
  container.innerHTML = data.map(s => {
    const names = s.employee_services.map(es => {
      const tm = teamMembers.find(t=>t.id === es.employee_id);
      return tm ? (tm.business_name || tm.email.split('@')[0]) : '';
    }).filter(Boolean).join(', ');

    return `
    <div style="padding:15px; border:1px solid var(--border); border-radius:8px; margin-bottom:10px; background:rgba(0,0,0,0.2);">
      <div style="font-weight:600; font-size:16px; margin-bottom:4px;">${s.title} <span class="text-muted">(${s.duration_minutes} min)</span></div>
      <div style="font-size:12px; color:var(--text-muted);">Mitarbeiter: ${names || '-'}</div>
      <button class="btn btn-danger" style="margin-top:10px; padding:5px 10px;" onclick="deleteService('${s.id}')">Löschen</button>
    </div>`
  }).join('');
}

document.getElementById('form-service').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('srv-title').value;
  const dur = parseInt(document.getElementById('srv-duration').value);
  const price = document.getElementById('srv-price').value;
  
  const { data: srv, error } = await supabase.from('services').insert({
    owner_id: session.user.id, title, duration_minutes: dur, price
  }).select().single();
  if (error) return alert(error.message);

  const selectedEmpIds = Array.from(document.querySelectorAll('input[name="srv_employees"]:checked')).map(el => el.value);
  if (selectedEmpIds.length > 0) {
    await supabase.from('employee_services').insert(selectedEmpIds.map(empId => ({ employee_id: empId, service_id: srv.id })));
  }
  document.getElementById('form-service').reset();
  loadServices();
});

window.deleteService = async (id) => {
  if(!confirm(T[lang].alert_service_delete)) return;
  await supabase.from('services').delete().eq('id', id);
  loadServices();
};

// ================= LEAVES (TIME OFFS) =================
document.getElementById('btn-add-leave').addEventListener('click', () => {
  document.getElementById('leave-modal').classList.add('show');
});

document.getElementById('leave-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const empId = document.getElementById('leave-employee').value;
  const start = document.getElementById('leave-start').value;
  const end = document.getElementById('leave-end').value;
  const reason = document.getElementById('leave-reason').value;

  const { error } = await supabase.from('time_offs').insert({
    employee_id: empId,
    start_date: new Date(start + 'T00:00:00').toISOString(),
    end_date: new Date(end + 'T23:59:59').toISOString(),
    reason
  });

  if (error) alert(error.message);
  else {
    document.getElementById('leave-modal').classList.remove('show');
    document.getElementById('leave-form').reset();
    calendar.refetchEvents();
  }
});

// ================= HOURS =================
const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
async function loadHours() {
  const { data: hours } = await supabase.from('working_hours').select('*').eq('user_id', session.user.id);
  let html = '';
  for(let i=0; i<7; i++) {
    const h = hours?.find(x => x.day_of_week === i) || { start_time: '09:00', end_time: '17:00', is_active: (i > 0 && i < 6) };
    html += `
      <div style="display:flex; gap:15px; align-items:center; margin-bottom:10px;">
        <label style="width:100px; color:#fff;">
          <input type="checkbox" id="wh-active-${i}" ${h.is_active ? 'checked' : ''}> ${DAYS[i]}
        </label>
        <input type="time" id="wh-start-${i}" class="input-control" style="width:auto; padding:5px;" value="${h.start_time.substring(0,5)}">
        <input type="time" id="wh-end-${i}" class="input-control" style="width:auto; padding:5px;" value="${h.end_time.substring(0,5)}">
      </div>
    `;
  }
  document.getElementById('hours-container').innerHTML = html;
}

document.getElementById('btn-save-hours').addEventListener('click', async () => {
  const payload = [];
  for(let i=0; i<7; i++) {
    payload.push({
      user_id: session.user.id,
      day_of_week: i,
      start_time: document.getElementById(`wh-start-${i}`).value + ':00',
      end_time: document.getElementById(`wh-end-${i}`).value + ':00',
      is_active: document.getElementById(`wh-active-${i}`).checked
    });
  }
  await supabase.from('working_hours').upsert(payload, { onConflict: 'user_id, day_of_week' });
  alert(T[lang].alert_hours_saved);
});

// ================= INTEGRATIONS =================
async function loadIntegrations() {
  const { data: integ } = await supabase.from('calendar_integrations').select('*').eq('user_id', session.user.id).eq('provider', 'google').maybeSingle();
  const status = document.getElementById('google-status');
  const btn = document.getElementById('google-connect-btn');
  
  if (integ && integ.access_token) {
    status.style.background = 'rgba(34,197,94,0.2)'; status.style.color = 'var(--primary)';
    status.textContent = T[lang].status_connected;
    btn.textContent = T[lang].btn_disconnect;
    btn.onclick = async () => {
      if (!confirm('Google Kalender trennen? Termine werden dann nicht mehr automatisch synchronisiert. Sie können die Verbindung jederzeit wiederherstellen.')) return;
      await supabase.from('calendar_integrations').delete().eq('id', integ.id);
      loadIntegrations();
    };
  } else {
    status.style.background = 'rgba(255,255,255,0.1)'; status.style.color = '#fff';
    status.textContent = T[lang].status_disconnected;
    btn.textContent = T[lang].btn_connect;
    btn.onclick = () => {
      window.location.href = `https://n8n.infinitymade.de/api/calendar/google-auth?userId=${session.user.id}`;
    };
  }
}

init();
