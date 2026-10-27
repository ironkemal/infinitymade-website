import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { arbeitsfensterFuerTag, zieheIntervalleAb } from './arbeitsfenster.js';

// Oracle comes ONLY from this local commit, never from a server import or a rewrite.
// Requires retained local git object. Missing object/hash drift must fail, not fall back.
const BASE = 'dc134770';
const ORIGINAL_SHA256 = '68c1026655a10af9f24a8d23987ff7bd402106806cf8e3c0752793372450c7cd';
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = execFileSync('rtk', ['proxy', 'git', 'show', `${BASE}:api-backend/server.js`], {
  cwd: root, encoding: 'utf8', maxBuffer: 2_000_000
});
const bounded = (first, last) => source.split('\n').slice(first - 1, last).join('\n');
const original = bounded(827, 1087);
assert.equal(createHash('sha256').update(original).digest('hex'), ORIGINAL_SHA256);
assert.match(original, /^async function getAvailableSlots\(/);
assert.match(original, /\n}$/);
new vm.Script(`(${original})`); // Declaration boundary must contain exactly one expression.

const helperScope = bounded(298, 344);
const helperNames = ['timeToMins', 'minsToTime', 'berlinOffsetMin',
  'utcToBerlinMinutes', 'berlinDayOfWeek', 'berlinDayBoundsUTC'];
const helpers = helperNames.map(name => {
  // Bounded declaration extraction: original top-level function closing braces are col 0.
  const matches = [...helperScope.matchAll(new RegExp(`^function ${name}\\([^]*?^}`, 'gm'))];
  assert.equal(matches.length, 1, `unique bounded original helper ${name}`);
  new vm.Script(`(${matches[0][0]})`);
  return matches[0][0];
}).join('\n');

function replaceOnce(text, from, to) {
  assert.ok(text.includes(from), `substitution anchor missing: ${from.slice(0, 70)}`);
  assert.equal(text.indexOf(from), text.lastIndexOf(from), 'unique substitution anchor');
  return text.replace(from, to);
}
function replaceRegion(text, start, end, replacement) {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'bounded substitution region');
  return replaceOnce(text, text.slice(a, b), replacement);
}

// Controlled replacement of ONLY window decisions/building. Queries, resolution,
// original absence clipping/projection, bookings/groups, Google and slot loop retained.
let candidate = replaceRegion(original,
  '  if (activeBiz && Array.isArray(activeBiz.closed_days)',
  '  // 1.5 Check custom_days',
  `  if (arbeitsfensterFuerTag({ wochentag: dayOfWeek, closedDays: activeBiz?.closed_days }).reason === 'business_closed_day') {
    return { slots: [], reason: 'business_closed_day' };
  }\n\n`);
candidate = replaceRegion(candidate,
  "  if (customDay && (customDay.type === 'closed' || customDay.type === 'holiday') && !customDay.start_time",
  '  // 2. Get Working Hours',
  `  if (arbeitsfensterFuerTag({ wochentag: dayOfWeek, customDay }).reason === 'custom_day_closed') {
    return { slots: [], reason: 'custom_day_closed' };
  }\n\n`);
candidate = replaceOnce(candidate, '  // Correct fallback logic:',
  '  const employeeArbeitszeit = wh;\n  // Correct fallback logic:');
const input = `wochentag: dayOfWeek, closedDays: activeBiz?.closed_days,
    hatOwner: Boolean(profile?.owner_id), arbeitszeit: employeeArbeitszeit,
    ownerArbeitszeit: wh, customDay`;
candidate = replaceRegion(candidate,
  "  if (customDay && customDay.type === 'special'",
  '  // 2. Get existing bookings',
  `  const fenster = arbeitsfensterFuerTag({ ${input} });
  if (fenster.reason) return { slots: [], reason: fenster.reason };
  const { start: startMinutes, end: endMinutes } = fenster.arbeitsintervall;\n\n`);
candidate = replaceRegion(candidate,
  "  if (customDay && (customDay.type === 'closed' || customDay.type === 'holiday') && customDay.start_time",
  '  // 2.6 Get Breaks', '');
candidate = replaceRegion(candidate, '  (breaksData || []).forEach',
  '  // 2.5 Get Time Offs', '');
