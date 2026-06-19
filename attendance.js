import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/supabase-config.js';

const API_BASE = 'https://n8n.infinitymade.de/api';
const BERLIN_TZ = 'Europe/Berlin';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- DOM refs ----
const $ = (id) => document.getElementById(id);
const loadingEl   = $('loading');
const appEl       = $('app');
const attDate     = $('attDate');
const attGreeting = $('attGreeting');
const attBadge    = $('attBadge');
const attBadgeIcon= $('attBadgeIcon');
const attBadgeText= $('attBadgeText');
const attTimes    = $('attTimes');
const attCheckIn  = $('attCheckIn');
const attCheckOut = $('attCheckOut');
const attDuration = $('attDuration');
const attMsg      = $('attMsg');
const gpsHint     = $('gpsHint');
const gpsHintText = $('gpsHintText');
const btnCheckIn  = $('btnCheckIn');
const btnCheckOut = $('btnCheckOut');
const spinIn      = $('spinIn');
const spinOut     = $('spinOut');
const btnCheckInLabel  = $('btnCheckInLabel');
const btnCheckOutLabel = $('btnCheckOutLabel');
const bizSelect   = $('bizSelect');
const historyCard = $('historyCard');
const historyList = $('historyList');

let currentUser = null;
let selectedBizId = null;
let todayRecord = null;

