// Auflösung der Datenannahmestelle — Fallback-Kette (Ops #283).
//   node --test api-backend/billing/kostentraeger/annahmestelle.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  waehleAnnahmestelle,
  abrechnungscodeKette,
  kassenartAusQuelle,
  ELEKTRONISCHE_DATENLIEFERUNG,
  VERKNUEPFUNGSART_KETTE,
  waehlePapierannahmestelle,
  ladePapierannahmestelle,
  PAPIER_DATENLIEFERUNG,
} from './annahmestelle.js';

// Eine VKG-Zeile, wie sie in kostentraeger_annahmestellen steht.
const zeile = (partner_ik, abrechnungscode, opt = {}) => ({
  partner_ik,
  abrechnungscode,
  verknuepfungsart:   opt.va  ?? '03',
  art_datenlieferung: opt.adl ?? '07',
  bundesland:         opt.bl  ?? '',
});

const podoKette = abrechnungscodeKette('podologie', '71');
const physKette = abrechnungscodeKette('physiotherapy', '22');

// --- T9: der spezifische Code gewinnt ------------------------------------

test('T9: Podologie nimmt 71/72, obwohl 99 und 00 danebenstehen', () => {
  const t = waehleAnnahmestelle([
    zeile('100000001', '00'),
    zeile('100000002', '99'),
    zeile('100000003', '71'),
  ], { ketten: podoKette });

  assert.equal(t.partnerIk, '100000003');
  assert.equal(t.abrechnungscode, '71');
  assert.equal(t.stufe, 0);
});

test('T9b: 72 zaehlt gleichwertig zu 71 (dieselbe Stufe)', () => {
  const t = waehleAnnahmestelle([zeile('100000009', '72'), zeile('100000001', '00')],
    { ketten: podoKette });
  assert.equal(t.partnerIk, '100000009');
  assert.equal(t.stufe, 0);
});

test('T9c: Physio nimmt den eigenen Code vor dem Gruppenschluessel 20', () => {
  const t = waehleAnnahmestelle([
    zeile('100000001', '20'),
    zeile('100000004', '22'),
  ], { ketten: physKette });
  assert.equal(t.partnerIk, '100000004');
  assert.equal(t.abrechnungscode, '22');
});

// --- T10: Abstieg in der Kette -------------------------------------------

test('T10: ohne 71/72 faellt die Podologie auf 99 — NICHT auf 20', () => {
  const t = waehleAnnahmestelle([
    zeile('100000005', '20'),   // Gruppenschluessel Heilmittel — deckt Podologie nicht
    zeile('100000006', '99'),
    zeile('100000007', '00'),
  ], { ketten: podoKette });

  assert.equal(t.partnerIk, '100000006', 'muss 99 nehmen, nicht die 20');
  assert.equal(t.abrechnungscode, '99');
  assert.equal(t.stufe, 1);
});

test('T10b: ohne 71/72/99 bleibt der Sammelschluessel 00', () => {
  const t = waehleAnnahmestelle([zeile('100000005', '20'), zeile('100000007', '00')],
    { ketten: podoKette });
  assert.equal(t.partnerIk, '100000007');
  assert.equal(t.stufe, 2);
});

test('T10c: die 20 allein macht die Podologie NICHT aufloesbar', () => {
  const t = waehleAnnahmestelle([zeile('100000005', '20')], { ketten: podoKette });
  assert.equal(t, null, 'Anhang 03 §8.14 Fussnote 4 — 20 deckt 71/72 nicht ab');
});

test('T10d: Physio steigt eigener Code -> 20 -> 99 -> 00 ab', () => {
  const stufen = [
    [[zeile('1', '22'), zeile('2', '20'), zeile('3', '99'), zeile('4', '00')], '1', 0],
    [[zeile('2', '20'), zeile('3', '99'), zeile('4', '00')],                   '2', 1],
    [[zeile('3', '99'), zeile('4', '00')],                                     '3', 2],
    [[zeile('4', '00')],                                                       '4', 3],
  ];
  for (const [zeilen, erwartet, stufe] of stufen) {
    const t = waehleAnnahmestelle(zeilen, { ketten: physKette });
    assert.equal(t.partnerIk, erwartet);
    assert.equal(t.stufe, stufe);
  }
});

// --- Verknuepfungsart -----------------------------------------------------

