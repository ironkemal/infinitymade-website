// Tests für die PLZ → Bundesland-Zuordnung der Preisabfrage.
//   node api-backend/billing/codes/plz-bundesland.test.js
//
// Anlass: Ops-Karte 178. Die alte Präfix-Tabelle in abrechnung.routes.js hatte
// neun doppelte Schlüssel und einen stillen Vorgabewert 'NW'. Beides erzeugte
// falsche Preise, ohne eine Fehlermeldung. Die neun Fälle stehen hier
// namentlich — sie sind der Grund, warum es diese Datei gibt.

import {
  bundeslandFuerPlz, bundeslandKandidaten, bundeslandFehlerText,
  BUNDESLAENDER, PLZ_ANZAHL,
} from './plz-bundesland.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('plz-bundesland');

// ── Die neun Präfixe aus Karte 178 ────────────────────────────────────────
// Links das Präfix, das die alte Tabelle doppelt führte; rechts, was sie
// zurückgab. Jede Zeile hier war vorher falsch.

const NEUN = [
  // [PLZ,   erwartet, alte falsche Antwort, Ort]
  ['21335', 'NI', 'SH', 'Lüneburg'],
  ['22765', 'HH', 'SH', 'Hamburg-Altona'],
  ['27568', 'HB', 'NI', 'Bremerhaven'],
  ['38100', 'NI', 'ST', 'Braunschweig'],
  ['63739', 'BY', 'HE', 'Aschaffenburg'],
  ['19348', 'BB', 'MV', 'Perleberg'],
  ['07545', 'TH', 'SN', 'Gera'],
  ['36037', 'HE', 'TH', 'Fulda'],
  ['37073', 'NI', 'TH', 'Göttingen'],
];

for (const [plz, erwartet, alt, ort] of NEUN) {
  test(`${plz} ${ort} → ${erwartet} (alt: ${alt})`, () => {
    const ist = bundeslandFuerPlz(plz);
    assert.equal(ist, erwartet,
      `${plz} (${ort}) muss ${erwartet} sein, ist ${ist}. ` +
      `Die alte Praefix-Tabelle gab hier ${alt} zurueck.`);
    assert.notEqual(ist, alt, `Rueckfall auf die alte Praefix-Antwort ${alt}.`);
  });
}

// Die Gegenprobe: die zweite Hälfte der doppelten Präfixe bleibt richtig.
test('21079 Hamburg-Harburg → HH (gleiches Praefix wie Lueneburg)', () =>
  assert.equal(bundeslandFuerPlz('21079'), 'HH'));
test('27283 Verden → NI (gleiches Praefix wie Bremerhaven)', () =>
  assert.equal(bundeslandFuerPlz('27283'), 'NI'));
test('63067 Offenbach → HE (gleiches Praefix wie Aschaffenburg)', () =>
  assert.equal(bundeslandFuerPlz('63067'), 'HE'));
test('19053 Schwerin → MV (gleiches Praefix wie Perleberg)', () =>
  assert.equal(bundeslandFuerPlz('19053'), 'MV'));
test('36433 Bad Salzungen → TH (gleiches Praefix wie Fulda)', () =>
  assert.equal(bundeslandFuerPlz('36433'), 'TH'));
test('37327 Leinefelde → TH (gleiches Praefix wie Goettingen)', () =>
  assert.equal(bundeslandFuerPlz('37327'), 'TH'));

// ── Kein stiller Vorgabewert mehr ─────────────────────────────────────────

test('Unbekannte PLZ → null, nicht NW', () => {
  assert.equal(bundeslandFuerPlz('99999'), null,
    'Ein geratenes NW schlaegt in einen falschen Preis um. Lieber Abbruch.');
  assert.equal(bundeslandFuerPlz('00000'), null);
});

test('Leere/kaputte Eingabe → null', () => {
  for (const wert of ['', null, undefined, '123', 'abcde', '1234', 12345.5, {}]) {
    assert.equal(bundeslandFuerPlz(wert), null, `Eingabe ${JSON.stringify(wert)}`);
  }
});

test('Zahl 38100 wird wie die Zeichenkette behandelt', () =>
  assert.equal(bundeslandFuerPlz(38100), 'NI'));

test('Fehlertext nennt die PLZ und bleibt bei eindeutiger PLZ leer', () => {
  assert.equal(bundeslandFehlerText('38100'), null);
  assert.match(bundeslandFehlerText('99999'), /99999/);
});

