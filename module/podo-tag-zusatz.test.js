import test from 'node:test';
import assert from 'node:assert/strict';
import { fussbefundKopf, fussbefundBoxHtml, folgeAusgangstermin, frageFolgetermin, ladeLetzterBefund, ladeTagesTermin, FOLGE_FRAGE,
  hatAnamnese, anamneseFehltNotizHtml, frageAnamnese78040, ANAMNESE_78040_FRAGE, ANAMNESE_FEHLT_NOTIZ } from './podo-tag-zusatz.js';
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

// ── Anamnese-Hinweis (S4 P3, gkv-302 30.09.2026) ──
const sbMit = (ergebnis) => ({ from(t) { assert.equal(t, 'anamnese'); return { select: () => ({ eq: (c, v) => { assert.equal(c, 'patient_id'); assert.equal(v, 'L1'); return { limit: async () => ergebnis }; } }) }; } });
test('hatAnamnese: Treffer → true, leer → false, Fehler/kein Patient/kein Client → null (dann KEIN Hinweis)', async () => {
  assert.equal(await hatAnamnese(sbMit({ data: [{ id: 'a' }], error: null }), 'L1'), true);
  assert.equal(await hatAnamnese(sbMit({ data: [], error: null }), 'L1'), false);
  assert.equal(await hatAnamnese(sbMit({ data: null, error: { message: 'x' } }), 'L1'), null);
  assert.equal(await hatAnamnese({ from() { throw new Error('x'); } }, 'L1'), null);
  assert.equal(await hatAnamnese(sbMit({ data: [], error: null }), null), null);
  assert.equal(await hatAnamnese(null, 'L1'), null);
});
test('Notiz: nur bei false, mit Link „Anamnese erfassen"', () => {
  assert.equal(anamneseFehltNotizHtml(true, s => s), '');
  assert.equal(anamneseFehltNotizHtml(null, s => s), '');
  const h = anamneseFehltNotizHtml(false, s => s);
  assert.ok(h.includes(ANAMNESE_FEHLT_NOTIZ));
  assert.match(h, /id="podAnamneseErfassenBtn"/);
  assert.match(h, />Anamnese erfassen</);
  assert.equal(ANAMNESE_FEHLT_NOTIZ, 'Für diese Patientin / diesen Patienten ist noch keine Anamnese erfasst.');
});
test('Rückfrage 78040: nur bei 78040 UND bestätigt fehlender Anamnese; Texte laut gkv-302', () => {
  assert.equal(frageAnamnese78040({ checks: ['78040', '78010'], hatAnamnese: false }), true);
  assert.equal(frageAnamnese78040({ checks: ['78040'], hatAnamnese: true }), false);
  assert.equal(frageAnamnese78040({ checks: ['78040'], hatAnamnese: null }), false);
  assert.equal(frageAnamnese78040({ checks: ['78010'], hatAnamnese: false }), false);
  assert.equal(frageAnamnese78040({ checks: undefined, hatAnamnese: false }), false);
  assert.equal(ANAMNESE_78040_FRAGE.title, 'Anamnese fehlt');
  assert.equal(ANAMNESE_78040_FRAGE.message, 'Die Anamnese ist Leistungsinhalt der Eingangsbefundung (Anlage 1a Teil 2 Nr. 4.1). Wurde sie erhoben (auch auf Papier)?');
  assert.equal(ANAMNESE_78040_FRAGE.confirmText, 'Anamnese erhoben — speichern');
  assert.equal(ANAMNESE_78040_FRAGE.cancelText, 'Zurück');
});
