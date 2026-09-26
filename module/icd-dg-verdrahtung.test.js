/**
 * icd-dg-verdrahtung.test.js — ICD ↔ Diagnosegruppe in der Muster-13-Maske.
 *
 * Spielt die Szenarien aus canli-test/REGISTER.md (Ops #304) gegen die echte
 * Verdrahtung durch — mit einem Mini-DOM (EventTarget) und einem Supabase-
 * Ersatz, der die Podologie-Zeilen der Tabelle `diagnosegruppen` liefert
 * (Stand Prod 26.09.2026). Ersetzt keinen Klickdurchgang: kein echtes
 * Fokus-/Blur-Verhalten, keine Katalogsuche, kein module/verordnung-podo.js.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdrahteIcdDg, icdAufZweiFelder, icdKodesAusFeld } from './icd-dg-verdrahtung.js';

const ZEILEN = [
  { code: 'DF', bereich: 'podologie', icd_enforcement: 'warn',
    icd_accept: [{ re: '^E1[0-4]\\.7[45]$' }, { re: '^E1[0-4]\\.4[01]$' }, { re: '^G63\\.2\\*?$' }],
    icd_exclude: [],
    icd_auto_select: [{ re: '^E1[0-4]\\.7[45]$' }, { re: '^E1[0-4]\\.4[01]$' }, { re: '^G63\\.2\\*?$' }],
    icd_accept_unsicher: [{ re: '^E1[0-4]\\.7[23]$' }] },
  { code: 'NF', bereich: 'podologie', icd_enforcement: 'warn',
    icd_accept: [{ re: '^G60\\.' }, { re: '^G61\\.' }, { re: '^G62\\.' }, { re: '^G63\\.[013-68]\\*?$' }],
    icd_exclude: [{ re: '^G63\\.2\\*?$' }, { re: '^E1[0-4]\\.' }],
    icd_auto_select: [{ re: '^G6[012]\\.' }, { re: '^G63\\.[013-68]\\*?$' }],
    icd_accept_unsicher: [] },
  { code: 'UI1', bereich: 'podologie', icd_enforcement: 'hard_before_dta',
    icd_accept: [{ re: '^L60\\.0$', note: 'Unguis incarnatus — ausschließlich zulässiger Kode' }],
    icd_exclude: [], icd_auto_select: [], icd_accept_unsicher: [] },
  { code: 'UI2', bereich: 'podologie', icd_enforcement: 'hard_before_dta',
    icd_accept: [{ re: '^L60\\.0$', note: 'Unguis incarnatus — ausschließlich zulässiger Kode' }],
    icd_exclude: [], icd_auto_select: [], icd_accept_unsicher: [] },
];

const supabase = {
  from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: ZEILEN, error: null }) }) }) }),
};
const warteLange = () => new Promise(r => setTimeout(r, 5));
const TEXTE = {
  pod_dg_kandidaten: 'Passende Diagnosegruppen:',
  pod_icd_mismatch: 'Der ICD benennt nicht die für diese Diagnosegruppe geforderte Diagnose',
  pod_icd_nach_feld2: '2. Code nach ICD 2 übernommen',
  pod_icd_je_feld: 'Mehr als zwei ICD-Codes: übertragen werden zwei (je Feld einer) – weitere bitte in den Diagnosetext',
};
const t = k => TEXTE[k] || k;

class Feld extends EventTarget {
  constructor(id) { super(); this.id = id; this.value = ''; this.dataset = {}; this.tagName = 'INPUT'; this.style = {}; this.textContent = ''; }
}

const warte = () => new Promise(r => setTimeout(r, 0));

/** Frische Maske je Test; `d.dg` usw. sind die Felder. */
async function maske({ dg = '', bereich = 'podo' } = {}) {
  const f = { rzIcd: new Feld('rzIcd'), rzIcd2: new Feld('rzIcd2'), rzDg: new Feld('rzDg'), rzIcdDgWarning: new Feld('rzIcdDgWarning'),
              rzTherapieBereich: new Feld('rzTherapieBereich') };
  f.rzDg.value = dg;
  f.rzTherapieBereich.value = bereich;
  globalThis.document = { getElementById: id => f[id] || null };
  // wie dashboard.js `_verdrahteIcdPaar`: Bereich der Maske, sonst der des Mandanten
  const mandant = 'praxis';
  verdrahteIcdDg({ icdId: 'rzIcd', icd2Id: 'rzIcd2', dgId: 'rzDg', warnId: 'rzIcdDgWarning',
                   bereich: () => f.rzTherapieBereich.value || mandant, supabase, t });
  const tippe = async (feld, v) => { f[feld].value = v; f[feld].dispatchEvent(new Event('input')); await warte(); };
  const verlasse = async (feld) => { f[feld].dispatchEvent(new Event('change')); await warteLange(); };
  const eingabe = async (feld, v) => { await tippe(feld, v); await verlasse(feld); };
  const hinweis = () => (f.rzIcdDgWarning.style.display === 'block' ? f.rzIcdDgWarning.textContent : '');
  return { f, tippe, verlasse, eingabe, hinweis };
}

