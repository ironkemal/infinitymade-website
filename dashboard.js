import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { mountCalendar } from './calendar-widget.js?v=20260512h';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : 'https://n8n.infinitymade.de/api';

// Global business switcher state
let currentBusiness = null;
let myBusinesses = [];
// Cross-business data sharing policy (per owner). true = shared across all Standorte, false = separate per business.
// Missing DB row => all false (separate). Loaded by loadDataSharing() during init.
let dataSharing = { patients: false, services: false, activities: false, finance: false, network: false };
const BIZ_STORAGE_KEY = 'infinitymade.active_business';
const BIZ_PREF_KEY = 'selected_business';
const ENTERPRISE_PLANS = new Set(['enterprise']);
const PLAN_EMPLOYEE_LIMITS = { starter: 2, professional: 8, klinik: 15, enterprise: Infinity };
function employeeLimit() { return PLAN_EMPLOYEE_LIMITS[(currentProfile?.plan || 'starter').toLowerCase()] ?? 2; }


const T = {
  de: {
    logout: 'Abmelden',
    nav_overview: 'Übersicht', nav_calendar: 'Termine', nav_kunden: 'Kunden Info',
    wiz_step_1: '1. Kontrolle', wiz_step_2: '2. Taxierung', wiz_step_3: '3. Export', wiz_step_4: '4. Archiv',
    nav_services: 'Dienstleistungen', nav_hours: 'Arbeitszeiten',
    nav_team: 'Mitarbeiter', nav_b2b: 'B2B', nav_b2c: 'B2C Mail', nav_rechnungen: 'Rechnungen', nav_feedback: 'Feedback', nav_settings: 'Einstellungen',
    overview_sub: 'Ihr heutiger Überblick',
    welcome_text: 'Willkommen',
    kpi_plan: 'Paket', kpi_status: 'Status', kpi_today_bookings: 'Heute', kpi_today_sub: 'Termine', kpi_support: 'Support',
    status_active: '✓ Aktiv', status_inactive: '✗ Inaktiv',
    today_bookings: 'Heutige Termine', upcoming_empty: 'Heute keine Termine.', features_title: 'Paketinhalt',
    calendar_sub: 'Termine verwalten & buchen',
    btn_add_leave: 'Abwesenheit eintragen', btn_add_booking: '+ Termin',
    kunden_sub: 'Leads & Kundeninformationen', leads_import: 'CSV importieren', leads_add: '+ Neuer Lead',
    apify_label: 'Google Maps Scraper:', apify_run: 'Suchen',
    lf_all: 'Alle', lf_new: 'Neu', lf_contacted: 'Kontaktiert', lf_booked: 'Termin', lf_won: 'Gewonnen', lf_lost: 'Verloren',
    lead_title: 'Name', lead_city: 'Stadt', lead_phone: 'Telefon', lead_rating: 'Bewertung', lead_standort: 'Standort',
    lead_status: 'Status', lead_notes: 'Notizen', lead_email: 'E-Mail', lead_website: 'Website',
    lead_country_code: 'Land', lead_google_url: 'Google Maps URL', lead_category_name: 'Kategorie',
    leads_empty: 'Noch keine Leads.', lead_modal_new: 'Neuer Lead', lead_modal_edit: 'Lead bearbeiten',
    lead_save: 'Speichern', lead_cancel: 'Abbrechen', lead_delete: 'Löschen', lead_confirm_delete: 'Lead wirklich löschen?',
    services_sub: 'Angebotene Leistungen verwalten',
    lbl_add_service: 'Neue Dienstleistung', lbl_srv_title: 'Name', lbl_srv_dur: 'Dauer (Min)',
    lbl_srv_price: 'Preis (€)', lbl_srv_emps: 'Mitarbeiter', btn_srv_save: 'Speichern',
    alert_service_delete: 'Dienstleistung wirklich löschen?',
    hours_sub: 'Öffnungszeiten je Mitarbeiter', btn_save_hours: 'Speichern', hours_for: 'Für:',
    alert_hours_saved: 'Arbeitszeiten gespeichert!',
    team_sub: 'Team verwalten', lbl_invite_code: 'Unternehmens-Code',
    sub_invite_code: 'Mitarbeiter registrieren sich mit diesem Code.',
    btn_copy: 'Kopieren', btn_remove: 'Entfernen', tab_info: 'Info', lbl_google_cal: 'Google Kalender',
    b2b_sub: 'Geschäftskontakte & KI-Assistent', b2b_add: '+ Kontakt',
    b2b_company: 'Unternehmen', b2b_contact: 'Ansprechpartner', b2b_status: 'Status',
    b2b_empty: 'Noch keine B2B-Kontakte.', b2b_ai_title: 'KI-Assistent',
    b2b_ai_welcome: 'Hallo! Ich helfe Ihnen bei B2B-Anfragen.',
    set_profile: 'Profil', set_biz: 'Unternehmensname', set_lang: 'Sprache', set_save: 'Speichern',
    set_account: 'Konto', set_password: 'Passwort', set_new_pw: 'Neues Passwort',
    set_change: 'Passwort ändern', set_integrations: 'Integrationen',
    sub_portal: 'Abonnement verwalten', sub_upgrade: 'Upgrade',
    status_disconnected: 'Nicht verbunden', status_connected: 'Verbunden',
    btn_connect: 'Verbinden', btn_disconnect: 'Trennen',
    lbl_manual_title: 'Neuer Termin', lbl_manual_emp: 'Mitarbeiter', lbl_manual_service: 'Dienstleistung',
    lbl_manual_start: 'Von', lbl_manual_end: 'Bis', lbl_manual_cust: 'Kundenname',
    lbl_leave_title: 'Abwesenheit eintragen', lbl_leave_emp: 'Für wen?',
    lbl_leave_start: 'Start', lbl_leave_end: 'Ende', lbl_leave_reason: 'Grund',
    btn_leave_cancel: 'Abbrechen', btn_leave_save: 'Speichern',
    lbl_other: 'Andere',
    saved: 'Gespeichert.', pw_changed: 'Passwort geändert.', err_generic: 'Ein Fehler ist aufgetreten.',
    copied: 'Kopiert!', csv_imported: 'Importiert: ', csv_error: 'CSV-Fehler: ',
    apify_error: 'Apify-Fehler: ', apify_done: 'Importiert: ', me: '(Sie)',
    nav_doctors: 'Ärzte', nav_notizen: 'Notizen', nav_fahrtenbuch: 'Fahrtenbuch', nav_beispielmodus: 'Beispielmodus', nav_anamnese: 'Anamnese',
    doctors_sub: 'Ärzte in der Nähe finden', notizen_sub: 'Patientennotizen & Berichte', b2c_sub: 'Kundenmailings & KI-Assistent',
    beispielmodus_sub: 'Anatomie-Haritas für Patientengespräche', anamnese_sub: 'Digitales Anamnese-Formular',
    lbl_doctor_notes: 'Arztnotizen', lbl_therapist_notes: 'Therapeutennotizen',
    lbl_ai_summary: 'AI-Bericht', lbl_send_patient: 'An Patient senden',
    lbl_select_patient: 'Patient wählen', lbl_notes_empty: 'Keine Notizen vorhanden.',
    nav_abrechnung: 'Kassenabrechnung', abrechnung_sub: 'Sammelrechnung § 302 SGB V an Krankenkassen',
    ab_ready: 'Abrechnungsbereit', ab_history: 'Abrechnungs-Historie',
    ab_kk: 'Krankenkasse', ab_patient: 'Patient', ab_rezept: 'Rezept', ab_einheiten: 'Einheiten',
    ab_brutto: 'Brutto', ab_zuzahlung: 'Zuzahlung', ab_select_all: 'Alle wählen',
    ab_create: 'Abrechnung erstellen', ab_no_ready: 'Keine abrechnungsbereiten Rezepte.',
    ab_no_history: 'Noch keine Abrechnungen erstellt.',
    ab_filename: 'Dateiname', ab_count: 'Rezepte', ab_total: 'Summe', ab_status: 'Status', ab_actions: '',
    ab_download_dta: '📥 DTA', ab_download_begleit: '📄 Begleitzettel',
    ab_creating: 'Erstelle Abrechnung…', ab_created: 'Abrechnung erstellt.',
    ab_status_erstellt: 'Erstellt', ab_status_heruntergeladen: 'Heruntergeladen',
    ab_status_gesendet: 'Versendet', ab_status_accepted: 'Akzeptiert',
    ab_status_rejected: 'Abgelehnt', ab_status_paid: 'Bezahlt',
    ab_zuzahlung_befreit: 'befreit', ab_hint_select: 'Wählen Sie alle Rezepte einer Krankenkasse, die in einer Sammelrechnung gebündelt werden sollen.',
    nav_belegliste: 'Kassenbuch (GoBD)',
    nav_mahnwesen: 'Mahnwesen',
    nav_statistik: 'Statistik',
    nav_warteliste: 'Warteliste'
  },
  en: {
    logout: 'Sign out',
    nav_overview: 'Overview', nav_calendar: 'Appointments', nav_kunden: 'Customers',
    wiz_step_1: '1. Control', wiz_step_2: '2. Pricing', wiz_step_3: '3. Export', wiz_step_4: '4. Archive',
    nav_services: 'Services', nav_hours: 'Working Hours',
    nav_team: 'Team', nav_b2b: 'B2B', nav_b2c: 'B2C Mail', nav_rechnungen: 'Invoices', nav_feedback: 'Feedback', nav_settings: 'Settings',
    overview_sub: 'Your daily overview',
    welcome_text: 'Welcome',
    kpi_plan: 'Plan', kpi_status: 'Status', kpi_today_bookings: 'Today', kpi_today_sub: 'Appointments', kpi_support: 'Support',
    status_active: '✓ Active', status_inactive: '✗ Inactive',
    today_bookings: "Today's Appointments", upcoming_empty: 'No appointments today.', features_title: "Plan contents",
    calendar_sub: 'Manage & book appointments', btn_add_leave: 'Add time off', btn_add_booking: '+ Appointment',
    kunden_sub: 'Leads & customer info', leads_import: 'Import CSV', leads_add: '+ New lead',
    apify_label: 'Google Maps Scraper:', apify_run: 'Search',
    lf_all: 'All', lf_new: 'New', lf_contacted: 'Contacted', lf_booked: 'Booked', lf_won: 'Won', lf_lost: 'Lost',
    lead_title: 'Name', lead_city: 'City', lead_phone: 'Phone', lead_rating: 'Rating', lead_standort: 'Practice',
    lead_status: 'Status', lead_notes: 'Notes', lead_email: 'Email', lead_website: 'Website',
    lead_country_code: 'Country', lead_google_url: 'Google Maps URL', lead_category_name: 'Category',
    leads_empty: 'No leads yet.', lead_modal_new: 'New lead', lead_modal_edit: 'Edit lead',
    lead_save: 'Save', lead_cancel: 'Cancel', lead_delete: 'Delete', lead_confirm_delete: 'Delete this lead?',
    services_sub: 'Manage your services',
    lbl_add_service: 'New Service', lbl_srv_title: 'Name', lbl_srv_dur: 'Duration (min)',
    lbl_srv_price: 'Price (€)', lbl_srv_emps: 'Employees', btn_srv_save: 'Save',
    alert_service_delete: 'Delete this service?',
    hours_sub: 'Working hours per employee', btn_save_hours: 'Save', hours_for: 'For:',
    alert_hours_saved: 'Hours saved!',
    team_sub: 'Manage your team', lbl_invite_code: 'Company Code',
    sub_invite_code: 'Employees register with this code.',
    btn_copy: 'Copy', btn_remove: 'Remove', tab_info: 'Info', lbl_google_cal: 'Google Calendar',
    b2b_sub: 'Business contacts & AI assistant', b2b_add: '+ Contact',
    b2b_company: 'Company', b2b_contact: 'Contact person', b2b_status: 'Status',
    b2b_empty: 'No B2B contacts yet.', b2b_ai_title: 'AI Assistant', b2b_ai_welcome: 'Hi! I can help with B2B queries.',
    set_profile: 'Profile', set_biz: 'Business name', set_lang: 'Language', set_save: 'Save',
    set_account: 'Account', set_password: 'Password', set_new_pw: 'New password',
    set_change: 'Change password', set_integrations: 'Integrations',
    sub_portal: 'Manage subscription', sub_upgrade: 'Upgrade',
    status_disconnected: 'Disconnected', status_connected: 'Connected',
    btn_connect: 'Connect', btn_disconnect: 'Disconnect',
    lbl_manual_title: 'New Appointment', lbl_manual_emp: 'Employee', lbl_manual_service: 'Service',
    lbl_manual_start: 'From', lbl_manual_end: 'To', lbl_manual_cust: 'Customer name',
    lbl_leave_title: 'Add time off', lbl_leave_emp: 'For whom?',
    lbl_leave_start: 'Start', lbl_leave_end: 'End', lbl_leave_reason: 'Reason',
    btn_leave_cancel: 'Cancel', btn_leave_save: 'Save',
    lbl_other: 'Other',
    saved: 'Saved.', pw_changed: 'Password changed.', err_generic: 'An error occurred.',
    copied: 'Copied!', csv_imported: 'Imported: ', csv_error: 'CSV error: ',
    apify_error: 'Apify error: ', apify_done: 'Imported: ', me: '(You)',
    nav_doctors: 'Doctors', nav_notizen: 'Notes', nav_fahrtenbuch: 'Travel Log', nav_beispielmodus: 'Demo Mode', nav_anamnese: 'Intake',
    doctors_sub: 'Find nearby doctors', notizen_sub: 'Patient notes & reports', b2c_sub: 'Customer mailings & AI assistant',
    beispielmodus_sub: 'Anatomy maps for patient consultations', anamnese_sub: 'Digital intake form',
    lbl_doctor_notes: 'Doctor notes', lbl_therapist_notes: 'Therapist notes',
    lbl_ai_summary: 'AI Report', lbl_send_patient: 'Send to patient',
    lbl_select_patient: 'Select patient', lbl_notes_empty: 'No notes available.',
    nav_abrechnung: 'Insurance Billing', abrechnung_sub: '§ 302 SGB V batch billing to health insurers',
    ab_ready: 'Ready to bill', ab_history: 'Billing history',
    ab_kk: 'Insurer', ab_patient: 'Patient', ab_rezept: 'Rx', ab_einheiten: 'Units',
    ab_brutto: 'Gross', ab_zuzahlung: 'Co-pay', ab_select_all: 'Select all',
    ab_create: 'Create billing', ab_no_ready: 'No prescriptions ready for billing.',
    ab_no_history: 'No billings yet.',
    ab_filename: 'Filename', ab_count: 'Rx count', ab_total: 'Total', ab_status: 'Status', ab_actions: '',
    ab_download_dta: '📥 DTA', ab_download_begleit: '📄 Cover sheet',
    ab_creating: 'Creating billing…', ab_created: 'Billing created.',
    ab_status_erstellt: 'Created', ab_status_heruntergeladen: 'Downloaded',
    ab_status_gesendet: 'Sent', ab_status_accepted: 'Accepted',
    ab_status_rejected: 'Rejected', ab_status_paid: 'Paid',
    ab_zuzahlung_befreit: 'exempt', ab_hint_select: 'Select all prescriptions for one insurer to bundle into a single batch invoice.',
    nav_belegliste: 'Cash Ledger (GoBD)',
    nav_mahnwesen: 'Dunning',
    nav_statistik: 'Statistics',
    nav_warteliste: 'Waiting List'
  },
  tr: {
    logout: 'Çıkış',
    nav_overview: 'Genel Bakış', nav_calendar: 'Randevular', nav_kunden: 'Müşteri Bilgisi',
    wiz_step_1: '1. Kontrol', wiz_step_2: '2. Fiyatlandırma', wiz_step_3: '3. Dışa Aktarım', wiz_step_4: '4. Arşiv',
    nav_services: 'Hizmetler', nav_hours: 'Çalışma Saatleri',
    nav_team: 'Personel', nav_b2b: 'B2B', nav_b2c: 'B2C Mail', nav_rechnungen: 'Faturalar', nav_feedback: 'Geri Bildirim', nav_settings: 'Ayarlar',
    overview_sub: 'Günlük genel bakışınız',
    welcome_text: 'Hoşgeldin',
    kpi_plan: 'Paket', kpi_status: 'Durum', kpi_today_bookings: 'Bugün', kpi_today_sub: 'Randevu', kpi_support: 'Destek',
    status_active: '✓ Aktif', status_inactive: '✗ Pasif',
    today_bookings: 'Bugünkü randevularınız', upcoming_empty: 'Bugün randevu yok.', features_title: 'Paket içeriği',
    calendar_sub: 'Randevu yönetimi', btn_add_leave: 'İzin ekle', btn_add_booking: '+ Randevu',
    kunden_sub: 'Lead & müşteri bilgileri', leads_import: 'CSV içe aktar', leads_add: '+ Yeni Lead',
    apify_label: 'Google Maps Scraper:', apify_run: 'Ara',
    lf_all: 'Tümü', lf_new: 'Yeni', lf_contacted: 'İletişim kuruldu', lf_booked: 'Randevu', lf_won: 'Kazanıldı', lf_lost: 'Kaybedildi',
    lead_title: 'Ad', lead_city: 'Şehir', lead_phone: 'Telefon', lead_rating: 'Puan', lead_standort: 'Şube',
    lead_status: 'Durum', lead_notes: 'Notlar', lead_email: 'E-posta', lead_website: 'Website',
    lead_country_code: 'Ülke', lead_google_url: 'Google Maps URL', lead_category_name: 'Kategori',
    leads_empty: 'Henüz lead yok.', lead_modal_new: 'Yeni Lead', lead_modal_edit: 'Lead düzenle',
    lead_save: 'Kaydet', lead_cancel: 'İptal', lead_delete: 'Sil', lead_confirm_delete: 'Bu lead silinsin mi?',
    services_sub: 'Sunulan hizmetleri yönet',
    lbl_add_service: 'Yeni Hizmet', lbl_srv_title: 'Ad', lbl_srv_dur: 'Süre (dk)',
    lbl_srv_price: 'Fiyat (€)', lbl_srv_emps: 'Personel', btn_srv_save: 'Kaydet',
    alert_service_delete: 'Bu hizmet silinsin mi?',
    hours_sub: 'Personel başına çalışma saatleri', btn_save_hours: 'Kaydet', hours_for: 'Kimin için:',
    alert_hours_saved: 'Saatler kaydedildi!',
    team_sub: 'Ekibi yönet', lbl_invite_code: 'Şirket Kodu',
    sub_invite_code: 'Çalışanlar bu kodla kayıt olabilir.',
    btn_copy: 'Kopyala', btn_remove: 'Çıkar', tab_info: 'Bilgi', lbl_google_cal: 'Google Takvim',
    b2b_sub: 'İş ortakları & KI asistan', b2b_add: '+ Kişi',
    b2b_company: 'Şirket', b2b_contact: 'İlgili kişi', b2b_status: 'Durum',
    b2b_empty: 'Henüz B2B kişisi yok.', b2b_ai_title: 'KI Asistan', b2b_ai_welcome: 'Merhaba! B2B sorularınızda yardımcı olabilirim.',
    set_profile: 'Profil', set_biz: 'İşletme adı', set_lang: 'Dil', set_save: 'Kaydet',
    set_account: 'Hesap', set_password: 'Şifre', set_new_pw: 'Yeni şifre',
    set_change: 'Şifre değiştir', set_integrations: 'Entegrasyonlar',
    sub_portal: 'Aboneliği yönet', sub_upgrade: 'Yükselt',
    status_disconnected: 'Bağlı değil', status_connected: 'Bağlandı',
    btn_connect: 'Bağlan', btn_disconnect: 'Bağlantıyı kes',
    lbl_manual_title: 'Yeni Randevu', lbl_manual_emp: 'Personel', lbl_manual_service: 'Hizmet',
    lbl_manual_start: 'Başlangıç', lbl_manual_end: 'Bitiş', lbl_manual_cust: 'Müşteri adı',
    lbl_leave_title: 'İzin ekle', lbl_leave_emp: 'Kimin için?',
    lbl_leave_start: 'Başlangıç', lbl_leave_end: 'Bitiş', lbl_leave_reason: 'Sebep',
    btn_leave_cancel: 'İptal', btn_leave_save: 'Kaydet',
    lbl_other: 'Diğer',
    saved: 'Kaydedildi.', pw_changed: 'Şifre değiştirildi.', err_generic: 'Bir hata oluştu.',
    copied: 'Kopyalandı!', csv_imported: 'İçe aktarıldı: ', csv_error: 'CSV hatası: ',
    apify_error: 'Apify hatası: ', apify_done: 'İçe aktarıldı: ', me: '(Siz)',
    nav_doctors: 'Doktorlar', nav_notizen: 'Notlar', nav_fahrtenbuch: 'Sürüş Defteri', nav_beispielmodus: 'Örnek Modu', nav_anamnese: 'Anamnez',
    doctors_sub: 'Yakındaki doktorları bul', notizen_sub: 'Hasta notları ve raporlar', b2c_sub: 'Müşteri maileri ve AI asistanı',
    beispielmodus_sub: 'Hasta görüşmeleri için anatomi haritaları', anamnese_sub: 'Dijital anamnez formu',
    lbl_doctor_notes: 'Doktor notları', lbl_therapist_notes: 'Terapist notları',
    lbl_ai_summary: 'AI Raporu', lbl_send_patient: 'Hastaya gönder',
    lbl_select_patient: 'Hasta seç', lbl_notes_empty: 'Not bulunmuyor.',
    nav_abrechnung: 'Kasa Faturalandırması', abrechnung_sub: '§ 302 SGB V Krankenkasse toplu faturası',
    ab_ready: 'Faturalandırmaya hazır', ab_history: 'Fatura geçmişi',
    ab_kk: 'Sigorta', ab_patient: 'Hasta', ab_rezept: 'Reçete', ab_einheiten: 'Birim',
    ab_brutto: 'Brüt', ab_zuzahlung: 'Katkı', ab_select_all: 'Tümünü seç',
    ab_create: 'Fatura oluştur', ab_no_ready: 'Faturalandırmaya hazır reçete yok.',
    ab_no_history: 'Henüz fatura oluşturulmadı.',
    ab_filename: 'Dosya adı', ab_count: 'Reçete sayısı', ab_total: 'Toplam', ab_status: 'Durum', ab_actions: '',
    ab_download_dta: '📥 DTA', ab_download_begleit: '📄 Refakat belgesi',
    ab_creating: 'Fatura oluşturuluyor…', ab_created: 'Fatura oluşturuldu.',
    ab_status_erstellt: 'Oluşturuldu', ab_status_heruntergeladen: 'İndirildi',
    ab_status_gesendet: 'Gönderildi', ab_status_accepted: 'Kabul',
    ab_status_rejected: 'Red', ab_status_paid: 'Ödendi',
    ab_zuzahlung_befreit: 'muaf', ab_hint_select: 'Tek bir Krankenkasse için tüm reçeteleri seçerek tek bir toplu faturada birleştirin.',
    nav_belegliste: 'Kasa Defteri (GoBD)',
    nav_mahnwesen: 'Tahsilat',
    nav_statistik: 'İstatistik',
    nav_warteliste: 'Bekleme Listesi'
  }
};

const PLAN_FEATURES = {
  starter: {
    de: ['WhatsApp KI-Assistent (24/7)', 'Automatische Erinnerungen', 'Warteliste-Automation', 'InfinityMade Online-Terminbuchung', 'DSGVO-konform'],
    en: ['WhatsApp AI Assistant (24/7)', 'Automatic reminders', 'Waitlist automation', 'InfinityMade online booking', 'GDPR-compliant'],
    tr: ['WhatsApp KI Asistanı (7/24)', 'Otomatik hatırlatmalar', 'Bekleme listesi otomasyonu', 'InfinityMade online randevu', 'DSGVO uyumlu']
  },
  professional: {
    de: ['Alles aus Starter', 'Reaktivierungskampagne', 'Upsell-Vorschläge', 'Auslastungs-Dashboard', 'Mitarbeiter-Routing'],
    en: ['Everything in Starter', 'Reactivation campaign', 'Upsell suggestions', 'Utilization dashboard', 'Staff routing'],
    tr: ["Starter'daki her şey", 'Reaktivasyon kampanyası', 'Ek satış önerileri', 'Doluluk paneli', 'Personel yönlendirme']
  },
  klinik: {
    de: ['Alles aus Professional', 'Digitales Anamnese-Formular', 'Verpasster Anruf → Assistent', 'Medizinische Erinnerungen', 'Rezept-Workflow'],
    en: ['Everything in Professional', 'Digital intake form', 'Missed call → Assistant', 'Medical reminders', 'Prescription workflow'],
    tr: ["Professional'daki her şey", 'Dijital anamnez formu', 'Cevapsız çağrı → Asistan', 'Tıbbi hatırlatmalar', 'Reçete iş akışı']
  },
  mitarbeiter: {
    de: ['Online-Terminbuchung', 'Kalender-Synchronisation', 'Arbeitszeiten-Verwaltung', 'DSGVO-konform'],
    en: ['Online booking', 'Calendar sync', 'Working hours management', 'GDPR-compliant'],
    tr: ['Online randevu', 'Takvim senkronizasyonu', 'Çalışma saatleri yönetimi', 'DSGVO uyumlu']
  }
};

// Line SVG icons — Lucide-style, 1.6 stroke
const ICON = {
  overview:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg>',
  calendar:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  users:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  services:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  clock:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  user:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  invoice:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
  b2b:          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  mail:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  message:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  settings:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  notes:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  car:          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  doctors:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"/><path d="M9 5h6"/><rect x="3" y="8" width="18" height="14" rx="2"/><path d="M9 14h6"/><path d="M12 11v6"/></svg>',
  bill_pro:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/><circle cx="12" cy="16" r="1"/></svg>',
  demo:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4V2h-4v2"/><path d="M16 8h2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8h2"/><path d="M6 8h12"/><path d="M9 12v4"/><path d="M15 12v4"/></svg>',
  warning:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  edit:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  flag:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  checkCircle:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  whatsapp:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  clipboard:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
  link:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
};

const SECTOR_PANELS = {
  default: [
    { id: 'overview', icon: ICON.overview, key: 'nav_overview', roles: ['owner', 'employee'] },
    { id: 'calendar', icon: ICON.calendar, key: 'nav_calendar', roles: ['owner', 'employee'] },
    { id: 'kunden', icon: ICON.users, key: 'nav_kunden', roles: ['owner', 'employee'] },
    { id: 'services', icon: ICON.services, key: 'nav_services', roles: ['owner', 'employee'] },
    { id: 'hours', icon: ICON.clock, key: 'nav_hours', roles: ['owner', 'employee'] },
    { id: 'team', icon: ICON.user, key: 'nav_team', roles: ['owner', 'employee'] },
    { id: 'rechnungen', icon: ICON.invoice, key: 'nav_rechnungen', roles: ['owner', 'employee'] },
    { id: 'b2b', icon: ICON.b2b, key: 'nav_b2b', roles: ['owner', 'employee'] },
    { id: 'b2c', icon: ICON.mail, key: 'nav_b2c', roles: ['owner', 'employee'] },
    { id: 'feedback', icon: ICON.message, key: 'nav_feedback', roles: ['owner', 'employee'] },
    { id: 'settings', icon: ICON.settings, key: 'nav_settings', roles: ['owner', 'employee'] }
  ],
  physiotherapy: [
    { id: 'overview', icon: ICON.overview, key: 'nav_overview', roles: ['owner', 'employee'] },
    { id: 'calendar', icon: ICON.calendar, key: 'nav_calendar', roles: ['owner', 'employee'] },
    { id: 'kunden', icon: ICON.users, key: 'nav_kunden', roles: ['owner', 'employee'] },
    { id: 'notizen', icon: ICON.notes, key: 'nav_notizen', roles: ['owner', 'employee'] },
    { id: 'fahrtenbuch', icon: ICON.car, key: 'nav_fahrtenbuch', roles: ['owner', 'employee'] },
    { id: 'services', icon: ICON.services, key: 'nav_services', roles: ['owner', 'employee'] },
    { id: 'hours', icon: ICON.clock, key: 'nav_hours', roles: ['owner', 'employee'] },
    { id: 'team', icon: ICON.user, key: 'nav_team', roles: ['owner', 'employee'] },
    { id: 'doctors', icon: ICON.doctors, key: 'nav_doctors', roles: ['owner', 'employee'] },
    { id: 'anamnese', icon: ICON.notes, key: 'nav_anamnese', roles: ['owner', 'employee'] },
    { id: 'rechnungen', icon: ICON.invoice, key: 'nav_rechnungen', roles: ['owner', 'employee'] },
    { id: 'abrechnung', icon: ICON.bill_pro, key: 'nav_abrechnung', roles: ['owner'] },
    { id: 'belegliste', icon: ICON.clipboard, key: 'nav_belegliste', roles: ['owner'] },
    { id: 'mahnwesen', icon: ICON.invoice, key: 'nav_mahnwesen', roles: ['owner'] },
    { id: 'warteliste', icon: ICON.notes, key: 'nav_warteliste', roles: ['owner'] },
    { id: 'statistik', icon: ICON.overview, key: 'nav_statistik', roles: ['owner'] },
    { id: 'b2b', icon: ICON.b2b, key: 'nav_b2b', roles: ['owner', 'employee'] },
    { id: 'b2c', icon: ICON.mail, key: 'nav_b2c', roles: ['owner', 'employee'] },
    { id: 'beispielmodus', icon: ICON.demo, key: 'nav_beispielmodus', roles: ['owner', 'employee'] },
    { id: 'feedback', icon: ICON.message, key: 'nav_feedback', roles: ['owner', 'employee'] },
    { id: 'settings', icon: ICON.settings, key: 'nav_settings', roles: ['owner', 'employee'] }
  ],
  praxis: [
    { id: 'overview', icon: ICON.overview, key: 'nav_overview', roles: ['owner', 'employee'] },
    { id: 'calendar', icon: ICON.calendar, key: 'nav_calendar', roles: ['owner', 'employee'] },
    { id: 'kunden', icon: ICON.users, key: 'nav_kunden', roles: ['owner', 'employee'] },
    { id: 'notizen', icon: ICON.notes, key: 'nav_notizen', roles: ['owner', 'employee'] },
    { id: 'services', icon: ICON.services, key: 'nav_services', roles: ['owner', 'employee'] },
    { id: 'hours', icon: ICON.clock, key: 'nav_hours', roles: ['owner', 'employee'] },
    { id: 'team', icon: ICON.user, key: 'nav_team', roles: ['owner', 'employee'] },
    { id: 'doctors', icon: ICON.doctors, key: 'nav_doctors', roles: ['owner', 'employee'] },
    { id: 'rechnungen', icon: ICON.invoice, key: 'nav_rechnungen', roles: ['owner', 'employee'] },
    { id: 'abrechnung', icon: ICON.bill_pro, key: 'nav_abrechnung', roles: ['owner'] },
    { id: 'belegliste', icon: ICON.clipboard, key: 'nav_belegliste', roles: ['owner'] },
    { id: 'mahnwesen', icon: ICON.invoice, key: 'nav_mahnwesen', roles: ['owner'] },
    { id: 'warteliste', icon: ICON.notes, key: 'nav_warteliste', roles: ['owner'] },
    { id: 'statistik', icon: ICON.overview, key: 'nav_statistik', roles: ['owner'] },
    { id: 'b2b', icon: ICON.b2b, key: 'nav_b2b', roles: ['owner', 'employee'] },
    { id: 'b2c', icon: ICON.mail, key: 'nav_b2c', roles: ['owner', 'employee'] },
    { id: 'beispielmodus', icon: ICON.demo, key: 'nav_beispielmodus', roles: ['owner', 'employee'] },
    { id: 'settings', icon: ICON.settings, key: 'nav_settings', roles: ['owner', 'employee'] }
  ]
};

const DAYS = {
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  tr: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
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
let calendarView = 'day';
let dayViewDate = new Date();
let moveBooking = null;
let moveGhostEl = null;
const EMP_COLORS = ['#1E3D2F', '#6B5538', '#4E5C45', '#8B6B47', '#523F26'];
let ovEmpPage = 0;
let leadFilter = 'all';
let leadSearchVal = '';
let invLines = [];
let invPatientId = null;
let invPrescriptionId = null;
let invListCache = [];
let prefillNotesPatientId = null;
let prefillAnamnesePatientId = null;
let bkActionBookingCache = null;
let bkActionTimer = null;
let pdCurrentLeadId = null;


function t(key) { return (T[currentLang] || T.de)[key] || key; }
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function getOwnerId() { return currentProfile.role === 'owner' ? currentSession.user.id : currentProfile.owner_id; }

function getSector() {
  if (currentProfile.role === 'owner') return currentProfile.sector || 'default';
  const s = ownerProfile?.sector || currentProfile.sector || 'default';
  console.log('[getSector]', s, { role: currentProfile.role, owner_id: currentProfile.owner_id, ownerProfile, currentProfileSector: currentProfile.sector });
  return s;
}
function getSidebarItems() {
  const sector = getSector();
  return SECTOR_PANELS[sector] || SECTOR_PANELS.default;
}

// True when the tenant has the DTA-Pro Stripe addon (gates §302 Sammelabrechnung).
// Owner → own flag. Employee → owner's flag (fetched into ownerProfile).
function hasDtaPro() {
  if (currentProfile?.role === 'owner') return !!currentProfile.has_dta_pro;
  return !!(ownerProfile?.has_dta_pro);
}

function applyI18n() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (v) el.textContent = v; });
  const ls = document.getElementById('langSelect');
  if (ls) ls.value = currentLang;
}

// ===== RBAC permissions cache =====
let modulePermissions = null; // { dashboard: true, calendar: true, ... }

async function loadModulePermissions() {
  if (!currentBusiness?.id) { modulePermissions = null; return; }
  try {
    const { data, error } = await supabase.rpc('get_my_permissions', { p_business_id: currentBusiness.id });
    if (error) { console.warn('[permissions]', error); modulePermissions = null; return; }
    const map = {};
    (data || []).forEach(r => { map[r.module] = r.has_access; });
    modulePermissions = map;
  } catch (e) {
    console.warn('[permissions]', e);
    modulePermissions = null;
  }
}

function hasModuleAccess(module) {
  // Owner her zaman tüm modüllere erişebilir (fallback)
  if (currentProfile?.role === 'owner') return true;
  if (!modulePermissions) return true; // fallback: kapanmadan önce gösterilebilir
  return modulePermissions[module] === true;
}

// Sidebar item id'sini RBAC module key'ine eşle
const SIDEBAR_TO_MODULE = {
  overview: 'dashboard',
  calendar: 'calendar',
  customers: 'customers',
  services: 'services',
  hours: 'hours',
  team: 'team',
  notes: 'notes',
  anamnese: 'anamnese',
  prescriptions: 'prescriptions',
  abrechnung: 'abrechnung',
  fahrtenbuch: 'fahrtenbuch',
  b2b: 'b2b',
  b2c: 'b2c',
  feedback: 'feedback',
  settings: 'settings',
};

async function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  const role = currentProfile.role || 'owner';

  if (role === 'employee' && !ownerProfile && currentProfile.owner_id) {
    const { data: owner, error: ownerErr } = await supabase.from('profiles').select('sector,has_dta_pro,plan,plan_status').eq('id', currentProfile.owner_id).maybeSingle();
    if (ownerErr) console.error('[renderSidebar ownerProfile]', ownerErr);
    if (owner) {
      ownerProfile = owner;
      if (!currentProfile.sector || currentProfile.sector === 'default') {
        currentProfile.sector = owner.sector || 'default';
      }
      console.log('[renderSidebar] fetched ownerProfile late', ownerProfile);
    }
  }

  // RBAC: aktif business için modül erişimlerini yükle
  await loadModulePermissions();

  const items = getSidebarItems();
  console.log('[renderSidebar] items count=', items.length, items.map(i => i.id));
  items.forEach(item => {
    if (!item.roles.includes(role)) return;
    if (item.id === 'abrechnung' && !hasDtaPro()) return;
    // RBAC scope check (sadece employee için)
    const moduleKey = SIDEBAR_TO_MODULE[item.id];
    if (role === 'employee' && moduleKey && !hasModuleAccess(moduleKey)) return;
    const btn = document.createElement('button');
    btn.className = 'sidebar-item' + (item.id === activePanel ? ' active' : '');
    btn.dataset.panel = item.id;
    btn.innerHTML = `<span class="icon">${item.icon}</span><span>${t(item.key)}</span>`;
    btn.addEventListener('click', () => switchPanel(item.id));
    nav.appendChild(btn);
  });
}

function buildBookingUrl(profile) {
  if (!profile) return '';
  const slug = (profile.booking_slug || '').trim();
  const base = (window.location.origin || 'https://infinitymade.de');
  // If empty: use UUID
  if (!slug) return base + '/booking.html?u=' + profile.id;
  // Already a full URL (http/https)?
  if (/^https?:\/\//i.test(slug)) {
    // Force production host so localhost links don't break when sharing
    return slug.replace(/^https?:\/\/[^/]+/i, base);
  }
  // Plain slug → wrap in URL
  return base + '/booking.html?u=' + slug;
}

function showMyBookingLink() {
  const wrap = document.getElementById('myBookingLink');
  const urlEl = document.getElementById('myBookingUrl');
  const btn = document.getElementById('myBookingCopy');
  if (!wrap || !currentProfile) return;
  const link = buildBookingUrl(currentProfile);
  urlEl.textContent = link;
  btn.onclick = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(link);
    showToast(t('copied'));
  };
  wrap.style.display = 'flex';
}

async function switchPanel(id) {
  window.switchPanel = switchPanel;
  activePanel = id;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('panel-' + id);
  if (target) target.classList.add('active');
  await renderSidebar();
  closeSidebar();
  if (id === 'overview') {
    loadTodayBookings().catch(() => {});
    loadActivityFeed().catch(() => {});
  }
  if (id === 'calendar') {
    showMyBookingLink();
    document.getElementById('dayViewDateLabel').textContent = formatDateDE(dayViewDate);
    setCalendarView('day');
  }
  if (id === 'fahrtenbuch') loadFahrtenbuchPanel();
  if (id === 'kunden') loadLeads();
  if (id === 'services') loadServices();
  if (id === 'hours') loadHoursPanel();
  if (id === 'team') loadTeam();
  if (id === 'b2b') { loadB2B(); checkB2bSetup(); }
  if (id === 'b2c') { loadB2C(); checkB2cSetup(); }
  if (id === 'settings') loadSettings();
  if (id === 'doctors') loadDoctors();
  if (id === 'notizen') loadNotizen();
  if (id === 'beispielmodus') loadBeispielmodus();
  if (id === 'rechnungen') loadRechnungen();
  if (id === 'abrechnung') loadAbrechnung();
  if (id === 'belegliste') loadBelegliste();
  if (id === 'mahnwesen') loadMahnwesen();
  if (id === 'warteliste') loadWarteliste();
  if (id === 'statistik') loadStatistik();
  if (id === 'anamnese') loadAnamnese();
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
  await renderSidebar();
  await supabase.from('profiles').update({ language: currentLang }).eq('id', currentSession.user.id);
});
// Theme toggle (light/dark) — persisted in localStorage, applied pre-paint in <head>
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#14110C' : '#F8F3E8');
}
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('im-theme', next); } catch (e) {}
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
// Modal'ı dışarı tıklayarak kapatma davranışı kapatıldı (kullanıcı kararı): randevu /
// rezept oluştururken yanlışlıkla overlay'e tıklayıp tüm girdiyi kaybetme şikayeti.
// Modal'lar sadece X butonu, Abbrechen veya Escape tuşu ile kapanır.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // En son açık modal'ı bul (hidden olmayan en yüksek z-index'li)
  const open = Array.from(document.querySelectorAll('.modal-overlay')).filter(m => !m.hidden);
  if (open.length) {
    const top = open[open.length - 1];
    closeModal(top.id);
  }
});

function openModal(id) { const el = document.getElementById(id); if (el) el.hidden = false; }
function closeModal(id) { const el = document.getElementById(id); if (el) el.hidden = true; if (id === 'bkActionModal' && bkActionTimer) { clearInterval(bkActionTimer); bkActionTimer = null; } }

function showToast(msg, type = 'success') {
  const d = document.createElement('div');
  d.className = `toast ${type}`;
  d.textContent = msg;
  document.getElementById('toastContainer').appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

// Rohe Postgres-Fehler in verständliche Meldungen übersetzen (Termin speichern)
function bookingErrMsg(error) {
  const m = (error && error.message) || '';
  if (m.includes('no_overlapping_bookings') || m.toLowerCase().includes('overlap') || m.includes('exclusion constraint')) {
    return 'Dieser Zeitraum ist für diese:n Mitarbeiter:in bereits belegt. Bitte eine andere Uhrzeit wählen.';
  }
  return m || t('err_generic');
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

function statusBadge(s) {
  if (s === 'confirmed' || s === 'accepted') return 'badge-green';
  if (s === 'cancelled' || s === 'canceled' || s === 'no_show') return 'badge-red';
  if (s === 'pending') return 'badge-yellow';
  return 'badge-gray';
}

async function renderOverview() {
  document.getElementById('bizName').textContent = currentProfile.business_name || '';

  // Welcome banner
  const welcomeEl = document.getElementById('welcomeText');
  if (welcomeEl) {
    const firstName = currentProfile.first_name || currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0] || '';
    welcomeEl.innerHTML = `<span>${escapeHtml(firstName)}</span>`;
  }

  // Settings Paket & Status
  document.getElementById('setPlanValue').textContent = currentProfile.plan
    ? currentProfile.plan.charAt(0).toUpperCase() + currentProfile.plan.slice(1) : '—';
  document.getElementById('setStatusValue').textContent = currentProfile.is_active ? t('status_active') : t('status_inactive');

  ['welcome-banner', 'pastdue-banner'].forEach(id => {
    const el = document.getElementById(id); if (el) el.hidden = true;
  });
  const params = new URLSearchParams(location.search);
  const status = currentProfile.plan_status;

  if (params.get('welcome') === '1') {
    history.replaceState({}, '', location.pathname);
    document.getElementById('welcome-banner').hidden = false;
  } else if (status === 'past_due') {
    document.getElementById('pastdue-banner').hidden = false;
  }

  document.getElementById('pastdue-fix-btn')?.addEventListener('click', openStripePortal);

  await loadTodayBookings();
  loadActivityFeed().catch(() => {});
  loadPhysioRezKpis().catch(() => { });
}

let scheduleDate = new Date();

function hexToHSL(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) { r = parseInt('0x' + hex[1] + hex[1]); g = parseInt('0x' + hex[2] + hex[2]); b = parseInt('0x' + hex[3] + hex[3]); }
  else if (hex.length === 7) { r = parseInt('0x' + hex[1] + hex[2]); g = parseInt('0x' + hex[3] + hex[4]); b = parseInt('0x' + hex[5] + hex[6]); }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}
function shiftColorForTime(hex, hour) {
  if (!hex || hex === 'null') return null;
  const hsl = hexToHSL(hex);
  const factor = Math.max(0, Math.min(1, (hour - 8) / 12));
  hsl.l = Math.max(38, Math.min(68, hsl.l - factor * 18));
  hsl.s = Math.max(40, Math.min(95, hsl.s - factor * 22));
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

function findGaps(whStart, whEnd, bookings) {
  try {
    let current = (whStart || '09:00:00').substring(0, 5);
    const end = (whEnd || '18:00:00').substring(0, 5);
    if (!current || !end) return [];
    const gaps = [];
    const sorted = [...bookings].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    for (const b of sorted) {
      const bStart = new Date(b.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' });
      const durMin = b.services?.duration_minutes || 30;
      const bEndRaw = b.end_time ? new Date(b.end_time) : new Date(new Date(b.start_time).getTime() + durMin * 60000);
      const bEnd = bEndRaw.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' });
      if (bStart > current) gaps.push({ start: current, end: bStart });
      if (bEnd > current) current = bEnd;
    }
    if (current < end) gaps.push({ start: current, end });
    return gaps;
  } catch (e) { console.error('[findGaps]', e); return []; }
}

async function renderGaps() {
  try {
    const tz = 'Europe/Berlin';
    const container = document.getElementById('gapsList');
    if (!container) return;

    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE', { timeZone: tz });
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
      .eq('user_id', currentSession.user.id)
      .gte('start_time', today.toISOString()).lte('start_time', tomorrowEndIso)
      .neq('status', 'cancelled').order('start_time');
    const { data: bookings } = await q;

    const allGaps = [];
    const whToday = whMap[todayDow];
    if (whToday) {
      const todayBookings = (bookings || []).filter(b => {
        const d = new Date(b.start_time);
        return d >= today && d < new Date(today.getTime() + 86400000);
      });
      findGaps(whToday.start_time, whToday.end_time, todayBookings).forEach(g =>
        allGaps.push({ day: 'Heute', start: g.start, end: g.end })
      );
    }
    const whTom = whMap[tomorrowDow];
    if (whTom) {
      const tomBookings = (bookings || []).filter(b => {
        const d = new Date(b.start_time);
        return d >= tomorrow && d < new Date(tomorrow.getTime() + 86400000);
      });
      findGaps(whTom.start_time, whTom.end_time, tomBookings).forEach(g =>
        allGaps.push({ day: 'Morgen', start: g.start, end: g.end })
      );
    }

    const totalEl = document.getElementById('gapsTotal');
    if (allGaps.length === 0) {
      container.innerHTML = '<div class="gap-empty">Keine freien Zeiten.</div>';
      if (totalEl) totalEl.textContent = '0 min';
      return;
    }
    const totalFreeMin = allGaps.reduce((sum, g) => {
      const s = parseInt(g.start.split(':')[0]) * 60 + parseInt(g.start.split(':')[1]);
      const e = parseInt(g.end.split(':')[0]) * 60 + parseInt(g.end.split(':')[1]);
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
  } catch (e) { console.error('[renderGaps]', e); }
}

async function renderGapsForDate(date) {
  try {
    const tz = 'Europe/Berlin';
    const container = document.getElementById('gapsList');
    if (!container) return;
    if (!date) date = scheduleDate;

    const dateStr = date.toLocaleDateString('sv-SE', { timeZone: tz });
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayDow = dayStart.getDay();

    const labelEl = document.getElementById('gapsDateLabel');
    if (labelEl) {
      const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
      const isToday = dateStr === todayStr;
      const fmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }).format(dayStart);
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
      .eq('user_id', currentSession.user.id)
      .gte('start_time', dayStart.toISOString()).lte('start_time', dayEndIso)
      .neq('status', 'cancelled').order('start_time');
    const { data: bookings } = await q;

    const totalEl = document.getElementById('gapsTotal');
    const wh = whMap[dayDow];
    if (!wh) {
      container.innerHTML = '<div class="gap-empty">Keine Arbeitszeiten für diesen Tag.</div>';
      if (totalEl) totalEl.textContent = '0 min';
      return;
    }

    const dayBookings = (bookings || []).filter(b => {
      const d = new Date(b.start_time);
      return d >= dayStart && d < new Date(dayStart.getTime() + 86400000);
    });
    const allGaps = findGaps(wh.start_time, wh.end_time, dayBookings).map(g => ({ day: 'Heute', start: g.start, end: g.end }));

    if (allGaps.length === 0) {
      container.innerHTML = '<div class="gap-empty">Keine freien Zeiten.</div>';
      if (totalEl) totalEl.textContent = '0 min';
      return;
    }
    const totalFreeMin = allGaps.reduce((sum, g) => {
      const s = parseInt(g.start.split(':')[0]) * 60 + parseInt(g.start.split(':')[1]);
      const e = parseInt(g.end.split(':')[0]) * 60 + parseInt(g.end.split(':')[1]);
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
  } catch (e) { console.error('[renderGapsForDate]', e); }
}

async function loadScheduleBookings(date) {
  scheduleDate = date;
  const loadingEl = document.getElementById('upcoming-bookings-loading');
  const emptyEl = document.getElementById('upcoming-bookings-empty');
  const gridEl = document.getElementById('upcoming-bookings-list');
  const labelEl = document.getElementById('scheduleDateLabel');
  loadingEl.hidden = false; emptyEl.hidden = true; gridEl.hidden = true;

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const fmtDate = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  labelEl.textContent = isToday ? 'Heutige Termine' : fmtDate;

  const tz = 'Europe/Berlin';
  const dStr = date.toLocaleDateString('sv-SE', { timeZone: tz });
  const dStart = new Date(dStr + 'T00:00:00').toISOString();
  const dEnd = new Date(dStr + 'T23:59:59').toISOString();
  const ownerId = getOwnerId();

  const { data: bookings } = await supabase.from('bookings')
    .select('id,user_id,service_id,start_time,end_time,customer_name,customer_phone,status,hausbesuch,notes,owner_id,fahrt_status,vehicle_id,start_km,end_km,fahrt_started_at,fahrt_arrived_at,fahrt_ended_at,is_group,group_capacity,group_parent_id,lead_id,services(title,color,code),prescription_sessions(session_number,prescriptions(heilmittel,heilmittel_position,diagnosegruppe,anzahl_einheiten,is_dringend,is_blanko,is_lhb_bvb,abrechnung_status))')
    .eq('owner_id', ownerId)
    .gte('start_time', dStart).lte('start_time', dEnd)
    .neq('status', 'cancelled');

  loadingEl.hidden = true;

  const nowIso = new Date().toISOString();
  let displayBookings = bookings || [];
  if (isToday) {
    displayBookings = displayBookings.filter(b => b.start_time >= nowIso);
  }
  if (isToday) {
    const myBookings = displayBookings.filter(b => b.user_id === currentSession.user.id);
    document.getElementById('kpi-today').textContent = myBookings.length;
  }

  if (displayBookings.length === 0) { emptyEl.hidden = false; return; }

  const timeCol = document.getElementById('ovTimeCol');
  const colsWrap = document.getElementById('ovColsWrap');
  timeCol.innerHTML = '';
  colsWrap.innerHTML = '';

  const SLOT_H = 48;
  let DAY_START = 8;
  if (isToday) {
    const now = new Date();
    DAY_START = Math.max(8, now.getHours());
  }
  for (let h = DAY_START; h < 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slot = document.createElement('div');
      slot.className = 'dv-slot';
      const label = document.createElement('div');
      label.className = 'dv-time-label';
      label.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slot.appendChild(label);
      timeCol.appendChild(slot);
    }
  }

  let allEmps = teamMembers.length ? teamMembers : [currentProfile];
  if (!allEmps.length) allEmps = [currentProfile];

  const currentId = currentSession.user.id;
  allEmps = [...allEmps].sort((a, b) => {
    if (a.id === currentId) return -1;
    if (b.id === currentId) return 1;
    return 0;
  });

  const isMobile = window.innerWidth < 768;
  const colsPerPage = isMobile ? 1 : 3;
  const totalPages = Math.ceil(allEmps.length / colsPerPage);
  ovEmpPage = Math.min(ovEmpPage, Math.max(0, totalPages - 1));
  const start = ovEmpPage * colsPerPage;
  const emps = allEmps.slice(start, start + colsPerPage);

  const navEl = document.getElementById('ovNav');
  const prevBtn = document.getElementById('ovPrevEmp');
  const nextBtn = document.getElementById('ovNextEmp');
  const ovLabelEl = document.getElementById('ovNavLabel');
  if (allEmps.length > colsPerPage) {
    navEl.hidden = false;
    prevBtn.disabled = ovEmpPage === 0;
    nextBtn.disabled = ovEmpPage >= totalPages - 1;
    const end = Math.min(start + colsPerPage, allEmps.length);
    ovLabelEl.textContent = `${start + 1}–${end} / ${allEmps.length}`;
  } else {
    navEl.hidden = true;
  }

  emps.forEach((emp, idx) => {
    const col = document.createElement('div');
    col.className = 'dv-col' + (emp.id === currentId ? ' dv-col-highlight' : '');
    const color = EMP_COLORS[idx % EMP_COLORS.length];

    const header = document.createElement('div');
    header.className = 'dv-col-header';
    header.textContent = emp.business_name || emp.email?.split('@')[0] || '—';
    col.appendChild(header);

    const slotWrap = document.createElement('div');
    slotWrap.className = 'dv-col-slots';

    for (let h = DAY_START; h < 20; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slot = document.createElement('div');
        slot.className = 'dv-slot';
        slotWrap.appendChild(slot);
      }
    }

    const empBookings = displayBookings.filter(b => b.user_id === emp.id);
    const parentBookings = empBookings.filter(b => !b.group_parent_id);
    parentBookings.forEach(b => {
      const childBookings = empBookings.filter(cb => cb.group_parent_id === b.id);
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();
      const dayStartMin = DAY_START * 60;
      const topPx = ((sMin - dayStartMin) / 30) * SLOT_H;
      const hPx = ((eMin - sMin) / 30) * SLOT_H;

      const block = document.createElement('div');
      block.className = 'dv-booking-block';
      block.style.top = topPx + 'px';
      block.style.height = Math.max(hPx, 24) + 'px';
      block.style.background = color + '25';
      block.style.borderColor = color;
      block.style.color = 'var(--text-main)';

      const durationMin = eMin - sMin;
      if (durationMin <= 20) {
        block.classList.add('dv-booking-block--compact');
      }

      // Add descriptive hover tooltip
      const startStr = s.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const endStr = e.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const timeStr = `${startStr} - ${endStr}`;
      const sess = (b.prescription_sessions && b.prescription_sessions[0]) || null;
      const rx   = sess?.prescriptions || null;
      const heilmittel = rx?.heilmittel || b.services?.code || '';
      const dg = rx?.diagnosegruppe || '';
      const subtitle = [heilmittel, dg].filter(Boolean).join(' · ');
      block.title = `${b.customer_name || b.services?.title || 'Termin'}\nZeit: ${timeStr}${subtitle ? '\nInfo: ' + subtitle : ''}`;

      block.innerHTML = renderBookingSlotInner(b, childBookings);
      block.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openBookingActionModal(b);
      });
      slotWrap.appendChild(block);
    });

    col.appendChild(slotWrap);
    colsWrap.appendChild(col);
  });

  gridEl.hidden = false;
}

async function loadTodayBookings() { return loadScheduleBookings(new Date()); }

// Nach einer Terminänderung alle relevanten Ansichten auffrischen.
// Übersicht (heute) + Aktivität werden IMMER neu geladen — egal welches Panel
// gerade aktiv ist — damit ein neuer Termin sofort in der Übersicht erscheint,
// ohne dass die Seite neu geladen werden muss.
async function refreshBookingViews() {
  if (calendar) { try { await calendar.reloadMonth(); calendar.refresh(); } catch (e) {} }
  // Übersicht-Tagesplan auffrischen (den aktuell gezeigten Tag beibehalten)
  try { await loadScheduleBookings(scheduleDate instanceof Date ? scheduleDate : new Date()); } catch (e) {}
  loadActivityFeed().catch(() => {});
  if (activePanel === 'calendar' && calendarView === 'day') {
    try { await renderDayView(toISODate(dayViewDate)); } catch (e) {}
  }
}

function formatActivityTimestamp(iso) {
  try {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    if (itemDate.getTime() === today.getTime()) {
      return `Heute ${timeStr} Uhr`;
    } else if (itemDate.getTime() === yesterday.getTime()) {
      return `Gestern ${timeStr} Uhr`;
    } else {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year} ${timeStr} Uhr`;
    }
  } catch (e) {
    console.error('[formatActivityTimestamp]', e);
    return '';
  }
}

async function loadActivityFeed() {
  const container = document.getElementById('activityFeedList');
  if (!container) return;
  
  try {
    const ownerId = getOwnerId();
    
    const [notesRes, invoicesRes, fahrtenRes, bookingsRes, leadsRes] = await Promise.all([
      bizScope(supabase.from('patient_notes')
        .select('id, created_at, lead_id, leads:lead_id(first_name,last_name)')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(10), 'activities'),
      bizScope(supabase.from('invoices')
        .select('id, created_at, invoice_number, total_patient, patient_name, status')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(10), 'activities'),
      bizScope(supabase.from('fahrten')
        .select('id, created_at, distance_km, lead_id, leads:lead_id(first_name,last_name)')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(10), 'activities'),
      bizScope(supabase.from('bookings')
        .select('id, created_at, customer_name')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(10), 'activities'),
      bizScope(supabase.from('leads')
        .select('id, created_at, first_name, last_name')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(10), 'activities')
    ]);

    const activities = [];

    if (notesRes.data) {
      notesRes.data.forEach(item => {
        const lead = item.leads;
        const name = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : '';
        if (name) {
          activities.push({
            type: 'note',
            ts: item.created_at,
            name: name
          });
        }
      });
    }

    if (invoicesRes.data) {
      invoicesRes.data.forEach(item => {
        if (item.status === 'paid' || item.status === 'bezahlt') {
          const name = item.patient_name || '';
          activities.push({
            type: 'invoice',
            ts: item.created_at,
            invoice_number: item.invoice_number || '',
            total_patient: item.total_patient || 0,
            name: name
          });
        }
      });
    }

    if (fahrtenRes.data) {
      fahrtenRes.data.forEach(item => {
        activities.push({
          type: 'fahrt',
          ts: item.created_at,
          distance_km: item.distance_km != null ? item.distance_km : 0
        });
      });
    }

    if (bookingsRes.data) {
      bookingsRes.data.forEach(item => {
        const name = item.customer_name || '';
        if (name) {
          activities.push({
            type: 'booking',
            ts: item.created_at,
            name: name
          });
        }
      });
    }

    if (leadsRes.data) {
      leadsRes.data.forEach(item => {
        if (item.first_name && item.first_name.trim()) {
          const name = `${item.first_name} ${item.last_name || ''}`.trim();
          activities.push({
            type: 'lead',
            ts: item.created_at,
            name: name
          });
        }
      });
    }

    activities.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    const topActivities = activities.slice(0, 7);

    if (topActivities.length === 0) {
      container.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 4px 0;">Noch keine Aktivität.</div>`;
      return;
    }

    container.innerHTML = topActivities.map(item => {
      let icon = '';
      let text = '';
      if (item.type === 'note') {
        icon = '📝';
        text = `Notiz hinzugefügt für <strong>${escapeHtml(item.name)}</strong>.`;
      } else if (item.type === 'invoice') {
        icon = '💶';
        const formattedAmount = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.total_patient) + ' €';
        text = `Rechnung <strong>${escapeHtml(item.invoice_number)}</strong> (${escapeHtml(formattedAmount)}) für ${escapeHtml(item.name)} bezahlt.`;
      } else if (item.type === 'fahrt') {
        icon = '🚗';
        text = `Fahrt gebucht (${escapeHtml(item.distance_km)} km).`;
      } else if (item.type === 'lead') {
        icon = '👤';
        text = `${escapeHtml(item.name)} neu als Patient:in registriert.`;
      } else if (item.type === 'booking') {
        icon = '📅';
        text = `Neuer Termin von <strong>${escapeHtml(item.name)}</strong> gebucht.`;
      }
      
      return `
        <div style="display: flex; gap: 10px; font-size: 12px; color: var(--text-main); text-align: left;">
          <span style="font-size: 14px; flex-shrink: 0; line-height: 1.4;">${icon}</span>
          <div style="flex-grow: 1;">
            <div style="line-height: 1.4; color: var(--text-main);">${text}</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(formatActivityTimestamp(item.ts))}</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('[loadActivityFeed] error', error);
    container.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 4px 0;">Aktivität konnte nicht geladen werden.</div>`;
  }
}

// Render the inner HTML for a calendar booking block. Physio-friendly:
//   line 1 — "Nachname, Vorname"
//   line 2 — Heilmittel · DG     (n/total)
//   icons  — Hausbesuch, Dringend, Blanko, Notiz
function renderBookingSlotInner(b, childBookings = []) {
  // Right-aligned icon strip (clickable parent already wired)
  const sess = (b.prescription_sessions && b.prescription_sessions[0]) || null;
  const rx   = sess?.prescriptions || null;
  const icons = [
    b.hausbesuch    ? `<span title="Hausbesuch" style="width:13px;height:13px;display:inline-flex;">${ICON.car}</span>` : '',
    rx?.is_dringend ? `<span title="Dringend" style="color:#fbbf24;width:13px;height:13px;display:inline-flex;">${ICON.warning}</span>` : '',
    rx?.is_blanko   ? '<span title="Blankoverordnung" style="font-size:9px;border:1px solid currentColor;padding:0 3px;border-radius:3px;">BL</span>' : '',
    rx?.is_lhb_bvb  ? '<span title="LHB/BVB" style="font-size:9px;border:1px solid currentColor;padding:0 3px;border-radius:3px;">LHB</span>' : '',
    b.notes         ? `<span title="Notiz" style="opacity:0.85;width:13px;height:13px;display:inline-flex;">${ICON.info}</span>` : '',
  ].filter(Boolean).join(' ');

  if (b.is_group) {
    const count = childBookings.length;
    const capacity = b.group_capacity || 5;
    
    // Glassmorphic styling based on fill status
    let badgeColor = 'hsla(var(--primary-h), var(--primary-s), var(--primary-l), 0.12)';
    let textColor = 'hsla(var(--primary-h), var(--primary-s), var(--primary-l), 1)';
    let borderColor = 'hsla(var(--primary-h), var(--primary-s), var(--primary-l), 0.22)';
    
    if (count >= capacity) {
      badgeColor = 'rgba(34, 197, 94, 0.1)';
      textColor = 'rgb(34, 197,  green-color)';
      textColor = '#22c55e';
      borderColor = 'rgba(34, 197, 94, 0.25)';
    } else if (count === 0) {
      badgeColor = 'rgba(156, 163, 175, 0.1)';
      textColor = 'var(--text-muted)';
      borderColor = 'rgba(156, 163, 175, 0.2)';
    }
    
    const badge = `
      <span class="group-capacity-badge" style="background: ${badgeColor}; color: ${textColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 1px 5px; font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; gap: 3px; backdrop-filter: blur(4px);">
        👥 ${count}/${capacity}
      </span>
    `;
    
    const partNames = childBookings.map(cb => {
      const name = cb.customer_name || 'Teilnehmer';
      return name.split(',')[0].trim();
    }).join(', ');
    
    const subtitle = partNames ? escapeHtml(partNames) : '<span style="opacity: 0.6; font-style: italic;">Freier Gruppenslot</span>';
    
    return `
      <div class="dv-booking-name" style="font-weight:700;font-size:12px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:6px;">
        <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(b.services?.title || 'Gruppe')}</span>
        ${badge}
      </div>
      <div class="dv-booking-subtitle" style="font-size:11px;line-height:1.2;opacity:0.9;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${subtitle}
      </div>
      ${icons ? `<div class="bk-icon-strip" style="position:absolute;top:2px;right:4px;display:flex;gap:3px;font-size:11px;line-height:1;pointer-events:none;">${icons}</div>` : ''}
    `;
  }

  // "Vorname Nachname" → "Nachname, Vorname" (best-effort). Single token or
  // already comma-formatted strings pass through.
  const raw = (b.customer_name || (b.services?.title) || 'Termin').trim();
  let displayName = raw;
  if (raw.includes(',')) {
    displayName = raw;
  } else {
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) {
      const ln = parts[parts.length - 1];
      const vn = parts.slice(0, -1).join(' ');
      displayName = ln + ', ' + vn;
    }
  }

  const heilmittel = rx?.heilmittel || b.services?.code || '';
  const dg = rx?.diagnosegruppe || '';
  const counter = (sess?.session_number && rx?.anzahl_einheiten)
    ? `(${sess.session_number}/${rx.anzahl_einheiten})`
    : '';
  const isReadyBadge = rx?.abrechnung_status === 'bereit' ? '<span title="Abrechnungsbereit" style="color:#15803d;">●</span>' : '';

  const subtitle = [
    heilmittel ? escapeHtml(heilmittel) : '',
    dg ? `<span style="opacity:0.75;">${escapeHtml(dg)}</span>` : '',
  ].filter(Boolean).join(' · ');

  return `
    <div class="dv-booking-name" style="font-weight:600;font-size:12px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${b.status === 'no_show' ? 'text-decoration:line-through;opacity:0.6;' : ''}">
      ${escapeHtml(displayName)}
      ${isReadyBadge}
    </div>
    ${subtitle || counter
      ? `<div class="dv-booking-subtitle" style="display:flex;justify-content:space-between;gap:6px;font-size:11px;line-height:1.2;opacity:0.9;margin-top:2px;">
           <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${subtitle}</span>
           ${counter ? `<span style="font-variant-numeric:tabular-nums;flex-shrink:0;">${counter}</span>` : ''}
         </div>`
      : ''}
    ${icons ? `<div class="bk-icon-strip" style="position:absolute;top:2px;right:4px;display:flex;gap:3px;font-size:11px;line-height:1;pointer-events:none;">${icons}</div>` : ''}
  `;
}

let _rezKpiCache = null;

async function loadPhysioRezKpis() {
  const block = document.getElementById('physioRezKpi');
  if (!block) return;
  if (getSector() !== 'physiotherapy') { block.style.display = 'none'; return; }

  const ownerId = getOwnerId();
  const { data, error } = await bizScope(supabase
    .from('prescriptions')
    .select('id, status, gueltig_bis, patient_id, heilmittel')
    .eq('owner_id', ownerId)
    .not('status', 'in', '(completed,billed,cancelled)'), 'patients');
  if (error) { console.warn('[rez-kpi]', error); block.style.display = 'none'; return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soonCutoff = new Date(today); soonCutoff.setDate(today.getDate() + 7);

  const overdue = [], soon = [], active = [];
  for (const rx of (data || [])) {
    const gb = rx.gueltig_bis ? new Date(rx.gueltig_bis) : null;
    if (gb && gb < today) overdue.push(rx);
    else if (gb && gb <= soonCutoff) soon.push(rx);
    if (rx.status === 'in_therapy') active.push(rx);
  }
  _rezKpiCache = { overdue, soon, active };

  document.getElementById('rezKpiOverdue').textContent = overdue.length;
  document.getElementById('rezKpiSoon').textContent = soon.length;
  document.getElementById('rezKpiActive').textContent = active.length;
  block.style.display = '';
}

(function bindRezKpiClicks() {
  document.addEventListener('click', async (ev) => {
    const tile = ev.target.closest('.rez-kpi-tile');
    if (!tile || !_rezKpiCache) return;
    const cat = tile.dataset.filter;
    const list = _rezKpiCache[cat] || [];
    if (!list.length) { showToast('Keine Rezepte in dieser Kategorie.', 'info'); return; }
    // Open the first patient with such a prescription; user can flip patients from there
    const firstRx = list[0];
    if (!firstRx?.patient_id) return;
    const { data: lead } = await supabase.from('leads')
      .select('*').eq('id', firstRx.patient_id).maybeSingle();
    if (lead && typeof openPatientDetailModal === 'function') {
      openPatientDetailModal(lead);
      setTimeout(() => {
        const rezTab = document.querySelector('.pd-tab[data-tab="rezepte"]');
        if (rezTab) rezTab.click();
      }, 200);
    }
  });
})();

async function openStripePortal() {
  if (!currentProfile.stripe_subscription_id) { window.location.href = '/onboarding.html?step=plan'; return; }
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch('/api/stripe/portal-session', { method: 'POST', headers: { 'Authorization': 'Bearer ' + s.access_token, 'Content-Type': 'application/json' } });
    const { url } = await res.json();
    if (url) window.location.href = url;
  } catch { showToast(t('err_generic'), 'error'); }
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
    let slots = data.slots || [];
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localIso = new Date(today.getTime() - offset * 60000).toISOString().substring(0, 16);
    slots = slots.filter(slot => `${dateStr}T${slot}` >= localIso);
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

async function prefillBookingModalFromSlot(dateStr, timeStr, empId, serviceId, serviceTitle) {
  const startIso = `${dateStr}T${timeStr}:00`;
  document.getElementById('bk-id').value = '';
  document.getElementById('bookingModalTitle').textContent = t('lbl_manual_title');
  document.getElementById('bkWlMatchBtn').hidden = true;
  document.getElementById('bkDeleteBtn').hidden = true;
  document.getElementById('bkStart').value = startIso.substring(0, 16);
  document.getElementById('bkCustomer').value = '';
  document.getElementById('bkCustomerId').value = '';
  document.getElementById('bkPhone').value = '';
  document.getElementById('bkNotes').value = '';
  document.getElementById('bkSeriesToggle').checked = false;
  document.getElementById('bkSeriesFields').hidden = true;
  populateEmpSelects(empId);
  await populateSrvSelect(serviceId);
  openModal('bookingModal');
  await initBkCustomerAutocomplete();
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

  const { data: srvData } = await bizScope(supabase.from('services')
    .select('*,employee_services(employee_id)')
    .or(`owner_id.eq.${ownerId},user_id.eq.${ownerId}`), 'services');
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
        const isPhysio = getSector() === 'physiotherapy';
        const durKeys = isPhysio && s.price_config?.durations
          ? Object.keys(s.price_config.durations).filter(k => s.price_config.durations[k].active)
          : [];

        if (durKeys.length > 0) {
          // Multi-duration physio service: show duration selection first
          items.push({
            label: s.title,
            meta: 'Sitzungsdauer wählen',
            color: s.color || '#22c55e',
            onClick: () => {
              calendar.setSideHead('Sitzungsdauer');
              const durItems = durKeys.map(k => ({
                label: `${k} min`,
                meta: s.price_config.durations[k].price ? `${s.price_config.durations[k].price} €` : 'Preis nicht festgelegt',
                onClick: () => loadSlots(dateStr, parseInt(k), s.id, s.title)
              }));
              calendar.renderSide(durItems);
            }
          });
        } else {
          items.push({
            label: s.title,
            meta: `${s.duration_minutes || 30} min`,
            color: s.color || '#22c55e',
            onClick: () => loadSlots(dateStr, s.duration_minutes || 30, s.id, s.title)
          });
        }
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

function toISODate(d) { return d.toISOString().split('T')[0]; }

function formatDateDE(d) {
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  return d.toLocaleDateString('de-DE', opts);
}

function setCalendarView(view) {
  calendarView = view;
  document.getElementById('monthViewWrap').style.display = view === 'month' ? '' : 'none';
  document.getElementById('dayViewGrid').style.display = view === 'day' ? 'flex' : 'none';
  document.querySelectorAll('.cal-view-toggle .cal-view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  if (view === 'day') renderDayView(toISODate(dayViewDate));
}

async function renderDayView(dateStr) {
  document.getElementById('dayViewDateLabel').textContent = formatDateDE(new Date(dateStr + 'T12:00:00'));
  const timeCol = document.getElementById('dvTimeCol');
  const colsWrap = document.getElementById('dvColsWrap');
  timeCol.innerHTML = '';
  colsWrap.innerHTML = '';

  const emps = teamMembers;
  if (!emps.length) return;

  // Heute: vergangene Stunden ausblenden + Live-"Jetzt"-Linie
  const _now = new Date();
  const isToday = dateStr === toISODate(_now);
  const nowMin = _now.getHours() * 60 + _now.getMinutes();

  for (let h = 8; h < 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slot = document.createElement('div');
      slot.className = 'dv-slot';
      if (isToday && (h * 60 + m + 30) <= nowMin) slot.classList.add('dv-slot--past');
      const label = document.createElement('div');
      label.className = 'dv-time-label';
      label.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slot.appendChild(label);
      timeCol.appendChild(slot);
    }
  }

  const ownerId = getOwnerId();
  const dStart = new Date(dateStr + 'T00:00:00').toISOString();
  const dEnd = new Date(dateStr + 'T23:59:59').toISOString();

  const { data: bookings } = await supabase.from('bookings')
    .select('id,user_id,service_id,start_time,end_time,customer_name,customer_phone,status,hausbesuch,notes,owner_id,fahrt_status,vehicle_id,start_km,end_km,fahrt_started_at,fahrt_arrived_at,fahrt_ended_at,is_group,group_capacity,group_parent_id,lead_id,services(title,code),prescription_sessions(session_number,prescriptions(heilmittel,heilmittel_position,diagnosegruppe,anzahl_einheiten,is_dringend,is_blanko,is_lhb_bvb,abrechnung_status))')
    .eq('owner_id', ownerId)
    .gte('start_time', dStart).lte('start_time', dEnd)
    .neq('status', 'cancelled');

  const empIds = emps.map(e => e.id);
  const { data: timeOffs } = await supabase.from('time_offs')
    .select('employee_id,start_date,end_date,reason')
    .in('employee_id', empIds)
    .lte('start_date', dEnd)
    .gte('end_date', dStart);

  emps.forEach((emp, idx) => {
    const col = document.createElement('div');
    col.className = 'dv-col';
    const color = EMP_COLORS[idx % EMP_COLORS.length];

    const header = document.createElement('div');
    header.className = 'dv-col-header';
    header.textContent = emp.business_name || emp.email?.split('@')[0] || '—';
    col.appendChild(header);

    const slotWrap = document.createElement('div');
    slotWrap.className = 'dv-col-slots';

    for (let h = 8; h < 20; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slot = document.createElement('div');
        slot.className = 'dv-slot';
        if (isToday && (h * 60 + m + 30) <= nowMin) slot.classList.add('dv-slot--past');
        const timeStr = `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        slot.dataset.time = timeStr;
        slot.dataset.empId = emp.id;
        slot.addEventListener('click', async () => {
          if (moveBooking) {
            placeGhost(slot, emp.id, moveBooking.customer_name || (moveBooking.services?.title) || 'Termin');
            return;
          }
          await prefillBookingModal(timeStr);
          const bkEmp = document.getElementById('bkEmployee');
          if (bkEmp) bkEmp.value = emp.id;
        });
        slotWrap.appendChild(slot);
      }
    }

    // Live "Jetzt"-Linie (nur heute, innerhalb der Tagesansicht 08–20)
    if (isToday && nowMin >= 8 * 60 && nowMin < 20 * 60) {
      const nowLine = document.createElement('div');
      nowLine.className = 'dv-now-line';
      nowLine.style.top = (((nowMin - 8 * 60) / 30) * 56) + 'px';
      slotWrap.appendChild(nowLine);
    }

    const empBookings = (bookings || []).filter(b => b.user_id === emp.id);
    const parentBookings = empBookings.filter(b => !b.group_parent_id);
    parentBookings.forEach(b => {
      const childBookings = empBookings.filter(cb => cb.group_parent_id === b.id);
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();
      const dayStartMin = 8 * 60;
      const topPx = ((sMin - dayStartMin) / 30) * 56;
      const hPx = ((eMin - sMin) / 30) * 56;

      const block = document.createElement('div');
      block.className = 'dv-booking-block';
      if (moveBooking && moveBooking.id === b.id) block.classList.add('dv-move-source');
      block.style.top = topPx + 'px';
      block.style.height = Math.max(hPx, 28) + 'px';
      block.style.background = color + '25';
      block.style.borderColor = color;
      block.style.color = 'var(--text-main)';

      const durationMin = eMin - sMin;
      if (durationMin <= 20) {
        block.classList.add('dv-booking-block--compact');
      }

      // Add descriptive hover tooltip
      const startStr = s.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const endStr = e.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const timeStr = `${startStr} - ${endStr}`;
      const sess = (b.prescription_sessions && b.prescription_sessions[0]) || null;
      const rx   = sess?.prescriptions || null;
      const heilmittel = rx?.heilmittel || b.services?.code || '';
      const dg = rx?.diagnosegruppe || '';
      const subtitle = [heilmittel, dg].filter(Boolean).join(' · ');
      block.title = `${b.customer_name || b.services?.title || 'Termin'}\nZeit: ${timeStr}${subtitle ? '\nInfo: ' + subtitle : ''}`;

      block.innerHTML = renderBookingSlotInner(b, childBookings);
      if (isToday && e < _now) block.classList.add('dv-booking-block--past');
      block.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openBookingModal(b);
      });
      slotWrap.appendChild(block);
    });

    const empOffs = (timeOffs || []).filter(t => t.employee_id === emp.id);
    if (empOffs.length) {
      const bar = document.createElement('div');
      bar.className = 'dv-absent';
      bar.textContent = 'Abwesend';
      slotWrap.appendChild(bar);
    }

    col.appendChild(slotWrap);
    colsWrap.appendChild(col);
  });
}

document.getElementById('dayViewPrev').addEventListener('click', () => {
  dayViewDate.setDate(dayViewDate.getDate() - 1);
  if (calendarView === 'day') renderDayView(toISODate(dayViewDate));
  else document.getElementById('dayViewDateLabel').textContent = formatDateDE(dayViewDate);
});
document.getElementById('dayViewNext').addEventListener('click', () => {
  dayViewDate.setDate(dayViewDate.getDate() + 1);
  if (calendarView === 'day') renderDayView(toISODate(dayViewDate));
  else document.getElementById('dayViewDateLabel').textContent = formatDateDE(dayViewDate);
});

// Tagesansicht "lebt": jede Minute die Jetzt-Linie verschieben & vergangene Stunden ausblenden
setInterval(() => {
  if (activePanel === 'calendar' && calendarView === 'day' && toISODate(dayViewDate) === toISODate(new Date())) {
    renderDayView(toISODate(dayViewDate));
  }
}, 60000);

async function prefillBookingModal(startStr) {
  document.getElementById('bk-id').value = '';
  document.getElementById('bookingModalTitle').textContent = t('lbl_manual_title');
  document.getElementById('bkWlMatchBtn').hidden = true;
  document.getElementById('bkDeleteBtn').hidden = true;
  document.getElementById('bkMoveBtn').hidden = true;
  const bkStartEl = document.getElementById('bkStart');
  bkStartEl.value = startStr ? startStr.substring(0, 16) : '';
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localIso = new Date(now.getTime() - offset * 60000).toISOString().substring(0, 16);
  bkStartEl.min = localIso;
  document.getElementById('bkCustomer').value = '';
  document.getElementById('bkCustomerId').value = '';
  document.getElementById('bkPhone').value = '';
  document.getElementById('bkNotes').value = '';
  document.getElementById('bkHausbesuch').checked = false;
  document.getElementById('bkSeriesToggle').checked = false;
  document.getElementById('bkSeriesFields').hidden = true;
  document.getElementById('bkSpecialBanner').hidden = true;
  document.getElementById('bkDocAssignHint').hidden = true;
  
  // Group Appointments Reset
  const isGrpCheckbox = document.getElementById('bkIsGroup');
  if (isGrpCheckbox) isGrpCheckbox.checked = false;
  window.bkSelectedGroupPatients = [];
  window.bkCurrentGroupParticipants = [];
  refreshBkGroupPanel();
  
  if (typeof refreshBkHausbesuchPanel === 'function') refreshBkHausbesuchPanel();
  populateEmpSelects();
  await populateSrvSelect();
  openModal('bookingModal');
  await initBkCustomerAutocomplete();
  await initBkGroupPatientAutocomplete().catch(() => {});
}

function computeSeriesPreview() {
  const startV = document.getElementById('bkStart').value;
  const count = parseInt(document.getElementById('bkSeriesCount').value) || 0;
  const rec = document.getElementById('bkSeriesRecurrence').value;
  if (!startV || count < 1) return [];
  const dateStr = startV.substring(0, 10);
  const step = rec === 'daily' ? 1 : (rec === 'biweekly' ? 14 : 7);
  const checked = Array.from(document.querySelectorAll('#bkSeriesWeekdays input:checked')).map(cb => parseInt(cb.value));
  const wdSet = new Set(checked.length ? checked : [new Date(dateStr + 'T12:00:00Z').getDay()]);
  const result = [];
  function addDays(ds, days) {
    const d = new Date(ds + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().substring(0, 10);
  }
  function dayOfWeek(ds) {
    const probe = new Date(ds + 'T12:00:00Z');
    return new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(probe);
  }
  const wdMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };

  const first = new Date(dateStr + 'T12:00:00Z');
  let current = addDays(dateStr, -first.getUTCDay());

  while (result.length < count) {
    Array.from(wdSet).sort().forEach(dayNum => {
      if (result.length >= count) return;
      const candidate = addDays(current, dayNum);
      if (wdMap[dayOfWeek(candidate)] === dayNum) result.push(candidate);
    });
    current = addDays(current, step);
  }
  return result;
}

function updateBkSeriesPreview() {
  const dates = computeSeriesPreview();
  const el = document.getElementById('bkSeriesPreview');
  if (!el) return;
  if (dates.length === 0) { el.textContent = ''; return; }
  const fmt = dates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
  const show = fmt.slice(0, 5).join(' · ');
  el.textContent = dates.length > 5 ? `${show} · … (${dates.length} Termine)` : `${show} (${dates.length} Termine)`;
}

async function calculateSessionInfo(patientName, patientPhone, currentBookingId, ownerId) {
  if (!patientName) return null;
  let query = supabase.from('bookings')
    .select('id,start_time')
    .eq('owner_id', ownerId)
    .eq('customer_name', patientName)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true });
  if (patientPhone) { query = query.eq('customer_phone', patientPhone); }
  const { data: bookings } = await query;
  if (!bookings || bookings.length === 0) return null;
  const idx = bookings.findIndex(b => b.id === currentBookingId);
  if (idx === -1) return null;
  return { current: idx + 1, total: bookings.length };
}

function updateNoShowButton(startTime) {
  const btn = document.getElementById('bkActionNoShowBtn');
  const hint = document.getElementById('bkActionNoShowHint');
  if (!btn || !hint) return;
  const start = new Date(startTime);
  const now = new Date();
  const diffMin = (now - start) / 60000;
  if (diffMin >= 3) {
    btn.disabled = false;
    hint.hidden = true;
  } else {
    btn.disabled = true;
    hint.hidden = false;
    const remaining = Math.ceil(3 - diffMin);
    hint.textContent = `Verfügbar in ${remaining} Min.`;
  }
}

async function openBookingActionModal(booking) {
  bkActionBookingCache = booking;
  if (bkActionTimer) { clearInterval(bkActionTimer); bkActionTimer = null; }

  const patientName = booking.customer_name || (booking.services?.title) || 'Termin';
  const patientPhone = booking.customer_phone || '';
  document.getElementById('bkActionPatient').textContent = patientName;

  const ownerId = getOwnerId();
  const sessionInfo = await calculateSessionInfo(patientName, patientPhone, booking.id, ownerId);
  if (sessionInfo) {
    document.getElementById('bkActionSession').textContent = `Seans ${sessionInfo.current} / ${sessionInfo.total}`;
  } else {
    document.getElementById('bkActionSession').textContent = '';
  }

  const isOwn = booking.user_id === currentSession.user.id;
  document.getElementById('bkActionNoShowBtn').hidden = !isOwn;
  document.getElementById('bkActionNoShowHint').hidden = !isOwn;

  // Fahrtenbuch: Hausbesuch state machine UI
  await renderBkActionFahrtState(booking, isOwn);

  if (isOwn) {
    updateNoShowButton(booking.start_time);
    bkActionTimer = setInterval(() => updateNoShowButton(booking.start_time), 30000);
  }

  openModal('bkActionModal');
}

// Fahrtenbuch: bkActionModal'ı booking.hausbesuch + fahrt_status'a göre render eder
async function renderBkActionFahrtState(booking, isOwn) {
  console.log('[fahrtenbuch] renderBkActionFahrtState', { id: booking?.id, hausbesuch: booking?.hausbesuch, fahrt_status: booking?.fahrt_status, isOwn });
  const hbInfo = document.getElementById('bkActionHbInfo');
  const fahrtStartGroup = document.getElementById('bkActionFahrtStartedGroup');
  const arrivedGroup = document.getElementById('bkActionArrivedGroup');
  const startTerminGroup = document.getElementById('bkActionStartTerminGroup');
  const fahrtEndGroup = document.getElementById('bkActionFahrtEndGroup');
  const doneGroup = document.getElementById('bkActionDoneGroup');

  // Reset
  hbInfo.hidden = true;
  fahrtStartGroup.hidden = true;
  arrivedGroup.hidden = true;
  startTerminGroup.hidden = !isOwn;
  fahrtEndGroup.hidden = true;
  doneGroup.hidden = true;

  if (!booking.hausbesuch) {
    // Normal randevu — sadece "Termin Starten" (mevcut akış)
    return;
  }

  // Hausbesuch — adres ve durum bilgisini al
  // Phone exact match çok kısıtlı (booking.customer_phone normalize farkı, eski kayıtlar vs.).
  // Önce phone'la dene, bulunamazsa owner kapsamında name match yap.
  let leadAddr = null, distanceKm = null, durationMin = null;
  try {
    const ownerScope = booking.owner_id || getOwnerId();
    let lead = null;
    if (booking.customer_phone) {
      const r = await supabase.from('leads')
        .select('id,first_name,last_name,title,phone,street,plz,city,distance_km,duration_min')
        .eq('owner_id', ownerScope)
        .eq('phone', booking.customer_phone)
        .maybeSingle();
      lead = r.data || null;
    }
    if (!lead && booking.customer_name) {
      // Name match — "Vorname Nachname · YYYY-MM-DD" formatından sadece isim kısmı
      const cleanName = booking.customer_name.split('·')[0].trim().toLowerCase();
      const { data: all } = await supabase.from('leads')
        .select('id,first_name,last_name,title,phone,street,plz,city,distance_km,duration_min')
        .eq('owner_id', ownerScope);
      lead = (all || []).find(l => {
        const composed = [l.first_name, l.last_name].filter(Boolean).join(' ').toLowerCase();
        const titleLc = (l.title || '').toLowerCase();
        return composed === cleanName || titleLc === cleanName;
      }) || null;
    }
    if (lead) {
      const parts = [lead.street, [lead.plz, lead.city].filter(Boolean).join(' ')].filter(Boolean);
      leadAddr = parts.length ? parts.join(', ') : null;
      distanceKm = lead.distance_km;
      durationMin = lead.duration_min;
    }
  } catch (e) {
    console.warn('[renderBkActionFahrtState lead lookup]', e);
  }

  hbInfo.hidden = false;
  document.getElementById('bkActionHbAddr').textContent = leadAddr || '— Adresse fehlt —';
  const routeEl = document.getElementById('bkActionHbRoute');
  if (distanceKm != null && durationMin != null) {
    routeEl.textContent = `${Number(distanceKm).toFixed(1)} km · ${durationMin} min (einfache Fahrt)`;
  } else {
    routeEl.textContent = '';
  }

  const statusBadge = document.getElementById('bkActionHbStatusBadge');
  const statusLabels = {
    null: 'Nicht gestartet',
    fahrt_started: 'Fahrt unterwegs',
    fahrt_arrived: 'Angekommen',
    in_progress: 'Termin läuft',
    fahrt_return_pending: 'Rückkehr offen',
    fahrt_completed: 'Abgeschlossen'
  };
  statusBadge.textContent = statusLabels[booking.fahrt_status] || statusLabels.null;

  if (!isOwn) {
    // Başka terapistin Hausbesuch'u — sadece bilgi göster, aksiyon yok
    startTerminGroup.hidden = true;
    return;
  }

  const s = booking.fahrt_status;
  if (s == null) {
    fahrtStartGroup.hidden = false;
    startTerminGroup.hidden = true;
  } else if (s === 'fahrt_started') {
    arrivedGroup.hidden = false;
    startTerminGroup.hidden = true;
  } else if (s === 'fahrt_arrived') {
    // Termin Starten aktif (mevcut buton)
    startTerminGroup.hidden = false;
  } else if (s === 'in_progress') {
    // Termin başlatılmış — Fahrt Beenden henüz aktif değil ama gösterelim
    startTerminGroup.hidden = true;
    fahrtEndGroup.hidden = false;
  } else if (s === 'fahrt_return_pending') {
    startTerminGroup.hidden = true;
    fahrtEndGroup.hidden = false;
  } else if (s === 'fahrt_completed') {
    startTerminGroup.hidden = true;
    doneGroup.hidden = false;
  }
}

// Fahrtenbuch: Fahrt Starten flow — vehicle picker + Start-KM
async function loadVehiclesForPicker() {
  const ownerId = getOwnerId();
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('vehicles')
    .select('id,kind,kennzeichen,label,is_default,created_by')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { console.error('[loadVehicles]', error); return []; }
  return data || [];
}

async function openFahrtStartModal() {
  const sel = document.getElementById('fsVehicleSelect');
  const err = document.getElementById('fsError');
  err.style.display = 'none'; err.textContent = '';
  document.getElementById('fsStartKm').value = '';
  const list = await loadVehiclesForPicker();
  const lastUsed = localStorage.getItem('fahrtenbuch:lastVehicleId') || '';
  sel.innerHTML = '<option value="">— Fahrzeug wählen —</option>' +
    list.map(v => {
      const kindLabel = v.kind === 'gewerblich' ? '🏢' : '🚙';
      const lbl = [v.kennzeichen, v.label].filter(Boolean).join(' · ');
      return `<option value="${v.id}">${kindLabel} ${lbl}</option>`;
    }).join('');
  if (lastUsed && list.find(v => v.id === lastUsed)) {
    sel.value = lastUsed;
  } else {
    const def = list.find(v => v.is_default);
    if (def) sel.value = def.id;
  }
  if (list.length === 0) {
    err.textContent = 'Noch kein Fahrzeug vorhanden. Bitte zuerst eines anlegen.';
    err.style.display = '';
  }
  openModal('fahrtStartModal');
}

// ---- Named handlers (delegated event'lerden + inline onclick fallback'tan çağrılır) ----

function openQuickVehicleModal() {
  document.getElementById('qvKennzeichen').value = '';
  document.getElementById('qvLabel').value = '';
  document.getElementById('qvError').style.display = 'none';
  openModal('quickVehicleModal');
}

async function saveQuickVehicleHandler() {
  const kz = document.getElementById('qvKennzeichen').value.trim();
  const lbl = document.getElementById('qvLabel').value.trim();
  const err = document.getElementById('qvError');
  err.style.display = 'none';
  if (!kz) { err.textContent = 'Kennzeichen erforderlich.'; err.style.display = ''; return; }
  const ownerId = getOwnerId();
  const userId = currentSession.user.id;
  const isOwner = currentProfile?.role === 'owner';
  const { data, error } = await supabase.from('vehicles').insert({
    owner_id: ownerId,
    created_by: userId,
    kind: isOwner ? 'gewerblich' : 'privat',
    kennzeichen: kz,
    label: lbl || null
  }).select().single();
  if (error) { err.textContent = error.message; err.style.display = ''; throw error; }
  closeModal('quickVehicleModal');
  await openFahrtStartModal();
  document.getElementById('fsVehicleSelect').value = data.id;
  showToast('Fahrzeug hinzugefügt ✓');
}

async function saveFahrtStartHandler() {
  const vehicleId = document.getElementById('fsVehicleSelect').value;
  const startKmRaw = document.getElementById('fsStartKm').value;
  const startKm = parseInt(startKmRaw, 10);
  const err = document.getElementById('fsError');
  err.style.display = 'none';
  if (!vehicleId) { err.textContent = 'Bitte ein Fahrzeug wählen.'; err.style.display = ''; return; }
  if (!Number.isFinite(startKm) || startKm < 0) {
    err.textContent = 'Bitte einen gültigen Start-KM eingeben.'; err.style.display = ''; return;
  }
  const b = bkActionBookingCache;
  if (!b || !b.id) { err.textContent = 'Buchung nicht gefunden. Bitte Modal neu öffnen.'; err.style.display = ''; return; }

  const nowIso = new Date().toISOString();
  const { data: updData, error: updErr } = await supabase.from('bookings').update({
    fahrt_status: 'fahrt_started',
    vehicle_id: vehicleId,
    start_km: startKm,
    fahrt_started_at: nowIso
  }).eq('id', b.id).select('id').maybeSingle();
  if (updErr) {
    err.textContent = 'DB-Fehler: ' + updErr.message;
    err.style.display = '';
    throw updErr;
  }
  if (!updData) {
    err.textContent = 'Keine Berechtigung — Buchung konnte nicht aktualisiert werden.';
    err.style.display = '';
    return;
  }

  localStorage.setItem('fahrtenbuch:lastVehicleId', vehicleId);
  b.fahrt_status = 'fahrt_started';
  b.vehicle_id = vehicleId;
  b.start_km = startKm;
  b.fahrt_started_at = nowIso;

  closeModal('fahrtStartModal');
  await renderBkActionFahrtState(b, true);
  showToast('🚗 Fahrt gestartet — Adresse kopieren und losfahren.');
}

async function copyHausbesuchAddress() {
  const addr = document.getElementById('bkActionHbAddr').textContent.trim();
  if (!addr || addr === '—' || addr.includes('fehlt')) {
    showToast('Keine Adresse zum Kopieren.', 'error'); return;
  }
  try {
    await navigator.clipboard.writeText(addr);
    const ok = document.getElementById('bkActionHbCopyOk');
    if (ok) { ok.style.display = 'inline'; setTimeout(() => { ok.style.display = 'none'; }, 1800); }
    showToast('Adresse kopiert ✓');
  } catch (_) {
    showToast('Kopieren fehlgeschlagen — manuell auswählen.', 'error');
  }
}

async function markArrivedHandler() {
  const b = bkActionBookingCache;
  if (!b || !b.id) { showToast('Buchung nicht gefunden.', 'error'); return; }
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase.from('bookings').update({
    fahrt_status: 'fahrt_arrived',
    fahrt_arrived_at: nowIso
  }).eq('id', b.id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) { showToast('Keine Berechtigung — Buchung nicht aktualisierbar.', 'error'); return; }
  b.fahrt_status = 'fahrt_arrived';
  b.fahrt_arrived_at = nowIso;
  await renderBkActionFahrtState(b, true);
  showToast('✅ Angekommen — Termin kann gestartet werden.');
}

function openFahrtEndModal() {
  const b = bkActionBookingCache;
  if (!b) { showToast('Buchung nicht gefunden.', 'error'); return; }
  document.getElementById('feStartKm').textContent = b.start_km != null ? b.start_km + ' km' : '—';
  document.getElementById('feEndKm').value = '';
  document.getElementById('feDistance').style.display = 'none';
  document.getElementById('feError').style.display = 'none';
  openModal('fahrtEndModal');
}

function updateEndKmPreview(value) {
  const b = bkActionBookingCache;
  const end = parseInt(value, 10);
  const distEl = document.getElementById('feDistance');
  if (!b || !Number.isFinite(end) || b.start_km == null) {
    distEl.style.display = 'none'; return;
  }
  const diff = end - b.start_km;
  if (diff < 0) {
    distEl.textContent = '⚠ End-KM darf nicht kleiner als Start-KM sein.';
    distEl.style.color = '#c00';
  } else {
    distEl.textContent = `Gefahrene Strecke: ${diff} km`;
    distEl.style.color = '#1c4d8f';
  }
  distEl.style.display = '';
}

async function saveFahrtEndHandler() {
  const b = bkActionBookingCache;
  const endKm = parseInt(document.getElementById('feEndKm').value, 10);
  const err = document.getElementById('feError');
  err.style.display = 'none';
  if (!b || !b.id) { err.textContent = 'Buchung nicht gefunden.'; err.style.display = ''; return; }
  if (!Number.isFinite(endKm) || endKm < 0) {
    err.textContent = 'Bitte einen gültigen End-KM eingeben.'; err.style.display = ''; return;
  }
  if (b.start_km != null && endKm < b.start_km) {
    err.textContent = 'End-KM darf nicht kleiner als Start-KM sein.'; err.style.display = ''; return;
  }

  const nowIso = new Date().toISOString();
  const { data: updData, error: updErr } = await supabase.from('bookings').update({
    fahrt_status: 'fahrt_completed',
    end_km: endKm,
    fahrt_ended_at: nowIso
  }).eq('id', b.id).select('id').maybeSingle();
  if (updErr) { err.textContent = 'DB: ' + updErr.message; err.style.display = ''; throw updErr; }
  if (!updData) { err.textContent = 'Keine Berechtigung.'; err.style.display = ''; return; }

  let kzSnapshot = null, kindSnapshot = null;
  if (b.vehicle_id) {
    const { data: v } = await supabase.from('vehicles').select('kennzeichen,kind').eq('id', b.vehicle_id).maybeSingle();
    if (v) { kzSnapshot = v.kennzeichen; kindSnapshot = v.kind; }
  }

  let leadId = null, leadDurationMin = null;
  if (b.customer_phone) {
    const { data: l } = await supabase.from('leads').select('id,duration_min')
      .eq('owner_id', b.owner_id).eq('phone', b.customer_phone).maybeSingle();
    if (l) { leadId = l.id; leadDurationMin = l.duration_min; }
  }

  const { error: fErr } = await supabase.from('fahrten').upsert({
    owner_id: b.owner_id,
    user_id: currentSession.user.id,
    booking_id: b.id,
    lead_id: leadId,
    vehicle_id: b.vehicle_id || null,
    kennzeichen_snapshot: kzSnapshot,
    kind_snapshot: kindSnapshot,
    start_km: b.start_km,
    end_km: endKm,
    distance_km: (Number.isFinite(b.start_km) && Number.isFinite(endKm)) ? (endKm - b.start_km) : null,
    estimated_duration_min: leadDurationMin,
    fahrt_started_at: b.fahrt_started_at,
    fahrt_arrived_at: b.fahrt_arrived_at,
    fahrt_ended_at: nowIso
  }, { onConflict: 'booking_id' });
  if (fErr) {
    console.error('[fahrten-insert]', fErr);
    showToast('Buchung aktualisiert, aber Fahrtenbuch-Log fehlgeschlagen: ' + fErr.message, 'error');
  }

  b.fahrt_status = 'fahrt_completed';
  b.end_km = endKm;
  b.fahrt_ended_at = nowIso;

  closeModal('fahrtEndModal');
  await renderBkActionFahrtState(b, true);
  showToast('🏁 Fahrt abgeschlossen — im Fahrtenbuch eingetragen.');
}

async function handleTerminStarten() {
  if (!bkActionBookingCache) return;
  const b = bkActionBookingCache;
  const patientName = b.customer_name || '';
  const patientPhone = b.customer_phone || '';
  const ownerId = getOwnerId();

  // Fahrtenbuch: Hausbesuch ise fahrt_status'u 'in_progress'e geçir — kullanıcı geri dönüp
  // Fahrt Beenden tıklayabilsin. Eğer henüz fahrt_arrived değilse blokla.
  if (b.hausbesuch) {
    if (b.fahrt_status !== 'fahrt_arrived' && b.fahrt_status !== 'in_progress') {
      showToast('Bitte zuerst "Fahrt Starten" → "Ich bin angekommen" durchlaufen.', 'error');
      return;
    }
    if (b.fahrt_status === 'fahrt_arrived') {
      await supabase.from('bookings').update({ fahrt_status: 'in_progress' }).eq('id', b.id);
      b.fahrt_status = 'in_progress';
    }
  }

  closeModal('bkActionModal');
  if (bkActionTimer) { clearInterval(bkActionTimer); bkActionTimer = null; }

  // Mark linked prescription_session done (physio); non-blocking
  markPrescriptionSession(b.id, 'done');

  const sessionText = document.getElementById('bkActionSession').textContent;
  const match = sessionText.match(/Seans\s+(\d+)\s*\/\s*(\d+)/);
  const sessionNum = match ? parseInt(match[1]) : 1;

  let leadId = null;
  if (patientName) {
    // Strip the " · YYYY-MM-DD" birth date suffix that displayNameWithBirth appends
    const cleanName = patientName.split('·')[0].trim().toLowerCase();
    const { data: leads } = await bizScope(supabase.from('leads')
      .select('id,first_name,last_name,title,phone,metadata')
      .eq('owner_id', ownerId), 'patients');
    if (leads && leads.length > 0) {
      const lead = leads.find(l => {
        const composed = [l.first_name, l.last_name].filter(Boolean).join(' ').toLowerCase();
        const titleLc = (l.title || '').toLowerCase();
        return composed === cleanName || titleLc === cleanName;
      }) || (patientPhone ? leads.find(l => l.phone === patientPhone) : null);
      if (lead) leadId = lead.id;
    }
  }

  if (sessionNum === 1) {
    prefillAnamnesePatientId = leadId;
    switchPanel('anamnese');
  } else {
    prefillNotesPatientId = leadId;
    switchPanel('notizen');
  }
}

async function triggerNoShowBot(booking) {
  // TODO: WhatsApp no-show bot entegrasyonu
  console.log('[NoShowBot] Triggered for booking:', booking.id, booking.customer_name);
}

async function handlePatientNichtErschienen() {
  if (!bkActionBookingCache) return;
  const btn = document.getElementById('bkActionNoShowBtn');
  if (btn && btn.disabled) return;

  closeModal('bkActionModal');
  if (bkActionTimer) { clearInterval(bkActionTimer); bkActionTimer = null; }

  try {
    const { error: bkErr } = await supabase
      .from('bookings')
      .update({ status: 'no_show' })
      .eq('id', bkActionBookingCache.id);

    if (bkErr) throw bkErr;

    const { error: sessErr } = await supabase
      .from('prescription_sessions')
      .update({ status: 'no_show' })
      .eq('booking_id', bkActionBookingCache.id);

    if (sessErr) throw sessErr;

    triggerNoShowBot(bkActionBookingCache);
    showToast('Patient nicht erschienen — Bot wurde ausgelöst.');

    const cal = window.calendar || calendar;
    if (cal) {
      await cal.reloadMonth();
      cal.refresh();
    }
    if (activePanel === 'overview') {
      await loadTodayBookings();
    }
    if (activePanel === 'calendar' && calendarView === 'day') {
      await renderDayView(toISODate(dayViewDate));
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// Group Appointments: Helpers and UI Managers
// ============================================================

window.bkSelectedGroupPatients = [];
window.bkCurrentGroupParticipants = [];

function refreshBkGroupPanel(selectedServiceId = null) {
  const bkId = document.getElementById('bk-id').value;
  const srvId = selectedServiceId || document.getElementById('bkService').value;
  const service = (window.ownerServices || []).find(s => s.id === srvId);
  const isGroupService = service ? service.is_group : false;
  
  const block = document.getElementById('bkGroupBlock');
  const isGroupCheckbox = document.getElementById('bkIsGroup');
  const capWrap = document.getElementById('bkGroupCapacityWrap');
  const participantsSection = document.getElementById('bkGroupParticipantsSection');
  const customerGroup = document.getElementById('bkCustomerGroup');
  const phoneGroup = document.getElementById('bkPhoneGroup');
  
  if (!block) return;
  
  // Show group block container if this is a group service OR if it's already checked OR if we are currently editing an existing booking that is a group
  const shouldShow = isGroupService || isGroupCheckbox.checked || bkId;
  
  if (shouldShow) {
    block.style.display = 'block';
  } else {
    block.style.display = 'none';
    isGroupCheckbox.checked = false;
    capWrap.style.display = 'none';
    participantsSection.style.display = 'none';
    customerGroup.style.display = 'block';
    if (phoneGroup) phoneGroup.style.display = 'block';
    
    // Restore series fields
    const seriesGroup = document.getElementById('bkSeriesToggle')?.closest('.form-group');
    if (seriesGroup) seriesGroup.style.display = 'block';
    return;
  }
  
  // If it's a group service, default the checkbox to checked (unless editing an existing einzel appointment)
  if (isGroupService && !bkId) {
    isGroupCheckbox.checked = true;
  }
  
  // Toggle series fields display - hide if group booking
  const seriesGroup = document.getElementById('bkSeriesToggle')?.closest('.form-group');
  if (seriesGroup) {
    seriesGroup.style.display = isGroupCheckbox.checked ? 'none' : 'block';
  }
  
  if (isGroupCheckbox.checked) {
    capWrap.style.display = 'flex';
    participantsSection.style.display = 'block';
    // Hide single customer search since this is a group!
    customerGroup.style.display = 'none';
    if (phoneGroup) phoneGroup.style.display = 'none';
    
    // Set default group capacity from service
    if (service && service.group_capacity && !bkId) {
      document.getElementById('bkGroupCapacity').value = service.group_capacity;
    }
  } else {
    capWrap.style.display = 'none';
    participantsSection.style.display = 'none';
    customerGroup.style.display = 'block';
    if (phoneGroup) phoneGroup.style.display = 'block';
  }
}

async function loadGroupParticipants(parentId, maxCapacity) {
  const listEl = document.getElementById('bkGroupParticipantsList');
  const countEl = document.getElementById('bkGroupCount');
  const maxEl = document.getElementById('bkGroupMaxDisplay');
  
  if (!listEl) return;
  listEl.innerHTML = '<li style="font-size:13px;color:var(--text-muted);padding:8px 0;text-align:center;">Lade Teilnehmer…</li>';
  
  const { data: children, error } = await supabase
    .from('bookings')
    .select('id,customer_name,customer_phone,lead_id')
    .eq('group_parent_id', parentId)
    .eq('status', 'confirmed');
    
  if (error) {
    console.error('Error fetching group participants:', error);
    listEl.innerHTML = '<li style="font-size:13px;color:#ef4444;padding:8px 0;">Fehler beim Laden.</li>';
    return;
  }
  
  window.bkCurrentGroupParticipants = children || [];
  
  const count = children ? children.length : 0;
  countEl.textContent = count;
  maxEl.textContent = maxCapacity;
  
  if (count === 0) {
    listEl.innerHTML = '<li style="font-size:13px;color:var(--text-muted);padding:8px 0;text-align:center;font-style:italic;">Keine Teilnehmer gebucht</li>';
    return;
  }
  
  listEl.innerHTML = children.map(child => {
    return `
      <li style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:13px;">
        <span style="font-weight:500;">👥 ${escapeHtml(child.customer_name)}</span>
        <button type="button" class="btn-ghost remove-group-part-btn" data-id="${child.id}" style="padding:2px 6px;font-size:11px;color:#ef4444;border-color:#fca5a5;">Entfernen</button>
      </li>
    `;
  }).join('');
  
  // Wire up remove button click handlers
  listEl.querySelectorAll('.remove-group-part-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const childId = e.target.dataset.id;
      const child = window.bkCurrentGroupParticipants.find(c => c.id === childId);
      if (!child) return;
      
      if (confirm(`Möchten Sie ${child.customer_name} wirklich aus dieser Gruppe entfernen?`)) {
        e.target.disabled = true;
        e.target.textContent = '…';
        const { error: delErr } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', childId);
        if (delErr) {
          showToast('Fehler: ' + delErr.message, 'error');
          e.target.disabled = false;
          e.target.textContent = 'Entfernen';
        } else {
          showToast('Teilnehmer entfernt.');
          await loadGroupParticipants(parentId, maxCapacity);
          if (window.calendar) { await window.calendar.reloadMonth(); window.calendar.refresh(); }
          if (activePanel === 'calendar' && calendarView === 'day') await renderDayView(toISODate(dayViewDate));
        }
      }
    });
  });
}

function renderLocalGroupParticipants() {
  const listEl = document.getElementById('bkGroupParticipantsList');
  const countEl = document.getElementById('bkGroupCount');
  const maxEl = document.getElementById('bkGroupMaxDisplay');
  const maxCapacity = parseInt(document.getElementById('bkGroupCapacity').value) || 5;
  
  if (!listEl) return;
  
  const patients = window.bkSelectedGroupPatients || [];
  countEl.textContent = patients.length;
  maxEl.textContent = maxCapacity;
  
  if (patients.length === 0) {
    listEl.innerHTML = '<li style="font-size:13px;color:var(--text-muted);padding:8px 0;text-align:center;font-style:italic;">Keine Teilnehmer ausgewählt</li>';
    return;
  }
  
  listEl.innerHTML = patients.map((p, idx) => {
    return `
      <li style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:13px;">
        <span style="font-weight:500;">👥 ${escapeHtml(p.name)}</span>
        <button type="button" class="btn-ghost remove-local-part-btn" data-index="${idx}" style="padding:2px 6px;font-size:11px;color:#ef4444;border-color:#fca5a5;">Entfernen</button>
      </li>
    `;
  }).join('');
  
  // Wire up remove local participant
  listEl.querySelectorAll('.remove-local-part-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index);
      window.bkSelectedGroupPatients.splice(idx, 1);
      renderLocalGroupParticipants();
    });
  });
}

async function initBkGroupPatientAutocomplete() {
  const input = document.getElementById('bkGroupPatientSearch');
  const list = document.getElementById('bkGroupPatientList');
  if (!input || !list) return;
  
  list.innerHTML = '';
  list.hidden = true;
  
  // Reuse bkAllLeads if loaded, otherwise load them
  if (!Array.isArray(window.bkAllLeads) || window.bkAllLeads.length === 0) {
    const ownerId = getOwnerId();
    const { data } = await bizScope(supabase
      .from('leads')
      .select('id,title,first_name,last_name,phone,metadata,street,plz,city')
      .eq('owner_id', ownerId)
      .order('title'), 'patients');
    window.bkAllLeads = data || [];
  }
  
  input.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      list.hidden = true;
      return;
    }
    
    const filtered = (window.bkAllLeads || []).filter(l => displayNameWithBirth(l).toLowerCase().includes(q));
    
    let html = '';
    if (filtered.length === 0) {
      html = '<li class="empty-item" style="font-size:12px;color:var(--text-muted);padding:6px 12px;">Keine Treffer</li>';
    } else {
      html = filtered.map(l => {
        const name = displayNameWithBirth(l);
        return `<li data-id="${l.id}" data-title="${escapeHtml(name)}" data-phone="${escapeHtml(l.phone || '')}" style="font-size:13px;padding:6px 12px;cursor:pointer;">👥 ${escapeHtml(name)}</li>`;
      }).join('');
    }
    
    list.innerHTML = html;
    list.hidden = false;
    
    // Wire up list item click
    list.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', async () => {
        const leadId = li.dataset.id;
        const leadName = li.dataset.title;
        const leadPhone = li.dataset.phone;
        
        input.value = '';
        list.hidden = true;
        
        const bkId = document.getElementById('bk-id').value;
        const maxCapacity = parseInt(document.getElementById('bkGroupCapacity').value) || 5;
        
        if (bkId) {
          // Editing existing booking -> immediately insert into database!
          const { data: parent } = await supabase.from('bookings').select('*').eq('id', bkId).single();
          if (!parent) return;
          
          // Check capacity limit
          const currentCount = window.bkCurrentGroupParticipants ? window.bkCurrentGroupParticipants.length : 0;
          if (currentCount >= (parent.group_capacity || 5)) {
            showToast('Diese Gruppe ist bereits voll belegt.', 'error');
            return;
          }
          
          // Check if already in group
          if (window.bkCurrentGroupParticipants.some(c => c.lead_id === leadId)) {
            showToast('Patient ist bereits in dieser Gruppe.', 'error');
            return;
          }
          
          const childPayload = {
            owner_id: parent.owner_id,
            user_id: parent.user_id,
            service_id: parent.service_id,
            start_time: parent.start_time,
            end_time: parent.end_time,
            customer_name: leadName,
            customer_phone: leadPhone || null,
            group_parent_id: parent.id,
            status: 'confirmed',
            lead_id: leadId
          };
          
          const { error: insErr } = await supabase.from('bookings').insert(childPayload);
          if (insErr) {
            showToast('Fehler beim Hinzufügen: ' + insErr.message, 'error');
          } else {
            showToast('Patient hinzugefügt.');
            await loadGroupParticipants(parent.id, parent.group_capacity);
            if (window.calendar) { await window.calendar.reloadMonth(); window.calendar.refresh(); }
            if (activePanel === 'calendar' && calendarView === 'day') await renderDayView(toISODate(dayViewDate));
          }
        } else {
          // Creating a new booking -> add to local array!
          if (!window.bkSelectedGroupPatients) window.bkSelectedGroupPatients = [];
          
          if (window.bkSelectedGroupPatients.length >= maxCapacity) {
            showToast(`Maximale Kapazität von ${maxCapacity} Personen erreicht.`, 'error');
            return;
          }
          
          if (window.bkSelectedGroupPatients.some(p => p.id === leadId)) {
            showToast('Patient bereits ausgewählt.', 'error');
            return;
          }
          
          window.bkSelectedGroupPatients.push({ id: leadId, name: leadName, phone: leadPhone });
          renderLocalGroupParticipants();
        }
      });
    });
  });
  
  // Hide dropdown on blur
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.hidden = true;
    }
  });
}

async function openBookingModal(b) {
  if (!b) { await prefillBookingModal(null); return; }
  const ownerId = getOwnerId();
  document.getElementById('bk-id').value = b.id || '';
  document.getElementById('bookingModalTitle').textContent = t('lbl_manual_title');
  // Show "Sitzung N/M" if this booking is linked to a prescription session
  if (b.id) decorateBookingTitleWithSession(b.id).catch(() => { });
  document.getElementById('bkWlMatchBtn').hidden = false;
  document.getElementById('bkDeleteBtn').hidden = false;
  document.getElementById('bkMoveBtn').hidden = false;
  document.getElementById('bkStart').value = b.start_time ? b.start_time.substring(0, 16) : '';
  document.getElementById('bkCustomer').value = b.customer_name || '';
  document.getElementById('bkPhone').value = b.customer_phone || '';
  document.getElementById('bkNotes').value = b.notes || '';
  document.getElementById('bkHausbesuch').checked = b.hausbesuch || false;
  document.getElementById('bkSeriesToggle').checked = false;
  document.getElementById('bkSeriesFields').hidden = true;
  document.getElementById('bkSpecialBanner').hidden = true;
  document.getElementById('bkDocAssignHint').hidden = true;
  if (typeof refreshBkHausbesuchPanel === 'function') refreshBkHausbesuchPanel();
  if (b.customer_phone) {
    try {
      const { data: lead } = await supabase.from('leads')
        .select('besondere_wuensche,geschlecht,hausbesuch')
        .eq('owner_id', ownerId)
        .eq('phone', b.customer_phone)
        .maybeSingle();
      if (lead?.besondere_wuensche) {
        const sb = document.getElementById('bkSpecialBanner');
        sb.textContent = 'Besondere Wünsche: ' + lead.besondere_wuensche;
        sb.hidden = false;
      }
      if (lead?.besondere_wuensche?.toLowerCase().includes('frau') || lead?.geschlecht === 'weiblich') {
        const dh = document.getElementById('bkDocAssignHint');
        dh.textContent = 'Patient wünscht weiblichen Therapeuten.';
        dh.hidden = false;
      }
    } catch (_) { }
  }
  populateEmpSelects(b.user_id);
  await populateSrvSelect(b.service_id);
  
  // Group Booking UI Populate
  const isGrpCheckbox = document.getElementById('bkIsGroup');
  if (isGrpCheckbox) isGrpCheckbox.checked = b.is_group || false;
  if (b.is_group) {
    document.getElementById('bkGroupCapacity').value = b.group_capacity || 5;
    window.bkSelectedGroupPatients = [];
    refreshBkGroupPanel(b.service_id);
    await loadGroupParticipants(b.id, b.group_capacity || 5);
  } else {
    window.bkSelectedGroupPatients = [];
    window.bkCurrentGroupParticipants = [];
    refreshBkGroupPanel(b.service_id);
  }
  await initBkGroupPatientAutocomplete().catch(() => {});
  
  if (b.service_id && b.start_time && b.end_time) {
    const actualDur = Math.round((new Date(b.end_time) - new Date(b.start_time)) / 60000);
    updateBkDuration(b.service_id, actualDur);
  }
  openModal('bookingModal');
  document.getElementById('bkMoveBtn').onclick = () => startMoveBooking(b);
  await initBkCustomerAutocomplete();
}

async function initBkCustomerAutocomplete() {
  const input = document.getElementById('bkCustomerSearch');
  const list = document.getElementById('bkCustomerList');
  const nameH = document.getElementById('bkCustomer');
  const idH = document.getElementById('bkCustomerId');
  const phoneGroup = document.getElementById('bkPhoneGroup');
  const phoneInput = document.getElementById('bkPhone');
  if (!input || !list || !nameH || !idH) return;
  if (phoneGroup) phoneGroup.hidden = true;

  async function loadBkLeads() {
    const ownerId = getOwnerId();
    const { data } = await bizScope(supabase
      .from('leads')
      .select('id,title,first_name,last_name,phone,metadata,street,plz,city,lat,lng,distance_km,duration_min,route_calculated_at')
      .eq('owner_id', ownerId)
      .order('title'), 'patients');
    window.bkAllLeads = data || [];
  }
  await loadBkLeads();

  let activeIndex = -1;

  function renderList(filter) {
    const q = (filter || '').trim().toLowerCase();
    const filtered = !q
      ? (window.bkAllLeads || [])
      : (window.bkAllLeads || []).filter(l => displayNameWithBirth(l).toLowerCase().includes(q));
    let html = '<li class="cust-new-item" data-action="new">+ Neuer Kunde…</li>';
    if (filtered.length === 0) {
      html += '<li class="empty-item">Keine Treffer</li>';
    } else {
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = q ? new RegExp(`(${esc})`, 'gi') : null;
      html += filtered.map(l => {
        const name = displayNameWithBirth(l);
        const safe = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const hl = rx ? safe.replace(rx, '<span class="match-hl">$1</span>') : safe;
        return `<li data-id="${l.id}">${hl}</li>`;
      }).join('');
    }
    list.innerHTML = html;
    list.hidden = false;
    activeIndex = -1;
  }

  function openNewLeadFlow() {
    // Schnellerfassung: Booking modalı kapatmadan küçük mini-modal aç
    list.hidden = true;
    // Mevcut booking durumunu sakla (Schnellerfassung iptal edilirse geri dönmek için)
    window._bkModalSnapshot = {
      start: document.getElementById('bkStart')?.value,
      employee: document.getElementById('bkEmployee')?.value,
      service: document.getElementById('bkService')?.value,
      notes: document.getElementById('bkNotes')?.value,
    };
    // Kullanıcının yazdığı metni ön dolgu olarak aktar
    const typed = (input.value || '').trim();
    const sfVorname = document.getElementById('sfVorname');
    const sfNachname = document.getElementById('sfNachname');
    if (sfVorname && !sfVorname.value) {
      // Tek kelimeyse Vorname, iki kelimeyse Vorname + Nachname
      const parts = typed.split(' ');
      sfVorname.value = parts[0] || '';
      if (sfNachname && parts.length > 1) sfNachname.value = parts.slice(1).join(' ');
    }
    document.getElementById('sfError').style.display = 'none';
    const sfModal = document.getElementById('schnellerfassungModal');
    if (sfModal) sfModal.hidden = false;
    setTimeout(() => sfVorname?.focus(), 80);
  }

  function applyLeadById(id) {
    const lead = (window.bkAllLeads || []).find(l => l.id === id);
    if (!lead) return;
    input.value = displayNameWithBirth(lead);
    nameH.value = displayNameWithBirth(lead);
    idH.value = lead.id;
    if (phoneInput) phoneInput.value = lead.phone || '';
    list.hidden = true;
    activeIndex = -1;
    refreshBkHausbesuchPanel(); // Fahrtenbuch: lead seçilince adres + cache durumu güncellenir
  }

  if (!input.dataset.bkAutoBound) {
    input.dataset.bkAutoBound = '1';
    input.addEventListener('input', () => {
      nameH.value = '';
      idH.value = '';
      if (phoneInput) phoneInput.value = '';
      renderList(input.value);
    });
    input.addEventListener('focus', () => renderList(input.value));
    input.addEventListener('keydown', (e) => {
      const items = list.querySelectorAll('li[data-id], li[data-action="new"]');
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
        if (activeIndex >= 0 && items[activeIndex]) {
          const it = items[activeIndex];
          if (it.dataset.action === 'new') openNewLeadFlow();
          else applyLeadById(it.dataset.id);
        }
      } else if (e.key === 'Escape') {
        list.hidden = true;
        activeIndex = -1;
      }
    });
    list.addEventListener('mousedown', (e) => {
      const it = e.target.closest('li');
      if (!it) return;
      e.preventDefault();
      if (it.dataset.action === 'new') openNewLeadFlow();
      else if (it.dataset.id) applyLeadById(it.dataset.id);
    });
    document.addEventListener('mousedown', (e) => {
      if (!document.getElementById('bkCustomerWrap')?.contains(e.target)) {
        list.hidden = true;
      }
    });

    const schnellBtn = document.getElementById('bkAddCustomerSchnell');
    const normalBtn = document.getElementById('bkAddCustomerNormal');

    if (schnellBtn && !schnellBtn.dataset.bound) {
      schnellBtn.dataset.bound = '1';
      schnellBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openNewLeadFlow();
      });
    }

    if (normalBtn && !normalBtn.dataset.bound) {
      normalBtn.dataset.bound = '1';
      normalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window._bkModalState = {
          id: document.getElementById('bk-id')?.value || null,
          start: document.getElementById('bkStart')?.value,
          employee: document.getElementById('bkEmployee')?.value,
          service: document.getElementById('bkService')?.value,
          notes: document.getElementById('bkNotes')?.value,
          hausbesuch: document.getElementById('bkHausbesuch')?.checked || false
        };
        window._returnToBkModal = true;
        closeModal('bookingModal');
        openLeadModal(null);
      });
    }
  }

  function selectLead(id) {
    if (!id) return;
    if (!(window.bkAllLeads || []).some(l => l.id === id)) {
      // refresh in case new lead just got added
      loadBkLeads().then(() => applyLeadById(id));
      return;
    }
    applyLeadById(id);
  }
  window.bkSelectLead = selectLead;

  // Pre-select existing customer when editing a booking
  const existingName = (nameH.value || '').trim().toLowerCase();
  const existingId = (idH.value || '').trim();
  if (existingId && (window.bkAllLeads || []).some(l => l.id === existingId)) {
    applyLeadById(existingId);
  } else if (existingName) {
    const match = (window.bkAllLeads || []).find(l =>
      (displayNameWithBirth(l) || '').toLowerCase() === existingName ||
      ((l.title || '').toLowerCase() === existingName)
    );
    if (match) applyLeadById(match.id);
    else { input.value = nameH.value; }
  } else {
    input.value = '';
  }
}

function startMoveBooking(b) {
  moveBooking = b;
  if (moveGhostEl) { moveGhostEl.remove(); moveGhostEl = null; }
  closeModal('bookingModal');
  if (calendarView !== 'day') setCalendarView('day');
  else renderDayView(toISODate(dayViewDate));
}

function placeGhost(slotEl, empId, text) {
  if (moveGhostEl) moveGhostEl.remove();
  const allEmps = currentProfile.role === 'owner' ? teamMembers : [currentProfile];
  const idx = allEmps.findIndex(e => e.id === empId);
  const color = EMP_COLORS[idx % EMP_COLORS.length];
  const ghost = document.createElement('div');
  ghost.className = 'dv-ghost';
  ghost.style.background = color + '25';
  ghost.style.borderColor = color;
  ghost.style.color = 'var(--text-main)';
  ghost.style.top = slotEl.offsetTop + 'px';
  const s = new Date(moveBooking.start_time);
  const e = new Date(moveBooking.end_time);
  const durMin = (e - s) / 60000;
  ghost.style.height = Math.max((durMin / 30) * 56, 28) + 'px';
  ghost.textContent = text;
  ghost.addEventListener('click', (ev) => {
    ev.stopPropagation();
    doMoveBooking(slotEl.dataset.time, empId);
  });
  slotEl.parentElement.appendChild(ghost);
  moveGhostEl = ghost;
}

async function doMoveBooking(startStr, empId) {
  if (!moveBooking) return;
  const s = new Date(startStr + ':00');
  const e = new Date(moveBooking.end_time);
  const oldS = new Date(moveBooking.start_time);
  const durMs = e - oldS;
  const newE = new Date(s.getTime() + durMs);
  const payload = {
    start_time: s.toISOString(),
    end_time: newE.toISOString()
  };
  if (empId && empId !== moveBooking.user_id) payload.user_id = empId;
  const { error } = await supabase.from('bookings').update(payload).eq('id', moveBooking.id);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  moveBooking = null;
  if (moveGhostEl) { moveGhostEl.remove(); moveGhostEl = null; }
  showToast('Termin verschoben');
  await renderDayView(toISODate(dayViewDate));
  if (typeof scheduleDate !== 'undefined' && toISODate(dayViewDate) === toISODate(scheduleDate)) {
    loadScheduleBookings(scheduleDate);
  }
}

function populateEmpSelects(selectedId = null) {
  ['bkEmployee', 'leaveEmployee'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = teamMembers.map(m =>
      `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${m.business_name || m.email?.split('@')[0]}</option>`
    ).join('');
  });

  // bkEmployee değişince servis listesini o çalışanın hizmetlerine göre yenile
  const bkEmp = document.getElementById('bkEmployee');
  if (bkEmp && !bkEmp.dataset.srvFilterWired) {
    bkEmp.dataset.srvFilterWired = '1';
    bkEmp.addEventListener('change', async () => {
      await populateSrvSelect(null, bkEmp.value);
    });
  }
}

async function populateSrvSelect(selectedId = null, employeeId = null) {
  const el = document.getElementById('bkService');
  if (!el) return;
  let q = supabase.from('services').select('id,title,duration_minutes,price,price_config,code,is_internal').or(`owner_id.eq.${getOwnerId()},user_id.eq.${getOwnerId()}`);
  q = bizScope(q, 'services');
  const { data } = await q;

  // Update global cache with full data including price_config
  if (data) {
    ownerServices = data;
  }

  // Çalışana atanmış hizmetler için filtre — atama yoksa hepsi gösterilir
  let allowedSet = null;
  if (!employeeId) employeeId = document.getElementById('bkEmployee')?.value || null;
  if (employeeId) {
    const { data: assigned } = await supabase.from('employee_services').select('service_id').eq('employee_id', employeeId);
    if (assigned && assigned.length) {
      allowedSet = new Set(assigned.map(a => a.service_id));
    }
  }

  // Customer-facing dropdown: exclude is_internal services (Blanko bonus etc.) unless it is the selected one
  let visible = (data || []).filter(s => !s.is_internal || s.id === selectedId);
  if (allowedSet) {
    visible = visible.filter(s => allowedSet.has(s.id) || s.id === selectedId);
  }

  el.innerHTML = '<option value="">— Dienstleistung wählen —</option>' + visible.map(s =>
    `<option value="${s.id}" data-duration="${s.duration_minutes || 30}" data-code="${escapeHtml(s.code || '')}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.title)}</option>`
  ).join('');
  if (selectedId) updateBkDuration(selectedId);
}

async function updateBkDuration(srvId, defaultValue = null) {
  const durGroup = document.getElementById('bkDurationGroup');
  const durOptions = document.getElementById('bkDurationOptions');
  if (!durGroup || !durOptions) return;
  if (!srvId) { durGroup.hidden = true; return; }

  // First check local cache
  let srv = ownerServices.find(s => s.id === srvId);

  // If not in cache or doesn't have price_config, fetch from database
  if (!srv || !srv.price_config) {
    const { data } = await supabase.from('services').select('id,title,duration_minutes,price,price_config').eq('id', srvId).single();
    if (data) {
      srv = data;
      // Update local cache
      const idx = ownerServices.findIndex(s => s.id === srvId);
      if (idx >= 0) ownerServices[idx] = srv;
    }
  }

  const defaultDur = parseInt(defaultValue) || parseInt(srv?.duration_minutes) || 30;

  // Get available durations from price_config
  let durations = [];
  if (srv?.price_config?.durations) {
    durations = Object.entries(srv.price_config.durations)
      .filter(([_, v]) => v && v.active)
      .map(([k, v]) => ({ minutes: parseInt(k), price: v.price }))
      .sort((a, b) => a.minutes - b.minutes);
  }

  if (durations.length > 1) {
    // Multiple active durations → show radio buttons
    const hasDefault = durations.some(d => d.minutes === defaultDur);
    const selected = hasDefault ? defaultDur : durations[0].minutes;
    durOptions.innerHTML = durations.map(d => `
      <label class="bk-dur-option">
        <input type="radio" name="bkDuration" value="${d.minutes}" ${d.minutes === selected ? 'checked' : ''}>
        <span>${d.minutes} Min${d.price ? ' · ' + formatEur(d.price) : ''}</span>
      </label>
    `).join('');
    durGroup.hidden = false;
  } else if (durations.length === 1) {
    // Single configured duration → hide radio group, single value applied automatically
    const d = durations[0];
    durOptions.innerHTML = `<input type="radio" name="bkDuration" value="${d.minutes}" checked hidden>`;
    durGroup.hidden = true;
  } else {
    // No price_config → fall back to the service's single duration_minutes
    const single = parseInt(srv?.duration_minutes) || defaultDur;
    durOptions.innerHTML = `<input type="radio" name="bkDuration" value="${single}" checked hidden>`;
    durGroup.hidden = true;
  }

  // Set initial value
  const checked = durOptions.querySelector('input[type="radio"]:checked');
  if (checked) {
    window._selectedBkDuration = parseInt(checked.value);
  }
}

document.getElementById('bkService').addEventListener('change', (e) => {
  updateBkDuration(e.target.value);
  refreshBkGroupPanel(e.target.value);
  // Add listeners for new radio buttons after duration group is populated
  setTimeout(() => {
    const durGroup = document.getElementById('bkDurationGroup');
    if (durGroup) {
      durGroup.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (ev) => {
          window._selectedBkDuration = parseInt(ev.target.value);
        });
      });
    }
  }, 10);
});

document.getElementById('bkIsGroup')?.addEventListener('change', () => {
  refreshBkGroupPanel();
});

document.getElementById('bkGroupCapacity')?.addEventListener('change', () => {
  if (!document.getElementById('bk-id').value) {
    renderLocalGroupParticipants();
  }
});

document.getElementById('bkPhone').addEventListener('blur', async () => {
  const phone = document.getElementById('bkPhone').value.trim();
  // wa_contacts tablosu DROP edildi (2026-05-22, WhatsApp shelved). Hint kalktı.
  const hint = document.getElementById('bkWaHint');
  if (hint) hint.hidden = true;
});

// ============================================================
// Fahrtenbuch: Hausbesuch panel + Berechnen flow
// ============================================================

const HAUSBESUCH_BUFFER_MIN = 10; // Fahrtenbuch.md §2: kapı çal, eşya topla payı

function getSelectedBkLead() {
  const id = document.getElementById('bkCustomerId')?.value;
  if (!id || !Array.isArray(window.bkAllLeads)) return null;
  return window.bkAllLeads.find(l => l.id === id) || null;
}

function getBkServiceDurationMin() {
  const durOptions = document.getElementById('bkDurationOptions');
  const durGroup = document.getElementById('bkDurationGroup');
  const checkedRadio = (durOptions || durGroup)?.querySelector('input[type="radio"]:checked');
  if (checkedRadio) return parseInt(checkedRadio.value, 10) || 30;
  const srvId = document.getElementById('bkService')?.value;
  return (ownerServices || []).find(s => s.id === srvId)?.duration_minutes || 30;
}

function refreshBkHausbesuchPanel() {
  const isHb = document.getElementById('bkHausbesuch').checked;
  const panel = document.getElementById('bkHausbesuchPanel');
  if (!panel) return;
  panel.hidden = !isHb;
  if (!isHb) return;

  const lead = getSelectedBkLead();
  const txt = document.getElementById('bkHbAddressText');
  const addrView = document.getElementById('bkHbAddrView');
  const addrEdit = document.getElementById('bkHbAddrEdit');
  const result = document.getElementById('bkHbResult');
  const err = document.getElementById('bkHbError');
  const cached = document.getElementById('bkHbCached');
  const bufferLine = document.getElementById('bkHbBufferLine');
  const blockTotal = document.getElementById('bkHbBlockTotal');
  err.style.display = 'none';
  err.textContent = '';

  if (!lead) {
    addrView.hidden = false; addrEdit.hidden = true;
    txt.textContent = '— Patient auswählen —';
    result.style.display = 'none';
    bufferLine.style.display = 'none';
    return;
  }

  const hasAddr = !!(lead.street || lead.plz || lead.city);
  if (hasAddr) {
    // View modu: kayıtlı adresi göster
    addrView.hidden = false; addrEdit.hidden = true;
    const parts = [lead.street, [lead.plz, lead.city].filter(Boolean).join(' ')].filter(Boolean);
    txt.textContent = parts.join(', ');
  } else {
    // Adres yok: inline edit aç
    addrView.hidden = true; addrEdit.hidden = false;
    document.getElementById('bkHbStreet').value = '';
    document.getElementById('bkHbPlz').value = '';
    document.getElementById('bkHbCity').value = '';
    document.getElementById('bkHbCancelAddrBtn').hidden = true;
  }

  if (lead.distance_km != null && lead.duration_min != null) {
    document.getElementById('bkHbKm').textContent = `${Number(lead.distance_km).toFixed(1)} km`;
    document.getElementById('bkHbMin').textContent = `${lead.duration_min} min`;
    const when = lead.route_calculated_at ? new Date(lead.route_calculated_at).toLocaleDateString('de-DE') : '';
    cached.textContent = when ? `(gespeichert ${when})` : '';
    result.style.display = '';
    const seance = getBkServiceDurationMin();
    blockTotal.textContent = String(lead.duration_min * 2 + seance + HAUSBESUCH_BUFFER_MIN);
    bufferLine.style.display = '';
  } else {
    result.style.display = 'none';
    bufferLine.style.display = 'none';
  }
}

// Adresi düzenlemek için inline edit'i aç
document.getElementById('bkHbEditAddrBtn')?.addEventListener('click', () => {
  const lead = getSelectedBkLead();
  if (!lead) return;
  document.getElementById('bkHbAddrView').hidden = true;
  document.getElementById('bkHbAddrEdit').hidden = false;
  document.getElementById('bkHbStreet').value = lead.street || '';
  document.getElementById('bkHbPlz').value = lead.plz || '';
  document.getElementById('bkHbCity').value = lead.city || '';
  document.getElementById('bkHbCancelAddrBtn').hidden = false;
});

document.getElementById('bkHbCancelAddrBtn')?.addEventListener('click', refreshBkHausbesuchPanel);

document.getElementById('bkHbSaveAddrBtn')?.addEventListener('click', async () => {
  const lead = getSelectedBkLead();
  if (!lead) { showToast('Bitte zuerst einen Patienten auswählen.', 'error'); return; }
  const street = document.getElementById('bkHbStreet').value.trim();
  const plz = document.getElementById('bkHbPlz').value.trim();
  const city = document.getElementById('bkHbCity').value.trim();
  if (!street || !plz || !city) {
    showToast('Strasse, PLZ und Stadt sind erforderlich.', 'error'); return;
  }
  if (!/^\d{5}$/.test(plz)) { showToast('PLZ muss 5-stellig sein.', 'error'); return; }
  // Adres değişirse cache invalidate
  const { error } = await supabase.from('leads').update({
    street, plz, city,
    lat: null, lng: null,
    distance_km: null, duration_min: null, route_calculated_at: null
  }).eq('id', lead.id);
  if (error) { showToast(error.message, 'error'); return; }
  // In-memory state
  lead.street = street; lead.plz = plz; lead.city = city;
  lead.lat = null; lead.lng = null;
  lead.distance_km = null; lead.duration_min = null; lead.route_calculated_at = null;
  showToast('Adresse gespeichert.');
  refreshBkHausbesuchPanel();
});

document.getElementById('bkHausbesuch')?.addEventListener('change', refreshBkHausbesuchPanel);
document.getElementById('bkService')?.addEventListener('change', refreshBkHausbesuchPanel);

async function invokeFahrtenbuchFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError: error response body in error.context.response
    let detail = error.message || 'Unbekannter Fehler';
    try {
      const ctxRes = error.context?.response || error.response;
      if (ctxRes && typeof ctxRes.json === 'function') {
        const j = await ctxRes.json();
        detail = j.error || j.detail || detail;
      }
    } catch (_) {}
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function ensureClinicLocation() {
  // profiles.clinic_lat/lng yoksa klinik adresini geocode et ve kaydet
  const ownerId = getOwnerId();
  if (!ownerId) throw new Error('Kein Owner');
  const { data: p } = await supabase
    .from('profiles')
    .select('clinic_lat,clinic_lng,street,house_number,zip,city,plz,country')
    .eq('id', ownerId)
    .maybeSingle();
  if (!p) throw new Error('Profil nicht gefunden');
  if (p.clinic_lat != null && p.clinic_lng != null) {
    return { lat: Number(p.clinic_lat), lng: Number(p.clinic_lng) };
  }
  const street = [p.street, p.house_number].filter(Boolean).join(' ').trim();
  const zip = p.zip || p.plz || '';
  const cityPart = [zip, p.city].filter(Boolean).join(' ').trim();
  const fullAddr = [street, cityPart].filter(Boolean).join(', ');
  if (!fullAddr) {
    throw new Error('Klinik-Adresse fehlt in den Einstellungen (Strasse, PLZ, Stadt)');
  }
  const geo = await invokeFahrtenbuchFn('fahrtenbuch-geocode', { address: fullAddr, country: p.country || 'DE' });
  // RPC update is on profiles → only owner can update own row (RLS allows)
  await supabase.from('profiles')
    .update({ clinic_lat: geo.lat, clinic_lng: geo.lng, clinic_geocoded_at: new Date().toISOString() })
    .eq('id', ownerId);
  return { lat: geo.lat, lng: geo.lng };
}

document.getElementById('bkHbBerechnenBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('bkHbBerechnenBtn');
  const err = document.getElementById('bkHbError');
  const result = document.getElementById('bkHbResult');
  err.style.display = 'none'; err.textContent = '';
  const lead = getSelectedBkLead();
  if (!lead) { err.textContent = 'Bitte zuerst einen Patienten auswählen.'; err.style.display = ''; return; }
  if (!lead.street || !lead.plz || !lead.city) {
    err.textContent = 'Adresse unvollständig — Patient bearbeiten.';
    err.style.display = ''; return;
  }

  btn.disabled = true; btn.textContent = '⏳ Berechne…';
  try {
    // 1) Klinik koordinatı
    const clinic = await ensureClinicLocation();

    // 2) Hasta koordinatı — yoksa geocode + leads update
    let leadLat = lead.lat != null ? Number(lead.lat) : null;
    let leadLng = lead.lng != null ? Number(lead.lng) : null;
    if (leadLat == null || leadLng == null) {
      const addr = `${lead.street}, ${lead.plz} ${lead.city}`;
      const geo = await invokeFahrtenbuchFn('fahrtenbuch-geocode', { address: addr });
      leadLat = geo.lat; leadLng = geo.lng;
      await supabase.from('leads').update({ lat: leadLat, lng: leadLng }).eq('id', lead.id);
    }

    // 3) Rota
    const route = await invokeFahrtenbuchFn('fahrtenbuch-route', {
      origin: [clinic.lng, clinic.lat],
      dest: [leadLng, leadLat]
    });

    // 4) Cache
    const nowIso = new Date().toISOString();
    await supabase.from('leads').update({
      distance_km: route.distance_km,
      duration_min: route.duration_min,
      route_calculated_at: nowIso
    }).eq('id', lead.id);

    // 5) In-memory state güncelle
    lead.lat = leadLat; lead.lng = leadLng;
    lead.distance_km = route.distance_km;
    lead.duration_min = route.duration_min;
    lead.route_calculated_at = nowIso;

    // 6) UI refresh
    document.getElementById('bkHbKm').textContent = `${route.distance_km.toFixed(1)} km`;
    document.getElementById('bkHbMin').textContent = `${route.duration_min} min`;
    document.getElementById('bkHbCached').textContent = '(gerade berechnet)';
    result.style.display = '';
    const seance = getBkServiceDurationMin();
    document.getElementById('bkHbBlockTotal').textContent = String(route.duration_min * 2 + seance + HAUSBESUCH_BUFFER_MIN);
    document.getElementById('bkHbBufferLine').style.display = '';
  } catch (e) {
    console.error('[fahrtenbuch-berechnen]', e);
    err.textContent = 'Fehler: ' + e.message;
    err.style.display = '';
  } finally {
    btn.disabled = false; btn.textContent = '📍 Entfernung berechnen';
  }
});

document.getElementById('bkSaveBtn').addEventListener('click', async () => {
  const id = document.getElementById('bk-id').value;
  const empId = document.getElementById('bkEmployee').value;
  const srvId = document.getElementById('bkService').value;
  const startV = document.getElementById('bkStart').value;
  let cust = document.getElementById('bkCustomer').value.trim();
  let custId = document.getElementById('bkCustomerId').value.trim();
  const phone = document.getElementById('bkPhone').value.trim();
  const notes = document.getElementById('bkNotes').value.trim();

  // Validation: Required fields
  if (!empId) { showToast('Bitte einen Mitarbeiter auswählen.', 'error'); return; }
  if (!srvId) { showToast('Bitte eine Dienstleistung auswählen.', 'error'); return; }
  if (!startV) { showToast('Bitte Datum und Uhrzeit auswählen.', 'error'); return; }

  // Robust customer resolution: if hidden fields are empty but the search
  // input shows a name, try to match a lead and use it.
  if (!custId) {
    const searchEl = document.getElementById('bkCustomerSearch');
    const searchTxt = (searchEl?.value || '').trim();
    if (searchTxt && Array.isArray(window.bkAllLeads)) {
      const lower = searchTxt.toLowerCase();
      const match = window.bkAllLeads.find(l =>
        (displayNameWithBirth(l) || '').toLowerCase() === lower ||
        (l.title || '').toLowerCase() === lower
      ) || window.bkAllLeads.find(l => (l.title || '').toLowerCase().startsWith(lower));
      if (match) {
        custId = match.id;
        cust = displayNameWithBirth(match);
        document.getElementById('bkCustomer').value = cust;
        document.getElementById('bkCustomerId').value = custId;
      }
    }
  }
  const isGroup = document.getElementById('bkIsGroup')?.checked || false;
  if (!isGroup) {
    if (!cust || !custId) { showToast('Bitte einen Kunden aus der Liste auswählen.', 'error'); return; }
  }

  const startDate = new Date(startV);
  const now = new Date();
  if (startDate < now) { showToast('Termine in der Vergangenheit können nicht gebucht werden.', 'error'); return; }

  const durGroup = document.getElementById('bkDurationGroup');
  const durOptions = document.getElementById('bkDurationOptions');
  let dur = ownerServices.find(s => s.id === srvId)?.duration_minutes || 30;
  // Read from radio whether group is hidden or visible (single-option case keeps the radio)
  const checkedRadio = (durOptions || durGroup)?.querySelector('input[type="radio"]:checked');
  if (checkedRadio) dur = parseInt(checkedRadio.value);

  // Fahrtenbuch: Hausbesuch ise end_time = gidiş + seans + dönüş + 10 dk buffer
  const isHausbesuch = document.getElementById('bkHausbesuch').checked;
  let totalBlockMin = dur;
  if (isHausbesuch) {
    const selLead = getSelectedBkLead();
    if (!selLead) {
      showToast('Bitte zuerst den Patienten auswählen.', 'error'); return;
    }
    if (!selLead.street || !selLead.plz || !selLead.city) {
      showToast('Hausbesuch: Patientenadresse fehlt — Patient bearbeiten.', 'error'); return;
    }
    if (selLead.duration_min == null) {
      showToast('Bitte zuerst "Entfernung berechnen" klicken.', 'error'); return;
    }
    totalBlockMin = Number(selLead.duration_min) * 2 + dur + HAUSBESUCH_BUFFER_MIN;
  }

  const startIso = new Date(startV).toISOString();
  const endIso = new Date(new Date(startV).getTime() + totalBlockMin * 60000).toISOString();

  const isSeries = document.getElementById('bkSeriesToggle').checked && !id;
  if (isSeries) {
    const dateStr = startV.substring(0, 10);
    const timeStr = startV.substring(11, 16);
    const count = parseInt(document.getElementById('bkSeriesCount').value) || 8;
    const rec = document.getElementById('bkSeriesRecurrence').value;
    const checked = Array.from(document.querySelectorAll('#bkSeriesWeekdays input:checked')).map(cb => parseInt(cb.value));
    const durMin = dur;
    const payload = {
      userId: empId,
      ownerId: getOwnerId(),
      serviceId: srvId,
      startDate: dateStr,
      time: timeStr,
      recurrence: rec,
      weekdays: checked.length ? checked : [new Date(dateStr + 'T12:00:00Z').getDay()],
      count: count,
      customerName: cust,
      customerPhone: phone || null,
      notes: notes || null,
      duration: durMin,
      hausbesuch: document.getElementById('bkHausbesuch').checked || false
    };
    const res = await fetch('https://n8n.infinitymade.de/api/booking/batch-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { showToast('Fehler beim Erstellen der Serientermine.', 'error'); return; }
    const data = await res.json();
    const created = data.created || [];
    const conflicts = data.conflicts || [];
    closeModal('bookingModal');
    await refreshBookingViews();
    if (conflicts.length > 0) {
      showToast(`${created.length} Termine erstellt, ${conflicts.length} übersprungen (Konflikt).`);
    } else {
      showToast(`${created.length} Termine erstellt.`);
    }
    return;
  }

  if (isGroup) {
    const groupCapacity = parseInt(document.getElementById('bkGroupCapacity').value) || 5;
    if (id) {
      // Update existing group booking
      const parentPayload = {
        user_id: empId,
        service_id: srvId,
        start_time: startIso,
        end_time: endIso,
        notes: notes || null,
        hausbesuch: document.getElementById('bkHausbesuch').checked || false,
        group_capacity: groupCapacity
      };
      
      const { error: upErr } = await supabase
        .from('bookings')
        .update(parentPayload)
        .eq('id', id);
        
      if (upErr) {
        console.error('[group parent update]', upErr);
        showToast(upErr.message || t('err_generic'), 'error');
        return;
      }
      
      // Keep children perfectly in sync
      const { error: syncErr } = await supabase
        .from('bookings')
        .update({
          user_id: empId,
          service_id: srvId,
          start_time: startIso,
          end_time: endIso,
          hausbesuch: parentPayload.hausbesuch
        })
        .eq('group_parent_id', id);
        
      if (syncErr) {
        console.error('[group children sync]', syncErr);
      }
      
      showToast('Gruppentermin erfolgreich aktualisiert.');
    } else {
      // Create a brand new group booking
      const parentPayload = {
        owner_id: getOwnerId(),
        user_id: empId,
        service_id: srvId,
        start_time: startIso,
        end_time: endIso,
        customer_name: 'Gruppe: ' + ((window.ownerServices || []).find(s => s.id === srvId)?.title || 'Gruppentermin'),
        customer_email: 'group@booking.com',
        notes: notes || null,
        hausbesuch: document.getElementById('bkHausbesuch').checked || false,
        status: 'confirmed',
        is_group: true,
        group_capacity: groupCapacity
      };
      
      const { data: parentBooking, error: pErr } = await supabase
        .from('bookings')
        .insert(parentPayload)
        .select()
        .single();
        
      if (pErr) {
        console.error('[group parent save]', pErr);
        showToast(bookingErrMsg(pErr), 'error');
        return;
      }
      
      // Now insert child bookings
      const patients = window.bkSelectedGroupPatients || [];
      if (patients.length > 0) {
        const childPayloads = patients.map(p => ({
          owner_id: getOwnerId(),
          user_id: empId,
          service_id: srvId,
          start_time: startIso,
          end_time: endIso,
          customer_name: p.name,
          customer_phone: p.phone || null,
          notes: notes || null,
          hausbesuch: document.getElementById('bkHausbesuch').checked || false,
          status: 'confirmed',
          group_parent_id: parentBooking.id,
          lead_id: p.id
        }));
        const { error: cErr } = await supabase.from('bookings').insert(childPayloads);
        if (cErr) {
          console.error('[group children save]', cErr);
          showToast('Gruppe erstellt, Fehler bei Teilnehmern: ' + cErr.message, 'warning');
        }
      }
      
      showToast('Gruppentermin erfolgreich erstellt.');
    }
    
    closeModal('bookingModal');
    await refreshBookingViews();
    return;
  }

  const payload = {
    owner_id: getOwnerId(), user_id: empId,
    service_id: srvId,
    start_time: startIso,
    end_time: endIso,
    customer_name: cust, customer_email: '', customer_phone: phone || null,
    notes: notes || null,
    hausbesuch: document.getElementById('bkHausbesuch').checked || false,
    status: 'confirmed',
    lead_id: custId || null
  };
  const { error } = id
    ? await supabase.from('bookings').update(payload).eq('id', id)
    : await supabase.from('bookings').insert(payload);
  if (error) { console.error('[booking save]', error); showToast(bookingErrMsg(error), 'error'); return; }
  closeModal('bookingModal');
  await refreshBookingViews();
  showToast(t('saved'));
});

// ============================================================
// AI Series Scheduler — KI-Vorschlag flow
// ============================================================
const AI_SUGGEST_URL = 'https://n8n.infinitymade.de/api/booking/ai-suggest-series';
const AI_BATCH_URL = 'https://n8n.infinitymade.de/api/booking/batch-create-explicit';
window._aiCtx = null; // holds last context for retry

document.getElementById('bkAiSuggestBtn').addEventListener('click', () => {
  const empId = document.getElementById('bkEmployee').value;
  const srvId = document.getElementById('bkService').value;
  const custId = document.getElementById('bkCustomerId').value.trim();
  const cust = document.getElementById('bkCustomer').value.trim();

  if (!empId) { showToast('Bitte zuerst einen Mitarbeiter auswählen.', 'error'); return; }
  if (!srvId) { showToast('Bitte zuerst eine Dienstleistung auswählen.', 'error'); return; }
  if (!custId || !cust) { showToast('Bitte zuerst einen Kunden auswählen.', 'error'); return; }

  // Open preferences modal
  document.getElementById('aiPrefSameEmp').value = 'preferred';
  document.getElementById('aiPrefTimeOfDay').value = 'any';
  document.getElementById('aiPrefNotes').value = '';
  openModal('aiPrefsModal');
});

document.getElementById('aiPrefSubmit').addEventListener('click', async () => {
  const empId = document.getElementById('bkEmployee').value;
  const srvId = document.getElementById('bkService').value;
  const custId = document.getElementById('bkCustomerId').value.trim();
  const count = parseInt(document.getElementById('bkSeriesCount').value) || 8;
  const recurrence = document.getElementById('bkSeriesRecurrence').value;
  const startV = document.getElementById('bkStart').value;
  const preferredTime = startV ? startV.substring(11, 16) : null;
  const startDate = startV ? startV.substring(0, 10) : null;
  const weekdays = Array.from(document.querySelectorAll('#bkSeriesWeekdays input:checked'))
    .map(cb => parseInt(cb.value));

  const preferences = {
    sameEmployee: document.getElementById('aiPrefSameEmp').value,
    timeOfDay: document.getElementById('aiPrefTimeOfDay').value,
    notes: document.getElementById('aiPrefNotes').value.trim()
  };

  closeModal('aiPrefsModal');

  showToast('🤖 KI sucht passende Termine…', 'info');

  const payload = {
    ownerId: getOwnerId(),
    serviceId: srvId,
    customerId: custId,
    employeeId: empId,
    count,
    recurrence,
    startDate,
    weekdays,
    preferredTime,
    preferences
  };

  window._aiCtx = { payload, baseEmpId: empId };

  try {
    const res = await fetch(AI_SUGGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast('Fehler: ' + (json.error || 'Vorschlag fehlgeschlagen'), 'error');
      return;
    }
    if (!json.selected || json.selected.length === 0) {
      showToast('Keine passenden Termine im Suchzeitraum.', 'error');
      return;
    }
    window._aiCtx.lastResult = json;
    renderAiSuggestions(json);
  } catch (err) {
    console.error('[ai-suggest]', err);
    showToast('Netzwerkfehler beim Abrufen der Vorschläge.', 'error');
  }
});

function renderAiSuggestions(json) {
  const reportEl = document.getElementById('aiSuggestReport');
  reportEl.textContent = json.report || 'Hier sind die KI-Vorschläge:';

  const empMap = {};
  (json.employees || []).forEach(e => { empMap[e.id] = e.name; });

  const listEl = document.getElementById('aiSuggestList');
  const fmtWd = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  listEl.innerHTML = json.selected.map((s, i) => {
    const wd = fmtWd(s.date);
    const empName = empMap[s.employeeId] || 'Mitarbeiter';
    const isDifferent = s.employeeId !== window._aiCtx.baseEmpId;
    const shiftBadges = [];
    if (s.dateShiftDays != null && s.shiftedFromDate) {
      const sign = s.dateShiftDays > 0 ? '+' : '';
      shiftBadges.push(`<span class="ai-slot-shift-badge" title="Wunschtag war ${fmtWd(s.shiftedFromDate)} — auf diesen Tag verschoben (Wunschtag voll belegt)"><span class="svg-icon" style="width:13px;height:13px;display:inline-flex;vertical-align:-2px;margin-right:4px;">${ICON.warning}</span>Tag verschoben (${sign}${s.dateShiftDays}d)</span>`);
    } else if (s.timeShiftMin != null) {
      const sign = s.timeShiftMin > 0 ? '+' : '';
      shiftBadges.push(`<span class="ai-slot-shift-badge" title="Wunschzeit war belegt — um ${s.timeShiftMin} Min verschoben">⏱ Zeit verschoben (${sign}${s.timeShiftMin} Min)</span>`);
    }
    return `<div class="ai-slot-row">
      <div class="ai-slot-num">${i + 1}</div>
      <div class="ai-slot-main">
        <div class="ai-slot-date"><span class="svg-icon" style="width:14px;height:14px;display:inline-flex;vertical-align:-2px;margin-right:4px;opacity:0.75;">${ICON.calendar}</span>${wd} · ${escapeHtml(s.time)} Uhr ${shiftBadges.join(' ')}</div>
        <div class="ai-slot-emp${isDifferent ? ' is-switch' : ''}">
          <span class="svg-icon" style="width:14px;height:14px;display:inline-flex;vertical-align:-2px;margin-right:4px;opacity:0.75;">${ICON.user}</span>${escapeHtml(empName)}${isDifferent ? '<span class="ai-slot-switch-badge">Wechsel</span>' : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  openModal('aiSuggestModal');
}

document.getElementById('aiSuggestRetry').addEventListener('click', async () => {
  if (!window._aiCtx?.payload) return;
  closeModal('aiSuggestModal');
  showToast('🤖 Suche andere Vorschläge…', 'info');
  try {
    const res = await fetch(AI_SUGGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(window._aiCtx.payload)
    });
    const json = await res.json();
    if (json.success && json.selected?.length) {
      window._aiCtx.lastResult = json;
      renderAiSuggestions(json);
    } else {
      showToast('Keine weiteren Vorschläge.', 'error');
    }
  } catch (err) {
    showToast('Netzwerkfehler.', 'error');
  }
});

document.getElementById('aiSuggestConfirm').addEventListener('click', async () => {
  if (!window._aiCtx?.lastResult) return;
  const { selected, service } = window._aiCtx.lastResult;
  const cust = document.getElementById('bkCustomer').value.trim();
  const custIdAtConfirm = document.getElementById('bkCustomerId').value.trim() || null;
  const phone = document.getElementById('bkPhone').value.trim();
  const notes = document.getElementById('bkNotes').value.trim();
  const hausbesuch = document.getElementById('bkHausbesuch').checked;

  const payload = {
    ownerId: getOwnerId(),
    serviceId: service?.id || document.getElementById('bkService').value,
    duration: service?.duration,
    slots: selected,
    customerName: cust,
    customerPhone: phone || null,
    notes: notes || null,
    hausbesuch
  };

  try {
    const res = await fetch(AI_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    closeModal('aiSuggestModal');
    closeModal('bookingModal');
    await refreshBookingViews();
    if (json.conflicts?.length) {
      showToast(`${json.created?.length || 0} erstellt, ${json.conflicts.length} übersprungen (Konflikt).`);
    } else {
      showToast(`${json.created?.length || 0} Termine erfolgreich erstellt.`);
    }

    // Phase 3.1: link each booking to a prescription_session (physio flow only)
    if (json.created?.length && window._physioFlow?.prescription_id) {
      await linkBookingsToPrescriptionSessions(window._physioFlow.prescription_id, json.created);
    }

    // Phase 3: post-batch-create — ask if patient should be emailed
    if (json.created?.length) {
      // Fallback: if hidden id field was cleared, derive from physio flow context or name lookup
      let custId = custIdAtConfirm || window._physioFlow?.patient_id || null;
      if (!custId && cust) {
        const match = leadsCache.find(l =>
          (l.title || '').toLowerCase() === cust.toLowerCase() ||
          [(l.first_name || ''), (l.last_name || '')].filter(Boolean).join(' ').toLowerCase() === cust.toLowerCase()
        );
        if (match) custId = match.id;
      }
      await maybeOfferAppointmentConfirmEmail({
        slots: selected,
        service,
        custId,
        custName: cust,
        empMap: (window._aiCtx?.lastResult?.employees || []).reduce((a, e) => (a[e.id] = e.name, a), {})
      });
    }
  } catch (err) {
    console.error('[ai-confirm]', err);
    showToast('Fehler beim Erstellen der Termine.', 'error');
  }
});

function showConfirmModal({ title = 'Bestätigen', message = '', confirmText = 'Bestätigen', cancelText = 'Abbrechen', variant = 'primary' } = {}) {
  return new Promise(resolve => {
    const titleEl = document.getElementById('confirmModalTitle');
    const textEl = document.getElementById('confirmModalText');
    const okBtn = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const closeBtn = document.querySelector('#confirmModal .modal-close');
    titleEl.innerHTML = title;
    textEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    okBtn.className = variant === 'danger' ? 'btn-danger' : 'btn-primary';

    const cleanup = (val) => {
      okBtn.onclick = null; cancelBtn.onclick = null; closeBtn.onclick = null;
      closeModal('confirmModal');
      resolve(val);
    };
    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    closeBtn.onclick = () => cleanup(false);
    openModal('confirmModal');
  });
}

function openMailOfferModal({ hasEmail, patientName }) {
  return new Promise(resolve => {
    const modal = document.getElementById('mailOfferModal');
    const textEl = document.getElementById('mailOfferText');
    const emailWrap = document.getElementById('mailOfferEmailWrap');
    const emailInput = document.getElementById('mailOfferEmail');
    const yesBtn = document.getElementById('mailOfferYesBtn');
    const noBtn = document.getElementById('mailOfferNoBtn');
    const closeBtn = modal.querySelector('.modal-close');

    textEl.textContent = hasEmail
      ? `Möchten Sie ${patientName || 'dem Patienten'} die erstellten Termine per E-Mail bestätigen?`
      : `Wir haben keine E-Mail-Adresse für ${patientName || 'den Patienten'}. Bitte fragen Sie nach und tragen Sie sie unten ein — oder überspringen.`;
    emailWrap.hidden = hasEmail;
    emailInput.value = '';

    const cleanup = () => {
      yesBtn.onclick = null; noBtn.onclick = null; closeBtn.onclick = null;
      closeModal('mailOfferModal');
    };
    yesBtn.onclick = () => {
      if (!hasEmail) {
        const val = (emailInput.value || '').trim();
        if (!val.includes('@')) {
          emailInput.focus();
          emailInput.style.borderColor = '#e74c3c';
          return;
        }
        cleanup();
        resolve({ ok: true, email: val });
      } else {
        cleanup();
        resolve({ ok: true });
      }
    };
    noBtn.onclick = () => { cleanup(); resolve({ ok: false }); };
    closeBtn.onclick = () => { cleanup(); resolve({ ok: false }); };

    openModal('mailOfferModal');
  });
}

async function markPrescriptionSession(bookingId, status) {
  if (!bookingId) return;
  try {
    const patch = { status };
    if (status === 'done') patch.done_at = new Date().toISOString();
    const { data: sess, error } = await supabase
      .from('prescription_sessions')
      .update(patch).eq('booking_id', bookingId)
      .select('prescription_id').maybeSingle();
    if (error) { console.warn('[session update]', error); return; }
    if (!sess?.prescription_id) return;

    // If all sessions are done, promote prescription to 'completed'
    const { count: openCount } = await supabase
      .from('prescription_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('prescription_id', sess.prescription_id)
      .neq('status', 'done');
    if ((openCount || 0) === 0) {
      await supabase.from('prescriptions')
        .update({ status: 'completed' }).eq('id', sess.prescription_id)
        .in('status', ['parsed', 'confirmed', 'in_therapy']);
      // §302 GKV flip: mark prescription "abrechnungsbereit" so it appears on
      // the Kassenabrechnung page. Only when the Krankenkasse is known AND
      // no abrechnung_status was already set (manual override wins).
      await supabase.from('prescriptions')
        .update({ abrechnung_status: 'bereit' })
        .eq('id', sess.prescription_id)
        .is('abrechnung_status', null)
        .not('kostentraeger_ik', 'is', null);
    } else {
      // Otherwise ensure 'in_therapy' once treatment has begun
      await supabase.from('prescriptions')
        .update({ status: 'in_therapy' }).eq('id', sess.prescription_id)
        .in('status', ['parsed', 'confirmed']);
    }
  } catch (e) {
    console.warn('[markPrescriptionSession]', e);
  }
}

async function decorateBookingTitleWithSession(bookingId) {
  const { data: sess } = await supabase
    .from('prescription_sessions')
    .select('session_number, prescription_id, prescriptions ( anzahl_einheiten, heilmittel )')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (!sess) return;
  const total = sess.prescriptions?.anzahl_einheiten || '?';
  const hm = sess.prescriptions?.heilmittel ? ` · ${sess.prescriptions.heilmittel}` : '';
  const titleEl = document.getElementById('bookingModalTitle');
  if (titleEl) titleEl.textContent = `${t('lbl_manual_title')} — Sitzung ${sess.session_number}/${total}${hm}`;
}

async function linkBookingsToPrescriptionSessions(prescriptionId, created) {
  try {
    const bookingIds = (created || [])
      .map(b => (typeof b === 'string' ? b : b?.id || b?.booking_id))
      .filter(Boolean);
    if (!bookingIds.length) return;

    // Continue numbering after any existing sessions for this Rx
    const { data: existing } = await supabase
      .from('prescription_sessions')
      .select('session_number')
      .eq('prescription_id', prescriptionId)
      .order('session_number', { ascending: false })
      .limit(1);
    let next = (existing?.[0]?.session_number || 0) + 1;

    const rows = bookingIds.map((bid, i) => ({
      prescription_id: prescriptionId,
      booking_id: bid,
      session_number: next + i,
      status: 'planned'
    }));
    const { error } = await supabase.from('prescription_sessions').insert(rows);
    if (error) console.warn('[prescription_sessions insert]', error);
  } catch (e) {
    console.warn('[linkBookingsToPrescriptionSessions]', e);
  }
}

async function maybeOfferAppointmentConfirmEmail({ slots, service, custId, custName, empMap }) {
  let lead = custId ? leadsCache.find(l => l.id === custId) : null;
  let email = lead?.email || '';

  // Cache may be stale (patient just created by rezept-confirm). Fetch fresh.
  if (custId && !email) {
    const { data: fresh } = await supabase
      .from('leads').select('id,email,phone,title,first_name,last_name')
      .eq('id', custId).maybeSingle();
    if (fresh) {
      email = fresh.email || '';
      if (lead) Object.assign(lead, fresh);
      else { lead = fresh; leadsCache.push(fresh); }
    }
  }
  if (!custId && !email) return;

  const offer = await openMailOfferModal({ hasEmail: !!email, patientName: custName });
  if (!offer.ok) {
    showToast('OK — weiter zur Rechnung.');
    proceedToRechnungForPhysio({ patientId: custId, patientName: custName });
    return;
  }

  if (!email) {
    email = offer.email;
    if (lead) {
      await supabase.from('leads').update({ email }).eq('id', lead.id);
      lead.email = email;
    }
  }

  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) throw new Error('Nicht angemeldet');

    const payload = {
      patient: { name: custName, email },
      service: { title: service?.title || '' },
      slots: (slots || []).map(sl => ({
        date: sl.date, time: sl.time,
        employeeName: empMap[sl.employeeId] || ''
      })),
      owner_info: {
        business_name: currentProfile.business_name,
        sender_name: currentProfile.b2b_sender_name || currentProfile.business_name || '',
        city: currentProfile.city || '',
        phone: currentProfile.phone || ''
      }
    };

    showToast('⏳ KI bereitet Bestätigungs-E-Mail vor…');
    const res = await fetch(`${AI_GATEWAY_BASE}/appointment-confirm-draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.access_token
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success || !json.draft) throw new Error(json.error || 'Entwurf fehlgeschlagen');

    const draft = json.draft;
    if (!draft.to_email) draft.to_email = email;
    if (!draft.to_name) draft.to_name = custName;
    if (lead) draft.contact_id = lead.id;
    // After send/discard, proceed to Rechnung
    window._composePostFlow = () => proceedToRechnungForPhysio({ patientId: custId, patientName: custName });
    openComposeModal(draft);
  } catch (e) {
    console.error('[appointment-confirm-draft]', e);
    showToast('Fehler: ' + e.message, 'error');
  }
}

// Lazy-creates the two internal services (Prozessdokumentation + Mehraufwand)
// per owner so the Blanko bonus lines reference real catalog entries.
// Marked is_internal=true so they're hidden from customer-facing pickers.
const BLANKO_BONUS_DEFINITIONS = [
  { title: 'Prozessdokumentation (Blanko)', price: '34.34', duration: 0, code: 'BLANKO_PD' },
  { title: 'Mehraufwand (Blanko)', price: '55.00', duration: 0, code: 'BLANKO_MA' }
];

async function ensureBlankoBonusServices() {
  const ownerId = getOwnerId();
  const titles = BLANKO_BONUS_DEFINITIONS.map(d => d.title);
  const { data: existing } = await supabase.from('services')
    .select('id, title, price, code, is_internal')
    .eq('owner_id', ownerId)
    .in('title', titles);
  const existingMap = new Map((existing || []).map(s => [s.title, s]));
  const result = [];
  for (const def of BLANKO_BONUS_DEFINITIONS) {
    const hit = existingMap.get(def.title);
    if (hit) {
      // If found but flag missing, normalize it once
      if (!hit.is_internal) {
        await supabase.from('services').update({ is_internal: true }).eq('id', hit.id);
      }
      result.push(hit);
    } else {
      const { data: inserted, error } = await supabase.from('services').insert({
        owner_id: ownerId,
        user_id: ownerId,
        title: def.title,
        price: def.price,
        duration_minutes: def.duration,
        code: def.code,
        is_internal: true,
        description: 'Automatisch erstellt für Blanko-Verordnungs-Abrechnung. Tarif in den Dienstleistungen anpassen.'
      }).select('id, title, price, code, is_internal').maybeSingle();
      if (error) { console.warn('[ensureBlankoBonus]', error); continue; }
      if (inserted) {
        result.push(inserted);
        // Keep the global cache in sync so the invoice line dropdown finds the new service
        if (Array.isArray(ownerServices) && !ownerServices.some(s => s.id === inserted.id)) {
          ownerServices.push(inserted);
        }
      }
    }
  }
  return result;
}

async function proceedToRechnungForPhysio({ patientId, patientName }) {
  const flow = window._physioFlow || {};
  const isBlanko = !!flow.is_blanko;
  const prescriptionId = flow.prescription_id || null;
  try {
    switchPanel('rechnungen');

    // Wait for panel + invoice list to mount
    await new Promise(r => setTimeout(r, 350));
    if (!patientId) {
      showToast('Rechnungen-Übersicht geöffnet (Patient nicht erkannt).', 'info');
      return;
    }
    await openInvEditor(null);
    invPrescriptionId = prescriptionId;

    const sel = document.getElementById('invPatientSelect');
    if (sel) {
      sel.value = patientId;
      sel.dispatchEvent(new Event('change'));
    }

    // Wait for bookings to populate, then check them all
    await new Promise(r => setTimeout(r, 600));
    const checks = document.querySelectorAll('#invBookingChecks input[type="checkbox"]');
    checks.forEach(cb => { cb.checked = true; });
    if (checks.length) checks[0].dispatchEvent(new Event('change'));

    // Inject Blanko bonus (PD + Mehraufwand) if applicable
    if (isBlanko) {
      const bonusServices = await ensureBlankoBonusServices();
      const exists = (title) => invLines.some(l => (l.title || '').toLowerCase().includes(title.toLowerCase()));
      bonusServices.forEach(svc => {
        if (!exists(svc.title)) {
          invLines.push({ title: svc.title, quantity: 1, unit_price: parseFloat(svc.price) || 0 });
        }
      });
      renderInvLines(); calcInvTotals();
      showToast(`Rechnung vorbereitet für ${patientName} (Blanko-Bonus enjekte).`);
    } else {
      showToast(`Rechnung vorbereitet für ${patientName}.`);
    }
    window._physioFlow = null;
  } catch (e) {
    console.error('[proceedToRechnung]', e);
    showToast('Fehler beim Öffnen der Rechnung: ' + e.message, 'error');
  }
}

document.getElementById('bkDeleteBtn').addEventListener('click', async () => {
  const id = document.getElementById('bk-id').value;
  if (!id) return;
  const ok = await showConfirmModal({
    title: 'Termin löschen?',
    message: t('lead_confirm_delete'),
    confirmText: 'Löschen',
    cancelText: 'Abbrechen',
    variant: 'danger'
  });
  if (!ok) return;

  // 1. Pre-trigger the match API call before deletion so the backend can fetch the booking details
  let matchPromise = null;
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    matchPromise = fetch(`${API}/warteliste/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ booking_id: id })
    }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  } catch (err) {
    console.error('[warteliste-match pre-trigger error]', err);
  }

  // 2. Perform the deletion
  const { error: delErr } = await supabase.from('bookings').delete().eq('id', id);
  if (delErr) {
    showToast('Fehler beim Löschen des Termins: ' + delErr.message, 'error');
    return;
  }

  // 3. Complete the UI cancel flow
  closeModal('bookingModal');
  await refreshBookingViews();
  showToast(t('saved'));

  // 4. Await and process match results asynchronously (guaranteed not to block the cancel flow)
  if (matchPromise) {
    try {
      const matchRes = await matchPromise;
      const { candidates, total } = matchRes;
      if (total > 0) {
        showWaitlistMatchModal(candidates);
      } else {
        showToast("Keine passenden Warteliste-Patienten.", "info");
      }
    } catch (err) {
      console.error('[warteliste-match fetch error]', err);
      showToast("Keine passenden Warteliste-Patienten.", "info");
    }
  }
});

// Click handler for search button in edit/details modal
document.getElementById('bkWlMatchBtn')?.addEventListener('click', async () => {
  const id = document.getElementById('bk-id').value;
  if (!id) return;
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch(`${API}/warteliste/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ booking_id: id })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { candidates, total } = await res.json();
    if (total > 0) {
      showWaitlistMatchModal(candidates);
    } else {
      showToast("Keine passenden Warteliste-Patienten.", "info");
    }
  } catch (err) {
    console.error('[bkWlMatchBtn error]', err);
    showToast("Warteliste-Abgleich fehlgeschlagen: " + err.message, "error");
  }
});

// Render matched candidates in the wlMatchModal
function showWaitlistMatchModal(candidates) {
  const listEl = document.getElementById('wlMatchList');
  if (!listEl) return;

  listEl.innerHTML = candidates.map(c => {
    const firstName = c.leads?.first_name || '';
    const lastName = c.leads?.last_name || '';
    const name = (firstName + ' ' + lastName).trim() || 'Unbekannter Patient';
    const phone = c.leads?.phone || '';
    const email = c.leads?.email || '';
    const priority = c.priority || 1;
    const notes = c.notes || '';

    let priorityBadge = '';
    if (priority === 3) {
      priorityBadge = `<span class="badge badge-red">Dringend</span>`;
    } else if (priority === 2) {
      priorityBadge = `<span class="badge badge-yellow">Hoch</span>`;
    } else {
      priorityBadge = `<span class="badge badge-gray">Normal</span>`;
    }

    const contactMethods = [];
    if (phone) {
      contactMethods.push(`<a href="tel:${escapeHtml(phone)}" style="color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:500;">📞 ${escapeHtml(phone)}</a>`);
    }
    if (email) {
      contactMethods.push(`<a href="mailto:${escapeHtml(email)}" style="color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:500;">✉️ ${escapeHtml(email)}</a>`);
    }
    const contactsHtml = contactMethods.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;">${contactMethods.join('')}</div>`
      : `<div style="color:var(--text-muted);font-size:12px;margin-top:8px;">Keine Kontaktdaten vorhanden.</div>`;

    const notesHtml = notes
      ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);word-break:break-word;">
           <strong>Notiz:</strong> ${escapeHtml(notes)}
         </div>`
      : '';

    return `
      <div class="wl-candidate-card" style="border:1px solid var(--border);background:var(--bg-card);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:4px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <strong style="font-size:14px;color:var(--text);">${escapeHtml(name)}</strong>
          ${priorityBadge}
        </div>
        ${contactsHtml}
        ${notesHtml}
      </div>
    `;
  }).join('');

  openModal('wlMatchModal');
}

(function bindSeriesEvents() {
  const toggle = document.getElementById('bkSeriesToggle');
  const fields = document.getElementById('bkSeriesFields');
  const countEl = document.getElementById('bkSeriesCount');
  const recEl = document.getElementById('bkSeriesRecurrence');
  const wdWrap = document.getElementById('bkSeriesWeekdayWrap');
  const startEl = document.getElementById('bkStart');
  if (toggle) toggle.onchange = () => {
    fields.hidden = !toggle.checked;
    if (toggle.checked) updateBkSeriesPreview();
  };
  if (countEl) countEl.oninput = updateBkSeriesPreview;
  if (recEl) recEl.onchange = () => {
    wdWrap.hidden = recEl.value === 'daily';
    updateBkSeriesPreview();
  };
  if (startEl) startEl.onchange = updateBkSeriesPreview;
  document.querySelectorAll('#bkSeriesWeekdays input').forEach(cb => {
    cb.onchange = updateBkSeriesPreview;
  });
})();

document.getElementById('bkActionStartBtn').addEventListener('click', handleTerminStarten);
document.getElementById('bkActionNoShowBtn').addEventListener('click', handlePatientNichtErschienen);

document.getElementById('leaveSaveBtn').addEventListener('click', async () => {
  const empId = document.getElementById('leaveEmployee').value;
  const start = document.getElementById('leaveStart').value;
  const end = document.getElementById('leaveEnd').value;
  const reason = document.getElementById('leaveReason').value.trim();
  if (!start || !end) { showToast(t('err_generic'), 'error'); return; }
  const { error } = await supabase.from('time_offs').insert({
    employee_id: empId,
    start_date: new Date(start + 'T00:00:00').toISOString(),
    end_date: new Date(end + 'T23:59:59').toISOString(),
    reason
  });
  if (error) { showToast(t('err_generic'), 'error'); return; }
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
function leadBirthDate(lead) {
  const md = lead.metadata || {};
  return lead.geburtsdatum || md.geburtsdatum || null;
}
function displayNameWithBirth(lead) {
  const name = displayName(lead);
  const bd = leadBirthDate(lead);
  return bd ? `${name} · ${bd}` : name;
}

async function loadLeads() {
  const ownerId = getOwnerId();
  let q = supabase.from('leads').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
  q = bizScope(q, 'patients');
  const { data } = await q;
  leadsCache = data || [];
  const phones = leadsCache.map(l => l.phone_normalized).filter(Boolean);
  leadsMeta = {};
  if (phones.length) {
    let bkQ = supabase.from('bookings').select('id,customer_phone_normalized,start_time,status')
      .eq('owner_id', ownerId).in('customer_phone_normalized', phones).order('start_time', { ascending: true });
    bkQ = bizScope(bkQ, 'patients');
    const { data: bkData } = await bkQ;
    // wa_contacts tablosu 2026-05-22'de DROP edildi (WhatsApp shelved). wa metadata kalktı.
    (bkData || []).forEach(b => {
      if (!leadsMeta[b.customer_phone_normalized]) leadsMeta[b.customer_phone_normalized] = { bookings: [], wa: null };
      leadsMeta[b.customer_phone_normalized].bookings.push(b);
    });
  }
  renderLeads();
}

function normalize_phone_js(p) {
  if (!p) return null;
  let c = p.replace(/[^0-9+]/g, '');
  if (c.startsWith('+')) return c;
  if (c.startsWith('00')) return '+' + c.slice(2);
  if (c.startsWith('0')) return '+49' + c.slice(1);
  if (c.length === 11 && c.startsWith('49')) return '+' + c;
  if (c.length >= 10) return '+' + c;
  return c;
}

function renderLeads() {
  const tbody = document.getElementById('leadTableBody');
  const emptyEl = document.getElementById('leadEmpty');
  let rows = leadsCache;
  if (leadFilter !== 'all') rows = rows.filter(r => r.status === leadFilter);
  if (leadSearchVal) {
    const q = leadSearchVal.toLowerCase();
    rows = rows.filter(r => displayNameWithBirth(r).toLowerCase().includes(q) || (r.city || '').toLowerCase().includes(q) || (r.phone || '').toLowerCase().includes(q));
  }
  if (rows.length === 0) { tbody.innerHTML = ''; emptyEl.hidden = false; return; }
  emptyEl.hidden = true;
  // Standort lookup: lead.business_id → business_name
  const bizNameById = new Map((myBusinesses || []).map(b => [b.id, b.business_name]));
  tbody.innerHTML = rows.map(r => {
    const meta = leadsMeta[r.phone_normalized] || {};
    const bkCount = meta.bookings?.length || 0;
    const hasWa = !!meta.wa;
    const bd = leadBirthDate(r);
    const sessionLabel = bkCount > 0 ? `Seans ${bkCount + 1}` : '';
    const standort = bizNameById.get(r.business_id) || '—';
    return `<tr class="lead-row" data-lead-id="${r.id}" style="cursor:pointer;">
      <td>${displayName(r)}${bd ? ` <span style="color:var(--text-muted);font-size:12px;">· ${bd}</span>` : ''}</td>
      <td>${r.city || '—'}</td>
      <td>${r.phone || '—'}</td>
      <td>${r.email || '—'}</td>
      <td>${escapeHtml(standort)}</td>
      <td>
        ${sessionLabel ? `<span class="badge badge-blue">${sessionLabel}</span> ` : ''}${hasWa ? `<span class="badge badge-green" title="WhatsApp" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;vertical-align:middle;"><span class="svg-icon" style="width:11px;height:11px;display:inline-flex;">${ICON.whatsapp}</span></span> ` : ''}
        <span class="badge ${leadStatusBadge(r.status)}">${r.status || '—'}</span>
      </td>
      <td><button class="btn-icon" data-lead-id="${r.id}" data-action="edit" title="Bearbeiten" style="display:inline-flex;align-items:center;justify-content:center;"><span class="svg-icon" style="width:14px;height:14px;display:inline-flex;">${ICON.edit}</span></button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.lead-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const lead = leadsCache.find(l => l.id === row.dataset.leadId);
      if (lead) openPatientDetailModal(lead);
    });
  });
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lead = leadsCache.find(l => l.id === btn.dataset.leadId);
      if (lead) openLeadModal(lead);
    });
  });
}

function renderPdInfoBlock(lead) {
  const grid = document.getElementById('pdInfoGrid');
  if (!grid) return;
  const md = lead.metadata || {};
  const dob = lead.geburtsdatum || md.geburtsdatum || '';
  const dobStr = dob ? new Date(dob).toLocaleDateString('de-DE') : '—';
  const addrParts = [lead.street, [lead.plz, lead.city].filter(Boolean).join(' ')].filter(Boolean);
  const addr = addrParts.length ? addrParts.join(', ') : '—';
  const km = lead.distance_km != null ? `ca. ${Number(lead.distance_km).toFixed(1)} km` : '—';
  const dur = lead.duration_min != null ? `ca. ${lead.duration_min} min` : '—';
  const krankenkasse = lead.krankenkasse || md.krankenkasse || '—';
  const vNr = lead.versichertennummer || md.krankenkassennummer || '—';
  const sex = md.geschlecht || lead.geschlecht || '—';
  const cell = (label, value) => `
    <div>
      <div style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px;">${label}</div>
      <div style="font-weight:500;">${escapeHtml(value)}</div>
    </div>`;
  const cellHtml = (label, htmlValue) => `
    <div>
      <div style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px;">${label}</div>
      <div style="font-weight:500;display:flex;align-items:center;gap:4px;">${htmlValue}</div>
    </div>`;
  grid.innerHTML = [
    cell('Name', displayName(lead) || '—'),
    cell('Geburtsdatum', dobStr),
    cell('Geschlecht', sex),
    cell('Telefon', lead.phone || '—'),
    cell('E-Mail', lead.email || '—'),
    cell('Krankenkasse', krankenkasse),
    cell('Versicherten-Nr.', vNr),
    cell('Adresse', addr),
    md.hausbesuch
      ? cellHtml('Hausbesuch', `<span class="svg-icon" style="width:14px;height:14px;display:inline-flex;color:var(--text-main);">${ICON.car}</span> Ja`)
      : cell('Hausbesuch', 'Nein'),
    cell('Entfernung', km),
    cell('Fahrzeit (einfach)', dur),
    cell('Status', lead.status || '—')
  ].join('');
}

async function openPatientDetailModal(lead) {
  pdCurrentLeadId = lead.id;
  document.getElementById('pdModalTitle').textContent = displayName(lead) || 'Patientendetails';
  renderPdInfoBlock(lead);
  document.querySelectorAll('.pd-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'notes'));
  document.querySelectorAll('.pd-panel').forEach(p => p.classList.toggle('active', p.id === 'pdPanelNotes'));
  document.getElementById('pdNotesLoading').hidden = false;
  document.getElementById('pdNotesContent').innerHTML = '';
  document.getElementById('pdAnamLoading').hidden = false;
  document.getElementById('pdAnamContent').innerHTML = '';
  document.getElementById('pdUeberContent').innerHTML = '<div class="pd-empty">Noch keine Überweisung eingetragen.</div>';
  document.getElementById('pdRechLoading').hidden = false;
  document.getElementById('pdRechContent').innerHTML = '';
  document.getElementById('pdTermLoading').hidden = false;
  document.getElementById('pdTermContent').innerHTML = '';
  document.getElementById('pdMailLoading').hidden = false;
  document.getElementById('pdMailContent').innerHTML = '';
  openModal('patientDetailModal');

  const leadId = lead.id;
  const isPhysio = getSector() === 'physiotherapy';
  const rezTab = document.getElementById('pdTabRezepte');
  if (rezTab) rezTab.style.display = isPhysio ? '' : 'none';

  loadPatientDetailNotes(leadId);
  loadPatientDetailAnamnese(leadId);
  loadPatientDetailUeberweisung(leadId);
  if (isPhysio) loadPatientDetailRezepte(leadId);
  loadPatientDetailRechnungen(leadId);
  loadPatientDetailTermine(leadId);
  loadPatientDetailMails(leadId);
}

async function loadPatientDetailRezepte(leadId) {
  const content = document.getElementById('pdRezContent');
  const loading = document.getElementById('pdRezLoading');
  if (!content) return;
  if (loading) loading.hidden = false;

  const [rxRes, befRes] = await Promise.all([
    supabase
      .from('prescriptions')
      .select(`
        id, rezept_typ, status, icd10, diagnosegruppe, heilmittel,
        heilmittel_position, anzahl_einheiten, frequenz, ausstellungsdatum, gueltig_bis,
        is_dringend, hausbesuch, dmrz_exported_at, created_at,
        abrechnung_status, kostentraeger_ik, zuzahlung_befreit,
        prescription_sessions ( id, session_number, status, done_at )
      `)
      .eq('patient_id', leadId)
      .order('created_at', { ascending: false }),
    supabase
      .from('zuzahlung_befreiung')
      .select('id, jahr, befreit_ab, befreit_bis, beleg_url')
      .eq('patient_id', leadId)
      .order('jahr', { ascending: false }),
  ]);
  const { data: rxs, error } = rxRes;
  const befreiungen = befRes.data || [];

  if (loading) loading.hidden = true;
  if (error) { content.innerHTML = '<div class="pd-empty">Fehler: ' + escapeHtml(error.message) + '</div>'; return; }

  const befreiungCard = renderBefreiungCard(leadId, befreiungen);
  if (!rxs || !rxs.length) {
    content.innerHTML = befreiungCard + '<div class="pd-empty">Keine Rezepte vorhanden.</div>';
    wireBefreiungCard(leadId);
    return;
  }

  const typLabel = { standard: 'Standard', blanko: 'Blanko', lhb_bvb: 'LHB/BVB' };
  const statusLabel = { parsed: 'Erfasst', confirmed: 'Bestätigt', in_therapy: 'In Therapie', completed: 'Abgeschlossen', billed: 'Abgerechnet', cancelled: 'Storniert' };
  const sessStatusLabel = { planned: 'geplant', done: 'erledigt', no_show: 'no_show', cancelled: 'storniert' };
  const sessStatusCls = { planned: 'badge-gray', done: 'badge-green', no_show: 'badge-red', cancelled: 'badge-gray' };

  content.innerHTML = rxs.map(rx => {
    const sessions = (rx.prescription_sessions || []).sort((a, b) => a.session_number - b.session_number);
    const total = rx.anzahl_einheiten || sessions.length || 0;
    const done = sessions.filter(s => s.status === 'done').length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    let validColor = '';
    if (rx.gueltig_bis) {
      const today0 = new Date(); today0.setHours(0, 0, 0, 0);
      const gb = new Date(rx.gueltig_bis);
      const days = Math.round((gb - today0) / 86400000);
      if (days < 0) validColor = 'color:#ef4444;font-weight:600;';
      else if (days <= 3) validColor = 'color:#ef4444;';
      else if (days <= 10) validColor = 'color:#f59e0b;';
    }
    const valid = rx.gueltig_bis
      ? `<span style="${validColor}">${new Date(rx.gueltig_bis).toLocaleDateString('de-DE')}</span>`
      : '—';
    const issued = rx.ausstellungsdatum ? new Date(rx.ausstellungsdatum).toLocaleDateString('de-DE') : '—';
    const dmrz = rx.dmrz_exported_at
      ? `<span class="badge badge-green" title="${new Date(rx.dmrz_exported_at).toLocaleString('de-DE')}">DMRZ ✓</span>`
      : `<span class="badge badge-gray">DMRZ offen</span>`;
    const flags = [
      rx.is_dringend ? '<span class="badge badge-red">Dringend</span>' : '',
      rx.hausbesuch ? '<span class="badge badge-blue">Hausbesuch</span>' : ''
    ].filter(Boolean).join(' ');

    const sessionPills = sessions.map(s => {
      const date = s.done_at ? new Date(s.done_at).toLocaleDateString('de-DE') : '';
      const title = `Sitzung ${s.session_number}${date ? ' · ' + date : ''}`;
      return `<span class="badge ${sessStatusCls[s.status] || 'badge-gray'}" title="${title}">${s.session_number} · ${sessStatusLabel[s.status] || s.status}</span>`;
    }).join(' ');

    // Sprint 8+: abrechnung_status badge + manual "bereit setzen" button (physio only)
    const abrStatus = rx.abrechnung_status;
    const sector = getSector();
    const showAbrControls = (sector === 'physiotherapy' || sector === 'praxis');
    let abrBadge = '';
    let abrButton = '';
    if (showAbrControls) {
      const statusBadges = {
        bereit: rx.kostentraeger_ik
          ? '<span class="badge" style="background:#dcfce7;color:#15803d;">Abrechnungsbereit</span>'
          : '<span class="badge" style="background:var(--warning-dim);color:var(--warning);">⚠ Krankenkasse fehlt</span>',
        in_abrechnung: '<span class="badge" style="background:#dbeafe;color:#1e40af;">In Abrechnung</span>',
        rejected: '<span class="badge" style="background:#fee2e2;color:#b91c1c;">ZAA abgelehnt</span>',
        accepted: '<span class="badge" style="background:#d1fae5;color:#065f46;">Bezahlt</span>',
      };
      abrBadge = statusBadges[abrStatus] || '';
      if (!abrStatus) {
        abrButton = `<button class="btn-primary btn-sm rx-mark-bereit" data-id="${rx.id}" title="Manuell als bereit für §302-Abrechnung markieren">Als bereit markieren</button>`;
      } else if (abrStatus === 'bereit') {
        abrButton = `<button class="btn-ghost btn-sm rx-unmark-bereit" data-id="${rx.id}" style="color:#b45309;" title="Zurück auf offen">Rückgängig</button>`;
      }
    }

    const paidButton = (rx.zuzahlung_eur > 0 && !rx.zuzahlung_befreit && abrStatus !== 'accepted')
      ? `<button class="btn-ghost btn-sm rx-mark-paid" data-id="${rx.id}" style="color:#15803d;font-weight:600;" title="Zuzahlung als bezahlt markieren"><span class="svg-icon" style="width:13px;height:13px;display:inline-flex;vertical-align:-2px;margin-right:4px;color:#15803d;">${ICON.checkCircle}</span>Zuzahlung erhalten</button>`
      : '';

    return `<div class="pd-rech-item" style="padding:14px 20px;border-bottom:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <div>
          <strong>${escapeHtml(rx.heilmittel || '—')}</strong>
          ${rx.heilmittel_position ? `<span style="font-family:monospace;font-size:11px;color:#666;margin-left:6px;">${escapeHtml(rx.heilmittel_position)}</span>` : ''}
          <span style="color:#888;margin-left:8px;font-size:13px;">${escapeHtml(rx.icd10 || '')}${rx.diagnosegruppe ? ' · ' + escapeHtml(rx.diagnosegruppe) : ''}</span>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
          <span class="badge badge-blue">${typLabel[rx.rezept_typ] || rx.rezept_typ}</span>
          <span class="badge badge-gray">${statusLabel[rx.status] || rx.status}</span>
          ${dmrz}
          ${flags}
          ${abrBadge}
          ${abrButton}
          <button class="btn-ghost btn-sm rx-print-zuzahlung" data-id="${rx.id}" title="Zuzahlungsrechnung drucken"><span class="svg-icon" style="width:13px;height:13px;display:inline-flex;vertical-align:-2px;margin-right:4px;">${ICON.invoice}</span>Zuzahlung</button>
          ${paidButton}
        </div>
      </div>
      <div style="font-size:13px;color:#555;margin-bottom:8px;">
        Ausgestellt: ${issued} · Gültig bis: ${valid} · Frequenz: ${escapeHtml(rx.frequenz || '—')}
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <div style="flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:#22c55e;"></div>
        </div>
        <span style="font-size:13px;color:#444;white-space:nowrap;">${done}/${total} Sitzungen</span>
      </div>
      ${sessionPills ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${sessionPills}</div>` : ''}
    </div>`;
  }).join('');

  content.innerHTML = befreiungCard + content.innerHTML;
  wireBefreiungCard(leadId);

  // Sprint 8+: manual "bereit setzen" / "rückgängig" handlers
  content.querySelectorAll('.rx-mark-bereit').forEach(btn => {
    btn.addEventListener('click', async () => {
      await flipAbrechnungStatus(btn.dataset.id, 'bereit', leadId);
    });
  });
  content.querySelectorAll('.rx-unmark-bereit').forEach(btn => {
    btn.addEventListener('click', async () => {
      await flipAbrechnungStatus(btn.dataset.id, null, leadId);
    });
  });
  content.querySelectorAll('.rx-mark-paid').forEach(btn => {
    btn.addEventListener('click', async () => {
      await flipAbrechnungStatus(btn.dataset.id, 'accepted', leadId);
    });
  });
  content.querySelectorAll('.rx-print-zuzahlung').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const printWindow = window.open(`${API}/billing/prescription/${btn.dataset.id}/zuzahlungsrechnung?token=${s.access_token}`, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        showToast('Popup-Blocker verhindert das Öffnen des Druckfensters.', 'error');
      }
    });
  });
}

async function flipAbrechnungStatus(rxId, newStatus, leadId) {
  try {
    if (newStatus === 'bereit') {
      const { data: rx, error: getErr } = await supabase
        .from('prescriptions')
        .select('bericht_angefordert, bericht_status')
        .eq('id', rxId)
        .single();
      if (getErr) throw getErr;

      if (rx && rx.bericht_angefordert && rx.bericht_status !== 'erledigt') {
        showToast('Abgelehnt: Therapiebericht fehlt!', 'error');
        return;
      }
    }

    if (newStatus === 'accepted') {
      const { data: rxInfo, error: rxErr } = await supabase
        .from('prescriptions')
        .select('*, leads:patient_id(first_name, last_name)')
        .eq('id', rxId)
        .single();
      if (rxErr) throw rxErr;

      if (rxInfo && rxInfo.zuzahlung_eur > 0) {
        const { error: blErr } = await supabase.from('belegliste').insert({
          owner_id: getOwnerId(),
          type: 'zuzahlung',
          amount_eur: Number(rxInfo.zuzahlung_eur),
          patient_id: rxInfo.patient_id,
          prescription_id: rxId,
          reference_text: `Zuzahlung erhalten: ${rxInfo.leads?.first_name || ''} ${rxInfo.leads?.last_name || ''}`.trim()
        });
        if (blErr) throw blErr;
      }
    }

    const { error } = await supabase
      .from('prescriptions')
      .update({ abrechnung_status: newStatus })
      .eq('id', rxId);
    if (error) throw error;
    
    showToast(newStatus === 'bereit' ? 'Als abrechnungsbereit markiert ✓' : (newStatus === 'accepted' ? 'Zuzahlung als bezahlt gebucht ✓' : 'Zurück auf offen ✓'));
    await loadPatientDetailRezepte(leadId);
  } catch (e) {
    console.error('[abrechnung-status]', e);
    showToast('Fehler: ' + e.message, 'error');
  }
}

// --- Zuzahlung-Befreiung (yearly co-pay exemption) ---

function renderBefreiungCard(leadId, befreiungen) {
  const currentYear = new Date().getFullYear();
  const current = befreiungen.find(b => b.jahr === currentYear);
  const others = befreiungen.filter(b => b.jahr !== currentYear);

  const fmt = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '—';
  const head = current
    ? `<span class="badge badge-green" style="font-size:13px;">Befreit ${currentYear}</span>
       <span style="font-size:13px;color:#555;">ab ${fmt(current.befreit_ab)}${current.befreit_bis ? ' – ' + fmt(current.befreit_bis) : ''}</span>
       ${current.beleg_url ? `<button class="btn-ghost btn-sm bef-view" data-path="${escapeHtml(current.beleg_url)}">📄 Beleg</button>` : ''}
       <button class="btn-ghost btn-sm bef-remove" data-id="${current.id}" style="color:#b91c1c;">Entfernen</button>`
    : `<span class="badge badge-gray" style="font-size:13px;">Zuzahlungspflichtig ${currentYear}</span>
       <button class="btn-primary btn-sm bef-add" data-lead="${escapeHtml(leadId)}">+ Befreiungsbescheinigung</button>`;

  const history = others.length
    ? `<div style="margin-top:8px;font-size:12px;color:#666;">
        ${others.map(b => `<span>${b.jahr}: befreit ab ${fmt(b.befreit_ab)}${b.beleg_url ? ` · <a href="#" class="bef-view" data-path="${escapeHtml(b.beleg_url)}">Beleg</a>` : ''}</span>`).join(' · ')}
      </div>`
    : '';

  return `<div class="pd-rech-item" style="padding:12px 20px;border-bottom:1px solid var(--border);background:#fafbfc;">
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;">
      <strong style="font-size:14px;">Zuzahlungs-Befreiung</strong>
      ${head}
    </div>
    ${history}
  </div>`;
}

function wireBefreiungCard(leadId) {
  const root = document.getElementById('pdRezContent');
  if (!root) return;
  root.querySelectorAll('.bef-add').forEach(btn => {
    btn.addEventListener('click', () => openBefreiungModal(btn.dataset.lead));
  });
  root.querySelectorAll('.bef-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Befreiung für dieses Jahr entfernen?')) return;
      const { error } = await supabase.from('zuzahlung_befreiung').delete().eq('id', btn.dataset.id);
      if (error) return showToast('Fehler: ' + error.message, 'error');
      showToast('Befreiung entfernt.');
      loadPatientDetailRezepte(leadId);
    });
  });
  root.querySelectorAll('.bef-view').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const path = btn.dataset.path;
      if (!path) return;
      const { data, error } = await supabase.storage.from('patient-documents').createSignedUrl(path, 300);
      if (error) return showToast('Beleg konnte nicht geöffnet werden: ' + error.message, 'error');
      window.open(data.signedUrl, '_blank');
    });
  });
}

function openBefreiungModal(leadId) {
  const modal = document.getElementById('befreiungModal');
  if (!modal) return;
  const yearInp = document.getElementById('befJahr');
  const abInp = document.getElementById('befAb');
  const bisInp = document.getElementById('befBis');
  const fileInp = document.getElementById('befFile');
  const errEl = document.getElementById('befErr');
  const saveBtn = document.getElementById('befSaveBtn');
  const today = new Date();
  const yyyy = today.getFullYear();
  yearInp.value = String(yyyy);
  abInp.value = today.toISOString().slice(0, 10);
  bisInp.value = `${yyyy}-12-31`;
  fileInp.value = '';
  if (errEl) errEl.textContent = '';
  saveBtn.dataset.lead = leadId;
  openModal('befreiungModal');
}

async function saveBefreiung(leadId) {
  const errEl = document.getElementById('befErr');
  errEl.textContent = '';
  const jahr = parseInt(document.getElementById('befJahr').value, 10);
  const ab = document.getElementById('befAb').value;
  const bis = document.getElementById('befBis').value || null;
  const file = document.getElementById('befFile').files[0];
  if (!jahr || !ab) { errEl.textContent = 'Jahr und „befreit ab“ sind Pflicht.'; return; }

  const ownerId = getOwnerId();

  // Upload beleg if present
  let belegPath = null;
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      errEl.textContent = 'Datei zu groß (max 5 MB).'; return;
    }
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
    belegPath = `${ownerId}/${leadId}/befreiung_${jahr}.${ext}`;
    const { error: upErr } = await supabase.storage.from('patient-documents').upload(belegPath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });
    if (upErr) { errEl.textContent = 'Upload-Fehler: ' + upErr.message; return; }
  }

  const row = {
    owner_id: ownerId,
    patient_id: leadId,
    jahr,
    befreit_ab: ab,
    befreit_bis: bis,
    beleg_url: belegPath,
  };
  const { error } = await supabase.from('zuzahlung_befreiung').upsert(row, { onConflict: 'patient_id,jahr' });
  if (error) { errEl.textContent = 'Speicherfehler: ' + error.message; return; }

  closeModal('befreiungModal');
  showToast('Befreiung gespeichert ✓');
  loadPatientDetailRezepte(leadId);
}

async function loadPatientDetailNotes(leadId) {
  const { data: notes } = await supabase.from('patient_notes')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle();
  const content = document.getElementById('pdNotesContent');
  document.getElementById('pdNotesLoading').hidden = true;
  if (!notes) {
    content.innerHTML = '<div class="pd-empty">Keine Notizen vorhanden.</div>';
    return;
  }
  let html = '';
  if (notes.doctor_notes) {
    html += `<div class="pd-section"><div class="pd-section-title">Arztnotizen</div><div class="pd-text">${escapeHtml(notes.doctor_notes)}</div></div>`;
  }
  if (notes.therapist_notes) {
    html += `<div class="pd-section"><div class="pd-section-title">Therapeutennotizen</div><div class="pd-text">${escapeHtml(notes.therapist_notes)}</div></div>`;
  }
  if (notes.ai_summary) {
    html += `<div class="pd-section"><div class="pd-section-title">AI Zusammenfassung</div><div class="pd-text">${escapeHtml(notes.ai_summary)}</div></div>`;
  }
  if (!html) html = '<div class="pd-empty">Keine Notizen vorhanden.</div>';
  content.innerHTML = html;
}

async function loadPatientDetailAnamnese(leadId) {
  const { data: anam } = await supabase.from('anamnese')
    .select('*,created_by')
    .eq('patient_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const content = document.getElementById('pdAnamContent');
  document.getElementById('pdAnamLoading').hidden = true;
  if (!anam) {
    content.innerHTML = '<div class="pd-empty">Keine Anamnese vorhanden.</div>';
    return;
  }

  let creatorName = '';
  if (anam.created_by) {
    const { data: creator } = await supabase.from('profiles')
      .select('first_name,last_name,business_name')
      .eq('id', anam.created_by)
      .maybeSingle();
    if (creator) {
      creatorName = [creator.first_name, creator.last_name].filter(Boolean).join(' ') || creator.business_name || '';
    }
  }

  const fields = [
    ['Hauptbeschwerde', anam.hauptbeschwerde],
    ['Beschwerde seit', anam.beschwerde_seit],
    ['Verlauf', anam.beschwerde_verlauf],
    ['Schmerz-Skala (0–10)', anam.schmerz_skala != null ? String(anam.schmerz_skala) : ''],
    ['Schmerzart', anam.schmerz_art],
    ['Vorerkrankungen', anam.vorerkrankungen],
    ['Operationen', anam.operationen],
    ['Medikamente', anam.medikamente],
    ['Allergien', anam.allergien],
    ['Beruf', anam.beruf],
    ['Sport / Bewegung', anam.sport],
    ['Raucher', anam.raucher ? 'Ja' : 'Nein'],
    ['Diagnose', anam.diagnose],
    ['Arzt', anam.arzt_name],
    ['Arzt-Nummer', anam.arzt_nummer],
    ['Rezept-Sitzungen', anam.rezept_sitzungen != null ? String(anam.rezept_sitzungen) : ''],
    ['Hausbesuch', anam.hausbesuch ? 'Ja' : 'Nein'],
    ['Besondere Wünsche', anam.besondere_wuensche],
    ['Notizen', anam.notizen],
    ['Erstellt am', anam.created_at ? fmtDate(anam.created_at) : ''],
    ['Erstellt von', creatorName],
  ];
  let html = '';
  html += `<div style="margin-bottom:16px;"><button class="btn-primary" id="pdAnamViewBtn" data-lead-id="${leadId}">📄 Dokument anzeigen</button></div>`;
  fields.forEach(([label, val]) => {
    if (val) html += `<div class="pd-section"><div class="pd-section-title">${label}</div><div class="pd-text">${escapeHtml(String(val))}</div></div>`;
  });
  if (!html) html = '<div class="pd-empty">Anamnese vorhanden, aber keine Details.</div>';
  content.innerHTML = html;

  const btn = document.getElementById('pdAnamViewBtn');
  if (btn) btn.addEventListener('click', () => {
    closeModal('patientDetailModal');
    prefillAnamnesePatientId = btn.dataset.leadId;
    switchPanel('anamnese');
  });
}

async function loadPatientDetailMails(leadId) {
  const ownerId = getOwnerId();
  // Look up patient email so we can also catch legacy rows that were
  // inserted without a contact_id.
  const { data: lead } = await supabase.from('leads')
    .select('email').eq('id', leadId).maybeSingle();
  const email = (lead?.email || '').trim();

  // Two queries OR'd: by contact_id (preferred) OR by to_email match
  const filters = [`contact_id.eq.${leadId}`];
  if (email) filters.push(`and(contact_id.is.null,to_email.ilike.${email})`);
  const { data: logs } = await supabase.from('email_logs')
    .select('*')
    .eq('owner_id', ownerId)
    .or(filters.join(','))
    .order('created_at', { ascending: false });

  // Backfill contact_id for the email-matched rows so future queries are cheaper
  const orphanIds = (logs || []).filter(l => !l.contact_id).map(l => l.id);
  if (orphanIds.length) {
    supabase.from('email_logs').update({ contact_id: leadId }).in('id', orphanIds).then(() => { });
  }

  const content = document.getElementById('pdMailContent');
  document.getElementById('pdMailLoading').hidden = true;
  if (!logs || logs.length === 0) {
    content.innerHTML = '<div class="pd-empty">Keine Mail-Historie vorhanden.</div>';
    return;
  }
  content.innerHTML = logs.map(l => `
    <div class="pd-mail-item">
      <div class="pd-mail-subj">${escapeHtml(l.subject || '(Kein Betreff)')}</div>
      <div class="pd-mail-meta">An: ${escapeHtml(l.to_email || '')} · ${l.created_at ? fmtDate(l.created_at) : ''}</div>
      <div class="pd-mail-body">${escapeHtml(l.body || '').slice(0, 300)}${(l.body || '').length > 300 ? '...' : ''}</div>
    </div>
  `).join('');
}

async function loadPatientDetailUeberweisung(leadId) {
  const { data } = await supabase.from('ueberweisungen')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  const content = document.getElementById('pdUeberContent');
  if (!data || data.length === 0) {
    content.innerHTML = '<div class="pd-empty">Noch keine Überweisung eingetragen.</div>';
    return;
  }
  content.innerHTML = data.map(u => `
    <div class="pd-ueber-card">
      <img src="${escapeHtml(u.image_url || '')}" class="pd-ueber-img" alt="Überweisung" />
      <div class="pd-ueber-meta">
        ${u.arzt_name ? `<div class="pd-ueber-row"><strong>Arzt:</strong> ${escapeHtml(u.arzt_name)}</div>` : ''}
        ${u.notiz ? `<div class="pd-ueber-row">${escapeHtml(u.notiz)}</div>` : ''}
        <div class="pd-ueber-date">${u.created_at ? fmtDate(u.created_at) : ''}</div>
      </div>
    </div>
  `).join('');
}

async function loadPatientDetailRechnungen(leadId) {
  const { data } = await supabase.from('invoices')
    .select('id,invoice_number,status,issued_at,total_patient,eigenanteil_eur,kassenzuzahlung,subtotal')
    .eq('patient_id', leadId)
    .order('issued_at', { ascending: false });
  const content = document.getElementById('pdRechContent');
  document.getElementById('pdRechLoading').hidden = true;
  if (!data || data.length === 0) {
    content.innerHTML = '<div class="pd-empty">Keine Rechnungen vorhanden.</div>';
    return;
  }
  content.innerHTML = data.map(inv => `
    <div class="pd-rech-item pd-rech-clickable" data-inv-id="${inv.id}" style="cursor:pointer;">
      <div class="pd-rech-row">
        <span class="pd-rech-num">${escapeHtml(inv.invoice_number || '—')}</span>
        <span class="badge ${inv.status === 'paid' ? 'badge-green' : inv.status === 'sent' ? 'badge-blue' : 'badge-gray'}">${inv.status || '—'}</span>
      </div>
      <div class="pd-rech-row">
        <span>${inv.issued_at ? fmtDate(inv.issued_at) : '—'}</span>
        <span class="pd-rech-total">${inv.total_patient != null ? inv.total_patient + ' €' : '—'}</span>
      </div>
      ${inv.eigenanteil_eur ? `<div class="pd-rech-detail">Eigenanteil: ${inv.eigenanteil_eur} €</div>` : ''}
      ${inv.kassenzuzahlung ? `<div class="pd-rech-detail">Kassenzuzahlung: ${inv.kassenzuzahlung} €</div>` : ''}
    </div>
  `).join('');
  content.querySelectorAll('.pd-rech-clickable').forEach(card => {
    card.addEventListener('click', async () => {
      const invId = card.dataset.invId;
      closeModal('patientDetailModal');
      if (!invListCache.find(i => i.id === invId)) {
        const ownerId = getOwnerId();
        const { data: invData } = await supabase.from('invoices').select('*').eq('id', invId).eq('owner_id', ownerId).maybeSingle();
        if (invData) invListCache.push(invData);
      }
      switchPanel('rechnungen');
      openInvEditor(invId);
    });
  });
}

async function loadPatientDetailTermine(leadId) {
  const lead = leadsCache.find(l => l.id === leadId);
  const ownerId = getOwnerId();
  const patientName = displayName(lead);
  let query = supabase.from('bookings')
    .select('id,start_time,end_time,status,customer_name,services(title,code)')
    .eq('owner_id', ownerId)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: false });
  if (lead?.phone) {
    query = query.eq('customer_phone', lead.phone);
  } else if (patientName) {
    query = query.eq('customer_name', patientName);
  } else {
    document.getElementById('pdTermLoading').hidden = true;
    document.getElementById('pdTermContent').innerHTML = '<div class="pd-empty">Keine Termine vorhanden.</div>';
    return;
  }
  const { data } = await query;
  const content = document.getElementById('pdTermContent');
  document.getElementById('pdTermLoading').hidden = true;
  if (!data || data.length === 0) {
    content.innerHTML = '<div class="pd-empty">Keine Termine vorhanden.</div>';
    return;
  }
  content.innerHTML = data.map(b => {
    const dateStr = b.start_time ? fmtDate(b.start_time) : '—';
    const timeStr = b.start_time ? fmtTime(b.start_time) : '—';
    const dur = b.end_time && b.start_time ? Math.round((new Date(b.end_time) - new Date(b.start_time)) / 60000) + ' min' : '';
    const serviceTitle = b.services?.title || '—';
    const svcCode4 = b.services?.code;
    return `
      <div class="pd-term-item">
        <div class="pd-term-row">
          <span class="pd-term-date">${dateStr} · ${timeStr}</span>
          <span class="badge ${b.status === 'confirmed' ? 'badge-green' : (b.status === 'cancelled' || b.status === 'no_show') ? 'badge-red' : 'badge-gray'}">${b.status || '—'}</span>
        </div>
        <div class="pd-term-service">${escapeHtml(serviceTitle)} ${svcCode4 ? '<span style="font-size:11px;color:var(--text-muted);margin-left:6px;background:var(--bg-elevated);padding:1px 5px;border-radius:3px;">' + escapeHtml(svcCode4) + '</span>' : ''} ${dur ? '· ' + dur : ''}</div>
      </div>
    `;
  }).join('');
}


document.getElementById('pdUeberAddBtn').addEventListener('click', () => {
  document.getElementById('pdUeberFileInput').click();
});

document.getElementById('pdUeberFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !pdCurrentLeadId) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result;
    const { error } = await supabase.from('ueberweisungen').insert({
      owner_id: getOwnerId(),
      lead_id: pdCurrentLeadId,
      image_url: base64,
      created_at: new Date().toISOString()
    });
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Überweisung gespeichert ✓');
    loadPatientDetailUeberweisung(pdCurrentLeadId);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

document.querySelectorAll('.pd-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.pd-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pd-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('pdPanel' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
    if (panel) panel.classList.add('active');
  });
});

function leadStatusBadge(s) {
  if (s === 'won') return 'badge-green';
  if (s === 'lost') return 'badge-red';
  if (s === 'contacted') return 'badge-blue';
  if (s === 'booked') return 'badge-yellow';
  return 'badge-gray';
}

document.querySelectorAll('.filter-btn[data-status]').forEach(btn => {
  if (btn.closest('#panel-kunden')) {
    btn.addEventListener('click', () => {
      leadFilter = btn.dataset.status;
      btn.closest('.filter-bar').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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
  document.getElementById('lead-id').value = lead?.id || '';
  document.getElementById('lead-first-name').value = lead?.first_name || '';
  document.getElementById('lead-last-name').value = lead?.last_name || '';
  document.getElementById('lead-phone').value = lead?.phone || '';
  document.getElementById('lead-email').value = lead?.email || '';
  document.getElementById('lead-city').value = lead?.city || '';
  document.getElementById('lead-status').value = lead?.status || 'new';
  document.getElementById('lead-notes').value = lead?.notes || '';
  document.getElementById('leadModalTitle').textContent = lead ? t('lead_modal_edit') : t('lead_modal_new');

  const md = lead?.metadata || {};
  document.getElementById('lead-geburtsdatum').value = md.geburtsdatum || '';

  const sector = getSector();
  const sectorFieldsEl = document.getElementById('lead-sector-fields');
  const physioRow = document.getElementById('lead-physio-row');
  const physioRow2 = document.getElementById('lead-physio-row2');
  const arztRow = document.getElementById('lead-arzt-row');
  const hausbesuchRow = document.getElementById('lead-hausbesuch-row');

  if (sector === 'physiotherapy') {
    sectorFieldsEl.style.display = 'block';
    physioRow.style.display = 'grid';
    physioRow2.style.display = 'grid';
    if (arztRow) arztRow.style.display = 'grid';
    hausbesuchRow.style.display = 'grid';

    if (krankenkassenCache.length === 0) {
      const { data } = await supabase.from('krankenkassen').select('*').order('name');
      krankenkassenCache = data || [];
    }
    const kkSelect = document.getElementById('lead-krankenkasse');
    kkSelect.innerHTML = '<option value="">-- Wählen --</option>' +
      krankenkassenCache.map(k => `<option value="${k.name}">${k.name}</option>`).join('');

    kkSelect.value = (lead?.krankenkasse || md.krankenkasse) || '';
    document.getElementById('lead-krankenkassennummer').value = (lead?.versichertennummer || md.krankenkassennummer) || '';

    if (!aerzteCache || aerzteCache.length === 0) {
      await loadAerzte();
    } else {
      populateLeadArztSelect();
    }
    const arztSelect = document.getElementById('lead-arzt');
    if (arztSelect) {
      arztSelect.value = lead?.arzt_id || '';
    }

    // New strukturlu adres alanları (kolonlar). Backward-compat: eski metadata.adresse'den parse et.
    const streetEl = document.getElementById('lead-street');
    const plzEl = document.getElementById('lead-plz');
    streetEl.value = lead?.street || '';
    plzEl.value = lead?.plz || '';
    if (!streetEl.value && md.adresse) {
      const parsed = parseAdresseString(md.adresse);
      streetEl.value = parsed.street || md.adresse;
      if (!plzEl.value) plzEl.value = parsed.plz || '';
      if (!document.getElementById('lead-city').value) document.getElementById('lead-city').value = parsed.city || '';
    }
    const hb = !!md.hausbesuch;
    document.getElementById('lead-hausbesuch').checked = hb;
    toggleLeadHausbesuchUI(hb);
  } else {
    sectorFieldsEl.style.display = 'none';
    physioRow.style.display = 'none';
    physioRow2.style.display = 'none';
    if (arztRow) arztRow.style.display = 'none';
    hausbesuchRow.style.display = 'none';
  }

  const histEl = document.getElementById('leadHistory');
  if (histEl) {
    histEl.innerHTML = '';
    if (lead?.phone_normalized) {
      const meta = leadsMeta[lead.phone_normalized] || {};
      const bks = meta.bookings || [];
      const wa = meta.wa;
      let html = '';
      if (wa) html += `<div class="lead-hist-item lead-hist-wa" style="display:flex;align-items:center;gap:4px;"><span class="svg-icon" style="width:13px;height:13px;display:inline-flex;color:var(--text-main);">${ICON.whatsapp}</span>WhatsApp: ${wa.customer_name || wa.wa_id}</div>`;
      if (bks.length) {
        html += bks.slice(0, 5).map(b => `<div class="lead-hist-item lead-hist-bk" style="display:flex;align-items:center;gap:4px;"><span class="svg-icon" style="width:13px;height:13px;display:inline-flex;color:var(--text-muted);">${ICON.calendar}</span>${fmtDate(b.start_time)} — <span class="badge ${statusBadge(b.status)}">${b.status}</span></div>`).join('');
        if (bks.length > 5) html += `<div class="lead-hist-item" style="color:var(--text-muted)">+${bks.length - 5} weitere</div>`;
      }
      if (html) histEl.innerHTML = '<div class="lead-hist-title">Verlauf</div>' + html;
    }
  }
  openModal('leadModal');
}

// ===== Fahrtenbuch helpers =====
// Parse "Straßenname 12, 53721 Siegburg" → {street, plz, city}
function parseAdresseString(s) {
  if (!s || typeof s !== 'string') return { street: null, plz: null, city: null };
  const txt = s.trim();
  // PLZ + Ort kalıbı: 5 digit + space + city (DE)
  const plzMatch = txt.match(/\b(\d{5})\s+([A-Za-zÀ-ÿäöüÄÖÜß .'-]+?)$/);
  if (plzMatch) {
    const plz = plzMatch[1];
    const city = plzMatch[2].trim();
    const before = txt.slice(0, plzMatch.index).replace(/[,;]\s*$/, '').trim();
    return { street: before || null, plz, city };
  }
  // Fallback: virgülle ayrılmışsa son parça city
  const parts = txt.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { street: parts.slice(0, -1).join(', '), plz: null, city: parts.at(-1) };
  }
  return { street: txt, plz: null, city: null };
}

function toggleLeadHausbesuchUI(checked) {
  document.getElementById('lead-street-req').hidden = !checked;
  document.getElementById('lead-plz-req').hidden = !checked;
  document.getElementById('lead-hausbesuch-hint').hidden = !checked;
}

document.getElementById('lead-hausbesuch')?.addEventListener('change', e => {
  toggleLeadHausbesuchUI(e.target.checked);
});

document.getElementById('leadSaveBtn').addEventListener('click', async () => {
  const id = document.getElementById('lead-id').value;
  const firstName = document.getElementById('lead-first-name').value.trim();
  const lastName = document.getElementById('lead-last-name').value.trim();
  const geburtsdatum = document.getElementById('lead-geburtsdatum').value;
  if (!firstName || !lastName) { showToast('Vorname und Nachname sind erforderlich.', 'error'); return; }
  if (!geburtsdatum) { showToast('Geburtsdatum ist erforderlich.', 'error'); return; }

  const sector = getSector();
  const city = document.getElementById('lead-city').value.trim();
  let street = null, plz = null, hausbesuch = false;

  if (sector === 'physiotherapy') {
    street = document.getElementById('lead-street').value.trim() || null;
    plz = document.getElementById('lead-plz').value.trim() || null;
    hausbesuch = document.getElementById('lead-hausbesuch').checked;

    // Hausbesuch işaretliyse adres zorunlu (Fahrtenbuch.md §1)
    if (hausbesuch) {
      const missing = [];
      if (!street) missing.push('Strasse');
      if (!plz) missing.push('PLZ');
      if (!city) missing.push('Stadt');
      if (missing.length) {
        showToast('Hausbesuch erfordert: ' + missing.join(', '), 'error');
        return;
      }
      if (!/^\d{5}$/.test(plz)) {
        showToast('PLZ muss 5-stellig sein.', 'error');
        return;
      }
    }
  }

  const metadata = { geburtsdatum };
  if (sector === 'physiotherapy') {
    metadata.krankenkasse = document.getElementById('lead-krankenkasse').value || null;
    metadata.krankenkassennummer = document.getElementById('lead-krankenkassennummer').value.trim() || null;
    metadata.hausbesuch = hausbesuch;
    // metadata.adresse'yi artık kullanmıyoruz (strukturlu kolonlar var). Eski kayıtları
    // upsert sırasında silmek istemiyoruz → kolonlarda doluysa metadata.adresse'i drop edelim.
    if (street || plz) metadata.adresse = null;
  }

  const payload = {
    owner_id: getOwnerId(),
    first_name: firstName,
    last_name: lastName,
    title: firstName + ' ' + lastName,
    phone: document.getElementById('lead-phone').value.trim() || null,
    email: document.getElementById('lead-email').value.trim() || null,
    street,
    plz,
    city: city || null,
    status: document.getElementById('lead-status').value,
    notes: document.getElementById('lead-notes').value.trim() || null,
    metadata: Object.keys(metadata).length ? metadata : null,
    krankenkasse: document.getElementById('lead-krankenkasse').value || null,
    versichertennummer: document.getElementById('lead-krankenkassennummer').value.trim() || null,
    arzt_id: document.getElementById('lead-arzt')?.value || null
  };

  // Adres değiştiyse cache'lenmiş rota geçersiz → temizle (Wave 3 Berechnen'de yeniden hesaplanır)
  if (id) {
    const prev = (Array.isArray(leadsCache) ? leadsCache : []).find(l => l.id === id) || {};
    if (prev.street !== street || prev.plz !== plz || (prev.city || null) !== (city || null)) {
      payload.location = null;
      payload.distance_km = null;
      payload.duration_min = null;
      payload.route_calculated_at = null;
    }
  }
  const { data: savedLead, error } = id
    ? await supabase.from('leads').update(payload).eq('id', id).select().single()
    : await supabase.from('leads').insert(payload).select().single();
  if (error) { showToast(t('err_generic'), 'error'); return; }
  closeModal('leadModal');
  await loadLeads();
  showToast(t('saved'));

  if (window._returnToBkModal) {
    window._returnToBkModal = false;
    const st = window._bkModalState || {};
    if (st.id) {
      await openBookingModal({ id: st.id, start_time: st.start, end_time: st.end, customer_name: '', customer_phone: '', notes: st.notes || '', hausbesuch: st.hausbesuch });
    } else {
      await prefillBookingModal(st.start);
    }
    if (st.employee) document.getElementById('bkEmployee').value = st.employee;
    if (st.service) document.getElementById('bkService').value = st.service;
    if (st.notes) document.getElementById('bkNotes').value = st.notes;
    document.getElementById('bkHausbesuch').checked = st.hausbesuch || false;
    document.getElementById('bkSeriesToggle').checked = st.seriesToggle || false;
    document.getElementById('bkSeriesFields').hidden = !st.seriesToggle;
    if (savedLead) {
      if (!window.bkAllLeads.find(l => l.id === savedLead.id)) {
        window.bkAllLeads.push(savedLead);
      }
      if (window.bkSelectLead) window.bkSelectLead(savedLead.id);
    }
  }
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
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
      });
    }
    const inserts = rows.filter(r => r.title || r.name).map(r => ({
      owner_id: ownerId,
      title: r.title || r.name || '—',
      phone: r.phone || r.phoneNumber || null,
      email: r.email || null,
      website: r.website || null,
      city: r.city || r['address.city'] || null,
      country_code: r.country_code || r.country || null,
      total_score: parseFloat(r.rating || r.totalScore) || null,
      reviews_count: parseInt(r.reviews_count || r.reviewsCount) || null,
      google_url: r.google_url || r.url || null,
      status: 'new'
    }));
    if (inserts.length === 0) throw new Error('empty');
    await supabase.from('leads').insert(inserts);
    await loadLeads();
    showToast(t('csv_imported') + inserts.length);
  } catch (err) {
    showToast(t('csv_error') + err.message, 'error');
  }
  e.target.value = '';
});

document.getElementById('apifyRunBtn').addEventListener('click', async () => {
  const rawQuery = document.getElementById('apifyQuery').value.trim();
  const city = document.getElementById('apifyCity').value.trim();
  const limit = Math.min(parseInt(document.getElementById('apifyLimit').value) || 20, 50);
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
      btn.disabled = false; btn.textContent = 'Suchen'; return;
    }
    const searchQuery = city ? `${rawQuery} ${city}` : rawQuery;
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch('/api/apify/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
  btn.disabled = false; btn.textContent = 'Suchen';
});

let servicesCache = [];

async function loadServices() {
  let q = supabase.from('services')
    .select('*,employee_services(employee_id),price_config,code')
    .or(`owner_id.eq.${getOwnerId()},user_id.eq.${getOwnerId()}`);
  q = bizScope(q, 'services');
  const { data } = await q;
  servicesCache = data || [];
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
  grid.innerHTML = servicesCache.map(s => {
    const empNames = (s.employee_services || []).map(es => {
      const m = teamMembers.find(tm => tm.id === es.employee_id);
      return m ? (m.business_name || m.email?.split('@')[0]) : null;
    }).filter(Boolean).join(', ');

    // Build duration chips from price_config or fall back to legacy duration_minutes
    let durChips = '';
    const cfg = s.price_config?.durations;
    if (cfg) {
      const active = Object.entries(cfg)
        .filter(([_, v]) => v && v.active)
        .map(([k, v]) => ({ min: parseInt(k), price: v.price }))
        .sort((a, b) => a.min - b.min);
      durChips = active.length
        ? active.map(d => `<span class="srv-chip">${d.min} Min${d.price != null ? ' · ' + formatEur(d.price) : ''}</span>`).join('')
        : '<span class="srv-chip srv-chip-warn">Keine aktive Dauer</span>';
    } else {
      const pr = s.price != null ? ' · ' + formatEur(s.price) : '';
      durChips = `<span class="srv-chip">${s.duration_minutes || '–'} Min${pr}</span>`;
    }

    const codeTag = s.code ? `<span class="srv-code-badge">${escapeHtml(s.code)}</span>` : '';
    return `<div class="service-card" data-srv-id="${s.id}">
      <div class="service-card-head">
        <div class="service-title">${escapeHtml(s.title)} ${codeTag}</div>
        <button class="srv-del-btn" data-srv-del="${s.id}" title="Löschen" aria-label="Löschen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="srv-chip-row">${durChips}</div>
      <div class="service-meta service-emps">${empNames ? '<span class="svg-icon" style="width:13px;height:13px;display:inline-flex;vertical-align:-2px;margin-right:4px;color:var(--text-muted);">' + ICON.users + '</span>' + escapeHtml(empNames) : '— Alle Mitarbeiter'}</div>
    </div>`;
  }).join('') + addCard;
  grid.querySelectorAll('.service-card[data-srv-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-srv-del]')) return;
      openServiceEdit(card.dataset.srvId);
    });
  });
  grid.querySelectorAll('[data-srv-del]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(t('alert_service_delete'))) return;
      await supabase.from('services').delete().eq('id', btn.dataset.srvDel);
      await loadServices();
    });
  });
  bindAddServiceCard();
}

function bindAddServiceCard() {
  const card = document.getElementById('addServiceCard');
  if (!card) return;
  card.addEventListener('click', () => {
    resetServiceForm();
    const form = document.getElementById('addServiceForm');
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function resetServiceForm() {
  const form = document.getElementById('addServiceForm');
  form.dataset.mode = 'add';
  document.getElementById('srvFormTitle').textContent = t('lbl_add_service') || 'Neue Dienstleistung';
  document.getElementById('srvEditId').value = '';
  document.getElementById('srvTitle').value = '';
  document.getElementById('srvCode').value = '';
  document.getElementById('srvDur').value = '30';
  document.getElementById('srvPrice').value = '0';
  document.getElementById('srvEmpAll').checked = true;
  renderSrvEmpCheckboxes();
  toggleEmpCheckboxes(true);
  // Unified: always use duration cards for every sector
  document.getElementById('srvStandardFields').hidden = true;
  document.getElementById('srvPhysioFields').hidden = false;
  document.getElementById('srvStandardColorRow').hidden = true;
  renderPhysioServiceCards();
}

function openServiceEdit(id) {
  const s = servicesCache.find(x => x.id === id);
  if (!s) return;
  resetServiceForm();
  const form = document.getElementById('addServiceForm');
  form.dataset.mode = 'edit';
  document.getElementById('srvFormTitle').textContent = 'Dienstleistung bearbeiten';
  document.getElementById('srvEditId').value = s.id;
  document.getElementById('srvTitle').value = s.title;
  document.getElementById('srvCode').value = s.code || '';

  // If price_config exists, use it. Otherwise build one from legacy duration_minutes+price.
  let durations = s.price_config?.durations;
  if (!durations || !Object.keys(durations).length) {
    if (s.duration_minutes) {
      durations = { [String(s.duration_minutes)]: { active: true, price: s.price || 0 } };
    } else {
      durations = {};
    }
  }
  renderPhysioServiceCards(durations);

  const assignedIds = new Set((s.employee_services || []).map(es => es.employee_id));
  const allChecked = assignedIds.size === 0 || assignedIds.size === teamMembers.length;
  document.getElementById('srvEmpAll').checked = allChecked;
  toggleEmpCheckboxes(allChecked);
  if (!allChecked) {
    document.querySelectorAll('input[name="srv_emp"]').forEach(cb => {
      cb.checked = assignedIds.has(cb.value);
    });
  }
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const PHYSIO_DURATIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90, 120];

function renderPhysioServiceCards(existingDurations) {
  const grid = document.getElementById('srvPhysioCards');
  if (!grid) return;
  const unitPrice = 0;
  grid.innerHTML = PHYSIO_DURATIONS.map(min => {
    const dur = existingDurations?.[String(min)] || {};
    const active = dur.active || false;
    const price = dur.price != null ? dur.price : '';
    return `<div class="srv-dur-card${active ? ' active' : ''}" data-dur="${min}">
      <div class="dur-label">${min}</div>
      <div class="dur-min">Minuten</div>
      <label class="dur-toggle">
        <input type="checkbox" class="dur-cb" ${active ? 'checked' : ''}>
        <span>Aktiv</span>
      </label>
      <input type="number" class="dur-price form-input" value="${price !== '' ? price : ''}" min="0" step="0.5" placeholder="Preis">
    </div>`;
  }).join('');
  grid.querySelectorAll('.dur-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const card = e.target.closest('.srv-dur-card');
      card.classList.toggle('active', e.target.checked);
    });
  });
  grid.querySelectorAll('.dur-price').forEach(inp => {
    inp.addEventListener('focus', () => {
      const card = inp.closest('.srv-dur-card');
      const dur = parseInt(card.dataset.dur);
      if (!inp.value && unitPrice) {
        inp.value = Math.round((dur / 5) * unitPrice * 100) / 100;
      }
    });
  });
}

function toggleEmpCheckboxes(disabled) {
  document.querySelectorAll('input[name="srv_emp"]').forEach(cb => {
    cb.disabled = disabled;
    cb.checked = disabled ? true : cb.checked;
    cb.closest('.emp-checkbox-item').style.opacity = disabled ? '0.5' : '1';
  });
}

function renderSrvEmpCheckboxes() {
  const container = document.getElementById('srvEmpCheckboxes');
  if (!container) return;
  container.innerHTML = teamMembers.map(m => {
    const name = m.business_name || m.email?.split('@')[0];
    return `<label class="emp-checkbox-item">
      <input type="checkbox" name="srv_emp" value="${m.id}" checked>
      <span>${name}</span>
    </label>`;
  }).join('');
}

document.getElementById('srvEmpAll').addEventListener('change', (e) => {
  toggleEmpCheckboxes(e.target.checked);
});

document.getElementById('srvCancelBtn').addEventListener('click', () => {
  document.getElementById('addServiceForm').hidden = true;
});

document.getElementById('srvSaveBtn').addEventListener('click', async () => {
  const title = document.getElementById('srvTitle').value.trim();
  if (!title) { showToast(t('err_generic'), 'error'); return; }
  const empIds = [...document.querySelectorAll('input[name="srv_emp"]:checked')].map(cb => cb.value);
  const mode = document.getElementById('addServiceForm').dataset.mode;

  const code = document.getElementById('srvCode').value.trim().toUpperCase() || null;

  // Always save price_config.durations (unified across sectors)
  const durations = {};
  const activeDurs = [];
  document.querySelectorAll('.srv-dur-card').forEach(card => {
    const dur = card.dataset.dur;
    const active = card.querySelector('.dur-cb').checked;
    const priceVal = card.querySelector('.dur-price').value;
    durations[dur] = { active, price: priceVal !== '' ? parseFloat(priceVal) : null };
    if (active) activeDurs.push({ minutes: parseInt(dur), price: priceVal !== '' ? parseFloat(priceVal) : 0 });
  });
  if (activeDurs.length === 0) {
    showToast('Bitte mindestens eine Dauer aktivieren.', 'error');
    return;
  }
  activeDurs.sort((a, b) => a.minutes - b.minutes);
  // Backward-compat fields use the smallest active duration
  const payload = {
    title, code,
    price_config: { durations },
    duration_minutes: activeDurs[0].minutes,
    price: activeDurs[0].price
  };

  if (mode === 'edit') {
    const editId = document.getElementById('srvEditId').value;
    console.log('[srvSave] editing service', editId, payload);
    const { error } = await supabase.from('services').update(payload).eq('id', editId);
    if (error) { console.error('[srvSave] update error:', error); showToast(t('err_generic'), 'error'); return; }
    await supabase.from('employee_services').delete().eq('service_id', editId);
    if (empIds.length) {
      await supabase.from('employee_services').insert(empIds.map(id => ({ employee_id: id, service_id: editId })));
    }
    showToast(t('saved'));
  } else {
    const ownerId = getOwnerId();
    const userId = currentSession.user.id;
    console.log('[srvSave] creating new service', { owner_id: ownerId, user_id: userId, ...payload });
    const insertPayload = { owner_id: ownerId, user_id: userId, ...payload };
    if (currentBusiness?.id) insertPayload.business_id = currentBusiness.id;
    const { data: srv, error } = await supabase.from('services').insert(insertPayload).select().single();
    if (error) { console.error('[srvSave] insert error:', error); showToast(t('err_generic'), 'error'); return; }
    if (empIds.length) {
      await supabase.from('employee_services').insert(empIds.map(id => ({ employee_id: id, service_id: srv.id })));
    }
    showToast(t('saved'));
  }
  document.getElementById('srvTitle').value = '';
  await loadServices();
  document.getElementById('addServiceForm').hidden = true;
});

let hoursEmpId = null;

document.getElementById('hoursEmpSelect').addEventListener('change', async () => {
  hoursEmpId = document.getElementById('hoursEmpSelect').value;
  await renderHoursGrid();
});

async function loadHoursPanel() {
  const { data: emps } = await supabase.from('profiles').select('id,business_name,email')
    .eq('owner_id', getOwnerId());
  const all = currentProfile.role === 'owner'
    ? [{ id: currentSession.user.id, business_name: currentProfile.business_name, email: currentSession.user.email }, ...(emps || [])]
    : [{ id: currentSession.user.id, business_name: currentProfile.business_name, email: currentSession.user.email }];
  const sel = document.getElementById('hoursEmpSelect');
  sel.innerHTML = all.map(e => `<option value="${e.id}">${e.business_name || e.email?.split('@')[0]}</option>`).join('');
  hoursEmpId = all[0]?.id || currentSession.user.id;
  await renderHoursGrid();

  // Standort-Öffnungstage section (Enterprise + owner)
  await renderHoursStandortSection();

  const calSection = document.querySelector('.hours-calendar-section');
  if (calSection) {
    calSection.hidden = currentProfile.role !== 'owner';
    if (currentProfile.role === 'owner') await renderHoursMiniCal();
  }
}

// ===== Standort-Öffnungstage (closed_days) =====
let hoursStandortId = null; // 'all' veya business UUID

async function renderHoursStandortSection() {
  const section = document.getElementById('hoursStandortSection');
  if (!section) return;
  const show = currentProfile.role === 'owner' && isEnterprise() && (myBusinesses?.length || 0) >= 1;
  section.hidden = !show;
  if (!show) return;

  const sel = document.getElementById('hoursStandortSelect');
  const multi = myBusinesses.length > 1;
  let opts = '';
  if (multi) opts += '<option value="all">Alle Standorte</option>';
  opts += myBusinesses.map(b => `<option value="${b.id}">${escapeHtml(b.business_name)}${b.is_default ? ' (Standard)' : ''}</option>`).join('');
  sel.innerHTML = opts;

  if (!hoursStandortId) hoursStandortId = currentBusiness?.id || myBusinesses[0]?.id;
  sel.value = hoursStandortId;

  renderHoursStandortDays();

  if (!sel.dataset.wired) {
    sel.dataset.wired = '1';
    sel.addEventListener('change', () => {
      hoursStandortId = sel.value;
      renderHoursStandortDays();
    });
  }
}

function renderHoursStandortDays() {
  const wrap = document.getElementById('hoursStandortDays');
  if (!wrap) return;

  const dayLabels = DAYS[currentLang] || DAYS.de;
  // Mevcut closed_days değerini bul (multi-biz "all" modunda kesişim göster)
  let closedSet = new Set();
  if (hoursStandortId === 'all') {
    // her gün: tüm business'larda kapalıysa kapalı kabul et (kesişim)
    const allClosed = myBusinesses.map(b => new Set((b.closed_days || []).map(Number)));
    for (let i = 0; i < 7; i++) {
      if (allClosed.every(s => s.has(i))) closedSet.add(i);
    }
  } else {
    const biz = myBusinesses.find(b => b.id === hoursStandortId);
    closedSet = new Set((biz?.closed_days || []).map(Number));
  }

  // 7 gün, Pazartesi başlangıç gösterimi için [1..6, 0]
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  wrap.innerHTML = dayOrder.map(i => {
    const isOpen = !closedSet.has(i);
    return `<button type="button" class="hours-day-pill ${isOpen ? 'is-open' : 'is-closed'}" data-day="${i}">
      ${isOpen ? '✓' : '✕'} ${dayLabels[i]}
    </button>`;
  }).join('');

  // Click handler
  wrap.querySelectorAll('.hours-day-pill').forEach(btn => {
    btn.addEventListener('click', () => toggleStandortDay(parseInt(btn.dataset.day, 10)));
  });
}

async function toggleStandortDay(day) {
  const targets = hoursStandortId === 'all' ? myBusinesses.map(b => b.id) : [hoursStandortId];

  for (const bizId of targets) {
    const biz = myBusinesses.find(b => b.id === bizId);
    if (!biz) continue;
    const current = new Set((biz.closed_days || []).map(Number));
    if (current.has(day)) current.delete(day);
    else current.add(day);
    const newArr = Array.from(current).sort((a, b) => a - b);
    const { error } = await supabase.from('businesses').update({ closed_days: newArr }).eq('id', bizId);
    if (error) { console.error('[closed_days]', error); showToast(t('err_generic'), 'error'); return; }
    biz.closed_days = newArr;
  }

  showToast('Öffnungstage aktualisiert ✓');
  renderHoursStandortDays();

  // Übersicht haftalık/aylık görünüm açıksa yenile
  if (scheduleView !== 'daily') await refreshActiveScheduleView();
}

let hoursBreaks = [];

async function renderHoursGrid() {
  const [{ data: hours }, { data: breaks }] = await Promise.all([
    supabase.from('working_hours').select('*').eq('user_id', hoursEmpId),
    supabase.from('breaks').select('*').eq('user_id', hoursEmpId)
  ]);
  hoursBreaks = breaks || [];
  const dayLabels = DAYS[currentLang] || DAYS.de;
  const grid = document.getElementById('hoursGrid');
  grid.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const h = hours?.find(x => x.day_of_week === i) || { start_time: '09:00:00', end_time: '17:00:00', is_active: (i > 0 && i < 6) };
    const dayBreaks = hoursBreaks.filter(b => b.day_of_week === i).sort((a, b) => a.start_time.localeCompare(b.start_time));
    const row = document.createElement('div');
    row.className = 'hours-row' + (h.is_active ? '' : ' inactive');
    row.innerHTML = `
      <div class="hours-day">
        <label class="toggle-switch">
          <input type="checkbox" id="wh-active-${i}" ${h.is_active ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        <span>${dayLabels[i]}</span>
      </div>
      <div></div>
      <div class="hours-times">
        <input class="form-input" id="wh-start-${i}" type="time" value="${h.start_time.substring(0, 5)}">
        <input class="form-input" id="wh-end-${i}" type="time" value="${h.end_time.substring(0, 5)}">
      </div>`;
    grid.appendChild(row);

    const breakWrap = document.createElement('div');
    breakWrap.className = 'hours-breaks-wrap';
    breakWrap.style.cssText = 'grid-column:1/-1;padding-left:44px;margin-bottom:8px;';
    breakWrap.innerHTML = dayBreaks.map(b => `
      <span class="break-chip">${b.start_time.substring(0, 5)}–${b.end_time.substring(0, 5)}
        <button class="break-del" data-id="${b.id}" title="Entfernen">×</button>
      </span>
    `).join('') + `
      <button class="btn-ghost-sm break-add-btn" data-day="${i}" style="font-size:12px;padding:4px 10px;">+ Pause</button>
      <span class="break-form" id="break-form-${i}" style="display:none;gap:6px;align-items:center;">
        <input type="time" class="form-input" id="break-start-${i}" style="width:100px;padding:4px 8px;font-size:13px;">
        <input type="time" class="form-input" id="break-end-${i}" style="width:100px;padding:4px 8px;font-size:13px;">
        <button class="btn-primary break-confirm" data-day="${i}" style="font-size:12px;padding:4px 10px;">Hinzufügen</button>
      </span>
    `;
    grid.appendChild(breakWrap);
  }

  grid.querySelectorAll('.break-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.day;
      const form = document.getElementById(`break-form-${d}`);
      form.style.display = form.style.display === 'none' ? 'inline-flex' : 'none';
    });
  });
  grid.querySelectorAll('.break-confirm').forEach(btn => {
    btn.addEventListener('click', async () => {
      const d = parseInt(btn.dataset.day);
      const s = document.getElementById(`break-start-${d}`).value;
      const e = document.getElementById(`break-end-${d}`).value;
      if (!s || !e) { showToast('Zeiten auswählen', 'error'); return; }
      if (s >= e) { showToast('Ende muss nach Start liegen', 'error'); return; }
      const { error } = await supabase.from('breaks').insert({ user_id: hoursEmpId, day_of_week: d, start_time: s + ':00', end_time: e + ':00' });
      if (error) { showToast(t('err_generic'), 'error'); return; }
      await renderHoursGrid();
    });
  });
  grid.querySelectorAll('.break-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('breaks').delete().eq('id', btn.dataset.id);
      if (error) { showToast(t('err_generic'), 'error'); return; }
      await renderHoursGrid();
    });
  });
}

document.getElementById('hoursSaveBtn').addEventListener('click', async () => {
  const payload = [];
  for (let i = 0; i < 7; i++) {
    payload.push({
      user_id: hoursEmpId, day_of_week: i,
      start_time: document.getElementById(`wh-start-${i}`).value + ':00',
      end_time: document.getElementById(`wh-end-${i}`).value + ':00',
      is_active: document.getElementById(`wh-active-${i}`).checked
    });
  }
  const { error } = await supabase.from('working_hours').upsert(payload, { onConflict: 'user_id,day_of_week' });
  if (error) { showToast(t('err_generic'), 'error'); return; }
  showToast(t('alert_hours_saved'));
});

let hoursCalDate = new Date();
let hoursCustomDays = [];

async function renderHoursMiniCal() {
  const userId = hoursEmpId || currentSession.user.id;
  const ownerId = getOwnerId();
  const [{ data: wh }, { data: cd }] = await Promise.all([
    supabase.from('working_hours').select('day_of_week,is_active').eq('user_id', userId),
    supabase.from('custom_days').select('*').eq('owner_id', ownerId)
  ]);
  hoursCustomDays = cd || [];
  const openDays = new Set((wh || []).filter(w => w.is_active).map(w => w.day_of_week));

  const year = hoursCalDate.getFullYear();
  const month = hoursCalDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  document.getElementById('hoursCalTitle').textContent =
    hoursCalDate.toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'de-DE', { month: 'long', year: 'numeric' });

  const grid = document.getElementById('hoursMiniCal');
  grid.innerHTML = '';
  const wdays = currentLang === 'tr'
    ? ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']
    : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  wdays.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-weekday';
    el.textContent = d;
    grid.appendChild(el);
  });

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const custom = hoursCustomDays.find(c => c.date === dateStr);

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (isPast ? ' past' : '') + (isToday ? ' today' : '');
    cell.textContent = d;

    const dot = document.createElement('span');
    dot.className = 'dot ' + (custom ? custom.type : (openDays.has(dow) ? 'open' : 'closed'));
    cell.appendChild(dot);

    if (!isPast) {
      cell.addEventListener('click', () => {
        document.querySelectorAll('#hoursMiniCal .cal-day').forEach(el => el.classList.remove('selected'));
        cell.classList.add('selected');
        document.getElementById('sdDate').value = dateStr;
      });
    }
    grid.appendChild(cell);
  }
  renderSpecialDaysList();
}

document.getElementById('hoursCalPrev').addEventListener('click', () => {
  hoursCalDate.setMonth(hoursCalDate.getMonth() - 1);
  renderHoursMiniCal();
});
document.getElementById('hoursCalNext').addEventListener('click', () => {
  hoursCalDate.setMonth(hoursCalDate.getMonth() + 1);
  renderHoursMiniCal();
});

function renderSpecialDaysList() {
  const list = document.getElementById('specialDaysList');
  if (!hoursCustomDays.length) { list.innerHTML = '<div style="color:var(--text-faint);font-size:13px;">Keine Sondertage vorhanden.</div>'; return; }
  const sorted = [...hoursCustomDays].sort((a, b) => a.date.localeCompare(b.date));
  list.innerHTML = sorted.map(d => {
    const timeRange = d.start_time && d.end_time ? ` ${d.start_time.substring(0, 5)}–${d.end_time.substring(0, 5)}` : '';
    return `
    <div class="special-day-item">
      <span class="sd-date">${d.date}</span>
      <span class="sd-badge ${d.type}">${d.type === 'closed' ? 'Geschlossen' : d.type === 'holiday' ? 'Feiertag' : 'Sondertermin'}${timeRange}</span>
      <span class="sd-note">${d.note || ''}</span>
      <button onclick="deleteSpecialDay('${d.id}')">×</button>
    </div>
  `;
  }).join('');
}

window.deleteSpecialDay = async function (id) {
  const { error } = await supabase.from('custom_days').delete().eq('id', id);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  showToast('Gelöscht');
  await renderHoursMiniCal();
};

document.getElementById('sdAddBtn').addEventListener('click', async () => {
  const von = document.getElementById('sdDate').value;
  const bis = document.getElementById('sdBis').value;
  const startTime = document.getElementById('sdStartTime').value;
  const endTime = document.getElementById('sdEndTime').value;
  const type = document.getElementById('sdType').value;
  const note = document.getElementById('sdNote').value.trim();
  if (!von) { showToast('Von Datum wählen', 'error'); return; }

  const end = bis || von;
  const startDate = new Date(von);
  const endDate = new Date(end);
  if (endDate < startDate) { showToast('Bis darf nicht vor Von liegen', 'error'); return; }

  const ownerId = getOwnerId();
  const rows = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    rows.push({
      owner_id: ownerId,
      date: d.toISOString().split('T')[0],
      type, note,
      start_time: startTime || null,
      end_time: endTime || null
    });
    d.setDate(d.getDate() + 1);
  }

  const { error } = await supabase.from('custom_days').upsert(rows, { onConflict: 'owner_id,date' });
  if (error) { showToast(t('err_generic'), 'error'); return; }
  showToast(rows.length > 1 ? `${rows.length} Tage hinzugefügt` : '1 Tag hinzugefügt');
  document.getElementById('sdNote').value = '';
  document.getElementById('sdBis').value = '';
  document.getElementById('sdStartTime').value = '';
  document.getElementById('sdEndTime').value = '';
  await renderHoursMiniCal();
});

async function loadTeam() {
  const ownerId = getOwnerId();
  let data = [];

  // Primary: direct Supabase query (uses v20 tenant-scoped RLS).
  const { data: rows, error: tErr } = await supabase
    .from('profiles')
    .select('id, email, business_name, role, booking_slug, avatar_url, anrede, owner_id')
    .or(`id.eq.${ownerId},owner_id.eq.${ownerId}`)
    .order('role', { ascending: true })  // owner first, then employees
    .order('created_at', { ascending: true });

  if (tErr) {
    console.error('[loadTeam] supabase error', tErr);
  } else if (rows && rows.length) {
    data = rows;
  }

  // Enterprise + multi-business: aktif business'a atanmamış employee'leri filtrele
  // (owner her zaman görünür)
  if (isEnterprise() && currentBusiness?.id && myBusinesses.length > 1) {
    const { data: assigned } = await supabase
      .from('employee_business_assignments')
      .select('employee_id')
      .eq('business_id', currentBusiness.id);
    const assignedIds = new Set((assigned || []).map(a => a.employee_id));
    data = data.filter(p => p.role === 'owner' || assignedIds.has(p.id));
  }

  // Fallback: legacy VPS endpoint (kept for any RLS edge cases).
  if (!data.length) {
    try {
      const res = await fetch(`${API}/team?owner_id=${ownerId}`);
      if (res.ok) data = await res.json();
    } catch (e) {
      console.warn('[loadTeam] VPS fallback failed', e);
    }
  }

  if (data.length === 0) {
    console.warn('[loadTeam] no team rows returned — showing self only');
    data = [{
      id: currentSession.user.id,
      email: currentSession.user.email,
      business_name: currentProfile.business_name || currentSession.user.email.split('@')[0],
      role: currentProfile.role,
    }];
  }
  teamMembers = data;

  if (currentProfile.role !== 'owner') return;
  const code = currentProfile.company_code || '—';
  document.getElementById('inviteCode').textContent = code;
  const inviteUrl = code === '—' ? '—' : `${location.origin}/employee-signup.html?code=${encodeURIComponent(code)}`;
  document.getElementById('inviteLink').textContent = inviteUrl;
  document.getElementById('copyInviteBtn').onclick = () => {
    navigator.clipboard.writeText(code);
    showToast(t('copied'));
  };
  document.getElementById('copyInviteLinkBtn').onclick = () => {
    navigator.clipboard.writeText(inviteUrl);
    showToast(t('copied'));
  };

  const list = document.getElementById('employeeList');
  list.innerHTML = data.map(m => {
    const name = m.business_name || m.email?.split('@')[0] || '—';
    const initial = (name[0] || '?').toUpperCase();
    const avatar = m.avatar_url ? `<img src="${m.avatar_url}" alt="">` : initial;
    const bookingLink = buildBookingUrl(m);
    const shortLink = bookingLink.replace(/^https?:\/\/(www\.)?/i, '');
    return `<div class="emp-card" data-emp-id="${m.id}">
      <div class="emp-avatar">${avatar}</div>
      <div class="emp-name">${name} ${m.id === currentSession.user.id ? t('me') : ''}</div>
      <div class="emp-role">${m.role === 'owner' ? 'Geschäftsführung' : 'Mitarbeiter'}</div>
      ${m.id === currentSession.user.id ? '<div class="emp-badge" title="Sie"></div>' : ''}
      <div class="emp-link-row">
        <a class="emp-link-text" href="${bookingLink}" target="_blank" rel="noopener" title="${bookingLink}"><span class="svg-icon" style="width:13px;height:13px;display:inline-flex;vertical-align:-2px;margin-right:4px;color:var(--text-muted);">${ICON.link}</span>${escapeHtml(shortLink)}</a>
        <button class="btn-icon emp-copy-link" title="Link kopieren" data-link="${bookingLink}" style="display:inline-flex;align-items:center;justify-content:center;"><span class="svg-icon" style="width:12px;height:12px;display:inline-flex;">${ICON.clipboard}</span></button>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('.emp-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.emp-link-row')) return;
      openEmpDetail(card.dataset.empId);
    });
  });
  list.querySelectorAll('.emp-link-row a, .emp-link-row button').forEach(el => {
    el.addEventListener('click', (e) => e.stopPropagation());
  });

  // Faz 3: Aktif business'a atanmamış owner employee'leri listele
  await renderOtherStandortEmps();
  list.querySelectorAll('.emp-copy-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      navigator.clipboard.writeText(btn.dataset.link);
      showToast(t('copied'));
    });
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

// ===== Faz 3: Cross-business — diğer standortlardan henüz buraya atanmamış employee'ler =====
async function renderOtherStandortEmps() {
  const wrap = document.getElementById('otherStandortEmps');
  const listEl = document.getElementById('otherStandortEmpsList');
  if (!wrap || !listEl) return;

  // Yalnız owner + Enterprise + birden fazla business olduğunda göster
  if (currentProfile.role !== 'owner' || !isEnterprise() || myBusinesses.length <= 1 || !currentBusiness?.id) {
    wrap.hidden = true;
    return;
  }

  // Owner'ın tüm employee'lerini çek
  const { data: allEmps } = await supabase
    .from('profiles')
    .select('id, email, business_name, avatar_url')
    .eq('owner_id', getOwnerId())
    .eq('role', 'employee');

  if (!allEmps || allEmps.length === 0) { wrap.hidden = true; return; }

  // Aktif business'a atanmış olanları al
  const { data: assigned } = await supabase
    .from('employee_business_assignments')
    .select('employee_id')
    .eq('business_id', currentBusiness.id);
  const assignedSet = new Set((assigned || []).map(a => a.employee_id));

  // Burada olmayanlar
  const others = allEmps.filter(e => !assignedSet.has(e.id));
  if (others.length === 0) { wrap.hidden = true; return; }
  wrap.hidden = false;

  // Her employee'nin hangi business'lara atanmış olduğunu özetle
  const empIds = others.map(e => e.id);
  const { data: theirAssignments } = await supabase
    .from('employee_business_assignments')
    .select('employee_id, business_id')
    .in('employee_id', empIds);
  const bizNameById = new Map(myBusinesses.map(b => [b.id, b.business_name]));
  const empBizMap = {};
  (theirAssignments || []).forEach(a => {
    if (!empBizMap[a.employee_id]) empBizMap[a.employee_id] = [];
    const name = bizNameById.get(a.business_id);
    if (name) empBizMap[a.employee_id].push(name);
  });

  listEl.innerHTML = others.map(e => {
    const name = e.business_name || e.email?.split('@')[0] || '—';
    const elsewhere = (empBizMap[e.id] || []).join(', ') || 'Keine Standorte';
    return `<div class="other-standort-emp-row" data-emp="${e.id}">
      <div>
        <div class="other-standort-emp-name">${escapeHtml(name)}</div>
        <div class="other-standort-emp-meta">Arbeitet in: ${escapeHtml(elsewhere)}</div>
      </div>
      <button class="btn-primary" type="button" data-add-emp="${e.id}" style="padding:6px 14px;font-size:12px;">＋ Hier hinzufügen</button>
    </div>`;
  }).join('');

  listEl.querySelectorAll('button[data-add-emp]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const empId = btn.dataset.addEmp;
      btn.disabled = true;
      btn.textContent = '…';
      const { data: g } = await supabase
        .from('employee_groups')
        .select('id')
        .eq('business_id', currentBusiness.id)
        .eq('name', 'Mitarbeiter')
        .maybeSingle();
      const { error } = await supabase.from('employee_business_assignments').upsert({
        employee_id: empId,
        business_id: currentBusiness.id,
        group_id: g?.id || null,
      }, { onConflict: 'employee_id,business_id' });
      if (error) {
        console.error('[add-other-emp]', error);
        showToast(t('err_generic'), 'error');
        btn.disabled = false;
        btn.textContent = '＋ Hier hinzufügen';
        return;
      }
      showToast('Mitarbeiter hinzugefügt ✓');
      await loadTeam();
    });
  });
}

// ===== RBAC: Employee permissions UI (Berechtigungen tab) =====
const RBAC_MODULES = [
  { id: 'dashboard',     label: 'Übersicht' },
  { id: 'calendar',      label: 'Termine' },
  { id: 'customers',     label: 'Kunden' },
  { id: 'services',      label: 'Dienstleistungen' },
  { id: 'hours',         label: 'Arbeitszeiten' },
  { id: 'team',          label: 'Personal' },
  { id: 'notes',         label: 'Notizen' },
  { id: 'anamnese',      label: 'Anamnese' },
  { id: 'prescriptions', label: 'Rezepte' },
  { id: 'abrechnung',    label: 'Abrechnung' },
  { id: 'fahrtenbuch',   label: 'Fahrtenbuch' },
  { id: 'b2b',           label: 'B2B' },
  { id: 'b2c',           label: 'B2C' },
  { id: 'feedback',      label: 'Feedback' },
];

async function loadEmpPermissions(empId) {
  if (currentProfile.role !== 'owner' || !currentBusiness?.id) return;
  const tab = document.getElementById('empTabPermissions');
  if (tab) tab.hidden = false;

  // Aktif business label
  const lbl = document.getElementById('empPermBusinessLabel');
  if (lbl) lbl.textContent = currentBusiness.business_name || '—';

  // Standorte (multi-business sadece Enterprise + >1 business)
  await renderEmpStandortList(empId);

  // Grup listesi
  const { data: groups } = await supabase
    .from('employee_groups')
    .select('id, name, is_default')
    .eq('business_id', currentBusiness.id)
    .order('is_default', { ascending: false })
    .order('name');

  const groupSel = document.getElementById('empPermGroup');
  groupSel.innerHTML = '<option value="">— Individuell —</option>' +
    (groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

  // Mevcut atama
  const { data: assignment } = await supabase
    .from('employee_business_assignments')
    .select('group_id')
    .eq('employee_id', empId)
    .eq('business_id', currentBusiness.id)
    .maybeSingle();

  groupSel.value = assignment?.group_id || '';

  await renderEmpPermGrid(empId, assignment?.group_id);

  groupSel.onchange = () => renderEmpPermGrid(empId, groupSel.value || null);

  document.getElementById('empPermSaveBtn').onclick = () => saveEmpPermissions(empId);
}

// ===== Faz 3: Cross-business assignment UI =====
async function renderEmpStandortList(empId) {
  const wrap = document.getElementById('empStandortWrap');
  const list = document.getElementById('empStandortList');
  if (!wrap || !list) return;

  // Sadece Enterprise + birden fazla business varsa göster
  if (!isEnterprise() || myBusinesses.length <= 1) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  const { data: assignments } = await supabase
    .from('employee_business_assignments')
    .select('business_id')
    .eq('employee_id', empId);
  const assignedSet = new Set((assignments || []).map(a => a.business_id));

  list.innerHTML = myBusinesses.map(b => `
    <label class="perm-item">
      <input type="checkbox" data-standort="${b.id}" ${assignedSet.has(b.id) ? 'checked' : ''} />
      <span>${escapeHtml(b.business_name)}${b.is_default ? ' <span class="biz-row-default-tag">(Standard)</span>' : ''}</span>
    </label>
  `).join('');

  // Anında kaydet (her tıklamada)
  list.querySelectorAll('input[data-standort]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const bizId = cb.dataset.standort;
      const checked = cb.checked;
      // En az 1 standort kalmalı
      if (!checked) {
        const remaining = Array.from(list.querySelectorAll('input[data-standort]:checked')).length;
        if (remaining === 0) {
          cb.checked = true;
          showToast('Mindestens ein Standort erforderlich.', 'error');
          return;
        }
      }
      if (checked) {
        // Default Mitarbeiter grubunu bul ve ata
        const { data: g } = await supabase
          .from('employee_groups')
          .select('id')
          .eq('business_id', bizId)
          .eq('name', 'Mitarbeiter')
          .maybeSingle();
        const { error } = await supabase.from('employee_business_assignments').upsert({
          employee_id: empId,
          business_id: bizId,
          group_id: g?.id || null,
        }, { onConflict: 'employee_id,business_id' });
        if (error) { console.error('[standort-add]', error); cb.checked = false; showToast(t('err_generic'), 'error'); return; }
        showToast('Standort hinzugefügt ✓');
      } else {
        const { error } = await supabase
          .from('employee_business_assignments')
          .delete()
          .eq('employee_id', empId)
          .eq('business_id', bizId);
        if (error) { console.error('[standort-remove]', error); cb.checked = true; showToast(t('err_generic'), 'error'); return; }
        showToast('Standort entfernt ✓');
      }
    });
  });
}

async function renderEmpPermGrid(empId, groupId) {
  const grid = document.getElementById('empPermGrid');
  if (!grid) return;

  // Grup default'larını çek
  let groupAccess = {};
  if (groupId) {
    const { data: scopes } = await supabase
      .from('group_scopes')
      .select('module, has_access')
      .eq('group_id', groupId);
    (scopes || []).forEach(s => { groupAccess[s.module] = s.has_access; });
  }

  // Bireysel override'lar
  const { data: overrides } = await supabase
    .from('employee_scope_overrides')
    .select('module, has_access')
    .eq('employee_id', empId)
    .eq('business_id', currentBusiness.id);
  const overrideMap = {};
  (overrides || []).forEach(o => { overrideMap[o.module] = o.has_access; });

  grid.innerHTML = RBAC_MODULES.map(m => {
    const effective = overrideMap[m.id] !== undefined ? overrideMap[m.id] : (groupAccess[m.id] === true);
    const isOverride = overrideMap[m.id] !== undefined;
    return `<label class="perm-item">
      <input type="checkbox" data-perm="${m.id}" ${effective ? 'checked' : ''} />
      <span>${m.label}</span>
      ${isOverride ? '<span class="perm-item-override">OVERRIDE</span>' : ''}
    </label>`;
  }).join('');
}

async function saveEmpPermissions(empId) {
  const groupSel = document.getElementById('empPermGroup');
  const newGroupId = groupSel.value || null;

  // 1. Grup atamasını güncelle
  const { error: assignErr } = await supabase
    .from('employee_business_assignments')
    .upsert({
      employee_id: empId,
      business_id: currentBusiness.id,
      group_id: newGroupId,
    }, { onConflict: 'employee_id,business_id' });
  if (assignErr) { console.error('[perm-assign]', assignErr); showToast(t('err_generic'), 'error'); return; }

  // 2. Mevcut override'ları sil
  await supabase
    .from('employee_scope_overrides')
    .delete()
    .eq('employee_id', empId)
    .eq('business_id', currentBusiness.id);

  // 3. UI'da işaretlenenler grup default'undan farklıysa override yaz
  let groupAccess = {};
  if (newGroupId) {
    const { data: scopes } = await supabase
      .from('group_scopes')
      .select('module, has_access')
      .eq('group_id', newGroupId);
    (scopes || []).forEach(s => { groupAccess[s.module] = s.has_access; });
  }

  const overrides = [];
  document.querySelectorAll('#empPermGrid input[data-perm]').forEach(cb => {
    const mod = cb.dataset.perm;
    const userChecked = cb.checked;
    const groupDefault = groupAccess[mod] === true;
    if (userChecked !== groupDefault) {
      overrides.push({
        employee_id: empId,
        business_id: currentBusiness.id,
        module: mod,
        has_access: userChecked,
      });
    }
  });
  if (overrides.length) {
    const { error: ovErr } = await supabase.from('employee_scope_overrides').insert(overrides);
    if (ovErr) { console.error('[perm-overrides]', ovErr); showToast(t('err_generic'), 'error'); return; }
  }

  showToast('Berechtigungen gespeichert ✓');
}

function openEmpDetail(empId) {
  const m = teamMembers.find(tm => tm.id === empId);
  if (!m) return;
  detailEmpId = empId;

  // RBAC tab'ı sadece owner + employee için
  if (currentProfile.role === 'owner' && m.role === 'employee') {
    loadEmpPermissions(empId).catch(err => console.warn('[loadEmpPermissions]', err));
  } else {
    const tab = document.getElementById('empTabPermissions');
    if (tab) tab.hidden = true;
  }

  document.getElementById('empDetailName').textContent = m.business_name || m.email?.split('@')[0] || '—';
  document.getElementById('empDetailRole').textContent = m.role || 'employee';
  document.getElementById('empDetailEmail').textContent = m.email || '—';
  const anredeSel = document.getElementById('empDetailAnrede');
  if (anredeSel) {
    anredeSel.value = m.anrede || '';
    anredeSel.onchange = async () => {
      const newVal = anredeSel.value || null;
      const { error } = await supabase.from('profiles').update({ anrede: newVal }).eq('id', empId);
      if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
      m.anrede = newVal;
      showToast('Anrede gespeichert');
    };
  }
  renderEmpAvatar(document.getElementById('empDetailAvatar'), m);
  renderEmpAvatar(document.getElementById('empAvatarPreview'), m);

  const bookingLink = buildBookingUrl(m);
  const linkInput = document.getElementById('empBookingLink');
  linkInput.value = bookingLink;
  document.getElementById('empCopyLinkBtn').onclick = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink);
    showToast('Link kopiert');
  };

  document.getElementById('teamListView').hidden = true;
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
      detail.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      detail.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tc = document.getElementById('tab-' + btn.dataset.tab);
      if (tc) tc.classList.add('active');
      if (btn.dataset.tab === 'kalender') initEmpCalTab(empId);
      if (btn.dataset.tab === 'hours') loadEmpHours(empId);
      if (btn.dataset.tab === 'services') loadEmpServices(empId);
      if (btn.dataset.tab === 'certificates') loadEmpCertificates(empId);
    });
  });
  detail.querySelector('.tab-btn[data-tab="info"]')?.classList.add('active');
  document.getElementById('tab-info')?.classList.add('active');

  document.getElementById('empDetailBack').onclick = () => {
    document.getElementById('teamListView').hidden = false;
    document.getElementById('teamDetailView').hidden = true;
    detailEmpId = null;
  };

  const isOwn = m.id === currentSession.user.id;
  document.getElementById('empRemoveBtn').hidden = isOwn;
  document.getElementById('empRemoveBtn').onclick = async () => {
    if (!confirm(t('btn_remove') + '?')) return;
    await supabase.from('profiles').update({ owner_id: null, role: 'owner' }).eq('id', m.id);
    await loadTeam();
    document.getElementById('teamListView').hidden = false;
    document.getElementById('teamDetailView').hidden = true;
  };

  supabase.from('calendar_integrations').select('*').eq('user_id', m.id).eq('provider', 'google').maybeSingle()
    .then(({ data }) => {
      document.getElementById('empGoogleStatus').textContent = data?.access_token ? t('status_connected') : t('status_disconnected');
    });
}

function initEmpCalTab(empId) {
  const tz = 'Europe/Berlin';
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
  const dateInput = document.getElementById('empCalDate');
  if (!dateInput.value) dateInput.value = todayStr;

  const canEdit = currentProfile.role === 'owner' || empId === currentSession.user.id;
  document.getElementById('empCalAddBtn').style.display = canEdit ? '' : 'none';

  loadEmpDaySchedule(empId, dateInput.value);

  dateInput.onchange = () => loadEmpDaySchedule(empId, dateInput.value);

  document.getElementById('empCalPrev').onclick = () => {
    const d = new Date(dateInput.value + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    dateInput.value = d.toISOString().substring(0, 10);
    loadEmpDaySchedule(empId, dateInput.value);
  };
  document.getElementById('empCalNext').onclick = () => {
    const d = new Date(dateInput.value + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    dateInput.value = d.toISOString().substring(0, 10);
    loadEmpDaySchedule(empId, dateInput.value);
  };
  document.getElementById('empCalAddBtn').onclick = async () => {
    const dateVal = dateInput.value;
    await prefillBookingModal(dateVal + 'T09:00');
    document.getElementById('bkEmployee').value = empId;
  };
}

async function loadEmpDaySchedule(empId, dateStr) {
  const list = document.getElementById('empDaySchedule');
  list.innerHTML = '<div class="emp-day-empty">Lädt…</div>';

  const dayStart = dateStr + 'T00:00:00';
  const dayEnd = dateStr + 'T23:59:59';

  const [{ data: bks }, { data: leaves }] = await Promise.all([
    supabase.from('bookings').select('*,services(title,color,code)')
      .eq('user_id', empId)
      .gte('start_time', new Date(dayStart).toISOString())
      .lte('start_time', new Date(dayEnd).toISOString())
      .neq('status', 'cancelled').order('start_time'),
    supabase.from('time_offs').select('*')
      .eq('employee_id', empId)
      .lte('start_date', new Date(dayEnd).toISOString())
      .gte('end_date', new Date(dayStart).toISOString())
  ]);

  const items = [];
  (bks || []).forEach(b => items.push({ type: 'booking', sort: b.start_time, data: b }));
  (leaves || []).forEach(l => items.push({ type: 'leave', sort: l.start_date, data: l }));
  items.sort((a, b) => a.sort.localeCompare(b.sort));

  if (!items.length) { list.innerHTML = '<div class="emp-day-empty">Keine Termine</div>'; return; }

  const canEdit = currentProfile.role === 'owner' || empId === currentSession.user.id;

  list.innerHTML = items.map(item => {
    if (item.type === 'leave') {
      const l = item.data;
      return `<div class="emp-slot emp-slot-leave">
        <span class="emp-slot-time">❌ Ganztags</span>
        <div class="emp-slot-info">
          <div class="emp-slot-customer">${l.reason || 'Abwesenheit'}</div>
        </div>
      </div>`;
    }
    const b = item.data;
    const color = b.services?.color || 'var(--primary)';
    return `<div class="emp-slot" data-bk-id="${b.id}" style="border-left:3px solid ${color};">
      <span class="emp-slot-time">${fmtTime(b.start_time)}${b.end_time ? ' – ' + fmtTime(b.end_time) : ''}</span>
      <div class="emp-slot-info">
        <div class="emp-slot-customer">${b.customer_name || '—'}</div>
        <div class="emp-slot-service">${b.services?.title || '—'} ${b.services?.code ? '<span style="font-size:10px;color:var(--text-muted);margin-left:4px;background:var(--bg-elevated);padding:1px 4px;border-radius:3px;">' + escapeHtml(b.services.code) + '</span>' : ''}</div>
      </div>
      ${canEdit ? `<span class="btn-icon" style="opacity:.5;font-size:12px;">✏️</span>` : ''}
    </div>`;
  }).join('');

  if (canEdit) {
    list.querySelectorAll('[data-bk-id]').forEach(el => {
      el.addEventListener('click', () => {
        const bk = (bks || []).find(b => b.id === el.dataset.bkId);
        if (bk) openBookingModal(bk);
      });
    });
  }
}

async function loadEmpHours(empId) {
  const [{ data: hours }, { data: breaks }] = await Promise.all([
    supabase.from('working_hours').select('*').eq('user_id', empId),
    supabase.from('breaks').select('*').eq('user_id', empId)
  ]);
  const empBreaks = breaks || [];
  const dayLabels = DAYS[currentLang] || DAYS.de;
  const grid = document.getElementById('empHoursGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const h = hours?.find(x => x.day_of_week === i) || { start_time: '09:00:00', end_time: '17:00:00', is_active: (i > 0 && i < 6) };
    const dayBreaks = empBreaks.filter(b => b.day_of_week === i).sort((a, b) => a.start_time.localeCompare(b.start_time));
    const row = document.createElement('div');
    row.className = 'hours-row' + (h.is_active ? '' : ' inactive');
    row.innerHTML = `
      <div class="hours-day">
        <label class="toggle-switch">
          <input type="checkbox" id="ewh-active-${i}" ${h.is_active ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        <span>${dayLabels[i]}</span>
      </div>
      <div></div>
      <div class="hours-times">
        <input class="form-input" id="ewh-start-${i}" type="time" value="${h.start_time.substring(0, 5)}">
        <input class="form-input" id="ewh-end-${i}" type="time" value="${h.end_time.substring(0, 5)}">
      </div>`;
    grid.appendChild(row);

    const breakWrap = document.createElement('div');
    breakWrap.className = 'hours-breaks-wrap';
    breakWrap.style.cssText = 'grid-column:1/-1;padding-left:44px;margin-bottom:8px;';
    breakWrap.innerHTML = dayBreaks.map(b => `
      <span class="break-chip">${b.start_time.substring(0, 5)}–${b.end_time.substring(0, 5)}
        <button class="break-del" data-id="${b.id}" title="Entfernen">×</button>
      </span>
    `).join('') + `
      <button class="btn-ghost-sm emp-break-add" data-day="${i}" style="font-size:12px;padding:4px 10px;">+ Pause</button>
      <span class="break-form" id="emp-break-form-${i}" style="display:none;gap:6px;align-items:center;">
        <input type="time" class="form-input" id="emp-break-start-${i}" style="width:100px;padding:4px 8px;font-size:13px;">
        <input type="time" class="form-input" id="emp-break-end-${i}" style="width:100px;padding:4px 8px;font-size:13px;">
        <button class="btn-primary emp-break-confirm" data-day="${i}" style="font-size:12px;padding:4px 10px;">Hinzufügen</button>
      </span>
    `;
    grid.appendChild(breakWrap);
  }

  grid.querySelectorAll('.emp-break-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.day;
      const form = document.getElementById(`emp-break-form-${d}`);
      form.style.display = form.style.display === 'none' ? 'inline-flex' : 'none';
    });
  });
  grid.querySelectorAll('.emp-break-confirm').forEach(btn => {
    btn.addEventListener('click', async () => {
      const d = parseInt(btn.dataset.day);
      const s = document.getElementById(`emp-break-start-${d}`).value;
      const e = document.getElementById(`emp-break-end-${d}`).value;
      if (!s || !e) { showToast('Zeiten auswählen', 'error'); return; }
      if (s >= e) { showToast('Ende muss nach Start liegen', 'error'); return; }
      const { error } = await supabase.from('breaks').insert({ user_id: empId, day_of_week: d, start_time: s + ':00', end_time: e + ':00' });
      if (error) { showToast(t('err_generic'), 'error'); return; }
      await loadEmpHours(empId);
    });
  });
  grid.querySelectorAll('.break-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('breaks').delete().eq('id', btn.dataset.id);
      if (error) { showToast(t('err_generic'), 'error'); return; }
      await loadEmpHours(empId);
    });
  });

  const saveBtn = document.getElementById('empHoursSaveBtn');
  if (saveBtn) saveBtn.onclick = async () => {
    const payload = [];
    for (let i = 0; i < 7; i++) {
      payload.push({
        user_id: empId, day_of_week: i,
        start_time: document.getElementById(`ewh-start-${i}`).value + ':00',
        end_time: document.getElementById(`ewh-end-${i}`).value + ':00',
        is_active: document.getElementById(`ewh-active-${i}`).checked
      });
    }
    const { error } = await supabase.from('working_hours').upsert(payload, { onConflict: 'user_id,day_of_week' });
    if (error) { showToast(t('err_generic'), 'error'); return; }
    showToast(t('alert_hours_saved'));
  };
}

async function loadEmpServices(empId) {
  const grid = document.getElementById('empServicesGrid');
  if (!grid) return;
  let allQ = supabase.from('services').select('id,title,duration_minutes,price,price_config,code,color')
    .or(`owner_id.eq.${getOwnerId()},user_id.eq.${getOwnerId()}`)
    .order('title');
  allQ = bizScope(allQ, 'services');
  const [{ data: all }, { data: assigned }] = await Promise.all([
    allQ,
    supabase.from('employee_services').select('service_id').eq('employee_id', empId)
  ]);
  const assignedIds = new Set((assigned || []).map(x => x.service_id));
  const total = (all || []).length;
  const selectedCount = assignedIds.size;

  grid.innerHTML = `
    <div class="emp-srv-toolbar">
      <span class="emp-srv-count">${selectedCount} von ${total} ausgewählt</span>
      <div class="emp-srv-toolbar-actions">
        <button type="button" class="btn-ghost-sm" data-srv-action="all">Alle</button>
        <button type="button" class="btn-ghost-sm" data-srv-action="none">Keine</button>
      </div>
    </div>
    <div class="emp-srv-list">
      ${(all || []).map(s => {
        const checked = assignedIds.has(s.id);
        return `<label class="emp-srv-row ${checked ? 'is-selected' : ''}" data-srv-id="${s.id}">
          <input type="checkbox" class="emp-srv-chk" data-srv="${s.id}" ${checked ? 'checked' : ''}>
          <span class="emp-srv-row-title">${escapeHtml(s.title)}</span>
        </label>`;
      }).join('')}
    </div>
  `;

  const updateCount = () => {
    const sel = grid.querySelectorAll('.emp-srv-chk:checked').length;
    const tot = grid.querySelectorAll('.emp-srv-chk').length;
    const c = grid.querySelector('.emp-srv-count');
    if (c) c.textContent = `${sel} von ${tot} ausgewählt`;
  };

  grid.querySelectorAll('.emp-srv-chk').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      e.stopPropagation();
      const row = chk.closest('.emp-srv-row');
      if (row) row.classList.toggle('is-selected', chk.checked);
      if (chk.checked) {
        await supabase.from('employee_services').insert({ employee_id: empId, service_id: chk.dataset.srv });
      } else {
        await supabase.from('employee_services').delete().eq('employee_id', empId).eq('service_id', chk.dataset.srv);
      }
      updateCount();
    });
  });

  // Toolbar Alle/Keine
  grid.querySelectorAll('[data-srv-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.srvAction;
      const checks = Array.from(grid.querySelectorAll('.emp-srv-chk'));
      const toCheck = action === 'all';
      // Sadece değişenleri DB'ye yaz
      for (const chk of checks) {
        if (chk.checked === toCheck) continue;
        chk.checked = toCheck;
        chk.closest('.emp-srv-row')?.classList.toggle('is-selected', toCheck);
        if (toCheck) {
          await supabase.from('employee_services').insert({ employee_id: empId, service_id: chk.dataset.srv });
        } else {
          await supabase.from('employee_services').delete().eq('employee_id', empId).eq('service_id', chk.dataset.srv);
        }
      }
      updateCount();
      showToast(toCheck ? 'Alle Dienstleistungen zugewiesen ✓' : 'Alle entfernt ✓');
    });
  });
}

async function loadEmpCertificates(empId) {
  const container = document.getElementById('empCertificatesGrid');
  if (!container) return;

  container.querySelectorAll('input[data-cert]').forEach(cb => cb.checked = false);

  try {
    const { data, error } = await supabase
      .from('therapist_certificates')
      .select('certificate')
      .eq('profile_id', empId);

    if (error) {
      console.error('[loadEmpCertificates] Error fetching certs:', error);
      return;
    }

    if (data && data.length) {
      const activeCerts = new Set(data.map(d => d.certificate));
      container.querySelectorAll('input[data-cert]').forEach(cb => {
        cb.checked = activeCerts.has(cb.dataset.cert);
      });
    }

    const saveBtn = document.getElementById('empCertificatesSaveBtn');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Wird gespeichert...';

        try {
          const checkedCerts = Array.from(container.querySelectorAll('input[data-cert]:checked')).map(cb => cb.dataset.cert);
          
          const { error: delErr } = await supabase
            .from('therapist_certificates')
            .delete()
            .eq('profile_id', empId);

          if (delErr) throw delErr;

          if (checkedCerts.length > 0) {
            const insertData = checkedCerts.map(cert => ({
              profile_id: empId,
              certificate: cert,
              owner_id: getOwnerId()
            }));
            const { error: insErr } = await supabase
              .from('therapist_certificates')
              .insert(insertData);

            if (insErr) throw insErr;
          }

          showToast('Zertifikate erfolgreich gespeichert ✓');
          
          if (typeof loadAbrechnung === 'function') {
            loadAbrechnung().catch(e => console.warn('[loadAbrechnung] reload failed', e));
          }
        } catch (err) {
          console.error('[saveEmpCertificates] error', err);
          showToast('Fehler beim Speichern: ' + err.message, 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Zertifikate speichern';
        }
      };
    }
  } catch (err) {
    console.error('[loadEmpCertificates] top level error', err);
  }
}

let b2bCache = [];

async function loadB2B() {
  const { data } = await bizScope(supabase.from('b2b_contacts')
    .select('*').eq('owner_id', getOwnerId()).order('created_at', { ascending: false }), 'network');
  b2bCache = data || [];
  renderB2B();
}

function renderB2B() {
  const tbody = document.getElementById('b2bTableBody');
  const emptyEl = document.getElementById('b2bEmpty');
  const q = document.getElementById('b2bSearch').value.toLowerCase();
  let rows = b2bCache;
  if (q) rows = rows.filter(r => (r.company_name || '').toLowerCase().includes(q) || (r.contact_name || '').toLowerCase().includes(q));
  if (!rows.length) { tbody.innerHTML = ''; emptyEl.hidden = false; return; }
  emptyEl.hidden = true;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.company_name || '—'}</td>
      <td>${r.contact_name || '—'}</td>
      <td>${r.phone || '—'}</td>
      <td><span class="badge ${b2bStatusBadge(r.status)}">${r.status || '—'}</span></td>
      <td><button class="btn-icon" data-b2b-id="${r.id}" data-action="edit">✏️</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = b2bCache.find(x => x.id === btn.dataset.b2bId);
      if (c) openB2BModal(c);
    });
  });
}

function b2bStatusBadge(s) {
  if (s === 'partner') return 'badge-green';
  if (s === 'inactive') return 'badge-red';
  if (s === 'contacted') return 'badge-blue';
  return 'badge-gray';
}

document.getElementById('b2bSearch').addEventListener('input', renderB2B);
document.getElementById('b2bAddBtn').addEventListener('click', () => openB2BModal(null));

function openB2BModal(c) {
  document.getElementById('b2b-id').value = c?.id || '';
  document.getElementById('b2b-company').value = c?.company_name || '';
  document.getElementById('b2b-contact').value = c?.contact_name || '';
  document.getElementById('b2b-phone').value = c?.phone || '';
  document.getElementById('b2b-email').value = c?.email || '';
  document.getElementById('b2b-status').value = c?.status || 'prospect';
  document.getElementById('b2b-notes').value = c?.notes || '';
  document.getElementById('b2bModalTitle').textContent = c ? 'Kontakt bearbeiten' : t('b2b_add');
  openModal('b2bModal');
}

document.getElementById('b2bSaveBtn').addEventListener('click', async () => {
  const id = document.getElementById('b2b-id').value;
  const payload = {
    owner_id: getOwnerId(),
    company_name: document.getElementById('b2b-company').value.trim(),
    contact_name: document.getElementById('b2b-contact').value.trim() || null,
    phone: document.getElementById('b2b-phone').value.trim() || null,
    email: document.getElementById('b2b-email').value.trim() || null,
    status: document.getElementById('b2b-status').value,
    notes: document.getElementById('b2b-notes').value.trim() || null
  };
  if (!payload.company_name) { showToast(t('err_generic'), 'error'); return; }
  const { error } = id
    ? await supabase.from('b2b_contacts').update(payload).eq('id', id)
    : await supabase.from('b2b_contacts').insert(payload);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  closeModal('b2bModal');
  await loadB2B();
  showToast(t('saved'));
});

// ===== B2C MAIL PANEL =====
let b2cCache = [];

async function loadB2C() {
  const { data } = await supabase.from('leads')
    .select('id,title,email,phone,status').eq('owner_id', getOwnerId()).order('created_at', { ascending: false });
  b2cCache = data || [];
  renderB2C();
}

function renderB2C() {
  const tbody = document.getElementById('b2cTableBody');
  const emptyEl = document.getElementById('b2cEmpty');
  const q = (document.getElementById('b2cSearch').value || '').toLowerCase();
  let rows = b2cCache;
  if (q) rows = rows.filter(r => (r.title || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q) || (r.phone || '').toLowerCase().includes(q));
  if (!rows.length) { tbody.innerHTML = ''; emptyEl.hidden = false; return; }
  emptyEl.hidden = true;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.title || '—'}</td>
      <td>${r.email || '—'}</td>
      <td>${r.phone || '—'}</td>
      <td><span class="badge ${leadStatusBadge(r.status)}">${r.status || '—'}</span></td>
      <td><button class="btn-icon" data-b2c-id="${r.id}" data-action="mail">✉</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-action="mail"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = b2cCache.find(x => x.id === btn.dataset.b2cId);
      if (c) openComposeModal({ to_name: c.title || '', to_email: c.email || '', subject: '', body: '' });
    });
  });
}

document.getElementById('b2cSearch').addEventListener('input', renderB2C);

document.getElementById('b2cComposeBtn').addEventListener('click', () => {
  openComposeModal({ to_name: '', to_email: '', subject: '', body: '' });
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
  const { error } = await supabase.from('profiles')
    .update({ b2b_sender_name: name, b2b_setup_done: true })
    .eq('id', currentSession.user.id);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  currentProfile.b2b_sender_name = name;
  currentProfile.b2b_setup_done = true;
  await checkB2cSetup();
  showToast('E-Mail-Einrichtung abgeschlossen ✓');
});

document.getElementById('b2cConfigBtn').addEventListener('click', () => {
  document.getElementById('cfgSenderName').value = currentProfile.b2b_sender_name || '';
  document.getElementById('cfgSystemPrompt').value = currentProfile.system_prompt || '';
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
    dotEl.className = 'status-dot connected';
    labelEl.textContent = email;
    connectBtnEl.textContent = 'Konto wechseln';
  } else {
    dotEl.className = 'status-dot';
    labelEl.textContent = 'Kein Konto verbunden';
    connectBtnEl.textContent = 'Mit Google verbinden';
  }
}

async function checkB2bSetup() {
  gmailConnectedEmail = currentProfile.b2b_from_email || null;
  const setupDone = currentProfile.b2b_setup_done && currentProfile.b2b_sender_name;
  document.getElementById('b2bSetupCard').hidden = !!setupDone;
  document.getElementById('b2bMainContent').hidden = !setupDone;
  if (setupDone) {
    document.getElementById('b2bFromName').textContent = currentProfile.b2b_sender_name || '—';
    document.getElementById('b2bFromEmail').textContent = gmailConnectedEmail || '—';
    document.getElementById('aiFromBadge').textContent = gmailConnectedEmail || '';
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
  const { error } = await supabase.from('profiles')
    .update({ b2b_sender_name: name, b2b_setup_done: true })
    .eq('id', currentSession.user.id);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  currentProfile.b2b_sender_name = name;
  currentProfile.b2b_setup_done = true;
  await checkB2bSetup();
  showToast('E-Mail-Einrichtung abgeschlossen ✓');
});

document.getElementById('b2bConfigBtn').addEventListener('click', () => {
  document.getElementById('cfgSenderName').value = currentProfile.b2b_sender_name || '';
  document.getElementById('cfgSystemPrompt').value = currentProfile.system_prompt || '';
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
  const systemPrompt = document.getElementById('cfgSystemPrompt')?.value.trim() || '';
  const { error } = await supabase.from('profiles')
    .update({ b2b_sender_name: name, system_prompt: systemPrompt }).eq('id', currentSession.user.id);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  currentProfile.b2b_sender_name = name;
  currentProfile.system_prompt = systemPrompt;
  const fromNameEl = document.getElementById('b2bFromName');
  if (fromNameEl) fromNameEl.textContent = name;
  closeModal('b2bConfigModal');
  if (activePanel === 'b2b') await checkB2bSetup();
  if (activePanel === 'b2c') await checkB2cSetup();
  showToast(t('saved'));
});

function openComposeModal(draft) {
  currentDraftContactId = draft.contact_id || null;
  document.getElementById('composeToName').value = draft.to_name || '';
  document.getElementById('composeToEmail').value = draft.to_email || '';
  document.getElementById('composeSubject').value = draft.subject || '';
  document.getElementById('composeBody').value = draft.body || '';
  document.getElementById('composeFromDisplay').textContent = gmailConnectedEmail || currentSession.user.email;
  openModal('emailComposeModal');
}

document.getElementById('composeDiscardBtn').addEventListener('click', () => {
  closeModal('emailComposeModal');
  aiAddMsg('Entwurf verworfen.', 'ai');
  if (typeof window._composePostFlow === 'function') {
    const fn = window._composePostFlow; window._composePostFlow = null; fn();
  }
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
  const toName = document.getElementById('composeToName').value.trim();
  const subject = document.getElementById('composeSubject').value.trim();
  const body = document.getElementById('composeBody').value.trim();
  if (!toEmail || !subject || !body) { showToast(t('err_generic'), 'error'); return; }

  const systemPrompt = currentProfile.system_prompt?.trim();
  const fullBody = systemPrompt ? body + '\n\n---\n' + systemPrompt : body;

  const btn = document.getElementById('composeSendBtn');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const res = await fetch('https://n8n.infinitymade.de/api/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentSession.user.id,
        to_email: toEmail, to_name: toName,
        subject, body: fullBody,
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
    // Resolve contact_id from to_email if the draft didn't supply one,
    // so patient-detail mail history finds the row.
    let contactId = currentDraftContactId || null;
    if (!contactId && toEmail) {
      const { data: matchLead } = await supabase.from('leads')
        .select('id').eq('owner_id', getOwnerId()).ilike('email', toEmail)
        .maybeSingle();
      if (matchLead?.id) contactId = matchLead.id;
    }
    await supabase.from('email_logs').insert({
      owner_id: getOwnerId(),
      contact_id: contactId,
      to_email: toEmail, to_name: toName,
      subject, body, status: 'sent'
    });
    closeModal('emailComposeModal');
    aiAddMsg('E-Mail gesendet an ' + toEmail + ' ✓', 'ai');
    showToast('E-Mail gesendet ✓');
    if (typeof window._composePostFlow === 'function') {
      const fn = window._composePostFlow; window._composePostFlow = null; fn();
    }
  } catch (e) {
    showToast('Fehler: ' + e.message, 'error');
  }
  btn.disabled = false; btn.textContent = '✉ Senden';
});

function aiAddMsg(text, role, containerId = 'aiMessages') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'msg-bubble ' + role;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

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
    const contacts = cache.slice(0, 30).map(c => mapContactFn ? mapContactFn(c) : ({
      id: c.id, company_name: c.company_name, contact_name: c.contact_name,
      email: c.email, phone: c.phone, notes: c.notes
    }));
    const res = await fetch(B2B_AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  } catch (e) {
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
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('aiSendBtn').click(); }
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

// Unified AI gateway endpoint (Phase 0). B2C draft now flows through Azure
// Frankfurt via api-backend/ai/router.js. B2B path still uses legacy n8n
// webhook and will be migrated in Phase 5.
const AI_GATEWAY_BASE = 'https://n8n.infinitymade.de/api/ai';

async function runMailDraftViaGateway(intent, contactsCache, containerId, mapContactFn) {
  aiAddMsg(intent, 'user', containerId);
  const msgsEl = document.getElementById(containerId);
  if (!msgsEl) return;
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'msg-bubble ai';
  loadingDiv.textContent = '⏳ KI bereitet E-Mail vor…';
  msgsEl.appendChild(loadingDiv);
  msgsEl.scrollTop = 9999;
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) throw new Error('Nicht angemeldet');

    const contacts = (contactsCache || []).slice(0, 30).map(c =>
      mapContactFn ? mapContactFn(c) : ({
        id: c.id, name: c.title || c.contact_name || c.company_name,
        email: c.email, phone: c.phone, notes: c.notes || ''
      })
    );

    const res = await fetch(`${AI_GATEWAY_BASE}/b2c-draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.access_token
      },
      body: JSON.stringify({
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
  } catch (e) {
    loadingDiv.remove();
    aiAddMsg('Fehler: ' + e.message, 'ai', containerId);
  }
}

document.getElementById('b2cAiSendBtn').addEventListener('click', () => {
  const input = document.getElementById('b2cAiInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  runMailDraftViaGateway(msg, b2cCache, 'b2cAiMessages', c => ({
    id: c.id, name: c.title, email: c.email, phone: c.phone, notes: ''
  }));
});

document.getElementById('b2cAiInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('b2cAiSendBtn').click(); }
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
    runMailDraftViaGateway(text, b2cCache, 'b2cAiMessages', c => ({
      id: c.id, name: c.title, email: c.email, phone: c.phone, notes: ''
    }));
  };
  recog.onend = () => { active = false; btn.textContent = '🎤'; };
  recog.onerror = () => { active = false; btn.textContent = '🎤'; };
})();

async function loadSettings() {
  document.getElementById('setBiz').value = currentProfile.business_name || '';
  document.getElementById('setLang').value = currentLang;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('setStreet', currentProfile.street);
  set('setPlz', currentProfile.plz);
  set('setCity', currentProfile.city);
  set('setPhone', currentProfile.phone);
  set('setBankName', currentProfile.bank_name);
  set('setIban', currentProfile.iban);
  set('setBic', currentProfile.bic);
  set('setSteuernummer', currentProfile.steuernummer);
  set('setUstId', currentProfile.ust_id);
  set('setTaxExempt', currentProfile.tax_exempt_note);

  const isEmployee = currentProfile.role !== 'owner';
  const accSection = document.getElementById('settingsAccountSection');
  if (accSection) accSection.hidden = isEmployee;

  if (!isEmployee) {
    document.getElementById('accEmail').textContent = currentSession.user.email || '—';
    const planName = currentProfile.plan ? currentProfile.plan.charAt(0).toUpperCase() + currentProfile.plan.slice(1) : '—';
    document.getElementById('accPlanBadge').textContent = planName;
  }

  const { data: integ } = await supabase.from('calendar_integrations')
    .select('*').eq('user_id', currentSession.user.id).eq('provider', 'google').maybeSingle();
  const calStatus = document.getElementById('googleCalStatus');
  const calBtn = document.getElementById('googleCalBtn');
  if (integ?.access_token) {
    calStatus.textContent = t('status_connected');
    calStatus.className = 'integration-status connected';
    calBtn.textContent = t('btn_disconnect');
    calBtn.onclick = async () => {
      const okDisc = await showConfirmModal({
        title: 'Google Kalender trennen?',
        message: 'Die Verbindung zu Google Kalender wird getrennt. Termine werden dann nicht mehr automatisch synchronisiert. Sie können die Verbindung jederzeit wiederherstellen.',
        confirmText: 'Trennen',
        cancelText: 'Abbrechen',
        variant: 'danger'
      });
      if (!okDisc) return;
      await supabase.from('calendar_integrations').delete().eq('id', integ.id);
      loadSettings();
    };
  } else {
    calStatus.textContent = t('status_disconnected');
    calStatus.className = 'integration-status';
    calBtn.textContent = t('btn_connect');
    calBtn.onclick = () => { window.location.href = `${API}/calendar/google-auth?userId=${currentSession.user.id}`; };
  }

  const features = (PLAN_FEATURES[currentProfile.plan] || PLAN_FEATURES.starter)[currentLang] || [];
  const sfList = document.getElementById('settingsFeatureList');
  if (sfList) sfList.innerHTML = features.map(f => `<li>${f}</li>`).join('');

  await loadAerzte();

  // Physio/Praxis: IK number for §302/DMRZ + Krankenkasse-Abrechnung
  const abrSection = document.getElementById('settingsAbrechnungSection');
  if (abrSection) {
    const sec = getSector();
    if (sec === 'physiotherapy' || sec === 'praxis') {
      abrSection.style.display = '';
      renderDtaProCard();
      document.getElementById('setIkNumber').value = currentProfile.ik_number || '';
      // Pull existing terapeut_zertifikat metadata (IK takes precedence here if set)
      supabase.from('terapeut_zertifikat')
        .select('ik_nummer, cert_subject, cert_valid_to')
        .eq('owner_id', getOwnerId())
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          const ikInp = document.getElementById('setIkNumber');
          if (data.ik_nummer && !ikInp.value) ikInp.value = data.ik_nummer;
          const status = document.getElementById('certStatus');
          if (status) {
            if (data.cert_subject) {
              const valid = data.cert_valid_to ? new Date(data.cert_valid_to).toLocaleDateString('de-DE') : '—';
              status.textContent = `Zertifikat: ${data.cert_subject} · gültig bis ${valid}`;
              status.style.color = '#15803d';
            } else {
              status.textContent = 'Noch kein ITSG-Zertifikat hinterlegt.';
              status.style.color = '';
            }
          }
        });
    } else {
      abrSection.style.display = 'none';
    }
  }
}

document.getElementById('befSaveBtn')?.addEventListener('click', () => {
  const lead = document.getElementById('befSaveBtn').dataset.lead;
  if (lead) saveBefreiung(lead);
});

document.getElementById('signRunBtn')?.addEventListener('click', runSignAbrechnung);

// ---------- Sprint 7-3 / s11: DTA-Pro addon card ----------

function renderDtaProCard() {
  const card = document.getElementById('dtaProCard');
  if (!card) return;
  const role = currentProfile?.role || 'owner';
  if (role !== 'owner') {
    // Employees should not see billing controls.
    card.style.display = 'none';
    return;
  }
  card.style.display = '';

  const active = hasDtaPro();
  const badge = document.getElementById('dtaProStatusBadge');
  const addMonthBtn = document.getElementById('dtaProAddMonthBtn');
  const addYearBtn = document.getElementById('dtaProAddYearBtn');
  const removeBtn = document.getElementById('dtaProRemoveBtn');
  const desc = document.getElementById('dtaProDesc');
  const msg = document.getElementById('dtaProMsg');
  if (msg) msg.textContent = '';

  if (active) {
    if (badge) badge.style.display = '';
    if (addMonthBtn) addMonthBtn.style.display = 'none';
    if (addYearBtn) addYearBtn.style.display = 'none';
    if (removeBtn) removeBtn.style.display = '';
    if (desc) desc.innerHTML = 'Sie nutzen den DTA-Pro Add-on. Die <strong>Kassenabrechnung</strong> ist in der Seitenleiste verfügbar.';
  } else {
    if (badge) badge.style.display = 'none';
    if (addMonthBtn) addMonthBtn.style.display = '';
    if (addYearBtn) addYearBtn.style.display = '';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

async function callDtaProEndpoint(endpoint, body) {
  const { data: { session: s } } = await supabase.auth.getSession();
  if (!s?.access_token) throw new Error('Nicht angemeldet');
  const res = await fetch(`/api/stripe/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + s.access_token,
    },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));
  return json;
}

async function dtaProAdd(interval) {
  const msg = document.getElementById('dtaProMsg');
  const btns = ['dtaProAddMonthBtn', 'dtaProAddYearBtn'].map(id => document.getElementById(id));
  btns.forEach(b => b && (b.disabled = true));
  if (msg) { msg.textContent = 'Wird aktiviert…'; msg.style.color = ''; }
  try {
    await callDtaProEndpoint('dta-pro-add', { interval });
    // Refresh local profile so sidebar + card pick up the change.
    const { data: refreshed } = await supabase.from('profiles')
      .select('*').eq('id', currentSession.user.id).single();
    if (refreshed) currentProfile = refreshed;
    renderDtaProCard();
    if (typeof renderSidebar === 'function') await renderSidebar();
    showToast('DTA-Pro aktiviert.');
    if (msg) { msg.textContent = 'Aktiv. Kassenabrechnung ist jetzt in der Seitenleiste verfügbar.'; msg.style.color = '#15803d'; }
  } catch (e) {
    console.error('[dta-pro/add]', e);
    if (msg) { msg.textContent = 'Fehler: ' + e.message; msg.style.color = '#b91c1c'; }
  } finally {
    btns.forEach(b => b && (b.disabled = false));
  }
}

async function dtaProRemove() {
  if (!confirm('DTA-Pro Add-on kündigen? Sie können das Modul jederzeit wieder aktivieren.')) return;
  const msg = document.getElementById('dtaProMsg');
  const btn = document.getElementById('dtaProRemoveBtn');
  if (btn) btn.disabled = true;
  if (msg) { msg.textContent = 'Wird gekündigt…'; msg.style.color = ''; }
  try {
    await callDtaProEndpoint('dta-pro-remove', {});
    const { data: refreshed } = await supabase.from('profiles')
      .select('*').eq('id', currentSession.user.id).single();
    if (refreshed) currentProfile = refreshed;
    renderDtaProCard();
    if (typeof renderSidebar === 'function') await renderSidebar();
    showToast('Add-on gekündigt.');
    if (msg) { msg.textContent = 'Add-on entfernt. Die Kassenabrechnung wurde ausgeblendet.'; msg.style.color = '#444'; }
  } catch (e) {
    console.error('[dta-pro/remove]', e);
    if (msg) { msg.textContent = 'Fehler: ' + e.message; msg.style.color = '#b91c1c'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- Sprint 8: DAS-Portal walkthrough modal ----------

const _dasGuideState = { abrechnungId: null, abrechnung: null };

function _dgStatusToStep(ab) {
  // Map abrechnung.status + signed_at → current step (1..4)
  if (!ab) return 1;
  if (ab.status === 'accepted' || ab.status === 'rejected') return 4; // done; keep step 4 highlighted
  if (ab.status === 'gesendet' || ab.status === 'heruntergeladen') {
    return ab.zaa_uploaded_at ? 4 : 3;
  }
  if (ab.signed_at) return 2;
  return 1;
}

function _dgRender(currentStep) {
  document.querySelectorAll('#dasGuideSteps .dg-step').forEach(li => {
    const step = parseInt(li.dataset.step, 10);
    const marker = li.querySelector('.dg-marker');
    const actions = li.querySelector('.dg-actions');
    // Reset
    li.style.background = '';
    li.style.border = '1px solid transparent';
    if (marker) {
      marker.style.cssText = 'width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;';
    }
    if (actions) actions.style.display = 'none';

    if (step < currentStep) {
      // Done
      if (marker) { marker.style.background = '#15803d'; marker.style.color = '#fff'; marker.textContent = '✓'; }
    } else if (step === currentStep) {
      li.style.background = '#eff6ff';
      li.style.border = '1px solid #93c5fd';
      if (marker) { marker.style.background = '#1d4ed8'; marker.style.color = '#fff'; marker.textContent = String(step); }
      if (actions) actions.style.display = 'flex';
      if (actions) actions.style.gap = '8px';
    } else {
      if (marker) { marker.style.background = '#e5e7eb'; marker.style.color = '#6b7280'; marker.textContent = String(step); }
    }
  });
}

async function openDasGuideModal(abrechnungId, forceStep) {
  if (!abrechnungId) return;
  _dasGuideState.abrechnungId = abrechnungId;

  const { data: ab } = await supabase
    .from('abrechnung')
    .select('id, dateiname, status, storage_path, signed_storage_path, signed_at, zaa_uploaded_at, kostentraeger_ik, prescription_count')
    .eq('id', abrechnungId)
    .maybeSingle();
  _dasGuideState.abrechnung = ab;

  const header = document.getElementById('dasGuideHeader');
  if (header) {
    const ik = ab?.kostentraeger_ik || '—';
    const kk = _abState.kkMap.get(ik)?.name || ik;
    header.innerHTML = `<strong>${escapeHtml(ab?.dateiname || abrechnungId)}</strong> · ${escapeHtml(kk)} · ${ab?.prescription_count || 0} Rezepte`;
  }

  const step = forceStep || _dgStatusToStep(ab);
  _dgRender(step);
  openModal('dasGuideModal');
}

document.getElementById('dgSignBtn')?.addEventListener('click', () => {
  const id = _dasGuideState.abrechnungId;
  const ab = _dasGuideState.abrechnung;
  if (!id) return;
  closeModal('dasGuideModal');
  openSignModal(id, { filename: ab?.dateiname });
});

document.getElementById('dgDownloadBtn')?.addEventListener('click', () => {
  const ab = _dasGuideState.abrechnung;
  if (!ab) return;
  const path = ab.signed_storage_path || ab.storage_path;
  if (!path) {
    showToast('Datei nicht verfügbar — bitte erst signieren.', 'error');
    return;
  }
  downloadAbrechnungFile(path, ab.id, 'dta');
});

document.getElementById('dgMarkSentBtn')?.addEventListener('click', async () => {
  const id = _dasGuideState.abrechnungId;
  if (!id) return;
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) throw new Error('Nicht angemeldet');
    const res = await fetch(`${API}/billing/abrechnung/${id}/mark-sent`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + s.access_token },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));
    showToast('Status: gesendet. Warten Sie auf die ZAA-Antwort.');
    await loadAbrechnung();
    _dgRender(3);
  } catch (e) {
    showToast('Fehler: ' + e.message, 'error');
  }
});

document.getElementById('dgZaaBtn')?.addEventListener('click', () => {
  const id = _dasGuideState.abrechnungId;
  if (!id) return;
  closeModal('dasGuideModal');
  // Re-use the existing ZAA upload modal
  if (typeof openZaaModal === 'function') {
    openZaaModal(id, _dasGuideState.abrechnung?.dateiname);
  } else {
    const btn = document.querySelector(`.ab-zaa-btn[data-id="${id}"]`);
    if (btn) btn.click();
  }
});

document.getElementById('dtaProAddMonthBtn')?.addEventListener('click', () => dtaProAdd('month'));
document.getElementById('dtaProAddYearBtn')?.addEventListener('click', () => dtaProAdd('year'));
document.getElementById('dtaProRemoveBtn')?.addEventListener('click', dtaProRemove);
document.getElementById('zaaRunBtn')?.addEventListener('click', runZaaUpload);

document.getElementById('ikSaveBtn')?.addEventListener('click', async () => {
  const raw = document.getElementById('setIkNumber').value.trim();
  if (raw && !/^\d{9}$/.test(raw)) {
    showToast('IK muss genau 9 Ziffern enthalten.', 'error');
    return;
  }
  const ik = raw || null;
  const ownerId = getOwnerId();

  // 1) profiles.ik_number (legacy DMRZ flow)
  const { error: pErr } = await supabase.from('profiles').update({ ik_number: ik }).eq('id', currentSession.user.id);
  if (pErr) { showToast('Fehler: ' + pErr.message, 'error'); return; }
  currentProfile.ik_number = ik;

  // 2) terapeut_zertifikat upsert (§302 Sammelabrechnung route reads this)
  if (ik) {
    const { error: zErr } = await supabase.from('terapeut_zertifikat').upsert({
      owner_id: ownerId,
      ik_nummer: ik,
    }, { onConflict: 'owner_id' });
    if (zErr) console.warn('[ik/zertifikat-upsert]', zErr);
  }

  showToast(ik ? 'IK gespeichert ✓' : 'IK entfernt.');
});

document.getElementById('profileSaveBtn').addEventListener('click', async () => {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const biz = v('setBiz');
  const lang = document.getElementById('setLang').value;
  const patch = {
    business_name: biz,
    language: lang,
    street: v('setStreet') || null,
    plz: v('setPlz') || null,
    city: v('setCity') || null,
    phone: v('setPhone') || null
  };
  const { error } = await supabase.from('profiles').update(patch).eq('id', currentSession.user.id);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  Object.assign(currentProfile, patch);
  currentLang = lang;
  localStorage.setItem('infinity_lang', lang);
  document.getElementById('bizName').textContent = biz;
  applyI18n();
  await renderSidebar();
  showToast(t('saved'));
});

document.getElementById('billingSaveBtn')?.addEventListener('click', async () => {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const patch = {
    bank_name: v('setBankName') || null,
    iban: v('setIban') || null,
    bic: v('setBic') || null,
    steuernummer: v('setSteuernummer') || null,
    ust_id: v('setUstId') || null,
    tax_exempt_note: v('setTaxExempt') || null,
    ik_number: v('setIkNumber') || null
  };
  const { error } = await supabase.from('profiles').update(patch).eq('id', currentSession.user.id);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  Object.assign(currentProfile, patch);
  showToast('Rechnungsdaten gespeichert ✓');
});

document.getElementById('pwChangeBtn').addEventListener('click', async () => {
  const pw = document.getElementById('setPw').value;
  if (pw.length < 6) { showToast(t('err_generic'), 'error'); return; }
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) { showToast(t('err_generic'), 'error'); return; }
  document.getElementById('setPw').value = '';
  showToast(t('pw_changed'));
});

document.getElementById('subPortalBtn').addEventListener('click', openStripePortal);
document.getElementById('subUpgradeBtn').addEventListener('click', () => { window.location.href = '/onboarding.html?step=plan'; });

// DSGVO Art. 15 — Export
document.getElementById('dsgvoExportBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('dsgvoExportBtn');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Wird vorbereitet...';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/dsgvo/export', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast('Export fehlgeschlagen: ' + (err.error || res.status), 'error');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infinitymade-daten-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Export heruntergeladen ✓');
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// DSGVO Art. 17 — Delete (mit doppelter Bestätigung)
document.getElementById('dsgvoDeleteBtn')?.addEventListener('click', async () => {
  const confirm1 = window.confirm(
    'Sind Sie sicher? Alle Ihre Daten werden gelöscht.\n\n' +
    'Abrechnungsdaten bleiben aus gesetzlicher Pflicht 10 Jahre anonymisiert gespeichert.\n\n' +
    'Diese Aktion ist NICHT rückgängig zu machen.'
  );
  if (!confirm1) return;

  const typed = window.prompt('Tippen Sie LÖSCHEN (Großbuchstaben) um zu bestätigen:');
  if (typed !== 'LÖSCHEN') {
    showToast('Abgebrochen — Bestätigung stimmte nicht überein.', 'error');
    return;
  }

  const btn = document.getElementById('dsgvoDeleteBtn');
  btn.disabled = true;
  btn.textContent = 'Wird gelöscht...';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/dsgvo/delete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirm: 'LÖSCHEN' }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('Löschung fehlgeschlagen: ' + (data.error || res.status), 'error');
      btn.disabled = false;
      btn.textContent = '🗑️ Konto & Daten löschen';
      return;
    }
    alert('Ihr Konto wurde gelöscht. Sie werden jetzt abgemeldet.');
    await supabase.auth.signOut();
    window.location.href = '/';
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = '🗑️ Konto & Daten löschen';
  }
});

async function ensureCompanyCode() {
  if (currentProfile.role !== 'owner' || currentProfile.company_code) return;
  const base = (currentProfile.business_name || currentSession.user.email.split('@')[0]).replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 10);
  const code = 'INF-' + base;
  await supabase.from('profiles').update({ company_code: code }).eq('id', currentSession.user.id);
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
    await supabase.from('profiles').update({ booking_slug: url }).eq('id', currentSession.user.id);
    currentProfile.booking_slug = url;
  } catch (e) {
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
      <td>${d.website ? `<a href="https://${d.website.replace(/^https?:\/\//, '')}" target="_blank" rel="noopener">${d.website}</a>` : '—'}</td>
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
  const wrap = document.getElementById('zygoteWrap');
  if (!wrap) return;
  if (wrap.dataset.loaded === '1') return;
  wrap.dataset.loaded = '1';
  wrap.innerHTML = '';
  const frame = document.createElement('iframe');
  frame.id = 'zygoteFrame';
  frame.src = 'https://www.zygotebody.com/';
  frame.allow = 'fullscreen';
  frame.setAttribute('allowfullscreen', '');
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
  wrap.appendChild(frame);

  const fsBtn = document.createElement('button');
  fsBtn.className = 'zygote-fs-btn';
  fsBtn.id = 'zygoteFsBtn';
  fsBtn.type = 'button';
  fsBtn.title = 'Vollbild';
  fsBtn.textContent = '⛶ Vollbild';
  fsBtn.addEventListener('click', () => {
    if (frame.requestFullscreen) frame.requestFullscreen();
    else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
  });
  wrap.appendChild(fsBtn);

  const newTab = document.createElement('a');
  newTab.className = 'zygote-fs-btn';
  newTab.id = 'zygoteNewTabBtn';
  newTab.href = 'https://www.zygotebody.com/';
  newTab.target = '_blank';
  newTab.rel = 'noopener';
  newTab.style.cssText = 'right:auto;left:12px;display:none;';
  newTab.textContent = '↗ Neuer Tab';
  wrap.appendChild(newTab);
}

async function loadNotizen() {
  const input = document.getElementById('notesPatientInput');
  const list = document.getElementById('notesPatientList');
  const hidden = document.getElementById('notesPatient');
  const form = document.getElementById('notesForm');
  const empty = document.getElementById('notesEmpty');
  const ownerId = getOwnerId();

  const { data: leads } = await supabase.from('leads').select('id,title,first_name,last_name,metadata').eq('owner_id', ownerId).order('title');
  const allLeads = leads || [];

  input.value = '';
  hidden.value = '';
  list.hidden = true;
  if (!hidden.value) { form.hidden = true; empty.hidden = false; }

  if (prefillNotesPatientId) {
    const prefillLead = allLeads.find(l => l.id === prefillNotesPatientId);
    if (prefillLead) {
      input.value = displayNameWithBirth(prefillLead);
      hidden.value = prefillLead.id;
      loadPatientNotes(prefillLead.id);
    }
    prefillNotesPatientId = null;
  }

  let activeIndex = -1;

  function renderList(filter) {
    activeIndex = -1;
    const q = (filter || '').trim().toLowerCase();
    const filtered = q
      ? allLeads.filter(l => displayNameWithBirth(l).toLowerCase().includes(q))
      : allLeads.slice();
    if (filtered.length === 0) {
      list.innerHTML = '<li class="empty-item">Keine Patienten</li>';
      list.hidden = false;
      return;
    }
    const esc = q.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    const rx = q ? new RegExp(`(${esc})`, 'gi') : null;
    list.innerHTML = filtered.map((l, i) => {
      const name = displayNameWithBirth(l);
      const safe = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const hl = rx ? safe.replace(rx, '<span class="match-hl">$1</span>') : safe;
      return `<li data-id="${l.id}" data-index="${i}">${hl}</li>`;
    }).join('');
    list.hidden = false;
  }

  function selectPatient(id) {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;
    input.value = displayNameWithBirth(lead);
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

  input.onfocus = () => renderList(input.value);

  input.onclick = () => renderList(input.value);

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
  const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('role','employee');
  const lim = employeeLimit();
  if (Number.isFinite(lim) && (count ?? 0) >= lim) { showToast(`Plan-Limit erreicht: max. ${lim} Mitarbeiter im ${(currentProfile?.plan||'starter')}-Paket. Bitte upgraden.`, 'error'); return; }
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

document.getElementById('teamAddBtn').addEventListener('click', () => {
  const code = currentProfile?.company_code;
  if (!code) { showToast('Kein Unternehmens-Code verfügbar', 'error'); return; }
  const inviteUrl = `${location.origin}/employee-signup.html?code=${encodeURIComponent(code)}`;
  window.open(inviteUrl, '_blank');
});
document.getElementById('aeSaveBtn').addEventListener('click', saveEmployee);

// ===== Übersicht view modes (Enterprise: daily/weekly/monthly) =====
let scheduleView = 'daily'; // 'daily' | 'weekly' | 'monthly'
let monthlyEmpId = null;

const SV_PREF_KEY = 'calendar_view';
const SV_EMP_PREF_KEY = 'monthly_employee';

async function bootScheduleViewToggle() {
  const toggle = document.getElementById('scheduleViewToggle');
  if (!toggle) return;

  // Gate: yalnız Enterprise + multi-business gözüksün (1 biz'lik kullanıcıya gerek yok)
  const showToggle = isEnterprise();
  toggle.hidden = !showToggle;
  if (!showToggle) { scheduleView = 'daily'; return; }

  // Kayıtlı tercih
  try {
    const { data: pref } = await supabase
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', currentSession.user.id)
      .eq('preference_key', SV_PREF_KEY)
      .maybeSingle();
    if (pref?.preference_value && ['daily','weekly','monthly'].includes(pref.preference_value)) {
      scheduleView = pref.preference_value;
    }
  } catch {}

  try {
    const { data: empPref } = await supabase
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', currentSession.user.id)
      .eq('preference_key', SV_EMP_PREF_KEY)
      .maybeSingle();
    if (empPref?.preference_value) monthlyEmpId = empPref.preference_value;
  } catch {}

  // Toggle buton wiring (idempotent)
  if (!toggle.dataset.wired) {
    toggle.dataset.wired = '1';
    toggle.querySelectorAll('.sv-btn').forEach(btn => {
      btn.addEventListener('click', () => switchScheduleView(btn.dataset.view));
    });
  }

  // Monthly employee selector wiring
  const empSel = document.getElementById('monthlyEmpSelect');
  if (empSel && !empSel.dataset.wired) {
    empSel.dataset.wired = '1';
    empSel.addEventListener('change', async () => {
      monthlyEmpId = empSel.value || null;
      await saveUserPref(SV_EMP_PREF_KEY, monthlyEmpId);
      if (scheduleView === 'monthly') await renderOverviewMonthly(scheduleDate);
    });
  }

  applyScheduleViewUI();

  // Eğer kayıtlı tercih daily değilse, ilgili görünümü çiz
  if (scheduleView !== 'daily') {
    if (scheduleView === 'monthly') populateMonthlyEmpSelect();
    await refreshActiveScheduleView();
  }
}

function applyScheduleViewUI() {
  const toggle = document.getElementById('scheduleViewToggle');
  toggle?.querySelectorAll('.sv-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === scheduleView);
  });

  // Container görünürlüğü
  const daily = document.getElementById('upcoming-bookings-list');
  const weekly = document.getElementById('overview-weekly');
  const monthly = document.getElementById('overview-monthly');
  const empty = document.getElementById('upcoming-bookings-empty');
  const ovNav = document.getElementById('ovNav');
  const empSel = document.getElementById('monthlyEmpSelect');

  if (daily) daily.hidden = scheduleView !== 'daily';
  if (weekly) weekly.hidden = scheduleView !== 'weekly';
  if (monthly) monthly.hidden = scheduleView !== 'monthly';
  if (empty) empty.hidden = scheduleView !== 'daily';
  if (ovNav) ovNav.hidden = scheduleView !== 'daily';
  if (empSel) empSel.hidden = scheduleView !== 'monthly';
}

async function saveUserPref(key, value) {
  if (!currentSession?.user?.id) return;
  try {
    await supabase.from('user_preferences').upsert({
      user_id: currentSession.user.id,
      preference_key: key,
      preference_value: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,preference_key' });
  } catch (e) { console.warn('[user-pref]', key, e); }
}

async function switchScheduleView(view) {
  if (!['daily','weekly','monthly'].includes(view)) return;
  scheduleView = view;
  await saveUserPref(SV_PREF_KEY, view);
  applyScheduleViewUI();

  if (view === 'daily') {
    await loadScheduleBookings(scheduleDate);
  } else if (view === 'weekly') {
    await renderOverviewWeekly(scheduleDate);
  } else if (view === 'monthly') {
    populateMonthlyEmpSelect();
    await renderOverviewMonthly(scheduleDate);
  }
}

function populateMonthlyEmpSelect() {
  const sel = document.getElementById('monthlyEmpSelect');
  if (!sel) return;
  const emps = teamMembers.length ? teamMembers : [currentProfile];
  sel.innerHTML = emps.map(m => {
    const name = m.business_name || m.email?.split('@')[0] || '—';
    return `<option value="${m.id}">${escapeHtml(name)}</option>`;
  }).join('');
  if (!monthlyEmpId || !emps.find(e => e.id === monthlyEmpId)) {
    monthlyEmpId = emps[0]?.id || null;
  }
  sel.value = monthlyEmpId || '';
}

// ===== Weekly view render =====
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Pazartesi başlangıç
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function renderOverviewWeekly(date) {
  const container = document.getElementById('overview-weekly');
  if (!container) return;

  const monday = startOfWeek(date);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const weekStart = days[0];
  const weekEnd = new Date(days[6]);
  weekEnd.setHours(23, 59, 59, 999);

  // Personel listesi — switcher aktif business filter'ı bookings'a uygulanır
  const emps = (teamMembers.length ? teamMembers : [currentProfile]).filter(e => e.role !== 'owner' || teamMembers.length <= 1);
  // Tüm team'i göster (owner dahil), filter ettiysek owner gözüksün
  const allEmps = teamMembers.length ? teamMembers : [currentProfile];

  // Bookings çek — cross-business: owner'in tüm business'larındaki bookings
  // (çalışan çakışmalarının görünür olması için)
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, start_time, end_time, user_id, status, service_id, business_id, hausbesuch, services(title, color)')
    .eq('owner_id', getOwnerId())
    .gte('start_time', weekStart.toISOString())
    .lte('start_time', weekEnd.toISOString())
    .neq('status', 'cancelled');
  if (error) { console.warn('[weekly]', error); }
  const bizNameById = new Map(myBusinesses.map(b => [b.id, b.business_name]));

  // Header label
  const labelEl = document.getElementById('scheduleDateLabel');
  if (labelEl) {
    const fmt = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    labelEl.textContent = `${fmt(weekStart)} – ${fmt(weekEnd)}`;
  }

  if (!allEmps.length) {
    container.innerHTML = '<div class="ov-week-empty-state">Keine Mitarbeiter — fügen Sie zuerst Personal hinzu.</div>';
    return;
  }

  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const todayISO = toISODate(new Date());

  // Aktif business'in kapali gunleri (sadece switcher aktif business varsa)
  const closedSet = new Set(((currentBusiness?.closed_days) || []).map(Number));

  // Grid: header row + emp rows
  let html = `<div class="ov-week-grid" style="--ov-day-count:7;">`;
  html += `<div class="ov-week-head" style="background:transparent;border:0;"></div>`;
  days.forEach((d, i) => {
    const isToday = toISODate(d) === todayISO;
    const isClosed = closedSet.has(d.getDay());
    const cls = ['ov-week-head'];
    if (isToday) cls.push('ov-week-head-today');
    if (isClosed) cls.push('ov-week-head-closed');
    html += `<div class="${cls.join(' ')}">${dayNames[i]} ${d.getDate()}.${d.getMonth() + 1}${isClosed ? '<span class="ov-day-closed-tag">geschlossen</span>' : ''}</div>`;
  });

  allEmps.forEach(emp => {
    const name = emp.business_name || emp.email?.split('@')[0] || '—';
    html += `<div class="ov-week-emp-cell">${escapeHtml(name)}</div>`;
    days.forEach(d => {
      const dayISO = toISODate(d);
      const isClosed = closedSet.has(d.getDay());
      const dayBookings = (bookings || []).filter(b =>
        b.user_id === emp.id && toISODate(new Date(b.start_time)) === dayISO
      ).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      html += `<div class="ov-week-cell ${isClosed ? 'ov-week-cell-closed' : ''}" data-day="${dayISO}" data-emp="${emp.id}">`;
      dayBookings.forEach(b => {
        const t = new Date(b.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const svc = b.services?.title || 'Termin';
        const isOther = currentBusiness?.id && b.business_id !== currentBusiness.id;
        const otherBizName = isOther ? (bizNameById.get(b.business_id) || 'Anderer Standort') : '';
        const cls = isOther ? 'ov-week-appt ov-week-appt-other' : 'ov-week-appt';
        const meta = isOther ? `<div class="ov-week-appt-other-tag">${escapeHtml(otherBizName)}</div>` : '';
        const hbIcon = b.hausbesuch ? `<span class="svg-icon ov-week-appt-hb" title="Hausbesuch" style="width:11px;height:11px;display:inline-flex;vertical-align:-1px;margin-left:3px;flex-shrink:0;">${ICON.car}</span>` : '';
        const hbTitle = b.hausbesuch ? 'Hausbesuch' : '';
        html += `<div class="${cls}${b.hausbesuch ? ' ov-week-appt-hausbesuch' : ''}" data-booking="${b.id}" title="${isOther ? 'Termin in ' + escapeHtml(otherBizName) : hbTitle}">
          <span class="ov-week-appt-time">${t}</span> ${escapeHtml(svc)}${hbIcon}
          ${meta}
        </div>`;
      });
      html += `</div>`;
    });
  });
  html += `</div>`;
  container.innerHTML = html;
}

// ===== Monthly view render =====
async function renderOverviewMonthly(date) {
  const container = document.getElementById('overview-monthly');
  if (!container) return;
  if (!monthlyEmpId) {
    populateMonthlyEmpSelect();
  }

  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const firstOfMonth = new Date(year, month, 1);
  const monthName = firstOfMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  // Grid start: Pazartesi'den başlat
  const gridStart = startOfWeek(firstOfMonth);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    cells.push(d);
  }

  // Header label
  const labelEl = document.getElementById('scheduleDateLabel');
  if (labelEl) labelEl.textContent = monthName;

  // Bookings çek
  const startISO = cells[0].toISOString();
  const endISO = new Date(cells[41]); endISO.setHours(23, 59, 59, 999);

  // Cross-business: çalışanın tüm business'lardaki randevuları görünür
  let query = supabase
    .from('bookings')
    .select('id, start_time, user_id, status, business_id')
    .eq('owner_id', getOwnerId())
    .gte('start_time', startISO)
    .lte('start_time', endISO.toISOString())
    .neq('status', 'cancelled');
  if (monthlyEmpId) query = query.eq('user_id', monthlyEmpId);
  const { data: bookings, error } = await query;
  if (error) console.warn('[monthly]', error);

  const todayISO = toISODate(new Date());
  const dowNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const closedSet = new Set(((currentBusiness?.closed_days) || []).map(Number));

  let html = '<div class="ov-month-grid">';
  dowNames.forEach(n => { html += `<div class="ov-month-dow">${n}</div>`; });
  let monthTotal = 0;
  cells.forEach(d => {
    const dayISO = toISODate(d);
    const isOut = d.getMonth() !== month;
    const isToday = dayISO === todayISO;
    const isClosed = closedSet.has(d.getDay());
    const count = (bookings || []).filter(b => toISODate(new Date(b.start_time)) === dayISO).length;
    if (!isOut) monthTotal += count;
    const classes = ['ov-month-cell'];
    if (isOut) classes.push('ov-month-cell-out');
    if (isToday) classes.push('ov-month-cell-today');
    if (isClosed && !isOut) classes.push('ov-month-cell-closed');
    const countHtml = isOut ? ''
      : isClosed ? '<span class="ov-day-closed-tag">geschlossen</span>'
      : `<span class="ov-month-count ${count === 0 ? 'ov-month-count-zero' : ''}">${count} ${count === 1 ? 'Termin' : 'Termine'}</span>`;
    html += `<div class="${classes.join(' ')}" data-day="${dayISO}" ${isClosed && !isOut ? 'data-closed="1"' : ''}>
      <span class="ov-month-day-num">${d.getDate()}</span>
      ${countHtml}
    </div>`;
  });
  html += '</div>';

  html += `<div class="ov-month-summary">
    <span>Gesamt im Monat: <strong>${monthTotal}</strong></span>
    <span>${monthName}</span>
  </div>`;
  container.innerHTML = html;

  // Hücreye tıklayınca günlük görünüme dön (kapali günler hariç)
  container.querySelectorAll('.ov-month-cell:not(.ov-month-cell-out):not(.ov-month-cell-closed)').forEach(el => {
    el.addEventListener('click', () => {
      const day = el.dataset.day;
      if (!day) return;
      scheduleDate = new Date(day);
      switchScheduleView('daily');
    });
  });
}

function shiftScheduleDate(direction) {
  // direction: -1 (geri) | +1 (ileri) | 0 (bugün)
  const d = direction === 0 ? new Date() : new Date(scheduleDate);
  if (direction !== 0) {
    if (scheduleView === 'weekly') d.setDate(d.getDate() + 7 * direction);
    else if (scheduleView === 'monthly') d.setMonth(d.getMonth() + direction);
    else d.setDate(d.getDate() + direction);
  }
  scheduleDate = d;
  return d;
}

async function refreshActiveScheduleView() {
  if (scheduleView === 'daily') {
    await loadScheduleBookings(scheduleDate);
    await renderGapsForDate(scheduleDate);
  } else if (scheduleView === 'weekly') {
    await renderOverviewWeekly(scheduleDate);
  } else if (scheduleView === 'monthly') {
    await renderOverviewMonthly(scheduleDate);
  }
}

function setupScheduleNav() {
  const prev = document.getElementById('schedulePrev');
  const next = document.getElementById('scheduleNext');
  const today = document.getElementById('scheduleToday');
  if (prev) prev.addEventListener('click', async () => {
    ovEmpPage = 0;
    shiftScheduleDate(-1);
    await refreshActiveScheduleView();
  });
  if (next) next.addEventListener('click', async () => {
    ovEmpPage = 0;
    shiftScheduleDate(+1);
    await refreshActiveScheduleView();
  });
  if (today) today.addEventListener('click', async () => {
    ovEmpPage = 0;
    shiftScheduleDate(0);
    await refreshActiveScheduleView();
  });

  const ovPrev = document.getElementById('ovPrevEmp');
  const ovNext = document.getElementById('ovNextEmp');
  if (ovPrev) ovPrev.addEventListener('click', () => {
    if (ovEmpPage > 0) { ovEmpPage--; loadScheduleBookings(scheduleDate); }
  });
  if (ovNext) ovNext.addEventListener('click', () => {
    const allEmps = teamMembers.length ? teamMembers : [currentProfile];
    const cpp = window.innerWidth < 768 ? 1 : 3;
    const totalPages = Math.ceil(allEmps.length / cpp);
    if (ovEmpPage < totalPages - 1) { ovEmpPage++; loadScheduleBookings(scheduleDate); }
  });

  const gPrev = document.getElementById('gapsPrev');
  const gNext = document.getElementById('gapsNext');
  const gToday = document.getElementById('gapsToday');
  if (gPrev) gPrev.addEventListener('click', async () => {
    ovEmpPage = 0;
    const d = new Date(scheduleDate);
    d.setDate(d.getDate() - 1);
    await loadScheduleBookings(d);
    await renderGapsForDate(d);
  });
  if (gNext) gNext.addEventListener('click', async () => {
    ovEmpPage = 0;
    const d = new Date(scheduleDate);
    d.setDate(d.getDate() + 1);
    await loadScheduleBookings(d);
    await renderGapsForDate(d);
  });
  if (gToday) gToday.addEventListener('click', async () => {
    ovEmpPage = 0;
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
    const statusColors = { open: 'badge-yellow', in_progress: 'badge-blue', resolved: 'badge-green', closed: 'badge-gray' };
    const priorityColors = { low: 'badge-gray', medium: 'badge-yellow', high: 'badge-red', critical: 'badge-red' };
    const st = f.status || 'open';
    const pr = f.priority || 'medium';
    const date = new Date(f.created_at).toLocaleDateString('de-DE');
    return `<div class="feedback-item">
      <div class="feedback-header">
        <span class="feedback-title">${f.title}</span>
        <div class="feedback-badges">
          <span class="badge ${statusColors[st] || 'badge-gray'}">${st}</span>
          <span class="badge ${priorityColors[pr] || 'badge-gray'}">${pr}</span>
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

function startClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  let lastMinute = -1;
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
    const currentMinute = now.getMinutes();
    if (currentMinute !== lastMinute) {
      lastMinute = currentMinute;
      if (scheduleDate) {
        const today = new Date();
        if (scheduleDate.toDateString() === today.toDateString()) loadScheduleBookings(scheduleDate);
      }
    }
  }
  tick();
  setInterval(tick, 1000);
}

function formatEur(n) {
  const num = typeof n === 'number' ? n : parseFloat(n);
  return ((isFinite(num) ? num : 0)).toFixed(2).replace('.', ',') + ' €';
}

async function loadRechnungen() {
  const ownerId = getOwnerId();
  const { data, error } = await bizScope(supabase.from('invoices')
    .select('*, prescriptions ( rezept_typ, status, dmrz_exported_at, heilmittel )')
    .eq('owner_id', ownerId).order('created_at', { ascending: false }), 'finance');
  if (error) { console.error('[invoices]', error); return; }
  invListCache = data || [];
  renderInvList();
}

function renderInvList() {
  const tbody = document.getElementById('invListBody');
  const empty = document.getElementById('invListEmpty');
  const wrap = document.getElementById('invListWrap');
  if (!tbody) return;
  if (invListCache.length === 0) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  const statusMap = { draft: 'Entwurf', sent: 'Gesendet', paid: 'Bezahlt', cancelled: 'Storniert' };
  const statusCls = { draft: 'badge-gray', sent: 'badge-blue', paid: 'badge-green', cancelled: 'badge-red' };
  tbody.innerHTML = invListCache.map(inv => {
    const date = new Date(inv.issued_at || inv.created_at).toLocaleDateString('de-DE');
    const total = formatEur(inv.total_patient || 0);
    const st = inv.status || 'draft';
    return `<tr>
      <td><strong>${inv.invoice_number || '—'}</strong></td>
      <td>${escapeHtml(inv.patient_name || '')}</td>
      <td>${date}</td>
      <td>${total}</td>
      <td><span class="badge ${statusCls[st] || 'badge-gray'}">${statusMap[st] || st}</span></td>
      <td>${renderRezeptBadges(inv)}</td>
      <td><button class="btn-ghost-sm inv-view-btn" data-id="${inv.id}">Ansehen</button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.inv-view-btn').forEach(btn => {
    btn.onclick = () => openInvView(btn.dataset.id);
  });
}

async function openInvView(invoiceId) {
  if (!invoiceId) return;
  const inv = invListCache.find(i => i.id === invoiceId);
  if (!inv) { showToast('Rechnung nicht gefunden.', 'error'); return; }

  // Resolve patient, prescription (with arzt), and booking range
  const [{ data: patient }, prescriptionRes, bookingsRes] = await Promise.all([
    supabase.from('leads')
      .select('first_name,last_name,title,geburtsdatum,street,plz,city,versichertennummer,krankenkasse,phone,email')
      .eq('id', inv.patient_id).maybeSingle(),
    inv.prescription_id
      ? supabase.from('prescriptions')
        .select('rezept_typ,status,heilmittel,icd10,diagnosegruppe,anzahl_einheiten,frequenz,ausstellungsdatum,gueltig_bis,dmrz_exported_at, aerzte ( arzt_name, lanr, bsnr )')
        .eq('id', inv.prescription_id).maybeSingle()
      : Promise.resolve({ data: null }),
    inv.prescription_id
      ? supabase.from('prescription_sessions')
        .select('bookings ( start_time )').eq('prescription_id', inv.prescription_id)
      : Promise.resolve({ data: null })
  ]);
  const rx = prescriptionRes.data;
  const arzt = rx?.aerzte;

  // Issuer (top-left)
  document.getElementById('invvBizName').textContent = currentProfile.business_name || '—';
  const bizMeta = [];
  if (currentProfile.street) bizMeta.push(currentProfile.street);
  const cityLine = [currentProfile.plz, currentProfile.city].filter(Boolean).join(' ');
  if (cityLine) bizMeta.push(cityLine);
  if (currentProfile.phone) bizMeta.push('Tel: ' + currentProfile.phone);
  if (currentProfile.email) bizMeta.push(currentProfile.email);
  if (currentProfile.ik_number) bizMeta.push('IK: ' + currentProfile.ik_number);
  document.getElementById('invvBizMeta').textContent = bizMeta.join('\n');

  // Meta (top-right)
  document.getElementById('invvNumber').textContent = inv.invoice_number || '—';
  document.getElementById('invvDate').textContent = new Date(inv.issued_at || inv.created_at).toLocaleDateString('de-DE');
  const statusMap = { draft: 'Entwurf', sent: 'Gesendet', paid: 'Bezahlt', cancelled: 'Storniert' };
  document.getElementById('invvStatus').textContent = statusMap[inv.status] || inv.status || '—';

  // Leistungszeitraum from linked session bookings (min..max start_time)
  const bookingDates = (bookingsRes.data || []).map(r => r.bookings?.start_time).filter(Boolean).map(s => new Date(s));
  if (bookingDates.length) {
    bookingDates.sort((a, b) => a - b);
    const fmt = d => d.toLocaleDateString('de-DE');
    const a = bookingDates[0], b = bookingDates[bookingDates.length - 1];
    document.getElementById('invvLeistungszeitraumRow').hidden = false;
    document.getElementById('invvLeistungszeitraum').textContent =
      a.toDateString() === b.toDateString() ? fmt(a) : `${fmt(a)} – ${fmt(b)}`;
  } else {
    document.getElementById('invvLeistungszeitraumRow').hidden = true;
  }

  // Recipient (DIN 5008)
  const patientLines = [];
  if (patient) {
    const fullName = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || patient.title || inv.patient_name || '';
    patientLines.push(`<strong>${escapeHtml(fullName)}</strong>`);
    if (patient.street) patientLines.push(escapeHtml(patient.street));
    const pc = [patient.plz, patient.city].filter(Boolean).join(' ');
    if (pc) patientLines.push(escapeHtml(pc));
    if (patient.geburtsdatum) patientLines.push('Geboren: ' + new Date(patient.geburtsdatum).toLocaleDateString('de-DE'));
    if (patient.krankenkasse) patientLines.push('Krankenkasse: ' + escapeHtml(patient.krankenkasse));
    if (patient.versichertennummer) patientLines.push('Versichertennr.: ' + escapeHtml(patient.versichertennummer));
  } else {
    patientLines.push(`<strong>${escapeHtml(inv.patient_name || '—')}</strong>`);
  }
  document.getElementById('invvPatient').innerHTML = patientLines.join('<br>');

  if (rx) {
    document.getElementById('invvRxBlock').hidden = false;
    document.getElementById('invvRx').innerHTML = [
      `<div>Heilmittel: <strong>${escapeHtml(rx.heilmittel || '—')}</strong></div>`,
      rx.icd10 ? `<div>ICD-10: ${escapeHtml(rx.icd10)}${rx.diagnosegruppe ? ' · Diagnosegruppe ' + escapeHtml(rx.diagnosegruppe) : ''}</div>` : '',
      rx.ausstellungsdatum ? `<div>Ausgestellt: ${new Date(rx.ausstellungsdatum).toLocaleDateString('de-DE')}${rx.gueltig_bis ? ' · Gültig bis: ' + new Date(rx.gueltig_bis).toLocaleDateString('de-DE') : ''}</div>` : '',
      rx.frequenz ? `<div>Frequenz: ${escapeHtml(rx.frequenz)}</div>` : '',
      arzt?.arzt_name
        ? `<div>Verordnender Arzt: ${escapeHtml(arzt.arzt_name)}${arzt.lanr ? ' · LANR ' + escapeHtml(arzt.lanr) : ''}${arzt.bsnr ? ' · BSNR ' + escapeHtml(arzt.bsnr) : ''}</div>`
        : ''
    ].filter(Boolean).join('');
  } else {
    document.getElementById('invvRxBlock').hidden = true;
  }

  // Aggregate just for display in case the row has stale duplicates
  const lines = aggregateInvLines(inv.line_items || []);
  document.getElementById('invvLineBody').innerHTML = lines.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(l.title || '')}</td>
      <td class="num">${l.quantity || 1}×</td>
      <td class="num">${formatEur(l.unit_price || 0)}</td>
      <td class="num">${formatEur((l.quantity || 1) * (l.unit_price || 0))}</td>
    </tr>`).join('');

  document.getElementById('invvSubtotal').textContent = formatEur(inv.subtotal || 0);
  document.getElementById('invvEigenPct').textContent = inv.eigenanteil_pct || 0;
  document.getElementById('invvEigenEur').textContent = formatEur(inv.eigenanteil_eur || 0);
  document.getElementById('invvKasse').textContent = formatEur(inv.kassenzuzahlung || 0);
  document.getElementById('invvTotal').textContent = formatEur(inv.total_patient || 0);

  if (inv.notes) {
    document.getElementById('invvNotesWrap').hidden = false;
    document.getElementById('invvNotes').textContent = inv.notes;
  } else {
    document.getElementById('invvNotesWrap').hidden = true;
  }

  // Tax exempt note (e.g. § 4 Nr. 14 UStG)
  const taxNoteEl = document.getElementById('invvTaxExemptNote');
  if (currentProfile.tax_exempt_note) {
    taxNoteEl.textContent = currentProfile.tax_exempt_note;
    taxNoteEl.style.display = '';
  } else {
    taxNoteEl.style.display = 'none';
  }

  // Footer: contact / bank / tax IDs
  const contact = [
    currentProfile.business_name,
    [currentProfile.street, [currentProfile.plz, currentProfile.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    currentProfile.phone ? 'Tel: ' + currentProfile.phone : '',
    currentProfile.email
  ].filter(Boolean).join('\n');
  document.getElementById('invvFooterContact').textContent = contact || '—';

  const bank = [
    currentProfile.bank_name,
    currentProfile.iban ? 'IBAN: ' + currentProfile.iban : '',
    currentProfile.bic ? 'BIC: ' + currentProfile.bic : ''
  ].filter(Boolean).join('\n');
  document.getElementById('invvFooterBank').textContent = bank || '—';

  const tax = [
    currentProfile.steuernummer ? 'Steuernr.: ' + currentProfile.steuernummer : '',
    currentProfile.ust_id ? 'USt-IdNr.: ' + currentProfile.ust_id : '',
    currentProfile.ik_number ? 'IK: ' + currentProfile.ik_number : ''
  ].filter(Boolean).join('\n');
  document.getElementById('invvFooterTax').textContent = tax || '—';

  window._currentInvoiceId = inv.id;
  document.getElementById('invListWrap').hidden = true;
  document.getElementById('invEditor').hidden = true;
  document.getElementById('invView').hidden = false;
  document.getElementById('invNewBtn').hidden = true;
}

function closeInvView() {
  document.getElementById('invView').hidden = true;
  document.getElementById('invListWrap').hidden = false;
  document.getElementById('invNewBtn').hidden = false;
}

function printArea() {
  const inv = document.getElementById('invoicePrintArea');
  const anam = document.getElementById('anamnesePrintArea');
  // Force the print template into the layout briefly so @media print can show it
  const prevInv = inv ? inv.style.display : '';
  const prevAnam = anam ? anam.style.display : '';
  if (inv && !document.getElementById('invView').hidden) inv.style.display = 'block';
  if (anam && activePanel === 'anamnese') anam.style.display = 'block';

  document.body.classList.add('printing-area');
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printing-area');
    if (inv) inv.style.display = prevInv;
    if (anam) anam.style.display = prevAnam;
  }, 100);
}

function renderRezeptBadges(inv) {
  const rx = inv.prescriptions;
  if (!rx) return '<span class="badge badge-gray" title="Kein verknüpftes Rezept">—</span>';
  const typLabel = { standard: 'Std', blanko: 'Blanko', lhb_bvb: 'LHB' }[rx.rezept_typ] || rx.rezept_typ;
  const typCls = { standard: 'badge-gray', blanko: 'badge-blue', lhb_bvb: 'badge-blue' }[rx.rezept_typ] || 'badge-gray';
  const typBadge = `<span class="badge ${typCls}" title="${escapeHtml(rx.heilmittel || '')}">${typLabel}</span>`;
  const dmrzBadge = rx.dmrz_exported_at
    ? `<span class="badge badge-green" title="DMRZ exportiert am ${new Date(rx.dmrz_exported_at).toLocaleString('de-DE')}">DMRZ ✓</span>`
    : `<span class="badge badge-gray" title="Noch nicht exportiert">DMRZ offen</span>`;
  return `<div style="display:flex;gap:4px;flex-wrap:wrap;">${typBadge}${dmrzBadge}</div>`;
}

async function loadInvPatients() {
  const ownerId = getOwnerId();
  const { data } = await supabase.from('leads')
    .select('id,first_name,last_name,title,phone,email,metadata')
    .eq('owner_id', ownerId).order('first_name', { ascending: true });
  const sel = document.getElementById('invPatientSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Patient auswählen --</option>' +
    (data || []).map(l => {
      const name = displayNameWithBirth(l);
      return `<option value="${l.id}" data-phone="${escapeHtml(l.phone || '')}" data-email="${escapeHtml(l.email || '')}">${escapeHtml(name)}</option>`;
    }).join('');
}

async function loadPatientBookings(patientId) {
  if (!patientId) return [];
  const ownerId = getOwnerId();

  // 1. Bookings linked through prescription_sessions for this patient
  const { data: linkedRows } = await supabase
    .from('prescription_sessions')
    .select('booking_id, prescriptions!inner(patient_id)')
    .eq('prescriptions.patient_id', patientId)
    .not('booking_id', 'is', null);
  const linkedIds = (linkedRows || []).map(r => r.booking_id).filter(Boolean);

  // 2. Bookings matched by customer identifiers (legacy/non-physio path)
  const { data: lead } = await supabase
    .from('leads')
    .select('first_name,last_name,title,phone,email,phone_normalized')
    .eq('id', patientId)
    .maybeSingle();
  const orParts = [];
  const names = new Set();
  if (lead?.title) names.add(lead.title);
  const composed = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ');
  if (composed) names.add(composed);
  names.forEach(n => orParts.push(`customer_name.eq.${n}`));
  if (lead?.phone) orParts.push(`customer_phone.eq.${lead.phone}`);
  if (lead?.phone_normalized) orParts.push(`customer_phone_normalized.eq.${lead.phone_normalized}`);
  if (lead?.email) orParts.push(`customer_email.eq.${lead.email}`);

  let query = supabase.from('bookings')
    .select('id,start_time,end_time,status,customer_name,service_id, services(title,price,duration_minutes,price_config)')
    .eq('owner_id', ownerId)
    .order('start_time', { ascending: false });

  if (linkedIds.length && orParts.length) {
    query = query.or(`id.in.(${linkedIds.join(',')}),${orParts.join(',')}`);
  } else if (linkedIds.length) {
    query = query.in('id', linkedIds);
  } else if (orParts.length) {
    query = query.or(orParts.join(','));
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) { console.error('[bookings]', error); return []; }
  // Dedupe just in case the OR overlapped with linked ids
  const seen = new Set();
  return (data || []).filter(b => (seen.has(b.id) ? false : (seen.add(b.id), true)));
}

function buildSvcOptions(selectedTitle) {
  const opts = ownerServices.map(s =>
    `<option value="${escapeHtml(s.title || '')}" data-price="${parseFloat(s.price) || 0}" ${(s.title || '') === selectedTitle ? 'selected' : ''}>${escapeHtml(s.title || '')}</option>`
  ).join('');
  return `<option value="" data-price="0">-- Leistung wählen --</option>` + opts;
}

function buildInvLineRow(line, idx) {
  return `<tr data-idx="${idx}">
    <td><select class="form-select inv-line-svc" style="min-width:180px;font-size:13px;">${buildSvcOptions(line.title || '')}</select></td>
    <td><input type="number" class="form-input inv-line-qty" value="${line.quantity || 1}" min="0" style="width:72px;text-align:center;" /></td>
    <td><input type="number" class="form-input inv-line-price" value="${line.unit_price || 0}" min="0" step="0.01" style="width:100px;text-align:right;" /></td>
    <td style="text-align:right;font-weight:600;">${formatEur((line.quantity || 1) * (line.unit_price || 0))}</td>
    <td><button class="btn-icon inv-del-line" type="button" title="Entfernen">🗑</button></td>
  </tr>`;
}

function renderInvLines() {
  const tbody = document.getElementById('invLineBody');
  if (!tbody) return;
  tbody.innerHTML = invLines.map((l, i) => buildInvLineRow(l, i)).join('');
  tbody.querySelectorAll('.inv-line-svc').forEach((sel, i) => {
    sel.onchange = () => {
      const opt = sel.options[sel.selectedIndex];
      invLines[i].title = opt.value;
      invLines[i].unit_price = parseFloat(opt.dataset.price) || 0;
      renderInvLines(); calcInvTotals();
    };
  });
  tbody.querySelectorAll('.inv-line-qty').forEach((inp, i) => {
    inp.onchange = () => { invLines[i].quantity = parseFloat(inp.value) || 0; renderInvLines(); calcInvTotals(); };
  });
  tbody.querySelectorAll('.inv-line-price').forEach((inp, i) => {
    inp.onchange = () => { invLines[i].unit_price = parseFloat(inp.value) || 0; renderInvLines(); calcInvTotals(); };
  });
  tbody.querySelectorAll('.inv-del-line').forEach((btn, i) => {
    btn.onclick = () => { invLines.splice(i, 1); renderInvLines(); calcInvTotals(); };
  });
}

function calcInvTotals() {
  const sub = invLines.reduce((s, l) => s + (l.quantity || 1) * (l.unit_price || 0), 0);
  const eigenPct = parseFloat(document.getElementById('invEigenPct').value) || 0;
  const eigenEur = sub * (eigenPct / 100);
  const kasse = parseFloat(document.getElementById('invKasse').value) || 0;
  const total = eigenEur + kasse;
  document.getElementById('invSubtotal').textContent = formatEur(sub);
  document.getElementById('invEigenEur').textContent = formatEur(eigenEur);
  document.getElementById('invKasseDisplay').textContent = formatEur(kasse);
  document.getElementById('invTotalPatient').textContent = formatEur(total);
}

async function generateInvNumber() {
  const year = new Date().getFullYear();
  const ownerId = getOwnerId();
  const { data } = await supabase.from('invoices')
    .select('invoice_number')
    .eq('owner_id', ownerId)
    .ilike('invoice_number', `INV-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1);
  let next = 1;
  if (data && data.length > 0 && data[0].invoice_number) {
    const m = data[0].invoice_number.match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `INV-${year}-${String(next).padStart(4, '0')}`;
}

function resetInvEditor() {
  invLines = [];
  invPatientId = null;
  invPrescriptionId = null;
  document.getElementById('invPatientSelect').value = '';
  document.getElementById('invPatientInfo').textContent = '';
  document.getElementById('invLineBody').innerHTML = '';
  document.getElementById('invEigenPct').value = 10;
  document.getElementById('invKasse').value = 10;
  document.getElementById('invNotes').value = '';
  document.getElementById('invPrintBtn').disabled = true;
  const dmrzBtn = document.getElementById('invDmrzBtn');
  if (dmrzBtn) dmrzBtn.disabled = true;
  window._currentInvoiceId = null;
  calcInvTotals();
}

async function openInvEditor(invoiceId) {
  document.getElementById('invEditor').hidden = false;
  document.getElementById('invListWrap').hidden = true;
  document.getElementById('invNewBtn').hidden = true;
  await loadInvPatients();
  resetInvEditor();
  if (invoiceId) {
    const inv = invListCache.find(i => i.id === invoiceId);
    if (!inv) return;
    invPatientId = inv.patient_id;
    invPrescriptionId = inv.prescription_id || null;
    document.getElementById('invPatientSelect').value = inv.patient_id || '';
    invLines = (inv.line_items || []).map(l => ({ ...l }));
    document.getElementById('invEigenPct').value = inv.eigenanteil_pct || 0;
    document.getElementById('invKasse').value = inv.kassenzuzahlung || 0;
    document.getElementById('invNotes').value = inv.notes || '';
    document.getElementById('invPrintBtn').disabled = false;
    const dmrzBtn = document.getElementById('invDmrzBtn');
    if (dmrzBtn) dmrzBtn.disabled = false;
    window._currentInvoiceId = inv.id;
    renderInvLines();
    calcInvTotals();
  } else {
    document.getElementById('invPatientSelect').focus();
  }
}

function closeInvEditor() {
  document.getElementById('invEditor').hidden = true;
  document.getElementById('invListWrap').hidden = false;
  document.getElementById('invNewBtn').hidden = false;
}

// Collapses repeated lines (same title + same unit price) into single rows
// with summed quantity. Keeps lines with the same title but different prices
// as separate entries (different durations / tariffs).
function aggregateInvLines(lines) {
  const groups = new Map();
  const order = [];
  for (const l of lines || []) {
    const title = (l.title || '').trim();
    const price = parseFloat(l.unit_price) || 0;
    const qty = parseFloat(l.quantity) || 1;
    const key = `${title}::${price.toFixed(2)}`;
    if (!groups.has(key)) {
      groups.set(key, { title, unit_price: price, quantity: 0 });
      order.push(key);
    }
    groups.get(key).quantity += qty;
  }
  return order.map(k => groups.get(k));
}

async function saveInvoice() {
  const patientSel = document.getElementById('invPatientSelect');
  const patientId = patientSel.value;
  if (!patientId) { showToast('Bitte wählen Sie einen Patienten aus.', 'error'); return; }
  if (invLines.length === 0) { showToast('Bitte fügen Sie mindestens eine Leistung hinzu.', 'error'); return; }
  // Collapse duplicates so the printed invoice and the DB row stay tidy
  invLines = aggregateInvLines(invLines);
  renderInvLines(); calcInvTotals();
  const subtotal = invLines.reduce((s, l) => s + (l.quantity || 1) * (l.unit_price || 0), 0);
  const eigenPct = parseFloat(document.getElementById('invEigenPct').value) || 0;
  const eigenEur = subtotal * (eigenPct / 100);
  const kasse = parseFloat(document.getElementById('invKasse').value) || 0;
  const total = eigenEur + kasse;
  const ownerId = getOwnerId();
  const patientName = patientSel.options[patientSel.selectedIndex].text;
  const invoiceNumber = await generateInvNumber();
  const payload = {
    owner_id: ownerId,
    patient_id: patientId,
    patient_name: patientName,
    line_items: invLines,
    subtotal,
    eigenanteil_pct: eigenPct,
    eigenanteil_eur: eigenEur,
    kassenzuzahlung: kasse,
    total_patient: total,
    status: 'draft',
    invoice_number: invoiceNumber,
    prescription_id: invPrescriptionId || null,
    notes: document.getElementById('invNotes').value || null
  };
  const { data: inserted, error } = await supabase.from('invoices').insert(payload).select('id').maybeSingle();
  if (error) { console.error('[invoice save]', error); showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }
  showToast('Rechnung ' + invoiceNumber + ' erstellt.');
  document.getElementById('invPrintBtn').disabled = false;
  const dmrzBtn = document.getElementById('invDmrzBtn');
  if (dmrzBtn) dmrzBtn.disabled = false;
  window._currentInvoiceId = inserted?.id || null;
  await loadRechnungen();
}

// ===== DMRZ XML export (Phase 3) =====

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildDmrzXml({ invoice, patient, prescription, arzt, owner }) {
  const tag = (name, val) => `    <${name}>${xmlEscape(val)}</${name}>`;
  const now = new Date().toISOString();
  const lines = (invoice.line_items || []).map((l, i) =>
    `    <Leistung position="${i + 1}">
      <Bezeichnung>${xmlEscape(l.title || '')}</Bezeichnung>
      <Anzahl>${Number(l.quantity || 1)}</Anzahl>
      <Einzelpreis>${(Number(l.unit_price) || 0).toFixed(2)}</Einzelpreis>
      <Gesamt>${((Number(l.quantity) || 1) * (Number(l.unit_price) || 0)).toFixed(2)}</Gesamt>
    </Leistung>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<DMRZExport xmlns="https://infinitymade.de/dmrz/v1" erzeugt="${now}" format="§302-vereinfacht-v1">
  <Leistungserbringer>
    <Name>${xmlEscape(owner?.business_name || '')}</Name>
    <Stadt>${xmlEscape(owner?.city || '')}</Stadt>
    <Telefon>${xmlEscape(owner?.phone || '')}</Telefon>
    <IK>${xmlEscape(owner?.ik_number || '')}</IK>
  </Leistungserbringer>
  <Versicherter>
${tag('Name', [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || patient?.title || '')}
${tag('Geburtsdatum', patient?.dob || '')}
${tag('Versichertennummer', patient?.versichertennummer || '')}
${tag('Krankenkasse', patient?.krankenkasse || '')}
  </Versicherter>
  <Arzt>
${tag('Name', arzt?.arzt_name || '')}
${tag('LANR', arzt?.lanr || '')}
${tag('BSNR', arzt?.bsnr || '')}
  </Arzt>
  <Verordnung typ="${xmlEscape(prescription?.rezept_typ || 'standard')}">
${tag('Ausstellungsdatum', prescription?.ausstellungsdatum || '')}
${tag('Behandlungsbeginn', prescription?.behandlungsbeginn || '')}
${tag('ICD10', prescription?.icd10 || '')}
${tag('Diagnosegruppe', prescription?.diagnosegruppe || '')}
${tag('Heilmittel', prescription?.heilmittel || '')}
${tag('AnzahlEinheiten', prescription?.anzahl_einheiten || '')}
${tag('Frequenz', prescription?.frequenz || '')}
${tag('Hausbesuch', prescription?.hausbesuch ? 'true' : 'false')}
${tag('Dringend', prescription?.is_dringend ? 'true' : 'false')}
  </Verordnung>
  <Rechnung nummer="${xmlEscape(invoice.invoice_number || '')}">
${tag('Zwischensumme', (Number(invoice.subtotal) || 0).toFixed(2))}
${tag('EigenanteilProzent', invoice.eigenanteil_pct || 0)}
${tag('EigenanteilEuro', (Number(invoice.eigenanteil_eur) || 0).toFixed(2))}
${tag('Kassenzuzahlung', (Number(invoice.kassenzuzahlung) || 0).toFixed(2))}
${tag('GesamtPatient', (Number(invoice.total_patient) || 0).toFixed(2))}
    <Leistungen>
${lines}
    </Leistungen>
${invoice.notes ? tag('Notizen', invoice.notes) : ''}
  </Rechnung>
</DMRZExport>
`;
}

async function downloadDmrzForInvoice() {
  const invId = window._currentInvoiceId;
  if (!invId) { showToast('Bitte zuerst die Rechnung speichern.', 'error'); return; }

  const okExport = await showConfirmModal({
    title: 'DMRZ-Export (§302) erstellen?',
    message: 'Die Rechnung wird als „abgerechnet" markiert und die §302-Exportdatei wird erzeugt. Dieser Schritt ist verbindlich und kann nicht rückgängig gemacht werden.',
    confirmText: 'Exportieren',
    cancelText: 'Abbrechen',
    variant: 'danger'
  });
  if (!okExport) return;

  try {
    const ownerId = getOwnerId();
    const { data: invoice, error: e1 } = await supabase.from('invoices')
      .select('*').eq('id', invId).eq('owner_id', ownerId).maybeSingle();
    if (e1 || !invoice) throw new Error(e1?.message || 'Rechnung nicht gefunden');

    const { data: patient } = await supabase.from('leads')
      .select('id,first_name,last_name,title,dob,versichertennummer,krankenkasse,email,phone')
      .eq('id', invoice.patient_id).maybeSingle();

    let prescription = null;
    if (invoice.prescription_id) {
      const { data: p } = await supabase.from('prescriptions')
        .select('*').eq('id', invoice.prescription_id).maybeSingle();
      prescription = p || null;
    }
    if (!prescription) {
      const { data: prescriptions } = await supabase.from('prescriptions')
        .select('*').eq('patient_id', invoice.patient_id)
        .order('created_at', { ascending: false }).limit(1);
      prescription = prescriptions?.[0] || null;
    }

    let arzt = null;
    if (prescription?.arzt_id) {
      const { data: a } = await supabase.from('aerzte')
        .select('arzt_name,lanr,bsnr').eq('id', prescription.arzt_id).maybeSingle();
      arzt = a;
    }

    const xml = buildDmrzXml({
      invoice, patient, prescription, arzt,
      owner: {
        business_name: currentProfile.business_name,
        city: currentProfile.city,
        phone: currentProfile.phone,
        ik_number: currentProfile.ik_number || ''
      }
    });

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DMRZ-${invoice.invoice_number || invId}.xml`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);

    if (prescription?.id) {
      await supabase.from('prescriptions')
        .update({ dmrz_exported_at: new Date().toISOString(), status: 'billed' })
        .eq('id', prescription.id);
    }
    showToast('DMRZ XML heruntergeladen ✓');
  } catch (e) {
    console.error('[dmrz-export]', e);
    showToast('Fehler: ' + e.message, 'error');
  }
}

let anamnesePatientCache = [];
let currentAnamneseId = null;
let currentAnamnesePatientId = null;

async function loadAnamnese() {
  const ownerId = getOwnerId();
  const { data } = await supabase.from('leads')
    .select('id,first_name,last_name,title,phone,email,metadata,geschlecht')
    .eq('owner_id', ownerId)
    .order('first_name', { ascending: true });
  anamnesePatientCache = data || [];
  const sel = document.getElementById('anamPatientSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Patient auswählen --</option>' +
    anamnesePatientCache.map(l => {
      const name = displayNameWithBirth(l);
      return `<option value="${l.id}">${escapeHtml(name)}</option>`;
    }).join('');
  if (prefillAnamnesePatientId) {
    sel.value = prefillAnamnesePatientId;
    await fillAnamneseForm(prefillAnamnesePatientId);
    prefillAnamnesePatientId = null;
  } else {
    resetAnamneseForm();
  }
}

function getAnamChecks(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

function setAnamChecks(containerId, dbString, otherInputId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  if (!dbString) { if (otherInputId) document.getElementById(otherInputId).value = ''; return; }
  const items = dbString.split(',').map(s => s.trim()).filter(Boolean);
  const known = Array.from(wrap.querySelectorAll('input[type="checkbox"]')).map(cb => cb.value);
  const unmatched = [];
  items.forEach(item => {
    const cb = wrap.querySelector(`input[value="${item}"]`);
    if (cb) cb.checked = true;
    else unmatched.push(item);
  });
  if (otherInputId) document.getElementById(otherInputId).value = unmatched.join(', ');
}

function syncAnamTextarea(containerId, otherInputId, textareaId) {
  const vals = getAnamChecks(containerId);
  const other = document.getElementById(otherInputId)?.value.trim();
  if (other) vals.push(other);
  const ta = document.getElementById(textareaId);
  if (ta) ta.value = vals.join(', ');
}

function resetAnamneseForm() {
  currentAnamneseId = null;
  document.getElementById('anamAufnahme').value = new Date().toISOString().substring(0, 10);
  document.getElementById('anamBeschwerdeSeit').value = '';
  document.getElementById('anamSchmerzSkala').value = '0';
  document.getElementById('anamSkalaVal').textContent = '0';
  document.getElementById('anamRaucher').checked = false;
  document.getElementById('anamArztName').value = '';
  document.getElementById('anamArztNummer').value = '';
  document.getElementById('anamRezeptSitzungen').value = '';
  document.getElementById('anamHausbesuch').checked = false;
  document.getElementById('anamWuensche').value = '';
  document.getElementById('anamNotizen').value = '';
  document.getElementById('anamSaveBtn').textContent = 'Speichern';
  document.getElementById('anamPrintBtn').hidden = true;

  const clearAll = [
    ['anamChkBeschwerden', 'anamBeschwerdenOther', 'anamHauptbeschwerde'],
    ['anamChkVorerkrankungen', 'anamVorerkrankungenOther', 'anamVorerkrankungen'],
    ['anamChkOperationen', 'anamOperationenOther', 'anamOperationen'],
    ['anamChkMedikamente', 'anamMedikamenteOther', 'anamMedikamente'],
    ['anamChkAllergien', 'anamAllergienOther', 'anamAllergien'],
    ['anamChkBeruf', 'anamBerufOther', 'anamBeruf'],
    ['anamChkSport', 'anamSportOther', 'anamSport'],
    ['anamChkDiagnose', 'anamDiagnoseOther', 'anamDiagnose'],
  ];
  clearAll.forEach(([cId, oId, tId]) => {
    const wrap = document.getElementById(cId);
    if (wrap) wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    const other = document.getElementById(oId);
    if (other) other.value = '';
    const ta = document.getElementById(tId);
    if (ta) ta.value = '';
  });

  const verlaufRadios = document.querySelectorAll('input[name="anamVerlauf"]');
  verlaufRadios.forEach(r => r.checked = false);
  const schmerzRadios = document.querySelectorAll('input[name="anamSchmerzArt"]');
  schmerzRadios.forEach(r => r.checked = false);
  document.getElementById('anamSchmerzArtOther').value = '';
}

async function loadAnamneseRxContext(patientId) {
  const box = document.getElementById('anamRxContext');
  if (!box) return;
  if (!patientId || getSector() !== 'physiotherapy') { box.style.display = 'none'; return; }

  const { data: rx } = await supabase
    .from('prescriptions')
    .select('id, rezept_typ, status, heilmittel, icd10, diagnosegruppe, anzahl_einheiten, frequenz, ausstellungsdatum, gueltig_bis, hausbesuch, is_dringend, prescription_sessions(status)')
    .eq('patient_id', patientId)
    .in('status', ['parsed', 'confirmed', 'in_therapy'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rx) { box.style.display = 'none'; return; }

  const typLabel = { standard: 'Standard', blanko: 'Blanko', lhb_bvb: 'LHB/BVB' }[rx.rezept_typ] || rx.rezept_typ;
  const statusLabel = { parsed: 'Erfasst', confirmed: 'Bestätigt', in_therapy: 'In Therapie' }[rx.status] || rx.status;

  let validColor = '#15803d', validNote = '';
  if (rx.gueltig_bis) {
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(rx.gueltig_bis) - today0) / 86400000);
    if (days < 0) { validColor = '#ef4444'; validNote = ' · überfällig'; }
    else if (days <= 3) { validColor = '#ef4444'; validNote = ` · in ${days}T`; }
    else if (days <= 10) { validColor = '#f59e0b'; validNote = ` · in ${days}T`; }
  }
  const validStr = rx.gueltig_bis
    ? `<span style="color:${validColor};font-weight:600;">Gültig bis ${new Date(rx.gueltig_bis).toLocaleDateString('de-DE')}${validNote}</span>`
    : 'Gültig bis —';

  const flags = [
    rx.is_dringend ? '<span class="badge badge-red">Dringend</span>' : '',
    rx.hausbesuch ? '<span class="badge badge-blue">Hausbesuch</span>' : ''
  ].filter(Boolean).join(' ');

  document.getElementById('anamRxBadges').innerHTML = `
    <span class="badge badge-blue">${typLabel}</span>
    <span class="badge badge-gray">${statusLabel}</span>
    ${flags}
  `;
  document.getElementById('anamRxHeading').textContent =
    `${rx.heilmittel || '—'}${rx.icd10 ? ' · ' + rx.icd10 : ''}${rx.diagnosegruppe ? ' · ' + rx.diagnosegruppe : ''}`;
  document.getElementById('anamRxMeta').innerHTML =
    `${validStr} · Frequenz: ${escapeHtml(rx.frequenz || '—')}`;

  const total = rx.anzahl_einheiten || (rx.prescription_sessions || []).length || 0;
  const done = (rx.prescription_sessions || []).filter(s => s.status === 'done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('anamRxProgressBar').style.width = pct + '%';
  document.getElementById('anamRxProgressLabel').textContent = `${done}/${total}`;

  box.style.display = '';
}

async function fillAnamneseForm(patientId) {
  loadAnamneseRxContext(patientId).catch(() => { });
  if (!aerzteCache || aerzteCache.length === 0) {
    await loadAerzte();
  }
  if (!patientId) { resetAnamneseForm(); return; }
  currentAnamnesePatientId = patientId;
  const ownerId = getOwnerId();
  const { data } = await supabase.from('anamnese')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) { resetAnamneseForm(); return; }
  currentAnamneseId = data.id;
  document.getElementById('anamAufnahme').value = data.aufnahmedatum || new Date().toISOString().substring(0, 10);
  document.getElementById('anamBeschwerdeSeit').value = data.beschwerde_seit || '';
  document.getElementById('anamSchmerzSkala').value = data.schmerz_skala != null ? String(data.schmerz_skala) : '0';
  document.getElementById('anamSkalaVal').textContent = data.schmerz_skala != null ? String(data.schmerz_skala) : '0';
  document.getElementById('anamRaucher').checked = data.raucher === true;
  document.getElementById('anamArztName').value = data.arzt_name || '';
  document.getElementById('anamArztNummer').value = data.arzt_nummer || '';
  document.getElementById('anamRezeptSitzungen').value = data.rezept_sitzungen != null ? String(data.rezept_sitzungen) : '';
  document.getElementById('anamHausbesuch').checked = data.hausbesuch === true;
  document.getElementById('anamWuensche').value = data.besondere_wuensche || '';
  document.getElementById('anamNotizen').value = data.notizen || '';
  document.getElementById('anamSaveBtn').textContent = 'Aktualisieren';
  document.getElementById('anamPrintBtn').hidden = false;

  setAnamChecks('anamChkBeschwerden', data.hauptbeschwerde, 'anamBeschwerdenOther');
  syncAnamTextarea('anamChkBeschwerden', 'anamBeschwerdenOther', 'anamHauptbeschwerde');
  setAnamChecks('anamChkVorerkrankungen', data.vorerkrankungen, 'anamVorerkrankungenOther');
  syncAnamTextarea('anamChkVorerkrankungen', 'anamVorerkrankungenOther', 'anamVorerkrankungen');
  setAnamChecks('anamChkOperationen', data.operationen, 'anamOperationenOther');
  syncAnamTextarea('anamChkOperationen', 'anamOperationenOther', 'anamOperationen');
  setAnamChecks('anamChkMedikamente', data.medikamente, 'anamMedikamenteOther');
  syncAnamTextarea('anamChkMedikamente', 'anamMedikamenteOther', 'anamMedikamente');
  setAnamChecks('anamChkAllergien', data.allergien, 'anamAllergienOther');
  syncAnamTextarea('anamChkAllergien', 'anamAllergienOther', 'anamAllergien');
  setAnamChecks('anamChkBeruf', data.beruf, 'anamBerufOther');
  syncAnamTextarea('anamChkBeruf', 'anamBerufOther', 'anamBeruf');
  setAnamChecks('anamChkSport', data.sport, 'anamSportOther');
  syncAnamTextarea('anamChkSport', 'anamSportOther', 'anamSport');
  setAnamChecks('anamChkDiagnose', data.diagnose, 'anamDiagnoseOther');
  syncAnamTextarea('anamChkDiagnose', 'anamDiagnoseOther', 'anamDiagnose');

  document.querySelectorAll('input[name="anamVerlauf"]').forEach(r => { r.checked = r.value === (data.beschwerde_verlauf || ''); });
  document.querySelectorAll('input[name="anamSchmerzArt"]').forEach(r => { r.checked = r.value === (data.schmerz_art || ''); });
  const schmerzAndere = document.querySelector('input[name="anamSchmerzArt"][value="andere"]');
  if (schmerzAndere && !schmerzAndere.checked) {
    const knownSchmerz = ['stechend', 'dumpf', 'brennend', 'ziehend', 'krampfartig', 'pulsierend'];
    if (data.schmerz_art && !knownSchmerz.includes(data.schmerz_art)) {
      document.getElementById('anamSchmerzArtOther').value = data.schmerz_art;
      schmerzAndere.checked = true;
    }
  }
}

async function printAnamneseInline() {
  const patientId = currentAnamnesePatientId;
  if (!patientId) { showToast('Bitte wählen Sie einen Patienten aus.', 'error'); return; }

  const ownerId = getOwnerId();
  const { data: anamnese } = await supabase.from('anamnese')
    .select('*').eq('owner_id', ownerId).eq('patient_id', patientId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!anamnese) { showToast('Keine Anamnese für diesen Patienten gefunden.', 'error'); return; }

  const patientName = document.querySelector('#anamPatientSelect option:checked')?.textContent || 'Unbekannt';
  const arr = (v) => Array.isArray(v) ? (v.filter(Boolean).join(', ') || '—') : (v || '—');

  document.getElementById('anamPrintBizName').textContent = currentProfile.business_name || '—';
  const bm = [];
  if (currentProfile.city) bm.push(currentProfile.city);
  if (currentProfile.phone) bm.push('Tel: ' + currentProfile.phone);
  document.getElementById('anamPrintBizMeta').textContent = bm.join(' · ');
  document.getElementById('anamPrintDate').textContent = new Date(anamnese.aufnahmedatum || anamnese.created_at).toLocaleDateString('de-DE');
  document.getElementById('anamPrintPatient').innerHTML = `<strong>${escapeHtml(patientName)}</strong>`;

  const rows = [
    ['Aufnahmedatum', anamnese.aufnahmedatum ? new Date(anamnese.aufnahmedatum).toLocaleDateString('de-DE') : '—'],
    ['Beschwerde seit', anamnese.beschwerde_seit || '—'],
    ['Hauptbeschwerden', arr(anamnese.hauptbeschwerde || anamnese.beschwerden)],
    ['Schmerz-Skala (0–10)', anamnese.schmerz_skala != null ? String(anamnese.schmerz_skala) : '—'],
    ['Schmerzart', arr(anamnese.schmerz_art)],
    ['Vorerkrankungen', arr(anamnese.vorerkrankungen)],
    ['Medikamente', arr(anamnese.medikamente)],
    ['Allergien', arr(anamnese.allergien)],
    ['Raucher', anamnese.raucher ? 'Ja' : 'Nein'],
    ['Hausbesuch', anamnese.hausbesuch ? 'Ja' : 'Nein'],
    ['Arzt', anamnese.arzt_name || '—'],
    ['Arzt-Nummer', anamnese.arzt_nummer || '—'],
    ['Verordnete Sitzungen', anamnese.rezept_sitzungen != null ? String(anamnese.rezept_sitzungen) : '—'],
    ['Besondere Wünsche', anamnese.besondere_wuensche || '—']
  ];
  document.getElementById('anamPrintFields').innerHTML = rows.map(([k, v]) =>
    `<div class="anamnese-print-row"><div class="anamnese-print-label">${k}</div><div class="anamnese-print-value">${escapeHtml(String(v))}</div></div>`
  ).join('');

  if (anamnese.notizen) {
    document.getElementById('anamPrintNotesWrap').hidden = false;
    document.getElementById('anamPrintNotes').textContent = anamnese.notizen;
  } else {
    document.getElementById('anamPrintNotesWrap').hidden = true;
  }

  printArea();
}

// Legacy popup printer (kept for compatibility but unwired)
async function printAnamnese() {
  const patientId = currentAnamnesePatientId;
  if (!patientId) { showToast('Bitte wählen Sie einen Patienten aus.', 'error'); return; }

  const ownerId = getOwnerId();
  const { data: anamnese } = await supabase.from('anamnese')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!anamnese) { showToast('Keine Anamnese für diesen Patienten gefunden.', 'error'); return; }

  const patientName = document.querySelector('#anamPatientSelect option:checked')?.textContent || 'Unbekannt';

  const getArrayStr = (val) => {
    if (!val) return '-';
    if (Array.isArray(val)) return val.filter(v => v).join(', ') || '-';
    return String(val);
  };

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Anamnese - ${patientName}</title>
<style>
  body{font-family:Arial,sans-serif;padding:30px;max-width:800px;margin:0 auto;font-size:14px}
  h1{font-size:20px;border-bottom:2px solid #22c55e;padding-bottom:10px;margin-bottom:20px}
  h2{font-size:16px;color:#22c55e;margin-top:20px}
  .row{display:flex;gap:20px;margin:8px 0}
  .label{font-weight:bold;min-width:160px}
  .value{flex:1}
  .section{background:#f9f9f9;padding:15px;margin:15px 0;border-radius:8px}
</style></head><body>
<h1>Anamnese - ${patientName}</h1>
<div class="row"><span class="label">Aufnahmedatum:</span><span class="value">${anamnese.aufnahmedatum || '-'}</span></div>
<div class="row"><span class="label">Beschwerden seit:</span><span class="value">${anamnese.beschwerde_seit || '-'}</span></div>
<h2>Hauptbeschwerde</h2>
<div class="section">${getArrayStr(anamnese.hauptbeschwerde)}</div>
<h2>Schmerz</h2>
<div class="row"><span class="label">Schmerz-Skala:</span><span class="value">${anamnese.schmerz_skala ?? '-'}/10</span></div>
<div class="row"><span class="label">Schmerz-Art:</span><span class="value">${anamnese.schmerz_art || '-'}</span></div>
<div class="row"><span class="label">Verlauf:</span><span class="value">${anamnese.beschwerde_verlauf || '-'}</span></div>
<h2>Vorerkrankungen</h2>
<div class="section">${getArrayStr(anamnese.vorerkrankungen)}</div>
<h2>Medikamente</h2>
<div class="section">${getArrayStr(anamnese.medikamente)}</div>
<h2>Allergien</h2>
<div class="section">${getArrayStr(anamnese.allergien)}</div>
<h2>Operationen</h2>
<div class="section">${getArrayStr(anamnese.operationen)}</div>
<h2>Beruf / Sport</h2>
<div class="row"><span class="label">Beruf:</span><span class="value">${getArrayStr(anamnese.beruf)}</span></div>
<div class="row"><span class="label">Sport:</span><span class="value">${getArrayStr(anamnese.sport)}</span></div>
<div class="row"><span class="label">Raucher:</span><span class="value">${anamnese.raucher ? 'Ja' : 'Nein'}</span></div>
<h2>Arzt / Rezept</h2>
<div class="row"><span class="label">Arzt:</span><span class="value">${anamnese.arzt_name || '-'}</span></div>
<div class="row"><span class="label">Arzt-Nr.:</span><span class="value">${anamnese.arzt_nummer || '-'}</span></div>
<div class="row"><span class="label">Rezept-Sitzungen:</span><span class="value">${anamnese.rezept_sitzungen || '-'}</span></div>
<div class="row"><span class="label">Hausbesuch:</span><span class="value">${anamnese.hausbesuch ? 'Ja' : 'Nein'}</span></div>
<h2>Besondere Wünsche</h2>
<div class="section">${anamnese.besondere_wuensche || '-'}</div>
<h2>Notizen</h2>
<div class="section">${anamnese.notizen || '-'}</div>
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
  else showToast('Popup blocked! Bitte Popups erlauben.', 'error');
}

async function saveAnamnese() {
  const patientId = document.getElementById('anamPatientSelect').value;
  if (!patientId) { showToast('Bitte wählen Sie einen Patienten aus.', 'error'); return; }
  const ownerId = getOwnerId();

  const getRadio = (name) => { const r = document.querySelector(`input[name="${name}"]:checked`); return r ? r.value : null; };
  let schmerzArt = getRadio('anamSchmerzArt');
  if (schmerzArt === 'andere') schmerzArt = document.getElementById('anamSchmerzArtOther').value.trim() || null;

  const payload = {
    owner_id: ownerId,
    patient_id: patientId,
    aufnahmedatum: document.getElementById('anamAufnahme').value || null,
    hauptbeschwerde: document.getElementById('anamHauptbeschwerde').value.trim() || null,
    beschwerde_seit: document.getElementById('anamBeschwerdeSeit').value.trim() || null,
    beschwerde_verlauf: getRadio('anamVerlauf'),
    schmerz_skala: document.getElementById('anamSchmerzSkala').value !== '' ? parseInt(document.getElementById('anamSchmerzSkala').value, 10) : null,
    schmerz_art: schmerzArt,
    vorerkrankungen: document.getElementById('anamVorerkrankungen').value.trim() || null,
    operationen: document.getElementById('anamOperationen').value.trim() || null,
    medikamente: document.getElementById('anamMedikamente').value.trim() || null,
    allergien: document.getElementById('anamAllergien').value.trim() || null,
    beruf: document.getElementById('anamBeruf').value.trim() || null,
    sport: document.getElementById('anamSport').value.trim() || null,
    raucher: document.getElementById('anamRaucher').checked,
    diagnose: document.getElementById('anamDiagnose').value.trim() || null,
    arzt_name: document.getElementById('anamArztName').value.trim() || null,
    arzt_nummer: document.getElementById('anamArztNummer').value.trim() || null,
    rezept_sitzungen: document.getElementById('anamRezeptSitzungen').value !== '' ? parseInt(document.getElementById('anamRezeptSitzungen').value, 10) : null,
    hausbesuch: document.getElementById('anamHausbesuch').checked,
    besondere_wuensche: document.getElementById('anamWuensche').value.trim() || null,
    notizen: document.getElementById('anamNotizen').value.trim() || null,
  };
  if (currentAnamneseId) {
    const { error } = await supabase.from('anamnese').update(payload).eq('id', currentAnamneseId);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Anamnese aktualisiert.');
  } else {
    const { data, error } = await supabase.from('anamnese').insert(payload).select();
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    if (data && data[0]) currentAnamneseId = data[0].id;
    showToast('Anamnese gespeichert.');
  }
  document.getElementById('anamPrintBtn').hidden = false;
}

function bindAnamneseEvents() {
  const sel = document.getElementById('anamPatientSelect');
  if (sel) sel.onchange = (e) => fillAnamneseForm(e.target.value);
  const saveBtn = document.getElementById('anamSaveBtn');
  if (saveBtn) saveBtn.onclick = saveAnamnese;
  const printBtn = document.getElementById('anamPrintBtn');
  if (printBtn) printBtn.onclick = printAnamneseInline;

  const anamArztName = document.getElementById('anamArztName');
  if (anamArztName) {
    anamArztName.addEventListener('input', () => {
      const val = anamArztName.value.trim();
      const matched = aerzteCache.find(a => a.arzt_name === val);
      if (matched && matched.arzt_nummer) {
        const numInput = document.getElementById('anamArztNummer');
        if (numInput && !numInput.value.trim()) {
          numInput.value = matched.arzt_nummer;
        }
      }
    });
  }

  const slider = document.getElementById('anamSchmerzSkala');
  const skalaVal = document.getElementById('anamSkalaVal');
  if (slider && skalaVal) {
    slider.oninput = () => { skalaVal.textContent = slider.value; };
  }

  const syncPairs = [
    ['anamChkBeschwerden', 'anamBeschwerdenOther', 'anamHauptbeschwerde'],
    ['anamChkVorerkrankungen', 'anamVorerkrankungenOther', 'anamVorerkrankungen'],
    ['anamChkOperationen', 'anamOperationenOther', 'anamOperationen'],
    ['anamChkMedikamente', 'anamMedikamenteOther', 'anamMedikamente'],
    ['anamChkAllergien', 'anamAllergienOther', 'anamAllergien'],
    ['anamChkBeruf', 'anamBerufOther', 'anamBeruf'],
    ['anamChkSport', 'anamSportOther', 'anamSport'],
    ['anamChkDiagnose', 'anamDiagnoseOther', 'anamDiagnose'],
  ];
  syncPairs.forEach(([cId, oId, tId]) => {
    const wrap = document.getElementById(cId);
    const other = document.getElementById(oId);
    if (wrap) wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.onchange = () => syncAnamTextarea(cId, oId, tId);
    });
    if (other) other.oninput = () => syncAnamTextarea(cId, oId, tId);
  });
}

function bindInvEvents() {
  document.getElementById('invNewBtn').onclick = () => openInvEditor(null);
  document.getElementById('invCancelBtn').onclick = () => closeInvEditor();
  document.getElementById('invSaveBtn').onclick = saveInvoice;
  document.getElementById('invPrintBtn').onclick = () => {
    // Switch to view first, then print the templated invoice
    if (window._currentInvoiceId) {
      openInvView(window._currentInvoiceId).then(printArea);
    } else {
      showToast('Bitte zuerst die Rechnung speichern.', 'error');
    }
  };
  const dmrzBtn = document.getElementById('invDmrzBtn');
  if (dmrzBtn) dmrzBtn.onclick = downloadDmrzForInvoice;
  document.getElementById('invvPrintBtn')?.addEventListener('click', printArea);
  document.getElementById('invvDmrzBtn')?.addEventListener('click', downloadDmrzForInvoice);
  document.getElementById('invvBackBtn')?.addEventListener('click', closeInvView);
  document.getElementById('invvEditBtn')?.addEventListener('click', () => {
    const id = window._currentInvoiceId;
    if (!id) return;
    document.getElementById('invView').hidden = true;
    openInvEditor(id);
  });
  document.getElementById('invAddLineBtn').onclick = () => {
    invLines.push({ title: '', quantity: 1, unit_price: 0 });
    renderInvLines(); calcInvTotals();
  };
  let invBookingCache = [];

  function syncInvLinesFromChecks() {
    const wrap = document.getElementById('invBookingChecks');
    if (!wrap) return;
    const checked = Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked'));
    invLines = checked.map(cb => ({
      title: cb.dataset.svc || 'Leistung',
      quantity: 1,
      unit_price: parseFloat(cb.dataset.price) || 0
    }));
    renderInvLines(); calcInvTotals();
  }

  document.getElementById('invPatientSelect').onchange = async (e) => {
    invPatientId = e.target.value;
    const bookingWrap = document.getElementById('invBookingWrap');
    const checksWrap = document.getElementById('invBookingChecks');
    if (!invPatientId) {
      document.getElementById('invPatientInfo').textContent = '';
      bookingWrap.hidden = true;
      invBookingCache = [];
      invLines = [];
      renderInvLines(); calcInvTotals();
      return;
    }
    const bookings = await loadPatientBookings(invPatientId);
    invBookingCache = bookings;
    if (bookings.length > 0) {
      bookingWrap.hidden = false;
      checksWrap.innerHTML = bookings.map(b => {
        const dt = new Date(b.start_time).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const svc = b.services?.title || 'Leistung';
        const dur = b.services?.duration_minutes || 0;
        // Get price from services table via price_config if available, otherwise use direct price field
        let price = parseFloat(b.services?.price) || 0;
        if (!price && b.services?.price_config?.durations) {
          const durations = b.services.price_config.durations;
          const firstActive = Object.keys(durations).find(k => durations[k].active);
          price = parseFloat(durations[firstActive]?.price) || 0;
        }
        const id = `invchk-${b.id}`;
        return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;padding:3px 0;cursor:pointer;">
          <input type="checkbox" id="${id}" data-bid="${b.id}" data-svc="${escapeHtml(svc)}" data-price="${price}" data-dur="${dur}" />
          <span>${dt} — <strong>${escapeHtml(svc)}</strong>${dur > 0 ? ' (' + dur + ' Min)' : ''} ${price > 0 ? '— ' + formatEur(price) : ''}</span>
        </label>`;
      }).join('');
      checksWrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.onchange = syncInvLinesFromChecks;
      });
      document.getElementById('invPatientInfo').textContent = `${bookings.length} Termin(e) gefunden.`;
    } else {
      bookingWrap.hidden = true;
      checksWrap.innerHTML = '';
      document.getElementById('invPatientInfo').textContent = 'Keine Termine gefunden.';
    }
    invLines = [];
    renderInvLines(); calcInvTotals();
  };
  document.getElementById('invEigenPct').oninput = calcInvTotals;
  document.getElementById('invKasse').oninput = calcInvTotals;
}

let aerzteCache = [];

function populateAerzteDatalist() {
  const datalist = document.getElementById('aerzteDatalist');
  if (!datalist) return;
  if (!Array.isArray(aerzteCache)) return;
  datalist.innerHTML = aerzteCache.map(a => `<option value="${escapeHtml(a.arzt_name)}"></option>`).join('');
}

function populateLeadArztSelect() {
  const arztSelect = document.getElementById('lead-arzt');
  if (!arztSelect) return;
  if (!Array.isArray(aerzteCache)) return;
  arztSelect.innerHTML = '<option value="">— Kein Arzt —</option>' +
    aerzteCache.map(a => `<option value="${a.id}">${escapeHtml(a.arzt_name)}</option>`).join('');
}

async function loadAerzte() {
  const { data } = await bizScope(supabase.from('aerzte').select('*').order('arzt_name', { ascending: true }), 'network');
  aerzteCache = data || [];

  populateAerzteDatalist();
  populateLeadArztSelect();

  const list = document.getElementById('aerzteList');
  if (!list) return;
  if (!aerzteCache.length) { list.innerHTML = '<p class="text-muted">Keine Ärzte.</p>'; return; }
  list.innerHTML = aerzteCache.map(a => `
    <div class="aerzte-row" data-id="${a.id}">
      <span>${escapeHtml(a.arzt_name)} <span class="text-muted" style="font-size:12px;">${escapeHtml(a.arzt_nummer || '')}</span></span>
      <div>
        <button class="btn-outline" onclick="editAerzte('${a.id}')">Bearbeiten</button>
        <button class="btn-danger" onclick="deleteAerzte('${a.id}')">Löschen</button>
      </div>
    </div>`).join('');
}

async function addAerzte() {
  const name = document.getElementById('aeName').value.trim();
  const nummer = document.getElementById('aeNummer').value.trim();
  if (!name) { showToast('Bitte einen Namen eingeben.', 'error'); return; }
  const ownerId = getOwnerId();
  const { error } = await supabase.from('aerzte').insert({ owner_id: ownerId, arzt_name: name, arzt_nummer: nummer || null });
  if (error) { showToast(t('err_generic'), 'error'); return; }
  document.getElementById('aeName').value = '';
  document.getElementById('aeNummer').value = '';
  await loadAerzte();
  showToast('Arzt gespeichert.');
}

async function deleteAerzte(id) {
  if (!confirm('Arzt wirklich löschen?')) return;
  const { error } = await supabase.from('aerzte').delete().eq('id', id);
  if (error) { showToast(t('err_generic'), 'error'); return; }
  await loadAerzte();
  showToast('Gelöscht.');
}

function editAerzte(id) {
  const a = aerzteCache.find(x => x.id === id);
  if (!a) return;
  const name = prompt('Neuer Name:', a.arzt_name);
  if (name === null) return;
  const nummer = prompt('Neue Telefon/Fax:', a.arzt_nummer || '');
  if (nummer === null) return;
  supabase.from('aerzte').update({ arzt_name: name.trim(), arzt_nummer: nummer.trim() || null }).eq('id', id).then(({ error }) => {
    if (error) { showToast(t('err_generic'), 'error'); return; }
    loadAerzte();
    showToast('Aktualisiert.');
  });
}

window.editAerzte = editAerzte;
window.deleteAerzte = deleteAerzte;

async function openRezeptModal(phone, leadId) {
  document.getElementById('rzPatientId').value = leadId || '';
  document.getElementById('rzArztName').value = '';
  document.getElementById('rzArztNummer').value = '';
  document.getElementById('rzDatum').value = '';
  document.getElementById('rzDiagnose').value = '';
  document.getElementById('rzSitzungen').value = '10';
  document.getElementById('rzHausbesuch').checked = false;
  document.getElementById('rzBerichtAngefordert').checked = false;
  document.getElementById('rzBerichtStatus').value = 'offen';
  document.getElementById('rzBefund').value = '';
  if (leadId) {
    const { data } = await supabase.from('leads').select('title,arzt_id,hausbesuch').eq('id', leadId).single();
    if (data?.arzt_id) {
      const { data: arzt } = await supabase.from('aerzte').select('arzt_name,arzt_nummer').eq('id', data.arzt_id).single();
      if (arzt) {
        document.getElementById('rzArztName').value = arzt.arzt_name || '';
        document.getElementById('rzArztNummer').value = arzt.arzt_nummer || '';
      }
    }
    if (data?.hausbesuch) document.getElementById('rzHausbesuch').checked = true;

    // Fetch and populate leitsymptomatik
    const { data: rx } = await supabase
      .from('prescriptions')
      .select('leitsymptomatik')
      .eq('patient_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const leitsymptomatikEl = document.getElementById('rxcLeitsymptomatik');
    if (leitsymptomatikEl) {
      leitsymptomatikEl.value = rx?.leitsymptomatik || '';
    }
  }
  openModal('rezeptModal');
}

async function saveRezept() {
  const ownerId = getOwnerId();
  const patientId = document.getElementById('rzPatientId').value;
  if (!patientId) { showToast('Kein Patient ausgewählt.', 'error'); return; }
  const payload = {
    ownerId,
    patientId,
    arztName: document.getElementById('rzArztName').value.trim(),
    arztNummer: document.getElementById('rzArztNummer').value.trim(),
    rezeptDatum: document.getElementById('rzDatum').value,
    diagnose: document.getElementById('rzDiagnose').value.trim(),
    sitzungen: parseInt(document.getElementById('rzSitzungen').value) || 10,
    hausbesuch: document.getElementById('rzHausbesuch').checked,
    berichtAngefordert: document.getElementById('rzBerichtAngefordert').checked,
    berichtStatus: document.getElementById('rzBerichtStatus').value,
    befund: document.getElementById('rzBefund').value.trim()
  };
  try {
    const res = await fetch('https://n8n.infinitymade.de/api/rezept/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Speichern fehlgeschlagen');
    closeModal('rezeptModal');
    showToast('Rezept gespeichert.');
  } catch (e) {
    showToast('Fehler: ' + e.message, 'error');
  }
}

// ===== Business Switcher (multi-business, Paket 3) =====


function isEnterprise() {
  const plan = (ownerProfile?.plan || currentProfile?.plan || '').toLowerCase();
  const status = ownerProfile?.plan_status || currentProfile?.plan_status;
  return ENTERPRISE_PLANS.has(plan) && ['trial', 'active', 'past_due'].includes(status);
}

async function bootBusinessSwitcher() {
  const wrap = document.getElementById('bizSwitcher');
  if (!wrap) return;

  try {
    const { data: list } = await supabase
      .from('businesses')
      .select('*')
      .order('is_default', { ascending: false })
      .order('business_name', { ascending: true });
    myBusinesses = list || [];
  } catch (e) {
    console.warn('[bizSwitcher] list failed', e);
    myBusinesses = [];
  }

  if (myBusinesses.length === 0) { wrap.hidden = true; return; }

  // Aktif business'ı çöz
  let activeId = null;
  try { activeId = localStorage.getItem(BIZ_STORAGE_KEY); } catch {}
  if (!activeId) {
    const { data: pref } = await supabase
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', currentSession.user.id)
      .eq('preference_key', BIZ_PREF_KEY)
      .maybeSingle();
    activeId = pref?.preference_value || null;
  }
  if (!activeId) {
    const { data: defaultId } = await supabase.rpc('get_default_business', { p_user: currentSession.user.id });
    activeId = defaultId || myBusinesses[0]?.id || null;
  }
  currentBusiness = myBusinesses.find(b => b.id === activeId) || myBusinesses[0] || null;

  // Switcher'ı yalnızca: (a) birden fazla business varsa, veya (b) Enterprise plan + ekleme yetkisi varsa göster
  const showSwitcher = myBusinesses.length > 1 || (isEnterprise() && currentProfile?.role === 'owner');
  wrap.hidden = !showSwitcher;

  renderBizSwitcher();
  wireBizSwitcherEvents();
  renderBusinessesSection();
  renderDataSharingSection();
}

// ===== Settings > Datenfreigabe zwischen Standorten =====
const DATA_SHARING_CATS = [
  { key: 'patients',   label: 'Patienten & Akten',        desc: 'Patientenliste, Notizen, Anamnese, Rezepte, Überweisungen, Warteliste' },
  { key: 'services',   label: 'Dienstleistungen',          desc: 'Angebotene Leistungen und deren Mitarbeiter-Zuordnung' },
  { key: 'activities', label: 'Aktivitäten',               desc: 'Der „Letzte Aktivitäten"-Verlauf in der Übersicht' },
  { key: 'finance',    label: 'Rechnungen',                desc: 'Patientenrechnungen aller Standorte' },
  { key: 'network',    label: 'Netzwerk (Ärzte & Praxen)', desc: 'Ärzteverzeichnis und B2B-Kontakte' }
];

function renderDataSharingSection() {
  const section = document.getElementById('settingsDataSharingSection');
  const listEl = document.getElementById('dataSharingList');
  if (!section || !listEl) return;

  // Only relevant for Enterprise owners with more than one Standort.
  const show = isEnterprise() && currentProfile?.role === 'owner' && myBusinesses.length > 1;
  section.hidden = !show;
  if (!show) return;

  listEl.innerHTML = DATA_SHARING_CATS.map(c => `
    <label style="display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer;">
      <input type="checkbox" data-share="${c.key}" ${dataSharing[c.key] ? 'checked' : ''} style="margin-top:2px;width:18px;height:18px;flex-shrink:0;accent-color:var(--primary);cursor:pointer;" />
      <span style="flex-grow:1;">
        <span style="display:block;font-weight:600;color:var(--text-main);">${escapeHtml(c.label)}</span>
        <span style="display:block;font-size:12px;color:var(--text-muted);margin-top:2px;line-height:1.4;">${escapeHtml(c.desc)}</span>
      </span>
    </label>`).join('');

  if (!section.dataset.wired) {
    section.dataset.wired = '1';
    document.getElementById('dataSharingSaveBtn')?.addEventListener('click', saveDataSharing);
  }
}

async function saveDataSharing() {
  const btn = document.getElementById('dataSharingSaveBtn');
  const next = { patients: false, services: false, activities: false, finance: false, network: false };
  document.querySelectorAll('#dataSharingList input[data-share]').forEach(cb => {
    next[cb.dataset.share] = cb.checked;
  });

  // Confirm when a category is newly switched ON (off -> on): data becomes visible across all Standorte.
  const enabling = Object.keys(next).filter(k => next[k] && !dataSharing[k]);
  if (enabling.length) {
    const labels = enabling.map(k => DATA_SHARING_CATS.find(c => c.key === k)?.label || k).join(', ');
    const okShare = await showConfirmModal({
      title: 'Daten standortübergreifend freigeben?',
      message: `Folgende Daten werden künftig für ALLE Ihre Standorte sichtbar: ${labels}. ` +
               `Mitarbeiter aller Standorte können diese Daten dann einsehen. Es werden keine Daten kopiert — ` +
               `Sie können diese Einstellung jederzeit wieder zurücksetzen.`,
      confirmText: 'Freigeben',
      cancelText: 'Abbrechen',
      variant: 'primary'
    });
    if (!okShare) return;
  }

  if (btn) btn.disabled = true;
  try {
    const { error } = await supabase
      .from('data_sharing_settings')
      .upsert({ owner_id: getOwnerId(), ...next, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    if (error) throw error;
    dataSharing = next;
    showToast('Datenfreigabe gespeichert ✓');
    // Re-fetch the scoped views so the change is visible immediately.
    loadActivityFeed?.().catch(() => {});
    if (typeof loadLeads === 'function') loadLeads().catch(() => {});
    if (typeof loadServices === 'function') loadServices().catch(() => {});
    if (typeof loadRechnungen === 'function') loadRechnungen().catch(() => {});
    if (typeof loadB2B === 'function') loadB2B().catch(() => {});
    if (typeof loadAerzte === 'function') loadAerzte().catch(() => {});
  } catch (e) {
    console.error('[saveDataSharing]', e);
    showToast(t('err_generic') || 'Fehler beim Speichern', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ===== Settings > Geschäfte (Multi-Business CRUD) =====
function renderBusinessesSection() {
  const section = document.getElementById('settingsBusinessesSection');
  const listEl = document.getElementById('businessesList');
  if (!section || !listEl) return;

  const showSection = isEnterprise() && currentProfile?.role === 'owner';
  section.hidden = !showSection;
  if (!showSection) return;

  if (myBusinesses.length === 0) {
    listEl.innerHTML = '<div class="form-hint">Noch kein Geschäft. Fügen Sie eines hinzu.</div>';
    return;
  }

  const baseUrl = (window.location.origin || 'https://infinitymade.de');
  listEl.innerHTML = myBusinesses.map(b => {
    const addr = [b.street, b.house_number].filter(Boolean).join(' ');
    const cityLine = [b.zip, b.city].filter(Boolean).join(' ');
    const fullAddr = [addr, cityLine].filter(Boolean).join(', ') || '—';
    const link = b.booking_slug ? `${baseUrl}/booking.html?u=${b.booking_slug}` : null;
    const linkHtml = link
      ? `<div class="biz-row-link"><span class="svg-icon" style="width:14px;height:14px;display:inline-flex;vertical-align:-2px;margin-right:4px;color:var(--text-muted);">${ICON.link}</span><span>${escapeHtml(link.replace(/^https?:\/\/(www\.)?/, ''))}</span>
           <button class="btn-icon-sm" data-copy-link="${link}" title="Link kopieren" style="display:inline-flex;align-items:center;justify-content:center;"><span class="svg-icon" style="width:12px;height:12px;display:inline-flex;">${ICON.clipboard}</span></button>
         </div>`
      : `<div class="biz-row-link biz-row-link-missing">Kein Buchungs-Slug gesetzt</div>`;
    return `<div class="biz-row">
      <div class="biz-row-body">
        <div class="biz-row-name">${escapeHtml(b.business_name)}${b.is_default ? '<span class="biz-row-default-tag">(Standard)</span>' : ''}</div>
        <div class="biz-row-meta">${escapeHtml(fullAddr)}</div>
        ${linkHtml}
      </div>
      <div class="biz-row-actions">
        <button class="btn-secondary" data-edit-business="${b.id}">Bearbeiten</button>
        ${b.is_default ? '' : `<button class="btn-danger-link" data-delete-business="${b.id}">Löschen</button>`}
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('[data-copy-link]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lnk = btn.dataset.copyLink;
      navigator.clipboard.writeText(lnk).then(() => showToast(t('copied') || 'Link kopiert ✓'));
    });
  });

  // Bind handlers (idempotent — set dataset.wired)
  if (!section.dataset.wired) {
    section.dataset.wired = '1';
    document.getElementById('addBusinessBtn')?.addEventListener('click', () => openBusinessModal(null));
    section.addEventListener('click', async (e) => {
      const editId = e.target.dataset.editBusiness;
      const delId  = e.target.dataset.deleteBusiness;
      if (editId) openBusinessModal(myBusinesses.find(b => b.id === editId));
      if (delId)  await deleteBusiness(delId);
    });
    wireBusinessModal();
  }
}

function updateBizSlugPreview() {
  const slug = document.getElementById('bizFormSlug')?.value?.trim();
  const preview = document.getElementById('bizSlugPreview');
  if (!preview) return;
  const base = (window.location.origin || 'https://infinitymade.de') + '/booking.html?u=';
  preview.textContent = slug ? base + slug : base + '<slug>';
}

function openBusinessModal(biz) {
  const modal = document.getElementById('businessModal');
  if (!modal) return;
  document.getElementById('businessModalTitle').textContent = biz ? 'Geschäft bearbeiten' : 'Neues Geschäft';
  document.getElementById('bizFormId').value = biz?.id || '';
  document.getElementById('bizFormName').value = biz?.business_name || '';
  document.getElementById('bizFormStreet').value = biz?.street || '';
  document.getElementById('bizFormHouseNumber').value = biz?.house_number || '';
  document.getElementById('bizFormZip').value = biz?.zip || '';
  document.getElementById('bizFormCity').value = biz?.city || '';
  document.getElementById('bizFormPhone').value = biz?.phone || '';
  document.getElementById('bizFormSlug').value = biz?.booking_slug || '';
  updateBizSlugPreview();

  const slugInp = document.getElementById('bizFormSlug');
  if (!slugInp.dataset.wired) {
    slugInp.dataset.wired = '1';
    slugInp.addEventListener('input', () => {
      // Normalize: lowercase + non-alphanum -> dash
      slugInp.value = slugInp.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      updateBizSlugPreview();
    });
  }

  // "Diğer işletmemden kopyala" — sadece yeni business eklerken ve birden fazla varsa göster
  const copyWrap = document.getElementById('bizCopyServicesWrap');
  const copySel  = document.getElementById('bizCopyServicesFrom');
  if (copyWrap && copySel) {
    if (!biz && myBusinesses.length > 0) {
      copyWrap.hidden = false;
      copySel.innerHTML = '<option value="">— Nicht kopieren —</option>' +
        myBusinesses.map(b => `<option value="${b.id}">${escapeHtml(b.business_name)}</option>`).join('');
    } else {
      copyWrap.hidden = true;
    }
  }
  modal.hidden = false;
}

function wireBusinessModal() {
  const modal = document.getElementById('businessModal');
  if (!modal) return;
  modal.querySelectorAll('[data-close="businessModal"]').forEach(el => {
    el.addEventListener('click', () => { modal.hidden = true; });
  });

  const form = document.getElementById('businessForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('bizFormId').value || null;
    const v = (gid) => (document.getElementById(gid)?.value || '').trim();
    const payload = {
      business_name: v('bizFormName'),
      street:        v('bizFormStreet') || null,
      house_number:  v('bizFormHouseNumber') || null,
      zip:           v('bizFormZip') || null,
      city:          v('bizFormCity') || null,
      phone:         v('bizFormPhone') || null,
      booking_slug:  v('bizFormSlug') || null,
    };
    if (!payload.business_name) { showToast('Name erforderlich', 'error'); return; }

    let newBiz = null;
    if (id) {
      const { error } = await supabase.from('businesses').update(payload).eq('id', id);
      if (error) {
        console.error('[biz-update]', error);
        if (error.code === '23505' && error.message.includes('booking_slug')) {
          showToast('Dieser Buchungs-Slug ist bereits vergeben.', 'error');
        } else {
          showToast(t('err_generic'), 'error');
        }
        return;
      }
    } else {
      const isEnterprise = ENTERPRISE_PLANS.has((currentProfile?.plan||'starter').toLowerCase());
      const existingCount = Array.isArray(myBusinesses) ? myBusinesses.length : 0;
      if (!isEnterprise && existingCount >= 1) { showToast('Mehrere Standorte sind nur im Enterprise-Paket verfügbar.', 'error'); return; }

      payload.owner_id = currentSession.user.id;
      payload.sector = currentProfile?.sector || null;
      const { data: created, error } = await supabase.from('businesses').insert(payload).select().single();
      if (error) {
        console.error('[biz-insert]', error);
        if (error.code === '23505' && error.message.includes('booking_slug')) {
          showToast('Dieser Buchungs-Slug ist bereits vergeben.', 'error');
        } else {
          showToast(t('err_generic'), 'error');
        }
        return;
      }
      newBiz = created;

      // Servisleri kopyala (opsiyonel)
      const copyFromId = document.getElementById('bizCopyServicesFrom')?.value;
      if (copyFromId && newBiz) {
        const { data: src } = await supabase.from('services').select('*').eq('business_id', copyFromId);
        if (src && src.length) {
          const clones = src.map(s => {
            const { id: _id, created_at, updated_at, ...rest } = s;
            return { ...rest, business_id: newBiz.id, owner_id: currentSession.user.id };
          });
          const { error: cErr } = await supabase.from('services').insert(clones);
          if (cErr) console.warn('[biz-copy-services]', cErr);
        }
      }
    }

    showToast(t('saved'));
    modal.hidden = true;
    // Refresh
    const { data: list } = await supabase
      .from('businesses').select('*')
      .order('is_default', { ascending: false })
      .order('business_name', { ascending: true });
    myBusinesses = list || [];
    renderBizSwitcher();
    renderBusinessesSection();
  });
}

async function deleteBusiness(id) {
  const biz = myBusinesses.find(b => b.id === id);
  if (!biz) return;
  if (!confirm(`"${biz.business_name}" wirklich löschen? Alle zugehörigen Daten (Termine, Dienstleistungen, Rechnungen) werden ebenfalls gelöscht.`)) return;
  const { error } = await supabase.from('businesses').delete().eq('id', id);
  if (error) { console.error('[biz-delete]', error); showToast(t('err_generic'), 'error'); return; }
  showToast('Gelöscht ✓');
  // Eğer aktif business silindiyse default'a dön
  if (currentBusiness?.id === id) {
    try { localStorage.removeItem(BIZ_STORAGE_KEY); } catch {}
    location.reload();
    return;
  }
  myBusinesses = myBusinesses.filter(b => b.id !== id);
  renderBizSwitcher();
  renderBusinessesSection();
}

function renderBizSwitcher() {
  const currentEl = document.getElementById('bizSwitcherCurrent');
  const menuEl = document.getElementById('bizSwitcherMenu');
  if (!currentEl || !menuEl) return;

  currentEl.textContent = currentBusiness?.business_name || '—';

  let html = '';
  myBusinesses.forEach(b => {
    const isActive = b.id === currentBusiness?.id;
    const meta = b.is_default ? '<span class="biz-switcher-item-meta">Standard</span>' : '';
    html += `<button type="button" class="biz-switcher-item" role="option" aria-selected="${isActive}" data-id="${b.id}">
      <span>${escapeHtml(b.business_name)}</span>${meta}
    </button>`;
  });

  if (isEnterprise() && currentProfile?.role === 'owner') {
    html += '<div class="biz-switcher-divider"></div>';
    html += '<button type="button" class="biz-switcher-add" id="bizSwitcherAdd">＋ Neues Geschäft hinzufügen</button>';
  }

  menuEl.innerHTML = html;
}

function wireBizSwitcherEvents() {
  const btn = document.getElementById('bizSwitcherBtn');
  const menu = document.getElementById('bizSwitcherMenu');
  if (!btn || !menu || btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !menu.hidden;
    menu.hidden = open;
    btn.setAttribute('aria-expanded', String(!open));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#bizSwitcher')) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  menu.addEventListener('click', async (e) => {
    const item = e.target.closest('.biz-switcher-item');
    if (item) {
      const id = item.dataset.id;
      if (id && id !== currentBusiness?.id) await switchBusiness(id);
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      return;
    }
    if (e.target.closest('#bizSwitcherAdd')) {
      // TODO Faz 1.3: Settings > İşletmeler > Yeni ekle modal'ı
      alert('Neues Geschäft hinzufügen — in Kürze verfügbar (Settings → Geschäfte).');
    }
  });
}

async function switchBusiness(businessId) {
  const biz = myBusinesses.find(b => b.id === businessId);
  if (!biz) return;
  currentBusiness = biz;
  try { localStorage.setItem(BIZ_STORAGE_KEY, businessId); } catch {}
  try {
    await supabase.from('user_preferences').upsert({
      user_id: currentSession.user.id,
      preference_key: BIZ_PREF_KEY,
      preference_value: businessId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,preference_key' });
  } catch (e) { console.warn('[switchBusiness] pref upsert failed', e); }
  // Sayfa yenilenmeden refresh: tüm panelleri yeniden çiz
  location.reload();
}

function getActiveBusinessId() {
  return currentBusiness?.id || null;
}

// Apply the active-business filter to a query UNLESS this category is shared across Standorte.
//   dataSharing[cat] === true  -> shared (owner-wide, no business filter)
//   dataSharing[cat] === false -> separate (only the active business)
// Single-business owners (no currentBusiness) are never filtered.
function bizScope(query, cat) {
  if (dataSharing[cat]) return query;
  if (!currentBusiness?.id) return query;
  return query.eq('business_id', currentBusiness.id);
}

// Load the owner's cross-business sharing policy. Absent row keeps the defaults (all separate).
async function loadDataSharing() {
  try {
    const { data } = await supabase
      .from('data_sharing_settings')
      .select('patients,services,activities,finance,network')
      .eq('owner_id', getOwnerId())
      .maybeSingle();
    if (data) {
      dataSharing = {
        patients: !!data.patients,
        services: !!data.services,
        activities: !!data.activities,
        finance: !!data.finance,
        network: !!data.network
      };
    }
  } catch (e) {
    console.warn('[loadDataSharing] falling back to defaults (all separate)', e);
  }
}

async function init() {
  try {
    console.log('[init] start');
    await ensureCompanyCode();
    console.log('[init] companyCode ok');
    await ensureBookingSlug();
    console.log('[init] bookingSlug ok');
    applyI18n();
    console.log('[init] i18n ok');
    await loadDataSharing();
    console.log('[init] dataSharing ok');
    await bootBusinessSwitcher();
    console.log('[init] bizSwitcher ok');
    await renderSidebar();
    console.log('[init] sidebar ok');
    await loadTeam();
    console.log('[init] team ok');
    await renderOverview();
    console.log('[init] overview ok');
    try { await renderGaps(); console.log('[init] gaps ok'); } catch (e) { console.error('[init] renderGaps error', e); }
    try { await renderGapsForDate(scheduleDate); console.log('[init] gapsForDate ok'); } catch (e) { console.error('[init] renderGapsForDate error', e); }
    setupScheduleNav();
    await bootScheduleViewToggle();
    await initCalendar();
    console.log('[init] calendar ok');

    // Realtime subscription for bookings — refreshes calendar when a booking is created from booking.html
    const ownerId = getOwnerId();
    const bkChannel = supabase.channel('bookings-realtime');
    bkChannel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `owner_id=eq.${ownerId}`
      }, async (payload) => {
        console.log('[realtime] new booking detected:', payload.new?.id);
        await refreshBookingViews();
      })
      .subscribe();

    await handleGmailCallback();
    console.log('[init] gmail ok');
    bindInvEvents();
    console.log('[init] invoices ok');
    bindAnamneseEvents();
    console.log('[init] anamnese ok');
    document.getElementById('aeAddBtn')?.addEventListener('click', addAerzte);
    document.getElementById('rzSaveBtn')?.addEventListener('click', saveRezept);
    document.getElementById('anamRezeptBtn')?.addEventListener('click', () => {
      const sel = document.getElementById('anamPatientSelect');
      if (!sel || !sel.value) { showToast('Bitte zuerst einen Patienten auswählen.', 'error'); return; }
      openRezeptModal(null, sel.value);
    });
    const rxcArztName = document.getElementById('rxcArztName');
    if (rxcArztName) {
      rxcArztName.addEventListener('input', () => {
        const val = rxcArztName.value.trim();
        const matched = aerzteCache.find(a => a.arzt_name === val);
        if (matched && matched.arzt_nummer) {
          const lanr = document.getElementById('rxcLanr');
          const bsnr = document.getElementById('rxcBsnr');
          if (lanr && !lanr.value.trim()) lanr.value = matched.arzt_nummer;
          if (bsnr && !bsnr.value.trim()) bsnr.value = matched.arzt_nummer;
        }
      });
    }
    await loadAerzte();
    const adminLink = document.getElementById('topbarAdminLink');
    if (adminLink && currentSession?.user?.id) {
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', currentSession.user.id)
        .maybeSingle();
      if (adminRow) {
        adminLink.style.display = '';
        adminLink.href = 'https://admin.infinitymade.de/';
      }
    }
    initRezeptScanner();
    initBeleglisteUI();
  } catch (e) {
    console.error('[dashboard init]', e);
  } finally {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = '';
    startClock();
  }
}

// ===== Phase 2: rxPreset → booking modal + AI series scheduler =====
// After rezept/confirm we land on the calendar panel; this opens the
// booking modal pre-filled with patient + service + series settings,
// then auto-triggers the existing AI suggest flow.

function parseFrequenzWoche(freq) {
  // "2x pro Woche" / "2 x / Woche" / "2x wöchentlich" → 2
  if (!freq) return null;
  const rangeMatch = freq.match(/(\d+)\s*[-–]\s*(\d+)\s*x?/i);
  if (rangeMatch && rangeMatch[2]) {
    return parseInt(rangeMatch[2], 10);
  }
  const m = freq.match(/(\d+)\s*x?\s*(?:pro|\/)?\s*Woche|w[öo]ch/i);
  if (m && m[1]) return parseInt(m[1], 10);
  const n = freq.match(/^\s*(\d+)/);
  return n ? parseInt(n[1], 10) : null;
}

function matchServiceForHeilmittel(heilmittelText, positionCode) {
  if (!Array.isArray(ownerServices)) return null;

  const hm = (heilmittelText || '').trim().toUpperCase();
  const pc = (positionCode || '').trim().toUpperCase();

  // Helper to normalize position code or service code (e.g., 20507 -> X0507)
  const normalizePositionCode = (code) => {
    if (!code) return '';
    let c = String(code).trim().toUpperCase();
    if (c.length === 5 && /^\d/.test(c)) {
      c = 'X' + c.slice(1);
    }
    return c;
  };

  // 1. Match by position template or code (e.g. "X0507" or "20507") against the service code (s.code)
  const normPC = normalizePositionCode(pc);
  if (normPC) {
    const hit = ownerServices.find(s => {
      const normSC = normalizePositionCode(s.code);
      return normSC && normSC === normPC;
    });
    if (hit) return hit;
  }

  if (hm) {
    // 2. Match by exact remedy name (hm) against service code
    let hit = ownerServices.find(s => (s.code || '').trim().toUpperCase() === hm);
    if (hit) return hit;

    // 3. Match by bidirectional title substring (title.includes(hm) || hm.includes(title))
    hit = ownerServices.find(s => {
      const title = (s.title || '').trim().toUpperCase();
      if (!title) return false;
      return title.includes(hm) || hm.includes(title);
    });
    if (hit) return hit;

    // 4. Match by advanced synonym / clinical alias groups
    const hmLower = hm.toLowerCase();

    // 4.1. KG am Gerät / Kräftigungstraining
    if (hmLower.includes('gerä') || hmLower.includes('geraet') || hmLower.includes('kgg') || hmLower.includes('kraft') || hmLower.includes('kräft')) {
      const aliasHit = ownerServices.find(s => {
        const t = (s.title || '').toLowerCase();
        return t.includes('gerä') || t.includes('geraet') || t.includes('kraft') || t.includes('kräft') || t.includes('training');
      });
      if (aliasHit) return aliasHit;
    }

    // 4.2. Manuelle Therapie
    if (hmLower.includes('manuelle') || hmLower.includes('mt')) {
      const aliasHit = ownerServices.find(s => {
        const t = (s.title || '').toLowerCase();
        return t.includes('manuelle') || t.includes('mt');
      });
      if (aliasHit) return aliasHit;
    }

    // 4.3. Lymphdrainage
    if (hmLower.includes('lymph') || hmLower.includes('mld')) {
      const aliasHit = ownerServices.find(s => {
        const t = (s.title || '').toLowerCase();
        return t.includes('lymph') || t.includes('mld');
      });
      if (aliasHit) return aliasHit;
    }

    // 4.4. Massage / KMT / Bindegewebe
    if (hmLower.includes('massage') || hmLower.includes('kmt') || hmLower.includes('klassische massage') || hmLower.includes('bindegewebe') || hmLower.includes('bgm')) {
      const aliasHit = ownerServices.find(s => {
        const t = (s.title || '').toLowerCase();
        return t.includes('massage') || t.includes('kmt') || t.includes('bindegewebe');
      });
      if (aliasHit) return aliasHit;
    }

    // 4.5. Elektrotherapie
    if (hmLower.includes('elektro')) {
      const aliasHit = ownerServices.find(s => {
        const t = (s.title || '').toLowerCase();
        return t.includes('elektro');
      });
      if (aliasHit) return aliasHit;
    }

    // 4.6. Ultraschall
    if (hmLower.includes('ultraschall') || hmLower.includes('us')) {
      const aliasHit = ownerServices.find(s => {
        const t = (s.title || '').toLowerCase();
        return t.includes('ultraschall') || t.includes('us');
      });
      if (aliasHit) return aliasHit;
    }

    // 4.7. General Krankengymnastik / Physiotherapie (KG / PT)
    if (hmLower.includes('krankengymnastik') || hmLower.includes('kg') || hmLower.includes('physio') || hmLower.includes('pt')) {
      const aliasHit = ownerServices.find(s => {
        const t = (s.title || '').toLowerCase();
        return t.includes('krankengymnastik') || t.includes('physio') || t.includes('pt') || t.includes('kg');
      });
      if (aliasHit) return aliasHit;
    }
  }

  return null;
}

async function openBookingFromRxPreset(preset) {
  try {
    if (typeof prefillBookingModal === 'function') {
      await prefillBookingModal(null);
    } else {
      openModal('bookingModal');
    }

    // Patient — fill all three fields directly. bkSelectLead alone is fragile
    // because the leads cache may not yet contain the just-created patient.
    if (preset.patient_id) {
      const displayName = preset.patient_name || '';
      const searchEl = document.getElementById('bkCustomerSearch');
      const nameH = document.getElementById('bkCustomer');
      const idH = document.getElementById('bkCustomerId');
      if (searchEl) searchEl.value = displayName;
      if (nameH) nameH.value = displayName;
      if (idH) idH.value = preset.patient_id;
      // Hide the suggestion dropdown if it's open
      const list = document.getElementById('bkCustomerList');
      if (list) list.hidden = true;
      // Best-effort: refresh leads cache so subsequent edits see the new patient
      if (typeof window.bkSelectLead === 'function') {
        setTimeout(() => {
          try { window.bkSelectLead(preset.patient_id); } catch { }
        }, 150);
      }
    }
    if (preset.hausbesuch) document.getElementById('bkHausbesuch').checked = true;

    // Service mapping
    const srv = matchServiceForHeilmittel(preset.heilmittel, preset.heilmittel_position);
    if (srv) {
      // Automatically query Supabase's employee_services table for that service
      const { data: assignments } = await supabase
        .from('employee_services')
        .select('employee_id')
        .eq('service_id', srv.id);

      const assignedEmpIds = (assignments || []).map(a => a.employee_id);
      const eligibleEmps = teamMembers.filter(m => assignedEmpIds.includes(m.id));
      const finalEmps = eligibleEmps.length > 0 ? eligibleEmps : teamMembers;

      let selectedEmp = null;
      if (finalEmps.length > 0) {
        if (finalEmps.length === 1) {
          selectedEmp = finalEmps[0];
          showToast(`Therapeut "${selectedEmp.business_name || selectedEmp.email?.split('@')[0] || ''}" wurde automatisch ausgewählt.`, 'success');
        } else {
          const randIndex = Math.floor(Math.random() * finalEmps.length);
          selectedEmp = finalEmps[randIndex];
          showToast(`Therapeut "${selectedEmp.business_name || selectedEmp.email?.split('@')[0] || ''}" wurde zufällig zugewiesen.`, 'info');
        }
      }

      // Assign employee ID to bkEmployee (set value directly to prevent race condition)
      const empSel = document.getElementById('bkEmployee');
      if (empSel && selectedEmp) {
        empSel.value = selectedEmp.id;
      }

      // Re-populate service dropdown with our target service selected (ensures it is in list and not filtered out)
      await populateSrvSelect(srv.id, selectedEmp ? selectedEmp.id : null);

      // Assign service ID to bkService and dispatch 'change' event
      const srvSel = document.getElementById('bkService');
      if (srvSel) {
        srvSel.value = srv.id;
        srvSel.dispatchEvent(new Event('change'));
      }
    } else if (preset.heilmittel) {
      showToast(`Keine Dienstleistung für "${preset.heilmittel}" gefunden — bitte manuell auswählen.`, 'info');
    }

    // Series
    if (preset.anzahl && preset.anzahl > 1) {
      const toggle = document.getElementById('bkSeriesToggle');
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      const fields = document.getElementById('bkSeriesFields');
      if (fields) fields.hidden = false;
      document.getElementById('bkSeriesCount').value = preset.anzahl;
      const perWeek = parseFrequenzWoche(preset.frequenz);
      const recSel = document.getElementById('bkSeriesRecurrence');
      if (recSel) recSel.value = 'weekly';
      // Hint via toast — user picks specific weekdays in AI prefs
      if (perWeek) showToast(`Serie: ${preset.anzahl} × · ${perWeek}× pro Woche — bitte Wochentage wählen.`, 'info');
    }

    // Start = next Monday 09:00 by default (user can change)
    const today = new Date();
    const dow = today.getDay();
    const daysToMon = (8 - dow) % 7 || 7;
    const start = new Date(today.getTime() + daysToMon * 86400000);
    const iso = start.toISOString().slice(0, 10) + 'T09:00';
    document.getElementById('bkStart').value = iso;

    // Auto-trigger AI suggest if we have employee + service + customer
    setTimeout(() => {
      const empId = document.getElementById('bkEmployee').value;
      const srvId = document.getElementById('bkService').value;
      const custId = document.getElementById('bkCustomerId').value.trim();
      if (empId && srvId && custId) {
        document.getElementById('bkAiSuggestBtn')?.click();
      } else {
        showToast('Bitte Mitarbeiter & ggf. Dienstleistung wählen, dann „KI-Vorschlag" klicken.', 'info');
      }
    }, 600);
  } catch (e) {
    console.error('[openBookingFromRxPreset]', e);
    showToast('Konnte Buchungs-Maske nicht öffnen: ' + e.message, 'error');
  }
}

// ===== Phase 2: AI-driven Rezept Scanner =====
// Webcam/file capture → /api/rezept/upload (Azure OCR + validators)
// → confirmation modal → /api/rezept/confirm → redirect to Termine.

const REZEPT_API = 'https://n8n.infinitymade.de/api/rezept';
let rxStream = null;
let rxLastUpload = null;  // { storage_path, parsed, validation, ocr_confidence, dataUri }

function initRezeptScanner() {
  const btn = document.getElementById('rezeptScanBtn');
  if (!btn) return;
  if (getSector() === 'physiotherapy') btn.style.display = '';

  btn.addEventListener('click', openRezeptScanModal);

  document.getElementById('rxScanWebcamBtn')?.addEventListener('click', startWebcamCapture);
  document.getElementById('rxScanFileBtn')?.addEventListener('click', () =>
    document.getElementById('rxScanFileInput').click());
  document.getElementById('rxScanFileInput')?.addEventListener('change', onFileChosen);
  document.getElementById('rxScanShotBtn')?.addEventListener('click', captureWebcamShot);
  document.getElementById('rxScanCancelCamBtn')?.addEventListener('click', stopWebcam);
  document.getElementById('rxConfirmBtn')?.addEventListener('click', submitConfirm);
  document.getElementById('rxInformPatientBtn')?.addEventListener('click', () =>
    showToast('Patient wird informiert (Demo) — Phase 3 verbindet das automatisch.', 'info'));
  document.getElementById('rxDoctorEmailBtn')?.addEventListener('click', () =>
    showToast('Arzt-E-Mail kommt in Phase 3.', 'info'));

  document.querySelectorAll('[data-modal="rezeptScanModal"]').forEach(el => {
    el.addEventListener('click', () => { stopWebcam(); closeRezeptScanModal(); });
  });
}

function openRezeptScanModal() {
  document.getElementById('rxScanError').style.display = 'none';
  document.getElementById('rxScanChooser').style.display = '';
  document.getElementById('rxScanCamera').style.display = 'none';
  document.getElementById('rxScanProcessing').style.display = 'none';
  document.getElementById('rezeptScanModal').hidden = false;
}
function closeRezeptScanModal() {
  document.getElementById('rezeptScanModal').hidden = true;
}

async function startWebcamCapture() {
  try {
    rxStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } }
    });
    const video = document.getElementById('rxScanVideo');
    video.srcObject = rxStream;
    document.getElementById('rxScanChooser').style.display = 'none';
    document.getElementById('rxScanCamera').style.display = '';
  } catch (e) {
    document.getElementById('rxScanError').textContent = 'Kamera nicht verfügbar: ' + e.message;
    document.getElementById('rxScanError').style.display = '';
  }
}
function stopWebcam() {
  if (rxStream) {
    rxStream.getTracks().forEach(t => t.stop());
    rxStream = null;
  }
  document.getElementById('rxScanCamera').style.display = 'none';
  document.getElementById('rxScanChooser').style.display = '';
}

function captureWebcamShot() {
  const video = document.getElementById('rxScanVideo');
  const canvas = document.getElementById('rxScanCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUri = canvas.toDataURL('image/jpeg', 0.85);
  stopWebcam();
  uploadRezeptImage(dataUri);
}

function onFileChosen(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => uploadRezeptImage(ev.target.result);
  reader.readAsDataURL(f);
  e.target.value = '';
}

async function uploadRezeptImage(dataUri) {
  document.getElementById('rxScanChooser').style.display = 'none';
  document.getElementById('rxScanCamera').style.display = 'none';
  document.getElementById('rxScanProcessing').style.display = '';
  document.getElementById('rxScanError').style.display = 'none';
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) throw new Error('Nicht angemeldet');
    const mimeMatch = dataUri.match(/^data:([^;]+);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const res = await fetch(`${REZEPT_API}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.access_token },
      body: JSON.stringify({ image_base64: dataUri, image_mime: mime })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Upload fehlgeschlagen');
    rxLastUpload = { ...json, dataUri };
    closeRezeptScanModal();
    openRezeptConfirmModal(rxLastUpload);
  } catch (e) {
    document.getElementById('rxScanProcessing').style.display = 'none';
    document.getElementById('rxScanChooser').style.display = '';
    document.getElementById('rxScanError').textContent = 'Fehler: ' + e.message;
    document.getElementById('rxScanError').style.display = '';
  }
}

async function openRezeptConfirmModal(payload) {
  if (!aerzteCache || aerzteCache.length === 0) {
    await loadAerzte();
  }
  const p = payload.parsed || {};
  const pat = p.patient || {};
  const arzt = p.arzt || {};
  const rez = p.rezept || {};

  document.getElementById('rxConfirmImg').src = payload.dataUri;
  const confEl = document.getElementById('rxOcrConfidence');
  confEl.textContent = payload.ocr_confidence != null
    ? `OCR-Vertrauen: ${Math.round(payload.ocr_confidence * 100)}%${payload.dry_run ? ' (DRY-RUN)' : ''}`
    : '';

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

  setVal('rxcFirstName', pat.first_name);
  setVal('rxcLastName', pat.last_name);
  setVal('rxcDob', pat.geburtsdatum);
  setVal('rxcVersNr', pat.versichertennummer);
  // Krankenkasse is set up by setupRezeptConfirmDropdowns below — skip plain setVal.
  setVal('rxcEmail', pat.email);
  setVal('rxcPhone', pat.phone);
  // Fahrtenbuch: OCR adresse'i strukturlu alanlara parse et
  const adresseParsed = parseAdresseString(pat.adresse);
  setVal('rxcStreet', adresseParsed.street);
  setVal('rxcPlz', adresseParsed.plz);
  setVal('rxcCity', adresseParsed.city);
  // Hausbesuch işaretliyse adres required göstergesi
  const setReq = (checked) => {
    document.getElementById('rxcStreetReq').hidden = !checked;
    document.getElementById('rxcPlzReq').hidden = !checked;
    document.getElementById('rxcCityReq').hidden = !checked;
  };
  setReq(!!rez.hausbesuch);
  document.getElementById('rxcHausbesuch')?.addEventListener('change', e => setReq(e.target.checked), { once: false });
  setVal('rxcArztName', arzt.name);
  setVal('rxcAusstDate', arzt.ausstellungsdatum);
  setVal('rxcLanr', arzt.lanr);
  setVal('rxcBsnr', arzt.bsnr);
  setVal('rxcIcd', rez.icd10);
  setVal('rxcDg', rez.diagnosegruppe);
  setVal('rxcLeitsymptomatik', rez.leitsymptomatik);
  // Heilmittel — handled by setupRezeptConfirmDropdowns
  // (we still pass the raw OCR text below)
  setVal('rxcAnzahl', rez.anzahl_einheiten);
  setVal('rxcFreq', rez.frequenz);
  setChk('rxcDringend', rez.is_dringend);
  setChk('rxcHausbesuch', rez.hausbesuch);
  setChk('rxcBlanko', rez.is_blanko);
  setChk('rxcLhbBvb', rez.is_lhb_bvb);
  setChk('rxcBerichtAngefordert', rez.bericht_angefordert);
  setVal('rxcBerichtStatus', rez.bericht_status || 'offen');

  renderValidationBanner(payload.validation);

  // Sprint 8+: populate KK + Heilmittel datalists and run AI fuzzy match on OCR text.
  setupRezeptConfirmDropdowns(pat.krankenkasse, rez.heilmittel);

  document.getElementById('rezeptConfirmModal').hidden = false;
}

function renderValidationBanner(v) {
  const el = document.getElementById('rxValidationBanner');
  if (!v) { el.innerHTML = ''; return; }
  const warnings = v.warnings || [];
  const blockers = v.blockers || [];
  const hinweise = v.hinweise || [];

  let html = '';
  if (blockers.length) {
    html += `<div style="background:#fee;border:1px solid #c00;border-radius:8px;padding:10px;margin-bottom:8px;">
      <strong style="color:#c00;">🔴 Blocker (${blockers.length}):</strong>
      <ul style="margin:6px 0 0 18px;color:#900;">${blockers.map(b => `<li>${b.message || b.code || b}</li>`).join('')}</ul>
    </div>`;
  }
  if (warnings.length) {
    html += `<div style="background:#fff7e6;border:1px solid #f0a500;border-radius:8px;padding:10px;margin-bottom:8px;">
      <strong style="color:#a06200;display:inline-flex;align-items:center;"><span class="svg-icon" style="width:14px;height:14px;display:inline-flex;vertical-align:-2px;margin-right:4px;color:#a06200;">${ICON.warning}</span>Warnungen (${warnings.length}):</strong>
      <ul style="margin:6px 0 0 18px;color:#6b4500;">${warnings.map(w => `<li>${w.message || w.code || w}</li>`).join('')}</ul>
    </div>`;
  }
  if (hinweise.length) {
    html += `<div style="background:#eef6ff;border:1px solid #2a73d3;border-radius:8px;padding:10px;margin-bottom:8px;">
      <strong style="color:#1c4d8f;display:inline-flex;align-items:center;"><span class="svg-icon" style="width:14px;height:14px;display:inline-flex;vertical-align:-2px;margin-right:4px;color:#1c4d8f;">${ICON.info}</span>Hinweise:</strong>
      <ul style="margin:6px 0 0 18px;color:#1c4d8f;">${hinweise.map(h => `<li>${h.message || h.code || h}</li>`).join('')}</ul>
    </div>`;
  }
  if (!html) {
    html = `<div style="background:#eaf8ee;border:1px solid #2a8c4a;border-radius:8px;padding:10px;color:#1f6b38;display:inline-flex;align-items:center;gap:4px;width:100%;">
      <span class="svg-icon" style="width:14px;height:14px;display:inline-flex;vertical-align:-2px;color:#1f6b38;">${ICON.checkCircle}</span>Verordnung ist regelkonform.
    </div>`;
  }
  el.innerHTML = html;
}

async function submitConfirm() {
  if (!rxLastUpload) return;
  const btn = document.getElementById('rxConfirmBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="svg-icon" style="width:15px;height:15px;display:inline-flex;vertical-align:-2px;margin-right:4px;">${ICON.clock}</span>Speichere…`;
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) throw new Error('Nicht angemeldet');

    const fn = document.getElementById('rxcFirstName').value.trim();
    const ln = document.getElementById('rxcLastName').value.trim();
    // Fahrtenbuch: Hausbesuch işaretliyse adres alanları zorunlu
    const hausbesuchChecked = document.getElementById('rxcHausbesuch').checked;
    const street = document.getElementById('rxcStreet').value.trim();
    const plz = document.getElementById('rxcPlz').value.trim();
    const city = document.getElementById('rxcCity').value.trim();
    if (hausbesuchChecked) {
      const missing = [];
      if (!street) missing.push('Strasse');
      if (!plz) missing.push('PLZ');
      if (!city) missing.push('Stadt');
      if (missing.length) {
        showToast('Hausbesuch erfordert: ' + missing.join(', '), 'error');
        btn.disabled = false;
        btn.innerHTML = `<span class="svg-icon" style="width:15px;height:15px;display:inline-flex;vertical-align:-2px;margin-right:4px;">${ICON.checkCircle}</span>Bestätigen & Termine planen`;
        return;
      }
      if (!/^\d{5}$/.test(plz)) {
        showToast('PLZ muss 5-stellig sein.', 'error');
        btn.disabled = false;
        btn.innerHTML = `<span class="svg-icon" style="width:15px;height:15px;display:inline-flex;vertical-align:-2px;margin-right:4px;">${ICON.checkCircle}</span>Bestätigen & Termine planen`;
        return;
      }
    }

    const parsedEdited = {
      patient: {
        first_name: fn || null,
        last_name: ln || null,
        name: [fn, ln].filter(Boolean).join(' ') || null,
        geburtsdatum: document.getElementById('rxcDob').value || null,
        versichertennummer: document.getElementById('rxcVersNr').value.trim() || null,
        krankenkasse: document.getElementById('rxcKasse').value.trim() || null,
        kostentraeger_ik: document.getElementById('rxcKasseIk').value.trim() || null,
        email: document.getElementById('rxcEmail').value.trim() || null,
        phone: document.getElementById('rxcPhone').value.trim() || null,
        geschlecht: rxLastUpload.parsed?.patient?.geschlecht || null,
        adresse: rxLastUpload.parsed?.patient?.adresse || null,
        // Strukturlu adres alanları (Fahrtenbuch)
        street: street || null,
        plz: plz || null,
        city: city || null
      },
      arzt: {
        name: document.getElementById('rxcArztName').value.trim() || null,
        ausstellungsdatum: document.getElementById('rxcAusstDate').value || null,
        lanr: document.getElementById('rxcLanr').value.trim() || null,
        bsnr: document.getElementById('rxcBsnr').value.trim() || null
      },
      rezept: {
        icd10: document.getElementById('rxcIcd').value.trim() || null,
        diagnosegruppe: document.getElementById('rxcDg').value.trim() || null,
        heilmittel: document.getElementById('rxcHm').value.trim() || null,
        leitsymptomatik: document.getElementById('rxcLeitsymptomatik')?.value.trim() || null,
        heilmittel_position: document.getElementById('rxcHmPosition').value.trim() || null,
        heilmittel_feld_text: rxLastUpload.parsed?.rezept?.heilmittel_feld_text || null,
        anzahl_einheiten: parseInt(document.getElementById('rxcAnzahl').value, 10) || null,
        frequenz: document.getElementById('rxcFreq').value.trim() || null,
        behandlungsbeginn: null,
        is_dringend: document.getElementById('rxcDringend').checked,
        hausbesuch: document.getElementById('rxcHausbesuch').checked,
        is_blanko: document.getElementById('rxcBlanko').checked,
        is_lhb_bvb: document.getElementById('rxcLhbBvb').checked,
        bericht_angefordert: document.getElementById('rxcBerichtAngefordert').checked,
        bericht_status: document.getElementById('rxcBerichtStatus').value
      }
    };

    const blockers = rxLastUpload.validation?.blockers || [];
    let proceedAnyway = false;
    if (blockers.length > 0) {
      const detail = (blockers.slice(0, 5).map(b => '• ' + (b.message || b.code || b)).join('\n'));
      proceedAnyway = await showConfirmModal({
        title: `<span class="svg-icon" style="width:18px;height:18px;display:inline-flex;vertical-align:-4px;margin-right:6px;color:var(--danger);">${ICON.warning}</span>${blockers.length} Blocker erkannt`,
        message: `${detail}\n\nMöchten Sie trotzdem fortfahren? Der Override wird protokolliert.`,
        confirmText: 'Trotzdem fortfahren',
        cancelText: 'Abbrechen',
        variant: 'danger'
      });
      if (!proceedAnyway) {
        btn.disabled = false;
        btn.innerHTML = `<span class="svg-icon" style="width:15px;height:15px;display:inline-flex;vertical-align:-2px;margin-right:4px;">${ICON.checkCircle}</span>Bestätigen & Termine planen`;
        return;
      }
    }

    const res = await fetch(`${REZEPT_API}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.access_token },
      body: JSON.stringify({
        storage_path: rxLastUpload.storage_path,
        parsed: parsedEdited,
        proceed_anyway: proceedAnyway
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Fehler');

    document.getElementById('rezeptConfirmModal').hidden = true;
    showToast('Rezept gespeichert ✓ Weiter zur Terminplanung.', 'success');

    const preset = {
      prescription_id: json.prescription_id,
      patient_id: json.patient_id,
      anzahl: parsedEdited.rezept.anzahl_einheiten,
      frequenz: parsedEdited.rezept.frequenz,
      heilmittel: parsedEdited.rezept.heilmittel,
      heilmittel_position: parsedEdited.rezept.heilmittel_position,
      hausbesuch: parsedEdited.rezept.hausbesuch,
      is_dringend: parsedEdited.rezept.is_dringend,
      is_blanko: parsedEdited.rezept.is_blanko,
      patient_name: [parsedEdited.patient.first_name, parsedEdited.patient.last_name].filter(Boolean).join(' ')
    };
    window._physioFlow = preset;
    sessionStorage.setItem('rxPreset', JSON.stringify(preset));

    if (typeof showPanel === 'function') showPanel('calendar');
    setTimeout(() => openBookingFromRxPreset(preset), 400);
  } catch (e) {
    console.error('[rezept-confirm]', e);
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="svg-icon" style="width:15px;height:15px;display:inline-flex;vertical-align:-2px;margin-right:4px;">${ICON.checkCircle}</span>Bestätigen & Termine planen`;
  }
}

// ===== § 302 SGB V Kassenabrechnung =====

const _abState = { ready: [], kkMap: new Map(), busy: false, positions: [], positionsLoaded: false };

// ---------- Sprint 8+ : Krankenkasse + Heilmittel datalist + AI auto-match ----------

let _kkListCache = null;

async function loadKkList() {
  if (_kkListCache) return _kkListCache;
  const { data, error } = await supabase
    .from('kostentraeger')
    .select('ik, name')
    .order('name');
  if (error) { console.warn('[kkList]', error); return []; }
  _kkListCache = data || [];
  return _kkListCache;
}

// Normalize for fuzzy compare: lowercase, strip diacritics, punctuation, runs of whitespace.
function _norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Score how close needle matches haystack (0 = no overlap, 1 = exact). Token Jaccard + prefix bonus.
function _matchScore(needle, haystack) {
  const a = _norm(needle), b = _norm(haystack);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.startsWith(a) || a.startsWith(b)) return 0.95;
  if (b.includes(a) || a.includes(b)) return 0.85;
  const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
  let common = 0;
  ta.forEach(t => { if (tb.has(t)) common++; });
  const union = ta.size + tb.size - common;
  return union ? common / union : 0;
}

function aiMatchKK(text, kkList) {
  if (!text) return null;
  let best = null, bestScore = 0;
  for (const k of kkList) {
    const s = _matchScore(text, k.name);
    if (s > bestScore) { bestScore = s; best = k; }
  }
  // Accept anything 0.6+ — covers "AOK Rheinland" → "AOK Rheinland/Hamburg" (0.85+)
  return bestScore >= 0.6 ? { ...best, score: bestScore } : null;
}

function aiMatchHeilmittel(text, positions) {
  if (!text) return null;
  const t = _norm(text);
  // Try exact short-code match first (KG, MT, MLD, etc. → first token of label)
  // and also X-template match (X0501 / 20501).
  if (/^x\d{4}$/i.test(text.trim())) {
    const exact = positions.find(p => p.x.toLowerCase() === text.trim().toLowerCase());
    if (exact) return { ...exact, score: 1 };
  }
  if (/^\d{5}$/.test(text.trim())) {
    const x = 'X' + text.trim().slice(1);
    const exact = positions.find(p => p.x === x);
    if (exact) return { ...exact, score: 1 };
  }
  // Short-code → first letters of label (KG ~ "Allgemeine Krankengymnastik")
  // Use a small alias table for accuracy.
  const aliases = {
    kg: 'X0501',
    'kg einzel': 'X0501',
    krankengymnastik: 'X0501',
    mt: 'X1201',
    'manuelle therapie': 'X1201',
    mld: 'X0205',
    'mld 30': 'X0205',
    'mld 45': 'X0201',
    'mld 60': 'X0202',
    'manuelle lymphdrainage': 'X0205',
    kmt: 'X0106',
    'klassische massage': 'X0106',
    massage: 'X0106',
    bgm: 'X0107',
    traktion: 'X1104',
    'kg geraet': 'X0507',
    'kg-geraet': 'X0507',
    'krankengymnastik am gerat': 'X0507',
    'krankengymnastik am gerat kg g': 'X0507',
    'krankengymnastik am gerat kg gerat': 'X0507',
    'kg zns': 'X0710',
    'kg-muko': 'X0702',
  };
  if (aliases[t]) {
    const found = positions.find(p => p.x === aliases[t]);
    if (found) return { ...found, score: 0.95 };
  }
  // Fallback: score against label
  let best = null, bestScore = 0;
  for (const p of positions) {
    const s = _matchScore(text, p.label + ' ' + p.x);
    if (s > bestScore) { bestScore = s; best = p; }
  }
  return bestScore >= 0.55 ? { ...best, score: bestScore } : null;
}

function populateKkDatalist(kkList) {
  const dl = document.getElementById('kkDatalist');
  if (!dl) return;
  dl.innerHTML = kkList.map(k =>
    `<option data-ik="${k.ik}" value="${escapeHtml(k.name)}">IK ${k.ik}</option>`
  ).join('');
}

function populateHmDatalist(positions) {
  const dl = document.getElementById('hmDatalist');
  if (!dl) return;
  // Show short labels with X-code so user can type either
  dl.innerHTML = positions.map(p =>
    `<option value="${escapeHtml(p.x + ' · ' + p.label)}"></option>`
  ).join('');
}

async function setupRezeptConfirmDropdowns(ocrKkText, ocrHmText) {
  const [kkList, positions] = await Promise.all([loadKkList(), loadPhysioPositions()]);
  populateKkDatalist(kkList);
  populateHmDatalist(positions);

  const kkInput = document.getElementById('rxcKasse');
  const kkIkInput = document.getElementById('rxcKasseIk');
  const kkStatus = document.getElementById('rxcKasseStatus');

  // Auto-match Krankenkasse from OCR
  const kkMatch = aiMatchKK(ocrKkText, kkList);
  if (kkMatch) {
    kkInput.value = kkMatch.name;
    kkIkInput.value = kkMatch.ik;
    if (kkStatus) kkStatus.textContent = ` ✓ erkannt (${Math.round(kkMatch.score * 100)}%) · IK ${kkMatch.ik}`;
  } else if (ocrKkText) {
    kkInput.value = ocrKkText;
    if (kkStatus) { kkStatus.textContent = ' ⚠ nicht erkannt — bitte auswählen'; kkStatus.style.color = '#b45309'; }
  } else {
    if (kkStatus) kkStatus.textContent = '';
  }

  // Re-resolve IK whenever user changes the input
  kkInput.oninput = () => {
    const m = aiMatchKK(kkInput.value, kkList);
    if (m && _norm(m.name) === _norm(kkInput.value)) {
      kkIkInput.value = m.ik;
      if (kkStatus) { kkStatus.style.color = '#15803d'; kkStatus.textContent = ` ✓ IK ${m.ik}`; }
    } else {
      kkIkInput.value = '';
      if (kkStatus) { kkStatus.style.color = '#b45309'; kkStatus.textContent = ' ⚠ keine IK zugeordnet'; }
    }
  };

  // Heilmittel
  const hmInput = document.getElementById('rxcHm');
  const hmPosInput = document.getElementById('rxcHmPosition');
  const hmStatus = document.getElementById('rxcHmStatus');

  const hmMatch = aiMatchHeilmittel(ocrHmText, positions);
  if (hmMatch) {
    // Keep short-form text the OCR gave (KG) — user familiarity; store position separately.
    hmInput.value = ocrHmText || hmMatch.label;
    hmPosInput.value = hmMatch.x;
    if (hmStatus) hmStatus.textContent = ` ✓ ${hmMatch.x} (${Math.round(hmMatch.score * 100)}%)`;
  } else if (ocrHmText) {
    hmInput.value = ocrHmText;
    if (hmStatus) { hmStatus.style.color = '#b45309'; hmStatus.textContent = ' ⚠ nicht erkannt — Position wählen'; }
  }

  hmInput.oninput = () => {
    const m = aiMatchHeilmittel(hmInput.value, positions);
    if (m) {
      hmPosInput.value = m.x;
      if (hmStatus) { hmStatus.style.color = '#15803d'; hmStatus.textContent = ` ✓ ${m.x}`; }
    } else {
      hmPosInput.value = '';
      if (hmStatus) { hmStatus.style.color = '#b45309'; hmStatus.textContent = ' ⚠ keine Position zugeordnet'; }
    }
  };
}

// Lazy-load PHYSIO_POSITIONS from backend on first Abrechnung page open.
async function loadPhysioPositions() {
  if (_abState.positionsLoaded) return _abState.positions;
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) throw new Error('Nicht angemeldet');
    const res = await fetch(`${API}/billing/positions`, {
      headers: { 'Authorization': 'Bearer ' + s.access_token },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));
    _abState.positions = json.positions || [];
    _abState.positionsLoaded = true;
  } catch (e) {
    console.warn('[positions/load]', e);
    _abState.positions = [];
  }
  return _abState.positions;
}

function buildPositionOptionsHtml(currentValue) {
  // Group by kat (category). Current value is either an X-template or a 5-digit resolved code.
  const positions = _abState.positions || [];
  const normalizedCurrent = (() => {
    if (!currentValue) return '';
    if (/^X\d{4}$/.test(currentValue)) return currentValue;
    if (/^\d{5}$/.test(currentValue)) return 'X' + currentValue.slice(1);
    return currentValue;
  })();

  const byKat = new Map();
  for (const p of positions) {
    if (!byKat.has(p.kat)) byKat.set(p.kat, []);
    byKat.get(p.kat).push(p);
  }

  let html = `<option value="" ${normalizedCurrent ? '' : 'selected'}>— Position wählen —</option>`;
  const knownMatch = positions.some(p => p.x === normalizedCurrent);
  if (normalizedCurrent && !knownMatch) {
    html += `<option value="${escapeHtml(normalizedCurrent)}" selected disabled>⚠ Unbekannt: ${escapeHtml(normalizedCurrent)}</option>`;
  }
  for (const [kat, items] of byKat) {
    html += `<optgroup label="${escapeHtml(kat)}">`;
    for (const p of items) {
      const sel = p.x === normalizedCurrent ? 'selected' : '';
      const priceTag = p.preis != null ? ` — ${p.preis.toFixed(2)} €` : '';
      const flagTag = [p.gruppe ? 'Gruppe' : '', p.telemed ? 'telemed' : ''].filter(Boolean).join(', ');
      const flag = flagTag ? ` (${flagTag})` : '';
      html += `<option value="${escapeHtml(p.x)}" ${sel}>${escapeHtml(p.x)} · ${escapeHtml(p.label)}${flag}${priceTag}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

async function savePositionOverride(prescriptionId, newPosition, selectEl) {
  if (!selectEl) return;
  const prev = selectEl.dataset.prev || '';
  selectEl.disabled = true;
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) throw new Error('Nicht angemeldet');
    const res = await fetch(`${API}/billing/prescription/${prescriptionId}/position`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.access_token,
      },
      body: JSON.stringify({ position: newPosition }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));

    // Update local state so re-render keeps the new value.
    const rx = _abState.ready.find(r => r.id === prescriptionId);
    if (rx) rx.heilmittel_position = json.heilmittel_position;
    selectEl.dataset.prev = newPosition;
    showToast('Position aktualisiert: ' + (json.label || newPosition));
  } catch (e) {
    console.error('[position/save]', e);
    showToast('Fehler: ' + e.message, 'error');
    // revert UI
    selectEl.value = prev;
  } finally {
    selectEl.disabled = false;
  }
}

function fmtEur(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function setWizardStep(stepNum) {
  _abState.activeStep = stepNum;
  document.querySelectorAll('.wizard-panel').forEach((el, idx) => {
    el.hidden = (idx + 1) !== stepNum;
  });
  document.querySelectorAll('.wiz-btn').forEach((btn, idx) => {
    const active = (idx + 1) === stepNum;
    btn.classList.toggle('active', active);
    btn.style.color = active ? 'var(--primary)' : 'var(--text-muted)';
  });
}

function runPreflightCheck() {
  const activeIk = _abState.activeIk;
  if (!activeIk) return;

  const checks = document.querySelectorAll(`.ab-rx-check[data-ik="${activeIk}"]:checked`);
  const selectedIds = [...checks].map(c => c.dataset.id);
  
  const resultsDiv = document.getElementById('abPreflightResults');
  const nextWrap = document.getElementById('abStep1NextWrap');
  if (!resultsDiv) return;
  resultsDiv.innerHTML = '';
  
  if (!selectedIds.length) {
    resultsDiv.innerHTML = `<div class="preflight-check-item error">
      <span class="preflight-check-icon error" style="display:inline-flex;width:16px;height:16px;">${ICON.warning}</span>
      <div>Bitte wählen Sie mindestens ein Rezept für den Preflight-Check aus.</div>
    </div>`;
    if (nextWrap) nextWrap.hidden = true;
    document.getElementById('btn-wiz-step2').disabled = true;
    return;
  }

  let hasErrors = false;
  let validationHtml = '';

  selectedIds.forEach(id => {
    const rx = _abState.ready.find(r => r.id === id);
    if (!rx) return;

    const lead = rx.leads || {};
    const pname = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unbekannter Patient';
    const heilmittelText = rx.heilmittel || '';
    
    const rxErrors = [];
    const rxWarnings = [];

    if (!lead.first_name || !lead.last_name) {
      rxErrors.push('Patienten-Name ist unvollständig.');
    }
    if (!lead.versichertennummer) {
      rxErrors.push('Versichertennummer fehlt.');
    }
    if (!rx.icd10) {
      rxErrors.push('ICD-10 Diagnosecode fehlt.');
    }
    if (!rx.anzahl_einheiten || rx.anzahl_einheiten <= 0) {
      rxErrors.push('Anzahl der Einheiten ist ungültig.');
    }
    if (!rx.heilmittel_position) {
      rxWarnings.push('Keine Heilmittelposition (X-Code) zugewiesen. Die Zuzahlung und Abrechnungspreise können nicht exakt ermittelt werden.');
    }

    const issues = checkPrescriptionCompliance(rx, _abState.therapistCertsMap);
    if (issues.isReportMissing) {
      rxErrors.push(`Therapiebericht erforderlich, aber ausstehend (${rx.bericht_status || 'offen'}).`);
    }
    if (issues.missingCert) {
      rxErrors.push(`Zertifikats-Fehler: Der Therapeut für die Sitzung am ${issues.missingCertDate} besitzt nicht das erforderliche Zertifikat '${issues.missingCertName}'.`);
    }
    if (issues.has14DayGap) {
      rxErrors.push(`Yasal Kilit: Terapötik ara verme (Behandlungsunterbrechung) 14 takvim gününü aşmaktadır (${issues.gapDays} Tage, ${issues.gapDates}).`);
    }

    let statusClass = 'success';
    let summaryText = '✓ Rezept fehlerfrei';
    if (rxErrors.length > 0) {
      statusClass = 'error';
      summaryText = '⚠ Kritische Fehler';
      hasErrors = true;
    } else if (rxWarnings.length > 0) {
      statusClass = 'warning';
      summaryText = '⚠ Warnungen vorhanden';
    }

    validationHtml += `<div class="preflight-card">
      <div class="preflight-group-title" style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:600;">${escapeHtml(pname)} — ${escapeHtml(heilmittelText || 'Heilmittel')}</span>
        <span style="font-size:12px;font-weight:600;color:var(--text-muted);">${summaryText}</span>
      </div>`;

    if (rxErrors.length === 0 && rxWarnings.length === 0) {
      validationHtml += `<div class="preflight-check-item success">
        <span class="preflight-check-icon success" style="display:inline-flex;width:16px;height:16px;">${ICON.checkCircle}</span>
        <div>Alle Pflichtfelder (Name, Versichertennummer, Einheiten, ICD-10, Heilmittel) sind korrekt ausgefüllt.</div>
      </div>`;
    }

    rxErrors.forEach(err => {
      validationHtml += `<div class="preflight-check-item error">
        <span class="preflight-check-icon error" style="display:inline-flex;width:16px;height:16px;">${ICON.warning}</span>
        <div><strong>Kritisch:</strong> ${escapeHtml(err)}</div>
      </div>`;
    });

    rxWarnings.forEach(warn => {
      validationHtml += `<div class="preflight-check-item warning">
        <span class="preflight-check-icon warning" style="display:inline-flex;width:16px;height:16px;">${ICON.info}</span>
        <div><strong>Hinweis:</strong> ${escapeHtml(warn)}</div>
      </div>`;
    });

    validationHtml += `</div>`;
  });

  resultsDiv.innerHTML = validationHtml;

  const summaryBox = document.createElement('div');
  summaryBox.className = 'preflight-summary-box';
  if (hasErrors) {
    summaryBox.style.cssText = 'background:rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); color: var(--text-main); display:flex; align-items:center; gap:12px; padding:16px; border-radius:var(--radius-md); margin-top:16px;';
    summaryBox.innerHTML = `<span class="preflight-check-icon error" style="display:inline-flex;width:24px;height:24px;color:#ef4444;">${ICON.warning}</span>
      <div>
        <strong style="display:block;font-size:14px;margin-bottom:2px;">Validierung fehlgeschlagen</strong>
        <span style="font-size:13px;color:var(--text-muted);">Einige Rezepte weisen kritische Fehler auf. Bitte korrigieren Sie diese in den Patientenakten, bevor Sie fortfahren.</span>
      </div>`;
    if (nextWrap) nextWrap.hidden = true;
    document.getElementById('btn-wiz-step2').disabled = true;
  } else {
    summaryBox.style.cssText = 'background:rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); color: var(--text-main); display:flex; align-items:center; gap:12px; padding:16px; border-radius:var(--radius-md); margin-top:16px;';
    summaryBox.innerHTML = `<span class="preflight-check-icon success" style="display:inline-flex;width:24px;height:24px;color:#22c55e;">${ICON.checkCircle}</span>
      <div>
        <strong style="display:block;font-size:14px;margin-bottom:2px;">Preflight-Check erfolgreich</strong>
        <span style="font-size:13px;color:var(--text-muted);">Alle Rezepte sind strukturell valide. Sie können jetzt mit der Taxierung fortfahren.</span>
      </div>`;
    if (nextWrap) nextWrap.hidden = false;
    document.getElementById('btn-wiz-step2').disabled = false;
  }
  resultsDiv.appendChild(summaryBox);
}

function renderTaxierungList() {
  const activeIk = _abState.activeIk;
  const container = document.getElementById('abTaxierungContainer');
  if (!activeIk || !container) return;
  
  const kk = _abState.kkMap.get(activeIk);
  const kkName = kk?.name || activeIk;
  
  const checks = document.querySelectorAll(`.ab-rx-check[data-ik="${activeIk}"]:checked`);
  const selectedIds = [...checks].map(c => c.dataset.id);
  const items = _abState.ready.filter(rx => selectedIds.includes(rx.id));
  
  if (!items.length) {
    container.innerHTML = `<div class="table-empty">Keine Rezepte ausgewählt. Bitte gehen Sie zurück zu Schritt 1.</div>`;
    return;
  }
  
  container.innerHTML = `
    <div style="margin-bottom:16px;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;">
      <div style="font-weight:600;font-size:15px;color:var(--text-main);">${escapeHtml(kkName)}</div>
      <div style="font-size:12px;color:var(--text-muted);">${activeIk !== '__unknown__' ? 'IK ' + escapeHtml(activeIk) : ''} &middot; ${items.length} ${t('ab_rezept')} zur Abrechnung</div>
    </div>
    
    <div class="table-wrap" style="margin:0;">
      <table class="data-table" style="margin:0;">
        <thead>
          <tr>
            <th>${t('ab_patient')}</th>
            <th>${t('ab_rezept')}</th>
            <th>${t('ab_einheiten')}</th>
            <th>${t('ab_zuzahlung')}</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(rx => {
            const lead = rx.leads || {};
            const pname = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—';
            const heilmittelText = rx.heilmittel || '—';
            const currentPos = rx.heilmittel_position || '';
            const picker = _abState.positionsLoaded
              ? `<select class="ab-pos-select-step2" data-id="${escapeHtml(rx.id)}" data-prev="${escapeHtml(currentPos)}" style="margin-top:4px;font-size:12px;max-width:280px;width:100%;">${buildPositionOptionsHtml(currentPos)}</select>`
              : `<span style="font-size:12px;color:var(--text-muted);">${escapeHtml(currentPos || '—')}</span>`;
            
            const _posLookup = (() => {
              if (!currentPos) return null;
              const tpl = /^X\d{4}$/.test(currentPos) ? currentPos
                : /^\d{5}$/.test(currentPos) ? 'X' + currentPos.slice(1)
                  : null;
              return tpl ? _abState.positions.find(p => p.x === tpl) : null;
            })();
            const anzahl = rx.anzahl_einheiten || 1;
            const brutto = _posLookup ? (_posLookup.preis || 0) * anzahl : 0;
            const zuPerEin = _posLookup?.zuzahlung;
            const zuProz = (zuPerEin != null) ? zuPerEin * anzahl : brutto * 0.10;
            const zuPausch = Math.min(10, Math.max(0, brutto - zuProz));
            const zuTotal = Math.round((zuProz + zuPausch) * 100) / 100;
            const zu = rx.zuzahlung_befreit
              ? `<span style="color:#15803d;font-weight:600;">${t('ab_zuzahlung_befreit')}</span>`
              : (_posLookup ? fmtEur(zuTotal) : '<span style="color:#b45309;" title="Position fehlt">— Position?</span>');
              
            return `<tr>
              <td>${escapeHtml(pname)}</td>
              <td>
                <div style="font-weight:500;">${escapeHtml(heilmittelText)}</div>
                ${picker}
              </td>
              <td>${rx.anzahl_einheiten || 0}</td>
              <td>${zu}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  container.querySelectorAll('.ab-pos-select-step2').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const newVal = e.target.value;
      if (!newVal) { e.target.value = e.target.dataset.prev || ''; return; }
      await savePositionOverride(e.target.dataset.id, newVal, e.target);
      renderTaxierungList();
    });
  });
}

async function renderExportStep() {
  const abId = _abState.activeAbrechnungId;
  const nextBtn = document.getElementById('btn-wiz-step3');
  if (nextBtn) nextBtn.disabled = false;

  if (!abId) {
    document.getElementById('abExportActiveBox').innerHTML = `<p style="color:var(--text-muted);">Keine aktive Abrechnung im Export-Schritt vorhanden.</p>`;
    return;
  }

  const { data: ab, error } = await supabase
    .from('abrechnung')
    .select('id, kostentraeger_ik, dateiname, rechnungsnummer, total_eur, zuzahlung_total, prescription_count, status, storage_path, begleitzettel_path, signed_storage_path')
    .eq('id', abId)
    .single();

  if (error || !ab) {
    console.error('[export/load]', error);
    return;
  }

  const kk = _abState.kkMap.get(ab.kostentraeger_ik);
  const kkName = kk?.name || ab.kostentraeger_ik || 'Krankenkasse';

  document.getElementById('abExportKkName').textContent = kkName;
  document.getElementById('abExportDetails').innerHTML = `
    <strong>Datei:</strong> <code style="font-size:12px;font-family:monospace;">${escapeHtml(ab.dateiname || ab.rechnungsnummer || ab.id.slice(0, 8))}</code> &middot; 
    <strong>Rezepte:</strong> ${ab.prescription_count || 0} &middot; 
    <strong>Gesamtsumme:</strong> ${fmtEur(ab.total_eur)} &middot;
    <strong>Status:</strong> <span class="badge ${ab.signed_storage_path ? 'badge-green' : 'badge-gray'}">${ab.signed_storage_path ? '✍ signiert' : 'unsigniert'}</span>
  `;

  const dlDta = document.getElementById('abDownloadActiveDta');
  const dlBeg = document.getElementById('abDownloadActiveBeg');
  const signBtn = document.getElementById('abSignActiveDta');

  const newDlDta = dlDta.cloneNode(true);
  const newDlBeg = dlBeg.cloneNode(true);
  const newSignBtn = signBtn.cloneNode(true);

  dlDta.parentNode.replaceChild(newDlDta, dlDta);
  dlBeg.parentNode.replaceChild(newDlBeg, dlBeg);
  signBtn.parentNode.replaceChild(newSignBtn, signBtn);

  if (ab.storage_path) {
    newDlDta.disabled = false;
    newDlDta.addEventListener('click', () => downloadAbrechnungFile(ab.storage_path, ab.id, 'dta'));
  } else {
    newDlDta.disabled = true;
  }

  if (ab.begleitzettel_path) {
    newDlBeg.disabled = false;
    newDlBeg.addEventListener('click', () => downloadAbrechnungFile(ab.begleitzettel_path, null, 'begleit'));
  } else {
    newDlBeg.disabled = true;
  }

  if (ab.signed_storage_path) {
    newSignBtn.innerHTML = '✓ Digital Signiert';
    newSignBtn.disabled = true;
    newSignBtn.className = 'btn-ghost';
  } else {
    newSignBtn.innerHTML = '✍ Digital Signieren (.p7m)';
    newSignBtn.disabled = false;
    newSignBtn.className = 'btn-primary';
    newSignBtn.addEventListener('click', () => openSignModal(ab.id, { filename: ab.dateiname }));
  }
}

async function loadAbrechnung() {
  const ownerId = getOwnerId();
  if (!ownerId) return;

  const [readyRes, kkRes, histRes, certsRes] = await Promise.all([
    supabase.from('prescriptions')
      .select(`
        id, patient_id, kostentraeger_ik, heilmittel, heilmittel_position, anzahl_einheiten, 
        zuzahlung_eur, zuzahlung_befreit, ausstellungsdatum, icd10, is_blanko, is_lhb_bvb, 
        bericht_angefordert, bericht_status,
        leads:patient_id(first_name,last_name,krankenkasse,versichertennummer),
        prescription_sessions (
          id, session_number, status, done_at,
          bookings:booking_id (
            id, user_id, service_id,
            services:service_id (id, required_certificate)
          )
        )
      `)
      .eq('owner_id', ownerId)
      .eq('abrechnung_status', 'bereit')
      .order('ausstellungsdatum', { ascending: true }),
    supabase.from('kostentraeger').select('ik, name, das_ik, active'),
    supabase.from('abrechnung')
      .select('id, kostentraeger_ik, dateiname, rechnungsnummer, total_eur, zuzahlung_total, prescription_count, status, storage_path, begleitzettel_path, signed_storage_path, signed_at, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('therapist_certificates')
      .select('profile_id, certificate')
      .eq('owner_id', ownerId)
  ]);

  if (readyRes.error) console.error('[abrechnung/ready]', readyRes.error);
  if (kkRes.error) console.error('[abrechnung/kk]', kkRes.error);
  if (histRes.error) console.error('[abrechnung/hist]', histRes.error);
  if (certsRes.error) console.error('[abrechnung/certs]', certsRes.error);

  _abState.kkMap = new Map((kkRes.data || []).map(r => [r.ik, r]));
  _abState.ready = readyRes.data || [];

  const therapistCertsMap = new Map();
  if (certsRes.data) {
    for (const c of certsRes.data) {
      if (!therapistCertsMap.has(c.profile_id)) {
        therapistCertsMap.set(c.profile_id, new Set());
      }
      therapistCertsMap.get(c.profile_id).add(c.certificate);
    }
  }
  _abState.therapistCertsMap = therapistCertsMap;

  loadPhysioPositions().then(() => {
    if (_abState.ready.length) renderAbrechnungReady();
  });

  renderAbrechnungReady();
  renderAbrechnungHistory(histRes.data || []);

  const icon1 = document.getElementById('wiz-icon-step1');
  const icon2 = document.getElementById('wiz-icon-step2');
  const icon3 = document.getElementById('wiz-icon-step3');
  const icon4 = document.getElementById('wiz-icon-step4');
  if (icon1 && !icon1.innerHTML) icon1.innerHTML = ICON.clipboard;
  if (icon2 && !icon2.innerHTML) icon2.innerHTML = ICON.edit;
  if (icon3 && !icon3.innerHTML) icon3.innerHTML = ICON.invoice;
  if (icon4 && !icon4.innerHTML) icon4.innerHTML = ICON.clock;

  if (!window.__abWizardBound) {
    window.__abWizardBound = true;
    document.querySelectorAll('.wiz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!btn.disabled) setWizardStep(parseInt(btn.dataset.step));
      });
    });

    const runPreflight = document.getElementById('abRunPreflightBtn');
    if (runPreflight) runPreflight.addEventListener('click', runPreflightCheck);

    const toStep2 = document.getElementById('abToStep2Btn');
    if (toStep2) {
      toStep2.addEventListener('click', () => {
        renderTaxierungList();
        setWizardStep(2);
      });
    }

    const backToStep1 = document.getElementById('abBackToStep1Btn');
    if (backToStep1) backToStep1.addEventListener('click', () => setWizardStep(1));

    const generateDta = document.getElementById('abGenerateDtaBtn');
    if (generateDta) {
      generateDta.addEventListener('click', () => {
        createAbrechnung(_abState.activeIk);
      });
    }

    const backToStep2 = document.getElementById('abBackToStep2Btn');
    if (backToStep2) backToStep2.addEventListener('click', () => setWizardStep(2));

    const toStep4 = document.getElementById('abToStep4Btn');
    if (toStep4) toStep4.addEventListener('click', () => setWizardStep(4));
  }

  if (!_abState.ready.length) {
    setWizardStep(4);
  } else {
    setWizardStep(_abState.activeStep || 1);
  }
}

function checkPrescriptionCompliance(rx, therapistCertsMap) {
  const issues = {
    has14DayGap: false,
    gapDays: 0,
    gapDates: '',
    missingCert: false,
    missingCertName: '',
    missingCertDate: '',
    isReportMissing: !!(rx.bericht_angefordert && rx.bericht_status !== 'erledigt'),
  };

  const doneSessions = (rx.prescription_sessions || [])
    .filter(s => s.status === 'done');

  // Check 14-day gap
  if (doneSessions.length > 1) {
    const sorted = [...doneSessions].sort((a, b) => new Date(a.done_at) - new Date(b.done_at));
    for (let k = 1; k < sorted.length; k++) {
      const prevD = new Date(sorted[k - 1].done_at);
      const currD = new Date(sorted[k].done_at);
      const diffTime = currD - prevD;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 14) {
        issues.has14DayGap = true;
        issues.gapDays = diffDays;
        issues.gapDates = `${new Date(sorted[k - 1].done_at).toLocaleDateString('de-DE')} - ${new Date(sorted[k].done_at).toLocaleDateString('de-DE')}`;
        break; // Show first gap
      }
    }
  }

  // Check therapist certificates
  for (const s of doneSessions) {
    const booking = s.bookings || s.booking_id || {};
    const service = booking.services || booking.service_id || booking.service || {};
    const requiredCert = service.required_certificate;
    if (requiredCert) {
      const therapistId = booking.user_id;
      const certSet = therapistCertsMap ? therapistCertsMap.get(therapistId) : null;
      if (!therapistId || !certSet || !certSet.has(requiredCert)) {
        issues.missingCert = true;
        issues.missingCertName = requiredCert;
        issues.missingCertDate = s.done_at ? new Date(s.done_at).toLocaleDateString('de-DE') : '';
        break;
      }
    }
  }

  return issues;
}

function renderAbrechnungReady() {
  const container = document.getElementById('abReadyGroups');
  const empty = document.getElementById('abReadyEmpty');
  if (!container || !empty) return;
  container.innerHTML = '';

  if (!_abState.ready.length) {
    empty.style.display = '';
    const preflightCard = document.getElementById('preflightActionCard');
    if (preflightCard) preflightCard.style.display = 'none';
    return;
  }
  empty.style.display = 'none';

  const groups = new Map();
  _abState.ready.forEach(rx => {
    const ik = rx.kostentraeger_ik || '__unknown__';
    if (!groups.has(ik)) groups.set(ik, []);
    groups.get(ik).push(rx);
  });

  for (const [ik, items] of groups) {
    const kk = _abState.kkMap.get(ik);
    const kkName = kk?.name || (ik === '__unknown__' ? '⚠ Kostenträger fehlt' : ik);

    const wrap = document.createElement('div');
    wrap.className = 'ab-group';
    wrap.style.cssText = 'border:1px solid var(--border);border-radius:10px;margin-bottom:14px;overflow:hidden;';

    const totalCount = items.length;

    let controlHtml = '';
    if (ik === '__unknown__') {
      const activeKks = Array.from(_abState.kkMap.values())
        .filter(kk => kk.active)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const optionsHtml = activeKks.map(kk => 
        `<option value="${escapeHtml(kk.ik)}">${escapeHtml(kk.name || kk.ik)}</option>`
      ).join('');

      const rxIds = items.map(rx => rx.id).join(',');

      controlHtml = `
        <div style="display:flex;align-items:center;gap:8px;">
          <select class="ab-assign-kk-select" style="font-size:13px;padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-main);">
            <option value="">Kostenträger wählen…</option>
            ${optionsHtml}
          </select>
          <button class="btn-primary ab-assign-kk-btn" data-ids="${escapeHtml(rxIds)}" disabled style="padding:6px 12px;font-size:13px;">Zuweisen</button>
        </div>
      `;
    } else {
      controlHtml = `<button class="btn-primary ab-select-group-btn" data-ik="${escapeHtml(ik)}">Validieren &amp; Abrechnen</button>`;
    }

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-card);">
        <div>
          <div style="font-weight:600;font-size:15px;">${escapeHtml(kkName)}</div>
          <div style="font-size:12px;color:var(--text-muted);">${ik !== '__unknown__' ? 'IK ' + escapeHtml(ik) : ''} · ${totalCount} ${t('ab_rezept')}</div>
        </div>
        ${controlHtml}
      </div>
      <div class="table-wrap" style="margin:0;">
        <table class="data-table" style="margin:0;">
          <thead>
            <tr>
              <th style="width:38px;"><input type="checkbox" class="ab-group-select-all" data-ik="${escapeHtml(ik)}" checked /></th>
              <th>${t('ab_patient')}</th>
              <th>${t('ab_rezept')}</th>
              <th>${t('ab_einheiten')}</th>
              <th>${t('ab_zuzahlung')}</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(rx => {
              const lead = rx.leads || {};
              const pname = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—';
              const heilmittelText = rx.heilmittel || '—';
              const currentPos = rx.heilmittel_position || '';
              const picker = _abState.positionsLoaded
                ? `<select class="ab-pos-select" data-id="${escapeHtml(rx.id)}" data-prev="${escapeHtml(currentPos)}" style="margin-top:4px;font-size:12px;max-width:280px;width:100%;">${buildPositionOptionsHtml(currentPos)}</select>`
                : `<span style="font-size:12px;color:var(--text-muted);">${escapeHtml(currentPos || '—')}</span>`;
              
              const _posLookup = (() => {
                if (!currentPos) return null;
                const tpl = /^X\d{4}$/.test(currentPos) ? currentPos
                  : /^\d{5}$/.test(currentPos) ? 'X' + currentPos.slice(1)
                    : null;
                return tpl ? _abState.positions.find(p => p.x === tpl) : null;
              })();
              const anzahl = rx.anzahl_einheiten || 1;
              const brutto = _posLookup ? (_posLookup.preis || 0) * anzahl : 0;
              const zuPerEin = _posLookup?.zuzahlung;
              const zuProz = (zuPerEin != null) ? zuPerEin * anzahl : brutto * 0.10;
              const zuPausch = Math.min(10, Math.max(0, brutto - zuProz));
              const zuTotal = Math.round((zuProz + zuPausch) * 100) / 100;
              const zu = rx.zuzahlung_befreit
                ? `<span style="color:#15803d;font-weight:600;">${t('ab_zuzahlung_befreit')}</span>`
                : (_posLookup ? fmtEur(zuTotal) : '<span style="color:#b45309;" title="Position fehlt">— Position?</span>');
              
              const issues = checkPrescriptionCompliance(rx, _abState.therapistCertsMap);
              const isBlocked = issues.isReportMissing || issues.missingCert || issues.has14DayGap;
              const checkboxHtml = isBlocked
                ? `<input type="checkbox" class="ab-rx-check" data-ik="${escapeHtml(ik)}" data-id="${escapeHtml(rx.id)}" disabled style="opacity:0.5;" />`
                : `<input type="checkbox" class="ab-rx-check" data-ik="${escapeHtml(ik)}" data-id="${escapeHtml(rx.id)}" checked />`;

              let badgesHtml = '';
              if (issues.isReportMissing) {
                badgesHtml += `<div style="margin-top:4px; display:inline-flex; align-items:center; gap:4px; background:#fee2e2; color:#b91c1c; font-size:11px; padding:3px 8px; border-radius:4px; font-weight:500;" title="Therapiebericht ausstehend!">
                    <span class="svg-icon" style="width:12px;height:12px;display:inline-flex;color:#b91c1c;">${ICON.warning}</span>
                    Bericht fehlt (${escapeHtml(rx.bericht_status)})
                   </div>`;
              }
              if (issues.missingCert) {
                badgesHtml += `<div style="margin-top:4px; margin-left:4px; display:inline-flex; align-items:center; gap:4px; background:#fee2e2; color:#b91c1c; font-size:11px; padding:3px 8px; border-radius:4px; font-weight:500;" title="Therapeut besitzt kein Zertifikat '${escapeHtml(issues.missingCertName)}' für die Sitzung am ${escapeHtml(issues.missingCertDate)}!">
                    <span class="svg-icon" style="width:12px;height:12px;display:inline-flex;color:#b91c1c;">${ICON.warning}</span>
                    Qualifikation fehlt (${escapeHtml(issues.missingCertName)})
                   </div>`;
              }
              if (issues.has14DayGap) {
                badgesHtml += `<div style="margin-top:4px; margin-left:4px; display:inline-flex; align-items:center; gap:4px; background:#fee2e2; color:#b91c1c; font-size:11px; padding:3px 8px; border-radius:4px; font-weight:500;" title="Unterbrechung von ${escapeHtml(issues.gapDays)} Tagen (${escapeHtml(issues.gapDates)}) überschreitet 14 Tage!">
                    <span class="svg-icon" style="width:12px;height:12px;display:inline-flex;color:#b91c1c;">${ICON.warning}</span>
                    Pause > 14 Tage (${escapeHtml(issues.gapDays)} Tg.)
                   </div>`;
              }

              return `<tr>
                <td>${checkboxHtml}</td>
                <td>
                  <div>${escapeHtml(pname)}</div>
                  ${badgesHtml}
                </td>
                <td>
                  <div style="font-weight:500;">${escapeHtml(heilmittelText)}</div>
                  ${picker}
                </td>
                <td>${rx.anzahl_einheiten || 0}</td>
                <td>${zu}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    container.appendChild(wrap);
  }

  container.querySelectorAll('.ab-group-select-all').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const ik = e.target.dataset.ik;
      container.querySelectorAll(`.ab-rx-check[data-ik="${ik}"]`).forEach(c => {
        if (!c.disabled) c.checked = e.target.checked;
      });
      if (_abState.activeIk === ik) runPreflightCheck();
    });
  });

  container.querySelectorAll('.ab-rx-check').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const ik = e.target.dataset.ik;
      if (_abState.activeIk === ik) runPreflightCheck();
    });
  });

  container.querySelectorAll('.ab-select-group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ik = btn.dataset.ik;
      _abState.activeIk = ik;
      const preflightCard = document.getElementById('preflightActionCard');
      if (preflightCard) {
        preflightCard.style.display = '';
        preflightCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      runPreflightCheck();
    });
  });

  container.querySelectorAll('.ab-group').forEach(groupWrap => {
    const select = groupWrap.querySelector('.ab-assign-kk-select');
    const button = groupWrap.querySelector('.ab-assign-kk-btn');
    if (select && button) {
      select.addEventListener('change', () => {
        button.disabled = !select.value;
      });
      button.addEventListener('click', async () => {
        const selectedIk = select.value;
        if (!selectedIk) return;
        const rxIds = button.dataset.ids.split(',');
        const ownerId = getOwnerId();
        if (!ownerId) {
          showToast('Fehler: Keine gültige Owner-ID gefunden', 'error');
          return;
        }
        
        button.disabled = true;
        button.textContent = '⏳ Zuweisen…';
        try {
          const { error } = await supabase
            .from('prescriptions')
            .update({ kostentraeger_ik: selectedIk })
            .eq('owner_id', ownerId)
            .in('id', rxIds);
            
          if (error) throw error;
          
          showToast('Kostenträger zugewiesen ✓');
          await loadAbrechnung();
        } catch (err) {
          showToast(err.message || 'Fehler beim Zuweisen des Kostenträgers', 'error');
          button.disabled = false;
          button.textContent = 'Zuweisen';
        }
      });
    }
  });

  container.querySelectorAll('.ab-pos-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const newVal = e.target.value;
      if (!newVal) { e.target.value = e.target.dataset.prev || ''; return; }
      savePositionOverride(e.target.dataset.id, newVal, e.target);
    });
  });
}

function renderAbrechnungHistory(rows) {
  const body = document.getElementById('abHistoryBody');
  const empty = document.getElementById('abHistoryEmpty');
  if (!body || !empty) return;
  body.innerHTML = '';
  if (!rows.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  rows.forEach(a => {
    const kk = _abState.kkMap.get(a.kostentraeger_ik);
    const statusLabel = t('ab_status_' + a.status) || a.status;
    const signedBadge = a.signed_storage_path
      ? `<span class="badge badge-green" title="${a.signed_at ? new Date(a.signed_at).toLocaleString('de-DE') : ''}">✍ signiert</span>`
      : `<span class="badge badge-gray">unsigniert</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span style="font-family:monospace;font-size:12px;">${escapeHtml(a.dateiname || a.rechnungsnummer || a.id.slice(0, 8))}</span> ${signedBadge}</td>
      <td>${escapeHtml(kk?.name || a.kostentraeger_ik || '—')}</td>
      <td>${a.prescription_count || 0}</td>
      <td>${fmtEur(a.total_eur)}</td>
      <td>${escapeHtml(statusLabel)}</td>
      <td style="white-space:nowrap;">
        ${a.signed_storage_path
        ? `<button class="btn-ghost btn-sm ab-dl-signed" data-path="${escapeHtml(a.signed_storage_path)}" data-id="${escapeHtml(a.id)}">📥 P7M</button>`
        : (a.storage_path ? `<button class="btn-primary btn-sm ab-sign" data-id="${escapeHtml(a.id)}" data-name="${escapeHtml(a.dateiname || '')}">✍ Signieren</button>` : '')
      }
        ${a.storage_path ? `<button class="btn-ghost btn-sm ab-dl-dta" data-path="${escapeHtml(a.storage_path)}" data-id="${escapeHtml(a.id)}">${t('ab_download_dta')}</button>` : ''}
        ${a.begleitzettel_path ? `<button class="btn-ghost btn-sm ab-dl-beg" data-path="${escapeHtml(a.begleitzettel_path)}">${t('ab_download_begleit')}</button>` : ''}
        <button class="btn-ghost btn-sm ab-zaa" data-id="${escapeHtml(a.id)}" data-name="${escapeHtml(a.dateiname || '')}" title="ZAA-Antwortdatei hochladen">📨 ZAA</button>
        <button class="btn-ghost btn-sm ab-guide" data-id="${escapeHtml(a.id)}" title="Schritt-für-Schritt-Anleitung" style="display:inline-flex;align-items:center;gap:4px;"><span class="svg-icon" style="width:12px;height:12px;display:inline-flex;">${ICON.clipboard}</span>Anleitung</button>
        ${a.status === 'rejected' || a.status === 'accepted'
        ? `<button class="btn-ghost btn-sm ab-show-errors" data-id="${escapeHtml(a.id)}">🔍 Fehler</button>`
        : ''}
        ${a.status === 'rejected'
        ? `<button class="btn-ghost btn-sm ab-revert-rejected" data-id="${escapeHtml(a.id)}">🔄 Korrigieren & erneut abrechnen</button>`
        : ''}
      </td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('.ab-dl-dta').forEach(btn => {
    btn.addEventListener('click', () => downloadAbrechnungFile(btn.dataset.path, btn.dataset.id, 'dta'));
  });
  body.querySelectorAll('.ab-dl-signed').forEach(btn => {
    btn.addEventListener('click', () => downloadAbrechnungFile(btn.dataset.path, btn.dataset.id, 'dta'));
  });
  body.querySelectorAll('.ab-dl-beg').forEach(btn => {
    btn.addEventListener('click', () => downloadAbrechnungFile(btn.dataset.path, null, 'begleit'));
  });
  body.querySelectorAll('.ab-sign').forEach(btn => {
    btn.addEventListener('click', () => openSignModal(btn.dataset.id, { filename: btn.dataset.name }));
  });
  body.querySelectorAll('.ab-zaa').forEach(btn => {
    btn.addEventListener('click', () => openZaaModal(btn.dataset.id, btn.dataset.name));
  });
  body.querySelectorAll('.ab-show-errors').forEach(btn => {
    btn.addEventListener('click', () => showZaaErrors(btn.dataset.id));
  });
  body.querySelectorAll('.ab-guide').forEach(btn => {
    btn.addEventListener('click', () => openDasGuideModal(btn.dataset.id));
  });
  body.querySelectorAll('.ab-revert-rejected').forEach(btn => {
    btn.addEventListener('click', async () => {
      const abId = btn.dataset.id;
      if (!confirm("Die Rezepte dieser Abrechnung werden zur Korrektur freigegeben und erscheinen wieder unter 'Bereit'. Fortfahren?")) {
        return;
      }
      try {
        const ownerId = getOwnerId();
        if (!ownerId) {
          showToast('Fehler: Keine gültige Owner-ID gefunden', 'error');
          return;
        }
        const { error } = await supabase.from('prescriptions')
          .update({ abrechnung_status: 'bereit', abrechnung_id: null })
          .eq('owner_id', ownerId)
          .eq('abrechnung_id', abId);
          
        if (error) throw error;
        
        showToast('Rezepte zur Korrektur freigegeben ✓');
        await loadAbrechnung();
      } catch (err) {
        showToast(err.message || 'Fehler beim Freigeben der Rezepte', 'error');
      }
    });
  });
}

function openZaaModal(abrechnungId, filename) {
  const modal = document.getElementById('zaaModal');
  if (!modal) return;
  document.getElementById('zaaFileInput').value = '';
  document.getElementById('zaaErr').textContent = '';
  document.getElementById('zaaResult').innerHTML = '';
  const btn = document.getElementById('zaaRunBtn');
  btn.disabled = false;
  btn.textContent = 'Hochladen & analysieren';
  btn.dataset.abrechnung = abrechnungId;
  document.getElementById('zaaTitle').textContent = 'ZAA-Antwortdatei' + (filename ? ' — ' + filename : '');
  openModal('zaaModal');
}

async function runZaaUpload() {
  const btn = document.getElementById('zaaRunBtn');
  const err = document.getElementById('zaaErr');
  const out = document.getElementById('zaaResult');
  const file = document.getElementById('zaaFileInput').files[0];
  err.textContent = '';
  out.innerHTML = '';
  if (!file) { err.textContent = 'Bitte Datei auswählen.'; return; }
  if (file.size > 5 * 1024 * 1024) { err.textContent = 'Datei zu groß (max 5 MB).'; return; }

  btn.disabled = true;
  btn.textContent = '⏳ Lade hoch…';
  try {
    const ab = btn.dataset.abrechnung;
    const ab64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch(`${API}/billing/abrechnung/${ab}/upload-zaa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.access_token,
      },
      body: JSON.stringify({ contentBase64: ab64, filename: file.name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));

    const summary = json.errorCount
      ? `<div style="padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;margin-bottom:10px;color:#991b1b;">
           ${json.errorCount} Fehler erkannt — Abrechnung als <strong>abgelehnt</strong> markiert.
         </div>`
      : `<div style="padding:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;margin-bottom:10px;color:#166534;">
           Keine Fehler erkannt — Abrechnung als <strong>akzeptiert</strong> markiert.
         </div>`;
    const rows = (json.errors || []).map(e => `
      <tr>
        <td><code>${escapeHtml(e.code)}</code></td>
        <td>${escapeHtml(e.belegnummer || '—')}</td>
        <td>${escapeHtml(e.uebersetzung || e.text || '')}</td>
        <td style="color:#444;">${escapeHtml(e.loesung || '')}</td>
      </tr>
    `).join('');
    out.innerHTML = summary + (rows
      ? `<table class="data-table"><thead><tr><th>Code</th><th>Beleg</th><th>Fehler</th><th>Lösung</th></tr></thead><tbody>${rows}</tbody></table>`
      : '');

    showToast(json.errorCount ? `${json.errorCount} Fehler importiert.` : 'Abrechnung akzeptiert.');
    btn.disabled = false;
    btn.textContent = 'Schließen';
    btn.onclick = () => { closeModal('zaaModal'); loadAbrechnung(); btn.onclick = runZaaUpload; };
  } catch (e) {
    console.error('[abrechnung/zaa-upload]', e);
    err.textContent = e.message;
    btn.disabled = false;
    btn.textContent = 'Hochladen & analysieren';
  }
}

async function showZaaErrors(abrechnungId) {
  const { data, error } = await supabase
    .from('zaa_fehler')
    .select('fehler_code, fehler_text, uebersetzung, loesung_hint, status, prescription_id, created_at')
    .eq('abrechnung_id', abrechnungId)
    .order('created_at');
  if (error) return showToast('Fehler: ' + error.message, 'error');

  openModal('zaaModal');
  document.getElementById('zaaTitle').textContent = 'ZAA-Fehler dieser Abrechnung';
  document.getElementById('zaaFileInput').value = '';
  document.getElementById('zaaErr').textContent = '';
  const out = document.getElementById('zaaResult');
  if (!data?.length) {
    out.innerHTML = `<div style="padding:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;color:#166534;">Keine Fehler — alles abgenommen.</div>`;
  } else {
    out.innerHTML = `<table class="data-table"><thead><tr><th>Code</th><th>Status</th><th>Fehler</th><th>Lösung</th><th>Aktion</th></tr></thead><tbody>
      ${data.map(e => {
        const actionLink = e.prescription_id
          ? `<a href="#" class="zaa-fix-link" data-rx="${escapeHtml(e.prescription_id)}" style="color:var(--primary);text-decoration:underline;font-weight:600;">Beheben</a>`
          : '—';
        return `<tr>
          <td><code>${escapeHtml(e.fehler_code)}</code></td>
          <td>${escapeHtml(e.status)}</td>
          <td>${escapeHtml(e.uebersetzung || e.fehler_text || '')}</td>
          <td style="color:#444;">${escapeHtml(e.loesung_hint || '')}</td>
          <td>${actionLink}</td>
        </tr>`;
      }).join('')}
    </tbody></table>`;

    out.querySelectorAll('.zaa-fix-link').forEach(link => {
      link.addEventListener('click', async (evt) => {
        evt.preventDefault();
        const rxId = link.dataset.rx;
        closeModal('zaaModal');
        const { data: rx } = await supabase.from('prescriptions').select('patient_id').eq('id', rxId).single();
        if (rx?.patient_id) {
          const { data: lead } = await supabase.from('leads').select('*').eq('id', rx.patient_id).single();
          if (lead) {
            openPatientDetailModal(lead);
            setTimeout(() => {
              const tab = document.getElementById('pdTabRezepte');
              if (tab) tab.click();
            }, 300);
          }
        }
      });
    });
  }
  document.getElementById('zaaRunBtn').textContent = 'Schließen';
  document.getElementById('zaaRunBtn').onclick = () => {
    closeModal('zaaModal');
    document.getElementById('zaaRunBtn').onclick = runZaaUpload;
  };
}

async function downloadAbrechnungFile(path, abrechnungId, kind) {
  try {
    const { data, error } = await supabase.storage.from('abrechnungen').createSignedUrl(path, 300);
    if (error) throw error;
    window.open(data.signedUrl, '_blank');
    if (abrechnungId && kind === 'dta') {
      supabase.from('abrechnung')
        .update({ status: 'heruntergeladen' })
        .eq('id', abrechnungId)
        .eq('status', 'erstellt')
        .then(() => {
          if (_abState.activeAbrechnungId === abrechnungId) renderExportStep();
          loadAbrechnung();
        });
    }
  } catch (e) {
    console.error('[abrechnung/download]', e);
    showToast('Download fehlgeschlagen: ' + e.message, 'error');
  }
}

let _forgeMod = null;
async function loadForge() {
  if (_forgeMod) return _forgeMod;
  const m = await import('https://esm.sh/node-forge@1.3.1');
  _forgeMod = m.default || m;
  return _forgeMod;
}

function _binStrToUint8(bs) {
  const u = new Uint8Array(bs.length);
  for (let i = 0; i < bs.length; i++) u[i] = bs.charCodeAt(i) & 0xff;
  return u;
}
function _u8ToBinStr(u8) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  return s;
}

function openSignModal(abrechnungId, opts = {}) {
  const modal = document.getElementById('signModal');
  if (!modal) return;
  document.getElementById('signFileInput').value = '';
  document.getElementById('signPinInput').value = '';
  const err = document.getElementById('signErr');
  err.textContent = '';
  const status = document.getElementById('signStatus');
  status.textContent = '';
  const btn = document.getElementById('signRunBtn');
  btn.disabled = false;
  btn.textContent = 'Signieren';
  btn.dataset.abrechnung = abrechnungId;
  document.getElementById('signTitle').textContent =
    opts.title || ('DTA signieren' + (opts.filename ? ' — ' + opts.filename : ''));
  openModal('signModal');
}

async function runSignAbrechnung() {
  const btn = document.getElementById('signRunBtn');
  const abrechnungId = btn.dataset.abrechnung;
  const err = document.getElementById('signErr');
  const stat = document.getElementById('signStatus');
  err.textContent = '';
  stat.textContent = '';

  const file = document.getElementById('signFileInput').files[0];
  const pin = document.getElementById('signPinInput').value;
  if (!file) { err.textContent = 'Bitte .p12-Datei auswählen.'; return; }
  if (!pin) { err.textContent = 'PIN erforderlich.'; return; }

  btn.disabled = true;
  btn.textContent = '⏳ Signiere…';
  try {
    stat.textContent = 'Lade DTA-Datei vom Server…';
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) throw new Error('Nicht angemeldet');

    const dtaRes = await fetch(`${API}/billing/abrechnung/${abrechnungId}/dta-bytes`, {
      headers: { 'Authorization': 'Bearer ' + s.access_token },
    });
    const dtaJson = await dtaRes.json();
    if (!dtaRes.ok) throw new Error(dtaJson.error || ('HTTP ' + dtaRes.status));

    stat.textContent = 'Lade Krypto-Bibliothek…';
    const forge = await loadForge();

    stat.textContent = 'Entschlüssele Zertifikat…';
    const p12Ab = await file.arrayBuffer();
    const p12BinStr = _u8ToBinStr(new Uint8Array(p12Ab));
    const p12Asn1 = forge.asn1.fromDer(p12BinStr);
    let p12;
    try { p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pin); }
    catch (e) {
      throw new Error('Zertifikat konnte nicht entschlüsselt werden (falsche PIN?).');
    }

    const keyBagSets = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBagSets = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBag = keyBagSets[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
      || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
    const certBag = certBagSets[forge.pki.oids.certBag]?.[0];
    if (!keyBag?.key) throw new Error('Privater Schlüssel im Zertifikat nicht gefunden.');
    if (!certBag?.cert) throw new Error('Zertifikat-Bag nicht gefunden.');

    const cert = certBag.cert;
    const privateKey = keyBag.key;

    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha1.create(); md.update(certDer); const certThumbprint = md.digest().toHex();
    const subjectAttrs = (cert.subject?.attributes || []).map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
    const notAfter = cert.validity?.notAfter ? new Date(cert.validity.notAfter).toISOString() : null;
    const certSerial = cert.serialNumber || null;

    if (cert.validity?.notAfter && cert.validity.notAfter < new Date()) {
      throw new Error(`Zertifikat abgelaufen (${cert.validity.notAfter.toLocaleDateString('de-DE')}).`);
    }

    stat.textContent = 'Erzeuge PKCS#7 SignedData…';
    const dtaBytes = atob(dtaJson.contentBase64);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(dtaBytes, 'binary');
    p7.addCertificate(cert);
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() },
      ],
    });
    p7.sign({ detached: false });

    const p7DerBin = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const signedBase64 = forge.util.encode64(p7DerBin);

    stat.textContent = 'Lade signierte Datei hoch…';
    const upRes = await fetch(`${API}/billing/abrechnung/${abrechnungId}/upload-signed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.access_token,
      },
      body: JSON.stringify({
        signedBase64,
        certSubject: subjectAttrs,
        certValidTo: notAfter,
        certThumbprint,
        certSerial,
      }),
    });
    const upJson = await upRes.json();
    if (!upRes.ok) throw new Error(upJson.error || ('HTTP ' + upRes.status));

    showToast('Signiert ✓ Lade Sie die .p7m-Datei jetzt im DAS-Portal hoch.');
    closeModal('signModal');
    
    _abState.activeAbrechnungId = abrechnungId;
    await renderExportStep();
    await loadAbrechnung();
    
    const step4Btn = document.getElementById('btn-wiz-step4');
    if (step4Btn) step4Btn.disabled = false;
    setWizardStep(4);
    
    openDasGuideModal(abrechnungId, 2);
  } catch (e) {
    console.error('[abrechnung/sign]', e);
    err.textContent = e.message || 'Signierung fehlgeschlagen.';
    stat.textContent = '';
    btn.disabled = false;
    btn.textContent = 'Signieren';
  }
}

async function createAbrechnung(kostentraegerIk) {
  if (_abState.busy) return;
  if (kostentraegerIk === '__unknown__') return;

  const checks = document.querySelectorAll(`.ab-rx-check[data-ik="${kostentraegerIk}"]:checked`);
  const prescriptionIds = [...checks].map(c => c.dataset.id);
  if (!prescriptionIds.length) {
    showToast('Bitte mindestens ein Rezept auswählen.', 'error');
    return;
  }

  const btn = document.getElementById('abGenerateDtaBtn');
  if (btn) { btn.disabled = true; btn.textContent = t('ab_creating'); }
  _abState.busy = true;

  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) throw new Error('Nicht angemeldet');

    const res = await fetch(`${API}/billing/abrechnung/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.access_token
      },
      body: JSON.stringify({
        ownerId: getOwnerId(),
        kostentraegerIk,
        prescriptionIds
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));

    showToast(t('ab_created'));
    _abState.activeAbrechnungId = json.abrechnungId;
    await renderExportStep();
    
    const step3Btn = document.getElementById('btn-wiz-step3');
    if (step3Btn) step3Btn.disabled = false;
    
    setWizardStep(3);
    await loadAbrechnung();
  } catch (e) {
    console.error('[abrechnung/create]', e);
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    _abState.busy = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Rechnung finalisieren & DTA erstellen ›'; }
  }
}

// ============================================================
// Fahrtenbuch Panel — Fahrzeuge / Fahrten / Berichte
// ============================================================

function fbActivateTab(tabName) {
  document.querySelectorAll('#panel-fahrtenbuch .tab-btn').forEach(btn => {
    const active = btn.dataset.fbTab === tabName;
    btn.classList.toggle('active', active);
    btn.style.borderBottomColor = active ? 'var(--primary, #1c4d8f)' : 'transparent';
    btn.style.fontWeight = active ? '600' : '400';
  });
  ['fahrten', 'vehicles', 'reports'].forEach(t => {
    const el = document.getElementById('fbTab' + t[0].toUpperCase() + t.slice(1));
    if (el) el.hidden = (t !== tabName);
  });
  if (tabName === 'fahrten') loadFbFahrten();
  if (tabName === 'vehicles') loadFbVehicles();
  if (tabName === 'reports') loadFbReports();
}

// Fahrtenbuch version stamp + global namespace (cache problem teşhisi için)
console.log('[fahrtenbuch] module loaded v=20260522f');
window.__fbVersion = '20260522f';
// Module-level addEventListener'lara güvenmiyoruz çünkü DOM hazır olmadan koşulan
// query'ler veya hot reload sırasında binding'ler kaçabilir.
if (!window.__fbDelegatedBound) {
  window.__fbDelegatedBound = true;
  const safe = async (label, fn) => {
    try { await fn(); }
    catch (err) {
      console.error('[fahrtenbuch:' + label + ']', err);
      if (typeof showToast === 'function') showToast(label + ': ' + (err?.message || err), 'error');
    }
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[id], [data-fb-tab]');
    if (!t) return;
    const id = t.id;
    // Fahrtenbuch panel
    if (id === 'fbVehicleAddBtn')   { e.preventDefault(); return safe('openVehicle',   () => openVehicleEditModal(null)); }
    if (id === 'vehEditSaveBtn')    { e.preventDefault(); return safe('saveVehicle',   saveVehicleEdit); }
    if (id === 'fbFahrtenRefresh')  { e.preventDefault(); return safe('refreshFahrten',loadFbFahrten); }
    if (id === 'fbFahrtenExportCsv'){ e.preventDefault(); return safe('exportCsv',     exportFbFahrtenCsv); }
    if (id === 'fbReportRefresh')   { e.preventDefault(); return safe('refreshReport', loadFbReports); }
    if (t.dataset && t.dataset.fbTab) { e.preventDefault(); return safe('switchTab',   () => fbActivateTab(t.dataset.fbTab)); }
    // Therapist flow (bkActionModal)
    if (id === 'bkActionFahrtStartBtn'){ e.preventDefault(); return safe('Fahrt Starten öffnen', openFahrtStartModal); }
    if (id === 'bkActionArrivedBtn')   { e.preventDefault(); return safe('Angekommen markieren', markArrivedHandler); }
    if (id === 'bkActionFahrtEndBtn')  { e.preventDefault(); return safe('Fahrt Beenden öffnen', openFahrtEndModal); }
    if (id === 'bkActionHbCopyBtn')    { e.preventDefault(); return safe('Kopieren',             copyHausbesuchAddress); }
    // Fahrt Start modal
    if (id === 'fsSaveBtn')         { e.preventDefault(); return safe('Fahrt speichern', saveFahrtStartHandler); }
    if (id === 'fsAddVehicleBtn')   { e.preventDefault(); return safe('Quick-Vehicle',  openQuickVehicleModal); }
    // Quick vehicle modal
    if (id === 'qvSaveBtn')         { e.preventDefault(); return safe('Fahrzeug speichern', saveQuickVehicleHandler); }
    // Fahrt End modal
    if (id === 'feSaveBtn')         { e.preventDefault(); return safe('Fahrt Ende speichern', saveFahrtEndHandler); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'vehEditKind') safe('kindHint', updateVehEditKindHint);
    if (e.target.id === 'feEndKm')     safe('endKmPreview', () => updateEndKmPreview(e.target.value));
  });
}

async function loadFahrtenbuchPanel() {
  const panel = document.getElementById('panel-fahrtenbuch');
  if (!panel) return;
  // Tab event'leri bir kez bağla — async fail durumunda flag set olmaması için
  // her binding'i try/catch içinde tut ve flag binding sonrasına koy.
  if (!panel.dataset.fbBound) {
    try {
      panel.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => fbActivateTab(btn.dataset.fbTab));
      });
      document.getElementById('fbFahrtenRefresh')?.addEventListener('click', loadFbFahrten);
      document.getElementById('fbFahrtenExportCsv')?.addEventListener('click', exportFbFahrtenCsv);
      document.getElementById('fbVehicleAddBtn')?.addEventListener('click', () => openVehicleEditModal(null));
      document.getElementById('vehEditSaveBtn')?.addEventListener('click', saveVehicleEdit);
      document.getElementById('vehEditKind')?.addEventListener('change', updateVehEditKindHint);
      document.getElementById('fbReportRefresh')?.addEventListener('click', loadFbReports);

      // Default filters
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const fromEl = document.getElementById('fbFahrtenFrom');
      const toEl = document.getElementById('fbFahrtenTo');
      const monthEl = document.getElementById('fbReportMonth');
      if (fromEl) fromEl.value = toISODate(monthStart);
      if (toEl) toEl.value = toISODate(today);
      if (monthEl) monthEl.value = today.toISOString().substring(0, 7);

      panel.dataset.fbBound = '1';
    } catch (e) {
      console.error('[loadFahrtenbuchPanel bind]', e);
    }
  }

  // Owner ise terapist filtresini her açılışta tazele (await burada — fail olsa bile flag etkilenmez)
  if (currentProfile?.role === 'owner') {
    try {
      const wrap = document.getElementById('fbFahrtenUserWrap');
      if (wrap) wrap.hidden = false;
      const sel = document.getElementById('fbFahrtenUser');
      if (sel && !sel.dataset.populated) {
        const { data: team } = await supabase.from('profiles')
          .select('id,owner_first_name,owner_last_name,email')
          .or(`id.eq.${currentSession.user.id},owner_id.eq.${currentSession.user.id}`);
        sel.innerHTML = '<option value="">— Alle —</option>' +
          (team || []).map(u => {
            const name = [u.owner_first_name, u.owner_last_name].filter(Boolean).join(' ') || u.email || u.id.slice(0, 8);
            return `<option value="${u.id}">${name}</option>`;
          }).join('');
        sel.addEventListener('change', loadFbFahrten);
        sel.dataset.populated = '1';
      }
    } catch (e) {
      console.warn('[loadFahrtenbuchPanel team]', e);
    }
  }

  fbActivateTab('fahrten');
}

// ---------- Fahrten tab ----------
async function loadFbFahrten() {
  const from = document.getElementById('fbFahrtenFrom').value;
  const to = document.getElementById('fbFahrtenTo').value;
  const userFilter = document.getElementById('fbFahrtenUser')?.value || '';

  let q = supabase.from('fahrten')
    .select('id,owner_id,user_id,booking_id,lead_id,vehicle_id,kennzeichen_snapshot,kind_snapshot,start_km,end_km,distance_km,estimated_duration_min,fahrt_started_at,fahrt_arrived_at,fahrt_ended_at,leads(first_name,last_name,title)')
    .order('fahrt_started_at', { ascending: false });
  if (from) q = q.gte('fahrt_started_at', from + 'T00:00:00Z');
  if (to) q = q.lte('fahrt_started_at', to + 'T23:59:59Z');
  if (userFilter) q = q.eq('user_id', userFilter);

  const { data, error } = await q;
  if (error) { console.error('[loadFbFahrten]', error); showToast('Fehler beim Laden.', 'error'); return; }

  // User name lookup (kim hangi terapist)
  const userIds = Array.from(new Set((data || []).map(f => f.user_id).filter(Boolean)));
  const userMap = {};
  if (userIds.length) {
    const { data: users } = await supabase.from('profiles')
      .select('id,owner_first_name,owner_last_name,email').in('id', userIds);
    (users || []).forEach(u => {
      userMap[u.id] = [u.owner_first_name, u.owner_last_name].filter(Boolean).join(' ') || u.email || u.id.slice(0, 8);
    });
  }

  const tbody = document.getElementById('fbFahrtenTbody');
  const empty = document.getElementById('fbFahrtenEmpty');
  if (!data || !data.length) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = data.map(f => {
    const dt = f.fahrt_started_at ? new Date(f.fahrt_started_at) : null;
    const dtStr = dt ? dt.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const patient = f.leads ? (f.leads.title || [f.leads.first_name, f.leads.last_name].filter(Boolean).join(' ')) : '—';
    const therapist = userMap[f.user_id] || '—';
    const duration = (f.fahrt_started_at && f.fahrt_ended_at)
      ? Math.round((new Date(f.fahrt_ended_at) - new Date(f.fahrt_started_at)) / 60000) + ' min'
      : '—';
    const art = f.kind_snapshot === 'gewerblich' ? '🏢 Gewerblich' : (f.kind_snapshot === 'privat' ? '🚙 Privat' : '—');
    return `<tr>
      <td>${dtStr}</td>
      <td>${escapeHtml(patient)}</td>
      <td>${escapeHtml(therapist)}</td>
      <td>${escapeHtml(f.kennzeichen_snapshot || '—')}</td>
      <td>${art}</td>
      <td>${f.start_km ?? '—'}</td>
      <td>${f.end_km ?? '—'}</td>
      <td>${f.distance_km != null ? f.distance_km + ' km' : '—'}</td>
      <td>${duration}</td>
    </tr>`;
  }).join('');
  // Cache for CSV export
  window._fbFahrtenCache = data.map(f => ({
    ...f,
    _patient: f.leads ? (f.leads.title || [f.leads.first_name, f.leads.last_name].filter(Boolean).join(' ')) : '',
    _therapist: userMap[f.user_id] || ''
  }));
}

function exportFbFahrtenCsv() {
  const rows = window._fbFahrtenCache || [];
  if (!rows.length) { showToast('Keine Daten zum Exportieren.', 'error'); return; }
  const header = ['Datum', 'Patient', 'Therapeut', 'Kennzeichen', 'Art', 'Start-KM', 'End-KM', 'Strecke (km)', 'Dauer (min)'];
  const lines = [header.join(';')];
  for (const f of rows) {
    const dt = f.fahrt_started_at ? new Date(f.fahrt_started_at).toLocaleString('de-DE') : '';
    const dur = (f.fahrt_started_at && f.fahrt_ended_at)
      ? Math.round((new Date(f.fahrt_ended_at) - new Date(f.fahrt_started_at)) / 60000)
      : '';
    lines.push([
      dt,
      `"${(f._patient || '').replace(/"/g, '""')}"`,
      `"${(f._therapist || '').replace(/"/g, '""')}"`,
      f.kennzeichen_snapshot || '',
      f.kind_snapshot || '',
      f.start_km ?? '',
      f.end_km ?? '',
      f.distance_km ?? '',
      dur
    ].join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fahrtenbuch_${new Date().toISOString().substring(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Fahrzeuge tab ----------
async function loadFbVehicles() {
  const ownerId = getOwnerId();
  const { data, error } = await supabase.from('vehicles')
    .select('id,owner_id,created_by,kind,kennzeichen,label,is_default,is_active,created_at')
    .eq('owner_id', ownerId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { console.error('[loadFbVehicles]', error); return; }

  const tbody = document.getElementById('fbVehiclesTbody');
  const empty = document.getElementById('fbVehiclesEmpty');
  if (!data || !data.length) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  const isOwner = currentProfile?.role === 'owner';
  const myUid = currentSession.user.id;
  tbody.innerHTML = data.map(v => {
    const art = v.kind === 'gewerblich' ? '🏢 Gewerblich' : '🚙 Privat';
    const canEdit = (isOwner) || (v.kind === 'privat' && v.created_by === myUid);
    const status = v.is_active ? '<span class="badge badge-green">aktiv</span>' : '<span class="badge badge-gray">inaktiv</span>';
    const def = v.is_default ? '⭐' : '';
    return `<tr data-vid="${v.id}">
      <td>${escapeHtml(v.kennzeichen)}</td>
      <td>${escapeHtml(v.label || '')}</td>
      <td>${art}</td>
      <td>${status}</td>
      <td>${def}</td>
      <td style="text-align:right;">
        ${canEdit ? '<button class="btn-ghost fb-veh-edit" data-vid="' + v.id + '" style="font-size:12px;padding:4px 8px;">Bearbeiten</button>' : ''}
        ${canEdit ? '<button class="btn-ghost fb-veh-del" data-vid="' + v.id + '" style="font-size:12px;padding:4px 8px;color:#c00;">Löschen</button>' : ''}
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.fb-veh-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = data.find(x => x.id === btn.dataset.vid);
      if (v) openVehicleEditModal(v);
    });
  });
  tbody.querySelectorAll('.fb-veh-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const v = data.find(x => x.id === btn.dataset.vid);
      if (!v) return;
      const ok = await showConfirmModal({
        title: 'Fahrzeug löschen?',
        message: `Kennzeichen: ${v.kennzeichen}\n\nFahrten-Logs bleiben erhalten (Kennzeichen wird im Log gespeichert).`,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        variant: 'danger'
      });
      if (!ok) return;
      const { error } = await supabase.from('vehicles').delete().eq('id', v.id);
      if (error) { showToast(error.message, 'error'); return; }
      showToast('Gelöscht.');
      loadFbVehicles();
    });
  });
}

function updateVehEditKindHint() {
  const kind = document.getElementById('vehEditKind').value;
  const hint = document.getElementById('vehEditKindHint');
  if (kind === 'gewerblich') {
    hint.textContent = 'Für alle Mitarbeiter sichtbar. Nur der Owner kann Gewerblich-Fahrzeuge anlegen/ändern.';
  } else {
    hint.textContent = 'Nur für die anlegende Person sichtbar (z.B. eigenes Privatauto).';
  }
}

function openVehicleEditModal(v) {
  const modal = document.getElementById('vehicleEditModal');
  if (!modal) {
    console.error('[fahrtenbuch] vehicleEditModal element nicht gefunden im DOM');
    showToast('Modal nicht geladen — bitte Seite neu laden (Strg+F5).', 'error');
    return;
  }
  const isOwner = currentProfile?.role === 'owner';
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal('vehEditId', v?.id || '');
  setVal('vehEditKennzeichen', v?.kennzeichen || '');
  setVal('vehEditLabel', v?.label || '');
  const titleEl = document.getElementById('vehEditTitle');
  if (titleEl) titleEl.textContent = v ? 'Fahrzeug bearbeiten' : 'Fahrzeug anlegen';
  const kindSel = document.getElementById('vehEditKind');
  if (kindSel) {
    kindSel.value = v?.kind || (isOwner ? 'gewerblich' : 'privat');
    Array.from(kindSel.options).forEach(opt => {
      opt.disabled = (opt.value === 'gewerblich' && !isOwner);
    });
    if (!isOwner) kindSel.value = 'privat';
  }
  const defEl = document.getElementById('vehEditIsDefault');
  if (defEl) defEl.checked = !!v?.is_default;
  const errEl = document.getElementById('vehEditError');
  if (errEl) errEl.style.display = 'none';
  updateVehEditKindHint();
  openModal('vehicleEditModal');
}

async function saveVehicleEdit() {
  const id = document.getElementById('vehEditId').value;
  const kennzeichen = document.getElementById('vehEditKennzeichen').value.trim();
  const label = document.getElementById('vehEditLabel').value.trim();
  const kind = document.getElementById('vehEditKind').value;
  const isDefault = document.getElementById('vehEditIsDefault').checked;
  const err = document.getElementById('vehEditError');
  err.style.display = 'none';
  if (!kennzeichen) { err.textContent = 'Kennzeichen erforderlich.'; err.style.display = ''; return; }

  const ownerId = getOwnerId();
  const userId = currentSession.user.id;
  const payload = { kennzeichen, label: label || null, kind, is_default: isDefault };

  let error;
  if (id) {
    ({ error } = await supabase.from('vehicles').update(payload).eq('id', id));
  } else {
    ({ error } = await supabase.from('vehicles').insert({ ...payload, owner_id: ownerId, created_by: userId }));
  }
  if (error) { err.textContent = error.message; err.style.display = ''; return; }

  // is_default seçildiyse diğer aynı kind araçların default'unu kaldır
  if (isDefault) {
    await supabase.from('vehicles').update({ is_default: false })
      .eq('owner_id', ownerId).eq('kind', kind).neq('id', id || '00000000-0000-0000-0000-000000000000');
    if (id) await supabase.from('vehicles').update({ is_default: true }).eq('id', id);
  }

  closeModal('vehicleEditModal');
  showToast('Gespeichert.');
  loadFbVehicles();
}

// ---------- Berichte tab ----------
async function loadFbReports() {
  const month = document.getElementById('fbReportMonth').value;
  if (!month) return;
  const [y, m] = month.split('-').map(n => parseInt(n));
  const monthStart = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(y, m, 1)).toISOString();

  // fahrten_monthly_summary view kullan
  const { data, error } = await supabase.from('fahrten_monthly_summary')
    .select('user_id,vehicle_id,kennzeichen_snapshot,kind_snapshot,trips,total_km,total_minutes,month')
    .gte('month', monthStart)
    .lt('month', monthEnd);
  if (error) { console.error('[loadFbReports]', error); return; }

  const userTbody = document.getElementById('fbReportByUserTbody');
  const vehTbody = document.getElementById('fbReportByVehicleTbody');
  const empty = document.getElementById('fbReportEmpty');

  if (!data || !data.length) {
    userTbody.innerHTML = ''; vehTbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // Aggregate by user
  const userIds = Array.from(new Set(data.map(r => r.user_id)));
  const { data: users } = await supabase.from('profiles')
    .select('id,owner_first_name,owner_last_name,email').in('id', userIds);
  const userMap = {};
  (users || []).forEach(u => {
    userMap[u.id] = [u.owner_first_name, u.owner_last_name].filter(Boolean).join(' ') || u.email || u.id.slice(0, 8);
  });

  const byUser = {};
  for (const r of data) {
    if (!byUser[r.user_id]) byUser[r.user_id] = { trips: 0, km: 0, min: 0 };
    byUser[r.user_id].trips += Number(r.trips || 0);
    byUser[r.user_id].km += Number(r.total_km || 0);
    byUser[r.user_id].min += Number(r.total_minutes || 0);
  }
  userTbody.innerHTML = Object.entries(byUser).map(([uid, agg]) => `
    <tr>
      <td>${escapeHtml(userMap[uid] || uid.slice(0,8))}</td>
      <td>${agg.trips}</td>
      <td>${agg.km.toFixed(1)} km</td>
      <td>${agg.min} min</td>
    </tr>
  `).join('');

  // Aggregate by vehicle
  const byVeh = {};
  for (const r of data) {
    const key = r.vehicle_id || ('snapshot:' + (r.kennzeichen_snapshot || 'unbekannt'));
    if (!byVeh[key]) byVeh[key] = { kennzeichen: r.kennzeichen_snapshot, kind: r.kind_snapshot, trips: 0, km: 0, min: 0 };
    byVeh[key].trips += Number(r.trips || 0);
    byVeh[key].km += Number(r.total_km || 0);
    byVeh[key].min += Number(r.total_minutes || 0);
  }
  vehTbody.innerHTML = Object.values(byVeh).map(v => `
    <tr>
      <td>${escapeHtml(v.kennzeichen || '—')}</td>
      <td>${v.kind === 'gewerblich' ? '🏢' : '🚙'} ${escapeHtml(v.kind || '—')}</td>
      <td>${v.trips}</td>
      <td>${v.km.toFixed(1)} km</td>
      <td>${v.min} min</td>
    </tr>
  `).join('');
}


// ============================================================
// Fahrtenbuch global namespace — inline onclick fallback (cache resilience)
// HTML butonlarına onclick="window.__fb.fahrtStart()" yazılabilir; bu sayede
// delegated handler bir sebepten ötürü kaçırsa bile flow çalışır.
// ============================================================
window.__fb = window.__fb || {};
Object.assign(window.__fb, {
  fahrtStart: () => openFahrtStartModal().catch(e => { console.error('[fb.fahrtStart]', e); showToast('Fahrt Starten: ' + (e?.message || e), 'error'); }),
  saveFahrtStart: () => saveFahrtStartHandler().catch(e => { console.error('[fb.saveFahrtStart]', e); showToast('Speichern: ' + (e?.message || e), 'error'); }),
  arrived: () => markArrivedHandler().catch(e => { console.error('[fb.arrived]', e); showToast('Angekommen: ' + (e?.message || e), 'error'); }),
  fahrtEnd: () => { try { openFahrtEndModal(); } catch (e) { console.error('[fb.fahrtEnd]', e); showToast('Fahrt Beenden: ' + (e?.message || e), 'error'); } },
  saveFahrtEnd: () => saveFahrtEndHandler().catch(e => { console.error('[fb.saveFahrtEnd]', e); showToast('End-KM: ' + (e?.message || e), 'error'); }),
  copyAddr: () => copyHausbesuchAddress().catch(e => { console.error('[fb.copyAddr]', e); }),
  addVehicle: () => { try { openVehicleEditModal(null); } catch (e) { console.error('[fb.addVehicle]', e); showToast('Fahrzeug: ' + (e?.message || e), 'error'); } },
  saveVehicle: () => Promise.resolve(saveVehicleEdit()).catch(e => { console.error('[fb.saveVehicle]', e); showToast('Speichern: ' + (e?.message || e), 'error'); }),
  quickAdd: () => { try { openQuickVehicleModal(); } catch (e) { console.error('[fb.quickAdd]', e); } },
  saveQuick: () => saveQuickVehicleHandler().catch(e => { console.error('[fb.saveQuick]', e); showToast('Fahrzeug: ' + (e?.message || e), 'error'); }),
});
console.log('[fahrtenbuch] window.__fb ready', Object.keys(window.__fb));

window.switchPanel = switchPanel;
window.setWizardStep = setWizardStep;
window.renderTaxierungList = renderTaxierungList;
window._abState = _abState;
window.openRezeptModal = openRezeptModal;
window.openRezeptConfirmModal = openRezeptConfirmModal;

// ============================================================================
// GoBD-Kassenbuch (Belegliste) UI Mechanics (Feature 4)
// ============================================================================

async function loadBelegliste() {
  const tbody = document.getElementById('beleglisteBody');
  const empty = document.getElementById('beleglisteEmpty');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const from = document.getElementById('blFilterFrom')?.value || '';
  const to = document.getElementById('blFilterTo')?.value || '';
  const type = document.getElementById('blFilterType')?.value || 'all';

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  // Use the Express backend endpoint to fetch and filter Belege
  const url = new URL(`${API}/billing/belegliste`);
  if (type !== 'all') url.searchParams.append('type', type);
  if (from) url.searchParams.append('from', from);
  if (to) url.searchParams.append('to', to);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Serverfehler');
    }

    const rows = await res.json();

    if (!rows || !rows.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    rows.forEach(r => {
      const dateStr = new Date(r.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
      const isNegative = Number(r.amount_eur) < 0;
      const color = isNegative ? '#b91c1c' : '#15803d';
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      
      const stornoBtn = r.type !== 'storno' 
        ? `<button class="btn-ghost btn-sm bl-storno-btn" data-nr="${r.beleg_nr}" data-val="${r.amount_eur}" data-ref="${escapeHtml(r.reference_text || '')}">Storno</button>`
        : '';

      tr.innerHTML = `
        <td style="font-family:monospace;font-weight:600;color:var(--text-main);">${String(r.beleg_nr).padStart(6, '0')}</td>
        <td style="color:var(--text-main);">${dateStr}</td>
        <td><span class="badge" style="background:var(--border);color:var(--text-main);">${r.type}</span></td>
        <td style="color:${color};font-weight:600;text-align:right;">${fmtEur(r.amount_eur)}</td>
        <td style="color:var(--text-main);">${escapeHtml(r.reference_text || '')}</td>
        <td style="color:var(--text-muted);">System</td>
        <td>${stornoBtn}</td>
      `;
      tbody.appendChild(tr);
    });

    // Wire Storno Event
    tbody.querySelectorAll('.bl-storno-btn').forEach(btn => {
      btn.addEventListener('click', () => triggerStorno(btn.dataset.nr, btn.dataset.val, btn.dataset.ref));
    });
  } catch (err) {
    showToast('Kassenbuch Fehler: ' + err.message, 'error');
  }
}

async function triggerStorno(belegNr, amount, originalRef) {
  const confirm = await showConfirmModal({
    title: 'Beleg Stornieren',
    message: `Sind Sie sicher, dass Sie den Beleg Nr. ${belegNr} stornieren möchten? Es wird eine Gegenbuchung von -${amount} € erzeugt.`,
    confirmText: 'Beleg Stornieren',
    variant: 'danger'
  });
  if (!confirm) return;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  try {
    const res = await fetch(`${API}/billing/belegliste`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'storno',
        amount_eur: -Number(amount),
        reference_text: `STORNO für Beleg-Nr: ${belegNr} (${originalRef})`
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Serverfehler');
    }

    showToast('Stornobuchung erzeugt ✓');
    loadBelegliste();
  } catch (err) {
    showToast('Storno gescheitert: ' + err.message, 'error');
  }
}

// Wire filters & actions once DOM is ready / loaded
function initBeleglisteUI() {
  document.getElementById('blFilterType')?.addEventListener('change', loadBelegliste);
  document.getElementById('blFilterFrom')?.addEventListener('change', loadBelegliste);
  document.getElementById('blFilterTo')?.addEventListener('change', loadBelegliste);

  document.getElementById('blExportCsvBtn')?.addEventListener('click', async () => {
    const from = document.getElementById('blFilterFrom')?.value || '';
    const to = document.getElementById('blFilterTo')?.value || '';
    const type = document.getElementById('blFilterType')?.value || 'all';

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    // Directly trigger a browser download for the CSV file
    const url = new URL(`${API}/billing/belegliste/export`);
    url.searchParams.append('token', token);
    if (type !== 'all') url.searchParams.append('type', type);
    if (from) url.searchParams.append('from', from);
    if (to) url.searchParams.append('to', to);

    window.open(url.toString(), '_blank');
  });

  document.getElementById('blAddManualBtn')?.addEventListener('click', () => {
    document.getElementById('blManualAmount').value = '';
    document.getElementById('blManualRef').value = '';
    openModal('manualBelegModal');
  });

  document.getElementById('blManualSaveBtn')?.addEventListener('click', async () => {
    const amount = Number(document.getElementById('blManualAmount').value);
    const ref = document.getElementById('blManualRef').value.trim();
    if (!amount || amount <= 0) return showToast('Betrag muss > 0 sein', 'error');
    if (!ref) return showToast('Referenztext erforderlich', 'error');

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    try {
      const res = await fetch(`${API}/billing/belegliste`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'barverkauf',
          amount_eur: amount,
          reference_text: ref
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Serverfehler');
      }

      closeModal('manualBelegModal');
      showToast('Beleg erfolgreich gebucht ✓');
      loadBelegliste();
    } catch (err) {
      showToast('Buchung gescheitert: ' + err.message, 'error');
    }
  });
}

// ============================================================================
// Mahnwesen (Dunning) UI
// ============================================================================

async function loadMahnwesen() {
  const tbody = document.getElementById('mahnwesenBody');
  const empty = document.getElementById('mahnwesenEmpty');
  const summary = document.getElementById('mwSummary');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Lade…</td></tr>';

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  try {
    const res = await fetch(`${API}/billing/mahnwesen/offene`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();

    tbody.innerHTML = '';
    if (!rows.length) {
      empty.hidden = false;
      summary.innerHTML = '<span style="color:#15803d;font-size:13px;">Alle Zuzahlungen beglichen ✓</span>';
      return;
    }
    empty.hidden = true;

    // Summary
    const totalOffen = rows.reduce((s, r) => s + Number(r.zuzahlung_eur), 0);
    const fmtEur = n => Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    summary.innerHTML = `
      <div><span style="font-size:11px;color:var(--text-muted);">Offen gesamt</span><br><strong style="color:#dc2626;">${fmtEur(totalOffen)}</strong></div>
      <div><span style="font-size:11px;color:var(--text-muted);">Patienten</span><br><strong>${rows.length}</strong></div>
    `;

    const LEVEL_LABELS = { 1: 'Erinnerung', 2: '1. Mahnung', 3: '2. Mahnung' };
    const LEVEL_COLORS = { 1: '#1d4ed8', 2: '#d97706', 3: '#dc2626' };

    rows.forEach(r => {
      const pname = `${escapeHtml(r.patient?.first_name || '')} ${escapeHtml(r.patient?.last_name || '')}`.trim();
      const lm = r.latest_mahnung;
      const nextLevel = lm ? Math.min(lm.level + 1, 3) : 1;
      const levelColor = lm ? LEVEL_COLORS[lm.level] : '#6b7280';
      const levelLabel = lm ? LEVEL_LABELS[lm.level] : '—';
      const statusBadge = lm
        ? `<span class="badge" style="background:${lm.status === 'bezahlt' ? '#dcfce7' : lm.status === 'abgeschrieben' ? '#f3f4f6' : '#fef3c7'};color:${lm.status === 'bezahlt' ? '#15803d' : lm.status === 'abgeschrieben' ? '#6b7280' : '#92400e'};">${escapeHtml(lm.status)}</span>`
        : '<span class="badge badge-gray">neu</span>';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${pname}</strong></td>
        <td style="text-align:right;font-weight:600;color:#dc2626;">${fmtEur(r.zuzahlung_eur)}</td>
        <td style="font-size:12px;color:var(--text-muted);">${lm ? new Date(lm.sent_at).toLocaleDateString('de-DE') : '—'}</td>
        <td><span style="color:${levelColor};font-weight:600;font-size:12px;">${levelLabel}</span></td>
        <td>${statusBadge}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn-ghost btn-sm mw-send-btn"
            data-rx="${r.id}"
            data-level="${nextLevel}"
            data-name="${escapeHtml(pname)}"
            style="font-size:12px;">
            ${LEVEL_LABELS[nextLevel]} senden
          </button>
          ${lm && lm.status === 'offen' ? `
            <button class="btn-ghost btn-sm mw-paid-btn" data-mw="${lm.id}" style="font-size:12px;color:#15803d;">✓ Bezahlt</button>
            <button class="btn-ghost btn-sm mw-write-off-btn" data-mw="${lm.id}" style="font-size:12px;color:#6b7280;">Abschreiben</button>
          ` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Send Mahnung
    tbody.querySelectorAll('.mw-send-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const level = parseInt(btn.dataset.level);
        btn.disabled = true;
        btn.textContent = 'Erstelle…';
        try {
          const res2 = await fetch(`${API}/billing/mahnwesen/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ prescriptionId: btn.dataset.rx, level })
          });
          if (!res2.ok) throw new Error(await res2.text());
          const html = await res2.text();
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(html);
            w.document.close();
            w.onload = () => w.print();
          } else {
            showToast('Popup-Blocker aktiv — bitte Popups erlauben.', 'error');
          }
          showToast('Mahnung erstellt ✓');
          loadMahnwesen();
        } catch (e) {
          showToast('Fehler: ' + e.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Erneut versuchen';
        }
      });
    });

    // Mark bezahlt / abgeschrieben
    const updateStatus = async (mahnungId, status) => {
      const res3 = await fetch(`${API}/billing/mahnwesen/${mahnungId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (!res3.ok) throw new Error(await res3.text());
      showToast(status === 'bezahlt' ? 'Als bezahlt markiert ✓' : 'Abgeschrieben ✓');
      loadMahnwesen();
    };

    tbody.querySelectorAll('.mw-paid-btn').forEach(btn => {
      btn.addEventListener('click', () => updateStatus(btn.dataset.mw, 'bezahlt').catch(e => showToast(e.message, 'error')));
    });
    tbody.querySelectorAll('.mw-write-off-btn').forEach(btn => {
      btn.addEventListener('click', () => updateStatus(btn.dataset.mw, 'abgeschrieben').catch(e => showToast(e.message, 'error')));
    });

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:#dc2626;padding:16px;">${escapeHtml(e.message)}</td></tr>`;
  }
}

async function loadStatistik() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  const monate = document.getElementById('statMonateSelect')?.value || 6;
  const fmtEur = n => Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  try {
    const res = await fetch(`${API}/billing/statistik?monate=${monate}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    const d = await res.json();

    // KPI
    setEl('statPatGesamt', d.patienten?.gesamt ?? '—');
    const neuPat = d.patienten?.neu_diesen_monat ?? 0;
    setEl('statPatNeu', neuPat > 0 ? `+${neuPat} diesen Monat` : 'Keine neuen diesen Monat');

    const sitzDiesen = d.sitzungen?.diesen_monat ?? 0;
    const sitzLetzt  = d.sitzungen?.letzten_monat ?? 0;
    setEl('statSitzDiesen', sitzDiesen);
    const deltaEl = document.getElementById('statSitzDelta');
    if (deltaEl) {
      const delta = sitzDiesen - sitzLetzt;
      deltaEl.textContent = delta === 0 ? 'gleich wie Vormonat' : (delta > 0 ? `+${delta} vs. Vormonat` : `${delta} vs. Vormonat`);
      deltaEl.style.color = delta >= 0 ? '#15803d' : '#dc2626';
    }

    setEl('statAbrAkz', d.abrechnung?.akzeptiert ?? '—');
    setEl('statAbrSumme', fmtEur(d.abrechnung?.summe_akzeptiert));
    setEl('statOffeneZuz', d.offene_zuzahlungen ?? '—');

    // Bar chart
    const chartEl = document.getElementById('statBarChart');
    const legendEl = document.getElementById('statBarLegend');
    if (!chartEl || !d.monatlich?.length) return;

    chartEl.innerHTML = '';
    legendEl.innerHTML = '';

    const maxVal = Math.max(...d.monatlich.map(m => m.umsatz), 1);
    const MO = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

    d.monatlich.forEach(m => {
      const pct = Math.max((m.umsatz / maxVal) * 100, m.umsatz > 0 ? 4 : 0);
      const [yr, mo] = m.monat.split('-');
      const label = `${MO[parseInt(mo) - 1]} ${yr.slice(2)}`;

      const col = document.createElement('div');
      col.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;min-width:28px;';

      const bar = document.createElement('div');
      bar.style.cssText = `width:100%;background:var(--primary);border-radius:4px 4px 0 0;height:${pct}%;min-height:${m.umsatz > 0 ? 4 : 0}px;transition:height 0.3s;cursor:default;`;
      bar.title = `${label}: ${fmtEur(m.umsatz)}`;

      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:9px;color:var(--text-muted);text-align:center;margin-top:4px;';
      lbl.textContent = label;

      col.appendChild(bar);
      col.appendChild(lbl);
      chartEl.appendChild(col);

      const leg = document.createElement('span');
      leg.style.cssText = 'font-size:11px;color:var(--text-muted);';
      leg.textContent = `${label}: ${fmtEur(m.umsatz)}`;
      legendEl.appendChild(leg);
    });

  } catch (e) {
    const chartEl = document.getElementById('statBarChart');
    if (chartEl) chartEl.innerHTML = `<span style="color:#dc2626;font-size:13px;">${escapeHtml(e.message)}</span>`;
  }
}

document.getElementById('statMonateSelect')?.addEventListener('change', () => {
  if (document.getElementById('panel-statistik')?.classList.contains('active')) loadStatistik();
});

// =====================================================================
// SCHNELLERFASSUNG — Hızlı Hasta Kaydı Mini-Modal
// =====================================================================
function initSchnellerfassung() {
  const modal = document.getElementById('schnellerfassungModal');
  if (!modal) return;

  const closeBtn = document.getElementById('schnellModalClose');
  const cancelBtn = document.getElementById('sfCancelBtn');
  const saveBtn = document.getElementById('sfSaveBtn');
  const errorEl = document.getElementById('sfError');

  function closeSchnellModal() {
    modal.hidden = true;
    // Alanları temizle
    ['sfVorname','sfNachname','sfGeburt','sfTelefon','sfGeschlecht'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    errorEl.style.display = 'none';
  }

  closeBtn?.addEventListener('click', closeSchnellModal);
  cancelBtn?.addEventListener('click', closeSchnellModal);

  saveBtn?.addEventListener('click', async () => {
    const vorname = (document.getElementById('sfVorname')?.value || '').trim();
    const nachname = (document.getElementById('sfNachname')?.value || '').trim();
    if (!vorname) {
      errorEl.textContent = 'Vorname ist Pflichtfeld.';
      errorEl.style.display = 'block';
      document.getElementById('sfVorname')?.focus();
      return;
    }
    const geburt = document.getElementById('sfGeburt')?.value || null;
    const telefon = (document.getElementById('sfTelefon')?.value || '').trim() || null;
    const geschlecht = document.getElementById('sfGeschlecht')?.value || null;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Speichere…';
    try {
      const ownerId = getOwnerId();
      const title = `${vorname} ${nachname}`.trim();
      const payload = {
        owner_id: ownerId,
        title,
        first_name: vorname,
        last_name: nachname,
        phone: telefon,
        geschlecht,
      };
      if (geburt) {
        payload.metadata = { geburtsdatum: geburt };
      }
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;

      // Leads listesini güncelle ve yeni lead'i seç
      // loadBkLeads initBkCustomerAutocomplete içinde tanımlı; window üzerinden erişemeyiz.
      // Direkt yüklüyoruz:
      const { data: freshLeads } = await supabase
        .from('leads')
        .select('id,title,first_name,last_name,phone,metadata,street,plz,city,lat,lng,distance_km,duration_min,route_calculated_at')
        .eq('owner_id', ownerId)
        .order('title');
      window.bkAllLeads = freshLeads || [];

      if (window.bkSelectLead) window.bkSelectLead(newLead.id);
      closeSchnellModal();
      showToast(`✓ ${title} erfasst und eingetragen`, 'success');
    } catch (err) {
      errorEl.textContent = 'Fehler: ' + (err.message || 'Unbekannt');
      errorEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '⚡ Speichern & in Termin eintragen';
    }
  });

  // ESC ile kapat
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSchnellModal();
  });
}

// =====================================================================
// COMPACT MODE — Yoğun Görünüm
// =====================================================================
function initCompactMode() {
  const toggle = document.getElementById('compactModeToggle');
  if (!toggle) return;

  const STORAGE_KEY = 'infinitymade_compact_mode';

  function applyCompact(enabled) {
    if (enabled) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }
  }

  // Kaydedilmiş tercihi yükle
  const saved = localStorage.getItem(STORAGE_KEY) === 'true';
  toggle.checked = saved;
  applyCompact(saved);

  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    localStorage.setItem(STORAGE_KEY, enabled);
    applyCompact(enabled);
    showToast(enabled ? 'Kompakter Modus aktiviert' : 'Kompakter Modus deaktiviert');
  });
}

// Init çağrıları — DOMContentLoaded'dan sonra
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initSchnellerfassung();
    initCompactMode();
    initWlModal();
    initDruckeinstellungen();
  });
} else {
  initSchnellerfassung();
  initCompactMode();
  initWlModal();
  initDruckeinstellungen();
}

// =====================================================================
// WARTELISTE — Bekleme Listesi Yönetimi
// =====================================================================
async function loadWarteliste() {
  const tbody = document.getElementById('wlTableBody');
  const emptyEl = document.getElementById('wlEmpty');
  const summaryEl = document.getElementById('wlSummary');
  if (!tbody) return;

  const ownerId = getOwnerId();
  const { data: entries, error } = await supabase
    .from('warteliste')
    .select(`
      id, preferred_days, preferred_time_from, preferred_time_to,
      priority, status, created_at, notes,
      leads:lead_id(id, title, first_name, last_name),
      services:service_id(id, title)
    `)
    .eq('owner_id', ownerId)
    .eq('status', 'waiting')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) { showToast('Fehler beim Laden der Warteliste: ' + error.message, 'error'); return; }

  const rows = entries || [];
  if (summaryEl) {
    summaryEl.innerHTML = `<span style="font-size:13px;"><strong>${rows.length}</strong> Patient${rows.length !== 1 ? 'en' : ''} auf der Warteliste</span>`;
  }

  if (rows.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const PRIORITY_LABELS = { 1: 'Normal', 2: '<span style="color:#f59e0b;font-weight:600;">Hoch</span>', 3: '<span style="color:#dc2626;font-weight:700;">Dringend</span>' };

  tbody.innerHTML = rows.map(e => {
    const patName = e.leads ? `${e.leads.first_name || ''} ${e.leads.last_name || ''}`.trim() || e.leads.title : '—';
    const srvName = e.services?.title || '—';
    const days = Array.isArray(e.preferred_days) ? e.preferred_days.join(', ') || 'Egal' : 'Egal';
    const time = (e.preferred_time_from && e.preferred_time_to)
      ? `${e.preferred_time_from.slice(0,5)} – ${e.preferred_time_to.slice(0,5)}`
      : 'Egal';
    const prio = PRIORITY_LABELS[e.priority] || 'Normal';
    const since = new Date(e.created_at).toLocaleDateString('de-DE');
    return `<tr>
      <td><strong>${patName}</strong></td>
      <td>${srvName}</td>
      <td>${days}</td>
      <td>${time}</td>
      <td>${prio}</td>
      <td style="color:var(--text-muted);font-size:12px;">${since}</td>
      <td>
        <button class="btn-ghost" style="font-size:12px;padding:3px 8px;" onclick="openWlEntry('${e.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Bearbeiten
        </button>
      </td>
    </tr>`;
  }).join('');
}

window.openWlEntry = async function(id) {
  const modal = document.getElementById('wlModal');
  if (!modal) return;
  document.getElementById('wlEntryId').value = id;
  document.getElementById('wlModalTitle').textContent = 'Warteliste — Eintrag bearbeiten';
  document.getElementById('wlDeleteBtn').hidden = false;

  const ownerId = getOwnerId();
  const { data: e } = await supabase.from('warteliste')
    .select('*, leads:lead_id(id,title,first_name,last_name), services:service_id(id,title)')
    .eq('id', id).eq('owner_id', ownerId).single();
  if (!e) return;

  document.getElementById('wlPatientSearch').value = e.leads
    ? `${e.leads.first_name || ''} ${e.leads.last_name || ''}`.trim() || e.leads.title : '';
  document.getElementById('wlPatientId').value = e.lead_id || '';
  document.getElementById('wlService').value = e.service_id || '';
  document.getElementById('wlTimeFrom').value = e.preferred_time_from?.slice(0,5) || '08:00';
  document.getElementById('wlTimeTo').value = e.preferred_time_to?.slice(0,5) || '18:00';
  document.getElementById('wlPriority').value = e.priority || 1;
  document.getElementById('wlNotes').value = e.notes || '';
  // Günleri seç
  document.querySelectorAll('.wlDay').forEach(cb => {
    cb.checked = Array.isArray(e.preferred_days) && e.preferred_days.includes(cb.value);
  });
  modal.hidden = false;
};

async function openNewWlEntry() {
  const modal = document.getElementById('wlModal');
  if (!modal) return;
  document.getElementById('wlEntryId').value = '';
  document.getElementById('wlModalTitle').textContent = 'Warteliste — Neuer Eintrag';
  document.getElementById('wlDeleteBtn').hidden = true;
  document.getElementById('wlPatientSearch').value = '';
  document.getElementById('wlPatientId').value = '';
  document.getElementById('wlService').value = '';
  document.getElementById('wlTimeFrom').value = '08:00';
  document.getElementById('wlTimeTo').value = '18:00';
  document.getElementById('wlPriority').value = '1';
  document.getElementById('wlNotes').value = '';
  document.querySelectorAll('.wlDay').forEach(cb => cb.checked = false);
  modal.hidden = false;
  await initWlPatientAutocomplete();
  await populateWlServices();
}

async function populateWlServices() {
  const sel = document.getElementById('wlService');
  if (!sel || sel.options.length > 1) return;
  const ownerId = getOwnerId();
  const { data: srvs } = await supabase.from('services').select('id,title').eq('owner_id', ownerId).order('title');
  (srvs || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.title;
    sel.appendChild(opt);
  });
}

async function initWlPatientAutocomplete() {
  const input = document.getElementById('wlPatientSearch');
  const list = document.getElementById('wlPatientList');
  const idH = document.getElementById('wlPatientId');
  if (!input || !list || !idH) return;
  if (input.dataset.wlBound) return;
  input.dataset.wlBound = '1';

  const ownerId = getOwnerId();
  const { data: leads } = await supabase.from('leads')
    .select('id,title,first_name,last_name').eq('owner_id', ownerId).order('title');
  const allLeads = leads || [];

  function renderWlList(q) {
    const filtered = q ? allLeads.filter(l => {
      const n = `${l.first_name||''} ${l.last_name||''} ${l.title||''}`.toLowerCase();
      return n.includes(q.toLowerCase());
    }) : allLeads.slice(0, 20);
    list.innerHTML = filtered.map(l => {
      const name = `${l.first_name||''} ${l.last_name||''}`.trim() || l.title;
      return `<li data-id="${l.id}">${name}</li>`;
    }).join('');
    list.hidden = false;
  }

  input.addEventListener('input', () => renderWlList(input.value));
  input.addEventListener('focus', () => renderWlList(input.value));
  list.addEventListener('mousedown', e => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    e.preventDefault();
    input.value = li.textContent;
    idH.value = li.dataset.id;
    list.hidden = true;
  });
  document.addEventListener('mousedown', e => {
    if (!document.getElementById('wlPatientWrap')?.contains(e.target)) list.hidden = true;
  });
}

function initWlModal() {
  const addBtn = document.getElementById('wlAddBtn');
  const saveBtn = document.getElementById('wlSaveBtn');
  const deleteBtn = document.getElementById('wlDeleteBtn');

  addBtn?.addEventListener('click', openNewWlEntry);

  saveBtn?.addEventListener('click', async () => {
    const id = document.getElementById('wlEntryId').value;
    const patientId = document.getElementById('wlPatientId').value;
    if (!patientId) { showToast('Bitte Patient auswählen', 'error'); return; }
    const days = [...document.querySelectorAll('.wlDay:checked')].map(cb => cb.value);
    const payload = {
      owner_id: getOwnerId(),
      lead_id: patientId,
      service_id: document.getElementById('wlService').value || null,
      preferred_days: days,
      preferred_time_from: document.getElementById('wlTimeFrom').value || null,
      preferred_time_to: document.getElementById('wlTimeTo').value || null,
      priority: parseInt(document.getElementById('wlPriority').value) || 1,
      notes: document.getElementById('wlNotes').value || null,
      status: 'waiting',
    };
    const { error } = id
      ? await supabase.from('warteliste').update(payload).eq('id', id)
      : await supabase.from('warteliste').insert(payload);
    if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
    document.getElementById('wlModal').hidden = true;
    showToast('Warteliste aktualisiert');
    await loadWarteliste();
  });

  deleteBtn?.addEventListener('click', async () => {
    const id = document.getElementById('wlEntryId').value;
    if (!id || !confirm('Eintrag wirklich löschen?')) return;
    await supabase.from('warteliste').delete().eq('id', id);
    document.getElementById('wlModal').hidden = true;
    showToast('Eintrag gelöscht');
    await loadWarteliste();
  });
}

// =====================================================================
// DRUCKEINSTELLUNGEN — Milimetrik Baskı Hizalama
// =====================================================================
function initDruckeinstellungen() {
  const STORAGE_KEY = 'infinitymade_print_offset';
  const xSlider = document.getElementById('offsetXSlider');
  const ySlider = document.getElementById('offsetYSlider');
  const xVal = document.getElementById('offsetXVal');
  const yVal = document.getElementById('offsetYVal');
  const adressBox = document.getElementById('druckAdressBox');
  const resetBtn = document.getElementById('druckResetBtn');
  const saveBtn = document.getElementById('druckSaveBtn');
  const openBtn = document.getElementById('openDruckModalBtn');
  if (!xSlider || !ySlider) return;

  openBtn?.addEventListener('click', () => openModal('druckModal'));

  // Kayıtlı değerleri yükle
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch {}
  xSlider.value = saved.x ?? 0;
  ySlider.value = saved.y ?? 0;

  function updatePreview() {
    const x = parseFloat(xSlider.value);
    const y = parseFloat(ySlider.value);
    if (xVal) xVal.textContent = (x >= 0 ? '+' : '') + x;
    if (yVal) yVal.textContent = (y >= 0 ? '+' : '') + y;
    if (adressBox) {
      // 1mm ~ 2px approximately for preview
      adressBox.style.transform = `translate(${x * 2}px, ${y * 2}px)`;
    }
  }

  [xSlider, ySlider].forEach(el => el.addEventListener('input', updatePreview));
  updatePreview();

  resetBtn?.addEventListener('click', () => {
    xSlider.value = 0;
    ySlider.value = 0;
    updatePreview();
  });

  saveBtn?.addEventListener('click', () => {
    const offset = {
      x: parseFloat(xSlider.value),
      y: parseFloat(ySlider.value)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(offset));
    document.getElementById('druckModal').hidden = true;
    showToast('Druckeinstellungen gespeichert ✓');
  });
}

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
    currentProfile = profile || { id: session.user.id, email: session.user.email, plan: 'starter', role: 'owner', is_active: true };
    if (currentProfile.language && !localStorage.getItem('infinity_lang')) currentLang = currentProfile.language;

    if (currentProfile.role !== 'owner' && currentProfile.owner_id) {
      const { data: owner, error: ownerErr } = await supabase.from('profiles').select('sector,has_dta_pro').eq('id', currentProfile.owner_id).maybeSingle();
      if (ownerErr) console.error('[ownerProfile]', ownerErr);
      if (owner) {
        ownerProfile = owner;
        if (!currentProfile.sector || currentProfile.sector === 'default') {
          currentProfile.sector = owner.sector || 'default';
        }
      }
      console.log('[boot] owner_id=', currentProfile.owner_id, 'ownerProfile=', ownerProfile, 'currentProfile.sector=', currentProfile.sector);
    } else {
      console.log('[boot] skipping owner fetch. role=', currentProfile.role, 'owner_id=', currentProfile.owner_id);
    }

    await init();
  } catch (e) {
    console.error('[boot]', e);
    window.location.href = 'login.html';
  }
})();