const projectionStart = candidate.indexOf('  if (timeOffs) {');
const projectionEnd = candidate.indexOf('  // 3. Get Google', projectionStart);
const originalProjection = candidate.slice(projectionStart, projectionEnd);
const redirectedProjection = replaceOnce(originalProjection, 'bookedIntervals.push({', 'abwesenheitsIntervalle.push({');
candidate = replaceOnce(candidate, originalProjection,
  `  const abwesenheitsIntervalle = [];\n${redirectedProjection}` +
  `  bookedIntervals.push(...arbeitsfensterFuerTag({ ${input},
    pausen: breaksData || [], abwesenheitsIntervalle }).sperrintervalle);\n\n`);
// Prove projection arithmetic and slot generation have not been reimplemented.
assert.equal(redirectedProjection.replace('abwesenheitsIntervalle.push({', 'bookedIntervals.push({'), originalProjection);
const generation = original.slice(original.indexOf('  // 4. Generate available slots'));
assert.equal(candidate.slice(candidate.indexOf('  // 4. Generate available slots')), generation);
const observe = text => replaceOnce(text, '  // 4. Generate available slots',
  '  capture({ startMinutes, endMinutes, bookedIntervals });\n  // 4. Generate available slots');
const plain = value => JSON.parse(JSON.stringify(value));
const wh = (start_time = '08:07:00', end_time = '17:00:00', is_active = true) =>
  ({ start_time, end_time, is_active });
const pause = (start_time, end_time) => ({ start_time, end_time });
const day = (type, start_time = null, end_time = null) => ({ type, start_time, end_time });

function harness(fixture, declaration) {
  const date = fixture.date || '2026-10-26';
  const userId = 'employee-a';
  const ownerId = fixture.hatOwner === false ? userId : 'owner-a';
  const now = Date.parse(fixture.now || '2026-01-01T00:00:00Z');
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const calls = [];
  const observations = [];
  const clock = vm.createContext({ Date: FixedDate, Intl });
  vm.runInContext(`const BUSINESS_TZ = 'Europe/Berlin'; ${helpers}`, clock);
  const weekday = vm.runInContext(`berlinDayOfWeek('${date}')`, clock);
  const bounds = plain(vm.runInContext(`berlinDayBoundsUTC('${date}')`, clock));
  const eq = (key, value) => ['eq', key, value];
  const query = table => {
    const ops = [];
    const chain = {};
    const resolve = () => {
      calls.push({ table, ops: plain(ops) });
      const selection = ops[0]?.[1];
      const check = expected => assert.deepEqual(ops, expected, `${table}: exact selection/filter boundary`);
      let data;
      switch (table) {
        case 'profiles':
          check([['select', 'owner_id'], eq('id', userId), ['single']]);
          data = { owner_id: fixture.hatOwner === false ? null : ownerId };
          break;
        case 'services':
          check([['select', 'is_group'], eq('id', 'service-a'), ['maybeSingle']]);
          data = { is_group: Boolean(fixture.groupService) };
          break;
        case 'businesses':
          if (selection === 'id, closed_days, owner_id') {
            check([['select', selection], eq('id', 'business-a'), ['maybeSingle']]);
            data = fixture.explicitMissing ? null : {
              id: 'business-a', owner_id: fixture.foreignBusiness ? 'foreign-owner' : ownerId,
              closed_days: fixture.closedDays || []
            };
          } else {
            check([['select', 'id, closed_days'], eq('owner_id', ownerId), eq('is_default', true), ['maybeSingle']]);
            data = fixture.noBusiness ? null : { id: 'default-a', closed_days: fixture.defaultClosedDays || [] };
          }
          break;
        case 'employee_business_assignments':
          check([['select', 'business_id, businesses(id, closed_days, is_default)'], eq('employee_id', userId)]);
          data = fixture.assignments || [];
          break;
        case 'custom_days':
          check([['select', 'type,start_time,end_time'], eq('owner_id', ownerId), eq('date', date), ['maybeSingle']]);
          data = fixture.customDay || null;
          break;
        case 'working_hours': {
          const selectedUser = ops[1]?.[2];
          assert.ok(selectedUser === userId || selectedUser === ownerId);
          check([['select', '*'], eq('user_id', selectedUser), eq('day_of_week', weekday), ['single']]);
          data = selectedUser === userId
            ? (Object.hasOwn(fixture, 'arbeitszeit') ? fixture.arbeitszeit : wh())
            : (Object.hasOwn(fixture, 'ownerArbeitszeit') ? fixture.ownerArbeitszeit : wh('09:03', '16:00'));
          break;
        }
        case 'bookings':
          if (selection === 'group_parent_id') {
            const ids = (fixture.bookings || []).filter(b => b.is_group).map(b => b.id);
            check([['select', selection], ['in', 'group_parent_id', ids], eq('status', 'confirmed')]);
            data = fixture.participants || [];
          } else {
            check([['select', 'id, start_time, end_time, is_group, group_capacity, service_id'],
              eq('user_id', userId), eq('status', 'confirmed'), ['is', 'group_parent_id', null],
              ['gte', 'start_time', bounds.start], ['lte', 'start_time', bounds.end]]);
            data = fixture.bookings || [];
          }
          break;
        case 'breaks':
          check([['select', 'start_time, end_time'], eq('user_id', userId), eq('day_of_week', weekday)]);
          data = (fixture.pausen || []).filter(p => (p.user_id ?? userId) === userId &&
            (p.day_of_week ?? weekday) === weekday).map(({ start_time, end_time }) => ({ start_time, end_time }));
          break;
        case 'time_offs':
          check([['select', 'start_date, end_date'], eq('employee_id', userId),
            ['lte', 'start_date', bounds.end], ['gte', 'end_date', bounds.start]]);
          data = (fixture.timeOffs || []).filter(t => (t.employee_id ?? userId) === userId &&
            Date.parse(t.start_date) <= Date.parse(bounds.end) && Date.parse(t.end_date) >= Date.parse(bounds.start));
          break;
        case 'calendar_integrations':
          check([['select', '*'], eq('user_id', userId), eq('provider', 'google'), ['single']]);
          data = null; // No credentials, integration or network fallback exists in this sandbox.
          break;
        default: assert.fail(`unexpected table ${table}`);
      }
      return { data };
    };
    for (const method of ['select', 'eq', 'is', 'in', 'gte', 'lte']) {
      chain[method] = (...args) => { ops.push([method, ...args]); return chain; };
    }
    for (const method of ['single', 'maybeSingle']) {
      chain[method] = () => { ops.push([method]); return Promise.resolve(resolve()); };
    }
    chain.then = (ok, fail) => Promise.resolve().then(resolve).then(ok, fail);
    return chain;
  };
  const context = vm.createContext({
    Date: FixedDate, Intl, supabase: { from: query }, arbeitsfensterFuerTag,
    capture: value => observations.push(plain(value)),
    newOAuthClient() { assert.fail('Google integration forbidden in B07 tests'); },
    google: { calendar() { assert.fail('Google provider forbidden in B07 tests'); } },
    console: { error() { assert.fail('unexpected swallowed provider error'); } }
  });
  vm.runInContext(`const BUSINESS_TZ = 'Europe/Berlin'; const SLOT_STEP_MINUTES = 15;
    ${helpers}\n${observe(declaration)}`, context);
  return {
    calls, observations,
    run: async () => plain(await context.getAvailableSlots(userId, date, fixture.duration ?? 30,
      fixture.noExplicitBusiness ? null : 'business-a', fixture.buffer ?? 0, fixture.step ?? 15,
      fixture.withService ? 'service-a' : null))
  };
}

