import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerfuegbarkeit } from './verfuegbarkeit.js';

// Synthetic, bounded injection witnesses. No copied slot generator, server import,
// credentials, network, DB, wall-clock dependency or production records.
const T = '10000000-0000-4000-8000-000000000001';
const E = '20000000-0000-4000-8000-000000000002';
const X = '30000000-0000-4000-8000-000000000003';
const S = '40000000-0000-4000-8000-000000000004';
const G = '50000000-0000-4000-8000-000000000005';
const B = '60000000-0000-4000-8000-000000000006';
const C = '70000000-0000-4000-8000-000000000007';
const owner = { tenantId: T, userId: T, role: 'owner' };
const employee = { tenantId: T, userId: E, role: 'employee' };
const NOW = '2026-10-27T08:00:00.000Z'; // Tuesday 09:00 Berlin.
const service = (overrides = {}) => ({ tenantId: T, serviceId: S, businessId: B,
  aktiv: true, erlaubt: true, dauerMin: 30, pufferMin: 5, rasterMin: 15,
  istGruppe: false, ...overrides });
const person = (userId = T, leistungen = [service()], standorte = [B]) => ({
  tenantId: T, userId, role: userId === T ? 'owner' : 'employee', standorte, leistungen,
});
const basis = (overrides = {}) => ({ version: 1, tenantId: T, userId: T, tag: '2026-10-27',
  businessId: B, vollstaendig: true, gruende: [], rasterUrsprung: 480,
  quellen: { arbeitszeit: 'vollstaendig', sperren: 'vollstaendig',
    buchungen: 'vollstaendig', extern: 'nicht_erforderlich' },
  externStatus: 'nicht_konfiguriert', arbeitsintervalle: [{ start: 480, end: 1020 }],
  sperren: [], buchungen: [], externeBelegung: [], ...overrides });
const result = (overrides = {}) => ({ vollstaendig: true, gruende: [],
  slots: [{ start: '10:00', gruppenRestplatz: false }], basis: basis(), ...overrides });
function fixture({ scope = owner, now = NOW, kontext, slots } = {}) {
  const reads = [], calls = [];
  const ctx = { version: 1, ...scope, vollstaendig: true, gruende: [],
    behandler: [person(scope.userId)], ...kontext };
  const api = createVerfuegbarkeit({ jetzt: () => new Date(now),
    ladeKontext: async input => { reads.push(input); return structuredClone(ctx); },
    slotAdapter: async input => {
      calls.push(input);
      return typeof slots === 'function' ? slots(input) : structuredClone(slots ?? result({
        basis: basis({ userId: scope.userId }),
      }));
    },
  });
  return { api, ctx, calls, reads };
}
const unknownTag = grund => ({ status: 'unbekannt', grund, luecken: null, minimumMin: null });
const unknownWeek = grund => ({ status: 'unbekannt', grund,
  gebuchtMin: null, arbeitsMin: null, quote: null });
const weekDates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
  '2026-10-30', '2026-10-31', '2026-11-01'];
function weekBasis(dates = weekDates, users = [T], businesses = [B]) {
  return { vollstaendig: true, gruende: [], tage: dates.flatMap(tag => users.flatMap(userId =>
    businesses.map(businessId => basis({ tag, userId, businessId })) )) };
}

