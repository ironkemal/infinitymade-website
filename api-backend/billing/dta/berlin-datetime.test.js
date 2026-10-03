// Tests for Europe/Berlin DST-safe date and time formatting in §302 DTA files.
// Covers fmtDate, buildUNB, buildAuftragsdatei, buildDtaFile, and process TZ matrix.
// node --test api-backend/billing/dta/berlin-datetime.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { fmtDate } from './encoding.js';
import { buildUNB } from './envelope.js';
import { buildAuftragsdatei } from './auftragsdatei.js';
import { buildDtaFile } from './builder.js';
import { physioFixture, podoFixture } from './fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_AUFTRAG = {
  absenderIk:          '123456789',
  empfaengerIk:        '987654321',
  logischerDateiname:  'SL345678S05',
  transfernummer:      7,
  nutzdateiByteLength: 1234,
  kind:                'echt',
};

const BASE_UNB = {
  absenderIk:         '123456789',
  empfaengerIk:       '987654321',
  datennummer:        7,
  leistungsbereich:   'B',
  anwendungsreferenz: 'SL345678S05',
  testIndikator:      '2',
};

// ---------------------------------------------------------------------------
// 1. fmtDate tests
// ---------------------------------------------------------------------------

test('fmtDate: genuine YYYY-MM-DD calendar strings remain unchanged day', () => {
  assert.equal(fmtDate('2026-05-18'), '20260518');
  assert.equal(fmtDate('2026-01-01'), '20260101');
  assert.equal(fmtDate('2024-02-29'), '20240229'); // Schaltjahr
});

test('fmtDate: rejects nonexistent dateonly instead of normalizing', () => {
  assert.equal(fmtDate('2026-02-31'), ''); // kein 03. März
  assert.equal(fmtDate('2026-04-31'), ''); // kein 01. Mai
  assert.equal(fmtDate('2026-02-29'), ''); // kein Schaltjahr
  assert.equal(fmtDate('2026-13-01'), '');
  assert.equal(fmtDate('2026-00-10'), '');
});

test('fmtDate: preserves existing falsy and invalid behavior', () => {
  assert.equal(fmtDate(null), '');
  assert.equal(fmtDate(undefined), '');
  assert.equal(fmtDate(''), '');
  assert.equal(fmtDate(false), '');
  assert.equal(fmtDate('not-a-date'), '');
  assert.equal(fmtDate(new Date(NaN)), '');
});

test('fmtDate: winter midnight 2026-01-15T23:30Z -> 20260116', () => {
  assert.equal(fmtDate('2026-01-15T23:30:00Z'), '20260116');
  assert.equal(fmtDate(new Date('2026-01-15T23:30:00Z')), '20260116');
});

test('fmtDate: summer midnight 2026-07-15T22:30Z -> 20260716', () => {
  assert.equal(fmtDate('2026-07-15T22:30:00Z'), '20260716');
  assert.equal(fmtDate(new Date('2026-07-15T22:30:00Z')), '20260716');
});

test('fmtDate: year boundary 2026-12-31T23:30Z -> 20270101', () => {
  assert.equal(fmtDate('2026-12-31T23:30:00Z'), '20270101');
  assert.equal(fmtDate(new Date('2026-12-31T23:30:00Z')), '20270101');
});

test('fmtDate: spring DST 2026-03-29T00:59:59Z and 01:00Z', () => {
  assert.equal(fmtDate('2026-03-29T00:59:59Z'), '20260329');
  assert.equal(fmtDate('2026-03-29T01:00:00Z'), '20260329');
});

test('fmtDate: fall DST 2026-10-25T00:59:59Z and 01:00Z', () => {
  assert.equal(fmtDate('2026-10-25T00:59:59Z'), '20261025');
  assert.equal(fmtDate('2026-10-25T01:00:00Z'), '20261025');
});

// ---------------------------------------------------------------------------
// 2. buildUNB tests
// ---------------------------------------------------------------------------

test('buildUNB: genuine dateonly creation input uses Berlin midnight 00:00 and preserves calendar day', () => {
  const unb = buildUNB({ ...BASE_UNB, erstellungsdatum: '2026-05-18' });
  assert.ok(unb.includes('+20260518:0000+'), `Expected 20260518:0000 in UNB, got: ${unb}`);
});

test('buildUNB: rejects nonexistent dateonly with controlled error', () => {
  assert.throws(
    () => buildUNB({ ...BASE_UNB, erstellungsdatum: '2026-02-31' }),
    /invalid erstellungsdatum/
  );
});

test('buildUNB: invalid/falsy erstellungsdatum throws controlled error', () => {
  assert.throws(() => buildUNB({ ...BASE_UNB, erstellungsdatum: null }), /invalid erstellungsdatum/);
  assert.throws(() => buildUNB({ ...BASE_UNB, erstellungsdatum: '' }), /invalid erstellungsdatum/);
  assert.throws(() => buildUNB({ ...BASE_UNB, erstellungsdatum: 'invalid' }), /invalid erstellungsdatum/);
});

