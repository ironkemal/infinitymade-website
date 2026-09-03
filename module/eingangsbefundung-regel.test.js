// Die Regel hinter der Eingangsbefundung (78040). Jeder Fall hier ist ein Fall,
// der ohne Pruefung Geld kostet — entweder als Absetzung (zu viel abgerechnet)
// oder als entgangene Leistung (zu Unrecht gesperrt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { darf78040 } from './eingangsbefundung-regel.js';

test('Patient ohne jede Behandlung — 78040 erlaubt', () => {
  const r = darf78040([], '2026-09-01');
  assert.equal(r.erlaubt, true);
  assert.equal(r.ersteAm, null);
});

test('null/undefined statt Liste kippt nicht um', () => {
  assert.equal(darf78040(null, '2026-09-01').erlaubt, true);
  assert.equal(darf78040(undefined, '2026-09-01').erlaubt, true);
});

test('78040 am selben Tag wie die erste Behandlung — erlaubt', () => {
  // Anlage 1a Teil 1 Nr. 2: „kann am gleichen Tag wie die podologische
  // Leistung durchgeführt werden." Das ist der Normalfall, nicht die Ausnahme.
  const r = darf78040(
    [{ behandlungsdatum: '2026-09-01', hpnr_codes: ['78010', '78030'] }],
    '2026-09-01',
  );
  assert.equal(r.erlaubt, true, '78040 neben 78010 am selben Tag ist ausdruecklich erlaubt');
});

test('bereits abgerechnete 78040 sperrt — auch ueber Verordnungen hinweg', () => {
  const r = darf78040(
    [
      { behandlungsdatum: '2026-03-02', hpnr_codes: ['78040', '78010'] },
      { behandlungsdatum: '2026-03-09', hpnr_codes: ['78030', '78010'] },
    ],
    '2026-09-01',
  );
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'schon_abgerechnet');
  assert.equal(r.schonAm, '2026-03-02', 'die Meldung nennt den Tag der ersten Abrechnung');
});

test('frueherer Behandlungstag ohne 78040 sperrt ebenfalls — der eigentliche Fehler', () => {
  // Das ist der Fall, der bis 31.08.2026 durchging: nie abgerechnet, aber die
  // Serie laeuft schon. „Vor der ersten Abgabe" ist damit vorbei.
  const r = darf78040(
    [
      { behandlungsdatum: '2026-08-04', hpnr_codes: ['78030', '78010'] },
      { behandlungsdatum: '2026-08-11', hpnr_codes: ['78030', '78010'] },
    ],
    '2026-08-18',
  );
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'nicht_erste_behandlung');
  assert.equal(r.ersteAm, '2026-08-04');
});

test('Nachtragen auf einen frueheren Tag als die erste Behandlung bleibt moeglich', () => {
  // Der Podologe traegt die vergessene Eingangsbefundung auf den Tag der ersten
  // Behandlung nach — datum == ersteAm, also nicht „frueher", also erlaubt.
  const r = darf78040(
    [{ behandlungsdatum: '2026-08-04', hpnr_codes: ['78030', '78010'] }],
    '2026-08-04',
  );
  assert.equal(r.erlaubt, true);
});

test('unsortierte Eingabe wird sortiert — ersteAm ist wirklich der frueheste Tag', () => {
  const r = darf78040(
    [
      { behandlungsdatum: '2026-08-11', hpnr_codes: ['78010'] },
      { behandlungsdatum: '2026-08-04', hpnr_codes: ['78010'] },
    ],
    '2026-08-18',
  );
  assert.equal(r.ersteAm, '2026-08-04');
});

test('Zeilen ohne Datum werden ignoriert statt zu sperren', () => {
  const r = darf78040(
    [{ behandlungsdatum: null, hpnr_codes: ['78010'] }, null],
    '2026-09-01',
  );
  assert.equal(r.erlaubt, true);
});

test('fehlendes hpnr_codes wird nicht als 78040 gelesen', () => {
  const r = darf78040([{ behandlungsdatum: '2026-09-01' }], '2026-09-01');
  assert.equal(r.erlaubt, true);
});

// ── befundungFuerLeistung: was gehoert unter die gewaehlte Leistung? ─────────
// Der Fall, der diese Regel ausgeloest hat: Beta-1, 31.08.2026 — „beim Nagel
// gibt es das nicht". Jeder Fall hier kostet ohne Pruefung Geld.
import { befundungFuerLeistung } from './eingangsbefundung-regel.js';

