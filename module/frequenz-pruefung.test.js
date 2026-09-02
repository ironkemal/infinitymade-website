import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sollAbstand, werktageZwischen, bewerteAbstand, pruefeFrequenz,
  sitzungenProWoche, verteileWochentage,
  TOLERANZ_WERKTAGE, UNTERBRECHUNG_TAGE,
} from './frequenz-pruefung.js';

// Die Schwellen stammen aus Podoloji/20230524_Podologie_FAK_bf.txt Nr. 11
// (§ 16 Abs. 4 Satz 5 Heilmittel-Richtlinie). Sie hier festzunageln ist der
// Sinn dieser Datei: wer sie ändert, ändert eine Abrechnungsregel.
test('die Schwellen stehen, wo die Quelle sie hinschreibt', () => {
  assert.equal(TOLERANZ_WERKTAGE, 2);
  assert.equal(UNTERBRECHUNG_TAGE, 84);
});

// ── Sollabstand aus dem Freitext ───────────────────────────────────────────

test('feste Wochenintervalle', () => {
  assert.deepEqual(sollAbstand('alle 4 Wochen'), { min: 28, max: 28, label: 'alle 4 Wochen' });
  assert.deepEqual(sollAbstand('alle vier Wochen'), { min: 28, max: 28, label: 'alle 4 Wochen' });
  assert.equal(sollAbstand('14-tägig').min, 14);
});

// Podologie DF/NF/QF fahren typisch 4–6 Wochen (FAK Nr. 36).
test('Spanne „alle 4-6 Wochen"', () => {
  assert.deepEqual(sollAbstand('alle 4-6 Wochen'), { min: 28, max: 42, label: 'alle 4-6 Wochen' });
  assert.deepEqual(sollAbstand('4 – 6 wöchig'), { min: 28, max: 42, label: 'alle 4-6 Wochen' });
});

// Die beiden Einträge, die seit dem 31.08.2026 im Frequenz-Dropdown stehen
// (`FREQUENZ_OPTIONS` in dashboard.js) — genau in der Schreibweise, in der sie
// dort gespeichert werden. „Flex" gibt es, weil der Abstand bei der
// Nagelspange real zwischen 1 und 8 Wochen schwankt.
test('die Dropdown-Werte „alle 4–6 Wochen" und „Flex" werden gelesen', () => {
  assert.deepEqual(sollAbstand('1x alle 4–6 Wochen'), { min: 28, max: 42, label: 'alle 4-6 Wochen' });
  assert.deepEqual(sollAbstand('Flex (1–8 Wochen)'), { min: 7, max: 56, label: 'alle 1-8 Wochen' });
});

test('Angaben pro Woche', () => {
  assert.deepEqual(sollAbstand('1x wöchentlich'), { min: 7, max: 7, label: '1× wöchentlich' });
  assert.deepEqual(sollAbstand('2x wöchentlich'), { min: 4, max: 4, label: '2× wöchentlich' });
});

// Eine Spanne ergibt einen Korridor, keinen Punkt — sonst warnte die Hälfte
// aller korrekten Termine.
test('Spanne „1-2x wöchentlich" ergibt einen Korridor', () => {
  const s = sollAbstand('1-2x wöchentlich');
  assert.equal(s.min, 4);
  assert.equal(s.max, 7);
});

test('„2–3x pro Woche" mit Gedankenstrich', () => {
  const s = sollAbstand('2–3x pro Woche');
  assert.equal(s.min, 2);
  assert.equal(s.max, 4);
});

test('unverwertbarer Text prüft nicht', () => {
  for (const t of ['', null, 'nach Bedarf', 'täglich', 'w']) {
    assert.equal(sollAbstand(t), null, String(t));
  }
});

// ── Werktage ──────────────────────────────────────────────────────────────

// Die Quelle rechnet in Werktagen. Ein Termin, der über ein Wochenende
// rutscht, darf deshalb nicht als Verstoss gelten.
test('Werktage überspringen das Wochenende', () => {
  // Fr 07.08.2026 → Mo 10.08.2026 = 3 Kalendertage, 1 Werktag
  assert.equal(werktageZwischen(new Date('2026-08-07T09:00:00Z'), new Date('2026-08-10T09:00:00Z')), 1);
  // Mo → Mo = 5 Werktage
  assert.equal(werktageZwischen(new Date('2026-08-03T09:00:00Z'), new Date('2026-08-10T09:00:00Z')), 5);
});

test('Werktage sind richtungsunabhängig', () => {
  const a = new Date('2026-08-03T09:00:00Z');
  const b = new Date('2026-08-10T09:00:00Z');
  assert.equal(werktageZwischen(a, b), werktageZwischen(b, a));
});

// ── Bewertung ─────────────────────────────────────────────────────────────

const wochentakt = { min: 7, max: 7, label: '1× wöchentlich' };

