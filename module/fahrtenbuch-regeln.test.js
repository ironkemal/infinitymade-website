import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAHRT_ZWECK,
  PATIENTENVERZEICHNIS_HINWEIS,
  fahrtReferenz,
  fahrtZweckUndZiel,
  fahrtenbuchCsv,
  patientenverzeichnisCsv
} from './fahrtenbuch-regeln.js';

test('fahrtReferenz: Normalfall, Grossschreibung, Bindestriche entfernen', () => {
  assert.equal(fahrtReferenz('12345678-abcd-1234-5678-1234567890ab'), 'P-12345678');
  assert.equal(fahrtReferenz('abcdef12-3456-7890-abcd-ef1234567890'), 'P-ABCDEF12');
  assert.equal(fahrtReferenz('ABCDEF12'), 'P-ABCDEF12');
  assert.equal(fahrtReferenz('a1-b2-c3-d4'), 'P-A1B2C3D4');
});

test('fahrtReferenz: ungültige und unvollständige Eingaben liefern leeren String', () => {
  assert.equal(fahrtReferenz(null), '');
  assert.equal(fahrtReferenz(undefined), '');
  assert.equal(fahrtReferenz(''), '');
  assert.equal(fahrtReferenz(12345678), '');
  assert.equal(fahrtReferenz({ id: '12345678' }), '');
  assert.equal(fahrtReferenz('1234-567'), ''); // 7 Zeichen (weniger als 8 Hex)
  assert.equal(fahrtReferenz('12345'), '');
  assert.equal(fahrtReferenz('xyz12345'), ''); // keine gültigen Hex-Zeichen
  assert.equal(fahrtReferenz('not-a-hex-id'), '');
});

test('fahrtZweckUndZiel: anonymisiert mit Referenz, kein Name, kein Komma/Strasse', () => {
  const bookingId = 'e3b0c442-98fc-1c14-9afe-463a3df005ca';
  const res = fahrtZweckUndZiel(bookingId);
  assert.equal(res.zweck, FAHRT_ZWECK);
  assert.equal(res.zielort, 'Patientenbesuch (s. Verzeichnis Nr. P-E3B0C442)');
  assert.match(res.zielort, /P-E3B0C442/);
  assert.doesNotMatch(res.zielort, /Max|Muster/i);
  assert.doesNotMatch(res.zielort, /,|Straße|Strasse/i);
});

test('fahrtZweckUndZiel: ohne Referenz Rückfall auf schlichten Zweck', () => {
  const resNull = fahrtZweckUndZiel(null);
  assert.equal(resNull.zweck, 'Patientenbesuch');
  assert.equal(resNull.zielort, 'Patientenbesuch');

  const resLeer = fahrtZweckUndZiel('');
  assert.equal(resLeer.zweck, 'Patientenbesuch');
  assert.equal(resLeer.zielort, 'Patientenbesuch');
});

test('fahrtenbuchCsv: Kopfzeile exakt, leeres Array liefert nur Kopfzeile', () => {
  const kopf = 'lfd. Nr./Referenz;Datum;Kennzeichen;Fahrer;Km-Stand Beginn;Km-Stand Ende;gefahrene km;Abfahrtsort;Reiseziel;Reisezweck;Fahrtart';
  assert.equal(fahrtenbuchCsv([]), kopf);
  assert.equal(fahrtenbuchCsv(null), kopf);
  assert.equal(fahrtenbuchCsv().split(';').length, 11);
});

