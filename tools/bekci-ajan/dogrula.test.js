// tools/bekci-ajan/dogrula.test.js
// Ne: dogrula.mjs birim testleri (güvenlik kapısı sertleştirme testleri dahil).
// Niye: SPEC.md §3.0 madde 1, 5 ve 6 uyarınca yama doğrulama korkuluklarını,
// iskelet korumasını, sent hassasiyetli rakam karşılaştırmasını ve diff özetini test etmek.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  sha256,
  iskelet,
  parseDiff,
  pruefeYama,
  diffOzet,
  rakamlariKarsilastir,
  PREISE_VERI_SATIRI,
  veriSatiriMi,
} from './dogrula.mjs';
import { fuehreAus, BEREICHE } from '../../api-backend/preise_autoupdate.mjs';
import { PODOLOGIE_PREISFENSTER } from '../../api-backend/billing/codes/podologie_positions.js';

// api-backend/billing/codes/podologie_positions.js dosyasından alınmış gerçek içerik
const PODOLOGIE_ORNEK_ICERIK = `
export const PODOLOGIE_POSITIONS_2025 = Object.freeze([
  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78020', label: 'Podologische Behandlung (groß)',    kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 50.55, zuzahlung: 5.06,  dauer: '50', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78030', label: 'Podologische Befundung',           diagnosegruppen: ['DF','NF','QF'], preis:  3.47, zuzahlung: 0.35,  dauer: null, gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
]);
`.trim();

const PODOLOGIE_YOL = 'api-backend/billing/codes/podologie_positions.js';
const ERLAUBT = [/^api-backend\/billing\/codes\/.*_positions\.js$/];

test('1. sha256 fonksiyonu hex çıktısı üretir', () => {
  const hash = sha256('test');
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
  assert.equal(hash, '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
});

test('2. iskelet tek tırnak, çift tırnak ve sayıları yer tutucuya çevirir', () => {
  const satir = "  { hpnr: '78010', label: \"Podologische\", preis: 35.16, dauer: -10 },";
  const sonuc = iskelet(satir);
  assert.equal(sonuc, "  { hpnr: \u0000S\u0000, label: \u0000S\u0000, preis: \u0000N\u0000, dauer: -\u0000N\u0000 },");
});

test('3. podologie_positions üzerinde yalnız preis değişen yama -> ok', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });

  assert.equal(sonuc.ok, true);
  assert.deepEqual(sonuc.gruende, []);
  assert.equal(sonuc.degisiklikler[PODOLOGIE_YOL].eklenen, 1);
  assert.equal(sonuc.degisiklikler[PODOLOGIE_YOL].silinen, 1);
});

test('4. yeni satır aynı iskelet biçiminde -> ok', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -3,0 +4,1 @@
+  { hpnr: '78040', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 40.00, zuzahlung: 4.00,  dauer: '40', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });

  assert.equal(sonuc.ok, true);
  assert.deepEqual(sonuc.gruende, []);
});

test('5. satıra process.exit() eklenmiş -> ret (bilinmeyen satır biçimi veya yasaklı sözcük)', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -3,0 +4,1 @@
+  process.exit(1);
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });

  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('bilinmeyen satır biçimi') || g.includes('yasaklı sözcük')));
});

test('6. string içinde escape, backtick veya template string (${) -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische \\n Kaçış',            kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });

  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz karakter')));
});

test('7. izinsiz dosya -> ret', () => {
  const patch = `
diff --git a/server.js b/server.js
index 1111111..2222222 100644
--- a/server.js
+++ b/server.js
@@ -1,1 +1,1 @@
-console.log("eski");
+console.log("yeni");
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { 'server.js': 'console.log("eski");' },
  });

  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('izinsiz dosya')));
});

test('8. rename / mode / binary / symlink / silindi bayrakları -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
old mode 100644
new mode 100755
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });

  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz bayrak: mode')));
});

test('9. dateiInhalt eksik veya boş yama -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-a
+b
`.trim();

  const sonuc1 = pruefeYama(patch, { erlaubt: ERLAUBT, dateiInhalt: {} });
  assert.equal(sonuc1.ok, false);
  assert.ok(sonuc1.gruende.some(g => g.includes('dateiInhalt eksik')));

  const sonuc2 = pruefeYama('', { erlaubt: ERLAUBT, dateiInhalt: {} });
  assert.equal(sonuc2.ok, false);
  assert.ok(sonuc2.gruende.includes('bos yama'));
});

