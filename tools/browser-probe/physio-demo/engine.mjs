// Local synthetic demo only. Executes original handlers; never imports server.js.
// Auth and exclusion below are DEMO fences, not production-auth/DB evidence.
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import vm from 'node:vm';
import * as fields from '../../../api-backend/lib/rezept-felder.js';
import { validiereBarcodeErfassung, computedMitErfassung } from '../../../api-backend/lib/rezept-erfassung.js';
import { statusAusAbrechnungStatus } from '../../../api-backend/billing/utils/einreichbar.js';
import { normalisiereGeschlecht } from '../../../api-backend/lib/geschlecht.js';
import { resolveOrCreateArzt } from '../../../api-backend/lib/arzt-registry.js';
import { findeLeadNachNameGeburt } from '../../../api-backend/booking/lead-aus-anfrage.js';
import { validateRezept } from '../../../api-backend/ai/validators/validate.js';
import { validateTherapist } from '../../../api-backend/booking/public-guards.js';
import { validateAuthenticatedService } from '../../../api-backend/booking/auth-guards.js';
import { serienDaten, isValidCalendarDate, isStrictInteger } from '../../../api-backend/booking/series.js';

const source = readFileSync(new URL('../../../api-backend/server.js', import.meta.url), 'utf8');
export const QUELLEN_SHA256 = createHash('sha256').update(source).digest('hex');
const writable = new Set(['leads', 'aerzte', 'prescriptions', 'prescription_validations', 'bookings']);
const readable = new Set([...writable, 'profiles', 'services', 'kostentraeger', 'invoices']);
const copy = value => JSON.parse(JSON.stringify(value));
const failure = message => Object.assign(new Error(message), { code: 'DEMO_UNSUPPORTED' });

function originalBlock(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || source.indexOf(start, a + 1) >= 0) throw failure('Original handler boundary changed');
  return source.slice(a, b);
}

