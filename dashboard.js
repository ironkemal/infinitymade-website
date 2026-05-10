import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API = 'https://n8n.infinitymade.de/api';

const T = {
  de: {
    logout:'Abmelden',
    nav_overview:'Übersicht',nav_calendar:'Kalender',nav_kunden:'Kunden Info',
    nav_services:'Dienstleistungen',nav_hours:'Arbeitszeiten',
    nav_team:'Mitarbeiter',nav_b2b:'B2B',nav_settings:'Einstellungen',
    overview_sub:'Ihr heutiger Überblick',
    kpi_plan:'Paket',kpi_status:'Status',kpi_today_bookings:'Heute',kpi_today_sub:'Termine',kpi_support:'Support',
    status_active:'✓ Aktiv',status_inactive:'✗ Inaktiv',
    today_bookings:'Heutige Termine',upcoming_empty:'Heute keine Termine.',features_title:'Paketinhalt',
    calendar_sub:'Klicken Sie auf einen Tag für Slots',
    btn_add_leave:'Abwesenheit eintragen',btn_add_booking:'+ Termin',
    kunden_sub:'Leads & Kundeninformationen',leads_import:'CSV importieren',leads_add:'+ Neuer Lead',
    apify_label:'Google Maps Scraper:',apify_run:'Suchen',
    lf_all:'Alle',lf_new:'Neu',lf_contacted:'Kontaktiert',lf_booked:'Termin',lf_won:'Gewonnen',lf_lost:'Verloren',
    lead_title:'Name',lead_city:'Stadt',lead_phone:'Telefon',lead_rating:'Bewertung',
    lead_status:'Status',lead_notes:'Notizen',lead_email:'E-Mail',lead_website:'Website',
    lead_country_code:'Land',lead_google_url:'Google Maps URL',lead_category_name:'Kategorie',
    leads_empty:'Noch keine Leads.',lead_modal_new:'Neuer Lead',lead_modal_edit:'Lead bearbeiten',
    lead_save:'Speichern',lead_cancel:'Abbrechen',lead_delete:'Löschen',lead_confirm_delete:'Lead wirklich löschen?',
    services_sub:'Angebotene Leistungen verwalten',
    lbl_add_service:'Neue Dienstleistung',lbl_srv_title:'Name',lbl_srv_dur:'Dauer (Min)',
    lbl_srv_price:'Preis (€)',lbl_srv_emps:'Mitarbeiter',btn_srv_save:'Speichern',
    alert_service_delete:'Dienstleistung wirklich löschen?',
    hours_sub:'Öffnungszeiten je Mitarbeiter',btn_save_hours:'Speichern',hours_for:'Für:',
    alert_hours_saved:'Arbeitszeiten gespeichert!',
    team_sub:'Team verwalten',lbl_invite_code:'Unternehmens-Code',
    sub_invite_code:'Mitarbeiter registrieren sich mit diesem Code.',
    btn_copy:'Kopieren',btn_remove:'Entfernen',tab_info:'Info',lbl_google_cal:'Google Kalender',
    b2b_sub:'Geschäftskontakte & KI-Assistent',b2b_add:'+ Kontakt',
    b2b_company:'Unternehmen',b2b_contact:'Ansprechpartner',b2b_status:'Status',
    b2b_empty:'Noch keine B2B-Kontakte.',b2b_ai_title:'KI-Assistent',
    b2b_ai_welcome:'Hallo! Ich helfe Ihnen bei B2B-Anfragen.',
    set_profile:'Profil',set_biz:'Unternehmensname',set_lang:'Sprache',set_save:'Speichern',
    set_account:'Konto',set_password:'Passwort',set_new_pw:'Neues Passwort',
    set_change:'Passwort ändern',set_integrations:'Integrationen',
    sub_portal:'Abonnement verwalten',sub_upgrade:'Upgrade',
    status_disconnected:'Nicht verbunden',status_connected:'Verbunden',
    btn_connect:'Verbinden',btn_disconnect:'Trennen',
    lbl_manual_title:'Neuer Termin',lbl_manual_emp:'Mitarbeiter',lbl_manual_service:'Dienstleistung',
    lbl_manual_start:'Von',lbl_manual_end:'Bis',lbl_manual_cust:'Kundenname',
    lbl_leave_title:'Abwesenheit eintragen',lbl_leave_emp:'Für wen?',
    lbl_leave_start:'Start',lbl_leave_end:'Ende',lbl_leave_reason:'Grund',
    btn_leave_cancel:'Abbrechen',btn_leave_save:'Speichern',
    saved:'Gespeichert.',pw_changed:'Passwort geändert.',err_generic:'Ein Fehler ist aufgetreten.',
    copied:'Kopiert!',csv_imported:'Importiert: ',csv_error:'CSV-Fehler: ',
    apify_error:'Apify-Fehler: ',apify_done:'Importiert: ',me:'(Sie)'
  },
  en: {
    logout:'Sign out',
    nav_overview:'Overview',nav_calendar:'Calendar',nav_kunden:'Customers',
    nav_services:'Services',nav_hours:'Working Hours',
    nav_team:'Team',nav_b2b:'B2B',nav_settings:'Settings',
    overview_sub:'Your daily overview',
    kpi_plan:'Plan',kpi_status:'Status',kpi_today_bookings:'Today',kpi_today_sub:'Appointments',kpi_support:'Support',
    status_active:'✓ Active',status_inactive:'✗ Inactive',
    today_bookings:"Today's Appointments",upcoming_empty:'No appointments today.',features_title:"Plan contents",
    calendar_sub:'Click a day to see slots',btn_add_leave:'Add time off',btn_add_booking:'+ Appointment',
    kunden_sub:'Leads & customer info',leads_import:'Import CSV',leads_add:'+ New lead',
    apify_label:'Google Maps Scraper:',apify_run:'Search',
    lf_all:'All',lf_new:'New',lf_contacted:'Contacted',lf_booked:'Booked',lf_won:'Won',lf_lost:'Lost',
    lead_title:'Name',lead_city:'City',lead_phone:'Phone',lead_rating:'Rating',
    lead_status:'Status',lead_notes:'Notes',lead_email:'Email',lead_website:'Website',
    lead_country_code:'Country',lead_google_url:'Google Maps URL',lead_category_name:'Category',
    leads_empty:'No leads yet.',lead_modal_new:'New lead',lead_modal_edit:'Edit lead',
    lead_save:'Save',lead_cancel:'Cancel',lead_delete:'Delete',lead_confirm_delete:'Delete this lead?',
    services_sub:'Manage your services',
    lbl_add_service:'New Service',lbl_srv_title:'Name',lbl_srv_dur:'Duration (min)',
    lbl_srv_price:'Price (€)',lbl_srv_emps:'Employees',btn_srv_save:'Save',
    alert_service_delete:'Delete this service?',
    hours_sub:'Working hours per employee',btn_save_hours:'Save',hours_for:'For:',
    alert_hours_saved:'Hours saved!',
    team_sub:'Manage your team',lbl_invite_code:'Company Code',
    sub_invite_code:'Employees register with this code.',
    btn_copy:'Copy',btn_remove:'Remove',tab_info:'Info',lbl_google_cal:'Google Calendar',
    b2b_sub:'Business contacts & AI assistant',b2b_add:'+ Contact',
    b2b_company:'Company',b2b_contact:'Contact person',b2b_status:'Status',
    b2b_empty:'No B2B contacts yet.',b2b_ai_title:'AI Assistant',b2b_ai_welcome:'Hi! I can help with B2B queries.',
    set_profile:'Profile',set_biz:'Business name',set_lang:'Language',set_save:'Save',
    set_account:'Account',set_password:'Password',set_new_pw:'New password',
    set_change:'Change password',set_integrations:'Integrations',
    sub_portal:'Manage subscription',sub_upgrade:'Upgrade',
    status_disconnected:'Disconnected',status_connected:'Connected',
    btn_connect:'Connect',btn_disconnect:'Disconnect',
    lbl_manual_title:'New Appointment',lbl_manual_emp:'Employee',lbl_manual_service:'Service',
    lbl_manual_start:'From',lbl_manual_end:'To',lbl_manual_cust:'Customer name',
    lbl_leave_title:'Add time off',lbl_leave_emp:'For whom?',
    lbl_leave_start:'Start',lbl_leave_end:'End',lbl_leave_reason:'Reason',
    btn_leave_cancel:'Cancel',btn_leave_save:'Save',
    saved:'Saved.',pw_changed:'Password changed.',err_generic:'An error occurred.',
    copied:'Copied!',csv_imported:'Imported: ',csv_error:'CSV error: ',
    apify_error:'Apify error: ',apify_done:'Imported: ',me:'(You)'
  },
  tr: {
    logout:'Çıkış',
    nav_overview:'Genel Bakış',nav_calendar:'Takvim',nav_kunden:'Müşteri Bilgisi',
    nav_services:'Hizmetler',nav_hours:'Çalışma Saatleri',
    nav_team:'Personel',nav_b2b:'B2B',nav_settings:'Ayarlar',
    overview_sub:'Günlük genel bakışınız',
    kpi_plan:'Paket',kpi_status:'Durum',kpi_today_bookings:'Bugün',kpi_today_sub:'Randevu',kpi_support:'Destek',
    status_active:'✓ Aktif',status_inactive:'✗ Pasif',
    today_bookings:'Bugünkü Randevular',upcoming_empty:'Bugün randevu yok.',features_title:'Paket içeriği',
    calendar_sub:'Slot görmek için bir güne tıklayın',btn_add_leave:'İzin ekle',btn_add_booking:'+ Randevu',
    kunden_sub:'Lead & müşteri bilgileri',leads_import:'CSV içe aktar',leads_add:'+ Yeni Lead',
    apify_label:'Google Maps Scraper:',apify_run:'Ara',
    lf_all:'Tümü',lf_new:'Yeni',lf_contacted:'İletişim kuruldu',lf_booked:'Randevu',lf_won:'Kazanıldı',lf_lost:'Kaybedildi',
    lead_title:'Ad',lead_city:'Şehir',lead_phone:'Telefon',lead_rating:'Puan',
    lead_status:'Durum',lead_notes:'Notlar',lead_email:'E-posta',lead_website:'Website',
    lead_country_code:'Ülke',lead_google_url:'Google Maps URL',lead_category_name:'Kategori',
    leads_empty:'Henüz lead yok.',lead_modal_new:'Yeni Lead',lead_modal_edit:'Lead düzenle',
    lead_save:'Kaydet',lead_cancel:'İptal',lead_delete:'Sil',lead_confirm_delete:'Bu lead silinsin mi?',
    services_sub:'Sunulan hizmetleri yönet',
    lbl_add_service:'Yeni Hizmet',lbl_srv_title:'Ad',lbl_srv_dur:'Süre (dk)',
    lbl_srv_price:'Fiyat (€)',lbl_srv_emps:'Personel',btn_srv_save:'Kaydet',
    alert_service_delete:'Bu hizmet silinsin mi?',
    hours_sub:'Personel başına çalışma saatleri',btn_save_hours:'Kaydet',hours_for:'Kimin için:',
    alert_hours_saved:'Saatler kaydedildi!',
    team_sub:'Ekibi yönet',lbl_invite_code:'Şirket Kodu',
    sub_invite_code:'Çalışanlar bu kodla kayıt olabilir.',
    btn_copy:'Kopyala',btn_remove:'Çıkar',tab_info:'Bilgi',lbl_google_cal:'Google Takvim',
    b2b_sub:'İş ortakları & KI asistan',b2b_add:'+ Kişi',
    b2b_company:'Şirket',b2b_contact:'İlgili kişi',b2b_status:'Durum',
    b2b_empty:'Henüz B2B kişisi yok.',b2b_ai_title:'KI Asistan',b2b_ai_welcome:'Merhaba! B2B sorularınızda yardımcı olabilirim.',
    set_profile:'Profil',set_biz:'İşletme adı',set_lang:'Dil',set_save:'Kaydet',
    set_account:'Hesap',set_password:'Şifre',set_new_pw:'Yeni şifre',
    set_change:'Şifre değiştir',set_integrations:'Entegrasyonlar',
    sub_portal:'Aboneliği yönet',sub_upgrade:'Yükselt',
    status_disconnected:'Bağlı değil',status_connected:'Bağlandı',
    btn_connect:'Bağlan',btn_disconnect:'Bağlantıyı kes',
    lbl_manual_title:'Yeni Randevu',lbl_manual_emp:'Personel',lbl_manual_service:'Hizmet',
    lbl_manual_start:'Başlangıç',lbl_manual_end:'Bitiş',lbl_manual_cust:'Müşteri adı',
    lbl_leave_title:'İzin ekle',lbl_leave_emp:'Kimin için?',
    lbl_leave_start:'Başlangıç',lbl_leave_end:'Bitiş',lbl_leave_reason:'Sebep',
    btn_leave_cancel:'İptal',btn_leave_save:'Kaydet',
    saved:'Kaydedildi.',pw_changed:'Şifre değiştirildi.',err_generic:'Bir hata oluştu.',
    copied:'Kopyalandı!',csv_imported:'İçe aktarıldı: ',csv_error:'CSV hatası: ',
    apify_error:'Apify hatası: ',apify_done:'İçe aktarıldı: ',me:'(Siz)'
  }
};

