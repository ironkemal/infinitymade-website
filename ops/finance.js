// Praxura Ops-Dashboard — Finanzen, Anlage EÜR & GoBD Modul v2.0
// Rechtsträger: Einzelunternehmen Yavuz Kemal Demir (EÜR nach § 4 Abs. 3 EStG)
import { sb, state, $, $$, esc, toast, fail, fmtDate, openModal, confirmDialog, memberById } from './app.js?v=20260811a';
import { INVOICE_FOLDER_URL } from './config.js?v=20260811a';

let expenses = [];
let query = '';
let selectedYear = new Date().getFullYear().toString();
let selectedCategory = 'all';
let selectedStatus = 'all';
let selectedPayer = 'all';
let selectedVatFilter = 'all';
let onlyRecurring = false;
let channel = null;

export const EUER_CATEGORIES = {
  'software_cloud': { label: 'Software & Cloud-Dienste', icon: '☁️', desc: 'SaaS, Hosting, Vercel, Supabase, OpenAI, GitHub, Domains', isAsset: false },
  'telecom_internet': { label: 'Telekommunikation & Internet', icon: '📱', desc: 'Mobilfunk, Telefon, Internetanschluss', isAsset: false },
  'office_supplies': { label: 'Büromaterial & Arbeitsmittel', icon: '📎', desc: 'Schreibwaren, Druckerpapier, Kleinmaterial', isAsset: false },
  'gwg_assets': { label: 'GWG (Geringwertige Wirtschaftsgüter)', icon: '💻', desc: 'Hardware & Geräte netto ≤ 800 € (Tastatur, Monitor, Headset)', isAsset: false },
  'asset_acquisition': { label: 'Anlagevermögen (Sammelposten / AfA)', icon: '🖥️', desc: 'Hardware > 800 € Netto — wird über AVEÜR abgeschrieben', isAsset: true },
  'travel_mobility': { label: 'Reise- & Fahrtkosten', icon: '🚆', desc: 'ÖPNV, Deutsche Bahn, Fahrtkosten', isAsset: false },
  'education_training': { label: 'Fortbildung & Fachliteratur', icon: '📚', desc: 'Fachbücher, Kurse, Zertifikate', isAsset: false },
  'marketing_sales': { label: 'Marketing & Vertrieb', icon: '📣', desc: 'Online-Ads (Google/Meta), Werbung, Branding', isAsset: false },
  'bank_fees': { label: 'Bank- & Nebenkosten des Geldverkehrs', icon: '💳', desc: 'Kontoführung, Transaktionsgebühren, Zahlungsdienstleister', isAsset: false },
  'rent_lease': { label: 'Miete & Raumkosten', icon: '🏢', desc: 'Büromiete, Coworking, Lagerräume', isAsset: false },
  'insurance': { label: 'Betriebliche Versicherungen', icon: '🛡️', desc: 'Berufshaftpflicht, Elektronikversicherung', isAsset: false },
  'professional_services': { label: 'Fremdleistungen & Dienstleister', icon: '🤝', desc: 'Freelancer, Entwicklungs- & Design-Dienstleistungen', isAsset: false },
  'legal_tax_advisory': { label: 'Rechts- & Steuerberatung', icon: '⚖️', desc: 'Steuerberater, Elster-Tools, Rechtsberatung', isAsset: false },
  'repairs_maintenance': { label: 'Reparaturen & Instandhaltung', icon: '🔧', desc: 'Wartung und Reparatur von Betriebsgeräten', isAsset: false },
  'business_meals': { label: 'Geschäftliche Bewirtung (§ 4 Abs. 5)', icon: '🍽️', desc: 'Geschäftliche Bewirtungskosten (steuerlich abzugsfähiger Anteil)', isAsset: false },
  'post_shipping': { label: 'Porto & Versand', icon: '📦', desc: 'Briefe, DHL, Kurierdienste', isAsset: false },
  'other_operational': { label: 'Sonstige Betriebsausgaben', icon: '🏷️', desc: 'Sonstige betrieblich veranlasste Ausgaben', isAsset: false },
  'private_expense': { label: 'Private Ausgabe (Nicht in EÜR)', icon: '🚫', desc: 'Private Ausgaben Dritter (z. B. Melih privat) — kein EÜR-Abzug', isAsset: false }
};

export const FUNDING_SOURCES = {
  'business_account': { label: 'Geschäftskonto Kemal', icon: '🏢', cls: 'pill-kemal' },
  'kemal_private': { label: 'Privatkonto Kemal (Einlage)', icon: '👤', cls: 'pill-joint' },
  'melih_private': { label: 'Melih privat (Nicht in EÜR)', icon: '🚫', cls: 'pill-melih' },
  'other': { label: 'Sonstige', icon: '💳', cls: 'pill-once' }
};

export const ECONOMIC_CLASSIFICATIONS = {
  'business_expense': 'Betriebsausgabe',
  'private_contribution': 'Privateinlage (Kemal)',
  'private_withdrawal': 'Privatentnahme',
  'private_expense': 'Privat (Nicht abzugsfähig)',
  'business_income': 'Betriebseinnahme'
};

export const DOCUMENT_TYPES = {
  'invoice': 'Rechnung',
  'credit_note': 'Gutschrift / Storno',
  'receipt': 'Quittung / Beleg',
  'corrected_invoice': 'Korrekturrechnung'
};