test('genau im Takt ist in Ordnung', () => {
  assert.equal(bewerteAbstand(7, 5, wochentakt), 'ok');
});

// Kemals Beispiel: wöchentlich verordnet, Termin 3 Tage nach dem letzten.
test('deutlich zu dicht schlägt an', () => {
  assert.equal(bewerteAbstand(1, 1, wochentakt), 'zu_dicht');
});

test('kleine Abweichung bleibt unter der 2-Werktage-Toleranz', () => {
  // 5 Kalendertage / 3 Werktage bei Sollkorridor 5 Werktage → 2 Werktage
  // Abweichung, also gerade noch zulässig.
  assert.equal(bewerteAbstand(5, 3, wochentakt), 'ok');
});

// Die zweite Richtung — bis heute gar nicht geprüft.
test('zu selten schlägt ebenfalls an', () => {
  assert.equal(bewerteAbstand(21, 15, wochentakt), 'zu_selten');
});

// Die teure Schwelle: darüber verliert die Verordnung ihre Gültigkeit.
test('über 12 Wochen ist eine Unterbrechung, nicht nur „zu selten"', () => {
  assert.equal(bewerteAbstand(85, 61, wochentakt), 'unterbrechung');
  assert.equal(bewerteAbstand(84, 60, wochentakt), 'zu_selten');
});

// Ohne verwertbare Frequenz bleibt nur die Unterbrechungsgrenze übrig.
test('ohne Sollabstand greift nur die 12-Wochen-Grenze', () => {
  assert.equal(bewerteAbstand(30, 22, null), 'ok');
  assert.equal(bewerteAbstand(90, 64, null), 'unterbrechung');
});

// ── Vollprüfung ───────────────────────────────────────────────────────────

function doppel(sessions, error = null) {
  const kette = {
    select: () => kette,
    eq: () => kette,
    not: () => Promise.resolve({ data: sessions, error }),
  };
  return { from: () => kette };
}

const sitzung = (nr, iso, status = 'confirmed') => ({
  id: 's' + nr, session_number: nr, booking_id: 'b' + nr,
  bookings: { start_time: iso, status },
});

const rxWoche = { id: 'rx-1', frequenz: '1x wöchentlich' };

// Genau der Fall, den Kemal beschrieben hat: ein Termin davor, einer danach,
// und man schiebt einen dritten dazwischen.
test('Termin zwischen zwei bestehenden nennt beide Nachbarn', async () => {
  const supabase = doppel([
    sitzung(1, '2026-08-03T09:00:00Z'),
    sitzung(2, '2026-08-10T09:00:00Z'),
  ]);
  const r = await pruefeFrequenz({ supabase, rx: rxWoche, neuesDatum: new Date('2026-08-06T09:00:00Z') });
  assert.equal(r.ok, false);
  assert.match(r.meldung, /Termin davor/);
  assert.match(r.meldung, /Termin danach/);
  assert.match(r.meldung, /1× wöchentlich/);
  assert.match(r.meldung, /Kasse/);
  assert.equal(r.befund.seiten.length, 2);
});

test('sauberer Wochentakt meldet nichts', async () => {
  const supabase = doppel([sitzung(1, '2026-08-03T09:00:00Z')]);
  const r = await pruefeFrequenz({ supabase, rx: rxWoche, neuesDatum: new Date('2026-08-10T09:00:00Z') });
  assert.equal(r.ok, true);
});

// Der Grund für „Flex": bei der Spangenbehandlung sind 8 Wochen Abstand
// genauso richtig wie eine Woche. Beides darf nicht beanstandet werden.
test('„Flex" beanstandet weder eine noch acht Wochen Abstand', async () => {
  const rxFlex = { id: 'rx-flex', frequenz: 'Flex (1–8 Wochen)' };
  const supabase = doppel([sitzung(1, '2026-08-03T09:00:00Z')]);
  for (const datum of ['2026-08-10T09:00:00Z', '2026-09-28T09:00:00Z']) {
    const r = await pruefeFrequenz({ supabase, rx: rxFlex, neuesDatum: new Date(datum) });
    assert.equal(r.ok, true, datum);
  }
});

test('Pause über 12 Wochen bekommt eine eigene Überschrift', async () => {
  const supabase = doppel([sitzung(1, '2026-05-04T09:00:00Z')]);
  const r = await pruefeFrequenz({ supabase, rx: rxWoche, neuesDatum: new Date('2026-08-10T09:00:00Z') });
  assert.equal(r.ok, false);
  assert.equal(r.titel, 'Behandlungspause über 12 Wochen');
  assert.match(r.meldung, /§ 16 Abs. 4/);
});

