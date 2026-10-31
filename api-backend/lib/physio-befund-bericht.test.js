import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueBefundBlock, befundBlockZeilen, filtereBefundeFuerVo } from './physio-befund-bericht.js';

test('baueBefundBlock: leere Eingaben', () => {
  assert.equal(baueBefundBlock(), null);
  assert.equal(baueBefundBlock({ befunde: [] }), null);
  assert.equal(baueBefundBlock({ befunde: [{ ist_aktuell: false }] }), null);
  assert.deepEqual(befundBlockZeilen(null), []);
  assert.deepEqual(befundBlockZeilen({}), []);
  assert.deepEqual(befundBlockZeilen({ erst: null }), []);
});

test('baueBefundBlock: Einzelbefund (Erstbefund ohne Folge-Befund)', () => {
  const befunde = [
    {
      id: 'bef-1',
      befundart: 'erst',
      befund_datum: '2026-09-01',
      ist_aktuell: true,
      created_at: '2026-09-01T10:00:00Z',
      daten: {
        bericht: {
          regionen: ['HWS', 'Schulter'],
          positive_tests: [{ region: 'HWS', test: 'Spurling', seite: 'rechts' }],
          adl: ['Sitzen', 'Schlafen'],
          massnahmen: ['Manuelle Therapie', 'Wärmetherapie'],
          ziele: [{ text: 'Schmerzreduktion', erreicht: 'teilweise' }],
          verlauf: null,
          empfehlung: { folge_vo: 'ja', eigentraining: true },
        },
      },
    },
  ];

  const messungen = [
    { befund_id: 'bef-1', typ: 'VAS', koerperteil: 'HWS', wert: 7 },
    { befund_id: 'bef-1', typ: 'ROM', koerperteil: 'HWS Rotation', seite: 'rechts', wert: 45 },
    { befund_id: 'bef-1', typ: 'kraft', koerperteil: 'Trapezius', seite: 'rechts', wert: 4 },
  ];

  const block = baueBefundBlock({ befunde, messungen });
  assert.ok(block);
  assert.equal(block.erst.datum, '2026-09-01');
  assert.deepEqual(block.erst.regionen, ['HWS', 'Schulter']);
  assert.deepEqual(block.erst.nrs, { HWS: 7 });
  assert.deepEqual(block.erst.rom, [{ label: 'HWS Rotation', seite: 'rechts', wert: 45 }]);
  assert.deepEqual(block.erst.mft, [{ label: 'Trapezius', seite: 'rechts', wert: 4 }]);
  assert.deepEqual(block.erst.positive_tests, [{ region: 'HWS', test: 'Spurling', seite: 'rechts' }]);
  assert.deepEqual(block.erst.adl, ['Sitzen', 'Schlafen']);
  assert.deepEqual(block.erst.ziele, [{ text: 'Schmerzreduktion', erreicht: 'teilweise' }]);

  assert.equal(block.aktuell, null);
  assert.deepEqual(block.veraenderungen, []);
  assert.deepEqual(block.massnahmen, ['Manuelle Therapie', 'Wärmetherapie']);
  assert.deepEqual(block.empfehlung, { folge_vo: 'ja', eigentraining: true });
  assert.equal(block.verlauf, null);

  const zeilen = befundBlockZeilen(block);
  assert.ok(zeilen.includes('Schmerz (NRS) HWS: 7'));
  assert.ok(zeilen.includes('ROM HWS Rotation rechts: 45°'));
  assert.ok(zeilen.includes('Kraft (MFT) Trapezius (rechts): 4'));
  assert.ok(zeilen.includes('Pos. Tests: Spurling (rechts)'));
  assert.ok(zeilen.includes('ADL: Sitzen, Schlafen'));
  assert.ok(zeilen.includes('Ziele: Schmerzreduktion (erreicht: teilweise)'));
  assert.ok(zeilen.includes('Massnahmen: Manuelle Therapie, Wärmetherapie'));
  assert.ok(zeilen.includes('Empfehlung: Folge-Verordnung: ja; Eigentraining'));
});

