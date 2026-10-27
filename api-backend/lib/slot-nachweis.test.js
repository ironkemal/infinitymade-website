import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { beobachteSlots } from './slot-nachweis.js';

// Real production declaration, no server bootstrap, credentials or provider access.
const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const original = execFileSync('rtk', ['proxy', 'git', 'show', '8970e658:api-backend/server.js'], {
  cwd: new URL('../../', import.meta.url), encoding: 'utf8', maxBuffer: 2_000_000
});
const declaration = (s, name, async = false) => {
  const matches = [...s.matchAll(new RegExp(`^${async ? 'async ' : ''}function ${name}\\([^]*?^}`, 'gm'))];
  assert.equal(matches.length, 1, name);
  new vm.Script(`(${matches[0][0]})`);
  return matches[0][0];
};
const helpers = ['timeToMins', 'minsToTime', 'berlinOffsetMin', 'utcToBerlinMinutes',
  'berlinDayOfWeek', 'berlinDayBoundsUTC'].map(n => declaration(source, n)).join('\n');
const plain = x => JSON.parse(JSON.stringify(x));

function engine(fixture = {}, baseline = false) {
  const calls = [];
  const daten = {
    profiles: { owner_id: fixture.employee ? 'owner' : null },
    services: { is_group: true },
    businesses: { id: 'business', owner_id: 'owner', closed_days: fixture.closed ? [2] : [] },
    employee_business_assignments: [], custom_days: null,
    working_hours: { start_time: '09:00', end_time: '11:00', is_active: true },
    bookings: fixture.group ? [{ id: 'group', start_time: '2026-10-27T09:00:00+01:00',
      end_time: '2026-10-27T09:30:00+01:00', is_group: true, group_capacity: 3, service_id: 'service' }] : [],
    breaks: [], time_offs: [], calendar_integrations: fixture.integration ?? null,
    ...fixture.data
  };
  const from = table => {
    let columns, options;
    const resolve = () => {
      const key = table === 'bookings' && columns === 'group_parent_id' ? 'participants' : table;
      const data = key === 'participants' ? [] : daten[table];
      calls.push({ key, options });
      if (fixture.reject === key) throw new Error('synthetic private error');
      if (fixture.error === key) return { data: null, error: { message: 'synthetic private error' } };
      const count = fixture.noCount === key ? null : (fixture.truncated === key ? 1001 : Array.isArray(data) ? data.length : null);
      return { data, error: null, count };
    };
    const q = {
      select(c, o) { columns = c; options = o; return q; },
      eq() { return q; }, is() { return q; }, in() { return q; },
      gte() { return q; }, lte() { return q; },
      single() { return q; }, maybeSingle() { return q; },
      then(ok, fail) { return Promise.resolve().then(resolve).then(ok, fail); }
    };
    return q;
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-27T07:00:00Z'])); }
  }
  const context = vm.createContext({ Date: FixedDate, Intl, supabase: { from },
    console: { error() {} },
    newOAuthClient() { if (fixture.oauthError) throw new Error('synthetic'); return { setCredentials() {} }; },
    google: { calendar() { return { freebusy: { async query() {
      if (fixture.googleError) throw new Error('synthetic');
      return fixture.googleResponse ?? { data: { calendars: { primary: { busy: [] } } } };
    } } }; } }
  });
  vm.runInContext(`const BUSINESS_TZ='Europe/Berlin'; const SLOT_STEP_MINUTES=15;
    ${helpers}\n${declaration(baseline ? original : source, 'getAvailableSlots', true)}`, context);
  const args = [fixture.employee ? 'employee' : 'owner', fixture.date ?? '2026-10-27', 30,
    fixture.employee ? null : 'business', 0, 15, fixture.group ? 'service' : null];
  return { calls, run: () => context.getAvailableSlots(...args),
    observed: () => beobachteSlots(context.getAvailableSlots, args) };
}

test('vollständige echte Engine-Reads, gleiche Slots und keine Kontrollabfrage', async () => {
  const e = engine();
  const result = await e.observed();
  assert.equal(result.vollstaendig, true);
  assert.deepEqual(plain(result.slots), plain((await engine({}, true).run()).slots));
  assert.equal(e.calls.length, 8);
  assert.ok(e.calls.filter(c => ['bookings', 'breaks', 'time_offs'].includes(c.key))
    .every(c => c.options?.count === 'exact'));
});

