// tools/bekci-ajan/anlat.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  anlatimGecerliMi,
  rakamKorumasi,
  anlatimSec,
  mesajKur,
  yedekMesaj,
} from './anlat.mjs';

function ornekGecerliAnlatim() {
  return {
    baslik: 'TK faturalarını artık başka bir adrese göndereceğiz',
    ne_oldu: 'Techniker Krankenkasse fatura kabul merkezini değiştirdi. Eski merkez artık fatura kabul etmeyecek.',
    bizi_etkisi: 'Sistemimizdeki adresi güncellemezsek ay sonunda gönderilecek faturalar geri dönebilir.',
    senden_istenen: 'Yeni fatura teslim adresini onaylamanı istiyoruz.',
    uygula_ne_yapar: 'Sistem yeni adrese güncellenir ve faturalar oraya yönlendirilir.',
    birak_ne_yapar: 'Adres eski halinde kalır, sonraki kontrolde tekrar sorulur.',
    oneri: 'Onaylamanı öneririm çünkü resmi duyuru yapıldı ve yeni merkez faaliyete geçti.',
    aciliyet: 'orta',
    son_tarih: '2027-01-01',
    isaretler: [
      {
        belge: '01.txt',
        aranan_metin: 'Techniker Krankenkasse yeni fatura adresi',
        neden: 'Resmi duyurudaki yeni teslimat adresi burada belirtiliyor.',
      },
    ],
  };
}

// 1. Şema geçerlilik testleri
test('1. Geçerli anlatım sorunsuz geçer', () => {
  const a = ornekGecerliAnlatim();
  const res = anlatimGecerliMi(a, { belgeAdlari: ['01.txt'] });
  assert.equal(res.ok, true);
  assert.deepEqual(res.hatalar, []);
});

test('2. Bilinmeyen kök anahtar reddedilir', () => {
  const a = ornekGecerliAnlatim();
  a.fazla_alan = 'yasak';
  const res = anlatimGecerliMi(a);
  assert.equal(res.ok, false);
  assert.match(res.hatalar.join(' '), /bilinmeyen_anahtar: fazla_alan/);
});

test('3. Uzunluk sınırları aşımı reddedilir', () => {
  const a = ornekGecerliAnlatim();
  a.baslik = 'a'.repeat(81);
  const res = anlatimGecerliMi(a);
  assert.equal(res.ok, false);
  assert.match(res.hatalar.join(' '), /baslik siniri asti/);
});

test('4. Geçersiz aciliyet veya son_tarih reddedilir', () => {
  const a1 = ornekGecerliAnlatim();
  a1.aciliyet = 'cok_acil';
  const r1 = anlatimGecerliMi(a1);
  assert.equal(r1.ok, false);
  assert.match(r1.hatalar.join(' '), /gecersiz_aciliyet/);

  const a2 = ornekGecerliAnlatim();
  a2.son_tarih = '2027-02-31'; // Takvimde yok
  const r2 = anlatimGecerliMi(a2);
  assert.equal(r2.ok, false);
  assert.match(r2.hatalar.join(' '), /gecersiz_son_tarih/);
});

test('5. isaretler sınırları ve belgeAdlari denetimi', () => {
  const a = ornekGecerliAnlatim();
  a.isaretler = [
    { belge: '01.txt', aranan_metin: 't1', neden: 'n1' },
    { belge: '01.txt', aranan_metin: 't2', neden: 'n2' },
    { belge: '01.txt', aranan_metin: 't3', neden: 'n3' },
    { belge: '01.txt', aranan_metin: 't4', neden: 'n4' }, // >3
  ];
  const r1 = anlatimGecerliMi(a, { belgeAdlari: ['01.txt'] });
  assert.equal(r1.ok, false);
  assert.match(r1.hatalar.join(' '), /isaretler siniri asti/);

  const a2 = ornekGecerliAnlatim();
  a2.isaretler = [{ belge: 'yabanci.txt', aranan_metin: 't1', neden: 'n1' }];
  const r2 = anlatimGecerliMi(a2, { belgeAdlari: ['01.txt'] });
  assert.equal(r2.ok, false);
  assert.match(r2.hatalar.join(' '), /belge bilinmiyor: yabanci\.txt/);
});

