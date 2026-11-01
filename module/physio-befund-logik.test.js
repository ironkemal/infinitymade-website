/**
 * physio-befund-logik.test.js — Tests fuer den Physio-Befund (Katalog + Logik).
 *
 * Ausfuehrung via: node --test module/physio-befund-logik.test.js
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FORM_VERSION,
  BEFUNDARTEN,
  REGIONEN,
  SEITEN,
  NRS_ZEITEN,
  CHARAKTER,
  INSPEKTION,
  PALPATION,
  ROM_BEWEGUNGEN,
  KRAFT_GRUPPEN,
  TESTS,
  TEST_ERGEBNISSE,
  ADL,
  ZIEL_VORSCHLAEGE,
  MASSNAHMEN,
  VERLAUF,
  ZIEL_ERREICHT,
} from './physio-befund-katalog.js';

import {
  neuerBefundZustand,
  validiere,
  baueDaten,
  koerperteilName,
  baueMessreihenZeilen,
  leseMesswerte,
  uebernehmeVonVorbefund,
  vergleich,
  positiveTests,
} from './physio-befund-logik.js';

describe('1. Katalog-Struktur und Vollstaendigkeit', () => {
  it('FORM_VERSION ist 1', () => {
    assert.equal(FORM_VERSION, 1);
  });

  it('BEFUNDARTEN enthaelt erst, zwischen, abschluss', () => {
    assert.deepEqual(BEFUNDARTEN.map(b => b.id), ['erst', 'zwischen', 'abschluss']);
    assert.equal(BEFUNDARTEN.find(b => b.id === 'erst').label, 'Erstbefund');
    assert.equal(BEFUNDARTEN.find(b => b.id === 'zwischen').label, 'Zwischenbefund');
    assert.equal(BEFUNDARTEN.find(b => b.id === 'abschluss').label, 'Abschlussbefund');
  });

  it('REGIONEN enthaelt HWS, LWS, Schulter, Knie, Hüfte und OSG mit festen Labels', () => {
    const ids = REGIONEN.map(r => r.id);
    assert.deepEqual(ids, ['HWS', 'LWS', 'Schulter', 'Knie', 'Hüfte', 'OSG']);

    const hws = REGIONEN.find(r => r.id === 'HWS');
    assert.equal(hws.label, 'HWS');
    assert.equal(hws.seitig, false);

    const lws = REGIONEN.find(r => r.id === 'LWS');
    assert.equal(lws.label, 'LWS');
    assert.equal(lws.seitig, false);

    const schulter = REGIONEN.find(r => r.id === 'Schulter');
    assert.equal(schulter.label, 'Schulter');
    assert.equal(schulter.seitig, true);

    const osg = REGIONEN.find(r => r.id === 'OSG');
    assert.equal(osg.label, 'OSG/Fuß');
    assert.equal(osg.seitig, true);
  });

  it('INSPEKTION und PALPATION enthalten "unauffällig" mit exklusiv: true', () => {
    const inspUnauff = INSPEKTION.find(i => i.label === 'unauffällig');
    assert.ok(inspUnauff);
    assert.equal(inspUnauff.exklusiv, true);

    const palpUnauff = PALPATION.find(p => p.label === 'unauffällig');
    assert.ok(palpUnauff);
    assert.equal(palpUnauff.exklusiv, true);
  });

  it('ROM_BEWEGUNGEN enthaelt alle geforderten Bewegungen pro Region', () => {
    // HWS: Flexion, Extension (nicht seitig, 45°), Lateralflexion (seitig, 45°), Rotation (seitig, 60–80°)
    const hws = ROM_BEWEGUNGEN.HWS;
    assert.equal(hws.length, 4);
    assert.equal(hws.find(b => b.id === 'flexion').seitig, false);
    assert.equal(hws.find(b => b.id === 'flexion').richtwert, '45°');
    assert.equal(hws.find(b => b.id === 'extension').seitig, false);
    assert.equal(hws.find(b => b.id === 'extension').richtwert, '45°');
    assert.equal(hws.find(b => b.id === 'lateralflexion').seitig, true);
    assert.equal(hws.find(b => b.id === 'lateralflexion').richtwert, '45°');
    assert.equal(hws.find(b => b.id === 'rotation').seitig, true);

    // LWS: Flexion, Extension (nicht seitig), Lateralflexion (seitig), Rotation (seitig)
    const lws = ROM_BEWEGUNGEN.LWS;
    assert.equal(lws.length, 4);
    assert.equal(lws.find(b => b.id === 'flexion').seitig, false);
    assert.equal(lws.find(b => b.id === 'extension').seitig, false);
    assert.equal(lws.find(b => b.id === 'lateralflexion').seitig, true);
    assert.equal(lws.find(b => b.id === 'rotation').seitig, true);

    // Schulter: 6 Bewegungen alle seitig
    const sch = ROM_BEWEGUNGEN.Schulter;
    assert.equal(sch.length, 6);
    assert.ok(sch.every(b => b.seitig === true));

    // OSG: 4 Bewegungen alle seitig
    const osg = ROM_BEWEGUNGEN.OSG;
    assert.equal(osg.length, 4);
    assert.ok(osg.every(b => b.seitig === true));
  });

  it('KRAFT_GRUPPEN enthaelt geforderte Muskelgruppen (nicht seitig nur HWS/LWS)', () => {
    assert.ok(KRAFT_GRUPPEN.HWS.every(g => g.seitig === false));
    assert.ok(KRAFT_GRUPPEN.LWS.every(g => g.seitig === false));
    assert.ok(KRAFT_GRUPPEN.Schulter.every(g => g.seitig === true));
    assert.ok(KRAFT_GRUPPEN.Knie.every(g => g.seitig === true));
    assert.ok(KRAFT_GRUPPEN.Hüfte.every(g => g.seitig === true));
    assert.ok(KRAFT_GRUPPEN.OSG.every(g => g.seitig === true));
  });

  it('TESTS enthaelt genau die geforderten Tests pro Region', () => {
    assert.deepEqual(TESTS.HWS.map(t => t.label), ['Spurling', 'Distraktion', 'ULTT1', 'Foramen-Kompression', 'Rotation in Flexion']);
    assert.equal(TESTS.HWS.find(t => t.id === 'distraktion').seitig, false);
    assert.equal(TESTS.HWS.find(t => t.id === 'spurling').seitig, true);

    assert.deepEqual(TESTS.LWS.map(t => t.label), ['Lasègue', 'Slump', 'Femoralis-Dehnung', 'Fersen-/Zehengang', 'Kemp']);
    assert.equal(TESTS.LWS.find(t => t.id === 'fersen_zehengang').seitig, false);

    assert.deepEqual(TESTS.Schulter.map(t => t.label), ['Hawkins-Kennedy', 'Neer', 'Jobe/Empty Can', 'Painful Arc', 'Lift-off/Belly-Press']);
    assert.deepEqual(TESTS.Knie.map(t => t.label), ['Lachman', 'Schublade vorn', 'McMurray', 'Thessaly', 'Varus-/Valgusstress']);
    assert.deepEqual(TESTS.Hüfte.map(t => t.label), ['FADIR', 'FABER/Patrick', 'Thomas', 'Trendelenburg', 'Log-Roll']);
    assert.deepEqual(TESTS.OSG.map(t => t.label), ['Schublade vorn OSG', 'Talar-Tilt', 'Thompson', 'Squeeze', 'Kleiger']);
  });

  it('TEST_ERGEBNISSE enthaelt plus, minus, nicht', () => {
    assert.deepEqual(TEST_ERGEBNISSE.map(t => t.id), ['plus', 'minus', 'nicht']);
  });
});

describe('2. neuerBefundZustand', () => {
  it('erzeugt initialen Zustand mit sinnvollen Defaults', () => {
    const s = neuerBefundZustand({ befundart: 'erst', datum: '2026-11-01', therapeutId: 'th-1' });
    assert.equal(s.befundart, 'erst');
    assert.equal(s.datum, '2026-11-01');
    assert.equal(s.therapeutId, 'th-1');
    assert.deepEqual(s.regionen, {});
    assert.deepEqual(s.inspektion, { auswahl: [], text: '' });
    assert.deepEqual(s.palpation, { auswahl: [], text: '' });
    assert.deepEqual(s.adl, { auswahl: [], gehstrecke_m: null, sitzdauer_min: null });
    assert.equal(s.ziele.length, 1);
    assert.equal(s.ziele[0].text, '');
    assert.equal(s.ziele[0].erreicht, null);
    assert.equal(s.verlauf, null);
    assert.deepEqual(s.empfehlung, { folge_vo: null, eigentraining: false });
    assert.equal(s.notiz, '');
  });
});

describe('3. validiere (Pflichtfaelle und Wertebereiche)', () => {
  function erstZustandGueltig() {
    return {
      befundart: 'erst',
      datum: '2026-11-01',
      therapeutId: 'th-1',
      regionen: {
        Schulter: {
          seite: 'rechts',
          nrs: { aktuell: 6, ruhe: 2, belastung: 8, nacht: 4 },
          charakter: ['stechend', 'ziehend'],
          rom: {
            flexion: { links: 180, rechts: 110, beidseits: null, schmerzhaft: { links: false, rechts: true, beidseits: false } },
          },
          kraft: {
            abduktion: { links: 5, rechts: 4, beidseits: null },
          },
          tests: {
            hawkins_kennedy: { rechts: 'plus', links: 'minus' },
          },
        },
      },
      inspektion: { auswahl: ['schwellung'], text: '' },
      palpation: { auswahl: ['druckdolenz'], text: '' },
      adl: { auswahl: ['ueberkopf'], gehstrecke_m: null, sitzdauer_min: null },
      ziele: [{ text: 'Schmerzfrei Überkopf greifen', erreicht: null }],
      therapieplan: { massnahmen: ['mt', 'mobilisation'], hausaufgaben: 'Pendelübungen' },
      verlauf: null,
      empfehlung: { folge_vo: null, eigentraining: false },
      notiz: 'Guter Allgemeinzustand',
    };
  }

  it('valider Erstbefund besteht ohne Fehler', () => {
    const s = erstZustandGueltig();
    const res = validiere(s);
    assert.equal(res.ok, true);
    assert.equal(res.fehler.length, 0);
  });

  it('Fehler wenn Befundart fehlt oder ungueltig ist', () => {
    const s = erstZustandGueltig();
    s.befundart = '';
    const res = validiere(s);
    assert.equal(res.ok, false);
    assert.ok(res.fehler.some(f => f.includes('Befundart')));
  });

  it('Fehler wenn keine Region erfasst ist', () => {
    const s = erstZustandGueltig();
    s.regionen = {};
    const res = validiere(s);
    assert.equal(res.ok, false);
    assert.ok(res.fehler.some(f => f.includes('Mindestens eine Region')));
  });

  it('Fehler wenn nrs.aktuell fehlt, null ist oder keine Zahl ist', () => {
    const s = erstZustandGueltig();
    s.regionen.Schulter.nrs.aktuell = null;
    const res = validiere(s);
    assert.equal(res.ok, false);
    assert.ok(res.fehler.some(f => f.includes('NRS aktuell')));
  });

  it('Fehler wenn nrs.aktuell nicht ganzzahlig oder ausserhalb 0–10 ist', () => {
    const s1 = erstZustandGueltig();
    s1.regionen.Schulter.nrs.aktuell = 5.5;
    assert.equal(validiere(s1).ok, false);

    const s2 = erstZustandGueltig();
    s2.regionen.Schulter.nrs.aktuell = 11;
    assert.equal(validiere(s2).ok, false);

    const s3 = erstZustandGueltig();
    s3.regionen.Schulter.nrs.aktuell = -1;
    assert.equal(validiere(s3).ok, false);

    const s4 = erstZustandGueltig();
    s4.regionen.Schulter.nrs.aktuell = 0; // 0 ist gueltig!
    assert.equal(validiere(s4).ok, true);
  });

  it('Fehler wenn Befunddatum fehlt, ungueltig oder im falschen Format ist', () => {
    const s1 = erstZustandGueltig();
    s1.datum = null;
    const res1 = validiere(s1);
    assert.equal(res1.ok, false);
    assert.ok(res1.fehler.some(f => f.includes('Befunddatum ist ein Pflichtfeld')));

    const s2 = erstZustandGueltig();
    s2.datum = '01.11.2026'; // falsches Format
    const res2 = validiere(s2);
    assert.equal(res2.ok, false);
    assert.ok(res2.fehler.some(f => f.includes('Befunddatum ist ein Pflichtfeld')));

    const s3 = erstZustandGueltig();
    s3.datum = '2026-99-99'; // semantisch ungueltig
    const res3 = validiere(s3);
    assert.equal(res3.ok, false);
    assert.ok(res3.fehler.some(f => f.includes('Befunddatum ist ein Pflichtfeld')));

    const s4 = erstZustandGueltig();
    s4.datum = '2026-11-01';
    assert.equal(validiere(s4).ok, true);
  });

  it('Fehler beim Erstbefund wenn kein Ziel mit Text vorhanden ist', () => {
    const s = erstZustandGueltig();
    s.ziele = [{ text: '   ', erreicht: null }];
    const res = validiere(s);
    assert.equal(res.ok, false);
    assert.ok(res.fehler.some(f => f.includes('Behandlungsziel')));
  });

  it('Fehler beim Zwischenbefund wenn verlauf fehlt', () => {
    const s = erstZustandGueltig();
    s.befundart = 'zwischen';
    s.verlauf = null;
    const res = validiere(s);
    assert.equal(res.ok, false);
    assert.ok(res.fehler.some(f => f.includes('Verlauf')));

    s.verlauf = 'besser';
    assert.equal(validiere(s).ok, true);
  });

  it('Fehler beim Abschlussbefund wenn verlauf oder empfehlung.folge_vo fehlt', () => {
    const s = erstZustandGueltig();
    s.befundart = 'abschluss';
    s.verlauf = null;
    s.empfehlung.folge_vo = null;

    const res1 = validiere(s);
    assert.equal(res1.ok, false);
    assert.ok(res1.fehler.some(f => f.includes('Verlauf')));
    assert.ok(res1.fehler.some(f => f.includes('Folge-Verordnung')));

    s.verlauf = 'gleich';
    s.empfehlung.folge_vo = 'nein';
    const res2 = validiere(s);
    assert.equal(res2.ok, true);
  });

  it('Fehler bei ungueltigen ROM-Werten (< 0 oder > 360)', () => {
    const s = erstZustandGueltig();
    s.regionen.Schulter.rom.flexion.rechts = 400;
    const res = validiere(s);
    assert.equal(res.ok, false);
    assert.ok(res.fehler.some(f => f.includes('ROM-Wert')));
  });

  it('Fehler bei ungueltigen MFT-Kraftwerten (< 0 oder > 5)', () => {
    const s = erstZustandGueltig();
    s.regionen.Schulter.kraft.abduktion.rechts = 6;
    const res = validiere(s);
    assert.equal(res.ok, false);
    assert.ok(res.fehler.some(f => f.includes('Kraft-Wert')));
  });
});

describe('4. baueDaten (jsonb fuer physio_befunde.daten)', () => {
  it('enthaelt keine Messwerte (kein nrs, keine ROM/MFT-Zahlen) und kein vorher', () => {
    const state = {
      befundart: 'erst',
      datum: '2026-11-01',
      therapeutId: 'th-1',
      vorher: { HWS: { nrs: { aktuell: 7 } } }, // Simulation einer vorhandenen vorher-Referenz
      regionen: {
        Schulter: {
          seite: 'rechts',
          nrs: { aktuell: 6, ruhe: 2, belastung: 8, nacht: 4 },
          charakter: ['stechend'],
          rom: {
            flexion: { links: 180, rechts: 120, beidseits: null, schmerzhaft: { links: false, rechts: true, beidseits: false } },
            extension: { links: 50, rechts: 50, beidseits: null, schmerzhaft: { links: false, rechts: false, beidseits: false } },
          },
          kraft: {
            flexion: { links: 5, rechts: 4, beidseits: null },
          },
          tests: {
            hawkins_kennedy: { rechts: 'plus', links: 'nicht' },
            neer: { rechts: 'minus', links: 'nicht' },
            jobe_empty_can: { rechts: 'nicht', links: 'nicht' },
          },
        },
      },
      inspektion: { auswahl: ['schwellung'], text: 'Leichte Schwellung ventralseitig' },
      palpation: { auswahl: ['druckdolenz'], text: 'Schmerz über Supraspinatussehne' },
      adl: { auswahl: ['ueberkopf'], gehstrecke_m: 500, sitzdauer_min: 60 },
      ziele: [{ text: 'Überkopf greifen', erreicht: null }],
      therapieplan: { massnahmen: ['mt'], hausaufgaben: 'Dehnung' },
      verlauf: null,
      empfehlung: { folge_vo: 'ja', eigentraining: true },
      notiz: 'Befundnotiz',
    };

    const daten = baueDaten(state);

    // Test 1: Kein Schluessel 'nrs' auf irgendeiner Ebene
    assert.equal('nrs' in daten, false);
    assert.equal('nrs' in (daten.regionen.Schulter || {}), false);

    // Test 2: 'vorher' darf nicht enthalten sein
    assert.equal('vorher' in daten, false);

    // Test 3: Keine Kraft-Zahlen
    assert.equal('kraft' in daten.regionen.Schulter, false);

    // Test 4: ROM enthaelt NUR schmerzhaft-Flags, keine Gradzahlen
    const rom = daten.regionen.Schulter.rom;
    assert.ok(rom.flexion);
    assert.deepEqual(rom.flexion, { schmerzhaft: { rechts: true } });
    assert.equal('links' in rom.flexion, false);
    assert.equal('rechts' in rom.flexion, false);
    assert.equal('beidseits' in rom.flexion, false);

    // Extension hatte keine schmerzhaften Flags -> sollte leer oder weggelassen sein
    assert.equal(rom.extension, undefined);

    // Test 5: Tests filtern 'nicht' heraus
    const tests = daten.regionen.Schulter.tests;
    assert.deepEqual(tests.hawkins_kennedy, { rechts: 'plus' });
    assert.deepEqual(tests.neer, { rechts: 'minus' });
    assert.equal('jobe_empty_can' in tests, false); // beide Seiten 'nicht' -> ganz weg

    // Test 6: Andere Daten sauber vorhanden
    assert.deepEqual(daten.inspektion.auswahl, ['schwellung']);
    assert.equal(daten.inspektion.text, 'Leichte Schwellung ventralseitig');
    assert.deepEqual(daten.palpation.auswahl, ['druckdolenz']);
    assert.deepEqual(daten.adl.auswahl, ['ueberkopf']);
    assert.equal(daten.adl.gehstrecke_m, 500);
    assert.equal(daten.adl.sitzdauer_min, 60);
    assert.deepEqual(daten.ziele, [{ text: 'Überkopf greifen', erreicht: null }]);
    assert.deepEqual(daten.therapieplan.massnahmen, ['mt']);
    assert.equal(daten.empfehlung.folge_vo, 'ja');
    assert.equal(daten.empfehlung.eigentraining, true);
    assert.equal(daten.notiz, 'Befundnotiz');

    // Test 7: bericht enthaelt denormalisierte Katalog-Labels und positive Tests (Seite klein)
    assert.ok(daten.bericht);
    assert.deepEqual(daten.bericht.regionen, ['Schulter']);
    assert.deepEqual(daten.bericht.inspektion, ['Schwellung']);
    assert.deepEqual(daten.bericht.palpation, ['Druckdolenz']);
    assert.deepEqual(daten.bericht.adl, ['Überkopf']);
    assert.deepEqual(daten.bericht.massnahmen, ['Manuelle Therapie (MT)']);
    assert.deepEqual(daten.bericht.positive_tests, [
      { region: 'Schulter', test: 'Hawkins-Kennedy', seite: 'rechts' },
    ]);
    assert.deepEqual(daten.bericht.ziele, [{ text: 'Überkopf greifen', erreicht: null }]);
    assert.equal(daten.bericht.verlauf, null);
    assert.deepEqual(daten.bericht.empfehlung, { folge_vo: 'ja', eigentraining: true });
    // Keine Messwerte im Bericht
    assert.equal('nrs' in daten.bericht, false);
    assert.equal('rom' in daten.bericht, false);
    assert.equal('kraft' in daten.bericht, false);
  });
});

describe('5. koerperteilName', () => {
  it('formatiert Region allein oder mit Zusatz und festem Trenner " · "', () => {
    assert.equal(koerperteilName('Schulter'), 'Schulter');
    assert.equal(koerperteilName('Schulter', 'Flexion'), 'Schulter · Flexion');
    assert.equal(koerperteilName('HWS', 'Ruhe'), 'HWS · Ruhe');
    assert.equal(koerperteilName('OSG', 'Plantarflexion'), 'OSG/Fuß · Plantarflexion');
    assert.equal(koerperteilName('Huefte', 'Abduktion'), 'Hüfte · Abduktion');
  });
});

describe('6. baueMessreihenZeilen', () => {
  it('erzeugt exakte Zeilen mit typ, einheit, koerperteil und seite; ignoriert leere Werte', () => {
    const state = {
      datum: '2026-11-01',
      regionen: {
        Schulter: {
          seite: 'rechts',
          nrs: { aktuell: 7, ruhe: 2, belastung: 8, nacht: null }, // nacht ist null -> keine Zeile
          rom: {
            flexion: { links: 175, rechts: 110, beidseits: null, schmerzhaft: { links: false, rechts: true } },
            abduktion: { links: null, rechts: 95, beidseits: null, schmerzhaft: { rechts: false } },
          },
          kraft: {
            abduktion: { links: 5, rechts: 4, beidseits: null },
          },
        },
        HWS: {
          seite: 'beidseits',
          nrs: { aktuell: 4, ruhe: null, belastung: null, nacht: null },
          rom: {
            flexion: { links: null, rechts: null, beidseits: 70, schmerzhaft: { beidseits: false } },
          },
          kraft: {
            flexoren: { links: null, rechts: null, beidseits: 5 },
          },
        },
      },
    };

    const ctx = {
      ownerId: 'own-1',
      leadId: 'lead-10',
      prescriptionId: 'rx-20',
      befundId: 'bef-30',
      erfasstVon: 'usr-40',
      gemessenAm: '2026-11-01T10:00:00.000Z',
    };

    const zeilen = baueMessreihenZeilen(state, ctx);

    // Zaehlung:
    // Schulter:
    // - NRS aktuell: 1
    // - NRS ruhe: 1
    // - NRS belastung: 1
    // - ROM flexion (links, rechts): 2
    // - ROM abduktion (rechts): 1
    // - Kraft abduktion (links, rechts): 2
    // HWS:
    // - NRS aktuell: 1
    // - ROM flexion (beidseits): 1
    // - Kraft flexoren (beidseits): 1
    // Summe = 3 + 3 + 2 + 1 + 1 + 1 = 11 Zeilen
    assert.equal(zeilen.length, 11);

    // Pflichtfelder an jeder Zeile
    for (const z of zeilen) {
      assert.equal(z.owner_id, 'own-1');
      assert.equal(z.lead_id, 'lead-10');
      assert.equal(z.prescription_id, 'rx-20');
      assert.equal(z.befund_id, 'bef-30');
      assert.equal(z.erfasst_von, 'usr-40');
      assert.equal(z.gemessen_am, '2026-11-01T10:00:00.000Z');
      assert.ok(['VAS', 'ROM', 'kraft'].includes(z.typ));
      assert.ok(typeof z.wert === 'number');
    }

    // Spezifische Pruefungen
    const nrsAkt = zeilen.find(z => z.typ === 'VAS' && z.koerperteil === 'Schulter');
    assert.ok(nrsAkt);
    assert.equal(nrsAkt.wert, 7);
    assert.equal(nrsAkt.einheit, 'Punkte');
    assert.equal(nrsAkt.seite, 'rechts');

    const nrsBelast = zeilen.find(z => z.typ === 'VAS' && z.koerperteil === 'Schulter · Belastung');
    assert.ok(nrsBelast);
    assert.equal(nrsBelast.wert, 8);

    const romFlexRechts = zeilen.find(z => z.typ === 'ROM' && z.koerperteil === 'Schulter · Flexion' && z.seite === 'rechts');
    assert.ok(romFlexRechts);
    assert.equal(romFlexRechts.wert, 110);
    assert.equal(romFlexRechts.einheit, 'Grad');
    assert.equal(romFlexRechts.notiz, 'schmerzhaft');

    const romFlexLinks = zeilen.find(z => z.typ === 'ROM' && z.koerperteil === 'Schulter · Flexion' && z.seite === 'links');
    assert.ok(romFlexLinks);
    assert.equal(romFlexLinks.wert, 175);
    assert.equal(romFlexLinks.notiz, null);

    const kraftAbduktLinks = zeilen.find(z => z.typ === 'kraft' && z.koerperteil === 'Schulter · Abduktion' && z.seite === 'links');
    assert.ok(kraftAbduktLinks);
    assert.equal(kraftAbduktLinks.wert, 5);
    assert.equal(kraftAbduktLinks.einheit, 'MFT');

    // HWS nicht seitige Pruefung
    const hwsRom = zeilen.find(z => z.typ === 'ROM' && z.koerperteil === 'HWS · Flexion');
    assert.ok(hwsRom);
    assert.equal(hwsRom.seite, 'beidseits');
    assert.equal(hwsRom.wert, 70);
  });
});

describe('7. Rundlauf: leseMesswerte(baueMessreihenZeilen(state))', () => {
  it('stellt Messwerte aus zeilen verlustfrei wieder her', () => {
    const originalState = {
      datum: '2026-11-01',
      regionen: {
        Schulter: {
          seite: 'rechts',
          nrs: { aktuell: 5, ruhe: 1, belastung: 7, nacht: 3 },
          rom: {
            flexion: { links: 180, rechts: 130, beidseits: null, schmerzhaft: { links: false, rechts: true, beidseits: false } },
            aussenrotation: { links: 70, rechts: 45, beidseits: null, schmerzhaft: { links: false, rechts: true, beidseits: false } },
          },
          kraft: {
            abduktion: { links: 5, rechts: 4, beidseits: null },
          },
        },
        OSG: {
          seite: 'links',
          nrs: { aktuell: 4, ruhe: 0, belastung: 6, nacht: null },
          rom: {
            dorsalextension: { links: 15, rechts: 25, beidseits: null, schmerzhaft: { links: true, rechts: false, beidseits: false } },
          },
          kraft: {
            dorsalextension: { links: 4, rechts: 5, beidseits: null },
          },
        },
      },
    };

    const ctx = {
      ownerId: 'own-1',
      leadId: 'lead-1',
      befundId: 'bef-1',
      gemessenAm: '2026-11-01T12:00:00Z',
    };

    const zeilen = baueMessreihenZeilen(originalState, ctx);
    const wiederhergestellt = leseMesswerte(zeilen);

    // Schulter Pruefung
    assert.ok(wiederhergestellt.Schulter);
    assert.equal(wiederhergestellt.Schulter.nrs.aktuell, 5);
    assert.equal(wiederhergestellt.Schulter.nrs.ruhe, 1);
    assert.equal(wiederhergestellt.Schulter.nrs.belastung, 7);
    assert.equal(wiederhergestellt.Schulter.nrs.nacht, 3);
    assert.equal(wiederhergestellt.Schulter.rom.flexion.links, 180);
    assert.equal(wiederhergestellt.Schulter.rom.flexion.rechts, 130);
    assert.equal(wiederhergestellt.Schulter.rom.flexion.schmerzhaft.rechts, true);
    assert.equal(wiederhergestellt.Schulter.rom.flexion.schmerzhaft.links, false);
    assert.equal(wiederhergestellt.Schulter.kraft.abduktion.links, 5);
    assert.equal(wiederhergestellt.Schulter.kraft.abduktion.rechts, 4);

    // OSG Pruefung (wichtiger Praefix "OSG/Fuß")
    assert.ok(wiederhergestellt.OSG);
    assert.equal(wiederhergestellt.OSG.nrs.aktuell, 4);
    assert.equal(wiederhergestellt.OSG.nrs.belastung, 6);
    assert.equal(wiederhergestellt.OSG.nrs.nacht, null);
    assert.equal(wiederhergestellt.OSG.rom.dorsalextension.links, 15);
    assert.equal(wiederhergestellt.OSG.rom.dorsalextension.rechts, 25);
    assert.equal(wiederhergestellt.OSG.rom.dorsalextension.schmerzhaft.links, true);
    assert.equal(wiederhergestellt.OSG.kraft.dorsalextension.links, 4);
  });

  it('Rundlauf: seitige Region mit ROM-Zeile VOR VAS-Zeile setzt seite NUR aus VAS; nicht-seitige bleibt null', () => {
    const zeilen = [
      { typ: 'ROM', koerperteil: 'Schulter · Flexion', seite: 'rechts', wert: 140 },
      { typ: 'VAS', koerperteil: 'Schulter', seite: 'links', wert: 6 },
      { typ: 'ROM', koerperteil: 'HWS · Flexion', seite: 'beidseits', wert: 40 },
      { typ: 'VAS', koerperteil: 'HWS', seite: 'beidseits', wert: 3 },
    ];
    const res = leseMesswerte(zeilen);
    assert.ok(res.Schulter);
    assert.equal(res.Schulter.seite, 'links'); // NUR aus VAS gesetzt, nicht von vorangehender ROM-Zeile
    assert.equal(res.Schulter.rom.flexion.rechts, 140);
    assert.equal(res.Schulter.nrs.aktuell, 6);
    assert.ok(res.HWS);
    assert.equal(res.HWS.seite, null); // nicht-seitige Region bleibt strikt null
    assert.equal(res.HWS.rom.flexion.beidseits, 40);
    assert.equal(res.HWS.nrs.aktuell, 3);
  });
});

describe('8. uebernehmeVonVorbefund', () => {
  it('erzeugt Zwischenbefund mit leeren Messwerten und vorher-Referenz', () => {
    const vorDaten = {
      regionen: {
        Schulter: {
          seite: 'rechts',
          charakter: ['stechend'],
          rom: { flexion: { schmerzhaft: { rechts: true } } },
          tests: { hawkins_kennedy: { rechts: 'plus' } },
        },
      },
      inspektion: { auswahl: ['schwellung'], text: 'Altbefund Schwellung' },
      palpation: { auswahl: ['hypertonus'], text: 'Trapezius' },
      adl: { auswahl: ['ueberkopf'], gehstrecke_m: 300, sitzdauer_min: 30 },
      ziele: [
        { text: 'Schmerzfrei heben', erreicht: 'ja' },
        { text: 'Sport machen', erreicht: 'teilweise' },
      ],
      therapieplan: { massnahmen: ['mt', 'kraeftigung'], hausaufgaben: 'Theraband' },
    };

    const vorMessungen = [
      { typ: 'VAS', koerperteil: 'Schulter', wert: 8, seite: 'rechts' },
      { typ: 'ROM', koerperteil: 'Schulter · Flexion', wert: 110, seite: 'rechts', notiz: 'schmerzhaft' },
    ];

    const neuState = uebernehmeVonVorbefund({
      befundart: 'zwischen',
      datum: '2026-11-15',
      therapeutId: 'th-2',
      vorDaten,
      vorMessungen,
    });

    assert.equal(neuState.befundart, 'zwischen');
    assert.equal(neuState.datum, '2026-11-15');
    assert.equal(neuState.therapeutId, 'th-2');

    // Regionen uebernommen, aber Messwerte leer (null)
    assert.ok(neuState.regionen.Schulter);
    assert.equal(neuState.regionen.Schulter.seite, 'rechts');
    assert.deepEqual(neuState.regionen.Schulter.charakter, ['stechend']);
    assert.deepEqual(neuState.regionen.Schulter.tests, { hawkins_kennedy: { rechts: 'plus' } });
    assert.deepEqual(neuState.regionen.Schulter.nrs, { aktuell: null, ruhe: null, belastung: null, nacht: null });
    assert.equal(neuState.regionen.Schulter.rom.flexion.rechts, null);

    // Inspektion, Palpation, ADL uebernommen
    assert.deepEqual(neuState.inspektion.auswahl, ['schwellung']);
    assert.equal(neuState.inspektion.text, 'Altbefund Schwellung');
    assert.deepEqual(neuState.adl.auswahl, ['ueberkopf']);
    assert.equal(neuState.adl.gehstrecke_m, 300);

    // Ziele uebernommen, aber 'erreicht' zurueckgesetzt auf null!
    assert.equal(neuState.ziele.length, 2);
    assert.equal(neuState.ziele[0].text, 'Schmerzfrei heben');
    assert.equal(neuState.ziele[0].erreicht, null);
    assert.equal(neuState.ziele[1].text, 'Sport machen');
    assert.equal(neuState.ziele[1].erreicht, null);

    // Therapieplan uebernommen
    assert.deepEqual(neuState.therapieplan.massnahmen, ['mt', 'kraeftigung']);

    // Messwerte im vorher-Attribut hinterlegt
    assert.ok(neuState.vorher.Schulter);
    assert.equal(neuState.vorher.Schulter.nrs.aktuell, 8);
    assert.equal(neuState.vorher.Schulter.rom.flexion.rechts, 110);
  });
});

describe('9. vergleich (Differenzen zwischen vorher und jetzt)', () => {
  it('erkennt Veraenderungen und berechnet delta korrekt', () => {
    const vorherMessungen = [
      { typ: 'VAS', koerperteil: 'Schulter', wert: 8, seite: 'rechts' },
      { typ: 'VAS', koerperteil: 'Schulter · Ruhe', wert: 3, seite: 'rechts' },
      { typ: 'ROM', koerperteil: 'Schulter · Flexion', wert: 110, seite: 'rechts' },
      { typ: 'kraft', koerperteil: 'Schulter · Abduktion', wert: 3, seite: 'rechts' },
    ];

    const aktuellMessungen = [
      { typ: 'VAS', koerperteil: 'Schulter', wert: 4, seite: 'rechts' }, // Delta -4
      { typ: 'VAS', koerperteil: 'Schulter · Ruhe', wert: 3, seite: 'rechts' }, // Unveraendert -> nicht in der Liste
      { typ: 'ROM', koerperteil: 'Schulter · Flexion', wert: 145, seite: 'rechts' }, // Delta +35
      { typ: 'kraft', koerperteil: 'Schulter · Abduktion', wert: 5, seite: 'rechts' }, // Delta +2
    ];

    const diff = vergleich(aktuellMessungen, vorherMessungen);

    assert.equal(diff.length, 3);

    const nrsDiff = diff.find(d => d.art === 'nrs');
    assert.ok(nrsDiff);
    assert.equal(nrsDiff.vorher, 8);
    assert.equal(nrsDiff.jetzt, 4);
    assert.equal(nrsDiff.delta, -4);

    const romDiff = diff.find(d => d.art === 'rom');
    assert.ok(romDiff);
    assert.equal(romDiff.label, 'Flexion');
    assert.equal(romDiff.vorher, 110);
    assert.equal(romDiff.jetzt, 145);
    assert.equal(romDiff.delta, 35);

    const kraftDiff = diff.find(d => d.art === 'kraft');
    assert.ok(kraftDiff);
    assert.equal(kraftDiff.label, 'Abduktion');
    assert.equal(kraftDiff.vorher, 3);
    assert.equal(kraftDiff.jetzt, 5);
    assert.equal(kraftDiff.delta, 2);
  });
});

describe('10. positiveTests', () => {
  it('filtert mit "plus" markierte Tests heraus und liefert Katalog-Labels', () => {
    const daten = {
      regionen: {
        Schulter: {
          seite: 'rechts',
          tests: {
            hawkins_kennedy: { rechts: 'plus', links: 'minus' },
            neer: { rechts: 'minus', links: 'nicht' },
            jobe_empty_can: { rechts: 'plus' },
          },
        },
        HWS: {
          seite: 'beidseits',
          tests: {
            spurling: { links: 'plus' },
            distraktion: 'plus', // nicht seitig
          },
        },
      },
    };

    const pos = positiveTests(daten);

    assert.equal(pos.length, 4);

    assert.deepEqual(pos[0], {
      region: 'Schulter',
      test: 'Hawkins-Kennedy',
      seite: 'Rechts',
    });

    assert.deepEqual(pos[1], {
      region: 'Schulter',
      test: 'Jobe/Empty Can',
      seite: 'Rechts',
    });

    assert.deepEqual(pos[2], {
      region: 'HWS',
      test: 'Spurling',
      seite: 'Links',
    });

    assert.deepEqual(pos[3], {
      region: 'HWS',
      test: 'Distraktion',
      seite: 'Beidseits',
    });
  });
});

import { standardVerordnungId } from './physio-befund-logik.js';

test('standardVerordnungId: laufende VO schlaegt neuere abgeschlossene und stornierte', () => {
  assert.equal(standardVerordnungId([
    { id: 'storno', status: 'cancelled' },
    { id: 'fertig', status: 'completed' },
    { id: 'laeuft', status: 'in_therapy' },
    { id: 'alt', status: 'confirmed' },
  ]), 'laeuft');
});

test('standardVerordnungId: ohne laufende VO nie die stornierte', () => {
  assert.equal(standardVerordnungId([
    { id: 'storno', status: 'cancelled' },
    { id: 'fertig', status: 'billed' },
  ]), 'fertig');
  assert.equal(standardVerordnungId([{ id: 'storno', status: 'cancelled' }]), null);
  assert.equal(standardVerordnungId([]), null);
});

test('neuerBefundZustand: Datum ist der Berliner Kalendertag', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-01T23:30:00Z') });
  assert.equal(neuerBefundZustand({}).datum, '2026-11-02');
});
