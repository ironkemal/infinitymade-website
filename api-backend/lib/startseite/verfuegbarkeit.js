import { berlinHeute, berlinTagesgrenzen } from '../berlin-tag.js';
import { zieheIntervalleAb } from '../arbeitsfenster.js';

const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const id = value => typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;
const location = value => value === null || id(value) !== null;
const integer = (value, min = 0) => Number.isInteger(value) && value >= min && value <= 1440;
const complete = value => value?.vollstaendig === true && Array.isArray(value.gruende) && value.gruende.length === 0;
const fail = code => { throw new Error(code); };
const REASONS = new Set(['KONTEXT_UNGUELTIG', 'SCOPE_UNGUELTIG', 'QUELLEN_UNVOLLSTAENDIG',
  'QUELLEN_WIDERSPRUCH', 'EXTERNE_BELEGUNG_UNBEKANNT', 'INTERVALL_UNGUELTIG',
  'SLOT_UNGUELTIG', 'WOCHENBASIS_FEHLT', 'ZEITBASIS_UNKLAR']);

function authorize(input, mode) {
  const deny = code => { throw Object.assign(new Error(code), { status: 403, code }); };
  if (!input || Object.keys(input).sort().join(',') !== 'role,tenantId,userId'
    || !id(input.tenantId) || !id(input.userId)
    || !['owner', 'employee'].includes(input.role)
    || (input.role === 'owner') !== (id(input.userId) === id(input.tenantId))) {
    deny('ZUGRIFF_VERWEIGERT');
  }
  if (mode === 'woche' && input.role === 'employee') deny('NUR_INHABER');
  return { tenantId: id(input.tenantId), userId: id(input.userId), role: input.role };
}

