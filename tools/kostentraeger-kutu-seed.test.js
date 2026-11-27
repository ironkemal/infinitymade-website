import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  L,
  seedDosyasi,
  tabloInserts,
  TABELLEN_CONFIG,
  ddlCikar,
  ZINCIR,
  zincirOlustur,
  sonrakiNumara,
} from './kostentraeger-kutu-seed.mjs';

// api-backend/db/migrate.test.js içindeki SaaS başlık denetimi ile birebir aynı regex
const SAAS_ZEILE_RE = /^-- SaaS: (angewandt|angewendet) \d{2}\.\d{2}\.\d{4}|^-- SaaS: nicht angewandt \(box-only\): .+/m;

// README.md Kural 6 doğrulaması için sayaç satırı regex'i
const ZAEHLER_ZEILE_RE = /^-- ZAEHLER: unveraendert \(reine Daten-UPSERT, public; kein DDL — README\.md Kural 6\)/m;

// 0132_seed_kostentraeger_q4_2026_nachlieferung.sql'den fixture satırları
const FIXTURE_KOSTENTRAEGER = [
  {
    ik: '100105006',
    name: 'Knappschaft Hauptverwaltung Dezernat I.5.5 (Meck.Vorp.)',
    das_ik: null,
    payer_type: 'gkv',
    region: null,
    active: 't',
    valid_from: '2012-04-01',
    valid_to: null,
    updated_at: '2026-09-05 22:55:00.745545+00',
    kurzname: 'Knappschaft Meckl.-Vorp.',
    abrechnender_kt_ik: null,
    ist_abrechnender_kt: 't',
    quelle: 'BN050526_KE0.txt',
    quelle_stand: '2026-04-24',
    datensatz_status: 'echt',
  },
  {
    ik: '100167999',
    name: 'DAK-Gesundheit',
    das_ik: null,
    payer_type: 'gkv',
    region: null,
    active: 't',
    valid_from: '1995-10-01',
    valid_to: null,
    updated_at: '2026-11-18 21:16:57.258319+00',
    kurzname: 'DAK',
    abrechnender_kt_ik: '105830016',
    ist_abrechnender_kt: 'f',
    quelle: 'EK05Q426_KE2.txt',
    quelle_stand: '2026-10-01',
    datensatz_status: 'echt',
  },
  {
    ik: '100202549',
    name: 'IKK - Die Innovationskasse (vorm. IKK Nord)',
    das_ik: null,
    payer_type: 'gkv',
    region: null,
    active: 't',
    valid_from: '1995-08-01',
    valid_to: null,
    updated_at: '2026-09-30 23:07:52.545622+00',
    kurzname: 'IKK - Die Innovationskasse',
    abrechnender_kt_ik: null,
    ist_abrechnender_kt: 't',
    quelle: 'IK05Q426_KE0.txt',
    quelle_stand: '2026-10-01',
    datensatz_status: 'echt',
  },
];

const FIXTURE_ANNAHMESTELLEN = [
  {
    kostentraeger_ik: '100105006',
    verknuepfungsart: '01',
    partner_ik: '100105006',
    leistungserbringergruppe: '0',
    abrechnungscode: '00',
    art_datenlieferung: '00',
    uebermittlungsmedium: '0',
    bundesland: '00',
    quelle: 'BN050526_KE0.txt',
    quelle_stand: '2026-04-24',
    valid_from: null,
    valid_to: null,
  },
  {
    kostentraeger_ik: '100105006',
    verknuepfungsart: '02',
    partner_ik: '109505009',
    leistungserbringergruppe: '5',
    abrechnungscode: '10',
    art_datenlieferung: '07',
    uebermittlungsmedium: '6',
    bundesland: '13',
    quelle: 'BN050526_KE0.txt',
    quelle_stand: '2026-04-24',
    valid_from: null,
    valid_to: null,
  },
];