test('03 schlaegt 02, auch wenn 02 den spezifischeren Code traegt', () => {
  const t = waehleAnnahmestelle([
    zeile('100000010', '71', { va: '02' }),
    zeile('100000011', '00', { va: '03' }),
  ], { ketten: podoKette });

  assert.equal(t.partnerIk, '100000011');
  assert.equal(t.verknuepfungsart, '03');
});

test('ohne jede 03-Zeile faellt die Auswahl auf 02', () => {
  const t = waehleAnnahmestelle([zeile('100000010', '71', { va: '02' })],
    { ketten: podoKette });
  assert.equal(t.partnerIk, '100000010');
  assert.equal(t.verknuepfungsart, '02');
});

test('Papierannahmestelle (09) und Verweis (01) zaehlen nie', () => {
  for (const va of ['09', '01']) {
    assert.equal(waehleAnnahmestelle([zeile('100000012', '71', { va })], { ketten: podoKette }),
      null, `Verknuepfungsart ${va} darf keine Datenannahmestelle sein`);
  }
  assert.deepEqual(VERKNUEPFUNGSART_KETTE, ['03', '02']);
});

// --- Art der Datenlieferung ----------------------------------------------

test('nur 07 und 30 gelten als elektronisch', () => {
  assert.deepEqual([...ELEKTRONISCHE_DATENLIEFERUNG], ['07', '30']);
  for (const adl of ['21', '24', '26', '28', '29']) {
    assert.equal(waehleAnnahmestelle([zeile('100000013', '71', { adl })], { ketten: podoKette }),
      null, `art_datenlieferung ${adl} ist Papier`);
  }
  assert.ok(waehleAnnahmestelle([zeile('100000014', '71', { adl: '30' })], { ketten: podoKette }));
});

// --- Bundesland -----------------------------------------------------------

test('landesunabhaengig ist der LEERE STRING, nicht NULL', () => {
  // Die Spalte ist NOT NULL DEFAULT '' — wer hier auf NULL prueft, trifft nichts.
  const t = waehleAnnahmestelle([zeile('100000015', '71', { bl: '' })], { ketten: podoKette });
  assert.equal(t.partnerIk, '100000015');
});

test('99 gilt ebenfalls landesunabhaengig', () => {
  const t = waehleAnnahmestelle([zeile('100000016', '71', { bl: '99' })], { ketten: podoKette });
  assert.equal(t.partnerIk, '100000016');
});

test('eine landesspezifische Zeile zaehlt nur beim passenden Land', () => {
  const zeilen = [zeile('100000017', '71', { bl: '05' })];
  assert.equal(waehleAnnahmestelle(zeilen, { ketten: podoKette }), null,
    'ohne bekanntes Land darf die landesspezifische Zeile nicht gezogen werden');
  assert.equal(waehleAnnahmestelle(zeilen, { ketten: podoKette, bundeslandVkg: '05' }).partnerIk,
    '100000017');
  assert.equal(waehleAnnahmestelle(zeilen, { ketten: podoKette, bundeslandVkg: '01' }), null);
});

// --- T11: nicht aufloesbar -----------------------------------------------

test('T11: kein brauchbares Segment -> null (der Aufrufer muss 412 antworten)', () => {
  assert.equal(waehleAnnahmestelle([], { ketten: podoKette }), null);
  assert.equal(waehleAnnahmestelle(null, { ketten: podoKette }), null);
  assert.equal(waehleAnnahmestelle([
    zeile('100000018', '71', { va: '09' }),      // Papierannahmestelle
    zeile('100000019', '71', { adl: '21' }),     // Papier-Datenlieferung
    zeile('100000020', '05'),                    // Code ausserhalb jeder Stufe
  ], { ketten: podoKette }), null);
});

// --- Mehrdeutigkeit -------------------------------------------------------

test('zwei Empfaenger auf der 00-Stufe werden gemeldet, nicht geworfen', () => {
  const t = waehleAnnahmestelle([
    zeile('103411401', '00'),
    zeile('104212516', '00'),
  ], { ketten: podoKette });

  assert.ok(t, 'die Datei muss trotzdem rausgehen koennen');
  assert.equal(t.kandidaten, 2, 'aber die Mehrdeutigkeit bleibt sichtbar');
  assert.equal(t.partnerIk, '103411401');
});

