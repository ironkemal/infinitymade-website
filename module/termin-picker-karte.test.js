import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MONATE_DE,
  WOCHENTAGE_KURZ_MO,
  datumIso,
  parseDatumIso,
  monatsRaster,
  kurzTagKopf,
  formatDauer,
  monogramm,
} from './termin-picker-karte.js';

describe('module/termin-picker-karte.js — reine Hilfsfunktionen & Regeln', () => {
  it('Monate und Wochentage starten auf Deutsch mit Montag', () => {
    assert.equal(MONATE_DE.length, 12);
    assert.equal(MONATE_DE[9], 'Oktober');
    assert.deepEqual(WOCHENTAGE_KURZ_MO, ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO']);
  });

  it('monatsRaster erzeugt ein korrektes Montags-Raster inkl. Schaltjahr', () => {
    // Oktober 2026: 1. Oktober 2026 ist Donnerstag -> 3 leere Zellen (Mo, Di, Mi) + 31 Tage = 34
    const okt2026 = monatsRaster(2026, 9);
    assert.equal(okt2026.filter(z => z.empty).length, 3);
    assert.equal(okt2026.filter(z => !z.empty).length, 31);
    assert.equal(okt2026[3].iso, '2026-10-01');
    assert.equal(okt2026[3].weekday, 4); // Donnerstag

    // Februar 2028 (Schaltjahr): 29 Tage
    const feb2028 = monatsRaster(2028, 1);
    assert.equal(feb2028.filter(z => !z.empty).length, 29);

    // Februar 2027 (kein Schaltjahr): 28 Tage
    const feb2027 = monatsRaster(2027, 1);
    assert.equal(feb2027.filter(z => !z.empty).length, 28);
  });

  it('parseDatumIso lehnt ungültige Daten (z. B. 31.02.) ab', () => {
    assert.equal(parseDatumIso('2026-02-31'), null);
    assert.equal(parseDatumIso('ungueltig'), null);
    const dt = parseDatumIso('2026-10-30');
    assert.ok(dt instanceof Date);
    assert.equal(datumIso(dt), '2026-10-30');
  });

  it('kurzTagKopf liefert kompakten deutschen Tageskopf (z. B. Fr 30)', () => {
    const kopf = kurzTagKopf('2026-10-30');
    assert.deepEqual(kopf, { wochentag: 'Fr', tag: 30, voll: 'Fr 30' });
    assert.equal(kurzTagKopf(''), null);
  });

  it('formatDauer formatiert Minuten und Stunden sauber', () => {
    assert.equal(formatDauer(30), '30 Min.');
    assert.equal(formatDauer(60), '1 Std.');
    assert.equal(formatDauer(90), '1 Std. 30 Min.');
    assert.equal(formatDauer(0), '');
    assert.equal(formatDauer(null), '');
  });

  it('monogramm erzeugt reine Text-Initialen ohne Foto', () => {
    assert.equal(monogramm('Praxis Sonnenschein'), 'PS');
    assert.equal(monogramm('Max Muster'), 'MM');
    assert.equal(monogramm('Podologie'), 'PO');
    assert.equal(monogramm(''), 'P');
  });

  it('Komponente enthält keine <img>-Elemente und keinen 12-Std-Schalter', () => {
    const src = fs.readFileSync(new URL('./termin-picker-karte.js', import.meta.url), 'utf8');
    assert.ok(!/<img\b/i.test(src), 'Keine Fotos/<img> in termin-picker-karte.js');
    assert.ok(!/12\s*Std/i.test(src), 'Kein 12-Std-Umschalter in termin-picker-karte.js');
  });
});
