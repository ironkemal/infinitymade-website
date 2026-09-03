import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  berechneZuzahlung,
  wirksameEinheiten,
  guthabenAus,
  korrekturErlaubt,
  zuzahlungFuerRezept,
  zuzahlungFuerPodoVerordnung,
} from './zuzahlung-rechnen.js';

// Die Gegenprobe: dieselbe Frage an das Backend. Der Import greift über die
// Ordnergrenze, weil genau das der Punkt ist — im Browser ist diese Datei nicht
// erreichbar (eigener Container, eigenes Deployment), im Test schon.
import { calcAbrechnungsfallZuzahlung } from '../api-backend/billing/zuzahlung/calculator.js';
import { korrekturErlaubt as korrekturErlaubtBackend } from '../api-backend/billing/zuzahlung/korrektur.js';

// --- Die Verklammerung ------------------------------------------------------
// Der eigentliche Zweck dieser Datei. Läuft eine der beiden Rechnungen weg,
// fällt hier etwas um, und zwar bevor ein Patient einen falschen Betrag
// bezahlt.

/** Ruft den Backend-Calculator mit derselben Fallbeschreibung auf. */
function ueberBackend({ einheiten, preisProEinheit, zuzahlungProEinheit, positionFrei, befreit }) {
  const frei = !!befreit || !!positionFrei;
  const sessions = Array.from({ length: einheiten }, () => ({
    preis_eur: preisProEinheit,
    // So setzt es abrechnung.routes.js zusammen: ist irgendetwas zuzahlungsfrei,
    // gehen 0 und das Kennzeichen gemeinsam in die Sitzung.
    zuzahlung_eur_position: frei ? 0 : zuzahlungProEinheit,
    position_frei: frei,
  }));
  return calcAbrechnungsfallZuzahlung({
    sessions,
    patient: { geburtsdatum: '1970-01-01', befreit_im_jahr: !!befreit },
    behandlungsende: '2026-08-31',
    verordnung_zuzahlungsfrei: !!befreit,
  });
}

const FAELLE = [
  { name: 'Abbruch: 3 von 6 Einheiten', einheiten: 3, preisProEinheit: 25.79, zuzahlungProEinheit: 2.58 },
  { name: 'vollstaendig: 6 Einheiten',  einheiten: 6, preisProEinheit: 25.79, zuzahlungProEinheit: 2.58 },
  { name: 'eine einzige Einheit',       einheiten: 1, preisProEinheit: 25.79, zuzahlungProEinheit: 2.58 },
  { name: 'gar nichts erbracht',        einheiten: 0, preisProEinheit: 25.79, zuzahlungProEinheit: 2.58 },
  { name: 'Position unbekannt (10-%-Ersatz)', einheiten: 4, preisProEinheit: 31.03, zuzahlungProEinheit: null },
  { name: 'guenstige Leistung, Pauschale greift in den Deckel',
    einheiten: 1, preisProEinheit: 8.40, zuzahlungProEinheit: 0.84 },
  { name: 'halbe Cents je Einheit',     einheiten: 7, preisProEinheit: 16.675, zuzahlungProEinheit: 1.6675 },
  { name: 'zuzahlungsfreie Position',   einheiten: 5, preisProEinheit: 22.10, zuzahlungProEinheit: null, positionFrei: true },
  { name: 'befreiter Patient',          einheiten: 6, preisProEinheit: 25.79, zuzahlungProEinheit: 2.58, befreit: true },
  { name: 'Podologie-Preisklasse',      einheiten: 3, preisProEinheit: 34.62, zuzahlungProEinheit: 3.46 },
];

for (const fall of FAELLE) {
  test(`Frontend und Backend rechnen gleich — ${fall.name}`, () => {
    const vorne = berechneZuzahlung(fall);
    const hinten = ueberBackend(fall);

    assert.equal(vorne.brutto, hinten.brutto, 'Brutto');
    assert.equal(vorne.prozent, hinten.prozZuzahlung, 'prozentualer Anteil');
    assert.equal(vorne.pauschale, hinten.pauschZuzahlung, 'Verordnungspauschale');
    assert.equal(vorne.gesamt, hinten.gesZuzahlung, 'Gesamtzuzahlung');
  });
}

// --- Die Regel, um die es Beta-1 geht ---------------------------------------

