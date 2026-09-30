import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDtaFile } from './builder.js';
import { podoFixture } from './fixtures.js';
import { segmenteTrennen } from './preflight.js';

const segmente = (inhalt) => segmenteTrennen(inhalt);
const finde    = (inhalt, tag) => segmente(inhalt).filter(s => s.startsWith(tag + '+'));

test('builder: eine Verordnung mit icd10Liste ["M17.1R", "E11.40†"] erzeugt DIA-Werte M17.1 und E11.40', () => {
  const basis = structuredClone(podoFixture);
  basis.prescriptions[0].verordnung.icd10Liste = ['M17.1R', 'E11.40†'];
  basis.prescriptions[0].verordnung.diagnosetext = '';
  const r = buildDtaFile(basis);
  const dia = finde(r.content, 'DIA');
  assert.equal(dia.length, 2);
  assert.equal(dia[0], 'DIA+M17.1');
  assert.equal(dia[1], 'DIA+E11.40');
  assert.ok(!r.content.includes('M17.1R'), 'Zusatz R darf nicht im DTA-Datenstrom vorkommen');
  assert.ok(!r.content.includes('E11.40†'), 'Sonderzeichen † darf nicht im DTA-Datenstrom vorkommen');
});
