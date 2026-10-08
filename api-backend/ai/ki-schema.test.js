// Tests for ki-schema.js (M4.1 / M4.3 / K4 safety).
//   node api-backend/ai/ki-schema.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTaskPayload } from './ki-schema.js';

test('rejects unknown root property with 400 KI_SCHEMA', () => {
  const payload = {
    intent: 'Terminbestätigung',
    unauthorized_extra_field: 'leak'
  };
  assert.throws(
    () => validateTaskPayload('b2c-draft', payload, { mode: 'direkt', allowFreeText: true }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.equal(err.status, 400);
      assert.ok(err.message.includes('unauthorized_extra_field'));
      return true;
    }
  );
});

test('rejects unknown property in nested contacts object', () => {
  const payload = {
    intent: 'Termin',
    contacts: [{
      name: 'Max Mustermann',
      attacker_payload: 'injection'
    }]
  };
  assert.throws(
    () => validateTaskPayload('b2c-draft', payload, { mode: 'direkt', allowFreeText: true }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.equal(err.status, 400);
      assert.ok(err.message.includes('attacker_payload'));
      return true;
    }
  );
});

test('rejects deep nesting exceeding MAX_DEPTH', () => {
  const deepPayload = {
    intent: 'Test',
    l1: { l2: { l3: { l4: { l5: { l6: 'too deep' } } } } }
  };
  assert.throws(
    () => validateTaskPayload('b2c-draft', deepPayload, { mode: 'direkt', allowFreeText: true }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.equal(err.status, 400);
      assert.ok(err.message.includes('Verschachtelungstiefe'));
      return true;
    }
  );
});

test('rejects invalid date and time formats in slots', () => {
  const badDatePayload = {
    slots: [{ date: '14.05.2026', time: '14:00' }]
  };
  assert.throws(
    () => validateTaskPayload('appointment-confirm-draft', badDatePayload, { mode: 'direkt' }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.ok(err.message.includes('YYYY-MM-DD'));
      return true;
    }
  );

  const badTimePayload = {
    slots: [{ date: '2026-05-14', time: '2 PM' }]
  };
  assert.throws(
    () => validateTaskPayload('appointment-confirm-draft', badTimePayload, { mode: 'direkt' }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.ok(err.message.includes('HH:mm'));
      return true;
    }
  );
});

