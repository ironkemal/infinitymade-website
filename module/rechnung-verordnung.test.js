import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verordnungenLaden, verordnungenRendern, verordnungAuswahl, verordnungenZuruecksetzen } from './rechnung-verordnung.js';

// Minimaler DOM-Stub — genug für verordnungenRendern (createElement/appendChild/
// addEventListener/dataset/style/setAttribute), kein jsdom im Projekt.
function fakeElement() {
  const attrs = {};
  const listeners = {};
  return {
    style: {},
    dataset: {},
    children: [],
    _attrs: attrs,
    _listeners: listeners,
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, val) { attrs[name] = val; },
    getAttribute(name) { return attrs[name]; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    _fire(type) { for (const fn of (listeners[type] || [])) fn(); },
  };
}

function fakeDocument() {
  return {
    createElement: () => fakeElement(),
    createTextNode: (text) => ({ textContent: text }),
  };
}

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

// Ops #293-Nebenfund (Live-Test 17.09.2026): der Physio-Weg löste den Preis
// bislang nur über `bookings.services` auf. Seit Ops 235 tragen moderne
// Termine ihre Leistung(en) in `booking_leistungen` — für sie blieb
// `bookings.services` leer, der Preis fiel still auf 0 (kein Fehler, keine
// Warnung, die Rechnung sah vollständig aus). `terminLeistungen()` kennt
// beide Wege; dieser Test nagelt fest, dass der booking_leistungen-Pfad
// tatsächlich den Katalogpreis liefert statt 0.
test('Physio: Preis kommt auch aus booking_leistungen, nicht nur bookings.services', async () => {
  const liste = await verordnungenLaden(fakeSb({
    prescriptions: [{
      id: 'rx1', ausstellungsdatum: '2026-08-01', diagnosegruppe: 'WS',
      heilmittel: 'Manuelle Therapie', anzahl_einheiten: 6,
      prescription_sessions: [{ id: 's1', booking_id: 'bk1', status: 'done', done_at: '2026-08-05' }],
    }],
    bookings: [{
      id: 'bk1',
      services: null, // moderner Kombi-Termin: die alte Einzel-Spalte ist leer
      booking_leistungen: [
        { anzahl: 2, sort_order: 0, services: { title: 'Manuelle Therapie', price: 27.50, price_config: null } },
      ],
    }],
  }), { ownerId: 'o1', leadId: 'p1', sector: 'physio', katalogPodo: [] });

  assert.equal(liste.length, 1);
  const beh = liste[0].behandlungen[0];
  assert.equal(beh.zeilen[0].title, 'Manuelle Therapie');
  assert.equal(beh.zeilen[0].unit_price, 27.5);
  assert.equal(beh.zeilen[0].quantity, 2);
  assert.equal(Number(beh.betrag.toFixed(2)), 55);
  assert.equal(beh.hinweis, null);
});

// Kemal-Entscheidung 17.09.2026 (Ops #296, Nebenfund aus #293): eine Behandlung
// ohne verknüpften Termin trägt 0,00 € — ihr Kästchen darf nicht mitgehakt
// bei den Rechnungszeilen landen, auch nicht über den "alles auswählen"-Kopf-
// haken der Verordnung. Erst nach Verknüpfen des Termins taucht sie ohne
// Hinweis auf und ist dann normal wählbar.
test('verordnungenRendern: Behandlung ohne Termin bleibt ungehakt, auch bei "alles auswählen"', () => {
  const liste = [{
    id: 'v1', nummer: null, datum: '2026-08-01', titel: 'Testverordnung',
    gesamt: 27.5, einheiten: 2, quelle: 'physio',
    behandlungen: [
      { id: 'b1', datum: '2026-08-05', betrag: 27.5, hinweis: null,
        zeilen: [{ title: 'Manuelle Therapie', quantity: 1, unit_price: 27.5 }] },
      { id: 'b2', datum: '2026-08-12', betrag: 0, hinweis: 'kein Termin verknüpft',
        zeilen: [{ title: 'Manuelle Therapie', quantity: 1, unit_price: 0 }] },
    ],
  }];

  global.document = fakeDocument();
  const container = fakeElement();
  verordnungenZuruecksetzen();
  verordnungenRendern(container, liste, { escapeHtml: (s) => s, formatEur: (n) => n.toFixed(2) + ' €', onAuswahl: () => {} });

  const vordRow = container.children[0];
  const vordCb = vordRow.children[1];
  const subList = container.children[1];
  const subCb1 = subList.children[0].children[0];
  const subCb2 = subList.children[1].children[0];

  // Startzustand: verfügbare Behandlung gehakt, gesperrte nicht — und disabled.
  assert.equal(subCb1.checked, true);
  assert.equal(!!subCb1.disabled, false);
  assert.equal(subCb2.checked, false);
  assert.equal(subCb2.disabled, true);

  // "Alles auswählen" über den Kopfhaken darf die gesperrte Behandlung nicht mitreissen.
  vordCb.checked = true;
  vordCb._fire('change');
  assert.equal(subCb1.checked, true);
  assert.equal(subCb2.checked, false);

  const auswahl = verordnungAuswahl();
  assert.equal(auswahl.zeilen.length, 1);
  assert.equal(auswahl.zeilen[0].unit_price, 27.5);
});

// Gleiche Sperre, Podologie-Ursache: kein HPNR-Code und kein betrag_gkv
// hinterlegt trägt ebenfalls garantiert 0,00 € ("kein Betrag hinterlegt").
// Auf Kemal-Wunsch 17.09.2026 auf diese zweite Ursache erweitert — ein Kode,
// der nur teilweise unbekannt ist ("Position X unbekannt"), bleibt dagegen
// wählbar, weil dort ein echter Teilbetrag steht.
test('verordnungenRendern: Podologie-Behandlung ohne Betrag bleibt ungehakt, Teilbetrag bleibt wählbar', () => {
  const liste = [{
    id: 'v1', nummer: null, datum: '2026-08-01', titel: 'Testverordnung',
    gesamt: 36.1, einheiten: 3, quelle: 'podologie',
    behandlungen: [
      { id: 'b1', datum: '2026-08-05', betrag: 36.1, hinweis: null,
        zeilen: [{ title: 'Podologische Behandlung (klein)', quantity: 1, unit_price: 36.1 }] },
      { id: 'b2', datum: '2026-08-12', betrag: 0, hinweis: 'kein Betrag hinterlegt',
        zeilen: [{ title: 'Testverordnung', quantity: 1, unit_price: 0 }] },
      { id: 'b3', datum: '2026-08-19', betrag: 36.1, hinweis: 'Position 99999 unbekannt',
        zeilen: [{ title: 'Podologische Behandlung (klein)', quantity: 1, unit_price: 36.1 }] },
    ],
  }];

  global.document = fakeDocument();
  const container = fakeElement();
  verordnungenZuruecksetzen();
  verordnungenRendern(container, liste, { escapeHtml: (s) => s, formatEur: (n) => n.toFixed(2) + ' €', onAuswahl: () => {} });

  const subList = container.children[1];
  const subCbOhneBetrag = subList.children[1].children[0];
  const subCbTeilbekannt = subList.children[2].children[0];

  assert.equal(subCbOhneBetrag.checked, false);
  assert.equal(subCbOhneBetrag.disabled, true);
  // Teilweise unbekannter Kode ist keine 0-€-Garantie — bleibt normal wählbar.
  assert.equal(subCbTeilbekannt.checked, true);
  assert.equal(!!subCbTeilbekannt.disabled, false);
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