async function parity(fixture) {
  const old = harness(fixture, original);
  const next = harness(fixture, candidate);
  const expected = await old.run();
  assert.deepEqual(await next.run(), expected, 'exact original slot sequence and reason');
  assert.deepEqual(next.calls, old.calls, 'exact original query/early-return order');
  assert.deepEqual(next.observations, old.observations, 'exact working bounds and raw blocker order');
  return { result: expected, calls: next.calls, observation: next.observations[0] };
}

test('oracle: pinned original declaration SHA256, bounded helpers, unchanged slot loop', () => {
  assert.equal(createHash('sha256').update(original).digest('hex'), ORIGINAL_SHA256);
  assert.equal(helperNames.length, 6);
});

const cases = [
  ['regular working hours, seconds ignored', {}],
  ['missing employee falls back to owner', { arbeitszeit: null }],
  ['falsy employee falls back to owner', { arbeitszeit: false }],
  ['missing owner and employee', { arbeitszeit: null, ownerArbeitszeit: null }],
  ['owner without record cannot fallback', { hatOwner: false, arbeitszeit: null }],
  ['inactive employee prevents fallback', { arbeitszeit: wh('08:00', '17:00', false) }],
  ['null is_active prevents fallback', { arbeitszeit: wh('08:00', '17:00', null) }],
  ['missing is_active prevents fallback', { arbeitszeit: { start_time: '08:00', end_time: '17:00' } }],
  ['inactive owner fallback', { arbeitszeit: null, ownerArbeitszeit: wh('08:00', '17:00', false) }],
  ['numeric Monday closed beats special', { closedDays: [1], customDay: day('special', '08:00', '17:00') }],
  ['numeric closed beats holiday and inactive', { closedDays: [1], customDay: day('holiday'), arbeitszeit: null }],
  ['string Monday not closed', { closedDays: ['1'] }],
  ['nonarray closed_days ignored', { closedDays: '1' }],
  ['Sunday is zero', { date: '2026-11-01', closedDays: [0] }],
  ['foreign explicit location ignored', { foreignBusiness: true, closedDays: [1] }],
  ['default location closed', { explicitMissing: true, defaultClosedDays: [1] }],
  ['assigned default preferred over first', { explicitMissing: true, assignments: [
    { businesses: { id: 'first', closed_days: [] } },
    { businesses: { id: 'default', is_default: true, closed_days: [1] } }
  ] }],
  ['no resolved location', { noExplicitBusiness: true, noBusiness: true }],
  ['closed entire day', { customDay: day('closed') }],
  ['holiday entire day beats inactive', { customDay: day('holiday'), arbeitszeit: wh('08:00', '17:00', false) }],
  ['closed interval', { customDay: day('closed', '11:00', '13:00') }],
  ['holiday interval', { customDay: day('holiday', '11:00', '13:00') }],
  ['closed only start ignored', { customDay: day('closed', '11:00') }],
  ['closed only end ignored', { customDay: day('closed', null, '13:00') }],
  ['holiday only start ignored', { customDay: day('holiday', '11:00') }],
  ['holiday only end ignored', { customDay: day('holiday', null, '13:00') }],
  ['special opens missing working hours', { arbeitszeit: null, ownerArbeitszeit: null, customDay: day('special', '10:07', '13:00') }],
  ['special opens inactive working hours', { arbeitszeit: wh('08:00', '17:00', false), customDay: day('special', '10:07', '13:00') }],
  ['special only start cannot open', { arbeitszeit: null, ownerArbeitszeit: null, customDay: day('special', '10:00') }],
  ['special only end cannot open', { arbeitszeit: null, ownerArbeitszeit: null, customDay: day('special', null, '13:00') }],
  ['special without times uses working hours', { customDay: day('special') }],
  ['unknown custom type ignored', { customDay: day('other', '09:00', '17:00') }],
  ['touching working edges and exact slots', { arbeitszeit: wh('09:00', '12:00'), pausen: [pause('08:00', '09:00'), pause('10:00', '10:30'), pause('12:00', '13:00')] }],
  ['overlapping unsorted pauses', { pausen: [pause('12:15', '13:00'), pause('11:30', '12:30'), pause('12:00', '12:45')] }],
  ['zero-width pause', { pausen: [pause('10:22', '10:22')] }],
  ['reverse pause', { pausen: [pause('12:00', '11:00')] }],
  ['midnight pause not extended', { pausen: [pause('23:00', '01:00')] }],
  ['zero working interval', { arbeitszeit: wh('10:00', '10:00') }],
  ['reverse working interval', { arbeitszeit: wh('17:00', '08:00') }],
  ['midnight working interval not extended', { arbeitszeit: wh('23:00', '01:00') }],
  ['zero custom blocking interval', { customDay: day('closed', '10:22', '10:22') }],
  ['reverse custom blocking interval', { customDay: day('holiday', '13:00', '11:00') }],
  ['requested user pauses only, no location filtering', { arbeitszeit: null, pausen: [
    { ...pause('09:00', '10:00'), user_id: 'owner-a' },
    { ...pause('10:00', '11:00'), user_id: 'other-user' },
    { ...pause('11:00', '12:00'), business_id: 'different-location' },
    { ...pause('13:00', '14:00'), day_of_week: 2 }
  ] }],
  ['same-day absence', { timeOffs: [{ start_date: '2026-10-26T10:00:00Z', end_date: '2026-10-26T12:00:00Z' }] }],
  ['full-day absence', { timeOffs: [{ start_date: '2026-10-25T23:00:00Z', end_date: '2026-10-26T22:59:59.999Z' }] }],
  ['multiday absence clipped', { timeOffs: [{ start_date: '2026-10-24T00:00:00Z', end_date: '2026-10-28T23:59:59Z' }] }],
  ['UTC date-only absence projection retained', { timeOffs: [{ start_date: '2026-10-26', end_date: '2026-10-27' }] }],
  ['absence includes exact bounds and excludes other employee', { timeOffs: [
    { start_date: '2026-10-25T22:00:00Z', end_date: '2026-10-25T23:00:00Z' },
    { start_date: '2026-10-26T22:59:59.999Z', end_date: '2026-10-27T04:00:00Z' },
    { start_date: '2026-10-25', end_date: '2026-10-28', employee_id: 'other-user' },
    { start_date: '2026-10-23', end_date: '2026-10-24' }
  ] }],
  ['all blocker families keep original order', { customDay: day('holiday', '13:00', '14:00'),
    pausen: [pause('12:00', '12:30'), pause('10:00', '10:15')],
    timeOffs: [{ start_date: '2026-10-26T14:00:00Z', end_date: '2026-10-26T15:00:00Z' }],
    bookings: [{ id: 'booking-a', start_time: '2026-10-26T08:00:00Z', end_time: '2026-10-26T09:00:00Z' }] }],
  ['spring DST projection, fixed 24h legacy bounds', { date: '2026-03-29', arbeitszeit: wh('00:00', '08:00'),
    timeOffs: [{ start_date: '2026-03-28', end_date: '2026-03-30' }] }],
  ['autumn DST projection, fixed 24h legacy bounds', { date: '2026-10-25', arbeitszeit: wh('00:00', '08:00'),
    timeOffs: [{ start_date: '2026-10-24', end_date: '2026-10-26' }] }],
  ['today keeps end-based 30-min lead rule', { now: '2026-10-26T08:00:00Z', arbeitszeit: wh('09:00', '12:00') }],
  ['past date stops before queries', { date: '2025-12-31' }],
  ['group booking available capacity retained', { withService: true, groupService: true,
    bookings: [{ id: 'parent-a', is_group: true, service_id: 'service-a', group_capacity: 2,
      start_time: '2026-10-26T09:00:00Z', end_time: '2026-10-26T10:00:00Z' }],
    participants: [{ group_parent_id: 'parent-a' }] }],
  ['group booking full capacity retained', { withService: true, groupService: true,
    bookings: [{ id: 'parent-a', is_group: true, service_id: 'service-a', group_capacity: 1,
      start_time: '2026-10-26T09:00:00Z', end_time: '2026-10-26T10:00:00Z' }],
    participants: [{ group_parent_id: 'parent-a' }] }]
];
for (const [name, fixture] of cases) test(`original parity: ${name}`, () => parity(fixture));

