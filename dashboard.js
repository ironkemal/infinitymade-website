import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { mountCalendar } from './calendar-widget.js?v=20260512h';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API = 'https://n8n.infinitymade.de/api';

const T = {
  de: {
    logout:'Abmelden',
    nav_overview:'Übersicht',nav_calendar:'Kalender',nav_kunden:'Kunden Info',
    nav_services:'Dienstleistungen',nav_hours:'Arbeitszeiten',
    nav_team:'Mitarbeiter',nav_b2b:'B2B',nav_b2c:'B2C Mail',nav_feedback:'Feedback',nav_settings:'Einstellungen',
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
    lbl_other:'Andere',
    saved:'Gespeichert.',pw_changed:'Passwort geändert.',err_generic:'Ein Fehler ist aufgetreten.',
    copied:'Kopiert!',csv_imported:'Importiert: ',csv_error:'CSV-Fehler: ',
    apify_error:'Apify-Fehler: ',apify_done:'Importiert: ',me:'(Sie)',
    nav_doctors:'Ärzte',nav_notizen:'Notizen',nav_beispielmodus:'Beispielmodus',
    doctors_sub:'Ärzte in der Nähe finden',notizen_sub:'Patientennotizen & Berichte',b2c_sub:'Kundenmailings & KI-Assistent',
    beispielmodus_sub:'Anatomie-Haritas für Patientengespräche',
    lbl_doctor_notes:'Arztnotizen',lbl_therapist_notes:'Therapeutennotizen',
    lbl_ai_summary:'AI-Bericht',lbl_send_patient:'An Patient senden',
    lbl_select_patient:'Patient wählen',lbl_notes_empty:'Keine Notizen vorhanden.'
  },
  en: {
    logout:'Sign out',
    nav_overview:'Overview',nav_calendar:'Calendar',nav_kunden:'Customers',
    nav_services:'Services',nav_hours:'Working Hours',
    nav_team:'Team',nav_b2b:'B2B',nav_b2c:'B2C Mail',nav_feedback:'Feedback',nav_settings:'Settings',
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
    lbl_other:'Other',
    saved:'Saved.',pw_changed:'Password changed.',err_generic:'An error occurred.',
    copied:'Copied!',csv_imported:'Imported: ',csv_error:'CSV error: ',
    apify_error:'Apify error: ',apify_done:'Imported: ',me:'(You)',
    nav_doctors:'Doctors',nav_notizen:'Notes',nav_beispielmodus:'Demo Mode',
    doctors_sub:'Find nearby doctors',notizen_sub:'Patient notes & reports',b2c_sub:'Customer mailings & AI assistant',
    beispielmodus_sub:'Anatomy maps for patient consultations',
    lbl_doctor_notes:'Doctor notes',lbl_therapist_notes:'Therapist notes',
    lbl_ai_summary:'AI Report',lbl_send_patient:'Send to patient',
    lbl_select_patient:'Select patient',lbl_notes_empty:'No notes available.'
  },
  tr: {
    logout:'Çıkış',
    nav_overview:'Genel Bakış',nav_calendar:'Takvim',nav_kunden:'Müşteri Bilgisi',
    nav_services:'Hizmetler',nav_hours:'Çalışma Saatleri',
    nav_team:'Personel',nav_b2b:'B2B',nav_b2c:'B2C Mail',nav_feedback:'Geri Bildirim',nav_settings:'Ayarlar',
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
    lbl_other:'Diğer',
    saved:'Kaydedildi.',pw_changed:'Şifre değiştirildi.',err_generic:'Bir hata oluştu.',
    copied:'Kopyalandı!',csv_imported:'İçe aktarıldı: ',csv_error:'CSV hatası: ',
    apify_error:'Apify hatası: ',apify_done:'İçe aktarıldı: ',me:'(Siz)',
    nav_doctors:'Doktorlar',nav_notizen:'Notlar',nav_beispielmodus:'Örnek Modu',
    doctors_sub:'Yakındaki doktorları bul',notizen_sub:'Hasta notları ve raporlar',b2c_sub:'Müşteri maileri ve AI asistanı',
    beispielmodus_sub:'Hasta görüşmeleri için anatomi haritaları',
    lbl_doctor_notes:'Doktor notları',lbl_therapist_notes:'Terapist notları',
    lbl_ai_summary:'AI Raporu',lbl_send_patient:'Hastaya gönder',
    lbl_select_patient:'Hasta seç',lbl_notes_empty:'Not bulunmuyor.'
  }
};

const PLAN_FEATURES = {
  starter: {
    de:['WhatsApp KI-Assistent (24/7)','Automatische Erinnerungen','Warteliste-Automation','InfinityMade Online-Terminbuchung','DSGVO-konform'],
    en:['WhatsApp AI Assistant (24/7)','Automatic reminders','Waitlist automation','InfinityMade online booking','GDPR-compliant'],
    tr:['WhatsApp KI Asistanı (7/24)','Otomatik hatırlatmalar','Bekleme listesi otomasyonu','InfinityMade online randevu','DSGVO uyumlu']
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
  },
  mitarbeiter: {
    de:['Online-Terminbuchung','Kalender-Synchronisation','Arbeitszeiten-Verwaltung','DSGVO-konform'],
    en:['Online booking','Calendar sync','Working hours management','GDPR-compliant'],
    tr:['Online randevu','Takvim senkronizasyonu','Çalışma saatleri yönetimi','DSGVO uyumlu']
  }
};

const SECTOR_PANELS = {
  default: [
    {id:'overview',icon:'📊',key:'nav_overview',roles:['owner','employee']},
    {id:'calendar',icon:'📅',key:'nav_calendar',roles:['owner','employee']},
    {id:'kunden',  icon:'👥',key:'nav_kunden',  roles:['owner','employee']},
    {id:'services',icon:'✂️', key:'nav_services',roles:['owner']},
    {id:'hours',   icon:'🕐',key:'nav_hours',   roles:['owner','employee']},
    {id:'team',    icon:'👤',key:'nav_team',    roles:['owner']},
    {id:'b2b',     icon:'🤝',key:'nav_b2b',     roles:['owner']},
    {id:'b2c',     icon:'📧',key:'nav_b2c',     roles:['owner','employee']},
    {id:'feedback',icon:'💬',key:'nav_feedback',roles:['owner','employee']},
    {id:'settings',icon:'⚙️', key:'nav_settings',roles:['owner','employee']}
  ],
  physiotherapy: [
    {id:'overview',icon:'📊',key:'nav_overview',roles:['owner','employee']},
    {id:'calendar',icon:'📅',key:'nav_calendar',roles:['owner','employee']},
    {id:'kunden',  icon:'👥',key:'nav_kunden',  roles:['owner','employee']},
    {id:'notizen', icon:'📝',key:'nav_notizen', roles:['owner','employee']},
    {id:'services',icon:'✂️', key:'nav_services',roles:['owner']},
    {id:'hours',   icon:'🕐',key:'nav_hours',   roles:['owner','employee']},
    {id:'team',    icon:'👤',key:'nav_team',    roles:['owner']},
    {id:'doctors', icon:'🏥',key:'nav_doctors',   roles:['owner','employee']},
    {id:'b2b',     icon:'🤝',key:'nav_b2b',     roles:['owner']},
    {id:'b2c',     icon:'📧',key:'nav_b2c',     roles:['owner','employee']},
    {id:'beispielmodus',icon:'🦴',key:'nav_beispielmodus',roles:['owner','employee']},
    {id:'feedback',icon:'💬',key:'nav_feedback',roles:['owner','employee']},
    {id:'settings',icon:'⚙️', key:'nav_settings',roles:['owner','employee']}
  ],
  praxis: [
    {id:'overview',icon:'📊',key:'nav_overview',roles:['owner','employee']},
    {id:'calendar',icon:'📅',key:'nav_calendar',roles:['owner','employee']},
    {id:'kunden',  icon:'👥',key:'nav_kunden',  roles:['owner','employee']},
    {id:'notizen', icon:'📝',key:'nav_notizen', roles:['owner','employee']},
    {id:'services',icon:'✂️', key:'nav_services',roles:['owner']},
    {id:'hours',   icon:'🕐',key:'nav_hours',   roles:['owner','employee']},
    {id:'team',    icon:'👤',key:'nav_team',    roles:['owner']},
    {id:'doctors', icon:'🏥',key:'nav_doctors',   roles:['owner','employee']},
    {id:'b2b',     icon:'🤝',key:'nav_b2b',     roles:['owner']},
    {id:'b2c',     icon:'📧',key:'nav_b2c',     roles:['owner','employee']},
    {id:'beispielmodus',icon:'🦴',key:'nav_beispielmodus',roles:['owner','employee']},
    {id:'settings',icon:'⚙️', key:'nav_settings',roles:['owner','employee']}
  ]
};

const DAYS = {
  de:['So','Mo','Di','Mi','Do','Fr','Sa'],
  en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  tr:['Paz','Pzt','Sal','Çar','Per','Cum','Cmt']
};

let currentLang = localStorage.getItem('infinity_lang') || 'de';
let currentProfile = null;
let currentSession = null;
let ownerProfile = null;
let teamMembers = [];
let calendar = null;
let selectedEmployeeId = null;
let ownerServices = [];
let activePanel = 'overview';
let leadFilter = 'all';
let leadSearchVal = '';

(async function boot() {
  try {
    const { data: authData } = await supabase.auth.getSession();
    const session = authData?.session;
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    currentSession = session;

    const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profErr) console.error('[profile]', profErr);
    currentProfile = profile || { id: session.user.id, email: session.user.email, plan:'starter', role:'owner', is_active:true };
    if (currentProfile.language && !localStorage.getItem('infinity_lang')) currentLang = currentProfile.language;

    if (currentProfile.role !== 'owner' && currentProfile.owner_id) {
      const { data: owner } = await supabase.from('profiles').select('sector').eq('id', currentProfile.owner_id).maybeSingle();
      if (owner) ownerProfile = owner;
    }

    await init();
  } catch (e) {
    console.error('[boot]', e);
    window.location.href = 'login.html';
  }
})();

function t(key) { return (T[currentLang]||T.de)[key]||key; }
function getOwnerId() { return currentProfile.role==='owner' ? currentSession.user.id : currentProfile.owner_id; }

function getSector() {
  if (currentProfile.role === 'owner') return currentProfile.sector || 'default';
  return ownerProfile?.sector || currentProfile.sector || 'default';
}
function getSidebarItems() {
  const sector = getSector();
  return SECTOR_PANELS[sector] || SECTOR_PANELS.default;
}

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
  getSidebarItems().forEach(item => {
    if (!item.roles.includes(role)) return;
    const btn = document.createElement('button');
    btn.className = 'sidebar-item' + (item.id===activePanel ? ' active' : '');
    btn.dataset.panel = item.id;
    btn.innerHTML = `<span class="icon">${item.icon}</span><span>${t(item.key)}</span>`;
    btn.addEventListener('click', () => switchPanel(item.id));
    nav.appendChild(btn);
  });
}

