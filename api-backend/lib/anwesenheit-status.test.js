import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anwesenheitStatus } from './anwesenheit-status.js';
import { mitarbeiterDarfStandort } from './standort-zuordnung.js';

// Montag, 23.11.2026 — Berlin = UTC+1
const um = (hhmm) => new Date(`2026-11-23T${hhmm}:00+01:00`);
const fenster = (user_id, start, ende = '18:00', day_of_week = 1, is_active = true) => ({ user_id, day_of_week, start_time: `${start}:00`, end_time: `${ende}:00`, is_active });

test('nach eigenem Dienstbeginn = late, davor/genau = present', () => {
  const zeiten = [fenster('m', '10:00')];
  assert.equal(anwesenheitStatus({ zeiten, empId: 'm', ownerId: 'o', jetzt: um('09:30') }), 'present');
  assert.equal(anwesenheitStatus({ zeiten, empId: 'm', ownerId: 'o', jetzt: um('10:00') }), 'present');
  assert.equal(anwesenheitStatus({ zeiten, empId: 'm', ownerId: 'o', jetzt: um('10:01') }), 'late');
});

test('früher fest 09:00: Dienstbeginn 13:00 um 09:30 ist NICHT verspätet', () => {
  assert.equal(anwesenheitStatus({ zeiten: [fenster('m', '13:00')], empId: 'm', ownerId: 'o', jetzt: um('09:30') }), 'present');
});

test('geteilter Tag: frühester Beginn zählt', () => {
  const zeiten = [fenster('m', '14:00'), fenster('m', '08:00', '12:00')];
  assert.equal(anwesenheitStatus({ zeiten, empId: 'm', ownerId: 'o', jetzt: um('08:15') }), 'late');
});

test('ohne eigene Zeiten → Inhaberzeiten; ohne Fenster am Tag → nie late', () => {
  assert.equal(anwesenheitStatus({ zeiten: [fenster('o', '08:00')], empId: 'm', ownerId: 'o', jetzt: um('08:30') }), 'late');
  assert.equal(anwesenheitStatus({ zeiten: [fenster('m', '08:00', '12:00', 2)], empId: 'm', ownerId: 'o', jetzt: um('11:00') }), 'present');
  assert.equal(anwesenheitStatus({ zeiten: [fenster('m', '08:00', '12:00', 1, false)], empId: 'm', ownerId: 'o', jetzt: um('11:00') }), 'present');
  assert.equal(anwesenheitStatus({ zeiten: [], empId: 'm', ownerId: 'o', jetzt: um('23:00') }), 'present');
});

const sbMit = (rows, error = null) => ({ from: () => ({ select: () => ({ eq: async () => ({ data: rows, error }) }) }) });

test('Check-in-Standort: zugeordnet ja, fremd nein, ohne Zuordnung nur Standard, Fehler nein', async () => {
  assert.equal(await mitarbeiterDarfStandort(sbMit([{ business_id: 'b' }]), { employeeId: 'm', business: { id: 'b' } }), true);
  assert.equal(await mitarbeiterDarfStandort(sbMit([{ business_id: 'b' }]), { employeeId: 'm', business: { id: 'a', is_default: true } }), false);
  assert.equal(await mitarbeiterDarfStandort(sbMit([]), { employeeId: 'm', business: { id: 'a', is_default: true } }), true);
  assert.equal(await mitarbeiterDarfStandort(sbMit([]), { employeeId: 'm', business: { id: 'c', is_default: false } }), false);
  assert.equal(await mitarbeiterDarfStandort(sbMit(null, { message: 'x' }), { employeeId: 'm', business: { id: 'b' } }), false);
});
