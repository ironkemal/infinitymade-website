// Die Einheitenliste im Terminbereich. Sie schreibt nichts, aber sie sagt dem
// Podologen, welche Befundung an welcher Einheit fällig ist — sagt sie es falsch,
// bucht er die Termine mit der falschen Position und bekommt eine Absetzung.
// Die Regel selbst (78040/78030) steht in eingangsbefundung-regel.js und ist dort
// geprüft; hier wird nur geprüft, dass sie richtig auf 1..n ausgerollt wird.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  einheitenPlan, einheitBeschriftung, befundDienstId, ziehNutzlast, bindePodoAnTermin,
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
