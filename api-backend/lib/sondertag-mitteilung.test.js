import test from 'node:test';
import assert from 'node:assert/strict';
import {
  datenschutzVersion, mailErlaubt, tageVonBis, geschlosseneTage, betroffene, einteilen, mitteilungsText,
  istEinzelneEmail, istUuid, MITTEILUNG_OPTION_TEXT, protokollZustand, IN_ARBEIT,
} from './sondertag-mitteilung.js';

const JA = `[X] ${MITTEILUNG_OPTION_TEXT}: JA`;
const einw = (version, zeile, extra = {}) => ({ consent_type: 'datenschutz', text_version: version, text_snapshot: `Kopf\n${zeile}\n[ ] Anderes: NEIN`, consented_at: '2026-11-01T10:00:00Z', revoked_at: null, ...extra });

test('Version als Zahl: v10 > v6 (String-Vergleich waere falsch)', () => {
  assert.equal(datenschutzVersion('datenschutz-v6-2026-11-05'), 6);
  assert.equal(datenschutzVersion('datenschutz-v10-2027-01-01'), 10);
  assert.equal(datenschutzVersion('termin-datenschutz-v3-2026-10-12'), null);
  assert.equal(datenschutzVersion(null), null);
});

test('Opt-in: nur v6+ mit exakt angekreuzter Option, nicht widerrufen', () => {
  assert.equal(mailErlaubt([einw('datenschutz-v6-2026-11-05', JA)]), true);
  assert.equal(mailErlaubt([einw('datenschutz-v10-2027-01-01', JA)]), true);
  assert.equal(mailErlaubt([einw('datenschutz-v5-2026-10-30', JA)]), false, 'v5 deckt nur Erinnerungen');
  assert.equal(mailErlaubt([einw('datenschutz-v6-2026-11-05', `[ ] ${MITTEILUNG_OPTION_TEXT}: NEIN`)]), false);
  assert.equal(mailErlaubt([einw('datenschutz-v6-2026-11-05', JA, { revoked_at: '2026-11-02T00:00:00Z' })]), false);
  assert.equal(mailErlaubt([]), false);
  assert.equal(mailErlaubt(undefined), false);
});

test('Opt-in: neueste Einwilligung zaehlt (spaetere ohne Haekchen ersetzt fruehere mit)', () => {
  const alt = einw('datenschutz-v6-2026-11-05', JA, { consented_at: '2026-11-01T10:00:00Z' });
  const neu = einw('datenschutz-v6-2026-11-05', `[ ] ${MITTEILUNG_OPTION_TEXT}: NEIN`, { consented_at: '2026-11-03T10:00:00Z' });
  assert.equal(mailErlaubt([alt, neu]), false);
  assert.equal(mailErlaubt([neu, alt].reverse()), false);
});

test('E-Mail: genau eine Adresse', () => {
  assert.equal(istEinzelneEmail('a@b.de'), true);
  assert.equal(istEinzelneEmail('a@b.de, c@d.de'), false);
  assert.equal(istEinzelneEmail('a@b.de;c@d.de'), false);
  assert.equal(istEinzelneEmail('a@@b.de'), false);
  assert.equal(istEinzelneEmail('a@b.de\nBcc: x@y.de'), false);
  assert.equal(istEinzelneEmail(''), false);
  assert.equal(istUuid('11111111-1111-4111-8111-111111111111'), true);
  assert.equal(istUuid('1; drop'), false);
});

test('Zeitraum und geschlossene Tage', () => {
  assert.deepEqual(tageVonBis('2026-12-24', '2026-12-26'), ['2026-12-24', '2026-12-25', '2026-12-26']);
  assert.equal(tageVonBis('2026-01-01', '2026-03-01'), null);
  assert.equal(tageVonBis('kaputt'), null);
  const tage = geschlosseneTage([
    { date: '2026-12-24', type: 'closed' }, { date: '2026-12-25', type: 'holiday' },
    { date: '2026-12-26', type: 'closed', start_time: '08:00', end_time: '12:00' }, { date: '2026-12-27', type: 'special' },
  ]);
  assert.deepEqual(tage.map(t => t.date), ['2026-12-24', '2026-12-25']);
});

test('Betroffene: Zukunft, nicht abgesagt, kein Gruppenkind, Berliner Tag, Standort passt', () => {
  const tage = [{ id: 't1', date: '2026-12-24', type: 'closed', business_id: 'A' }];
  const termine = [
    { id: 'b1', start_time: '2026-12-24T09:00:00Z', business_id: 'A' },
    { id: 'b2', start_time: '2026-12-24T09:00:00Z', business_id: 'B' },
    { id: 'b3', start_time: '2026-12-24T10:00:00Z', business_id: null },
    { id: 'b4', start_time: '2026-12-24T11:00:00Z', business_id: 'A', status: 'cancelled' },
    { id: 'b5', start_time: '2026-12-24T12:00:00Z', business_id: 'A', group_parent_id: 'x' },
    { id: 'b6', start_time: '2026-12-23T23:30:00Z', business_id: 'A' }, // = 24.12. 00:30 Berlin
    { id: 'b7', start_time: '2026-12-24T23:30:00Z', business_id: 'A' }, // = 25.12. Berlin
  ];
  const ids = betroffene(termine, tage, new Date('2026-12-01T00:00:00Z')).map(x => x.termin.id);
  assert.deepEqual(ids, ['b6', 'b1', 'b3']);
  assert.deepEqual(betroffene(termine, tage, new Date('2026-12-24T09:30:00Z')).map(x => x.termin.id), ['b3']);
});

