import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============ TRANSLATIONS ============ */
const T = {
  de: {
    logout: 'Abmelden',
    nav_overview: 'Übersicht', nav_calendar: 'Kalender', nav_leads: 'Leads',
    nav_whatsapp: 'WhatsApp Bot', nav_settings: 'Einstellungen',

    overview_title: 'Übersicht',
    kpi_plan: 'Paket', kpi_status: 'Status', kpi_since: 'Aktiv seit', kpi_support: 'Support',
    status_active: '✓ Aktiv', status_inactive: '✗ Inaktiv',
    features_title: 'Was ist in Ihrem Paket enthalten?',

    calendar_title: 'Kalender', calendar_sub: 'Ihre Buchungen über Cal.com',
    cal_empty: 'Ihr Kalender wird gerade eingerichtet. Bitte kontaktieren Sie uns.',

    leads_title: 'Leads', leads_sub: 'Ihre Leads aus Airtable',
    airtable_empty: 'Ihre Lead-Datenbank wird gerade eingerichtet.',
    upgrade_title: 'Verfügbar ab Professional',
    upgrade_msg: 'Das Leads-Dashboard ist Teil der Professional- und Klinik-Pakete.',
    upgrade_cta: 'Paket upgraden',

    wa_title: 'WhatsApp Bot', wa_active: 'Bot Aktiv', wa_number: 'Nummer',
    wa_last7: 'Letzte 7 Tage',
    wa_msgs: 'Nachrichten beantwortet', wa_appts: 'Termine vereinbart', wa_cancels: 'Stornierungen bearbeitet',
    wa_open: 'WhatsApp öffnen',

    settings_title: 'Einstellungen',
    set_profile: 'Profil', set_biz: 'Unternehmensname', set_lang: 'Sprache', set_save: 'Speichern',
    set_password: 'Passwort ändern', set_new_pw: 'Neues Passwort', set_change: 'Passwort ändern',
    set_account: 'Konto',
    saved: 'Gespeichert.', pw_changed: 'Passwort geändert.', err_generic: 'Ein Fehler ist aufgetreten.',
    plan_label: 'Paket:', billing_monthly: 'monatlich', billing_annual: 'jährlich'
  },
  en: {
    logout: 'Sign out',
    nav_overview: 'Overview', nav_calendar: 'Calendar', nav_leads: 'Leads',
    nav_whatsapp: 'WhatsApp Bot', nav_settings: 'Settings',

    overview_title: 'Overview',
    kpi_plan: 'Plan', kpi_status: 'Status', kpi_since: 'Active since', kpi_support: 'Support',
    status_active: '✓ Active', status_inactive: '✗ Inactive',
    features_title: "What's included in your plan?",

    calendar_title: 'Calendar', calendar_sub: 'Your bookings via Cal.com',
    cal_empty: 'Your calendar is being set up. Please contact us.',

    leads_title: 'Leads', leads_sub: 'Your leads from Airtable',
    airtable_empty: 'Your lead database is being set up.',
    upgrade_title: 'Available from Professional',
    upgrade_msg: 'The Leads dashboard is part of the Professional and Klinik plans.',
    upgrade_cta: 'Upgrade plan',

    wa_title: 'WhatsApp Bot', wa_active: 'Bot Active', wa_number: 'Number',
    wa_last7: 'Last 7 days',
    wa_msgs: 'messages answered', wa_appts: 'appointments booked', wa_cancels: 'cancellations handled',
    wa_open: 'Open WhatsApp',

    settings_title: 'Settings',
    set_profile: 'Profile', set_biz: 'Business name', set_lang: 'Language', set_save: 'Save',
    set_password: 'Change password', set_new_pw: 'New password', set_change: 'Change password',
    set_account: 'Account',
    saved: 'Saved.', pw_changed: 'Password changed.', err_generic: 'Something went wrong.',
    plan_label: 'Plan:', billing_monthly: 'monthly', billing_annual: 'annual'
  },
  tr: {
    logout: 'Çıkış',
    nav_overview: 'Genel Bakış', nav_calendar: 'Takvim', nav_leads: 'Leadler',
    nav_whatsapp: 'WhatsApp Bot', nav_settings: 'Ayarlar',

    overview_title: 'Genel Bakış',
    kpi_plan: 'Paket', kpi_status: 'Durum', kpi_since: 'Aktif tarih', kpi_support: 'Destek',
    status_active: '✓ Aktif', status_inactive: '✗ Pasif',
    features_title: 'Paketinizde neler var?',

    calendar_title: 'Takvim', calendar_sub: 'Cal.com üzerinden randevularınız',
    cal_empty: 'Takviminiz hazırlanıyor. Lütfen bizimle iletişime geçin.',

    leads_title: 'Leadler', leads_sub: 'Airtable üzerinden leadleriniz',
    airtable_empty: 'Lead veritabanınız hazırlanıyor.',
    upgrade_title: 'Professional paketten itibaren',
    upgrade_msg: 'Leadler paneli Professional ve Klinik paketlerinde mevcuttur.',
    upgrade_cta: 'Paketi yükselt',

    wa_title: 'WhatsApp Bot', wa_active: 'Bot Aktif', wa_number: 'Numara',
    wa_last7: 'Son 7 gün',
    wa_msgs: 'mesaj cevaplandı', wa_appts: 'randevu alındı', wa_cancels: 'iptal işlendi',
    wa_open: "WhatsApp'ı aç",

    settings_title: 'Ayarlar',
    set_profile: 'Profil', set_biz: 'İşletme adı', set_lang: 'Dil', set_save: 'Kaydet',
    set_password: 'Şifre değiştir', set_new_pw: 'Yeni şifre', set_change: 'Şifre değiştir',
    set_account: 'Hesap',
    saved: 'Kaydedildi.', pw_changed: 'Şifre değiştirildi.', err_generic: 'Bir hata oluştu.',
    plan_label: 'Paket:', billing_monthly: 'aylık', billing_annual: 'yıllık'
  }
};

