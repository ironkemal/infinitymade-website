// Die Dateiliste des §302-Archivs. Getestet wird der rechnende Teil — die
// Reihenfolge und die vier Geldzahlen —, nicht das Zeichnen.
//
// Warum gerade diese:
//   · reichereAn()   trennt "Soll gegen die Kasse" von "Zuzahlung des
//                    Patienten". Genau diese zwei hatte die alte
//                    Podologie-Liste vertauscht.
//   · sortiereVerlauf() entscheidet, was der Podologe zuerst sieht. Eine
//                    abgesetzte Datei, die unter zwanzig bezahlten steht, wird
//                    nicht korrigiert — und das Geld nie geholt.
//   · istUeberfaellig() ist die 4-Wochen-Frist aus den Richtlinien
//                    (Text 20.11.2006 § 7 Abs. 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dringlichkeit, sortiereVerlauf, reichereAn, istUeberfaellig, DRINGLICHKEIT }
  from './abrechnung-verlauf.js';

const datei = (o) => ({
  id: 'a', kostentraeger_ik: '101', total_eur: 0, zuzahlung_total: 0,
  prescription_count: 1, rejected_count: 0, status: 'gesendet',
  created_at: '2026-09-01T10:00:00Z', ...o,
});

test('dringlichkeit: was zu tun ist steht oben, Erledigtes unten', () => {
  assert.ok(dringlichkeit('rejected')   < dringlichkeit('gesendet'));
  assert.ok(dringlichkeit('abgewiesen') < dringlichkeit('gesendet'));
  assert.ok(dringlichkeit('gesendet')   < dringlichkeit('accepted'));
  assert.ok(dringlichkeit('accepted')   < dringlichkeit('paid'));
  assert.equal(DRINGLICHKEIT.rejected, DRINGLICHKEIT.abgewiesen,
    'beide Rot sind gleich dringend — unterschieden werden sie in Farbe und Aktion');
  // Ein Status, den niemand kennt, ist eher etwas zum Ansehen als etwas
  // Erledigtes — deshalb ganz nach oben, nicht ans Ende.
  assert.ok(dringlichkeit('irgendwas') < dringlichkeit('rejected'));
});

test('reichereAn: Soll ist der Kassenanteil, nicht die Zuzahlung', () => {
  const [a] = reichereAn(
    [datei({ id: 'x', total_eur: 500, zuzahlung_total: 80 })],
    [{ abrechnung_id: 'x', netto_eur: 300, absetzung_eur: 0 },
     { abrechnung_id: 'x', netto_eur: 120, absetzung_eur: 20 }],
    [{ abrechnung_id: 'x', betrag_eur: 100 }],
    () => 'AOK',
  );
  assert.equal(a.kassenName, 'AOK');
  assert.equal(a.soll, 420);
  assert.equal(a.absetzung, 20);
  assert.equal(a.bezahlt, 100);
  assert.equal(a.offen, 300, 'Soll − Absetzung − Bezahlt');
});

test('reichereAn: ohne Zeilenbetraege gilt der Kopfsatz (rekonstruierte Altdatei)', () => {
  const [a] = reichereAn([datei({ id: 'x', total_eur: 500, zuzahlung_total: 80 })],
                         [{ abrechnung_id: 'x', netto_eur: 0, absetzung_eur: 0 }],
                         []);
  assert.equal(a.soll, 420);
  assert.equal(a.offen, 420);
});

test('reichereAn: eine Teilabsetzung wird als solche erkannt', () => {
  const [a] = reichereAn([datei({ status: 'rejected', rejected_count: 1, prescription_count: 4 })], [], []);
  assert.equal(a.anzeigeStatus, 'teilweise_abgesetzt');
  const [b] = reichereAn([datei({ status: 'rejected', rejected_count: 4, prescription_count: 4 })], [], []);
  assert.equal(b.anzeigeStatus, 'rejected');
});

test('sortiereVerlauf: Vorgabe ist "offen zuerst, dann Datum absteigend"', () => {
  const zeilen = reichereAn([
    datei({ id: 'bezahlt', status: 'paid',      created_at: '2026-09-05T00:00:00Z' }),
    datei({ id: 'alt-rot', status: 'rejected',  created_at: '2026-08-01T00:00:00Z', prescription_count: 2, rejected_count: 2 }),
    datei({ id: 'neu-rot', status: 'rejected',  created_at: '2026-09-04T00:00:00Z', prescription_count: 2, rejected_count: 2 }),
    datei({ id: 'unterwegs', status: 'gesendet', created_at: '2026-09-06T00:00:00Z' }),
  ], [], []);
  const ids = sortiereVerlauf(zeilen).map(z => z.id);
  assert.deepEqual(ids, ['neu-rot', 'alt-rot', 'unterwegs', 'bezahlt']);
});

test('sortiereVerlauf: ein Spaltenklick sortiert rein nach der Spalte', () => {
  const zeilen = reichereAn([
    datei({ id: 'a', total_eur: 100, status: 'paid' }),
    datei({ id: 'b', total_eur: 900, status: 'rejected', prescription_count: 1, rejected_count: 1 }),
    datei({ id: 'c', total_eur: 500, status: 'gesendet' }),
  ], [], []);
  // Absteigend nach Soll — die Dringlichkeit darf jetzt NICHT mehr mitreden,
  // sonst faende niemand die groesste Summe.
  assert.deepEqual(sortiereVerlauf(zeilen, 'soll', 'desc').map(z => z.id), ['b', 'c', 'a']);
  assert.deepEqual(sortiereVerlauf(zeilen, 'soll', 'asc').map(z => z.id),  ['a', 'c', 'b']);
});

test('sortiereVerlauf: Gleichstand ergibt immer dieselbe Reihenfolge', () => {
  const zeilen = reichereAn([
    datei({ id: 'zzz', total_eur: 100 }), datei({ id: 'aaa', total_eur: 100 }),
  ], [], []);
  const einmal = sortiereVerlauf(zeilen, 'soll', 'desc').map(z => z.id);
  const nochmal = sortiereVerlauf(zeilen, 'soll', 'desc').map(z => z.id);
  assert.deepEqual(einmal, nochmal);
  assert.deepEqual(einmal, ['aaa', 'zzz']);
});

test('sortiereVerlauf fasst die Eingabe nicht an', () => {
  const zeilen = reichereAn([datei({ id: 'a' }), datei({ id: 'b' })], [], []);
  const vorher = zeilen.map(z => z.id);
  sortiereVerlauf(zeilen, 'datei', 'asc');
  assert.deepEqual(zeilen.map(z => z.id), vorher);
});

test('istUeberfaellig: 4 Wochen ab Einreichung, und nur wenn Geld offen ist', () => {
  const heute = new Date('2026-09-09T12:00:00Z');
  const eingereicht = (tageVorher) =>
    new Date(heute.getTime() - tageVorher * 864e5).toISOString();

  assert.equal(istUeberfaellig({ zaa_uploaded_at: eingereicht(30), offen: 100 }, heute), true);
  assert.equal(istUeberfaellig({ zaa_uploaded_at: eingereicht(20), offen: 100 }, heute), false);
  // Bezahlt ist nicht ueberfaellig, egal wie alt.
  assert.equal(istUeberfaellig({ zaa_uploaded_at: eingereicht(90), offen: 0 }, heute), false);
  // Noch nicht eingereicht: eine Frist waere eine erfundene Mahnung.
  assert.equal(istUeberfaellig({ zaa_uploaded_at: null, offen: 100 }, heute), false);
});
