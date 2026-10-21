// Widget und Backend koennen keine Datei teilen. Dieser Test haelt die doppelt gefuehrten
// Listen gleich — laeuft er rot, ist eine Seite allein geaendert worden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as widget from './booking-widget.logic.js';
import * as server from '../api-backend/booking/widget-guards.js';
import { ANLIEGEN as MODUL } from '../module/anfrage-anliegen.js';

test('Anliegen: Widget-Modul und Server gleich (Schluessel, Titel, Zahlungsarten)', () => {
  assert.deepEqual(Object.keys(server.ANLIEGEN), MODUL.map((a) => a.key));
  for (const a of MODUL) {
    assert.equal(server.ANLIEGEN[a.key].titel, a.titel, a.key);
    assert.deepEqual(server.ANLIEGEN[a.key].zahlung, a.zahlung, a.key);
  }
});

test('Tage, Tageszeiten, Dringlichkeit, Erstbesuch, Zahlarten: Schluessel und Texte gleich', () => {
  assert.deepEqual(widget.TAGE.map((t) => t.key), Object.keys(server.TAGE));
  assert.deepEqual(widget.TAGE.map((t) => t.kurz), Object.values(server.TAGE));
  assert.deepEqual(widget.TAGESZEITEN.map((t) => t.key), Object.keys(server.TAGESZEITEN));
  assert.deepEqual(widget.TAGESZEITEN.map((t) => t.text), Object.values(server.TAGESZEITEN));
  assert.deepEqual(widget.DRINGLICHKEIT.map((t) => t.key), Object.keys(server.DRINGLICHKEIT));
  assert.deepEqual(widget.DRINGLICHKEIT.map((t) => t.titel), Object.values(server.DRINGLICHKEIT));
  assert.deepEqual(widget.ERSTBESUCH.map((t) => t.key), Object.keys(server.ERSTBESUCH));
  assert.deepEqual(widget.ZAHLARTEN.map((t) => t.key), server.ZAHLUNGSARTEN);
  assert.equal(widget.MAX_MITTEILUNG, server.MAX_MITTEILUNG);
  assert.equal(widget.MAX_ANMERKUNG, server.MAX_ANMERKUNG);
});

test('Was das Widget schickt, besteht die Serverpruefung', () => {
  const z = {
    ...widget.leererZustand(), anliegen: 'nagelspange', zahlart: 'selbstzahler', hausbesuch: true,
    tage: ['mo', 'fr'], zeiten: ['nachmittag', 'spaet'], dringlichkeit: 'asap', erstbesuch: 'ja',
    vorname: 'Erika', nachname: 'Musterfrau', tag: '12', monat: '4', jahr: '1975', email: 'e@x.de',
    mitteilung: 'x', anmerkung: 'y', fuerAndere: true,
  };
  const body = widget.buildPayload(z, { ownerId: '00000000-0000-4000-8000-000000000001', mitAnliegen: true });
  assert.equal(server.pruefeWidgetAnfrage(body, new Date('2026-10-12T10:00:00Z')), null);
  const flex = widget.buildPayload({ ...z, flexibel: true, tage: [], zeiten: [] }, { ownerId: 'o', mitAnliegen: false });
  assert.equal(server.pruefeWidgetAnfrage(flex, new Date('2026-10-12T10:00:00Z')), null);
});
