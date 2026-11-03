import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeHeilmittelZeilen, normalizeBereich } from './heilmittel-zeilen.js';

test('normalizeBereich normalisiert Fachbereiche korrekt', () => {
  // Physio-Varianten
  assert.equal(normalizeBereich('physio'), 'physio');
  assert.equal(normalizeBereich('Physiotherapie'), 'physio');
  assert.equal(normalizeBereich('physiotherapy'), 'physio');
  assert.equal(normalizeBereich('PHYSIOTHERAPY'), 'physio');

  // Ergo-Varianten
  assert.equal(normalizeBereich('ergo'), 'ergo');
  assert.equal(normalizeBereich('Ergotherapie'), 'ergo');
  assert.equal(normalizeBereich('ergotherapy'), 'ergo');
  assert.equal(normalizeBereich('ERGOTHERAPY'), 'ergo');

  // Podo-Varianten
  assert.equal(normalizeBereich('podo'), 'podo');
  assert.equal(normalizeBereich('Podologie'), 'podo');
  assert.equal(normalizeBereich('podiatry'), 'podo');

  // Logo-Varianten
  assert.equal(normalizeBereich('stimme'), 'logo');
  assert.equal(normalizeBereich('logo'), 'logo');
  assert.equal(normalizeBereich('Logopädie'), 'logo');
  assert.equal(normalizeBereich('Logopaedie'), 'logo');
  assert.equal(normalizeBereich('logotherapy'), 'logo');

  // Ernährung-Varianten
  assert.equal(normalizeBereich('ernährung'), 'ernaehrung');
  assert.equal(normalizeBereich('ernaehrungstherapie'), 'ernaehrung');
});

test('Gültige Einzelzeile in Physio ist fehlerfrei', () => {
  const r = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: 'X0501', bezeichnung: 'KG', einheiten: 6, doppelbehandlung: false }],
  });
  assert.deepEqual(r.fehler, []);
});

test('Gültige Mehrfachzeilen in Physio und Ergo sind fehlerfrei', () => {
  const r1 = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [
      { code: 'X0501', bezeichnung: 'KG', einheiten: 6 },
      { code: 'X1201', bezeichnung: 'MT', einheiten: 6 },
    ],
  });
  assert.deepEqual(r1.fehler, []);

  const r1b = pruefeHeilmittelZeilen({
    bereich: 'physiotherapy',
    zeilen: [
      { code: 'X0501', bezeichnung: 'KG', einheiten: 6 },
      { code: 'X1201', bezeichnung: 'MT', einheiten: 6 },
    ],
  });
  assert.deepEqual(r1b.fehler, []);

  const r2 = pruefeHeilmittelZeilen({
    bereich: 'ergo',
    zeilen: [
      { code: 'X2101', bezeichnung: 'Motorisch-funktionell', einheiten: 10 },
      { code: 'X2102', bezeichnung: 'Sensomotorisch-perzeptiv', einheiten: 10 },
      { code: 'X2103', bezeichnung: 'Psychisch-funktionell', einheiten: 10 },
    ],
  });
  assert.deepEqual(r2.fehler, []);

  const r2b = pruefeHeilmittelZeilen({
    bereich: 'ergotherapy',
    zeilen: [
      { code: 'X2101', bezeichnung: 'Motorisch-funktionell', einheiten: 10 },
      { code: 'X2102', bezeichnung: 'Sensomotorisch-perzeptiv', einheiten: 10 },
    ],
  });
  assert.deepEqual(r2b.fehler, []);
});

test('>3 vorrangig wird sert abgewiesen', () => {
  const r = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [
      { code: 'X0501', einheiten: 6 },
      { code: 'X1201', einheiten: 6 },
      { code: 'X0502', einheiten: 6 },
      { code: 'X0503', einheiten: 6 },
    ],
  });
  assert.ok(r.fehler.some(f => f.includes('Maximal 3 vorrangige Heilmittel')));
});

test('Podologie und Logo sperren Mehrfachzeilen sert ab', () => {
  const r1 = pruefeHeilmittelZeilen({
    bereich: 'podo',
    zeilen: [
      { code: '78010', bezeichnung: 'Behandlung', einheiten: 6 },
      { code: '78020', bezeichnung: 'Komplex', einheiten: 6 },
    ],
  });
  assert.ok(r1.fehler.some(f => f.includes('nur in der Physiotherapie und Ergotherapie')));

  const r2 = pruefeHeilmittelZeilen({
    bereich: 'stimme',
    zeilen: [
      { code: 'X3101', einheiten: 10 },
      { code: 'X3102', einheiten: 10 },
    ],
  });
  assert.ok(r2.fehler.some(f => f.includes('nur in der Physiotherapie und Ergotherapie')));
});