const FIXTURE_ANSCHRIFTEN = [
  {
    kostentraeger_ik: '109905003',
    art: '2',
    plz: '45004',
    ort: 'Essen',
    strasse: '100453',
    quelle: 'BN050526_KE0.txt',
    quelle_stand: '2026-05-01',
    valid_from: null,
    valid_to: null,
  },
  {
    kostentraeger_ik: '109905014',
    art: '3',
    plz: '45095',
    ort: 'Essen',
    strasse: '',
    quelle: 'BN050526_KE0.txt',
    quelle_stand: '2026-05-01',
    valid_from: null,
    valid_to: null,
  },
];

test('L(): NULL, tek tırnak ikileme ve ters bölü için E-string kaçışı', () => {
  assert.equal(L(null), 'NULL');
  assert.equal(L(undefined), 'NULL');
  assert.equal(L(''), "''");
  assert.equal(L('DAK-Gesundheit'), "'DAK-Gesundheit'");
  assert.equal(L("O'Reilly"), "'O''Reilly'");
  assert.equal(L('foo\\bar'), "E'foo\\\\bar'");
  assert.equal(L("foo'bar\\baz"), "E'foo\\\'bar\\\\baz'");
  assert.equal(L(true), "'t'");
  assert.equal(L(false), "'f'");
});

test('seedDosyasi: 0132 başlık satırları migrate.js ve README kurallarına uygundur', () => {
  const sql = seedDosyasi({
    version: '0133',
    stichtag: '2026-11-25',
    aktiv: [{ datei: 'AO05Q426_KE2.txt', gueltigAb: '2026-11-01', sha256: 'abc123sha' }],
    kommend: [{ datei: 'EK05Q426_KE3.txt', gueltigAb: '2026-12-01', sha256: 'def456sha' }],
    tablolar: {
      kostentraeger: FIXTURE_KOSTENTRAEGER,
      kostentraeger_annahmestellen: FIXTURE_ANNAHMESTELLEN,
      kostentraeger_anschriften: FIXTURE_ANSCHRIFTEN,
    },
    ozKontrol: {
      kostentraeger: { n: 3, h: 'h1' },
      kostentraeger_annahmestellen: { n: 2, h: 'h2' },
      kostentraeger_anschriften: { n: 2, h: 'h3' },
    },
    stats: {
      kostentraeger: { satir: 3, yeni: 0, kapanan: 0, degisen: 0 },
      kostentraeger_annahmestellen: { satir: 2, yeni: 0, kapanan: 0, degisen: 0 },
      kostentraeger_anschriften: { satir: 2, yeni: 0, kapanan: 0, degisen: 0 },
    },
  });

  const kopf = sql.split('\n').slice(0, 30).join('\n');
  assert.match(kopf, SAAS_ZEILE_RE, '-- SaaS: satırı migrate.test.js formatına uymalı');
  assert.match(kopf, ZAEHLER_ZEILE_RE, '-- ZAEHLER: satırı README Kural 6 formatına uymalı');
  assert.match(kopf, /AO05Q426_KE2\.txt\s+ab 2026-11-01\s+abc123sha/);
  assert.match(kopf, /NICHT enthalten \(kommend\):/);
  assert.match(kopf, /EK05Q426_KE3\.txt\s+ab 2026-12-01\s+def456sha/);
});