// 2. Yasak kalıplar ve sır taraması
test('6. Yasak kalıplar yakalanır: uzantı, URL, yol benzeri dize, alt çizgili uzun token, vaka id', () => {
  // Uzantı
  const a1 = ornekGecerliAnlatim();
  a1.ne_oldu = 'Bu bilgi rehber.pdf dosyasında yer alıyor.';
  assert.equal(anlatimGecerliMi(a1).ok, false);

  // URL / http
  const a2 = ornekGecerliAnlatim();
  a2.oneri = 'Detaylar http://example.com adresinde bulunabilir.';
  assert.equal(anlatimGecerliMi(a2).ok, false);

  // Yol dizesi
  const a3 = ornekGecerliAnlatim();
  a3.bizi_etkisi = 'Değişiklik api/billing klasörünü etkileyecek.';
  assert.equal(anlatimGecerliMi(a3).ok, false);

  // _ içeren >=6 karakterlik token
  const a4 = ornekGecerliAnlatim();
  a4.senden_istenen = 'Lütfen podologie_positions durumunu gözden geçir.';
  assert.equal(anlatimGecerliMi(a4).ok, false);

  // Vaka id
  const a5 = ornekGecerliAnlatim();
  a5.ne_oldu = 'Konu #20261125-preise-1 numaralı vaka ile ilgilidir.';
  assert.equal(anlatimGecerliMi(a5).ok, false);
});

test('7. Sır taraması yakalanır (sk-ant-, ghp_ vb.)', () => {
  const a = ornekGecerliAnlatim();
  a.oneri = 'Gerekirse sk-ant-api03-1234567890abcdef jetonunu yenilemeliyiz.';
  const res = anlatimGecerliMi(a);
  assert.equal(res.ok, false);
  assert.match(res.hatalar.join(' '), /sir iceriyor/);
});

// 3. Rakam koruması testleri
test('8. Rakam koruması: uydurma fiyat ve 3+ haneli sayı yakalanır', () => {
  const olgular = 'Podologie 78010 XML 36,10 -> 37,20 EUR 2027-01-01';
  const a = ornekGecerliAnlatim();
  a.ne_oldu = 'Fiyat 45,50 Euro seviyesine çıktı ve 88990 numaralı kod etkilendi.';
  const res = rakamKorumasi(a, olgular);
  assert.equal(res.ok, false);
  assert.ok(res.uydurma.includes('45,50'));
  assert.ok(res.uydurma.includes('88990'));
});

test('9. Rakam koruması: virgül ve nokta ondalıkta eşdeğerdir', () => {
  const olgular = 'XML fiyat 37.20 Euro ve eski fiyat 36,10 Euro';
  const a = ornekGecerliAnlatim();
  a.son_tarih = null;
  // Anlatımda ters biçimler kullanılıyor: 37,20 ve 36.10
  a.ne_oldu = 'Tedavi ücreti 36.10 Eurodan 37,20 Euroya yükseldi.';
  const res = rakamKorumasi(a, olgular);
  assert.equal(res.ok, true);
  assert.deepEqual(res.uydurma, []);
});

test('10. Rakam koruması: tarih biçimleri eşdeğerdir (gg.aa.jjjj ve jjjj-aa-gg)', () => {
  const olgular = 'Yeni sözleşme 2027-01-01 tarihinde yürürlüğe giriyor';
  const a = ornekGecerliAnlatim();
  a.son_tarih = '2027-01-01';
  a.ne_oldu = 'Değişiklik 01.01.2027 gününden itibaren geçerli.';
  const res = rakamKorumasi(a, olgular);
  assert.equal(res.ok, true);
  assert.deepEqual(res.uydurma, []);
});

