// Regression 23.11.2026: Seit der Bereichs-Navigation ist jeder andere Bereich der Einstellungen ausgeblendet.
// Wer nur switchPanel('settings') + scrollIntoView macht, landet im Nichts — Sprünge müssen über
// gehZuEinstellung laufen (öffnet den Bereich via einstellungenZeigeAbschnitt, scrollt, fokussiert).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lies = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('gehZuEinstellung öffnet den Bereich, bevor es scrollt', () => {
  const src = lies('../dashboard.js');
  const m = src.match(/async function gehZuEinstellung\(sectionId, focusId\) \{\n([^\n]*)/);
  assert.ok(m, 'gehZuEinstellung nicht gefunden');
  assert.ok(m[1].indexOf("await switchPanel('settings')") < m[1].indexOf('einstellungenZeigeAbschnitt(sectionId)'), m[1]);
});

test('Einrichtungsring springt über gehZuEinstellung', () => {
  const src = lies('../dashboard.js');
  assert.match(src, /mountEinrichtungRing\(\{[^\n]*springe: \(id\) => \{ void gehZuEinstellung\(id\); \}/);
});

test('„Was fehlt noch?“ (Briefkopf) springt über gehZuEinstellung mit Feld', () => {
  const src = lies('./branding-ui.js');
  assert.match(src, /globalThis\.gehZuEinstellung\(a\.dataset\.sprung, a\.dataset\.feld/);
  assert.match(src, /data-feld="\$\{esc\(x\.feld/);
});

test('kein Modul springt mit switchPanel(\'settings\') + scrollIntoView an gehZuEinstellung vorbei', () => {
  for (const datei of ['../dashboard.js', './rechte-ohne-standort.js', './einrichtung-ring.js', './branding-ui.js', './mailversand.js']) {
    const src = lies(datei);
    const roh = /(switchPanel|wechslePanel)\('settings'\)[^\n]{0,160}scrollIntoView/.test(src);
    assert.equal(roh, false, `${datei}: Panelwechsel + scrollIntoView ohne Bereich zu öffnen`);
  }
});

test('IK-Lücke zeigt auf den Abschnitt, in dem das Feld steht', () => {
  const html = lies('../dashboard.html');
  const abschnitt = html.slice(html.indexOf('id="settingsAbrechnungSection"'), html.indexOf('id="settingsTiSection"'));
  assert.ok(abschnitt.includes('id="setIkNumber"'), 'setIkNumber liegt nicht in settingsAbrechnungSection');
  assert.match(lies('./branding.js'), /'ik', 'Institutionskennzeichen \(IK\)', 'settingsAbrechnungSection', 'setIkNumber'/);
});
