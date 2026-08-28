// Regression zu 28.08.2026: derselbe Fall zweimal bei der Kasse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERORDNUNG_EINREICHBAR, istEinreichbar, einreichbarFilter } from './einreichbar.js';

test('bereits eingereichte Verordnung darf nicht noch einmal', () => {
  assert.equal(istEinreichbar('abgerechnet'), false);
});

test('abgeschlossene Zustaende sind gesperrt', () => {
  assert.equal(istEinreichbar('storniert'), false);
  assert.equal(istEinreichbar('archiviert'), false);
});

test('laufende Verordnung darf eingereicht werden', () => {
  assert.equal(istEinreichbar('aktiv'), true);
  assert.equal(istEinreichbar('abrechenbar'), true);
});

test('Korrekturweg nach Kassenrueckmeldung bleibt offen', () => {
  // Absetzung heisst: Geld ist nicht gekommen. Wer hier sperrt, sperrt die
  // Nachforderung aus — genau der stille Einnahmeverlust, den die Arbeitsliste
  // sichtbar machen soll.
  assert.equal(istEinreichbar('abgesetzt'), true);
  assert.equal(istEinreichbar('teilabsetzung'), true);
});

test('fehlender Status zaehlt als laufend, nicht als eingereicht', () => {
  // verordnungen.status ist nullable. Eine alte Zeile ohne Wert darf nicht
  // an der Abrechnung scheitern.
  assert.equal(istEinreichbar(null), true);
  assert.equal(istEinreichbar(undefined), true);
  assert.equal(istEinreichbar(''), true);
});

test('unbekannter Status wird nicht durchgewunken', () => {
  assert.equal(istEinreichbar('irgendwas'), false);
});

test('der Spiegel im Frontend fuehrt dieselbe Liste', (t) => {
  // Die Arbeitsliste in module/podologie-abrechnung.js holt genau die Zustaende,
  // die hier eingereicht werden duerfen. Zwei Deploys, kein gemeinsamer Import —
  // also haelt dieser Test die beiden zusammen. Laeuft die Liste auseinander,
  // zeigt die Oberflaeche eine Verordnung an, die das Backend mit 409 abweist.
  let quelle;
  try {
    quelle = readFileSync(new URL('../../../module/podologie-abrechnung.js', import.meta.url), 'utf8');
  } catch {
    // Im Docker-Image liegt das Frontend nicht bei — dort ist nichts zu pruefen.
    return t.skip('module/podologie-abrechnung.js nicht vorhanden');
  }
  const treffer = quelle.match(/\.in\('status',\s*\[([^\]]*)\]\)/);
  assert.ok(treffer, "`.in('status', [...])` in loadPodologieBilling nicht gefunden — Spiegel-Test blind geworden");
  const vorn = treffer[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  assert.deepEqual([...vorn].sort(), [...VERORDNUNG_EINREICHBAR].sort(),
    'Arbeitsliste und Einreich-Regel sind auseinandergelaufen — beide Stellen aendern');
});

test('Filter deckt dieselbe Menge ab und faengt NULL mit', () => {
  const f = einreichbarFilter();
  for (const s of VERORDNUNG_EINREICHBAR) assert.ok(f.includes(s), `${s} fehlt im Filter`);
  assert.ok(f.includes('status.is.null'), 'NULL-Zeilen wuerden ein falsches 409 ausloesen');
  assert.ok(!f.includes('abgerechnet'), 'abgerechnet darf im Anspruch-Filter nicht vorkommen');
});