test('abgesagte Termine zählen nicht', async () => {
  const supabase = doppel([sitzung(1, '2026-08-09T09:00:00Z', 'cancelled')]);
  const r = await pruefeFrequenz({ supabase, rx: rxWoche, neuesDatum: new Date('2026-08-10T09:00:00Z') });
  assert.equal(r.ok, true);
});

test('der eigene Termin beanstandet sich nicht selbst', async () => {
  const supabase = doppel([sitzung(1, '2026-08-09T09:00:00Z')]);
  const r = await pruefeFrequenz({
    supabase, rx: rxWoche, neuesDatum: new Date('2026-08-10T09:00:00Z'), ausserBookingId: 'b1',
  });
  assert.equal(r.ok, true);
});

// Lieber gar nicht warnen als auf falscher Grundlage.
test('Lesefehler führt nicht zu einer Warnung', async () => {
  const r = await pruefeFrequenz({
    supabase: doppel(null, { message: 'boom' }), rx: rxWoche, neuesDatum: new Date(),
  });
  assert.equal(r.ok, true);
});

test('ohne bisherige Termine gibt es nichts zu vergleichen', async () => {
  const r = await pruefeFrequenz({ supabase: doppel([]), rx: rxWoche, neuesDatum: new Date() });
  assert.equal(r.ok, true);
});

// ── Serienplanung: Wochentage aus der Verordnung ──────────────────────────

test('Sitzungen pro Woche aus dem Freitext', () => {
  assert.equal(sitzungenProWoche('1x wöchentlich'), 1);
  assert.equal(sitzungenProWoche('2x wöchentlich'), 2);
  assert.equal(sitzungenProWoche('3x pro Woche'), 3);
  // Bei einer Spanne gilt der höhere Wert — sonst plant die Serie zu dünn.
  assert.equal(sitzungenProWoche('1-2x wöchentlich'), 2);
  // Mehrwöchige Intervalle plant die Serie über den Wochenabstand, nicht über
  // Wochentage — hier bewusst null.
  assert.equal(sitzungenProWoche('alle 4 Wochen'), null);
  assert.equal(sitzungenProWoche('nach Bedarf'), null);
});

test('ein Termin pro Woche bleibt auf dem Starttag', () => {
  assert.deepEqual(verteileWochentage(1, 1), [1]);
  assert.deepEqual(verteileWochentage(3, 1), [3]);
});

// Mo + 3 Termine → Mo/Mi/Fr, der Abstand, den auch ein Mensch wählen würde.
test('drei Termine ab Montag ergeben Mo/Mi/Fr', () => {
  assert.deepEqual(verteileWochentage(1, 3), [1, 3, 5]);
});

test('zwei Termine ab Montag ergeben Mo/Fr', () => {
  assert.deepEqual(verteileWochentage(1, 2), [1, 5]);
});

// Praxen arbeiten Mo–Fr; ein Wochenendstart darf keine Samstagsserie erzeugen.
test('Wochenendstart wird auf Montag gezogen', () => {
  assert.deepEqual(verteileWochentage(0, 1), [1]);
  assert.deepEqual(verteileWochentage(6, 1), [1]);
});

test('es kommen nie mehr oder weniger Tage heraus als verlangt', () => {
  for (let start = 0; start <= 6; start++) {
    for (let n = 1; n <= 5; n++) {
      const tage = verteileWochentage(start, n);
      assert.equal(tage.length, n, `start=${start} n=${n} → ${tage}`);
      assert.equal(new Set(tage).size, n, 'keine Dubletten');
      assert.ok(tage.every(t => t >= 1 && t <= 5), 'nur Mo–Fr');
      assert.deepEqual(tage, [...tage].sort((a, b) => a - b), 'aufsteigend');
    }
  }
});

// Regression: die abgelöste `parseFrequenzWoche` in dashboard.js las
// „4-6 wöchig" und „alle 4-6 Wochen" — die typische Podologie-Frequenz für
// DF/NF/QF, gemeint ist alle 4-6 WOCHEN — als „6× pro Woche" und zeigte der
// Praxis genau das als Hinweis an. Mehrwöchige Intervalle dürfen hier niemals
// eine Zahl liefern.
test('mehrwöchige Intervalle sind keine Wochenfrequenz', () => {
  assert.equal(sitzungenProWoche('4-6 wöchig'), null);
  assert.equal(sitzungenProWoche('alle 4-6 Wochen'), null);
  assert.equal(sitzungenProWoche('alle 4 Wochen'), null);
  assert.equal(sitzungenProWoche('14-tägig'), null);
});

// Zweiter Fehler derselben Funktion: sie fiel am Ende auf „erste Zahl im Text"
// zurück, sodass aus „10 Einheiten" zehn Sitzungen pro Woche wurden.
test('freier Text ohne Wochenangabe liefert nichts', () => {
  assert.equal(sitzungenProWoche('10 Einheiten'), null);
  assert.equal(sitzungenProWoche('nach Bedarf'), null);
});
