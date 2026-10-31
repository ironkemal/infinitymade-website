import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alleUnterschrieben,
  baueSignierBody,
} from './formular-unterschreiben.js';

test('alleUnterschrieben: liefert true nur wenn alle Felder eine Signatur besitzen', () => {
  const felder = [
    { seite: 1, x: 10, y: 10, w: 20, h: 20 },
    { seite: 1, x: 50, y: 50, w: 20, h: 20 },
  ];

  // Vollständig (Array)
  assert.equal(alleUnterschrieben(felder, ['data:image/png;base64,AAA', 'data:image/png;base64,BBB']), true);

  // Unvollständig (Array mit null / leer)
  assert.equal(alleUnterschrieben(felder, ['data:image/png;base64,AAA', null]), false);
  assert.equal(alleUnterschrieben(felder, ['data:image/png;base64,AAA', '   ']), false);
  assert.equal(alleUnterschrieben(felder, ['data:image/png;base64,AAA']), false);

  // Vollständig (Map / Objekt)
  assert.equal(alleUnterschrieben(felder, { 0: 'sig0', 1: 'sig1' }), true);

  // Unvollständig (Map / Objekt)
  assert.equal(alleUnterschrieben(felder, { 0: 'sig0' }), false);

  // Leere Felder oder ungültige Eingaben
  assert.equal(alleUnterschrieben([], []), false);
  assert.equal(alleUnterschrieben(null, ['sig']), false);
  assert.equal(alleUnterschrieben(felder, null), false);
});

test('baueSignierBody: baut Request-Body mit aufsteigendem feld_index und ohne Base64-Präfix', () => {
  const body = baueSignierBody({
    formularId: '11111111-1111-1111-1111-111111111111',
    leadId: '22222222-2222-2222-2222-222222222222',
    unterschriften: [
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
      'iVBORw0KGgoAAAANSUhEUgBB', // bereits ohne Präfix
    ],
    signedName: ' Max Mustermann ',
  });

  assert.equal(body.formular_id, '11111111-1111-1111-1111-111111111111');
  assert.equal(body.lead_id, '22222222-2222-2222-2222-222222222222');
  assert.equal(body.signed_name, 'Max Mustermann');
  assert.equal(body.signaturen.length, 2);

  assert.deepEqual(body.signaturen[0], {
    feld_index: 0,
    png_base64: 'iVBORw0KGgoAAAANSUhEUgAA',
  });

  assert.deepEqual(body.signaturen[1], {
    feld_index: 1,
    png_base64: 'iVBORw0KGgoAAAANSUhEUgBB',
  });
});

test('baueSignierBody: unterstützt auch Map-Format für unterschriften und optionalen signedName', () => {
  const body = baueSignierBody({
    formularId: 'form-123',
    leadId: 'lead-456',
    unterschriften: {
      0: 'data:image/png;base64,AAA',
      1: 'data:image/png;base64,BBB',
    },
    signedName: '',
  });

  assert.equal(body.formular_id, 'form-123');
  assert.equal(body.lead_id, 'lead-456');
  assert.equal('signed_name' in body, false);
  assert.equal(body.signaturen.length, 2);
  assert.equal(body.signaturen[0].feld_index, 0);
  assert.equal(body.signaturen[0].png_base64, 'AAA');
  assert.equal(body.signaturen[1].feld_index, 1);
  assert.equal(body.signaturen[1].png_base64, 'BBB');
});
