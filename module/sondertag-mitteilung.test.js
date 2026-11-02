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
    { gesendet: 0, fehler: 1, unklar: 1, httpStatus: 409, error: 'Mailserver nicht erreichbar.' },
    { gesendet: 1, fehler: 1, unklar: 0, httpStatus: 409, error: 'Mailserver nicht erreichbar.' },
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
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      const vorschau = ++aufrufe === 1;
      return {
        ok: vorschau || !daten.httpStatus, status: vorschau ? 200 : daten.httpStatus || 200,
        json: async () => vorschau
          ? { weg: 'smtp', mail: [{ bookingId: 'b1', start: '2026-12-24T09:00:00Z' }] }
          : daten,
      };
    });
    try {
      await mountMitteilung(host, {
        apiBase: 'https://example.invalid', von: '2026-12-24',
        showConfirmModal: async () => true,
        showToast: (...args) => toast.push(args),
      });
      await senden();
      if (daten.unklar) {
        assert.match(ergebnis.textContent, /1 Versandstatus unklar \(bitte anrufen\)/);
        assert.match(toast.at(-1)[0], /Versandstatus unklar/);
        assert.equal(toast.at(-1)[1], 'error');
      } else if (daten.httpStatus) {
        assert.match(ergebnis.textContent, /1 gesendet/);
        assert.match(ergebnis.textContent, /1 fehlgeschlagen/);
        assert.deepEqual(toast.at(-1), [daten.error, 'error']);
      } else {
        assert.equal(ergebnis.textContent, '1 gesendet');
        assert.deepEqual(toast.at(-1), ['E-Mails gesendet ✓', undefined]);
      }
      if (daten.httpStatus) assert.match(ergebnis.textContent, /Mailserver nicht erreichbar/);
      assert.equal(knopf.disabled, !daten.httpStatus);
      assert.equal(wahl.disabled, !daten.httpStatus);
      assert.equal(aufrufe, 2);
    } finally {
      mock.mock.restore();
    }
  }
});

test('Vorschau: HTTP- und Netzwerkfehler bleiben sichtbar, ohne Versand auszulösen', async (t) => {
  for (const status of [401, 503, 'offline']) {
    const host = { innerHTML: 'alter Inhalt' };
    let calls = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      if (status === 'offline') throw new TypeError('offline');
      return { ok: false, status, json: async () => ({ error: '<b>Vorschau nicht verfügbar</b>' }) };
    });
    try {
      await mountMitteilung(host, { apiBase: 'https://example.invalid', von: '2026-12-24' });
      assert.match(host.innerHTML, /role="status"/);
      assert.match(host.innerHTML, /telefonisch informieren/);
      assert.ok(!host.innerHTML.includes('<b>'));
      assert.ok(!host.innerHTML.includes('stmSenden'));
      assert.equal(calls, 1);
    } finally { mock.mock.restore(); }
  }
});
