import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  korrekturErlaubt,
  pruefeEingabe,
  folgenDerKorrektur,
  verrechnungsBetrag,
  KORREKTUR_GRUENDE,
} from './korrektur.js';

// --- korrekturErlaubt: der Riegel -------------------------------------------

test('offene Verordnung darf korrigiert werden', () => {
  assert.equal(korrekturErlaubt({ belegnummer: null, abrechnung_status: null }).erlaubt, true);
  assert.equal(korrekturErlaubt({ belegnummer: null, abrechnung_status: 'bereit' }).erlaubt, true);
});

test('eine vergebene Belegnummer sperrt und verweist aufs Korrekturverfahren', () => {
  const r = korrekturErlaubt({ belegnummer: '4711-3' });
  assert.equal(r.erlaubt, false);
  assert.equal(r.status, 409);
  assert.match(r.grund, /Korrekturverfahren/);
});

test('laufende Abrechnung sperrt in jedem Zwischenstatus', () => {
  for (const st of ['in_abrechnung', 'gesendet', 'accepted', 'paid']) {
    const r = korrekturErlaubt({ abrechnung_status: st });
    assert.equal(r.erlaubt, false, st);
    assert.equal(r.status, 409, st);
  }
});

test('nach einer Absetzung ist wieder offen — abrechnung_id ist kein Riegel', () => {
  // Bei der Absetzung setzt abrechnung.routes.js den Status auf 'bereit' zurueck,
  // laesst die abrechnung_id aber stehen. Haengt der Riegel an der id, ist genau
  // das Rezept gesperrt, das jetzt korrigiert werden muss.
  const rx = { abrechnung_id: 'uuid', abrechnung_status: 'bereit', belegnummer: null };
  assert.equal(korrekturErlaubt(rx).erlaubt, true);
});

test('kassierte Zuzahlung sperrt nicht — sie ist der Normalfall des Abbruchs', () => {
  const rx = { zuzahlung_kassiert_am: '2026-08-20T09:00:00Z', abrechnung_status: 'bereit' };
  assert.equal(korrekturErlaubt(rx).erlaubt, true);
});

test('fehlende Verordnung wird mit 404 abgewiesen', () => {
  const r = korrekturErlaubt(null);
  assert.equal(r.erlaubt, false);
  assert.equal(r.status, 404);
});

// --- pruefeEingabe ----------------------------------------------------------

const GUELTIG = { einheiten: 3, grund: 'Patient nach 3 Sitzungen abgebrochen', grundCode: 'abbruch' };

test('Einheiten allein reichen', () => {
  assert.equal(pruefeEingabe(GUELTIG).ok, true);
});

test('Betrag allein reicht', () => {
  assert.equal(pruefeEingabe({ betrag: 17.74, grund: 'mit Patient vereinbart', grundCode: 'korrektur_soll' }).ok, true);
});

test('ohne Einheiten und ohne Betrag gibt es nichts zu korrigieren', () => {
  const r = pruefeEingabe({ grund: 'irgendwas', grundCode: 'sonstiges' });
  assert.equal(r.ok, false);
  assert.match(r.fehler, /Weder/);
});

test('die Begruendung ist Pflicht — das ist der Unterschied zum stillen Ueberschreiben', () => {
  assert.equal(pruefeEingabe({ ...GUELTIG, grund: '' }).ok, false);
  assert.equal(pruefeEingabe({ ...GUELTIG, grund: '   ' }).ok, false);
  assert.equal(pruefeEingabe({ ...GUELTIG, grund: 'ok' }).ok, false);
  assert.equal(pruefeEingabe({ ...GUELTIG, grund: undefined }).ok, false);
});

test('null Einheiten sind erlaubt — "gar nichts erbracht" ist eine Aussage', () => {
  assert.equal(pruefeEingabe({ ...GUELTIG, einheiten: 0 }).ok, true);
});

test('negative oder gebrochene Einheiten werden abgewiesen', () => {
  assert.equal(pruefeEingabe({ ...GUELTIG, einheiten: -1 }).ok, false);
  assert.equal(pruefeEingabe({ ...GUELTIG, einheiten: 2.5 }).ok, false);
});

test('ein negativer Betrag wird abgewiesen', () => {
  assert.equal(pruefeEingabe({ betrag: -5, grund: 'test test', grundCode: 'sonstiges' }).ok, false);
});