test('jeton mode rejects freetext intent with KI_FREITEXT_GESPERRT', () => {
  const payload = { intent: 'Freitext Auftrag' };
  assert.throws(
    () => validateTaskPayload('b2c-draft', payload, { mode: 'jeton' }),
    (err) => {
      assert.equal(err.code, 'KI_FREITEXT_GESPERRT');
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test('jeton mode rejects series userFeedback and notes with KI_FREITEXT_GESPERRT', () => {
  const payloadFeedback = {
    count: 1, candidates: [],
    userFeedback: 'Bitte andere Zeit'
  };
  assert.throws(
    () => validateTaskPayload('series-scheduler', payloadFeedback, { mode: 'jeton' }),
    (err) => {
      assert.equal(err.code, 'KI_FREITEXT_GESPERRT');
      assert.equal(err.status, 403);
      return true;
    }
  );

  const payloadNotes = {
    count: 1, candidates: [],
    preferences: { notes: 'Besondere Wünsche' }
  };
  assert.throws(
    () => validateTaskPayload('series-scheduler', payloadNotes, { mode: 'jeton' }),
    (err) => {
      assert.equal(err.code, 'KI_FREITEXT_GESPERRT');
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test('jeton mode rejects rezept heilmittel_feld_text with KI_FREITEXT_GESPERRT', () => {
  const payload = {
    rezept: {
      frequenz: '2x pro Woche',
      heilmittel_feld_text: 'Arzt-Notiz Freitext'
    }
  };
  assert.throws(
    () => validateTaskPayload('rezept-normalize', payload, { mode: 'jeton' }),
    (err) => {
      assert.equal(err.code, 'KI_FREITEXT_GESPERRT');
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test('direct mode blocks freetext if allowFreeText is false', () => {
  const payload = { intent: 'Nachricht' };
  assert.throws(
    () => validateTaskPayload('b2c-draft', payload, { mode: 'direkt', allowFreeText: false }),
    (err) => {
      assert.equal(err.code, 'KI_FREITEXT_GESPERRT');
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test('valid payload passes for all tasks', () => {
  // b2c-draft in direct mode with allowFreeText
  assert.equal(
    validateTaskPayload('b2c-draft', {
      intent: 'Bitte Erinnerung senden',
      contacts: [{ name: 'Anna Schmidt', email: 'anna@example.de' }],
      owner_info: { sector: 'physiotherapy' }
    }, { mode: 'direkt', allowFreeText: true }),
    true
  );

  // appointment-confirm-draft
  assert.equal(
    validateTaskPayload('appointment-confirm-draft', {
      slots: [{ date: '2026-10-15', time: '09:00', employeeName: 'Max' }],
      patient: { name: 'Lisa Meier', email: 'lisa@example.de' },
      service: { title: 'KG', duration: 30 }
    }, { mode: 'direkt' }),
    true
  );

  // series-scheduler in jeton mode without freetext
  assert.equal(
    validateTaskPayload('series-scheduler', {
      count: 6,
      recurrence: 'weekly',
      targetDates: ['2026-10-15'],
      candidates: [{ date: '2026-10-15', time: '10:00', employeeId: 'emp-1' }]
    }, { mode: 'jeton' }),
    true
  );

  // rezept-normalize in jeton mode without freetext
  assert.equal(
    validateTaskPayload('rezept-normalize', {
      rezept: { frequenz: '2x pro Woche', diagnosegruppe: 'WS2' },
      heilmittel_positionen: [{ x: 'X0501', label: 'Allgemeine Krankengymnastik (KG) Einzel' }]
    }, { mode: 'jeton' }),
    true
  );
});

test('rejects arbitrary catalog label in heilmittel_positionen', () => {
  const payload = {
    rezept: { frequenz: '2x pro Woche' },
    heilmittel_positionen: [{ x: 'X9999', label: 'Beliebige Ungeprüfte Zauberbehandlung' }]
  };
  assert.throws(
    () => validateTaskPayload('rezept-normalize', payload, { mode: 'direkt' }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.ok(err.message.includes('unbekanntes Katalog-Label'));
      return true;
    }
  );
});


test('actual series shapes accept 60 sessions, shift metadata and nullable identities', () => {
  assert.equal(validateTaskPayload('series-scheduler', { count: 60, candidates: [{ date: '2026-10-15', time: '14:00', employeeId: 'emp', bucket: 59, shiftedFromDate: '2026-10-14', dateShiftDays: 1 }], previousSelected: [{ date: '2026-10-14', time: '14:00', employeeId: 'emp' }], preferences: { preferredEmployee: null }, customer: { id: null } }, { mode: 'jeton' }), true);
});
test('invalid calendar dates, numeric coercion, nested freeText and arbitrary diagnosis fail', () => {
  for (const payload of [{ count: '1' }, { count: 1, candidates: [{ date: '2026-02-31', time: '14:00' }] }, { count: 1, preferences: { notes: { date: 'private name' } } }, { count: 1, service: { duration: '30' } }, { count: 1, candidates: [{ date: '2026-10-15', time: '14:00', bucket: 60 }] }]) assert.throws(() => validateTaskPayload('series-scheduler', payload, { mode: 'jeton' }), e => e.code === 'KI_SCHEMA');
  assert.throws(() => validateTaskPayload('rezept-normalize', { rezept: { diagnosegruppe: 'WS2 Private Patient' } }, { mode: 'jeton' }), e => e.code === 'KI_SCHEMA');
});


test('typed catalogue code cannot carry raw identity through structured A', () => {
  assert.throws(() => validateTaskPayload('rezept-normalize', { rezept: {}, heilmittel_positionen: [{ x: 'NEUETESTPERSONQZX', label: 'Manuelle Therapie' }] }, { mode: 'jeton' }), e => e.code === 'KI_SCHEMA');
  for (const x of ['X0501', '78010']) assert.equal(validateTaskPayload('rezept-normalize', { rezept: {}, heilmittel_positionen: [{ x, label: 'Manuelle Therapie' }] }, { mode: 'jeton' }), true);
});


test('catalogue category is fixed enum and cannot hide arbitrary private text', () => {
  assert.throws(() => validateTaskPayload('rezept-normalize', { rezept: {}, heilmittel_positionen: [{ x: 'X0501', label: 'Manuelle Therapie', kat: 'Private Person' }] }, { mode: 'jeton' }), e => e.code === 'KI_SCHEMA');
  assert.equal(validateTaskPayload('rezept-normalize', { rezept: {}, heilmittel_positionen: [{ x: 'X0501', label: 'Manuelle Therapie', kat: 'vorrangig' }] }, { mode: 'jeton' }), true);
});
