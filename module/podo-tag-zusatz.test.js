import test from 'node:test';
import assert from 'node:assert/strict';
import { fussbefundKopf, fussbefundBoxHtml, folgeAusgangstermin, frageFolgetermin, ladeLetzterBefund, ladeTagesTermin, FOLGE_FRAGE } from './podo-tag-zusatz.js';
import { leadStatusLabel } from './lead-status.js';

test('Kopfzeile: ohne Befund „Noch kein Fußbefund"', () => {
  assert.match(fussbefundKopf(null).titel, /Noch kein Fußbefund/);
  assert.match(fussbefundKopf('').titel, /Noch kein Fußbefund/);
});
test('Kopfzeile: mit Befund Datum + unverändert/aktualisieren', () => {
  const k = fussbefundKopf('2026-09-12T10:00:00+00:00');
  assert.match(k.titel, /12\.09\.2026/);
  assert.match(k.hinweis, /unverändert/);
  assert.match(k.hinweis, /aktualisieren/);
});
test('Box ist ein <details> ohne open (standardmässig zu)', () => {
  const h = fussbefundBoxHtml('2026-09-12', s => s);
  assert.match(h, /<details id="podFussbefundBox"/);
  assert.doesNotMatch(h.split('>')[0], /\bopen\b/);
  assert.match(h, /id="podFussbefundHost"/);
});
test('Folgetermin-Frage: Texte laut Konsey', () => {
  assert.equal(FOLGE_FRAGE.confirmText, 'Folgetermin anlegen');
  assert.equal(FOLGE_FRAGE.cancelText, 'Später');
  assert.match(FOLGE_FRAGE.message, /Folgetermin jetzt anlegen\?/);
});
test('frageFolgetermin: nicht bei aufgebrauchter Verordnung', () => {
  assert.equal(frageFolgetermin({ alleVerbraucht: false }), true);
  assert.equal(frageFolgetermin({ alleVerbraucht: true }), false);
});
test('Ausgangstermin: Buchung hat Vorrang und wird um Patient/Verordnung ergänzt', () => {
  const r = folgeAusgangstermin({ buchung: { id: 'b1', start_time: 'x' }, vord: { id: 'v1', lead_id: 'l1' }, datum: '2026-10-01' });
  assert.equal(r.quelle, 'buchung');
  assert.equal(r.booking.lead_id, 'l1');
  assert.equal(r.booking.verordnung_id, 'v1');
});
test('Ausgangstermin: ohne Buchung Platzhalter ohne id, Behandlungstag 09:00', () => {
  const r = folgeAusgangstermin({ buchung: null, vord: { id: 'v1', lead_id: 'l1', hausbesuch: true }, datum: '2026-10-01', name: 'A B' });
  assert.equal(r.quelle, 'platzhalter');
  assert.equal(r.booking.id, null);
  assert.equal(r.booking.start_time, '2026-10-01T09:00:00');
  assert.equal(r.booking.hausbesuch, true);
  assert.equal(r.booking.customer_name, 'A B');
});
test('Lader wirft nie und liefert null', async () => {
  const kaputt = { from() { throw new Error('x'); } };
  assert.equal(await ladeLetzterBefund(kaputt, 'o', 'l'), null);
  assert.equal(await ladeTagesTermin(kaputt, 'o', 'v', '2026-10-01'), null);
  assert.equal(await ladeLetzterBefund(null, 'o', 'l'), null);
});
test('leadStatusLabel: Almanca etiket, bilinmeyen ham, boş —', () => {
  assert.equal(leadStatusLabel('new'), 'Neu');
  assert.equal(leadStatusLabel('contacted'), 'Kontaktiert');
  assert.equal(leadStatusLabel('booked'), 'Termin vereinbart');
  assert.equal(leadStatusLabel('won'), 'Gewonnen');
  assert.equal(leadStatusLabel('lost'), 'Verloren');
  assert.equal(leadStatusLabel('weird'), 'weird');
  assert.equal(leadStatusLabel(null), '—');
});