async function switchPanel(id) {
  activePanel = id;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('panel-'+id);
  if (target) target.classList.add('active');
  renderSidebar();
  closeSidebar();
  if (id==='calendar'){ if(!calendar) await initCalendar(); else calendar.reloadMonth(); }
  if (id==='kunden') loadLeads();
  if (id==='services') loadServices();
  if (id==='hours') loadHoursPanel();
  if (id==='team') loadTeam();
  if (id==='b2b') { loadB2B(); checkB2bSetup(); }
  if (id==='b2c') { loadB2C(); checkB2cSetup(); }
  if (id==='settings') loadSettings();
  if (id==='doctors') loadDoctors();
  if (id==='notizen') loadNotizen();
  if (id==='beispielmodus') loadBeispielmodus();
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

let scheduleDate = new Date();

function hexToHSL(hex) {
  let r=0,g=0,b=0;
  if (hex.length===4){r=parseInt('0x'+hex[1]+hex[1]);g=parseInt('0x'+hex[2]+hex[2]);b=parseInt('0x'+hex[3]+hex[3]);}
  else if (hex.length===7){r=parseInt('0x'+hex[1]+hex[2]);g=parseInt('0x'+hex[3]+hex[4]);b=parseInt('0x'+hex[5]+hex[6]);}
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0,s=0,l=(max+min)/2;
  if (max!==min){
    const d=max-min;
    s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){
      case r:h=((g-b)/d+(g<b?6:0))/6;break;
      case g:h=((b-r)/d+2)/6;break;
      case b:h=((r-g)/d+4)/6;break;
    }
  }
  return {h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};
}
function hslToHex(h,s,l){
  s/=100; l/=100;
  const k=n=>(n+h/30)%12;
  const a=s*Math.min(l,1-l);
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  const toHex=x=>Math.round(x*255).toString(16).padStart(2,'0');
  return '#'+toHex(f(0))+toHex(f(8))+toHex(f(4));
}
function shiftColorForTime(hex, hour){
  if (!hex || hex==='null') return null;
  const hsl = hexToHSL(hex);
  const factor = Math.max(0, Math.min(1, (hour - 8) / 12));
  hsl.l = Math.max(38, Math.min(68, hsl.l - factor * 18));
  hsl.s = Math.max(40, Math.min(95, hsl.s - factor * 22));
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

function findGaps(whStart, whEnd, bookings) {
  try {
    let current = (whStart || '09:00:00').substring(0,5);
    const end   = (whEnd   || '18:00:00').substring(0,5);
    if (!current || !end) return [];
    const gaps = [];
    const sorted = [...bookings].sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
    for (const b of sorted) {
      const bStart = new Date(b.start_time).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Berlin'});
      const durMin = b.services?.duration_minutes || 30;
      const bEndRaw = b.end_time ? new Date(b.end_time) : new Date(new Date(b.start_time).getTime() + durMin*60000);
      const bEnd = bEndRaw.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Berlin'});
      if (bStart > current) gaps.push({start: current, end: bStart});
      if (bEnd > current) current = bEnd;
    }
    if (current < end) gaps.push({start: current, end});
    return gaps;
  } catch(e) { console.error('[findGaps]', e); return []; }
}

async function renderGaps() {
  try {
    const tz = 'Europe/Berlin';
    const container = document.getElementById('gapsList');
    if (!container) return;

    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE',{timeZone:tz});
    const today = new Date(todayStr + 'T00:00:00');
    const tomorrow = new Date(today.getTime() + 86400000);
    const todayDow = today.getDay();
    const tomorrowDow = tomorrow.getDay();

    const ownerId = getOwnerId();
    const { data: whAll } = await supabase.from('working_hours')
      .select('day_of_week,start_time,end_time,is_active')
      .eq('user_id', ownerId)
      .eq('is_active', true);
    const whMap = {};
    whAll?.forEach(r => whMap[r.day_of_week] = r);

    const todayEndIso = new Date(today.getTime() + 86399000).toISOString();
    const tomorrowEndIso = new Date(tomorrow.getTime() + 86399000).toISOString();
    let q = supabase.from('bookings')
      .select('start_time,end_time,services(duration_minutes),status')
      .eq('owner_id', ownerId)
      .gte('start_time', today.toISOString()).lte('start_time', tomorrowEndIso)
      .neq('status','cancelled').order('start_time');
    if (currentProfile.role !== 'owner') q = q.eq('user_id', currentSession.user.id);
    const { data: bookings } = await q;

    const allGaps = [];
    const whToday = whMap[todayDow];
    if (whToday) {
      const todayBookings = (bookings||[]).filter(b => {
        const d = new Date(b.start_time);
        return d >= today && d < new Date(today.getTime() + 86400000);
      });
      findGaps(whToday.start_time, whToday.end_time, todayBookings).forEach(g =>
        allGaps.push({day: 'Heute', start: g.start, end: g.end})
      );
    }
    const whTom = whMap[tomorrowDow];
    if (whTom) {
      const tomBookings = (bookings||[]).filter(b => {
        const d = new Date(b.start_time);
        return d >= tomorrow && d < new Date(tomorrow.getTime() + 86400000);
      });
      findGaps(whTom.start_time, whTom.end_time, tomBookings).forEach(g =>
        allGaps.push({day: 'Morgen', start: g.start, end: g.end})
      );
    }

    const totalEl = document.getElementById('gapsTotal');
    if (allGaps.length === 0) {
      container.innerHTML = '<div class="gap-empty">Keine freien Zeiten.</div>';
      if (totalEl) totalEl.textContent = '0 min';
      return;
    }
    const totalFreeMin = allGaps.reduce((sum, g) => {
      const s = parseInt(g.start.split(':')[0])*60 + parseInt(g.start.split(':')[1]);
      const e = parseInt(g.end.split(':')[0])*60 + parseInt(g.end.split(':')[1]);
      return sum + (e - s);
    }, 0);
    const totalH = Math.floor(totalFreeMin / 60);
    const totalM = totalFreeMin % 60;
    if (totalEl) totalEl.textContent = totalH > 0 ? `${totalH}h ${totalM}min` : `${totalM}min`;

    container.innerHTML = allGaps.map(g => {
      const durMin = Math.round((new Date('2000-01-01T' + g.end) - new Date('2000-01-01T' + g.start)) / 60000);
      return `<div class="gap-card">
        <div class="gap-card-top">
          <span class="gap-card-dur">${durMin} min</span>
        </div>
        <div class="gap-card-time">${g.start} - ${g.end}</div>
      </div>`;
    }).join('');
  } catch(e) { console.error('[renderGaps]', e); }
}

async function renderGapsForDate(date) {
  try {
    const tz = 'Europe/Berlin';
    const container = document.getElementById('gapsList');
    if (!container) return;
    if (!date) date = scheduleDate;

    const dateStr = date.toLocaleDateString('sv-SE',{timeZone:tz});
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayDow = dayStart.getDay();

    const labelEl = document.getElementById('gapsDateLabel');
    if (labelEl) {
      const todayStr = new Date().toLocaleDateString('sv-SE',{timeZone:tz});
      const isToday = dateStr === todayStr;
      const fmt = new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'numeric',month:'short'}).format(dayStart);
      labelEl.textContent = isToday ? 'Freie Zeiten' : fmt;
    }

    const ownerId = getOwnerId();
    const { data: whAll } = await supabase.from('working_hours')
      .select('day_of_week,start_time,end_time,is_active')
      .eq('user_id', ownerId)
      .eq('is_active', true);
    const whMap = {};
    whAll?.forEach(r => whMap[r.day_of_week] = r);

    const dayEndIso = new Date(dayStart.getTime() + 86399000).toISOString();
    let q = supabase.from('bookings')
      .select('start_time,end_time,services(duration_minutes),status')
      .eq('owner_id', ownerId)
      .gte('start_time', dayStart.toISOString()).lte('start_time', dayEndIso)
      .neq('status','cancelled').order('start_time');
    if (currentProfile.role !== 'owner') q = q.eq('user_id', currentSession.user.id);
    const { data: bookings } = await q;

    const totalEl = document.getElementById('gapsTotal');
    const wh = whMap[dayDow];
    if (!wh) {
      container.innerHTML = '<div class="gap-empty">Keine Arbeitszeiten für diesen Tag.</div>';
      if (totalEl) totalEl.textContent = '0 min';
      return;
    }

    const dayBookings = (bookings||[]).filter(b => {
      const d = new Date(b.start_time);
      return d >= dayStart && d < new Date(dayStart.getTime() + 86400000);
    });
    const allGaps = findGaps(wh.start_time, wh.end_time, dayBookings).map(g => ({day: 'Heute', start: g.start, end: g.end}));

    if (allGaps.length === 0) {
      container.innerHTML = '<div class="gap-empty">Keine freien Zeiten.</div>';
      if (totalEl) totalEl.textContent = '0 min';
      return;
    }
    const totalFreeMin = allGaps.reduce((sum, g) => {
      const s = parseInt(g.start.split(':')[0])*60 + parseInt(g.start.split(':')[1]);
      const e = parseInt(g.end.split(':')[0])*60 + parseInt(g.end.split(':')[1]);
      return sum + (e - s);
    }, 0);
    const totalH = Math.floor(totalFreeMin / 60);
    const totalM = totalFreeMin % 60;
    if (totalEl) totalEl.textContent = totalH > 0 ? `${totalH}h ${totalM}min` : `${totalM}min`;

    container.innerHTML = allGaps.map(g => {
      const durMin = Math.round((new Date('2000-01-01T' + g.end) - new Date('2000-01-01T' + g.start)) / 60000);
      return `<div class="gap-card">
        <div class="gap-card-top">
          <span class="gap-card-dur">${durMin} min</span>
        </div>
        <div class="gap-card-time">${g.start} - ${g.end}</div>
      </div>`;
    }).join('');
  } catch(e) { console.error('[renderGapsForDate]', e); }
}

async function loadScheduleBookings(date) {
  scheduleDate = date;
  const loadingEl = document.getElementById('upcoming-bookings-loading');
  const emptyEl   = document.getElementById('upcoming-bookings-empty');
  const listEl    = document.getElementById('upcoming-bookings-list');
  const labelEl   = document.getElementById('scheduleDateLabel');
  loadingEl.hidden=false; emptyEl.hidden=true; listEl.hidden=true;

  const today = new Date();
  const dayDiff = Math.round((date - new Date(today.toDateString())) / 86400000);
  const isToday = dayDiff===0;
  const fmtDate = new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'numeric',month:'short'}).format(date);
  labelEl.textContent = isToday ? 'Heutige Termine' : fmtDate;

  const tz = 'Europe/Berlin';
  const dStr = date.toLocaleDateString('sv-SE',{timeZone:tz});
  const dStart = new Date(dStr+'T00:00:00').toISOString();
  const dEnd   = new Date(dStr+'T23:59:59').toISOString();
  const ownerId = getOwnerId();

  let q = supabase.from('bookings')
    .select('*,services(title,color)')
    .eq('owner_id',ownerId)
    .gte('start_time',dStart).lte('start_time',dEnd)
    .neq('status','cancelled').order('start_time').limit(25);
  if (currentProfile.role!=='owner') q = q.eq('user_id',currentSession.user.id);

  const {data:bookings} = await q;
  loadingEl.hidden = true;
  if (isToday) document.getElementById('kpi-today').textContent = bookings?.length ?? 0;

  if (!bookings||bookings.length===0) { emptyEl.hidden=false; return; }
  const fallbackColors = ['#f97316','#3b82f6','#ec4899','#a855f7','#ef4444'];
  const nowIso = new Date().toISOString();
  const greenIndices = new Set();
  if (isToday) {
    const idx = bookings.findIndex(b => b.start_time >= nowIso);
    if (idx !== -1) { greenIndices.add(idx); if (idx + 1 < bookings.length) greenIndices.add(idx + 1); }
  }
  listEl.innerHTML = bookings.map((b,i)=>{
    const emp = teamMembers.find(m=>m.id===b.user_id);
    const dur = b.end_time
      ? Math.round((new Date(b.end_time)-new Date(b.start_time))/60000)+' min'
      : (b.services?.duration_minutes ? b.services.duration_minutes+' min' : '—');
    const hourStr = new Date(b.start_time).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Berlin'});
    const hour = parseInt(hourStr.split(':')[0]) + parseInt(hourStr.split(':')[1])/60;
    const isClose = greenIndices.has(i);
    const baseColor = isClose ? '#22c55e' : (b.services?.color || fallbackColors[i % fallbackColors.length]);
    const color = shiftColorForTime(baseColor, hour);
    const staff = emp?.business_name||emp?.email?.split('@')[0]||'';
    const isOwner = currentProfile.role==='owner';
    return `<div class="schedule-card" style="background:${color};">
      <div class="schedule-card-dur">${dur}</div>
      <div class="schedule-card-name">${b.customer_name||'—'}</div>
      <div class="schedule-card-time">${fmtTime(b.start_time)}</div>
      ${isOwner && staff ? `<div class="schedule-card-staff">${staff}</div>` : ''}
    </div>`;
  }).join('');
  listEl.hidden = false;
}