export const REVIEW_CODE_LABELS = {
  'RC_UNCERTAIN': '§ 13b Reverse-Charge unklar',
  'VAT_ID_MISSING': 'USt-IdNr. fehlt',
  'PAYMENT_MISSING': 'Zahlungsdatum (§ 11 EStG) fehlt',
  'DUPLICATE_DOCUMENT': 'Mögliches Rechnungsduplikat',
  'OCR_LOW_CONFIDENCE': 'KI-Erkennung unsicher',
  'ASSET_CLASSIFICATION_UNCERTAIN': 'Anlagevermögen-Prüfung nötig',
  'PRIVATE_BUSINESS_MIXED': 'Privatanteil ungeklärt'
};

export const STATUS_LABELS = {
  'processed': { label: 'Verarbeitet (OK)', cls: 'st-ok' },
  'review_needed': { label: 'Prüfung nötig', cls: 'st-warn' },
  'archived': { label: 'Archiviert', cls: 'st-mute' }
};

export const fmtEuro = (n) => {
  const val = Number(n) || 0;
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
};

async function loadExpenses() {
  const { data, error } = await sb
    .from('ops_finance_expenses')
    .select('*')
    .order('invoice_date', { ascending: false });

  if (error) return fail('Finanzdaten laden', error);
  expenses = data || [];
  render();
}

