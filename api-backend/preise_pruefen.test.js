// Standalone smoke test for preise_pruefen.
//   node api-backend/preise_pruefen.test.js
//
// Nur die reine Parse-/Vergleichslogik wird getestet (kein Netzwerk, kein ZIP) —
// die Fixture-XML unten ist ein Ausschnitt aus einer echten GKV-Antwort, keine
// erfundene Struktur.

import { parseXml, vergleiche } from './preise_pruefen.mjs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('preise_pruefen');

// Reale HPNR/Preise aus dem heutigen podologie_positions.js (Fenster 2026) und
// physio_positions.js (Fenster 2026-01-01), plus ein paar Prüf-Fälle:
//   X8010 → passt exakt
//   X0501 → passt exakt
//   X8030 → Preis stimmt nicht (Abweichung provozieren)
//   X8999 → Code existiert bei uns nicht (unbekannt)
const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<HMPRoot HMP_Version="3.0" Schema_Version="3.2">
	<HMP>
		<HMP4>X8010</HMP4>
		<Heilmittelbereich>Podologie</Heilmittelbereich>
		<Bezeichnung>Podologische Behandlung (klein)</Bezeichnung>
		<Gueltig_ab>2026-07-01</Gueltig_ab>
		<Hoechstpreis>36.1</Hoechstpreis>
	</HMP>
	<HMP>
		<HMP4>X8030</HMP4>
		<Heilmittelbereich>Podologie</Heilmittelbereich>
		<Bezeichnung>Podologische Befundung</Bezeichnung>
		<Gueltig_ab>2026-07-01</Gueltig_ab>
		<Hoechstpreis>999.99</Hoechstpreis>
	</HMP>
	<HMP>
		<HMP4>X8999</HMP4>
		<Heilmittelbereich>Podologie</Heilmittelbereich>
		<Bezeichnung>Erfundene Testposition, existiert nicht bei uns</Bezeichnung>
		<Gueltig_ab>2026-07-01</Gueltig_ab>
		<Hoechstpreis>12.34</Hoechstpreis>
	</HMP>
	<HMP>
		<HMP4>X0501</HMP4>
		<Heilmittelbereich>Physiotherapie</Heilmittelbereich>
		<Bezeichnung>Allgemeine Krankengymnastik (KG)</Bezeichnung>
		<Gueltig_ab>2026-01-01</Gueltig_ab>
		<Hoechstpreis>29.63</Hoechstpreis>
	</HMP>
	<HMP>
		<HMP4>X8010</HMP4>
		<Heilmittelbereich>Podologie</Heilmittelbereich>
		<Bezeichnung>Zukünftige Preisrunde, testweise</Bezeichnung>
		<Gueltig_ab>2099-01-01</Gueltig_ab>
		<Hoechstpreis>50</Hoechstpreis>
	</HMP>
</HMPRoot>`;

test('parseXml extrahiert alle HMP-Blöcke', () => {
  const zeilen = parseXml(FIXTURE_XML);
  assert.equal(zeilen.length, 5);
  assert.equal(zeilen[0].hmp4, 'X8010');
  assert.equal(zeilen[0].bereich, 'Podologie');
  assert.equal(zeilen[0].preis, 36.1);
  assert.equal(zeilen[0].gueltig_ab, '2026-07-01');
});

test('vergleiche: exakter Treffer (Podologie X8010→78010, Physio X0501)', () => {
  const erg = vergleiche(parseXml(FIXTURE_XML));
  // beide echten Codes matchen ihr jeweiliges Fenster exakt
  assert.ok(erg.ok >= 2, `erwartet mind. 2 Treffer, war ${erg.ok}`);
});

test('vergleiche: Preisabweichung wird erkannt (X8030 mit falschem Preis)', () => {
  const erg = vergleiche(parseXml(FIXTURE_XML));
  const treffer = erg.abweichend.find(a => a.code === '78030');
  assert.ok(treffer, '78030 sollte als abweichend gemeldet werden');
  assert.equal(treffer.xmlPreis, 999.99);
});

test('vergleiche: unbekannter Code landet in fehlt, nicht in abweichend', () => {
  const erg = vergleiche(parseXml(FIXTURE_XML));
  const treffer = erg.fehlt.find(f => f.code === '78999');
  assert.ok(treffer, '78999 (aus X8999) sollte als unbekannt gemeldet werden');
});

test('vergleiche: neuere Preisrunde als unser Fenster wird als neuePreisrunde gemeldet, nicht als abweichend', () => {
  const erg = vergleiche(parseXml(FIXTURE_XML));
  const treffer = erg.neuePreisrunde.find(n => n.code === '78010' && n.xmlGueltigAb === '2099-01-01');
  assert.ok(treffer, 'ein XML-Fenster nach unserem letzten Fenster sollte als neuePreisrunde auftauchen');
  assert.equal(erg.abweichend.some(a => a.code === '78010'), false, '78010 darf wegen der 2099er Zeile nicht als abweichend zählen');
});

test('vergleiche: bekannte Codes ohne passende XML-Zeile bleiben unauffällig (keine Exception)', () => {
  // Podologie-Fenster 2025 (gueltig_ab 2025-07-01) taucht in der Fixture gar nicht auf —
  // darf weder crashen noch als Fehler gezählt werden.
  assert.doesNotThrow(() => vergleiche(parseXml(FIXTURE_XML)));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
