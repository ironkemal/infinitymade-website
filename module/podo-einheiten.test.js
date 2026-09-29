// Die Einheitenliste im Terminbereich. Sie schreibt nichts, aber sie sagt dem
// Podologen, welche Befundung an welcher Einheit fällig ist — sagt sie es falsch,
// bucht er die Termine mit der falschen Position und bekommt eine Absetzung.
// Die Regel selbst (78040/78030) steht in eingangsbefundung-regel.js und ist dort
// geprüft; hier wird nur geprüft, dass sie richtig auf 1..n ausgerollt wird.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  einheitenPlan, einheitBeschriftung, befundDienstId, ziehNutzlast, bindePodoAnTermin,
  bindePodoSerie, bindePodoSerieVonRezept, meldePodoSerienBindung, zeichnePodoEinheiten,
} from './podo-einheiten.js';

const BASIS = {
  diagnosegruppe: 'DF', anzahl: 6, behandlungen: [], datum: '2026-09-18', podologieVor2023: false,
};
const termin = (id, start, extra = {}) => ({ id, start_time: start, status: 'confirmed', ...extra });

// ── Neuer Patient ────────────────────────────────────────────────────────────

test('neuer Patient, 6 Einheiten: Einheit 1 = 78040, 2-6 = 78030, alle offen', () => {
  const p = einheitenPlan(BASIS);
  assert.equal(p.anwendbar, true);
  assert.equal(p.einheiten.length, 6);
  assert.equal(p.offen, 6);
  assert.deepEqual(p.einheiten.map(e => e.befund),
    ['78040', '78030', '78030', '78030', '78030', '78030']);
  assert.ok(p.einheiten.every(e => e.termin === null));
});

// Der Fall, der die Berechnung über die GANZE Serie rechtfertigt: ist Einheit 1
// gebucht, aber noch nicht dokumentiert, darf Einheit 2 kein zweites 78040 tragen.
test('Einheit 1 gebucht, noch nicht dokumentiert: offene 2-6 tragen 78030, nicht 78040', () => {
  const p = einheitenPlan({ ...BASIS, termine: [termin('a', '2026-09-20T09:00:00Z')] });
  assert.equal(p.offen, 5);
  assert.equal(p.einheiten[0].termin.id, 'a');
  assert.equal(p.einheiten[0].befund, '78040');
  assert.deepEqual(p.einheiten.slice(1).map(e => e.befund), ['78030', '78030', '78030', '78030', '78030']);
});

test('Termine belegen die Einheiten in zeitlicher Reihenfolge, nicht in Listenreihenfolge', () => {
  const p = einheitenPlan({
    ...BASIS,
    termine: [termin('spaet', '2026-10-02T09:00:00Z'), termin('frueh', '2026-09-20T09:00:00Z')],
  });
  assert.equal(p.einheiten[0].termin.id, 'frueh');
  assert.equal(p.einheiten[1].termin.id, 'spaet');
  assert.equal(p.einheiten[0].befund, '78040');
});

// ── Bekannter Patient ────────────────────────────────────────────────────────

test('78040 schon abgerechnet: alle Einheiten 78030', () => {
  const p = einheitenPlan({
    ...BASIS, behandlungen: [{ behandlungsdatum: '2026-08-01', hpnr_codes: ['78040', '78010'] }],
  });
  assert.deepEqual(p.einheiten.map(e => e.befund), Array(6).fill('78030'));
});

// ── Zählregeln (wie terminZaehler) ───────────────────────────────────────────

test('abgesagte und nicht erschienene Termine belegen keine Einheit', () => {
  const p = einheitenPlan({
    ...BASIS,
    termine: [
      termin('x', '2026-09-20T09:00:00Z', { status: 'cancelled' }),
      termin('y', '2026-09-21T09:00:00Z', { status: 'no_show' }),
      termin('z', '2026-09-22T09:00:00Z', { no_show: true }),
      termin('ok', '2026-09-23T09:00:00Z'),
    ],
  });
  assert.equal(p.offen, 5);
  assert.equal(p.einheiten.filter(e => e.termin).length, 1);
  assert.equal(p.einheiten[0].termin.id, 'ok');
});

