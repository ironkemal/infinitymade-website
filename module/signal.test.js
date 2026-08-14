// signal.js — Tests.  Lauf:  npm test    (oder: node --test module/)
//
// Erste Frontend-Tests des Projekts. `signal.js` ist bewusst DOM-frei,
// deshalb läuft es unverändert unter Node.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { on, once, off, emit, emitSync, _reset, _inspect } from './signal.js';

/** Wartet, bis die Microtask-Queue abgearbeitet ist (emit ist verdichtend). */
const tick = () => new Promise((r) => setTimeout(r, 0));

test('on + emit — Zuhörer bekommt die Meldung samt detail', async () => {
  _reset();
  const gesehen = [];
  on('bookings:changed', (d) => gesehen.push(d));

  emit('bookings:changed', { id: 7 });
  assert.deepEqual(gesehen, [], 'emit darf NICHT synchron feuern');

  await tick();
  assert.deepEqual(gesehen, [{ id: 7 }]);
});

test('verdichtet mehrfache Meldungen desselben Themas zu einem Aufruf', async () => {
  _reset();
  let aufrufe = 0;
  let letztes;
  on('bookings:changed', (d) => { aufrufe++; letztes = d; });

  // Typischer Speichervorgang: Termin + Patient + Zähler melden nacheinander.
  emit('bookings:changed', { schritt: 1 });
  emit('bookings:changed', { schritt: 2 });
  emit('bookings:changed', { schritt: 3 });

  await tick();
  assert.equal(aufrufe, 1, 'drei Meldungen dürfen nur einen Refresh auslösen');
  assert.deepEqual(letztes, { schritt: 3 }, 'die letzte Meldung gewinnt');
});

test('verschiedene Themen werden nicht vermischt', async () => {
  _reset();
  const a = [], b = [];
  on('profiles:changed', () => a.push(1));
  on('verordnungen:changed', () => b.push(1));

  emit('profiles:changed');
  emit('verordnungen:changed');
  emit('profiles:changed');

  await tick();
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
});

test('Abmelde-Funktion von on() stoppt weitere Meldungen', async () => {
  _reset();
  let aufrufe = 0;
  const stop = on('profiles:changed', () => aufrufe++);

  emit('profiles:changed');
  await tick();
  assert.equal(aufrufe, 1);

  stop();
  emit('profiles:changed');
  await tick();
  assert.equal(aufrufe, 1, 'nach dem Abmelden darf nichts mehr kommen');
});

test('once() feuert genau einmal', async () => {
  _reset();
  let aufrufe = 0;
  once('bookings:changed', () => aufrufe++);

  emit('bookings:changed');
  await tick();
  emit('bookings:changed');
  await tick();

  assert.equal(aufrufe, 1);
  assert.deepEqual(_inspect(), {}, 'once muss sich selbst aufräumen');
});

test('off() ohne handler entfernt alle Zuhörer des Themas', async () => {
  _reset();
  let aufrufe = 0;
  on('team:changed', () => aufrufe++);
  on('team:changed', () => aufrufe++);
  assert.deepEqual(_inspect(), { 'team:changed': 2 });

  off('team:changed');
  emit('team:changed');
  await tick();

  assert.equal(aufrufe, 0);
  assert.deepEqual(_inspect(), {});
});

test('ein defekter Zuhörer reißt die anderen NICHT mit', async () => {
  _reset();
  const fehlerLog = console.error;
  console.error = () => {};              // erwarteter Fehler, Ausgabe unterdrücken
  try {
    const gelaufen = [];
    on('patients:changed', () => { gelaufen.push('vorher'); });
    on('patients:changed', () => { throw new Error('Panel kaputt'); });
    on('patients:changed', () => { gelaufen.push('nachher'); });

    emit('patients:changed');
    await tick();

    assert.deepEqual(gelaufen, ['vorher', 'nachher'],
      'ein kaputtes Panel darf die anderen nicht veralten lassen');
  } finally {
    console.error = fehlerLog;
  }
});

test('emitSync() feuert sofort, ohne Verdichtung', () => {
  _reset();
  let aufrufe = 0;
  on('bookings:changed', () => aufrufe++);

  emitSync('bookings:changed');
  emitSync('bookings:changed');

  assert.equal(aufrufe, 2, 'emitSync verdichtet bewusst nicht');
});

test('Meldung ohne Zuhörer ist harmlos', async () => {
  _reset();
  assert.doesNotThrow(() => emit('gibtesnicht:changed', { a: 1 }));
  await tick();
});

test('ungültige Argumente werden früh abgelehnt', () => {
  _reset();
  assert.throws(() => on('', () => {}), TypeError);
  assert.throws(() => on('x:changed', 'kein handler'), TypeError);
  assert.throws(() => emit(''), TypeError);
});

test('während der Zustellung darf man sich abmelden', async () => {
  _reset();
  const gelaufen = [];
  const stop = on('bookings:changed', () => { gelaufen.push('a'); stop(); });
  on('bookings:changed', () => gelaufen.push('b'));

  emit('bookings:changed');
  await tick();
  assert.deepEqual(gelaufen, ['a', 'b'], 'Abmelden mitten in der Runde darf nichts überspringen');

  emit('bookings:changed');
  await tick();
  assert.deepEqual(gelaufen, ['a', 'b', 'b']);
});