async function loadTodayBookings() { return loadScheduleBookings(new Date()); }

async function openStripePortal() {
  if (!currentProfile.stripe_subscription_id) { window.location.href='/onboarding.html?step=plan'; return; }
  try {
    const {data:{session:s}} = await supabase.auth.getSession();
    const res = await fetch('/api/stripe/portal-session',{method:'POST',headers:{'Authorization':'Bearer '+s.access_token,'Content-Type':'application/json'}});
    const {url} = await res.json();
    if (url) window.location.href = url;
  } catch { showToast(t('err_generic'),'error'); }
}

function renderCalEmpList() {
  const container = document.getElementById('calEmpList');
  console.log('[DASHBOARD] renderCalEmpList container=', container, 'teamMembers.length=', teamMembers.length);
  if (!container) return;
  container.innerHTML = '<div class="cal-emp-title">Mitarbeiter</div>' +
    teamMembers.map(m => `
      <button class="cal-emp-pick ${m.id === selectedEmployeeId ? 'active' : ''}" data-emp-id="${m.id}">
        <div class="cal-emp-dot">${(m.business_name || m.email || '?')[0].toUpperCase()}</div>
        <span>${m.business_name || m.email?.split('@')[0]}</span>
      </button>
    `).join('');
  container.querySelectorAll('.cal-emp-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const empId = btn.dataset.empId;
      if (empId === selectedEmployeeId) return;
      selectedEmployeeId = empId;
      renderCalEmpList();
      updateCalendarForEmployee(empId);
    });
  });
}

async function getEmployeeWorkingHours(empId) {
  const { data: wh } = await supabase.from('working_hours')
    .select('day_of_week, is_active').eq('user_id', empId);
  if ((wh || []).length > 0) return wh;
  const ownerId = getOwnerId();
  const { data: ownerWh } = await supabase.from('working_hours')
    .select('day_of_week, is_active').eq('user_id', ownerId);
  return ownerWh || [];
}

async function updateCalendarForEmployee(empId) {
  if (!calendar) return;
  const wh = await getEmployeeWorkingHours(empId);
  const offWeekdays = [];
  for (let d = 0; d < 7; d++) {
    const row = wh.find(w => w.day_of_week === d);
    if (!row || !row.is_active) offWeekdays.push(d);
  }
  calendar.setDisabled({ weekdays: offWeekdays });
  await calendar.reloadMonth();
}

