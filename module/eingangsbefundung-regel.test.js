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

// ── darf78100: Erstbefundung gross, einmal je Patient und Kalenderjahr ───────
// Anlage 1c i.d.F. 01.07.2025, Teil 1 Nr. 5 I.1. Stand bis zum 03.09.2026 nur
// als Hinweistext im Katalog — ankreuzen liess es sich beliebig oft.
import { darf78100 } from './eingangsbefundung-regel.js';

test('Patient ohne Vorgeschichte — 78100 erlaubt', () => {
  assert.equal(darf78100([], '2026-09-03').erlaubt, true);
  assert.equal(darf78100(null, '2026-09-03').erlaubt, true);
});

test('zweite 78100 im selben Kalenderjahr wird gesperrt', () => {
  const r = darf78100(
    [{ behandlungsdatum: '2026-02-10', hpnr_codes: ['78100', '78610'] }],
    '2026-11-02',
  );
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'kalenderjahr_verbraucht');
  assert.equal(r.schonAm, '2026-02-10', 'die Meldung nennt den Tag der ersten Abgabe');
});

test('am selben Tag ein zweites Mal ist ebenfalls gesperrt', () => {
  const r = darf78100(
    [{ behandlungsdatum: '2026-02-10', hpnr_codes: ['78100'] }],
    '2026-02-10',
  );
  assert.equal(r.erlaubt, false);
});

test('neues Kalenderjahr gibt den Anspruch frei — anders als bei 78040', () => {
  const behs = [{ behandlungsdatum: '2026-02-10', hpnr_codes: ['78100'] }];
  assert.equal(darf78100(behs, '2027-01-05').erlaubt, true);
  // Gegenprobe: 78040 waere hier weiterhin gesperrt, weil die Serie laeuft.
  assert.equal(darf78040(behs, '2027-01-05').erlaubt, false);
});

test('Jahresgrenze wird auf den Tag genau gezogen', () => {
  const behs = [{ behandlungsdatum: '2025-12-31', hpnr_codes: ['78100'] }];
  assert.equal(darf78100(behs, '2026-01-01').erlaubt, true);
  assert.equal(darf78100([{ behandlungsdatum: '2026-01-01', hpnr_codes: ['78100'] }], '2026-12-31').erlaubt, false);
});

test('78110 klein sperrt die grosse nicht', () => {
  const r = darf78100(
    [{ behandlungsdatum: '2026-02-10', hpnr_codes: ['78110', '78610'] }],
    '2026-11-02',
  );
  assert.equal(r.erlaubt, true, 'die Grenze gilt nur der grossen Form');
});

test('mehrere Abgaben im Jahr — gemeldet wird die frueheste', () => {
  const r = darf78100(
    [
      { behandlungsdatum: '2026-07-01', hpnr_codes: ['78100'] },
      { behandlungsdatum: '2026-02-10', hpnr_codes: ['78100'] },
    ],
    '2026-11-02',
  );
  assert.equal(r.schonAm, '2026-02-10');
});

test('kaputtes Datum sperrt nicht — lieber durchlassen als grundlos blockieren', () => {
  const behs = [{ behandlungsdatum: '2026-02-10', hpnr_codes: ['78100'] }];
  assert.equal(darf78100(behs, '').erlaubt, true);
  assert.equal(darf78100(behs, undefined).erlaubt, true);
});

test('Zeilen ohne Datum oder ohne hpnr_codes kippen nicht um', () => {
  const r = darf78100(
    [null, { behandlungsdatum: null, hpnr_codes: ['78100'] }, { behandlungsdatum: '2026-02-10' }],
    '2026-11-02',
  );
  assert.equal(r.erlaubt, true);
});

// ── Zwei Loecher, die erst beim Verdrahten weh getan haetten ─────────────────
// Beide von `fonksiyon-ustasi` beim Melden der Funktion angezeigt (03.09.2026).