for (const duration of [15, '35', 60]) {
  for (const buffer of [0, 5, 20]) {
    for (const step of [5, 15, 30]) {
      test(`original parity: duration=${duration}, buffer=${buffer}, step=${step}, anchored 08:07`, () =>
        parity({ duration, buffer, step, pausen: [pause('10:11', '10:38'), pause('12:00', '12:00'), pause('14:00', '13:50')] }));
    }
  }
}

test('pure core preserves raw order/zero/reverse intervals and leaves inputs untouched', () => {
  const input = { wochentag: 1, hatOwner: true, arbeitszeit: null,
    ownerArbeitszeit: wh('08:07:59', '17:00:59'), customDay: day('closed', '13:00', '12:00'),
    pausen: [pause('11:00', '11:00'), pause('10:00', '10:30')],
    abwesenheitsIntervalle: [{ start: 1439, end: 0 }, { start: 0, end: 0 }] };
  const before = structuredClone(input);
  for (const item of [...input.pausen, ...input.abwesenheitsIntervalle, input.ownerArbeitszeit, input.customDay]) Object.freeze(item);
  Object.freeze(input.pausen); Object.freeze(input.abwesenheitsIntervalle); Object.freeze(input);
  assert.deepEqual(arbeitsfensterFuerTag(input), {
    arbeitsintervall: { start: 487, end: 1020 },
    sperrintervalle: [{ start: 780, end: 720 }, { start: 660, end: 660 },
      { start: 600, end: 630 }, { start: 1439, end: 0 }, { start: 0, end: 0 }]
  });
  assert.deepEqual(input, before);
});

