// onprem O-140 (30.09.2026): Praxisstandort ohne Nominatim — Zustandstext.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standortStatusText, gpsAnzeige, gpsSchalterLesen, standortFuerCheckin, GPS_HINWEIS } from './praxis-standort.js';

test('standortStatusText: fehlend, leer, gesetzt', () => {
  assert.match(standortStatusText(null), /nicht eingerichtet/);
  assert.match(standortStatusText({ id: 'b', clinic_lat: null, clinic_lng: null }), /nicht eingerichtet/);
  assert.match(standortStatusText({ id: 'b', clinic_lat: 50.8, clinic_lng: 7.2 }, true), /gesetzt \(50\.80000, 7\.20000\).*150 m/);
  // Schalter aus: kein „geprüft" behaupten (P2 canli-test 30.09.2026)
  assert.match(standortStatusText({ id: 'b', clinic_lat: 50.8, clinic_lng: 7.2 }), /GPS-Prüfung ist aus/);
  assert.doesNotMatch(standortStatusText({ id: 'b', clinic_lat: 50.8, clinic_lng: 7.2 }), /150 m/);
});

test('gpsAnzeige: true ✓, false ⚠, NULL nicht geprüft, ohne Check-in —', () => {
  assert.equal(gpsAnzeige({ check_in_at: 'x', check_in_valid: true }).icon, '✓');
  assert.equal(gpsAnzeige({ check_in_at: 'x', check_in_valid: false }).icon, '⚠');
  assert.equal(gpsAnzeige({ check_in_at: 'x', check_in_valid: null }).icon, 'nicht geprüft');
  assert.equal(gpsAnzeige({ check_in_at: 'x' }).icon, 'nicht geprüft');
  assert.equal(gpsAnzeige({ check_in_at: null, check_in_valid: null }).icon, '—');
});

test('standortFuerCheckin: Schalter aus fragt nie; an + Fehler → ohne Standort', async () => {
  let gefragt = 0;
  const hole = async () => { gefragt++; return { lat: 50.8, lng: 7.2 }; };
  assert.deepEqual(await standortFuerCheckin(false, hole), { ohneStandort: false });
  assert.equal(gefragt, 0);
  assert.deepEqual(await standortFuerCheckin(true, hole), { lat: 50.8, lng: 7.2, ohneStandort: false });
  assert.deepEqual(await standortFuerCheckin(true, async () => { throw new Error('verweigert'); }), { ohneStandort: true });
  assert.deepEqual(await standortFuerCheckin(true, async () => ({ lat: NaN, lng: 1 })), { ohneStandort: true });
});

test('gpsSchalterLesen: liest Owner-Profil, Fehler → false; Hinweistext', async () => {
  const sb = (ich, owner) => ({ from: () => { let id; const k = { select: () => k, eq: (_, v) => { id = v; return k; }, maybeSingle: async () => ({ data: id === 'emp' ? ich : owner }) }; return k; } });
  assert.equal(await gpsSchalterLesen(sb({ role: 'employee', owner_id: 'own' }, { gps_checkin_pruefen: true }), 'emp'), true);
  assert.equal(await gpsSchalterLesen(sb({ role: 'employee', owner_id: 'own' }, { gps_checkin_pruefen: false }), 'emp'), false);
  assert.equal(await gpsSchalterLesen({ from: () => { throw new Error('x'); } }, 'emp'), false);
  assert.match(GPS_HINWEIS, /150 m .* nur das Ergebnis\.$/);
});
