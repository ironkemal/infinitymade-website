import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escHtml, mailBetreff } from './html-escape.js';

test('escHtml neutralisiert Tags, Attribute und Anfuehrungszeichen', () => {
  assert.equal(escHtml('<a href="x" onclick=\'y\'>&</a>'), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(escHtml(null), '');
  assert.equal(escHtml(42), '42');
});

test('mailBetreff entfernt Zeilenumbrueche und kuerzt', () => {
  assert.equal(mailBetreff('Max\r\nBcc: boese@example.com'), 'Max Bcc: boese@example.com');
  assert.equal(mailBetreff('x'.repeat(300)).length, 120);
});
