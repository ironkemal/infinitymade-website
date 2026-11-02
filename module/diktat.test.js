import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPreferredMimeType,
  formatDuration,
  insertTextAtCursor,
  DIKTAT_LEGAL_NOTICE,
  MIME_CANDIDATES
} from './diktat.js';

test('DIKTAT_LEGAL_NOTICE matches exact required German text', () => {
  assert.equal(
    DIKTAT_LEGAL_NOTICE,
    'Ihre Sprache wird zur Umschrift an Microsoft Azure (EU, Schweden) gesendet und von Praxura nicht gespeichert – bitte nur diktieren, was zur Dokumentation nötig ist.'
  );
});

test('getPreferredMimeType: selects highest priority supported mime type', () => {
  // Supports all: picks first candidate
  const supportAll = () => true;
  assert.equal(getPreferredMimeType(supportAll), 'audio/webm;codecs=opus');

  // No webm, only ogg supported
  const supportOnlyOgg = (mime) => mime.startsWith('audio/ogg');
  assert.equal(getPreferredMimeType(supportOnlyOgg), 'audio/ogg;codecs=opus');

  // Only mp4 supported
  const supportOnlyMp4 = (mime) => mime === 'audio/mp4';
  assert.equal(getPreferredMimeType(supportOnlyMp4), 'audio/mp4');

  // Nothing supported: defaults to audio/webm
  const supportNone = () => false;
  assert.equal(getPreferredMimeType(supportNone), 'audio/webm');

  // No checker function: defaults to audio/webm
  assert.equal(getPreferredMimeType(null), 'audio/webm');
});

test('formatDuration: formats seconds accurately as M:SS', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(5), '0:05');
  assert.equal(formatDuration(9), '0:09');
  assert.equal(formatDuration(10), '0:10');
  assert.equal(formatDuration(59), '0:59');
  assert.equal(formatDuration(60), '1:00');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(119), '1:59');
  assert.equal(formatDuration(120), '2:00');
  assert.equal(formatDuration(180), '3:00');
  // Bounds & non-number handling
  assert.equal(formatDuration(-10), '0:00');
  assert.equal(formatDuration(NaN), '0:00');
  assert.equal(formatDuration('65'), '1:05');
});

test('insertTextAtCursor: inserts text at cursor position and returns selection bounds', () => {
  // 1. Insert in empty text
  const res1 = insertTextAtCursor('', 0, 0, 'Hallo Praxis');
  assert.equal(res1.newText, 'Hallo Praxis');
  assert.equal(res1.selectionStart, 0);
  assert.equal(res1.selectionEnd, 12);

  // 2. Insert at middle cursor
  const original = 'Guten Tag, wie geht es?';
  const insert = 'schönen ';
  const res2 = insertTextAtCursor(original, 6, 6, insert);
  assert.equal(res2.newText, 'Guten schönen Tag, wie geht es?');
  assert.equal(res2.selectionStart, 6);
  assert.equal(res2.selectionEnd, 6 + insert.length);
  assert.equal(res2.newText.slice(res2.selectionStart, res2.selectionEnd), insert);

  // 3. Replace selected text
  const res3 = insertTextAtCursor('Liebe Kollegin', 6, 14, 'Freundin');
  assert.equal(res3.newText, 'Liebe Freundin');
  assert.equal(res3.selectionStart, 6);
  assert.equal(res3.selectionEnd, 14);

  // 4. Undefined/null cursor appends to the end
  const res4 = insertTextAtCursor('Text davor', undefined, undefined, ' und danach');
  assert.equal(res4.newText, 'Text davor und danach');
  assert.equal(res4.selectionStart, 10);
  assert.equal(res4.selectionEnd, 21);
});