async function loadSlots(dateStr, durationMinutes, serviceId, serviceTitle) {
  if (!calendar) return;
  calendar.setSideHead('Slots');
  try {
    const res = await fetch(`${API}/booking/get-slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: selectedEmployeeId,
        date: dateStr,
        duration: durationMinutes,
        buffer: 0,
        step: 30
      })
    });
    const data = await res.json();
    const slots = data.slots || [];
    const slotItems = slots.map(slot => ({
      label: slot,
      onClick: () => {
        prefillBookingModalFromSlot(dateStr, slot, selectedEmployeeId, serviceId, serviceTitle);
      }
    }));
    calendar.renderSide(slotItems);
  } catch (e) {
    console.error('loadSlots error:', e);
    calendar.renderSide([]);
  }
}

function prefillBookingModalFromSlot(dateStr, timeStr, empId, serviceId, serviceTitle) {
  const [h, m] = timeStr.split(':').map(Number);
  const dur = ownerServices.find(s => s.id === serviceId)?.duration_minutes || 30;
  let endH = h + Math.floor((m + dur) / 60);
  let endM = (m + dur) % 60;
  endH = endH % 24;
  const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  const startIso = `${dateStr}T${timeStr}:00`;
  const endIso = `${dateStr}T${endStr}:00`;
  document.getElementById('bk-id').value = '';
  document.getElementById('bookingModalTitle').textContent = t('lbl_manual_title');
  document.getElementById('bkDeleteBtn').hidden = true;
  document.getElementById('bkStart').value = startIso.substring(0, 16);
  document.getElementById('bkEnd').value = endIso.substring(0, 16);
  document.getElementById('bkCustomer').value = '';
  document.getElementById('bkPhone').value = '';
  document.getElementById('bkNotes').value = '';
  populateEmpSelects(empId);
  populateSrvSelect(serviceId);
  openModal('bookingModal');
}

async function initCalendar() {
  console.log('[DASHBOARD] initCalendar START');
  const ownerId = getOwnerId();
  const calEl = document.getElementById('calendarEl');
  calEl.innerHTML = '';

  if (!selectedEmployeeId) {
    selectedEmployeeId = currentProfile.role === 'owner'
      ? (teamMembers[0]?.id || currentSession.user.id)
      : currentSession.user.id;
  }

  const { data: srvData } = await supabase.from('services')
    .select('*,employee_services(employee_id)')
    .or(`owner_id.eq.${ownerId},user_id.eq.${ownerId}`);
  ownerServices = srvData || [];
  console.log('[DASHBOARD] ownerServices loaded:', ownerServices.length);

  renderCalEmpList();

  const wh = await getEmployeeWorkingHours(selectedEmployeeId);
  const offWeekdays = [];
  for (let d = 0; d < 7; d++) {
    const row = wh.find(w => w.day_of_week === d);
    if (!row || !row.is_active) offWeekdays.push(d);
  }

  calendar = mountCalendar(calEl, {
    disabledWeekdays: offWeekdays,
    emptyText: 'Keine freien Termine verfügbar.',
    placeholder: 'Bitte Datum wählen',
    onMonthChange: async (year, month) => {
      const start = new Date(year, month, 1).toISOString().split('T')[0];
      const end = new Date(year, month + 1, 0).toISOString().split('T')[0] + 'T23:59:59';
      let q = supabase.from('bookings').select('start_time')
        .eq('owner_id', ownerId).neq('status', 'cancelled')
        .gte('start_time', start).lte('start_time', end);
      if (currentProfile.role !== 'owner') {
        q = q.eq('user_id', currentSession.user.id);
      } else if (selectedEmployeeId) {
        q = q.eq('user_id', selectedEmployeeId);
      }
      const { data } = await q;
      const dots = {};
      (data || []).forEach(b => { dots[b.start_time.split('T')[0]] = true; });
      return dots;
    },
    onDaySelect: async (dateStr) => {
      console.log('[DASHBOARD] onDaySelect:', dateStr, 'employee:', selectedEmployeeId);
      const empServices = ownerServices.filter(s =>
        (s.employee_services || []).some(es => es.employee_id === selectedEmployeeId)
      );
      const displayServices = empServices.length > 0 ? empServices : ownerServices;
      const items = [];
      displayServices.forEach(s => {
        items.push({
          label: s.title,
          meta: `${s.duration_minutes || 30} min`,
          color: s.color || '#22c55e',
          onClick: () => loadSlots(dateStr, s.duration_minutes || 30, s.id, s.title)
        });
      });
      items.push({
        label: t('lbl_other') || 'Andere',
        meta: '30 min',
        color: '#94a3b8',
        onClick: () => loadSlots(dateStr, 30, null, 'Andere')
      });
      return items;
    }
  });
}

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

document.getElementById('bkPhone').addEventListener('blur', async () => {
  const phone = document.getElementById('bkPhone').value.trim();
  const hint  = document.getElementById('bkWaHint');
  if (!hint||!phone) { if(hint) hint.hidden=true; return; }
  const norm = normalize_phone_js(phone);
  if (!norm) { hint.hidden=true; return; }
  const {data:wa} = await supabase.from('wa_contacts')
    .select('wa_id,customer_name').eq('business_id',getOwnerId()).eq('phone',norm).maybeSingle();
  if (wa) {
    hint.textContent = `💬 WhatsApp bekannt: ${wa.customer_name||wa.wa_id}`;
    hint.hidden = false;
    if (!document.getElementById('bkCustomer').value) document.getElementById('bkCustomer').value = wa.customer_name||'';
  } else {
    hint.hidden = true;
  }
});

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
  if (calendar) { await calendar.reloadMonth(); calendar.refresh(); }
  if (activePanel==='overview') await loadTodayBookings();
  showToast(t('saved'));
});

document.getElementById('bkDeleteBtn').addEventListener('click', async () => {
  const id = document.getElementById('bk-id').value;
  if (!id||!confirm(t('lead_confirm_delete'))) return;
  await supabase.from('bookings').delete().eq('id',id);
  closeModal('bookingModal');
  if (calendar) { await calendar.reloadMonth(); calendar.refresh(); }
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
  if (calendar) { await calendar.reloadMonth(); calendar.refresh(); }
  showToast(t('saved'));
});

let leadsCache = [];
let leadsMeta = {};
let krankenkassenCache = [];

function displayName(lead) {
  const fn = lead.first_name || '';
  const ln = lead.last_name || '';
  if (fn && ln) return fn + ' ' + ln;
  if (fn) return fn;
  if (ln) return ln;
  return lead.title || '—';
}

async function loadLeads() {
  const ownerId = getOwnerId();
  const {data} = await supabase.from('leads')
    .select('*').eq('owner_id',ownerId).order('created_at',{ascending:false});
  leadsCache = data||[];
  const phones = leadsCache.map(l=>l.phone_normalized).filter(Boolean);
  leadsMeta = {};
  if (phones.length) {
    const [bkRes, waRes] = await Promise.all([
      supabase.from('bookings').select('id,customer_phone_normalized,start_time,status')
        .eq('owner_id',ownerId).in('customer_phone_normalized',phones),
      supabase.from('wa_contacts').select('wa_id,phone,customer_name')
        .eq('business_id',ownerId).in('phone',phones)
    ]);
    (bkRes.data||[]).forEach(b => {
      if (!leadsMeta[b.customer_phone_normalized]) leadsMeta[b.customer_phone_normalized] = {bookings:[],wa:null};
      leadsMeta[b.customer_phone_normalized].bookings.push(b);
    });
    (waRes.data||[]).forEach(w => {
      const norm = normalize_phone_js(w.phone);
      if (!leadsMeta[norm]) leadsMeta[norm] = {bookings:[],wa:null};
      leadsMeta[norm].wa = w;
    });
  }
  renderLeads();
}

function normalize_phone_js(p) {
  if (!p) return null;
  let c = p.replace(/[^0-9+]/g,'');
  if (c.startsWith('+')) return c;
  if (c.startsWith('00')) return '+'+c.slice(2);
  if (c.startsWith('0')) return '+49'+c.slice(1);
  if (c.length===11 && c.startsWith('49')) return '+'+c;
  if (c.length>=10) return '+'+c;
  return c;
}

function renderLeads() {
  const tbody = document.getElementById('leadTableBody');
  const emptyEl = document.getElementById('leadEmpty');
  let rows = leadsCache;
  if (leadFilter!=='all') rows = rows.filter(r=>r.status===leadFilter);
  if (leadSearchVal) {
    const q = leadSearchVal.toLowerCase();
    rows = rows.filter(r=>displayName(r).toLowerCase().includes(q)||(r.city||'').toLowerCase().includes(q)||(r.phone||'').toLowerCase().includes(q));
  }
  if (rows.length===0) { tbody.innerHTML=''; emptyEl.hidden=false; return; }
  emptyEl.hidden = true;
  tbody.innerHTML = rows.map(r=>{
    const meta = leadsMeta[r.phone_normalized]||{};
    const bkCount = meta.bookings?.length||0;
    const hasWa   = !!meta.wa;
    return `<tr>
      <td>${displayName(r)}</td>
      <td>${r.city||'—'}</td>
      <td>${r.phone||'—'}</td>
      <td>${r.total_score??r.rating??'—'}</td>
      <td>
        ${bkCount?`<span class="badge badge-blue" title="Termine">📅 ${bkCount}</span> `:''}${hasWa?'<span class="badge badge-green" title="WhatsApp">💬</span> ':''}
        <span class="badge ${leadStatusBadge(r.status)}">${r.status||'—'}</span>
      </td>
      <td><button class="btn-icon" data-lead-id="${r.id}" data-action="edit">✏️</button></td>
    </tr>`;
  }).join('');
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

async function openLeadModal(lead) {
  document.getElementById('lead-id').value        = lead?.id||'';
  document.getElementById('lead-first-name').value = lead?.first_name||'';
  document.getElementById('lead-last-name').value   = lead?.last_name||'';
  document.getElementById('lead-phone').value     = lead?.phone||'';
  document.getElementById('lead-email').value     = lead?.email||'';
  document.getElementById('lead-city').value      = lead?.city||'';
  document.getElementById('lead-status').value    = lead?.status||'new';
  document.getElementById('lead-notes').value     = lead?.notes||'';
  document.getElementById('leadModalTitle').textContent = lead ? t('lead_modal_edit') : t('lead_modal_new');

  const sector = getSector();
  const sectorFieldsEl = document.getElementById('lead-sector-fields');
  const physioRow = document.getElementById('lead-physio-row');
  const physioRow2 = document.getElementById('lead-physio-row2');

  if (sector === 'physiotherapy') {
    sectorFieldsEl.style.display = 'block';
    physioRow.style.display = 'grid';
    physioRow2.style.display = 'grid';

    if (krankenkassenCache.length === 0) {
      const {data} = await supabase.from('krankenkassen').select('*').order('name');
      krankenkassenCache = data||[];
    }
    const kkSelect = document.getElementById('lead-krankenkasse');
    kkSelect.innerHTML = '<option value="">-- Wählen --</option>' +
      krankenkassenCache.map(k=>`<option value="${k.name}">${k.name}</option>`).join('');

    const md = lead?.metadata||{};
    kkSelect.value = md.krankenkasse || '';
    document.getElementById('lead-krankenkassennummer').value = md.krankenkassennummer || '';
    document.getElementById('lead-geburtsdatum').value = md.geburtsdatum || '';
    document.getElementById('lead-adresse').value = md.adresse || '';
  } else {
    sectorFieldsEl.style.display = 'none';
    physioRow.style.display = 'none';
    physioRow2.style.display = 'none';
  }

  const histEl = document.getElementById('leadHistory');
  if (histEl) {
    histEl.innerHTML = '';
    if (lead?.phone_normalized) {
      const meta = leadsMeta[lead.phone_normalized]||{};
      const bks  = meta.bookings||[];
      const wa   = meta.wa;
      let html = '';
      if (wa) html += `<div class="lead-hist-item lead-hist-wa">💬 WhatsApp: ${wa.customer_name||wa.wa_id}</div>`;
      if (bks.length) {
        html += bks.slice(0,5).map(b=>`<div class="lead-hist-item lead-hist-bk">📅 ${fmtDate(b.start_time)} — <span class="badge ${statusBadge(b.status)}">${b.status}</span></div>`).join('');
        if (bks.length>5) html += `<div class="lead-hist-item" style="color:var(--text-muted)">+${bks.length-5} weitere</div>`;
      }
      if (html) histEl.innerHTML = '<div class="lead-hist-title">Verlauf</div>'+html;
    }
  }
  openModal('leadModal');
}

document.getElementById('leadSaveBtn').addEventListener('click', async () => {
  const id = document.getElementById('lead-id').value;
  const firstName = document.getElementById('lead-first-name').value.trim();
  const lastName  = document.getElementById('lead-last-name').value.trim();
  if (!firstName || !lastName) { showToast('Vorname und Nachname sind erforderlich.', 'error'); return; }

  const metadata = {};
  const sector = getSector();
  if (sector === 'physiotherapy') {
    metadata.krankenkasse = document.getElementById('lead-krankenkasse').value || null;
    metadata.krankenkassennummer = document.getElementById('lead-krankenkassennummer').value.trim() || null;
    metadata.geburtsdatum = document.getElementById('lead-geburtsdatum').value || null;
    metadata.adresse = document.getElementById('lead-adresse').value.trim() || null;
  }

  const payload = {
    owner_id:getOwnerId(),
    first_name:firstName,
    last_name:lastName,
    title:firstName + ' ' + lastName,
    phone:document.getElementById('lead-phone').value.trim()||null,
    email:document.getElementById('lead-email').value.trim()||null,
    city:document.getElementById('lead-city').value.trim()||null,
    status:document.getElementById('lead-status').value,
    notes:document.getElementById('lead-notes').value.trim()||null,
    metadata: Object.keys(metadata).length ? metadata : null
  };
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
  const rawQuery = document.getElementById('apifyQuery').value.trim();
  const city     = document.getElementById('apifyCity').value.trim();
  const limit    = Math.min(parseInt(document.getElementById('apifyLimit').value)||20, 50);
  if (!rawQuery) { showToast('Bitte Suchbegriff eingeben', 'error'); return; }
  const btn = document.getElementById('apifyRunBtn');
  btn.disabled = true; btn.textContent = '⏳';
  const ownerId = getOwnerId();
  try {
    let dbq = supabase.from('scraper_data').select('id').eq('owner_id', ownerId);
    if (rawQuery) dbq = dbq.or(`company_name.ilike.%${rawQuery}%,name.ilike.%${rawQuery}%,category.ilike.%${rawQuery}%`);
    if (city) dbq = dbq.ilike('city', `%${city}%`);
    const { data: dbHits } = await dbq.limit(limit);
    if (dbHits && dbHits.length >= 5) {
      document.getElementById('b2bSearch').value = rawQuery;
      renderB2B();
      showToast(`${dbHits.length} Treffer aus Datenbank geladen`);
      btn.disabled=false; btn.textContent='Suchen'; return;
    }
    const searchQuery = city ? `${rawQuery} ${city}` : rawQuery;
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch('/api/apify/search', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': 'Bearer ' + s.access_token
      },
      body: JSON.stringify({ query: searchQuery, limit })
    });
    const data = await res.json();
    console.log('[apifyRun] API status:', res.status, 'items:', data.items?.length, 'error:', data.error);
    if (!res.ok || data.error) throw new Error(data.error || 'Suche fehlgeschlagen');
    const items = data.items || [];
    console.log('[apifyRun] first item keys:', items[0] ? Object.keys(items[0]).join(', ') : 'none');
    const inserts = items.filter(i => i.title || i.name || i.placeName).map(i => ({
      owner_id: ownerId,
      company_name: i.title || i.name || i.placeName,
      name: i.title || i.name || i.placeName,
      category: rawQuery,
      city: i.city || city || i.address?.split(',').pop()?.trim() || '',
      phone: i.phone || '',
      email: i.email || '',
      website: i.website || '',
      status: 'new',
      notes: i.address || ''
    }));
    console.log('[apifyRun] inserts count:', inserts.length);
    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from('scraper_data').insert(inserts);
      if (insErr) { console.error('[apifyRun insert]', insErr); throw new Error('DB-Fehler: ' + insErr.message); }
    }
    document.getElementById('b2bSearch').value = rawQuery;
    await loadB2B();
    showToast(`✓ ${inserts.length} Kontakte importiert`);
  } catch(err) {
    showToast('Fehler: '+err.message, 'error');
  }
  btn.disabled=false; btn.textContent='Suchen';
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
  const addCard = `<div class="service-card add-service-card" id="addServiceCard">
      <div class="add-service-icon">+</div>
      <div class="add-service-label">Neue Dienstleistung</div>
    </div>`;
  if (!servicesCache.length) { grid.innerHTML = addCard; bindAddServiceCard(); return; }
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
  }).join('') + addCard;
  grid.querySelectorAll('[data-srv-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('alert_service_delete'))) return;
      await supabase.from('services').delete().eq('id',btn.dataset.srvDel);
      await loadServices();
    });
  });
  bindAddServiceCard();
}

function bindAddServiceCard() {
  const card = document.getElementById('addServiceCard');
  if (!card) return;
  card.addEventListener('click', () => {
    const form = document.getElementById('addServiceForm');
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderSrvEmpCheckboxes() {
  const container = document.getElementById('srvEmpCheckboxes');
  if (!container) return;
  container.innerHTML = teamMembers.map(m=>{
    const name = m.business_name||m.email?.split('@')[0];
    return `<label class="emp-checkbox-item">
      <input type="checkbox" name="srv_emp" value="${m.id}" checked>
      <span>${name}</span>
    </label>`;
  }).join('');
}

document.getElementById('srvSaveBtn').addEventListener('click', async () => {
  const title = document.getElementById('srvTitle').value.trim();
  const duration = parseInt(document.getElementById('srvDur').value,10)||30;
  const price = parseFloat(document.getElementById('srvPrice').value)||0;
  const color = document.getElementById('srvColor').value;
  if (!title) { showToast(t('err_generic'),'error'); return; }
  const empIds = [...document.querySelectorAll('input[name="srv_emp"]:checked')].map(cb=>cb.value);
  const ownerId = getOwnerId();
  const { data: srv, error } = await supabase.from('services').insert({ owner_id: ownerId, title, duration_minutes: duration, price, color }).select().single();
  if (error) { showToast(t('err_generic'),'error'); return; }
  if (empIds.length) {
    await supabase.from('employee_services').insert(empIds.map(id=>({ employee_id: id, service_id: srv.id })));
  }
  document.getElementById('srvTitle').value='';
  await loadServices();
  showToast(t('saved'));
  document.getElementById('addServiceForm').hidden = true;
});

let hoursEmpId = null;

document.getElementById('hoursEmpSelect').addEventListener('change', async () => {
  hoursEmpId = document.getElementById('hoursEmpSelect').value;
  await renderHoursGrid();
});

async function loadHoursPanel() {
  const {data:emps} = await supabase.from('profiles').select('id,business_name,email')
    .eq('owner_id',getOwnerId());
  const all = currentProfile.role==='owner'
    ? [{id:currentSession.user.id,business_name:currentProfile.business_name,email:currentSession.user.email},...(emps||[])]
    : [{id:currentSession.user.id,business_name:currentProfile.business_name,email:currentSession.user.email}];
  const sel = document.getElementById('hoursEmpSelect');
  sel.innerHTML = all.map(e=>`<option value="${e.id}">${e.business_name||e.email?.split('@')[0]}</option>`).join('');
  hoursEmpId = all[0]?.id||currentSession.user.id;
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
    row.className = 'hours-row' + (h.is_active?'':' inactive');
    row.innerHTML = `
      <div class="hours-day">
        <label class="toggle-switch">
          <input type="checkbox" id="wh-active-${i}" ${h.is_active?'checked':''}>
          <span class="toggle-slider"></span>
        </label>
        <span>${dayLabels[i]}</span>
      </div>
      <div></div>
      <div class="hours-times">
        <input class="form-input" id="wh-start-${i}" type="time" value="${h.start_time.substring(0,5)}">
        <input class="form-input" id="wh-end-${i}" type="time" value="${h.end_time.substring(0,5)}">
      </div>`;
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
  // API avatar_url ve booking_slug döndürmüyorsa Supabase'den al
  if (data.length > 0) {
    const ids = data.map(d => d.id).filter(Boolean);
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,avatar_url,booking_slug').in('id', ids);
      if (profiles) {
        const map = {};
        profiles.forEach(p => map[p.id] = p);
        data.forEach(d => {
          if (map[d.id]) {
            if (map[d.id].avatar_url) d.avatar_url = map[d.id].avatar_url;
            if (map[d.id].booking_slug) d.booking_slug = map[d.id].booking_slug;
          }
        });
      }
    }
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
  list.innerHTML = data.map(m=>{
    const name = m.business_name || m.email?.split('@')[0] || '—';
    const initial = (name[0]||'?').toUpperCase();
    const avatar = m.avatar_url ? `<img src="${m.avatar_url}" alt="">` : initial;
    return `<div class="emp-card" data-emp-id="${m.id}">
      <div class="emp-avatar">${avatar}</div>
      <div class="emp-name">${name} ${m.id===currentSession.user.id?t('me'):''}</div>
      <div class="emp-role">${m.role==='owner'?'Geschäftsführung':'Mitarbeiter'}</div>
      ${m.id===currentSession.user.id?'<div class="emp-badge" title="Sie"></div>':''}
    </div>`;
  }).join('');
  list.querySelectorAll('.emp-card').forEach(card => {
    card.addEventListener('click', () => openEmpDetail(card.dataset.empId));
  });
}

let detailEmpId = null;

function renderEmpAvatar(el, m) {
  const name = m.business_name || m.email?.split('@')[0] || '?';
  if (m.avatar_url) {
    el.innerHTML = `<img src="${m.avatar_url}" alt="">`;
  } else {
    el.textContent = name[0].toUpperCase();
  }
}

function openEmpDetail(empId) {
  const m = teamMembers.find(tm=>tm.id===empId);
  if (!m) return;
  detailEmpId = empId;

  document.getElementById('empDetailName').textContent  = m.business_name||m.email?.split('@')[0]||'—';
  document.getElementById('empDetailRole').textContent  = m.role||'employee';
  document.getElementById('empDetailEmail').textContent = m.email||'—';
  renderEmpAvatar(document.getElementById('empDetailAvatar'), m);
  renderEmpAvatar(document.getElementById('empAvatarPreview'), m);

  const bookingLink = m.booking_slug || '';
  const linkInput = document.getElementById('empBookingLink');
  linkInput.value = bookingLink;
  document.getElementById('empCopyLinkBtn').onclick = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink);
    showToast('Link kopiert');
  };

  document.getElementById('teamListView').hidden  = true;
  document.getElementById('teamDetailView').hidden = false;

  // Avatar upload with crop
  let cropper = null;
  const fileInput = document.getElementById('empAvatarInput');
  const cropModal = document.getElementById('avatarCropModal');
  const cropImage = document.getElementById('cropImage');

  function closeCropModal() {
    cropModal.hidden = true;
    if (cropper) { cropper.destroy(); cropper = null; }
    cropImage.src = '';
    fileInput.value = '';
  }

  fileInput.onchange = (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    cropImage.src = url;
    cropModal.hidden = false;
    if (cropper) cropper.destroy();
    cropper = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 0.9,
      dragMode: 'move',
      guides: false,
      center: false,
      highlight: false,
      background: false,
      scalable: false,
      zoomable: true,
      cropBoxMovable: true,
      cropBoxResizable: false,
      minCropBoxWidth: 120,
      minCropBoxHeight: 120,
    });
  };

  document.getElementById('cropCancelBtn').onclick = closeCropModal;
  document.getElementById('cropModalClose').onclick = closeCropModal;

  document.getElementById('cropSaveBtn').onclick = async () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) { showToast('Bildverarbeitung fehlgeschlagen', 'error'); return; }
    const path = `${empId}/${Date.now()}.jpg`;
    showToast('Bild wird hochgeladen…');
    try {
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = urlData?.publicUrl;
      if (!avatarUrl) throw new Error('URL fehlgeschlagen');
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', empId);
      if (dbErr) throw dbErr;
      m.avatar_url = avatarUrl;
      renderEmpAvatar(document.getElementById('empDetailAvatar'), m);
      renderEmpAvatar(document.getElementById('empAvatarPreview'), m);
      await loadTeam();
      showToast('Profilbild gespeichert');
      closeCropModal();
    } catch (e) {
      showToast('Fehler: ' + e.message, 'error');
    }
  };

  document.getElementById('empAvatarRemoveBtn').onclick = async () => {
    if (!m.avatar_url) { showToast('Kein Bild vorhanden'); return; }
    if (!confirm('Profilbild entfernen?')) return;
    try {
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', empId);
      if (dbErr) throw dbErr;
      m.avatar_url = null;
      renderEmpAvatar(document.getElementById('empDetailAvatar'), m);
      renderEmpAvatar(document.getElementById('empAvatarPreview'), m);
      await loadTeam();
      showToast('Profilbild entfernt');
    } catch (e) {
      showToast('Fehler: ' + e.message, 'error');
    }
  };

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
    row.className = 'hours-row' + (h.is_active?'':' inactive');
    row.innerHTML = `
      <div class="hours-day">
        <label class="toggle-switch">
          <input type="checkbox" id="ewh-active-${i}" ${h.is_active?'checked':''}>
          <span class="toggle-slider"></span>
        </label>
        <span>${dayLabels[i]}</span>
      </div>
      <div></div>
      <div class="hours-times">
        <input class="form-input" id="ewh-start-${i}" type="time" value="${h.start_time.substring(0,5)}">
        <input class="form-input" id="ewh-end-${i}" type="time" value="${h.end_time.substring(0,5)}">
      </div>`;
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
  document.getElementById('b2bModalTitle').textContent = c ? 'Kontakt bearbeiten' : t('b2b_add');
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

// ===== B2C MAIL PANEL =====
let b2cCache = [];

async function loadB2C() {
  const {data} = await supabase.from('leads')
    .select('id,title,email,phone,status').eq('owner_id',getOwnerId()).order('created_at',{ascending:false});
  b2cCache = data||[];
  renderB2C();
}

function renderB2C() {
  const tbody = document.getElementById('b2cTableBody');
  const emptyEl = document.getElementById('b2cEmpty');
  const q = (document.getElementById('b2cSearch').value||'').toLowerCase();
  let rows = b2cCache;
  if (q) rows = rows.filter(r=>(r.title||'').toLowerCase().includes(q)||(r.email||'').toLowerCase().includes(q)||(r.phone||'').toLowerCase().includes(q));
  if (!rows.length) { tbody.innerHTML=''; emptyEl.hidden=false; return; }
  emptyEl.hidden = true;
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td>${r.title||'—'}</td>
      <td>${r.email||'—'}</td>
      <td>${r.phone||'—'}</td>
      <td><span class="badge ${leadStatusBadge(r.status)}">${r.status||'—'}</span></td>
      <td><button class="btn-icon" data-b2c-id="${r.id}" data-action="mail">✉</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-action="mail"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = b2cCache.find(x=>x.id===btn.dataset.b2cId);
      if (c) openComposeModal({to_name:c.title||'',to_email:c.email||'',subject:'',body:''});
    });
  });
}

document.getElementById('b2cSearch').addEventListener('input', renderB2C);

document.getElementById('b2cComposeBtn').addEventListener('click', () => {
  openComposeModal({to_name:'',to_email:'',subject:'',body:''});
});

async function checkB2cSetup() {
  gmailConnectedEmail = currentProfile.b2b_from_email || null;
  const setupDone = currentProfile.b2b_setup_done && currentProfile.b2b_sender_name;
  document.getElementById('b2cSetupCard').hidden = !!setupDone;
  document.getElementById('b2cMainContent').hidden = !setupDone;
  if (setupDone) {
    document.getElementById('b2cFromName').textContent = currentProfile.b2b_sender_name || '—';
    document.getElementById('b2cFromEmail').textContent = gmailConnectedEmail || '—';
    document.getElementById('b2cAiFromBadge').textContent = gmailConnectedEmail || '';
  } else {
    const nameInput = document.getElementById('b2cSetupSenderName');
    if (currentProfile.b2b_sender_name) nameInput.value = currentProfile.b2b_sender_name;
    updateB2cSetupFinishBtn();
  }
}

function updateB2cSetupFinishBtn() {
  const nameOk = document.getElementById('b2cSetupSenderName').value.trim().length > 0;
  document.getElementById('b2cSetupFinishBtn').disabled = !nameOk;
}

document.getElementById('b2cSetupSenderName').addEventListener('input', updateB2cSetupFinishBtn);

document.getElementById('b2cSetupFinishBtn').addEventListener('click', async () => {
  const name = document.getElementById('b2cSetupSenderName').value.trim();
  if (!name) return;
  const {error} = await supabase.from('profiles')
    .update({b2b_sender_name: name, b2b_setup_done: true})
    .eq('id', currentSession.user.id);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  currentProfile.b2b_sender_name = name;
  currentProfile.b2b_setup_done = true;
  await checkB2cSetup();
  showToast('E-Mail-Einrichtung abgeschlossen ✓');
});

document.getElementById('b2cConfigBtn').addEventListener('click', () => {
  document.getElementById('cfgSenderName').value = currentProfile.b2b_sender_name || '';
  setGmailUI(gmailConnectedEmail,
    document.getElementById('cfgGmailDot'),
    document.getElementById('cfgGmailLabel'),
    document.getElementById('cfgGmailBtn'));
  openModal('b2bConfigModal');
});

const B2B_AGENT_URL = 'https://n8n.infinitymade.de/webhook/b2b-mail-agent';
let gmailConnectedEmail = null;
let currentDraftContactId = null;
let mailPreviewLeadId = null;

function startGmailOAuth() {
  const userId = currentSession.user.id;
  window.location.href = 'https://n8n.infinitymade.de/api/gmail/connect?userId=' + encodeURIComponent(userId);
}

function setGmailUI(email, dotEl, labelEl, connectBtnEl) {
  if (email) {
    dotEl.className   = 'status-dot connected';
    labelEl.textContent = email;
    connectBtnEl.textContent = 'Konto wechseln';
  } else {
    dotEl.className   = 'status-dot';
    labelEl.textContent = 'Kein Konto verbunden';
    connectBtnEl.textContent = 'Mit Google verbinden';
  }
}

async function checkB2bSetup() {
  gmailConnectedEmail = currentProfile.b2b_from_email || null;
  const setupDone = currentProfile.b2b_setup_done && currentProfile.b2b_sender_name;
  document.getElementById('b2bSetupCard').hidden   = !!setupDone;
  document.getElementById('b2bMainContent').hidden = !setupDone;
  if (setupDone) {
    document.getElementById('b2bFromName').textContent  = currentProfile.b2b_sender_name || '—';
    document.getElementById('b2bFromEmail').textContent = gmailConnectedEmail || '—';
    document.getElementById('aiFromBadge').textContent  = gmailConnectedEmail || '';
    document.getElementById('composeFromDisplay').textContent = gmailConnectedEmail || currentProfile.b2b_sender_name || '—';
  } else {
    const nameInput = document.getElementById('setupSenderName');
    if (currentProfile.b2b_sender_name) nameInput.value = currentProfile.b2b_sender_name;
    updateSetupFinishBtn();
  }
}

function updateSetupFinishBtn() {
  const nameOk = document.getElementById('setupSenderName').value.trim().length > 0;
  document.getElementById('b2bSetupFinishBtn').disabled = !nameOk;
}

document.getElementById('setupSenderName').addEventListener('input', updateSetupFinishBtn);

document.getElementById('b2bSetupFinishBtn').addEventListener('click', async () => {
  const name = document.getElementById('setupSenderName').value.trim();
  if (!name) return;
  const {error} = await supabase.from('profiles')
    .update({b2b_sender_name: name, b2b_setup_done: true})
    .eq('id', currentSession.user.id);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  currentProfile.b2b_sender_name = name;
  currentProfile.b2b_setup_done  = true;
  await checkB2bSetup();
  showToast('E-Mail-Einrichtung abgeschlossen ✓');
});

document.getElementById('b2bConfigBtn').addEventListener('click', () => {
  document.getElementById('cfgSenderName').value = currentProfile.b2b_sender_name || '';
  document.getElementById('cfgApifyToken').value = localStorage.getItem('apify_token') || '';
  setGmailUI(gmailConnectedEmail,
    document.getElementById('cfgGmailDot'),
    document.getElementById('cfgGmailLabel'),
    document.getElementById('cfgGmailBtn'));
  openModal('b2bConfigModal');
});

document.getElementById('cfgGmailBtn').addEventListener('click', () => startGmailOAuth('config'));

document.getElementById('b2bConfigSaveBtn').addEventListener('click', async () => {
  const name = document.getElementById('cfgSenderName').value.trim();
  if (!name) { showToast(t('err_generic'), 'error'); return; }
  const apifyToken = document.getElementById('cfgApifyToken')?.value.trim();
  if (apifyToken) localStorage.setItem('apify_token', apifyToken);
  const {error} = await supabase.from('profiles')
    .update({b2b_sender_name: name}).eq('id', currentSession.user.id);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  currentProfile.b2b_sender_name = name;
  const fromNameEl = document.getElementById('b2bFromName');
  if (fromNameEl) fromNameEl.textContent = name;
  closeModal('b2bConfigModal');
  if (activePanel === 'b2b') await checkB2bSetup();
  if (activePanel === 'b2c') await checkB2cSetup();
  showToast(t('saved'));
});

function openComposeModal(draft) {
  currentDraftContactId = draft.contact_id || null;
  document.getElementById('composeToName').value  = draft.to_name || '';
  document.getElementById('composeToEmail').value = draft.to_email || '';
  document.getElementById('composeSubject').value  = draft.subject || '';
  document.getElementById('composeBody').value     = draft.body || '';
  document.getElementById('composeFromDisplay').textContent = gmailConnectedEmail || currentSession.user.email;
  openModal('emailComposeModal');
}

document.getElementById('composeDiscardBtn').addEventListener('click', () => {
  closeModal('emailComposeModal');
  aiAddMsg('Entwurf verworfen.', 'ai');
});

function copyWithFeedback(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    const orig = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.classList.remove('copied'); btn.textContent = orig; }, 1500);
  });
}

document.getElementById('copyToEmailBtn').addEventListener('click', () => {
  copyWithFeedback(document.getElementById('copyToEmailBtn'), document.getElementById('composeToEmail').value);
});
document.getElementById('copySubjectBtn').addEventListener('click', () => {
  copyWithFeedback(document.getElementById('copySubjectBtn'), document.getElementById('composeSubject').value);
});
document.getElementById('copyBodyBtn').addEventListener('click', () => {
  copyWithFeedback(document.getElementById('copyBodyBtn'), document.getElementById('composeBody').value);
});

document.getElementById('composeSendBtn').addEventListener('click', async () => {
  const toEmail = document.getElementById('composeToEmail').value.trim();
  const toName  = document.getElementById('composeToName').value.trim();
  const subject = document.getElementById('composeSubject').value.trim();
  const body    = document.getElementById('composeBody').value.trim();
  if (!toEmail || !subject || !body) { showToast(t('err_generic'), 'error'); return; }

  const btn = document.getElementById('composeSendBtn');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const res = await fetch('https://n8n.infinitymade.de/api/gmail/send', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        userId: currentSession.user.id,
        to_email: toEmail, to_name: toName,
        subject, body,
        sender_name: currentProfile.b2b_sender_name || ''
      })
    });
    const json = await res.json();
    if (!json.success) {
      if (json.error && json.error.includes('Gmail token')) {
        showToast('Gmail nicht verbunden — bitte in Konfiguration neu verbinden', 'error');
        return;
      }
      throw new Error(json.error || 'Senden fehlgeschlagen');
    }
    await supabase.from('email_logs').insert({
      owner_id: getOwnerId(),
      contact_id: currentDraftContactId || null,
      to_email: toEmail, to_name: toName,
      subject, body, status: 'sent'
    });
    closeModal('emailComposeModal');
    aiAddMsg('E-Mail gesendet an ' + toEmail + ' ✓', 'ai');
    showToast('E-Mail gesendet ✓');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  }
  btn.disabled = false; btn.textContent = '✉ Senden';
});

async function runMailDraft(intent, contactsCache, containerId = 'aiMessages', mapContactFn = null) {
  aiAddMsg(intent, 'user', containerId);
  const msgsEl = document.getElementById(containerId);
  if (!msgsEl) return;
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'msg-bubble ai';
  loadingDiv.textContent = '⏳ KI bereitet E-Mail vor…';
  msgsEl.appendChild(loadingDiv);
  msgsEl.scrollTop = 9999;
  try {
    const cache = contactsCache || b2bCache;
    const contacts = cache.slice(0,30).map(c => mapContactFn ? mapContactFn(c) : ({
      id:c.id, company_name:c.company_name, contact_name:c.contact_name,
      email:c.email, phone:c.phone, notes:c.notes
    }));
    const res = await fetch(B2B_AGENT_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        action: 'draft',
        intent,
        contacts,
        owner_info: {
          business_name: currentProfile.business_name,
          sender_name: currentProfile.b2b_sender_name || currentProfile.business_name || '',
          city: currentProfile.city || '',
          sector: currentProfile.sector || '',
          extra_context: currentProfile.system_prompt || ''
        }
      })
    });
    const json = await res.json();
    loadingDiv.remove();
    if (!json.success || !json.draft) throw new Error(json.error || 'Fehler');
    aiAddMsg('E-Mail-Entwurf erstellt — bitte prüfen und senden.', 'ai', containerId);
    openComposeModal(json.draft);
  } catch(e) {
    loadingDiv.remove();
    aiAddMsg('Fehler: ' + e.message, 'ai', containerId);
  }
}

document.getElementById('aiSendBtn').addEventListener('click', () => {
  const input = document.getElementById('aiInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  runMailDraft(msg);
});

document.getElementById('aiInput').addEventListener('keydown', e => {
  if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('aiSendBtn').click(); }
});

(function initVoiceInput() {
  const btn = document.getElementById('aiVoiceBtn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { btn.hidden = true; return; }
  const recog = new SpeechRecognition();
  recog.lang = 'de-DE'; recog.continuous = false; recog.interimResults = false;
  let active = false;
  btn.addEventListener('click', () => {
    if (active) { recog.stop(); return; }
    recog.start();
    active = true; btn.textContent = '🔴';
  });
  recog.onresult = e => {
    const text = e.results[0][0].transcript;
    document.getElementById('aiInput').value = text;
    active = false; btn.textContent = '🎤';
    runMailDraft(text);
  };
  recog.onend = () => { active = false; btn.textContent = '🎤'; };
  recog.onerror = () => { active = false; btn.textContent = '🎤'; };
})();

document.getElementById('b2cAiSendBtn').addEventListener('click', () => {
  const input = document.getElementById('b2cAiInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  runMailDraft(msg, b2cCache, 'b2cAiMessages', c => ({
    id:c.id, company_name:c.title, contact_name:c.title,
    email:c.email, phone:c.phone, notes:''
  }));
});

document.getElementById('b2cAiInput').addEventListener('keydown', e => {
  if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('b2cAiSendBtn').click(); }
});

(function initB2cVoiceInput() {
  const btn = document.getElementById('b2cAiVoiceBtn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { btn.hidden = true; return; }
  const recog = new SpeechRecognition();
  recog.lang = 'de-DE'; recog.continuous = false; recog.interimResults = false;
  let active = false;
  btn.addEventListener('click', () => {
    if (active) { recog.stop(); return; }
    recog.start();
    active = true; btn.textContent = '🔴';
  });
  recog.onresult = e => {
    const text = e.results[0][0].transcript;
    document.getElementById('b2cAiInput').value = text;
    active = false; btn.textContent = '🎤';
    runMailDraft(text, b2cCache, 'b2cAiMessages', c => ({
      id:c.id, company_name:c.title, contact_name:c.title,
      email:c.email, phone:c.phone, notes:''
    }));
  };
  recog.onend = () => { active = false; btn.textContent = '🎤'; };
  recog.onerror = () => { active = false; btn.textContent = '🎤'; };
})();

async function loadSettings() {
  document.getElementById('setBiz').value  = currentProfile.business_name||'';
  document.getElementById('setLang').value = currentLang;

  const isEmployee = currentProfile.role !== 'owner';
  const accSection = document.getElementById('settingsAccountSection');
  if (accSection) accSection.hidden = isEmployee;

  if (!isEmployee) {
    document.getElementById('accEmail').textContent = currentSession.user.email||'—';
    const planName = currentProfile.plan ? currentProfile.plan.charAt(0).toUpperCase()+currentProfile.plan.slice(1) : '—';
    document.getElementById('accPlanBadge').textContent = planName;
  }

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
  currentProfile.language = lang;
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

function cleanBookingSlug(input) {
  return (input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function ensureBookingSlug() {
  try {
    if (!currentSession || !currentProfile) return;
    if (currentProfile.booking_slug) return;
    const emailPrefix = currentSession.user.email ? currentSession.user.email.split('@')[0] : '';
    const base = cleanBookingSlug(currentProfile.business_name) || cleanBookingSlug(emailPrefix) || cleanBookingSlug(currentSession.user.id);
    const slug = base || 'user';
    const url = window.location.origin + '/booking.html?u=' + slug;
    await supabase.from('profiles').update({booking_slug:url}).eq('id',currentSession.user.id);
    currentProfile.booking_slug = url;
  } catch(e) {
    console.error('[ensureBookingSlug]', e);
  }
}

let docsCache = [];
let docsSort = { key: 'created_at', dir: 'desc' };

function renderDocTable(rows) {
  const tbody = document.getElementById('docTableBody');
  const empty = document.getElementById('docEmpty');
  const hint = document.getElementById('docFilterHint');
  tbody.innerHTML = '';
  if (!rows || rows.length === 0) { empty.hidden = false; hint.textContent = ''; return; }
  empty.hidden = true;
  hint.textContent = rows.length + ' Einträge';
  tbody.innerHTML = rows.map(d => {
    const displayName = d.name || d.company_name || '—';
    return `<tr>
      <td>${displayName}</td>
      <td>${d.category || '—'}</td>
      <td>${d.city || '—'}</td>
      <td>${d.email ? `<a href="mailto:${d.email}">${d.email}</a>` : '—'}</td>
      <td>${d.phone || '—'}</td>
      <td>${d.notes || '—'}</td>
      <td>${d.website ? `<a href="https://${d.website.replace(/^https?:\/\//,'')}" target="_blank" rel="noopener">${d.website}</a>` : '—'}</td>
    </tr>`;
  }).join('');
}

function filterDocsCache(text) {
  const t = text.toLowerCase();
  return docsCache.filter(d => {
    const name = (d.name || d.company_name || '').toLowerCase();
    const cat = (d.category || '').toLowerCase();
    const city = (d.city || '').toLowerCase();
    const phone = (d.phone || '').toLowerCase();
    const email = (d.email || '').toLowerCase();
    const notes = (d.notes || '').toLowerCase();
    return name.includes(t) || cat.includes(t) || city.includes(t) || phone.includes(t) || email.includes(t) || notes.includes(t);
  });
}

function sortDocsCache(rows, key, dir) {
  return [...rows].sort((a, b) => {
    const av = (a[key] || '').toLowerCase();
    const bv = (b[key] || '').toLowerCase();
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

async function loadDoctors() {
  const empty = document.getElementById('docEmpty');
  empty.hidden = true;
  const ownerId = getOwnerId();
  const { data: docs, error } = await supabase.from('scraper_data').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
  console.log('[loadDoctors] rows:', docs?.length, 'error:', error);
  if (error) { console.error('[loadDoctors]', error); empty.hidden = false; return; }
  docsCache = docs || [];
  const filterText = document.getElementById('docFilterInput').value.trim();
  let rows = filterText ? filterDocsCache(filterText) : docsCache;
  rows = sortDocsCache(rows, docsSort.key, docsSort.dir);
  renderDocTable(rows);
}

function setDocProgress(text, pct) {
  const wrap = document.getElementById('docProgressWrap');
  const info = document.getElementById('docProgressInfo');
  const fill = document.getElementById('docProgressFill');
  wrap.hidden = false;
  info.innerHTML = text;
  fill.style.width = pct + '%';
}
function hideDocProgress() {
  document.getElementById('docProgressWrap').hidden = true;
  document.getElementById('docProgressFill').style.width = '0%';
}

document.getElementById('docFilterInput').addEventListener('input', () => {
  const filterText = document.getElementById('docFilterInput').value.trim();
  let rows = filterText ? filterDocsCache(filterText) : docsCache;
  rows = sortDocsCache(rows, docsSort.key, docsSort.dir);
  renderDocTable(rows);
});

document.getElementById('docSortCity').addEventListener('click', () => {
  const th = document.getElementById('docSortCity');
  const icon = th.querySelector('.sort-icon');
  th.classList.remove('asc', 'desc');
  if (docsSort.key === 'city' && docsSort.dir === 'asc') {
    docsSort = { key: 'city', dir: 'desc' };
    th.classList.add('desc');
    icon.textContent = '↓';
  } else {
    docsSort = { key: 'city', dir: 'asc' };
    th.classList.add('asc');
    icon.textContent = '↑';
  }
  const filterText = document.getElementById('docFilterInput').value.trim();
  let rows = filterText ? filterDocsCache(filterText) : docsCache;
  rows = sortDocsCache(rows, docsSort.key, docsSort.dir);
  renderDocTable(rows);
});

document.getElementById('docSearchBtn').addEventListener('click', async () => {
  const query = document.getElementById('docQuery').value.trim() || 'Arzt';
  const city = document.getElementById('docCity').value.trim();
  const limit = parseInt(document.getElementById('docLimit').value, 10) || 20;
  const fullQuery = city ? `${query} ${city}` : query;
  const btn = document.getElementById('docSearchBtn');
  btn.disabled = true; btn.textContent = '⏳';
  const ownerId = getOwnerId();

  // 1) Önce veritabanında ara — zaten varsa Apify'a gitme
  let dbq = supabase.from('scraper_data').select('*').eq('owner_id', ownerId);
  if (query) dbq = dbq.or(`company_name.ilike.%${query}%,name.ilike.%${query}%,category.ilike.%${query}%`);
  if (city) dbq = dbq.ilike('city', `%${city}%`);
  const { data: dbHits } = await dbq.limit(limit);
  if (dbHits && dbHits.length >= 3) {
    docsCache = dbHits;
    const filterText = document.getElementById('docFilterInput').value.trim();
    let rows = filterText ? filterDocsCache(filterText) : docsCache;
    rows = sortDocsCache(rows, docsSort.key, docsSort.dir);
    renderDocTable(rows);
    showToast(`${dbHits.length} Treffer aus Datenbank geladen`);
    btn.disabled = false; btn.textContent = 'Suchen';
    return;
  }

  // 2) DB'de yoksa Apify'dan çek
  const startTime = Date.now();
  const ticker = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const phase = elapsed < 8 ? 'Google Maps wird durchsucht...'
               : elapsed < 25 ? 'Praxisdetails werden extrahiert...'
               : elapsed < 50 ? 'Kontaktdaten werden aufbereitet...'
               : 'Daten werden verarbeitet...';
    const pct = Math.min(95, (elapsed / 120) * 95);
    setDocProgress(`${phase} <b>${elapsed}s</b>`, pct);
  }, 1000);

  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch('/api/apify/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.access_token
      },
      body: JSON.stringify({ query: fullQuery, limit, language: 'de', countryCode: 'de' })
    });
    const data = await res.json();
    console.log('[docSearch] API status:', res.status, 'items:', data.items?.length, 'error:', data.error);
    if (!res.ok || data.error) throw new Error(data.error || 'Apify-Fehler');
    const items = data.items || [];
    console.log('[docSearch] first item keys:', items[0] ? Object.keys(items[0]).join(', ') : 'none');
    const ownerId = getOwnerId();
    const inserts = items.filter(i => i.title || i.name || i.placeName).map(i => ({
      owner_id: ownerId,
      company_name: i.title || i.name || i.placeName,
      name: i.title || i.name || i.placeName,
      category: query,
      city: i.city || city || i.address?.split(',').pop()?.trim() || '',
      phone: i.phone || '',
      email: i.email || '',
      website: i.website || '',
      status: 'new',
      notes: i.address || ''
    }));
    console.log('[docSearch] inserts count:', inserts.length);
    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from('scraper_data').insert(inserts);
      if (insErr) { console.error('[docSearch insert]', insErr); throw new Error('DB-Fehler: ' + insErr.message); }
    }
    setDocProgress(`<b>${inserts.length}</b> Praxen importiert — Tabelle wird geladen...`, 100);
    await loadDoctors();
    showToast(t('apify_done') + inserts.length);
  } catch (e) {
    showToast(t('apify_error') + e.message, 'error');
  } finally {
    clearInterval(ticker);
    setTimeout(hideDocProgress, 800);
    btn.disabled = false; btn.textContent = 'Suchen';
  }
});

function loadBeispielmodus() {
  const frame = document.getElementById('zygoteFrame');
  if (frame && !frame.src) frame.src = 'https://www.zygotebody.com/';
  const fsBtn = document.getElementById('zygoteFsBtn');
  if (fsBtn && !fsBtn.dataset.bound) {
    fsBtn.dataset.bound = '1';
    fsBtn.addEventListener('click', () => {
      if (frame?.requestFullscreen) frame.requestFullscreen();
      else if (frame?.webkitRequestFullscreen) frame.webkitRequestFullscreen();
    });
  }
}

async function loadNotizen() {
  const input = document.getElementById('notesPatientInput');
  const list = document.getElementById('notesPatientList');
  const hidden = document.getElementById('notesPatient');
  const form = document.getElementById('notesForm');
  const empty = document.getElementById('notesEmpty');
  const ownerId = getOwnerId();

  const { data: leads } = await supabase.from('leads').select('id,title,first_name,last_name').eq('owner_id', ownerId).order('title');
  const allLeads = leads || [];

  input.value = '';
  hidden.value = '';
  list.hidden = true;
  if (!hidden.value) { form.hidden = true; empty.hidden = false; }

  let activeIndex = -1;

  function renderList(filter) {
    activeIndex = -1;
    const q = filter.trim().toLowerCase();
    if (!q) { list.hidden = true; return; }
    const filtered = allLeads.filter(l => displayName(l).toLowerCase().includes(q));
    if (filtered.length === 0) {
      list.innerHTML = '<li class="empty-item">Keine Treffer</li>';
      list.hidden = false;
      return;
    }
    list.innerHTML = filtered.map((l, i) => {
      const name = displayName(l);
      const esc = q.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
      const hl = name.replace(new RegExp(`(${esc})`, 'gi'), '<span class="match-hl">$1</span>');
      return `<li data-id="${l.id}" data-index="${i}">${hl}</li>`;
    }).join('');
    list.hidden = false;
  }

  function selectPatient(id) {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;
    input.value = displayName(lead);
    hidden.value = id;
    list.hidden = true;
    activeIndex = -1;
    loadPatientNotes(id);
  }

  async function loadPatientNotes(leadId) {
    form.hidden = false; empty.hidden = true;
    const { data: rec } = await supabase.from('patient_notes').select('*').eq('lead_id', leadId).eq('owner_id', ownerId).maybeSingle();
    document.getElementById('notesDoctor').value = rec?.doctor_notes || '';
    document.getElementById('notesTherapist').value = rec?.therapist_notes || '';
    const aiBox = document.getElementById('aiReportBox');
    if (rec?.ai_summary) {
      aiBox.textContent = rec.ai_summary;
      aiBox.style.display = 'block';
    } else {
      aiBox.style.display = 'none';
    }
  }

  input.oninput = () => {
    if (hidden.value) { hidden.value = ''; form.hidden = true; empty.hidden = false; }
    renderList(input.value);
  };

  input.onkeydown = (e) => {
    const items = list.querySelectorAll('li:not(.empty-item)');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
      if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
      if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = items[activeIndex];
      if (active) selectPatient(active.dataset.id);
    } else if (e.key === 'Escape') {
      list.hidden = true;
      activeIndex = -1;
    }
  };

  list.onclick = (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) selectPatient(li.dataset.id);
  };

  document.addEventListener('click', (e) => {
    if (!document.getElementById('notesPatientWrap').contains(e.target)) {
      list.hidden = true;
    }
  });
}

document.getElementById('notesSaveBtn').addEventListener('click', async () => {
  const leadId = document.getElementById('notesPatient').value;
  if (!leadId) { showToast('Bitte Patient wählen', 'error'); return; }
  const ownerId = getOwnerId();
  const payload = {
    owner_id: ownerId,
    lead_id: leadId,
    doctor_notes: document.getElementById('notesDoctor').value.trim(),
    therapist_notes: document.getElementById('notesTherapist').value.trim()
  };
  const { data: existing } = await supabase.from('patient_notes').select('id').eq('lead_id', leadId).eq('owner_id', ownerId).maybeSingle();
  const { error } = existing
    ? await supabase.from('patient_notes').update(payload).eq('id', existing.id)
    : await supabase.from('patient_notes').insert(payload);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  showToast(t('saved'));
});

document.getElementById('aiGenBtn').addEventListener('click', async () => {
  const leadId = document.getElementById('notesPatient').value;
  if (!leadId) { showToast('Bitte Patient wählen', 'error'); return; }
  const notes = document.getElementById('notesTherapist').value.trim();
  if (!notes) { showToast('Therapeutennotizen eingeben', 'error'); return; }
  const btn = document.getElementById('aiGenBtn');
  btn.disabled = true; btn.textContent = 'Generiere…';
  try {
    const res = await fetch(`${API}/ai-summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, lang: currentLang })
    });
    const data = await res.json();
    const summary = data.summary || 'Keine Zusammenfassung verfügbar.';
    document.getElementById('aiReportBox').textContent = summary;
    document.getElementById('aiReportBox').style.display = 'block';
    const ownerId = getOwnerId();
    const { data: existing } = await supabase.from('patient_notes').select('id').eq('lead_id', leadId).eq('owner_id', ownerId).maybeSingle();
    if (existing) {
      await supabase.from('patient_notes').update({ ai_summary: summary }).eq('id', existing.id);
    }
  } catch (e) {
    showToast('AI-Fehler: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '🤖 AI-Bericht erstellen';
  }
});

