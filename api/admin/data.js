import { getAuthedUser, adminFetch, adminRpc, isAdmin, json } from '../_lib/auth.js';
import { aiCallCostEUR, planMonthlyEUR, PRICING_META } from '../_lib/pricing.js';

function startOfMonthISO() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}
function inDaysISO(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
}

// PostgREST counts via Prefer: count=exact + select=id&limit=1.
// Returns the row count from the Content-Range header without fetching rows.
async function countRows(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${path}${sep}select=id&limit=1`;
  const res = await adminFetch(url, { headers: { Prefer: 'count=exact' } });
  // adminFetch swallows headers — fall back to fetching data and counting client-side.
  // Cheap enough for current scale; revisit if any single tenant's monthly volume passes ~5k rows.
  if (Array.isArray(res.data)) {
    // limit=1 means we don't actually have all rows; do a real fetch for correctness.
    const full = await adminFetch(`${path}${sep}select=id`);
    return Array.isArray(full.data) ? full.data.length : 0;
  }
  return 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const { user, error: authErr } = await getAuthedUser(req);
  if (authErr || !user) return json(res, 401, { error: 'Unauthorized' });
  if (!(await isAdmin(user.id))) return json(res, 403, { error: 'Forbidden' });

  const type = req.query?.type || 'stats';
  const monthStart = startOfMonthISO();

  if (type === 'stats') {
    // Owners with subscription state — used for MRR + status counts
    const owners = await adminFetch('/profiles?select=id,plan,plan_status,trial_ends_at,billing_interval&role=eq.owner');
    const rows = owners.data || [];

    let mrr = 0, trial = 0, trialEndingThisWeek = 0, active = 0, pastDue = 0, canceled = 0;
    const weekFromNow = inDaysISO(7);
    for (const r of rows) {
      const s = r.plan_status;
      if (s === 'active')   { active++;  mrr += planMonthlyEUR(r.plan); }
      if (s === 'trial')    { trial++;   if (r.trial_ends_at && r.trial_ends_at <= weekFromNow) trialEndingThisWeek++; }
      if (s === 'past_due') { pastDue++; }
      if (s === 'canceled') { canceled++; }
    }

    // Month-to-date usage volumes + AI cost
    const ai = await adminFetch(`/ai_audit_log?select=tenant_id,model,prompt_tokens,completion_tokens&created_at=gte.${monthStart}`);
    const aiRows = ai.data || [];
    let aiCost = 0;
    for (const a of aiRows) aiCost += aiCallCostEUR(a.model, a.prompt_tokens, a.completion_tokens);

    const emails = await adminFetch(`/email_logs?select=id&created_at=gte.${monthStart}`);
    // messages table DROPPED 2026-05-22 (WhatsApp shelved)
    const msgs   = { data: [] };
    const newBookings = await adminFetch(`/bookings?select=id&created_at=gte.${monthStart}`);

    // Chatbot widget usage — logged by n8n directly (not via calendar-api router).
    // owner_id is usually null until embedded widgets start passing it.
    const cb = await adminFetch(`/chatbot_usage?select=cost_eur,total_tokens&created_at=gte.${monthStart}`);
    const cbRows = cb.data || [];
    let cbCost = 0, cbTokens = 0;
    for (const c of cbRows) { cbCost += Number(c.cost_eur || 0); cbTokens += Number(c.total_tokens || 0); }

    return json(res, 200, {
      mrr_eur: Number(mrr.toFixed(2)),
      total_owners: rows.length,
      active, trial, past_due: pastDue, canceled,
      trial_ending_this_week: trialEndingThisWeek,
      starter_count:      rows.filter(r => r.plan === 'starter').length,
      professional_count: rows.filter(r => r.plan === 'professional').length,
      klinik_count:       rows.filter(r => r.plan === 'klinik').length,
      enterprise_count:   rows.filter(r => r.plan === 'enterprise').length,
      ai_calls_mtd:       aiRows.length,
      ai_cost_eur_mtd:    Number(aiCost.toFixed(4)),
      chatbot_calls_mtd:  cbRows.length,
      chatbot_tokens_mtd: cbTokens,
      chatbot_cost_eur_mtd: Number(cbCost.toFixed(4)),
      emails_mtd:         (emails.data || []).length,
      whatsapp_mtd:       (msgs.data || []).length,
      new_bookings_mtd:   (newBookings.data || []).length,
    });
  }

  if (type === 'customers') {
    // Pull everything once, then bucket in JS — avoids N+1 queries against tenants.
    const owners = await adminFetch('/profiles?select=id,business_name,email,sector,city,plan,plan_status,trial_ends_at,billing_interval,created_at,whatsapp_phone_number_id,b2b_setup_done,stripe_subscription_id&role=eq.owner&order=created_at.desc');
    const ownerRows = owners.data || [];
    const ownerIds = ownerRows.map(o => o.id);
    if (ownerIds.length === 0) return json(res, 200, { items: [] });

    const ai      = await adminFetch(`/ai_audit_log?select=tenant_id,model,prompt_tokens,completion_tokens&created_at=gte.${monthStart}`);
    const emails  = await adminFetch(`/email_logs?select=owner_id&created_at=gte.${monthStart}`);
    // messages table DROPPED 2026-05-22 (WhatsApp shelved). Stub kept for backward compat.
    const msgs    = { data: [] };
    const bk      = await adminFetch(`/bookings?select=owner_id&created_at=gte.${monthStart}`);
    const cal     = await adminFetch('/calendar_integrations?select=user_id');

    const aiByOwner = new Map();
    for (const a of ai.data || []) {
      const cur = aiByOwner.get(a.tenant_id) || { calls: 0, tokens: 0, cost: 0 };
      cur.calls += 1;
      cur.tokens += (a.prompt_tokens || 0) + (a.completion_tokens || 0);
      cur.cost += aiCallCostEUR(a.model, a.prompt_tokens, a.completion_tokens);
      aiByOwner.set(a.tenant_id, cur);
    }
    const tally = (arr, key) => {
      const m = new Map();
      for (const r of arr || []) m.set(r[key], (m.get(r[key]) || 0) + 1);
      return m;
    };
    const emailsByOwner = tally(emails.data, 'owner_id');
    const msgsByOwner   = tally(msgs.data,   'business_id');
    const bkByOwner     = tally(bk.data,     'owner_id');
    const calConnected  = new Set((cal.data || []).map(c => c.user_id));

    const items = ownerRows.map(o => {
      const a = aiByOwner.get(o.id) || { calls: 0, tokens: 0, cost: 0 };
      return {
        id: o.id,
        business_name: o.business_name,
        email: o.email,
        sector: o.sector,
        city: o.city,
        plan: o.plan,
        plan_status: o.plan_status,
        trial_ends_at: o.trial_ends_at,
        billing_interval: o.billing_interval,
        created_at: o.created_at,
        integrations: {
          gmail:    !!o.b2b_setup_done,
          gcal:     calConnected.has(o.id),
          stripe:   !!o.stripe_subscription_id,
        },
        usage_mtd: {
          ai_calls:  a.calls,
          ai_tokens: a.tokens,
          ai_cost_eur: Number(a.cost.toFixed(4)),
          emails:    emailsByOwner.get(o.id) || 0,
          bookings:  bkByOwner.get(o.id) || 0,
        },
      };
    });
    return json(res, 200, { items });
  }

  if (type === 'ai_breakdown') {
    const ownerId = req.query?.owner_id;
    if (!ownerId) return json(res, 400, { error: 'owner_id required' });
    const ai = await adminFetch(`/ai_audit_log?select=task,model,prompt_tokens,completion_tokens,latency_ms,status,error,created_at&tenant_id=eq.${ownerId}&created_at=gte.${monthStart}&order=created_at.desc`);
    const rows = ai.data || [];

    const byModel = {};
    const byTask = {};
    let totalCost = 0;
    const errors = [];
    for (const r of rows) {
      const cost = aiCallCostEUR(r.model, r.prompt_tokens, r.completion_tokens);
      totalCost += cost;
      const m = byModel[r.model] = byModel[r.model] || { calls: 0, prompt_tokens: 0, completion_tokens: 0, cost_eur: 0 };
      m.calls += 1; m.prompt_tokens += (r.prompt_tokens || 0); m.completion_tokens += (r.completion_tokens || 0); m.cost_eur += cost;
      const t = byTask[r.task] = byTask[r.task] || { calls: 0, cost_eur: 0 };
      t.calls += 1; t.cost_eur += cost;
      if (r.status && r.status !== 'ok' && errors.length < 10) {
        errors.push({ created_at: r.created_at, task: r.task, model: r.model, status: r.status, error: r.error });
      }
    }
    const round = (n, d=4) => Number(Number(n).toFixed(d));
    for (const k of Object.keys(byModel)) byModel[k].cost_eur = round(byModel[k].cost_eur);
    for (const k of Object.keys(byTask))  byTask[k].cost_eur  = round(byTask[k].cost_eur);

    return json(res, 200, {
      total_calls: rows.length,
      total_cost_eur: round(totalCost),
      by_model: byModel,
      by_task: byTask,
      recent_errors: errors,
    });
  }

  if (type === 'db_health') {
    const [total, breakdown, topTenants] = await Promise.all([
      adminRpc('admin_db_total_size', {}),
      adminRpc('admin_db_size_breakdown', {}),
      adminRpc('admin_top_tenants_by_rows', {}),
    ]);
    return json(res, 200, {
      total_bytes: total.data ?? 0,
      tables: Array.isArray(breakdown.data) ? breakdown.data.slice(0, 15) : [],
      top_tenants: Array.isArray(topTenants.data) ? topTenants.data : [],
      pricing: PRICING_META,
    });
  }

  if (type === 'bookings') {
    const { data, status } = await adminFetch('/bookings?select=*,profiles!bookings_owner_id_fkey(business_name,email)&order=start_time.desc&limit=100');
    if (!data) return json(res, status || 500, { error: 'DB error' });
    return json(res, 200, { items: data });
  }

  return json(res, 400, { error: 'Unknown type' });
}