test('alte Positionsnummer schweigt nicht mehr, sie nennt den Grund', () => {
  // Bei einer Beta-Praxis steht in `services.gkv_position_nr` teils noch P01/P02.
  // Vorher fiel das auf `kein_podologie_zweig` — der Podologe haette am Telefon
  // keinen Vorschlag gesehen und keinen Hinweis, warum nicht.
  for (const hpnr of ['P01', 'P02', 'P-HB', 'P03a', 'P03b', 'P03c', 'P04']) {
    const r = befundungFuerLeistung({ hpnr, behandlungen: [], datum: '2026-09-03' });
    assert.equal(r.code, null);
    assert.equal(r.grund, 'legacy_positionsnummer', `${hpnr} muss als Altlast erkannt werden`);
    assert.match(r.hinweis, new RegExp(hpnr.replace('-', '\\-')), 'die Meldung nennt die Nummer');
  }
});

test('alte Nummer wird NICHT stillschweigend auf die neue HPNR umgedeutet', () => {
  // P01 zeigt laut GKV_PODO_LEGACY_MAP auf 78020. Trotzdem darf hier kein 78040
  // herauskommen — sonst lebt die alte Nummer weiter und die Migration wird nie
  // gemacht.
  const r = befundungFuerLeistung({ hpnr: 'P01', behandlungen: [], datum: '2026-09-03' });
  assert.notEqual(r.code, '78040');
});

test('Katalogzeile erkennt eine unbekannte Nagel-Position als Nagel', () => {
  // Kaeme morgen eine neue UI1/UI2-Position dazu, kennt die feste Liste sie
  // nicht. Mit den Diagnosegruppen der Katalogzeile schweigt die Regel trotzdem
  // richtig, statt die Position fuer sektorfremd zu halten.
  const r = befundungFuerLeistung({
    hpnr: '78699', behandlungen: [], datum: '2026-09-03', diagnosegruppen: ['UI1', 'UI2'],
  });
  assert.equal(r.code, null);
  assert.equal(r.grund, 'nagelzweig');
});

test('Diagnosegruppen bremsen auch eine bekannte DF-Behandlung aus', () => {
  // Steht in der Katalogzeile UI1, gilt der Nagelzweig — auch wenn die HPNR
  // nach DF aussieht. Die Zeile ist naeher an der Wahrheit als unsere Liste.
  const r = befundungFuerLeistung({
    hpnr: '78010', behandlungen: [], datum: '2026-09-03', diagnosegruppen: ['UI1'],
  });
  assert.equal(r.grund, 'nagelzweig');
});

test('Diagnosegruppen koennen einen Vorschlag NICHT ausloesen', () => {
  // Nur die Positivliste 78010/78020 darf 78040 ausloesen. „DF" an einer
  // unbekannten Position reicht nicht — ein zu Unrecht vorgeschlagener Code
  // kostet Geld, ein fehlender kostet einen Klick.
  const r = befundungFuerLeistung({
    hpnr: '78777', behandlungen: [], datum: '2026-09-03', diagnosegruppen: ['DF', 'NF', 'QF'],
  });
  assert.equal(r.code, null);
  assert.equal(r.grund, 'kein_podologie_zweig');
});

test('DF-Katalogzeile aendert am Normalfall nichts', () => {
  const r = befundungFuerLeistung({
    hpnr: '78010', behandlungen: [], datum: '2026-09-03',
    diagnosegruppen: ['DF', 'NF', 'QF'], podologieVor2023: false,
  });
  assert.equal(r.code, '78040');
  assert.equal(r.automatisch, true);
});

test('leere, kaputte oder fehlende Diagnosegruppen fallen auf die feste Liste zurueck', () => {
  for (const dg of [null, undefined, [], [null, ''], ['  ui2  ']]) {
    const r = befundungFuerLeistung({
      hpnr: '78610', behandlungen: [], datum: '2026-09-03', diagnosegruppen: dg,
    });
    assert.equal(r.grund, 'nagelzweig', 'die feste Liste kennt 78610 ohnehin');
  }
  // Kleinschreibung und Leerzeichen werden erkannt, nicht verworfen.
  const r = befundungFuerLeistung({
    hpnr: '78699', behandlungen: [], datum: '2026-09-03', diagnosegruppen: [' ui1 '],
  });
  assert.equal(r.grund, 'nagelzweig');
});