const PLAN_FEATURES = {
  starter: {
    de:['WhatsApp KI-Assistent (24/7)','Automatische Erinnerungen','Warteliste-Automation','Cal.com Kalenderintegration','DSGVO-konform'],
    en:['WhatsApp AI Assistant (24/7)','Automatic reminders','Waitlist automation','Cal.com calendar integration','GDPR-compliant'],
    tr:['WhatsApp KI Asistanı (7/24)','Otomatik hatırlatmalar','Bekleme listesi otomasyonu','Cal.com takvim entegrasyonu','DSGVO uyumlu']
  },
  professional: {
    de:['Alles aus Starter','Reaktivierungskampagne','Upsell-Vorschläge','Auslastungs-Dashboard','Mitarbeiter-Routing'],
    en:['Everything in Starter','Reactivation campaign','Upsell suggestions','Utilization dashboard','Staff routing'],
    tr:["Starter'daki her şey",'Reaktivasyon kampanyası','Ek satış önerileri','Doluluk paneli','Personel yönlendirme']
  },
  klinik: {
    de:['Alles aus Professional','Digitales Anamnese-Formular','Verpasster Anruf → Assistent','Medizinische Erinnerungen','Rezept-Workflow'],
    en:['Everything in Professional','Digital intake form','Missed call → Assistant','Medical reminders','Prescription workflow'],
    tr:["Professional'daki her şey",'Dijital anamnez formu','Cevapsız çağrı → Asistan','Tıbbi hatırlatmalar','Reçete iş akışı']
  }
};

const SIDEBAR_ITEMS = [
  {id:'overview',icon:'📊',key:'nav_overview',roles:['owner','employee']},
  {id:'calendar',icon:'📅',key:'nav_calendar',roles:['owner','employee']},
  {id:'kunden',  icon:'👥',key:'nav_kunden',  roles:['owner']},
  {id:'services',icon:'✂️', key:'nav_services',roles:['owner']},
  {id:'hours',   icon:'🕐',key:'nav_hours',   roles:['owner','employee']},
  {id:'team',    icon:'👤',key:'nav_team',    roles:['owner']},
  {id:'b2b',     icon:'🤝',key:'nav_b2b',     roles:['owner']},
  {id:'settings',icon:'⚙️', key:'nav_settings',roles:['owner','employee']}
];

