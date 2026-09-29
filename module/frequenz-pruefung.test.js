import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sollAbstand, werktageZwischen, bewerteAbstand, pruefeFrequenz, pruefeErsttermin,
  sitzungenProWoche, verteileWochentage,
  TOLERANZ_WERKTAGE, UNTERBRECHUNG_TAGE,
} from './frequenz-pruefung.js';

// Die Schwellen stammen aus wissensbank/podologie/20230524_Podologie_FAK_bf.txt Nr. 11
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

// ── Podologie: Nachbartermine kommen aus ladePodoTermine, nicht aus
//    prescription_sessions (Reform S1.9) — vorher war das hier IMMER {ok:true},
//    weil Podologie kein Sitzungs-Hauptbuch führt. ──────────────────────────

/**
 * Fake-Supabase, das `prescription_sessions` mit einem Fehler beantwortet
 * (der Podologie-Zweig darf diese Tabelle gar nicht erst anfragen) und
 * `bookings` mit den übergebenen Zeilen.
 */
function doppelPodo(bookings) {
  const bookingKette = {
    select: () => bookingKette,
    eq: () => bookingKette,
    neq: () => bookingKette,
    is: () => bookingKette,
    not: () => bookingKette,
    order: () => Promise.resolve({ data: bookings, error: null }),
    limit: () => Promise.resolve({ data: [], error: null }),
  };
  return {
    from: (table) => {
      if (table === 'bookings') return bookingKette;
      throw new Error(`Podologie darf "${table}" hier nicht abfragen`);
    },
  };
}

const podoBooking = (id, iso, status = 'confirmed') =>
  ({ id, start_time: iso, end_time: null, status, no_show: false, customer_name: '', service_id: null, business_id: null });

const rxPodoWoche = { id: 'rx-podo', frequenz: '1x wöchentlich', therapie_bereich: 'podo' };

test('Podologie: Nachbartermine kommen aus bookings (ladePodoTermine), sauberer Takt meldet nichts', async () => {
  const supabase = doppelPodo([podoBooking('b1', '2026-08-03T09:00:00Z')]);
  const r = await pruefeFrequenz({
    supabase, rx: rxPodoWoche, neuesDatum: new Date('2026-08-10T09:00:00Z'), ownerId: 'owner-1',
  });
  assert.equal(r.ok, true);
});

test('Podologie: Frequenzabweichung wird ebenfalls erkannt (Datenquelle bookings)', async () => {
  const supabase = doppelPodo([podoBooking('b1', '2026-08-09T09:00:00Z')]); // 1 Tag statt 1 Woche
  const r = await pruefeFrequenz({
    supabase, rx: rxPodoWoche, neuesDatum: new Date('2026-08-10T09:00:00Z'), ownerId: 'owner-1',
  });
  assert.equal(r.ok, false);
});

test('Podologie: ohne ownerId keine Abfrage, also keine Warnung', async () => {
  const r = await pruefeFrequenz({
    supabase: doppelPodo([podoBooking('b1', '2026-08-09T09:00:00Z')]),
    rx: rxPodoWoche, neuesDatum: new Date('2026-08-10T09:00:00Z'),
  });
  assert.equal(r.ok, true);
});

// Der eigentliche Fehler, den Reform S1.9 behebt: eine >12-Wochen-Pause darf
// in der Podologie NICHT automatisch als „Verordnung ungültig" gemeldet
// werden — FAK Nr. 11 sagt nur, was bei WENIGER als 12 Wochen gilt.
test('Podologie: lange Pause allein löst KEINE Unterbrechungswarnung aus', async () => {
  const supabase = doppelPodo([podoBooking('b1', '2026-05-04T09:00:00Z')]); // > 12 Wochen vor dem Zieldatum
  const rx = { id: 'rx-podo-2', frequenz: 'nach Bedarf', therapie_bereich: 'podo' }; // kein Sollabstand
  const r = await pruefeFrequenz({
    supabase, rx, neuesDatum: new Date('2026-08-10T09:00:00Z'), ownerId: 'owner-1',
  });
  assert.equal(r.ok, true);
});

