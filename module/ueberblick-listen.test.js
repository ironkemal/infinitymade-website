import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  fristenGruppieren,
  aktuelleAbwesenheiten,
  datumMitJahr,
  abwesenheitTyp,
  wochenAuslastungAufbereiten,
  fristenAuswerten,
  rezKpiAuswerten,
  therapieberichteAufbereiten,
  rezeptPruefbedarfAufbereiten,
  anfragenAufbereiten,
  wartelisteAufbereiten,
  aufgabenAufbereiten,
  rechnungenAufbereiten,
  geburtstageAufbereiten,
  abwesenheitenAufbereiten,
  abwesenheitKachelAuswerten,
  nichtErscheinerAufbereiten,
  telefonLink,
  initialen,
  suchePasst,
} from './ueberblick-listen.js';

test('Fund 8: gleiche Fristmeldungen werden mit Anzahl zusammengefasst', () => {
  const t = 'TEST-Anna — Behandlungsbeginn in 14 Tagen fällig (bis 01.12.2026)';
  const r = fristenGruppieren([
    { type: 'warning', text: t },
    { type: 'warning', text: t },
    { type: 'warning', text: t },
    { type: 'danger', text: 'Bernd — ABGELAUFEN' },
  ]);
  assert.equal(r.length, 2);
  assert.equal(r[0].text, `${t} · 3 Verordnungen`);
  assert.equal(r[1].text, 'Bernd — ABGELAUFEN');
});

test('Fund 8: Abwesenheiten nur laufend oder in 14 Tagen, Datum mit Jahr', () => {
  const zeilen = [
    { id: 'a', start_date: '2026-12-07T00:00:00+00:00', end_date: '2026-12-13T00:00:00+00:00' },
    { id: 'b', start_date: '2027-07-01T00:00:00+00:00', end_date: '2027-07-01T00:00:00+00:00' },
    { id: 'c', start_date: '2026-11-10T00:00:00+00:00', end_date: '2026-11-20T00:00:00+00:00' },
    { id: 'e', start_date: '2026-12-01T00:00:00+00:00', end_date: '2026-12-01T00:00:00+00:00' },
    { id: 'f', start_date: '2026-12-02T00:00:00+00:00', end_date: '2026-12-02T00:00:00+00:00' },
    { id: 'd', start_date: '2026-11-01T00:00:00+00:00', end_date: '2026-11-05T00:00:00+00:00' },
  ];
  assert.deepEqual(aktuelleAbwesenheiten(zeilen, '2026-11-17').map(z => z.id), ['c', 'e']);
  assert.equal(datumMitJahr('2026-12-31T00:00:00+00:00'), '31.12.2026');
  assert.equal(abwesenheitTyp('urlaub'), 'Urlaub');
});

test('wochenAuslastungAufbereiten: zählt 7 Tage inkl. Hausbesuche, ignoriert stornierte', () => {
  const jetzt = new Date('2026-11-19T09:00:00Z');
  const w = wochenAuslastungAufbereiten([
    { start_time: '2026-11-19T08:00:00Z', status: 'completed', hausbesuch: false },
    { start_time: '2026-11-19T12:00:00Z', status: 'confirmed', hausbesuch: true },
    { start_time: '2026-11-19T14:00:00Z', status: 'cancelled', hausbesuch: false },
    { start_time: '2026-11-20T10:00:00Z', status: 'confirmed', hausbesuch: false },
    { start_time: '2026-11-20T11:00:00Z', status: 'confirmed', hausbesuch: false },
  ], '2026-11-19', jetzt);
  assert.equal(w.tage.length, 7);
  assert.equal(w.heuteGesamt, 2);
  assert.equal(w.heuteOffen, 1);
  assert.equal(w.heuteHausbesuche, 1);
  assert.equal(w.gesamt7, 4);
  assert.equal(w.hausbesuche7, 1);
  assert.equal(w.tage[0].prozent, 33); // Untergrenze 6: 2 Termine sind kein voller Balken
  assert.equal(w.tage[2].prozent, 0);
});