test('mehr Termine als Einheiten: alle bleiben sichtbar, offen ist 0 (nicht negativ)', () => {
  const p = einheitenPlan({
    ...BASIS, anzahl: 2,
    termine: [termin('a', '2026-09-20T09:00:00Z'), termin('b', '2026-09-21T09:00:00Z'), termin('c', '2026-09-22T09:00:00Z')],
  });
  assert.equal(p.offen, 0);
  assert.equal(p.einheiten.length, 3);
  assert.ok(p.einheiten.every(e => e.termin));
});

test('Einheitenzahl nicht erfasst: keine erfundene Restmenge', () => {
  for (const anzahl of [null, undefined, '', 0, 'x']) {
    const p = einheitenPlan({ ...BASIS, anzahl });
    assert.equal(p.anwendbar, false, String(anzahl));
    assert.equal(p.offen, null);
    assert.deepEqual(p.einheiten, []);
  }
});

// ── Nagelspange ──────────────────────────────────────────────────────────────

test('UI1: kein 78040/78030 je Einheit — die Erstbefundung entscheidet die Praxis', () => {
  const p = einheitenPlan({ ...BASIS, diagnosegruppe: 'UI1', anzahl: 4 });
  assert.equal(p.einheiten.length, 4);
  assert.ok(p.einheiten.every(e => e.befund === null));
  assert.ok(p.hinweis.length > 0, 'der Grund steht im Hinweis');
});

test('Leitsymptomatik-Suffix an der Diagnosegruppe stört nicht („DF-c")', () => {
  const p = einheitenPlan({ ...BASIS, diagnosegruppe: 'DF-c' });
  assert.equal(p.einheiten[0].befund, '78040');
});

// ── Beschriftung ─────────────────────────────────────────────────────────────

test('Beschriftung nennt Befund und Behandlung — ohne Befund nur Behandlung', () => {
  assert.equal(einheitBeschriftung('78040'), 'Eingangsbefundung (78040) + Behandlung');
  assert.equal(einheitBeschriftung('78030'), 'Befundung (78030) + Behandlung');
  assert.equal(einheitBeschriftung(null), 'Behandlung');
});

// ── Leistung zur Befundposition ──────────────────────────────────────────────

test('befundDienstId findet die Leistung über die Positionsnummer, auch mit Leerraum', () => {
  const dienste = [
    { id: 'a', gkv_position_nr: '78010' },
    { id: 'b', gkv_position_nr: ' 78030 ' },
    { id: 'c', gkv_position_nr: null },
  ];
  assert.equal(befundDienstId(dienste, '78030'), 'b');
  assert.equal(befundDienstId(dienste, '78040'), null, 'nicht eingerichtet → null, kein Raten');
  assert.equal(befundDienstId(dienste, null), null);
  assert.equal(befundDienstId(null, '78030'), null);
});

test('befundDienstId findet auch eine Leistung, deren HPNR nur im code steht', () => {
  assert.equal(befundDienstId([{ id: 'x', gkv_position_nr: null, code: '78040' }], '78040'), 'x');
});

// ── Was beim Ziehen mitgeht ──────────────────────────────────────────────────