test('Einteilen: Mail nur mit Patient + Einwilligung + Adresse + Versandweg; sonst Anrufliste mit Grund', () => {
  const t = (id, lead) => ({ termin: { id, lead_id: lead, start_time: '2026-12-24T09:00:00Z' }, tag: { id: 'd' } });
  const leads = new Map([['l1', { email: 'a@b.de' }], ['l2', { email: 'a@b.de' }], ['l3', { email: 'kaputt' }]]);
  const ew = new Map([['l1', [einw('datenschutz-v6-2026-11-05', JA)]], ['l3', [einw('datenschutz-v6-2026-11-05', JA)]]]);
  const r = einteilen([t('b1', 'l1'), t('b2', 'l2'), t('b3', 'l3'), t('b4', null), t('b5', 'l1')], leads, ew, protokollZustand([{ booking_id: 'b5', termin_beginn: '2026-12-24T09:00:00+00:00', status: 'gesendet' }]), true);
  assert.deepEqual(r.mail.map(x => x.termin.id), ['b1']);
  assert.deepEqual(r.anruf.map(x => [x.termin.id, x.grund]), [['b2', 'keine_einwilligung'], ['b3', 'keine_email'], ['b4', 'kein_patient']]);
  assert.deepEqual(r.schon.map(x => x.termin.id), ['b5']);
  const ohneWeg = einteilen([t('b1', 'l1')], leads, ew, new Map(), false);
  assert.equal(ohneWeg.anruf[0].grund, 'versand_nicht_eingerichtet');
});

test('Text: Praxis, Datum, Uhrzeit, entfaellt, Rueckruf — keine Anrede mit Namen, Zeilenumbrueche raus', () => {
  const { betreff, text } = mitteilungsText({ praxis: 'Physio\r\nBcc: x', telefon: '0221 123', startIso: '2026-12-24T09:00:00Z' });
  assert.equal(betreff, 'Terminabsage – Physio Bcc: x');
  assert.ok(!/[\r\n]/.test(betreff));
  assert.match(text, /24\.12\.2026 um 10:00 Uhr/);
  assert.match(text, /entfällt leider/);
  assert.match(text, /0221 123/);
  assert.match(text, /^Guten Tag,/);
});

test('Opt-in: neueste widerrufen -> false, kein Rueckfall auf aeltere v6 mit JA (legal-de)', () => {
  const alt = einw('datenschutz-v6-2026-11-05', JA, { consented_at: '2026-11-01T10:00:00Z' });
  const neuWiderrufen = einw('datenschutz-v6-2026-11-05', JA, { consented_at: '2026-11-03T10:00:00Z', revoked_at: '2026-11-04T00:00:00Z' });
  assert.equal(mailErlaubt([alt, neuWiderrufen]), false);
});

test('Text: "bei <Praxis>", kein doppeltes "Praxis Praxis"', () => {
  const { text } = mitteilungsText({ praxis: 'Praxis für Physiotherapie Nord', startIso: '2026-12-24T09:00:00Z' });
  assert.match(text, /um 10:00 Uhr bei Praxis für Physiotherapie Nord entfällt/);
  assert.ok(!/Praxis Praxis/.test(text));
});

test('Dedup je Buchung UND Beginn: verschobener Termin wird wieder angeboten (Review 02.11.)', () => {
  const lead = new Map([['l1', { email: 'a@b.de' }]]);
  const ew = new Map([['l1', [einw('datenschutz-v6-2026-11-02', JA)]]]);
  const verschoben = [{ termin: { id: 'b1', lead_id: 'l1', start_time: '2026-12-24T10:00:00Z' }, tag: {} }];
  const alt = protokollZustand([{ booking_id: 'b1', termin_beginn: '2026-12-24T09:00:00Z', status: 'gesendet' }]);
  const r = einteilen(verschoben, lead, ew, alt, true);
  assert.equal(r.mail.length, 1);
  assert.equal(r.schon.length, 0);
});

test('Protokoll: IN_ARBEIT = unklar -> Anrufliste, nie Mail; echter Fehler -> wieder versendbar', () => {
  const lead = new Map([['l1', { email: 'a@b.de' }]]);
  const ew = new Map([['l1', [einw('datenschutz-v6-2026-11-02', JA)]]]);
  const liste = [{ termin: { id: 'b1', lead_id: 'l1', start_time: '2026-12-24T09:00:00Z' }, tag: {} }];
  const unklar = einteilen(liste, lead, ew, protokollZustand([{ booking_id: 'b1', termin_beginn: '2026-12-24T09:00:00Z', status: 'fehler', fehler_code: IN_ARBEIT }]), true);
  assert.deepEqual(unklar.anruf.map(x => x.grund), ['versand_unklar']);
  assert.equal(unklar.mail.length, 0);
  const fehler = einteilen(liste, lead, ew, protokollZustand([{ booking_id: 'b1', termin_beginn: '2026-12-24T09:00:00Z', status: 'fehler', fehler_code: 'ECONNREFUSED' }]), true);
  assert.equal(fehler.mail.length, 1);
});
