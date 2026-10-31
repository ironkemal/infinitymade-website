/** Browser-only synthetic Supabase module. Never imported by product code.
 * Playwright replaces /vendor/supabase-js.js at the network boundary.
 * No SDK, account, persistence, DB, auth refresh, or external transport.
 */
const OWNER = '11111111-1111-4111-8111-111111111111';
const PATIENT = '22222222-2222-4222-8222-222222222222';
const RX = '33333333-3333-4333-8333-333333333333';
const BOOKING = '44444444-4444-4444-8444-444444444444';
const BILL = '55555555-5555-4555-8555-555555555555';
const SERVICE = '66666666-6666-4666-8666-666666666666';
const day = window.__opsFixtureDay || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const log = window.__opsFixture = { reads: [], rejected: [], unknown: [], auth: [], realtime: [], day,
  ids: { OWNER, PATIENT, RX, BOOKING, BILL, SERVICE }, synthetic: true };
const clone = value => structuredClone(value);
const user = { id: OWNER, email: 'owner@example.invalid', user_metadata: { full_name: 'Synthetic Owner' } };
const session = { user, access_token: 'synthetic-probe-only', token_type: 'bearer', expires_at: 4102444800 };
const profile = { id: OWNER, owner_id: null, role: 'owner', sector: 'podologie', plan: 'professional',
  plan_status: 'active', is_active: true, business_name: 'Synthetische Testpraxis', company_code: 'TEST23',
  booking_slug: 'synthetic-browser-only', email: user.email, created_at: '2026-01-01T12:00:00Z',
  ik_nummer: '999999999', street: 'Testweg 1', postal_code: '00000', city: 'Testort',
  owner_first_name: 'Synthetic', owner_last_name: 'Owner', language: 'de' };
const patient = { id: PATIENT, owner_id: OWNER, user_id: OWNER, business_id: null,
  first_name: 'Synthetisch', last_name: 'Testpatient', title: 'Synthetisch Testpatient',
  phone: '+490000000000', email: 'patient@example.invalid', geburtsdatum: '1970-01-01',
  versichertennummer: 'X000000000', versichertenstatus: '1', insurance_type: 'gkv',
  krankenkasse: 'Synthetische Testkasse', krankenkasse_ik: '999999998', kostentraeger_ik: '999999998',
  patientennummer: 'SYN-0001', address: 'Testweg 2', street: 'Testweg 2', postal_code: '00000', city: 'Testort',
  created_at: '2026-01-01T12:00:00Z', is_active: true };
const service = { id: SERVICE, user_id: OWNER, owner_id: OWNER, business_id: null, title: 'Synthetische Podologie',
  code: '78010', gkv_position_nr: '78010', price: 36.10, duration_minutes: 30, is_active: true, color: '#387666', required_certificate: null };
const treatment = { id: '77777777-7777-4777-8777-777777777777', owner_id: OWNER, verordnung_id: RX,
  behandlungsdatum: day, hpnr_codes: ['78010'], betrag_gkv: 36.10, zuzahlung: 3.61,
  therapist_id: OWNER, status: 'done', storniert_am: null, booking_id: BOOKING };
const prescription = { id: RX, owner_id: OWNER, patient_id: PATIENT, patient_name: patient.title,
  therapie_bereich: 'podo', status: 'confirmed', abrechnung_status: 'gesendet', rezeptart: 'kassen',
  ausstellungsdatum: day, gueltig_bis: '2026-11-20', behandlungsbeginn: day,
  heilmittel: 'Hornhautabtragung', heilmittel_position: '78010', heilmittel_items: [],
  anzahl_einheiten: 1, frequenz: '1x alle 4 Wochen', diagnosegruppe: 'DF', icd10: 'E11.74', icd10_2: null,
  leitsymptomatik: 'a', pat_leitsymptomatik: null, hausbesuch: false, is_dringend: false,
  unterschrift_vorhanden: true, zuzahlung_befreit: false, zuzahlung_kassiert_am: null, versichertennummer: patient.versichertennummer,
  krankenkasse_ik: patient.krankenkasse_ik, kostentraeger_ik: patient.kostentraeger_ik,
  doctor_lanr: '999999900', doctor_bsnr: '999999900', arzt_id: null, belegnummer: 'SYN-0001',
  leads: patient, aerzte: null, podologie_behandlungen: [treatment], prescription_sessions: [] };