test('Ziehnutzlast: kein sessionId, aber podoVordId und Befund — Format der Physio-Karten', () => {
  const n = ziehNutzlast({
    vord: { id: 'v1', heilmittel: 'Hornhautabtragung', heilmittel_feld_text: null },
    einheit: { nr: 1, befund: '78040' }, patientName: 'Test Patient', leadId: 'p1',
  });
  assert.equal(n.podoVordId, 'v1');
  assert.equal(n.prescriptionId, 'v1');
  assert.equal(n.befund, '78040');
  assert.equal(n.sessionId, null);
  assert.equal(n.sessions.length, 1);
  assert.equal(n.sessions[0].sessionId, null);
  assert.equal(n.sessions[0].sessionNum, 1);
  assert.equal(n.sessions[0].heilmittelName, 'Hornhautabtragung');
  assert.match(n.bannerText, /Einheit #1: Eingangsbefundung \(78040\) \+ Behandlung/);
});

test('Ziehnutzlast: der Feldtext der Verordnung geht vor dem Kurztext', () => {
  const n = ziehNutzlast({
    vord: { id: 'v', heilmittel: 'kurz', heilmittel_feld_text: 'Podologische Komplexbehandlung' },
    einheit: { nr: 3, befund: '78030' }, leadId: 'p',
  });
  assert.equal(n.heilmittelName, 'Podologische Komplexbehandlung');
});

// ── Zuordnung nach dem Anlegen ───────────────────────────────────────────────

/** Attrappe, die `bindeTermin` zufrieden stellt. */
const sbMit = (antwort) => ({
  from: () => ({ update: () => ({ eq: () => ({ select: async () => antwort }) }) }),
});

test('bindePodoAnTermin: ohne podoVordId nichts zu tun — und kein Fehler', async () => {
  for (const pend of [{}, null, undefined]) {
    const r = await bindePodoAnTermin(sbMit({ data: [{ id: 'b' }] }), 'b', pend);
    assert.equal(r.ok, true);
    assert.equal(r.gebunden, 0);
  }
});

test('bindePodoAnTermin: Erfolg meldet verordnungen:changed und hat die Form der Physio-Bindung', async () => {
  const gemeldet = [];
  const r = await bindePodoAnTermin(sbMit({ data: [{ id: 'b' }] }), 'b', { podoVordId: 'v' },
    { emit: (e) => gemeldet.push(e) });
  assert.deepEqual(r, { ok: true, gebunden: 1, erwartet: 1, fehlend: [], meldung: '' });
  assert.deepEqual(gemeldet, ['verordnungen:changed']);
});

// „gespeichert" ohne Zuordnung wäre genau die Stille, die bei den Physio-Sitzungen
// vier Wochen lang unbemerkt blieb (sitzung-bindung.js).
test('bindePodoAnTermin: 0 betroffene Zeilen ist ein Fehler mit lesbarer Meldung', async () => {
  const r = await bindePodoAnTermin(sbMit({ data: [] }), 'b', { podoVordId: 'v' },
    { emit: () => assert.fail('nichts melden') });
  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 0);
  assert.deepEqual(r.fehlend, ['b']);
  assert.match(r.meldung, /nicht zugeordnet/);
  assert.match(r.meldung, /Verordnungen/);
});

// ═══════════════════════════════════════════════════════════════════════════
// S1.8 (28.09.2026): Serienverteilung — mehrere neu angelegte Termine auf
// einmal an dieselbe podologische Verordnung binden.
// ═══════════════════════════════════════════════════════════════════════════

/** Eine Attrappe, die `.select()`, jedes Filter-Chainglied und `.maybeSingle()` bedient. */
function chainVon(ergebnis) {
  const self = {
    select: () => self, eq: () => self, neq: () => self, is: () => self, not: () => self,
    in: () => self, or: () => self, order: () => self, limit: () => self,
    maybeSingle: async () => ergebnis,
    then: (resolve) => Promise.resolve(ergebnis).then(resolve),
  };
  return self;
}

/**
 * `sb`-Attrappe für `bindePodoSerie`/`bindePodoSerieVonRezept`/`meldePodoSerienBindung`:
 * `bookings` liefert `vergeben` für `ladePodoTermine` und protokolliert jeden
 * `bindeTermin`-Aufruf (Reihenfolge!) in `bindeAufrufe`; `failIds` lässt einzelne
 * davon wie ein `bindeTermin` mit 0 betroffenen Zeilen scheitern.
 */
