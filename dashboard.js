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
    qa_hours: 'Verfügbarkeit ändern', qa_events: 'Event-Types bearbeiten',
    qa_bookings: 'Alle Buchungen', qa_settings: 'Cal.com Einstellungen',

    leads_title: 'Leads', leads_sub: 'Verwalten Sie Ihre Anfragen',
    leads_add: '+ Neuer Lead', leads_import: 'CSV / JSON importieren',
    leads_empty: 'Noch keine Leads. Klicken Sie auf "Neuer Lead" oder "CSV importieren", um zu starten.',
    lf_all: 'Alle', lf_new: 'Neu', lf_contacted: 'Kontaktiert', lf_booked: 'Termin', lf_won: 'Gewonnen', lf_lost: 'Verloren',
    lead_title: 'Titel', lead_category_name: 'Kategorie', lead_categories: 'Alle Kategorien (Komma-getrennt)',
    lead_phone: 'Telefon', lead_email: 'E-Mail', lead_website: 'Website',
    lead_street: 'Straße', lead_city: 'Stadt', lead_state: 'Bundesland', lead_country_code: 'Land',
    lead_rating: 'Bewertung', lead_reviews: 'Anzahl Bewertungen', lead_google_url: 'Google Maps URL',
    lead_status: 'Status', lead_notes: 'Notizen',
    lead_modal_new: 'Neuer Lead', lead_modal_edit: 'Lead bearbeiten',
    lead_save: 'Speichern', lead_cancel: 'Abbrechen', lead_edit: 'Bearbeiten', lead_delete: 'Löschen',
    lead_confirm_delete: 'Diesen Lead wirklich löschen?',
    csv_imported: 'Leads importiert: ', csv_error: 'CSV-Import fehlgeschlagen: ',
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
    qa_hours: 'Manage availability', qa_events: 'Edit event types',
    qa_bookings: 'All bookings', qa_settings: 'Cal.com settings',

    leads_title: 'Leads', leads_sub: 'Manage your enquiries',
    leads_add: '+ New lead', leads_import: 'Import CSV / JSON',
    leads_empty: 'No leads yet. Click "New lead" or "Import CSV" to start.',
    lf_all: 'All', lf_new: 'New', lf_contacted: 'Contacted', lf_booked: 'Booked', lf_won: 'Won', lf_lost: 'Lost',
    lead_title: 'Title', lead_category_name: 'Category', lead_categories: 'All categories (comma-separated)',
    lead_phone: 'Phone', lead_email: 'Email', lead_website: 'Website',
    lead_street: 'Street', lead_city: 'City', lead_state: 'State', lead_country_code: 'Country',
    lead_rating: 'Rating', lead_reviews: 'Review count', lead_google_url: 'Google Maps URL',
    lead_status: 'Status', lead_notes: 'Notes',
    lead_modal_new: 'New lead', lead_modal_edit: 'Edit lead',
    lead_save: 'Save', lead_cancel: 'Cancel', lead_edit: 'Edit', lead_delete: 'Delete',
    lead_confirm_delete: 'Delete this lead?',
    csv_imported: 'Leads imported: ', csv_error: 'CSV import failed: ',
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
    qa_hours: 'Müsaitlik saatleri', qa_events: 'Randevu türleri',
    qa_bookings: 'Tüm randevular', qa_settings: 'Cal.com ayarları',

    leads_title: 'Leadler', leads_sub: 'Müşteri taleplerini yönetin',
    leads_add: '+ Yeni Lead', leads_import: 'CSV / JSON içe aktar',
    leads_empty: 'Henüz lead yok. "Yeni Lead" veya "CSV içe aktar" ile başlayın.',
    lf_all: 'Tümü', lf_new: 'Yeni', lf_contacted: 'İletişime geçildi', lf_booked: 'Randevu', lf_won: 'Kazanıldı', lf_lost: 'Kaybedildi',
    lead_title: 'Başlık', lead_category_name: 'Kategori', lead_categories: 'Tüm kategoriler (virgülle)',
    lead_phone: 'Telefon', lead_email: 'E-posta', lead_website: 'Website',
    lead_street: 'Sokak', lead_city: 'Şehir', lead_state: 'Eyalet', lead_country_code: 'Ülke',
    lead_rating: 'Puan', lead_reviews: 'Yorum sayısı', lead_google_url: 'Google Maps URL',
    lead_status: 'Durum', lead_notes: 'Notlar',
    lead_modal_new: 'Yeni Lead', lead_modal_edit: 'Lead düzenle',
    lead_save: 'Kaydet', lead_cancel: 'İptal', lead_edit: 'Düzenle', lead_delete: 'Sil',
    lead_confirm_delete: 'Bu lead silinsin mi?',
    csv_imported: 'Yüklenen lead sayısı: ', csv_error: 'CSV içe aktarma hatası: ',
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