test('10. diffOzet 78010 preis değişim satırı üretir ve 15 satır sınırını uygular', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -3,1 +3,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 37.20, zuzahlung: 3.72,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const ozet = diffOzet(patch);
  assert.equal(ozet.length, 1);
  assert.ok(ozet[0].includes("'78010'"));
  assert.ok(ozet[0].includes('35.16 → 37.20'));

  let buyukPatch = 'diff --git a/a.js b/a.js\n--- a/a.js\n+++ b/a.js\n@@ -1,20 +1,20 @@\n';
  for (let i = 1; i <= 20; i++) {
    buyukPatch += `-'kod_${i}': 10\n+'kod_${i}': 20\n`;
  }
  const buyukOzet = diffOzet(buyukPatch);
  assert.equal(buyukOzet.length, 16);
  assert.equal(buyukOzet[15], '… ve 5 satır daha');
});

test('11. rakamlariKarsilastir sent yuvarlaması (0.1+0.2 tuzağı), null kontrolü ve eksik kodlar', () => {
  const listeA = [
    { code: '78010', preis: 0.1 + 0.2, zuzahlung: null, gueltig_ab: '2025-07-01' },
    { code: '78020', preis: 50.55, zuzahlung: 5.06, gueltig_ab: '2025-07-01' },
    { code: '78030', preis: 3.47, zuzahlung: 0.35, gueltig_ab: '2025-07-01' },
  ];

  const listeB = [
    { code: '78010', preis: 0.30, zuzahlung: null, gueltig_ab: '2025-07-01' },
    { code: '78020', preis: 50.55, zuzahlung: 5.06, gueltig_ab: '2025-07-01' },
    { code: '78030', preis: 3.47, zuzahlung: 0.35, gueltig_ab: '2025-07-01' },
  ];

  const r1 = rakamlariKarsilastir(listeA, listeB);
  assert.equal(r1.uyusuyor, true);
  assert.deepEqual(r1.farklar, []);

  const listeCFarkli = [
    { code: '78010', preis: 36.10, zuzahlung: 0, gueltig_ab: '2025-07-01' },
    { code: '78020', preis: 50.55, zuzahlung: 5.06, gueltig_ab: '2025-07-01' },
  ];
  const r2 = rakamlariKarsilastir(listeA, listeCFarkli);
  assert.equal(r2.uyusuyor, false);
  assert.ok(r2.farklar.some(f => f.includes('78010 preis:')));
  assert.ok(r2.farklar.some(f => f.includes('78010 zuzahlung:')));
  assert.ok(r2.farklar.some(f => f.includes("78030: b'de eksik")));
});

// ─── YENİ GÜVENLİK KAPISI SERTLEŞTİRME TESTLERİ ─────────────────────────────

test('12. çıplak ---/+++ iki dosyalı yama -> ret (biçim: diff --git başlığı yok)', () => {
  const patch = `
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-eski
+yeni
--- a/api-backend/billing/codes/ergo_positions.js
+++ b/api-backend/billing/codes/ergo_positions.js
@@ -1,1 +1,1 @@
-eski2
+yeni2
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: [/^api-backend\/billing\/codes\/.*_positions\.js$/],
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });

  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('biçim: diff --git başlığı yok')));
});

test('13. hunk içinde +++ 1]; process.exit(1); /* içerik satırı -> başlık sanılmaz, ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+++ 1]; process.exit(1); /*
`.trim();

  const parseResult = parseDiff(patch);
  assert.equal(parseResult.length, 1);
  assert.equal(parseResult[0].neu, 'api-backend/billing/codes/podologie_positions.js');
  assert.equal(parseResult[0].eklenen.length, 1);
  assert.equal(parseResult[0].eklenen[0].satir, '++ 1]; process.exit(1); /*');

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('yasaklı sözcük') || g.includes('guvensiz yorum')));
});

test('14. ikinci +++ başlığı -> ret (biçim: birden fazla +++ başlığı)', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('biçim: birden fazla +++ başlığı')));
});

