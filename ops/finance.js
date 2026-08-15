// Praxura Ops-Dashboard — Finanzen & Anlage EÜR Modul
import { sb, state, $, $$, esc, toast, fail, fmtDate, openModal, confirmDialog, memberById } from './app.js?v=20260811a';
import { INVOICE_FOLDER_URL } from './config.js?v=20260811a';

let expenses = [];
let query = '';
let selectedYear = new Date().getFullYear().toString();
let selectedCategory = 'all';
let selectedStatus = 'all';
let selectedPaidBy = 'all';
let onlyRecurring = false;
let channel = null;

export const EUER_CATEGORIES = {
  'software_cloud': { label: 'Software & Cloud-Dienste', icon: '☁️', desc: 'SaaS, Hosting, Vercel, Supabase, Domains, AI Tools, APIs' },
  'telecom_internet': { label: 'Telekommunikation & Internet', icon: '📱', desc: 'Mobilfunk, Telefon, Internetanschluss' },
  'office_supplies': { label: 'Büromaterial & Arbeitsmittel', icon: '📎', desc: 'Schreibwaren, Druckerpapier, Kleinmaterial' },
  'gwg_assets': { label: 'GWG (Geringwertige Wirtschaftsgüter)', icon: '💻', desc: 'Hardware & Geräte netto ≤ 800 € (Tastatur, Monitor, Headset)' },
  'travel_mobility': { label: 'Reise- & Fahrtkosten', icon: '🚆', desc: 'ÖPNV, Deutsche Bahn, Fahrtkosten' },
  'education_training': { label: 'Fortbildung & Fachliteratur', icon: '📚', desc: 'Fachbücher, Kurse, Zertifikate' },
  'marketing_sales': { label: 'Marketing & Vertrieb', icon: '📣', desc: 'Online-Ads (Google/Meta), Werbung, Branding' },
  'bank_fees': { label: 'Bank- & Nebenkosten des Geldverkehrs', icon: '💳', desc: 'Kontoführung, Transaktionsgebühren, Zahlungsdienstleister' },
  'other_operational': { label: 'Sonstige Betriebsausgaben', icon: '📦', desc: 'Sonstige abzugsfähige Betriebsausgaben' }
};

export const PAID_BY_OPTIONS = {
  'kemal': { label: 'Kemal', icon: '👤', cls: 'pill-kemal' },
  'melih': { label: 'Melih', icon: '👤', cls: 'pill-melih' },
  'gemeinsam': { label: 'Ortak / Gemeinsam', icon: '👥', cls: 'pill-joint' }
};

export const PAYMENT_METHODS = {
  'bank_transfer': 'Banküberweisung',
  'credit_card': 'Kreditkarte',
  'paypal': 'PayPal',
  'direct_debit': 'Lastschrift'
};

export const STATUS_LABELS = {
  'processed': { label: 'Verarbeitet', cls: 'st-ok' },
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
    // Year filter
    if (selectedYear !== 'all') {
      const itemYear = item.invoice_date ? item.invoice_date.slice(0, 4) : '';
      if (itemYear !== selectedYear) return false;
    }
    // Category filter
    if (selectedCategory !== 'all' && item.euer_category !== selectedCategory) {
      return false;
    }
    // Status filter
    if (selectedStatus !== 'all' && item.status !== selectedStatus) {
      return false;
    }
    // Paid By filter
    if (selectedPaidBy !== 'all') {
      const paid = item.paid_by || 'gemeinsam';
      if (paid !== selectedPaidBy) return false;
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
      const matchSender = (item.email_sender || '').toLowerCase().includes(q);
      const matchPaid = (item.paid_by || '').toLowerCase().includes(q);
      if (!matchVendor && !matchNumber && !matchDesc && !matchSender && !matchPaid) return false;
    }
    return true;
  });
}

