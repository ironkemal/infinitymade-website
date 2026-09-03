import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verordnungDetailHtml } from './verordnung-detail.js';

// Warum es diese Datei gibt:
// `verordnungDetailHtml` ist absichtlich eine reine Funktion — Zeile rein,
// HTML raus, kein DOM, kein Supabase. Genau deshalb lässt sich das nachprüfen,
// was beim Umbau der Seite in zwei Hälften (31.08.2026) am leichtesten still
// kaputtgeht: dass beide Verordnungstöpfe dieselbe Ansicht bekommen, obwohl
// ihre Spalten verschieden heissen. `anzahl_einheiten` ↔ `behandlungseinheiten`,
// `is_dringend` ↔ `dringend`, `icd10` als Spalte ↔ `icd10` als text[].
// Ein Feld an der falschen Stelle abgefragt ergibt kein Fehlschlagen, sondern
// ein stilles „—" auf dem Bildschirm.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PHYSIO = {
  id: 'rx1',
  status: 'in_therapy',
  ausstellungsdatum: '2026-08-01',
  anzahl_einheiten: 6,
  frequenz: '2x pro Woche',
  heilmittel: 'KG',
  icd10: 'M54.5',
  diagnosegruppe: 'WS2',
  is_dringend: true,
  verordnungsnummer: 3,
  leads: { id: 'p1', first_name: 'Anna', last_name: 'Berger', patientennummer: 12 },
  aerzte: { arzt_name: 'Dr. Schmitt', lanr: '123456789' },
  prescription_sessions: [
    { id: 's1', session_number: 1, status: 'done',    booking_id: 'b1', bookings: { start_time: '2026-08-05T09:00:00Z' } },
    { id: 's2', session_number: 2, status: 'planned', booking_id: 'b2', bookings: { start_time: '2026-08-07T09:00:00Z' } },
    { id: 's3', session_number: 3, status: 'planned', booking_id: null,  bookings: null },
  ],
};

const PODO = {
  id: 'v1',
  status: 'aktiv',
  ausstellungsdatum: '2026-08-02',
  behandlungseinheiten: 6,
  therapiefrequenz: '1x pro Woche',
  diagnosegruppe: 'DF2',
  icd10: ['E11.40', 'E11.74'],
  dringend: true,
  verordnungsnummer: 4,
  lead_id: 'p1',
  heilmittel_items: [{ code: '78010', bezeichnung: 'Podologische Behandlung', anzahl: 1 }],
  leads: { id: 'p1', first_name: 'Anna', last_name: 'Berger', patientennummer: 12 },
  aerzte: { arzt_name: 'Dr. Schmitt', lanr: '123456789' },
  podologie_behandlungen: [
    { id: 'b1', behandlungsdatum: '2026-08-03', hpnr_codes: ['78010', '78030'], betrag_gkv: 38.63 },
  ],
};

/* ── Kopf: Name, Nummer, Status ───────────────────────────────────────────── */

test('Kopfzeile trägt Name, Belegnummer und Status — in beiden Töpfen', () => {
  const p = verordnungDetailHtml(PHYSIO, { escapeHtml: esc, quelle: 'physio' });
  assert.match(p, /Anna Berger/);
  assert.match(p, /12-3/);              // Patienten-Nr. + Verordnungs-Nr.
  assert.match(p, /In Behandlung/);     // aus dem gemeinsamen Vokabular

  const v = verordnungDetailHtml(PODO, { escapeHtml: esc, quelle: 'podologie' });
  assert.match(v, /Anna Berger/);
  assert.match(v, /12-4/);
  assert.match(v, /In Behandlung/);
});

test('Podologie ohne Patientenakte fällt auf den Freitextnamen zurück', () => {
  // Altbestand: `lead_id` fehlt, also gibt es keinen Verbund und keine Nummer.
  const html = verordnungDetailHtml(
    { ...PODO, leads: null, lead_id: null, verordnungsnummer: null, patient_name: 'Werner Müller' },
    { escapeHtml: esc, quelle: 'podologie' },
  );
  assert.match(html, /Werner Müller/);
  assert.doesNotMatch(html, /12-/);
});

/* ── Die Spaltenfallen zwischen den Töpfen ───────────────────────────────── */

test('verordnete Menge wird je Topf aus der richtigen Spalte gelesen', () => {
  // `anzahl_einheiten` ↔ `behandlungseinheiten`. Beim Umschreiben die
  // wahrscheinlichste Verwechslung — und sie fällt nicht auf, weil ein
  // fehlender Wert nur als „—" erscheint.
  assert.match(verordnungDetailHtml(PHYSIO, { escapeHtml: esc, quelle: 'physio' }),
    /Behandlungseinheiten[\s\S]{0,200}?6/);
  assert.match(verordnungDetailHtml(PODO, { escapeHtml: esc, quelle: 'podologie' }),
    /Behandlungseinheiten[\s\S]{0,400}?6/);
});

