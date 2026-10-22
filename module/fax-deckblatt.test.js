import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueFaxDeckblattHtml, VERTRAULICH } from './fax-deckblatt.js';

const basis = {
  praxis: { name: 'Praxis Test', strasse: 'Hauptstr. 1', ort: '53721 Siegburg', telefon: '02241 123' },
  empfaenger: { name: 'Dr. med. Anna Muster', fax: '02241 999', telefon: '' },
  betreff: 'Therapiebericht',
  seiten: 3,
  datum: new Date('2026-10-22T10:00:00'),
};

test('Deckblatt enthält Empfänger, Faxnummer, Seiten und Vertraulichkeitshinweis', () => {
  const html = baueFaxDeckblattHtml(basis);
  assert.match(html, /Dr\. med\. Anna Muster/);
  assert.match(html, /02241 999/);
  assert.match(html, /3 \(inkl\. Deckblatt\)/);
  assert.match(html, /22\.10\.2026/);
  assert.ok(html.includes('§ 203 StGB'));
  assert.ok(VERTRAULICH.includes('telefonisch'));
});

test('Praxis-Telefon steht drauf — für den Rückruf bei Fehlzustellung', () => {
  assert.match(baueFaxDeckblattHtml(basis), /02241 123/);
});

test('Eingaben werden escaped', () => {
  const html = baueFaxDeckblattHtml({ ...basis, betreff: '<img src=x onerror=alert(1)>', nachricht: 'a\n<b>' });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
  assert.ok(html.includes('a<br>&lt;b&gt;'));
});

test('Leere Felder erzeugen keine leeren Zeilen, ungültige Seitenzahl fällt weg', () => {
  const html = baueFaxDeckblattHtml({ ...basis, seiten: 'x', empfaenger: { name: 'X', fax: '' } });
  assert.ok(!html.includes('inkl. Deckblatt'));
  assert.ok(!/<th>Fax<\/th><td><\/td>/.test(html));
});

test('Keine externen Ressourcen im Druckfenster (vendor-Regel, Box offline)', () => {
  const html = baueFaxDeckblattHtml(basis);
  assert.ok(!/https?:\/\//.test(html));
});