document.getElementById('notesSendBtn').addEventListener('click', async () => {
  const leadId = document.getElementById('notesPatient').value;
  if (!leadId) { showToast('Bitte Patient wählen', 'error'); return; }
  const summary = document.getElementById('aiReportBox').textContent;
  if (!summary || document.getElementById('aiReportBox').style.display === 'none') {
    showToast('Zuerst AI-Bericht erstellen', 'error'); return;
  }

  if (!currentProfile.b2b_from_email) {
    showToast('Bitte zuerst E-Mail-Konto in B2B verbinden', 'error');
    switchPanel('b2b');
    return;
  }

  const { data: lead } = await supabase.from('leads').select('email,title,first_name,last_name').eq('id', leadId).single();
  if (!lead?.email) { showToast('Patient hat keine E-Mail', 'error'); return; }

  mailPreviewLeadId = leadId;

  const fromLabel = (currentProfile.b2b_sender_name || currentProfile.business_name || 'InfinityMade')
    + ' <' + currentProfile.b2b_from_email + '>';
  document.getElementById('mailPreviewFrom').value = fromLabel;
  document.getElementById('mailPreviewTo').value = displayName(lead) + ' <' + lead.email + '>';
  document.getElementById('mailPreviewSubject').value = 'Ihr Therapie-Bericht';
  document.getElementById('mailPreviewBody').textContent = summary;
  openModal('mailPreviewModal');
});