test('baueBefundBlock: Zwei Befunde mit Veränderungen', () => {
  const befunde = [
    {
      id: 'bef-erst',
      befundart: 'erst',
      befund_datum: '2026-09-01',
      ist_aktuell: true,
      created_at: '2026-09-01T09:00:00Z',
      daten: {
        bericht: {
          regionen: ['HWS'],
          positive_tests: [{ region: 'HWS', test: 'Spurling', seite: 'rechts' }],
          adl: ['Sitzen am PC'],
          massnahmen: ['MT'],
          ziele: [{ text: 'Schmerzreduktion auf NRS <= 3', erreicht: null }],
          empfehlung: { folge_vo: null, eigentraining: false },
        },
      },
    },
    {
      id: 'bef-abschluss',
      befundart: 'abschluss',
      befund_datum: '2026-10-15',
      ist_aktuell: true,
      created_at: '2026-10-15T11:00:00Z',
      daten: {
        bericht: {
          regionen: ['HWS'],
          positive_tests: [],
          adl: ['Sitzen am PC beschwerdefrei'],
          massnahmen: ['MT', 'KGG'],
          ziele: [{ text: 'Schmerzreduktion auf NRS <= 3', erreicht: 'ja' }],
          verlauf: 'besser',
          empfehlung: { folge_vo: 'nein', eigentraining: true },
        },
      },
    },
  ];

  const messungen = [
    // Erstbefund
    { befund_id: 'bef-erst', typ: 'VAS', koerperteil: 'HWS', wert: 7 },
    { befund_id: 'bef-erst', typ: 'ROM', koerperteil: 'Schulter Flexion', seite: 'links', wert: 90 },
    { befund_id: 'bef-erst', typ: 'kraft', koerperteil: 'Trapezius', seite: 'links', wert: 3 },
    { befund_id: 'bef-erst', typ: 'kraft', koerperteil: 'Deltoideus', seite: 'links', wert: 4 },

    // Abschlussbefund
    { befund_id: 'bef-abschluss', typ: 'VAS', koerperteil: 'HWS', wert: 3 },
    { befund_id: 'bef-abschluss', typ: 'ROM', koerperteil: 'Schulter Flexion', seite: 'links', wert: 140 },
    { befund_id: 'bef-abschluss', typ: 'kraft', koerperteil: 'Trapezius', seite: 'links', wert: 5 },
    // Deltoideus unveraendert (4 -> 4)
    { befund_id: 'bef-abschluss', typ: 'kraft', koerperteil: 'Deltoideus', seite: 'links', wert: 4 },
  ];

  const block = baueBefundBlock({ befunde, messungen });
  assert.ok(block);
  assert.equal(block.erst.datum, '2026-09-01');
  assert.equal(block.aktuell.datum, '2026-10-15');
  assert.equal(block.verlauf, 'besser');
  assert.deepEqual(block.massnahmen, ['MT', 'KGG']);
  assert.deepEqual(block.empfehlung, { folge_vo: 'nein', eigentraining: true });

  // Deltoideus unveraendert, darf NICHT in veraenderungen sein
  assert.equal(block.veraenderungen.length, 3);
  assert.deepEqual(block.veraenderungen[0], {
    art: 'nrs',
    label: 'HWS',
    seite: null,
    vorher: 7,
    jetzt: 3,
  });
  assert.deepEqual(block.veraenderungen[1], {
    art: 'rom',
    label: 'Schulter Flexion',
    seite: 'links',
    vorher: 90,
    jetzt: 140,
  });
  assert.deepEqual(block.veraenderungen[2], {
    art: 'mft',
    label: 'Trapezius',
    seite: 'links',
    vorher: 3,
    jetzt: 5,
  });

  const zeilen = befundBlockZeilen(block);
  assert.ok(zeilen.includes('Schmerz (NRS) HWS: 7 -> 3'));
  assert.ok(zeilen.includes('ROM Schulter Flexion links: 90° -> 140°'));
  assert.ok(zeilen.includes('Kraft (MFT) Trapezius (links): 3 -> 5'));
  // Unveränderter Deltoideus taucht als Einzelwert auf
  assert.ok(zeilen.includes('Kraft (MFT) Deltoideus (links): 4'));
  assert.ok(zeilen.includes('ADL: Sitzen am PC beschwerdefrei'));
  assert.ok(zeilen.includes('Ziele: Schmerzreduktion auf NRS <= 3 (erreicht: ja)'));
  assert.ok(zeilen.includes('Verlauf: besser'));
  assert.ok(zeilen.includes('Massnahmen: MT, KGG'));
  assert.ok(zeilen.includes('Empfehlung: Folge-Verordnung: nein; Eigentraining'));
});