function fakeSb({ rx = null, vergeben = [], failIds = new Set() } = {}) {
  const bindeAufrufe = [];
  return {
    bindeAufrufe,
    from(table) {
      if (table === 'prescriptions') return { select: () => chainVon({ data: rx, error: null }) };
      if (table === 'bookings') {
        return {
          select: () => chainVon({ data: vergeben, error: null }),
          update: () => ({
            eq: (_col, bookingId) => {
              bindeAufrufe.push(bookingId);
              const geschrieben = !failIds.has(bookingId);
              return { select: async () => (geschrieben ? { data: [{ id: bookingId }], error: null } : { data: [], error: null }) };
            },
          }),
        };
      }
      return { select: () => chainVon({ data: null, error: null }) };
    },
  };
}

test('bindePodoSerie: innerhalb der Kapazität — bindet alle, kein `confirm`-Parameter mehr nötig', async () => {
  const sb = fakeSb({ vergeben: [] });
  const created = [
    { id: 'b1', start_time: '2026-10-05T09:00:00Z' },
    { id: 'b2', start_time: '2026-10-12T09:00:00Z' },
  ];
  const r = await bindePodoSerie(sb, { ownerId: 'o1', vordId: 'rx1', anzahlEinheiten: 6, created });
  assert.deepEqual(r, { ok: true, gebunden: 2, erwartet: 2, fehlend: [], meldung: '', warnung: false });
  assert.deepEqual(sb.bindeAufrufe, ['b1', 'b2']);
});

test('bindePodoSerie: Einheitenzahl nicht erfasst — keine Kappung, alles wird gebunden', async () => {
  const sb = fakeSb({ vergeben: [] });
  const created = [{ id: 'b1', date: '2026-10-05', time: '09:00' }];
  const r = await bindePodoSerie(sb, { ownerId: 'o1', vordId: 'rx1', anzahlEinheiten: null, created });
  assert.equal(r.ok, true);
  assert.equal(r.gebunden, 1);
  assert.equal(r.warnung, false);
});

// S1.8-Nachbesserung (29.09.2026, podoloji-Denetim): die Rückfrage „Trotzdem
// alle zuordnen?" ist WEG — eine Kasse zahlt nie mehr als die verordnete
// Menge, „alle zuordnen" durfte also nie eine gültige Wahl sein. Jetzt wird
// IMMER nur bis zur Grenze gebunden, ohne nachzufragen.
test('bindePodoSerie: Kappung überschritten — bindet ohne Rückfrage nur bis zur Grenze, meldet den Rest als Warnung', async () => {
  const sb = fakeSb({ vergeben: [{ id: 'alt', status: 'confirmed', start_time: '2026-09-01T09:00:00Z' }] });
  const created = [
    { id: 'b1', start_time: '2026-10-05T09:00:00Z' },
    { id: 'b2', start_time: '2026-10-12T09:00:00Z' },
    { id: 'b3', start_time: '2026-10-19T09:00:00Z' },
  ];
  // 1 bereits vergeben + 3 neue = 4, Kapazität 3 -> Überschreitung um 1.
  const r = await bindePodoSerie(sb, { ownerId: 'o1', vordId: 'rx1', anzahlEinheiten: 3, created });
  assert.equal(r.gebunden, 2, 'nur die 2 noch freien Plätze, nicht alle 3 neuen');
  assert.equal(r.erwartet, 2);
  assert.equal(r.ok, true);
  assert.equal(r.warnung, true);
  assert.deepEqual(sb.bindeAufrufe, ['b1', 'b2'], 'zeitlich früheste zuerst — b3 bleibt aussen vor');
  assert.match(r.meldung, /2 Termine der Verordnung zugeordnet/);
  assert.match(r.meldung, /1 Termin liegt über der verordneten Menge/);
  assert.match(r.meldung, /Folgeverordnung nötig/);
});