// ── darfErstbefundungNagel: einmalig je Serie, je Nagel ─────────────────────
// § 3b lit. a) Aenderungsvereinbarung 16.06.2025. Die Serie haengt am Nagel,
// nicht an der Verordnung — jeder Fall hier ist einer, den die Kasse sonst
// absetzt oder den der Podologe zu Unrecht nicht abrechnen kann.
import { darfErstbefundungNagel, nagelLabel, NAGEL_WERTE } from './eingangsbefundung-regel.js';

test('Nagel ohne Vorgeschichte — Erstbefundung erlaubt', () => {
  const r = darfErstbefundungNagel([], 'U1 links', '2026-09-04');
  assert.equal(r.erlaubt, true);
  assert.equal(r.serieSeit, null);
});

test('ohne bekannten Nagel wird nicht gesperrt, aber der Grund steht dabei', () => {
  const behs = [{ behandlungsdatum: '2026-02-01', hpnr_codes: ['78110'] }];
  const r = darfErstbefundungNagel(behs, '', '2026-09-04');
  assert.equal(r.erlaubt, true);
  assert.equal(r.grund, 'nagel_unbekannt');
  assert.equal(darfErstbefundungNagel(behs, null, '2026-09-04').erlaubt, true);
});

test('zweite Erstbefundung in derselben laufenden Serie wird gesperrt', () => {
  const r = darfErstbefundungNagel(
    [
      { behandlungsdatum: '2026-02-01', hpnr_codes: ['78110', '78610'] },
      { behandlungsdatum: '2026-03-01', hpnr_codes: ['78610'] },
    ],
    'U1 links', '2026-09-04',
  );
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'serie_hat_erstbefundung');
  assert.equal(r.schonAm, '2026-02-01');
  assert.equal(r.schonCode, '78110');
});

test('die Sperre gilt ueber Verordnungen hinweg — Serie ist nicht die Verordnung', () => {
  // Beide Zeilen haengen an verschiedenen Verordnungen; der Aufrufer reicht
  // sie zusammen herein, weil sie denselben Nagel betreffen. Genau das ist
  // der Satz „kann mehrere Verordnungen umfassen".
  const r = darfErstbefundungNagel(
    [{ behandlungsdatum: '2026-01-15', hpnr_codes: ['78100'] }],
    'U2 rechts', '2026-08-20',
  );
  assert.equal(r.erlaubt, false);
  assert.equal(r.schonCode, '78100');
});

test('klein sperrt gross und umgekehrt — die Serienregel kennt keinen Unterschied', () => {
  const nurKlein = [{ behandlungsdatum: '2026-01-15', hpnr_codes: ['78110'] }];
  const nurGross = [{ behandlungsdatum: '2026-01-15', hpnr_codes: ['78100'] }];
  assert.equal(darfErstbefundungNagel(nurKlein, 'U1 links', '2026-05-01').erlaubt, false);
  assert.equal(darfErstbefundungNagel(nurGross, 'U1 links', '2026-05-01').erlaubt, false);
});

test('nach dem Abschluss (78520) beginnt eine neue Serie — wieder erlaubt', () => {
  const r = darfErstbefundungNagel(
    [
      { behandlungsdatum: '2026-01-15', hpnr_codes: ['78110'] },
      { behandlungsdatum: '2026-05-20', hpnr_codes: ['78610'] },
      { behandlungsdatum: '2026-06-10', hpnr_codes: ['78520'] },
    ],
    'U1 links', '2026-09-04',
  );
  assert.equal(r.erlaubt, true);
  assert.equal(r.serieSeit, '2026-06-10', 'die neue Serie beginnt mit dem Abschluss der alten');
});