test('NRS mit Seite rechts: genau eine NRS-Zeile pro Region/Seite (keine Doppelausgabe)', () => {
  const befunde = [
    {
      id: 'bef-1',
      befundart: 'erst',
      befund_datum: '2026-09-01',
      ist_aktuell: true,
      created_at: '2026-09-01T08:00:00Z',
      daten: { bericht: { regionen: ['HWS'] } },
    },
    {
      id: 'bef-2',
      befundart: 'abschluss',
      befund_datum: '2026-10-01',
      ist_aktuell: true,
      created_at: '2026-10-01T08:00:00Z',
      daten: { bericht: { regionen: ['HWS'], verlauf: 'besser' } },
    },
  ];
  const messungen = [
    { befund_id: 'bef-1', typ: 'VAS', koerperteil: 'HWS', seite: 'rechts', wert: 7 },
    { befund_id: 'bef-2', typ: 'VAS', koerperteil: 'HWS', seite: 'rechts', wert: 3 },
  ];

  const block = baueBefundBlock({ befunde, messungen });
  const zeilen = befundBlockZeilen(block);

  const nrsZeilen = zeilen.filter(z => z.startsWith('Schmerz (NRS)'));
  assert.equal(nrsZeilen.length, 1);
  assert.equal(nrsZeilen[0], 'Schmerz (NRS) HWS (rechts): 7 -> 3');
});

test('filtereBefundeFuerVo / Bevorzugung aktueller Verordnung', () => {
  const bVo1 = { id: 'b1', prescription_id: 'rx-1', befund_datum: '2026-09-01', ist_aktuell: true };
  const bVo2 = { id: 'b2', prescription_id: 'rx-2', befund_datum: '2026-09-15', ist_aktuell: true };
  const bNull = { id: 'b3', prescription_id: null, befund_datum: '2026-09-20', ist_aktuell: true };

  // 1. Wenn passende Befunde mit prescription_id === rx.id existieren: NUR diese
  const r1 = filtereBefundeFuerVo([bVo1, bVo2, bNull], 'rx-1');
  assert.deepEqual(r1.map(b => b.id), ['b1']);

  // 2. Wenn keine passenden existieren: Fallback auf prescription_id == null
  const r2 = filtereBefundeFuerVo([bVo2, bNull], 'rx-1');
  assert.deepEqual(r2.map(b => b.id), ['b3']);

  // 3. Befunde mit anderer prescription_id nie
  const r3 = filtereBefundeFuerVo([bVo2], 'rx-1');
  assert.deepEqual(r3, []);

  // 4. baueBefundBlock mit prescriptionId liefert nur Befunde der aktuellen VO
  const block = baueBefundBlock({
    befunde: [
      { id: 'b1', prescription_id: 'rx-1', befundart: 'erst', befund_datum: '2026-09-01', ist_aktuell: true, daten: { bericht: { regionen: ['HWS'] } } },
      { id: 'b2', prescription_id: 'rx-fremd', befundart: 'erst', befund_datum: '2026-08-01', ist_aktuell: true, daten: { bericht: { regionen: ['LWS'] } } },
    ],
    messungen: [
      { befund_id: 'b1', typ: 'VAS', koerperteil: 'HWS', wert: 6 },
      { befund_id: 'b2', typ: 'VAS', koerperteil: 'LWS', wert: 9 },
    ],
    prescriptionId: 'rx-1',
  });
  assert.ok(block);
  assert.deepEqual(block.erst.regionen, ['HWS']);
  assert.deepEqual(block.erst.nrs, { HWS: 6 });
});