// Storno/no_show zählen für Podologie genauso wenig als Nachbar wie im
// Physio-Zweig — istVergeben() filtert sie aus ladePodoTermine() heraus.
test('Podologie: abgesagte/no_show-Termine zählen nicht als Nachbar', async () => {
  const supabase = doppelPodo([
    podoBooking('b1', '2026-08-09T09:00:00Z', 'cancelled'),
    { ...podoBooking('b2', '2026-08-09T10:00:00Z'), no_show: true },
  ]);
  const r = await pruefeFrequenz({
    supabase, rx: rxPodoWoche, neuesDatum: new Date('2026-08-10T09:00:00Z'), ownerId: 'owner-1',
  });
  assert.equal(r.ok, true);
});

// ── UI1/UI2: keine Frequenzwarnung, unabhängig vom Fachbereich ────────────

test('UI1/UI2-Diagnosegruppen: keine Frequenzwarnung (Anlage 3 Podologie lit. i)', async () => {
  // Würde ohne die Ausnahme warnen (1 Tag statt 1 Woche Abstand) — die
  // Ausnahme muss also VOR jeder Datenbankabfrage greifen.
  const rx = { id: 'rx-ui', frequenz: '1x wöchentlich', diagnosegruppe: 'UI1' };
  const r = await pruefeFrequenz({
    supabase: doppel(null, { message: 'darf nicht aufgerufen werden' }),
    rx, neuesDatum: new Date('2026-08-10T09:00:00Z'),
  });
  assert.equal(r.ok, true);
});

// ── Physio/Ergo/Logo: unverändertes Verhalten (kein therapie_bereich) ──────

test('Physio/Ergo/Logo: 12-Wochen-Unterbrechung bleibt unverändert scharf', async () => {
  const supabase = doppel([sitzung(1, '2026-05-04T09:00:00Z')]);
  const r = await pruefeFrequenz({ supabase, rx: rxWoche, neuesDatum: new Date('2026-08-10T09:00:00Z') });
  assert.equal(r.ok, false);
  assert.equal(r.titel, 'Behandlungspause über 12 Wochen');
  assert.match(r.meldung, /HeilM-RL § 16 Abs. 4/);
  assert.doesNotMatch(r.meldung, /Gültigkeit — die Kasse kann die Leistung absetzen/);
});

// ── bewerteAbstand: Unterbrechungsprüfung ist jetzt abschaltbar ───────────

test('bewerteAbstand: pruefeUnterbrechung=false ignoriert die 12-Wochen-Grenze', () => {
  assert.equal(bewerteAbstand(85, 61, wochentakt, false), 'zu_selten');
  assert.equal(bewerteAbstand(85, 61, wochentakt, true), 'unterbrechung');
  assert.equal(bewerteAbstand(85, 61, wochentakt), 'unterbrechung'); // Default bleibt true
});

// ── pruefeErsttermin: Behandlungsbeginn-Frist, nur Podologie, nur erster Termin ─

/**
 * Fake-Supabase für `pruefeErsttermin`: `.from('prescriptions')` liefert die
 * übergebene Verordnungszeile, `.from('bookings')` die übergebenen Termine
 * (für `ladePodoTermine`).
 */
function doppelErsttermin({ rx, bookings = [] }) {
  const bookingKette = {
    select: () => bookingKette,
    eq: () => bookingKette,
    neq: () => bookingKette,
    is: () => bookingKette,
    not: () => bookingKette,
    order: () => Promise.resolve({ data: bookings, error: null }),
    limit: () => Promise.resolve({ data: [], error: null }),
  };
  const rxKette = {
    select: () => rxKette,
    eq: () => rxKette,
    maybeSingle: () => Promise.resolve({ data: rx, error: null }),
  };
  return { from: (table) => (table === 'bookings' ? bookingKette : rxKette) };
}

const rxPodoNormal = { id: 'rx-1', therapie_bereich: 'podo', ausstellungsdatum: '2026-01-01', is_dringend: false, behandlungsbeginn: null };
const rxPodoDringend = { id: 'rx-2', therapie_bereich: 'podo', ausstellungsdatum: '2026-01-01', is_dringend: true, behandlungsbeginn: null };