function renderKPIs(list) {
  const totalGross = list.reduce((sum, item) => sum + (Number(item.gross_amount) || 0), 0);
  const totalNet = list.reduce((sum, item) => sum + (Number(item.net_amount) || 0), 0);
  const totalVat = list.reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0);

  // Active monthly subscriptions (calculated across all active recurring items)
  const recurringItems = expenses.filter(i => i.is_recurring && i.status !== 'archived');
  const monthlyRecurringEst = recurringItems.reduce((sum, item) => {
    const gross = Number(item.gross_amount) || 0;
    if (item.recurring_interval === 'yearly') return sum + (gross / 12);
    if (item.recurring_interval === 'quarterly') return sum + (gross / 3);
    return sum + gross; // default monthly
  }, 0);

  // Partner spend totals (filtered list)
  const totalKemal = list.filter(i => i.paid_by === 'kemal').reduce((sum, i) => sum + (Number(i.gross_amount) || 0), 0);
  const totalMelih = list.filter(i => i.paid_by === 'melih').reduce((sum, i) => sum + (Number(i.gross_amount) || 0), 0);
  const totalJoint = list.filter(i => (!i.paid_by || i.paid_by === 'gemeinsam')).reduce((sum, i) => sum + (Number(i.gross_amount) || 0), 0);

  const kpiContainer = $('#financeKPIs');
  if (!kpiContainer) return;

  kpiContainer.innerHTML = `
    <div class="f-kpi-card">
      <span class="f-kpi-title">Ausgaben (Brutto)</span>
      <span class="f-kpi-val">${fmtEuro(totalGross)}</span>
      <span class="f-kpi-sub">${list.length} Buchungen im Filter</span>
    </div>
    <div class="f-kpi-card">
      <span class="f-kpi-title">Ausgaben (Netto)</span>
      <span class="f-kpi-val">${fmtEuro(totalNet)}</span>
      <span class="f-kpi-sub">EÜR Betriebsausgaben</span>
    </div>
    <div class="f-kpi-card">
      <span class="f-kpi-title">Vorsteuer (USt.)</span>
      <span class="f-kpi-val">${fmtEuro(totalVat)}</span>
      <span class="f-kpi-sub">Erstattungsfähige USt.</span>
    </div>
    <div class="f-kpi-card">
      <span class="f-kpi-title">Laufende Abos / Fix</span>
      <span class="f-kpi-val">${recurringItems.length} <small style="font-size:14px;color:var(--text-dim)">(~${fmtEuro(monthlyRecurringEst)}/Mo)</small></span>
      <span class="f-kpi-sub">SaaS & Monatliche Kosten</span>
    </div>
    <div class="f-kpi-card f-kpi-partner-card">
      <span class="f-kpi-title">Ortaklar Dağılımı (Brutto)</span>
      <div class="f-partner-pills">
        <span class="pill pill-kemal" title="Kemal harcamaları">👤 Kemal: <strong>${fmtEuro(totalKemal)}</strong></span>
        <span class="pill pill-melih" title="Melih harcamaları">👤 Melih: <strong>${fmtEuro(totalMelih)}</strong></span>
      </div>
      <span class="f-kpi-sub">👥 Ortak: ${fmtEuro(totalJoint)}</span>
    </div>
  `;
}

