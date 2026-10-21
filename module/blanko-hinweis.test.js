import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBlankoHinweis } from './blanko-hinweis.js';

test('unbestätigte Blanko-Grundlagen erzeugen niemals eine positive Vergütungsampel', () => {
  for (const rx of [
    { rezept_typ: 'blanko' },
    { is_blanko: true, heilmittel_typ_blanko: 'unbekannt', vorrangig_einheiten: null },
    { is_blanko: true, therapie_bereich: 'ergotherapie', vorrangig_einheiten: 0 },
    { is_blanko: true, heilmittel_typ_blanko: 'fraktur', vorrangig_einheiten: 3, ergaenzend_einheiten: 1 },
    { is_blanko: true, heilmittel_typ_blanko: 'fraktur', vorrangig_einheiten: 99 },
  ]) {
    const html = renderBlankoHinweis(rx, 2);
    assert.match(html, /Vergütungszone nicht berechenbar/);
    assert.match(html, /2 Sitzungen dokumentiert/);
    assert.doesNotMatch(html, /GRÜNE ZONE|ROTE ZONE|ampel-gruen|ampel-rot|9 %|blanko-bar/);
  }
});

test('andere Rezeptarten erhalten keinen Blanko-Hinweis', () => {
  for (const rx of [null, {}, { rezept_typ: 'standard' }, { is_blanko: false }]) {
    assert.equal(renderBlankoHinweis(rx), '');
  }
});

test('Datum und dokumentierte Sitzungen bleiben erhalten; freie Werte gelangen nicht in HTML', () => {
  assert.match(renderBlankoHinweis({ is_blanko: true, gueltig_bis: '2026-10-31' }, 1), /31\.10\.2026/);
  assert.match(renderBlankoHinweis({ is_blanko: true }, 1), /1 Sitzung dokumentiert/);
  for (const gueltig_bis of ['<img src=x onerror=alert(1)>', '2026-02-30', '9999-99-99', '', null]) {
    const html = renderBlankoHinweis({ is_blanko: true, gueltig_bis }, '<script>');
    assert.doesNotMatch(html, /Gültig bis:|<img|<script>|Sitzung/);
  }
});

test('Fristsignal bleibt auch an Zeitumstellung und bei Ablauf erhalten', () => {
  const rx = { is_blanko: true, gueltig_bis: '2026-10-26' };
  assert.match(renderBlankoHinweis(rx, 0, new Date(2026, 9, 24)), /noch 2 Tage/);
  assert.match(renderBlankoHinweis(rx, 0, new Date(2026, 9, 27)), /abgelaufen/);
});