test('bindePodoSerie: Kappung überschritten — bindet nur die zeitlich ersten, nicht die zuerst gelisteten', async () => {
  const sb = fakeSb({ vergeben: [] });
  const created = [
    // absichtlich NICHT in zeitlicher Reihenfolge übergeben
    { id: 'spaet', start_time: '2026-11-01T09:00:00Z' },
    { id: 'frueh', start_time: '2026-10-01T09:00:00Z' },
    { id: 'mitte', start_time: '2026-10-15T09:00:00Z' },
  ];
  // Kapazität 2, 0 vergeben, 3 neue -> Überschreitung um 1.
  const r = await bindePodoSerie(sb, { ownerId: 'o1', vordId: 'rx1', anzahlEinheiten: 2, created });
  assert.deepEqual(sb.bindeAufrufe, ['frueh', 'mitte'], 'zeitlich früheste zuerst, nicht Listenreihenfolge');
  assert.equal(r.gebunden, 2);
  assert.equal(r.erwartet, 2);
  assert.equal(r.ok, true);
  assert.equal(r.warnung, true);
  assert.match(r.meldung, /2 Termine der Verordnung zugeordnet/);
  assert.match(r.meldung, /1 Termin liegt über/);
});

test('bindePodoSerie: mehrere Termine über der Grenze — Pluralform in der Meldung', async () => {
  const sb = fakeSb({ vergeben: [] });
  const created = [
    { id: 'a', start_time: '2026-10-01T09:00:00Z' },
    { id: 'b', start_time: '2026-10-08T09:00:00Z' },
    { id: 'c', start_time: '2026-10-15T09:00:00Z' },
    { id: 'd', start_time: '2026-10-22T09:00:00Z' },
  ];
  const r = await bindePodoSerie(sb, { ownerId: 'o1', vordId: 'rx1', anzahlEinheiten: 1, created });
  assert.equal(r.gebunden, 1);
  assert.equal(r.warnung, true);
  assert.match(r.meldung, /3 Termine liegen über der verordneten Menge/);
});

test('bindePodoSerie: batch-create-explicit liefert date+time statt start_time — Sortierung funktioniert trotzdem', async () => {
  const sb = fakeSb({ vergeben: [] });
  const created = [
    { id: 'spaet', date: '2026-10-20', time: '09:00' },
    { id: 'frueh', date: '2026-10-06', time: '09:00' },
  ];
  const r = await bindePodoSerie(sb, { ownerId: 'o1', vordId: 'rx1', anzahlEinheiten: 6, created });
  assert.deepEqual(sb.bindeAufrufe, ['frueh', 'spaet']);
  assert.equal(r.gebunden, 2);
});

test('bindePodoSerie: ein bindeTermin schlägt fehl — Teilbindung, ok:false, Meldung nennt Zahl', async () => {
  const sb = fakeSb({ vergeben: [], failIds: new Set(['b2']) });
  const created = [{ id: 'b1', start_time: '2026-10-05T09:00:00Z' }, { id: 'b2', start_time: '2026-10-12T09:00:00Z' }];
  const gemeldet = [];
  const r = await bindePodoSerie(sb, {
    ownerId: 'o1', vordId: 'rx1', anzahlEinheiten: 6, created,
    emit: (e) => gemeldet.push(e),
  });
  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 1);
  assert.deepEqual(r.fehlend, ['b2']);
  assert.match(r.meldung, /1 von 2/);
  assert.deepEqual(gemeldet, ['verordnungen:changed'], 'mindestens ein Erfolg -> trotzdem melden');
});

test('bindePodoSerie: kein Termin angelegt — nichts zu tun, kein Fehler', async () => {
  const sb = fakeSb();
  const r = await bindePodoSerie(sb, { ownerId: 'o1', vordId: 'rx1', anzahlEinheiten: 6, created: [] });
  assert.deepEqual(r, { ok: true, gebunden: 0, erwartet: 0, fehlend: [], meldung: '', warnung: false });
  assert.deepEqual(sb.bindeAufrufe, []);
});

