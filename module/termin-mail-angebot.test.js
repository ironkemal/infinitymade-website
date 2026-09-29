// termin-mail-angebot.js — Reform S1.11b (29.09.2026).
//
// Hintergrund: nach einer frisch gebundenen Podologie-Serie gab es noch keine
// einzige erledigte Sitzung, aber `proceedToRechnungForPhysio` oeffnete trotzdem
// die Rechnungen und zeigte "Rechnung vorbereitet" — gleich ob per Druck, "Nein"
// oder ✕ geschlossen wurde. `ohneRechnung` (aus `window._physioFlow?.podo`)
// schaltet diesen Anschluss ab. Diese Tests pruefen nur die reinen Entscheidungen
// (Text/Sichtbarkeit, Flow-Flag) — kein DOM noetig, das Modal selbst bindet nur
// feste dashboard.html-IDs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mailAngebotZustand, istPodoOhneRechnung } from './termin-mail-angebot.js';

// ── mailAngebotZustand ──────────────────────────────────────────────────────

test('mailAngebotZustand: Physio mit E-Mail — unveraenderter Standardtext, "Nein" fuehrt zur Rechnung', () => {
  const z = mailAngebotZustand({ hasEmail: true, patientName: 'Anna Beispiel', ohneRechnung: false });
  assert.equal(z.titel, 'Termine per E-Mail bestätigen?');
  assert.match(z.text, /Anna Beispiel die erstellten Termine per E-Mail bestätigen/);
  assert.equal(z.emailSichtbar, false);
  assert.equal(z.yesSichtbar, true);
  assert.equal(z.noText, 'Nein, weiter zur Rechnung');
});

test('mailAngebotZustand: Physio ohne E-Mail — Eingabefeld sichtbar, "Ja" bleibt da (unveraenderter Ablauf)', () => {
  const z = mailAngebotZustand({ hasEmail: false, patientName: 'Anna Beispiel', ohneRechnung: false });
  assert.equal(z.emailSichtbar, true);
  assert.equal(z.yesSichtbar, true);
  assert.equal(z.noText, 'Nein, weiter zur Rechnung');
});

test('mailAngebotZustand: Podologie mit E-Mail — "Nein" wird zu "Schließen", Angebot bleibt (Drucken/E-Mail)', () => {
  const z = mailAngebotZustand({ hasEmail: true, patientName: 'Herr Muster', ohneRechnung: true });
  assert.equal(z.titel, 'Terminübersicht mitgeben?');
  assert.equal(z.emailSichtbar, false);
  assert.equal(z.yesSichtbar, true, 'E-Mail-Entwurf bleibt anbietbar, wenn eine Adresse vorliegt');
  assert.equal(z.noText, 'Schließen');
});

test('mailAngebotZustand: Podologie ohne E-Mail — keine Rueckfrage, nur Drucken/Schließen', () => {
  const z = mailAngebotZustand({ hasEmail: false, patientName: 'Herr Muster', ohneRechnung: true });
  assert.equal(z.titel, 'Terminübersicht mitgeben?');
  assert.equal(z.emailSichtbar, false, 'keine E-Mail-Adresse wird abgefragt');
  assert.equal(z.yesSichtbar, false, '"Ja, Entwurf erstellen" braucht eine E-Mail, die hier fehlt');
  assert.equal(z.noText, 'Schließen');
  assert.match(z.text, /keine E-Mail-Adresse hinterlegt/);
  assert.doesNotMatch(z.text, /tragen Sie sie unten ein/, 'darf nicht mehr nach einer Adresse fragen');
});

test('mailAngebotZustand: fehlender Patientenname faellt auf neutrale Anrede zurueck', () => {
  const z = mailAngebotZustand({ hasEmail: true, ohneRechnung: false });
  assert.match(z.text, /dem Patienten/);
});

// ── istPodoOhneRechnung ──────────────────────────────────────────────────────

test('istPodoOhneRechnung: podo:true -> true', () => {
  assert.equal(istPodoOhneRechnung({ podo: true, prescription_id: null }), true);
});

test('istPodoOhneRechnung: Physio-Flow (kein podo-Feld) -> false', () => {
  assert.equal(istPodoOhneRechnung({ prescription_id: 'rx1', is_blanko: false }), false);
});

test('istPodoOhneRechnung: null/undefined -> false, wirft nicht', () => {
  assert.equal(istPodoOhneRechnung(null), false);
  assert.equal(istPodoOhneRechnung(undefined), false);
});
