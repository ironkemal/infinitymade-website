// Tests for PII masking utility (M4.1 / M4.3 / K4 safety).
//   node api-backend/ai/pii-mask.test.js

import {
  maskPII,
  maskMessages,
  entitiesFromContacts,
  scanneReste,
  unmaskStreng,
  unmaskValues,
  scanOutputPII
} from './pii-mask.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  ok   ' + name);
    pass++;
  } catch (e) {
    console.log('  FAIL ' + name + '\n       ' + e.message);
    fail++;
  }
}

console.log('maskPII - Basis & Muster');

test('auto-detects KVNR with nonce placeholder', () => {
  const { masked, unmask, nonce } = maskPII('Patient A123456789 hat einen Termin.');
  assert.ok(!masked.includes('A123456789'));
  assert.ok(masked.includes(`⟦KVNR_${nonce}_1⟧`));
  assert.equal(unmask(masked), 'Patient A123456789 hat einen Termin.');
});

test('auto-detects IBAN with nonce placeholder', () => {
  const { masked, nonce } = maskPII('IBAN DE89370400440532013000 für Überweisung.');
  assert.ok(!masked.includes('DE89370400440532013000'));
  assert.ok(masked.includes(`⟦IBAN_${nonce}_1⟧`));
});

test('masks explicit name entity', () => {
  const { masked, unmask, nonce } = maskPII(
    'Herr Max Mustermann kommt am 14.05.',
    { entities: [{ value: 'Max Mustermann', type: 'NAME' }] }
  );
  assert.ok(!masked.includes('Max Mustermann'));
  assert.ok(masked.includes(`⟦NAME_${nonce}_1⟧`));
  assert.equal(unmask(masked), 'Herr Max Mustermann kommt am 14.05.');
});

test('same value gets same placeholder (dedupe within call)', () => {
  const { masked, map, nonce } = maskPII(
    'Max Mustermann hat angerufen. Max Mustermann möchte einen Termin.',
    { entities: [{ value: 'Max Mustermann', type: 'NAME' }] }
  );
  assert.equal(Object.keys(map).length, 1);
  const count = (masked.match(new RegExp(`⟦NAME_${nonce}_1⟧`, 'g')) || []).length;
  assert.equal(count, 2);
});

test('multiple entities get unique placeholders', () => {
  const { masked, map, nonce } = maskPII(
    'Max Mustermann und Anna Schmidt kommen.',
    { entities: [
      { value: 'Max Mustermann', type: 'NAME' },
      { value: 'Anna Schmidt', type: 'NAME' },
    ]}
  );
  assert.equal(Object.keys(map).length, 2);
  assert.ok(masked.includes(`⟦NAME_${nonce}_1⟧`));
  assert.ok(masked.includes(`⟦NAME_${nonce}_2⟧`));
});

test('unmask reverses model output', () => {
  const text = 'Sehr geehrter Herr Müller, am 2026-05-23 ist Ihr Termin.';
  const { masked, unmask, nonce } = maskPII(text, {
    entities: [{ value: 'Müller', type: 'NAME' }, { value: '2026-05-23', type: 'DATE' }]
  });
  const modelOutput = `Antwort an ⟦NAME_${nonce}_1⟧: Termin am ⟦DATE_${nonce}_1⟧ bestätigt.`;
  const restored = unmask(modelOutput);
  assert.equal(restored, 'Antwort an Müller: Termin am 2026-05-23 bestätigt.');
});

test('longest-first ordering avoids substring collisions', () => {
  const { masked, nonce } = maskPII(
    'Anna ist da. Anna Schmidt kommt morgen.',
    { entities: [
      { value: 'Anna', type: 'NAME' },
      { value: 'Anna Schmidt', type: 'NAME' },
    ]}
  );
  assert.ok(masked.includes(`⟦NAME_${nonce}_1⟧`));  // Anna Schmidt
  assert.ok(masked.includes(`⟦NAME_${nonce}_2⟧`));  // Anna alone
  assert.ok(!masked.includes('Anna Schmidt'));
});

test('handles empty input', () => {
  const { masked, unmask } = maskPII('');
  assert.equal(masked, '');
  assert.equal(unmask(''), '');
});

console.log('maskPII - Nonce & Sicherheitsgarantien');

test('per-call nonce is unique across independent calls', () => {
  const res1 = maskPII('Patient A123456789');
  const res2 = maskPII('Patient A123456789');
  assert.notEqual(res1.nonce, res2.nonce);
  assert.ok(res1.masked !== res2.masked);
});