// ── bindePodoSerieVonRezept: Entscheidung nach REZEPT, nicht Fachbereich ───────

test('bindePodoSerieVonRezept: Physio/Ergo/Logo -> {podo:false}, rührt keinen Termin an', async () => {
  const sb = fakeSb({ rx: { anzahl_einheiten: 6, therapie_bereich: null } });
  const r = await bindePodoSerieVonRezept(sb, {
    ownerId: 'o1', prescriptionId: 'rx1', created: [{ id: 'b1', start_time: '2026-10-05T09:00:00Z' }],
  });
  assert.deepEqual(r, { podo: false });
  assert.deepEqual(sb.bindeAufrufe, []);
});

test('bindePodoSerieVonRezept: Podologie -> delegiert an bindePodoSerie', async () => {
  const sb = fakeSb({ rx: { anzahl_einheiten: 6, therapie_bereich: 'podo' }, vergeben: [] });
  const r = await bindePodoSerieVonRezept(sb, {
    ownerId: 'o1', prescriptionId: 'rx1', created: [{ id: 'b1', start_time: '2026-10-05T09:00:00Z' }],
  });
  assert.equal(r.podo, true);
  assert.equal(r.ok, true);
  assert.equal(r.gebunden, 1);
});

// ── meldePodoSerienBindung: Toast + `_physioFlow`-Aufräumen ────────────────────

test('meldePodoSerienBindung: Physio -> false, kein Toast, `_physioFlow` bleibt unberührt', async () => {
  globalThis.window = globalThis;
  window._physioFlow = { prescription_id: 'rx1', foo: 'bleibt' };
  const sb = fakeSb({ rx: { anzahl_einheiten: 6, therapie_bereich: null } });
  const toast = () => assert.fail('kein Toast für Physio — der eigene Weg meldet selbst');
  const ok = await meldePodoSerienBindung(sb, { ownerId: 'o1', prescriptionId: 'rx1', created: [{ id: 'b1' }], toast });
  assert.equal(ok, false);
  assert.deepEqual(window._physioFlow, { prescription_id: 'rx1', foo: 'bleibt' });
});

test('meldePodoSerienBindung: Podologie -> true, Toast informiert, nur `prescription_id` wird geleert', async () => {
  globalThis.window = globalThis;
  window._physioFlow = { prescription_id: 'rx1', anzahl: 3, patient_id: 'p1' };
  const sb = fakeSb({ rx: { anzahl_einheiten: 6, therapie_bereich: 'podo' }, vergeben: [] });
  const meldungen = [];
  const toast = (text, art) => meldungen.push({ text, art });
  const ok = await meldePodoSerienBindung(sb, {
    ownerId: 'o1', prescriptionId: 'rx1', created: [{ id: 'b1', start_time: '2026-10-05T09:00:00Z' }], toast,
  });
  assert.equal(ok, true);
  assert.equal(window._physioFlow.prescription_id, null, 'bayat Bayrag darf keine spätere Serie mehr binden');
  assert.equal(window._physioFlow.patient_id, 'p1', 'Patient-Fallback (dashboard.js ~6833) bleibt erhalten');
  // Reform S1.11b: einziges Zeichen, das dem Mail-Angebot/Rechnungs-Anschluss
  // noch verrät, dass dieser Flow podologisch war (prescription_id ist weg).
  assert.equal(window._physioFlow.podo, true, 'ohne dieses Flag ueberspringt proceedToRechnungForPhysio den Podo-Fall nicht mehr');
  // Volle Bindung ohne Kappung erzeugt keine Meldung — kein Toast erwartet.
  assert.deepEqual(meldungen, []);
});

