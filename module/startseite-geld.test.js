import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summeText, monatText, geldKarteHtml, holeGeld, zuzahlungHtml, unbekanntHinweis, mahnungenHtml } from './startseite-geld.js';

const NBSP = / /g;
const t = (s) => s.replace(NBSP, ' ');

test('summeText: vollständige Summe ohne Hinweis, Tausenderpunkt', () => {
  const r = summeText({ bekanntCent: 123450, gesamtCent: 123450, unbekanntAnzahl: 0 });
  assert.equal(t(r.betrag), '1.234,50 €');
  assert.equal(r.hinweis, '');
});

test('summeText: Unbekannte → Teilsumme + „Gesamtbetrag unbekannt“, nie „mind.“ (Codex V6.F03 P2)', () => {
  // Repro Codex: ungeklärte Kassenkorrektur kann ein Rückfluss sein → 100 € ist keine Untergrenze.
  const r = summeText({ bekanntCent: 10000, gesamtCent: null, unbekanntAnzahl: 1, gruende: ['KASSE_KORREKTUR_UNGEKLAERT'] });
  assert.equal(t(r.betrag), 'Teilsumme 100,00 €');
  assert.equal(r.hinweis, 'Gesamtbetrag unbekannt · 1 Eintrag ungeklärt');
  assert.doesNotMatch(r.betrag + r.hinweis, /mind\.|ohne gültigen Betrag/);
  assert.equal(summeText({ bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: 2 }).hinweis, 'Gesamtbetrag unbekannt · 2 Einträge ungeklärt');
  assert.equal(unbekanntHinweis({ bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: null }), 'Gesamtbetrag unbekannt');
  assert.equal(summeText(null).betrag, '–');
});

test('zuzahlungHtml: Patient, Kasse (E16) und Klärung getrennt, keine gemeinsame Summe (Codex V6.F03 P2)', () => {
  const voll = t(zuzahlungHtml({ bekanntCent: 10000, gesamtCent: 10000, unbekanntAnzahl: 0, patientBekanntCent: 2000, kasseBekanntCent: 7000, klaerungBekanntCent: 1000 }));
  assert.match(voll, /Bei Patienten offen<\/span><span class="zahl">20,00 €/);
  assert.match(voll, /Bei Kasse gefordert<\/span><span class="zahl">70,00 €/);
  assert.match(voll, /In Klärung<\/span><span class="zahl">10,00 €/);
  assert.doesNotMatch(voll, /100,00/);
  const teil = t(zuzahlungHtml({ bekanntCent: 3000, gesamtCent: null, unbekanntAnzahl: 1, patientBekanntCent: 3000, kasseBekanntCent: 0, klaerungBekanntCent: 0 }));
  assert.match(teil, /Teilsumme 30,00 €/);
  assert.match(teil, /In Klärung/);
  assert.match(teil, /Gesamtbetrag unbekannt · 1 Eintrag ungeklärt/);
  assert.doesNotMatch(t(zuzahlungHtml({ bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0, patientBekanntCent: 0, kasseBekanntCent: 0, klaerungBekanntCent: 0 })), /In Klärung/);
});

test('monatText', () => {
  assert.equal(monatText('2026-10'), 'Oktober 2026');
  assert.equal(monatText('2026-13'), '');
  assert.equal(monatText(undefined), '');
});

test('geldKarteHtml: Zustände laden / fehler / Daten; Text aus umfang, Privat/Ausfall als nicht enthalten', () => {
  assert.match(geldKarteHtml({ laden: true }), /werden geladen/);
  assert.match(geldKarteHtml({ fehler: true }), /data-aktion="geld-neu"/);
  const html = geldKarteHtml({ fehler: true, daten: {
    monat: '2026-10', umfang: { patient: 'Kassiert diesen Monat (erfasst im Kassenbuch)' },
    kassiert: { patient: { bekanntCent: 10000, gesamtCent: 10000, unbekanntAnzahl: 0 }, kasse: { bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0 } },
    offen: { zuzahlung: { bekanntCent: 2000, gesamtCent: null, unbekanntAnzahl: 1, patientBekanntCent: 2000, kasseBekanntCent: 0, klaerungBekanntCent: 0 } } } });
  assert.match(html, /Kassiert diesen Monat \(erfasst im Kassenbuch\)/);
  assert.match(html, /Oktober 2026 · alle Standorte/);
  assert.match(html, /Teilsumme 20,00/);
  assert.doesNotMatch(html, /mind\./);
  assert.match(html, /nicht enthalten/);
  assert.match(html, /Mahnstufen gerade nicht verfügbar/, 'Mahnblockfehler bleibt getrennt sichtbar');
  assert.doesNotMatch(geldKarteHtml({ daten: { umfang: { patient: '<b>x</b>' } } }), /<b>x/);
});

