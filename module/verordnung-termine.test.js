import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istVergeben, terminZaehler } from './verordnung-termine.js';

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