// S1.8-Nachbesserung (29.09.2026): keine Rückfrage mehr, dafür ein 'warning'-Toast
// statt 'info' — die Kappung ist jetzt ein Hinweis, der Aufmerksamkeit verdient
// (Folgeverordnung nötig), keine neutrale Statusmeldung.
test('meldePodoSerienBindung: Podologie mit Kappungs-Meldung -> Toast mit Variante "warning", ohne Rückfrage', async () => {
  globalThis.window = globalThis;
  window._physioFlow = { prescription_id: 'rx1' };
  const sb = fakeSb({ rx: { anzahl_einheiten: 1, therapie_bereich: 'podo' }, vergeben: [] });
  const meldungen = [];
  const toast = (text, art) => meldungen.push({ text, art });
  const created = [{ id: 'b1', start_time: '2026-10-05T09:00:00Z' }, { id: 'b2', start_time: '2026-10-12T09:00:00Z' }];
  await meldePodoSerienBindung(sb, { ownerId: 'o1', prescriptionId: 'rx1', created, toast });
  assert.equal(meldungen.length, 1);
  assert.equal(meldungen[0].art, 'warning');
  assert.match(meldungen[0].text, /Folgeverordnung nötig/);
});

test('meldePodoSerienBindung: Schreibfehler geht vor Kappungswarnung -> Toast bleibt "error"', async () => {
  globalThis.window = globalThis;
  window._physioFlow = { prescription_id: 'rx1' };
  // Kapazität 1, 2 neue Termine -> Kappung UND (bei diesem Sb) ein Schreibfehler
  // auf dem einzig gebundenen Termin — ok:false muss die Toast-Art bestimmen.
  const sb = fakeSb({ rx: { anzahl_einheiten: 1, therapie_bereich: 'podo' }, vergeben: [], failIds: new Set(['b1']) });
  const meldungen = [];
  const toast = (text, art) => meldungen.push({ text, art });
  const created = [{ id: 'b1', start_time: '2026-10-05T09:00:00Z' }, { id: 'b2', start_time: '2026-10-12T09:00:00Z' }];
  await meldePodoSerienBindung(sb, { ownerId: 'o1', prescriptionId: 'rx1', created, toast });
  assert.equal(meldungen.length, 1);
  assert.equal(meldungen[0].art, 'error');
});

// ═══════════════════════════════════════════════════════════════════════════
// zeichnePodoEinheiten: der Serienknopf — nur die Sichtbarkeits-/Verdrahtungs-
// Logik, kein Anspruch auf die volle Darstellung (die übrigen Panelteile sind
// bereits über `einheitenPlan()` geprüft).
// ═══════════════════════════════════════════════════════════════════════════

function bauDom() {
  const els = {
    bkRxSessionsPanel: { hidden: true },
    bkRxUnvergebeneList: { innerHTML: '', querySelectorAll: () => [], onchange: null },
    bkRxTermineList: { innerHTML: '' },
    bkRxSessionsBadge: { textContent: '' },
    bkRxSerieBtn: { hidden: true, onclick: null, textContent: '' },
    bkRxLeistungenBtn: { hidden: true, onclick: null },
  };
  globalThis.document = { getElementById: (id) => els[id] || null };
  return els;
}

/** `sb`-Attrappe für `zeichnePodoEinheiten`: bedient `prescriptions`, `bookings`, `leads`. */
function fakeSbFuerZeichnen({ vord, vergeben = [] }) {
  return {
    from(table) {
      if (table === 'prescriptions') {
        return {
          // `ladeVerordnung` fragt den vollen Spaltensatz ab (enthält
          // `anzahl_einheiten`); `ladeBehandlungen` fragt nur `id` ab, um die
          // Verordnungen des Patienten zu finden — hier immer leer, damit sie
          // ohne weitere `podologie_behandlungen`-Abfrage `[]` zurückgibt.
          select: (cols) => (String(cols).includes('anzahl_einheiten')
            ? chainVon({ data: vord, error: null })
            : chainVon({ data: [], error: null })),
        };
      }
      if (table === 'bookings') return { select: () => chainVon({ data: vergeben, error: null }) };
      return { select: () => chainVon({ data: null, error: null }) };
    },
  };
}

