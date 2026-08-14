// plz.js — Tests für die Datentabelle.  Lauf:  node --test module/
//
// Getestet wird hier die erzeugte Tabelle, nicht der DOM-Teil: der Wert dieser
// Funktion steht und fällt damit, dass in `plz-orte.json` Orte stehen und keine
// Firmenpostfächer. Genau das ging beim ersten Erzeugen schief — der Filter
// über Rechtsformen liess "Job-Center Berlin Mitte" und "Amtsgericht Nürnberg"
// durch, und diese Namen wären als Wohnort in die Patientenakte gelaufen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { orte, quelle } = JSON.parse(
  readFileSync(new URL('./plz-orte.json', import.meta.url), 'utf8')
);

test('Tabelle nennt ihre Quelle — CC BY 4.0 verlangt die Attribution', () => {
  assert.match(quelle, /CC BY 4\.0/);
});

test('bekannte Orte stehen richtig drin', () => {
  assert.equal(orte['90402'], 'Nürnberg');     // Praxisort des Beta-Kunden
  assert.equal(orte['53721'], 'Siegburg');     // Sitz des Herstellers
  assert.equal(orte['10115'], 'Berlin');
  assert.equal(orte['91567'], 'Herrieden');    // kleine Gemeinde, nur eine PLZ
});

test('Großempfänger-Postleitzahlen sind nicht enthalten', () => {
  assert.equal(orte['90327'], undefined);      // war "Novartis Pharma GmbH"
  assert.equal(orte['10086'], undefined);      // war "Job-Center Berlin Mitte"
  assert.equal(orte['10098'], undefined);      // war "Uni Klinikum Charite"
});

test('kein Eintrag sieht aus wie ein Firmenname', () => {
  const verdaechtig = /\b(gmbh|mbh|\bag\b|kgaa|e\.? ?v\.?|amtsgericht|job-?center|agentur für arbeit|klinikum|versicherung|bundesagentur)\b/i;
  const treffer = Object.entries(orte)
    .flatMap(([plz, v]) => (Array.isArray(v) ? v : [v]).map(o => [plz, o]))
    .filter(([, o]) => verdaechtig.test(o));
  assert.deepEqual(treffer, [], `Firmennamen in der Ortstabelle: ${JSON.stringify(treffer.slice(0, 5))}`);
});

test('jede PLZ hat fünf Stellen und mindestens einen Ort', () => {
  for (const [plz, v] of Object.entries(orte)) {
    assert.match(plz, /^\d{5}$/);
    const liste = Array.isArray(v) ? v : [v];
    assert.ok(liste.length > 0 && liste.every(o => typeof o === 'string' && o.trim()), plz);
  }
});

test('Umfang ist plausibel — Deutschland hat gut 8.000 Postleitzahlen', () => {
  const n = Object.keys(orte).length;
  assert.ok(n > 7000 && n < 10000, `unerwartete Anzahl: ${n}`);
});