test('15. "\'" + process.exit(1) + "\'" tırnak hilesi -> ret', () => {
  const orjinal = `
export const PODOLOGIE_POSITIONS_2025 = Object.freeze([
  { hpnr: '78010', label: "Podologische", preis: 35.16, zuzahlung: 3.52, dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
]);
`.trim();

  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: "Podologische", preis: 35.16, zuzahlung: 3.52, dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: "'" + process.exit(1) + "'", preis: 35.16, zuzahlung: 3.52, dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: orjinal },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('yasaklı sözcük') || g.includes('iskelet uyuşmuyor') || g.includes('parantez')));
});

test('16. preis: N, zuzahlung: N tanımlayıcı hilesi -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: N, zuzahlung: N,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('iskelet uyuşmuyor')));
});

test('17. yol saldırısı: ../ segmenti -> ret', () => {
  const patch = `
diff --git a/../server.js b/../server.js
index 1111111..2222222 100644
--- a/../server.js
+++ b/../server.js
@@ -1,1 +1,1 @@
-a
+b
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: [/server\.js$/],
    dateiInhalt: { '../server.js': 'a' },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('gecersiz yol')));
});

test('18. yol saldırısı: mutlak yol (başta /) -> ret', () => {
  const patch = `
diff --git a//etc/passwd b//etc/passwd
index 1111111..2222222 100644
--- a//etc/passwd
+++ b//etc/passwd
@@ -1,1 +1,1 @@
-a
+b
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: [/.*passwd/],
    dateiInhalt: { '/etc/passwd': 'a' },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('gecersiz yol')));
});