let calRendered = false;
function renderCalendar() {
  const container = document.getElementById('cal-inline');
  const empty = document.getElementById('cal-empty');
  const url = (currentProfile.cal_link || '').trim();

  // URL'den Cal kullanıcı/event slug'ını çıkar
  // Örn: "https://cal.com/yavuz-kemal-demir-rmnjrz/infinitymade/embed"
  //   → "yavuz-kemal-demir-rmnjrz/infinitymade"
  const match = url.match(/cal\.com\/([^?#]+)/);
  let calLink = match ? match[1].replace(/\/embed\/?$/, '').replace(/\/$/, '') : '';

  if (!calLink) {
    container.style.display = 'none';
    empty.hidden = false;
    return;
  }

  container.style.display = 'block';
  empty.hidden = true;

  // Sadece bir kere init et
  if (!calRendered && typeof window.Cal === 'function') {
    window.Cal("inline", {
      elementOrSelector: "#cal-inline",
      config: { layout: "month_view" },
      calLink
    });
    window.Cal("ui", {
      styles: { branding: { brandColor: "#22c55e" } },
      hideEventTypeDetails: false,
      layout: "month_view"
    });
    calRendered = true;
  }
}

/* ============ LEADS CRUD ============ */
let leadsCache = [];
let leadStatusFilter = 'all';

async function loadLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('owner_id', currentSession.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Load leads error:', error);
    leadsCache = [];
    return;
  }
  leadsCache = data || [];
}

function paintLeads() {
  const t = T[currentLang];
  const tbody = document.getElementById('leadTableBody');
  const empty = document.getElementById('leadEmpty');
  if (!tbody) return;

  const filtered = leadStatusFilter === 'all'
    ? leadsCache
    : leadsCache.filter(l => l.status === leadStatusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  tbody.innerHTML = filtered.map(l => {
    const statusLabel = t['lf_' + l.status] || l.status;
    const websiteCell = l.website
      ? `<a href="${escapeHtml(l.website)}" target="_blank" rel="noopener" class="lead-website-link">${escapeHtml(shortUrl(l.website))}</a>`
      : '<span class="lead-cell-muted">—</span>';
    const ratingCell = l.total_score
      ? `<span class="lead-rating"><span class="lead-rating-star">★</span>${l.total_score}${l.reviews_count ? ` <span class="lead-cell-muted">(${l.reviews_count})</span>` : ''}</span>`
      : '<span class="lead-cell-muted">—</span>';
    return `
      <tr data-id="${l.id}">
        <td class="lead-name-cell">${escapeHtml(l.title || '')}<div class="lead-cell-muted" style="font-size:.78rem;margin-top:2px;">${escapeHtml(l.category_name || '')}</div></td>
        <td class="lead-cell-muted">${escapeHtml(l.city || '—')}</td>
        <td class="lead-cell-muted">${escapeHtml(l.phone || '—')}</td>
        <td>${websiteCell}</td>
        <td>${ratingCell}</td>
        <td><span class="status-badge status-${l.status}">${statusLabel}</span></td>
        <td>
          <div class="lead-actions">
            <button class="lead-action-btn" data-act="edit" data-id="${l.id}">${t.lead_edit}</button>
            <button class="lead-action-btn danger" data-act="del" data-id="${l.id}">${t.lead_delete}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function shortUrl(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); }
  catch { return u; }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function renderLeads() {
  const isLocked = currentProfile.plan === 'starter';
  document.getElementById('leads-content').hidden = isLocked;
  document.getElementById('leads-upgrade').hidden = !isLocked;
  if (isLocked) return;

  await loadLeads();
  paintLeads();
}

function openLeadModal(lead) {
  const t = T[currentLang];
  document.getElementById('leadModalTitle').textContent = lead ? t.lead_modal_edit : t.lead_modal_new;
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  v('lead-id', lead?.id);
  v('lead-title', lead?.title);
  v('lead-category-name', lead?.category_name);
  v('lead-phone', lead?.phone);
  v('lead-email', lead?.email);
  v('lead-website', lead?.website);
  v('lead-street', lead?.street);
  v('lead-city', lead?.city);
  v('lead-state', lead?.state);
  v('lead-country', lead?.country_code);
  v('lead-score', lead?.total_score);
  v('lead-reviews', lead?.reviews_count);
  v('lead-categories', Array.isArray(lead?.categories) ? lead.categories.join(', ') : '');
  v('lead-google-url', lead?.google_url);
  v('lead-status', lead?.status || 'new');
  v('lead-notes', lead?.notes);
  document.getElementById('leadModal').hidden = false;
}

function closeLeadModal() {
  document.getElementById('leadModal').hidden = true;
}

async function saveLead(e) {
  e.preventDefault();
  const id = document.getElementById('lead-id').value;
  const get = (i) => document.getElementById(i)?.value.trim() || null;
  const num = (i) => { const v = document.getElementById(i)?.value; return v ? Number(v) : null; };
  const cats = (document.getElementById('lead-categories')?.value || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const payload = {
    owner_id: currentSession.user.id,
    title: get('lead-title'),
    category_name: get('lead-category-name'),
    phone: get('lead-phone'),
    email: get('lead-email'),
    website: get('lead-website'),
    street: get('lead-street'),
    city: get('lead-city'),
    state: get('lead-state'),
    country_code: get('lead-country'),
    total_score: num('lead-score'),
    reviews_count: num('lead-reviews'),
    categories: cats.length ? cats : null,
    google_url: get('lead-google-url'),
    status: document.getElementById('lead-status').value,
    notes: get('lead-notes'),
    updated_at: new Date().toISOString()
  };

  let error;
  if (id) {
    ({ error } = await supabase.from('leads').update(payload).eq('id', id));
  } else {
    ({ error } = await supabase.from('leads').insert(payload));
  }

  if (error) {
    alert(error.message);
    return;
  }

  closeLeadModal();
  await renderLeads();
}

/* ============ CSV IMPORT ============ */
function parseCSV(text) {
  // BOM temizle
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQuotes) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += c; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function pickFirstEmail(item) {
  // JSON: emails array, additionalEmails array, email string
  const candidates = [];
  if (Array.isArray(item.emails)) candidates.push(...item.emails);
  if (Array.isArray(item.additionalEmails)) candidates.push(...item.additionalEmails);
  if (typeof item.emails === 'string') candidates.push(...item.emails.split(/[,;]/));
  if (typeof item.email === 'string') candidates.push(item.email);
  for (const c of candidates) {
    const v = String(c || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
  }
  return null;
}

function jsonItemToRecord(item) {
  const title = (item.title || item.name || '').trim();
  if (!title) return null;
  let cats = null;
  if (Array.isArray(item.categories)) cats = item.categories.filter(Boolean);
  return {
    owner_id: currentSession.user.id,
    title,
    total_score: item.totalScore ?? null,
    reviews_count: item.reviewsCount ?? null,
    street: item.street || null,
    city: item.city || null,
    state: item.state || null,
    country_code: item.countryCode || null,
    website: item.website || null,
    phone: item.phone || null,
    email: pickFirstEmail(item),
    categories: cats && cats.length ? cats : null,
    category_name: item.categoryName || null,
    google_url: item.url || null,
    status: 'new'
  };
}

async function handleCsvFile(file) {
  const t = T[currentLang];
  try {
    const text = await file.text();
    let records = [];

    const isJson = file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{');

    if (isJson) {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : [parsed]);
      records = items.map(jsonItemToRecord).filter(Boolean);
    } else {
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error('Empty CSV');

      const headers = rows[0].map(h => h.trim());
      const idx = (name) => headers.indexOf(name);

      const categoryIdxs = headers
        .map((h, i) => h.startsWith('categories/') ? i : -1)
        .filter(i => i >= 0);

      const emailIdxs = headers
        .map((h, i) => /^(emails?|additionalEmails?)(\/\d+)?$/i.test(h) ? i : -1)
        .filter(i => i >= 0);

      const extractEmail = (row) => {
        for (const i of emailIdxs) {
          const val = (row[i] || '').trim();
          if (!val) continue;
          const first = val.split(/[,;]/)[0].trim();
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first)) return first;
        }
        return null;
      };

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every(c => !c)) continue;
        const title = (row[idx('title')] || '').trim();
        if (!title) continue;
        const cats = categoryIdxs.map(i => row[i]?.trim()).filter(Boolean);
        records.push({
          owner_id: currentSession.user.id,
          title,
          total_score: row[idx('totalScore')] ? Number(row[idx('totalScore')]) : null,
          reviews_count: row[idx('reviewsCount')] ? parseInt(row[idx('reviewsCount')], 10) : null,
          street: row[idx('street')] || null,
          city: row[idx('city')] || null,
          state: row[idx('state')] || null,
          country_code: row[idx('countryCode')] || null,
          website: row[idx('website')] || null,
          phone: row[idx('phone')] || null,
          email: extractEmail(row),
          categories: cats.length ? cats : null,
          category_name: row[idx('categoryName')] || null,
          google_url: row[idx('url')] || null,
          status: 'new'
        });
      }
    }

    if (records.length === 0) throw new Error('No valid rows');

    for (let i = 0; i < records.length; i += 1000) {
      const chunk = records.slice(i, i + 1000);
      const { error } = await supabase.from('leads').insert(chunk);
      if (error) throw error;
    }

    alert(t.csv_imported + records.length);
    await renderLeads();
  } catch (err) {
    alert(t.csv_error + (err.message || err));
  }
}

async function deleteLead(id) {
  const t = T[currentLang];
  if (!confirm(t.lead_confirm_delete)) return;
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) { alert(error.message); return; }
  await renderLeads();
}

// Event listener'ları bir kere bağla
function bindLeadEvents() {
  document.getElementById('leadAddBtn')?.addEventListener('click', () => openLeadModal(null));
  document.getElementById('leadModalClose')?.addEventListener('click', closeLeadModal);
  document.getElementById('leadModalCancel')?.addEventListener('click', closeLeadModal);
  document.getElementById('leadForm')?.addEventListener('submit', saveLead);

  // CSV import
  const csvBtn = document.getElementById('csvImportBtn');
  const csvFile = document.getElementById('csvFile');
  csvBtn?.addEventListener('click', () => csvFile?.click());
  csvFile?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleCsvFile(file);
      e.target.value = '';
    }
  });

  // Filter pills
  document.querySelectorAll('.lf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      leadStatusFilter = btn.dataset.status;
      document.querySelectorAll('.lf-btn').forEach(b => b.classList.toggle('active', b === btn));
      paintLeads();
    });
  });

  // Row actions (event delegation)
  document.getElementById('leadTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'edit') {
      const lead = leadsCache.find(l => l.id === id);
      if (lead) openLeadModal(lead);
    } else if (btn.dataset.act === 'del') {
      deleteLead(id);
    }
  });

  // Modal backdrop click → close
  document.getElementById('leadModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'leadModal') closeLeadModal();
  });
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
bindLeadEvents();
switchPanel('overview');

document.getElementById('loading').style.display = 'none';
document.getElementById('app').style.display = 'block';
