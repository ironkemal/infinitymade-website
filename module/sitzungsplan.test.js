// Die Sitzungsplan-Vorschau der Verordnungsmaske. Sie schreibt nichts, aber sie
// sagt dem Podologen, was ihn in der Abrechnung erwartet — sagt sie es falsch,
// rechnet er danach und bekommt eine Absetzung. Deshalb geprueft wie die Regel
// selbst.
//
// Belegstelle der Tabelle: wissensbank/SPEC-RULES.md → „Podologie: 6 seanslık
// serinin hangi Termin'ine hangi befundung".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitzungsplan, dgWurzel, POD_DG_BEHANDLUNG } from './sitzungsplan.js';

// ── dgWurzel ────────────────────────────────────────────────────────────────

test('dgWurzel schneidet den Leitsymptomatik-Buchstaben ab', () => {
  assert.equal(dgWurzel('DF-a'), 'DF');
  assert.equal(dgWurzel('DF'), 'DF');
  assert.equal(dgWurzel('df-c'), 'DF');
  assert.equal(dgWurzel('UI1'), 'UI1');
  assert.equal(dgWurzel('NF-b'), 'NF');
  assert.equal(dgWurzel(''), '');
  assert.equal(dgWurzel(null), '');
});

// ── Neuer Patient: Sitzung 1 traegt 78040, der Rest 78030 ───────────────────

test('neuer Patient, 6 Einheiten — Sitzung 1: 78040, Sitzung 2-6: 78030', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: 6, behandlungen: [], datum: '2026-09-14',
    podologieVor2023: false,
  });
  assert.equal(p.anwendbar, true);
  assert.equal(p.zeilen.length, 2);
  assert.equal(p.zeilen[0].titel, 'Sitzung 1');
  assert.deepEqual(p.zeilen[0].codes, ['78040']);
  assert.equal(p.zeilen[1].titel, 'Sitzung 2–6');
  assert.deepEqual(p.zeilen[1].codes, ['78030']);
});

test('78040-Tag sagt ausdruecklich, dass 78030 entfaellt', () => {
  // Anlage 1a Teil 2 Ziff. 4.1: „Die podologische Befundung nach Teil 2
  // Ziffer 4.2 ist fuer diese Behandlung nicht abrechnungsfaehig."
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: 6, behandlungen: [], datum: '2026-09-14',
    podologieVor2023: false,
  });
  assert.match(p.zeilen[0].text, /entfällt an diesem Tag/);
});

test('eine einzige Einheit — keine zweite Zeile, keine Spanne', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: 1, behandlungen: [], datum: '2026-09-14',
    podologieVor2023: false,
  });
  assert.equal(p.zeilen.length, 1);
  assert.equal(p.zeilen[0].titel, 'Sitzung 1');
});

test('zwei Einheiten — zweite Zeile ist eine einzelne Sitzung, keine Spanne', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: 2, behandlungen: [], datum: '2026-09-14',
    podologieVor2023: false,
  });
  assert.equal(p.zeilen[1].titel, 'Sitzung 2');
});

// ── Bekannter Patient: durchgehend 78030 ────────────────────────────────────

test('78040 schon abgerechnet — alle Sitzungen tragen 78030', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'DF',
    anzahl: 6,
    behandlungen: [{ behandlungsdatum: '2026-03-02', hpnr_codes: ['78040', '78010'] }],
    datum: '2026-09-14',
  });
  assert.equal(p.zeilen.length, 1);
  assert.equal(p.zeilen[0].titel, 'Sitzung 1–6');
  assert.deepEqual(p.zeilen[0].codes, ['78030']);
  assert.match(p.hinweis, /2026-03-02/);
});

test('Behandlung an einem frueheren Tag — 78040 ist verbraucht, kein Nachholen', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'NF',
    anzahl: 3,
    behandlungen: [{ behandlungsdatum: '2026-08-01', hpnr_codes: ['78010'] }],
    datum: '2026-09-14',
  });
  assert.deepEqual(p.zeilen[0].codes, ['78030']);
  assert.equal(p.zeilen.length, 1);
});

test('Altbestand vor dem 01.11.2023 — nie ein Anspruch auf 78040', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'QF', anzahl: 6, behandlungen: [], datum: '2026-09-14',
    podologieVor2023: true,
  });
  assert.deepEqual(p.zeilen[0].codes, ['78030']);
  assert.equal(p.zeilen[0].titel, 'Sitzung 1–6');
  assert.match(p.hinweis, /01\.11\.2023/);
});

// ── Die offene Rueckfrage ───────────────────────────────────────────────────