const DAYS = {
  de:['So','Mo','Di','Mi','Do','Fr','Sa'],
  en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  tr:['Paz','Pzt','Sal','Çar','Per','Cum','Cmt']
};

let currentLang = localStorage.getItem('infinity_lang') || 'de';
let currentProfile = null;
let currentSession = null;
let teamMembers = [];
let calendar = null;
let activePanel = 'overview';
let leadFilter = 'all';
let leadSearchVal = '';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = 'login.html'; throw new Error('no session'); }
currentSession = session;

const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
currentProfile = profile || { id: session.user.id, email: session.user.email, plan:'starter', role:'owner', is_active:true };
if (currentProfile.language && !localStorage.getItem('infinity_lang')) currentLang = currentProfile.language;

function t(key) { return (T[currentLang]||T.de)[key]||key; }
function getOwnerId() { return currentProfile.role==='owner' ? currentSession.user.id : currentProfile.owner_id; }

function applyI18n() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => { const v=t(el.dataset.i18n); if(v) el.textContent=v; });
  const ls = document.getElementById('langSelect');
  if (ls) ls.value = currentLang;
}

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  const role = currentProfile.role || 'owner';
  SIDEBAR_ITEMS.forEach(item => {
    if (!item.roles.includes(role)) return;
    const btn = document.createElement('button');
    btn.className = 'sidebar-item' + (item.id===activePanel ? ' active' : '');
    btn.dataset.panel = item.id;
    btn.innerHTML = `<span class="icon">${item.icon}</span><span>${t(item.key)}</span>`;
    btn.addEventListener('click', () => switchPanel(item.id));
    nav.appendChild(btn);
  });
}

function switchPanel(id) {
  activePanel = id;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('panel-'+id);
  if (target) target.classList.add('active');
  renderSidebar();
  closeSidebar();
  if (id==='calendar' && calendar) { setTimeout(() => calendar.updateSize(), 50); setTimeout(() => calendar.updateSize(), 300); }
  if (id==='kunden') loadLeads();
  if (id==='services') loadServices();
  if (id==='hours') loadHoursPanel();
  if (id==='team') loadTeam();
  if (id==='b2b') loadB2B();
  if (id==='settings') loadSettings();
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('visible');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
}

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.contains('open') ? closeSidebar() : openSidebar();
});
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
document.getElementById('langSelect').addEventListener('change', async (e) => {
  currentLang = e.target.value;
  localStorage.setItem('infinity_lang', currentLang);
  applyI18n();
  renderSidebar();
  await supabase.from('profiles').update({language:currentLang}).eq('id',currentSession.user.id);
});
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

document.querySelectorAll('.modal-close,[data-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.modal || btn.closest('.modal-overlay')?.id;
    if (id) closeModal(id);
  });
});
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if(e.target===ov) closeModal(ov.id); });
});

function openModal(id) { const el=document.getElementById(id); if(el) el.hidden=false; }
function closeModal(id) { const el=document.getElementById(id); if(el) el.hidden=true; }

function showToast(msg, type='success') {
  const d = document.createElement('div');
  d.className = `toast ${type}`;
  d.textContent = msg;
  document.getElementById('toastContainer').appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso));
}

function statusBadge(s) {
  if (s==='confirmed'||s==='accepted') return 'badge-green';
  if (s==='cancelled'||s==='canceled') return 'badge-red';
  if (s==='pending') return 'badge-yellow';
  return 'badge-gray';
}

async function renderOverview() {
  document.getElementById('bizName').textContent = currentProfile.business_name || '';
  document.getElementById('kpi-plan').textContent = currentProfile.plan
    ? currentProfile.plan.charAt(0).toUpperCase()+currentProfile.plan.slice(1) : '—';
  document.getElementById('kpi-status').textContent = currentProfile.is_active ? t('status_active') : t('status_inactive');

  ['welcome-banner','noplan-banner','trial-banner','pastdue-banner'].forEach(id => {
    const el=document.getElementById(id); if(el) el.hidden=true;
  });
  const params = new URLSearchParams(location.search);
  const status = currentProfile.plan_status||'pending';
  const hasSub = !!currentProfile.stripe_subscription_id;
  if (params.get('welcome')==='1') {
    history.replaceState({},'' ,location.pathname);
    document.getElementById('welcome-banner').hidden = false;
  } else if (status==='pending' && !hasSub) {
    document.getElementById('noplan-banner').hidden = false;
  } else if (status==='trial' && currentProfile.trial_ends_at) {
    const days = Math.max(0,Math.ceil((new Date(currentProfile.trial_ends_at)-Date.now())/86400000));
    document.getElementById('trial-days-left').textContent = days;
    document.getElementById('trial-banner').hidden = false;
  } else if (status==='past_due') {
    document.getElementById('pastdue-banner').hidden = false;
  }

  document.getElementById('trial-manage-btn')?.addEventListener('click', openStripePortal);
  document.getElementById('pastdue-fix-btn')?.addEventListener('click', openStripePortal);

  const features = (PLAN_FEATURES[currentProfile.plan]||PLAN_FEATURES.starter)[currentLang]||[];
  document.getElementById('featureList').innerHTML = features.map(f=>`<li>${f}</li>`).join('');

  await loadTodayBookings();
}

async function loadTodayBookings() {
  const loadingEl = document.getElementById('upcoming-bookings-loading');
  const emptyEl   = document.getElementById('upcoming-bookings-empty');
  const listEl    = document.getElementById('upcoming-bookings-list');
  loadingEl.hidden=false; emptyEl.hidden=true; listEl.hidden=true;

  const tz = 'Europe/Berlin';
  const todayStr = new Date().toLocaleDateString('sv-SE',{timeZone:tz});
  const todayStart = new Date(todayStr+'T00:00:00').toISOString();
  const todayEnd   = new Date(todayStr+'T23:59:59').toISOString();
  const ownerId = getOwnerId();

  let q = supabase.from('bookings')
    .select('*,services(title,color)')
    .eq('owner_id',ownerId)
    .gte('start_time',todayStart).lte('start_time',todayEnd)
    .neq('status','cancelled').order('start_time').limit(25);
  if (currentProfile.role!=='owner') q = q.eq('user_id',currentSession.user.id);

  const {data:bookings} = await q;
  loadingEl.hidden = true;
  document.getElementById('kpi-today').textContent = bookings?.length ?? 0;

  if (!bookings||bookings.length===0) { emptyEl.hidden=false; return; }
  listEl.innerHTML = bookings.map(b=>{
    const emp = teamMembers.find(m=>m.id===b.user_id);
    return `<li class="upcoming-item">
      <span class="upcoming-time">${fmtTime(b.start_time)}</span>
      <div><div class="upcoming-customer">${b.customer_name||'—'}</div><div class="upcoming-service">${b.services?.title||'—'}</div></div>
      <span class="upcoming-staff">${emp?.business_name||emp?.email?.split('@')[0]||''}</span>
      <span class="badge ${statusBadge(b.status)}">${b.status||''}</span>
    </li>`;
  }).join('');
  listEl.hidden = false;
}

async function openStripePortal() {
  if (!currentProfile.stripe_subscription_id) { window.location.href='/onboarding.html?step=plan'; return; }
  try {
    const {data:{session:s}} = await supabase.auth.getSession();
    const res = await fetch('/api/stripe/portal-session',{method:'POST',headers:{'Authorization':'Bearer '+s.access_token,'Content-Type':'application/json'}});
    const {url} = await res.json();
    if (url) window.location.href = url;
  } catch { showToast(t('err_generic'),'error'); }
}