test('factory rejects absent injection dependencies', () => {
  assert.throws(() => createVerfuegbarkeit(), TypeError);
  assert.throws(() => createVerfuegbarkeit({ ladeKontext() {} }), TypeError);
});
for (const [label, scope] of Object.entries({
  missing: {}, invalidUuid: { ...owner, tenantId: 'bad' },
  unknownRole: { ...owner, role: 'admin' }, ownerMismatch: { ...owner, userId: E },
  employeeMismatch: { ...employee, userId: T },
  foreignOverride: { ...employee, employeeId: X },
  tenantOverride: { ...owner, query: { tenantId: X } },
})) {
  test(`auth ${label}: 403 before every source`, async () => {
    const f = fixture();
    for (const mode of ['tag', 'woche']) {
      await assert.rejects(f.api[mode](scope), e => e.status === 403 && e.code === 'ZUGRIFF_VERWEIGERT');
    }
    assert.equal(f.reads.length + f.calls.length, 0);
  });
}
test('employee week: NUR_INHABER and zero reads; own day only', async () => {
  const f = fixture({ scope: employee });
  await assert.rejects(f.api.woche(employee), e => e.status === 403 && e.code === 'NUR_INHABER');
  assert.equal(f.reads.length + f.calls.length, 0);
  const dto = await f.api.tag(employee);
  assert.equal(dto.status, 'ok');
  assert.deepEqual(f.reads[0], { version: 1, modus: 'tag', ...employee,
    tage: ['2026-10-27'], jetzt: NOW });
  assert.equal(f.calls[0].userId, E);
});
test('all service parameters reach adapter, original raster and group differences retained', async () => {
  const f = fixture({ kontext: { behandler: [person(T, [service(), service({
    serviceId: G, dauerMin: 20, pufferMin: 10, rasterMin: 10, istGruppe: true,
  })])] }, slots: input => result({ basis: basis(), slots: [{ start: input.serviceId === G ? '10:10' : '10:00',
    gruppenRestplatz: false }] }) });
  const dto = await f.api.tag(owner);
  assert.equal(dto.minimumMin, 20);
  assert.deepEqual(f.calls, [
    { tenantId: T, userId: T, tag: '2026-10-27', businessId: B, serviceId: S,
      dauerMin: 30, pufferMin: 5, rasterMin: 15, jetzt: NOW },
    { tenantId: T, userId: T, tag: '2026-10-27', businessId: B, serviceId: G,
      dauerMin: 20, pufferMin: 10, rasterMin: 10, jetzt: NOW },
  ]);
  assert.equal(dto.luecken[0].freiMin, 30); // overlapping 30 + 20, not 50.
  assert.equal(dto.luecken[0].starts.length, 2);
  assert.deepEqual(dto.luecken[0].intervalle, [{ von: '10:00', bis: '10:30' }]);
});
test('overlapping witnesses and locations union per clinician, buffer excluded', async () => {
  const f = fixture({ kontext: { behandler: [person(T,
    [service(), service({ businessId: C })], [B, C])] },
  slots: p => result({ basis: basis({ businessId: p.businessId }), slots: [
    { start: '10:00', gruppenRestplatz: false }, { start: '10:15', gruppenRestplatz: false },
  ] }) });
  const dto = await f.api.tag(owner);
  assert.equal(dto.luecken.length, 1);
  assert.equal(dto.luecken[0].freiMin, 45);
  assert.equal(dto.luecken[0].starts.length, 4);
});
test('start gate is strict > jetzt+30; no extra raster starts invented', async () => {
  const f = fixture({ slots: result({ slots: ['09:15', '09:30', '09:45'].map(start =>
    ({ start, gruppenRestplatz: false })) }) });
  const dto = await f.api.tag(owner);
  assert.deepEqual(dto.luecken[0].starts.map(s => s.start), ['09:45']);
  assert.equal(dto.luecken[0].freiMin, 30);
});
test('group remainder is service-specific witness, zero free clinician minutes', async () => {
  const f = fixture({ kontext: { behandler: [person(T, [service({ istGruppe: true })])] },
    slots: result({ slots: [{ start: '10:00', gruppenRestplatz: true }], basis: basis({
      buchungen: [{ start: 600, end: 630, gruppenServiceId: S }],
    }) }) });
  const dto = await f.api.tag(owner);
  assert.equal(dto.status, 'ok');
  assert.equal(dto.luecken[0].freiMin, 0);
  assert.deepEqual(dto.luecken[0].intervalle, []);
  assert.equal(dto.luecken[0].starts[0].art, 'gruppenrestplatz');
});
for (const [name, mutate, grund] of [
  ['legacy response', r => { delete r.vollstaendig; }, 'QUELLEN_UNVOLLSTAENDIG'],
  ['DB failure', r => { r.vollstaendig = false; r.gruende = ['raw SQL patient secret']; }, 'QUELLEN_UNVOLLSTAENDIG'],
  ['pagination truncation', r => { r.basis.quellen.buchungen = 'abgeschnitten'; }, 'QUELLEN_UNVOLLSTAENDIG'],
  ['Google missing', r => { r.basis.externStatus = 'verbunden'; }, 'EXTERNE_BELEGUNG_UNBEKANNT'],
  ['Google failed', r => { r.basis.externStatus = 'verbunden'; r.basis.quellen.extern = 'fehler'; }, 'EXTERNE_BELEGUNG_UNBEKANNT'],
  ['missing raw work', r => { delete r.basis.arbeitsintervalle; }, 'INTERVALL_UNGUELTIG'],
  ['reverse work', r => { r.basis.arbeitsintervalle = [{ start: 600, end: 500 }]; }, 'INTERVALL_UNGUELTIG'],
  ['zero blocker', r => { r.basis.sperren = [{ start: 600, end: 600 }]; }, 'INTERVALL_UNGUELTIG'],
  ['reverse blocker', r => { r.basis.sperren = [{ start: 620, end: 600 }]; }, 'INTERVALL_UNGUELTIG'],
  ['invalid external interval', r => { r.basis.externeBelegung = [{ start: NaN, end: 610 }]; }, 'INTERVALL_UNGUELTIG'],
  ['foreign tenant', r => { r.basis.tenantId = X; }, 'SCOPE_UNGUELTIG'],
  ['foreign employee', r => { r.basis.userId = E; }, 'SCOPE_UNGUELTIG'],
  ['wrong location', r => { r.basis.businessId = C; }, 'SCOPE_UNGUELTIG'],
  ['wrong date', r => { r.basis.tag = '2026-10-28'; }, 'SCOPE_UNGUELTIG'],
  ['off-grid', r => { r.slots[0].start = '10:01'; }, 'SLOT_UNGUELTIG'],
  ['out of work', r => { r.slots[0].start = '17:00'; }, 'SLOT_UNGUELTIG'],
  ['buffer overlap', r => { r.basis.sperren = [{ start: 632, end: 640 }]; }, 'SLOT_UNGUELTIG'],
  ['wrong group', r => { r.slots[0].gruppenRestplatz = true; }, 'SLOT_UNGUELTIG'],
  ['HH:mm not attested', r => { r.slots = ['10:00']; }, 'SLOT_UNGUELTIG'],
]) {
  test(`${name}: whole day unknown, no partial values`, async () => {
    const r = result(); mutate(r);
    const f = fixture({ slots: r });
    assert.deepEqual(await f.api.tag(owner), unknownTag(grund));
  });
}
for (const externStatus of ['nicht_konfiguriert', 'aus', 'verbunden']) {
  test(`explicit external status ${externStatus}`, async () => {
    const b = basis({ externStatus });
    if (externStatus === 'verbunden') b.quellen.extern = 'vollstaendig';
    assert.equal((await fixture({ slots: result({ basis: b }) }).api.tag(owner)).status, 'ok');
  });
}
test('one failed service invalidates successful service result', async () => {
  const f = fixture({ kontext: { behandler: [person(T, [service(), service({ serviceId: G })])] },
    slots: p => p.serviceId === S ? result() : { vollstaendig: false } });
  assert.deepEqual(await f.api.tag(owner), unknownTag('QUELLEN_UNVOLLSTAENDIG'));
  assert.equal(f.calls.length, 2);
});
test('source exceptions fixed and scrubbed', async () => {
  const api = createVerfuegbarkeit({ ladeKontext: async () => { throw Error('PII SQL'); }, slotAdapter() {} });
  assert.deepEqual(await api.tag(owner), unknownTag('QUELLE_NICHT_VERFUEGBAR'));
  assert.deepEqual(await api.woche(owner), unknownWeek('QUELLE_NICHT_VERFUEGBAR'));
  const f = fixture({ slots: () => { throw Error('Google patient note'); } });
  assert.deepEqual(await f.api.tag(owner), unknownTag('QUELLE_NICHT_VERFUEGBAR'));
});
test('known empty work and service sets; no invented 30/35-minute minimum', async () => {
  const f = fixture({ slots: result({ slots: [], basis: basis({ arbeitsintervalle: [], rasterUrsprung: null }) }) });
  assert.deepEqual(await f.api.tag(owner), { status: 'ok', grund: 'KEINE_ARBEITSZEIT', luecken: [], minimumMin: 30 });
  const empty = fixture({ kontext: { behandler: [person(T, [])] } });
  assert.deepEqual(await empty.api.tag(owner), { status: 'ok', grund: 'KEINE_LEISTUNGEN', luecken: [], minimumMin: null });
  assert.equal(empty.calls.length, 0);
  const missing = fixture({ kontext: { behandler: [person(T, undefined)] } });
  delete missing.ctx.behandler[0].leistungen;
  assert.deepEqual(await missing.api.tag(owner), unknownTag('KONTEXT_UNGUELTIG'));
});
for (const [name, patch] of [
  ['foreign context tenant', { tenantId: X }],
  ['foreign employee metadata', { behandler: [person(E), person(X)] }],
  ['missing completeness', { vollstaendig: undefined }],
  ['missing service duration', { behandler: [person(E, [service({ dauerMin: null })])] }],
  ['foreign service', { behandler: [person(E, [service({ tenantId: X })])] }],
]) {
  test(`${name} fails closed before slots`, async () => {
    const f = fixture({ scope: employee, kontext: patch });
    assert.equal((await f.api.tag(employee)).status, 'unbekannt');
    assert.equal(f.calls.length, 0);
  });
}
test('normalized inactive/disallowed services excluded; no services.is_active assumption', async () => {
  const f = fixture({ kontext: { behandler: [person(T, [service({ dauerMin: 37 }),
    service({ serviceId: G, aktiv: false, dauerMin: 1 })])] } });
  assert.equal((await f.api.tag(owner)).minimumMin, 37);
  assert.equal(f.calls.length, 1);
});
test('week without full raw basis stays unknown (past cannot be derived from slots)', async () => {
  const f = fixture();
  assert.deepEqual(await f.api.woche(owner), unknownWeek('WOCHENBASIS_FEHLT'));
  assert.equal(f.calls.length, 0);
});
test('week clips, unions overlap/sites/group entries once and includes past Monday', async () => {
  const raw = weekBasis(weekDates, [T], [B, C]);
  for (const b of raw.tage) {
    b.arbeitsintervalle = [{ start: 480, end: 720 }, { start: 600, end: 780 }];
    b.sperren = [{ start: 540, end: 570 }, { start: 550, end: 580 }];
    b.buchungen = [{ start: 450, end: 510, gruppenServiceId: S },
      { start: 450, end: 510, gruppenServiceId: S }, { start: 700, end: 800 }];
  }
  const f = fixture({ kontext: { behandler: [person(T, [service()], [B, C])], wochenbasis: raw } });
  const dto = await f.api.woche(owner);
  assert.deepEqual(dto, { status: 'ok', grund: null, arbeitsMin: 1820, gebuchtMin: 770, quote: 770 / 1820 });
  assert.deepEqual(f.reads[0].tage, weekDates);
  assert.equal(f.calls.length, 0);
});
for (const [name, mutate, grund] of [
  ['missing day', w => w.tage.pop(), 'WOCHENBASIS_FEHLT'],
  ['duplicate day', w => w.tage.push(w.tage[0]), 'WOCHENBASIS_FEHLT'],
  ['truncated', w => { w.vollstaendig = false; }, 'WOCHENBASIS_FEHLT'],
  ['raw missing booking', w => { delete w.tage[0].buchungen; }, 'INTERVALL_UNGUELTIG'],
  ['reverse raw blocker', w => { w.tage[0].sperren = [{ start: 600, end: 500 }]; }, 'INTERVALL_UNGUELTIG'],
  ['foreign metadata', w => { w.tage[0].userId = E; }, 'SCOPE_UNGUELTIG'],
]) {
  test(`week ${name}: no partial week sum`, async () => {
    const w = weekBasis(); mutate(w);
    assert.deepEqual(await fixture({ kontext: { wochenbasis: w } }).api.woche(owner), unknownWeek(grund));
  });
}
test('week empty working time: 0/0, quote null', async () => {
  const w = weekBasis();
  for (const b of w.tage) { b.arbeitsintervalle = []; b.rasterUrsprung = null; }
  assert.deepEqual(await fixture({ kontext: { wochenbasis: w } }).api.woche(owner), {
    status: 'ok', grund: 'KEINE_ARBEITSZEIT', arbeitsMin: 0, gebuchtMin: 0, quote: null,
  });
});
for (const [now, dates] of [
  ['2026-12-31T23:30:00Z', ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']],
  ['2026-11-01T22:59:00Z', weekDates],
  ['2026-10-25T23:30:00Z', weekDates],
]) {
  test(`Berlin Mo–So calendar boundaries ${now}`, async () => {
    const f = fixture({ now, kontext: { wochenbasis: weekBasis(dates) } });
    assert.equal((await f.api.woche(owner)).status, 'ok');
    assert.deepEqual(f.reads[0].tage, dates);
  });
}
for (const now of ['2026-03-29T07:00:00Z', '2026-10-25T08:00:00Z']) {
  test(`DST 23/25-hour minute basis conservative unknown ${now}`, async () => {
    const f = fixture({ now });
    assert.deepEqual(await f.api.tag(owner), unknownTag('ZEITBASIS_UNKLAR'));
    assert.equal(f.calls.length, 0);
  });
}
test('week containing DST and HH:mm cannot claim a full raw week', async () => {
  const dates = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  const f = fixture({ now: '2026-10-24T08:00:00Z', kontext: { wochenbasis: weekBasis(dates) } });
  assert.deepEqual(await f.api.woche(owner), unknownWeek('ZEITBASIS_UNKLAR'));
});
test('DTO allowlist excludes names, notes, money, raw errors and absence reasons', async () => {
  const r = result();
  r.patient_name = r.basis.note = 'DO_NOT_SERIALIZE';
  r.slots[0].patient = 'DO_NOT_SERIALIZE';
  const dto = await fixture({ slots: r }).api.tag(owner);
  assert.equal(dto.status, 'ok');
  assert.deepEqual(Object.keys(dto).sort(), ['grund', 'luecken', 'minimumMin', 'status']);
  assert.doesNotMatch(JSON.stringify(dto), /DO_NOT_SERIALIZE|patient|note|price|betrag|reason/i);
});

test('original engine raster stays anchored at 08:07, never resets after blocker', async () => {
  const f = fixture({ slots: result({ basis: basis({
    rasterUrsprung: 487, arbeitsintervalle: [{ start: 487, end: 1020 }],
    sperren: [{ start: 600, end: 620 }],
  }), slots: [{ start: '10:22', gruppenRestplatz: false }] }) });
  assert.deepEqual((await f.api.tag(owner)).luecken[0].starts.map(s => s.start), ['10:22']);
  const bad = fixture({ slots: result({ basis: basis({
    rasterUrsprung: 487, arbeitsintervalle: [{ start: 487, end: 1020 }],
    sperren: [{ start: 600, end: 620 }],
  }), slots: [{ start: '10:20', gruppenRestplatz: false }] }) });
  assert.deepEqual(await bad.api.tag(owner), unknownTag('SLOT_UNGUELTIG'));
});
test('same clinician, two service observations contradict: no partial value', async () => {
  const f = fixture({ kontext: { behandler: [person(T, [service(), service({ serviceId: G })])] },
    slots: p => result({ basis: basis({ sperren: p.serviceId === S ? [] : [{ start: 900, end: 915 }] }) }) });
  assert.deepEqual(await f.api.tag(owner), unknownTag('QUELLEN_WIDERSPRUCH'));
});
test('owner all permitted clinicians; identical minutes count once per clinician', async () => {
  const f = fixture({ kontext: { behandler: [person(T), person(E)] },
    slots: p => result({ basis: basis({ userId: p.userId }) }) });
  const dto = await f.api.tag(owner);
  assert.deepEqual(dto.luecken.map(p => [p.userId, p.freiMin]), [[T, 30], [E, 30]]);
  assert.deepEqual(f.calls.map(p => p.userId), [T, E]);
});
test('resolved single-practice null location reaches original engine fallback unchanged', async () => {
  const f = fixture({ scope: employee,
    kontext: { behandler: [person(E, [service({ businessId: null })], [null])] },
    slots: p => result({ basis: basis({ userId: E, businessId: p.businessId }) }) });
  assert.equal((await f.api.tag(employee)).status, 'ok');
  assert.equal(f.calls[0].businessId, null);
});
for (const key of ['arbeitszeit', 'sperren', 'buchungen']) {
  for (const problem of ['fehler', 'abgeschnitten', undefined]) {
    test(`explicit ${key} ${problem}: unknown despite empty slots`, async () => {
      const r = result({ slots: [] });
      r.basis.quellen[key] = problem;
      assert.deepEqual(await fixture({ slots: r }).api.tag(owner), unknownTag('QUELLEN_UNVOLLSTAENDIG'));
    });
  }
}
test('connected external busy blocks day, occupies week; external off with busy is contradictory', async () => {
  const b = basis({ externStatus: 'verbunden', externeBelegung: [{ start: 600, end: 615 }] });
  b.quellen.extern = 'vollstaendig';
  assert.deepEqual(await fixture({ slots: result({ basis: b }) }).api.tag(owner), unknownTag('SLOT_UNGUELTIG'));
  const w = weekBasis();
  for (const day of w.tage) {
    day.externStatus = 'verbunden'; day.quellen.extern = 'vollstaendig';
    day.externeBelegung = [{ start: 600, end: 630 }];
    day.buchungen = [{ start: 615, end: 645 }];
  }
  assert.deepEqual(await fixture({ kontext: { wochenbasis: w } }).api.woche(owner), {
    status: 'ok', grund: null, arbeitsMin: 3780, gebuchtMin: 315, quote: 315 / 3780,
  });
  const off = basis({ externeBelegung: [{ start: 600, end: 630 }] });
  assert.deepEqual(await fixture({ slots: result({ basis: off }) }).api.tag(owner), unknownTag('EXTERNE_BELEGUNG_UNBEKANNT'));
});
test('inactive or disallowed services never reach adapter or minimum', async () => {
  const f = fixture({ kontext: { behandler: [person(T, [service({ aktiv: false }),
    service({ serviceId: G, erlaubt: false, dauerMin: 1 })])] } });
  assert.deepEqual(await f.api.tag(owner), { status: 'ok', grund: 'KEINE_LEISTUNGEN', minimumMin: null, luecken: [] });
  assert.equal(f.calls.length, 0);
});
test('zero work interval and reverse booking rejected before measurement', async () => {
  for (const patch of [{ arbeitsintervalle: [{ start: 600, end: 600 }] },
    { buchungen: [{ start: 620, end: 600 }] }]) {
    assert.deepEqual(await fixture({ slots: result({ basis: basis(patch) }) }).api.tag(owner),
      unknownTag('INTERVALL_UNGUELTIG'));
  }
});
test('invalid clock stays unknown before source, authorization still runs first', async () => {
  let reads = 0;
  const api = createVerfuegbarkeit({ jetzt: () => new Date('invalid'),
    ladeKontext: () => { reads++; }, slotAdapter() {} });
  assert.deepEqual(await api.tag(owner), unknownTag('ZEITBASIS_UNKLAR'));
  await assert.rejects(api.tag({}), e => e.status === 403);
  assert.equal(reads, 0);
});
test('raster origin must match raw original working start, not arbitrary midnight', async () => {
  assert.deepEqual(await fixture({ slots: result({ basis: basis({ rasterUrsprung: 0 }) }) }).api.tag(owner),
    unknownTag('INTERVALL_UNGUELTIG'));
});