test('erster Termin innerhalb der 28-Tage-Frist: ok', async () => {
  const supabase = doppelErsttermin({ rx: rxPodoNormal, bookings: [] });
  const r = await pruefeErsttermin({
    supabase, prescriptionId: 'rx-1', ersterTermin: '2026-01-20', ownerId: 'owner-1',
  });
  assert.equal(r.ok, true);
});

test('erster Termin nach der 28-Tage-Frist: BLOCK mit Meldung', async () => {
  const supabase = doppelErsttermin({ rx: rxPodoNormal, bookings: [] });
  const r = await pruefeErsttermin({
    supabase, prescriptionId: 'rx-1', ersterTermin: '2026-02-01', ownerId: 'owner-1',
  });
  assert.equal(r.ok, false);
  assert.match(r.meldung, /Behandlungsbeginn verpasst/);
});

test('dringlich: 14-Tage-Frist statt 28', async () => {
  const supabase = doppelErsttermin({ rx: rxPodoDringend, bookings: [] });
  assert.equal((await pruefeErsttermin({
    supabase, prescriptionId: 'rx-2', ersterTermin: '2026-01-15', ownerId: 'owner-1',
  })).ok, true);
  assert.equal((await pruefeErsttermin({
    supabase, prescriptionId: 'rx-2', ersterTermin: '2026-01-16', ownerId: 'owner-1',
  })).ok, false);
});

test('behandlungsbeginn bereits dokumentiert: kein Block mehr, egal wie spät', async () => {
  const rx = { ...rxPodoNormal, behandlungsbeginn: '2026-01-10' };
  const supabase = doppelErsttermin({ rx, bookings: [] });
  const r = await pruefeErsttermin({
    supabase, prescriptionId: rx.id, ersterTermin: '2026-06-01', ownerId: 'owner-1',
  });
  assert.equal(r.ok, true);
});

test('nicht Podologie: kein Block', async () => {
  const rx = { id: 'rx-3', therapie_bereich: null, ausstellungsdatum: '2026-01-01', is_dringend: false, behandlungsbeginn: null };
  const supabase = doppelErsttermin({ rx, bookings: [] });
  const r = await pruefeErsttermin({
    supabase, prescriptionId: rx.id, ersterTermin: '2026-06-01', ownerId: 'owner-1',
  });
  assert.equal(r.ok, true);
});

test('schon ein ANDERER vergebener Termin vorhanden: nicht mehr der erste, kein Block', async () => {
  const supabase = doppelErsttermin({
    rx: rxPodoNormal,
    bookings: [{ id: 'b-alt', start_time: '2026-01-05T09:00:00Z', status: 'confirmed', no_show: false }],
  });
  const r = await pruefeErsttermin({
    supabase, prescriptionId: rxPodoNormal.id, ersterTermin: '2026-06-01', ownerId: 'owner-1',
  });
  assert.equal(r.ok, true);
});

// Der Fehler, den `ausserBookingId` verhindert: verschiebt man den EINZIGEN
// (ersten) Termin einer Verordnung, zählt `ladePodoTermine` ihn selbst als
// "schon vergeben" — ohne Ausschluss würde die Frist nie mehr geprüft.
test('der einzige Termin ist der bearbeitete selbst: gilt weiterhin als erster Termin', async () => {
  const supabase = doppelErsttermin({
    rx: rxPodoNormal,
    bookings: [{ id: 'b-selbst', start_time: '2026-01-05T09:00:00Z', status: 'confirmed', no_show: false }],
  });
  const r = await pruefeErsttermin({
    supabase, prescriptionId: rxPodoNormal.id, ersterTermin: '2026-02-01',
    ownerId: 'owner-1', ausserBookingId: 'b-selbst',
  });
  assert.equal(r.ok, false);
  assert.match(r.meldung, /Behandlungsbeginn verpasst/);
});

test('ohne ownerId: keine Podo-Abfrage möglich, kein Block', async () => {
  const supabase = doppelErsttermin({ rx: rxPodoNormal, bookings: [] });
  const r = await pruefeErsttermin({ supabase, prescriptionId: rxPodoNormal.id, ersterTermin: '2026-06-01' });
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
