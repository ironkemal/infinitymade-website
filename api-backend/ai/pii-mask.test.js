// Tests for PII masking utility (M4.1 / M4.3 / K4 safety).
//   node api-backend/ai/pii-mask.test.js

import {
  maskPII,
  maskMessages,
  entitiesFromContacts,
  scanneReste,
  unmaskStreng,
  unmaskValues,
  scanOutputPII,
  bereinigeUnsichtbares
} from './pii-mask.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
/**
 * @param {string} name
 * @param {() => void} fn
 */
function test(name, fn) {
  try {
    fn();
    console.log('  ok   ' + name);
    pass++;
  } catch (e) {
    console.log('  FAIL ' + name + '\n       ' + (e instanceof Error ? e.message : String(e)));
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
  const c0 = /** @type {string} */ (m[0].content);
  const c1 = /** @type {string} */ (m[1].content);
  assert.ok(!c0.includes('Max Mustermann'));
  assert.ok(!c1.includes('Max Mustermann'));
  assert.equal((c0.match(new RegExp(`⟦NAME_${nonce}_1⟧`, 'g')) || []).length, 1);
  assert.equal((c1.match(new RegExp(`⟦NAME_${nonce}_1⟧`, 'g')) || []).length, 1);
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
  const parts = /** @type {[{ type: string, text: string }, { type: string, image_url: { url: string } }]} */ (m[0].content);
  assert.ok(!parts[0].text.includes('A123456789'));
  assert.ok(parts[0].text.includes(`⟦KVNR_${nonce}_1⟧`));
  assert.equal(parts[1].image_url.url, 'data:image/png;base64,XXX');
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

console.log('Freitext-Lücken (Audit 12.11.2026) - synthetische Daten');

// Everything a model would see: tokens collapsed to their type.
const WOERTERBUCH = ['Yilmaz', 'Aylin', 'Aylin Yilmaz', 'Hoffmann', 'Koch', 'Li', 'Do'];
/**
 * @param {string} text
 * @param {import('./pii-mask.js').MaskOptions} [opts={}]
 */
const sicht = (text, opts = {}) => {
  const r = maskPII(text, { mandantNamen: WOERTERBUCH, ignoreProtected: true, ...opts });
  assert.equal(r.unmask(r.masked), text, 'Maskierung muss verlustfrei sein');
  return r.masked.replace(/⟦([A-Z_]+)_[a-f0-9]{32}_\d+⟧/g, '[$1]');
};

test('birth date of a child under ten is hidden', () => {
  assert.equal(sicht('Kind, 14.03.2019, Sprachentwicklungsstörung.'), 'Kind, [DATE], Sprachentwicklungsstörung.');
});

test('birth date notations: two-digit year, slash, hyphen, ISO', () => {
  assert.equal(sicht('Patientin 12.03.59, Zustand nach Hüft-TEP.'), 'Patientin [DOB], Zustand nach Hüft-TEP.');
  assert.equal(sicht('Patient 12/03/1959 kommt wieder.'), 'Patient [DOB] kommt wieder.');
  assert.equal(sicht('Patient 12-03-1959 kommt wieder.'), 'Patient [DOB] kommt wieder.');
  assert.equal(sicht('Pat. 1959-03-12 Kontrolle.'), 'Pat. [DOB] Kontrolle.');
  assert.equal(sicht('Geboren 3. Mai 2021, Frühchen.'), 'Geboren [DOB], Frühchen.');
});

test('labelled birth date is hidden even with "am", asterisk or a future typo', () => {
  assert.equal(sicht('geb. am 12.03.2019 in Bonn'), 'geb. am [DOB] in Bonn');
  assert.equal(sicht('Geburtsdatum: 01.02.2099'), 'Geburtsdatum: [DOB]');
  assert.equal(sicht('Max *12.03.1959'), 'Max *[DOB]');
  assert.equal(sicht('Jahrgang 1959'), '[DOB]');
});

test('today and future dates stay readable in every notation', () => {
  // Two-digit years resolve to this century only up to five years ahead ("59" is 1959, not 2059).
  const naechstesJahr = String((new Date().getFullYear() + 1) % 100).padStart(2, '0');
  for (const text of ['Termin am 15.10.2099 um 14:30 Uhr.', `Termin am 15.10.${naechstesJahr}, sonst 15/10/2099.`, 'Ab 2099-10-15 wöchentlich.', 'Am 3. Mai 2099 Kontrolle.']) {
    assert.equal(sicht(text), text);
  }
  const heute = new Date();
  const de = `${String(heute.getDate()).padStart(2, '0')}.${String(heute.getMonth() + 1).padStart(2, '0')}.${heute.getFullYear()}`;
  assert.equal(sicht(`Termin heute ${de} fällt aus.`), `Termin heute ${de} fällt aus.`);
});

test('recent past appointment dates stay readable, only a birth context hides them', () => {
  const vorjahr = new Date().getFullYear() - 1;
  const text = `Die Unterbrechung dauerte vom 03.01.${vorjahr} bis zum 10.01.${vorjahr}.`;
  assert.equal(sicht(text), text);
  assert.equal(sicht(`Säugling, 03.01.${vorjahr}, Tortikollis.`), 'Säugling, [DATE], Tortikollis.');
  assert.equal(sicht(`Die 4-jährige kam am 03.01.${vorjahr} zur Welt.`), 'Die 4-jährige kam am [DATE] zur Welt.');
});

test('contextual names with letters outside A-Z and umlauts are masked whole', () => {
  assert.equal(sicht('Frau Tuğba Aydın kommt.'), 'Frau [NAME] kommt.');
  assert.equal(sicht('Mail an Herrn Stanisław Wiśniewski senden.'), 'Mail an Herrn [NAME] senden.');
  assert.equal(sicht('Die Nachbarin Ålina Dreckel ruft an, Tante Edda auch.'), 'Die Nachbarin [NAME] ruft an, Tante [NAME] auch.');
});

test('structured prompt pass and answer scan keep recent past dates (series planning)', () => {
  const vorjahr = `${new Date().getFullYear() - 1}-03-12`;
  const { messages } = maskMessages([{ role: 'user', content: `{"date":"${vorjahr}","time":"09:00"}` }]);
  assert.ok(messages[0].content.includes(vorjahr));
  assert.equal(scanOutputPII(`{"date":"${vorjahr}"}`).safe, true);
  assert.equal(scanOutputPII('{"date":"1959-03-12"}').safe, false);
});

test('known two-letter name is masked; ordinary short words and weekday abbreviations are not', () => {
  assert.equal(sicht('Li kommt morgen nicht.'), '[NAME] kommt morgen nicht.');
  assert.equal(sicht('Do 14 Uhr passt, li. Knie schmerzt.'), 'Do 14 Uhr passt, li. Knie schmerzt.');
  assert.equal(sicht('Frau Do kommt.'), 'Frau [NAME] kommt.');
});

test('lower-case common-word surname at sentence start is a name, mid-sentence it is a word', () => {
  assert.equal(sicht('koch hat abgesagt wegen Grippe.'), '[NAME] hat abgesagt wegen Grippe.');
  assert.equal(sicht('Sie arbeitet als koch im Hotel.'), 'Sie arbeitet als koch im Hotel.');
});

test('invisible characters cannot split a known name', () => {
  assert.equal(sicht('Yil\u200bmaz kommt später.'), '[NAME] kommt später.');
  // An invisible character outside a finding stays where it was (harmless, keeps the round trip exact).
  assert.equal(sicht('Hoff\u00admann und Ay\u2060lin\ufeff absagen'), '[NAME] und [NAME]\ufeff absagen');
  assert.equal(bereinigeUnsichtbares('A\u200b\u200d\u202eB'), 'AB');
  assert.deepEqual(scanneReste('Nummer 1234\u200b5678').map(f => f.art), ['ZIFFERNFOLGE']);
});

test('addresses: abbreviated street, hyphenated street, preposition street, doorbell name', () => {
  assert.equal(sicht('Hauptstr 12 in Troisdorf'), '[ADDRESS] in [LOCATION]');
  assert.equal(sicht('Kaiser-Wilhelm-Str. 5 klingeln'), '[ADDRESS] klingeln');
  assert.equal(sicht('Wohnt Am Turm 4b, Klingel Meier.'), 'Wohnt [ADDRESS], Klingel [NAME].');
  assert.equal(sicht('Hausbesuch Siegburg Kaldauen, zweiter Stock links.'), 'Hausbesuch [LOCATION], zweiter Stock links.');
});

test('preposition and Hausbesuch rules leave scheduling language alone', () => {
  for (const text of ['Am Montag 3 Termine frei.', 'Im Januar 2 Wochen Urlaub.', 'Am Freitag 14 Uhr.', 'Im Rezept 6 KG verordnet.', 'Hausbesuch Montag Vormittag möglich.', 'Zum Termin 10 Minuten früher kommen.']) {
    assert.equal(sicht(text), text);
  }
});

test('phone numbers: foreign prefix, labelled without leading zero', () => {
  assert.equal(sicht('Erreichbar unter +43 660 123 45 67.'), 'Erreichbar unter [PHONE].');
  assert.equal(sicht('Handy: 171 234 56 78'), 'Handy: [PHONE]');
  assert.equal(sicht('Rückruf 0041 44 123 45 67 bitte'), 'Rückruf [PHONE] bitte');
});

test('grouped digit runs are hidden, short counts and future dates are not', () => {
  assert.equal(sicht('Vers.-Nr. 123 456 789 bei Debeka'), 'Vers.-Nr. [NUMBER] bei Debeka');
  assert.equal(sicht('Kundennummer 12-345-678'), 'Kundennummer [NUMBER]');
  assert.equal(sicht('10 20 30 Minuten, ab 2099-10-15 oder 15-10-2099.'), '10 20 30 Minuten, ab 2099-10-15 oder 15-10-2099.');
});

test('title without dot, medical facility and employer', () => {
  assert.equal(sicht('KG 6x, Dr Weber Gemeinschaftspraxis Lohmar'), 'KG 6x, Dr [NAME]');
  assert.equal(sicht('Überweisung vom MVZ Rheinaue.'), 'Überweisung vom [ORGANIZATION].');
  assert.equal(sicht('Patient arbeitet bei Zurich Versicherung.'), 'Patient arbeitet bei [ORGANIZATION].');
  assert.deepEqual(scanneReste('Prof Unbekannt wartet.').map(f => f.art), ['ANREDE_REST']);
});

test('documented residual risk: an unknown name without any context still passes', () => {
  // Not closable by pattern rules. If this starts failing, the residual-risk text in the
  // KI-Anlage / DSFA is outdated and must be revised together with this test.
  assert.equal(sicht('Bitte Termin für Mehmet Demirci verschieben.'), 'Bitte Termin für Mehmet Demirci verschieben.');
});


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
