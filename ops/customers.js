// Praxura Cockpit — Kunden 360° (SaaS + On-Prem Boxen)
import { sb, $, esc, toast, fail, fmtDate, openModal, confirmDialog, myRole } from './app.js?v=20261127c';
import { t, onLangChange } from './i18n.js?v=20261127c';
import { getCustomers, getKiUsage, currentMonthUtc } from './cockpit-api.js?v=20261127c';

const FACHBEREICHE = ['podologie', 'physiotherapie', 'ergotherapie', 'logopaedie', 'interdisziplinaer'];

function normalizeFachbereich(v) {
  if (typeof v !== 'string') return null;
  const key = v.trim().toLowerCase();
  if (!key) return null;
  switch (key) {
    case 'physiotherapy':
    case 'physiotherapie':
      return 'physiotherapie';
    case 'ergotherapy':
    case 'ergotherapie':
      return 'ergotherapie';
    case 'logopaedie':
    case 'logopädie':
    case 'speech':
      return 'logopaedie';
    case 'podologie':
    case 'podiatry':
      return 'podologie';
    case 'interdisziplinaer':
    case 'interdisziplinär':
    case 'praxis':
    case 'massage':
    case 'other':
      return 'interdisziplinaer';
    default:
      return null;
  }
}

const canEditPractice = (role = myRole()) => role === 'founder' || role === 'sales' || role === 'tech';
const MODES = ['saas', 'box', 'hybrid'];
const STAGES = ['lead', 'demo', 'onboarding', 'aktiv', 'risiko', 'gekuendigt'];
const BILLING_MODES = ['pilot_frei', 'stripe', 'rechnung'];
const PAYMENT_STATUSES = ['ok', 'trial', 'past_due', 'paused', 'canceled'];
const CHECKLIST_KEYS = [
  { key: 'avv', labelDe: 'AVV abgeschlossen' },
  { key: 'onboarding_call', labelDe: 'Kickoff / Onboarding' },
  { key: 'rezept_test', labelDe: 'Rezept-OCR Testlauf' },
  { key: 'abrechnung', labelDe: 'Abrechnung / DTA eingerichtet' },
];

let crmRows = [];
let billingMap = new Map();
let saasMap = new Map();
let saasList = [];
let apiStatus = null;
let schemaMissing = false;

let filterQuery = '';
let filterFach = 'all';
let filterMode = 'all';
let filterStage = 'all';

let selectedCustomerKey = null; // crm id oder `saas:<tenantId>`
let drawerEscHandler = null;
let unsubLang = null;

function isMissingTableError(err) {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205' || /does not exist|could not find the table/i.test(err.message || '');
}

function fmtEur(val, digits = 2) {
  if (val === null || val === undefined || val === '') return '—';
  return (Number(val) || 0).toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) + ' €';
}

function fmtInt(val) {
  return Math.round(Number(val) || 0).toLocaleString('de-DE');
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (!Number.isFinite(target)) return null;
  const today = new Date().setUTCHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000));
}

async function loadCustomersData() {
  const role = myRole();
  const canSeeBilling = role === 'founder' || role === 'sales';
  const month = currentMonthUtc();

  const [crmRes, bilRes, apiRes] = await Promise.all([
    sb.from('ops_customers').select('*').order('display_name'),
    canSeeBilling
      ? sb.from('ops_customer_billing').select('*')
      : Promise.resolve({ data: [], error: null }),
    getCustomers(month),
  ]);

  schemaMissing = isMissingTableError(crmRes.error) || isMissingTableError(bilRes.error);
  if (crmRes.error && !isMissingTableError(crmRes.error)) fail('Kunden laden', crmRes.error);
  if (bilRes.error && !isMissingTableError(bilRes.error)) fail('Vertragsdaten laden', bilRes.error);

  crmRows = crmRes.data || [];
  billingMap = new Map((bilRes.data || []).map((b) => [b.customer_id, b]));
  apiStatus = apiRes;
  saasList = apiRes.ok ? (apiRes.data?.customers || []) : [];
  saasMap = new Map(saasList.map((s) => [s.tenantId, s]));
}