// ---- Yardımcılar ----
function formatTime(isoStr) {
  if (!isoStr) return '—';
  return new Intl.DateTimeFormat('de-DE', { timeZone: BERLIN_TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(isoStr));
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat('de-DE', { timeZone: BERLIN_TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(isoDate + 'T12:00:00Z'));
}

function formatShortDate(isoDate) {
  return new Intl.DateTimeFormat('de-DE', { timeZone: BERLIN_TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(isoDate + 'T12:00:00Z'));
}

function formatDuration(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '';
  const diffMs = new Date(checkOut) - new Date(checkIn);
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return `${h}h ${m}m gearbeitet`;
}

function greeting() {
  const h = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: BERLIN_TZ, hour: 'numeric', hour12: false }).format(new Date()), 10);
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function showMsg(text, type = 'success') {
  attMsg.textContent = text;
  attMsg.className = `att-msg ${type}`;
  setTimeout(() => { attMsg.className = 'att-msg'; }, 4000);
}

function setLoading(btn, spin, label, text, isLoading) {
  btn.disabled = isLoading;
  spin.style.display = isLoading ? 'block' : 'none';
  label.textContent = isLoading ? '…' : text;
}

// ---- API çağrıları ----
async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function fetchToday() {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/attendance/today`, { headers });
  if (!res.ok) throw new Error('Heute-Status konnte nicht geladen werden');
  return res.json();
}

async function fetchHistory() {
  const headers = await authHeaders();
  // Son 7 günün employee-bazlı kaydını doğrudan Supabase'den çek
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const dateFrom = from.toISOString().slice(0, 10);
  const dateTo = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('attendance')
    .select('date, check_in_at, check_out_at, status')
    .eq('employee_id', currentUser.id)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchBusinesses() {
  const { data: profile } = await supabase.from('profiles').select('owner_id, role').eq('id', currentUser.id).single();
  const ownerId = profile?.role === 'owner' ? currentUser.id : profile?.owner_id;
  if (!ownerId) return [];
  const { data } = await supabase.from('businesses').select('id, business_name').eq('owner_id', ownerId);
  return data || [];
}

// ---- UI güncelle ----
function renderStatus(record) {
  todayRecord = record;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN_TZ }).format(new Date());
  attDate.textContent = formatDate(today);
  attGreeting.textContent = greeting();

  attBadge.className = 'att-badge';
  attTimes.style.display = 'none';
  btnCheckIn.style.display = 'block';
  btnCheckOut.style.display = 'none';
  btnCheckIn.disabled = false;
  btnCheckOut.disabled = false;

  if (!record) {
    attBadge.classList.add('not-in');
    attBadgeIcon.textContent = '○';
    attBadgeText.textContent = 'Noch nicht eingecheckt';
    btnCheckInLabel.textContent = '↓ Einchecken';
    return;
  }

  attTimes.style.display = 'flex';
  attCheckIn.textContent = formatTime(record.check_in_at);
  attCheckOut.textContent = formatTime(record.check_out_at);
  attDuration.textContent = record.check_out_at ? formatDuration(record.check_in_at, record.check_out_at) : '';

  if (record.check_out_at) {
    attBadge.classList.add('done');
    attBadgeIcon.textContent = '✓';
    attBadgeText.textContent = 'Arbeitstag abgeschlossen';
    btnCheckIn.style.display = 'none';
    btnCheckOut.style.display = 'none';
    return;
  }

  if (record.status === 'late') {
    attBadge.classList.add('late');
    attBadgeIcon.textContent = '⏰';
    attBadgeText.textContent = 'Eingecheckt (verspätet)';
  } else {
    attBadge.classList.add('present');
    attBadgeIcon.textContent = '●';
    attBadgeText.textContent = 'Eingecheckt';
  }

  btnCheckIn.style.display = 'none';
  btnCheckOut.style.display = 'block';
  btnCheckOutLabel.textContent = '↑ Auschecken';
}

function renderHistory(records) {
  if (!records.length) return;
  historyCard.style.display = 'block';
  historyList.innerHTML = records.map((r) => {
    const dotClass = {
      present: 'dot-present',
      late: 'dot-late',
      incomplete: 'dot-incomplete',
      absent: 'dot-absent',
    }[r.status] || 'dot-absent';

    const timeStr = r.check_in_at
      ? `${formatTime(r.check_in_at)} – ${r.check_out_at ? formatTime(r.check_out_at) : '—'}`
      : '—';

    const dur = formatDuration(r.check_in_at, r.check_out_at);

    return `
      <div class="att-history-row">
        <div class="att-history-dot ${dotClass}"></div>
        <div class="att-history-date">${formatShortDate(r.date)}</div>
        <div class="att-history-times">${timeStr}</div>
        <div class="att-history-dur">${dur}</div>
      </div>
    `;
  }).join('');
}

// ---- GPS al ----
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS wird von diesem Gerät nicht unterstützt'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === 1) reject(new Error('GPS-Berechtigung verweigert. Bitte Standort-Zugriff erlauben.'));
        else reject(new Error('Standort konnte nicht ermittelt werden. Bitte erneut versuchen.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// ---- Check-in ----
btnCheckIn.addEventListener('click', async () => {
  setLoading(btnCheckIn, spinIn, btnCheckInLabel, '↓ Einchecken', true);
  gpsHintText.textContent = 'Standort wird ermittelt …';
  gpsHint.className = 'att-gps-hint';

  try {
    const { lat, lng } = await getLocation();
    gpsHintText.textContent = 'Standort ermittelt ✓';

    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ business_id: selectedBizId, lat, lng }),
    });

    const data = await res.json();

    if (res.status === 409) {
      showMsg('Heute bereits eingecheckt.', 'success');
    } else if (!res.ok) {
      throw new Error(data.error || 'Check-in fehlgeschlagen');
    } else {
      if (data.gps_checked && !data.check_in_valid) {
        showMsg('⚠️ Check-in gespeichert, aber Standort außerhalb des Bereichs.', 'error');
      } else {
        showMsg('✓ Erfolgreich eingecheckt!', 'success');
      }
    }

    // Durumu yenile
    const { record } = await fetchToday();
    renderStatus(record);
  } catch (err) {
    gpsHint.className = 'att-gps-hint error';
    gpsHintText.textContent = err.message;
    showMsg(err.message, 'error');
  } finally {
    setLoading(btnCheckIn, spinIn, btnCheckInLabel, '↓ Einchecken', false);
  }
});

// ---- Check-out ----
btnCheckOut.addEventListener('click', async () => {
  setLoading(btnCheckOut, spinOut, btnCheckOutLabel, '↑ Auschecken', true);

  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/attendance/check-out`, {
      method: 'POST',
      headers,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check-out fehlgeschlagen');

    showMsg('✓ Auf Wiedersehen! Check-out gespeichert.', 'success');
    const { record } = await fetchToday();
    renderStatus(record);

    // Geçmişi yenile
    const hist = await fetchHistory();
    renderHistory(hist);
  } catch (err) {
    showMsg(err.message, 'error');
  } finally {
    setLoading(btnCheckOut, spinOut, btnCheckOutLabel, '↑ Auschecken', false);
  }
});

// ---- İşyeri seçimi ----
bizSelect.addEventListener('change', () => {
  selectedBizId = bizSelect.value;
  btnCheckIn.disabled = !selectedBizId;
});

// ---- Init ----
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    return;
  }
  currentUser = session.user;

  try {
    // İşyerlerini yükle
    const businesses = await fetchBusinesses();
    if (businesses.length > 1) {
      bizSelect.style.display = 'block';
      bizSelect.innerHTML = '<option value="">— Standort wählen —</option>' +
        businesses.map((b) => `<option value="${b.id}">${b.business_name}</option>`).join('');
      btnCheckIn.disabled = true;
    } else if (businesses.length === 1) {
      selectedBizId = businesses[0].id;
    }

    // Bugünkü durum
    const { record } = await fetchToday();
    renderStatus(record);

    // Geçmiş
    const hist = await fetchHistory();
    renderHistory(hist);
  } catch (err) {
    console.error('[attendance init]', err);
    showMsg('Fehler beim Laden. Bitte Seite neu laden.', 'error');
  } finally {
    loadingEl.style.display = 'none';
    appEl.style.display = 'block';
  }
}

init();
