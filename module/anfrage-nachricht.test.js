import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { baueAnfrageKiAuftrag } from './anfrage-nachricht.js';

test('baueAnfrageKiAuftrag enthaelt Patient, Leistung, Zeitwunsch und Anweisung', () => {
  const intent = baueAnfrageKiAuftrag({
    req: {
      patients: { vorname: 'Erika', nachname: 'Muster' },
      services: { title: 'Podologische Komplexbehandlung' },
      notizen: 'Zeit: Mo, Mi · Vormittag\nWie bald: So bald wie möglich\nFreitext',
    },
    anweisung: 'Dienstag 10 Uhr vorschlagen',
    aktuellerText: '',
  });
  assert.match(intent, /Erika Muster/);
  assert.match(intent, /Podologische Komplexbehandlung/);
  assert.match(intent, /Zeit: Mo, Mi · Vormittag/);
  assert.match(intent, /Dienstag 10 Uhr vorschlagen/);
});

test('booking-request.html fragt bevorzugte Wochentage statt Kalenderdatum', () => {
  const html = readFileSync(new URL('../booking-request.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="prefDaysGrid"'), 'Wochentags-Auswahl muss vorhanden sein');
  assert.ok(html.includes('id="prefDaytimeGrid"'), 'Tageszeit-Auswahl muss vorhanden sein');
  assert.equal(html.includes('id="calGrid"'), false, 'Kalender-Datumswahl soll entfernt sein');
});

test('dashboard.js benennt Ablehnen in Anderer Termin um', () => {
  const js = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  assert.ok(js.includes("anfragen_ablehnen: 'Anderer Termin'"));
});
