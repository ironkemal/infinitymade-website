// Tor, kein Test im üblichen Sinn: es prüft nicht das Verhalten des
// Preflights, sondern ob jede seiner Regeln KLASSIFIZIERT ist.
//
//   node --test api-backend/billing/dta/regel-schwere.test.js
//
// Warum das eine eigene Prüfung wert ist (onprem O-113): eine falsche harte
// Regel hält die Abrechnung jedes betroffenen Kunden an, und in einer
// Kundenbox können wir sie nicht schnell zurücknehmen. Deshalb steht im Plan,
// dass eine NEUE harte Regel die Zustimmung von `gkv-302` braucht. Ein Satz in
// einem Plan hält aber niemanden auf — dieser Test tut es.
//
// Bewusst über den QUELLTEXT statt über einen Aufruf: die Codes stecken in
// Zeichenketten, die nur unter ihren jeweiligen Bedingungen entstehen. Ein
// Laufzeittest müsste jede Bedingung nachstellen, um die Liste vollständig zu
// sehen — und genau die Regel, die jemand neu und ungetestet einbaut, wäre
// dann die, die er nicht nachgestellt hat.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { REGEL_SCHWERE, harteRegeln } from './regel-schwere.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = readFileSync(join(HIER, 'preflight.js'), 'utf8');

/** Jede Zeichenkette der Form `X:01234` im Preflight-Quelltext. */
function codesImQuelltext() {
  return new Set([...QUELLE.matchAll(/'([A-Z]:\d{5})'/g)].map(m => m[1]));
}

test('jede Preflight-Regel ist klassifiziert', () => {
  const imCode = codesImQuelltext();
  const fehlend = [...imCode].filter(c => !REGEL_SCHWERE[c]).sort();

  assert.deepEqual(fehlend, [],
    `Neue Regel(n) ohne Klassifikation: ${fehlend.join(', ')}.\n`
    + 'Bitte in api-backend/billing/dta/regel-schwere.js eintragen.\n'
    + '⚠️ Eine neue HARTE Regel braucht vorher die Zustimmung von `gkv-302` '
    + '(onprem O-113): sie hält im Fehlerfall die Abrechnung jedes betroffenen '
    + 'Kunden an, und in einer Kundenbox kommt die Korrektur frühestens in der '
    + 'nächsten Nacht an — im Kanal :stable Tage später, ohne Netz nie.');
});

test('keine toten Einträge in der Klassifikation', () => {
  const imCode = codesImQuelltext();
  const tot = Object.keys(REGEL_SCHWERE).filter(c => !imCode.has(c)).sort();
  assert.deepEqual(tot, [],
    `Klassifiziert, aber im Preflight nicht mehr vorhanden: ${tot.join(', ')}. `
    + 'Bitte aus regel-schwere.js entfernen — eine Liste, die Regeln führt, die '
    + 'es nicht gibt, verliert ihren Wert als Übersicht.');
});

test('jeder Eintrag trägt die drei Pflichtfelder in zulässiger Form', () => {
  const schweren = new Set(['hart', 'warnung', 'beides']);
  const wirkungen = new Set(['datei', 'zeile', 'unbekannt']);
  for (const [code, v] of Object.entries(REGEL_SCHWERE)) {
    assert.ok(schweren.has(v.schwere), `${code}: schwere "${v.schwere}" unzulässig`);
    assert.ok(wirkungen.has(v.kasse),  `${code}: kasse "${v.kasse}" unzulässig`);
    assert.ok(String(v.quelle || '').trim().length > 0, `${code}: quelle fehlt`);
    assert.ok(String(v.hinweis || '').trim().length > 0, `${code}: hinweis fehlt`);
  }
});

test('harteRegeln() liefert genau die Codes mit schwere "hart" oder "beides" — sortiert und ohne Doppelte', () => {
  const codes = harteRegeln();
  const erwartet = Object.entries(REGEL_SCHWERE)
    .filter(([, v]) => v.schwere === 'hart' || v.schwere === 'beides')
    .map(([k]) => k)
    .sort();

  assert.deepEqual(codes, erwartet, 'harteRegeln() muss exakt den harten/beides-Codes entsprechen');
  assert.equal(codes.length, new Set(codes).size, 'harteRegeln() darf keine Duplikate enthalten');
  assert.deepEqual(codes, [...codes].sort(), 'harteRegeln() muss aufsteigend sortiert sein');
});

test('jeder Code aus harteRegeln() kommt auch im Quelltext von preflight.js vor', () => {
  const imCode = codesImQuelltext();
  const fehlend = harteRegeln().filter(c => !imCode.has(c)).sort();

  assert.deepEqual(fehlend, [],
    `Harte Regel(n) aus harteRegeln(), aber nicht im Preflight-Quelltext vorhanden: ${fehlend.join(', ')}.\n`
    + 'Jede harte Regel muss in preflight.js implementiert sein.\n'
    + '⚠️ Eine neue HARTE Regel braucht vorher die Zustimmung von `gkv-302` '
    + '(onprem O-113): sie hält im Fehlerfall die Abrechnung jedes betroffenen '
    + 'Kunden an, und in einer Kundenbox kommt die Korrektur frühestens in der '
    + 'nächsten Nacht an — im Kanal :stable Tage später, ohne Netz nie.');
});

