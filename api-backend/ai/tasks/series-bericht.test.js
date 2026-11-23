import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berichtOhneIds } from './series-scheduler.js';

test('KI-Serienbericht zeigt Namen statt Mitarbeiter-UUID (Live-Test 23.11.2026)', () => {
  const id = '501c1c80-1111-4222-8333-444455556666';
  assert.equal(berichtOhneIds(`mit dem bevorzugten Mitarbeiter ${id}.`, [{ id, name: 'Synthetische Therapeutin' }]), 'mit dem bevorzugten Mitarbeiter Synthetische Therapeutin.');
  assert.equal(berichtOhneIds(`Mitarbeiter ${id}`, []), 'Mitarbeiter die gewählte Fachkraft');
  assert.equal(berichtOhneIds('Alle Termine dienstags.', undefined), 'Alle Termine dienstags.');
});