test('fristenAuswerten & therapieberichteAufbereiten', () => {
  const heute = '2026-11-19';
  const rezepte = [
    {
      id: 'rx-1', patient_id: 'p-anna', ausstellungsdatum: '2026-11-03', behandlungsbeginn: null,
      is_dringend: false, heilmittel: 'KG', diagnosegruppe: 'WS2', therapie_bereich: 'physio',
      bericht_angefordert: false, bericht_status: 'offen',
      leads: { id: 'p-anna', first_name: 'Anna', last_name: 'Beispiel' },
    },
    {
      id: 'rx-2', patient_id: 'p-anna', ausstellungsdatum: '2026-11-03', behandlungsbeginn: null,
      is_dringend: false, heilmittel: 'KG', diagnosegruppe: 'WS2', therapie_bereich: 'physio',
      bericht_angefordert: true, bericht_status: 'offen',
      leads: { id: 'p-anna', first_name: 'Anna', last_name: 'Beispiel' },
    },
    {
      id: 'rx-3', patient_id: 'p-joerg', ausstellungsdatum: '2026-11-01', behandlungsbeginn: null,
      is_dringend: true, heilmittel: 'MT', diagnosegruppe: 'EX2', therapie_bereich: 'physio',
      bericht_angefordert: true, bericht_status: 'erledigt',
      leads: { id: 'p-joerg', first_name: 'Jörg', last_name: 'Müller' },
    },
    {
      id: 'rx-4', patient_id: 'p-clara', ausstellungsdatum: '2026-10-28', behandlungsbeginn: null,
      is_dringend: false, heilmittel: 'Podologische Komplexbehandlung', diagnosegruppe: 'DF', therapie_bereich: 'podo',
      leads: { id: 'p-clara', first_name: 'Clara', last_name: 'Weber' },
    },
    {
      id: 'rx-5', patient_id: 'p-bernd', ausstellungsdatum: '2026-03-01', behandlungsbeginn: '2026-03-10',
      is_dringend: false, heilmittel: 'MLD', diagnosegruppe: 'LY', therapie_bereich: 'physio',
      leads: { id: 'p-bernd', first_name: 'Bernd', last_name: 'Schmidt' },
    },
  ];

  const erg = fristenAuswerten(rezepte, heute);
  assert.equal(erg.length, 4);
  assert.equal(erg[0].kategorie, 'ueberfaellig');
  assert.equal(erg[0].tageDiff, -4);
  assert.equal(erg[1].kategorie, 'bald');
  assert.equal(erg[1].quelle, 'podologie');
  assert.equal(erg[2].kategorie, 'geplant');
  assert.equal(erg[2].anzahl, 2);
  assert.equal(erg[3].kategorie, 'abrechnung');

  const berichte = therapieberichteAufbereiten(rezepte);
  assert.equal(berichte.length, 1);
  assert.equal(berichte[0].rxId, 'rx-2');
});

test('F-01 rezKpiAuswerten: Dashboard und Überblick liefern identische Zahlen inkl. Entwurf und ohne geschlossene VOs', () => {
  const heute = '2026-11-21';
  // 28 Tage ab 2026-10-28 = 2026-11-25 (in 4 Tagen <= 7 Tage)
  const rezepte = [
    {
      id: 'rx-entwurf', patient_id: 'p-1', status: 'parsed', gueltig_bis: null,
      ausstellungsdatum: '2026-10-28', behandlungsbeginn: null, is_dringend: false,
      heilmittel: 'KG', diagnosegruppe: 'WS2', therapie_bereich: 'physio',
      leads: { id: 'p-1', first_name: 'Änne', last_name: 'TEST-Größer' },
    },
    {
      id: 'rx-bestaetigt', patient_id: 'p-2', status: 'confirmed', gueltig_bis: null,
      ausstellungsdatum: '2026-10-28', behandlungsbeginn: null, is_dringend: false,
      heilmittel: 'MT', diagnosegruppe: 'EX2', therapie_bereich: 'physio',
      leads: { id: 'p-2', first_name: 'Jörg', last_name: 'TEST-Müller' },
    },
    {
      id: 'rx-therapie-1', patient_id: 'p-3', status: 'in_therapy', gueltig_bis: null,
      ausstellungsdatum: '2026-10-20', behandlungsbeginn: '2026-11-01', is_dringend: false,
      therapie_bereich: 'physio',
    },
    {
      id: 'rx-therapie-2', patient_id: 'p-4', status: 'in_therapy', gueltig_bis: null,
      ausstellungsdatum: '2026-10-22', behandlungsbeginn: '2026-11-05', is_dringend: false,
      therapie_bereich: 'physio',
    },
    // Stornierte VO darf NICHT zählen (auch wenn fristnah)
    {
      id: 'rx-storno', patient_id: 'p-5', status: 'cancelled', gueltig_bis: null,
      ausstellungsdatum: '2026-10-20', behandlungsbeginn: null, is_dringend: false,
      therapie_bereich: 'physio',
    },
    // Bereits bezahlte Podologie-VO (status='confirmed', abrechnung_status='paid') darf NICHT zählen
    {
      id: 'rx-podo-paid', patient_id: 'p-6', status: 'confirmed', abrechnung_status: 'paid',
      ausstellungsdatum: '2026-10-20', behandlungsbeginn: null, is_dringend: false,
      therapie_bereich: 'podo',
    },
  ];

  const kpi = rezKpiAuswerten(rezepte, heute);
  const ublFristen = fristenAuswerten(rezepte, heute);
  assert.equal(kpi.overdue.length, 0);
  assert.equal(kpi.soon.length, 2);
  assert.equal(kpi.active.length, 2);
  assert.equal(kpi.soon.length, ublFristen.filter(f => f.kategorie === 'bald').length);
  assert.equal(kpi.overdue.length, ublFristen.filter(f => f.kategorie === 'ueberfaellig').length);
  assert.deepEqual(kpi.soon.map(x => x.patient_id).sort(), ['p-1', 'p-2']);

  // Leere Praxis
  const leer = rezKpiAuswerten([], heute);
  assert.equal(leer.overdue.length, 0);
  assert.equal(leer.soon.length, 0);
  assert.equal(leer.active.length, 0);
});

