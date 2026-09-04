import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verordnungenLaden } from './rechnung-verordnung.js';

// Warum es diese Datei gibt:
// Der Betrag einer Podologie-Behandlung entsteht nicht in der Datenbank, sondern
// beim Auflösen der HPNR-Kodes gegen den Vergütungskatalog. `betrag_gkv` wird
// beim Dokumentieren einer Behandlung nicht geschrieben und ist in der Praxis
// NULL — wer sich darauf verlässt, stellt 0,00 € in Rechnung. Diese Tests nageln
// die Reihenfolge fest: erst die Kodes, dann betrag_gkv, sonst ein Hinweis.

// Seit 04.09.2026 EIN Verordnungstopf: die Fixtures unten stehen als
// `prescriptions` (nicht mehr `verordnungen`) mit den dortigen Feldnamen
// (`anzahl_einheiten` statt `behandlungseinheiten`) — `verordnungenLaden()`
// übersetzt intern über `verordnung-topf.js` (`ausTopf`).

// Auszug aus GKV_LEISTUNGSKATALOG.podologie (dashboard.js), Preise nach
// applyGueltigePreise() zum Stichtag 2026.
const KATALOG = [
  { code: '78010', title: 'Podologische Behandlung (klein)', price: 36.10 },
  { code: '78020', title: 'Podologische Komplexbehandlung', price: 51.92 },
  { code: '78030', title: 'Podologische Befundung', price: 3.57 },
];

/** Minimaler Supabase-Ersatz: liefert je Tabelle eine feste Antwort. */
function fakeSb(tabellen) {
  const kette = (tabelle) => {
    const selbst = {
      select: () => selbst,
      eq: () => selbst,
      in: () => selbst,
      order: () => Promise.resolve({ data: tabellen[tabelle] || [], error: null }),
      then: (res) => res({ data: tabellen[tabelle] || [], error: null }),
    };
    return selbst;
  };
  return { from: kette };
}

const OPTS = { ownerId: 'o1', leadId: 'p1', sector: 'podologie', katalogPodo: KATALOG };

test('jeder HPNR-Kode wird eine eigene Rechnungszeile mit Katalogpreis', async () => {
  const liste = await verordnungenLaden(fakeSb({
    prescriptions: [{
      id: 'v1', ausstellungsdatum: '2026-08-01', diagnosegruppe: 'DF',
      heilmittel_items: [{ code: '78010' }], anzahl_einheiten: 10,
    }],
    podologie_behandlungen: [
      { id: 'b1', verordnung_id: 'v1', behandlungsdatum: '2026-08-05', hpnr_codes: ['78010', '78030'], betrag_gkv: null },
    ],
  }), OPTS);

  assert.equal(liste.length, 1);
  const beh = liste[0].behandlungen[0];
  assert.deepEqual(beh.zeilen.map(z => z.title), [
    'Podologische Behandlung (klein)', 'Podologische Befundung',
  ]);
  // 36,10 + 3,57 — nicht betrag_gkv (das ist NULL) und nicht 0.
  assert.equal(Number(beh.betrag.toFixed(2)), 39.67);
  assert.equal(beh.hinweis, null);
});

test('der Verordnungsbetrag ist die Summe ihrer Behandlungen', async () => {
  const liste = await verordnungenLaden(fakeSb({
    prescriptions: [{ id: 'v1', ausstellungsdatum: '2026-08-01', diagnosegruppe: 'DF', heilmittel_items: [], anzahl_einheiten: 6 }],
    podologie_behandlungen: [
      { id: 'b1', verordnung_id: 'v1', behandlungsdatum: '2026-08-05', hpnr_codes: ['78010', '78030'] },
      { id: 'b2', verordnung_id: 'v1', behandlungsdatum: '2026-08-12', hpnr_codes: ['78010', '78030'] },
    ],
  }), OPTS);

  assert.equal(Number(liste[0].gesamt.toFixed(2)), 79.34);
  assert.equal(liste[0].behandlungen.length, 2);
  assert.equal(liste[0].einheiten, 6);
});