function renderCategoryBreakdown(list) {
  const breakdownEl = $('#financeBreakdown');
  if (!breakdownEl) return;

  const totalGross = list.reduce((sum, item) => sum + (Number(item.gross_amount) || 0), 0);
  
  const catSums = {};
  for (const key of Object.keys(EUER_CATEGORIES)) {
    catSums[key] = { gross: 0, count: 0 };
  }

  for (const item of list) {
    const cat = item.euer_category || 'other_operational';
    if (!catSums[cat]) catSums[cat] = { gross: 0, count: 0 };
    catSums[cat].gross += Number(item.gross_amount) || 0;
    catSums[cat].count += 1;
  }

  const sortedCats = Object.entries(catSums)
    .filter(([_, data]) => data.gross > 0 || selectedCategory === 'all')
    .sort((a, b) => b[1].gross - a[1].gross);

  breakdownEl.innerHTML = `
    <div class="f-breakdown-card">
      <div class="f-breakdown-head">
        <h3>Anlage EÜR Kostenverteilung</h3>
        <span class="hint">Aufteilung nach deutschen Steuerkategorien</span>
      </div>
      <div class="f-breakdown-list">
        ${sortedCats.map(([catKey, data]) => {
          const info = EUER_CATEGORIES[catKey] || { label: catKey, icon: '🏷️' };
          const pct = totalGross > 0 ? Math.round((data.gross / totalGross) * 100) : 0;
          return `
            <div class="f-cat-row" data-cat="${esc(catKey)}">
              <div class="f-cat-info">
                <span class="f-cat-icon">${info.icon}</span>
                <span class="f-cat-name">${esc(info.label)}</span>
                <span class="f-cat-count">${data.count} Belege</span>
                <span class="f-cat-amount">${fmtEuro(data.gross)}</span>
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
            <th>Status</th>
            <th>Datum</th>
            <th>Lieferant & Art</th>
            <th>Kime Ait / Ortak</th>
            <th>EÜR Kategorie</th>
            <th>Zahlung</th>
            <th style="text-align:right">Netto</th>
            <th style="text-align:right">USt.</th>
            <th style="text-align:right">Brutto</th>
            <th style="text-align:center">Beleg</th>
            <th style="text-align:right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(item => {
            const catInfo = EUER_CATEGORIES[item.euer_category] || { label: item.euer_category, icon: '🏷️' };
            const statusInfo = STATUS_LABELS[item.status] || { label: item.status, cls: 'st-mute' };
            const paidKey = item.paid_by || 'gemeinsam';
            const paidInfo = PAID_BY_OPTIONS[paidKey] || PAID_BY_OPTIONS['gemeinsam'];
            const payLabel = PAYMENT_METHODS[item.payment_method] || item.payment_method || '—';
            
            return `
              <tr data-id="${item.id}" class="f-row ${item.status === 'review_needed' ? 'is-warning' : ''}">
                <td>
                  <span class="pill ${statusInfo.cls}">${esc(statusInfo.label)}</span>
                </td>
                <td>
                  <div style="font-weight:500">${esc(fmtDate(item.invoice_date))}</div>
                  ${item.due_date ? `<div class="f-subtext">Fällig: ${esc(fmtDate(item.due_date))}</div>` : ''}
                </td>
                <td>
                  <div class="f-vendor-cell">
                    <span class="f-vendor-name">${esc(item.vendor_name)}</span>
                    ${item.is_recurring 
                      ? `<span class="pill pill-abo" title="Wiederkehrendes Abo (${esc(item.recurring_interval)})">🔄 Abo (${esc(item.recurring_interval)})</span>` 
                      : `<span class="pill pill-once" title="Einmalige Ausgabe">Einmalig</span>`}
                  </div>
                  ${item.invoice_number ? `<div class="f-subtext">Nr. ${esc(item.invoice_number)}</div>` : ''}
                  ${item.description ? `<div class="f-desc" title="${esc(item.description)}">${esc(item.description)}</div>` : ''}
                </td>
                <td>
                  <span class="pill ${paidInfo.cls}">
                    ${paidInfo.icon} ${esc(paidInfo.label)}
                  </span>
                </td>
                <td>
                  <span class="f-cat-badge" title="${esc(catInfo.desc || '')}">
                    <span>${catInfo.icon}</span> ${esc(catInfo.label)}
                  </span>
                </td>
                <td>
                  <span class="f-subtext">${esc(payLabel)}</span>
                </td>
                <td style="text-align:right" class="f-num">
                  ${fmtEuro(item.net_amount)}
                </td>
                <td style="text-align:right" class="f-num">
                  <div>${fmtEuro(item.vat_amount)}</div>
                  <div class="f-subtext">${Number(item.vat_rate) || 0}%</div>
                </td>
                <td style="text-align:right" class="f-num f-gross">
                  <strong>${fmtEuro(item.gross_amount)}</strong>
                </td>
                <td style="text-align:center">
                  ${item.drive_web_view_link ? `
                    <a href="${esc(item.drive_web_view_link)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm f-beleg-btn" title="PDF in Google Drive öffnen">
                      📄 PDF ↗
                    </a>
                  ` : (item.drive_file_id ? `
                    <a href="https://drive.google.com/file/d/${esc(item.drive_file_id)}/view" target="_blank" rel="noopener" class="btn btn-ghost btn-sm f-beleg-btn" title="PDF in Google Drive öffnen">
                      📄 Drive ↗
                    </a>
                  ` : `<span class="f-subtext">—</span>`)}
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
    const years = [...new Set(expenses.map(i => i.invoice_date ? i.invoice_date.slice(0, 4) : null).filter(Boolean))];
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
  const currentVatRate = it ? Number(it.vat_rate) || 19 : 19;
  const currentVatAmount = it ? Number(it.vat_amount) || '' : '';
  const currentPaidBy = it?.paid_by || 'gemeinsam';

  openModal({
    title: isEdit ? 'Ausgabe / Beleg bearbeiten' : 'Neue Ausgabe erfassen',
    bodyHTML: `
      <div class="row-2">
        <label class="fld">
          <span>Lieferant / Dienstleister *</span>
          <input id="f_vendor" value="${esc(it?.vendor_name || '')}" placeholder="z. B. Adobe, Supabase, Telekom, OpenAI" required autofocus>
        </label>
        <label class="fld">
          <span>Rechnungsnummer</span>
          <input id="f_number" value="${esc(it?.invoice_number || '')}" placeholder="z. B. INV-2026-001">
        </label>
      </div>

      <div class="row-2">
        <label class="fld">
          <span>Rechnungsdatum *</span>
          <input type="date" id="f_date" value="${esc(it?.invoice_date || today)}" required>
        </label>
        <label class="fld">
          <span>Fälligkeitsdatum</span>
          <input type="date" id="f_due" value="${esc(it?.due_date || '')}">
        </label>
      </div>

      <div class="row-2" style="grid-template-columns: 1.2fr 1fr 1fr 1fr; align-items: end;">
        <label class="fld">
          <span>Bruttobetrag (€) *</span>
          <input type="number" step="0.01" id="f_gross" value="${currentGross}" placeholder="0,00" required>
        </label>
        <label class="fld">
          <span>USt.-Satz</span>
          <select id="f_vat_rate">
            <option value="19" ${currentVatRate === 19 ? 'selected' : ''}>19 % (Regel)</option>
            <option value="7" ${currentVatRate === 7 ? 'selected' : ''}>7 % (Ermäßigt)</option>
            <option value="0" ${currentVatRate === 0 ? 'selected' : ''}>0 % (Steuerfrei / §19 / Reverse)</option>
            <option value="custom" ${![0, 7, 19].includes(currentVatRate) ? 'selected' : ''}>Benutzerdefiniert</option>
          </select>
        </label>
        <label class="fld">
          <span>USt.-Betrag (€)</span>
          <input type="number" step="0.01" id="f_vat_amount" value="${currentVatAmount}" placeholder="0,00">
        </label>
        <label class="fld">
          <span>Nettobetrag (€)</span>
          <input type="number" step="0.01" id="f_net" value="${currentNet}" placeholder="0,00">
        </label>
      </div>

      <div class="row-2">
        <label class="fld">
          <span>Anlage EÜR Steuerkategorie *</span>
          <select id="f_category" required>
            ${Object.entries(EUER_CATEGORIES).map(([key, info]) => `
              <option value="${esc(key)}" ${(it?.euer_category === key || (!it && key === 'software_cloud')) ? 'selected' : ''}>
                ${info.icon} ${esc(info.label)}
              </option>
            `).join('')}
          </select>
        </label>
        <label class="fld">
          <span>Kime Ait / Ortak (Zugehörigkeit) *</span>
          <select id="f_paid_by" required>
            <option value="gemeinsam" ${currentPaidBy === 'gemeinsam' ? 'selected' : ''}>👥 Ortak / Gemeinsam</option>
            <option value="kemal" ${currentPaidBy === 'kemal' ? 'selected' : ''}>👤 Kemal</option>
            <option value="melih" ${currentPaidBy === 'melih' ? 'selected' : ''}>👤 Melih</option>
          </select>
        </label>
      </div>

      <div class="row-2">
        <label class="fld">
          <span>Zahlungsart</span>
          <select id="f_payment">
            ${Object.entries(PAYMENT_METHODS).map(([key, label]) => `
              <option value="${esc(key)}" ${it?.payment_method === key ? 'selected' : ''}>
                ${esc(label)}
              </option>
            `).join('')}
          </select>
        </label>
        <label class="fld">
          <span>Status</span>
          <select id="f_status">
            <option value="processed" ${(!it || it.status === 'processed') ? 'selected' : ''}>Verarbeitet (OK)</option>
            <option value="review_needed" ${it?.status === 'review_needed' ? 'selected' : ''}>Prüfung nötig</option>
            <option value="archived" ${it?.status === 'archived' ? 'selected' : ''}>Archiviert</option>
          </select>
        </label>
      </div>

      <div class="row-2" style="grid-template-columns: 1fr 1.2fr; align-items: center; padding: 6px 0;">
        <label class="chk-inline">
          <input type="checkbox" id="f_recurring" ${it?.is_recurring ? 'checked' : ''}>
          <span>Wiederkehrende Ausgabe (Abo / Fixkosten)</span>
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

      <label class="fld">
        <span>Beschreibung / Notiz</span>
        <textarea id="f_desc" style="min-height:70px" placeholder="z. B. ChatGPT Plus Abo für Kemal, Server-Hosting für Praxura">${esc(it?.description || '')}</textarea>
      </label>

      <div class="row-2">
        <label class="fld">
          <span>Google Drive Beleglink (URL)</span>
          <input type="url" id="f_drive_link" value="${esc(it?.drive_web_view_link || '')}" placeholder="https://drive.google.com/file/d/...">
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

      const recalculateAmounts = () => {
        const gross = parseFloat(grossIn.value);
        if (isNaN(gross) || gross <= 0) return;

        let rate = parseFloat(vatRateSel.value);
        if (isNaN(rate)) rate = 0;

        if (rate === 0) {
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

      recChk.onchange = () => {
        intervalWrap.style.display = recChk.checked ? 'grid' : 'none';
      };
    },
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      {
        label: isEdit ? 'Speichern' : 'Hinzufügen',
        kind: 'primary',
        onClick: async () => {
          const vendor = $('#f_vendor').value.trim();
          const invoiceDate = $('#f_date').value;
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

          const isRec = $('#f_recurring').checked;
          const recInterval = isRec ? $('#f_interval').value : 'none';
          const paidBy = $('#f_paid_by').value;

          const row = {
            vendor_name: vendor,
            invoice_number: $('#f_number').value.trim() || null,
            invoice_date: invoiceDate,
            due_date: $('#f_due').value || null,
            gross_amount: grossVal,
            net_amount: netVal,
            vat_rate: vatRateVal,
            vat_amount: vatAmountVal,
            currency: 'EUR',
            euer_category: $('#f_category').value,
            paid_by: paidBy,
            is_recurring: isRec,
            recurring_interval: recInterval,
            payment_method: $('#f_payment').value,
            description: $('#f_desc').value.trim() || null,
            drive_web_view_link: $('#f_drive_link').value.trim() || null,
            status: $('#f_status').value
          };

          const q = isEdit
            ? sb.from('ops_finance_expenses').update(row).eq('id', it.id)
            : sb.from('ops_finance_expenses').insert({ ...row, created_by: state.me.id });

          const { error } = await q;
          if (error) return fail('Ausgabe speichern', error), false;

          toast(isEdit ? 'Ausgabe aktualisiert' : 'Ausgabe angelegt');
          loadExpenses();
          return true;
        }
      }
    ]
  });
}