for (const key of ['profiles', 'services', 'businesses', 'employee_business_assignments',
  'custom_days', 'working_hours', 'bookings', 'participants', 'breaks', 'time_offs', 'calendar_integrations']) {
  for (const failure of ['error', 'reject']) {
    test(`${key}: ${failure} aus tatsächlich verwendetem Read bleibt Unknown`, async () => {
      const e = engine({ employee: key === 'employee_business_assignments', group: true, [failure]: key });
      const result = await e.observed();
      assert.equal(result.vollstaendig, false);
      assert.equal(result.slots.length, 0);
      assert.ok(e.calls.some(c => c.key === key));
      assert.ok(!JSON.stringify(result).includes('private error'));
    });
  }
}

for (const key of ['employee_business_assignments', 'bookings', 'participants', 'breaks', 'time_offs']) {
  for (const failure of ['noCount', 'truncated']) {
    test(`${key}: ${failure} bleibt Unknown auch bei leeren Listen`, async () => {
      const result = await engine({ employee: true, group: true, [failure]: key }).observed();
      assert.equal(result.vollstaendig, false);
      assert.equal(result.slots.length, 0);
    });
  }
}

test('optionaler Standort fehlt fehlerfrei: Single-Praxis bleibt möglich', async () => {
  const result = await engine({ employee: true, data: { businesses: null } }).observed();
  assert.equal(result.vollstaendig, true);
});
test('vergangene Tage liefern keine Wochenrohgrundlage', async () => {
  const e = engine({ date: '2026-10-26' });
  const result = await e.observed();
  assert.equal(result.vollstaendig, false);
  assert.equal(e.calls.length, 0);
  assert.ok(result.gruende.includes('VERGANGENHEIT_OHNE_ROHBASIS'));
});
test('geschlossener Tag: leere Slots belegt, keine Wochenkapazität behauptet', async () => {
  assert.equal((await engine({ closed: true }).observed()).vollstaendig, true);
});

const integration = { access_token: 'synthetic', refresh_token: 'synthetic' };
for (const [name, fixture, valid] of [
  ['keine Verbindung', {}, true],
  ['Zeile ohne Token', { integration: {} }, false],
  ['gültiges leeres Busy', { integration }, true],
  ['Timeout', { integration, googleError: true }, false],
  ['OAuth-Initialisierung', { integration, oauthError: true }, false],
  ['eingebetteter Fehler', { integration, googleResponse: { data: { calendars: { primary: { busy: [], errors: [{}] } } } } }, false],
  ['fehlender Kalender', { integration, googleResponse: { data: {} } }, false],
  ['fehlendes Busy', { integration, googleResponse: { data: { calendars: { primary: {} } } } }, false],
  ['ungültiges Intervall', { integration, googleResponse: { data: { calendars: { primary: { busy: [{ start: 'bad', end: 'bad' }] } } } } }, false]
]) {
  test(`Google ${name}: Vollständigkeit ${valid}`, async () => {
    const result = await engine(fixture).observed();
    assert.equal(result.vollstaendig, valid);
    assert.ok(!JSON.stringify(result).includes('synthetic'));
  });
}

for (const fixture of [{}, { employee: true }, { group: true }, { closed: true },
  { error: 'breaks' }, { integration, googleError: true }]) {
  test(`Buchungsantwort unverändert gegen fixierten Commit ${JSON.stringify(fixture)}`, async () => {
    const e = engine(fixture);
    assert.deepEqual(plain(await e.run()), plain(await engine(fixture, true).run()));
    assert.ok(e.calls.every(c => c.options === undefined));
  });
}
test('parallele Nachweise bleiben getrennt', async () => {
  const [gut, defekt] = await Promise.all([engine().observed(), engine({ error: 'breaks' }).observed()]);
  assert.equal(gut.vollstaendig, true);
  assert.equal(defekt.vollstaendig, false);
});
test('uninstrumentierte Engine kann kein vollstaendig:true erzeugen', async () => {
  const result = await beobachteSlots(async () => ({ slots: ['09:00'] }), []);
  assert.equal(result.vollstaendig, false);
  assert.deepEqual(result.slots, []);
});