test('unbeantwortete Altbestandsfrage kommt als rueckfrage mit', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: 6, behandlungen: [], datum: '2026-09-14',
    podologieVor2023: null,
  });
  assert.ok(p.rueckfrage, 'die Frage muss sichtbar bleiben');
  assert.match(p.rueckfrage, /01\.11\.2023/);
  // Trotz offener Frage wird der wahrscheinliche Fall gezeigt — sonst stuende
  // die Maske leer da, bis jemand eine Frage beantwortet, die er nicht sieht.
  assert.deepEqual(p.zeilen[0].codes, ['78040']);
});

test('beantwortete Frage („nein") laesst keine rueckfrage zurueck', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: 6, behandlungen: [], datum: '2026-09-14',
    podologieVor2023: false,
  });
  assert.equal(p.rueckfrage, null);
});

// ── Nagelzweig UI1/UI2 ──────────────────────────────────────────────────────

test('UI1/UI2 — kein Sitzungsplan, nur der Hinweis der Regel', () => {
  for (const dg of ['UI1', 'UI2']) {
    const p = sitzungsplan({
      diagnosegruppe: dg, anzahl: 8, behandlungen: [], datum: '2026-09-14',
    });
    assert.equal(p.anwendbar, true, dg);
    assert.equal(p.zeilen.length, 0, `${dg}: im Nagelzweig wird nichts vorgeschlagen`);
    assert.equal(p.grund, 'nagelzweig', dg);
    assert.match(p.hinweis, /Erstbefundung/, dg);
    assert.equal(p.rueckfrage, null, dg);
  }
});

test('im Nagelzweig taucht 78040 nirgends auf', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'UI1', anzahl: 8, behandlungen: [], datum: '2026-09-14',
  });
  assert.doesNotMatch(p.hinweis, /78040 (gehört|läuft)/);
  assert.equal(p.zeilen.length, 0);
});

// ── Nichts zu zeigen ────────────────────────────────────────────────────────

test('fremde oder fehlende Diagnosegruppe — nicht anwendbar', () => {
  assert.equal(sitzungsplan({ diagnosegruppe: 'WS', anzahl: 6, datum: '2026-09-14' }).anwendbar, false);
  assert.equal(sitzungsplan({ diagnosegruppe: '', anzahl: 6, datum: '2026-09-14' }).anwendbar, false);
  assert.equal(sitzungsplan({}).anwendbar, false);
  assert.equal(sitzungsplan().anwendbar, false);
});

test('ohne Menge kein Plan, aber die Frage bleibt erhalten', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: '', behandlungen: [], datum: '2026-09-14',
  });
  assert.equal(p.anwendbar, false);
  assert.equal(p.grund, 'keine_menge');
  assert.ok(p.rueckfrage);
});

test('unsinnige Mengen kippen nicht um', () => {
  for (const anzahl of [0, -3, 'abc', null, undefined]) {
    const p = sitzungsplan({ diagnosegruppe: 'DF', anzahl, behandlungen: [], datum: '2026-09-14' });
    assert.equal(p.anwendbar, false, String(anzahl));
    assert.deepEqual(p.zeilen, [], String(anzahl));
  }
});

test('Selbstzahler bekommt keine GKV-Position', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: 6, behandlungen: [], datum: '2026-09-14',
    selbstzahler: true,
  });
  assert.equal(p.zeilen.length, 0);
  assert.equal(p.grund, 'selbstzahler');
});

test('null statt Behandlungsliste kippt nicht um', () => {
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: 6, behandlungen: null, datum: '2026-09-14',
    podologieVor2023: false,
  });
  assert.equal(p.anwendbar, true);
  assert.deepEqual(p.zeilen[0].codes, ['78040']);
});

// ── Die Behandlungsposition bleibt bewusst zweideutig ───────────────────────

test('die Behandlung steht als 78010/78020 da, nicht als eine Nummer', () => {
  // Welche der beiden es wird, haengt an der Therapiezeit und entscheidet sich
  // am Behandlungstag. Eine Nummer hier waere geraten.
  const p = sitzungsplan({
    diagnosegruppe: 'DF', anzahl: 6, behandlungen: [], datum: '2026-09-14',
    podologieVor2023: false,
  });
  for (const z of p.zeilen) assert.match(z.text, /78010\/78020/);
});

test('die stellvertretenden Positionen liegen im richtigen Zweig', () => {
  assert.equal(POD_DG_BEHANDLUNG.DF, '78010');
  assert.equal(POD_DG_BEHANDLUNG.UI1, '78610');
  // DF/NF/QF teilen sich dieselbe Behandlungsposition — die Regel wertet
  // 78010 und 78020 ohnehin gleich.
  assert.equal(POD_DG_BEHANDLUNG.NF, POD_DG_BEHANDLUNG.DF);
  assert.equal(POD_DG_BEHANDLUNG.QF, POD_DG_BEHANDLUNG.DF);
});
