// Praxura Ops-Dashboard — Fahrtenbuch & Kfz-Kosten Modul (GoBD & EÜR)
// Rechtsträger: Einzelunternehmen Yavuz Kemal Demir
import { sb, state, $, $$, esc, toast, fail, fmtDate, openModal, closeModal, confirmDialog } from './app.js?v=20260811a';

let vehicles = [];
let entries = [];
let costs = [];
let selectedVehicleId = null;
let selectedYear = new Date().getFullYear().toString();
let selectedMonth = 'all';
let selectedTripType = 'all';
let activeSubTab = 'trips'; // 'trips' | 'costs' | 'vehicles'

export async function renderFahrtenbuch(root) {
  root.innerHTML = `
    <div class="finance-header-bar">
      <div>
        <div class="finance-eyebrow">KFZ-KOSTEN & FAHRTENBUCH</div>
        <h2 class="finance-title">🚗 Fahrtenbuch & Fahrzeugkosten</h2>
      </div>
      <div class="f-header-actions">
        <select id="fb_year_filter" class="f-select-compact">
          <option value="2026" ${selectedYear === '2026' ? 'selected' : ''}>2026</option>
          <option value="2025" ${selectedYear === '2025' ? 'selected' : ''}>2025</option>
          <option value="2027" ${selectedYear === '2027' ? 'selected' : ''}>2027</option>
        </select>
        <button id="fb_export_btn" class="f-btn f-btn-secondary">📥 Fahrtenbuch Export (CSV/EÜR)</button>
        <button id="fb_add_trip_btn" class="f-btn f-btn-primary">+ Neue Fahrt</button>
      </div>
    </div>

    <!-- Vehicle Selector & Sub-Tabs -->
    <div class="fb-controls-row">
      <div class="fb-vehicle-select-group">
        <label for="fb_vehicle_select">Fahrzeug:</label>
        <select id="fb_vehicle_select" class="f-select" style="min-width: 260px;">
          <option value="">Lade Fahrzeuge...</option>
        </select>
        <button id="fb_add_vehicle_btn" class="btn btn-ghost" title="Fahrzeug bearbeiten / hinzufügen" style="padding: 6px 10px;">⚙️ Fahrzeug verwalten</button>
      </div>

      <div class="fb-sub-tabs">
        <button class="fb-sub-tab-btn ${activeSubTab === 'trips' ? 'active' : ''}" data-tab="trips">🗺️ Fahrten</button>
        <button class="fb-sub-tab-btn ${activeSubTab === 'costs' ? 'active' : ''}" data-tab="costs">⛽ Kfz-Kosten</button>
        <button class="fb-sub-tab-btn ${activeSubTab === 'vehicles' ? 'active' : ''}" data-tab="vehicles">🚘 Fahrzeuge</button>
      </div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="finance-kpis-grid" id="fb_kpi_grid">
      <div class="f-kpi-card">
        <div class="f-kpi-label">Gesamtstrecke (${selectedYear})</div>
        <div class="f-kpi-val" id="fb_kpi_total_km">0 km</div>
        <div class="f-kpi-sub" id="fb_kpi_trips_count">0 Fahrten erfasst</div>
      </div>
      <div class="f-kpi-card" style="border-left: 3px solid #10b981;">
        <div class="f-kpi-label">Geschäftliche Fahrten</div>
        <div class="f-kpi-val" id="fb_kpi_business_km" style="color: #10b981;">0 km</div>
        <div class="f-kpi-sub" id="fb_kpi_business_pct">0% Anteil</div>
      </div>
      <div class="f-kpi-card" style="border-left: 3px solid #f59e0b;">
        <div class="f-kpi-label">Arbeitsweg (Wohnung ↔ Betrieb)</div>
        <div class="f-kpi-val" id="fb_kpi_commute_km" style="color: #f59e0b;">0 km</div>
        <div class="f-kpi-sub" id="fb_kpi_commute_pct">0% Anteil</div>
      </div>
      <div class="f-kpi-card" style="border-left: 3px solid #6366f1;">
        <div class="f-kpi-label">EÜR-Betriebsausgabe (Kfz)</div>
        <div class="f-kpi-val" id="fb_kpi_euer_deduction" style="color: #6366f1;">0,00 €</div>
        <div class="f-kpi-sub" id="fb_kpi_deduction_basis">Kilometersatz (0,30 €/km)</div>
      </div>
    </div>

    <!-- Main Content Container based on Active Tab -->
    <div id="fb_main_content"></div>
  `;

  bindEvents(root);
  await loadVehicles();
  await loadEntriesAndCosts();
}