test('dieselbe IK mehrfach ist NICHT mehrdeutig', () => {
  const t = waehleAnnahmestelle([zeile('661430035', '71'), zeile('661430035', '71', { adl: '30' })],
    { ketten: podoKette });
  assert.equal(t.kandidaten, 1);
});

// --- Kettenaufbau ---------------------------------------------------------

test('abrechnungscodeKette: Podologie ueberspringt die 20', () => {
  assert.deepEqual(abrechnungscodeKette('podologie', '71'), [['71', '72'], ['99'], ['00']]);
  assert.ok(!abrechnungscodeKette('podologie', '71').flat().includes('20'));
});

test('abrechnungscodeKette: Physio/Ergo/Logo behalten die 20', () => {
  assert.deepEqual(abrechnungscodeKette('physiotherapy', '22'), [['22'], ['20'], ['99'], ['00']]);
  assert.deepEqual(abrechnungscodeKette('ergotherapie', '25'), [['25'], ['20'], ['99'], ['00']]);
  assert.deepEqual(abrechnungscodeKette('logopaedie', '27'), [['27'], ['20'], ['99'], ['00']]);
});

test('abrechnungscodeKette: ohne eigenen Code faellt die erste Stufe weg', () => {
  assert.deepEqual(abrechnungscodeKette('physiotherapy', null), [['20'], ['99'], ['00']]);
});

// --- Kassenart (zweite Haelfte der Dateieinheit) --------------------------

test('kassenartAusQuelle liest die ersten zwei Zeichen des Dateinamens', () => {
  const erwartet = {
    'AO05Q326_KE3.txt': 'AO', 'EK05Q226_KE0.txt': 'EK', 'BK05Q326_KE1.txt': 'BK',
    'IK05Q326_KE1.txt': 'IK', 'BN050526_KE0.txt': 'BN', 'LK05Q226_KE0.txt': 'LK',
  };
  for (const [quelle, kassenart] of Object.entries(erwartet)) {
    assert.equal(kassenartAusQuelle(quelle), kassenart);
  }
});

test('kassenartAusQuelle raet NICHT — Unbekanntes ergibt null', () => {
  for (const q of [null, undefined, '', '  ', 'irgendwas.txt', 'XX05Q326.txt', '05Q326']) {
    assert.equal(kassenartAusQuelle(q), null, `"${q}" darf keine Kassenart ergeben`);
  }
});

test('die Auswahl liefert die Kassenart mit', () => {
  const t = waehleAnnahmestelle(
    [{ ...zeile('661430035', '71'), quelle: 'EK05Q226_KE0.txt' }], { ketten: podoKette });
  assert.equal(t.kassenart, 'EK');
});

test('fehlende quelle macht die Auswahl nicht kaputt, nur die Kassenart null', () => {
  const t = waehleAnnahmestelle([zeile('661430035', '71')], { ketten: podoKette });
  assert.equal(t.partnerIk, '661430035');
  assert.equal(t.kassenart, null);
});

// ── waehlePapierannahmestelle (VKG 09) ───────────────────────────────────────

// Hilfsfunktion analog zu zeile(), aber fuer Papier-VKG-Zeilen.
const papierZeile = (partner_ik, abrechnungscode, opt = {}) => ({
  partner_ik,
  abrechnungscode,
  verknuepfungsart:   '09',
  art_datenlieferung: opt.adl ?? '28',   // 28 = Papier (unbelegt, Praxiserfahrung)
  bundesland:         opt.bl  ?? '',
});

test('P1: VKG-09 mit Papier-Datenlieferung wird als Papierannahmestelle gewaehlt', () => {
  const t = waehlePapierannahmestelle(
    [papierZeile('661430035', '71')],
    { ketten: podoKette }
  );
  assert.ok(t, 'Papierannahmestelle muss gefunden werden');
  assert.equal(t.partnerIk, '661430035');
  assert.equal(t.abrechnungscode, '71');
});