test('seedDosyasi: INSERT başlığı ve ON CONFLICT SET listesi valid_from içermez', () => {
  const sql = seedDosyasi({
    version: '0133',
    stichtag: '2026-11-25',
    aktiv: [],
    kommend: [],
    tablolar: {
      kostentraeger: FIXTURE_KOSTENTRAEGER,
      kostentraeger_annahmestellen: FIXTURE_ANNAHMESTELLEN,
      kostentraeger_anschriften: FIXTURE_ANSCHRIFTEN,
    },
    ozKontrol: {
      kostentraeger: { n: 3, h: 'h1' },
      kostentraeger_annahmestellen: { n: 2, h: 'h2' },
      kostentraeger_anschriften: { n: 2, h: 'h3' },
    },
    stats: {
      kostentraeger: { satir: 3, yeni: 0, kapanan: 0, degisen: 0 },
      kostentraeger_annahmestellen: { satir: 2, yeni: 0, kapanan: 0, degisen: 0 },
      kostentraeger_anschriften: { satir: 2, yeni: 0, kapanan: 0, degisen: 0 },
    },
  });

  // INSERT başlıkları
  assert.match(sql, /INSERT INTO public\.kostentraeger \(ik, name, das_ik, payer_type, region, active, valid_from, valid_to, updated_at, kurzname, abrechnender_kt_ik, ist_abrechnender_kt, quelle, quelle_stand, datensatz_status\) VALUES/);
  assert.match(sql, /INSERT INTO public\.kostentraeger_annahmestellen \(kostentraeger_ik, verknuepfungsart, partner_ik, leistungserbringergruppe, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland, quelle, quelle_stand, valid_from, valid_to\) VALUES/);
  assert.match(sql, /INSERT INTO public\.kostentraeger_anschriften \(kostentraeger_ik, art, plz, ort, strasse, quelle, quelle_stand, valid_from, valid_to\) VALUES/);

  // ON CONFLICT ifadeleri
  assert.match(sql, /ON CONFLICT \(ik\) DO UPDATE SET/);
  assert.match(sql, /ON CONFLICT \(kostentraeger_ik, verknuepfungsart, partner_ik, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland\) DO UPDATE SET/);
  assert.match(sql, /ON CONFLICT \(kostentraeger_ik, art, plz, ort, strasse\) DO UPDATE SET/);

  // Alt tablolarda valid_from GÜNCELLENMEZ (keepOnConflict)
  const asSection = sql.slice(sql.indexOf('-- ─── 2) kostentraeger_annahmestellen'), sql.indexOf('-- ─── 4) Selbstpruefung'));
  assert.equal(asSection.includes('valid_from=EXCLUDED.valid_from'), false, 'valid_from alt tabloların UPDATE SET listesinde olmamalı');
  assert.ok(asSection.includes('valid_to=EXCLUDED.valid_to'), 'valid_to güncellenmeli');

  // DO öz-kontrol ve Adım-2 geleceğe kilit
  assert.match(sql, /DO \$\$/);
  assert.match(sql, /SELECT \(SELECT count\(\*\) FROM public\.kostentraeger_annahmestellen WHERE valid_from > \(now\(\) AT TIME ZONE 'Europe\/Berlin'\)::date\)/);
  assert.match(sql, /RAISE EXCEPTION '0133: % Zeilen mit valid_from in der Zukunft \(O-139 Adim 2\)'/);
});

test('tabloInserts: 500 satırlık bloklara böler', () => {
  const satirlar = [];
  for (let i = 0; i < 505; i++) {
    satirlar.push({
      ...FIXTURE_KOSTENTRAEGER[0],
      ik: String(100000000 + i),
    });
  }

  const sql = tabloInserts('kostentraeger', satirlar, TABELLEN_CONFIG.kostentraeger);
  const insertSayisi = (sql.match(/INSERT INTO public\.kostentraeger/g) || []).length;
  assert.equal(insertSayisi, 2, '505 satır 500 ve 5 satırlık iki bloğa bölünmeli');
});

