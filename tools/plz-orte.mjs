#!/usr/bin/env node
// PLZ → Ort Tabelle bauen.
//
// Warum ein lokaler Datensatz und kein Dienst: G8 (CLAUDE.md) verbietet neue
// Cloud-Abhängigkeiten — die On-Premise-Version muss ohne Internet laufen. Eine
// Adressvervollständigung über Google Places waere zusaetzlich eine Uebermittlung
// von Patientenadressen an einen Dritten. Die deutschen Postleitzahlen sind ein
// feststehender Datenbestand; eine Datei genuegt.
//
// Quelle: zauberware/postal-codes-json-xml-csv (Basis: GeoNames), CC BY 4.0.
//   https://github.com/zauberware/postal-codes-json-xml-csv
// Die Attribution steht in module/plz-orte.json (Feld `quelle`) und in
// funktionen/README bzw. im Impressum-Abschnitt „Verwendete Datenbestaende".
//
// Lauf:
//   node tools/plz-orte.mjs <pfad-zu-zipcodes.de.csv>
//
// ⚠️ Die Rohdatei enthaelt Grossempfaenger-Postleitzahlen: dort steht im Feld
//    `place` KEIN Ort, sondern ein Firmenname („Mercedes-Benz Versicherung AG").
//    Ungefiltert uebernommen stuende dieser Firmenname als Wohnort im Patienten-
//    stammblatt und liefe von dort in Rechnung und §302-Datei. Diese Zeilen
//    werden hier entfernt; die echte Gemeinde steht in `community`.

import { readFileSync, writeFileSync } from 'node:fs';

const quelle = process.argv[2];
if (!quelle) {
  console.error('Aufruf: node tools/plz-orte.mjs <zipcodes.de.csv>');
  process.exit(1);
}

// Grossempfaenger sicher erkennen — ueber die Struktur, nicht ueber Wortlisten.
//
// Die Rohdatei fuehrt zwei zusammengelegte Quellen. Die Gemeindezeilen tragen
// das Bundesland deutsch mit zweibuchstabigem Kuerzel ("Bayern", BY), die
// Grossempfaengerzeilen englisch mit numerischem Kuerzel ("Bavaria", 02):
//
//   DE,90402,Nürnberg,Bayern,BY,…              ← Ort
//   DE,90327,Novartis Pharma GmbH,Bavaria,02,… ← Firmenpostfach
//
// Eine Wortliste ("GmbH", "AG", …) reichte nicht: sie liess „Job-Center Berlin
// Mitte", „Amtsgericht Nürnberg" und „Uni Klinikum Charite" durch — Namen ohne
// Rechtsform, die als Wohnort genauso falsch sind.
const LAND_KUERZEL = /^[A-Z]{2}$/;

// CSV mit Anfuehrungszeichen — Orte wie "Freiburg im Breisgau" sind harmlos,
// aber Firmennamen enthalten Kommata. Deshalb ein echter Parser, kein split(',').
function parseCsvZeile(zeile) {
  const felder = [];
  let feld = '';
  let inAnfuehrung = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (c === '"') {
      if (inAnfuehrung && zeile[i + 1] === '"') { feld += '"'; i++; }
      else inAnfuehrung = !inAnfuehrung;
    } else if (c === ',' && !inAnfuehrung) {
      felder.push(feld); feld = '';
    } else {
      feld += c;
    }
  }
  felder.push(feld);
  return felder;
}

const zeilen = readFileSync(quelle, 'utf8').split(/\r?\n/).filter(Boolean);
const kopf = parseCsvZeile(zeilen[0]);
const iPlz     = kopf.indexOf('zipcode');
const iOrt     = kopf.indexOf('place');
const iLand    = kopf.indexOf('state');
const iLandKrz = kopf.indexOf('state_code');

if (iPlz < 0 || iOrt < 0 || iLandKrz < 0) {
  console.error('Spalten zipcode/place/state_code fehlen.');
  process.exit(1);
}

/** @type {Map<string, Set<string>>} */
const karte = new Map();
/** @type {Map<string, string>} */
const bundesland = new Map();
let verworfen = 0;

for (let n = 1; n < zeilen.length; n++) {
  const f = parseCsvZeile(zeilen[n]);
  const plz = (f[iPlz] || '').trim();
  let ort   = (f[iOrt] || '').trim();
  if (!/^\d{5}$/.test(plz) || !ort) continue;

  if (!LAND_KUERZEL.test((f[iLandKrz] || '').trim())) { verworfen++; continue; }

  // Ortsteile in Klammern verkuerzen: „Berlin (Mitte)" → „Berlin".
  // Der Patient schreibt seinen Ort, nicht den Verwaltungsbezirk.
  ort = ort.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!ort) continue;

  if (!karte.has(plz)) karte.set(plz, new Set());
  karte.get(plz).add(ort);
  if (iLand >= 0 && !bundesland.has(plz)) bundesland.set(plz, (f[iLand] || '').trim());
}

// Ein PLZ-Gebiet kann echt mehrere Orte haben (laendlicher Raum). Mehrere Werte
// bleiben als Liste erhalten — die Maske schlaegt dann vor statt zu setzen.
const daten = {};
let mehrdeutig = 0;
for (const [plz, orte] of [...karte].sort((a, b) => a[0].localeCompare(b[0]))) {
  const liste = [...orte].sort();
  if (liste.length > 1) mehrdeutig++;
  daten[plz] = liste.length === 1 ? liste[0] : liste;
}

const ausgabe = {
  quelle: 'zauberware/postal-codes-json-xml-csv (GeoNames), CC BY 4.0',
  erzeugt: new Date().toISOString().slice(0, 10),
  hinweis: 'Erzeugt mit tools/plz-orte.mjs — nicht von Hand bearbeiten.',
  orte: daten,
};

// Die Bundesland-Zuordnung verdoppelt die Datei und hat im Frontend keinen
// Abnehmer. Sie waere die saubere Grundlage fuer das Tarifkennzeichen der
// §302-Datei (heute in abrechnung.routes.js ueber PLZ-Praefixe geraten) —
// dafuer dann mit `--bundesland` erzeugen.
if (process.argv.includes('--bundesland')) {
  const bl = Object.fromEntries([...bundesland].filter(([p]) => daten[p]));
  writeFileSync(new URL('../module/plz-bundesland.json', import.meta.url), JSON.stringify(bl));
  console.log(`→ module/plz-bundesland.json (${(JSON.stringify(bl).length / 1024).toFixed(0)} KB)`);
}

const ziel = new URL('../module/plz-orte.json', import.meta.url);
writeFileSync(ziel, JSON.stringify(ausgabe));

const groesse = (JSON.stringify(ausgabe).length / 1024).toFixed(0);
console.log(`✓ ${Object.keys(daten).length} Postleitzahlen · ${mehrdeutig} mehrdeutig · ${verworfen} Grossempfaenger-Zeilen verworfen`);
console.log(`→ module/plz-orte.json (${groesse} KB)`);
