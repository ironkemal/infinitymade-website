// Tests for PII masking utility.
//   node api-backend/ai/pii-mask.test.js

import { maskPII, maskMessages, entitiesFromContacts } from './pii-mask.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('maskPII');

test('auto-detects KVNR', () => {
  const { masked, unmask } = maskPII('Patient A123456789 hat einen Termin.');
  assert.ok(!masked.includes('A123456789'));
  assert.ok(masked.includes('<<KVNR_1>>'));
  assert.equal(unmask(masked), 'Patient A123456789 hat einen Termin.');
});

test('auto-detects IBAN', () => {
  const { masked } = maskPII('IBAN DE89370400440532013000 für Überweisung.');
  assert.ok(!masked.includes('DE89370400440532013000'));
  assert.ok(masked.includes('<<IBAN_1>>'));
});

test('masks explicit name entity', () => {
  const { masked, unmask } = maskPII(
    'Herr Max Mustermann kommt am 14.05.',
    { entities: [{ value: 'Max Mustermann', type: 'NAME' }] }
  );
  assert.ok(!masked.includes('Max Mustermann'));
  assert.ok(masked.includes('<<NAME_1>>'));
  assert.equal(unmask(masked), 'Herr Max Mustermann kommt am 14.05.');
});

test('same value gets same placeholder (dedupe)', () => {
  const { masked, map } = maskPII(
    'Max Mustermann hat angerufen. Max Mustermann möchte einen Termin.',
    { entities: [{ value: 'Max Mustermann', type: 'NAME' }] }
  );
  assert.equal(Object.keys(map).length, 1);
  assert.equal((masked.match(/<<NAME_1>>/g) || []).length, 2);
});

test('multiple entities get unique placeholders', () => {
  const { masked, map } = maskPII(
    'Max Mustermann und Anna Schmidt kommen.',
    { entities: [
      { value: 'Max Mustermann', type: 'NAME' },
      { value: 'Anna Schmidt', type: 'NAME' },
    ]}
  );
  assert.equal(Object.keys(map).length, 2);
  assert.ok(masked.includes('<<NAME_1>>'));
  assert.ok(masked.includes('<<NAME_2>>'));
});

test('unmask reverses model output', () => {
  const text = 'Sehr geehrter Herr Müller, am 2026-05-23 ist Ihr Termin.';
  const { masked, unmask } = maskPII(text, {
    entities: [{ value: 'Müller', type: 'NAME' }, { value: '2026-05-23', type: 'DATE' }]
  });
  // Simulate model regurgitating placeholders
  const modelOutput = `Antwort an <<NAME_1>>: Termin am <<DATE_1>> bestätigt.`;
  const restored = unmask(modelOutput);
  assert.equal(restored, 'Antwort an Müller: Termin am 2026-05-23 bestätigt.');
});

test('longest-first ordering avoids substring collisions', () => {
  // "Anna Schmidt" contains "Anna" — longer must replace first
  const { masked } = maskPII(
    'Anna ist da. Anna Schmidt kommt morgen.',
    { entities: [
      { value: 'Anna', type: 'NAME' },
      { value: 'Anna Schmidt', type: 'NAME' },
    ]}
  );
  assert.ok(masked.includes('<<NAME_1>>'));  // Anna Schmidt
  assert.ok(masked.includes('<<NAME_2>>'));  // Anna alone
  assert.ok(!masked.includes('Anna Schmidt'));
});

test('handles empty input', () => {
  const { masked, unmask } = maskPII('');
  assert.equal(masked, '');
  assert.equal(unmask(''), '');
});

console.log('maskMessages');

test('masks across system+user messages with shared placeholders', () => {
  const messages = [
    { role: 'system', content: 'Du bist Assistent für Max Mustermann.' },
    { role: 'user',   content: 'Schreibe Max Mustermann eine Erinnerung.' },
  ];
  const { messages: m, unmask } = maskMessages(messages, {
    entities: [{ value: 'Max Mustermann', type: 'NAME' }]
  });
  assert.ok(!m[0].content.includes('Max Mustermann'));
  assert.ok(!m[1].content.includes('Max Mustermann'));
  assert.equal(m[0].content.match(/<<NAME_1>>/g).length, 1);
  assert.equal(m[1].content.match(/<<NAME_1>>/g).length, 1);
  assert.equal(unmask('Hallo <<NAME_1>>'), 'Hallo Max Mustermann');
});

test('preserves multi-part content (vision) — masks text part only', () => {
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: 'Patient A123456789 — bitte auslesen.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,XXX' } },
    ]
  }];
  const { messages: m } = maskMessages(messages);
  assert.ok(!m[0].content[0].text.includes('A123456789'));
  assert.ok(m[0].content[0].text.includes('<<KVNR_1>>'));
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

test('end-to-end: mask contacts list, unmask response', () => {
  const contacts = [
    { name: 'Hans Müller', email: 'hans@praxis.de', kvnr: 'A123456789' },
  ];
  const intent = 'Bitte Hans Müller (A123456789) eine Terminbestätigung schicken an hans@praxis.de';
  const { masked, unmask } = maskPII(intent, { entities: entitiesFromContacts(contacts) });
  assert.ok(!masked.includes('Hans Müller'));
  assert.ok(!masked.includes('A123456789'));
  assert.ok(!masked.includes('hans@praxis.de'));
  // model "echoes" placeholders in response
  const modelOut = 'Email an <<NAME_1>> (<<EMAIL_1>>): Sehr geehrter <<NAME_1>>, …';
  const restored = unmask(modelOut);
  assert.ok(restored.includes('Hans Müller'));
  assert.ok(restored.includes('hans@praxis.de'));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