async function initCalendar() {
  const ownerId = getOwnerId();
  const calEl = document.getElementById('calendarEl');
  calendar = new FullCalendar.Calendar(calEl, {
    initialView: window.innerWidth<768 ? 'timeGridDay' : 'timeGridWeek',
    headerToolbar: {left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,timeGridDay'},
    locale: currentLang,
    height: 'auto',
    slotMinTime:'06:00:00',slotMaxTime:'23:00:00',
    allDaySlot:true,selectable:true,
    dateClick(info) { openSlotPanel(info.dateStr); },
    select(info) { prefillBookingModal(info.startStr, info.endStr); },
    events: async (info,ok,fail) => {
      try {
        let q = supabase.from('bookings')
          .select('*,services(title,color)')
          .eq('owner_id',ownerId).gte('start_time',info.startStr).lte('start_time',info.endStr);
        if (currentProfile.role!=='owner') q = q.eq('user_id',currentSession.user.id);
        const {data:bks} = await q;

        const {data:leaves} = await supabase.from('time_offs')
          .select('*')
          .in('employee_id',teamMembers.map(m=>m.id))
          .lte('start_date',info.endStr).gte('end_date',info.startStr);

        const evts = [];
        (bks||[]).forEach(b => {
          const emp = teamMembers.find(m=>m.id===b.user_id);
          evts.push({
            id:b.id,title:`${b.services?.title||'Termin'} – ${b.customer_name}`,
            start:b.start_time,end:b.end_time,
            backgroundColor:b.services?.color||'#22c55e',borderColor:b.services?.color||'#22c55e',
            textColor:'#0a0a0a',extendedProps:{...b,_empName:emp?.business_name||''}
          });
        });
        (leaves||[]).forEach(l => evts.push({
          id:'leave_'+l.id,title:`❌ ${l.reason||'Beurlaubt'}`,
          start:l.start_date,end:l.end_date,allDay:true,
          backgroundColor:'#ef4444',borderColor:'#ef4444',textColor:'#fff'
        }));
        ok(evts);
      } catch(e) { fail(e); }
    },
    eventClick(info) {
      const b = info.event.extendedProps;
      if (b.customer_name) openBookingModal(b);
    }
  });
  calendar.render();
}

async function openSlotPanel(dateStr) {
  const panel = document.getElementById('slotPanel');
  const list  = document.getElementById('slotList');
  document.getElementById('slotDate').textContent = fmtDate(dateStr+'T12:00:00');
  panel.classList.add('open');

  const ownerId = getOwnerId();
  const {data:bks} = await supabase.from('bookings')
    .select('*,services(title),profiles!bookings_user_id_fkey(business_name)')
    .eq('owner_id',ownerId)
    .gte('start_time',dateStr+'T00:00:00').lte('start_time',dateStr+'T23:59:59')
    .neq('status','cancelled').order('start_time');

  if (!bks||bks.length===0) {
    list.innerHTML = `<div class="slot-item slot-free"><span>Keine Termine</span></div>`;
    return;
  }
  list.innerHTML = bks.map(b=>`
    <div class="slot-item slot-busy" data-id="${b.id}">
      <span class="slot-time">${fmtTime(b.start_time)} – ${fmtTime(b.end_time)}</span>
      <span class="slot-customer">${b.customer_name} · ${b.services?.title||''}</span>
    </div>`).join('');
  list.querySelectorAll('.slot-item').forEach(el => {
    el.addEventListener('click', () => {
      const bk = bks.find(b=>b.id===el.dataset.id);
      if (bk) openBookingModal(bk);
    });
  });
}

document.getElementById('slotPanelClose').addEventListener('click', () => {
  document.getElementById('slotPanel').classList.remove('open');
});

document.getElementById('calAddBookingBtn').addEventListener('click', () => openBookingModal(null));
document.getElementById('calAddLeaveBtn').addEventListener('click', () => {
  populateEmpSelects();
  openModal('leaveModal');
});

function prefillBookingModal(startStr, endStr) {
  document.getElementById('bk-id').value = '';
  document.getElementById('bookingModalTitle').textContent = t('lbl_manual_title');
  document.getElementById('bkDeleteBtn').hidden = true;
  document.getElementById('bkStart').value = startStr ? startStr.substring(0,16) : '';
  document.getElementById('bkEnd').value   = endStr   ? endStr.substring(0,16)   : '';
  document.getElementById('bkCustomer').value = '';
  document.getElementById('bkPhone').value    = '';
  document.getElementById('bkNotes').value    = '';
  populateEmpSelects();
  populateSrvSelect();
  openModal('bookingModal');
}

function openBookingModal(b) {
  if (!b) { prefillBookingModal(null,null); return; }
  document.getElementById('bk-id').value = b.id||'';
  document.getElementById('bookingModalTitle').textContent = t('lbl_manual_title');
  document.getElementById('bkDeleteBtn').hidden = false;
  document.getElementById('bkStart').value    = b.start_time ? b.start_time.substring(0,16) : '';
  document.getElementById('bkEnd').value      = b.end_time   ? b.end_time.substring(0,16)   : '';
  document.getElementById('bkCustomer').value = b.customer_name||'';
  document.getElementById('bkPhone').value    = b.customer_phone||'';
  document.getElementById('bkNotes').value    = b.notes||'';
  populateEmpSelects(b.user_id);
  populateSrvSelect(b.service_id);
  openModal('bookingModal');
}

function populateEmpSelects(selectedId=null) {
  ['bkEmployee','leaveEmployee'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = teamMembers.map(m=>
      `<option value="${m.id}" ${m.id===selectedId?'selected':''}>${m.business_name||m.email?.split('@')[0]}</option>`
    ).join('');
  });
}

function populateSrvSelect(selectedId=null) {
  const el = document.getElementById('bkService');
  if (!el) return;
  supabase.from('services').select('id,title').or(`owner_id.eq.${getOwnerId()},user_id.eq.${getOwnerId()}`).then(({data}) => {
    el.innerHTML = '<option value="">—</option>'+(data||[]).map(s=>
      `<option value="${s.id}" ${s.id===selectedId?'selected':''}>${s.title}</option>`
    ).join('');
  });
}

document.getElementById('bkSaveBtn').addEventListener('click', async () => {
  const id      = document.getElementById('bk-id').value;
  const empId   = document.getElementById('bkEmployee').value;
  const srvId   = document.getElementById('bkService').value||null;
  const startV  = document.getElementById('bkStart').value;
  const endV    = document.getElementById('bkEnd').value;
  const cust    = document.getElementById('bkCustomer').value.trim();
  const phone   = document.getElementById('bkPhone').value.trim();
  const notes   = document.getElementById('bkNotes').value.trim();
  if (!startV||!cust) { showToast(t('err_generic'),'error'); return; }

  const payload = {
    owner_id:getOwnerId(),user_id:empId,
    service_id:srvId||null,
    start_time:new Date(startV).toISOString(),
    end_time:endV ? new Date(endV).toISOString() : null,
    customer_name:cust,customer_email:'',customer_phone:phone||null,status:'confirmed'
  };
  const {error} = id
    ? await supabase.from('bookings').update(payload).eq('id',id)
    : await supabase.from('bookings').insert(payload);
  if (error) { showToast(t('err_generic'),'error'); return; }
  closeModal('bookingModal');
  calendar?.refetchEvents();
  if (activePanel==='overview') await loadTodayBookings();
  showToast(t('saved'));
});

document.getElementById('bkDeleteBtn').addEventListener('click', async () => {
  const id = document.getElementById('bk-id').value;
  if (!id||!confirm(t('lead_confirm_delete'))) return;
  await supabase.from('bookings').delete().eq('id',id);
  closeModal('bookingModal');
  calendar?.refetchEvents();
  if (activePanel==='overview') await loadTodayBookings();
  showToast(t('saved'));
});