test('Aynı code iki kez girildiğinde sert red', () => {
  const r = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [
      { code: 'X0501', bezeichnung: 'KG', einheiten: 6 },
      { code: 'X0501', bezeichnung: 'KG erneut', einheiten: 6 },
    ],
  });
  assert.ok(r.fehler.some(f => f.includes('nicht mehrfach')));
});

test('Einheit <= 0 veya boş girildiğinde sert red', () => {
  const r1 = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: 'X0501', bezeichnung: 'KG', einheiten: 0 }],
  });
  assert.ok(r1.fehler.some(f => f.includes('größer als 0')));

  const r2 = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: 'X0501', bezeichnung: 'KG', einheiten: '' }],
  });
  assert.ok(r2.fehler.some(f => f.includes('größer als 0')));

  const r3 = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: 'X0501', bezeichnung: 'KG', einheiten: -2 }],
  });
  assert.ok(r3.fehler.some(f => f.includes('größer als 0')));
});

test('Satırda Einheit var ama Heilmittel boş ise sert red', () => {
  const r = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: '', bezeichnung: '', einheiten: 6 }],
  });
  assert.ok(r.fehler.some(f => f.includes('auch ein Heilmittel an')));
});

test('>1 ergänzend Heilmittel wird sert abgewiesen', () => {
  const r = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: 'X0501', einheiten: 6 }],
    ergaenzend: [
      { code: 'X1301', einheiten: 6 },
      { code: 'X1302', einheiten: 6 },
    ],
  });
  assert.ok(r.fehler.some(f => f.includes('Maximal ein ergänzendes Heilmittel')));
});

test('Vorrangigsiz ergänzend wird sert abgewiesen', () => {
  const r = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [],
    ergaenzend: { code: 'X1301', einheiten: 6 },
  });
  assert.ok(r.fehler.some(f => f.includes('mindestens ein vorrangiges Heilmittel')));
});

test('Ergänzend Einheit > Summe vorrangig wird sert abgewiesen', () => {
  const r = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [
      { code: 'X0501', einheiten: 6 },
      { code: 'X1201', einheiten: 4 },
    ], // Summe vorrangig = 10
    ergaenzend: { code: 'X1301', einheiten: 12 }, // 12 > 10
  });
  assert.ok(r.fehler.some(f => f.includes('dürfen die Summe der vorrangigen Heilmittel nicht übersteigen')));
});

test('Ergänzendes Heilmittel mit gültiger Einheit ist erlaubt', () => {
  const r = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [
      { code: 'X0501', einheiten: 6 },
      { code: 'X1201', einheiten: 4 },
    ], // Summe vorrangig = 10
    ergaenzend: { code: 'X1301', einheiten: 10 }, // 10 <= 10
  });
  assert.deepEqual(r.fehler, []);
});

test('Doppelbehandlung bei ergänzendem Heilmittel wird sert abgewiesen', () => {
  const r = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: 'X0501', einheiten: 6 }],
    ergaenzend: { code: 'X1301', einheiten: 6, doppelbehandlung: true },
  });
  assert.ok(r.fehler.some(f => f.includes('Doppelbehandlung ist für ergänzende Heilmittel nicht zulässig')));
});

test('istEntwurf: leere Einheit ist frei, aber Einheit 0, doppelter Code und Ergänzend > Summe sperren', () => {
  // Leere Einheit im Entwurf erlaubt
  const rLeer = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: 'X0501', bezeichnung: 'KG', einheiten: '' }],
    istEntwurf: true,
  });
  assert.deepEqual(rLeer.fehler, []);

  // Einheit 0 sperrt auch im Entwurf
  const rNull = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: 'X0501', bezeichnung: 'KG', einheiten: 0 }],
    istEntwurf: true,
  });
  assert.ok(rNull.fehler.some(f => f.includes('größer als 0')));

  // Doppelter Code sperrt auch im Entwurf
  const rDoppelt = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [
      { code: 'X0501', bezeichnung: 'KG', einheiten: 6 },
      { code: 'X0501', bezeichnung: 'KG', einheiten: 6 },
    ],
    istEntwurf: true,
  });
  assert.ok(rDoppelt.fehler.some(f => f.includes('nicht mehrfach')));

  // Ergänzend > Summe sperrt auch im Entwurf
  const rErg = pruefeHeilmittelZeilen({
    bereich: 'physio',
    zeilen: [{ code: 'X0501', bezeichnung: 'KG', einheiten: 6 }],
    ergaenzend: { code: 'X1301', einheiten: 10 },
    istEntwurf: true,
  });
  assert.ok(rErg.fehler.some(f => f.includes('nicht übersteigen')));
});

