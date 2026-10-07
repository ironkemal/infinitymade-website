// K2b.15 — Mail-Entwurf statt Versand in der Box ohne SMTP.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mailEntwurfStattVersand, entwurfBestaetigt, entwurfAbgelehnt, entwurfGegenangebot, entwurfNachricht,
} from './mail-entwurf.js';

const alt = { ...process.env };
afterEach(() => {
  for (const k of ['SUPABASE_PUBLIC_URL', 'SMTP_HOST']) {
    if (alt[k] === undefined) delete process.env[k]; else process.env[k] = alt[k];
  }
});

test('Entwurf nur in der Box ohne SMTP', () => {
  delete process.env.SUPABASE_PUBLIC_URL; delete process.env.SMTP_HOST;
  assert.equal(mailEntwurfStattVersand(), false, 'SaaS ohne SMTP: kein Entwurf (Verhalten unverändert)');
  process.env.SUPABASE_PUBLIC_URL = 'https://box.example';
  assert.equal(mailEntwurfStattVersand(), true);
  process.env.SMTP_HOST = 'smtp.example';
  assert.equal(mailEntwurfStattVersand(), false, 'Box mit eigenem SMTP sendet selbst');
});

test('Texte: Empfänger, keine Links (O-155), Telefonhinweis', () => {
  const alle = [
    entwurfBestaetigt({ to: 'p@x.de', vorname: 'Eva', praxis: 'Praxis A', datum: '2026-10-08', uhrzeit: '09:30', therapeut: 'T. B.' }),
    entwurfAbgelehnt({ to: 'p@x.de', vorname: 'Eva', praxis: 'Praxis A', grund: 'Urlaub' }),
    entwurfGegenangebot({ to: 'p@x.de', vorname: 'Eva', praxis: 'Praxis A', termine: [{ date: '2026-10-09', time: '10:00' }] }),
    entwurfNachricht({ to: 'p@x.de', vorname: 'Eva', praxis: 'Praxis A', nachricht: 'Bitte Rezept mitbringen.' }),
  ];
  for (const e of alle) {
    assert.equal(e.to, 'p@x.de');
    assert.ok(e.subject);
    assert.ok(!/https?:\/\//.test(e.text), 'kein Link im Box-Entwurf');
    assert.ok(e.text.includes('Praxis A'));
  }
  assert.ok(alle[0].text.includes('8.10.2026') && alle[0].text.includes('09:30 Uhr'));
  assert.ok(alle[0].text.includes('rufen Sie bitte die Praxis an'));
  assert.ok(alle[1].text.includes('Grund: Urlaub'));
  assert.ok(alle[2].text.includes('10:00 Uhr'));
  assert.ok(alle[3].text.includes('Bitte Rezept mitbringen.'));
});