const booking = { id: BOOKING, owner_id: OWNER, user_id: OWNER, business_id: null, lead_id: PATIENT,
  service_id: SERVICE, services: service, leads: patient, customer_name: patient.title,
  customer_phone: patient.phone, start_time: new Date(day + 'T09:00:00+02:00').toISOString(),
  end_time: new Date(day + 'T09:30:00+02:00').toISOString(),
  status: 'completed', verordnung_id: RX, prescription_sessions: [], hausbesuch: false,
  created_at: day + 'T06:00:00Z', notes: 'Synthetischer Testtermin — keine klinische Freigabe' };
const bill = { id: BILL, owner_id: OWNER, kostentraeger_ik: patient.kostentraeger_ik,
  dateiname: 'TSOL_SYNTHETIC_ONLY', rechnungsnummer: 'SYN-302-0001', total_eur: 36.10,
  zuzahlung_total: 13.61, prescription_count: 1, rejected_count: 0, status: 'erstellt',
  created_at: day + 'T10:00:00Z', betriebsart: 'test', storage_path: null };
const tables = {
  profiles: [profile], businesses: [], data_sharing_settings: [], module_visibility: [], user_preferences: [],
  leads: [patient], prescriptions: [prescription], podologie_behandlungen: [treatment], bookings: [booking],
  // Existing catalog codes prevent the product's documented first-load auto-seed.
  // Other rows have no price: only 78010 participates in this money test.
  services: [service, ...(window.__opsCatalogCodes || []).filter(code => code !== '78010').map(code => ({
    ...service, id: 'synthetic-service-' + code, code, gkv_position_nr: code, price: null, title: 'Synthetischer Katalogplatzhalter ' + code }))],
  working_hours: Array.from({ length: 7 }, (_, day_of_week) => ({
    user_id: OWNER, owner_id: OWNER, day_of_week, start_time: '08:00:00', end_time: '18:00:00', is_active: true })),
  patient_notes: [], invoices: [], fahrten: [], aerzte: [], admin_users: [],
  pat_fussbefund: [], anamnese: [], zuzahlung_befreiung: [],
  krankenkassen: [{ id: 'synthetic-insurer', name: patient.krankenkasse, ik: patient.kostentraeger_ik }],
  terapeut_zertifikat: [{ id: OWNER, owner_id: OWNER, ik_nummer: '999999999', valid_until: '2099-12-31' }],
  therapist_certificates: [{ profile_id: OWNER, owner_id: OWNER, certificate: 'podologie', expires_at: '2099-12-31' }],
  kostentraeger: [{ ik: patient.kostentraeger_ik, name: patient.krankenkasse, das_ik: '999999997', active: true }],
  kostentraeger_auswahl: [{ ik: patient.kostentraeger_ik, name: patient.krankenkasse,
    abrechnender_kt_ik: patient.kostentraeger_ik, kurzname: 'Testkasse', das_ik: '999999997', active: true }],
  abrechnung: [bill], abrechnung_zeile: [{ id: 'synthetic-line', owner_id: OWNER, abrechnung_id: BILL,
    prescription_id: RX, netto_eur: 22.49, brutto_eur: 36.10, zuzahlung_eur: 13.61, absetzung_eur: 0, status: 'offen' }],
  abrechnung_zahlung: [], prescription_sessions: [],
  diagnosegruppen: [{ code: 'DF', label: 'Synthetische Diagnosegruppe', bereich: 'podologie', aktiv: true,
    sort: 1, untergruppen: ['a', 'b', 'c'], icd_accept: ['E11'], icd_exclude: [],
    icd_auto_select: [], icd_accept_unsicher: [], icd_enforcement: 'warn' }],
};
// FAQ25 read-only empty-state contracts, verified against current callers.
// Exact steps prevent arbitrary new reads from silently succeeding with [].
const faqReadContracts = {
  // module/abwesenheit.js:34: calendar absence lookup for the fixed synthetic day.
  time_offs: [['select', 'employee_id,start_date,end_date,reason,note,type', {}],
    ['in', 'employee_id', [OWNER]], ['lte', 'start_date', new Date(day + 'T23:59:59+02:00').toISOString()],
    ['gte', 'end_date', new Date(day + 'T00:00:00+02:00').toISOString()]],
  // dashboard.js:7889, 7305, 7640, 7851; no documents, receipts, measurements or mails.
  ueberweisungen: [['select', '*', {}], ['eq', 'lead_id', PATIENT], ['order', 'created_at', { ascending: false }]],
  belegliste: [['select', 'beleg_nr, prescription_id, zahlart, amount_eur, created_at', {}],
    ['eq', 'patient_id', PATIENT], ['eq', 'type', 'zuzahlung'], ['order', 'beleg_nr', { ascending: false }]],
  messreihen: [['select', 'id, typ, koerperteil, wert, einheit, gemessen_am, notiz', {}],
    ['eq', 'lead_id', PATIENT], ['order', 'gemessen_am', { ascending: true }]],
  email_logs: [['select', '*', {}], ['eq', 'owner_id', OWNER],
    ['or', `contact_id.eq.${PATIENT},and(contact_id.is.null,to_email.ilike.${patient.email})`],
    ['order', 'created_at', { ascending: false }]],
  // module/patienten-einwilligung.js:512 — list only, no signed URL/storage access.
  patient_consents: [['select', 'id, consent_type, text_version, text_sha256, consented_at, signature_path, signed_name, revoked_at, revoke_reason', {}],
    ['eq', 'patient_id', PATIENT], ['order', 'consented_at', { ascending: false }]],
  // dashboard.js:12985 — SaaS support list; Box removes the list before navigation.
  feedbacks: [['select', '*', {}], ['eq', 'user_id', OWNER], ['order', 'created_at', { ascending: false }]],
};
for (const table of Object.keys(faqReadContracts)) tables[table] = [];
log.dataset = { profile: clone(profile), patient: clone(patient), prescription: clone(prescription),
  treatment: clone(treatment), booking: clone(booking), bill: clone(bill) };

