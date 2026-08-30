import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eintraegeFuer, TERMIN_SELEKTOR } from './kalender-kontextmenue.js';

const ids = (termin) => eintraegeFuer(termin).map(e => e.id);
const eintrag = (termin, id) => eintraegeFuer(termin).find(e => e.id === id);

test('offener Termin: alle Handlungen wählbar', () => {
  const t = { id: '1', status: 'confirmed' };
  assert.deepEqual(ids(t), [
    'wahrgenommen', 'nicht_erschienen', 'verschieben', 'trenner', 'oeffnen', 'absagen',
  ]);
  for (const id of ['wahrgenommen', 'nicht_erschienen', 'verschieben']) {
    assert.equal(eintrag(t, id).deaktiviert, false, id);
  }
});

test('fehlender Status gilt als offen — sonst waere das Menue nach einem Teil-Select leer', () => {
  // Die Wochenansicht laedt nicht alle Spalten; ein Termin ohne `status` darf
  // deshalb nicht wie ein abgeschlossener behandelt werden.
  assert.equal(eintrag({ id: '1' }, 'wahrgenommen').deaktiviert, false);
});

test('erledigter Termin: Statuswechsel abgeblendet, Öffnen und Absagen bleiben', () => {
  for (const status of ['completed', 'no_show', 'cancelled', 'pending']) {
    const t = { id: '1', status };
    assert.equal(eintrag(t, 'wahrgenommen').deaktiviert, true, status);
    assert.equal(eintrag(t, 'nicht_erschienen').deaktiviert, true, status);
    assert.equal(eintrag(t, 'verschieben').deaktiviert, true, status);
    // Absagen bleibt: ein doppelt gebuchter oder falsch angelegter Termin muss
    // auch dann noch weggehen, wenn er schon abgehakt wurde.
    assert.equal(eintrag(t, 'absagen').deaktiviert, undefined, status);
    assert.ok(eintrag(t, 'oeffnen'));
  }
});

test('die Eintraege wechseln nie die Plaetze', () => {
  // Abblenden statt Weglassen ist Absicht: ein Menue mit wanderndem Inhalt
  // trifft man nicht mehr blind.
  const offen = ids({ status: 'confirmed' });
  const zu = ids({ status: 'completed' });
  assert.deepEqual(offen, zu);
});

test('Gruppentermin fuehrt nur ins Panel', () => {
  // Die Handlungen betreffen die Kinder-Buchungen, nicht den Kopf.
  const t = { id: '1', status: 'confirmed', is_group: true };
  assert.deepEqual(ids(t), ['oeffnen']);
});

test('Teilnehmer einer Gruppe ist ein normaler Termin', () => {
  const t = { id: '2', status: 'confirmed', is_group: true, group_parent_id: '1' };
  assert.ok(ids(t).includes('wahrgenommen'));
});

test('Absagen ist als gefaehrlich markiert, sonst nichts', () => {
  const gefaehrlich = eintraegeFuer({ status: 'confirmed' }).filter(e => e.gefahr);
  assert.deepEqual(gefaehrlich.map(e => e.id), ['absagen']);
});

test('der Selektor deckt alle drei Ansichten ab', () => {
  for (const klasse of ['.dv-booking-block', '.wv-booking-block', '.month-event-pill']) {
    assert.ok(TERMIN_SELEKTOR.includes(klasse), klasse);
  }
});