test('weniger Sitzungen senken den Prozentanteil, nicht die Pauschale', () => {
  const sechs = berechneZuzahlung({ einheiten: 6, preisProEinheit: 25.79, zuzahlungProEinheit: 2.58 });
  const drei  = berechneZuzahlung({ einheiten: 3, preisProEinheit: 25.79, zuzahlungProEinheit: 2.58 });

  // Die 10 € haengen an der Verordnung (§ 61 SGB V), nicht an der Sitzung.
  assert.equal(sechs.pauschale, 10.00);
  assert.equal(drei.pauschale, 10.00);

  assert.equal(sechs.prozent, 15.48);   // 6 × 2,58
  assert.equal(drei.prozent, 7.74);     // 3 × 2,58
  assert.equal(sechs.gesamt, 25.48);
  assert.equal(drei.gesamt, 17.74);
});

test('die Pauschale kann den Bruttobetrag nicht uebersteigen', () => {
  // Eine Einheit zu 8,40 €: 0,84 € Prozentanteil, es bleiben 7,56 € — mehr als
  // das darf die Pauschale nicht sein, sonst zahlt der Patient mehr als die
  // Leistung wert ist.
  const r = berechneZuzahlung({ einheiten: 1, preisProEinheit: 8.40, zuzahlungProEinheit: 0.84 });
  assert.equal(r.pauschale, 7.56);
  assert.equal(r.gesamt, 8.40);
  assert.equal(r.gesamt, r.brutto);
});

test('null Einheiten ergeben null Zuzahlung — auch keine Pauschale', () => {
  const r = berechneZuzahlung({ einheiten: 0, preisProEinheit: 25.79, zuzahlungProEinheit: 2.58 });
  assert.deepEqual(r, { brutto: 0, prozent: 0, pauschale: 0, gesamt: 0, befreit: false });
});

test('Befreiung setzt alles auf null, das Brutto bleibt sichtbar', () => {
  const r = berechneZuzahlung({ einheiten: 6, preisProEinheit: 25.79, zuzahlungProEinheit: 2.58, befreit: true });
  assert.equal(r.gesamt, 0);
  assert.equal(r.befreit, true);
  assert.equal(r.brutto, 154.74);
});

// --- wirksameEinheiten ------------------------------------------------------

test('Korrektur schlaegt erbracht und verordnet', () => {
  assert.equal(wirksameEinheiten({ verordnet: 6, erbracht: 3, korrektur: 2 }), 2);
});

test('die korrigierte Null gilt — sie ist eine Aussage, kein fehlender Wert', () => {
  assert.equal(wirksameEinheiten({ verordnet: 6, erbracht: 3, korrektur: 0 }), 0);
});

test('ohne Korrektur zaehlen die erbrachten Sitzungen', () => {
  assert.equal(wirksameEinheiten({ verordnet: 6, erbracht: 3 }), 3);
});

test('ohne erbrachte Sitzung faellt es auf die verordnete Menge zurueck', () => {
  // Gleicher Rueckfall wie im Backend: eine frisch angelegte Verordnung hat
  // noch keine Sitzung, soll aber trotzdem einen Betrag zeigen.
  assert.equal(wirksameEinheiten({ verordnet: 6, erbracht: 0 }), 6);
  assert.equal(wirksameEinheiten({ verordnet: 6, erbracht: null }), 6);
  assert.equal(wirksameEinheiten({ verordnet: 6 }), 6);
});

test('kaputte Eingaben kippen nicht', () => {
  assert.equal(wirksameEinheiten({ verordnet: null }), 0);
  assert.equal(wirksameEinheiten({ verordnet: undefined, erbracht: undefined }), 0);
  assert.equal(wirksameEinheiten({ verordnet: '6' }), 6);
  assert.equal(wirksameEinheiten({ verordnet: 6, korrektur: -1 }), 6); // negativ zaehlt nicht
});

// --- zuzahlungFuerRezept ----------------------------------------------------
// Der Adapter, den die §302-Vorschauen benutzen. Vorher rechneten sie mit
// anzahl_einheiten und wichen damit von der gedruckten Rechnung ab.

const POS = { preis: 25.79, zuzahlung: 2.58, zuzahlung_frei: false };
const sitzungen = (done, offen = 0) => [
  ...Array.from({ length: done }, () => ({ status: 'done' })),
  ...Array.from({ length: offen }, () => ({ status: 'planned' })),
];