test('anti-injection: neutralizes existing tokens without spoofing unmask', () => {
  const injection = 'User input with ⟦NAME_fake_1⟧ and <<KVNR_99>> payload.';
  const { masked, unmask } = maskPII(injection);
  assert.ok(!masked.includes('⟦NAME_fake_1⟧'));
  assert.ok(!masked.includes('<<KVNR_99>>'));
  const restored = unmask(masked);
  assert.equal(restored, injection);
});

test('prototype safety: keys like __proto__ and toString do not corrupt mapping', () => {
  const text = '__proto__ constructor toString';
  const { masked, unmask } = maskPII(text, {
    entities: [
      { value: '__proto__', type: 'TEST' },
      { value: 'constructor', type: 'TEST' }
    ]
  });
  assert.equal(unmask(masked), text);
});

test('preserves appointment dates and times (not falsely masked as DOB)', () => {
  const appointmentText = 'Termin am 2026-10-15 um 14:30 Uhr vereinbart.';
  const { masked } = maskPII(appointmentText, { preserveAppointments: true });
  assert.ok(masked.includes('2026-10-15'));
  assert.ok(masked.includes('14:30'));
});

test('strict unmask throws on unknown placeholder or foreign nonce', () => {
  const { unmaskStreng: strictFn, nonce } = maskPII('Hans Müller', {
    entities: [{ value: 'Hans Müller', type: 'NAME' }]
  });
  // Valid token passes
  assert.equal(strictFn(`Hallo ⟦NAME_${nonce}_1⟧`), 'Hallo Hans Müller');

  // Foreign nonce token throws
  assert.throws(
    () => strictFn('Hallo ⟦NAME_foreign_1⟧'),
    /Unbekannter oder ungültiger Platzhalter/
  );
  // Malformed legacy token throws
  assert.throws(
    () => strictFn('Hallo <<KVNR_999>>'),
    /Unbekannter oder ungültiger Platzhalter/
  );
});

console.log('maskMessages');

test('masks across system+user messages with shared placeholders and nonce', () => {
  const messages = [
    { role: 'system', content: 'Du bist Assistent für Max Mustermann.' },
    { role: 'user',   content: 'Schreibe Max Mustermann eine Erinnerung.' },
  ];
  const { messages: m, unmask, nonce } = maskMessages(messages, {
    entities: [{ value: 'Max Mustermann', type: 'NAME' }]
  });
  assert.ok(!m[0].content.includes('Max Mustermann'));
  assert.ok(!m[1].content.includes('Max Mustermann'));
  assert.equal(m[0].content.match(new RegExp(`⟦NAME_${nonce}_1⟧`, 'g')).length, 1);
  assert.equal(m[1].content.match(new RegExp(`⟦NAME_${nonce}_1⟧`, 'g')).length, 1);
  assert.equal(unmask(`Hallo ⟦NAME_${nonce}_1⟧`), 'Hallo Max Mustermann');
});

test('preserves multi-part content (vision) — masks text part only', () => {
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: 'Patient A123456789 — bitte auslesen.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,XXX' } },
    ]
  }];
  const { messages: m, nonce } = maskMessages(messages);
  assert.ok(!m[0].content[0].text.includes('A123456789'));
  assert.ok(m[0].content[0].text.includes(`⟦KVNR_${nonce}_1⟧`));
  assert.equal(m[0].content[1].image_url.url, 'data:image/png;base64,XXX');
});

console.log('entitiesFromContacts');

test('extracts names + emails + phones from contacts', () => {
  const ents = entitiesFromContacts([
    { name: 'Anna Schmidt', email: 'anna@x.de', phone: '+491701234567' },
    { first_name: 'Max', last_name: 'Mustermann', email: 'max@y.de' },
  ]);
  const names  = ents.filter(e => e.type === 'NAME').map(e => e.value);
  const emails = ents.filter(e => e.type === 'EMAIL').map(e => e.value);
  const phones = ents.filter(e => e.type === 'PHONE').map(e => e.value);
  assert.deepEqual(names.sort(),  ['Anna Schmidt', 'Max Mustermann']);
  assert.deepEqual(emails.sort(), ['anna@x.de', 'max@y.de']);
  assert.deepEqual(phones, ['+491701234567']);
});

console.log('unmaskValues & scanOutputPII & scanneReste');