function reject(kind, name) {
  log.rejected.push({ kind, name });
  throw new Error(`SYNTHETIC_BOUNDARY_REJECTED ${kind}:${name}`);
}
function unknown(kind, name) {
  log.unknown.push({ kind, name });
  return { data: null, error: { message: `FIXTURE_REQUIRED ${kind}:${name}`, code: 'FIXTURE_REQUIRED' } };
}
const valueAt = (row, key) => key.split('.').reduce((obj, part) => obj?.[part], row);
function compare(row, key, op, value) {
  const got = valueAt(row, key);
  if (op === 'is') return value === null ? got == null : got === value;
  if (op === 'eq') return got != null && got === value;
  if (op === 'neq') return got != null && got !== value;
  if (op === 'in') {
    const values = Array.isArray(value) ? value : splitTop(String(value).slice(1, -1)).map(v => {
      const raw = v.replace(/^"|"$/g, ''); return typeof got === 'number' ? Number(raw) : raw;
    });
    return got != null && values.includes(got);
  }
  if (op === 'gte') return got != null && got >= value;
  if (op === 'lte') return got != null && got <= value;
  if (op === 'gt') return got != null && got > value;
  if (op === 'lt') return got != null && got < value;
  if (op === 'ilike' || op === 'like') {
    const expression = String(value).split('%').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + expression + '$', op === 'ilike' ? 'i' : '').test(String(got ?? ''));
  }
  throw new Error('FIXTURE_REQUIRED operator:' + op);
}
function splitTop(text) {
  let depth = 0, start = 0; const result = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (text[i] === ',' && !depth) { result.push(text.slice(start, i)); start = i + 1; }
  }
  result.push(text.slice(start)); return result.filter(Boolean);
}
function expression(row, text) {
  if (/^(and|or)\(/.test(text)) {
    const all = text.startsWith('and('), parts = splitTop(text.slice(all ? 4 : 3, -1));
    return all ? parts.every(p => expression(row, p)) : parts.some(p => expression(row, p));
  }
  const match = text.match(/^([\w.]+?)\.(not\.)?(eq|neq|is|in|gte|lte|gt|lt|ilike|like)\.(.*)$/);
  if (!match) throw new Error('FIXTURE_REQUIRED filter:' + text);
  const [, key, neg, op, raw] = match;
  const scalar = text => {
    const v = text.replace(/^"|"$/g, '');
    return v === 'null' ? null : v === 'true' ? true : v === 'false' ? false
      : typeof valueAt(row, key) === 'number' && Number.isFinite(Number(v)) ? Number(v) : v;
  };
  const value = op === 'in' ? splitTop(raw.slice(1, -1)).map(scalar) : scalar(raw);
  const ok = compare(row, key, op, value); return neg ? !ok : ok;
}
function project(row, selection) {
  if (!selection || selection === '*') return clone(row);
  const result = {};
  for (const part of splitTop(selection.replace(/\s+/g, ''))) {
    if (part === '*') { Object.assign(result, clone(row)); continue; }
    if (part.includes('(')) {
      // Joined rows are explicit synthetic relations, never fetched elsewhere.
      const head = part.slice(0, part.indexOf('(')), inner = part.slice(part.indexOf('(') + 1, -1);
      const alias = head.split(':')[0].split('!')[0];
      const relation = head.includes(':') ? head.split(':')[1].split('!')[0] : alias;
      const source = row[alias] ?? row[relation] ?? null;
      result[alias] = Array.isArray(source) ? source.map(item => project(item, inner)) : source ? project(source, inner) : null;
    } else {
      const [alias, source = alias] = part.split(':'); result[alias] = clone(row[source] ?? null);
    }
  }
  return result;
}
class Query {
  constructor(table) { this.table = table; this.filters = []; this.orders = []; this.steps = []; this.selection = '*'; }
  select(columns = '*', opts = {}) { this.selection = columns; this.opts = opts; this.steps.push(['select', columns, opts]); return this; }
  test(op, key, value, negate = false) {
    this.steps.push([negate ? 'not' : op, key, value]);
    this.filters.push(row => negate ? (op !== 'is' && valueAt(row, key) == null ? false : !compare(row, key, op, value))
      : compare(row, key, op, value)); return this;
  }
  eq(k, v) { return this.test('eq', k, v); } neq(k, v) { return this.test('neq', k, v); }
  is(k, v) { return this.test('is', k, v); } in(k, v) { return this.test('in', k, v); }
  gte(k, v) { return this.test('gte', k, v); } lte(k, v) { return this.test('lte', k, v); }
  gt(k, v) { return this.test('gt', k, v); } lt(k, v) { return this.test('lt', k, v); }
  ilike(k, v) { return this.test('ilike', k, v); } like(k, v) { return this.test('like', k, v); }
  not(k, op, v) { return this.test(op, k, v, true); }
  or(text) { this.steps.push(['or', text]); this.filters.push(row => splitTop(text).some(p => expression(row, p))); return this; }
  order(k, opts = {}) { this.orders.push([k, opts]); this.steps.push(['order', k, opts]); return this; }
  limit(n) { this.max = n; this.steps.push(['limit', n]); return this; }
  range(a, b) { this.offset = a; this.max = b - a + 1; this.steps.push(['range', a, b]); return this; }
  single() { this.mode = 'single'; return this; } maybeSingle() { this.mode = 'maybeSingle'; return this; }
  insert() { return reject('db', this.table + '.insert'); } upsert() { return reject('db', this.table + '.upsert'); }
  update() { return reject('db', this.table + '.update'); } delete() { return reject('db', this.table + '.delete'); }
  then(resolve, fail) { return Promise.resolve().then(() => this.run()).then(resolve, fail); }
  run() {
    const entry = { table: this.table, steps: clone(this.steps), mode: this.mode || 'array' }; log.reads.push(entry);
    if (!Object.hasOwn(tables, this.table)) return unknown('table', this.table);
    if (Object.hasOwn(faqReadContracts, this.table) && (entry.mode !== 'array'
        || JSON.stringify(this.steps) !== JSON.stringify(faqReadContracts[this.table]))) {
      return unknown('query-contract', this.table);
    }
    try {
      let rows = clone(tables[this.table]).filter(row => this.filters.every(fn => fn(row)));
      const count = rows.length;
      rows.sort((a, b) => { for (const [key, opts] of this.orders) {
        const av = valueAt(a, key), bv = valueAt(b, key);
        if (av === bv) continue;
        if (av == null || bv == null) return (av == null ? -1 : 1) * ((opts.nullsFirst ?? opts.ascending === false) ? 1 : -1);
        return (av < bv ? -1 : 1) * (opts.ascending === false ? -1 : 1);
      } return 0; });
      rows = rows.slice(this.offset || 0, this.max == null ? undefined : (this.offset || 0) + this.max);
      rows = rows.map(row => project(row, this.selection)); entry.count = rows.length;
      if (this.mode && (rows.length > 1 || this.mode === 'single' && rows.length !== 1)) {
        return { data: null, error: { code: 'PGRST116', message: 'Synthetic single cardinality mismatch' }, count };
      }
      return { data: this.opts?.head ? null : this.mode ? rows[0] || null : rows,
        error: null, ...(this.opts?.count ? { count } : {}) };
    } catch (error) { return unknown('query', this.table + ':' + error.message); }
  }
}
const channel = () => { const inert = { on: () => inert, subscribe: () => inert,
  unsubscribe: async () => 'ok' }; return inert; };
export function createClient(url, key) {
  if (url !== 'https://synthetic.invalid' || key !== 'synthetic-anon-dummy') reject('client', 'non-synthetic-config');
  const auth = new Proxy({
    getSession: async () => { log.auth.push('getSession'); return { data: { session: clone(session) }, error: null }; },
    getUser: async () => { log.auth.push('getUser'); return { data: { user: clone(user) }, error: null }; },
    onAuthStateChange: () => { log.auth.push('onAuthStateChange'); return { data: { subscription: { unsubscribe() {} } } }; },
  }, { get: (obj, name) => Object.hasOwn(obj, name) ? obj[name] : () => reject('auth', String(name)) });
  return { auth, from: table => new Query(table),
    rpc: async (name, args) => {
      log.reads.push({ rpc: name, args });
      // Only these read-only lookup contracts are allowed. Unknown RPCs fail closed.
      if (name === 'search_diagnosen') return { data: [{ code: 'E11.74', title: 'Synthetischer Diagnoseeintrag' }], error: null };
      if (name === 'search_heilmittel') return { data: [{ id: SERVICE, positionsnummer: '78010', name: service.title, bereich: 'podologie' }], error: null };
      return reject('rpc', name);
    },
    channel: name => { log.realtime.push(name); return channel(); }, removeChannel: async () => 'ok',
    removeAllChannels: async () => [], getChannels: () => [],
    storage: new Proxy({ from: name => new Proxy({}, {
      get: (_, operation) => () => reject('storage', name + '.' + String(operation)),
    }) }, { get: (obj, name) => Object.hasOwn(obj, name) ? obj[name] : () => reject('storage', String(name)) }),
    functions: { invoke: name => reject('functions', name) },
  };
}