function buildMergedRows() {
  const linkedTenants = new Set();
  const merged = [];

  for (const c of crmRows) {
    if (c.tenant_id) linkedTenants.add(c.tenant_id);
    const saas = c.tenant_id ? saasMap.get(c.tenant_id) || null : null;
    const billing = billingMap.get(c.id) || null;
    merged.push({
      key: c.id,
      isLinkedCrm: true,
      crm: c,
      saas,
      billing,
      displayName: c.display_name,
      fachbereich: normalizeFachbereich(c.fachbereich) || normalizeFachbereich(saas?.fachbereich) || 'podologie',
      deploymentMode: c.deployment_mode || 'saas',
      lifecycleStage: c.lifecycle_stage || 'lead',
      tenantId: c.tenant_id || null,
      boxName: c.box_name || null,
    });
  }

  for (const s of saasList) {
    if (linkedTenants.has(s.tenantId)) continue;
    merged.push({
      key: `saas:${s.tenantId}`,
      isLinkedCrm: false,
      crm: null,
      saas: s,
      billing: null,
      displayName: s.name || s.tenantId,
      fachbereich: normalizeFachbereich(s.fachbereich) || 'podologie',
      deploymentMode: 'saas',
      lifecycleStage: s.planStatus === 'past_due' ? 'risiko' : (s.isActive ? 'aktiv' : 'onboarding'),
      tenantId: s.tenantId,
      boxName: null,
    });
  }

  return merged;
}

function unlinkedSaasCount() {
  const linked = new Set(crmRows.map((c) => c.tenant_id).filter(Boolean));
  return saasList.filter((s) => !linked.has(s.tenantId)).length;
}

async function syncUnlinkedSaas() {
  if (!canEditPractice()) return;
  const linked = new Set(crmRows.map((c) => c.tenant_id).filter(Boolean));
  const missing = saasList.filter((s) => !linked.has(s.tenantId));
  if (!missing.length) return;

  const payload = missing.map((s) => ({
    display_name: s.name || 'Praxis',
    tenant_id: s.tenantId,
    deployment_mode: 'saas',
    fachbereich: normalizeFachbereich(s.fachbereich) || 'podologie',
    lifecycle_stage: s.planStatus === 'past_due' ? 'risiko' : (s.isActive ? 'aktiv' : 'onboarding'),
    avv_signed: Boolean(s.avvAcceptedAt),
    avv_signed_at: s.avvAcceptedAt ? String(s.avvAcceptedAt).slice(0, 10) : null,
  }));

  const { error } = await sb.from('ops_customers').insert(payload);
  if (error) return fail('SaaS-Sync', error);
  toast(t('cust.syncDone', { n: payload.length }));
  await mountCustomers();
}

