// Wächter S8 (M6b): Die Sondertag-Mail geht nur an Patienten, deren Datenschutz-Einwilligung ab v6 die Option
// MITTEILUNG_OPTION_TEXT angekreuzt hat (api-backend/lib/sondertag-mitteilung.js). Der Text dafür liegt in
// Kemals Bereich (module/einwilligung-texte.js). Sobald dort v6+ steht, muss die Option exakt diesen Text tragen —
// sonst erkennt das Backend niemanden als einverstanden (oder, schlimmer, einen anderen Haken).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EINWILLIGUNG_TEXTE } from './einwilligung-texte.js';
import { MITTEILUNG_OPTION_TEXT, MITTEILUNG_MIN_VERSION, datenschutzVersion } from '../api-backend/lib/sondertag-mitteilung.js';

test('E13: ab Datenschutz v6 traegt die Option terminerinnerung exakt den Text, den das Backend prueft', () => {
  const def = EINWILLIGUNG_TEXTE.datenschutz;
  const v = datenschutzVersion(def.version);
  assert.ok(v !== null, `Versionsformat unerwartet: ${def.version}`);
  if (v < MITTEILUNG_MIN_VERSION) return; // heute v5: Mailversand bewusst aus, alle auf die Anrufliste
  const opt = def.optionen.find(o => o.key === 'terminerinnerung');
  assert.ok(opt, 'Option terminerinnerung fehlt');
  assert.equal(opt.text, MITTEILUNG_OPTION_TEXT);
});