test('Dringlichkeit wird je Topf aus der richtigen Spalte gelesen', () => {
  // `is_dringend` (Physio) ↔ `dringend` (Podologie).
  assert.match(verordnungDetailHtml(PHYSIO, { escapeHtml: esc, quelle: 'physio' }), /Dringlicher Behandlungsbedarf/);
  assert.match(verordnungDetailHtml(PODO,   { escapeHtml: esc, quelle: 'podologie' }), /Dringlicher Behandlungsbedarf/);

  const ruhig = verordnungDetailHtml({ ...PODO, dringend: false }, { escapeHtml: esc, quelle: 'podologie' });
  assert.doesNotMatch(ruhig, /Dringlicher Behandlungsbedarf/);
});

test('Podologie-icd10 ist ein text[] und darf nicht als [object Object] landen', () => {
  const html = verordnungDetailHtml(PODO, { escapeHtml: esc, quelle: 'podologie' });
  assert.match(html, /E11\.40 · E11\.74/);
  assert.doesNotMatch(html, /object Object/);
});

/* ── Rechte Spalte ────────────────────────────────────────────────────────── */

test('Physio: Termine sind in vergeben und unvergeben getrennt', () => {
  const html = verordnungDetailHtml(PHYSIO, { escapeHtml: esc, quelle: 'physio' });
  assert.match(html, /vergeben/);
  assert.match(html, /unvergeben/);
  assert.match(html, /ohne Termin/);   // die Zeile ohne booking_id
});

test('Podologie: Verschreibung zeigt Summe und Zuzahlung, wenn sie gerechnet wurde', () => {
  const summe = { brutto: 38.63, prozent: 3.87, pauschale: 10, gesamt: 13.87, befreit: false, unbekannt: [] };
  const html = verordnungDetailHtml(PODO, { escapeHtml: esc, quelle: 'podologie', summe });
  assert.match(html, /Gesamt/);
  assert.match(html, /38,63 €/);
  assert.match(html, /13,87 €/);
});

test('Podologie: unbekannte Position wird als unvollständige Summe gemeldet', () => {
  // Eine Position ohne Katalogtreffer geht mit 0 € ein — die Summe sähe sonst
  // vollständig aus, obwohl sie es nicht ist.
  const summe = { brutto: 35.16, prozent: 3.52, pauschale: 10, gesamt: 13.52, befreit: false, unbekannt: ['79999'] };
  const html = verordnungDetailHtml(PODO, { escapeHtml: esc, quelle: 'podologie', summe });
  assert.match(html, /79999/);
  assert.match(html, /unvollständig/);
});

test('Podologie ohne Summe bleibt stehen — die Ansicht ist die Verordnung, nicht die Rechnung', () => {
  const html = verordnungDetailHtml(PODO, { escapeHtml: esc, quelle: 'podologie' });
  assert.match(html, /Verschreibung/);
  assert.doesNotMatch(html, /Gesamt/);
});

test('Podologie: Termine-Kasten sagt „nicht erfasst" statt 0, wenn die Menge fehlt', () => {
  const html = verordnungDetailHtml(
    { ...PODO, behandlungseinheiten: null },
    { escapeHtml: esc, quelle: 'podologie', termine: { vergeben: [], kandidaten: [] } },
  );
  assert.match(html, /Einheitenzahl nicht erfasst/);
});

test('Podologie: zugeordnete und zuordenbare Termine bekommen je einen eigenen Knopf', () => {
  // Beta-1 will EINEN Termin wählen, nicht alle — also je Zeile ein Knopf.
  const html = verordnungDetailHtml(PODO, {
    escapeHtml: esc, quelle: 'podologie',
    termine: {
      vergeben:   [{ id: 'b1', start_time: '2026-08-10T08:00:00Z', status: 'confirmed' }],
      kandidaten: [{ id: 'b2', start_time: '2026-08-17T08:00:00Z', status: 'confirmed' },
                   { id: 'b3', start_time: '2026-08-24T08:00:00Z', status: 'confirmed' }],
    },
  });
  assert.equal((html.match(/data-termin-binden=/g) || []).length, 2);
  assert.equal((html.match(/data-termin-loesen=/g) || []).length, 1);
});

/* ── Der Riegel ───────────────────────────────────────────────────────────── */

test('abgerechnete Verordnung bietet kein Ändern der Menge an', () => {
  // `belegnummer` gesetzt = war bei der Kasse (Anlage 1 TP5 V21 Kap. 7.3).
  const html = verordnungDetailHtml(
    { ...PODO, belegnummer: '12-4', status: 'abgerechnet' },
    { escapeHtml: esc, quelle: 'podologie' },
  );
  assert.doesNotMatch(html, /data-einheiten-aendern/);
  assert.match(html, /festgeschrieben/);
});

test('laufende Verordnung bietet das Ändern an', () => {
  const html = verordnungDetailHtml(PODO, { escapeHtml: esc, quelle: 'podologie' });
  assert.match(html, /data-einheiten-aendern/);
});

test('im Physio-Topf ist die Menge nicht änderbar — dort wäre es eine Geldänderung', () => {
  const html = verordnungDetailHtml(PHYSIO, { escapeHtml: esc, quelle: 'physio' });
  assert.doesNotMatch(html, /data-einheiten-aendern/);
});

/* ── Fluchtfunktion ───────────────────────────────────────────────────────── */

test('Freitextfelder werden maskiert', () => {
  const html = verordnungDetailHtml(
    { ...PODO, notizen: '<script>alert(1)</script>' },
    { escapeHtml: esc, quelle: 'podologie' },
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
