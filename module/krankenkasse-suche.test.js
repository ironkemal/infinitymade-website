// krankenkasse-suche.js — Tests der Reihenfolge.  Lauf:  node --test module/
//
// Getestet wird `sucheKassen` — die einzige Stelle, die entscheidet, was oben
// steht. Genau daran hing die Beschwerde: alphabetisch war die richtige Kasse
// nie in Sichtweite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sucheKassen } from './krankenkasse-suche.js';
import * as suche from './krankenkasse-suche.js';

const quelle = readFileSync(new URL('./krankenkasse-suche.js', import.meta.url), 'utf8');

const kassen = [
  { name: 'actimonda krankenkasse', kurz: null,     ik: '1',  anzahl: 0 },
  { name: 'AOK Bayern',             kurz: 'AOK BY', ik: '2',  anzahl: 41 },
  { name: 'BARMER',                 kurz: null,     ik: '3',  anzahl: 12 },
  { name: 'HEK',                    kurz: null,     ik: '4',  anzahl: 3 },
  { name: 'Techniker Krankenkasse', kurz: 'TK',     ik: '5',  anzahl: 7 },
  { name: 'Zeus BKK',               kurz: null,     ik: '6',  anzahl: 0 },
];

test('Kassen der eigenen Praxis stehen oben, nach Häufigkeit', () => {
  const r = sucheKassen(kassen, '');
  assert.deepEqual(r.slice(0, 4).map(k => k.name),
    ['AOK Bayern', 'BARMER', 'Techniker Krankenkasse', 'HEK']);
});

test('ungenutzte Kassen folgen alphabetisch', () => {
  const r = sucheKassen(kassen, '');
  assert.deepEqual(r.slice(4).map(k => k.name), ['actimonda krankenkasse', 'Zeus BKK']);
});

test('Suche findet über die Abkürzung', () => {
  assert.deepEqual(sucheKassen(kassen, 'TK').map(k => k.name), ['Techniker Krankenkasse']);
});

test('Suche ist unabhängig von Gross-/Kleinschreibung und Zeichensetzung', () => {
  // Der Bindestrich wird wie ein Leerzeichen behandelt — wer „aok-bayern"
  // tippt, meint dieselbe Kasse. (Diese Erwartung stand hier zuerst falsch
  // herum im Test; die Normalisierung war von Anfang an die richtige.)
  assert.deepEqual(sucheKassen(kassen, 'aok-bayern').map(k => k.name), ['AOK Bayern']);
  assert.deepEqual(sucheKassen(kassen, 'aok bayern').map(k => k.name), ['AOK Bayern']);
  assert.deepEqual(sucheKassen(kassen, 'BARMER').map(k => k.name), ['BARMER']);
  assert.deepEqual(sucheKassen(kassen, 'barmer').map(k => k.name), ['BARMER']);
});

test('ohne eigene Patienten bleibt es alphabetisch — nichts zu bevorzugen', () => {
  const frisch = kassen.map(k => ({ ...k, anzahl: 0 }));
  assert.deepEqual(sucheKassen(frisch, '').map(k => k.name), [
    'actimonda krankenkasse', 'AOK Bayern', 'BARMER', 'HEK',
    'Techniker Krankenkasse', 'Zeus BKK',
  ]);
});

test('Trefferzahl wird begrenzt', () => {
  const viele = Array.from({ length: 400 }, (_, i) => ({ name: `BKK ${i}`, kurz: null, ik: null, anzahl: 0 }));
  assert.equal(sucheKassen(viele, '', 30).length, 30);
});

test('Vorgabe zeigt den ganzen Kassenbestand — 94 Zeilen, nicht 30', () => {
  // Regression: die Vorgabe war 30 und schnitt die alphabetische Liste mitten
  // im „B" ab. Der Anwender sah ein Fuenftel und hielt die Quelle fuer falsch.
  const bestand = Array.from({ length: 94 }, (_, i) => ({ name: `Kasse ${i}`, kurz: null, ik: null, anzahl: 0 }));
  assert.equal(sucheKassen(bestand, '').length, 94);
});

// ── Ops #264: Krankenkasse → IK automatisch, ohne dashboard.js zu vergrössern ──
//
// attachKrankenkasseSuche() ist DOM-getrieben (attachAutocomplete()) — kein
// node:test-DOM hier, deshalb ein Bauart-Test wie bei podologie-abrechnung.js:
// geprüft wird die Quelle, nicht das Verhalten im Browser (das übernimmt
// tools/browser-probe/ bzw. der echte Klickdurchgang).