/* Plan-bazlı feature listeleri */
const PLAN_FEATURES = {
  starter: {
    de: ['WhatsApp KI-Assistent (24/7)', 'Automatische Erinnerungen (24h + 2h)', 'Warteliste-Automation', 'SSS-Antworten', '2 Sprachen', 'Google Bewertung nach Termin', 'Cal.com Kalenderintegration', 'DSGVO-konform + AV-Vertrag'],
    en: ['WhatsApp AI Assistant (24/7)', 'Automatic reminders (24h + 2h)', 'Waitlist automation', 'FAQ replies', '2 languages', 'Google review after appointment', 'Cal.com calendar integration', 'GDPR-compliant + DPA'],
    tr: ['WhatsApp KI Asistanı (7/24)', 'Otomatik hatırlatmalar (24sa + 2sa)', 'Bekleme listesi otomasyonu', 'SSS yanıtları', '2 dil', 'Randevu sonrası Google değerlendirmesi', 'Cal.com takvim entegrasyonu', 'DSGVO uyumlu + AV sözleşmesi']
  },
  professional: {
    de: ['Alles aus Starter', 'Reaktivierungskampagne (60 Tage)', 'Upsell-Vorschläge nach Termin', 'Auslastungs-Dashboard', 'Bis zu 4 Sprachen', 'Mitarbeiter-Routing', 'Kampagnen-Publisher (WhatsApp Broadcast)'],
    en: ['Everything in Starter', 'Reactivation campaign (60 days)', 'Upsell suggestions after appointment', 'Utilization dashboard', 'Up to 4 languages', 'Staff routing', 'Campaign publisher (WhatsApp broadcast)'],
    tr: ["Starter'daki her şey", 'Reaktivasyon kampanyası (60 gün)', 'Randevu sonrası ek satış önerileri', 'Doluluk paneli', '4 dile kadar', 'Personel yönlendirme', 'Kampanya yayıncısı (WhatsApp yayını)']
  },
  klinik: {
    de: ['Alles aus Professional', 'Digitales Anamnese-Formular', 'Verpasster Anruf → Assistent', 'Medizinische Erinnerungen', 'Rezept & AU-Schein Workflow', 'Unbegrenzte Sprachen'],
    en: ['Everything in Professional', 'Digital intake form', 'Missed call → Assistant', 'Medical reminders', 'Prescription & sick note workflow', 'Unlimited languages'],
    tr: ["Professional'daki her şey", 'Dijital anamnez formu', 'Cevapsız çağrı → Asistan', 'Tıbbi hatırlatmalar', 'Reçete & rapor iş akışı', 'Sınırsız dil']
  }
};