// ── reine Hilfen ────────────────────────────────────────────────────────────

test('icdKodesAusFeld: Komma, Semikolon, Leerzeichen, Titel mit Komma, doppelt', () => {
  assert.deepEqual(icdKodesAusFeld('E11.74, L60.0'), ['E11.74', 'L60.0']);
  assert.deepEqual(icdKodesAusFeld('E11.74;L60.0'), ['E11.74', 'L60.0']);
  assert.deepEqual(icdKodesAusFeld('E11.74 L60.0'), ['E11.74', 'L60.0']);
  assert.deepEqual(icdKodesAusFeld('E11.74 – Diabetes mellitus, Typ 2: Mit diabetischem Fußsyndrom'), ['E11.74']);
  assert.deepEqual(icdKodesAusFeld('E11.74 – Diabetes mellitus, Typ 2, L60.0'), ['E11.74', 'L60.0']);
  assert.deepEqual(icdKodesAusFeld('e11.74, E11.74'), ['E11.74']);
  assert.deepEqual(icdKodesAusFeld('Diabetiker'), []);
});

test('icdAufZweiFelder: verteilt nur zwei Kodes in ein leeres zweites Feld', () => {
  assert.deepEqual(icdAufZweiFelder('E11.74, L60.0', ''), { feld1: 'E11.74', feld2: 'L60.0', verschoben: true, zuViele: false });
  assert.equal(icdAufZweiFelder('E11.74 – Diabetes mellitus, Typ 2', '').verschoben, false);
  assert.equal(icdAufZweiFelder('E11.74', 'L60.0').verschoben, false);
  assert.equal(icdAufZweiFelder('E11.74, L60.0', 'G63.2').zuViele, true);
  assert.equal(icdAufZweiFelder('E11.74, L60.0, G63.2', '').zuViele, true);
});

// ── Szenarien canli-test/REGISTER.md (Ops #304) ─────────────────────────────

test('a) leere DG, E11.74 → DF als Vorschlag', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'E11.74');
  assert.equal(m.f.rzDg.value, 'DF');
  assert.equal(m.f.rzDg.dataset.dgAuto, 'DF');
  assert.equal(m.hinweis(), '');
});

test('b) geladene NF bleibt, Warnung nennt die passende Gruppe', async () => {
  const m = await maske({ dg: 'NF' });
  await m.eingabe('rzIcd', 'E11.74');
  assert.equal(m.f.rzDg.value, 'NF');
  assert.match(m.hinweis(), /^Der ICD benennt nicht .*: E11\.74 \(NF\).* · Passende Diagnosegruppen: DF$/);
});

test('c) DG von Hand geleert → sofort neuer Vorschlag, ohne ICD anzufassen', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'E11.74');
  m.f.rzDg.value = ''; m.f.rzDg.dispatchEvent(new Event('change')); await warteLange();
  assert.equal(m.f.rzDg.value, 'DF');
  assert.equal(m.f.rzDg.dataset.dgAuto, 'DF');
});

test('Fachbereich der Maske zählt: Podologie angekreuzt bei Mandant „praxis" → DF', async () => {
  const m = await maske({ bereich: 'podo' });
  await m.eingabe('rzIcd', 'E11.74');
  assert.equal(m.f.rzDg.value, 'DF');
});

test('Maske auf Physio: keine Podologie-Regeln → kein DF', async () => {
  const m = await maske({ bereich: 'physio' });
  await m.eingabe('rzIcd', 'E11.74');
  assert.equal(m.f.rzDg.value, '');
});

