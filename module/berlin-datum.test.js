import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const urls = {
  helper: new URL('./berlin-datum.js', import.meta.url).href,
  oeffnen: new URL('./podo-behandlungen-oeffnen.js', import.meta.url).href,
  geplant: new URL('./podo-geplant.js', import.meta.url).href,
  fristen: new URL('./heilmittel-fristen.js', import.meta.url).href,
  heute: new URL('./termin-heute.js', import.meta.url).href,
  einheiten: new URL('./podo-einheiten.js', import.meta.url).href,
};

async function childRunner(urls) {
  const { alsBerlinDatum, berlinTagesgrenzen } = await import(urls.helper);
  const { terminDatum } = await import(urls.oeffnen);
  const { geplanteAlsBehandlungen } = await import(urls.geplant);
  const { pruefeBehandlungsbeginn } = await import(urls.fristen);
  const { tagesgrenzen, heuteAktualisieren, terminZuLead } = await import(urls.heute);

  // 1. alsBerlinDatum basic & boundary shifts (accepted Gregorian range 0001–9999 explicit)
  assert.equal(alsBerlinDatum('2026-10-03T22:30:00Z'), '2026-10-04');
  assert.equal(alsBerlinDatum('2026-12-01T23:30:00Z'), '2026-12-02');
  assert.equal(alsBerlinDatum('2026-10-04'), '2026-10-04');
  assert.equal(alsBerlinDatum('2026-02-29'), '');
  assert.equal(alsBerlinDatum(''), '');
  assert.equal(alsBerlinDatum('2026-10-04T12:00:00'), '');
  assert.equal(alsBerlinDatum(0), '1970-01-01');
  assert.equal(alsBerlinDatum('0000-01-01'), '');
  assert.equal(alsBerlinDatum('0040-02-29'), '0040-02-29');
  assert.equal(alsBerlinDatum('9999-12-31T23:30:00Z'), '');

  // 2. berlinTagesgrenzen DST
  const s23 = berlinTagesgrenzen('2026-03-29');
  assert.equal(Date.parse(s23.bisExklusiv) - Date.parse(s23.von), 23 * 3600 * 1000);
  const w25 = berlinTagesgrenzen('2026-10-25');
  assert.equal(Date.parse(w25.bisExklusiv) - Date.parse(w25.von), 25 * 3600 * 1000);
  assert.equal(berlinTagesgrenzen('0000-01-01'), null);
  assert.ok(berlinTagesgrenzen('0040-02-29')?.von.startsWith('0040'));

  // 3. terminDatum
  assert.equal(terminDatum({ start_time: '2026-10-03T22:30:00Z' }), '2026-10-04');
  assert.equal(terminDatum({ start_time: '2026-12-01T23:30:00Z' }), '2026-12-02');
  assert.equal(terminDatum({ start_time: '2026-10-04' }), '2026-10-04');
  assert.equal(terminDatum({ start_time: '2026-02-29' }), undefined);
  assert.equal(terminDatum({ start_time: '' }), undefined);
  assert.equal(terminDatum({ start_time: '2026-10-04T12:00:00' }), undefined);
  assert.equal(terminDatum({ start_time: 0 }), undefined);

  // 4. geplanteAlsBehandlungen
  const bookings = [
    { id: 'b1', status: 'confirmed', start_time: '2026-10-03T22:30:00Z', services: { gkv_position_nr: '78010' } },
    { id: 'b2', status: 'confirmed', start_time: '2026-12-01T23:30:00Z', services: { gkv_position_nr: '78010' } },
    { id: 'b3', status: 'confirmed', start_time: '2026-10-04', services: { gkv_position_nr: '78010' } },
    { id: 'own', status: 'confirmed', start_time: '2026-10-04', services: { gkv_position_nr: '78010' } },
    { id: 'b5', status: 'cancelled', start_time: '2026-10-04', services: { gkv_position_nr: '78010' } },
    { id: 'b6', status: 'confirmed', start_time: '2026-02-29', services: { gkv_position_nr: '78010' } },
    { id: 'b7', status: 'confirmed', start_time: '2026-10-04', services: { gkv_position_nr: '99999' } },
  ];
  const geplante = geplanteAlsBehandlungen(bookings, { ohneId: 'own' });
  assert.deepEqual(geplante.map(g => g.behandlungsdatum), ['2026-10-04', '2026-12-02', '2026-10-04']);
  assert.equal(geplante[0].geplant, true);

  // 5. pruefeBehandlungsbeginn
  assert.equal(pruefeBehandlungsbeginn({ ausstellungsdatum: '2026-11-01', ersterTermin: '2026-11-29', istDringend: false }).ok, true);
  assert.equal(pruefeBehandlungsbeginn({ ausstellungsdatum: '2026-11-01', ersterTermin: '2026-11-30', istDringend: false }).ok, false);

  // 6. tagesgrenzen, heuteAktualisieren, terminZuLead
  const tg = tagesgrenzen(new Date('2026-10-25T12:00:00Z'));
  assert.equal(tg.tag, '2026-10-25');
  assert.equal(tagesgrenzen(new Date(NaN)), null);
  const lastMsISO = new Date(Date.parse(tg.bisExklusiv) - 1).toISOString();
  const rows = [
    { lead_id: 'a', start_time: '2026-10-25T00:30:00.000Z' },
    { lead_id: 'b', start_time: '2026-10-25T01:30:00.000Z' },
    { lead_id: 'c', start_time: lastMsISO },
    { lead_id: 'd', start_time: tg.bisExklusiv },
  ];
  let queryCount = 0;
  const fakeSB = {
    from() {
      return {
        _gte: null, _lt: null,
        select() { return this; }, eq() { return this; }, neq() { return this; },
        gte(c, v) { this._gte = v; return this; },
        lt(c, v) { this._lt = v; return this; },
        then(onRes) {
          queryCount++;
          const data = rows.filter(r => r.start_time >= this._gte && r.start_time < this._lt);
          return Promise.resolve({ data, error: null }).then(onRes);
        }
      };
    }
  };
  const index = await heuteAktualisieren(fakeSB, 'owner', new Date('2026-10-25T12:00:00Z'));
  assert.equal(queryCount, 1);
  assert.equal(terminZuLead(index, { id: 'a' }), '2026-10-25T00:30:00.000Z');
  assert.equal(terminZuLead(index, { id: 'b' }), '2026-10-25T01:30:00.000Z');
  assert.equal(terminZuLead(index, { id: 'c' }), lastMsISO);
  assert.equal(terminZuLead(index, { id: 'd' }), null);
  const prevCount = queryCount;
  const fallbackIndex = await heuteAktualisieren(fakeSB, 'owner', new Date(NaN), index);
  assert.equal(queryCount, prevCount, 'invalidDate must make no DB query');
  assert.equal(fallbackIndex, index);

  // 7. FixedDate for private heute probe
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length === 0 ? ['2026-10-03T22:30:00Z'] : args)); }
    static now() { return Date.parse('2026-10-03T22:30:00Z'); }
  }

  // 8. podo-einheiten.js private heute
  const einheitenSrc = fs.readFileSync(new URL(urls.einheiten), 'utf8');
  const line = einheitenSrc.split('\n').find(l => l.startsWith('const heute ='));
  assert.ok(line, 'must find const heute in podo-einheiten.js');
  const resHeute = vm.runInNewContext(line + '\nheute()', { alsBerlinDatum, Date: FixedDate });
  assert.equal(resHeute, '2026-10-04');
}

const SCRIPT = `import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
const run = ${childRunner.toString()};
await run(${JSON.stringify(urls)});`;

for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Europe/Berlin']) {
  test(`invariants in TZ=${tz}`, () => {
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', SCRIPT], {
      env: { ...process.env, TZ: tz }, timeout: 10000, maxBuffer: 1000000, encoding: 'utf8',
    });
    assert.equal(res.status, 0, `Failed in TZ=${tz}:\n${res.stderr}`);
  });
}