const mahndaten = () => ({ stufen: [
  { stufe: 1, anzahl: 2, bekanntAnzahl: 2, rest: { bekanntCent: 7500, gesamtCent: 7500, unbekanntAnzahl: 0 } },
  { stufe: 2, anzahl: null, bekanntAnzahl: 1, rest: { bekanntCent: 2500, gesamtCent: null, unbekanntAnzahl: 1 } },
  { stufe: 3, anzahl: 1, bekanntAnzahl: 1, rest: { bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: 1 } }
] });

test('Mahnstufen: Umfang, Anzahl und aktueller Rest getrennt; Unknown niemals Mindestbetrag', () => {
  const html = t(mahnungenHtml({ daten: mahndaten() }));
  assert.match(html, /Bereits gemahnte Forderungen, aktuell belegter Rest/);
  assert.match(html, /Stufe 1[\s\S]*75,00 €[\s\S]*2 Forderungen/);
  assert.match(html, /Stufe 2[\s\S]*Teilsumme 25,00 €[\s\S]*Gesamtbetrag unbekannt/);
  assert.match(html, /Teilerfassung: 1 bekannte Forderung · Gesamtanzahl unbekannt/);
  assert.match(html, /Unabhängig vom Abrechnungsmonat/);
  assert.match(html, /Stufe 3[\s\S]*Teilsumme 0,00 €[\s\S]*1 Forderung/);
  assert.match(html, /Höchste Stufe je Forderung; kein gemeinsamer Transaktionsstand/);
  assert.doesNotMatch(html, /mind\.|100,00|keine Forderungen/i);
});
test('Mahnstufen: laden, Fehler, leere belegte Stufen und veralteter Stand', () => {
  assert.match(mahnungenHtml({ laden: true }), /werden geladen/);
  assert.match(mahnungenHtml({ fehler: true }), /gerade nicht verfügbar/);
  assert.match(mahnungenHtml({ daten: { stufen: [] } }), /gerade nicht verfügbar/);
  const falsch = mahndaten(); falsch.stufen[0].stufe = 2;
  assert.match(mahnungenHtml({ daten: falsch }), /gerade nicht verfügbar/);
  const leer = { stufen: [1, 2, 3].map(stufe => ({ stufe, anzahl: 0, bekanntAnzahl: 0,
    rest: { bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0 } })) };
  const html = t(mahnungenHtml({ daten: leer }));
  assert.equal((html.match(/0 Forderungen/g) || []).length, 3);
  assert.doesNotMatch(html, /Teilsumme|Gesamtbetrag unbekannt/);
  assert.match(mahnungenHtml({ daten: mahndaten(), fehler: true }), /Zuletzt geladener Stand/);
});
test('Mahnblock-Fetch bleibt unabhängig vom Geldblock', async () => {
  const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic' } } }) } };
  let pfad;
  const daten = mahndaten();
  const result = await holeGeld({ supabase, apiBase: '/api', blockName: 'mahnungen', fetchFn: async u => {
    pfad = u; return { ok: true, json: async () => ({ bloecke: { mahnungen: { status: 'ok', daten } } }) };
  } });
  assert.equal(pfad, '/api/startseite/zusammenfassung?bloecke=mahnungen');
  assert.deepEqual(result, daten);
  await assert.rejects(holeGeld({ supabase, apiBase: '/api', blockName: 'fremd' }), /UNGUELTIGER_BLOCK/);
});

test('holeGeld: Token, Pfad, Blockfehler', async () => {
  const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } };
  let url, opt;
  const ok = async (u, o) => { url = u; opt = o; return { ok: true, json: async () => ({ bloecke: { geld: { status: 'ok', daten: { monat: '2026-10' } } } }) }; };
  assert.deepEqual(await holeGeld({ supabase, apiBase: 'https://x/api/', fetchFn: ok }), { monat: '2026-10' });
  assert.equal(url, 'https://x/api/startseite/zusammenfassung?bloecke=geld');
  assert.equal(opt.headers.Authorization, 'Bearer tok');
  await assert.rejects(holeGeld({ supabase, apiBase: 'https://x/api', fetchFn: async () => ({ ok: false, status: 403 }) }), /HTTP_403/);
  await assert.rejects(holeGeld({ supabase, apiBase: 'https://x/api', fetchFn: async () => ({ ok: true, json: async () => ({ bloecke: { geld: { status: 'fehler' } } }) }) }), /BLOCK/);
  await assert.rejects(holeGeld({ supabase: { auth: { getSession: async () => ({ data: {} }) } }, apiBase: 'x' }), /KEINE_SITZUNG/);
});
