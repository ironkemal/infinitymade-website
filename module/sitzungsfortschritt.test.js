import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istFertigBehandelt, hauptbuchFuehrtStatus, pruefeVerordnungsfortschritt } from './sitzungsfortschritt.js';

// Der Fehler, wegen dem es diese Datei gibt (Ops-Karte 12.08.2026):
// nie verplante Platzhalter-Sitzungen hielten das Rezept ewig von 'bereit' fern.
// Sie tauchen hier gar nicht mehr auf — `offen` zählt nur Sitzungen MIT Termin.
test('erbrachte Einheiten schlagen offene Platzhalter', () => {
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 6, einheiten: 6 }), true);
});

test('mehr erbracht als verordnet gilt ebenfalls als fertig', () => {
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 7, einheiten: 6 }), true);
});

// Die Gegenprobe: ohne diese Hälfte der Regel wäre ein Rezept über 6 Einheiten
// schon nach dem ersten abgehakten Termin abrechnungsbereit.
test('abgebrochene Serie wird NICHT automatisch bereit', () => {
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 5, einheiten: 6 }), false);
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 1, einheiten: 6 }), false);
});

test('ein offener Termin blockiert immer', () => {
  assert.equal(istFertigBehandelt({ offen: 1, erbracht: 6, einheiten: 6 }), false);
});

test('ohne verordnete Einheitenzahl reicht: nichts mehr offen', () => {
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 3, einheiten: null }), true);
  assert.equal(istFertigBehandelt({ offen: 2, erbracht: 3, einheiten: null }), false);
});

// ─── Podologie: der Status gehört der Abrechnungsmaske (18.09.2026) ─────────
// Podologie-Verordnungen tragen jetzt ebenfalls Zeilen in prescription_sessions
// (Sitzungsplan). Ohne diese Kapsel stünde ihr Status unter zwei Zählern — und
// der aus dem Hauptbuch käme nie auf 'fertig', weil dort für die Podologie nie
// ein 'done' gesetzt wird: die Verordnung erschiene lautlos nie in der §302-Liste.
test('nur die Podologie gibt den Status an die Abrechnungsmaske ab', () => {
  assert.equal(hauptbuchFuehrtStatus('podo'), false);
  for (const b of ['physio', 'ergo', 'stimme', 'ernaehrung', null, undefined]) {
    assert.equal(hauptbuchFuehrtStatus(b), true, String(b));
  }
});

/** Attrappe, die jede Schreibabfrage mitschreibt. */
function attrappe(rx) {
  const schreib = [];
  const kette = (tabelle) => {
    const q = {
      _t: tabelle,
      select: () => q, eq: () => q, not: () => q, is: () => q, in: () => q,
      update: (p) => { schreib.push({ tabelle, patch: p }); return q; },
      maybeSingle: async () => ({ data: rx }),
      then: (f) => f({ count: 0, data: null }),
    };
    return q;
  };
  return { schreib, client: { from: kette } };
}

test('Podologie: pruefeVerordnungsfortschritt schreibt NICHTS und meldet null', async () => {
  const { schreib, client } = attrappe({ anzahl_einheiten: 6, therapie_bereich: 'podo' });
  assert.equal(await pruefeVerordnungsfortschritt(client, 'rx-1'), null);
  assert.deepEqual(schreib, [], 'kein Statusschreiben für die Podologie');
});

test('Physio: pruefeVerordnungsfortschritt läuft weiter wie bisher', async () => {
  const { schreib, client } = attrappe({ anzahl_einheiten: 6, therapie_bereich: 'physio' });
  const r = await pruefeVerordnungsfortschritt(client, 'rx-2');
  assert.equal(r.einheiten, 6);
  assert.ok(schreib.some(w => w.patch.status === 'in_therapy'), 'Status wird gehoben');
});