test('ein Betrag von 0 ist erlaubt', () => {
  assert.equal(pruefeEingabe({ betrag: 0, grund: 'Befreiung lag doch vor', grundCode: 'befreiung_nachgereicht' }).ok, true);
});

test('unbekannter Grundcode wird abgewiesen', () => {
  assert.equal(pruefeEingabe({ ...GUELTIG, grundCode: 'weil_ich_kann' }).ok, false);
});

test('alle dokumentierten Gruende sind auch erlaubt', () => {
  for (const code of KORREKTUR_GRUENDE) {
    assert.equal(pruefeEingabe({ einheiten: 1, grund: 'Begruendung', grundCode: code }).ok, true, code);
  }
});

// --- folgenDerKorrektur -----------------------------------------------------

test('Abbruch nach Vorauszahlung erzeugt Guthaben', () => {
  // 6 Einheiten kassiert (25,48 €), nur 3 erbracht (17,74 €).
  const r = folgenDerKorrektur({ altBetrag: 25.48, neuBetrag: 17.74, saldo: 25.48 });
  assert.equal(r.guthaben, 7.74);
  assert.equal(r.restforderung, 0);
  assert.equal(r.differenz, -7.74);
  assert.equal(r.aenderung, true);
});

test('noch nicht gezahlt: kein Guthaben, nur ein kleineres Soll', () => {
  const r = folgenDerKorrektur({ altBetrag: 25.48, neuBetrag: 17.74, saldo: 0 });
  assert.equal(r.guthaben, 0);
  assert.equal(r.restforderung, 17.74);
});

test('teilweise gezahlt: der Rest bleibt Forderung, kein Guthaben', () => {
  const r = folgenDerKorrektur({ altBetrag: 25.48, neuBetrag: 17.74, saldo: 10.00 });
  assert.equal(r.guthaben, 0);
  assert.equal(r.restforderung, 7.74);
});

test('Soll auf null und alles gezahlt: der volle Betrag wird Guthaben', () => {
  const r = folgenDerKorrektur({ altBetrag: 25.48, neuBetrag: 0, saldo: 25.48 });
  assert.equal(r.guthaben, 25.48);
});

test('punktgenau bezahlt ergibt weder Guthaben noch Forderung', () => {
  const r = folgenDerKorrektur({ altBetrag: 17.74, neuBetrag: 17.74, saldo: 17.74 });
  assert.equal(r.guthaben, 0);
  assert.equal(r.restforderung, 0);
  assert.equal(r.aenderung, false);
});

test('ein Storno im Kassenbuch zieht den Saldo mit', () => {
  // Zuzahlung 25,48 gebucht, danach 25,48 storniert ⇒ Saldo 0.
  const r = folgenDerKorrektur({ altBetrag: 25.48, neuBetrag: 17.74, saldo: 0 });
  assert.equal(r.guthaben, 0);
});

// --- verrechnungsBetrag -----------------------------------------------------

test('Guthaben kleiner als die naechste Zuzahlung: alles wird angerechnet', () => {
  const r = verrechnungsBetrag({ rest: 7.74, zielSoll: 25.48 });
  assert.equal(r.betrag, 7.74);
  assert.equal(r.neuesZielSoll, 17.74);
  assert.equal(r.neuerRest, 0);
});

test('Guthaben groesser als die naechste Zuzahlung: der Ueberschuss bleibt stehen', () => {
  // Sonst entstuende aus dem Guthaben ein negatives Soll — also ein zweites
  // Guthaben aus dem ersten.
  const r = verrechnungsBetrag({ rest: 30.00, zielSoll: 17.74 });
  assert.equal(r.betrag, 17.74);
  assert.equal(r.neuesZielSoll, 0);
  assert.equal(r.neuerRest, 12.26);
});

test('Zielverordnung fordert nichts: es wird nichts verrechnet', () => {
  const r = verrechnungsBetrag({ rest: 7.74, zielSoll: 0 });
  assert.equal(r.betrag, 0);
  assert.equal(r.neuerRest, 7.74);
});

test('aufgebrauchtes Guthaben verrechnet nichts mehr', () => {
  assert.equal(verrechnungsBetrag({ rest: 0, zielSoll: 25.48 }).betrag, 0);
});

test('kaputte Eingaben ergeben 0 statt NaN', () => {
  assert.equal(verrechnungsBetrag({ rest: null, zielSoll: undefined }).betrag, 0);
  assert.equal(verrechnungsBetrag({ rest: -5, zielSoll: 10 }).betrag, 0);
});
