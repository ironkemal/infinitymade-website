// Regression zu 28.08.2026: derselbe Fall zweimal bei der Kasse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VERORDNUNG_EINREICHBAR, istEinreichbar, einreichbarFilter,
  statusAusAbrechnungStatus, abrechnungStatusAusStatus,
} from './einreichbar.js';

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
  // Seit der Zusammenlegung der Verordnungstöpfe (04.09.2026) holt die
  // Arbeitsliste ihren Statusfilter aus module/verordnung-topf.js
  // (PODO_ARBEITSLISTE_OR) statt einem eigenen `.in('status', [...])`. Dieser
  // Test haelt weiter beide Seiten zusammen: die dort erlaubten
  // abrechnung_status-Werte muessen genau die sein, die
  // abrechnungStatusAusStatus() aus VERORDNUNG_EINREICHBAR erzeugt.
  let quelle;
  try {
    quelle = readFileSync(new URL('../../../module/verordnung-topf.js', import.meta.url), 'utf8');
  } catch {
    // Im Docker-Image liegt das Frontend nicht bei — dort ist nichts zu pruefen.
    return t.skip('module/verordnung-topf.js nicht vorhanden');
  }
  const treffer = quelle.match(/PODO_ARBEITSLISTE_OR\s*=\s*\n?\s*'([^']*)'/);
  assert.ok(treffer, 'PODO_ARBEITSLISTE_OR in verordnung-topf.js nicht gefunden — Spiegel-Test blind geworden');

  // Aus dem PostgREST-`or`-String die genannten abrechnung_status-Werte lesen.
  // Nicht blind auf `,` splitten: `abrechnung_status.in.(a,b,c)` traegt selbst
  // Kommas — das zerlegte fruehere Zeilen versehentlich in vier Stuecke statt
  // in `is.null` + eine `in.(...)`-Klausel.
  const vornIsNull = /abrechnung_status\.is\.null/.test(treffer[1]);
  const vornWerte = new Set();
  const inMatch = treffer[1].match(/abrechnung_status\.in\.\(([^)]*)\)/);
  if (inMatch) inMatch[1].split(',').forEach(w => vornWerte.add(w.trim()));

  // Aus VERORDNUNG_EINREICHBAR dieselbe Menge herleiten.
  const hintenWerte = new Set();
  let hintenIsNull = false;
  for (const status of VERORDNUNG_EINREICHBAR) {
    const abr = abrechnungStatusAusStatus(status);
    if (abr === null) hintenIsNull = true; else hintenWerte.add(abr);
  }

  assert.equal(vornIsNull, hintenIsNull, 'NULL-Behandlung (= aktiv) ist auseinandergelaufen');
  assert.deepEqual([...vornWerte].sort(), [...hintenWerte].sort(),
    'Arbeitsliste und Einreich-Regel sind auseinandergelaufen — beide Stellen aendern');
});

test('statusAusAbrechnungStatus und abrechnungStatusAusStatus sind zueinander konsistent', () => {
  for (const status of VERORDNUNG_EINREICHBAR) {
    const abr = abrechnungStatusAusStatus(status);
    assert.equal(statusAusAbrechnungStatus(abr), status, `Rundreise fuer ${status}`);
  }
});

test('Werte, die es im podologischen Zweig nie gab, gelten als abgerechnet', () => {
  // Der teure Fehler waere, sie auf 'aktiv' fallen zu lassen: dann stuende
  // eine eingereichte Verordnung wieder in der Arbeitsliste.
  assert.equal(statusAusAbrechnungStatus('in_abrechnung'), 'abgerechnet');
  assert.equal(statusAusAbrechnungStatus('accepted'), 'abgerechnet');
  assert.equal(statusAusAbrechnungStatus('paid'), 'abgerechnet');
});

test('Filter deckt dieselbe Menge ab und faengt NULL mit', () => {
  const f = einreichbarFilter();
  for (const s of VERORDNUNG_EINREICHBAR) assert.ok(f.includes(s), `${s} fehlt im Filter`);
  assert.ok(f.includes('status.is.null'), 'NULL-Zeilen wuerden ein falsches 409 ausloesen');
  assert.ok(!f.includes('abgerechnet'), 'abgerechnet darf im Anspruch-Filter nicht vorkommen');
});
