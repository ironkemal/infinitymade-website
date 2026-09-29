import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEHANDLUNGSBEGINN_TAGE, behandlungsbeginnFrist, pruefeBehandlungsbeginn,
} from './heilmittel-fristen.js';

// [Q] HeilM-RL § 15 Abs. 1 — 28 Kalendertage normal, 14 bei dringlichem
// Behandlungsbedarf. Siehe Dateikopf für die genaue Fundstelle.
test('die Fristwerte stehen, wo die Quelle sie hinschreibt', () => {
  assert.equal(BEHANDLUNGSBEGINN_TAGE.normal, 28);
  assert.equal(BEHANDLUNGSBEGINN_TAGE.dringend, 14);
});

// ── behandlungsbeginnFrist ──────────────────────────────────────────────────

test('behandlungsbeginnFrist: 28 Tage normal, 14 dringlich', () => {
  assert.equal(behandlungsbeginnFrist('2026-01-01', false), '2026-01-29');
  assert.equal(behandlungsbeginnFrist('2026-01-01', true), '2026-01-15');
});

test('behandlungsbeginnFrist: fehlende/ungültige Eingabe ergibt null', () => {
  assert.equal(behandlungsbeginnFrist(null, false), null);
  assert.equal(behandlungsbeginnFrist('', false), null);
  assert.equal(behandlungsbeginnFrist('kein-datum', false), null);
});

// ── pruefeBehandlungsbeginn ──────────────────────────────────────────────────

test('genau am letzten Tag der Frist ist noch ok (27./28. Tag ok, 29. zu spät)', () => {
  const basis = { ausstellungsdatum: '2026-01-01', istDringend: false };
  // Tag 27 nach Ausstellung
  assert.equal(pruefeBehandlungsbeginn({ ...basis, ersterTermin: '2026-01-28' }).ok, true);
  // Tag 28 — genau die Frist, noch zulässig (Frist = "bis spätestens")
  assert.equal(pruefeBehandlungsbeginn({ ...basis, ersterTermin: '2026-01-29' }).ok, true);
  // Tag 29 — einen Tag zu spät
  const r = pruefeBehandlungsbeginn({ ...basis, ersterTermin: '2026-01-30' });
  assert.equal(r.ok, false);
  assert.equal(r.frist, '2026-01-29');
  assert.match(r.meldung, /Behandlungsbeginn verpasst/);
  assert.match(r.meldung, /28 Tage, HeilM-RL § 15/);
});

test('dringlich: 14 Tage statt 28', () => {
  const basis = { ausstellungsdatum: '2026-01-01', istDringend: true };
  assert.equal(pruefeBehandlungsbeginn({ ...basis, ersterTermin: '2026-01-15' }).ok, true); // Tag 14
  assert.equal(pruefeBehandlungsbeginn({ ...basis, ersterTermin: '2026-01-16' }).ok, false); // Tag 15
});

test('behandlungsbeginn bereits gesetzt: immer ok, unabhängig vom Datum', () => {
  const r = pruefeBehandlungsbeginn({
    ausstellungsdatum: '2026-01-01', istDringend: false,
    ersterTermin: '2026-06-01', behandlungsbeginn: '2026-01-10',
  });
  assert.equal(r.ok, true);
});

test('ohne Ausstellungsdatum oder ohne Termin: nicht prüfbar, also ok', () => {
  assert.equal(pruefeBehandlungsbeginn({ ersterTermin: '2026-01-30' }).ok, true);
  assert.equal(pruefeBehandlungsbeginn({ ausstellungsdatum: '2026-01-01' }).ok, true);
  assert.equal(pruefeBehandlungsbeginn({}).ok, true);
});

// Die Zählung läuft über den Berlin-Kalendertag, nicht UTC — ein Termin kurz
// vor Mitternacht darf durch eine Zeitzonenverschiebung nicht auf den
// nächsten (schon zu späten) Tag rutschen.
test('Berlin-Kalendertag: ein Date-Objekt wird in Europe/Berlin ausgewertet', () => {
  const basis = { ausstellungsdatum: '2026-01-01', istDringend: false }; // Frist: 2026-01-29
  // 2026-01-29 23:30 Uhr Berlin-Zeit (CET, UTC+1) = 22:30 UTC, also noch derselbe Tag.
  const spaetAmFristtag = new Date('2026-01-29T22:30:00Z');
  assert.equal(pruefeBehandlungsbeginn({ ...basis, ersterTermin: spaetAmFristtag }).ok, true);
  // 2026-01-30 00:30 Uhr Berlin-Zeit = 2026-01-29 23:30 UTC, bleibt in Berlin
  // aber bereits der 30. — einen Tag zu spät.
  const kurzNachMitternachtBerlin = new Date('2026-01-29T23:30:00Z');
  assert.equal(pruefeBehandlungsbeginn({ ...basis, ersterTermin: kurzNachMitternachtBerlin }).ok, false);
});
