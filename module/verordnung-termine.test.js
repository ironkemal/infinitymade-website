import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istVergeben, terminZaehler, bindeTermin, loeseTermin } from './verordnung-termine.js';

// Warum es diese Datei gibt:
// Beim Entwurf der Spalte `bookings.verordnung_id` (03.09.2026) hat `db-ustasi`
// zwei Zählfehler vorhergesagt, die man in der Oberfläche nicht sieht, weil das
// Ergebnis plausibel aussieht. Beide sind hier festgenagelt.

/* ── Falle 1: abgesagte Termine ──────────────────────────────────────────── */
// Wer jeden Termin mit `verordnung_id` als vergeben zählt, lässt eine Absage
// eine Einheit auffressen: die Verordnung sieht voll aus, obwohl noch
// behandelt werden muss. Der Physio-Topf hat das Problem nicht — dort leert
// `sitzung-abgleich` beim Storno die Zeile.

test('abgesagte und nicht wahrgenommene Termine zählen nicht als vergeben', () => {
  assert.equal(istVergeben({ status: 'confirmed' }), true);
  assert.equal(istVergeben({ status: 'completed' }), true);
  assert.equal(istVergeben({ status: 'pending' }), true);
  assert.equal(istVergeben({ status: 'cancelled' }), false);
  assert.equal(istVergeben({ status: 'no_show' }), false);
  // `no_show` gibt es zweimal: als Status und als eigene Spalte. Ein Termin,
  // der als „confirmed" stehen blieb und nachträglich als nicht wahrgenommen
  // markiert wurde, darf ebenfalls keine Einheit verbrauchen.
  assert.equal(istVergeben({ status: 'confirmed', no_show: true }), false);
});

test('der Zähler lässt abgesagte Termine aus der Restmenge heraus', () => {
  const z = terminZaehler({ behandlungseinheiten: 6 }, [
    { status: 'confirmed' },
    { status: 'completed' },
    { status: 'cancelled' },
    { status: 'confirmed', no_show: true },
  ]);
  assert.deepEqual(z, { verordnet: 6, belegt: 2, offen: 4 });
});

/* ── Falle 2: Einheitenzahl nicht erfasst ────────────────────────────────── */
// `verordnungen.behandlungseinheiten` ist NULLABLE, und live gibt es solche
// Zeilen. Ein stilles `|| 0` machte daraus „0 verordnet" — die Anzeige läse
// sich dann wie „alles vergeben", also genau falsch herum.

test('ohne erfasste Einheitenzahl gibt es keine Restmenge, nur die Zahl der Termine', () => {
  const z = terminZaehler({ behandlungseinheiten: null }, [{ status: 'confirmed' }]);
  assert.deepEqual(z, { verordnet: null, belegt: 1, offen: null });

  // Auch der leere String (Formularwert) darf nicht als 0 durchgehen.
  assert.equal(terminZaehler({ behandlungseinheiten: '' }, []).verordnet, null);
  assert.equal(terminZaehler({}, []).verordnet, null);
});

test('eine erfasste 0 ist etwas anderes als „nicht erfasst"', () => {
  const z = terminZaehler({ behandlungseinheiten: 0 }, []);
  assert.equal(z.verordnet, 0);
  assert.equal(z.offen, 0);
});

test('mehr Termine als verordnet ergibt keine negative Restmenge', () => {
  const z = terminZaehler({ behandlungseinheiten: 2 }, [
    { status: 'confirmed' }, { status: 'confirmed' }, { status: 'confirmed' },
  ]);
  assert.equal(z.belegt, 3);
  assert.equal(z.offen, 0);
});

/* ── Falle 3: das UPDATE, das nichts tut und Erfolg meldet ────────────────── */
// Ein UPDATE, das die Zeilensicherheit nicht passieren darf, wirft KEINEN
// Fehler — PostgREST meldet Erfolg mit null betroffenen Zeilen. Das wird real,
// sobald Angestellte `verordnungen` lesen, aber nicht schreiben dürfen: die
// Oberfläche sagte „gespeichert", die Datenbank hatte nichts getan.


/** Supabase-Ersatz, der genau das zurückgibt, was PostgREST zurückgäbe. */
function fakeUpdate({ rows = [], error = null } = {}) {
  const kette = {
    update: () => kette,
    eq: () => kette,
    select: () => Promise.resolve({ data: rows, error }),
  };
  return { from: () => kette };
}

test('zugeordnet gilt nur, wenn die Datenbank eine Zeile zurückgibt', async () => {
  const gut = await bindeTermin(fakeUpdate({ rows: [{ id: 'b1' }] }), { bookingId: 'b1', vordId: 'v1' });
  assert.equal(gut.ok, true);
});

test('null betroffene Zeilen ist ein Fehler, kein Erfolg', async () => {
  const leer = await bindeTermin(fakeUpdate({ rows: [] }), { bookingId: 'b1', vordId: 'v1' });
  assert.equal(leer.ok, false);
  assert.match(leer.fehler, /nicht geändert/);

  const geloest = await loeseTermin(fakeUpdate({ rows: [] }), { bookingId: 'b1' });
  assert.equal(geloest.ok, false);
});

test('der Owner-Riegel der Datenbank wird im Klartext durchgereicht', async () => {
  // `trg_booking_verordnung_owner` wirft 42501 mit fertigem deutschem Satz.
  // Ihn durch einen eigenen zu ersetzen hiesse, die genauere Meldung wegzuwerfen.
  const res = await bindeTermin(
    fakeUpdate({ error: { code: '42501', message: 'Diese Verordnung gehoert zu einer anderen Praxis.' } }),
    { bookingId: 'b1', vordId: 'v1' },
  );
  assert.equal(res.ok, false);
  assert.match(res.fehler, /anderen Praxis/);
});