const VORD_OFFEN = {
  id: 'rx-1', heilmittel: 'Hornhautabtragung', heilmittel_feld_text: null, heilmittel_position: '30140',
  diagnosegruppe: 'DF', anzahl_einheiten: 6, ausstellungsdatum: '2026-09-01', patient_id: 'pat-1',
  therapie_bereich: 'podo', frequenz: '1x wöchentlich',
};

test('zeichnePodoEinheiten: aufSerie vorhanden + offene Einheiten -> Knopf aktiv, ruft mit {rx, offen, booking}', async () => {
  const els = bauDom();
  const sb = fakeSbFuerZeichnen({ vord: VORD_OFFEN, vergeben: [] });
  const booking = { lead_id: 'pat-1', customer_name: 'Max Mustermann' };
  const aufrufe = [];
  const ok = await zeichnePodoEinheiten({
    sb, ownerId: 'owner-1', booking, vordId: 'rx-1', aufSerie: (arg) => aufrufe.push(arg),
  });

  assert.equal(ok, true);
  assert.equal(els.bkRxSerieBtn.hidden, false);
  assert.equal(typeof els.bkRxSerieBtn.onclick, 'function');
  els.bkRxSerieBtn.onclick();
  assert.equal(aufrufe.length, 1);
  assert.equal(aufrufe[0].rx.id, 'rx-1');
  assert.equal(aufrufe[0].offen, 6);
  assert.equal(aufrufe[0].booking, booking);
});

test('zeichnePodoEinheiten: ohne aufSerie bleibt der Knopf verborgen (Rückwärtskompatibilität)', async () => {
  const els = bauDom();
  const sb = fakeSbFuerZeichnen({ vord: VORD_OFFEN, vergeben: [] });
  await zeichnePodoEinheiten({ sb, ownerId: 'owner-1', booking: { lead_id: 'pat-1' }, vordId: 'rx-1' });
  assert.equal(els.bkRxSerieBtn.hidden, true);
  assert.equal(els.bkRxSerieBtn.onclick, null);
});

test('zeichnePodoEinheiten: alle Einheiten vergeben (offen=0) -> Knopf verborgen, trotz aufSerie', async () => {
  const els = bauDom();
  const vergebenVoll = Array.from({ length: 6 }, (_, i) => ({
    id: `b${i}`, start_time: `2026-09-0${i + 1}T09:00:00Z`, status: 'confirmed', no_show: false,
  }));
  const sb = fakeSbFuerZeichnen({ vord: VORD_OFFEN, vergeben: vergebenVoll });
  const aufSerie = () => assert.fail('bei offen=0 darf der Knopf nicht aufrufbar sein');
  const ok = await zeichnePodoEinheiten({ sb, ownerId: 'owner-1', booking: { lead_id: 'pat-1' }, vordId: 'rx-1', aufSerie });
  assert.equal(ok, true);
  assert.equal(els.bkRxSerieBtn.hidden, true);
});

test('zeichnePodoEinheiten: Einheitenzahl nicht erfasst (offen=null) -> Knopf verborgen', async () => {
  const els = bauDom();
  const sb = fakeSbFuerZeichnen({ vord: { ...VORD_OFFEN, anzahl_einheiten: null }, vergeben: [] });
  const aufSerie = () => assert.fail('ohne erfasste Einheitenzahl gibt es nichts zu verteilen');
  await zeichnePodoEinheiten({ sb, ownerId: 'owner-1', booking: { lead_id: 'pat-1' }, vordId: 'rx-1', aufSerie });
  assert.equal(els.bkRxSerieBtn.hidden, true);
});
