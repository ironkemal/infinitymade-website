// Uçtan uca akış testi — fiyat bekçisi + ajan kararı + kapı (tools/bekci-ajan/SPEC.md §2).
// Niye: parçalar ayrı ayrı test edildi ama aralarındaki sözleşme (bericht → bewerte → yama → kapı)
// 24.11.2026'da bir kez koptu (sprungCodes'ta xmlGueltigAb yoktu, "auto" hiç mümkün değildi).
// Bu test o sözleşmeyi gerçek preise_autoupdate.mjs + gerçek podologie_positions.js kopyasıyla tutar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fuehreAus, BEREICHE } from '../../api-backend/preise_autoupdate.mjs';
import { PODOLOGIE_PREISFENSTER } from '../../api-backend/billing/codes/podologie_positions.js';
import { bewerte } from './preise-bewerten.mjs';
import { yamaKontrol } from './cli.mjs';

const YOL = 'api-backend/billing/codes/podologie_positions.js';
const offen = PODOLOGIE_PREISFENSTER.find(f => f.gueltig_bis === '9999-12-31');
const ORIGINAL = readFileSync(BEREICHE.podologie.datei, 'utf8');
const SPRUNG = '78010';
const neu = Math.round(offen.positionen.find(p => p.hpnr === SPRUNG).preis * 1.30 * 100) / 100;
const XML = offen.positionen.map(p => {
  const preis = p.hpnr === SPRUNG ? neu : p.preis;
  return `<HMP><HMP4>X${String(p.hpnr).slice(1)}</HMP4><Heilmittelbereich>Podologie</Heilmittelbereich><Hoechstpreis>${preis}</Hoechstpreis><Gueltig_ab>2099-07-01</Gueltig_ab><Bezeichnung>${p.label}</Bezeichnung></HMP>`;
}).join('\n');

async function mitKopie(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'bekci-akis-'));
  const ziel = join(dir, 'podologie_positions.js');
  writeFileSync(ziel, ORIGINAL, 'utf8');
  const alt = BEREICHE.podologie.datei;
  BEREICHE.podologie.datei = ziel;
  try { return await fn(ziel); } finally { BEREICHE.podologie.datei = alt; rmSync(dir, { recursive: true, force: true }); }
}

const karar = (preis, extra = {}) => ({
  tur: 'sprung_belegt', guven: 'hoch', ozet: 'Sözleşme metni yeni fiyatı doğruluyor.',
  okunan_rakamlar: [{ code: SPRUNG, preis, zuzahlung: null, gueltig_ab: '2099-07-01', quelle: 'wissensbank/podologie/test.txt', zeile: 10 }],
  neue_positionen: [], erlaube_sprung: [SPRUNG], warnungen: [], ...extra,
});

test('sıçrama raporu: art=sprung, sprungCodes başlangıç tarihini taşıyor', async () => {
  const b = await mitKopie(() => fuehreAus({ xml: XML, dryRun: true }));
  const s = b.needsReview.find(r => r.art === 'sprung');
  assert.ok(s, JSON.stringify(b.needsReview));
  assert.equal(s.sprungCodes[0].code, SPRUNG);
  assert.equal(s.sprungCodes[0].xmlGueltigAb, '2099-07-01');
});

test('çift dikiş tutuyor → auto, yalnız sıçrayan kod serbest', async () => {
  const b = await mitKopie(() => fuehreAus({ xml: XML, dryRun: true }));
  const e = bewerte({ bericht: b, karar: karar(neu) });
  assert.equal(e.karar, 'auto', e.gruende.join(' | '));
  assert.deepEqual(e.erlaubeSprung, [SPRUNG]);
});

test('ajan 1 sent farklı okudu → vaka, otomatik yok', async () => {
  const b = await mitKopie(() => fuehreAus({ xml: XML, dryRun: true }));
  const e = bewerte({ bericht: b, karar: karar(Math.round((neu + 0.01) * 100) / 100) });
  assert.equal(e.karar, 'vaka');
  assert.deepEqual(e.vaka.ek.erlaubeSprung, []);
});

test('ajan emin değil → vaka ama onaylanabilir (ek.erlaubeSprung dolu)', async () => {
  const b = await mitKopie(() => fuehreAus({ xml: XML, dryRun: true }));
  const e = bewerte({ bericht: b, karar: karar(neu, { guven: 'mittel' }) });
  assert.equal(e.karar, 'vaka');
  assert.deepEqual(e.vaka.ek.erlaubeSprung, [SPRUNG]);
});

test('üretilen yama kapıdan geçiyor ve yalnız fiyat dosyasına dokunuyor', async () => {
  await mitKopie(async (ziel) => {
    const b = await fuehreAus({ xml: XML, dryRun: false, erlaubeSprung: new Set([SPRUNG]) });
    assert.equal(b.changed.length, 1, JSON.stringify(b.needsReview));
    const orig = join(tmpdir(), `bekci-orig-${process.pid}.js`);
    writeFileSync(orig, ORIGINAL, 'utf8');
    const r = spawnSync('git', ['diff', '--no-index', '--no-color', orig, ziel], { encoding: 'utf8' });
    rmSync(orig, { force: true });
    // Geçici yolları depo yoluna çevir (workflow'da `git diff -- billing/codes/` aynı başlığı üretir)
    let patch = r.stdout.replace(/\r\n/g, '\n');
    patch = patch.replace(/^diff --git "?a\/[^"\n]+?"? "?b\/[^"\n]+"?$/gm, `diff --git a/${YOL} b/${YOL}`);
    patch = patch.replace(/^--- "?a\/[^"\n]+"?$/gm, `--- a/${YOL}`);
    patch = patch.replace(/^\+\+\+ "?b\/[^"\n]+"?$/gm, `+++ b/${YOL}`);
    patch = patch.replace(/^index .*\n/gm, '');
    const k = yamaKontrol({ patch, preset: 'preise', dateiInhalt: { [YOL]: ORIGINAL } });
    assert.equal(k.ok, true, k.gruende.join(' | ') + '\n' + patch.slice(0, 800));
    assert.ok(k.ozet.length > 0);
  });
});
