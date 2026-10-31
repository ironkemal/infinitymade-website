// Rechnung per Mail (P1, K9): PDF-Regeln, MIME-Bau und Versandweg.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { erzeugeRechnungPdf, zeilenZusammenfassen, summenLabel, empfaengerZeilen, rechnungDateiname } from './rechnung-pdf.js';
import { baueMimeNachricht } from './gmail-senden.js';

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';
const { versandWeg } = await import('../routes/dokument-mail.js');

const INV = {
  invoice_number: 'R-2026-0007', issued_at: '2026-10-31', invoice_type: 'privat',
  line_items: [{ title: 'KG', quantity: 1, unit_price: 25 }, { title: 'KG', quantity: 1, unit_price: 25 }, { title: 'MLD 45', quantity: 2, unit_price: 40 }],
  subtotal: 130, total_patient: 130, kassenzuzahlung: 0,
  aussteller_snapshot: { name: 'Physio Test', strasse: 'Musterstraße 1', plzOrt: '54290 Musterstadt', bank: { iban: 'DE00 0000' } },
  empfaenger_snapshot: { art: 'patient', name: 'Anna Beispiel', strasse: 'Weg 2', plzOrt: '54290 Musterstadt' },
};

test('zeilenZusammenfassen: gleiche Leistung + Preis wird eine Zeile (wie aggregateInvLines)', () => {
  const z = zeilenZusammenfassen(INV.line_items);
  assert.deepEqual(z.map(l => [l.title, l.quantity]), [['KG', 2], ['MLD 45', 2]]);
});

test('summenLabel: Privat/BG ohne Eigenanteil, GKV mit', () => {
  assert.equal(summenLabel('privat').label, 'Rechnungsbetrag');
  assert.equal(summenLabel('bg').eigen, false);
  assert.equal(summenLabel('zuzahlung').label, 'Zu zahlen (Patient)');
});

test('empfaengerZeilen: Snapshot hat Vorrang vor der Akte', () => {
  const z = empfaengerZeilen(INV, { first_name: 'Neu', last_name: 'Name' });
  assert.equal(z[0], 'Anna Beispiel');
});

test('erzeugeRechnungPdf: ohne Passwort offen, mit Passwort verschlüsselt', async () => {
  const offen = await erzeugeRechnungPdf({ inv: INV });
  assert.equal(offen.subarray(0, 4).toString(), '%PDF');
  assert.ok(!offen.toString('latin1').includes('/Encrypt'));
  const zu = await erzeugeRechnungPdf({ inv: INV }, { passwort: 'Abc123xyz9' });
  assert.ok(zu.toString('latin1').includes('/Encrypt'));
});

test('rechnungDateiname: kein Patientenname, nur Nummer', () => {
  assert.equal(rechnungDateiname(INV), 'Rechnung_R-2026-0007.pdf');
  assert.equal(rechnungDateiname({}), 'Rechnung.pdf');
});

test('versandWeg: Box nur SMTP (ohne SMTP kein Versand), SaaS nur Gmail der Praxis', () => {
  assert.equal(versandWeg({ SMTP_HOST: 'smtp.praxis.de' }, true), 'smtp');
  assert.equal(versandWeg({}, true), null);
  assert.equal(versandWeg({ SMTP_HOST: 'smtp.praxura.de' }, false), 'gmail');
});

test('baueMimeNachricht: Anhang als multipart, kein Header-Einschleusen über Zeilenumbruch', () => {
  const raw = baueMimeNachricht({
    from: 'praxis@example.com', to: 'pat@example.com\r\nBcc: boese@example.com', subject: 'Ihre Rechnung', text: 'Hallo',
    attachments: [{ filename: 'Rechnung.pdf', content: Buffer.from('%PDF-1.7'), contentType: 'application/pdf' }],
  });
  assert.match(raw, /Content-Type: multipart\/mixed; boundary=/);
  assert.match(raw, /filename="Rechnung.pdf"/);
  assert.ok(!/\r\nBcc:/i.test(raw));
});