test('P2: elektronische art_datenlieferung (07, 30) auf einer VKG-09-Zeile wird NICHT gewaehlt', () => {
  // Der elektronische Kanal laeuft ueber VKG 02/03 — eine VKG-09-Zeile mit
  // art_datenlieferung 07 waere ein Datenfehler in der Kostentraegerdatei.
  // Die Funktion muss sie dennoch sicher ignorieren.
  for (const adl of ['07', '30']) {
    const t = waehlePapierannahmestelle(
      [{ ...papierZeile('661430035', '71'), art_datenlieferung: adl }],
      { ketten: podoKette }
    );
    assert.equal(t, null, `art_datenlieferung ${adl} ist elektronisch und darf nicht als Papier gewaehlt werden`);
  }
  // Die Liste der Papier-Werte ist definiert.
  assert.deepEqual([...PAPIER_DATENLIEFERUNG], ['21', '24', '26', '28', '29']);
});

test('P3: Podologie nimmt 71/72 vor 99 vor 00 (dieselbe Kette wie elektronisch)', () => {
  const zeilen = [
    papierZeile('100000001', '00'),
    papierZeile('100000002', '99'),
    papierZeile('100000003', '71'),
  ];
  const t = waehlePapierannahmestelle(zeilen, { ketten: podoKette });
  assert.equal(t.partnerIk, '100000003');
  assert.equal(t.abrechnungscode, '71');
  assert.equal(t.stufe, 0);
});

test('P3b: 71/72 fehlen → Fallback auf 99', () => {
  const t = waehlePapierannahmestelle(
    [papierZeile('100000006', '99'), papierZeile('100000007', '00')],
    { ketten: podoKette }
  );
  assert.equal(t.partnerIk, '100000006');
  assert.equal(t.stufe, 1);
});

test('P3c: Podologie-Kette ueberspringt die 20 (Anhang 03 §8.14 Fussnote 4)', () => {
  const t = waehlePapierannahmestelle(
    [papierZeile('100000005', '20')],
    { ketten: podoKette }
  );
  assert.equal(t, null, '20 deckt Podologie auch beim Papierweg nicht ab');
});

test('P4: Bundesland-Filter funktioniert wie bei waehleAnnahmestelle', () => {
  const zeilen = [papierZeile('100000017', '71', { bl: '05' })];
  // Ohne Bundeslandangabe → nicht gewaehlt.
  assert.equal(waehlePapierannahmestelle(zeilen, { ketten: podoKette }), null,
    'landesspezifische Zeile darf ohne bekanntes Land nicht gezogen werden');
  // Mit passendem Bundesland → gewaehlt.
  assert.equal(
    waehlePapierannahmestelle(zeilen, { ketten: podoKette, bundeslandVkg: '05' }).partnerIk,
    '100000017'
  );
  // Mit anderem Bundesland → nicht gewaehlt.
  assert.equal(waehlePapierannahmestelle(zeilen, { ketten: podoKette, bundeslandVkg: '01' }), null);
});

test('P5: keine passende Zeile → null', () => {
  assert.equal(waehlePapierannahmestelle([], { ketten: podoKette }), null);
  assert.equal(waehlePapierannahmestelle(null, { ketten: podoKette }), null);
  // VKG-02-Zeile darf nicht als Papierannahmestelle zaehlen.
  assert.equal(
    waehlePapierannahmestelle(
      [{ ...papierZeile('661430035', '71'), verknuepfungsart: '02' }],
      { ketten: podoKette }
    ),
    null
  );
});

test('IKK-Realbeispiel: VKG 09 + abrechnungscode 71/72 → 661430035, 99 → 100202549', () => {
  // Aus IK05Q326_KE1.txt, IDK+100202549 (IKK - Die Innovationskasse).
  // VKG+09+661430035+5++28++++71 und +72, VKG+09+100202549+5++28++++99
  const zeilen = [
    papierZeile('661430035', '71'),
    papierZeile('661430035', '72'),
    papierZeile('100202549', '99'),
  ];
  const t71 = waehlePapierannahmestelle(zeilen, { ketten: podoKette });
  assert.equal(t71.partnerIk, '661430035', 'Podologie-Code 71 muss zu IQVIA HSS fuehren');
  assert.equal(t71.stufe, 0);

  // Mit Kette ohne 71/72 → faellt auf 99 = IKK selbst.
  const kette99 = abrechnungscodeKette('podologie', null).filter((_, i) => i > 0);
  const t99 = waehlePapierannahmestelle(zeilen, { ketten: kette99 });
  assert.equal(t99.partnerIk, '100202549');
});

// ── ladePapierannahmestelle mit Anschrift-Auflösung (§302 Schritt 1.4) ────────