test('fahrtenbuchCsv: 11 Spalten je Zeile, Km-Werte ungequotet', () => {
  const row = {
    booking_id: 'a1b2c3d4-0000-0000-0000-000000000000',
    lead_id: 'l1',
    fahrt_started_at: '2026-09-30T08:00:00Z',
    kennzeichen_snapshot: 'B-XY 1234',
    kind_snapshot: 'gewerblich',
    start_km: 15000,
    end_km: 15025,
    distance_km: 25,
    abfahrtsort: 'Praxis Mitte',
    _therapist: 'Dr. Schmidt'
  };
  const csv = fahrtenbuchCsv([row]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  const cols = lines[1].split(';');
  assert.equal(cols.length, 11);
  assert.equal(cols[0], '"P-A1B2C3D4"');
  assert.equal(cols[2], '"B-XY 1234"');
  assert.equal(cols[3], '"Dr. Schmidt"');
  assert.equal(cols[4], '15000');
  assert.equal(cols[5], '15025');
  assert.equal(cols[6], '25');
  assert.equal(cols[7], '"Praxis Mitte"');
  assert.equal(cols[8], '"Patientenbesuch (s. Verzeichnis Nr. P-A1B2C3D4)"');
  assert.equal(cols[9], '"Patientenbesuch"');
  assert.equal(cols[10], '"Gewerblich"');
});

test('fahrtenbuchCsv: Altzeile mit Patientendaten wird vollständig bereinigt', () => {
  const altzeile = {
    booking_id: 'c0ffee01-1234-5678-90ab-cdef12345678',
    lead_id: 'lead-999',
    fahrt_started_at: '2026-09-30T10:00:00Z',
    kennzeichen_snapshot: 'B-AB 9999',
    kind_snapshot: 'gewerblich',
    start_km: 20000,
    end_km: 20010,
    distance_km: 10,
    zweck: 'Hausbesuch Max Muster',
    zielort: 'Musterstr. 1, 12345 Berlin',
    abfahrtsort: 'Praxis',
    _therapist: 'Therapeutin',
    leads: {
      first_name: 'Max',
      last_name: 'Muster',
      street: 'Musterstr. 1',
      plz: '12345',
      city: 'Berlin'
    },
    bookings: {
      customer_name: 'Max Muster'
    }
  };
  const csv = fahrtenbuchCsv([altzeile]);
  assert.doesNotMatch(csv, /Max/);
  assert.doesNotMatch(csv, /Muster/);
  assert.doesNotMatch(csv, /Berlin/);
  assert.match(csv, /Patientenbesuch \(s\. Verzeichnis Nr\. P-C0FFEE01\)/);
  assert.match(csv, /"Patientenbesuch"/);
});

test('fahrtenbuchCsv: Zeile ohne lead_id behält gespeicherten Zweck und Zielort', () => {
  const zeileOhneLead = {
    booking_id: null,
    lead_id: null,
    fahrt_started_at: '2026-09-30T11:00:00Z',
    kennzeichen_snapshot: 'B-XY 1234',
    kind_snapshot: 'gewerblich',
    start_km: 20010,
    end_km: 20020,
    distance_km: 10,
    zweck: 'Materialeinkauf Praxisbedarf',
    zielort: 'Sanitätshaus Großmarkt',
    abfahrtsort: 'Praxis',
    _therapist: 'Fahrer'
  };
  const csv = fahrtenbuchCsv([zeileOhneLead]);
  assert.match(csv, /"Materialeinkauf Praxisbedarf"/);
  assert.match(csv, /"Sanitätshaus Großmarkt"/);
});

test('fahrtenbuchCsv: Fahrtart-Mapping und leere Km-Felder', () => {
  const rowPrivat = {
    kind_snapshot: 'privat',
    start_km: null,
    end_km: undefined,
    distance_km: ''
  };
  const csvPrivat = fahrtenbuchCsv([rowPrivat]);
  assert.match(csvPrivat, /"Privat"$/);
  assert.match(csvPrivat, /;;;;/); // 3 leere Km-Felder ungequotet
});

test('fahrtenbuchCsv: Formel-Injection-Schutz und Anführungszeichen-Verdopplung', () => {
  const injectionRow = {
    abfahrtsort: '=cmd|\' /C calc\'!A0',
    zweck: '+49 12345',
    zielort: '-minusZiel',
    _therapist: '@admin',
    kennzeichen_snapshot: '\tTAB-Kennzeichen'
  };
  const csv = fahrtenbuchCsv([injectionRow]);
  assert.match(csv, /"'=cmd/);
  assert.match(csv, /"'\+49 12345"/);
  assert.match(csv, /"'-minusZiel"/);
  assert.match(csv, /"'@admin"/);
  assert.match(csv, /"'\tTAB-Kennzeichen"/);

  const quoteRow = {
    abfahrtsort: 'Praxis "Sonnenschein"',
    zweck: 'Besuch "Herr & Frau"'
  };
  const csvQuote = fahrtenbuchCsv([quoteRow]);
  assert.match(csvQuote, /"Praxis ""Sonnenschein"""/);
  assert.match(csvQuote, /"Besuch ""Herr & Frau"""/);
});

test('patientenverzeichnisCsv: Kopfzeile, Name+Anschrift korrekt formatiert', () => {
  const kopf = 'Referenz;Datum;Patientenname;Anschrift';
  assert.equal(patientenverzeichnisCsv([]), kopf);

  const row = {
    booking_id: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
    fahrt_started_at: '2026-09-30T09:15:00Z',
    lead_id: 'lead-42',
    leads: {
      first_name: 'Erika',
      last_name: 'Mustermann',
      street: 'Hauptstr. 10',
      plz: '10115',
      city: 'Berlin'
    }
  };
  const csv = patientenverzeichnisCsv([row]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], kopf);
  assert.equal(lines[1].split(';').length, 4);
  assert.match(lines[1], /^"P-A1B2C3D4";/);
  assert.match(lines[1], /"Erika Mustermann"/);
  assert.match(lines[1], /"Hauptstr\. 10, 10115 Berlin"$/);
});

test('patientenverzeichnisCsv: Fallback auf bookings.customer_name bei fehlenden leads', () => {
  const row = {
    booking_id: 'b2c3d4e5-5678-90ab-cdef-1234567890ab',
    fahrt_started_at: '2026-09-30T10:00:00Z',
    lead_id: 'lead-43',
    leads: null,
    bookings: {
      customer_name: 'Hans Fallback'
    }
  };
  const csv = patientenverzeichnisCsv([row]);
  assert.match(csv, /"P-B2C3D4E5"/);
  assert.match(csv, /"Hans Fallback"/);
  assert.match(csv, /;""$/); // Keine Anschrift
});

test('patientenverzeichnisCsv: Zeilen ohne ermittelbaren Namen werden übersprungen', () => {
  const rows = [
    {
      booking_id: 'c3d4e5f6-5678-90ab-cdef-1234567890ab',
      fahrt_started_at: '2026-09-30T10:30:00Z',
      lead_id: 'lead-44',
      leads: null,
      bookings: null
    },
    {
      booking_id: 'd4e5f6a1-5678-90ab-cdef-1234567890ab',
      fahrt_started_at: '2026-09-30T11:00:00Z',
      zweck: 'Privatfahrt'
    }
  ];
  const csv = patientenverzeichnisCsv(rows);
  assert.equal(csv, 'Referenz;Datum;Patientenname;Anschrift');
});

test('patientenverzeichnisCsv und fahrtenbuchCsv: Referenz ist für dieselbe booking_id identisch', () => {
  const row = {
    booking_id: 'beefcafe-1234-5678-90ab-cdef12345678',
    lead_id: 'lead-99',
    fahrt_started_at: '2026-09-30T14:00:00Z',
    leads: { first_name: 'Klaus', last_name: 'Tester' }
  };
  const fbRef = fahrtenbuchCsv([row]).split('\n')[1].split(';')[0];
  const pvRef = patientenverzeichnisCsv([row]).split('\n')[1].split(';')[0];
  assert.equal(fbRef, '"P-BEEFCAFE"');
  assert.equal(pvRef, '"P-BEEFCAFE"');
  assert.equal(fbRef, pvRef);
});

test('PATIENTENVERZEICHNIS_HINWEIS: enthält Finanzamt und korrekten Wortlaut mit Umlauten', () => {
  assert.match(PATIENTENVERZEICHNIS_HINWEIS, /Finanzamt/);
  assert.equal(
    PATIENTENVERZEICHNIS_HINWEIS,
    'Das Patientenverzeichnis enthält Gesundheitsdaten (Patientennamen und Anschriften) und wird nur auf Anforderung des Finanzamts herausgegeben.'
  );
});

// Quelltext-Waechter: der Schreibpfad in dashboard.js darf keinen Namen/keine Anschrift mehr bauen.
import { readFileSync } from 'node:fs';
test('dashboard.js: Fahrt-Upsert baut zweck/zielort ohne Patientendaten', () => {
  const src = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  assert.ok(src.includes('fahrtZweckUndZiel(b.id)'));
  assert.equal(src.includes('`Hausbesuch ${patientName}`'), false);
  assert.equal(/zielort\s*=\s*lead\s*\?/.test(src), false);
});

import { fahrtAnzeigeText } from './fahrtenbuch-regeln.js';
test('fahrtAnzeigeText maskiert lead_id-Zeilen und Altzeilen "Hausbesuch <Name>"', () => {
  const id = 'a1b2c3d4-0000-0000-0000-000000000000';
  const a = fahrtAnzeigeText({ booking_id: id, lead_id: 'L', zweck: 'Hausbesuch Max Muster', zielort: 'Musterstr. 1' });
  assert.equal(a.zweck, 'Patientenbesuch');
  assert.match(a.zielort, /Nr\. P-A1B2C3D4\)/);
  const b = fahrtAnzeigeText({ booking_id: id, lead_id: null, zweck: 'Hausbesuch Erika', zielort: 'Weg 2' });
  assert.equal(/Erika|Weg/.test(b.zweck + b.zielort), false);
  assert.deepEqual(fahrtAnzeigeText({ booking_id: id, zweck: 'Fortbildung', zielort: 'Köln' }), { zweck: 'Fortbildung', zielort: 'Köln' });
});