test('von Podologie auf Physio umgekreuzt → eigener Vorschlag wird zurückgenommen', async () => {
  const m = await maske({ bereich: 'podo' });
  await m.eingabe('rzIcd', 'E11.74');
  assert.equal(m.f.rzDg.value, 'DF');
  m.f.rzTherapieBereich.value = 'physio';
  await m.verlasse('rzIcd');            // dashboard.js stösst beim Umkreuzen `change` an
  assert.equal(m.f.rzDg.value, '');
});

test('von Podologie auf Physio umgekreuzt → geladene DG bleibt', async () => {
  const m = await maske({ bereich: 'podo', dg: 'DF' });
  await m.eingabe('rzIcd', 'E11.74');
  m.f.rzTherapieBereich.value = 'physio';
  await m.verlasse('rzIcd');
  assert.equal(m.f.rzDg.value, 'DF');
});

test('d) E11.74, L60.0 in einem Feld → aufgeteilt, keine DG, Kandidaten', async () => {
  const m = await maske();
  await m.tippe('rzIcd', 'E11.74');
  await m.eingabe('rzIcd', 'E11.74, L60.0');
  assert.equal(m.f.rzIcd.value, 'E11.74');
  assert.equal(m.f.rzIcd2.value, 'L60.0');
  assert.equal(m.f.rzDg.value, '');
  assert.equal(m.hinweis(), '2. Code nach ICD 2 übernommen · Passende Diagnosegruppen: DF, UI1, UI2');
});

test('d2) E11.74 → DF, dann L60.0 im zweiten Feld → DF zurückgenommen', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'E11.74');
  assert.equal(m.f.rzDg.value, 'DF');
  await m.eingabe('rzIcd2', 'L60.0');
  assert.equal(m.f.rzDg.value, '');
  assert.equal(m.f.rzDg.dataset.dgAuto, undefined);
  assert.equal(m.hinweis(), 'Passende Diagnosegruppen: DF, UI1, UI2');
});

test('d2) E11.74 → DF, dann „, L60.0" ergänzt → DF zurückgenommen', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'E11.74');
  await m.eingabe('rzIcd', 'E11.74, L60.0');
  assert.equal(m.f.rzDg.value, '');
  assert.match(m.hinweis(), /Passende Diagnosegruppen: DF, UI1, UI2$/);
});

test('d2) zweiten Kode wieder löschen → DF kommt zurück', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'E11.74');
  await m.eingabe('rzIcd2', 'L60.0');
  await m.eingabe('rzIcd2', '');
  assert.equal(m.f.rzDg.value, 'DF');
});

test('e) Z99.9 → keine DG', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'Z99.9');
  assert.equal(m.f.rzDg.value, '');
});

test('f) E11.72 → kein DF (nur „unsicher")', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'E11.72');
  assert.equal(m.f.rzDg.value, '');
});

test('L60.0 allein → keine DG, Kandidaten UI1, UI2', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'L60.0');
  assert.equal(m.f.rzDg.value, '');
  assert.equal(m.hinweis(), 'Passende Diagnosegruppen: UI1, UI2');
});

test('Klick ins DG-Feld (input ohne change) schaltet die Automatik nicht ab', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'E11.74');
  m.f.rzDg.dispatchEvent(new Event('input')); await warte();
  await m.eingabe('rzIcd2', 'L60.0');
  assert.equal(m.f.rzDg.value, '');
});

test('DF von Hand gewählt bleibt, auch bei mehrdeutigem ICD', async () => {
  const m = await maske();
  m.f.rzDg.value = 'DF'; m.f.rzDg.dispatchEvent(new Event('change')); await warte();
  await m.eingabe('rzIcd', 'E11.74');
  await m.eingabe('rzIcd2', 'L60.0');
  assert.equal(m.f.rzDg.value, 'DF');
});

test('drei Kodes → nichts verschoben, Hinweis je Feld einen Code', async () => {
  const m = await maske();
  await m.eingabe('rzIcd', 'E11.74, L60.0, G63.2');
  assert.equal(m.f.rzIcd2.value, '');
  assert.match(m.hinweis(), /^Mehr als zwei ICD-Codes: übertragen werden zwei/);
  assert.equal(m.f.rzDg.value, '');
});