test('pure core decision precedence and strict closed-day membership', () => {
  const input = { wochentag: 0, closedDays: [0], customDay: day('special', '09:00', '12:00'), arbeitszeit: null };
  assert.equal(arbeitsfensterFuerTag(input).reason, 'business_closed_day');
  assert.equal(arbeitsfensterFuerTag({ ...input, closedDays: ['0'] }).reason, undefined);
  assert.equal(arbeitsfensterFuerTag({ ...input, closedDays: [], customDay: day('closed') }).reason, 'custom_day_closed');
  assert.equal(arbeitsfensterFuerTag({ wochentag: 0 }).reason, 'working_hours_inactive');
});

test('owner fallback requires missing employee row and owner relationship', () => {
  const ownerArbeitszeit = wh('09:00', '16:00');
  const input = { wochentag: 1, ownerArbeitszeit };
  assert.equal(arbeitsfensterFuerTag({ ...input, hatOwner: true,
    arbeitszeit: wh('08:00', '17:00', false) }).reason, 'working_hours_inactive');
  assert.equal(arbeitsfensterFuerTag({ ...input, hatOwner: false,
    arbeitszeit: null }).reason, 'working_hours_inactive');
  assert.deepEqual(arbeitsfensterFuerTag({ ...input, hatOwner: true,
    arbeitszeit: null }).arbeitsintervall, { start: 540, end: 960 });
  assert.deepEqual(arbeitsfensterFuerTag({ ...input, hatOwner: true,
    arbeitszeit: wh('08:00', '17:00') }).arbeitsintervall, { start: 480, end: 1020 });
});