test('11. Rakam koruması: 1–2 haneli sayılar serbesttir', () => {
  const olgular = 'Genel bilgi güncellemesi';
  const a = ornekGecerliAnlatim();
  a.son_tarih = null;
  a.ne_oldu = 'Son 14 gün içinde 3 farklı deneme yapıldı ve yüzde 5 fark tespit edildi.';
  const res = rakamKorumasi(a, olgular);
  assert.equal(res.ok, true);
  assert.deepEqual(res.uydurma, []);
});

// 4. Anlatım seçici (anlatimSec) testleri
test('12. anlatimSec: denetçi düzeltmesi geçerli ise ilk tercih odur', () => {
  const olgular = '78010 37,20 2027-01-01';
  const ajanAnlatim = ornekGecerliAnlatim();
  const duzeltilmis = ornekGecerliAnlatim();
  duzeltilmis.baslik = 'Denetçi tarafından sadeleştirilmiş başlık';

  const denetim = {
    anlasilir: false,
    sorunlar: ['Ajan biraz karmaşık yazmış'],
    duzeltilmis,
  };

  const res = anlatimSec({
    anlatim: ajanAnlatim,
    denetim,
    olgular,
    belgeAdlari: ['01.txt'],
  });

  assert.equal(res.kaynak, 'denetci');
  assert.equal(res.anlatim?.baslik, 'Denetçi tarafından sadeleştirilmiş başlık');
});

test('13. anlatimSec: denetçi düzeltmesi geçersizse ama ajan geçerliyse ve onaylıysa ajan seçilir', () => {
  const olgular = '78010 37,20 2027-01-01';
  const ajanAnlatim = ornekGecerliAnlatim();
  const bozukDuzeltilmis = ornekGecerliAnlatim();
  bozukDuzeltilmis.baslik = 'a'.repeat(95); // Geçersiz uzunluk

  const denetim = {
    anlasilir: true,
    sorunlar: [],
    duzeltilmis: bozukDuzeltilmis,
  };

  const res = anlatimSec({
    anlatim: ajanAnlatim,
    denetim,
    olgular,
    belgeAdlari: ['01.txt'],
  });

  assert.equal(res.kaynak, 'ajan');
  assert.equal(res.anlatim?.baslik, ajanAnlatim.baslik);
});

test('14. anlatimSec: hiçbir geçerli anlatım yoksa null döner', () => {
  const denetim = {
    anlasilir: false,
    sorunlar: ['Mesaj anlaşılmıyor'],
    duzeltilmis: null,
  };

  const res = anlatimSec({
    anlatim: null,
    denetim,
    olgular: '',
  });

  assert.equal(res.kaynak, null);
  assert.equal(res.anlatim, null);
});

// 5. Mesaj kurucu (mesajKur) testleri
test('15. mesajKur: beklenen formatı ve düğmeleri eksiksiz kurar', () => {
  const vaka = {
    id: '20261125-preise-1',
    bekci: 'preise',
    durum: 'acik',
    ek: { uygulanabilir: true },
  };
  const a = ornekGecerliAnlatim();
  a.aciliyet = 'yuksek';
  a.son_tarih = '2027-01-01';

  const { text, knoepfe } = mesajKur({ vaka, anlatim: a });

  assert.ok(text.includes('📌 TK faturalarını artık başka bir adrese göndereceğiz'));
  assert.ok(text.includes('⏰ Acil — son tarih: 01.01.2027'));
  assert.ok(text.includes('Ne oldu?'));
  assert.ok(text.includes('Bizi nasıl etkiliyor?'));
  assert.ok(text.includes('Senden istediğim:'));
  assert.ok(text.includes('✅ Uygula → Sistem yeni adrese güncellenir ve faturalar oraya yönlendirilir.'));
  assert.ok(text.includes('❌ Bırak → Adres eski halinde kalır, sonraki kontrolde tekrar sorulur.'));
  assert.ok(text.includes('Benim önerim:'));
  assert.ok(text.includes('📎 Yukarıdaki görselde ilgili yeri sarıyla işaretledim.'));

  // Vaka ID metinde OLMAMALIDIR
  assert.equal(text.includes('20261125-preise-1'), false);
  assert.equal(text.includes('#20261125-'), false);

  // Düğmeler
  assert.equal(knoepfe.length, 2);
  assert.equal(knoepfe[0][0].text, '✅ Uygula');
  assert.equal(knoepfe[0][0].befehl, 'v:20261125-preise-1:uygula');
  assert.equal(knoepfe[0][1].text, '❌ Bırak');
  assert.equal(knoepfe[1][0].text, '💬 Açıkla');
});