test('unmaskValues only unmasks object values, never object keys', () => {
  const { unmask, nonce } = maskPII('Geheimnis', {
    entities: [{ value: 'Geheimnis', type: 'SECRET' }]
  });
  const inputObj = {
    [`⟦SECRET_${nonce}_1⟧`]: `Wert: ⟦SECRET_${nonce}_1⟧`,
    nested: {
      subKey: `⟦SECRET_${nonce}_1⟧`
    }
  };
  const restored = unmaskValues(inputObj, unmask);
  // Key must remain unchanged
  assert.ok(Object.prototype.hasOwnProperty.call(restored, `⟦SECRET_${nonce}_1⟧`));
  // Values must be unmasked
  assert.equal(restored[`⟦SECRET_${nonce}_1⟧`], 'Wert: Geheimnis');
  assert.equal(restored.nested.subKey, 'Geheimnis');
});

test('scanneReste detects unmasked honorific remnants and long digit sequences', () => {
  const textWithRemnants = 'Dr. Schmidt hat angerufen unter 022411234567 in 53721 Siegburg.';
  const befunde = scanneReste(textWithRemnants, ['Schmidt']);
  assert.ok(befunde.length > 0);
  const arts = befunde.map(b => b.art);
  assert.ok(arts.includes('ANREDE_REST') || arts.includes('FUZZY_NAME_REST'));
  assert.ok(arts.includes('ZIFFERNFOLGE') || arts.includes('PLZ_REST'));
});

test('scanOutputPII catches raw KVNR and foreign tokens in output', () => {
  const knownMap = new Map([['⟦OK_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_1⟧', 'Geheim']]);
  const check1 = scanOutputPII('Antwort mit A123456789', knownMap);
  assert.equal(check1.safe, false);
  assert.ok(check1.violations.some(v => v.includes('KVNR')));

  const check2 = scanOutputPII('Antwort mit ⟦UNKNOWN_TOKEN_99⟧', knownMap);
  assert.equal(check2.safe, false);
  assert.ok(check2.violations.some(v => v.includes('Unbekannter Platzhalter')));

  const check3 = scanOutputPII('Saubere Antwort mit ⟦OK_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_1⟧', knownMap);
  assert.equal(check3.safe, true);
});


test('contextual spouse name covers unknown first name despite known surname overlap', () => {
  const text = 'Patient Günther Franke wünscht Termin, Ehefrau Monika Franke begleitet ihn.';
  const result = maskPII(text, { entities: [{ value: 'Günther Franke', type: 'NAME' }] });
  assert.ok(!result.masked.includes('Monika'));
  assert.ok(!result.masked.includes('Franke'));
  assert.equal(result.unmask(result.masked), text);
});
test('identity and residence location cues mask locality without broad capitalized-noun rule', () => {
  for (const text of ['Dr. med. Schultze aus Hennef verordnet Antiseptik.', 'Hausarzt Lindner in Leipzig erhält Befund.']) {
    const result = maskPII(text);
    assert.ok(!result.masked.includes('Hennef') && !result.masked.includes('Leipzig'));
    assert.equal(result.unmask(result.masked), text);
  }
  const clinical = 'Aus Erfahrung verbessert Therapie Diabetes mellitus und Wagner-Grad 1.';
  assert.equal(maskPII(clinical).masked, clinical);
});
test('historical repeated DOB variants mask while current and future appointment dates remain', () => {
  const text = 'Patient geboren 13.4.1952, erneut 13. April 1952 genannt, Jg. 52.';
  const result = maskPII(text);
  assert.ok(!result.masked.includes('13. April 1952'));
  assert.equal(result.unmask(result.masked), text);
  const appointments = 'Termin 13. April 2027 um 14:00, Folgekontrolle 2027-05-13.';
  assert.equal(maskPII(appointments).masked, appointments);
});
test('rare-age patient and geography combination is blocked; clinical grade remains intact', () => {
  const text = '98-jährige Patientin aus Lohmar-Wahlscheid mit Amputation D2 rechts.';
  const result = maskPII(text);
  assert.ok(scanneReste(result.masked).some(f => f.art === 'QUASI_REIDENTIFIKATION'));
  assert.ok(result.masked.includes('Amputation D2 rechts'));
  assert.equal(result.unmask(result.masked), text);
  assert.deepEqual(scanneReste('98-jährige Verordnung, Diabetes mellitus Typ 2, Wagner-Grad 1.'), []);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