document.getElementById('mailPreviewSendBtn').addEventListener('click', async () => {
  const leadId = mailPreviewLeadId;
  const { data: lead } = await supabase.from('leads').select('email,title,first_name,last_name').eq('id', leadId).single();
  const summary = document.getElementById('aiReportBox').textContent;
  try {
    const res = await fetch(`${API}/b2b-mail-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        to_email: lead.email,
        to_name: displayName(lead),
        subject: 'Ihr Therapie-Bericht',
        body: summary,
        sender_name: currentProfile.b2b_sender_name || currentProfile.business_name || 'InfinityMade',
        from_email: currentProfile.b2b_from_email
      })
    });
    if (!res.ok) throw new Error('Senden fehlgeschlagen');
    closeModal('mailPreviewModal');
    showToast('Bericht gesendet: ' + lead.email);
  } catch (e) {
    showToast('Senden fehlgeschlagen: ' + e.message, 'error');
  }
});

async function handleGmailCallback() {
  const qp = new URLSearchParams(window.location.search);
  if (!qp.get('gmail_ok')) return;
  const email = qp.get('gmail_email') || '';
  if (email) {
    currentProfile.b2b_from_email = decodeURIComponent(email);
    gmailConnectedEmail = currentProfile.b2b_from_email;
  }
  window.history.replaceState({}, '', window.location.pathname);
  showToast('Gmail verbunden: ' + (gmailConnectedEmail || ''));
  switchPanel('b2b');
}

function generatePassword(len = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let pw = '';
  for (let i = 0; i < len; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
  return pw;
}

function openAddEmployeeModal() {
  document.getElementById('ae-first-name').value = '';
  document.getElementById('ae-last-name').value = '';
  document.getElementById('ae-email').value = '';
  document.getElementById('ae-phone').value = '';
  document.getElementById('addEmpFormStep').hidden = false;
  document.getElementById('addEmpResultStep').hidden = true;
  document.getElementById('aeSaveBtn').hidden = false;
  document.getElementById('aeCancelBtn').textContent = 'Abbrechen';
  document.getElementById('aeSaveBtn').disabled = false;
  document.getElementById('aeSaveBtn').textContent = 'Speichern';
  openModal('addEmployeeModal');
}

async function saveEmployee() {
  const firstName = document.getElementById('ae-first-name').value.trim();
  const lastName = document.getElementById('ae-last-name').value.trim();
  const email = document.getElementById('ae-email').value.trim();
  const phone = document.getElementById('ae-phone').value.trim();

  if (!firstName || !lastName || !email) {
    showToast('Bitte füllen Sie alle Pflichtfelder aus.', 'error');
    return;
  }

  const password = generatePassword(12);
  const ownerId = getOwnerId();
  const businessName = firstName + ' ' + lastName;

  const { data: { session: oldSession } } = await supabase.auth.getSession();

  const btn = document.getElementById('aeSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Wird erstellt...';

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.session && oldSession && data.session.user.id !== oldSession.user.id) {
      await supabase.auth.setSession({
        access_token: oldSession.access_token,
        refresh_token: oldSession.refresh_token
      });
    }

    const newUserId = data.user.id;
    const ownerSlug = cleanBookingSlug(currentProfile.business_name) || currentProfile.company_code?.toLowerCase() || cleanBookingSlug(ownerId);
    const empSlug = cleanBookingSlug(businessName);
    const slug = ownerSlug + '-' + empSlug;
    const booking_url = window.location.origin + '/booking.html?u=' + slug;

    const { error: profileError } = await supabase.from('profiles').insert({
      id: newUserId,
      email: email,
      business_name: businessName,
      phone: phone || null,
      owner_id: ownerId,
      role: 'employee',
      is_active: true,
      language: currentLang,
      plan: currentProfile.plan || 'starter',
      sector: currentProfile.sector || 'default',
      booking_slug: booking_url
    });
    if (profileError) throw profileError;

    showAddEmployeeResult(email, password);
    await loadTeam();
  } catch (e) {
    showToast('Fehler: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Speichern';
  }
}

function showAddEmployeeResult(email, password) {
  document.getElementById('addEmpFormStep').hidden = true;
  document.getElementById('addEmpResultStep').hidden = false;
  document.getElementById('aeSaveBtn').hidden = true;
  document.getElementById('aeCancelBtn').textContent = 'Schliessen';
  document.getElementById('ae-res-email').textContent = email;
  document.getElementById('ae-res-password').textContent = password;

  const loginUrl = 'https://infinitymade.de/login.html';
  const shareText = encodeURIComponent(
    'Hallo! Dein InfinityMade Zugang:' +
    '\nE-Mail: ' + email +
    '\nPasswort: ' + password +
    '\nLogin: ' + loginUrl
  );
  document.getElementById('aeShareWaBtn').href = 'https://wa.me/?text=' + shareText;

  document.getElementById('aeCopyEmailBtn').onclick = () => {
    navigator.clipboard.writeText(email);
    showToast('E-Mail kopiert');
  };
  document.getElementById('aeCopyPwBtn').onclick = () => {
    navigator.clipboard.writeText(password);
    showToast('Passwort kopiert');
  };
  document.getElementById('aeCopyLinkBtn').onclick = () => {
    navigator.clipboard.writeText(loginUrl);
    showToast('Link kopiert');
  };
}

document.getElementById('teamAddBtn').addEventListener('click', openAddEmployeeModal);
document.getElementById('aeSaveBtn').addEventListener('click', saveEmployee);

function setupScheduleNav() {
  const prev = document.getElementById('schedulePrev');
  const next = document.getElementById('scheduleNext');
  const today = document.getElementById('scheduleToday');
  if (prev) prev.addEventListener('click', async () => {
    const d = new Date(scheduleDate);
    d.setDate(d.getDate()-1);
    await loadScheduleBookings(d);
    await renderGapsForDate(d);
  });
  if (next) next.addEventListener('click', async () => {
    const d = new Date(scheduleDate);
    d.setDate(d.getDate()+1);
    await loadScheduleBookings(d);
    await renderGapsForDate(d);
  });
  if (today) today.addEventListener('click', async () => {
    await loadScheduleBookings(new Date());
    await renderGapsForDate(new Date());
  });

  const gPrev = document.getElementById('gapsPrev');
  const gNext = document.getElementById('gapsNext');
  const gToday = document.getElementById('gapsToday');
  if (gPrev) gPrev.addEventListener('click', async () => {
    const d = new Date(scheduleDate);
    d.setDate(d.getDate()-1);
    await loadScheduleBookings(d);
    await renderGapsForDate(d);
  });
  if (gNext) gNext.addEventListener('click', async () => {
    const d = new Date(scheduleDate);
    d.setDate(d.getDate()+1);
    await loadScheduleBookings(d);
    await renderGapsForDate(d);
  });
  if (gToday) gToday.addEventListener('click', async () => {
    await loadScheduleBookings(new Date());
    await renderGapsForDate(new Date());
  });
}

async function loadFeedbacks() {
  const list = document.getElementById('fbList');
  if (!list) return;
  list.innerHTML = '<div class="gaps-loading"><div class="spinner-sm"></div></div>';
  const { data, error } = await supabase.from('feedbacks').select('*').eq('user_id', currentSession.user.id).order('created_at', { ascending: false });
  if (error) { list.innerHTML = '<div class="table-empty">Fehler beim Laden.</div>'; return; }
  if (!data || data.length === 0) { list.innerHTML = '<div class="table-empty">Noch keine Tickets.</div>'; return; }
  list.innerHTML = data.map(f => {
    const statusColors = { open:'badge-yellow', in_progress:'badge-blue', resolved:'badge-green', closed:'badge-gray' };
    const priorityColors = { low:'badge-gray', medium:'badge-yellow', high:'badge-red', critical:'badge-red' };
    const st = f.status || 'open';
    const pr = f.priority || 'medium';
    const date = new Date(f.created_at).toLocaleDateString('de-DE');
    return `<div class="feedback-item">
      <div class="feedback-header">
        <span class="feedback-title">${f.title}</span>
        <div class="feedback-badges">
          <span class="badge ${statusColors[st]||'badge-gray'}">${st}</span>
          <span class="badge ${priorityColors[pr]||'badge-gray'}">${pr}</span>
        </div>
      </div>
      <div class="feedback-meta">${f.type} · ${date}</div>
      <div class="feedback-desc">${f.description || ''}</div>
      ${f.admin_notes ? `<div class="feedback-admin-note"><strong>Admin:</strong> ${f.admin_notes}</div>` : ''}
    </div>`;
  }).join('');
}

document.getElementById('fbSendBtn')?.addEventListener('click', async () => {
  const type = document.getElementById('fbType').value;
  const priority = document.getElementById('fbPriority').value;
  const title = document.getElementById('fbTitle').value.trim();
  const description = document.getElementById('fbDesc').value.trim();
  if (!title) { showToast('Titel ist erforderlich.', 'error'); return; }
  const ownerId = getOwnerId();
  const { error } = await supabase.from('feedbacks').insert({
    user_id: currentSession.user.id,
    owner_id: ownerId,
    type, priority, title, description
  });
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  document.getElementById('fbTitle').value = '';
  document.getElementById('fbDesc').value = '';
  showToast('Ticket erstellt.');
  await loadFeedbacks();
});

async function init() {
  try {
    console.log('[init] start');
    await ensureCompanyCode();
    console.log('[init] companyCode ok');
    await ensureBookingSlug();
    console.log('[init] bookingSlug ok');
    applyI18n();
    console.log('[init] i18n ok');
    renderSidebar();
    console.log('[init] sidebar ok');
    await loadTeam();
    console.log('[init] team ok');
    await renderOverview();
    console.log('[init] overview ok');
    try { await renderGaps(); console.log('[init] gaps ok'); } catch(e) { console.error('[init] renderGaps error', e); }
    try { await renderGapsForDate(scheduleDate); console.log('[init] gapsForDate ok'); } catch(e) { console.error('[init] renderGapsForDate error', e); }
    setupScheduleNav();
    await initCalendar();
    console.log('[init] calendar ok');
    await handleGmailCallback();
    console.log('[init] gmail ok');
  } catch(e) {
    console.error('[dashboard init]', e);
  } finally {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = '';
  }
}


