import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindeSitzungenAnTermin, bindungsFehlerText } from './sitzung-bindung.js';

/** Minimaler Supabase-Doppelgänger: `.from().update().in().select()`. */
function sbAttrappe({ data = null, error = null, protokoll = {} } = {}) {
  return {
    from(tabelle) {
      protokoll.tabelle = tabelle;
      return {
        update(werte) {
          protokoll.werte = werte;
          return {
            in(spalte, ids) {
              protokoll.ids = ids;
              return { select: async () => ({ data, error }) };
            },
          };
        },
      };
    },
  };
}

test('der Kombi-Fall — zwei Einheiten, beide gebunden', async () => {
  const protokoll = {};
  const sb = sbAttrappe({ data: [{ id: 's1' }, { id: 's2' }], protokoll });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1', 's2']);
  assert.equal(r.ok, true);
  assert.equal(r.gebunden, 2);
  assert.deepEqual(r.fehlend, []);
  assert.equal(r.meldung, '');
  assert.equal(protokoll.tabelle, 'prescription_sessions');
  assert.equal(protokoll.werte.booking_id, 'b1');
  // Gebunden heisst geplant, nicht erbracht.
  assert.equal(protokoll.werte.status, 'planned');
});

// Der eigentliche Befund der Karte: der Index schlägt zu, KEINE der beiden
// Zeilen wird gebunden — und bis zum 16.09.2026 meldete die Maske trotzdem
// „gespeichert".
test('Indexverletzung — Fehler wird durchgereicht, nicht verschluckt', async () => {
  const sb = sbAttrappe({ error: { message: 'duplicate key value violates unique constraint' } });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1', 's2']);
  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 0);
  assert.deepEqual(r.fehlend, ['s1', 's2']);
  assert.match(r.meldung, /NICHT zugeordnet/);
  assert.match(r.meldung, /duplicate key/);
});

// PostgREST meldet keinen Fehler, wenn das UPDATE null Zeilen trifft. Ohne
// Nachzählen wäre das wieder ein stiller Verlust.
test('kein Fehler, aber keine Zeile getroffen — gilt als Fehlschlag', async () => {
  const sb = sbAttrappe({ data: [] });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1']);
  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 0);
  assert.deepEqual(r.fehlend, ['s1']);
});

test('teilweise gebunden — die Zahl steht in der Meldung', async () => {
  const sb = sbAttrappe({ data: [{ id: 's1' }] });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1', 's2']);
  assert.equal(r.ok, false);
  assert.equal(r.gebunden, 1);
  assert.deepEqual(r.fehlend, ['s2']);
  assert.match(r.meldung, /nur 1 von 2/);
});

test('doppelte Ids werden einmal gezählt', async () => {
  const protokoll = {};
  const sb = sbAttrappe({ data: [{ id: 's1' }], protokoll });
  const r = await bindeSitzungenAnTermin(sb, 'b1', ['s1', 's1', null]);
  assert.equal(r.ok, true);
  assert.equal(r.erwartet, 1);
  assert.deepEqual(protokoll.ids, ['s1']);
});

// Ohne vorgemerkte Sitzung ist nichts zu tun — und das ist kein Fehler.
test('nichts vorgemerkt — stiller Erfolg, kein Datenbankzugriff', async () => {
  let beruehrt = false;
  const sb = { from() { beruehrt = true; return {}; } };
  const r = await bindeSitzungenAnTermin(sb, 'b1', []);
  assert.equal(r.ok, true);
  assert.equal(r.erwartet, 0);
  assert.equal(beruehrt, false);
});

test('der Text sagt, dass der Termin trotzdem steht', () => {
  const t = bindungsFehlerText({ erwartet: 1, gebunden: 0, dbMeldung: '' });
  assert.match(t, /Termin gespeichert/);
  assert.match(t, /von Hand zuordnen/);
  assert.doesNotMatch(t, /undefined/);
});

// ── bindeSerieAnVerordnung (Physio-Serie, 29.10.2026) ─────────────────────────
import { bindeSerieAnVerordnung } from './sitzung-bindung.js';