test('Abbruch: der Betrag folgt den erbrachten Sitzungen, nicht der Verordnung', () => {
  const rx = { anzahl_einheiten: 6, prescription_sessions: sitzungen(3, 3) };
  const r = zuzahlungFuerRezept(rx, POS);
  assert.equal(r.erbracht, 3);
  assert.equal(r.verordnet, 6);
  assert.equal(r.einheiten, 3);
  assert.equal(r.gesamt, 17.74);   // 3 × 2,58 + 10,00
});

test('abgesagte und nicht wahrgenommene Sitzungen zaehlen nicht mit', () => {
  const rx = {
    anzahl_einheiten: 6,
    prescription_sessions: [
      ...sitzungen(3),
      { status: 'cancelled' }, { status: 'no_show' }, { status: 'planned' },
    ],
  };
  assert.equal(zuzahlungFuerRezept(rx, POS).einheiten, 3);
});

test('ohne dokumentierte Sitzung gilt die verordnete Menge', () => {
  const rx = { anzahl_einheiten: 6, prescription_sessions: [] };
  const r = zuzahlungFuerRezept(rx, POS);
  assert.equal(r.einheiten, 6);
  assert.equal(r.gesamt, 25.48);
});

test('fehlende Einbettung kippt nicht — es gilt die verordnete Menge', () => {
  assert.equal(zuzahlungFuerRezept({ anzahl_einheiten: 6 }, POS).einheiten, 6);
});

test('ohne Katalogposition bleibt der Betrag bei null statt zu raten', () => {
  const r = zuzahlungFuerRezept({ anzahl_einheiten: 6, prescription_sessions: sitzungen(3) }, null);
  assert.equal(r.brutto, 0);
  assert.equal(r.gesamt, 0);
});

test('zuzahlungsfreie Position heisst 0 %, nicht "unbekannt"', () => {
  // Der Fehler, den der Kommentar in der alten Vorschau festhielt: ohne diese
  // Unterscheidung wurden 10 % berechnet, waehrend die Rechnung 0 € auswies.
  const frei = { preis: 22.10, zuzahlung: null, zuzahlung_frei: true };
  const r = zuzahlungFuerRezept({ anzahl_einheiten: 5, prescription_sessions: sitzungen(5) }, frei);
  assert.equal(r.prozent, 0);
});

test('befreiter Patient bleibt bei null, egal wie viele Sitzungen', () => {
  const rx = { anzahl_einheiten: 6, zuzahlung_befreit: true, prescription_sessions: sitzungen(3) };
  assert.equal(zuzahlungFuerRezept(rx, POS).gesamt, 0);
});

// --- guthabenAus ------------------------------------------------------------

test('zu viel gezahlt ergibt Guthaben', () => {
  assert.equal(guthabenAus({ soll: 17.74, ist: 25.48 }), 7.74);
});

test('zu wenig gezahlt ergibt KEIN negatives Guthaben', () => {
  // Das ist eine Restforderung und gehoert ins Mahnwesen, nicht hierher.
  assert.equal(guthabenAus({ soll: 25.48, ist: 17.74 }), 0);
});

test('punktgenau bezahlt ergibt kein Guthaben', () => {
  assert.equal(guthabenAus({ soll: 25.48, ist: 25.48 }), 0);
});

test('nichts gezahlt ergibt kein Guthaben', () => {
  assert.equal(guthabenAus({ soll: 25.48, ist: 0 }), 0);
});

// --- korrekturErlaubt -------------------------------------------------------

test('offene Verordnung darf korrigiert werden', () => {
  assert.equal(korrekturErlaubt({ belegnummer: null, abrechnung_status: null }).erlaubt, true);
  assert.equal(korrekturErlaubt({ belegnummer: null, abrechnung_status: 'bereit' }).erlaubt, true);
});

test('eine vergebene Belegnummer sperrt endgueltig', () => {
  const r = korrekturErlaubt({ belegnummer: '4711-3', abrechnung_status: 'bereit' });
  assert.equal(r.erlaubt, false);
  assert.match(r.grund, /Korrekturverfahren/);
});

test('Rezept in laufender Abrechnung ist gesperrt', () => {
  for (const st of ['in_abrechnung', 'gesendet', 'accepted', 'paid']) {
    assert.equal(korrekturErlaubt({ abrechnung_status: st }).erlaubt, false, st);
  }
});