function bindEvents(root) {
  // Year filter
  root.querySelector('#fb_year_filter')?.addEventListener('change', async (e) => {
    selectedYear = e.target.value;
    await loadEntriesAndCosts();
  });

  // Vehicle select
  root.querySelector('#fb_vehicle_select')?.addEventListener('change', (e) => {
    selectedVehicleId = e.target.value;
    renderSubTabContent();
    updateKPIs();
  });

  // Top Buttons
  root.querySelector('#fb_add_trip_btn')?.addEventListener('click', () => openTripModal(null));
  root.querySelector('#fb_add_vehicle_btn')?.addEventListener('click', () => {
    const curVeh = vehicles.find(v => v.id === selectedVehicleId);
    openVehicleModal(curVeh || null);
  });
  root.querySelector('#fb_export_btn')?.addEventListener('click', exportFahrtenbuchData);

  // Sub-tabs
  root.querySelectorAll('.fb-sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.fb-sub-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSubTab = btn.dataset.tab;
      renderSubTabContent();
    });
  });
}

async function loadVehicles() {
  try {
    const { data, error } = await sb
      .from('ops_fahrtenbuch_vehicles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    vehicles = data || [];

    // If no vehicle exists, seed default vehicle
    if (vehicles.length === 0) {
      const { data: seeded, error: seedErr } = await sb
        .from('ops_fahrtenbuch_vehicles')
        .insert([{
          license_plate: 'K-KD 2026',
          make_model: 'Kemal PKW (Privatfahrzeug)',
          year: 2024,
          fuel_type: 'benzin',
          ownership_type: 'privat_genutzt',
          initial_odometer: 0,
          is_active: true
        }])
        .select();
      if (!seedErr && seeded) {
        vehicles = seeded;
      }
    }

    const select = document.getElementById('fb_vehicle_select');
    if (select) {
      select.innerHTML = vehicles.map(v => `
        <option value="${v.id}" ${v.id === selectedVehicleId ? 'selected' : ''}>
          ${esc(v.license_plate)} — ${esc(v.make_model)} (${v.ownership_type === 'privat_genutzt' ? 'Privat-Kfz (0,30 €/km)' : 'Firmenwagen'})
        </option>
      `).join('');

      if (!selectedVehicleId && vehicles.length > 0) {
        selectedVehicleId = vehicles[0].id;
        select.value = selectedVehicleId;
      }
    }
  } catch (err) {
    console.error('Error loading vehicles:', err);
  }
}

async function loadEntriesAndCosts() {
  try {
    const { data: tripData, error: tripErr } = await sb
      .from('ops_fahrtenbuch_entries')
      .select('*')
      .order('trip_date', { ascending: false })
      .order('odometer_start', { ascending: false });

    if (tripErr) throw tripErr;
    entries = tripData || [];

    const { data: costData, error: costErr } = await sb
      .from('ops_fahrtenbuch_costs')
      .select('*')
      .order('cost_date', { ascending: false });

    if (costErr) throw costErr;
    costs = costData || [];

    renderSubTabContent();
    updateKPIs();
  } catch (err) {
    console.error('Error loading Fahrtenbuch data:', err);
  }
}

function getFilteredEntries() {
  return entries.filter(e => {
    if (selectedVehicleId && e.vehicle_id !== selectedVehicleId) return false;
    if (selectedYear && !e.trip_date.startsWith(selectedYear)) return false;
    if (selectedMonth !== 'all') {
      const m = e.trip_date.slice(5, 7);
      if (m !== selectedMonth) return false;
    }
    if (selectedTripType !== 'all' && e.trip_type !== selectedTripType) return false;
    return true;
  });
}

function getFilteredCosts() {
  return costs.filter(c => {
    if (selectedVehicleId && c.vehicle_id !== selectedVehicleId) return false;
    if (selectedYear && !c.cost_date.startsWith(selectedYear)) return false;
    return true;
  });
}

function updateKPIs() {
  const filtered = getFilteredEntries();
  const filteredCosts = getFilteredCosts();

  let totalKm = 0;
  let businessKm = 0;
  let commuteKm = 0;
  let privateKm = 0;

  filtered.forEach(e => {
    const km = parseFloat(e.distance_km) || (e.odometer_end - e.odometer_start) || 0;
    totalKm += km;
    if (e.trip_type === 'geschaeftlich') businessKm += km;
    else if (e.trip_type === 'arbeitsweg') commuteKm += km;
    else privateKm += km;
  });

  const businessPct = totalKm > 0 ? Math.round((businessKm / totalKm) * 100) : 0;
  const commutePct = totalKm > 0 ? Math.round((commuteKm / totalKm) * 100) : 0;

  const vehicle = vehicles.find(v => v.id === selectedVehicleId);
  const isPrivate = !vehicle || vehicle.ownership_type === 'privat_genutzt';

  let euerDeduction = 0;
  let basisText = '';

  if (isPrivate) {
    euerDeduction = businessKm * 0.30;
    basisText = `Kilometersatz (0,30 € × ${businessKm.toFixed(1)} km)`;
  } else {
    const totalCostAmount = filteredCosts.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    euerDeduction = (totalCostAmount * (businessPct / 100));
    basisText = `Kostenanteil (${businessPct}% von ${totalCostAmount.toFixed(2)} €)`;
  }

  const elTotal = document.getElementById('fb_kpi_total_km');
  const elTrips = document.getElementById('fb_kpi_trips_count');
  const elBiz = document.getElementById('fb_kpi_business_km');
  const elBizPct = document.getElementById('fb_kpi_business_pct');
  const elCommute = document.getElementById('fb_kpi_commute_km');
  const elCommutePct = document.getElementById('fb_kpi_commute_pct');
  const elDeduct = document.getElementById('fb_kpi_euer_deduction');
  const elBasis = document.getElementById('fb_kpi_deduction_basis');

  if (elTotal) elTotal.textContent = `${totalKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`;
  if (elTrips) elTrips.textContent = `${filtered.length} Fahrten erfasst`;
  if (elBiz) elBiz.textContent = `${businessKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`;
  if (elBizPct) elBizPct.textContent = `${businessPct}% geschäftlicher Anteil`;
  if (elCommute) elCommute.textContent = `${commuteKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`;
  if (elCommutePct) elCommutePct.textContent = `${commutePct}% Arbeitsweg`;
  if (elDeduct) elDeduct.textContent = `${euerDeduction.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  if (elBasis) elBasis.textContent = basisText;
}

function renderSubTabContent() {
  const container = document.getElementById('fb_main_content');
  if (!container) return;

  if (activeSubTab === 'trips') {
    renderTripsTab(container);
  } else if (activeSubTab === 'costs') {
    renderCostsTab(container);
  } else if (activeSubTab === 'vehicles') {
    renderVehiclesTab(container);
  }
}

function renderTripsTab(container) {
  const filtered = getFilteredEntries();

  container.innerHTML = `
    <!-- Filter Toolbar -->
    <div class="fb-filter-bar">
      <div class="fb-filter-group">
        <label>Monat:</label>
        <select id="fb_month_filter" class="f-select-compact">
          <option value="all" ${selectedMonth === 'all' ? 'selected' : ''}>Alle Monate</option>
          <option value="01" ${selectedMonth === '01' ? 'selected' : ''}>Januar</option>
          <option value="02" ${selectedMonth === '02' ? 'selected' : ''}>Februar</option>
          <option value="03" ${selectedMonth === '03' ? 'selected' : ''}>März</option>
          <option value="04" ${selectedMonth === '04' ? 'selected' : ''}>April</option>
          <option value="05" ${selectedMonth === '05' ? 'selected' : ''}>Mai</option>
          <option value="06" ${selectedMonth === '06' ? 'selected' : ''}>Juni</option>
          <option value="07" ${selectedMonth === '07' ? 'selected' : ''}>Juli</option>
          <option value="08" ${selectedMonth === '08' ? 'selected' : ''}>August</option>
          <option value="09" ${selectedMonth === '09' ? 'selected' : ''}>September</option>
          <option value="10" ${selectedMonth === '10' ? 'selected' : ''}>Oktober</option>
          <option value="11" ${selectedMonth === '11' ? 'selected' : ''}>November</option>
          <option value="12" ${selectedMonth === '12' ? 'selected' : ''}>Dezember</option>
        </select>
      </div>

      <div class="fb-filter-group">
        <label>Art der Fahrt:</label>
        <select id="fb_type_filter" class="f-select-compact">
          <option value="all" ${selectedTripType === 'all' ? 'selected' : ''}>Alle Fahrtarten</option>
          <option value="geschaeftlich" ${selectedTripType === 'geschaeftlich' ? 'selected' : ''}>🟢 Geschäftlich</option>
          <option value="arbeitsweg" ${selectedTripType === 'arbeitsweg' ? 'selected' : ''}>🟡 Arbeitsweg</option>
          <option value="privat" ${selectedTripType === 'privat' ? 'selected' : ''}>🔴 Privat</option>
        </select>
      </div>

      <div class="fb-filter-count">
        ${filtered.length} Fahrten gefunden
      </div>
    </div>

    <!-- Table -->
    <div class="finance-table-wrapper">
      <table class="finance-table">
        <thead>
          <tr>
            <th>Datum / Zeit</th>
            <th>Art</th>
            <th>Start ➔ Ziel</th>
            <th>Zweck / Kunde</th>
            <th>Tachostand</th>
            <th style="text-align: right;">km</th>
            <th style="text-align: center;">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr>
              <td colspan="7" class="f-empty-state" style="text-align: center; padding: 32px 16px; color: var(--text-dim);">
                Keine Fahrten für diesen Filterzeitraum gefunden.<br>
                Klicke oben auf <strong>+ Neue Fahrt</strong>, um eine Fahrt einzutragen.
              </td>
            </tr>
          ` : filtered.map(t => {
            const km = parseFloat(t.distance_km) || (t.odometer_end - t.odometer_start) || 0;
            const typeBadge = t.trip_type === 'geschaeftlich'
              ? '<span class="fb-badge fb-badge-biz">🟢 Geschäftlich</span>'
              : (t.trip_type === 'arbeitsweg'
                ? '<span class="fb-badge fb-badge-commute">🟡 Arbeitsweg</span>'
                : '<span class="fb-badge fb-badge-private">🔴 Privat</span>');

            return `
              <tr>
                <td>
                  <strong>${fmtDate(t.trip_date)}</strong>
                  ${t.departure_time ? `<div class="f-cell-sub">${t.departure_time.slice(0,5)} ${t.arrival_time ? '– ' + t.arrival_time.slice(0,5) : ''}</div>` : ''}
                </td>
                <td>${typeBadge}</td>
                <td>
                  <strong>${esc(t.start_location)}</strong> ➔ <strong>${esc(t.end_location)}</strong>
                  ${t.route_description ? `<div class="f-cell-sub">${esc(t.route_description)}</div>` : ''}
                </td>
                <td>
                  ${t.business_reason ? `<div>${esc(t.business_reason)}</div>` : '<span class="f-cell-sub">–</span>'}
                  ${t.client_name ? `<div class="f-cell-sub">Kunde: ${esc(t.client_name)}</div>` : ''}
                </td>
                <td>
                  <span class="fb-odometer">${t.odometer_start.toLocaleString('de-DE')}</span> ➔ 
                  <span class="fb-odometer">${t.odometer_end.toLocaleString('de-DE')}</span>
                </td>
                <td style="text-align: right; font-weight: 700;">
                  ${km.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km
                </td>
                <td style="text-align: center;">
                  <button class="btn btn-ghost edit-trip-btn" data-id="${t.id}" title="Bearbeiten" style="padding: 3px 7px;">✎</button>
                  <button class="btn btn-ghost delete-trip-btn" data-id="${t.id}" title="Löschen" style="padding: 3px 7px; color: #ef4444;">✕</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Filters
  container.querySelector('#fb_month_filter')?.addEventListener('change', (e) => {
    selectedMonth = e.target.value;
    renderTripsTab(container);
    updateKPIs();
  });

  container.querySelector('#fb_type_filter')?.addEventListener('change', (e) => {
    selectedTripType = e.target.value;
    renderTripsTab(container);
    updateKPIs();
  });

  // Action buttons
  container.querySelectorAll('.edit-trip-btn').forEach(btn => {
    btn.onclick = () => {
      const trip = entries.find(t => t.id === btn.dataset.id);
      if (trip) openTripModal(trip);
    };
  });

  container.querySelectorAll('.delete-trip-btn').forEach(btn => {
    btn.onclick = () => {
      const trip = entries.find(t => t.id === btn.dataset.id);
      if (!trip) return;
      confirmDialog('Fahrt löschen', `Fahrt vom ${fmtDate(trip.trip_date)} (${trip.start_location} ➔ ${trip.end_location}) wirklich löschen?`, async () => {
        const { error } = await sb.from('ops_fahrtenbuch_entries').delete().eq('id', trip.id);
        if (error) {
          toast('Fehler beim Löschen: ' + error.message, true);
          return false;
        }
        toast('Fahrt erfolgreich gelöscht');
        await loadEntriesAndCosts();
        return true;
      });
    };
  });
}

function renderCostsTab(container) {
  const filtered = getFilteredCosts();
  const totalCosts = filtered.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  container.innerHTML = `
    <div class="fb-filter-bar">
      <div style="font-weight: 600;">
        Fahrzeugkosten (${selectedYear}): <span style="color: #6366f1;">${totalCosts.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
      </div>
      <div>
        <button id="fb_add_cost_btn" class="f-btn f-btn-primary">+ Ausgabe erfassen</button>
      </div>
    </div>

    <div class="finance-table-wrapper">
      <table class="finance-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Kostenart</th>
            <th>Beschreibung</th>
            <th style="text-align: right;">Betrag (€)</th>
            <th style="text-align: center;">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr>
              <td colspan="5" class="f-empty-state" style="text-align: center; padding: 32px 16px; color: var(--text-dim);">
                Keine Fahrzeugkosten für ${selectedYear} erfasst.<br>
                Erfasse Tankbelege, Kfz-Versicherung, Steuer oder Reparaturen.
              </td>
            </tr>
          ` : filtered.map(c => `
            <tr>
              <td><strong>${fmtDate(c.cost_date)}</strong></td>
              <td><span class="fb-badge fb-badge-cost">${esc(c.cost_type)}</span></td>
              <td>${esc(c.description || '–')}</td>
              <td style="text-align: right; font-weight: 700;">
                ${(parseFloat(c.amount) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
              </td>
              <td style="text-align: center;">
                <button class="btn btn-ghost delete-cost-btn" data-id="${c.id}" style="padding: 3px 7px; color: #ef4444;">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#fb_add_cost_btn')?.addEventListener('click', () => openCostModal());
  container.querySelectorAll('.delete-cost-btn').forEach(btn => {
    btn.onclick = () => {
      const cost = costs.find(c => c.id === btn.dataset.id);
      if (!cost) return;
      confirmDialog('Kostenposition löschen', `Kostenposition (${cost.cost_type} - ${cost.amount} €) löschen?`, async () => {
        await sb.from('ops_fahrtenbuch_costs').delete().eq('id', cost.id);
        toast('Ausgabe gelöscht');
        await loadEntriesAndCosts();
        return true;
      });
    };
  });
}

function renderVehiclesTab(container) {
  container.innerHTML = `
    <div class="fb-filter-bar">
      <div style="font-weight: 600;">Registrierte Fahrzeuge</div>
      <button id="fb_new_vehicle_btn" class="f-btn f-btn-primary">+ Neues Fahrzeug</button>
    </div>

    <div class="finance-table-wrapper">
      <table class="finance-table">
        <thead>
          <tr>
            <th>Kennzeichen</th>
            <th>Modell / Marke</th>
            <th>Baujahr / Kraftstoff</th>
            <th>Nutzungsart</th>
            <th>Start-km</th>
            <th>Status</th>
            <th style="text-align: center;">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${vehicles.map(v => `
            <tr>
              <td><strong class="fb-plate-tag">${esc(v.license_plate)}</strong></td>
              <td>${esc(v.make_model)}</td>
              <td>${v.year || '–'} / ${esc(v.fuel_type || 'benzin')}</td>
              <td>
                ${v.ownership_type === 'privat_genutzt' 
                  ? '<span class="fb-badge fb-badge-private">Privat-Pkw (0,30 €/km)</span>' 
                  : '<span class="fb-badge fb-badge-biz">Betriebsvermögen (Firmenwagen)</span>'}
              </td>
              <td>${(v.initial_odometer || 0).toLocaleString('de-DE')} km</td>
              <td>${v.is_active ? '🟢 Aktiv' : '⚪ Inaktiv'}</td>
              <td style="text-align: center;">
                <button class="btn btn-ghost edit-veh-btn" data-id="${v.id}" style="padding: 3px 7px;">✎</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#fb_new_vehicle_btn')?.addEventListener('click', () => openVehicleModal(null));
  container.querySelectorAll('.edit-veh-btn').forEach(btn => {
    btn.onclick = () => {
      const veh = vehicles.find(v => v.id === btn.dataset.id);
      if (veh) openVehicleModal(veh);
    };
  });
}

function openTripModal(trip = null) {
  const isEdit = !!trip;
  
  let nextOdoStart = 0;
  if (!isEdit && entries.length > 0) {
    const vehicleEntries = entries.filter(e => e.vehicle_id === selectedVehicleId);
    if (vehicleEntries.length > 0) {
      nextOdoStart = Math.max(...vehicleEntries.map(e => e.odometer_end || 0));
    }
  }

  openModal({
    title: isEdit ? 'Fahrt bearbeiten' : 'Neue Fahrt erfassen',
    bodyHTML: `
      <div class="form-grid">
        <label class="fld">
          <span>Datum *</span>
          <input type="date" id="t_date" value="${trip?.trip_date || new Date().toISOString().slice(0, 10)}" required>
        </label>
        <label class="fld">
          <span>Fahrtart *</span>
          <select id="t_type" required>
            <option value="geschaeftlich" ${trip?.trip_type === 'geschaeftlich' ? 'selected' : ''}>🟢 Geschäftlich (Betriebsausgabe)</option>
            <option value="arbeitsweg" ${trip?.trip_type === 'arbeitsweg' ? 'selected' : ''}>🟡 Arbeitsweg (Wohnung ↔ Betrieb)</option>
            <option value="privat" ${trip?.trip_type === 'privat' ? 'selected' : ''}>🔴 Privatfahrt</option>
          </select>
        </label>
      </div>

      <div class="form-grid">
        <label class="fld">
          <span>Abfahrtzeit</span>
          <input type="time" id="t_dep_time" value="${trip?.departure_time?.slice(0, 5) || ''}">
        </label>
        <label class="fld">
          <span>Ankunftzeit</span>
          <input type="time" id="t_arr_time" value="${trip?.arrival_time?.slice(0, 5) || ''}">
        </label>
      </div>

      <div class="form-grid">
        <label class="fld">
          <span>Startort *</span>
          <input type="text" id="t_start" placeholder="z. B. Köln Büro / Zuhause" value="${trip?.start_location || ''}" required>
        </label>
        <label class="fld">
          <span>Zielort *</span>
          <input type="text" id="t_end" placeholder="z. B. Kunde Düsseldorf / Meeting" value="${trip?.end_location || ''}" required>
        </label>
      </div>

      <label class="fld">
        <span>Reiseroute / Zwischenstopps</span>
        <input type="text" id="t_route" placeholder="z. B. über A3, Zwischenstopp Essen" value="${trip?.route_description || ''}">
      </label>

      <div class="form-grid-3">
        <label class="fld">
          <span>Tachostand Beginn (km) *</span>
          <input type="number" id="t_odo_start" value="${isEdit ? trip.odometer_start : nextOdoStart}" required>
        </label>
        <label class="fld">
          <span>Tachostand Ende (km) *</span>
          <input type="number" id="t_odo_end" value="${trip?.odometer_end || ''}" required>
        </label>
        <label class="fld">
          <span>Strecke (km)</span>
          <input type="text" id="t_dist_display" value="${trip?.distance_km || 0} km" readonly style="font-weight: bold; color: #10b981;">
        </label>
      </div>

      <div class="form-grid">
        <label class="fld">
          <span>Reisezweck / Anlass (bei Geschäftsfahrten)</span>
          <input type="text" id="t_reason" placeholder="z. B. Erstberatung, Server-Wartung, Notartermin" value="${trip?.business_reason || ''}">
        </label>
        <label class="fld">
          <span>Kunde / Partner</span>
          <input type="text" id="t_client" placeholder="z. B. Fa. Müller GmbH" value="${trip?.client_name || ''}">
        </label>
      </div>
    `,
    onOpen: (body) => {
      const startInp = $('#t_odo_start', body);
      const endInp = $('#t_odo_end', body);
      const distDisp = $('#t_dist_display', body);

      const calcDist = () => {
        const s = parseFloat(startInp.value) || 0;
        const e = parseFloat(endInp.value) || 0;
        const diff = Math.max(0, e - s);
        distDisp.value = diff.toFixed(1) + ' km';
      };

      startInp.oninput = calcDist;
      endInp.oninput = calcDist;
      calcDist();
    },
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      {
        label: isEdit ? 'Speichern' : 'Fahrt eintragen',
        kind: 'primary',
        onClick: async () => {
          const startInp = document.getElementById('t_odo_start');
          const endInp = document.getElementById('t_odo_end');
          const odoStart = parseInt(startInp.value, 10);
          const odoEnd = parseInt(endInp.value, 10);

          if (isNaN(odoStart) || isNaN(odoEnd) || odoEnd <= odoStart) {
            toast('Tachostand Ende muss größer als Tachostand Beginn sein!', true);
            return false;
          }

          const startLoc = document.getElementById('t_start').value.trim();
          const endLoc = document.getElementById('t_end').value.trim();
          if (!startLoc || !endLoc) {
            toast('Start- und Zielort müssen ausgefüllt sein!', true);
            return false;
          }

          const payload = {
            vehicle_id: selectedVehicleId,
            trip_date: document.getElementById('t_date').value,
            trip_type: document.getElementById('t_type').value,
            departure_time: document.getElementById('t_dep_time').value || null,
            arrival_time: document.getElementById('t_arr_time').value || null,
            start_location: startLoc,
            end_location: endLoc,
            route_description: document.getElementById('t_route').value.trim() || null,
            odometer_start: odoStart,
            odometer_end: odoEnd,
            business_reason: document.getElementById('t_reason').value.trim() || null,
            client_name: document.getElementById('t_client').value.trim() || null,
            driver: 'kemal'
          };

          try {
            if (isEdit) {
              const { error } = await sb.from('ops_fahrtenbuch_entries').update(payload).eq('id', trip.id);
              if (error) throw error;
              toast('Fahrt erfolgreich aktualisiert');
            } else {
              const { error } = await sb.from('ops_fahrtenbuch_entries').insert([payload]);
              if (error) throw error;
              toast('Fahrt erfolgreich eingetragen');
            }
            await loadEntriesAndCosts();
            return true;
          } catch (err) {
            toast('Fehler beim Speichern: ' + err.message, true);
            return false;
          }
        }
      }
    ]
  });
}

function openCostModal() {
  openModal({
    title: 'Kfz-Kosten erfassen',
    bodyHTML: `
      <div class="form-grid">
        <label class="fld">
          <span>Datum *</span>
          <input type="date" id="c_date" value="${new Date().toISOString().slice(0, 10)}" required>
        </label>
        <label class="fld">
          <span>Kostenart *</span>
          <select id="c_type" required>
            <option value="kraftstoff">⛽ Kraftstoff / Tanken / Laden</option>
            <option value="versicherung">🛡️ Kfz-Versicherung (Haftpflicht/Kasko)</option>
            <option value="steuer">🏛️ Kfz-Steuer</option>
            <option value="wartung">🔧 Wartung & Inspektion</option>
            <option value="reparatur">🛠️ Reparatur</option>
            <option value="leasing">📄 Leasingrate</option>
            <option value="parkgebuehr">🅿️ Parkgebühren / Maut</option>
            <option value="sonstiges">📦 Sonstige Fahrzeugkosten</option>
          </select>
        </label>
      </div>

      <div class="form-grid">
        <label class="fld">
          <span>Bruttobetrag (€) *</span>
          <input type="number" step="0.01" id="c_amount" placeholder="0.00" required>
        </label>
        <label class="fld">
          <span>Darin enthaltene USt (€)</span>
          <input type="number" step="0.01" id="c_vat" placeholder="0.00">
        </label>
      </div>

      <label class="fld">
        <span>Beschreibung / Belegnotiz</span>
        <input type="text" id="c_desc" placeholder="z. B. Aral Tankstelle Köln">
      </label>
    `,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      {
        label: 'Kosten speichern',
        kind: 'primary',
        onClick: async () => {
          const amt = parseFloat(document.getElementById('c_amount').value) || 0;
          if (amt <= 0) {
            toast('Bitte einen gültigen Betrag eingeben!', true);
            return false;
          }

          const payload = {
            vehicle_id: selectedVehicleId,
            cost_date: document.getElementById('c_date').value,
            cost_type: document.getElementById('c_type').value,
            amount: amt,
            vat_amount: parseFloat(document.getElementById('c_vat').value) || 0,
            description: document.getElementById('c_desc').value.trim() || null
          };

          try {
            const { error } = await sb.from('ops_fahrtenbuch_costs').insert([payload]);
            if (error) throw error;
            toast('Kosten erfolgreich gespeichert');
            await loadEntriesAndCosts();
            return true;
          } catch (err) {
            toast('Fehler beim Speichern: ' + err.message, true);
            return false;
          }
        }
      }
    ]
  });
}

function openVehicleModal(vehicle = null) {
  const isEdit = !!vehicle;

  openModal({
    title: isEdit ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug anlegen',
    bodyHTML: `
      <div class="form-grid">
        <label class="fld">
          <span>Amtliches Kennzeichen *</span>
          <input type="text" id="v_plate" placeholder="z. B. K-KD 2026" value="${vehicle?.license_plate || ''}" required>
        </label>
        <label class="fld">
          <span>Hersteller / Modell *</span>
          <input type="text" id="v_model" placeholder="z. B. VW Golf 8 / Tesla Model 3" value="${vehicle?.make_model || ''}" required>
        </label>
      </div>

      <div class="form-grid">
        <label class="fld">
          <span>Nutzungsart / Zuordnung *</span>
          <select id="v_owner" required>
            <option value="privat_genutzt" ${(!vehicle || vehicle.ownership_type === 'privat_genutzt') ? 'selected' : ''}>Privat-Kfz betrieblich genutzt (0,30 €/km)</option>
            <option value="eigentum" ${vehicle?.ownership_type === 'eigentum' ? 'selected' : ''}>Betriebsvermögen (Firmenwagen - Kauf)</option>
            <option value="leasing" ${vehicle?.ownership_type === 'leasing' ? 'selected' : ''}>Betriebsvermögen (Firmenwagen - Leasing)</option>
          </select>
        </label>
        <label class="fld">
          <span>Antriebsart</span>
          <select id="v_fuel">
            <option value="benzin" ${(!vehicle || vehicle.fuel_type === 'benzin') ? 'selected' : ''}>Benzin</option>
            <option value="diesel" ${vehicle?.fuel_type === 'diesel' ? 'selected' : ''}>Diesel</option>
            <option value="elektro" ${vehicle?.fuel_type === 'elektro' ? 'selected' : ''}>Elektro (BEV)</option>
            <option value="hybrid" ${vehicle?.fuel_type === 'hybrid' ? 'selected' : ''}>Plug-In-Hybrid</option>
          </select>
        </label>
      </div>

      <div class="form-grid">
        <label class="fld">
          <span>Anfangs-Kilometerstand (km)</span>
          <input type="number" id="v_odo" value="${vehicle?.initial_odometer || 0}">
        </label>
        <label class="fld">
          <span>Brutto-Listenpreis (€) (für 1%-Regel)</span>
          <input type="number" step="0.01" id="v_price" value="${vehicle?.list_price_gross || 0}">
        </label>
      </div>
    `,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      {
        label: isEdit ? 'Aktualisieren' : 'Fahrzeug anlegen',
        kind: 'primary',
        onClick: async () => {
          const plate = document.getElementById('v_plate').value.trim().toUpperCase();
          const model = document.getElementById('v_model').value.trim();
          if (!plate || !model) {
            toast('Bitte Kennzeichen und Modell eingeben!', true);
            return false;
          }

          const payload = {
            license_plate: plate,
            make_model: model,
            ownership_type: document.getElementById('v_owner').value,
            fuel_type: document.getElementById('v_fuel').value,
            initial_odometer: parseInt(document.getElementById('v_odo').value, 10) || 0,
            list_price_gross: parseFloat(document.getElementById('v_price').value) || 0,
            is_active: true
          };

          try {
            if (isEdit) {
              await sb.from('ops_fahrtenbuch_vehicles').update(payload).eq('id', vehicle.id);
              toast('Fahrzeug aktualisiert');
            } else {
              const { data: created, error } = await sb.from('ops_fahrtenbuch_vehicles').insert([payload]).select();
              if (error) throw error;
              if (created && created[0]) selectedVehicleId = created[0].id;
              toast('Fahrzeug angelegt');
            }
            await loadVehicles();
            renderSubTabContent();
            updateKPIs();
            return true;
          } catch (err) {
            toast('Fehler: ' + err.message, true);
            return false;
          }
        }
      }
    ]
  });
}

function exportFahrtenbuchData() {
  const filtered = getFilteredEntries();
  const filteredCosts = getFilteredCosts();

  if (filtered.length === 0) {
    toast('Keine Fahrten im ausgewählten Jahr zum Exportieren vorhanden.', true);
    return;
  }

  let totalKm = 0;
  let bizKm = 0;
  let commuteKm = 0;
  let privKm = 0;

  filtered.forEach(e => {
    const km = parseFloat(e.distance_km) || (e.odometer_end - e.odometer_start) || 0;
    totalKm += km;
    if (e.trip_type === 'geschaeftlich') bizKm += km;
    else if (e.trip_type === 'arbeitsweg') commuteKm += km;
    else privKm += km;
  });

  const bizPct = totalKm > 0 ? (bizKm / totalKm) : 0;
  const vehicle = vehicles.find(v => v.id === selectedVehicleId);
  const vehicleName = vehicle ? `${vehicle.license_plate} - ${vehicle.make_model}` : 'Fahrzeug';

  const headers = [
    'Datum',
    'Abfahrt',
    'Ankunft',
    'Fahrzeug',
    'Fahrtart',
    'Startort',
    'Zielort',
    'Route',
    'Tacho_Start',
    'Tacho_Ende',
    'Distanz_km',
    'Reisezweck',
    'Kunde_Partner',
    'Fahrer'
  ];

  const rows = filtered.map(t => [
    t.trip_date,
    t.departure_time || '',
    t.arrival_time || '',
    vehicleName,
    t.trip_type,
    `"${(t.start_location || '').replace(/"/g, '""')}"`,
    `"${(t.end_location || '').replace(/"/g, '""')}"`,
    `"${(t.route_description || '').replace(/"/g, '""')}"`,
    t.odometer_start,
    t.odometer_end,
    parseFloat(t.distance_km) || (t.odometer_end - t.odometer_start),
    `"${(t.business_reason || '').replace(/"/g, '""')}"`,
    `"${(t.client_name || '').replace(/"/g, '""')}"`,
    t.driver || 'kemal'
  ]);

  const csvContent = '\uFEFF' + [
    `# GoBD-konformes Fahrtenbuch — Einzelunternehmen Yavuz Kemal Demir`,
    `# Steuerjahr: ${selectedYear} | Fahrzeug: ${vehicleName}`,
    `# Gesamtkilometer: ${totalKm.toFixed(1)} km | Geschaeftlich: ${bizKm.toFixed(1)} km (${(bizPct*100).toFixed(1)}%) | Arbeitsweg: ${commuteKm.toFixed(1)} km`,
    `# EÜR-Betriebsausgaben-Ansatz (0.30 EUR/km): ${(bizKm * 0.30).toFixed(2)} EUR`,
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `fahrtenbuch_Kemal_${selectedYear}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast(`Fahrtenbuch für ${selectedYear} erfolgreich exportiert!`);
}

export function mountFahrtenbuch() {
  const root = $('#view-fahrtenbuch');
  if (root) renderFahrtenbuch(root);
}
