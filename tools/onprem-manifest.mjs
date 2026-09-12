#!/usr/bin/env node
// onprem/manifest.json üretici — O-45 (b), onprem/REGISTER.md §7J (J2).
//
// El ile düzenlenmez: sha256'lar diskteki gerçek dosya içeriğinden hesaplanır,
// elle yazılan bir hash yanlış olursa update.sh'ın sapma kontrolü (J3) her
// kutuda "müşteri elle değiştirmiş" sanıp güncellemeyi durdurur.
//
// Kullanım:
//   node tools/onprem-manifest.mjs                → kök VERSION dosyasını okur, surum'u onunla eşitler
//   node tools/onprem-manifest.mjs --durak         → bu sürümü "durak" işaretler (elle_adim'i de elle doldur)
//
// ⚠️ O-25/R7 (12.09.2026): `surum` artık kendi sayacını TUTMAZ. Kaynak tek:
// kök `VERSION` dosyası (ürünün sürümü, api+frontend image'ları + bu bundle
// hepsi aynı numarayı taşır — G7, tek codebase). Önceden burada bir
// `naechstesPatch()` vardı ve kendi PATCH'ini artırıyordu — bu, sürüm
// kavramının koddan bağımsız ikinci bir kopyasıydı ve iki sayaç er ya da geç
// birbirinden kayardı. `tools/check-onprem.sh` artık `manifest.json`'ın
// `surum`'unun kök `VERSION`'la birebir aynı olmasını commit kapısında zorluyor.
//
// durak/elle_adim/not_url ÖNCEKİ manifest.json'dan korunur (elle girilen bir
// duraklama notu, ilgisiz bir sonraki koşuda kaybolmasın) — sıfırlamak için
// dosyayı elle düzenle ya da --durak-sifirla ver.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ONPREM_DIR = join(REPO_ROOT, 'onprem');
const MANIFEST_PATH = join(ONPREM_DIR, 'manifest.json');
const VERSION_PATH = join(REPO_ROOT, 'VERSION');

// J2'nin sabit listesi — dizin değil dosya, tek tek. Yeni bir "bizim" dosya
// eklenince buraya da eklenir; tools/check-onprem.sh (O-72) bunu compose'un
// bind-mount kaynaklarıyla karşılaştırır, biri eksikse commit reddedilir.
const BUNDLE_DATEILER = [
  'docker-compose.yml',
  '.env.template',
  'install.sh',
  'update.sh',
  'lib-health.sh',
  'volumes/api/kong.yml',
  'volumes/api/kong-entrypoint.sh',
  'volumes/db/_supabase.sql',
  'volumes/db/jwt.sql',
  'volumes/db/no-pg-net.sql',
  'volumes/db/realtime.sql',
  'volumes/db/roles.sql',
  'volumes/db/webhooks.sql',
];

function sha256(pfad) {
  return createHash('sha256').update(readFileSync(pfad)).digest('hex');
}

const args = process.argv.slice(2);
const durakSifirla = args.includes('--durak-sifirla');
const durakSet = args.includes('--durak');

let vorher = { durak: false, elle_adim: [], not_url: '' };
if (existsSync(MANIFEST_PATH)) {
  try {
    vorher = { ...vorher, ...JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) };
  } catch {
    // bozuk/eksik dosya — sıfırdan üret
  }
}

if (!existsSync(VERSION_PATH)) {
  console.error(`✗ Kök VERSION dosyası yok (${VERSION_PATH}) — önce onu yaz.`);
  process.exit(1);
}
const surum = readFileSync(VERSION_PATH, 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(surum)) {
  console.error(`✗ VERSION içeriği X.Y.Z değil: "${surum}"`);
  process.exit(1);
}

const dateien = BUNDLE_DATEILER.map((rel) => {
  const abs = join(ONPREM_DIR, rel);
  if (!existsSync(abs)) {
    console.error(`✗ Bundle listesinde ama diskte yok: ${rel}`);
    process.exit(1);
  }
  return { yol: rel, sha256: sha256(abs) };
});

const manifest = {
  surum,
  dateien,
  durak: durakSifirla ? false : (durakSet || vorher.durak),
  elle_adim: durakSifirla ? [] : vorher.elle_adim,
  not_url: durakSifirla ? '' : vorher.not_url,
};

// ⚠️ `dateien[]`'in her elemanı TEK SATIRDA durmak zorunda: update.sh onu
// jq/python OLMADAN, satır bazlı `grep -E` ile okuyor (hedef kutularda ikisi
// de garanti değil). JSON.stringify'ın varsayılan girintilemesi "yol" ve
// "sha256"'yı ayrı satırlara böler — o zaman grep hiçbir şey bulamaz (bu
// hata ilk üretimde yakalandı, gerçek update.sh'a karşı test edilerek).
// Bu yüzden dosya elle, parça parça kuruluyor — JSON.stringify'ın tek-parça
// çıktısına güvenmek yerine.
const dateienSatirlari = dateien
  .map((d) => `    { "yol": ${JSON.stringify(d.yol)}, "sha256": ${JSON.stringify(d.sha256)} }`)
  .join(',\n');
const cikti = [
  '{',
  `  "surum": ${JSON.stringify(surum)},`,
  '  "dateien": [',
  dateienSatirlari,
  '  ],',
  `  "durak": ${manifest.durak},`,
  `  "elle_adim": ${JSON.stringify(manifest.elle_adim)},`,
  `  "not_url": ${JSON.stringify(manifest.not_url)}`,
  '}',
  '',
].join('\n');

writeFileSync(MANIFEST_PATH, cikti);
console.log(`✓ onprem/manifest.json → sürüm ${surum}, ${dateien.length} dosya`);
if (manifest.durak) {
  console.log('  ⚠️  durak: true — elle_adim/not_url alanlarının doldurulduğunu kontrol et.');
}