test('neuer Patient + podologische Behandlung → 78040, aber mit Rueckfrage', () => {
  const r = befundungFuerLeistung({ hpnr: '78010', behandlungen: [], datum: '2026-09-03' });
  assert.equal(r.code, '78040');
  assert.equal(r.automatisch, false, 'die Frage nach der Zeit vor dem 01.11.2023 ist offen');
  assert.match(r.rueckfrage, /01\.11\.2023/);
});

test('neuer Patient, Vorgeschichte ausdruecklich verneint → 78040 ohne Rueckfrage', () => {
  const r = befundungFuerLeistung({
    hpnr: '78020', behandlungen: [], datum: '2026-09-03', podologieVor2023: false,
  });
  assert.equal(r.code, '78040');
  assert.equal(r.automatisch, true);
  assert.equal(r.rueckfrage, null);
});

test('Patient war vor dem 01.11.2023 schon beim Podologen → 78030 statt 78040', () => {
  const r = befundungFuerLeistung({
    hpnr: '78010', behandlungen: [], datum: '2026-09-03', podologieVor2023: true,
  });
  assert.equal(r.code, '78030');
  assert.equal(r.grund, 'kein_anspruch_altbestand');
});

test('Nagelspangenbehandlung → gar kein Vorschlag, nur ein Hinweis', () => {
  // Beta-1, 31.08.2026: „beim Nagel gibt es das nicht." Stimmt — 78040 gibt es
  // in UI1/UI2 nicht, und die Erstbefundung dort haengt an Nagel und Serie,
  // nicht daran, ob der Patient neu ist.
  const r = befundungFuerLeistung({ hpnr: '78610', behandlungen: [], datum: '2026-09-03' });
  assert.equal(r.code, null);
  assert.equal(r.grund, 'nagelzweig');
  assert.match(r.hinweis, /78110/);
});

test('alle Nagel-Positionen schweigen — auch Kontrolle, Abschluss, Bericht, Altspangen', () => {
  for (const hpnr of ['78620', '78510', '78520', '78530', '78210', '78220', '78230', '78300', '78400']) {
    const r = befundungFuerLeistung({ hpnr, behandlungen: [], datum: '2026-09-03' });
    assert.equal(r.code, null, `${hpnr} darf keine Befundung vorschlagen`);
    assert.equal(r.grund, 'nagelzweig');
  }
});

test('laufende Serie → 78030, nicht mehr 78040', () => {
  const r = befundungFuerLeistung({
    hpnr: '78010',
    behandlungen: [{ behandlungsdatum: '2026-08-04', hpnr_codes: ['78030', '78010'] }],
    datum: '2026-09-03',
  });
  assert.equal(r.code, '78030');
  assert.equal(r.grund, 'nicht_erste_behandlung');
  assert.match(r.hinweis, /2026-08-04/, 'die Meldung nennt den Tag, an dem der Anspruch verfiel');
});

test('78040 schon abgerechnet → 78030 mit Datum in der Begruendung', () => {
  const r = befundungFuerLeistung({
    hpnr: '78010',
    behandlungen: [{ behandlungsdatum: '2026-03-02', hpnr_codes: ['78040', '78010'] }],
    datum: '2026-09-03',
  });
  assert.equal(r.code, '78030');
  assert.equal(r.grund, 'eingangsbefundung_verbraucht');
  assert.match(r.hinweis, /2026-03-02/);
});

test('Selbstzahler bekommt keine GKV-Position', () => {
  const r = befundungFuerLeistung({
    hpnr: '78010', behandlungen: [], datum: '2026-09-03', selbstzahler: true,
  });
  assert.equal(r.code, null);
  assert.equal(r.grund, 'selbstzahler');
});

test('eine Befundung bekommt keine zweite Befundung', () => {
  for (const hpnr of ['78030', '78040', '78100', '78110']) {
    const r = befundungFuerLeistung({ hpnr, behandlungen: [], datum: '2026-09-03' });
    assert.equal(r.code, null, `${hpnr} ist selbst schon eine Befundung`);
    assert.equal(r.grund, 'ist_schon_befundung');
  }
});

test('Hausbesuch allein traegt keinen Zweig', () => {
  for (const hpnr of ['79933', '79934']) {
    const r = befundungFuerLeistung({ hpnr, behandlungen: [], datum: '2026-09-03' });
    assert.equal(r.code, null);
    assert.equal(r.grund, 'zuschlag_ohne_zweig');
  }
});

test('fremde Sektoren und leere Eingabe kippen nicht um', () => {
  assert.equal(befundungFuerLeistung({ hpnr: 'X0501', datum: '2026-09-03' }).grund, 'kein_podologie_zweig');
  assert.equal(befundungFuerLeistung({ hpnr: '', datum: '2026-09-03' }).grund, 'keine_leistung');
  assert.equal(befundungFuerLeistung().grund, 'keine_leistung');
});
