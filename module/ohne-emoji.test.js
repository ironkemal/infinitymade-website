import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zerlege, nurText } from './ohne-emoji.js';

test('zerlege: ohne Emoji → null; typografische Zeichen bleiben', () => {
  assert.equal(zerlege('Speichern'), null);
  assert.equal(zerlege('✓ erledigt ✕ © 2026 ™ ↩ zurück'), null);
});

test('zerlege: Bedeutung → Symbol, Dekoration fällt weg', () => {
  assert.deepEqual(zerlege('⚠️ Kassenzertifikat läuft ab'), [{ symbol: 'warn' }, { text: ' Kassenzertifikat läuft ab' }]);
  assert.deepEqual(zerlege('🖨 Drucken'), [{ symbol: 'druck' }, { text: ' Drucken' }]);
  assert.deepEqual(zerlege('🎂 Geburtstage'), [{ text: 'Geburtstage' }]);
  assert.deepEqual(zerlege('Urlaub 🌴'), [{ text: 'Urlaub ' }]);
});

test('zerlege: Haken-Emojis werden typografisch', () => {
  assert.deepEqual(zerlege('✅ Gespeichert'), [{ text: '✓ Gespeichert' }]);
  assert.deepEqual(zerlege('❌ Fehler'), [{ text: '✕ Fehler' }]);
});

test('nurText: für Optionen und title', () => {
  assert.equal(nurText('🦶 Podologie'), 'Podologie');
  assert.equal(nurText('⚠ Achtung'), 'Achtung');
  assert.equal(nurText('ohne'), 'ohne');
});