function getFilteredExpenses() {
  const q = query.trim().toLowerCase();
  return expenses.filter(item => {
    // Year filter: based on payment_date if present, else invoice_date (§ 11 EStG)
    const effectiveDate = item.payment_date || item.invoice_date || '';
    if (selectedYear !== 'all') {
      const itemYear = effectiveDate ? effectiveDate.slice(0, 4) : '';
      if (itemYear !== selectedYear) return false;
    }
    // Category filter
    if (selectedCategory !== 'all') {
      const cat = item.tax_category || item.euer_category;
      if (cat !== selectedCategory) return false;
    }
    // Status filter
    if (selectedStatus !== 'all' && item.status !== selectedStatus) {
      return false;
    }
    // Payer / Funding Source filter
    if (selectedPayer !== 'all') {
      const source = item.funding_source || item.payer_type || 'business_account';
      if (selectedPayer === 'euer_only' && (item.is_deductible === false || source === 'melih_private')) {
        return false;
      }
      if (selectedPayer === 'melih_private' && source !== 'melih_private') {
        return false;
      }
      if (selectedPayer === 'kemal_business' && source !== 'business_account') {
        return false;
      }
      if (selectedPayer === 'kemal_private' && source !== 'kemal_private') {
        return false;
      }
    }
    // VAT / Reverse Charge filter
    if (selectedVatFilter !== 'all') {
      if (selectedVatFilter === 'reverse_charge' && !item.reverse_charge) return false;
      if (selectedVatFilter === 'standard' && item.reverse_charge) return false;
    }
    // Recurring filter
    if (onlyRecurring && !item.is_recurring) {
      return false;
    }
    // Search query
    if (q) {
      const matchVendor = (item.vendor_name || '').toLowerCase().includes(q);
      const matchNumber = (item.invoice_number || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchCountry = (item.vendor_country || '').toLowerCase().includes(q);
      const matchVatId = (item.vendor_vat_id || '').toLowerCase().includes(q);
      if (!matchVendor && !matchNumber && !matchDesc && !matchCountry && !matchVatId) return false;
    }
    return true;
  });
}

function renderKPIs(list) {
  // Deductible business expenses for Kemal's Einzelunternehmen
  const deductibleList = list.filter(i => i.is_deductible !== false && (i.funding_source || i.payer_type) !== 'melih_private');
  
  // Calculate deductible Net amount considering deductible_percentage (e.g. 70% for Bewirtung)
  const euerNet = deductibleList.reduce((sum, item) => {
    const net = Number(item.net_amount) || 0;
    const pct = Number(item.deductible_percentage) || 100;
    return sum + (net * (pct / 100));
  }, 0);

  const euerGross = deductibleList.reduce((sum, item) => sum + (Number(item.gross_amount) || 0), 0);
  
  // Normal Domestic Input VAT (§ 15 UStG)
  const totalInputVat = deductibleList
    .filter(i => i.input_vat_eligible !== false && !i.reverse_charge)
    .reduce((sum, item) => sum + (Number(item.vat_amount || item.invoice_vat_amount) || 0), 0);

  // Reverse-Charge § 13b (Tax Base & 19% Tax Liability/Credit)
  const rcList = deductibleList.filter(i => i.reverse_charge);
  const totalRcNet = rcList.reduce((sum, item) => sum + (Number(item.net_amount) || 0), 0);
  const totalRcTax = rcList.reduce((sum, item) => sum + (Number(item.reverse_charge_tax_amount) || (Number(item.net_amount) * 0.19) || 0), 0);

  // Active recurring SaaS subscriptions
  const recurringItems = deductibleList.filter(i => i.is_recurring && i.status !== 'archived');
  const monthlyRecurringEst = recurringItems.reduce((sum, item) => {
    const gross = Number(item.gross_amount) || 0;
    if (item.recurring_interval === 'yearly') return sum + (gross / 12);
    if (item.recurring_interval === 'quarterly') return sum + (gross / 3);
    return sum + gross;
  }, 0);

  // Review & Plausibility Metrics
  const reviewNeeded = list.filter(i => i.status === 'review_needed' || i.needs_review).length;
  const missingPaymentDate = list.filter(i => !i.payment_date && i.status !== 'archived').length;

  const kpiContainer = $('#financeKPIs');
  if (!kpiContainer) return;

  kpiContainer.innerHTML = `
    <div class="f-kpi-card">
      <span class="f-kpi-title">EÜR Betriebsausgaben (Netto)</span>
      <span class="f-kpi-val">${fmtEuro(euerNet)}</span>
      <span class="f-kpi-sub">Brutto: ${fmtEuro(euerGross)} (${deductibleList.length} EÜR-Belege)</span>
    </div>
    <div class="f-kpi-card">
      <span class="f-kpi-title">Abziehbare Vorsteuer (§ 15)</span>
      <span class="f-kpi-val">${fmtEuro(totalInputVat)}</span>
      <span class="f-kpi-sub">Erstattungsfähig Inland</span>
    </div>
    <div class="f-kpi-card">
      <span class="f-kpi-title">§ 13b Reverse Charge (B2B)</span>
      <span class="f-kpi-val">${fmtEuro(totalRcNet)} <small style="font-size:13px;color:var(--gold)">(USt: ${fmtEuro(totalRcTax)})</small></span>
      <span class="f-kpi-sub">${rcList.length} Auslands-SaaS Belege (EU/Drittland)</span>
    </div>
    <div class="f-kpi-card">
      <span class="f-kpi-title">Laufende Abos / Fixkosten</span>
      <span class="f-kpi-val">${recurringItems.length} <small style="font-size:14px;color:var(--text-dim)">(~${fmtEuro(monthlyRecurringEst)}/Mo)</small></span>
      <span class="f-kpi-sub">Monatliche SaaS & Dienste</span>
    </div>
    <div class="f-kpi-card f-kpi-partner-card">
      <span class="f-kpi-title">GoBD & Plausibilitäts-Status</span>
      <div class="f-partner-pills">
        <span class="pill ${reviewNeeded === 0 ? 'st-ok' : 'st-warn'}">
          ${reviewNeeded === 0 ? '✓ Alle Belege plausibel' : `⚠️ ${reviewNeeded} Belege in Prüfung`}
        </span>
        <span class="pill ${missingPaymentDate === 0 ? 'st-ok' : 'pill-once'}">
          ${missingPaymentDate === 0 ? '✓ Zahlungsfluss (§11) erfasst' : `ℹ️ ${missingPaymentDate} ohne Zahlungsdatum`}
        </span>
      </div>
      <span class="f-kpi-sub">Rechtsträger: Einzelunternehmen Kemal</span>
    </div>
  `;
}

function renderCategoryBreakdown(list) {
  const breakdownEl = $('#financeBreakdown');
  if (!breakdownEl) return;

  const deductibleList = list.filter(i => i.is_deductible !== false && (i.funding_source || i.payer_type) !== 'melih_private');
  const totalNet = deductibleList.reduce((sum, item) => sum + (Number(item.net_amount) || 0), 0);
  
  const catSums = {};
  for (const key of Object.keys(EUER_CATEGORIES)) {
    if (key !== 'private_expense') {
      catSums[key] = { net: 0, count: 0 };
    }
  }

  for (const item of deductibleList) {
    const cat = item.tax_category || item.euer_category || 'other_operational';
    if (!catSums[cat]) catSums[cat] = { net: 0, count: 0 };
    catSums[cat].net += Number(item.net_amount) || 0;
    catSums[cat].count += 1;
  }

  const sortedCats = Object.entries(catSums)
    .filter(([_, data]) => data.net > 0 || selectedCategory === 'all')
    .sort((a, b) => b[1].net - a[1].net);

  breakdownEl.innerHTML = `
    <div class="f-breakdown-card">
      <div class="f-breakdown-head">
        <h3>Anlage EÜR Kostenverteilung (Netto)</h3>
        <span class="hint">Amtliche Steuerkategorien für Einzelunternehmen Yavuz Kemal Demir</span>
      </div>
      <div class="f-breakdown-list">
        ${sortedCats.map(([catKey, data]) => {
          const info = EUER_CATEGORIES[catKey] || { label: catKey, icon: '🏷️' };
          const pct = totalNet > 0 ? Math.round((data.net / totalNet) * 100) : 0;
          return `
            <div class="f-cat-row" data-cat="${esc(catKey)}">
              <div class="f-cat-info">
                <span class="f-cat-icon">${info.icon}</span>
                <span class="f-cat-name">${esc(info.label)}</span>
                <span class="f-cat-count">${data.count} Belege</span>
                <span class="f-cat-amount">${fmtEuro(data.net)}</span>
                <span class="f-cat-pct">${pct}%</span>
              </div>
              <div class="f-cat-bar">
                <div class="f-cat-bar-fill" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  $$('.f-cat-row', breakdownEl).forEach(el => {
    el.onclick = () => {
      const cat = el.dataset.cat;
      selectedCategory = (selectedCategory === cat) ? 'all' : cat;
      const catSelect = $('#fCatFilter');
      if (catSelect) catSelect.value = selectedCategory;
      render();
    };
  });
}

function renderList(list) {
  const tableEl = $('#financeList');
  const countEl = $('#financeCount');
  if (countEl) countEl.textContent = `${list.length} von ${expenses.length} Belegen`;

  if (!tableEl) return;

  if (!list.length) {
    tableEl.innerHTML = '<p class="empty">Keine Buchungen für die gewählten Filter gefunden.</p>';
    return;
  }

  tableEl.innerHTML = `
    <div class="f-table-wrap">
      <table class="f-table">
        <thead>
          <tr>
            <th>Status & GoBD</th>
            <th>Datum / Zahlung</th>
            <th>Lieferant & Land</th>
            <th>Kategorie & Steuer</th>
            <th>Mittelherkunft</th>
            <th style="text-align:right">Netto</th>
            <th style="text-align:right">USt. / § 13b</th>
            <th style="text-align:right">Brutto</th>
            <th style="text-align:center">Beleg</th>
            <th style="text-align:right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(item => {
            const catKey = item.tax_category || item.euer_category || 'other_operational';
            const catInfo = EUER_CATEGORIES[catKey] || { label: catKey, icon: '🏷️' };
            const statusInfo = STATUS_LABELS[item.status] || { label: item.status, cls: 'st-mute' };
            const sourceKey = item.funding_source || item.payer_type || 'business_account';
            const sourceInfo = FUNDING_SOURCES[sourceKey] || FUNDING_SOURCES['business_account'];
            const isNonDeductible = item.is_deductible === false || sourceKey === 'melih_private';
            
            return `
              <tr data-id="${item.id}" class="f-row ${item.status === 'review_needed' || item.needs_review ? 'is-warning' : ''} ${isNonDeductible ? 'is-private-row' : ''}">
                <td>
                  <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">
                    <span class="pill ${statusInfo.cls}">${esc(statusInfo.label)}</span>
                    ${item.original_file_hash ? `<span class="f-subtext" style="color:var(--text-dim)" title="SHA-256: ${esc(item.original_file_hash)}">🔒 Hash OK</span>` : ''}
                    ${item.duplicate_candidate ? `<span class="pill pill-melih" style="font-size:9.5px">⚠️ Duplikat?</span>` : ''}
                  </div>
                </td>
                <td>
                  <div style="font-weight:500">${esc(fmtDate(item.invoice_date))}</div>
                  ${item.payment_date 
                    ? `<div class="f-subtext" style="color:var(--gold)" title="Zahlungsdatum nach § 11 EStG">Gezahlt: ${esc(fmtDate(item.payment_date))}</div>` 
                    : `<div class="f-subtext" style="color:var(--text-mute)">Zahlung offen</div>`}
                </td>
                <td>
                  <div class="f-vendor-cell">
                    <span class="f-vendor-name">${esc(item.vendor_name)}</span>
                    <span class="f-country-tag" title="Land">${esc(item.vendor_country || 'DE')}</span>
                    ${item.is_recurring ? `<span class="pill pill-abo" title="Wiederkehrendes Abo">🔄 Abo</span>` : ''}
                  </div>
                  ${item.invoice_number ? `<div class="f-subtext">Nr. ${esc(item.invoice_number)}</div>` : ''}
                  ${item.vendor_vat_id ? `<div class="f-subtext">USt-ID: ${esc(item.vendor_vat_id)}</div>` : ''}
                  ${item.description ? `<div class="f-desc" title="${esc(item.description)}">${esc(item.description)}</div>` : ''}
                </td>
                <td>
                  <div style="display:flex;flex-direction:column;gap:3px">
                    <span class="f-cat-badge" title="${esc(catInfo.desc || '')}">
                      <span>${catInfo.icon}</span> ${esc(catInfo.label)}
                    </span>
                    ${item.reverse_charge ? `
                      <span class="pill pill-abo" style="font-size:10.5px" title="${esc(item.reverse_charge_reason || '§ 13b UStG')}">
                        ⚡ § 13b RC (Rechnung 0% / 19% RC)
                      </span>
                    ` : ''}
                    ${Number(item.deductible_percentage) < 100 && !isNonDeductible ? `
                      <span class="f-subtext" style="color:var(--gold)">${item.deductible_percentage}% abzugsfähig</span>
                    ` : ''}
                    ${isNonDeductible ? `<span class="pill pill-melih" style="font-size:10px">🚫 Nicht in EÜR</span>` : ''}
                  </div>
                </td>
                <td>
                  <div style="display:flex;flex-direction:column;gap:2px">
                    <span class="pill ${sourceInfo.cls}">
                      ${sourceInfo.icon} ${esc(sourceInfo.label)}
                    </span>
                    ${sourceKey === 'kemal_private' ? `<span class="f-subtext" style="color:var(--text-dim)">+ Privateinlage</span>` : ''}
                  </div>
                </td>
                <td style="text-align:right" class="f-num">
                  ${fmtEuro(item.net_amount)}
                </td>
                <td style="text-align:right" class="f-num">
                  ${item.reverse_charge ? `
                    <div style="color:var(--gold)" title="§ 13b Steuerschuld & Vorsteuer">${fmtEuro(item.net_amount * 0.19)} <small>(19% RC)</small></div>
                    <div class="f-subtext">Rechnungs-USt: 0%</div>
                  ` : `
                    <div>${fmtEuro(item.vat_amount)}</div>
                    <div class="f-subtext">${Number(item.vat_rate) || 0}%</div>
                  `}
                </td>
                <td style="text-align:right" class="f-num f-gross">
                  <strong>${fmtEuro(item.gross_amount)}</strong>
                </td>
                <td style="text-align:center">
                  ${item.drive_web_view_link ? `
                    <a href="${esc(item.drive_web_view_link)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm f-beleg-btn" title="PDF in Google Drive öffnen">
                      📄 PDF ↗
                    </a>
                  ` : `<span class="f-subtext">—</span>`}
                </td>
                <td style="text-align:right">
                  <div class="f-actions">
                    <button class="btn btn-ghost btn-sm" data-act="edit" title="Bearbeiten">✎</button>
                    <button class="btn btn-danger btn-sm" data-act="del" title="Löschen">🗑</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function render() {
  const filtered = getFilteredExpenses();

  // Populate Year options if needed
  const yearSelect = $('#fYearFilter');
  if (yearSelect && yearSelect.options.length <= 1) {
    const years = [...new Set(expenses.map(i => (i.payment_date || i.invoice_date || '').slice(0, 4)).filter(Boolean))];
    const currentYear = new Date().getFullYear().toString();
    if (!years.includes(currentYear)) years.push(currentYear);
    years.sort().reverse();
    
    yearSelect.innerHTML = `<option value="all">Alle Jahre</option>` +
      years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('');
  }

  renderKPIs(filtered);
  renderCategoryBreakdown(filtered);
  renderList(filtered);
}

function formExpense(it = null) {
  const isEdit = !!it;
  const today = new Date().toISOString().slice(0, 10);
  
  const currentGross = it ? Number(it.gross_amount) || '' : '';
  const currentNet = it ? Number(it.net_amount) || '' : '';
  const currentInvoiceVatRate = it ? Number(it.invoice_vat_rate ?? it.vat_rate) || 19 : 19;
  const currentVatAmount = it ? Number(it.vat_amount) || '' : '';
  const currentFunding = it?.funding_source || it?.payer_type || 'business_account';
  const currentCountry = it?.vendor_country || 'DE';
  const currentCat = it?.tax_category || it?.euer_category || 'software_cloud';
  const currentDocType = it?.document_type || 'invoice';
  const currentDeductiblePct = it ? Number(it.deductible_percentage) || 100 : 100;

  openModal({
    title: isEdit ? 'Steuerbeleg & EÜR-Buchung bearbeiten' : 'Neue Betriebsausgabe erfassen (GoBD)',
    bodyHTML: `
      <div class="row-2" style="grid-template-columns: 1fr 1fr 1fr">
        <label class="fld">
          <span>Belegart</span>
          <select id="f_doc_type">
            ${Object.entries(DOCUMENT_TYPES).map(([k, l]) => `
              <option value="${k}" ${currentDocType === k ? 'selected' : ''}>${l}</option>
            `).join('')}
          </select>
        </label>
        <label class="fld">
          <span>Lieferant / Dienstleister *</span>
          <input id="f_vendor" value="${esc(it?.vendor_name || '')}" placeholder="z. B. Adobe, OpenAI, Supabase" required autofocus>
        </label>
        <label class="fld">
          <span>Rechnungsnummer</span>
          <input id="f_number" value="${esc(it?.invoice_number || '')}" placeholder="z. B. INV-2026-001">
        </label>
      </div>

      <div class="row-2" style="grid-template-columns: 1fr 1fr 1fr">
        <label class="fld">
          <span>Rechnungsdatum *</span>
          <input type="date" id="f_date" value="${esc(it?.invoice_date || today)}" required>
        </label>
        <label class="fld">
          <span>Zahlungsdatum (§ 11 EStG) *</span>
          <input type="date" id="f_payment_date" value="${esc(it?.payment_date || it?.invoice_date || today)}" required title="Für EÜR verbindliches Zahlungsflussdatum">
        </label>
        <label class="fld">
          <span>Leistungsdatum / Zeitraum</span>
          <input type="date" id="f_service_date" value="${esc(it?.service_date || '')}">
        </label>
      </div>

      <div class="row-2" style="grid-template-columns: 1.2fr 1fr 1fr 1fr; align-items: end;">
        <label class="fld">
          <span>Bruttobetrag (€) *</span>
          <input type="number" step="0.01" id="f_gross" value="${currentGross}" placeholder="0,00" required>
        </label>
        <label class="fld">
          <span>Rechnungs-USt-Satz</span>
          <select id="f_vat_rate">
            <option value="19" ${currentInvoiceVatRate === 19 ? 'selected' : ''}>19 % (Inland Regel)</option>
            <option value="7" ${currentInvoiceVatRate === 7 ? 'selected' : ''}>7 % (Ermäßigt)</option>
            <option value="0" ${currentInvoiceVatRate === 0 ? 'selected' : ''}>0 % (Rechnung ohne USt / Reverse Charge)</option>
          </select>
        </label>
        <label class="fld">
          <span>Rechnungs-USt (€)</span>
          <input type="number" step="0.01" id="f_vat_amount" value="${currentVatAmount}" placeholder="0,00">
        </label>
        <label class="fld">
          <span>Nettobetrag (€)</span>
          <input type="number" step="0.01" id="f_net" value="${currentNet}" placeholder="0,00">
        </label>
      </div>

      <div class="row-2" style="grid-template-columns: 1.3fr 1fr">
        <label class="fld">
          <span>Steuerkategorie (Anlage EÜR) *</span>
          <select id="f_category" required>
            ${Object.entries(EUER_CATEGORIES).map(([key, info]) => `
              <option value="${esc(key)}" ${currentCat === key ? 'selected' : ''}>
                ${info.icon} ${esc(info.label)}
              </option>
            `).join('')}
          </select>
        </label>
        <label class="fld">
          <span>Mittelherkunft / Konto *</span>
          <select id="f_funding_source" required>
            <option value="business_account" ${currentFunding === 'business_account' ? 'selected' : ''}>🏢 Geschäftskonto (Kemal)</option>
            <option value="kemal_private" ${currentFunding === 'kemal_private' ? 'selected' : ''}>👤 Privatkonto Kemal (Privateinlage)</option>
            <option value="melih_private" ${currentFunding === 'melih_private' ? 'selected' : ''}>🚫 Melih privat (Nicht in EÜR)</option>
            <option value="other" ${currentFunding === 'other' ? 'selected' : ''}>Sonstige</option>
          </select>
        </label>
      </div>

      <div class="row-2" style="grid-template-columns: 1fr 1.2fr 1.2fr; align-items: end;">
        <label class="fld">
          <span>Lieferantenland</span>
          <input id="f_vendor_country" value="${esc(currentCountry)}" placeholder="DE, IE, US" maxlength="5">
        </label>
        <label class="fld">
          <span>Lieferanten USt-IdNr.</span>
          <input id="f_vendor_vat_id" value="${esc(it?.vendor_vat_id || '')}" placeholder="z. B. IE9671888X">
        </label>
        <label class="chk-inline" style="padding-bottom:10px">
          <input type="checkbox" id="f_reverse_charge" ${it?.reverse_charge ? 'checked' : ''}>
          <span>§ 13b Reverse Charge (B2B Ausland)</span>
        </label>
      </div>

      <div class="row-2" style="grid-template-columns: 1fr 1fr">
        <label class="fld">
          <span>Abzugsfähiger Anteil (%)</span>
          <input type="number" step="1" id="f_deductible_pct" value="${currentDeductiblePct}" min="0" max="100">
        </label>
        <label class="fld">
          <span>Begründung / Notiz für Steuerberater</span>
          <input id="f_deductible_reason" value="${esc(it?.deductibility_reason || '')}" placeholder="z. B. 70% Bewirtung per § 4 Abs. 5 EStG">
        </label>
      </div>

      ${isEdit ? `
        <label class="fld" style="background:var(--bg-2);padding:10px;border-radius:6px;border:1px dashed var(--line)">
          <span style="color:var(--gold)">GoBD Änderungsgrund (Pflicht bei manueller Bearbeitung) *</span>
          <input id="f_change_reason" placeholder="z. B. OCR-Erkennungsfehler beim Rechnungsdatum korrigiert" required>
        </label>
      ` : ''}

      <div class="row-2" style="grid-template-columns: 1fr 1.2fr; align-items: center; padding: 4px 0;">
        <label class="chk-inline">
          <input type="checkbox" id="f_recurring" ${it?.is_recurring ? 'checked' : ''}>
          <span>Wiederkehrendes Abo (Monatlich/Jährlich)</span>
        </label>
        <label class="fld" id="f_interval_wrap" ${!it?.is_recurring ? 'style="display:none"' : ''}>
          <span>Intervall</span>
          <select id="f_interval">
            <option value="monthly" ${it?.recurring_interval === 'monthly' ? 'selected' : ''}>Monatlich</option>
            <option value="quarterly" ${it?.recurring_interval === 'quarterly' ? 'selected' : ''}>Vierteljährlich</option>
            <option value="yearly" ${it?.recurring_interval === 'yearly' ? 'selected' : ''}>Jährlich</option>
          </select>
        </label>
      </div>

      <div class="row-2">
        <label class="fld">
          <span>Google Drive Beleglink (URL)</span>
          <input type="url" id="f_drive_link" value="${esc(it?.drive_web_view_link || '')}" placeholder="https://drive.google.com/file/d/...">
        </label>
        <label class="fld">
          <span>Prüfstatus</span>
          <select id="f_status">
            <option value="processed" ${(!it || it.status === 'processed') ? 'selected' : ''}>Verarbeitet (OK)</option>
            <option value="review_needed" ${it?.status === 'review_needed' ? 'selected' : ''}>Prüfung nötig</option>
            <option value="archived" ${it?.status === 'archived' ? 'selected' : ''}>Archiviert</option>
          </select>
        </label>
      </div>
    `,
    onOpen: (body) => {
      const grossIn = $('#f_gross', body);
      const vatRateSel = $('#f_vat_rate', body);
      const vatAmountIn = $('#f_vat_amount', body);
      const netIn = $('#f_net', body);
      const recChk = $('#f_recurring', body);
      const intervalWrap = $('#f_interval_wrap', body);
      const rcChk = $('#f_reverse_charge', body);
      const catSel = $('#f_category', body);
      const dedPctIn = $('#f_deductible_pct', body);
      const dedReasonIn = $('#f_deductible_reason', body);

      const recalculateAmounts = () => {
        const gross = parseFloat(grossIn.value);
        if (isNaN(gross) || gross <= 0) return;

        let rate = parseFloat(vatRateSel.value);
        if (isNaN(rate)) rate = 0;

        if (rcChk.checked || rate === 0) {
          vatAmountIn.value = '0.00';
          netIn.value = gross.toFixed(2);
        } else {
          const net = gross / (1 + (rate / 100));
          const vat = gross - net;
          netIn.value = net.toFixed(2);
          vatAmountIn.value = vat.toFixed(2);
        }
      };

      grossIn.oninput = recalculateAmounts;
      vatRateSel.onchange = recalculateAmounts;
      
      rcChk.onchange = () => {
        if (rcChk.checked) vatRateSel.value = '0';
        recalculateAmounts();
      };

      catSel.onchange = () => {
        if (catSel.value === 'business_meals') {
          dedPctIn.value = '70';
          dedReasonIn.value = '70% geschäftliche Bewirtung (§ 4 Abs. 5 Nr. 2 EStG)';
        }
      };

      recChk.onchange = () => {
        intervalWrap.style.display = recChk.checked ? 'grid' : 'none';
      };
    },
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      {
        label: isEdit ? 'Speichern & Protokollieren' : 'Hinzufügen',
        kind: 'primary',
        onClick: async () => {
          const vendor = $('#f_vendor').value.trim();
          const invoiceDate = $('#f_date').value;
          const paymentDate = $('#f_payment_date').value || invoiceDate;
          const grossVal = parseFloat($('#f_gross').value);

          if (!vendor) { toast('Lieferant fehlt', true); return false; }
          if (!invoiceDate) { toast('Rechnungsdatum fehlt', true); return false; }
          if (isNaN(grossVal) || grossVal <= 0) { toast('Gültigen Bruttobetrag eingeben', true); return false; }

          let netVal = parseFloat($('#f_net').value);
          let vatAmountVal = parseFloat($('#f_vat_amount').value);
          let vatRateVal = parseFloat($('#f_vat_rate').value);
          if (isNaN(vatRateVal)) vatRateVal = 0;
          if (isNaN(netVal)) netVal = grossVal;
          if (isNaN(vatAmountVal)) vatAmountVal = grossVal - netVal;

          const isRc = $('#f_reverse_charge').checked;
          const rcTaxAmount = isRc ? (Math.round(netVal * 0.19 * 100) / 100) : 0;
          const fundingSource = $('#f_funding_source').value;
          const taxCat = $('#f_category').value;
          const isDeductible = fundingSource !== 'melih_private' && taxCat !== 'private_expense';
          const dedPct = parseFloat($('#f_deductible_pct').value) || 100;

          // Determine economic classification
          let econClass = 'business_expense';
          if (fundingSource === 'melih_private' || taxCat === 'private_expense') {
            econClass = 'private_expense';
          } else if (fundingSource === 'kemal_private') {
            econClass = 'private_contribution'; // Privateinlage
          }

          const row = {
            document_type: $('#f_doc_type').value,
            vendor_name: vendor,
            vendor_country: $('#f_vendor_country').value.trim().toUpperCase() || 'DE',
            vendor_vat_id: $('#f_vendor_vat_id').value.trim() || null,
            invoice_number: $('#f_number').value.trim() || null,
            invoice_date: invoiceDate,
            payment_date: paymentDate,
            cash_flow_date: paymentDate,
            service_date: $('#f_service_date').value || null,
            gross_amount: grossVal,
            net_amount: netVal,
            vat_rate: isRc ? 0 : vatRateVal,
            vat_amount: isRc ? 0 : vatAmountVal,
            invoice_vat_rate: vatRateVal,
            invoice_vat_amount: isRc ? 0 : vatAmountVal,
            reverse_charge: isRc,
            reverse_charge_tax_rate: 19.00,
            reverse_charge_tax_amount: rcTaxAmount,
            reverse_charge_input_vat_amount: rcTaxAmount,
            reverse_charge_reason: isRc ? '§ 13b UStG / B2B Ausland' : null,
            input_vat_eligible: !isRc && isDeductible,
            currency: 'EUR',
            tax_category: taxCat,
            euer_category: taxCat,
            funding_source: fundingSource,
            payer_type: fundingSource,
            economic_purpose: isDeductible ? 'business' : 'private',
            economic_classification: econClass,
            is_deductible: isDeductible,
            deductible_percentage: dedPct,
            deductibility_reason: $('#f_deductible_reason').value.trim() || null,
            is_recurring: $('#f_recurring').checked,
            recurring_interval: $('#f_recurring').checked ? $('#f_interval').value : 'none',
            description: $('#f_desc').value.trim() || null,
            drive_web_view_link: $('#f_drive_link').value.trim() || null,
            status: $('#f_status').value
          };

          if (isEdit) {
            const changeReason = $('#f_change_reason')?.value?.trim();
            if (!changeReason) {
              toast('GoBD: Bitte einen Änderungsgrund angeben', true);
              return false;
            }

            // 1. Update record
            const { error } = await sb.from('ops_finance_expenses').update(row).eq('id', it.id);
            if (error) return fail('Ausgabe speichern', error), false;

            // 2. Insert into GoBD audit log
            await sb.from('ops_finance_audit_log').insert({
              expense_id: it.id,
              event_type: 'manual_edit',
              field_name: 'multiple_fields',
              old_value: JSON.stringify({ gross: it.gross_amount, vendor: it.vendor_name, cat: it.tax_category, date: it.invoice_date }),
              new_value: JSON.stringify({ gross: row.gross_amount, vendor: row.vendor_name, cat: row.tax_category, date: row.invoice_date }),
              changed_by: state.me.id,
              changed_by_name: state.me.display_name,
              change_reason: changeReason,
              source: 'user'
            });

            toast('Ausgabe & GoBD-Änderungsprotokoll gespeichert');
          } else {
            const { error } = await sb.from('ops_finance_expenses').insert({ ...row, created_by: state.me.id });
            if (error) return fail('Ausgabe anlegen', error), false;
            toast('Ausgabe erfolgreich angelegt');
          }

          loadExpenses();
          return true;
        }
      }
    ]
  });
}

function exportEuerCSV() {
  const deductibleList = getFilteredExpenses().filter(i => i.is_deductible !== false && (i.funding_source || i.payer_type) !== 'melih_private');
  if (!deductibleList.length) {
    toast('Keine abzugsfähigen EÜR-Daten für den Export vorhanden', true);
    return;
  }

  const header = [
    'Zahlungsdatum (§11 EStG)',
    'Rechnungsdatum',
    'Belegart',
    'Rechnungsnummer',
    'Lieferant',
    'Land',
    'USt-IdNr.',
    'Anlage EÜR Kategorie',
    'Mittelherkunft / Konto',
    'Steuerliche Einordnung',
    'Abzugsfähig (%)',
    'Netto (€)',
    'Rechnungs-USt (%)',
    'Vorsteuer abzugsfähig (€)',
    '§ 13b Reverse Charge (€)',
    'Brutto (€)',
    'Abo',
    'Beschreibung',
    'GoBD File Hash'
  ];

  const rows = deductibleList.map(item => {
    const net = Number(item.net_amount) || 0;
    const pct = Number(item.deductible_percentage) || 100;
    const effectiveNet = (net * (pct / 100)).toFixed(2).replace('.', ',');

    return [
      item.payment_date || item.invoice_date || '',
      item.invoice_date || '',
      DOCUMENT_TYPES[item.document_type] || item.document_type || 'Rechnung',
      item.invoice_number ? `"${item.invoice_number.replace(/"/g, '""')}"` : '',
      `"${(item.vendor_name || '').replace(/"/g, '""')}"`,
      item.vendor_country || 'DE',
      item.vendor_vat_id || '',
      `"${(EUER_CATEGORIES[item.tax_category || item.euer_category]?.label || item.tax_category || '').replace(/"/g, '""')}"`,
      FUNDING_SOURCES[item.funding_source || item.payer_type]?.label || 'Geschäftskonto Kemal',
      ECONOMIC_CLASSIFICATIONS[item.economic_classification] || 'Betriebsausgabe',
      pct + '%',
      effectiveNet,
      (Number(item.invoice_vat_rate ?? item.vat_rate) || 0).toFixed(2).replace('.', ','),
      item.reverse_charge ? '0,00' : (Number(item.vat_amount || item.invoice_vat_amount) || 0).toFixed(2).replace('.', ','),
      item.reverse_charge ? (Number(item.reverse_charge_tax_amount) || (net * 0.19)).toFixed(2).replace('.', ',') : '0,00',
      (Number(item.gross_amount) || 0).toFixed(2).replace('.', ','),
      item.is_recurring ? 'Ja' : 'Nein',
      `"${(item.description || '').replace(/"/g, '""')}"`,
      item.original_file_hash || ''
    ];
  });

  const csvContent = '\uFEFF' + [header.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Anlage_EUER_Kemal_Einzelunternehmen_${selectedYear}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('EÜR CSV-Export für Elster & Steuerberater erfolgreich generiert');
}

function exportEuerJSON() {
  const deductibleList = getFilteredExpenses().filter(i => i.is_deductible !== false && (i.funding_source || i.payer_type) !== 'melih_private');
  if (!deductibleList.length) {
    toast('Keine Daten für den Export vorhanden', true);
    return;
  }

  const exportData = {
    taxpayer: {
      name: 'Yavuz Kemal Demir',
      legal_entity: 'Einzelunternehmen',
      country: 'Deutschland',
      jurisdiction: 'NRW',
      accounting_method: 'Einnahmen-Überschuss-Rechnung (§ 4 Abs. 3 EStG)'
    },
    export_year: selectedYear,
    generated_at: new Date().toISOString(),
    verfahrensdokumentation_version: '2.0',
    total_deductible_records: deductibleList.length,
    summary: {
      euer_operating_expenses_net: deductibleList.reduce((s, i) => s + ((Number(i.net_amount) || 0) * ((Number(i.deductible_percentage) || 100) / 100)), 0),
      euer_operating_expenses_gross: deductibleList.reduce((s, i) => s + (Number(i.gross_amount) || 0), 0),
      deductible_input_vat_15: deductibleList.filter(i => !i.reverse_charge).reduce((s, i) => s + (Number(i.vat_amount || i.invoice_vat_amount) || 0), 0),
      reverse_charge_13b_tax_base: deductibleList.filter(i => i.reverse_charge).reduce((s, i) => s + (Number(i.net_amount) || 0), 0),
      reverse_charge_13b_tax_liability: deductibleList.filter(i => i.reverse_charge).reduce((s, i) => s + (Number(i.reverse_charge_tax_amount) || (Number(i.net_amount) * 0.19) || 0), 0),
      private_contributions_kemal: deductibleList.filter(i => (i.funding_source || i.payer_type) === 'kemal_private').reduce((s, i) => s + (Number(i.gross_amount) || 0), 0)
    },
    expenses: deductibleList
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Anlage_EUER_Kemal_${selectedYear}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('EÜR JSON-Export erfolgreich generiert');
}

export function mountFinance() {
  // Bind controls
  $('#addExpenseBtn').onclick = () => formExpense();
  $('#exportCsvBtn').onclick = exportEuerCSV;
  $('#exportJsonBtn').onclick = exportEuerJSON;
  
  const driveBtn = $('#financeDriveLink');
  if (driveBtn) {
    driveBtn.href = INVOICE_FOLDER_URL;
    driveBtn.hidden = false;
  }

  $('#financeSearch').oninput = (e) => {
    query = e.target.value;
    render();
  };

  $('#fYearFilter').onchange = (e) => {
    selectedYear = e.target.value;
    render();
  };

  $('#fCatFilter').onchange = (e) => {
    selectedCategory = e.target.value;
    render();
  };

  $('#fStatusFilter').onchange = (e) => {
    selectedStatus = e.target.value;
    render();
  };

  const payerFilter = $('#fPaidByFilter');
  if (payerFilter) {
    payerFilter.onchange = (e) => {
      selectedPayer = e.target.value;
      render();
    };
  }

  const vatFilter = $('#fVatFilter');
  if (vatFilter) {
    vatFilter.onchange = (e) => {
      selectedVatFilter = e.target.value;
      render();
    };
  }

  $('#fOnlyRecurring').onchange = (e) => {
    onlyRecurring = e.target.checked;
    render();
  };

  // Delegated events for list
  $('#financeList').onclick = (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    const row = btn.closest('tr[data-id]');
    if (!row) return;

    const it = expenses.find(x => x.id === row.dataset.id);
    if (!it) return;

    if (btn.dataset.act === 'edit') {
      return formExpense(it);
    }

    if (btn.dataset.act === 'del') {
      confirmDialog('Ausgabe löschen', `${it.vendor_name} — ${fmtEuro(it.gross_amount)} wirklich löschen?`, async () => {
        const { error } = await sb.from('ops_finance_expenses').delete().eq('id', it.id);
        if (error) return fail('Löschen', error), false;
        expenses = expenses.filter(x => x.id !== it.id);
        render();
        toast('Ausgabe gelöscht');
        return true;
      });
    }
  };

  // Realtime subscription
  if (channel) { sb.removeChannel(channel); channel = null; }
  let t = null;
  const reload = () => { clearTimeout(t); t = setTimeout(loadExpenses, 250); };
  channel = sb.channel('ops_finance_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_finance_expenses' }, reload)
    .subscribe();

  loadExpenses();
}