test('IK-Geschwisterfeld wird per Namenskonvention gesucht (<id>Ik), kein neuer Dashboard-Aufruf nötig', () => {
  assert.match(quelle, /getElementById\(\s*inputEl\.id\s*\+\s*['"]Ik['"]\s*\)/,
    'dashboard.js darf nicht wachsen — die Verknüpfung muss hier im Modul über die ID-Konvention laufen.');
});

test('Autofill überschreibt nie einen vorhandenen Wert (OCR/Handkorrektur bleibt stehen)', () => {
  const treffer = quelle.match(/onSelect:\s*k\s*=>\s*\{[\s\S]{0,200}?\}/);
  assert.ok(treffer, 'onSelect-Handler nicht gefunden');
  assert.match(treffer[0], /!ikEl\.value/,
    'Ohne diese Bedingung würde jede Kassenauswahl eine bereits eingetragene IK stillschweigend ersetzen.');
});

// ── Ops #300: IK eintippen findet die Kasse (Konsey 21.09.2026, Lieferung 2) ──
//
// Warum eine zweite Quelle: der Podologe tippt die IK von Muster 13 — das ist die
// KARTEN-IK. Die steht nur in `kostentraeger` (eigene Zeile, die per
// `abrechnender_kt_ik` auf die abrechnende IK verweist), nicht in
// `krankenkassen.ik_number` (dort steht die abrechnende IK). Beispiel DAK:
// Karte 100167999 → abgerechnet wird bei 105830016 (db/REGISTER.md:704).
//
// Getestet werden nur die reinen Funktionen — ohne Netz, ohne DB. Welche Zeilen
// überhaupt Kassen sind (ohne Rechenzentren), entscheidet die View
// `kostentraeger_auswahl`, nicht diese Funktionen.
//
// Die neuen Funktionen gibt es beim Schreiben der Tests noch nicht. Über den
// Namensraum-Import schlägt deshalb nur der jeweilige Test fehl (mit klarer
// Meldung), nicht das Laden der ganzen Datei — die alten Tests bleiben grün.

const fn = name => {
  assert.equal(typeof suche[name], 'function', `${name}() fehlt in module/krankenkasse-suche.js`);
  return suche[name];
};

// Zeilen so, wie die View sie liefert (Spaltennamen der Tabelle kostentraeger).
const ktZeilen = [
  { ik: '105313145', name: 'AOK Hessen',      kurzname: 'AOK Hessen', abrechnender_kt_ik: null },
  { ik: '105830016', name: 'DAK-Gesundheit',  kurzname: 'DAK',        abrechnender_kt_ik: null },
  { ik: '100167999', name: 'DAK-Gesundheit',  kurzname: 'DAK',        abrechnender_kt_ik: '105830016' },
  { ik: '104926702', name: 'DIE BERGISCHE KRANKENKASSE', kurzname: null, abrechnender_kt_ik: null },
];

test('IK-Eingabe: nur Ziffern, ab 3 Stellen — Leerzeichen und Punkte werden entfernt', () => {
  const ikAusEingabe = fn('ikAusEingabe');
  assert.equal(ikAusEingabe('105830016'), '105830016');
  assert.equal(ikAusEingabe('1058'), '1058');
  assert.equal(ikAusEingabe('105'), '105');
  assert.equal(ikAusEingabe('105 830 016'), '105830016');
  assert.equal(ikAusEingabe('105.830.016'), '105830016');
  assert.equal(ikAusEingabe('  1058  '), '1058');
});

test('IK-Eingabe: zu kurz („1", „10") löst keine IK-Suche aus', () => {
  // 1.020 von 1.043 IK beginnen mit „10" — bei zwei Stellen ist der Präfix als
  // Filter wertlos (gkv-302, Konsey 21.09.2026). Ab drei Stellen sucht die IK-Suche
  // (Entscheidung Melih 21.09.2026, statt der empfohlenen vier); der größte
  // Dreier-Präfix „108" hat 189 Treffer, der größte Vierer-Präfix „1080" 86.
  const ikAusEingabe = fn('ikAusEingabe');
  for (const q of ['', ' ', '1', '10', '1 0']) {
    assert.equal(ikAusEingabe(q), null, `„${q}" darf keine IK-Suche auslösen`);
  }
});

test('IK-Eingabe: Namen und Mischformen sind keine IK', () => {
  // „AOK 105" meint einen Namen — die Namenssuche bleibt zuständig.
  const ikAusEingabe = fn('ikAusEingabe');
  for (const q of ['AOK 105', 'AOK', 'TK', '10a58', 'BKK 24 plus', null, undefined]) {
    assert.equal(ikAusEingabe(q), null, `„${q}" ist keine reine Ziffernfolge`);
  }
});

test('ganze Karten-IK tippen findet die Kasse — Name aus der Zeile, IK aufgelöst', () => {
  // Der Kernfall aus Ops #300. Auf der Karte steht 100167999, im Feld soll
  // danach die abrechnende IK 105830016 stehen (Konsey-Entscheidung).
  const r = fn('sucheKostentraeger')(ktZeilen, '100167999');
  assert.equal(r.length, 1);
  assert.equal(r[0].name, 'DAK-Gesundheit');
  assert.equal(r[0].kartenIk, '100167999');
  assert.equal(r[0].ik, '105830016');
});

test('Anfang der IK reicht (Präfix), gefunden wird nur am Anfang — nicht mittendrin', () => {
  const sucheKostentraeger = fn('sucheKostentraeger');
  assert.deepEqual(sucheKostentraeger(ktZeilen, '1058').map(k => k.kartenIk), ['105830016']);
  assert.deepEqual(sucheKostentraeger(ktZeilen, '1001').map(k => k.kartenIk), ['100167999']);
  assert.deepEqual(sucheKostentraeger(ktZeilen, '5830'), [], '„5830" steht mitten in 105830016 — kein Treffer');
});

test('Kasse, die selbst abrechnet: aufgelöste IK ist ihre eigene', () => {
  const r = fn('sucheKostentraeger')(ktZeilen, '105313145');
  assert.equal(r.length, 1);
  assert.equal(r[0].kartenIk, '105313145');
  assert.equal(r[0].ik, '105313145');
});

test('Treffer sind nach IK sortiert — nicht nach Häufigkeit oder Name', () => {
  // Mehrere Treffer mit gleichem Präfix: aufsteigend nach IK, egal wie die
  // Zeilen ankommen und wie die Namen alphabetisch stehen (Z vor A hier).
  const mehr = [
    { ik: '108000030', name: 'C', kurzname: null, abrechnender_kt_ik: null },
    { ik: '108000010', name: 'Z', kurzname: null, abrechnender_kt_ik: null },
    { ik: '108000020', name: 'A', kurzname: null, abrechnender_kt_ik: null },
  ];
  assert.deepEqual(fn('sucheKostentraeger')(mehr, '1080').map(k => k.kartenIk),
    ['108000010', '108000020', '108000030']);
});

test('Trefferzeile hat dieselbe Form wie eine Kasse aus der Namenssuche', () => {
  // attachKrankenkasseSuche() rendert und wählt beide Quellen mit demselben Code
  // (renderItem/onSelect/toText): name, kurz, ik, typ, anzahl müssen da sein.
  const [k] = fn('sucheKostentraeger')(ktZeilen, '100167999');
  assert.equal(k.kurz, 'DAK');
  assert.equal(k.typ, 'gesetzlich');
  assert.equal(k.anzahl, 0);
  assert.equal(k.quelle, 'kostentraeger');
  const [ohneKurz] = fn('sucheKostentraeger')(ktZeilen, '104926702');
  assert.equal(ohneKurz.kurz, null);
});

test('sucheKostentraeger: Name, Kürzel und zu kurze Ziffern liefern nichts', () => {
  // Die Namenssuche bleibt bei sucheKassen(); diese Funktion ist nur die IK-Suche.
  const sucheKostentraeger = fn('sucheKostentraeger');
  for (const q of ['DAK', 'AOK Hessen', '10', '', null]) {
    assert.deepEqual(sucheKostentraeger(ktZeilen, q), [], `„${q}"`);
  }
});

test('sucheKostentraeger: Leerzeichen/Punkte in der IK, kaputte Zeilen, Limit', () => {
  const sucheKostentraeger = fn('sucheKostentraeger');
  assert.deepEqual(sucheKostentraeger(ktZeilen, '105 830 016').map(k => k.kartenIk), ['105830016']);
  assert.deepEqual(sucheKostentraeger(ktZeilen, '105.830.016').map(k => k.kartenIk), ['105830016']);
  // Eine Zeile ohne IK (Datenfehler) darf die Suche nicht zum Absturz bringen.
  const kaputt = [{ ik: null, name: 'X', kurzname: null, abrechnender_kt_ik: null }, ...ktZeilen];
  assert.deepEqual(sucheKostentraeger(kaputt, '1058').map(k => k.kartenIk), ['105830016']);
  // Limit greift.
  const viele = Array.from({ length: 200 }, (_, i) =>
    ({ ik: `1080${String(i).padStart(5, '0')}`, name: `Kasse ${i}`, kurzname: null, abrechnender_kt_ik: null }));
  assert.equal(sucheKostentraeger(viele, '1080', 30).length, 30);
});

test('Vorgabe schneidet den größten Präfix nicht ab — „108" hat im Seed 189 Treffer', () => {
  // Regression-Schutz wie beim Kassenbestand oben: ein zu kleines Standard-Limit
  // schnitt hier still Kassen ab, ohne dass der Anwender es merkt.
  const viele = Array.from({ length: 189 }, (_, i) =>
    ({ ik: `108${String(i).padStart(6, '0')}`, name: `Kasse ${i}`, kurzname: null, abrechnender_kt_ik: null }));
  assert.equal(fn('sucheKostentraeger')(viele, '108').length, 189);
});

// ── Anschluss ans Feld: sucheKassenfeld(), ikAnzeige(), hinweisZeile() ──────────
//
// Ein Supabase-Doppel, das `from().select().like().order().limit()` und die
// awaitbare Kette kann — wie PostgREST: ein Präfix-`like` ('1001%') und `limit`
// werden tatsächlich angewandt, ein Fehler kommt als { data: null, error }.
function sbDoppel({ view = [], viewFehler = null, kassen = [], werfen = false } = {}) {
  const aufrufe = [];
  return {
    aufrufe,
    from(tabelle) {
      if (werfen) throw new Error('Netzwerk weg');
      const st = { tabelle, like: null, order: null, limit: null };
      aufrufe.push(st);
      const b = {
        select() { return b; }, eq() { return b; }, not() { return b; },
        order(spalte) { st.order = spalte; return b; },
        like(spalte, muster) { st.like = [spalte, muster]; return b; },
        limit(n) { st.limit = n; return b; },
        then(ok, nok) {
          let res;
          if (tabelle === 'kostentraeger_auswahl') {
            if (viewFehler) res = { data: null, error: viewFehler };
            else {
              const pre = st.like ? st.like[1].replace(/%$/, '') : '';
              res = { data: view.filter(z => z.ik.startsWith(pre)).slice(0, st.limit ?? Infinity), error: null };
            }
          } else if (tabelle === 'krankenkassen') res = { data: kassen, error: null };
          else res = { data: [], error: null };       // leads (Häufigkeit)
          return Promise.resolve(res).then(ok, nok);
        },
      };
      return b;
    },
  };
}
const tabellen = sb => sb.aufrufe.map(a => a.tabelle);
const stammKassen = [
  { name: 'BKK 24', abbreviation: null, ik_number: '104000999', type: 'gesetzlich' },
  { name: 'BKK 1058 plus', abbreviation: null, ik_number: null, type: 'gesetzlich' },
  { name: 'Techniker Krankenkasse', abbreviation: 'TK', ik_number: '101575519', type: 'gesetzlich' },
];

test('Ziffern (≥ 3) fragen NUR die View ab — Präfix, nach IK sortiert, Limit 300', async () => {
  suche.verwerfeKassenCache?.();
  const sb = sbDoppel({ view: ktZeilen, kassen: stammKassen });
  const r = await fn('sucheKassenfeld')(sb, 'mandant-1', '100167999');
  assert.deepEqual(tabellen(sb), ['kostentraeger_auswahl'], 'krankenkassen darf bei einer IK-Eingabe nicht gelesen werden');
  assert.deepEqual(sb.aufrufe[0].like, ['ik', '100167999%']);
  assert.equal(sb.aufrufe[0].order, 'ik');
  assert.equal(sb.aufrufe[0].limit, 300);
  assert.equal(r.length, 1);
  assert.equal(r[0].name, 'DAK-Gesundheit');
  assert.equal(r[0].ik, '105830016');
});

test('drei Ziffern reichen; Leerzeichen und Punkte werden vor der Abfrage entfernt', async () => {
  suche.verwerfeKassenCache?.();
  const sb = sbDoppel({ view: ktZeilen });
  const r1 = await fn('sucheKassenfeld')(sb, 'm', '100');
  assert.deepEqual(sb.aufrufe[0].like, ['ik', '100%']);
  assert.deepEqual(r1.map(k => k.kartenIk), ['100167999']);
  await fn('sucheKassenfeld')(sb, 'm', '100 167.999');
  assert.deepEqual(sb.aufrufe[1].like, ['ik', '100167999%']);
});

test('bei IK-Eingabe läuft KEINE Namenssuche — auch ein Name mit denselben Ziffern erscheint nicht', async () => {
  suche.verwerfeKassenCache?.();
  const sb = sbDoppel({ view: ktZeilen, kassen: stammKassen });
  const r = await fn('sucheKassenfeld')(sb, 'm', '1058');
  assert.ok(!r.some(k => k.name === 'BKK 1058 plus'), '„BKK 1058 plus" ist ein Name, keine IK-Treffer');
  assert.ok(!tabellen(sb).includes('krankenkassen'));
});

test('unter 3 Ziffern und bei Namen bleibt es bei der Namenssuche — die View wird nicht gefragt', async () => {
  const sucheKassenfeld = fn('sucheKassenfeld');
  suche.verwerfeKassenCache?.();
  const sb1 = sbDoppel({ view: ktZeilen, kassen: stammKassen });
  const r1 = await sucheKassenfeld(sb1, 'm1', '24');           // zwei Ziffern → Name
  assert.deepEqual(r1.map(k => k.name), ['BKK 24']);
  assert.ok(!tabellen(sb1).includes('kostentraeger_auswahl'));
  suche.verwerfeKassenCache?.();
  const sb2 = sbDoppel({ view: ktZeilen, kassen: stammKassen });
  const r2 = await sucheKassenfeld(sb2, 'm2', 'TK');
  assert.deepEqual(r2.map(k => k.name), ['Techniker Krankenkasse']);
  assert.ok(!tabellen(sb2).includes('kostentraeger_auswahl'));
});

test('fehlende View (Migration noch nicht live): leere Liste, eine Warnung, Namenssuche unberührt', async (t) => {
  suche._warnungZuruecksetzen?.();
  suche.verwerfeKassenCache?.();
  const warn = t.mock.method(console, 'warn', () => {});
  const sb = sbDoppel({ viewFehler: { message: 'relation "public.kostentraeger_auswahl" does not exist', code: '42P01' }, kassen: stammKassen });
  const sucheKassenfeld = fn('sucheKassenfeld');
  assert.deepEqual(await sucheKassenfeld(sb, 'm', '100167999'), []);
  assert.deepEqual(await sucheKassenfeld(sb, 'm', '100167998'), []);
  assert.equal(warn.mock.callCount(), 1, 'die Warnung kommt nur einmal, nicht bei jedem Tastendruck');
  assert.deepEqual((await sucheKassenfeld(sb, 'm', 'TK')).map(k => k.name), ['Techniker Krankenkasse']);
});

test('sucheKassenfeld wirft nie — attachAutocomplete fängt eine Ausnahme aus fetchItems nicht ab', async (t) => {
  suche._warnungZuruecksetzen?.();
  suche.verwerfeKassenCache?.();
  t.mock.method(console, 'warn', () => {});
  const sucheKassenfeld = fn('sucheKassenfeld');
  assert.deepEqual(await sucheKassenfeld(sbDoppel({ werfen: true }), 'm', '100167999'), []);
  assert.deepEqual(await sucheKassenfeld(sbDoppel({ werfen: true }), 'm', 'TK'), []);
});

test('ikAnzeige: Karte → abrechnende IK, sonst die IK der Zeile', () => {
  const ikAnzeige = fn('ikAnzeige');
  assert.equal(ikAnzeige({ quelle: 'kostentraeger', kartenIk: '100167999', ik: '105830016' }), 'IK 100167999 → 105830016');
  assert.equal(ikAnzeige({ quelle: 'kostentraeger', kartenIk: '105313145', ik: '105313145' }), 'IK 105313145');
  assert.equal(ikAnzeige({ name: 'X', ik: '101575519', anzahl: 3 }), 'IK 101575519');
  assert.equal(ikAnzeige({ name: 'Y', ik: null, anzahl: 0 }), '');
});

test('hinweisZeile: „Karte X → rechnet ab bei Y" bleibt nach der Auswahl stehen (de/en/tr)', () => {
  const hinweisZeile = fn('hinweisZeile');
  const dak = { quelle: 'kostentraeger', kartenIk: '100167999', ik: '105830016' };
  const de = hinweisZeile(dak, '', 'de');
  assert.match(de, /100167999/); assert.match(de, /105830016/); assert.match(de, /rechnet ab/);
  const en = hinweisZeile(dak, '', 'en');
  const tr = hinweisZeile(dak, '', 'tr');
  assert.notEqual(en, de); assert.notEqual(tr, de);
  for (const s of [en, tr]) { assert.match(s, /100167999/); assert.match(s, /105830016/); }
  assert.equal(hinweisZeile(dak, '', 'fr'), de, 'unbekannte Sprache fällt auf Deutsch zurück');
  assert.equal(hinweisZeile(dak, '', undefined), de);
});

test('hinweisZeile: kein Hinweis, wenn Karte und Abrechnung dieselbe IK sind oder nichts Besonderes passiert', () => {
  const hinweisZeile = fn('hinweisZeile');
  assert.equal(hinweisZeile({ quelle: 'kostentraeger', kartenIk: '105313145', ik: '105313145' }, '', 'de'), '');
  assert.equal(hinweisZeile({ name: 'TK', ik: '101575519', anzahl: 3 }, '', 'de'), '', 'Namenstreffer, Feld war leer');
  assert.equal(hinweisZeile(null, '', 'de'), '');
  assert.equal(hinweisZeile({ name: 'Y', ik: null }, '', 'de'), '');
});

test('hinweisZeile: gefülltes Feld wird nicht überschrieben — die Abweichung wird sichtbar (Konsey)', () => {
  const hinweisZeile = fn('hinweisZeile');
  const dak = { quelle: 'kostentraeger', kartenIk: '100167999', ik: '105830016' };
  const s = hinweisZeile(dak, '101570104', 'de');           // z. B. von OCR gesetzt
  assert.match(s, /101570104/); assert.match(s, /105830016/); assert.match(s, /nicht überschrieben/i);
  assert.equal(hinweisZeile(dak, '105830016', 'de'), hinweisZeile(dak, '', 'de'),
    'steht schon dieselbe IK im Feld, gibt es nichts zu warnen — nur die Auflösung');
  assert.match(hinweisZeile({ name: 'TK', ik: '101575519' }, '999999999', 'de'), /999999999/,
    'gilt auch für Treffer aus der Namenssuche');
});

test('Anschluss: fetchItems ruft sucheKassenfeld, der Hinweis wird mit textContent gesetzt (kein innerHTML)', () => {
  assert.match(quelle, /fetchItems:\s*query\s*=>\s*sucheKassenfeld\(\s*sb\s*,\s*ownerId\(\)\s*,\s*query\s*\)/,
    'attachKrankenkasseSuche muss die Ziffern-Weiche in sucheKassenfeld() benutzen');
  const start = quelle.indexOf('function zeigeIkHinweis');
  assert.ok(start > 0, 'zeigeIkHinweis nicht gefunden');
  const rumpf = quelle.slice(start, start + 900);
  assert.match(rumpf, /textContent\s*=/);
  assert.doesNotMatch(rumpf, /innerHTML/, 'IKs kommen aus der Datenbank — kein innerHTML für den Hinweis');
});

test('aufgeloesteIk: abrechnende IK, sonst die eigene', () => {
  const aufgeloesteIk = fn('aufgeloesteIk');
  assert.equal(aufgeloesteIk({ ik: '100167999', abrechnender_kt_ik: '105830016' }), '105830016');
  assert.equal(aufgeloesteIk({ ik: '105830016', abrechnender_kt_ik: null }), '105830016');
  assert.equal(aufgeloesteIk({ ik: '105830016' }), '105830016');
  // Leerer String zählt als „fehlt": eine leere IK im Feld wäre schlechter als die eigene.
  assert.equal(aufgeloesteIk({ ik: '105830016', abrechnender_kt_ik: '' }), '105830016');
});