// Calendar arithmetic on date labels, never seven 24-hour instants in Berlin.
function datesFor(mode, now) {
  const today = berlinHeute(now);
  if (mode === 'tag') return [today];
  const monday = new Date(`${today}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + offset);
    return day.toISOString().slice(0, 10);
  });
}

function normalDay(tag) {
  const bounds = berlinTagesgrenzen(tag);
  // The existing engine uses HH:mm/minute-of-day, without offset/fold. Do not
  // silently reinterpret its raw blockers on a 23/25-hour day as a 24-hour day.
  if (!bounds || Date.parse(bounds.bisExklusiv) - Date.parse(bounds.von) !== 86400000) fail('ZEITBASIS_UNKLAR');
  return bounds;
}

function validateContext(ctx, scope) {
  if (!ctx || ctx.version !== 1 || !Array.isArray(ctx.behandler)) fail('KONTEXT_UNGUELTIG');
  if (id(ctx.tenantId) !== scope.tenantId || id(ctx.userId) !== scope.userId || ctx.role !== scope.role) fail('SCOPE_UNGUELTIG');
  if (!complete(ctx)) fail('QUELLEN_UNVOLLSTAENDIG');
  const seen = new Set();
  for (const p of ctx.behandler) {
    if (!p || !id(p.userId) || id(p.tenantId) !== scope.tenantId
      || (p.role === 'owner' ? id(p.userId) !== scope.tenantId
        : p.role !== 'employee' || id(p.userId) === scope.tenantId)
      || (scope.role === 'employee' && id(p.userId) !== scope.userId)) fail('SCOPE_UNGUELTIG');
    if (seen.has(id(p.userId))) fail('KONTEXT_UNGUELTIG');
    seen.add(id(p.userId));
    if (!Array.isArray(p.standorte) || !p.standorte.length || !p.standorte.every(location)
      || new Set(p.standorte.map(b => b === null ? null : id(b))).size !== p.standorte.length
      || !Array.isArray(p.leistungen)) fail('KONTEXT_UNGUELTIG');
    const services = new Set();
    for (const s of p.leistungen) {
      if (!s || id(s.tenantId) !== scope.tenantId) fail('SCOPE_UNGUELTIG');
      if (!id(s.serviceId) || !location(s.businessId)
        || !p.standorte.some(b => (b === null ? null : id(b)) === (s.businessId === null ? null : id(s.businessId)))
        || typeof s.aktiv !== 'boolean' || typeof s.erlaubt !== 'boolean'
        || typeof s.istGruppe !== 'boolean' || !integer(s.dauerMin, 1)
        || !integer(s.pufferMin) || s.dauerMin + s.pufferMin > 1440
        || !integer(s.rasterMin, 1)) fail('KONTEXT_UNGUELTIG');
      const key = `${id(s.serviceId)}:${s.businessId === null ? null : id(s.businessId)}`;
      if (services.has(key)) fail('KONTEXT_UNGUELTIG');
      services.add(key);
    }
  }
  return ctx.behandler;
}

function intervals(rows, bookings = false) {
  if (!Array.isArray(rows)) fail('INTERVALL_UNGUELTIG');
  return rows.map(r => {
    // Validate RAW input BEFORE subtraction/union. B07 deliberately preserves
    // zero/reverse blockers; normalizing those would manufacture valid capacity.
    if (!r || !integer(r.start) || !integer(r.end) || r.start >= r.end
      || (bookings && r.gruppenServiceId != null && !id(r.gruppenServiceId))) fail('INTERVALL_UNGUELTIG');
    return { start: r.start, end: r.end,
      ...(bookings ? { gruppenServiceId: r.gruppenServiceId == null ? null : id(r.gruppenServiceId) } : {}) };
  });
}

function validateBasis(raw, { tenantId, userId, tag, businessId }) {
  if (!raw || raw.version !== 1) fail('QUELLEN_UNVOLLSTAENDIG');
  if (id(raw.tenantId) !== tenantId || id(raw.userId) !== userId || raw.tag !== tag
    || !location(raw.businessId)
    || (raw.businessId === null ? null : id(raw.businessId)) !== businessId) fail('SCOPE_UNGUELTIG');
  if (!complete(raw)) fail('QUELLEN_UNVOLLSTAENDIG');
  if (!raw.quellen || !['arbeitszeit', 'sperren', 'buchungen'].every(k => raw.quellen[k] === 'vollstaendig')) {
    fail('QUELLEN_UNVOLLSTAENDIG');
  }
  const externalOkay = raw.externStatus === 'verbunden' ? raw.quellen.extern === 'vollstaendig'
    : ['nicht_konfiguriert', 'aus'].includes(raw.externStatus) && raw.quellen.extern === 'nicht_erforderlich';
  if (!externalOkay) fail('EXTERNE_BELEGUNG_UNBEKANNT');
  normalDay(tag);
  const work = intervals(raw.arbeitsintervalle), blocks = intervals(raw.sperren);
  const bookings = intervals(raw.buchungen, true), external = intervals(raw.externeBelegung);
  if (raw.externStatus !== 'verbunden' && external.length) fail('EXTERNE_BELEGUNG_UNBEKANNT');
  if (work.length ? !integer(raw.rasterUrsprung)
    || raw.rasterUrsprung !== work.reduce((first, w) => Math.min(first, w.start), 1440)
    : raw.rasterUrsprung !== null) fail('INTERVALL_UNGUELTIG');
  // Keep raw order and duplicates in the evidence signature. A second service
  // response must not silently replace the first service's source observation.
  return { work, blocks, bookings, external, origin: raw.rasterUrsprung,
    externStatus: raw.externStatus };
}

function union(rows) {
  const sorted = rows.map(({ start, end }) => ({ start, end })).sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push(r);
  }
  return out;
}
const overlaps = (a, b) => a.start < b.end && a.end > b.start;
const minutes = rows => rows.reduce((sum, r) => sum + r.end - r.start, 0);
const hhmm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
function startMinute(s) {
  if (typeof s !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)) fail('SLOT_UNGUELTIG');
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
}
function unknown(mode, grund) {
  return mode === 'tag' ? { status: 'unbekannt', grund, luecken: null, minimumMin: null }
    : { status: 'unbekannt', grund, gebuchtMin: null, arbeitsMin: null, quote: null };
}

async function day(persons, tenantId, tag, now, slotAdapter) {
  const bounds = normalDay(tag);
  const collected = [], durations = [];
  let hasWork = false;
  for (const p of persons) {
    const starts = [], free = [], observations = new Map();
    for (const s of p.leistungen.filter(s => s.aktiv && s.erlaubt)) {
      durations.push(s.dauerMin);
      const input = { tenantId, userId: id(p.userId), tag,
        businessId: s.businessId === null ? null : id(s.businessId), serviceId: id(s.serviceId),
        dauerMin: s.dauerMin, pufferMin: s.pufferMin, rasterMin: s.rasterMin, jetzt: now.toISOString() };
      const response = await slotAdapter(input);
      if (!complete(response)) fail('QUELLEN_UNVOLLSTAENDIG');
      const b = validateBasis(response.basis, input);
      const signature = JSON.stringify(b);
      if (observations.has(input.businessId) && observations.get(input.businessId) !== signature) fail('QUELLEN_WIDERSPRUCH');
      observations.set(input.businessId, signature);
      hasWork ||= b.work.length > 0;
      if (!Array.isArray(response.slots)) fail('SLOT_UNGUELTIG');
      const seen = new Set();
      for (const witness of response.slots) {
        if (!witness || typeof witness.gruppenRestplatz !== 'boolean') fail('SLOT_UNGUELTIG');
        const start = startMinute(witness.start);
        const block = { start, end: start + s.dauerMin + s.pufferMin };
        const occupied = b.bookings.filter(r => overlaps(block, r));
        if (seen.has(start) || !b.work.some(w => w.start <= start && block.end <= w.end)
          || start < b.origin || (start - b.origin) % s.rasterMin !== 0
          || [...b.blocks, ...b.external].some(r => overlaps(block, r))
          || (witness.gruppenRestplatz
            ? !s.istGruppe || !occupied.length || occupied.some(r => r.gruppenServiceId !== input.serviceId)
            : occupied.length > 0)) fail('SLOT_UNGUELTIG');
        seen.add(start);
        // Conservative subset of legacy engine: its lead gate tests slot END.
        // Booking/create tests START > now+30; never advertise earlier starts.
        const instant = Date.parse(bounds.von) + start * 60000;
        if (instant <= now.getTime() + 30 * 60000) continue;
        starts.push({ start: witness.start, serviceId: input.serviceId, businessId: input.businessId,
          dauerMin: s.dauerMin, pufferMin: s.pufferMin, rasterMin: s.rasterMin,
          art: witness.gruppenRestplatz ? 'gruppenrestplatz' : 'frei' });
        if (!witness.gruppenRestplatz) free.push({ start, end: start + s.dauerMin });
      }
    }
    if (starts.length) {
      const coverage = union(free);
      collected.push({ userId: id(p.userId), freiMin: minutes(coverage),
        intervalle: coverage.map(i => ({ von: hhmm(i.start), bis: hhmm(i.end) })),
        starts: starts.sort((a, b) => a.start.localeCompare(b.start) || a.serviceId.localeCompare(b.serviceId)
          || String(a.businessId).localeCompare(String(b.businessId))) });
    }
  }
  return { status: 'ok', grund: collected.length ? null : !persons.length ? 'KEINE_BEHANDLER'
    : !durations.length ? 'KEINE_LEISTUNGEN' : !hasWork ? 'KEINE_ARBEITSZEIT' : 'KEINE_FREIEN_STARTS',
  luecken: collected, minimumMin: durations.length ? Math.min(...durations) : null };
}

function week(ctx, persons, tenantId, dates) {
  if (!complete(ctx.wochenbasis) || !Array.isArray(ctx.wochenbasis.tage)) fail('WOCHENBASIS_FEHLT');
  const expected = new Map();
  for (const tag of dates) for (const p of persons) for (const business of p.standorte) {
    const businessId = business === null ? null : id(business);
    const userId = id(p.userId);
    expected.set(`${tag}:${userId}:${businessId}`, { tenantId, tag, userId, businessId });
  }
  const byPersonDay = new Map();
  for (const raw of ctx.wochenbasis.tage) {
    if (!raw || !id(raw.userId) || id(raw.tenantId) !== tenantId
      || !persons.some(p => id(p.userId) === id(raw.userId)) || !dates.includes(raw.tag)
      || !location(raw.businessId)) fail('SCOPE_UNGUELTIG');
    const businessId = raw.businessId === null ? null : id(raw.businessId);
    const key = `${raw.tag}:${id(raw.userId)}:${businessId}`;
    const scope = expected.get(key);
    if (!scope) {
      if (!persons.find(p => id(p.userId) === id(raw.userId)).standorte
        .some(b => (b === null ? null : id(b)) === businessId)) fail('SCOPE_UNGUELTIG');
      fail('WOCHENBASIS_FEHLT');
    }
    const b = validateBasis(raw, scope);
    expected.delete(key);
    const groupKey = `${raw.tag}:${id(raw.userId)}`;
    const group = byPersonDay.get(groupKey) ?? { capacity: [], occupied: [] };
    // Subtract only validated raw blockers. B07 subtraction is shared; union is
    // a measurement step AFTER subtraction, never an engine-input rewrite.
    group.capacity.push(...zieheIntervalleAb(union(b.work), b.blocks));
    group.occupied.push(...b.bookings, ...b.external);
    byPersonDay.set(groupKey, group);
  }
  if (expected.size) fail('WOCHENBASIS_FEHLT');
  let arbeitsMin = 0, gebuchtMin = 0;
  for (const g of byPersonDay.values()) {
    const capacity = union(g.capacity);
    arbeitsMin += minutes(capacity);
    const clipped = [];
    for (const o of union(g.occupied)) for (const w of capacity) {
      if (overlaps(o, w)) clipped.push({ start: Math.max(o.start, w.start), end: Math.min(o.end, w.end) });
    }
    gebuchtMin += minutes(union(clipped));
  }
  return { status: 'ok', grund: arbeitsMin === 0 ? 'KEINE_ARBEITSZEIT' : null,
    gebuchtMin, arbeitsMin, quote: arbeitsMin > 0 ? gebuchtMin / arbeitsMin : null };
}

/**
 * B08 / contract v1. Pure injected Startseite measurement adapter; no queries,
 * writes, server import, location/service resolver, slot generation or defaults.
 * Why/where: measured free-treatment coverage and complete weekly occupancy for
 * Startseite; first consumer is the synthetic injection suite in this directory.
 * This is NOT a guarantee of online bookability or atomic booking availability.
 *
 * Factory: createVerfuegbarkeit({ladeKontext,slotAdapter,jetzt?:()=>Date}) returns
 * {tag({tenantId,userId,role}),woche({tenantId,userId,role})}, both async.
 * ONLY those three scope keys accepted; IDs UUID, owner userId===tenantId,
 * employee userId!==tenantId. Unknown/contradictory role or extra override: throws
 * {status:403,code:'ZUGRIFF_VERWEIGERT'} before any source. Employee week throws
 * {status:403,code:'NUR_INHABER'} before sources. Integrator MUST build this scope
 * from authenticated server auth/profile, never body/query claims. This module
 * cannot authenticate caller-supplied identities. Employee context: own user only.
 *
 * ladeKontext JSON input:
 * {version:1,modus:'tag'|'woche',tenantId,userId,role,tage:['YYYY-MM-DD',...],
 *  jetzt:'UTC ISO instant'}. Today / current Mo–So from injected Berlin clock.
 * JSON output:
 * {version:1,tenantId,userId,role,vollstaendig:true,gruende:[],behandler:[
 *   {tenantId,userId,role:'owner'|'employee',standorte:[UUID|null,...],leistungen:[
 *     {tenantId,serviceId:UUID,businessId:UUID|null,aktiv:boolean,erlaubt:boolean,
 *      dauerMin:integer>0,pufferMin:integer>=0,rasterMin:integer>0,istGruppe:boolean}
 *   ]}],wochenbasis?:{vollstaendig:true,gruende:[],tage:[BASIS,...]}}.
 * Empty arrays are KNOWN empty only with explicit completeness. All staff,
 * services, permission/group/certificate conditions and resolved sites must be
 * complete and tenant-checked by integrator. `aktiv` is normalized eligibility,
 * NOT services.is_active (column does not exist). Map existing duration_minutes,
 * is_group, is_internal, employee_services, required_certificate and engine's
 * actual buffer/raster/location/fallback policy, with no invented 30/35 default.
 * null businessId is the explicitly resolved single-practice engine fallback.
 *
 * slotAdapter exact JSON input:
 * {tenantId,userId,tag,businessId,serviceId,dauerMin,pufferMin,rasterMin,jetzt:ISO}.
 * Integrator calls original getAvailableSlots(userId,tag,dauerMin,businessId,
 * pufferMin,rasterMin,serviceId). Return JSON:
 * {vollstaendig:true,gruende:[],slots:[{start:'HH:mm',gruppenRestplatz:boolean}],
 *  basis:BASIS}. All eligible services are called, including different groups.
 * slots are actual engine witnesses; group flag needs matching group/capacity
 * proof from SAME reads. No slot candidates are reconstructed here. Each site's
 * raw basis must match across services. Empty work still needs complete BASIS.
 *
 * BASIS exact v1 required fields:
 * {version:1,tenantId,userId,tag,businessId,vollstaendig:true,gruende:[],
 *  quellen:{arbeitszeit:'vollstaendig',sperren:'vollstaendig',
 *    buchungen:'vollstaendig',extern:'vollstaendig'|'nicht_erforderlich'},
 *  externStatus:'verbunden'|'nicht_konfiguriert'|'aus',
 *  arbeitsintervalle:[{start,end}],sperren:[{start,end}],
 *  buchungen:[{start,end,gruppenServiceId?:UUID|null}],
 *  externeBelegung:[{start,end}],rasterUrsprung:integer|null}.
 * Minute-of-Berlin-day intervals, integers 0..1440, strict start<end, raw before
 * subtraction. Origin equals earliest raw working start; null iff no work.
 * Preserve B07's original raster origin,
 * raw work/sperren, fallback/custom-day/absence projection; do NOT normalize
 * zero/reverse blockers. Those make measurement INTERVALL_UNGUELTIG. 23/25-hour
 * days remain ZEITBASIS_UNKLAR because engine's HH:mm has no UTC-offset/fold.
 * Connected external calendar requires complete freebusy incl per-calendar
 * errors; explicitly checked off/unconfigured => nicht_erforderlich + empty
 * external array. Missing/broken expected connection never means no occupancy.
 * Bookings must be source-confirmed occupied norm-input, group parent once,
 * no new DB-status assumptions. External busy counts as occupied weekly time.
 *
 * REQUIRED INTEGRATOR GATE: legacy getAvailableSlots returns only {slots} and
 * ignores DB errors, truncation and Google failures; it CANNOT supply this proof.
 * Instrument ORIGINAL engine reads for errors, tenant/service/location scope,
 * pagination (also group participants), external config/freebusy and exact date
 * coverage. No second control query proves completeness of first observation.
 * Metadata loader must share the authorized engine/source observation, not add
 * an unchecked service/location resolver. For week: full raw observations for
 * EVERY date/person/site, including past days; legacy past-date early return
 * proves nothing. Absent/fullness/duplicate gaps => WOCHENBASIS_FEHLT, no totals.
 * This file provides no physical server wiring; instrumenting sources remains
 * integrator-owned. Claims of completeness are trust-boundary attestations,
 * not something this pure module can independently prove against a database.
 *
 * Tag DTO: {status:'ok'|'unbekannt',grund:null|FIXED,luecken:[]|null,
 * minimumMin:number|null}. Each luecken entry is {userId,freiMin,
 * intervalle:[{von:'HH:mm',bis:'HH:mm'}],starts:[{start,serviceId,businessId,
 * dauerMin,pufferMin,rasterMin,art:'frei'|'gruppenrestplatz'}]}.
 * intervalle is UNION of witnessed treatment-duration coverage per clinician
 * across sites/services; excludes buffer and all group remainder coverage.
 * It promises NO starts beyond `starts`, is NOT slots.length*duration, and is
 * NOT raw unoccupied working time. Minimum is eligible service duration only.
 * Extra strict START>now+30 filter is documented subset of legacy END gate;
 * booking logic is unchanged. Group remainder witness contributes zero minutes.
 * Week DTO: {status,grund,gebuchtMin:number|null,arbeitsMin:number|null,
 * quote:number|null}. Per person/day: union(work minus raw blocks) across sites;
 * union(bookings + external busy) clipped to that capacity; duplicates/group
 * children cannot inflate minutes. Whole week only. Quote=gebucht/arbeits (>0),
 * empty known capacity => 0/0 with null quote, never NaN or invented utilization.
 * Unknown is always null values, fixed reason, no partial sums. No raw data,
 * patient fields, names, notes, absence reasons, money or raw errors serialized.
 * Empty reasons: KEINE_BEHANDLER, KEINE_LEISTUNGEN, KEINE_ARBEITSZEIT,
 * KEINE_FREIEN_STARTS. Unknown reasons: REASONS above or QUELLE_NICHT_VERFUEGBAR.
 */
export function createVerfuegbarkeit({ ladeKontext, slotAdapter, jetzt = () => new Date() } = {}) {
  if (typeof ladeKontext !== 'function' || typeof slotAdapter !== 'function' || typeof jetzt !== 'function') {
    throw new TypeError('ladeKontext, slotAdapter und Uhr erforderlich');
  }
  async function run(mode, input) {
    const scope = authorize(input, mode);
    try {
      const instant = jetzt();
      if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) fail('ZEITBASIS_UNKLAR');
      const now = new Date(instant);
      const dates = datesFor(mode, now);
      const ctx = await ladeKontext({ version: 1, modus: mode, ...scope, tage: [...dates], jetzt: now.toISOString() });
      const persons = validateContext(ctx, scope);
      return mode === 'tag' ? await day(persons, scope.tenantId, dates[0], now, slotAdapter)
        : week(ctx, persons, scope.tenantId, dates);
    } catch (err) {
      return unknown(mode, REASONS.has(err?.message) ? err.message : 'QUELLE_NICHT_VERFUEGBAR');
    }
  }
  return { tag: input => run('tag', input), woche: input => run('woche', input) };
}