test('nach einer Absetzung darf wieder korrigiert werden', () => {
  // Der Kern: bei der Absetzung wird der Status auf 'bereit' zurueckgesetzt,
  // die abrechnung_id aber stehen gelassen. Haenge der Riegel an abrechnung_id,
  // waere genau das Rezept gesperrt, das man jetzt anfassen muss.
  const rx = { abrechnung_id: 'irgendeine-uuid', abrechnung_status: 'bereit', belegnummer: null };
  assert.equal(korrekturErlaubt(rx).erlaubt, true);
});

test('bereits kassierte Zuzahlung ist kein Riegel', () => {
  // Der Normalfall des Abbruchs: der Patient hat im Voraus gezahlt. Genau
  // daraus entsteht das Guthaben.
  const rx = { zuzahlung_kassiert_am: '2026-08-20T10:00:00Z', abrechnung_status: 'bereit' };
  assert.equal(korrekturErlaubt(rx).erlaubt, true);
});

test('fehlende Verordnung wird abgewiesen statt durchgelassen', () => {
  assert.equal(korrekturErlaubt(null).erlaubt, false);
});

// Zweite Verklammerung: die Oberflaeche versteckt den Knopf, das Backend haelt
// den Riegel. Sagen die beiden Verschiedenes, sieht der Anwender entweder einen
// Knopf, der 409 wirft, oder — schlimmer — keinen Knopf fuer etwas Erlaubtes.
const RIEGEL_FAELLE = [
  { name: 'frisch, ohne Status',        rx: { belegnummer: null, abrechnung_status: null } },
  { name: 'bereit',                     rx: { belegnummer: null, abrechnung_status: 'bereit' } },
  { name: 'in Abrechnung',              rx: { belegnummer: null, abrechnung_status: 'in_abrechnung' } },
  { name: 'gesendet',                   rx: { belegnummer: null, abrechnung_status: 'gesendet' } },
  { name: 'accepted',                   rx: { belegnummer: null, abrechnung_status: 'accepted' } },
  { name: 'paid',                       rx: { belegnummer: null, abrechnung_status: 'paid' } },
  { name: 'rejected',                   rx: { belegnummer: null, abrechnung_status: 'rejected' } },
  { name: 'Belegnummer vergeben',       rx: { belegnummer: '4711-3', abrechnung_status: 'bereit' } },
  { name: 'nach Absetzung',             rx: { belegnummer: null, abrechnung_status: 'bereit', abrechnung_id: 'uuid' } },
  { name: 'bereits kassiert',           rx: { belegnummer: null, abrechnung_status: 'bereit', zuzahlung_kassiert_am: '2026-08-20T09:00:00Z' } },
  { name: 'gar keine Verordnung',       rx: null },
];

for (const fall of RIEGEL_FAELLE) {
  test(`Riegel vorne und hinten gleich — ${fall.name}`, () => {
    assert.equal(
      korrekturErlaubt(fall.rx).erlaubt,
      korrekturErlaubtBackend(fall.rx).erlaubt,
    );
  });
}

/* ── Podologie: mehrere verschiedene Positionen an einem Tag ──────────────── */
// Anlass: Beta-1, 31.08.2026 — podologische Behandlung + Befundung zusammen,
// und nirgends stand die Summe. Im Physio-Topf ist eine Verordnung „n mal
// dieselbe Position"; hier ist sie es nicht, und genau daran scheitert die
// Rechnung „Preis × Einheiten".

// Auszug aus api-backend/billing/codes/podologie_positions.js (ab 01.07.2025).
const PODO_KATALOG = {
  '78010': { preis: 35.16, zuzahlung: 3.52, label: 'Podologische Behandlung (klein)' },
  '78030': { preis: 3.47,  zuzahlung: 0.35, label: 'Podologische Befundung' },
  '78040': { preis: 22.48, zuzahlung: 2.25, label: 'Eingangsbefundung' },
  // Zuzahlungsfrei laut Katalog — `zuzahlung: null` heisst hier FREI, nicht
  // „unbekannt". Die Unterscheidung ist bares Geld für den Patienten.
  '78530': { preis: 8.62,  zuzahlung: null, label: 'Therapiebericht' },
};
const findePodoPosition = (code) => PODO_KATALOG[code] || null;