test('buildUNB: winter midnight 2026-01-15T23:30Z -> 20260116 00:30', () => {
  const unb = buildUNB({ ...BASE_UNB, erstellungsdatum: '2026-01-15T23:30:00Z' });
  assert.ok(unb.includes('+20260116:0030+'), unb);
});

test('buildUNB: summer midnight 2026-07-15T22:30Z -> 20260716 00:30', () => {
  const unb = buildUNB({ ...BASE_UNB, erstellungsdatum: '2026-07-15T22:30:00Z' });
  assert.ok(unb.includes('+20260716:0030+'), unb);
});

test('buildUNB: year boundary 2026-12-31T23:30Z -> 20270101 00:30', () => {
  const unb = buildUNB({ ...BASE_UNB, erstellungsdatum: '2026-12-31T23:30:00Z' });
  assert.ok(unb.includes('+20270101:0030+'), unb);
});

test('buildUNB: spring DST 2026-03-29T00:59:59Z -> 01:59 and 01:00Z -> 03:00', () => {
  const unb1 = buildUNB({ ...BASE_UNB, erstellungsdatum: '2026-03-29T00:59:59Z' });
  assert.ok(unb1.includes('+20260329:0159+'), unb1);

  const unb2 = buildUNB({ ...BASE_UNB, erstellungsdatum: '2026-03-29T01:00:00Z' });
  assert.ok(unb2.includes('+20260329:0300+'), unb2);
});

test('buildUNB: fall DST 2026-10-25T00:59:59Z -> 02:59 and 01:00Z -> 02:00', () => {
  const unb1 = buildUNB({ ...BASE_UNB, erstellungsdatum: '2026-10-25T00:59:59Z' });
  assert.ok(unb1.includes('+20261025:0259+'), unb1);

  const unb2 = buildUNB({ ...BASE_UNB, erstellungsdatum: '2026-10-25T01:00:00Z' });
  assert.ok(unb2.includes('+20261025:0200+'), unb2);
});

// ---------------------------------------------------------------------------
// 3. buildAuftragsdatei (length 348, fields 116-129 YYYYMMDDhhmmss)
// ---------------------------------------------------------------------------

const feld = (satz, von, bis) => satz.slice(von - 1, bis);

test('buildAuftragsdatei: genuine dateonly preserves calendar day with Berlin midnight 00:00:00', () => {
  const satz = buildAuftragsdatei({ ...BASE_AUFTRAG, erstellungsdatum: '2026-05-18' });
  assert.equal(satz.length, 348);
  assert.equal(feld(satz, 116, 129), '20260518000000');
});

test('buildAuftragsdatei: rejects nonexistent dateonly', () => {
  assert.throws(
    () => buildAuftragsdatei({ ...BASE_AUFTRAG, erstellungsdatum: '2026-02-31' }),
    /invalid erstellungsdatum/
  );
});

test('buildAuftragsdatei: winter midnight 2026-01-15T23:30:15Z -> 20260116 00:30:15', () => {
  const satz = buildAuftragsdatei({ ...BASE_AUFTRAG, erstellungsdatum: '2026-01-15T23:30:15Z' });
  assert.equal(satz.length, 348);
  assert.equal(feld(satz, 116, 129), '20260116003015');
});

test('buildAuftragsdatei: summer midnight 2026-07-15T22:30:45Z -> 20260716 00:30:45', () => {
  const satz = buildAuftragsdatei({ ...BASE_AUFTRAG, erstellungsdatum: '2026-07-15T22:30:45Z' });
  assert.equal(satz.length, 348);
  assert.equal(feld(satz, 116, 129), '20260716003045');
});

test('buildAuftragsdatei: year boundary 2026-12-31T23:30:00Z -> 20270101 00:30:00', () => {
  const satz = buildAuftragsdatei({ ...BASE_AUFTRAG, erstellungsdatum: '2026-12-31T23:30:00Z' });
  assert.equal(satz.length, 348);
  assert.equal(feld(satz, 116, 129), '20270101003000');
});

test('buildAuftragsdatei: spring DST 2026-03-29T00:59:59Z -> 01:59:59 and 01:00:00Z -> 03:00:00', () => {
  const satz1 = buildAuftragsdatei({ ...BASE_AUFTRAG, erstellungsdatum: '2026-03-29T00:59:59Z' });
  assert.equal(satz1.length, 348);
  assert.equal(feld(satz1, 116, 129), '20260329015959');

  const satz2 = buildAuftragsdatei({ ...BASE_AUFTRAG, erstellungsdatum: '2026-03-29T01:00:00Z' });
  assert.equal(satz2.length, 348);
  assert.equal(feld(satz2, 116, 129), '20260329030000');
});

