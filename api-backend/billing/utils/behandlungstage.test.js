import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrechenbareBehandlungstage, behandlungstageJeDatum, TAGESHOECHSTZAHL } from './behandlungstage.js';

test('Bereit-Zählung: storniert, Befund allein und 78620 zählen nicht; gleicher Tag einmal', () => {
  const n = abrechenbareBehandlungstage([
    { behandlungsdatum: '2026-09-01', hpnr_codes: ['78010'] },
    { behandlungsdatum: '2026-09-01', hpnr_codes: ['78030'] },
    { behandlungsdatum: '2026-09-02', hpnr_codes: ['78030'] },
    { behandlungsdatum: '2026-09-03', hpnr_codes: ['78020'], storniert_am: '2026-09-04' },
    { behandlungsdatum: '2026-09-05', hpnr_codes: ['78620'] },
    { behandlungsdatum: '2026-09-06', hpnr_codes: ['78610', '78620'] },
    { behandlungsdatum: '2026-09-07T10:00:00', hpnr_codes: [' 78020 '] },
  ]);
  assert.equal(n, 3); // 01., 06., 07.
});

test('je Tag: 78010 + 78020 am selben Tag = 2 Behandlungen, 78610 getrennt gezählt', () => {
  const r = behandlungstageJeDatum([
    { d: '2026-09-01', p: '78010' }, { d: '2026-09-01', p: '78020' },
    { d: '2026-09-01', p: '78610', a: 2 }, { d: '2026-09-01', p: '78030' },
  ], x => x.d, x => x.p, x => x.a);
  const b = r.find(x => x.gruppe === 'behandlung');
  const n = r.find(x => x.gruppe === 'nagelspange');
  assert.equal(b.anzahl, 2);
  assert.ok(b.anzahl > TAGESHOECHSTZAHL.behandlung);
  assert.equal(n.anzahl, 2);
  assert.ok(!(n.anzahl > TAGESHOECHSTZAHL.nagelspange));
});