// Erzeugt einen leichtgewichtigen Mock für Supabase, der exakt die von
// ladePapierannahmestelle() aufgerufenen Tabellen und Methoden bedient.
function erzeugeMockSupabase({
  annahmestellen = [],
  kostentraeger = [],
  anschriften = [],
  wirfFehlerTabelle = null,
  datenFehlerTabelle = null,
} = {}) {
  const aufrufe = [];
  return {
    aufrufe,
    from(tabelle) {
      return {
        select(spalten) {
          return {
            eq(feld, wert) {
              aufrufe.push({ tabelle, spalten, feld, wert });

              if (wirfFehlerTabelle === tabelle) {
                throw new Error(`Simulierter Verbindungs-/DB-Fehler fuer Tabelle ${tabelle}`);
              }
              if (datenFehlerTabelle === tabelle) {
                return Promise.resolve({
                  data: null,
                  error: { message: `relation "${tabelle}" does not exist` },
                });
              }

              if (tabelle === 'kostentraeger_annahmestellen') {
                const zeilen = annahmestellen.filter(z => z[feld] === wert);
                return Promise.resolve({ data: zeilen, error: null });
              }

              if (tabelle === 'kostentraeger') {
                return {
                  maybeSingle: async () => {
                    const treffer = kostentraeger.find(k => k[feld] === wert);
                    return { data: treffer || null, error: null };
                  },
                };
              }

              if (tabelle === 'kostentraeger_anschriften') {
                const zeilen = anschriften.filter(a => a[feld] === wert);
                return Promise.resolve({ data: zeilen, error: null });
              }

              return Promise.resolve({ data: [], error: null });
            },
          };
        },
      };
    },
  };
}

test('L1: ladePapierannahmestelle() liefert die Anschrift mit und waehlt nach 1 > 2 > 3', async () => {
  const supabase = erzeugeMockSupabase({
    annahmestellen: [
      {
        kostentraeger_ik: '100000001',
        partner_ik: '661430035',
        verknuepfungsart: '09',
        art_datenlieferung: '28',
        abrechnungscode: '71',
        bundesland: '',
      },
    ],
    kostentraeger: [
      { ik: '661430035', name: 'IQVIA Health System Services GmbH' },
    ],
    anschriften: [
      { kostentraeger_ik: '661430035', art: '3', plz: '04310', ort: 'Leipzig', strasse: '' },
      { kostentraeger_ik: '661430035', art: '1', plz: '04425', ort: 'Taucha', strasse: 'Gaertnerweg 12' },
      { kostentraeger_ik: '661430035', art: '2', plz: '42100', ort: 'Wuppertal', strasse: '' },
    ],
  });

  const res = await ladePapierannahmestelle(supabase, {
    kostentraegerIk: '100000001',
    bereich: 'podologie',
  });

  assert.equal(res.ok, true);
  assert.equal(res.ik, '661430035');
  assert.equal(res.name, 'IQVIA Health System Services GmbH');
  assert.ok(res.anschrift, 'Anschrift muss vorhanden sein');
  assert.equal(res.anschrift.art, '1', 'Hausanschrift (1) muss Vorrang vor Postfach (2) und Grosskunde (3) haben');
  assert.equal(res.anschrift.plz, '04425');
  assert.equal(res.anschrift.ort, 'Taucha');
  assert.equal(res.anschrift.strasse, 'Gaertnerweg 12');
});

test('L2: keine Anschriften vorhanden → ok: true und anschrift: null (Abrechnung darf nicht scheitern)', async () => {
  const supabase = erzeugeMockSupabase({
    annahmestellen: [
      {
        kostentraeger_ik: '100000001',
        partner_ik: '661430035',
        verknuepfungsart: '09',
        art_datenlieferung: '28',
        abrechnungscode: '71',
        bundesland: '',
      },
    ],
    kostentraeger: [
      { ik: '661430035', name: 'IQVIA Health System Services GmbH' },
    ],
    anschriften: [],
  });

  const res = await ladePapierannahmestelle(supabase, {
    kostentraegerIk: '100000001',
    bereich: 'podologie',
  });

  assert.equal(res.ok, true, 'Fehlende Anschrift darf die Abrechnung nicht anhalten');
  assert.equal(res.ik, '661430035');
  assert.equal(res.anschrift, null);
});