function literalPattern(pattern) {
  let regex = '^';
  const chars = String(pattern);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '\\') {
      if (++i >= chars.length) throw failure('Incomplete ilike escape');
      regex += chars[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (c === '%') regex += '.*';
    else if (c === '_') regex += '.';
    else regex += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(regex + '$', 'iu');
}

// Implements only operations used by these handlers and actual imported helpers.
// Unsupported operations throw, even when a helper would otherwise swallow DB errors.
function memoryClient(tables, ownerId) {
  return { from(table) {
    if (!readable.has(table) || !Array.isArray(tables[table])) throw failure(`Missing/unsupported demo table: ${table}`);
    let operation = 'select', value, columns = '*', mode = 'many', maximum = Infinity;
    const filters = [];
    function owned(row) {
      if (table === 'prescription_validations') return tables.prescriptions?.some(p => p.id === row.prescription_id && p.owner_id === ownerId);
      return row.owner_id === ownerId;
    }
    function execute() {
      let rows = tables[table].filter(row => filters.every(fn => fn(row)));
      if (operation !== 'select') {
        if (!writable.has(table)) throw failure('Read-only demo table');
        if (operation === 'update' && !filters.length) throw failure('Unfiltered update rejected');
        if (operation === 'insert') {
          const additions = (Array.isArray(value) ? value : [value]).map(row => ({ ...row, id: row.id || randomUUID(), created_at: row.created_at || new Date().toISOString() }));
          if (additions.some(row => !owned(row))) return { data: null, error: { code: '42501', message: 'Foreign owner write rejected' } };
          if (table === 'bookings') {
            const before = [...tables.bookings];
            for (const row of additions) {
              if (!Number.isFinite(Date.parse(row.start_time)) || !Number.isFinite(Date.parse(row.end_time)) || Date.parse(row.end_time) <= Date.parse(row.start_time)) return { data: null, error: { code: '22007', message: 'Invalid interval' } };
              if (row.status === 'confirmed' && before.some(old => old.status === 'confirmed' && old.user_id === row.user_id && Date.parse(old.start_time) < Date.parse(row.end_time) && Date.parse(old.end_time) > Date.parse(row.start_time))) return { data: null, error: { code: '23P01', message: 'Synthetic demo overlap' } };
              before.push(row);
            }
          }
          if (additions.some(row => tables[table].some(old => old.id === row.id))) return { data: null, error: { code: '23505', message: 'Duplicate ID' } };
          tables[table].push(...additions); rows = additions;
        } else {
          if (rows.some(row => !owned(row) || (value.owner_id !== undefined && value.owner_id !== ownerId))) return { data: null, error: { code: '42501', message: 'Foreign owner update rejected' } };
          rows.forEach(row => Object.assign(row, copy(value)));
        }
      }
      rows = rows.slice(0, maximum).map(row => {
        if (columns === '*') return copy(row);
        const result = {};
        for (const key of columns.split(',').map(s => s.trim())) result[key] = row[key] ?? null;
        return result;
      });
      if (mode !== 'many') {
        if (rows.length > 1 || (mode === 'single' && rows.length !== 1)) return { data: null, error: { code: 'PGRST116', message: 'Expected single demo row' } };
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    }
    const chain = {
      select(selected = '*') {
        if (selected !== '*' && !/^[a-z_][a-z_0-9]*(?:\s*,\s*[a-z_][a-z_0-9]*)*$/.test(selected)) throw failure('Unsupported projection/join');
        columns = selected; return chain;
      },
      eq(key, val) { filters.push(row => row[key] === val); return chain; },
      is(key, val) { if (val !== null) throw failure('Unsupported is filter'); filters.push(row => row[key] == null); return chain; },
      in(key, vals) { if (!Array.isArray(vals)) throw failure('Invalid in filter'); filters.push(row => vals.includes(row[key])); return chain; },
      ilike(key, pattern) { const regex = literalPattern(pattern); filters.push(row => typeof row[key] === 'string' && regex.test(row[key])); return chain; },
      or(expression) {
        // Only flat, explicit PostgREST comparisons used by payer/date/invoice helpers.
        const clauses = String(expression).split(',').map(part => {
          const match = /^([a-z_][a-z_0-9]*)\.(eq|is|gte|lte)\.(.+)$/.exec(part);
          if (!match || (match[2] === 'is' && match[3] !== 'null')) throw failure('Unsupported or filter');
          const [, key, op, val] = match;
          return row => op === 'is' ? row[key] == null : op === 'eq' ? row[key] === val : row[key] != null && (op === 'gte' ? row[key] >= val : row[key] <= val);
        });
        filters.push(row => clauses.some(fn => fn(row))); return chain;
      },
      limit(n) { if (!Number.isSafeInteger(n) || n < 0 || n > 10000) throw failure('Invalid limit'); maximum = n; return chain; },
      insert(payload) { operation = 'insert'; value = copy(payload); return chain; },
      update(payload) { operation = 'update'; value = copy(payload); return chain; },
      single() { mode = 'single'; return chain; },
      maybeSingle() { mode = 'maybe'; return chain; },
      then(resolve, reject) { return Promise.resolve().then(execute).then(resolve, reject); },
    };
    return chain;
  } };
}

function registerHandlers(supabase) {
  const handlers = {};
  const context = vm.createContext({
    ...fields, validiereBarcodeErfassung, computedMitErfassung,
    statusAusAbrechnungStatus, normalisiereGeschlecht, resolveOrCreateArzt,
    findeLeadNachNameGeburt, validateRezept, validateTherapist,
    validateAuthenticatedService, serienDaten, isValidCalendarDate, isStrictInteger,
    supabase, BUSINESS_TZ: 'Europe/Berlin',
    console: { error() {}, log() {} },
    requireAuthAI() {},
    app: {
      post(path, _middleware, handler) { handlers[`POST ${path}`] = handler; },
      patch(path, _middleware, handler) { handlers[`PATCH ${path}`] = handler; },
    },
  }, { codeGeneration: { strings: false, wasm: false } });
  const blocks = [
    originalBlock('function berlinOffsetMin(', '\n// Convert a UTC Date'),
    originalBlock('function berlinLocalToUTC(', '\nfunction addDays('),
    originalBlock('async function pruefeLeadId(', '\n// ---- Feedback-NLU'),
    originalBlock("app.post('/api/rezept/confirm',", '\n// Ändern: die Muster-13-Maske'),
    originalBlock("app.patch('/api/rezept/:id',", "\napp.post('/api/rezept/save',"),
    originalBlock("app.post('/api/arzt/resolve',", '\n// ===== Phase 4:'),
  ];
  blocks.forEach(block => vm.runInContext(block, context, { timeout: 1000 }));
  if (Object.keys(handlers).length !== 4) throw failure('Unexpected handler registration');
  return handlers;
}

/** Original API body, synthetic table map in/out. No network, server boot or auth claims. */
export async function fuehreDemoAktionAus({ pfad, methode, body, tabellen, rolle = 'owner' } = {}) {
  const original = tabellen;
  const result = (status, response, tables = original) => ({ status, body: response, tabellen: tables });
  if (rolle !== 'owner') return result(403, { error: 'Demo: nur Inhaber-Schreibwege freigegeben' });
  const method = String(methode ?? '').toUpperCase();
  const match = /^\/api\/rezept\/([a-zA-Z0-9-]+)$/.exec(String(pfad));
  const route = method === 'PATCH' && match ? '/api/rezept/:id' : pfad;
  if (!['POST /api/rezept/confirm', 'PATCH /api/rezept/:id', 'POST /api/booking/batch-create', 'POST /api/arzt/resolve'].includes(`${method} ${route}`)) return result(501, { error: 'Dieser Schreibweg ist in der lokalen Demo gesperrt' });
  try {
    const serial = JSON.stringify(tabellen);
    if (!serial || serial.length > 2 * 1024 * 1024 || !tabellen || Array.isArray(tabellen) || typeof tabellen !== 'object') throw failure('Invalid demo tables');
    if (Object.keys(tabellen).some(key => !/^[a-z][a-z_0-9]*$/.test(key) || !Array.isArray(tabellen[key]) || tabellen[key].length > 10000 || tabellen[key].some(row => !row || Array.isArray(row) || typeof row !== 'object'))) throw failure('Invalid demo table rows');
    const tables = JSON.parse(serial);
    const owners = (tables.profiles || []).filter(p => p.role === 'owner' && !p.owner_id);
    if (owners.length !== 1 || typeof owners[0].id !== 'string') throw failure('Exactly one synthetic owner required');
    if (!body || Array.isArray(body) || typeof body !== 'object' || JSON.stringify(body).length > 128 * 1024) return result(400, { error: 'Ungültiger Demo-Auftrag' });
    const ownerId = owners[0].id;
    // Original batch handler tolerates an unowned lead as null. Demo must not claim it linked it.
    if (route === '/api/booking/batch-create' && body.leadId && !tables.leads?.some(p => p.id === body.leadId && p.owner_id === ownerId)) return result(403, { error: 'Patient gehört nicht zu dieser Testpraxis' });
    const handlers = registerHandlers(memoryClient(tables, ownerId));
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handlers[`${method} ${route}`]({ auth: { tenantId: ownerId, userId: ownerId }, params: { id: match?.[1] }, body: copy(body) }, response);
    if (!response.body || response.statusCode >= 500) return result(500, { error: 'Lokale Demo konnte Produktionshandler nicht vollständig ausführen' });
    return result(response.statusCode, copy(response.body), response.statusCode >= 200 && response.statusCode < 300 ? tables : original);
  } catch {
    return result(500, { error: 'Lokale Demo: ungültige oder nicht unterstützte Datenquelle' });
  }
}