const SIDEBAR_ITEMS = [
  { id: 'overview',  icon: '📊', i18n: 'nav_overview',  plans: ['starter', 'professional', 'klinik'] },
  { id: 'calendar',  icon: '📅', i18n: 'nav_calendar',  plans: ['starter', 'professional', 'klinik'] },
  { id: 'leads',     icon: '🎯', i18n: 'nav_leads',     plans: ['starter', 'professional', 'klinik'], lockedFor: ['starter'] },
  { id: 'whatsapp',  icon: '💬', i18n: 'nav_whatsapp',  plans: ['starter', 'professional', 'klinik'] },
  { id: 'settings',  icon: '⚙️',  i18n: 'nav_settings',  plans: ['starter', 'professional', 'klinik'] },
];

let currentLang = localStorage.getItem('infinity_lang') || 'de';
let currentProfile = null;
let currentSession = null;

/* ============ AUTH GUARD ============ */
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  window.location.href = '/login.html';
  throw new Error('redirect');
}
currentSession = session;

/* ============ LOAD PROFILE ============ */
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single();

if (profileError || !profile) {
  // Profile yoksa minimum bir model oluştur — yine de dashboard'u göster
  currentProfile = {
    id: session.user.id,
    email: session.user.email,
    business_name: '',
    plan: 'starter',
    billing: 'monthly',
    cal_link: '',
    airtable_link: '',
    whatsapp_number: '',
    language: currentLang,
    is_active: true,
    activated_at: null
  };
} else {
  currentProfile = profile;
  if (profile.language && !localStorage.getItem('infinity_lang')) {
    currentLang = profile.language;
  }
}

/* ============ RENDER ============ */
function applyI18n() {
  const t = T[currentLang];
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  renderSidebar();
  renderOverview();
}

function renderSidebar() {
  const t = T[currentLang];
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  SIDEBAR_ITEMS.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'sidebar-item' + (item.id === activePanel ? ' active' : '');
    btn.dataset.panel = item.id;
    const locked = item.lockedFor && item.lockedFor.includes(currentProfile.plan);
    btn.innerHTML = `
      <span class="icon">${item.icon}</span>
      <span>${t[item.i18n]}</span>
      ${locked ? '<span class="lock">🔒</span>' : ''}
    `;
    btn.addEventListener('click', () => switchPanel(item.id));
    nav.appendChild(btn);
  });
}

function renderOverview() {
  const t = T[currentLang];
  const planName = currentProfile.plan ? currentProfile.plan.charAt(0).toUpperCase() + currentProfile.plan.slice(1) : '—';
  document.getElementById('kpi-plan').textContent = planName;
  document.getElementById('kpi-status').textContent = currentProfile.is_active ? t.status_active : t.status_inactive;

  if (currentProfile.activated_at) {
    const d = new Date(currentProfile.activated_at);
    const locale = currentLang === 'de' ? 'de-DE' : currentLang === 'tr' ? 'tr-TR' : 'en-US';
    document.getElementById('kpi-since').textContent = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  } else {
    document.getElementById('kpi-since').textContent = '—';
  }

  // Features
  const list = document.getElementById('featureList');
  list.innerHTML = '';
  const features = (PLAN_FEATURES[currentProfile.plan] || PLAN_FEATURES.starter)[currentLang] || [];
  features.forEach(f => {
    const li = document.createElement('li');
    li.textContent = f;
    list.appendChild(li);
  });
}

function renderCalendar() {
  const frame = document.getElementById('cal-frame');
  const empty = document.getElementById('cal-empty');
  if (currentProfile.cal_link) {
    frame.src = currentProfile.cal_link;
    frame.style.display = 'block';
    empty.hidden = true;
  } else {
    frame.style.display = 'none';
    empty.hidden = false;
  }
}

function renderLeads() {
  const isLocked = currentProfile.plan === 'starter';
  document.getElementById('leads-content').hidden = isLocked;
  document.getElementById('leads-upgrade').hidden = !isLocked;

  if (!isLocked) {
    const frame = document.getElementById('airtable-frame');
    const empty = document.getElementById('airtable-empty');
    if (currentProfile.airtable_link) {
      frame.src = currentProfile.airtable_link;
      frame.style.display = 'block';
      empty.hidden = true;
    } else {
      frame.style.display = 'none';
      empty.hidden = false;
    }
  }
}