// Ohne Kodes bleibt betrag_gkv der einzige Anhaltspunkt. Geschätzt wird nichts.
test('ohne HPNR-Kodes zaehlt betrag_gkv', async () => {
  const liste = await verordnungenLaden(fakeSb({
    prescriptions: [{ id: 'v1', ausstellungsdatum: '2026-08-01', diagnosegruppe: 'NF', heilmittel_items: [], anzahl_einheiten: 3 }],
    podologie_behandlungen: [{ id: 'b1', verordnung_id: 'v1', behandlungsdatum: '2026-08-05', hpnr_codes: [], betrag_gkv: '42.50' }],
  }), OPTS);

  assert.equal(liste[0].behandlungen[0].betrag, 42.5);
  assert.equal(liste[0].behandlungen[0].hinweis, null);
});

test('ohne Kodes und ohne Betrag wird 0 gemeldet statt still gerechnet', async () => {
  const liste = await verordnungenLaden(fakeSb({
    prescriptions: [{ id: 'v1', ausstellungsdatum: '2026-08-01', diagnosegruppe: 'NF', heilmittel_items: [], anzahl_einheiten: 3 }],
    podologie_behandlungen: [{ id: 'b1', verordnung_id: 'v1', behandlungsdatum: '2026-08-05', hpnr_codes: [], betrag_gkv: null }],
  }), OPTS);

  assert.equal(liste[0].behandlungen[0].betrag, 0);
  assert.equal(liste[0].behandlungen[0].hinweis, 'kein Betrag hinterlegt');
});

// Ein Kode, den der Katalog nicht kennt, darf nicht als 0 € mitlaufen —
// sonst sieht die Rechnung vollständig aus und ist es nicht.
test('unbekannter Kode wird gemeldet, nicht mit 0 mitgerechnet', async () => {
  const liste = await verordnungenLaden(fakeSb({
    prescriptions: [{ id: 'v1', ausstellungsdatum: '2026-08-01', diagnosegruppe: 'DF', heilmittel_items: [], anzahl_einheiten: 4 }],
    podologie_behandlungen: [{ id: 'b1', verordnung_id: 'v1', behandlungsdatum: '2026-08-05', hpnr_codes: ['78010', '99999'] }],
  }), OPTS);

  const beh = liste[0].behandlungen[0];
  assert.equal(beh.zeilen.length, 1);
  assert.equal(Number(beh.betrag.toFixed(2)), 36.10);
  assert.match(beh.hinweis, /99999/);
});

// Der Zeilentitel ist der Name der Leistung, nicht die Diagnosegruppe —
// solange sich aus heilmittel_items einer ableiten lässt.
test('Verordnungstitel kommt aus heilmittel_items, sonst aus der Diagnosegruppe', async () => {
  const mit = await verordnungenLaden(fakeSb({
    prescriptions: [{ id: 'v1', ausstellungsdatum: '2026-08-01', diagnosegruppe: 'DF', heilmittel_items: [{ code: '78020' }], anzahl_einheiten: 4 }],
    podologie_behandlungen: [],
  }), OPTS);
  assert.equal(mit[0].titel, 'Podologische Komplexbehandlung');

  const ohne = await verordnungenLaden(fakeSb({
    prescriptions: [{ id: 'v1', ausstellungsdatum: '2026-08-01', diagnosegruppe: 'NF', heilmittel_items: [], anzahl_einheiten: 4 }],
    podologie_behandlungen: [],
  }), OPTS);
  assert.equal(ohne[0].titel, 'NF');
});

// Eine Verordnung ohne dokumentierte Behandlung ist nicht abrechenbar. Sie wird
// gelistet (der Podologe soll sehen, dass es sie gibt), trägt aber 0 €.
test('Verordnung ohne dokumentierte Behandlung bleibt bei 0', async () => {
  const liste = await verordnungenLaden(fakeSb({
    prescriptions: [{ id: 'v1', ausstellungsdatum: '2026-08-01', diagnosegruppe: 'DF', heilmittel_items: [], anzahl_einheiten: 10 }],
    podologie_behandlungen: [],
  }), OPTS);

  assert.equal(liste[0].behandlungen.length, 0);
  assert.equal(liste[0].gesamt, 0);
});