document.getElementById('leaveSaveBtn').addEventListener('click', async () => {
  const empId  = document.getElementById('leaveEmployee').value;
  const start  = document.getElementById('leaveStart').value;
  const end    = document.getElementById('leaveEnd').value;
  const reason = document.getElementById('leaveReason').value.trim();
  if (!start||!end) { showToast(t('err_generic'),'error'); return; }
  const {error} = await supabase.from('time_offs').insert({
    employee_id:empId,
    start_date:new Date(start+'T00:00:00').toISOString(),
    end_date:new Date(end+'T23:59:59').toISOString(),
    reason
  });
  if (error) { showToast(t('err_generic'),'error'); return; }
  closeModal('leaveModal');
  document.getElementById('leaveReason').value = '';
  calendar?.refetchEvents();
  showToast(t('saved'));
});

let leadsCache = [];

async function loadLeads() {
  const ownerId = getOwnerId();
  const {data} = await supabase.from('leads')
    .select('*').eq('owner_id',ownerId).order('created_at',{ascending:false});
  leadsCache = data||[];
  renderLeads();
}

function renderLeads() {
  const tbody = document.getElementById('leadTableBody');
  const emptyEl = document.getElementById('leadEmpty');
  let rows = leadsCache;
  if (leadFilter!=='all') rows = rows.filter(r=>r.status===leadFilter);
  if (leadSearchVal) {
    const q = leadSearchVal.toLowerCase();
    rows = rows.filter(r=>(r.title||'').toLowerCase().includes(q)||(r.city||'').toLowerCase().includes(q)||(r.phone||'').toLowerCase().includes(q));
  }
  if (rows.length===0) { tbody.innerHTML=''; emptyEl.hidden=false; return; }
  emptyEl.hidden = true;
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td>${r.title||'—'}</td>
      <td>${r.city||'—'}</td>
      <td>${r.phone||'—'}</td>
      <td>${r.total_score??r.rating??'—'}</td>
      <td><span class="badge ${leadStatusBadge(r.status)}">${r.status||'—'}</span></td>
      <td><button class="btn-icon" data-lead-id="${r.id}" data-action="edit">✏️</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lead = leadsCache.find(l=>l.id===btn.dataset.leadId);
      if (lead) openLeadModal(lead);
    });
  });
}

function leadStatusBadge(s) {
  if (s==='won') return 'badge-green';
  if (s==='lost') return 'badge-red';
  if (s==='contacted') return 'badge-blue';
  if (s==='booked') return 'badge-yellow';
  return 'badge-gray';
}

document.querySelectorAll('.filter-btn[data-status]').forEach(btn => {
  if (btn.closest('#panel-kunden')) {
    btn.addEventListener('click', () => {
      leadFilter = btn.dataset.status;
      btn.closest('.filter-bar').querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderLeads();
    });
  }
});

document.getElementById('leadSearch').addEventListener('input', e => {
  leadSearchVal = e.target.value;
  renderLeads();
});

document.getElementById('leadAddBtn').addEventListener('click', () => openLeadModal(null));

function openLeadModal(lead) {
  document.getElementById('lead-id').value        = lead?.id||'';
  document.getElementById('lead-title').value     = lead?.title||'';
  document.getElementById('lead-category-name').value = lead?.category_name||'';
  document.getElementById('lead-phone').value     = lead?.phone||'';
  document.getElementById('lead-email').value     = lead?.email||'';
  document.getElementById('lead-website').value   = lead?.website||'';
  document.getElementById('lead-city').value      = lead?.city||'';
  document.getElementById('lead-country').value   = lead?.country_code||'';
  document.getElementById('lead-score').value     = lead?.rating??'';
  document.getElementById('lead-google-url').value = lead?.google_url||'';
  document.getElementById('lead-status').value    = lead?.status||'new';
  document.getElementById('lead-notes').value     = lead?.notes||'';
  document.getElementById('leadModalTitle').textContent = lead ? t('lead_modal_edit') : t('lead_modal_new');
  openModal('leadModal');
}

document.getElementById('leadSaveBtn').addEventListener('click', async () => {
  const id = document.getElementById('lead-id').value;
  const payload = {
    owner_id:getOwnerId(),
    title:document.getElementById('lead-title').value.trim(),
    category_name:document.getElementById('lead-category-name').value.trim()||null,
    phone:document.getElementById('lead-phone').value.trim()||null,
    email:document.getElementById('lead-email').value.trim()||null,
    website:document.getElementById('lead-website').value.trim()||null,
    city:document.getElementById('lead-city').value.trim()||null,
    country_code:document.getElementById('lead-country').value.trim()||null,
    total_score:parseFloat(document.getElementById('lead-score').value)||null,
    google_url:document.getElementById('lead-google-url').value.trim()||null,
    status:document.getElementById('lead-status').value,
    notes:document.getElementById('lead-notes').value.trim()||null
  };
  if (!payload.title) { showToast(t('err_generic'),'error'); return; }
  const {error} = id
    ? await supabase.from('leads').update(payload).eq('id',id)
    : await supabase.from('leads').insert(payload);
  if (error) { showToast(t('err_generic'),'error'); return; }
  closeModal('leadModal');
  await loadLeads();
  showToast(t('saved'));
});

document.getElementById('csvImportBtn').addEventListener('click', () => {
  document.getElementById('csvFile').click();
});
document.getElementById('csvFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const ownerId = getOwnerId();
  try {
    let rows = [];
    if (file.name.endsWith('.json')) {
      rows = JSON.parse(text);
    } else {
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h=>h.trim().replace(/"/g,''));
      rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v=>v.trim().replace(/"/g,''));
        return Object.fromEntries(headers.map((h,i)=>[h,vals[i]]));
      });
    }
    const inserts = rows.filter(r=>r.title||r.name).map(r=>({
      owner_id:ownerId,
      title:r.title||r.name||'—',
      phone:r.phone||r.phoneNumber||null,
      email:r.email||null,
      website:r.website||null,
      city:r.city||r['address.city']||null,
      country_code:r.country_code||r.country||null,
      total_score:parseFloat(r.rating||r.totalScore)||null,
      reviews_count:parseInt(r.reviews_count||r.reviewsCount)||null,
      google_url:r.google_url||r.url||null,
      status:'new'
    }));
    if (inserts.length===0) throw new Error('empty');
    await supabase.from('leads').insert(inserts);
    await loadLeads();
    showToast(t('csv_imported')+inserts.length);
  } catch(err) {
    showToast(t('csv_error')+err.message,'error');
  }
  e.target.value = '';
});