test('anfragenAufbereiten, wartelisteAufbereiten, aufgabenAufbereiten, rechnungenAufbereiten', () => {
  const heute = '2026-11-19';
  const anf = anfragenAufbereiten([
    { id: 'a1', preferred_date: '2026-11-24', preferred_time: '10:00:00', payment_type: 'gkv', behandlungsart: 'KG', created_at: '2026-11-18T10:00:00Z', patients: { vorname: 'Lea', nachname: 'Koch' } },
  ], heute);
  assert.equal(anf[0].name, 'Lea Koch');
  assert.equal(anf[0].art, 'GKV');
  assert.equal(anf[0].alterLabel, 'Gestern');

  const wl = wartelisteAufbereiten([
    { id: 'w1', lead_id: 'l1', priority: 1, created_at: '2026-11-15T10:00:00Z', leads: { first_name: 'Berta', last_name: 'Neu' }, services: { title: 'MT' } },
    { id: 'w2', lead_id: 'l2', priority: 3, created_at: '2026-11-19T08:00:00Z', leads: { first_name: 'Anton', last_name: 'Eilig' }, services: { title: 'KG' } },
  ], heute);
  assert.equal(wl[0].name, 'Anton Eilig');
  assert.equal(wl[0].prioLabel, 'Dringend');

  const aufg = aufgabenAufbereiten([
    { id: 't1', text: 'Kasse anrufen', faellig_am: '2026-11-25', leads: null },
    { id: 't2', text: 'Rezept nachfordern', faellig_am: '2026-11-17', lead_id: 'l1', leads: { first_name: 'Karin', last_name: 'Hoffmann' } },
  ], heute);
  assert.equal(aufg[0].id, 't2');
  assert.equal(aufg[0].ueberfaellig, true);
  assert.equal(aufg[0].faelligLabel, '2 T. überfällig');

  const rech = rechnungenAufbereiten([
    { id: 'r1', invoice_number: 'RE-2026-0142', patient_name: 'Max Muster', issued_at: '2026-11-01', brutto_gesamt: 310.5 },
    { id: 'r2', invoice_number: 'RE-2026-0150', patient_name: 'Lisa Klein', issued_at: '2026-11-15', brutto_gesamt: 89.5 },
  ], heute);
  assert.equal(rech.summeEur, 400);
  assert.equal(rech.ueberfaelligAnzahl, 1);
  assert.equal(rech.liste[0].ueberfaellig, true);
});

