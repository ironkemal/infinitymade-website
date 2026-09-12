#!/usr/bin/env node
// On-prem kutu paketi için referans/seed verisi üretici — O-38 (onprem/REGISTER.md).
//
// Ne yapar: canlı Postgres'ten (DATABASE_URL) belirtilen tabloyu deterministik bir
// sırayla (PK'ye göre) okur, Postgres'in KENDİ format('%L', ...) fonksiyonuyla
// (yani bizim JS tarafında yeniden icat ettiğimiz bir escape mantığı DEĞİL, Postgres'in
// kendi tırnak/kaçış kuralları) çok-satırlı INSERT ... ON CONFLICT DO UPDATE üretir.
//
// Niye JS-taraflı escaping değil: diagnosegruppen'in jsonb + text[] + regex-içeren
// sütunları var; elle yazılan bir escape fonksiyonu bir yerde yanlış kaçırırsa sonuç
// sessizce bozuk bir regex/jsonb olur. Postgres'in kendi format() fonksiyonu tek
// otorite kaynak — 12.09.2026'da tam bu tablo üzerinde gerçek bir Postgres'e karşı
// (ayrı, atılabilir bir container) doğrulandı: 57/57 satır, regex'ler fonksiyonel
// olarak test edildi (ör. DF kodunun deseni gerçekten E10.74'e eşleşiyor).
//
// Kullanım:
//   DATABASE_URL=postgres://... node tools/seed-generieren.mjs <tablo_adi>
//   → api-backend/db/migrations/ altına YAZMAZ, stdout'a basar. Elle incelenip
//     (satır sayısı + örnek satırlar) doğru numarayla migration dosyasına eklenir.
//
// SEED-1..SEED-11 (onprem/REGISTER.md §O-38, 12.09.2026, onprem-review + db-ustasi
// tasarım kilidi): ayrı bir seed-runner YOK, seed dosyaları normal migration'dır
// (api-backend/db/migrations/NNNN_seed_<tablo>.sql), migrate.js hiç değişmedi.
// Checksum kilidi "bir daha çalışmaz" der ama SaaS'ta bu veri ZATEN var (G7) —
// bu yüzden ON CONFLICT DO UPDATE zorunlu, düz INSERT değil. DELETE hiçbir yerde
// kullanılmaz (kostentraeger'ın ON DELETE CASCADE zinciri + prescriptions FK'si
// nedeniyle bir satırın silinmesi başka tabloları da götürür veya patlatır).
//
// Bir tablo daha eklemek için TABLES dizisine bir satır eklenir. Doğal anahtar
// (conflictKeys) tablonun GERÇEK unique kısıtından alınır — uydurulmaz.

import { Client } from 'pg';