function serienDouble({ rx, sitzungen }) {
  const geschrieben = [];
  const tabelle = (name) => {
    const q = { _f: {}, _upd: null };
    q.select = () => q; q.order = () => q; q.maybeSingle = async () => ({ data: name === 'prescriptions' ? rx : null, error: null });
    q.eq = (k, v) => { q._f[k] = v; return q; }; q.is = (k, v) => { q._f[k] = v; return q; };
    q.in = (k, ids) => { q._ids = ids; return q; };
    q.update = (u) => { q._upd = u; return q; };
    q.then = (res) => {
      if (name === 'prescription_sessions' && q._upd) {
        const treffer = sitzungen.filter((s) => q._ids.includes(s.id) && s.booking_id === null);
        treffer.forEach((s) => { s.booking_id = q._upd.booking_id; geschrieben.push([s.id, q._upd.booking_id]); });
        return res({ data: treffer.map((s) => ({ id: s.id })), error: null });
      }
      if (name === 'prescription_sessions') {
        return res({ data: sitzungen.filter((s) => s.booking_id === null && s.status === 'planned').sort((a, b) => a.session_number - b.session_number), error: null });
      }
      return res({ data: [], error: null });
    };
    return q;
  };
  return { sb: { from: tabelle }, geschrieben };
}
const sitz = (n, gebucht = null) => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, session_number: i + 1, status: 'planned', booking_id: i < gebucht ? `alt${i}` : null }));
const rxOk = { id: 'rx1', status: 'confirmed', anzahl_einheiten: 6, gueltig_bis: '2026-12-01', behandlungsbeginn: null, therapie_bereich: 'physio' };

test('bindeSerieAnVerordnung: belegt freie Sitzungen in Datumsreihenfolge', async () => {
  const d = serienDouble({ rx: rxOk, sitzungen: sitz(6, 1) });
  const r = await bindeSerieAnVerordnung(d.sb, { prescriptionId: 'rx1', heute: '2026-10-29',
    created: [{ id: 'b3', start_time: '2026-11-16T15:00:00Z' }, { id: 'b1', start_time: '2026-11-02T15:00:00Z' }, { id: 'b2', start_time: '2026-11-09T15:00:00Z' }] });
  assert.deepEqual(r, { ok: true, gebunden: 3, ueberhang: 0, meldung: '' });
  assert.deepEqual(d.geschrieben, [['s2', 'b1'], ['s3', 'b2'], ['s4', 'b3']]);
});

test('bindeSerieAnVerordnung: Überhang wird gemeldet, keine neuen Zeilen', async () => {
  const d = serienDouble({ rx: { ...rxOk, anzahl_einheiten: 2 }, sitzungen: sitz(2) });
  const r = await bindeSerieAnVerordnung(d.sb, { prescriptionId: 'rx1', heute: '2026-10-29',
    created: [{ id: 'a', start_time: '1' }, { id: 'b', start_time: '2' }, { id: 'c', start_time: '3' }] });
  assert.equal(r.gebunden, 2); assert.equal(r.ueberhang, 1);
  assert.match(r.meldung, /2 von 3 Terminen .* 1 Termin bleibt ohne Verordnung/);
  assert.equal(d.geschrieben.length, 2);
});

test('bindeSerieAnVerordnung: Podologie, abgeschlossen, Blanko, abgelaufen ohne Beginn → nichts binden', async () => {
  for (const [rx, muster] of [
    [{ ...rxOk, therapie_bereich: 'podo' }, /^$/],
    [{ ...rxOk, status: 'completed' }, /abgeschlossen/],
    [{ ...rxOk, anzahl_einheiten: null }, /keine Anzahl/],
    [{ ...rxOk, gueltig_bis: '2026-10-01' }, /abgelaufen/],
  ]) {
    const d = serienDouble({ rx, sitzungen: sitz(6) });
    const r = await bindeSerieAnVerordnung(d.sb, { prescriptionId: 'rx1', heute: '2026-10-29', created: [{ id: 'x', start_time: '1' }] });
    assert.equal(r.gebunden, 0); assert.match(r.meldung, muster); assert.equal(d.geschrieben.length, 0);
  }
});