test('Podologie: Behandlung + Befundung an einem Tag ergeben eine Summe', () => {
  const r = zuzahlungFuerPodoVerordnung(
    { zuzahlung_befreit: false },
    [{ behandlungsdatum: '2026-08-03', hpnr_codes: ['78010', '78030'] }],
    findePodoPosition,
  );
  assert.equal(r.brutto, 38.63);          // 35,16 + 3,47
  assert.equal(r.prozent, 3.87);          //  3,52 + 0,35
  assert.equal(r.pauschale, 10.00);       // je Verordnung, gedeckelt
  assert.equal(r.gesamt, 13.87);
});

test('Podologie: dieselbe Rechnung wie das Backend', () => {
  // Zwei Behandlungstage, beim ersten zusätzlich die Eingangsbefundung.
  const behs = [
    { behandlungsdatum: '2026-08-03', hpnr_codes: ['78010', '78040'] },
    { behandlungsdatum: '2026-08-17', hpnr_codes: ['78010', '78030'] },
  ];
  const vorne = zuzahlungFuerPodoVerordnung({ zuzahlung_befreit: false }, behs, findePodoPosition);

  // So klopft das Backend Behandlung × hpnr_codes flach (mapVerordnungToDtaShape).
  const sessions = behs.flatMap(b => b.hpnr_codes.map(c => ({
    preis_eur: PODO_KATALOG[c].preis,
    zuzahlung_eur_position: PODO_KATALOG[c].zuzahlung,
    position_frei: PODO_KATALOG[c].zuzahlung == null,
  })));
  const hinten = calcAbrechnungsfallZuzahlung({
    sessions,
    patient: { geburtsdatum: '1970-01-01', befreit_im_jahr: false },
    behandlungsende: '2026-08-17',
    verordnung_zuzahlungsfrei: false,
  });

  assert.equal(vorne.brutto, hinten.brutto);
  assert.equal(vorne.prozent, hinten.prozZuzahlung);
  assert.equal(vorne.pauschale, hinten.pauschZuzahlung);
  assert.equal(vorne.gesamt, hinten.gesZuzahlung);
});

test('Podologie: zuzahlungsfreie Position zählt zum Brutto, nicht zum Prozentanteil', () => {
  const r = zuzahlungFuerPodoVerordnung(
    { zuzahlung_befreit: false },
    [{ behandlungsdatum: '2026-08-03', hpnr_codes: ['78010', '78530'] }],
    findePodoPosition,
  );
  assert.equal(r.brutto, 43.78);   // 35,16 + 8,62
  assert.equal(r.prozent, 3.52);   // nur 78010 — 78530 ist frei
});

test('Podologie: unbekannter Code wird gemeldet, nicht still mit 0 gerechnet', () => {
  // Ein Code ohne Katalogtreffer bekommt Preis 0 und die 10-%-Ersatzrechnung
  // (also ebenfalls 0). Das Ergebnis ist dasselbe wie „vergessen" — deshalb
  // MUSS er in `unbekannt` auftauchen, sonst sieht die Oberfläche eine
  // vollständige Summe, die keine ist.
  const r = zuzahlungFuerPodoVerordnung(
    { zuzahlung_befreit: false },
    [{ behandlungsdatum: '2026-08-03', hpnr_codes: ['78010', '79999'] }],
    findePodoPosition,
  );
  assert.deepEqual(r.unbekannt, ['79999']);
  assert.equal(r.brutto, 35.16);
});

test('Podologie: Befreiung setzt alles auf 0, das Brutto bleibt sichtbar', () => {
  const r = zuzahlungFuerPodoVerordnung(
    { zuzahlung_befreit: true },
    [{ behandlungsdatum: '2026-08-03', hpnr_codes: ['78010', '78030'] }],
    findePodoPosition,
  );
  assert.equal(r.brutto, 38.63);
  assert.equal(r.gesamt, 0);
  assert.equal(r.befreit, true);
});

test('Podologie: gleiche Position an zwei Tagen wird in der Zeile gezählt', () => {
  const r = zuzahlungFuerPodoVerordnung(
    { zuzahlung_befreit: false },
    [
      { behandlungsdatum: '2026-08-03', hpnr_codes: ['78010'] },
      { behandlungsdatum: '2026-08-17', hpnr_codes: ['78010'] },
    ],
    findePodoPosition,
  );
  const zeile = r.zeilen.find(z => z.code === '78010');
  assert.equal(zeile.anzahl, 2);
  assert.equal(zeile.summe, 70.32);
});