test('ddlCikar: baseline ve 0032den üç tablo + identity + constraint çıkarır; policy/grant/FK almaz', () => {
  const ddl = ddlCikar();

  // Üç tablo oluşturma
  assert.match(ddl, /CREATE TABLE public\.kostentraeger \(/);
  assert.match(ddl, /CREATE TABLE public\.kostentraeger_annahmestellen \(/);
  assert.match(ddl, /CREATE TABLE public\.kostentraeger_anschriften \(/);

  // Identity ve PK/Unique kısıtları
  assert.match(ddl, /ALTER TABLE public\.kostentraeger_annahmestellen ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY/);
  assert.match(ddl, /ADD CONSTRAINT kostentraeger_pkey PRIMARY KEY \(ik\)/);
  assert.match(ddl, /ADD CONSTRAINT kostentraeger_annahmestellen_pkey PRIMARY KEY \(id\)/);
  assert.match(ddl, /ADD CONSTRAINT kostentraeger_annahmestellen_uniq UNIQUE/);

  // İndeksler
  assert.match(ddl, /CREATE INDEX idx_kostentraeger_abrechnender ON public\.kostentraeger/);
  assert.match(ddl, /CREATE INDEX idx_kt_annahme_routing ON public\.kostentraeger_annahmestellen/);

  // Yasaklı öğeler: POLICY, RLS, GRANT, REVOKE, FOREIGN KEY
  assert.equal(/POLICY/i.test(ddl), false, 'POLICY içermemeli');
  assert.equal(/ENABLE ROW LEVEL SECURITY/i.test(ddl), false, 'RLS içermemeli');
  assert.equal(/GRANT/i.test(ddl), false, 'GRANT içermemeli');
  assert.equal(/REVOKE/i.test(ddl), false, 'REVOKE içermemeli');
  assert.equal(/FOREIGN KEY/i.test(ddl), false, 'FOREIGN KEY içermemeli');
  assert.equal(/REFERENCES/i.test(ddl), false, 'REFERENCES içermemeli');
});

test('ZINCIR: tanımlı migration listesi ve nasil seçimi tutarlıdır', () => {
  assert.ok(Array.isArray(ZINCIR));
  assert.ok(ZINCIR.length >= 9);

  const dosyalar = ZINCIR.map(z => z.datei);
  assert.ok(dosyalar.includes('0006_seed_kostentraeger.sql'));
  assert.ok(dosyalar.includes('0007_seed_kostentraeger_annahmestellen.sql'));
  assert.ok(dosyalar.includes('0032_kostentraeger_anschriften.sql'));
  assert.ok(dosyalar.includes('0036_seed_kostentraeger_anschriften.sql'));
  assert.ok(dosyalar.includes('0037_seed_kostentraeger_annahmestellen_quelle_stand.sql'));
  assert.ok(dosyalar.includes('0045_seed_kostentraeger_q4_2026.sql'));
  assert.ok(dosyalar.includes('0046_kostentraeger_gueltigkeit_annahmestellen.sql'));
  assert.ok(dosyalar.includes('0056_db_aufraeumen.sql'));
  assert.ok(dosyalar.includes('0132_seed_kostentraeger_q4_2026_nachlieferung.sql'));

  const item0032 = ZINCIR.find(z => z.datei.startsWith('0032_'));
  assert.equal(item0032.nasil, 'ddl-cikar');

  const item0046 = ZINCIR.find(z => z.datei.startsWith('0046_'));
  assert.equal(item0046.nasil, 'ifade-sec');

  const item0056 = ZINCIR.find(z => z.datei.startsWith('0056_'));
  assert.equal(item0056.nasil, 'ifade-sec');

  const item0132 = ZINCIR.find(z => z.datei.startsWith('0132_'));
  assert.equal(item0132.nasil, 'tam');
});

test('zincirOlustur: yeni *_seed_kostentraeger* dosyalarını otomatik sırayla ekler', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seed-zincir-'));
  try {
    writeFileSync(join(dir, '0006_seed_kostentraeger.sql'), 'select 1;');
    writeFileSync(join(dir, '0150_seed_kostentraeger_2027.sql'), 'select 2;');
    const zincir = zincirOlustur({ migDir: dir });
    const son = zincir[zincir.length - 1];
    assert.equal(son.datei, '0150_seed_kostentraeger_2027.sql');
    assert.equal(son.nasil, 'tam');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sonrakiNumara: en büyük migration numarasının bir fazlasını 4 basamaklı döner', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sonraki-numara-'));
  try {
    writeFileSync(join(dir, '0001_a.sql'), 'select 1;');
    writeFileSync(join(dir, '0042_b.sql'), 'select 2;');
    assert.equal(sonrakiNumara(dir), '0043');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const migrationDir = new URL('../api-backend/db/migrations/', import.meta.url);
  const versions = readdirSync(migrationDir).filter(name => /^\d{4}_.*\.sql$/.test(name))
    .map(name => Number(name.slice(0, 4)));
  assert.ok(versions.length > 0);
  assert.equal(sonrakiNumara(), String(Math.max(...versions) + 1).padStart(4, '0'));
});