document.getElementById('apifyRunBtn').addEventListener('click', async () => {
  const sectorEl = document.getElementById('apifySector');
  const sector   = sectorEl?.value||'';
  const rawQuery = document.getElementById('apifyQuery').value.trim();
  const query    = sector && rawQuery ? `${sector} ${rawQuery}` : sector||rawQuery;
  const limit    = parseInt(document.getElementById('apifyLimit').value)||20;
  const token    = localStorage.getItem('apify_token') || prompt('Apify API Token:');
  if (!query||!token) return;
  localStorage.setItem('apify_token', token);
  const btn = document.getElementById('apifyRunBtn');
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${token}&timeout=120&memory=512`,
      {method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({searchStringsArray:[query],maxCrawledPlacesPerSearch:limit,language:'de',includeHistogram:false})}
    );
    if (!res.ok) throw new Error('HTTP '+res.status);
    const items = await res.json();
    const ownerId = getOwnerId();
    const inserts = (items||[]).map(p=>({
      owner_id:ownerId,
      company_name:p.title||p.name||'—',
      contact_name:null,
      phone:p.phone||p.phoneNumber||null,
      email:p.email||null,
      website:p.website||null,
      status:'prospect',
      notes:[
        sector?`Branche: ${sector}`:null,
        p.address?.street?`Adresse: ${p.address.street}, ${p.address.city||''}`:null,
        p.totalScore?`Bewertung: ${p.totalScore} ⭐ (${p.reviewsCount||0} Rezensionen)`:null,
        p.url?`Google Maps: ${p.url}`:null
      ].filter(Boolean).join('\n')||null
    }));
    if (inserts.length>0) await supabase.from('b2b_contacts').insert(inserts);
    await loadB2B();
    showToast(t('apify_done')+inserts.length);
  } catch(err) {
    showToast(t('apify_error')+err.message,'error');
  }
  btn.disabled=false;
  btn.textContent = 'Suchen';
});

let servicesCache = [];

async function loadServices() {
  const {data} = await supabase.from('services')
    .select('*,employee_services(employee_id)').or(`owner_id.eq.${getOwnerId()},user_id.eq.${getOwnerId()}`);
  servicesCache = data||[];
  renderServices();
  renderSrvEmpCheckboxes();
}

function renderServices() {
  const grid = document.getElementById('servicesGrid');
  if (!servicesCache.length) { grid.innerHTML='<div class="table-empty">Noch keine Dienstleistungen.</div>'; return; }
  grid.innerHTML = servicesCache.map(s=>{
    const empNames = (s.employee_services||[]).map(es=>{
      const m = teamMembers.find(tm=>tm.id===es.employee_id);
      return m ? (m.business_name||m.email?.split('@')[0]) : null;
    }).filter(Boolean).join(', ');
    return `<div class="service-card">
      <div class="service-color" style="background:${s.color||'#22c55e'}"></div>
      <div class="service-info">
        <div class="service-title">${s.title}</div>
        <div class="service-meta">${s.duration_minutes} min · ${s.price!=null?s.price+' €':'—'}</div>
        <div class="service-meta">${empNames||'—'}</div>
      </div>
      <button class="btn-icon" data-srv-del="${s.id}">🗑️</button>
    </div>`;
  }).join('');
  grid.querySelectorAll('[data-srv-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('alert_service_delete'))) return;
      await supabase.from('services').delete().eq('id',btn.dataset.srvDel);
      await loadServices();
    });
  });
}

function renderSrvEmpCheckboxes() {
  const container = document.getElementById('srvEmpCheckboxes');
  if (!container) return;
  container.innerHTML = teamMembers.map(m=>`
    <label class="checkbox-label">
      <input type="checkbox" name="srv_emp" value="${m.id}" checked>
      ${m.business_name||m.email?.split('@')[0]}
    </label>`).join('');
}

document.getElementById('srvSaveBtn').addEventListener('click', async () => {
  const title = document.getElementById('srvTitle').value.trim();
  const dur   = parseInt(document.getElementById('srvDur').value)||30;
  const price = parseFloat(document.getElementById('srvPrice').value)||0;
  const color = document.getElementById('srvColor').value;
  if (!title) { showToast(t('err_generic'),'error'); return; }
  const {data:srv,error} = await supabase.from('services').insert({
    owner_id:getOwnerId(),title,duration_minutes:dur,price,color
  }).select().single();
  if (error) { showToast(t('err_generic'),'error'); return; }
  const selected = Array.from(document.querySelectorAll('input[name="srv_emp"]:checked')).map(el=>el.value);
  if (selected.length>0) {
    await supabase.from('employee_services').insert(selected.map(eid=>({employee_id:eid,service_id:srv.id})));
  }
  document.getElementById('srvTitle').value='';
  await loadServices();
  showToast(t('saved'));
});

let hoursEmpId = null;

async function loadHoursPanel() {
  const {data:emps} = await supabase.from('profiles').select('id,business_name,email')
    .eq('owner_id',getOwnerId());
  const all = currentProfile.role==='owner'
    ? [{id:currentSession.user.id,business_name:currentProfile.business_name,email:currentSession.user.email},...(emps||[])]
    : [{id:currentSession.user.id,business_name:currentProfile.business_name,email:currentSession.user.email}];
  const sel = document.getElementById('hoursEmpSelect');
  sel.innerHTML = all.map(e=>`<option value="${e.id}">${e.business_name||e.email?.split('@')[0]}</option>`).join('');
  hoursEmpId = all[0]?.id||currentSession.user.id;
  sel.addEventListener('change', async () => { hoursEmpId=sel.value; await renderHoursGrid(); });
  await renderHoursGrid();
}

async function renderHoursGrid() {
  const {data:hours} = await supabase.from('working_hours').select('*').eq('user_id',hoursEmpId);
  const dayLabels = DAYS[currentLang]||DAYS.de;
  const grid = document.getElementById('hoursGrid');
  grid.innerHTML = '';
  for (let i=0;i<7;i++) {
    const h = hours?.find(x=>x.day_of_week===i)||{start_time:'09:00:00',end_time:'17:00:00',is_active:(i>0&&i<6)};
    const row = document.createElement('div');
    row.className = 'hours-row';
    row.innerHTML = `
      <label class="hours-day">
        <input type="checkbox" id="wh-active-${i}" ${h.is_active?'checked':''}> ${dayLabels[i]}
      </label>
      <input class="form-input" id="wh-start-${i}" type="time" value="${h.start_time.substring(0,5)}" style="width:110px;">
      <span>—</span>
      <input class="form-input" id="wh-end-${i}" type="time" value="${h.end_time.substring(0,5)}" style="width:110px;">`;
    grid.appendChild(row);
  }
}

document.getElementById('hoursSaveBtn').addEventListener('click', async () => {
  const payload = [];
  for(let i=0;i<7;i++) {
    payload.push({
      user_id:hoursEmpId,day_of_week:i,
      start_time:document.getElementById(`wh-start-${i}`).value+':00',
      end_time:document.getElementById(`wh-end-${i}`).value+':00',
      is_active:document.getElementById(`wh-active-${i}`).checked
    });
  }
  const {error} = await supabase.from('working_hours').upsert(payload,{onConflict:'user_id,day_of_week'});
  if (error) { showToast(t('err_generic'),'error'); return; }
  showToast(t('alert_hours_saved'));
});

async function loadTeam() {
  const ownerId = getOwnerId();
  let data = [];
  try {
    const res = await fetch(`${API}/team?owner_id=${ownerId}`);
    if (res.ok) data = await res.json();
  } catch {}
  if (data.length===0) {
    data = [{id:currentSession.user.id,email:currentSession.user.email,business_name:currentProfile.business_name||currentSession.user.email.split('@')[0],role:currentProfile.role}];
  }
  teamMembers = data;

  if (currentProfile.role!=='owner') return;
  const code = currentProfile.company_code||'—';
  document.getElementById('inviteCode').textContent = code;
  document.getElementById('copyInviteBtn').onclick = () => {
    navigator.clipboard.writeText(code);
    showToast(t('copied'));
  };

  const list = document.getElementById('employeeList');
  list.innerHTML = data.map(m=>`
    <div class="emp-card" data-emp-id="${m.id}">
      <div class="emp-avatar">${(m.business_name||m.email||'?')[0].toUpperCase()}</div>
      <div class="emp-info">
        <div class="emp-name">${m.business_name||m.email?.split('@')[0]} ${m.id===currentSession.user.id?t('me'):''}</div>
        <div class="emp-role">${m.role||'employee'}</div>
      </div>
      <span class="emp-arrow">›</span>
    </div>`).join('');
  list.querySelectorAll('.emp-card').forEach(card => {
    card.addEventListener('click', () => openEmpDetail(card.dataset.empId));
  });
}

let detailEmpId = null;

function openEmpDetail(empId) {
  const m = teamMembers.find(tm=>tm.id===empId);
  if (!m) return;
  detailEmpId = empId;

  document.getElementById('empDetailName').textContent  = m.business_name||m.email?.split('@')[0]||'—';
  document.getElementById('empDetailRole').textContent  = m.role||'employee';
  document.getElementById('empDetailEmail').textContent = m.email||'—';
  document.getElementById('empDetailAvatar').textContent = (m.business_name||m.email||'?')[0].toUpperCase();
  document.getElementById('teamListView').hidden  = true;
  document.getElementById('teamDetailView').hidden = false;

  const detail = document.getElementById('teamDetailView');

  detail.querySelectorAll('.tab-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
  });
  detail.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      detail.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      detail.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      const tc = document.getElementById('tab-'+btn.dataset.tab);
      if (tc) tc.classList.add('active');
      if (btn.dataset.tab==='kalender') initEmpCalTab(empId);
      if (btn.dataset.tab==='hours') loadEmpHours(empId);
      if (btn.dataset.tab==='services') loadEmpServices(empId);
    });
  });
  detail.querySelector('.tab-btn[data-tab="info"]')?.classList.add('active');
  document.getElementById('tab-info')?.classList.add('active');

  document.getElementById('empDetailBack').onclick = () => {
    document.getElementById('teamListView').hidden  = false;
    document.getElementById('teamDetailView').hidden = true;
    detailEmpId = null;
  };

  const isOwn = m.id===currentSession.user.id;
  document.getElementById('empRemoveBtn').hidden = isOwn;
  document.getElementById('empRemoveBtn').onclick = async () => {
    if (!confirm(t('btn_remove')+'?')) return;
    await supabase.from('profiles').update({owner_id:null,role:'owner'}).eq('id',m.id);
    await loadTeam();
    document.getElementById('teamListView').hidden  = false;
    document.getElementById('teamDetailView').hidden = true;
  };

  supabase.from('calendar_integrations').select('*').eq('user_id',m.id).eq('provider','google').single()
    .then(({data}) => {
      document.getElementById('empGoogleStatus').textContent = data?.access_token ? t('status_connected') : t('status_disconnected');
    });
}

function initEmpCalTab(empId) {
  const tz = 'Europe/Berlin';
  const todayStr = new Date().toLocaleDateString('sv-SE',{timeZone:tz});
  const dateInput = document.getElementById('empCalDate');
  if (!dateInput.value) dateInput.value = todayStr;

  const canEdit = currentProfile.role==='owner' || empId===currentSession.user.id;
  document.getElementById('empCalAddBtn').style.display = canEdit ? '' : 'none';

  loadEmpDaySchedule(empId, dateInput.value);

  dateInput.onchange = () => loadEmpDaySchedule(empId, dateInput.value);

  document.getElementById('empCalPrev').onclick = () => {
    const d = new Date(dateInput.value+'T12:00:00');
    d.setDate(d.getDate()-1);
    dateInput.value = d.toISOString().substring(0,10);
    loadEmpDaySchedule(empId, dateInput.value);
  };
  document.getElementById('empCalNext').onclick = () => {
    const d = new Date(dateInput.value+'T12:00:00');
    d.setDate(d.getDate()+1);
    dateInput.value = d.toISOString().substring(0,10);
    loadEmpDaySchedule(empId, dateInput.value);
  };
  document.getElementById('empCalAddBtn').onclick = () => {
    const dateVal = dateInput.value;
    prefillBookingModal(dateVal+'T09:00', dateVal+'T09:30');
    document.getElementById('bkEmployee').value = empId;
  };
}

async function loadEmpDaySchedule(empId, dateStr) {
  const list = document.getElementById('empDaySchedule');
  list.innerHTML = '<div class="emp-day-empty">Lädt…</div>';

  const dayStart = dateStr+'T00:00:00';
  const dayEnd   = dateStr+'T23:59:59';

  const [{data:bks},{data:leaves}] = await Promise.all([
    supabase.from('bookings').select('*,services(title,color)')
      .eq('user_id',empId)
      .gte('start_time',new Date(dayStart).toISOString())
      .lte('start_time',new Date(dayEnd).toISOString())
      .neq('status','cancelled').order('start_time'),
    supabase.from('time_offs').select('*')
      .eq('employee_id',empId)
      .lte('start_date',new Date(dayEnd).toISOString())
      .gte('end_date',new Date(dayStart).toISOString())
  ]);

  const items = [];
  (bks||[]).forEach(b => items.push({type:'booking',sort:b.start_time,data:b}));
  (leaves||[]).forEach(l => items.push({type:'leave',sort:l.start_date,data:l}));
  items.sort((a,b)=>a.sort.localeCompare(b.sort));

  if (!items.length) { list.innerHTML='<div class="emp-day-empty">Keine Termine</div>'; return; }

  const canEdit = currentProfile.role==='owner' || empId===currentSession.user.id;

  list.innerHTML = items.map(item => {
    if (item.type==='leave') {
      const l = item.data;
      return `<div class="emp-slot emp-slot-leave">
        <span class="emp-slot-time">❌ Ganztags</span>
        <div class="emp-slot-info">
          <div class="emp-slot-customer">${l.reason||'Abwesenheit'}</div>
        </div>
      </div>`;
    }
    const b = item.data;
    const color = b.services?.color||'var(--primary)';
    return `<div class="emp-slot" data-bk-id="${b.id}" style="border-left:3px solid ${color};">
      <span class="emp-slot-time">${fmtTime(b.start_time)}${b.end_time?' – '+fmtTime(b.end_time):''}</span>
      <div class="emp-slot-info">
        <div class="emp-slot-customer">${b.customer_name||'—'}</div>
        <div class="emp-slot-service">${b.services?.title||'—'}</div>
      </div>
      ${canEdit?`<span class="btn-icon" style="opacity:.5;font-size:12px;">✏️</span>`:''}
    </div>`;
  }).join('');

  if (canEdit) {
    list.querySelectorAll('[data-bk-id]').forEach(el => {
      el.addEventListener('click', () => {
        const bk = (bks||[]).find(b=>b.id===el.dataset.bkId);
        if (bk) openBookingModal(bk);
      });
    });
  }
}

async function loadEmpHours(empId) {
  const {data:hours} = await supabase.from('working_hours').select('*').eq('user_id',empId);
  const dayLabels = DAYS[currentLang]||DAYS.de;
  const grid = document.getElementById('empHoursGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i=0;i<7;i++) {
    const h = hours?.find(x=>x.day_of_week===i)||{start_time:'09:00:00',end_time:'17:00:00',is_active:(i>0&&i<6)};
    const row = document.createElement('div');
    row.className = 'hours-row';
    row.innerHTML = `
      <label class="hours-day">
        <input type="checkbox" id="ewh-active-${i}" ${h.is_active?'checked':''}> ${dayLabels[i]}
      </label>
      <input class="form-input" id="ewh-start-${i}" type="time" value="${h.start_time.substring(0,5)}" style="width:110px;">
      <span>—</span>
      <input class="form-input" id="ewh-end-${i}" type="time" value="${h.end_time.substring(0,5)}" style="width:110px;">`;
    grid.appendChild(row);
  }
  const saveBtn = document.getElementById('empHoursSaveBtn');
  if (saveBtn) saveBtn.onclick = async () => {
    const payload = [];
    for(let i=0;i<7;i++) {
      payload.push({
        user_id:empId,day_of_week:i,
        start_time:document.getElementById(`ewh-start-${i}`).value+':00',
        end_time:document.getElementById(`ewh-end-${i}`).value+':00',
        is_active:document.getElementById(`ewh-active-${i}`).checked
      });
    }
    const {error} = await supabase.from('working_hours').upsert(payload,{onConflict:'user_id,day_of_week'});
    if (error) { showToast(t('err_generic'),'error'); return; }
    showToast(t('alert_hours_saved'));
  };
}

async function loadEmpServices(empId) {
  const grid = document.getElementById('empServicesGrid');
  if (!grid) return;
  const [{data:all},{data:assigned}] = await Promise.all([
    supabase.from('services').select('id,title').or(`owner_id.eq.${getOwnerId()},user_id.eq.${getOwnerId()}`),
    supabase.from('employee_services').select('service_id').eq('employee_id',empId)
  ]);
  const assignedIds = new Set((assigned||[]).map(x=>x.service_id));
  grid.innerHTML = (all||[]).map(s=>`
    <label class="checkbox-label">
      <input type="checkbox" class="emp-srv-chk" data-srv="${s.id}" ${assignedIds.has(s.id)?'checked':''}>
      ${s.title}
    </label>`).join('');
  grid.querySelectorAll('.emp-srv-chk').forEach(chk => {
    chk.addEventListener('change', async () => {
      if (chk.checked) {
        await supabase.from('employee_services').insert({employee_id:empId,service_id:chk.dataset.srv});
      } else {
        await supabase.from('employee_services').delete().eq('employee_id',empId).eq('service_id',chk.dataset.srv);
      }
    });
  });
}

let b2bCache = [];

async function loadB2B() {
  const {data} = await supabase.from('b2b_contacts')
    .select('*').eq('owner_id',getOwnerId()).order('created_at',{ascending:false});
  b2bCache = data||[];
  renderB2B();
}

function renderB2B() {
  const tbody = document.getElementById('b2bTableBody');
  const emptyEl = document.getElementById('b2bEmpty');
  const q = document.getElementById('b2bSearch').value.toLowerCase();
  let rows = b2bCache;
  if (q) rows = rows.filter(r=>(r.company_name||'').toLowerCase().includes(q)||(r.contact_name||'').toLowerCase().includes(q));
  if (!rows.length) { tbody.innerHTML=''; emptyEl.hidden=false; return; }
  emptyEl.hidden = true;
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td>${r.company_name||'—'}</td>
      <td>${r.contact_name||'—'}</td>
      <td>${r.phone||'—'}</td>
      <td><span class="badge ${b2bStatusBadge(r.status)}">${r.status||'—'}</span></td>
      <td><button class="btn-icon" data-b2b-id="${r.id}" data-action="edit">✏️</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = b2bCache.find(x=>x.id===btn.dataset.b2bId);
      if (c) openB2BModal(c);
    });
  });
}

function b2bStatusBadge(s) {
  if (s==='partner') return 'badge-green';
  if (s==='inactive') return 'badge-red';
  if (s==='contacted') return 'badge-blue';
  return 'badge-gray';
}

document.getElementById('b2bSearch').addEventListener('input', renderB2B);
document.getElementById('b2bAddBtn').addEventListener('click', () => openB2BModal(null));

function openB2BModal(c) {
  document.getElementById('b2b-id').value       = c?.id||'';
  document.getElementById('b2b-company').value  = c?.company_name||'';
  document.getElementById('b2b-contact').value  = c?.contact_name||'';
  document.getElementById('b2b-phone').value    = c?.phone||'';
  document.getElementById('b2b-email').value    = c?.email||'';
  document.getElementById('b2b-status').value   = c?.status||'prospect';
  document.getElementById('b2b-notes').value    = c?.notes||'';
  document.getElementById('b2bModalTitle').textContent = c ? t('b2b_add') : t('b2b_add');
  openModal('b2bModal');
}

document.getElementById('b2bSaveBtn').addEventListener('click', async () => {
  const id = document.getElementById('b2b-id').value;
  const payload = {
    owner_id:getOwnerId(),
    company_name:document.getElementById('b2b-company').value.trim(),
    contact_name:document.getElementById('b2b-contact').value.trim()||null,
    phone:document.getElementById('b2b-phone').value.trim()||null,
    email:document.getElementById('b2b-email').value.trim()||null,
    status:document.getElementById('b2b-status').value,
    notes:document.getElementById('b2b-notes').value.trim()||null
  };
  if (!payload.company_name) { showToast(t('err_generic'),'error'); return; }
  const {error} = id
    ? await supabase.from('b2b_contacts').update(payload).eq('id',id)
    : await supabase.from('b2b_contacts').insert(payload);
  if (error) { showToast(t('err_generic'),'error'); return; }
  closeModal('b2bModal');
  await loadB2B();
  showToast(t('saved'));
});

document.getElementById('aiSendBtn').addEventListener('click', async () => {
  const input = document.getElementById('aiInput');
  const msg = input.value.trim();
  if (!msg) return;
  const msgs = document.getElementById('aiMessages');
  msgs.innerHTML += `<div class="msg-bubble user">${msg}</div>`;
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
  setTimeout(() => {
    msgs.innerHTML += `<div class="msg-bubble ai">Funktion in Kürze verfügbar.</div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }, 600);
});
document.getElementById('aiInput').addEventListener('keydown', e => {
  if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); document.getElementById('aiSendBtn').click(); }
});