// ── Grenzfälle: lieber nachfragen als raten ───────────────────────────────

test('07919 liegt auf der Grenze SN/TH → null + zwei Kandidaten', () => {
  assert.deepEqual(bundeslandKandidaten('07919'), ['SN', 'TH']);
  assert.equal(bundeslandFuerPlz('07919'), null);
  assert.match(bundeslandFehlerText('07919'), /Landesgrenze/);
});

test('21039 liegt auf der Grenze HH/SH → null', () => {
  assert.deepEqual(bundeslandKandidaten('21039'), ['HH', 'SH']);
  assert.equal(bundeslandFuerPlz('21039'), null);
});

// ── Tabelle als Ganzes ────────────────────────────────────────────────────

test('8309 Postleitzahlen, alle Werte sind gueltige Laenderkuerzel', () => {
  assert.equal(PLZ_ANZAHL, 8309, 'Die Tabelle stammt aus tools/plz-orte.mjs --bundesland.');
  assert.equal(BUNDESLAENDER.length, 16);
});

test('Jedes der 16 Laender kommt mindestens einmal vor', () => {
  const proben = {
    BW: '70173', BY: '80331', BE: '10115', BB: '14467', HB: '28195',
    HH: '20095', HE: '60311', MV: '19055', NI: '30159', NW: '40213',
    RP: '55116', SL: '66111', SN: '01067', ST: '39104', SH: '24103', TH: '99084',
  };
  for (const [land, plz] of Object.entries(proben)) {
    assert.equal(bundeslandFuerPlz(plz), land, `${plz} sollte ${land} sein`);
    assert.ok(BUNDESLAENDER.includes(land));
  }
});

// ── Bauart: bewacht den Produktionspfad ───────────────────────────────────
//
// Die Tests oben bleiben grün, wenn abrechnung.routes.js wieder eine eigene
// Präfix-Tabelle mitbringt. Deshalb hier zwei Quelltext-Tests auf genau die
// beiden Eigenschaften, deren Verlust den Fehler zurückholt.

const routesQuelle = readFileSync(
  new URL('../api/abrechnung.routes.js', import.meta.url), 'utf8');

// Die Kopfkommentare erklaeren den alten Fehler und zitieren ihn dabei
// woertlich. Fuer die Bauart-Tests zaehlt nur ausgefuehrter Code.
const routesCode = routesQuelle
  .split(String.fromCharCode(10))
  .filter((z) => {
    const t = z.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  })
  .join(String.fromCharCode(10));

test('BAUART: routes raet nicht mehr aus PLZ-Praefixen', () => {
  assert.equal(/prefixMap/.test(routesCode), false,
    'Die Praefix-Tabelle ist entfernt — sie hatte neun doppelte Schluessel.');
  assert.equal(/bundesland\s*=\s*'NW'/.test(routesCode), false,
    "Auch kein toter Vorgabeparameter 'NW' — mapVerordnungToDtaShape trug einen, ungelesen.");
  assert.equal(/\|\|\s*'NW'/.test(routesCode), false,
    "Der stille Vorgabewert 'NW' ist entfernt — er machte jede unbekannte PLZ zu NRW.");
});

test('BAUART: jede Bundesland-Ermittlung wird sofort abgesichert', () => {
  const zeilen = routesQuelle.split('\n');
  const stellen = zeilen
    .map((z, i) => ({ z, i }))
    .filter(({ z }) => z.includes('= bundeslandDerPraxis('));

  // Zwei, nicht drei: create-podologie hat das Bundesland zwar berechnet, aber
  // an eine Funktion gegeben, die es nie las. Podologie kennt keinen regionalen
  // Tarif-Override, dort gibt es nichts zu ermitteln.
  assert.equal(stellen.length, 2,
    `Erwartet 2 Aufrufstellen (create, preflight), gefunden ${stellen.length}.`);

  for (const { i } of stellen) {
    const naechste = zeilen[i + 1] || '';
    assert.match(naechste, /if\s*\(!bundesland\)\s*return\s+bundeslandFehler\(/,
      `Zeile ${i + 2}: nach der Ermittlung muss der 422-Riegel stehen. ` +
      'Ohne ihn geht null in die Tarifabfrage und der Fall wird ohne Preis abgerechnet.');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
