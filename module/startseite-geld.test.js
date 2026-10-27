import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summeText, monatText, geldKarteHtml, holeGeld, zuzahlungHtml, unbekanntHinweis } from './startseite-geld.js';

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
  assert.doesNotMatch(html, /geld-neu/, 'letzte gute Zahlen bleiben bei Fehler stehen');
  assert.doesNotMatch(geldKarteHtml({ daten: { umfang: { patient: '<b>x</b>' } } }), /<b>x/);
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
