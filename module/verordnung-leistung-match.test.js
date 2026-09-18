import test from 'node:test';
import assert from 'node:assert/strict';
import { passendeLeistungId } from './verordnung-leistung-match.js';

const dienste = [
  { id: 'nagelspange', title: 'Nagelspangenbehandlung', code: '' },
  { id: 'podo-gross', title: 'Podologische Behandlung (groß)', code: '', gkv_position_nr: '02501' },
  { id: 'befund', title: 'Eingangsbefundung', code: '78040' },
];

test('HPNR-Treffer geht vor Freitext', () => {
  const rx = { heilmittel: 'Podologische Behandlung (groß)', heilmittel_position: '02501' };
  assert.equal(passendeLeistungId(rx, dienste), 'podo-gross');
});

test('Freitext bidirektional: langer Verordnungstext, kurzer Titel', () => {
  const rx = { heilmittel: 'Podologische Behandlung (groß)' };
  assert.equal(passendeLeistungId(rx, dienste), 'podo-gross');
});

test('Code-Treffer ueber heilmittel_position', () => {
  const rx = { heilmittel_position: '78040' };
  assert.equal(passendeLeistungId(rx, dienste), 'befund');
});

test('ohne Treffer null statt Rueckfall auf die erste Leistung (Ops #306)', () => {
  const rx = { heilmittel: 'Manuelle Lymphdrainage', heilmittel_position: '99999' };
  assert.equal(passendeLeistungId(rx, dienste), null);
});

test('leere/keine Verordnungsangaben ergeben null', () => {
  assert.equal(passendeLeistungId({}, dienste), null);
  assert.equal(passendeLeistungId(null, dienste), null);
});

test('keine Leistungen im Katalog ergibt null', () => {
  assert.equal(passendeLeistungId({ heilmittel: 'egal' }, []), null);
});