test('nach dem Abschluss laeuft die neue Serie ihrerseits — zweite Sperre greift', () => {
  const r = darfErstbefundungNagel(
    [
      { behandlungsdatum: '2026-01-15', hpnr_codes: ['78110'] },
      { behandlungsdatum: '2026-06-10', hpnr_codes: ['78520'] },
      { behandlungsdatum: '2026-07-01', hpnr_codes: ['78110'] },
    ],
    'U1 links', '2026-09-04',
  );
  assert.equal(r.erlaubt, false);
  assert.equal(r.schonAm, '2026-07-01', 'gemeldet wird die Erstbefundung der LAUFENDEN Serie');
  assert.equal(r.serieSeit, '2026-06-10');
});

test('Nachtrag faellt in die alte Serie, nicht in die neue', () => {
  // Der 05.06. liegt VOR dem Abschluss vom 10.06. — die Erstbefundung vom
  // 15.01. gehoert zu derselben Serie und sperrt. Ohne obere Fenstergrenze
  // waere dieser Nachtrag faelschlich durchgegangen.
  const r = darfErstbefundungNagel(
    [
      { behandlungsdatum: '2026-01-15', hpnr_codes: ['78110'] },
      { behandlungsdatum: '2026-06-10', hpnr_codes: ['78520'] },
      { behandlungsdatum: '2026-07-01', hpnr_codes: ['78110'] },
    ],
    'U1 links', '2026-06-05',
  );
  assert.equal(r.erlaubt, false);
  assert.equal(r.schonAm, '2026-01-15');
});

test('Abschluss am selben Tag beendet die Serie erst danach', () => {
  // 78520 und eine neue Erstbefundung am gleichen Tag: der Abschluss zaehlt
  // noch zur alten Serie, die Erstbefundung davor sperrt weiterhin.
  const r = darfErstbefundungNagel(
    [
      { behandlungsdatum: '2026-01-15', hpnr_codes: ['78110'] },
      { behandlungsdatum: '2026-06-10', hpnr_codes: ['78520'] },
    ],
    'U1 links', '2026-06-10',
  );
  assert.equal(r.erlaubt, false, 'am Abschlusstag selbst laeuft die alte Serie noch');
});

test('nur die Nagelspangenbehandlung ohne Erstbefundung sperrt nicht', () => {
  const r = darfErstbefundungNagel(
    [{ behandlungsdatum: '2026-01-15', hpnr_codes: ['78610', '78620'] }],
    'U1 links', '2026-09-04',
  );
  assert.equal(r.erlaubt, true);
});

test('kaputte Eingaben kippen nicht um', () => {
  assert.equal(darfErstbefundungNagel(null, 'U1 links', '2026-09-04').erlaubt, true);
  assert.equal(darfErstbefundungNagel([null, {}], 'U1 links', '2026-09-04').erlaubt, true);
  assert.equal(darfErstbefundungNagel([], 'U1 links', '').grund, 'kein_datum');
  assert.equal(
    darfErstbefundungNagel(
      [{ behandlungsdatum: '2026-01-15' }], 'U1 links', '2026-09-04',
    ).erlaubt, true, 'Zeile ohne hpnr_codes sperrt nicht');
});

test('nagelLabel macht aus dem Vertragskuerzel Klartext', () => {
  assert.equal(nagelLabel('U1 links'), 'Großzehe links (U1)');
  assert.equal(nagelLabel('U5 rechts'), 'Kleinzehe rechts (U5)');
  assert.equal(nagelLabel('U3 links'), '3. Zehe links (U3)');
  assert.equal(nagelLabel(''), '', 'leer bleibt leer');
  assert.equal(nagelLabel('Zehe II rechts'), 'Zehe II rechts', 'Altbestand kommt roh zurueck');
});

test('NAGEL_WERTE deckt genau die zehn Vertragswerte ab', () => {
  // Spiegel des CHECK prescriptions_nagel_check — laeuft der auseinander,
  // scheitert das Speichern erst live mit einem 400er.
  assert.equal(NAGEL_WERTE.length, 10);
  for (const w of NAGEL_WERTE) assert.match(w, /^U[1-5] (links|rechts)$/);
  assert.notEqual(nagelLabel(NAGEL_WERTE[0]), NAGEL_WERTE[0], 'jeder Wert ist lesbar');
});