test('16. mesajKur: uygulanabilir: false durumunda ✅ satırı ve düğmesi olmaz', () => {
  const vaka = {
    id: '20261125-quellen-2',
    bekci: 'quellen',
    durum: 'acik',
    ek: { uygulanabilir: false },
  };
  const a = ornekGecerliAnlatim();
  a.aciliyet = 'dusuk';
  a.son_tarih = null;
  a.isaretler = [];

  const { text, knoepfe } = mesajKur({ vaka, anlatim: a });

  assert.ok(text.includes('Bu konu otomatik uygulanamıyor; karar verirsen Claude yerel oturumda yapar.'));
  assert.equal(text.includes('✅ Uygula →'), false);
  assert.equal(text.includes('⏰ Acil'), false);
  assert.equal(text.includes('📎 Yukarıdaki görselde'), false);

  // Düğmelerde ✅ yok
  assert.equal(knoepfe.length, 2);
  assert.equal(knoepfe[0].length, 1);
  assert.equal(knoepfe[0][0].text, '❌ Bırak');
  assert.equal(knoepfe[1][0].text, '💬 Açıkla');
});

test('17. mesajKur: 3900 karakter sınırı kesilir ve sonuna … konur', () => {
  const vaka = {
    id: '20261125-preise-3',
    bekci: 'preise',
    durum: 'acik',
  };
  const a = ornekGecerliAnlatim();
  a.ne_oldu = 'Cümle. '.repeat(600); // Çok uzun metin

  const { text } = mesajKur({ vaka, anlatim: a });
  assert.ok(text.length <= 3900);
  assert.ok(text.endsWith('…'));
});

// 6. Yedek mesaj (yedekMesaj) testleri
test('18. yedekMesaj: sade metin, ham satırlar/dosya adları/vaka id içermez', () => {
  const vaka = {
    id: '20261125-preise-4',
    bekci: 'preise',
    baslik: 'Podologie 78010 fiyat uyuşmazlığı podologie_positions.js',
    satirlar: ['satir 1: raw error', 'satir 2: XML 36.10'],
    dosyalar: ['api-backend/billing/codes/podologie_positions.js'],
    durum: 'acik',
    ek: { uygulanabilir: true },
  };

  const { text, knoepfe } = yedekMesaj({ vaka });

  assert.ok(text.includes('📌 Podologie 78010 fiyat uyuşmazlığı'));
  assert.ok(text.includes('Bunu sana anlaşılır biçimde özetleyemedim. Karar vermeden önce "💬 Açıkla"ya bas, ayrıntılı anlatayım.'));

  // Ham satır veya dosya yolu yok
  assert.equal(text.includes('satir 1: raw error'), false);
  assert.equal(text.includes('api-backend'), false);
  assert.equal(text.includes('podologie_positions.js'), false);
  assert.equal(text.includes('20261125-preise-4'), false);

  assert.equal(knoepfe[0][0].text, '✅ Uygula');
  assert.equal(knoepfe[0][0].befehl, 'v:20261125-preise-4:uygula');
});
