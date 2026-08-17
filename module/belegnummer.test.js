import test from 'node:test';
import assert from 'node:assert/strict';
import { belegnummerText, belegnummerRosette } from './belegnummer.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

test('setzt die Nummer aus Patienten- und Verordnungsnummer zusammen', () => {
  assert.equal(belegnummerText({ verordnungsnummer: 3 }, { patientennummer: 1 }), '1-3');
  assert.equal(belegnummerText({ verordnungsnummer: 11 }, { patientennummer: 12 }), '12-11');
});

test('die gespeicherte belegnummer hat Vorrang — sie liegt so bei der Kasse', () => {
  // Anlage 1 TP5 V21 Kap. 7.3: einmal geschrieben, nie geaendert. Weicht die
  // Anzeige davon ab, sucht man bei einer Rueckmeldung den falschen Beleg.
  assert.equal(
    belegnummerText({ belegnummer: '7-2', verordnungsnummer: 9 }, { patientennummer: 4 }),
    '7-2'
  );
  // Auch der alte UUID-Anfang bleibt stehen, wenn er eingefroren wurde.
  assert.equal(belegnummerText({ belegnummer: 'a3f9c2e1-4' }, { patientennummer: 4 }), 'a3f9c2e1-4');
});

test('ohne Patientennummer bleibt nur die Verordnungsnummer, erkennbar als solche', () => {
  assert.equal(belegnummerText({ verordnungsnummer: 3 }), '#3');
  assert.equal(belegnummerText({ verordnungsnummer: 3 }, { patientennummer: null }), '#3');
});

test('erste Verordnung des ersten Patienten ist 1-1, nicht leer', () => {
  // 0 und 1 sind hier die gefaehrlichen Werte: eine falsche
  // Wahrheitspruefung haette 1-1 verschluckt.
  assert.equal(belegnummerText({ verordnungsnummer: 1 }, { patientennummer: 1 }), '1-1');
});

test('ohne jede Nummer kommt nichts zurueck — kein Platzhalter', () => {
  assert.equal(belegnummerText({}), '');
  assert.equal(belegnummerText(null), '');
  assert.equal(belegnummerText({ verordnungsnummer: null }, { patientennummer: 5 }), '');
  assert.equal(belegnummerRosette({}, { escapeHtml: esc }), '');
});

test('Rosette enthaelt die Nummer und ist gefluchtet', () => {
  const html = belegnummerRosette({ verordnungsnummer: 3 }, { patientennummer: 1, escapeHtml: esc });
  assert.match(html, /1-3/);
  assert.match(html, /<span class="belegnr-rosette"/);

  const boese = belegnummerRosette({ belegnummer: '<img src=x>' }, { escapeHtml: esc });
  assert.ok(!boese.includes('<img'), 'Belegnummer darf kein Markup einschleusen');
});
