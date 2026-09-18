// Geplante Termine in der Befundungsregel. Der Fehler, wegen dem es das gibt
// (fonksiyon-ustasi, 18.09.2026): der Vorschlag der Terminmaske las nur
// `podologie_behandlungen`, also nur Dokumentiertes. Wer eine Serie im Voraus
// bucht, bekam für JEDEN Termin „noch keine Behandlung → 78040".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geplanteAlsBehandlungen, positionVon } from './podo-geplant.js';
import { befundungFuerLeistung } from './eingangsbefundung-regel.js';

const dienst = (nr) => ({ gkv_position_nr: nr });
const buchung = (id, start, positionen, extra = {}) => ({
  id, start_time: start, status: 'confirmed',
  booking_leistungen: positionen.map(nr => ({ services: dienst(nr) })), ...extra,
});

// ── Übersetzung ──────────────────────────────────────────────────────────────

test('ein geplanter Termin wird zu Tag + Positionen', () => {
  const r = geplanteAlsBehandlungen([buchung('a', '2026-09-20T09:00:00Z', ['78010', '78040'])]);
  assert.deepEqual(r, [{ behandlungsdatum: '2026-09-20', hpnr_codes: ['78010', '78040'], geplant: true }]);
});

test('der Tag ist der Berliner Tag: 22:30 UTC im Sommer ist schon der nächste Tag', () => {
  const r = geplanteAlsBehandlungen([buchung('a', '2026-09-20T22:30:00Z', ['78010'])]);
  assert.equal(r[0].behandlungsdatum, '2026-09-21');
});

test('Rückfall auf die Hauptleistung, wenn keine Leistungszeilen da sind', () => {
  // Backend, batch-create und from-request schreiben keine booking_leistungen —
  // dieselbe Lücke, die podGeplanteHpnr() schon schließt.
  const r = geplanteAlsBehandlungen([
    { id: 'a', start_time: '2026-09-20T09:00:00Z', status: 'confirmed', booking_leistungen: [], services: dienst('78010') },
  ]);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].hpnr_codes, ['78010']);
});

// ── Was NICHT zählt ──────────────────────────────────────────────────────────

test('Physio-Termine desselben Patienten sperren 78040 nicht', () => {
  // Eine frühere Physio-Behandlung ist keine „frühere Behandlung" im Sinne der
  // Podologie-Vereinbarung — sie würde 78040 zu Unrecht sperren.
  assert.deepEqual(geplanteAlsBehandlungen([buchung('p', '2026-09-01T09:00:00Z', ['X0201', 'X0501'])]), []);
});

test('abgesagte und nicht erschienene Termine zählen nicht', () => {
  const r = geplanteAlsBehandlungen([
    buchung('x', '2026-09-20T09:00:00Z', ['78040'], { status: 'cancelled' }),
    buchung('y', '2026-09-21T09:00:00Z', ['78040'], { status: 'no_show' }),
    buchung('z', '2026-09-22T09:00:00Z', ['78040'], { no_show: true }),
  ]);
  assert.deepEqual(r, []);
});

test('der Termin, der gerade bearbeitet wird, sperrt sich nicht selbst', () => {
  const r = geplanteAlsBehandlungen([buchung('eigen', '2026-09-20T09:00:00Z', ['78040'])], { ohneId: 'eigen' });
  assert.deepEqual(r, []);
});

test('Müll in der Liste stürzt nicht ab', () => {
  assert.deepEqual(geplanteAlsBehandlungen(null), []);
  assert.deepEqual(geplanteAlsBehandlungen([null, {}, { start_time: null }]), []);
});

test('positionVon: Leerraum und fehlende Werte', () => {
  assert.equal(positionVon({ gkv_position_nr: ' 78030 ' }), '78030');
  assert.equal(positionVon({ gkv_position_nr: null }), '');
  assert.equal(positionVon(null), '');
});

// ── Der Fall, wegen dem es das Modul gibt ────────────────────────────────────

const REGEL = { hpnr: '78010', datum: '2026-09-27', selbstzahler: false, podologieVor2023: false, diagnosegruppen: ['DF'] };

test('OHNE die geplanten Termine: der zweite Termin einer im Voraus gebuchten Serie bekommt 78040 (der Fehler)', () => {
  // So verhielt sich die Terminmaske vor dem 18.09.2026.
  assert.equal(befundungFuerLeistung({ ...REGEL, behandlungen: [] }).code, '78040');
});

test('MIT den geplanten Terminen: der zweite Termin bekommt 78030', () => {
  const geplant = geplanteAlsBehandlungen([buchung('t1', '2026-09-20T09:00:00Z', ['78010', '78040'])]);
  const urteil = befundungFuerLeistung({ ...REGEL, behandlungen: geplant });
  assert.equal(urteil.code, '78030');
});

test('MIT geplantem ERSTEN Termin ohne Befundzeile: der zweite bekommt trotzdem 78030', () => {
  // Der erste Termin wurde ohne Befundung gebucht (78010 allein). Er ist dennoch
  // eine frühere Behandlung — „nicht die erste", also nicht mehr 78040.
  const geplant = geplanteAlsBehandlungen([buchung('t1', '2026-09-20T09:00:00Z', ['78010'])]);
  assert.equal(befundungFuerLeistung({ ...REGEL, behandlungen: geplant }).code, '78030');
});

test('der erste Termin selbst bleibt 78040, wenn sonst nichts geplant ist', () => {
  const geplant = geplanteAlsBehandlungen([buchung('eigen', '2026-09-20T09:00:00Z', ['78010', '78040'])], { ohneId: 'eigen' });
  assert.equal(befundungFuerLeistung({ ...REGEL, datum: '2026-09-20', behandlungen: geplant }).code, '78040');
});
