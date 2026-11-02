import test from 'node:test';
import assert from 'node:assert/strict';
import { mitteilungHtml, mountMitteilung } from './sondertag-mitteilung.js';

test('Mail-Abschnitt: Empfaenger vorausgewaehlt (abwaehlbar), Mustertext, Knopf mit Anzahl, Namen escaped', () => {
  const html = mitteilungHtml({ weg: 'smtp', mail: [{ bookingId: 'b1', start: '2026-12-24T09:00:00Z', name: '<i>A' }], anruf: [], bereits: [],
    beispiel: { betreff: 'Terminabsage – P', text: 'Guten Tag' } });
  assert.match(html, /class="stm-wahl" value="b1" checked/);
  assert.match(html, /Freigeben und senden \(1\)/);
  assert.match(html, /Mustertext ansehen/);
  assert.ok(!html.includes('<i>A'));
});

test('Ohne Versandweg: Hinweis, kein Sende-Knopf; ohne Einwilligung: Hinweis Telefon', () => {
  const ohne = mitteilungHtml({ weg: null, mail: [], anruf: [{}], bereits: [] });
  assert.match(ohne, /nicht eingerichtet/);
  assert.ok(!ohne.includes('stmSenden'));
  assert.match(mitteilungHtml({ weg: 'gmail', mail: [], anruf: [{}], bereits: [] }), /Niemand hat in E-Mail-Mitteilungen eingewilligt/);
  assert.match(mitteilungHtml({ weg: 'gmail', mail: [], anruf: [], bereits: [{}, {}] }), /Bereits per E-Mail informiert: 2/);
  assert.equal(mitteilungHtml(null), '');
});

test('Versandergebnis: unklaren Status mit Telefonhinweis melden, niemals als reinen Erfolg', async (t) => {
  for (const daten of [
    { gesendet: 1, fehler: 0, unklar: 1 },
    { gesendet: 0, fehler: 1, unklar: 1 },
    { gesendet: 1, fehler: 0, unklar: 0 },
  ]) {
    let senden;
    const toast = [];
    const ergebnis = { textContent: '' };
    const wahl = { value: 'b1', disabled: false, addEventListener() {} };
    const knopf = { disabled: false, addEventListener(_event, fn) { senden = fn; } };
    const host = {
      innerHTML: '',
      querySelector(selector) { return selector === '#stmSenden' ? knopf : ergebnis; },
      querySelectorAll() { return [wahl]; },
    };
    let aufrufe = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      json: async () => ++aufrufe === 1
        ? { weg: 'smtp', mail: [{ bookingId: 'b1', start: '2026-12-24T09:00:00Z' }] }
        : daten,
    }));
    try {
      await mountMitteilung(host, {
        apiBase: 'https://example.invalid', von: '2026-12-24',
        showConfirmModal: async () => true,
        showToast: (...args) => toast.push(args),
      });
      await senden();
      if (daten.unklar) {
        assert.match(ergebnis.textContent, /1 Versandstatus unklar \(bitte anrufen\)/);
        assert.deepEqual(toast.at(-1), ['Versandstatus unklar. Bitte telefonisch informieren.', 'error']);
      } else {
        assert.equal(ergebnis.textContent, '1 gesendet');
        assert.deepEqual(toast.at(-1), ['E-Mails gesendet ✓', undefined]);
      }
      assert.equal(knopf.disabled, true);
      assert.equal(wahl.disabled, true);
      assert.equal(aufrufe, 2);
    } finally {
      mock.mock.restore();
    }
  }
});
