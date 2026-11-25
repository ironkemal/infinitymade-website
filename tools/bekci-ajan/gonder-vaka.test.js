// gonder-vaka.mjs — anlatım seçimi, yedek mesaj, message_id kaydı, sıra eşleme (Kemal 25.11.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gonder, siraBul, siradaki, entscheidungVakalari } from './gonder-vaka.mjs';
import { yeniVaka, kaydet, yukle } from './vaka.mjs';

function sahteTg() {
  const giden = [];
  return {
    giden,
    sende: async (text, knoepfe) => { giden.push({ tur: 'mesaj', text, knoepfe }); return { message_id: 777 }; },
    sendeKisa: async (text, opt) => { giden.push({ tur: 'kisa', text, opt }); return { message_id: 778 }; },
    sendeBild: async (p, cap) => { giden.push({ tur: 'foto', p, cap }); return { message_id: 779 }; },
  };
}

async function hazirla() {
  const kok = mkdtempSync(join(tmpdir(), 'bekci-gv-'));
  mkdirSync(join(kok, 'vakalar'));
  const v = yeniVaka({ bekci: 'kostentraeger', baslik: 'Kostenträger: DAS-Wechsel', satirlar: ['• KT 101575519 Kod 76 açık VKG 03 partner kümesi değişti: [661430035] → [101575519]'], dosyalar: [], ek: { iz: 'abc', uygulanabilir: true }, simdi: new Date('2026-12-01T06:00:00Z') });
  await kaydet(join(kok, 'vakalar'), v);
  return { kok, v };
}

const iyiAnlatim = {
  baslik: 'TK faturalarını artık başka bir adrese göndereceğiz',
  ne_oldu: 'Techniker Krankenkasse (TK), 1 Aralık 2026 itibarıyla faturaları kendisi kabul etmeye başlıyor.',
  bizi_etkisi: 'TK hastalarının faturaları şimdiye kadar bir veri merkezine (661430035) gidiyordu, artık doğrudan TK\'ya (101575519) gidecek.',
  senden_istenen: 'Bu değişikliği kutulara göndereyim mi?',
  uygula_ne_yapar: 'Kutular bu gece yeni adresi alır.',
  birak_ne_yapar: 'Kutular eski adreste kalır, TK faturaları reddedilebilir.',
  oneri: 'Uygula derim, çünkü TK yeni adresi resmî listede yayınladı.',
  aciliyet: 'orta', son_tarih: null, isaretler: [],
};

test('geçerli anlatım → açıklamalı mesaj + düğmeler + message_id vakaya', async () => {
  const { kok, v } = await hazirla();
  const tg = sahteTg();
  const ad = join(kok, 'anlatim.json'); writeFileSync(ad, JSON.stringify({ vakalar: [iyiAnlatim] }));
  const dd = join(kok, 'denetim.json'); writeFileSync(dd, JSON.stringify({ vakalar: [{ anlasilir: true, sorunlar: [], duzeltilmis: null }] }));
  const s = await gonder({ tg, kok, id: v.id, entscheidung: { karar: 'vaka', vaka: { ek: { iz: 'abc' }, baslik: v.baslik } }, anlatimDosya: ad, denetimDosya: dd });
  assert.equal(s.yedek, false);
  const m = tg.giden.find(g => g.tur === 'mesaj');
  assert.match(m.text, /Ne oldu\?/);
  assert.match(m.text, /TK faturalarını/);
  assert.ok(!m.text.includes(v.id), 'vaka id metinde olmamalı');
  assert.ok(m.knoepfe?.length);
  assert.equal((await yukle(join(kok, 'vakalar'), v.id)).mesajId, 777);
});

test('denetçi onayı yok → yedek mesaj', async () => {
  const { kok, v } = await hazirla();
  const tg = sahteTg();
  const ad = join(kok, 'a.json'); writeFileSync(ad, JSON.stringify(iyiAnlatim));
  const s = await gonder({ tg, kok, id: v.id, entscheidung: { vaka: { ek: { iz: 'abc' } } }, anlatimDosya: ad });
  assert.equal(s.yedek, true);
});

test('uydurma rakam → anlatım reddedilir, yedek mesaj (ham satır yok)', async () => {
  const { kok, v } = await hazirla();
  const tg = sahteTg();
  const ad = join(kok, 'anlatim.json');
  writeFileSync(ad, JSON.stringify({ vakalar: [{ ...iyiAnlatim, bizi_etkisi: 'Yeni ücret 437,55 € olacak.' }] }));
  const s = await gonder({ tg, kok, id: v.id, entscheidung: { vaka: { ek: { iz: 'abc' } } }, anlatimDosya: ad });
  assert.equal(s.yedek, true);
  const m = tg.giden.find(g => g.tur === 'mesaj');
  assert.ok(!m.text.includes('VKG 03'), 'ham satır gösterilmemeli');
  assert.match(m.text, /Açıkla/);
});

test('denetçi düzeltmesi ajanınkinden önce gelir', async () => {
  const { kok, v } = await hazirla();
  const tg = sahteTg();
  const ad = join(kok, 'a.json'), dd = join(kok, 'd.json');
  writeFileSync(ad, JSON.stringify({ vakalar: [iyiAnlatim] }));
  writeFileSync(dd, JSON.stringify({ vakalar: [{ anlasilir: false, sorunlar: ['x'], duzeltilmis: { ...iyiAnlatim, baslik: 'Düzeltilmiş başlık: TK adres değiştiriyor' } }] }));
  const s = await gonder({ tg, kok, id: v.id, entscheidung: { vaka: { ek: { iz: 'abc' } } }, anlatimDosya: ad, denetimDosya: dd });
  assert.equal(s.kaynak, 'denetci');
  assert.match(tg.giden.find(g => g.tur === 'mesaj').text, /Düzeltilmiş başlık/);
});

test('açıklama → asıl mesaja yanıt, düğmesiz', async () => {
  const { kok, v } = await hazirla();
  await kaydet(join(kok, 'vakalar'), { ...v, mesajId: 55 });
  const tg = sahteTg();
  const ad = join(kok, 'a.json'); writeFileSync(ad, JSON.stringify(iyiAnlatim));
  const dd = join(kok, 'd.json'); writeFileSync(dd, JSON.stringify({ anlasilir: true, sorunlar: [], duzeltilmis: null }));
  await gonder({ tg, kok, id: v.id, entscheidung: { vaka: { ek: { iz: 'abc' } } }, anlatimDosya: ad, denetimDosya: dd, aciklama: true });
  const k = tg.giden.find(g => g.tur === 'kisa');
  assert.equal(k.opt.replyTo, 55);
});

test('sıra eşleme: iz → quelleId → baslik; siradaki tek nesne ve dizi', () => {
  const adaylar = [{ ek: { iz: 'a', quelleId: 'q1' }, baslik: 'A' }, { ek: { iz: 'b', quelleId: 'q2' }, baslik: 'B' }];
  assert.equal(siraBul({ ek: { iz: 'b' } }, adaylar), 1);
  assert.equal(siraBul({ ek: { quelleId: 'q1' } }, adaylar), 0);
  assert.equal(siraBul({ baslik: 'B' }, adaylar), 1);
  assert.deepEqual(siradaki({ vakalar: [1, 2] }, 1), 2);
  assert.deepEqual(siradaki({ x: 1 }, 0), { x: 1 });
  assert.equal(siradaki({ x: 1 }, 1), null);
  assert.equal(entscheidungVakalari({ vakalar: [1] }).length, 1);
  assert.equal(entscheidungVakalari({ vaka: { a: 1 } }).length, 1);
});