test('buildAuftragsdatei: fall DST 2026-10-25T00:59:59Z -> 02:59:59 and 01:00:00Z -> 02:00:00', () => {
  const satz1 = buildAuftragsdatei({ ...BASE_AUFTRAG, erstellungsdatum: '2026-10-25T00:59:59Z' });
  assert.equal(satz1.length, 348);
  assert.equal(feld(satz1, 116, 129), '20261025025959');

  const satz2 = buildAuftragsdatei({ ...BASE_AUFTRAG, erstellungsdatum: '2026-10-25T01:00:00Z' });
  assert.equal(satz2.length, 348);
  assert.equal(feld(satz2, 116, 129), '20261025020000');
});

// ---------------------------------------------------------------------------
// 4. buildDtaFile with synthetic existing fixtures
// ---------------------------------------------------------------------------

test('buildDtaFile: physioFixture preserves dateonly and non-03 output', () => {
  const dta = buildDtaFile(physioFixture);
  assert.ok(dta.content.startsWith("UNB+UNOC:3+123456789+987654321+20260518:0000+00023+B+SL345678S05+2'"));
  assert.equal(dta.auftragsdatei.length, 348);
  assert.equal(feld(dta.auftragsdatei, 116, 129), '20260518000000');
  // Unrelated non-03 (VKZ 01) output checks
  assert.ok(dta.content.includes("FKT+01++123456789+101000000+101000000'"));
  assert.ok(dta.content.includes("BES+135,00+23,50+13,50+10,00'"));
});

test('buildDtaFile: podoFixture preserves dateonly and non-03 output', () => {
  const dta = buildDtaFile(podoFixture);
  assert.ok(dta.content.startsWith("UNB+UNOC:3+123456789+987654321+20260828:0000+00024+B+SL345678S08+2'"));
  assert.equal(dta.auftragsdatei.length, 348);
  assert.equal(feld(dta.auftragsdatei, 116, 129), '20260828000000');
});

test('buildDtaFile: timestamp input uses Berlin DST in both UNB and Auftragsdatei', () => {
  const f = structuredClone(physioFixture);
  f.rechnung.datum = '2026-01-15T23:30:15Z';
  const dta = buildDtaFile(f);
  assert.ok(dta.content.includes("+20260116:0030+"), 'UNB carries 20260116:0030');
  assert.equal(dta.auftragsdatei.length, 348);
  assert.equal(feld(dta.auftragsdatei, 116, 129), '20260116003015');
});

// ---------------------------------------------------------------------------
// 5. Process TZ independence child process matrix
// ---------------------------------------------------------------------------

test('process TZ independence: matrix UTC / America/Los_Angeles / Asia/Tokyo / Europe/Berlin', () => {
  const runnerScript = `
    import { fmtDate } from './api-backend/billing/dta/encoding.js';
    import { buildUNB } from './api-backend/billing/dta/envelope.js';
    import { buildAuftragsdatei } from './api-backend/billing/dta/auftragsdatei.js';

    const res = {
      fmtDateDateonly: fmtDate('2026-05-18'),
      fmtDateWinter: fmtDate('2026-01-15T23:30:00Z'),
      fmtDateSummer: fmtDate('2026-07-15T22:30:00Z'),
      unbWinter: buildUNB({
        absenderIk: '123456789', empfaengerIk: '987654321', datennummer: 1,
        erstellungsdatum: '2026-01-15T23:30:00Z'
      }),
      auftragSummer: buildAuftragsdatei({
        absenderIk: '123456789', empfaengerIk: '987654321', logischerDateiname: 'SL345678S05',
        transfernummer: 1, nutzdateiByteLength: 100, erstellungsdatum: '2026-07-15T22:30:45Z'
      }).slice(115, 129),
      auftragDateonly: buildAuftragsdatei({
        absenderIk: '123456789', empfaengerIk: '987654321', logischerDateiname: 'SL345678S05',
        transfernummer: 1, nutzdateiByteLength: 100, erstellungsdatum: '2026-05-18'
      }).slice(115, 129)
    };
    process.stdout.write(JSON.stringify(res));
  `;

  const timezones = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Europe/Berlin'];
  let baseline = null;

  for (const tz of timezones) {
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', runnerScript], {
      cwd: join(__dirname, '../../..'),
      env: { ...process.env, TZ: tz },
      encoding: 'utf8',
    });
    const result = JSON.parse(stdout);

    assert.equal(result.fmtDateDateonly, '20260518', `TZ=${tz} fmtDateDateonly mismatch`);
    assert.equal(result.fmtDateWinter, '20260116', `TZ=${tz} fmtDateWinter mismatch`);
    assert.equal(result.fmtDateSummer, '20260716', `TZ=${tz} fmtDateSummer mismatch`);
    assert.ok(result.unbWinter.includes('+20260116:0030+'), `TZ=${tz} unbWinter mismatch`);
    assert.equal(result.auftragSummer, '20260716003045', `TZ=${tz} auftragSummer mismatch`);
    assert.equal(result.auftragDateonly, '20260518000000', `TZ=${tz} auftragDateonly mismatch`);

    if (!baseline) {
      baseline = stdout;
    } else {
      assert.equal(stdout, baseline, `Output under TZ=${tz} differed from baseline`);
    }
  }
});
