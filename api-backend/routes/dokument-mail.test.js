// Therapiebericht-Versand: Eingabeprüfung und die Regel „echter Versand nur Box + SMTP".
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';
const { pruefeEingabe, versandMoeglich, entscheideFaxVersand } = await import('./dokument-mail.js');

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

test('entscheideFaxVersand: SaaS, kein SMTP, kein Muster, keine Faxnummer, erfolgreicher Versand', () => {
  const muster = '{nummer}@fax.provider.de';
  const nummer = '0221 123456';
  const smtp = 'smtp.praxis.de';

  // 1. SaaS (kutu = false) -> immer SAAS, egal ob SMTP vorhanden
  assert.deepEqual(entscheideFaxVersand({ kutu: false, smtp, muster, nummer }), { senden: false, code: 'SAAS' });

  // 2. Box ohne SMTP -> KEIN_SMTP
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp: null, muster, nummer }), { senden: false, code: 'KEIN_SMTP' });
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp: '', muster, nummer }), { senden: false, code: 'KEIN_SMTP' });

  // 3. Box mit SMTP, aber kein Muster -> KEIN_MUSTER
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp, muster: null, nummer }), { senden: false, code: 'KEIN_MUSTER' });
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp, muster: '', nummer }), { senden: false, code: 'KEIN_MUSTER' });
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp, muster: 'ungueltiges-muster', nummer }), { senden: false, code: 'KEIN_MUSTER' });

  // 4. Box mit SMTP, Muster gültig, aber keine Faxnummer / ungültige Faxnummer -> KEINE_FAXNUMMER
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp, muster, nummer: null }), { senden: false, code: 'KEINE_FAXNUMMER' });
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp, muster, nummer: '' }), { senden: false, code: 'KEINE_FAXNUMMER' });
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp, muster, nummer: '123' }), { senden: false, code: 'KEINE_FAXNUMMER' }); // zu kurz (<6)

  // 5. Box mit SMTP, Muster und Nummer gültig -> senden: true mit berechneter Adresse
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp, muster, nummer }), {
    senden: true,
    adresse: '0221123456@fax.provider.de',
  });

  // 6. Führendes + wird zu 00 normalisiert
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp, muster, nummer: '+49 221 123456' }), {
    senden: true,
    adresse: '0049221123456@fax.provider.de',
  });

  // 7. Injektion in Faxnummer wird unschädlich gemacht (nur Ziffern bleiben)
  assert.deepEqual(entscheideFaxVersand({ kutu: true, smtp, muster, nummer: '0221 123\r\nBcc: evil@test.de' }), {
    senden: true,
    adresse: '0221123@fax.provider.de',
  });
});