async function loadSettings() {
  document.getElementById('setBiz').value  = currentProfile.business_name||'';
  document.getElementById('setLang').value = currentLang;
  document.getElementById('accEmail').textContent = currentSession.user.email||'—';
  const planName = currentProfile.plan ? currentProfile.plan.charAt(0).toUpperCase()+currentProfile.plan.slice(1) : '—';
  document.getElementById('accPlanBadge').textContent = planName;

  const {data:integ} = await supabase.from('calendar_integrations')
    .select('*').eq('user_id',currentSession.user.id).eq('provider','google').single();
  const calStatus = document.getElementById('googleCalStatus');
  const calBtn    = document.getElementById('googleCalBtn');
  if (integ?.access_token) {
    calStatus.textContent = t('status_connected');
    calStatus.className = 'integration-status connected';
    calBtn.textContent = t('btn_disconnect');
    calBtn.onclick = async () => { await supabase.from('calendar_integrations').delete().eq('id',integ.id); loadSettings(); };
  } else {
    calStatus.textContent = t('status_disconnected');
    calStatus.className = 'integration-status';
    calBtn.textContent = t('btn_connect');
    calBtn.onclick = () => { window.location.href=`${API}/calendar/google-auth?userId=${currentSession.user.id}`; };
  }
}

document.getElementById('profileSaveBtn').addEventListener('click', async () => {
  const biz  = document.getElementById('setBiz').value.trim();
  const lang = document.getElementById('setLang').value;
  const {error} = await supabase.from('profiles').update({business_name:biz,language:lang}).eq('id',currentSession.user.id);
  if (error) { showToast(t('err_generic'),'error'); return; }
  currentProfile.business_name = biz;
  currentLang = lang;
  localStorage.setItem('infinity_lang',lang);
  document.getElementById('bizName').textContent = biz;
  applyI18n();
  renderSidebar();
  showToast(t('saved'));
});

