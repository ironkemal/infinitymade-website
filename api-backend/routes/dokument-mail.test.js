// Therapiebericht-Versand: Eingabeprüfung und die Regel „echter Versand nur Box + SMTP".
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';
const { pruefeEingabe, versandMoeglich } = await import('./dokument-mail.js');

const RX = '11111111-2222-3333-4444-555555555555';

test('versandMoeglich: nur Box mit SMTP — nie SaaS (Gesundheitsdaten nicht über unseren Absender)', () => {
  assert.equal(versandMoeglich({ SMTP_HOST: 'smtp.praxis.de' }, true), true);
  assert.equal(versandMoeglich({}, true), false);
  assert.equal(versandMoeglich({ SMTP_HOST: 'smtp.praxura.de' }, false), false);
});

test('pruefeEingabe: Aktion und Verordnung Pflicht', () => {
  assert.ok(pruefeEingabe({}).fehler);
  assert.ok(pruefeEingabe({ aktion: 'senden', prescription_id: RX }).fehler);
  assert.ok(pruefeEingabe({ aktion: 'mail', prescription_id: 'x' }).fehler);
  assert.equal(pruefeEingabe({ aktion: 'fax', prescription_id: RX }).werte.aktion, 'fax');
});

test('pruefeEingabe: unbekannte Codes fallen weg, Text wird gekürzt, Mailadresse geprüft', () => {
  const w = pruefeEingabe({ aktion: 'druck', prescription_id: RX, art: 'quatsch', empfehlung_code: 'x', verlauf: 'a'.repeat(5000) }).werte;
  assert.equal(w.art, 'zwischenbericht');
  assert.equal(w.empfehlung_code, null);
  assert.equal(w.verlauf.length, 4000);
  assert.ok(pruefeEingabe({ aktion: 'mail', prescription_id: RX, an_email: 'a@b' }).fehler);
  assert.ok(pruefeEingabe({ aktion: 'mail', prescription_id: RX, an_email: 'x@y.de\nBcc: z@q.de' }).fehler);
  assert.equal(pruefeEingabe({ aktion: 'mail', prescription_id: RX, an_email: ' arzt@praxis.de ' }).werte.an_email, 'arzt@praxis.de');
});