function exportEuerCSV() {
  const list = getFilteredExpenses();
  if (!list.length) {
    toast('Keine Daten für den Export vorhanden', true);
    return;
  }

  const header = [
    'Datum',
    'Rechnungsnummer',
    'Lieferant',
    'Zugehörigkeit / Person',
    'Anlage EÜR Kategorie',
    'Netto (€)',
    'USt.-Satz (%)',
    'USt.-Betrag (€)',
    'Brutto (€)',
    'Zahlungsart',
    'Abo / Wiederkehrend',
    'Intervall',
    'Status',
    'Beschreibung',
    'Drive Link'
  ];

  const rows = list.map(item => [
    item.invoice_date || '',
    item.invoice_number ? `"${item.invoice_number.replace(/"/g, '""')}"` : '',
    `"${(item.vendor_name || '').replace(/"/g, '""')}"`,
    PAID_BY_OPTIONS[item.paid_by]?.label || item.paid_by || 'Gemeinsam',
    `"${(EUER_CATEGORIES[item.euer_category]?.label || item.euer_category || '').replace(/"/g, '""')}"`,
    (Number(item.net_amount) || 0).toFixed(2).replace('.', ','),
    (Number(item.vat_rate) || 0).toFixed(2).replace('.', ','),
    (Number(item.vat_amount) || 0).toFixed(2).replace('.', ','),
    (Number(item.gross_amount) || 0).toFixed(2).replace('.', ','),
    PAYMENT_METHODS[item.payment_method] || item.payment_method || '',
    item.is_recurring ? 'Ja' : 'Nein',
    item.recurring_interval || '',
    item.status || '',
    `"${(item.description || '').replace(/"/g, '""')}"`,
    item.drive_web_view_link || ''
  ]);

  const csvContent = '\uFEFF' + [header.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Anlage_EUER_Export_${selectedYear}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('EÜR CSV-Export erfolgreich generiert');
}

function exportEuerJSON() {
  const list = getFilteredExpenses();
  if (!list.length) {
    toast('Keine Daten für den Export vorhanden', true);
    return;
  }

  const exportData = {
    business_owner: 'Yavuz Kemal Demir',
    tax_type: 'Einnahmen-Überschuss-Rechnung (EÜR)',
    export_year: selectedYear,
    generated_at: new Date().toISOString(),
    total_records: list.length,
    summary: {
      total_gross: list.reduce((s, i) => s + (Number(i.gross_amount) || 0), 0),
      total_net: list.reduce((s, i) => s + (Number(i.net_amount) || 0), 0),
      total_vat: list.reduce((s, i) => s + (Number(i.vat_amount) || 0), 0),
      kemal_gross: list.filter(i => i.paid_by === 'kemal').reduce((s, i) => s + (Number(i.gross_amount) || 0), 0),
      melih_gross: list.filter(i => i.paid_by === 'melih').reduce((s, i) => s + (Number(i.gross_amount) || 0), 0),
      gemeinsam_gross: list.filter(i => (!i.paid_by || i.paid_by === 'gemeinsam')).reduce((s, i) => s + (Number(i.gross_amount) || 0), 0)
    },
    expenses: list
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Anlage_EUER_Export_${selectedYear}_${new Date().toISOString().slice(0, 10)}.json`;
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

  const paidByFilter = $('#fPaidByFilter');
  if (paidByFilter) {
    paidByFilter.onchange = (e) => {
      selectedPaidBy = e.target.value;
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
