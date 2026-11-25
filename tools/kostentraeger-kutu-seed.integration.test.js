// tools/kostentraeger-kutu-seed.integration.test.js
// Entegrasyon testleri: DATABASE_URL tanımlıysa Postgres ikizi üzerinde koşar.
// DATABASE_URL yoksa atlanır (test.skip).

import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ladePg,
  kur,
  dokum,
  dogrula,
  seedDosyasi,
  ozKontrolHesapla,
  berechneStats,
  sha256Hesapla,
} from './kostentraeger-kutu-seed.mjs';
import {
  synchronisiere,
  sqlClient,
  ladeAusgaben,
  ECHT_DIR,
} from './kostentraeger-annahmestellen-laden.mjs';
import { waehleAusgaben } from '../api-backend/billing/kostentraeger/lade-plan.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;

test('kostentraeger-kutu-seed entegrasyon testleri', {
  skip: !DATABASE_URL ? 'DATABASE_URL yok, entegrasyon testi atlandı' : false,
  timeout: 120000,
}, async (t) => {
  const pg = await ladePg();
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const query = async (sql, params = []) => (params.length ? client.query(sql, params) : client.query(sql));

  try {
    await t.test('(a) 0132 regresyonu: ikiz zinciri 0132 HARİÇ kur + synchronisiere === 0132 durumu (updated_at hariç)', async () => {
      // 1. İkiz zincirini 0132 HARİÇ kur
      await kur(query, {
        haricDosyalar: new Set(['0132_seed_kostentraeger_q4_2026_nachlieferung.sql']),
        dropSchema: true,
      });

      // 2. 18.11.2026 Stichtag ile senkronize et (0132'nin ürettiği gün)
      const ausgaben = ladeAusgaben();
      await synchronisiere({
        db: sqlClient(query),
        stichtag: '2026-11-18',
        heute: '2026-11-18',
        write: true,
        ausgaben,
        log: () => {},
      });

      const dokumSync = await dokum(query);

      // 3. İkinci adım: Temiz şemaya 0132 DAHİL tüm zinciri kur
      await kur(query, { dropSchema: true });
      const dokum0132 = await dokum(query);

      // 4. Birebir eşitlik kontrolü (kostentraeger tablosunda updated_at hariç)
      assert.equal(dokumSync.kostentraeger.length, dokum0132.kostentraeger.length, 'kostentraeger satır sayısı tutmalı');
      assert.equal(dokumSync.kostentraeger_annahmestellen.length, dokum0132.kostentraeger_annahmestellen.length, 'annahmestellen satır sayısı tutmalı');
      assert.equal(dokumSync.kostentraeger_anschriften.length, dokum0132.kostentraeger_anschriften.length, 'anschriften satır sayısı tutmalı');

      for (let i = 0; i < dokumSync.kostentraeger.length; i++) {
        const s = { ...dokumSync.kostentraeger[i], updated_at: null };
        const o = { ...dokum0132.kostentraeger[i], updated_at: null };
        assert.deepEqual(s, o, `kostentraeger satır ${i} (${s.ik}) updated_at dışında birebir uyuşmalı`);
      }

      assert.deepEqual(dokumSync.kostentraeger_annahmestellen, dokum0132.kostentraeger_annahmestellen, 'annahmestellen birebir uyuşmalı');
      assert.deepEqual(dokumSync.kostentraeger_anschriften, dokum0132.kostentraeger_anschriften, 'anschriften birebir uyuşmalı');
    });

    await t.test('(b) üretilen dosya dogrula\'dan geçer (idempotent ve tam döküm eşleşmesi)', async () => {
      // 1. 0132 öncesi ikizi kur
      await kur(query, {
        haricDosyalar: new Set(['0132_seed_kostentraeger_q4_2026_nachlieferung.sql']),
        dropSchema: true,
      });
      const vorher = await dokum(query);

      const ausgaben = ladeAusgaben();
      const stichtag = '2026-11-18';
      await synchronisiere({
        db: sqlClient(query),
        stichtag,
        heute: '2026-11-18',
        write: true,
        ausgaben,
        log: () => {},
      });
      const nachher = await dokum(query);

      const { stats } = berechneStats(vorher, nachher);
      const ozKontrol = await ozKontrolHesapla(query);

      const { aktiv: aktivMeta, kommend: kommendMeta } = waehleAusgaben(ausgaben, stichtag);
      const aktivMitSha = aktivMeta.map(a => ({
        datei: a.datei,
        gueltigAb: a.gueltigAb,
        sha256: sha256Hesapla(join(ECHT_DIR, a.datei)),
      }));
      const kommendMitSha = kommendMeta.map(k => ({
        datei: k.datei,
        gueltigAb: k.gueltigAb,
        sha256: sha256Hesapla(join(ECHT_DIR, k.datei)),
      }));

      const metin = seedDosyasi({
        version: '0132',
        stichtag,
        aktiv: aktivMitSha,
        kommend: kommendMitSha,
        tablolar: nachher,
        ozKontrol,
        stats,
      });

      // dogrula: boş şemaya kur + uygula + ikinci kez uygula + nachher ile döküm karşılaştır
      const dogrulaSonuc = await dogrula(query, metin, {
        nachher,
        kurFn: async (q) => kur(q, {
          haricDosyalar: new Set(['0132_seed_kostentraeger_q4_2026_nachlieferung.sql']),
          dropSchema: true,
        }),
      });

      assert.equal(dogrulaSonuc.ok, true);
    });

    await t.test('(c) değişiklik yokken degisiklik:false', async () => {
      // Senkronize olmuş mevcut durum üzerinde tekrar synchronisiere çalıştırılır
      const vorher = await dokum(query);
      const ausgaben = ladeAusgaben();
      await synchronisiere({
        db: sqlClient(query),
        stichtag: '2026-11-18',
        heute: '2026-11-18',
        write: true,
        ausgaben,
        log: () => {},
      });
      const nachher = await dokum(query);

      const { degisiklik } = berechneStats(vorher, nachher);
      assert.equal(degisiklik, false, 'Aynı stichtag ve çıktılarda değişiklik false dönmeli');
    });
  } finally {
    await client.end();
  }
});