function renderWhatsApp() {
  document.getElementById('wa-number-val').textContent = currentProfile.whatsapp_number || '—';
  const link = document.getElementById('wa-link');
  if (currentProfile.whatsapp_number) {
    const cleaned = currentProfile.whatsapp_number.replace(/[^\d+]/g, '');
    link.href = `https://wa.me/${cleaned.replace(/^\+/, '')}`;
  } else {
    link.href = '#';
  }
}

function renderSettings() {
  document.getElementById('set-biz').value = currentProfile.business_name || '';
  document.getElementById('set-lang').value = currentLang;
  document.getElementById('acc-email').textContent = currentProfile.email || currentSession.user.email;
  const t = T[currentLang];
  const billingLabel = currentProfile.billing === 'annual' ? t.billing_annual : t.billing_monthly;
  const planName = currentProfile.plan ? currentProfile.plan.charAt(0).toUpperCase() + currentProfile.plan.slice(1) : '—';
  document.getElementById('acc-plan-line').textContent = `${t.plan_label} ${planName} (${billingLabel})`;
}

/* ============ PANEL SWITCHING ============ */
let activePanel = 'overview';
const panelMap = {
  overview: 'panel-overview',
  calendar: 'panel-calendar',
  leads: 'panel-leads',
  whatsapp: 'panel-whatsapp',
  settings: 'panel-settings'
};

function switchPanel(id) {
  activePanel = id;
  Object.entries(panelMap).forEach(([k, panelId]) => {
    document.getElementById(panelId).hidden = k !== id;
  });
  document.querySelectorAll('.sidebar-item').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === id);
  });

  if (id === 'calendar') renderCalendar();
  if (id === 'leads') renderLeads();
  if (id === 'whatsapp') renderWhatsApp();
  if (id === 'settings') renderSettings();

  // mobil sidebar kapat
  document.getElementById('sidebar').classList.remove('open');
}

/* ============ HEADER WIRING ============ */
document.getElementById('bizName').textContent = currentProfile.business_name || currentSession.user.email;
document.getElementById('langSelect').value = currentLang;

document.getElementById('langSelect').addEventListener('change', (e) => {
  currentLang = e.target.value;
  localStorage.setItem('infinity_lang', currentLang);
  applyI18n();
  if (activePanel === 'settings') renderSettings();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

/* ============ FORMS ============ */
const profileMsg = document.getElementById('profileMsg');
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  profileMsg.className = 'msg';
  const biz = document.getElementById('set-biz').value.trim();
  const lang = document.getElementById('set-lang').value;
  const t = T[currentLang];

  const { error } = await supabase
    .from('profiles')
    .update({ business_name: biz, language: lang })
    .eq('id', currentSession.user.id);

  if (error) {
    profileMsg.className = 'msg show error';
    profileMsg.textContent = t.err_generic;
    return;
  }

  currentProfile.business_name = biz;
  currentProfile.language = lang;
  document.getElementById('bizName').textContent = biz || currentSession.user.email;

  if (lang !== currentLang) {
    currentLang = lang;
    localStorage.setItem('infinity_lang', lang);
    document.getElementById('langSelect').value = lang;
    applyI18n();
    renderSettings();
  }

  profileMsg.className = 'msg show success';
  profileMsg.textContent = T[currentLang].saved;
});

const passwordMsg = document.getElementById('passwordMsg');
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  passwordMsg.className = 'msg';
  const pw = document.getElementById('set-pw').value;
  const t = T[currentLang];

  const { error } = await supabase.auth.updateUser({ password: pw });

  if (error) {
    passwordMsg.className = 'msg show error';
    passwordMsg.textContent = error.message || t.err_generic;
    return;
  }

  passwordMsg.className = 'msg show success';
  passwordMsg.textContent = t.pw_changed;
  document.getElementById('set-pw').value = '';
});

/* ============ INIT ============ */
applyI18n();
switchPanel('overview');

document.getElementById('loading').style.display = 'none';
document.getElementById('app').style.display = 'block';