test('geburtstageAufbereiten, abwesenheitenAufbereiten, nichtErscheinerAufbereiten', () => {
  const leads = [
    { id: '1', first_name: 'Sabine', last_name: 'Kurz', geburtsdatum: '1980-12-28' },
    { id: '2', first_name: 'Max', last_name: 'Winter', geburtsdatum: '1990-01-03' },
    { id: '3', first_name: 'Lena', last_name: 'Spät', geburtsdatum: '1975-01-20' },
  ];
  const r7 = geburtstageAufbereiten(leads, '2026-12-28', 7);
  assert.equal(r7.length, 2);
  assert.equal(r7[0].istHeute, true);
  assert.equal(r7[0].alterWird, 46);
  assert.equal(r7[1].tageBis, 6);
  assert.equal(geburtstageAufbereiten(leads, '2026-12-28', 30).length, 3);

  const abw = abwesenheitenAufbereiten([
    { id: '1', start_date: '2026-12-10T00:00:00Z', end_date: '2026-12-12T00:00:00Z', type: 'urlaub', profiles: { business_name: 'Anna Berg' } },
    { id: '2', start_date: '2026-11-18T00:00:00Z', end_date: '2026-11-22T00:00:00Z', type: 'krank', profiles: { business_name: 'Tom Klein' } },
  ], '2026-11-19', 30);
  assert.equal(abw[0].name, 'Tom Klein');
  assert.equal(abw[0].istAktiv, true);

  // F-07 / 9.6: Kachel rechnet fest auf 14 Tage mit Untertitel „heute aktiv: X“
  const abw14 = abwesenheitenAufbereiten([
    { id: '1', start_date: '2026-12-07T00:00:00Z', end_date: '2026-12-13T00:00:00Z', type: 'urlaub', profiles: { business_name: 'QA Testtherapeut' } },
  ], '2026-11-21', 14);
  const kachel0 = abwesenheitKachelAuswerten(abw14);
  assert.equal(kachel0.anzahl, 0);
  assert.equal(kachel0.heuteAktiv, 0);
  assert.equal(kachel0.untertitel, 'heute aktiv: 0');

  const kachelAktiv = abwesenheitKachelAuswerten(abw.slice(0, 1), { aufgabenAnzahl: 2, ueberfAufgaben: 1 });
  assert.equal(kachelAktiv.anzahl, 1);
  assert.equal(kachelAktiv.heuteAktiv, 1);
  assert.equal(kachelAktiv.untertitel, 'heute aktiv: 1 · 2 Aufgaben (1 fällig)');

  const kachelZukunft = abwesenheitKachelAuswerten([{ istAktiv: false }]);
  assert.equal(kachelZukunft.anzahl, 1);
  assert.equal(kachelZukunft.untertitel, 'heute aktiv: 0');

  const ns = nichtErscheinerAufbereiten([
    { id: 'b1', lead_id: 'l1', customer_name: 'Paul Muster', start_time: '2026-11-18T13:30:00Z', services: { title: 'Krankengymnastik' } },
  ], '2026-11-19');
  assert.equal(ns[0].vorText, 'Gestern');
  assert.equal(initialen('Jörg TEST-Müller'), 'JT');
  assert.equal(suchePasst('müller', ['Jörg Müller', 'KG']), true);
});

test('telefonLink & rezeptPruefbedarfAufbereiten (Absetzungen vor Scans)', () => {
  assert.deepEqual(telefonLink('+49 171 / 123-4567'), { anzeige: '+49 171 / 123-4567', href: 'tel:+491711234567' });
  assert.equal(telefonLink('123'), null);
  assert.equal(telefonLink('javascript:alert(1)'), null);

  const p = rezeptPruefbedarfAufbereiten([
    { id: 'r1', status: 'parsed', abrechnung_status: null, ausstellungsdatum: '2026-11-18', heilmittel: 'KG', leads: { first_name: 'Anna', last_name: 'Scan' } },
    { id: 'r2', status: 'confirmed', abrechnung_status: 'rejected', ausstellungsdatum: '2026-10-10', heilmittel: 'MT', leads: { first_name: 'Bernd', last_name: 'Kasse' } },
    { id: 'r2b', status: 'confirmed', abrechnung_status: 'teilabsetzung', ausstellungsdatum: '2026-10-12', heilmittel: 'KG', leads: { first_name: 'Clara', last_name: 'Teil' } },
    { id: 'r3', status: 'confirmed', abrechnung_status: 'bereit', ausstellungsdatum: '2026-11-01', heilmittel: 'MLD', leads: { first_name: 'Ok', last_name: 'Fall' } },
    // Nicht existierender Altstring 'absetzung' darf nicht als Absetzung matchen
    { id: 'r4', status: 'confirmed', abrechnung_status: 'absetzung', ausstellungsdatum: '2026-10-11', heilmittel: 'KG', leads: { first_name: 'Alt', last_name: 'String' } },
    // Geschlossene stornierte VO darf nicht in Prüfbedarf landen
    { id: 'r5', status: 'cancelled', abrechnung_status: 'rejected', ausstellungsdatum: '2026-10-11', heilmittel: 'KG', leads: { first_name: 'Storno', last_name: 'Fall' } },
  ]);
  assert.equal(p.length, 3);
  assert.equal(p[0].art, 'absetzung');
  assert.equal(p[0].etikett, 'Absetzung');
  assert.equal(p[0].schwere, 'danger');
  assert.equal(p[1].art, 'absetzung');
  assert.equal(p[1].etikett, 'Teilabsetzung');
  assert.equal(p[1].schwere, 'danger');
  assert.equal(p[2].art, 'scan');
  assert.equal(p[2].schwere, 'warning');
});

test('Überblick-Ansicht und Panel-Markup enthalten keine Emojis', () => {
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
  const html = fs.readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  const start = html.indexOf('id="panel-ueberblick"');
  const end = html.indexOf('</section>', start);
  assert.ok(start > 0 && end > start, 'panel-ueberblick im HTML vorhanden');
  assert.equal(emojiRe.test(html.slice(start, end)), false, 'panel-ueberblick ohne Emojis');

  const ansicht = fs.readFileSync(new URL('./ueberblick-ansicht.js', import.meta.url), 'utf8');
  assert.equal(emojiRe.test(ansicht), false, 'ueberblick-ansicht.js ohne Emojis');
});