const TABLES = {
  kostentraeger: {
    columns: ['ik', 'name', 'das_ik', 'payer_type', 'region', 'active', 'valid_from',
      'valid_to', 'updated_at', 'kurzname', 'abrechnender_kt_ik', 'ist_abrechnender_kt',
      'quelle', 'quelle_stand', 'datensatz_status'],
    conflictKeys: ['ik'],
    where: `datensatz_status = 'echt'`,
    orderBy: 'ik',
  },
  kostentraeger_annahmestellen: {
    columns: ['kostentraeger_ik', 'verknuepfungsart', 'partner_ik', 'leistungserbringergruppe',
      'abrechnungscode', 'art_datenlieferung', 'uebermittlungsmedium', 'bundesland', 'quelle'],
    conflictKeys: ['kostentraeger_ik', 'verknuepfungsart', 'partner_ik', 'abrechnungscode',
      'art_datenlieferung', 'uebermittlungsmedium', 'bundesland'],
    orderBy: 'kostentraeger_ik, verknuepfungsart, partner_ik, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland',
  },
  heilmittel_tarif: {
    columns: ['id', 'bundesland', 'kostentraeger_ik', 'position_nr', 'heilmittel_code',
      'preis_eur', 'zuzahlung_pflicht', 'gueltig_ab', 'gueltig_bis'],
    conflictKeys: ['id'],
    orderBy: 'id',
    afterSql: `SELECT setval('public.heilmittel_tarif_id_seq', (SELECT COALESCE(MAX(id),1) FROM public.heilmittel_tarif), true);`,
  },
  krankenkassen: {
    // ⚠️ ik_number bu listede YOK ve BİLİNÇLİ: canlıdaki 16/94 dolu değerin hepsi
    // aynı doğrulanmamış kaynaktan, en az 4'ü kanıtlanmış yanlış (db/REGISTER.md,
    // 06.09.2026 — ör. DAK'a HEK'in IK'sı yazılı). Yanlış veriyi 20 kutuya dağıtmaktansa
    // boş dağıtmak tek savunulabilir yol. Üretilen INSERT'e ELLE `, ik_number)` sütun
    // listesine ve her satırın sonuna `,NULL` eklenir (düzeltme ayrı migration, gkv-302
    // kararını bekliyor) — otomatik değil, çünkü otomatikleştirmek "unutma" riskini
    // tam da önlemeye çalıştığımız yere geri taşır.
    columns: ['id', 'name', 'abbreviation', 'type', 'created_at'],
    conflictKeys: ['id'],
    orderBy: 'name',
  },
  icd_sector_ranges: {
    columns: ['bereich', 'gte', 'lt', 'label', 'sort'],
    conflictKeys: ['bereich', 'gte', 'lt'],
    orderBy: 'bereich, gte, lt',
  },
  diagnosegruppen: {
    columns: ['code', 'label', 'untergruppen', 'icd10_codes', 'icd10_pflicht',
      'befundung_erlaubt', 'nagelspange_erlaubt', 'lokalisation_pflicht', 'bereich',
      'indikation', 'leitsymptomatik', 'hoechstmenge', 'icd_ranges', 'sort', 'aktiv',
      'icd_accept', 'icd_exclude', 'icd_auto_select', 'icd_accept_unsicher'],
    conflictKeys: ['code'],
    orderBy: 'code',
  },
  heilmittel_katalog: {
    // Otorite zinciri değişmiyor (SEED-6): bu tablo api-backend/sync_heilmittel_katalog.js
    // ile billing/codes/*.js'ten üretilir. Bu script yalnız CANLI (zaten doğru üretilmiş)
    // durumu dump eder — ikinci bir üretim yolu AÇMAZ.
    columns: ['code', 'bereich', 'label', 'kuerzel', 'kategorie', 'diagnosegruppen',
      'preis_eur', 'zuzahlung_eur', 'dauer', 'gueltig_ab', 'gueltig_bis', 'deprecated',
      'ungueltig_ab', 'ersetzt_durch', 'max_pro_tag', 'max_pro_termin', 'notiz', 'gruppe',
      'telemed', 'sort'],
    conflictKeys: ['bereich', 'code', 'gueltig_ab'],
    orderBy: 'bereich, code, gueltig_ab',
  },
  icd10_titles: {
    // BfArM ICD-10-GM, Systematisches Verzeichnis (Band 1). Dağıtım hakkı doğrulandı
    // (legal-de, 12.09.2026): § 5 Abs. 2 UrhG "amtliches Werk", Downloadbedingungen
    // 01.08.2025 § 1 Nr. 3/4 yeniden dağıtımı açıkça öngörüyor. Şart: Quellenangabe
    // (image + UI, bkz. NOTICE-QUELLEN.txt) + Änderungsverbot (kod başlıkları AYNEN).
    // Band 2 (Alphabetisches Verzeichnis, Zi'nin ayrı hakları var) bu kapsamda DEĞİL.
    columns: ['code', 'titel', 'kapitel', 'ebene', 'terminal', 'code_plain', 'gruppe'],
    conflictKeys: ['code'],
    orderBy: 'code',
  },
  // dta_schluessel BİLİNÇLİ OLARAK YOK — source_version alanı bugün yanlış
  // ("Anlage 3 V22", geçerli sürüm V21) ve tablo hiçbir kod yolundan okunmuyor.
  // Yanlış sürüm etiketini checksum-kilitli bir dosyaya gömmek, kimsenin
  // düzeltemeyeceği bir hata dondurur. db-ustasi tavsiyesi: source_version
  // düzeltilene kadar atla (12.09.2026).
};

const BATCH_SIZE = 500;

function buildQuery(table, cfg) {
  const cols = cfg.columns.join(', ');
  const literalCols = cfg.columns.map(() => `%L`).join(',');
  const fmtArgs = cfg.columns.join(', ');
  const updateCols = cfg.columns.filter((c) => !cfg.conflictKeys.includes(c));
  const setClause = updateCols.map((c) => `${c}=EXCLUDED.${c}`).join(', ');
  const where = cfg.where ? `WHERE ${cfg.where}` : '';

  return `
WITH src AS (SELECT * FROM public.${table} ${where}),
batched AS (SELECT *, (row_number() OVER (ORDER BY ${cfg.orderBy}) - 1) / ${BATCH_SIZE} AS batch FROM src),
rows_txt AS (
  SELECT batch, string_agg(format('(${literalCols})', ${fmtArgs}), E',\\n  ' ORDER BY ${cfg.orderBy}) AS vals
  FROM batched GROUP BY batch ORDER BY batch
)
SELECT string_agg(
  format(E'INSERT INTO public.${table} (${cols}) VALUES\\n  %s\\nON CONFLICT (${cfg.conflictKeys.join(', ')}) DO UPDATE SET\\n  ${setClause};', vals),
  E'\\n\\n'
) AS sql_out
FROM rows_txt;`.trim();
}

async function main() {
  const tableName = process.argv[2];
  if (!tableName || !TABLES[tableName]) {
    console.error(`Kullanım: node tools/seed-generieren.mjs <${Object.keys(TABLES).join('|')}>`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL gerekli (canlı Postgres bağlantısı, direkt — PostgREST değil).');
    process.exit(1);
  }

  const cfg = TABLES[tableName];
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(buildQuery(tableName, cfg));
    process.stdout.write(rows[0].sql_out + '\n');
    if (cfg.afterSql) process.stdout.write('\n' + cfg.afterSql + '\n');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