document.getElementById('pwChangeBtn').addEventListener('click', async () => {
  const pw = document.getElementById('setPw').value;
  if (pw.length<6) { showToast(t('err_generic'),'error'); return; }
  const {error} = await supabase.auth.updateUser({password:pw});
  if (error) { showToast(t('err_generic'),'error'); return; }
  document.getElementById('setPw').value = '';
  showToast(t('pw_changed'));
});

document.getElementById('subPortalBtn').addEventListener('click', openStripePortal);
document.getElementById('subUpgradeBtn').addEventListener('click', () => { window.location.href='/onboarding.html?step=plan'; });

async function ensureCompanyCode() {
  if (currentProfile.role!=='owner'||currentProfile.company_code) return;
  const base = (currentProfile.business_name||currentSession.user.email.split('@')[0]).replace(/[^A-Za-z0-9]/g,'').toUpperCase().substring(0,10);
  const code = 'INF-'+base;
  await supabase.from('profiles').update({company_code:code}).eq('id',currentSession.user.id);
  currentProfile.company_code = code;
}

async function init() {
  try {
    await ensureCompanyCode();
    applyI18n();
    renderSidebar();
    await loadTeam();
    await renderOverview();
    await initCalendar();
  } catch(e) {
    console.error('[dashboard init]', e);
  } finally {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = '';
  }
}

init();