test('reverse blockers touching either boundary preserve strict non-overlap', () => {
  const intervalle = [{ start: 0, end: 10 }];
  assert.deepEqual(zieheIntervalleAb(intervalle, [{ start: 6, end: 0 }]), intervalle);
  assert.deepEqual(zieheIntervalleAb(intervalle, [{ start: 10, end: 4 }]), intervalle);
});

test('subtraction: half-open touching, ordered splits, overlapping blockers, immutable inputs', () => {
  const input = Object.freeze([Object.freeze({ start: 480, end: 1020 })]);
  const blocks = Object.freeze([Object.freeze({ start: 600, end: 660 }),
    Object.freeze({ start: 630, end: 690 }), Object.freeze({ start: 480, end: 480 }),
    Object.freeze({ start: 1020, end: 1080 })]);
  assert.deepEqual(zieheIntervalleAb(input, blocks), [{ start: 480, end: 600 }, { start: 690, end: 1020 }]);
  assert.deepEqual(zieheIntervalleAb([{ start: 0, end: 10 }], [{ start: -2, end: 12 }]), []);
  assert.deepEqual(zieheIntervalleAb([], blocks), []);
  assert.deepEqual(zieheIntervalleAb([{ start: 10, end: 0 }, { start: 5, end: 5 }], []),
    [{ start: 10, end: 0 }, { start: 5, end: 5 }]);
});

test('subtraction retains zero blockers and reverse blockers produce overlapping windows', () => {
  assert.deepEqual(zieheIntervalleAb([{ start: 0, end: 10 }], [{ start: 5, end: 5 }]),
    [{ start: 0, end: 5 }, { start: 5, end: 10 }]);
  const windows = zieheIntervalleAb([{ start: 0, end: 10 }], [{ start: 6, end: 4 }]);
  assert.deepEqual(windows, [{ start: 0, end: 6 }, { start: 4, end: 10 }]);
  assert.equal(windows.reduce((n, i) => n + i.end - i.start, 0), 12, 'not an unchecked utilization denominator');
});

test('subtraction is not a slot-raster anchor: preserve original 08:07 start', async () => {
  const { result } = await parity({ arbeitszeit: wh('08:07', '11:00'), pausen: [pause('09:00', '09:38')] });
  assert.ok(result.slots.includes('09:52'));
  assert.ok(!result.slots.includes('09:38'));
});

test('legacy limits explicit: DST day bounds remain 24h; UTC dates and end-based lead rule unchanged', async () => {
  const spring = await parity({ date: '2026-03-29' });
  const autumn = await parity({ date: '2026-10-25' });
  const bookingBounds = run => run.calls.find(c => c.table === 'bookings').ops.slice(-2).map(op => op[2]);
  assert.deepEqual(bookingBounds(spring), ['2026-03-28T22:00:00.000Z', '2026-03-29T21:59:59.999Z']);
  assert.deepEqual(bookingBounds(autumn), ['2026-10-24T23:00:00.000Z', '2026-10-25T22:59:59.999Z']);
  const today = await parity({ now: '2026-10-26T08:00:00Z', arbeitszeit: wh('09:00', '12:00') });
  assert.equal(today.result.slots[0], '09:15', 'original tests slot END against now+30, not slot start');
  const utcDate = await parity({ timeOffs: [{ start_date: '2026-10-26', end_date: '2026-10-27' }] });
  assert.deepEqual(utcDate.observation.bookedIntervals, [{ start: 60, end: 1439 }]);
});