function openPracticeModal(existingRow = null, prefillSaas = null) {
  const role = myRole();
  if (!canEditPractice(role)) return;
  const canSeeBilling = role === 'founder' || role === 'sales';
  const crm = existingRow?.crm || null;
  const bil = existingRow?.billing || null;

  const name = crm?.display_name || prefillSaas?.name || '';
  const tenantId = crm?.tenant_id || prefillSaas?.tenantId || '';
  const boxName = crm?.box_name || '';
  const mode = crm?.deployment_mode || 'saas';
  const fach = normalizeFachbereich(crm?.fachbereich) || normalizeFachbereich(prefillSaas?.fachbereich) || 'podologie';
  const stage = crm?.lifecycle_stage || (prefillSaas ? 'aktiv' : 'lead');
  const contactName = crm?.contact_name || '';
  const contactEmail = crm?.contact_email || '';
  const contactPhone = crm?.contact_phone || '';
  const avvSigned = crm ? Boolean(crm.avv_signed) : Boolean(prefillSaas?.avvAcceptedAt);
  const avvDate = crm?.avv_signed_at || (prefillSaas?.avvAcceptedAt ? String(prefillSaas.avvAcceptedAt).slice(0, 10) : '');
  const itsgDate = crm?.itsg_cert_expires_at || '';

  openModal({
    title: crm ? `${t('common.edit')}: ${crm.display_name}` : t('cust.newBtn'),
    bodyHTML: `
      <label class="fld">
        <span>${esc(t('cust.field.displayName'))}</span>
        <input id="c_name" value="${esc(name)}" required>
      </label>
      <div class="row-2">
        <label class="fld">
          <span>${esc(t('cust.col.fachbereich'))}</span>
          <select id="c_fach">
            ${FACHBEREICHE.map((f) => `<option value="${f}" ${f === fach ? 'selected' : ''}>${esc(t('cust.fach.' + f))}</option>`).join('')}
          </select>
        </label>
        <label class="fld">
          <span>${esc(t('cust.col.mode'))}</span>
          <select id="c_mode">
            ${MODES.map((m) => `<option value="${m}" ${m === mode ? 'selected' : ''}>${esc(t('cust.mode.' + m))}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="row-2">
        <label class="fld">
          <span>${esc(t('cust.col.stage'))}</span>
          <select id="c_stage">
            ${STAGES.map((s) => `<option value="${s}" ${s === stage ? 'selected' : ''}>${esc(t('cust.stage.' + s))}</option>`).join('')}
          </select>
        </label>
        <label class="fld">
          <span>${esc(t('cust.field.boxName'))}</span>
          <input id="c_box" value="${esc(boxName)}" placeholder="praxis-box-01">
        </label>
      </div>
      <label class="fld">
        <span>${esc(t('cust.field.tenantId'))}</span>
        <input id="c_tenant" value="${esc(tenantId)}" placeholder="uuid">
      </label>
      <div class="row-2">
        <label class="fld">
          <span>${esc(t('cust.field.contactName'))}</span>
          <input id="c_cname" value="${esc(contactName)}">
        </label>
        <label class="fld">
          <span>${esc(t('cust.field.contactPhone'))}</span>
          <input id="c_cphone" value="${esc(contactPhone)}">
        </label>
      </div>
      <label class="fld">
        <span>${esc(t('cust.field.contactEmail'))}</span>
        <input type="email" id="c_cemail" value="${esc(contactEmail)}">
      </label>
      <div class="row-2">
        <label class="fld">
          <span>${esc(t('cust.field.avvDate'))}</span>
          <input type="date" id="c_avv_date" value="${esc(avvDate)}">
        </label>
        <label class="fld">
          <span>${esc(t('cust.field.itsgDate'))}</span>
          <input type="date" id="c_itsg_date" value="${esc(itsgDate)}">
        </label>
      </div>
      <label class="chk-inline">
        <input type="checkbox" id="c_avv" ${avvSigned ? 'checked' : ''}>
        <span>${esc(t('cust.field.avvSigned'))}</span>
      </label>
      ${canSeeBilling ? `
        <hr class="ck-hr">
        <div class="row-2">
          <label class="fld">
            <span>${esc(t('cust.field.billingMode'))}</span>
            <select id="cb_mode">
              ${BILLING_MODES.map((m) => `<option value="${m}" ${m === (bil?.billing_mode || 'pilot_frei') ? 'selected' : ''}>${esc(m)}</option>`).join('')}
            </select>
          </label>
          <label class="fld">
            <span>${esc(t('cust.field.paymentStatus'))}</span>
            <select id="cb_status">
              ${PAYMENT_STATUSES.map((s) => `<option value="${s}" ${s === (bil?.payment_status || 'ok') ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="row-2">
          <label class="fld">
            <span>${esc(t('cust.field.planLabel'))}</span>
            <input id="cb_plan" value="${esc(bil?.plan_label || '')}" placeholder="Pilot / Standard / Pro">
          </label>
          <label class="fld">
            <span>${esc(t('cust.field.monthlyEur'))}</span>
            <input type="number" step="0.01" id="cb_monthly" value="${esc(bil?.contract_monthly_eur ?? '')}">
          </label>
        </div>
      ` : ''}
    `,
    actions: [
      { label: t('common.cancel'), onClick: () => true },
      {
        label: t('common.save'),
        kind: 'primary',
        onClick: async () => {
          const displayName = $('#c_name')?.value.trim();
          if (!displayName) return false;
          const tenantVal = $('#c_tenant')?.value.trim() || null;
          const boxVal = $('#c_box')?.value.trim() || null;

          const row = {
            display_name: displayName,
            fachbereich: $('#c_fach').value,
            deployment_mode: $('#c_mode').value,
            lifecycle_stage: $('#c_stage').value,
            tenant_id: tenantVal,
            box_name: boxVal,
            contact_name: $('#c_cname').value.trim() || null,
            contact_email: $('#c_cemail').value.trim() || null,
            contact_phone: $('#c_cphone').value.trim() || null,
            avv_signed: $('#c_avv').checked,
            avv_signed_at: $('#c_avv_date').value || null,
            itsg_cert_expires_at: $('#c_itsg_date').value || null,
          };

          let savedId = crm?.id || null;
          if (crm) {
            const { error } = await sb.from('ops_customers').update(row).eq('id', crm.id);
            if (error) { fail('Praxis speichern', error); return false; }
          } else {
            const { data, error } = await sb.from('ops_customers').insert(row).select('id').single();
            if (error) { fail('Praxis anlegen', error); return false; }
            savedId = data.id;
          }

          if (canSeeBilling && savedId) {
            const monthlyRaw = $('#cb_monthly')?.value.trim();
            const bilRow = {
              customer_id: savedId,
              billing_mode: $('#cb_mode').value,
              payment_status: $('#cb_status').value,
              plan_label: $('#cb_plan').value.trim() || null,
              contract_monthly_eur: monthlyRaw === '' ? null : Number(monthlyRaw),
            };
            const { error: bilErr } = await sb.from('ops_customer_billing').upsert(bilRow, { onConflict: 'customer_id' });
            if (bilErr) { fail('Vertragsdaten', bilErr); return false; }
          }

          toast(t('cust.saved'));
          selectedCustomerKey = savedId;
          await mountCustomers();
          return true;
        },
      },
    ],
  });
}

function closeDrawer() {
  selectedCustomerKey = null;
  const back = $('#ckDrawerBack');
  if (back) back.hidden = true;
  if (drawerEscHandler) {
    document.removeEventListener('keydown', drawerEscHandler);
    drawerEscHandler = null;
  }
}

async function renderDrawer(row) {
  const back = $('#ckDrawerBack');
  const body = $('#ckDrawerBody');
  const titleEl = $('#ckDrawerTitle');
  if (!back || !body || !titleEl) return;

  const role = myRole();
  const canEdit = canEditPractice(role);
  const canSeeBilling = role === 'founder' || role === 'sales';
  const canSeeKiCosts = role === 'founder' || role === 'tech';
  const isFounder = role === 'founder';
  const month = currentMonthUtc();
  const crm = row.crm;
  const saas = row.saas;
  const bil = row.billing;
  const certDays = daysUntil(crm?.itsg_cert_expires_at);

  titleEl.textContent = row.displayName;
  back.hidden = false;

  if (!drawerEscHandler) {
    drawerEscHandler = (e) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', drawerEscHandler);
  }

  const checklist = crm?.onboarding_checklist || {};
  const ki = saas?.ki || null;

  body.innerHTML = `
    <div class="ck-drawer-top-badges">
      <span class="ck-badge">${esc(t('cust.fach.' + row.fachbereich))}</span>
      <span class="ck-badge">${esc(t('cust.mode.' + row.deploymentMode))}</span>
      <span class="ck-badge stage-${esc(row.lifecycleStage)}">${esc(t('cust.stage.' + row.lifecycleStage))}</span>
      ${!row.isLinkedCrm ? `<span class="ck-badge sev-warn">${esc(t('cust.unlinkedBadge'))}</span>` : ''}
    </div>

    ${canEdit ? `
      <div class="ck-drawer-actions">
        ${row.isLinkedCrm
          ? `<button class="btn btn-ghost" id="dEditBtn">${esc(t('common.edit'))}</button>`
          : `<button class="btn btn-primary" id="dLinkBtn">${esc(t('cust.newBtn'))}</button>`}
      </div>
    ` : ''}

    <section class="ck-drawer-sec">
      <h4>${esc(t('cust.drawer.profile'))}</h4>
      <div class="ck-kv-grid">
        <div><span>Tenant-ID</span><code>${esc(row.tenantId || '—')}</code></div>
        <div><span>Box</span><code>${esc(row.boxName || '—')}</code></div>
        <div><span>${esc(t('cust.field.contactName'))}</span><strong>${esc(crm?.contact_name || '—')}</strong></div>
        <div><span>${esc(t('cust.field.contactEmail'))}</span><strong>${esc(crm?.contact_email || '—')}</strong></div>
        <div><span>${esc(t('cust.field.contactPhone'))}</span><strong>${esc(crm?.contact_phone || '—')}</strong></div>
      </div>
    </section>

    <section class="ck-drawer-sec">
      <h4>${esc(t('cust.drawer.compliance'))}</h4>
      <div class="ck-kv-grid">
        <div><span>AVV</span><strong>${crm?.avv_signed || saas?.avvAcceptedAt ? esc(t('cust.avvOk')) : esc(t('cust.avvMissing'))} ${crm?.avv_signed_at ? `(${esc(fmtDate(crm.avv_signed_at))})` : ''}</strong></div>
        <div><span>ITSG</span><strong>${crm?.itsg_cert_expires_at ? `${esc(fmtDate(crm.itsg_cert_expires_at))}` : '—'} ${certDays !== null && certDays <= 60 ? `<span class="ck-badge sev-${certDays <= 14 ? 'critical' : 'warn'}">${esc(certDays < 0 ? t('common.expiredDays', { n: Math.abs(certDays) }) : t('common.daysLeft', { n: certDays }))}</span>` : ''}</strong></div>
      </div>
      ${row.isLinkedCrm ? `
        <div class="ck-checklist">
          ${CHECKLIST_KEYS.map((item) => `
            <label class="chk-inline">
              <input type="checkbox" data-chk-key="${esc(item.key)}" ${checklist[item.key] ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
              <span>${esc(item.labelDe)}</span>
            </label>
          `).join('')}
        </div>
      ` : ''}
    </section>

    ${canSeeBilling ? `
      <section class="ck-drawer-sec">
        <h4>${esc(t('cust.drawer.billing'))}</h4>
        ${saas ? `
          <div class="ck-kv-grid" style="margin-bottom:10px">
            <div><span>SaaS Plan</span><strong>${esc(saas.plan || '—')} (${esc(saas.planStatus || '—')})</strong></div>
            <div><span>Trial Ends</span><strong>${saas.trialEndsAt ? esc(fmtDate(saas.trialEndsAt)) : '—'}</strong></div>
          </div>
        ` : ''}
        ${row.isLinkedCrm ? `
          <div class="row-2">
            <label class="fld">
              <span>${esc(t('cust.field.billingMode'))}</span>
              <select id="db_mode">
                ${BILLING_MODES.map((m) => `<option value="${m}" ${m === (bil?.billing_mode || 'pilot_frei') ? 'selected' : ''}>${esc(m)}</option>`).join('')}
              </select>
            </label>
            <label class="fld">
              <span>${esc(t('cust.field.paymentStatus'))}</span>
              <select id="db_status">
                ${PAYMENT_STATUSES.map((s) => `<option value="${s}" ${s === (bil?.payment_status || 'ok') ? 'selected' : ''}>${esc(s)}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="row-2" style="margin-top:8px">
            <label class="fld">
              <span>${esc(t('cust.field.planLabel'))}</span>
              <input id="db_plan" value="${esc(bil?.plan_label || '')}">
            </label>
            <label class="fld">
              <span>${esc(t('cust.field.monthlyEur'))}</span>
              <input type="number" step="0.01" id="db_monthly" value="${esc(bil?.contract_monthly_eur ?? '')}">
            </label>
          </div>
          <div class="row-2" style="margin-top:8px">
            <label class="fld">
              <span>${esc(t('cust.field.setupEur'))}</span>
              <input type="number" step="0.01" id="db_setup" value="${esc(bil?.setup_fee_eur ?? '')}">
            </label>
            <label class="fld">
              <span>${esc(t('cust.field.stripeId'))}</span>
              <input id="db_stripe" value="${esc(bil?.stripe_customer_id || '')}" placeholder="cus_...">
            </label>
          </div>
          <div style="margin-top:10px">
            <button class="btn btn-primary" id="dbSaveBtn">${esc(t('cust.drawer.saveBilling'))}</button>
          </div>
        ` : ''}
      </section>
    ` : ''}

    <section class="ck-drawer-sec">
      <h4>${esc(t('cust.drawer.ki', { month }))}</h4>
      ${ki ? `
        <div class="ck-kv-grid">
          <div><span>${esc(t('ki.col.calls'))}</span><strong>${esc(fmtInt(ki.calls))}</strong></div>
          ${canSeeKiCosts ? `<div><span>${esc(t('ki.col.costEur'))}</span><strong>${esc(fmtEur(ki.costEur, 4))}</strong></div>` : ''}
          <div><span>DE Text Tokens</span><strong>${esc(fmtInt(ki.byResource?.['de-text']?.totalTokens))}</strong></div>
          <div><span>Reasoning Tokens</span><strong>${esc(fmtInt(ki.reasoningTokens))}</strong></div>
          <div><span>SE Audio</span><strong>${esc(((Number(ki.audioSeconds) || 0) / 60).toFixed(1))} min</strong></div>
        </div>
        <div id="dKiDetail" style="margin-top:8px"></div>
      ` : `<p class="hint">${esc(t('cust.noKiData'))}</p>`}
    </section>

    ${row.isLinkedCrm ? `
      <section class="ck-drawer-sec">
        <h4>${esc(t('cust.drawer.notes'))}</h4>
        <label class="fld">
          <textarea id="dNotes">${esc(crm.notes || '')}</textarea>
        </label>
        <div style="display:flex;gap:8px;margin-top:8px;justify-content:space-between">
          <button class="btn btn-primary" id="dSaveNotesBtn">${esc(t('cust.drawer.saveNotes'))}</button>
          ${isFounder ? `<button class="btn btn-danger" id="dDeleteBtn">${esc(t('cust.drawer.deletePractice'))}</button>` : ''}
        </div>
      </section>
    ` : ''}
  `;

  if (canEdit) {
    $('#dEditBtn', body)?.addEventListener('click', () => openPracticeModal(row));
    $('#dLinkBtn', body)?.addEventListener('click', () => openPracticeModal(null, saas));

    body.querySelectorAll('[data-chk-key]').forEach((chk) => {
      chk.addEventListener('change', async () => {
        const nextList = { ...(crm.onboarding_checklist || {}), [chk.getAttribute('data-chk-key')]: chk.checked };
        const { error } = await sb.from('ops_customers').update({ onboarding_checklist: nextList }).eq('id', crm.id);
        if (error) return fail('Checkliste', error);
        crm.onboarding_checklist = nextList;
        toast(t('cust.saved'));
      });
    });
  }

  $('#dbSaveBtn', body)?.addEventListener('click', async () => {
    const monthlyRaw = $('#db_monthly', body).value.trim();
    const setupRaw = $('#db_setup', body).value.trim();
    const payload = {
      customer_id: crm.id,
      billing_mode: $('#db_mode', body).value,
      payment_status: $('#db_status', body).value,
      plan_label: $('#db_plan', body).value.trim() || null,
      contract_monthly_eur: monthlyRaw === '' ? null : Number(monthlyRaw),
      setup_fee_eur: setupRaw === '' ? null : Number(setupRaw),
      stripe_customer_id: $('#db_stripe', body).value.trim() || null,
    };
    const { error } = await sb.from('ops_customer_billing').upsert(payload, { onConflict: 'customer_id' });
    if (error) return fail('Vertragsdaten', error);
    billingMap.set(crm.id, payload);
    toast(t('cust.saved'));
    renderCustomers();
  });

  $('#dSaveNotesBtn', body)?.addEventListener('click', async () => {
    const notes = $('#dNotes', body).value;
    const { error } = await sb.from('ops_customers').update({ notes }).eq('id', crm.id);
    if (error) return fail('Notizen', error);
    crm.notes = notes;
    toast(t('cust.saved'));
  });

  $('#dDeleteBtn', body)?.addEventListener('click', () => {
    confirmDialog(t('cust.drawer.deletePractice'), t('cust.drawer.deleteConfirm'), async () => {
      const { error } = await sb.from('ops_customers').delete().eq('id', crm.id);
      if (error) { fail('Löschen', error); return false; }
      closeDrawer();
      await mountCustomers();
      return true;
    });
  });

  // Optional detaillierte Aufgaben-Aufschlüsselung für diesen Mandanten nachladen
  if (row.tenantId && (role === 'founder' || role === 'tech' || role === 'support')) {
    const det = await getKiUsage(month, row.tenantId);
    const detEl = $('#dKiDetail', body);
    if (detEl && det.ok && Array.isArray(det.data?.byTask) && det.data.byTask.length) {
      detEl.innerHTML = `<div class="ck-mini-box">${det.data.byTask.map((tk) => `
        <div class="ck-mini-row">
          <span><code>${esc(tk.task)}</code> (${esc(fmtInt(tk.calls))})</span>
          <strong>${canSeeKiCosts ? esc(fmtEur(tk.costEur, 4)) : esc(fmtInt(tk.totalTokens) + ' tok')}</strong>
        </div>
      `).join('')}</div>`;
    }
  }
}

function renderCustomers() {
  const root = $('#view-customers');
  if (!root) return;

  const role = myRole();
  const canEdit = canEditPractice(role);
  const canSeeBilling = role === 'founder' || role === 'sales';
  const canSeeKiCosts = role === 'founder' || role === 'tech';
  const allRows = buildMergedRows();

  const q = filterQuery.trim().toLowerCase();
  const filtered = allRows.filter((r) => {
    if (filterFach !== 'all' && r.fachbereich !== filterFach) return false;
    if (filterMode !== 'all' && r.deploymentMode !== filterMode) return false;
    if (filterStage !== 'all' && r.lifecycleStage !== filterStage) return false;
    if (q) {
      const hay = `${r.displayName} ${r.boxName || ''} ${r.tenantId || ''} ${r.crm?.contact_name || ''} ${r.crm?.contact_email || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const unlinked = unlinkedSaasCount();

  let banner = '';
  if (schemaMissing) {
    banner += `<div class="ck-banner ck-banner-warn">${esc(t('common.schemaPending'))}</div>`;
  }
  if (apiStatus && !apiStatus.ok) {
    const msg = apiStatus.reason === 'NOT_CONFIGURED'
      ? t('common.apiNotConfigured')
      : t('common.apiOffline', { reason: apiStatus.reason || 'offline' });
    banner += `<div class="ck-banner ck-banner-info">${esc(msg)}</div>`;
  }

  root.innerHTML = `
    <div class="ck-head">
      <div>
        <h2 class="ck-title">${esc(t('cust.title'))}</h2>
        <p class="ck-sub">${esc(t('cust.subtitle'))}</p>
      </div>
      <div class="ck-head-actions">
        ${canEdit && unlinked > 0 ? `<button class="btn" id="cSyncBtn">${esc(t('cust.syncBtn', { n: unlinked }))}</button>` : ''}
        ${canEdit ? `<button class="btn btn-primary" id="cNewBtn">${esc(t('cust.newBtn'))}</button>` : ''}
      </div>
    </div>

    ${banner}

    <div class="view-bar">
      <input class="search" id="cSearch" type="search" value="${esc(filterQuery)}" placeholder="${esc(t('cust.searchPh'))}">
      <select class="search f-filter-select" id="cFachFilter" style="max-width:190px">
        <option value="all">${esc(t('cust.filter.fachbereich'))}</option>
        ${FACHBEREICHE.map((f) => `<option value="${f}" ${filterFach === f ? 'selected' : ''}>${esc(t('cust.fach.' + f))}</option>`).join('')}
      </select>
      <select class="search f-filter-select" id="cModeFilter" style="max-width:170px">
        <option value="all">${esc(t('cust.filter.mode'))}</option>
        ${MODES.map((m) => `<option value="${m}" ${filterMode === m ? 'selected' : ''}>${esc(t('cust.mode.' + m))}</option>`).join('')}
      </select>
      <select class="search f-filter-select" id="cStageFilter" style="max-width:170px">
        <option value="all">${esc(t('cust.filter.stage'))}</option>
        ${STAGES.map((s) => `<option value="${s}" ${filterStage === s ? 'selected' : ''}>${esc(t('cust.stage.' + s))}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <span class="hint">${esc(filtered.length)} / ${esc(allRows.length)}</span>
    </div>

    <div class="ck-table-wrap">
      <table class="ck-table">
        <thead>
          <tr>
            <th>${esc(t('cust.col.practice'))}</th>
            <th>${esc(t('cust.col.fachbereich'))}</th>
            <th>${esc(t('cust.col.mode'))}</th>
            <th>${esc(t('cust.col.stage'))}</th>
            <th>${esc(t('cust.col.compliance'))}</th>
            ${canSeeBilling ? `<th>${esc(t('cust.col.billing'))}</th>` : ''}
            <th>${esc(t('cust.col.ki'))}</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0
            ? `<tr><td colspan="${canSeeBilling ? 7 : 6}"><p class="empty">${esc(t('cust.empty'))}</p></td></tr>`
            : filtered.map((r) => {
                const avvOk = Boolean(r.crm?.avv_signed || r.saas?.avvAcceptedAt);
                const certDays = daysUntil(r.crm?.itsg_cert_expires_at);
                const bilLabel = r.billing?.plan_label || r.saas?.plan || '—';
                const bilStatus = r.billing?.payment_status || r.saas?.planStatus || '';
                const ki = r.saas?.ki;
                return `
                  <tr class="ck-row ${selectedCustomerKey === r.key ? 'is-selected' : ''}" data-cust-key="${esc(r.key)}">
                    <td>
                      <div class="ck-cell-main">${esc(r.displayName)}</div>
                      <div class="ck-cell-sub">
                        ${r.boxName ? `<code>${esc(r.boxName)}</code>` : ''}
                        ${!r.isLinkedCrm ? `<span class="ck-badge sev-warn">${esc(t('cust.unlinkedBadge'))}</span>` : ''}
                      </div>
                    </td>
                    <td>${esc(t('cust.fach.' + r.fachbereich))}</td>
                    <td><span class="ck-badge">${esc(t('cust.mode.' + r.deploymentMode))}</span></td>
                    <td><span class="ck-badge stage-${esc(r.lifecycleStage)}">${esc(t('cust.stage.' + r.lifecycleStage))}</span></td>
                    <td>
                      <span class="ck-badge ${avvOk ? 'sev-ok' : 'sev-warn'}">${esc(avvOk ? t('cust.avvOk') : t('cust.avvMissing'))}</span>
                      ${certDays !== null && certDays <= 60 ? `<span class="ck-badge sev-${certDays <= 14 ? 'critical' : 'warn'}">ITSG ${esc(certDays)}d</span>` : ''}
                    </td>
                    ${canSeeBilling ? `
                      <td>
                        <div>${esc(bilLabel)}</div>
                        ${bilStatus ? `<div class="ck-cell-sub">${esc(bilStatus)}${r.billing?.contract_monthly_eur != null ? ` · ${esc(fmtEur(r.billing.contract_monthly_eur))}` : ''}</div>` : ''}
                      </td>
                    ` : ''}
                    <td>
                      ${ki ? `
                        <div>${esc(fmtInt(ki.calls))} · ${esc(fmtInt(ki.totalTokens))} tok</div>
                        ${canSeeKiCosts ? `<div class="ck-cell-sub">${esc(fmtEur(ki.costEur, 4))}</div>` : ''}
                      ` : '<span class="hint">—</span>'}
                    </td>
                  </tr>
                `;
              }).join('')}
        </tbody>
      </table>
    </div>

    <div class="ck-drawer-back" id="ckDrawerBack" hidden>
      <aside class="ck-drawer" role="dialog" aria-modal="true">
        <header class="ck-drawer-head">
          <h3 id="ckDrawerTitle"></h3>
          <button class="btn btn-icon" id="ckDrawerClose" aria-label="${esc(t('common.close'))}">×</button>
        </header>
        <div class="ck-drawer-body" id="ckDrawerBody"></div>
      </aside>
    </div>
  `;

  $('#cNewBtn', root)?.addEventListener('click', () => openPracticeModal(null));
  $('#cSyncBtn', root)?.addEventListener('click', syncUnlinkedSaas);
  $('#cSearch', root)?.addEventListener('input', (e) => { filterQuery = e.target.value; renderCustomers(); });
  $('#cFachFilter', root)?.addEventListener('change', (e) => { filterFach = e.target.value; renderCustomers(); });
  $('#cModeFilter', root)?.addEventListener('change', (e) => { filterMode = e.target.value; renderCustomers(); });
  $('#cStageFilter', root)?.addEventListener('change', (e) => { filterStage = e.target.value; renderCustomers(); });

  $('#ckDrawerClose', root)?.addEventListener('click', closeDrawer);
  $('#ckDrawerBack', root)?.addEventListener('click', (e) => {
    if (e.target.id === 'ckDrawerBack') closeDrawer();
  });

  root.querySelectorAll('tr[data-cust-key]').forEach((tr) => {
    tr.addEventListener('click', () => {
      const key = tr.getAttribute('data-cust-key');
      const found = allRows.find((r) => r.key === key);
      if (found) {
        selectedCustomerKey = key;
        renderDrawer(found);
      }
    });
  });

  if (selectedCustomerKey) {
    const found = allRows.find((r) => r.key === selectedCustomerKey);
    if (found) renderDrawer(found);
    else closeDrawer();
  }
}

export async function mountCustomers() {
  if (!unsubLang) {
    unsubLang = onLangChange(() => {
      const el = $('#view-customers');
      if (el && !el.hidden) renderCustomers();
    });
  }
  window.__praxuraOpenNewPractice = () => {
    if (canEditPractice()) openPracticeModal(null);
  };
  const root = $('#view-customers');
  if (root && crmRows.length === 0 && !apiStatus) {
    root.innerHTML = `<p class="empty">${esc(t('auth.loading'))}</p>`;
  }
  await loadCustomersData();
  renderCustomers();
}
