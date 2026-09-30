import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachLeadKartenIk, leadKartenIkFehler, pruefeLeadKartenIk } from './lead-karten-ik.js';

function umgebung() {
  const kasseHoerer = [];
  const ikHoerer = [];
  const kasse = { id: 'lead-krankenkasse', dataset: {}, addEventListener: (t, f) => kasseHoerer.push([t, f]) };
  const ik = {
    id: 'lead-krankenkasseIk',
    value: 'x',
    dataset: {},
    attrs: {},
    focusCalled: false,
    focus() { this.focusCalled = true; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, f) { ikHoerer.push([t, f]); },
  };
  const hinweis = { id: 'lead-krankenkasseIkHinweis', textContent: 'h' };
  const abweichung = { id: 'lead-krankenkasseIkAbweichung', textContent: 'a' };
  const fehler = { id: 'lead-krankenkasseIkFehler', textContent: 'f' };

  const elemente = {
    'lead-krankenkasse': kasse,
    'lead-krankenkasseIk': ik,
    'lead-krankenkasseIkHinweis': hinweis,
    'lead-krankenkasseIkAbweichung': abweichung,
    'lead-krankenkasseIkFehler': fehler,
  };

  globalThis.document = {
    getElementById: id => elemente[id] || null,
    createElement: tag => {
      const el = {
        tagName: tag,
        dataset: {},
        attrs: {},
        style: {},
        insertAdjacentElement() {},
        setAttribute(k, v) { this.attrs[k] = String(v); },
        removeAttribute(k) { delete this.attrs[k]; },
      };
      return el;
    },
  };

  const tippenKasse = () => kasseHoerer.filter(([t]) => t === 'input').forEach(([, f]) => f());
  const tippenIk = () => ikHoerer.filter(([t]) => t === 'input').forEach(([, f]) => f());
  return { kasse, ik, hinweis, abweichung, fehler, kasseHoerer, ikHoerer, tippenKasse, tippenIk };
}

test('lädt den gespeicherten Wert, leer wenn keiner da', () => {
  const { kasse, ik } = umgebung();
  attachLeadKartenIk(kasse, '108310400');
  assert.equal(ik.value, '108310400');
  attachLeadKartenIk(kasse, null);
  assert.equal(ik.value, '');
});

test('Kasse von Hand geändert → Karten-IK leer; Listener nur einmal', () => {
  const { kasse, ik, kasseHoerer, tippenKasse } = umgebung();
  attachLeadKartenIk(kasse, '108310400');
  attachLeadKartenIk(kasse, '108310400');
  assert.equal(kasseHoerer.length, 1);
  tippenKasse();
  assert.equal(ik.value, '');
});

test('ohne Geschwisterfeld passiert nichts', () => {
  const { kasse } = umgebung();
  globalThis.document = { getElementById: () => null };
  assert.doesNotThrow(() => attachLeadKartenIk(kasse, '108310400'));
});

// ── Neue Tests (W2: Karten-IK Validierung) ──────────────────────────────────

test('leadKartenIkFehler: leer, 9 Ziffern, Formatfehler', () => {
  // leer -> ''
  assert.equal(leadKartenIkFehler(''), '');
  assert.equal(leadKartenIkFehler('   '), '');
  assert.equal(leadKartenIkFehler(null), '');
  assert.equal(leadKartenIkFehler(undefined), '');

  // 9 Ziffern (auch mit Leerzeichen/Punkten) -> ''
  assert.equal(leadKartenIkFehler('100167999'), '');
  assert.equal(leadKartenIkFehler('100 167 999'), '');
  assert.equal(leadKartenIkFehler('100.167.999'), '');

  // ungültig -> Text
  const errKurz = leadKartenIkFehler('12345');
  assert.equal(errKurz, 'IK der Krankenkasse muss genau 9 Ziffern haben.');

  const errBuchstabe = leadKartenIkFehler('10016799x');
  assert.equal(errBuchstabe, 'IK der Krankenkasse muss genau 9 Ziffern haben.');

  const errLang = leadKartenIkFehler('1001679999');
  assert.equal(errLang, 'IK der Krankenkasse muss genau 9 Ziffern haben.');
});

test('pruefeLeadKartenIk: blockiert bei Fehler, lässt leere und gültige IK durch', () => {
  const { kasse, ik, fehler, tippenIk } = umgebung();

  // Gültige 9-stellige IK -> true
  ik.value = '100167999';
  assert.equal(pruefeLeadKartenIk(kasse), true);
  assert.equal(fehler.textContent, '');
  assert.equal(ik.attrs['aria-invalid'], undefined);

  // Leeres Feld -> true
  ik.value = '';
  assert.equal(pruefeLeadKartenIk(kasse), true);
  assert.equal(fehler.textContent, '');

  // Ungültige IK -> false, setzt Fehler, aria-invalid und Fokus
  ik.value = '12345';
  ik.focusCalled = false;
  assert.equal(pruefeLeadKartenIk(kasse), false);
  assert.equal(fehler.textContent, 'IK der Krankenkasse muss genau 9 Ziffern haben.');
  assert.equal(ik.attrs['aria-invalid'], 'true');
  assert.equal(ik.focusCalled, true);

  // Nächstes Tippen räumt den Fehler und aria-invalid auf
  tippenIk();
  assert.equal(fehler.textContent, '');
  assert.equal(ik.attrs['aria-invalid'], undefined);
});

test('attachLeadKartenIk: räumt Hinweis-, Abweichungs- und Fehlerelement auf', () => {
  const { kasse, ik, hinweis, abweichung, fehler } = umgebung();
  hinweis.textContent = 'alter Hinweis';
  abweichung.textContent = 'alte Abweichung';
  fehler.textContent = 'alter Fehler';
  ik.setAttribute('aria-invalid', 'true');

  attachLeadKartenIk(kasse, '100167999');
  assert.equal(hinweis.textContent, '');
  assert.equal(abweichung.textContent, '');
  assert.equal(fehler.textContent, '');
  assert.equal(ik.attrs['aria-invalid'], undefined);
});