test('L3: Fehler oder fehlende Tabelle beim Adress-Select → ebenfalls ok: true und anschrift: null', async () => {
  // Fall 3a: Tabelle existiert noch nicht vor Migration (Supabase liefert error-Objekt)
  const supabaseFehler = erzeugeMockSupabase({
    annahmestellen: [
      {
        kostentraeger_ik: '100000001',
        partner_ik: '661430035',
        verknuepfungsart: '09',
        art_datenlieferung: '28',
        abrechnungscode: '71',
        bundesland: '',
      },
    ],
    kostentraeger: [
      { ik: '661430035', name: 'IQVIA Health System Services GmbH' },
    ],
    datenFehlerTabelle: 'kostentraeger_anschriften',
  });

  const res3a = await ladePapierannahmestelle(supabaseFehler, {
    kostentraegerIk: '100000001',
    bereich: 'podologie',
  });

  assert.equal(res3a.ok, true, 'DB-Fehler bei Adress-Tabelle darf Abrechnung nicht stoppen');
  assert.equal(res3a.ik, '661430035');
  assert.equal(res3a.anschrift, null);

  // Fall 3b: Query wirft Exception (Netzwerk- oder Client-Fehler)
  const supabaseWurf = erzeugeMockSupabase({
    annahmestellen: [
      {
        kostentraeger_ik: '100000001',
        partner_ik: '661430035',
        verknuepfungsart: '09',
        art_datenlieferung: '28',
        abrechnungscode: '71',
        bundesland: '',
      },
    ],
    kostentraeger: [
      { ik: '661430035', name: 'IQVIA Health System Services GmbH' },
    ],
    wirfFehlerTabelle: 'kostentraeger_anschriften',
  });

  const res3b = await ladePapierannahmestelle(supabaseWurf, {
    kostentraegerIk: '100000001',
    bereich: 'podologie',
  });

  assert.equal(res3b.ok, true, 'Geworfene Exception darf Abrechnung nicht stoppen');
  assert.equal(res3b.ik, '661430035');
  assert.equal(res3b.anschrift, null);
});

test('L4: die Adresse wird zur Partner-IK geholt, nicht zur Kostentraeger-IK', async () => {
  const supabase = erzeugeMockSupabase({
    annahmestellen: [
      {
        kostentraeger_ik: '100000001',
        partner_ik: '661430035',
        verknuepfungsart: '09',
        art_datenlieferung: '28',
        abrechnungscode: '71',
        bundesland: '',
      },
    ],
    kostentraeger: [
      { ik: '100000001', name: 'Krankenkasse Muenchen' },
      { ik: '661430035', name: 'IQVIA Health System Services GmbH' },
    ],
    anschriften: [
      // Falsche Adresse (haengt an der Kostentraeger-IK 100000001):
      { kostentraeger_ik: '100000001', art: '1', plz: '80331', ort: 'Muenchen', strasse: 'Kassenstr. 1' },
      // Richtige Adresse (haengt an der Partner-IK / Papierannahmestelle 661430035):
      { kostentraeger_ik: '661430035', art: '1', plz: '04425', ort: 'Taucha', strasse: 'Gaertnerweg 12' },
    ],
  });

  const res = await ladePapierannahmestelle(supabase, {
    kostentraegerIk: '100000001',
    bereich: 'podologie',
  });

  assert.equal(res.ok, true);
  assert.equal(res.ik, '661430035');
  // Anschrift muss die der Papierannahmestelle (Taucha) sein, nicht die der Kasse (Muenchen)
  assert.equal(res.anschrift.plz, '04425');
  assert.equal(res.anschrift.ort, 'Taucha');
  assert.equal(res.anschrift.strasse, 'Gaertnerweg 12');

  // Pruefen, dass die DB-Abfrage tatsaechlich mit der Partner-IK erfolgte
  const adressAufruf = supabase.aufrufe.find(a => a.tabelle === 'kostentraeger_anschriften');
  assert.ok(adressAufruf, 'kostentraeger_anschriften muss abgefragt werden');
  assert.equal(adressAufruf.feld, 'kostentraeger_ik');
  assert.equal(adressAufruf.wert, '661430035', 'Abfrage muss mit partnerIk laufen, NICHT mit kostentraegerIk (100000001)');
});