test('19. yol saldırısı: ters slash (\\) -> ret', () => {
  const patch = `
diff --git a/api-backend\\codes.js b/api-backend\\codes.js
index 1111111..2222222 100644
--- a/api-backend\\codes.js
+++ b/api-backend\\codes.js
@@ -1,1 +1,1 @@
-a
+b
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: [/codes\.js/],
    dateiInhalt: { 'api-backend\\codes.js': 'a' },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('gecersiz yol')));
});

test('20. yol saldırısı: alt !== neu -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/other_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/other_positions.js
@@ -1,1 +1,1 @@
-a
+b
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: 'a' },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('alt !== neu')));
});

test('21. yol saldırısı: aynı dosya iki kez -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 37.00, zuzahlung: 3.70,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('tekrarlanan dosya')));
});

test('22. ^$\'sız erlaubt regex\'iyle kısmi eşleşme -> ret (tam yol eşleşmeli)', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  // Regex başında ^ veya sonunda $ yok; sadece 'api-backend/billing' kısmına denk geliyor
  const kismiErlaubt = [/api-backend\/billing/];

  const sonuc = pruefeYama(patch, {
    erlaubt: kismiErlaubt,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('izinsiz dosya')));
});

test('23. import { x } from \'data:text/javascript,…\' (orijinalde import satırı varken) -> ret', () => {
  const orjinal = `
import { createHash } from 'node:crypto';
export const PODOLOGIE_POSITIONS_2025 = Object.freeze([]);
`.trim();

  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -1,0 +2,1 @@
+import { x } from 'data:text/javascript,console.log(1)';
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: orjinal },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('yasaklı sözcük')));
});

test('24. eşsiz silinen satır -> ret (silme yasak: satır N)', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,0 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('silme yasak: satır 2')));
});

test('25. iskeleti değişen çift -> ret (iskelet uyuşmuyor)', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  const yeniDegisken = 123;
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('iskelet uyuşmuyor')));
});

test('26. bağlam satırı yalan -> ret (bağlam uyuşmuyor)', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -1,2 +1,2 @@
 yalan bağlam satırı
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('bağlam uyuşmuyor')));
});

test('27. hunk sayacı aşımı -> ret', () => {
  // @@ -2,1 +2,1 @@ bildirilmiş ama 2 silinen satır yazılmış
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
-  { hpnr: '78020', label: 'Podologische Behandlung (groß)',    kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 50.55, zuzahlung: 5.06,  dauer: '50', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('hunk sayaç aşımı') || g.includes('hunk sonrası geçersiz satır')));
});

test('28. hunk eksik satır / EOF -> ret', () => {
  // @@ -2,2 +2,2 @@ bildirilmiş ama sadece 1 satır verilip diff bitmiş
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,2 +2,2 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('eksik hunk satırı')));
});

test('29. veri satırında 120000 geçmesi artık ret DEĞİL -> ok', () => {
  const orjinal = `
export const PODOLOGIE_POSITIONS_2025 = Object.freeze([
  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 120000, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
]);
`.trim();

  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 120000, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 120000, zuzahlung: 4.00,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: orjinal },
  });
  assert.equal(sonuc.ok, true);
  assert.deepEqual(sonuc.gruende, []);
});

test('30. bayrak kontrolü: rename -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
rename from old.js
rename to new.js
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz bayrak: rename')));
});

test('31. bayrak kontrolü: binary -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
Binary files a/api-backend/billing/codes/podologie_positions.js and b/api-backend/billing/codes/podologie_positions.js differ
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz bayrak: binary')));
});

test('32. bayrak kontrolü: symlink (mode 120000) -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
new file mode 120000
--- /dev/null
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -0,0 +1,1 @@
+symlink-target
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz bayrak: symlink')));
});

test('33. bayrak kontrolü: silindi (deleted file mode) -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
deleted file mode 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ /dev/null
@@ -1,1 +0,0 @@
-eski
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz bayrak: silindi')));
});

test('34. bayrak kontrolü: yeniDosya (new file mode) -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
new file mode 100644
--- /dev/null
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -0,0 +1,1 @@
+yeni
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz bayrak: yeniDosya')));
});

test('35. eklenen satırda backtick (`) -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: \`78010\`, label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz karakter')));
});

test('36. eklenen satırda ${ (template string) -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '\${kod}', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz karakter')));
});

test('37. eklenen satırda yorum // (string dışında) -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' }, // yorum
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz yorum')));
});

test('38. eklenen satırda blok yorum /* */ -> ret', () => {
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -2,1 +2,1 @@
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  /* gizli */ { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: PODOLOGIE_ORNEK_ICERIK },
  });
  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('guvensiz yorum')));
});

test('39. rakamlariKarsilastir: undefined vs null -> uyusuyor: false', () => {
  const listeA = [{ code: '78010', preis: undefined, zuzahlung: null }];
  const listeB = [{ code: '78010', preis: null, zuzahlung: null }];
  const res = rakamlariKarsilastir(listeA, listeB);
  assert.equal(res.uyusuyor, false);
  assert.ok(res.farklar.some(f => f.includes('78010 preis: undefined ≠ null')));
});

test('40. rakamlariKarsilastir: \'\' vs 0 -> uyusuyor: false (geçersiz değer)', () => {
  const listeA = [{ code: '78010', preis: '', zuzahlung: 0 }];
  const listeB = [{ code: '78010', preis: 0, zuzahlung: 0 }];
  const res = rakamlariKarsilastir(listeA, listeB);
  assert.equal(res.uyusuyor, false);
  assert.ok(res.farklar.some(f => f.includes('geçersiz değer')));
});

test('41. rakamlariKarsilastir: false -> uyusuyor: false (geçersiz değer)', () => {
  const listeA = [{ code: '78010', preis: false, zuzahlung: 0 }];
  const listeB = [{ code: '78010', preis: false, zuzahlung: 0 }];
  const res = rakamlariKarsilastir(listeA, listeB);
  assert.equal(res.uyusuyor, false);
  assert.ok(res.farklar.some(f => f.includes('geçersiz değer')));
});

test('42. rakamlariKarsilastir: NaN -> uyusuyor: false (geçersiz değer)', () => {
  const listeA = [{ code: '78010', preis: NaN, zuzahlung: 0 }];
  const listeB = [{ code: '78010', preis: 35.16, zuzahlung: 0 }];
  const res = rakamlariKarsilastir(listeA, listeB);
  assert.equal(res.uyusuyor, false);
  assert.ok(res.farklar.some(f => f.includes('geçersiz değer')));
});

test('43. Geçerli yama hâlâ kabul: 4-5 gerçek satır, 1 çift değişen + 2 yeni satır -> ok: true, diffOzet doğru', () => {
  // api-backend/billing/codes/podologie_positions.js'ten 5 gerçek satır
  const gercekIcerik = `
export const PODOLOGIE_POSITIONS_2025 = Object.freeze([
  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78020', label: 'Podologische Behandlung (groß)',    kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 50.55, zuzahlung: 5.06,  dauer: '50', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
  { hpnr: '78030', label: 'Podologische Befundung',           diagnosegruppen: ['DF','NF','QF'], preis:  3.47, zuzahlung: 0.35,  dauer: null, gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
]);
`.trim();

  // 78010 üzerinde preis, zuzahlung ve gueltig_bis değişiyor + 2 yeni satır (78040, 78050) ekleniyor
  const patch = `
diff --git a/api-backend/billing/codes/podologie_positions.js b/api-backend/billing/codes/podologie_positions.js
index 1111111..2222222 100644
--- a/api-backend/billing/codes/podologie_positions.js
+++ b/api-backend/billing/codes/podologie_positions.js
@@ -1,3 +1,5 @@
 export const PODOLOGIE_POSITIONS_2025 = Object.freeze([
-  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 35.16, zuzahlung: 3.52,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2025-07-01', gueltig_bis: '2026-12-31' },
+  { hpnr: '78040', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 40.00, zuzahlung: 4.00,  dauer: '40', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
+  { hpnr: '78050', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 45.00, zuzahlung: 4.50,  dauer: '45', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
   { hpnr: '78020', label: 'Podologische Behandlung (groß)',    kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 50.55, zuzahlung: 5.06,  dauer: '50', gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30' },
`.trim();

  const sonuc = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PODOLOGIE_YOL]: gercekIcerik },
  });

  assert.equal(sonuc.ok, true);
  assert.deepEqual(sonuc.gruende, []);
  assert.equal(sonuc.degisiklikler[PODOLOGIE_YOL].silinen, 1);
  assert.equal(sonuc.degisiklikler[PODOLOGIE_YOL].eklenen, 3);

  const ozet = diffOzet(patch);
  assert.equal(ozet.length, 3);
  assert.ok(ozet[0].includes("'78010'"));
  assert.ok(ozet[0].includes('35.16 → 36.10'));
  assert.ok(ozet[0].includes('3.52 → 3.61'));
  assert.ok(ozet[0].includes("'2026-06-30' → '2026-12-31'"));
  assert.ok(ozet[1].includes("+ '78040' 40.00 € (yeni satır)"));
  assert.ok(ozet[2].includes("+ '78050' 45.00 € (yeni satır)"));
});

// ─── DÜZELTME 2: SOĞUK DENETİM SALDIRILARI, YANLIŞ RETLER VE ÜRETİM TESTİ ───

const POD_GERCEK_YOL = 'api-backend/billing/codes/podologie_positions.js';
const PHYS_GERCEK_YOL = 'api-backend/billing/codes/physio_positions.js';

const podGercekIcerik = readFileSync(POD_GERCEK_YOL, 'utf8');
const physGercekIcerik = readFileSync(PHYS_GERCEK_YOL, 'utf8');

function makeReplacePatch(path, fileContent, searchStr, replacementLine) {
  const lines = fileContent.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes(searchStr));
  assert.ok(idx >= 0, `searchStr bulunamadı: ${searchStr}`);
  const lineNo = idx + 1;
  const oldLine = lines[idx];
  return `diff --git a/${path} b/${path}
--- a/${path}
+++ b/${path}
@@ -${lineNo},1 +${lineNo},1 @@
-${oldLine}
+${replacementLine}`;
}

function makeInsertPatch(path, fileContent, searchStr, insertedLine) {
  const lines = fileContent.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes(searchStr));
  assert.ok(idx >= 0, `searchStr bulunamadı: ${searchStr}`);
  const lineNo = idx + 1;
  const ctxLine = lines[idx];
  return `diff --git a/${path} b/${path}
--- a/${path}
+++ b/${path}
@@ -${lineNo},1 +${lineNo},2 @@
 ${ctxLine}
+${insertedLine}`;
}

test('44. Saldırı 1: String içi tekil \\r (0x0D) enjeksiyonu -> ret', () => {
  const lines = podGercekIcerik.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes("'78010'"));
  assert.ok(idx >= 0);
  const oldLine = lines[idx];
  const newLine = oldLine.replace('Podologische', 'Podolo\rgische');
  const patch = makeReplacePatch(POD_GERCEK_YOL, podGercekIcerik, "'78010'", newLine);
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('guvensiz karakter') || g.includes('veri satırı değil')));
});

test('45. Saldırı 2a: Fonksiyon dönüş nesnesi (return {...}) eklemek -> ret', () => {
  const patch = makeInsertPatch(
    PHYS_GERCEK_YOL,
    physGercekIcerik,
    'function fensterFuerDatum',
    '  return { fenster: fenster[fenster.length - 0], ausserhalb: true };'
  );
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PHYS_GERCEK_YOL]: physGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('veri satırı değil') || g.includes('bilinmeyen satır biçimi')));
});

test('46. Saldırı 2b: Veri dizisine ...entry, eklemek -> ret', () => {
  const patch = makeInsertPatch(
    PHYS_GERCEK_YOL,
    physGercekIcerik,
    "'X0501'",
    '    ...entry,'
  );
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PHYS_GERCEK_YOL]: physGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('veri satırı değil') || g.includes('bilinmeyen satır biçimi')));
});

test('47. Saldırı 2c: Veri dizisine !p.deprecated eklemek -> ret', () => {
  const patch = makeInsertPatch(
    POD_GERCEK_YOL,
    podGercekIcerik,
    "hpnr: '78010'",
    '    !p.deprecated'
  );
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('veri satırı değil') || g.includes('bilinmeyen satır biçimi')));
});

test('48. Saldırı 2d: Veri dizisine Object.freeze({... positionen: PODOLOGIE_POSITIONS_2025 }) eklemek -> ret', () => {
  const patch = makeInsertPatch(
    POD_GERCEK_YOL,
    podGercekIcerik,
    "hpnr: '78010'",
    "  Object.freeze({ gueltig_ab: '2025-07-01', gueltig_bis: '2026-06-30', positionen: PODOLOGIE_POSITIONS_2025 }),"
  );
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('veri satırı değil') || g.includes('bilinmeyen satır biçimi')));
});

test('49. Saldırı 3a: prefixMap yönlendirme tablosunu değiştirmek -> ret', () => {
  const lines = physGercekIcerik.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes('prefixMap'));
  assert.ok(idx >= 0);
  const oldLine = lines[idx];
  const newLine = oldLine.replace("'21': '1'", "'00': '0'");
  const patch = makeReplacePatch(PHYS_GERCEK_YOL, physGercekIcerik, 'prefixMap', newLine);
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PHYS_GERCEK_YOL]: physGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('veri satırı değil')));
});

test('50. Saldırı 3b: regex /^X\\d{4}$/ kalıbını değiştirmek -> ret', () => {
  const lines = physGercekIcerik.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes('X\\d{4}'));
  assert.ok(idx >= 0);
  const oldLine = lines[idx];
  const newLine = oldLine.replace('X\\d{4}', 'X\\d{99}');
  const patch = makeReplacePatch(PHYS_GERCEK_YOL, physGercekIcerik, 'X\\d{4}', newLine);
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PHYS_GERCEK_YOL]: physGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('veri satırı değil')));
});

test('51. Saldırı 4: Yarım kayıt satırı enjeksiyonu -> ret', () => {
  const patch = makeInsertPatch(
    POD_GERCEK_YOL,
    podGercekIcerik,
    "hpnr: '78010'",
    "  { hpnr: '78610', label: 'Podologische Befundung (groß)',"
  );
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('veri satırı değil')));
});

test('52. Saldırı 5: Hunk içinde bitişik olmayan +/- sırası kaydırma -> ret', () => {
  const lines = physGercekIcerik.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes('if (!entry) return null;'));
  assert.ok(idx >= 0);
  const targetLine = lines[idx];
  const prevLine = lines[idx - 1];
  const patch = `diff --git a/${PHYS_GERCEK_YOL} b/${PHYS_GERCEK_YOL}
--- a/${PHYS_GERCEK_YOL}
+++ b/${PHYS_GERCEK_YOL}
@@ -${idx},2 +${idx},2 @@
+${targetLine}
 ${prevLine}
-${targetLine}`;
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [PHYS_GERCEK_YOL]: physGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('silme yasak') || g.includes('veri satırı değil') || g.includes('bağlam uyuşmuyor')));
});

test('53. Saldırı 6: Üstte sahte çift tırnaklı "78010" ile gölgeleme -> ret', () => {
  const patch = makeInsertPatch(
    POD_GERCEK_YOL,
    podGercekIcerik,
    "hpnr: '78010'",
    '  { hpnr: "78010", label: \'Podologische Behandlung (klein)\', diagnosegruppen: [\'DF\'], preis: 0.01, zuzahlung: 0.00, dauer: \'35\', gueltig_ab: \'2026-07-01\', gueltig_bis: \'9999-12-31\' },'
  );
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('çift tırnak yasak') || g.includes('tekrar eden kod') || g.includes('veri satırı değil')));
});

test('54. Saldırı 7a: Negatif fiyat (-35.16) enjeksiyonu -> ret', () => {
  const lines = podGercekIcerik.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes("'78010'"));
  assert.ok(idx >= 0);
  const oldLine = lines[idx];
  const newLine = oldLine.replace('preis: 35.16', 'preis: -35.16');
  const patch = makeReplacePatch(POD_GERCEK_YOL, podGercekIcerik, "'78010'", newLine);
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('iskelet uyuşmuyor')));
});

test('55. Saldırı 7b: Kod değiştirme \'78010\' → \'00000\' -> ret', () => {
  const lines = podGercekIcerik.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes("'78010'"));
  assert.ok(idx >= 0);
  const oldLine = lines[idx];
  const newLine = oldLine.replace("'78010'", "'00000'");
  const patch = makeReplacePatch(POD_GERCEK_YOL, podGercekIcerik, "'78010'", newLine);
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('kod değiştirilemez')));
});

test('56. Saldırı 7c: Geçersiz satır numaralı sıfır bağlamlı hunk (@@ -99999,0 +1,1 @@) -> ret', () => {
  const patch = `diff --git a/${POD_GERCEK_YOL} b/${POD_GERCEK_YOL}
--- a/${POD_GERCEK_YOL}
+++ b/${POD_GERCEK_YOL}
@@ -99999,0 +1,1 @@
+  { hpnr: '78010', label: 'Podologische', diagnosegruppen: ['DF'], preis: 36.10, zuzahlung: 3.61, dauer: '35', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },`;
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('geçersiz satır numarası') || g.includes('hunk bağlam veya silinen satır içermiyor')));
});

test('57. Saldırı 7d: Çakışan iki hunk -> ret', () => {
  const lines = podGercekIcerik.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes("'78010'"));
  assert.ok(idx >= 0);
  const lineNo = idx + 1;
  const line = lines[idx];
  const patch = `diff --git a/${POD_GERCEK_YOL} b/${POD_GERCEK_YOL}
--- a/${POD_GERCEK_YOL}
+++ b/${POD_GERCEK_YOL}
@@ -${lineNo},1 +${lineNo},1 @@
-${line}
+${line}
@@ -${lineNo},1 +${lineNo},1 @@
-${line}
+${line}`;
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, false);
  assert.ok(res.gruende.some(g => g.includes('çakışan veya sırasız hunk')));
});

test('58. Yanlış ret 1: PREISSTAND güncellemesi -> ok', () => {
  const lines = podGercekIcerik.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes('export const PREISSTAND'));
  assert.ok(idx >= 0);
  const oldLine = lines[idx];
  const newLine = "export const PREISSTAND = '01-01-27';";
  const patch = makeReplacePatch(POD_GERCEK_YOL, podGercekIcerik, 'export const PREISSTAND', newLine);
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, true, res.gruende.join(' | '));
  assert.deepEqual(res.gruende, []);
});

test('59. Yanlış ret 2: zuzahlung: null → 3.52 geçişi -> ok', () => {
  const lines = podGercekIcerik.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes('zuzahlung: null'));
  assert.ok(idx >= 0);
  const oldLine = lines[idx];
  const newLine = oldLine.replace('zuzahlung: null', 'zuzahlung: 3.52');
  const patch = makeReplacePatch(POD_GERCEK_YOL, podGercekIcerik, 'zuzahlung: null', newLine);
  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, true, res.gruende.join(' | '));
  assert.deepEqual(res.gruende, []);
});

test('60. Yanlış ret 3: Boşluksuz boş bağlam satırı ("") ve \\ No newline at end of file -> ok', () => {
  const lines = podGercekIcerik.split(/\r?\n/);
  const idx78010 = lines.findIndex(l => l.includes("'78010'"));
  assert.ok(idx78010 > 1);
  const prevLine = lines[idx78010 - 1];
  const targetLine = lines[idx78010];
  const newLine = targetLine.replace('preis: 35.16', 'preis: 36.10');
  const lineNo = idx78010;

  const patch = `diff --git a/${POD_GERCEK_YOL} b/${POD_GERCEK_YOL}
--- a/${POD_GERCEK_YOL}
+++ b/${POD_GERCEK_YOL}
@@ -${lineNo},2 +${lineNo},2 @@
${prevLine.length === 0 ? '' : ' ' + prevLine}
-${targetLine}
+${newLine}
\\ No newline at end of file`;

  const res = pruefeYama(patch, {
    erlaubt: ERLAUBT,
    dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
  });
  assert.equal(res.ok, true, res.gruende.join(' | '));
});

test('61. rakamlariKarsilastir: aynı dizide tekrarlanan code -> tekrar eden kod: X', () => {
  const listA = [
    { code: '78010', preis: 35.16, zuzahlung: 3.52, gueltig_ab: '2025-07-01' },
    { code: '78010', preis: 0.01, zuzahlung: 0.00, gueltig_ab: '2025-07-01' },
  ];
  const listB = [
    { code: '78010', preis: 35.16, zuzahlung: 3.52, gueltig_ab: '2025-07-01' },
  ];
  const resA = rakamlariKarsilastir(listA, listB);
  assert.equal(resA.uyusuyor, false);
  assert.ok(resA.farklar.some(f => f === 'tekrar eden kod: 78010'));

  const resB = rakamlariKarsilastir(listB, listA);
  assert.equal(resB.uyusuyor, false);
  assert.ok(resB.farklar.some(f => f === 'tekrar eden kod: 78010'));
});

test('62. Gerçek üretim testi: preise_autoupdate fuehreAus + erlaubeSprung yaması kapıdan geçer', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bekci-dogrula-prod-'));
  const ziel = join(dir, 'podologie_positions.js');
  writeFileSync(ziel, podGercekIcerik, 'utf8');
  const alt = BEREICHE.podologie.datei;
  BEREICHE.podologie.datei = ziel;

  try {
    const offen = PODOLOGIE_PREISFENSTER.find(f => f.gueltig_bis === '9999-12-31');
    const SPRUNG = '78010';
    const neu = Math.round(offen.positionen.find(p => p.hpnr === SPRUNG).preis * 1.30 * 100) / 100;
    const XML = offen.positionen.map(p => {
      const preis = p.hpnr === SPRUNG ? neu : p.preis;
      return `<HMP><HMP4>X${String(p.hpnr).slice(1)}</HMP4><Heilmittelbereich>Podologie</Heilmittelbereich><Hoechstpreis>${preis}</Hoechstpreis><Gueltig_ab>2099-07-01</Gueltig_ab><Bezeichnung>${p.label}</Bezeichnung></HMP>`;
    }).join('\n');

    const b = await fuehreAus({ xml: XML, dryRun: false, erlaubeSprung: new Set([SPRUNG]) });
    assert.equal(b.changed.length, 1, JSON.stringify(b.needsReview));

    const orig = join(tmpdir(), `bekci-orig-${process.pid}.js`);
    writeFileSync(orig, podGercekIcerik, 'utf8');
    const r = spawnSync('git', ['diff', '--no-index', '--no-color', orig, ziel], { encoding: 'utf8' });
    rmSync(orig, { force: true });

    let patch = r.stdout.replace(/\r\n/g, '\n');
    patch = patch.replace(/^diff --git "?a\/[^" \n]+"? "?b\/[^" \n]+"?/gm, `diff --git a/${POD_GERCEK_YOL} b/${POD_GERCEK_YOL}`);
    patch = patch.replace(/^--- "?a\/[^" \n]+"?/gm, `--- a/${POD_GERCEK_YOL}`);
    patch = patch.replace(/^\+\+\+ "?b\/[^" \n]+"?/gm, `+++ b/${POD_GERCEK_YOL}`);
    patch = patch.replace(/^index .*\n/gm, '');

    const k = pruefeYama(patch, {
      erlaubt: ERLAUBT,
      dateiInhalt: { [POD_GERCEK_YOL]: podGercekIcerik },
    });
    assert.equal(k.ok, true, k.gruende.join(' | ') + '\n' + patch.slice(0, 800));
    assert.ok(k.degisiklikler[POD_GERCEK_YOL].eklenen > 0);
  } finally {
    BEREICHE.podologie.datei = alt;
    rmSync(dir, { recursive: true, force: true });
  }
});

