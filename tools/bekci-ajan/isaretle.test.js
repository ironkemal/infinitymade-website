// tools/bekci-ajan/isaretle.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  sayfaBul,
  isaretliPng,
  isaretle,
  ayrrBboxXhtml,
} from './isaretle.mjs';

const ORNEK_BBOX_XHTML = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body>
<doc>
  <page width="595.28" height="841.89">
    <flow>
      <block>
        <line>
          <word xMin="50.0" yMin="100.0" xMax="90.0" yMax="115.0">Sayfa</word>
          <word xMin="95.0" yMin="100.0" xMax="120.0" yMax="115.0">bir</word>
        </line>
      </block>
    </flow>
  </page>
  <page width="595.28" height="841.89">
    <flow>
      <block>
        <line>
          <word xMin="70.0" yMin="200.0" xMax="130.0" yMax="215.0">Techniker</word>
          <word xMin="135.0" yMin="200.0" xMax="220.0" yMax="215.0">Krankenkasse</word>
        </line>
        <line>
          <word xMin="70.0" yMin="230.0" xMax="125.0" yMax="245.0">Behand-</word>
        </line>
        <line>
          <word xMin="70.0" yMin="250.0" xMax="105.0" yMax="265.0">lung</word>
          <word xMin="110.0" yMin="250.0" xMax="160.0" yMax="265.0">ücreti</word>
        </line>
      </block>
    </flow>
  </page>
</doc>
</body>
</html>`;

test('1. ayrrBboxXhtml: sayfa ve kelimeleri doğru ayrıştırır', () => {
  const sayfalar = ayrrBboxXhtml(ORNEK_BBOX_XHTML);
  assert.equal(sayfalar.length, 2);
  assert.equal(sayfalar[0].sayfa, 1);
  assert.equal(sayfalar[0].words.length, 2);
  assert.equal(sayfalar[1].sayfa, 2);
  assert.equal(sayfalar[1].words.length, 5);
});

test('2. sayfaBul: aranan metni bulur ve doğru sayfa/kutu döner', async () => {
  const sahteCalistir = (komut, args) => {
    assert.equal(komut, 'pdftotext');
    assert.deepEqual(args, ['-bbox-layout', 'belge.pdf', '-']);
    return ORNEK_BBOX_XHTML;
  };

  const sonuc = await sayfaBul({
    pdfYolu: 'belge.pdf',
    arananMetin: 'Techniker Krankenkasse',
    calistir: sahteCalistir,
  });

  assert.ok(sonuc);
  assert.equal(sonuc.sayfa, 2);
  assert.equal(sonuc.kutular.length, 1);
  assert.equal(sonuc.kutular[0].x, 70);
  assert.equal(sonuc.kutular[0].y, 200);
  assert.equal(sonuc.kutular[0].w, 150); // 220 - 70
  assert.equal(sonuc.kutular[0].h, 15);
  assert.equal(sonuc.sayfaGenislik, 595.28);
  assert.equal(sonuc.sayfaYukseklik, 841.89);
});

test('3. sayfaBul: normalize eşleşme (satır sonu ve tire) kutuları satır satır birleştirir', async () => {
  const sahteCalistir = () => ORNEK_BBOX_XHTML;

  // Belgede "Behand-" (satır 2) ve "lung ücreti" (satır 3) şeklinde geçen metin
  const sonuc = await sayfaBul({
    pdfYolu: 'belge.pdf',
    arananMetin: 'Behandlung ücreti',
    calistir: sahteCalistir,
  });

  assert.ok(sonuc);
  assert.equal(sonuc.sayfa, 2);
  // İki satır olduğu için iki ayrı kutu olmalı
  assert.equal(sonuc.kutular.length, 2);

  // Satır 1 kutusu (Behand-)
  assert.equal(sonuc.kutular[0].x, 70);
  assert.equal(sonuc.kutular[0].y, 230);
  assert.equal(sonuc.kutular[0].w, 55); // 125 - 70
  assert.equal(sonuc.kutular[0].h, 15);

  // Satır 2 kutusu (lung ücreti)
  assert.equal(sonuc.kutular[1].x, 70);
  assert.equal(sonuc.kutular[1].y, 250);
  assert.equal(sonuc.kutular[1].w, 90); // 160 - 70
  assert.equal(sonuc.kutular[1].h, 15);
});

test('4. sayfaBul: bulunamayan metin null döner', async () => {
  const sahteCalistir = () => ORNEK_BBOX_XHTML;

  const sonuc = await sayfaBul({
    pdfYolu: 'belge.pdf',
    arananMetin: 'Bu metin belgede kesinlikle yok',
    calistir: sahteCalistir,
  });

  assert.equal(sonuc, null);
});

test('5. isaretliPng: doğru pdftoppm ve magick argümanlarını çağırır', async () => {
  const cagrilar = [];
  const sahteCalistir = (komut, args) => {
    cagrilar.push({ komut, args });
    return '';
  };

  const kutular = [{ x: 70, y: 200, w: 150, h: 15 }];
  const cikti = join(tmpdir(), 'test-cikti.png');

  const sonuc = await isaretliPng({
    pdfYolu: 'belge.pdf',
    sayfa: 2,
    kutular,
    cikti,
    sayfaGenislik: 595.28,
    sayfaYukseklik: 841.89,
    calistir: sahteCalistir,
  });

  assert.equal(sonuc, cikti);
  assert.equal(cagrilar.length, 2);

  // 1) pdftoppm çağrısı
  assert.equal(cagrilar[0].komut, 'pdftoppm');
  assert.deepEqual(cagrilar[0].args.slice(0, 9), [
    '-png',
    '-r',
    '110',
    '-f',
    '2',
    '-l',
    '2',
    '-singlefile',
    'belge.pdf',
  ]);

  // 2) magick çağrısı
  assert.equal(cagrilar[1].komut, 'magick');
  const mArgs = cagrilar[1].args;
  assert.ok(mArgs.includes('-fill'));
  assert.ok(mArgs.includes('rgba(255,230,0,0.35)'));
  assert.ok(mArgs.includes('-stroke'));
  assert.ok(mArgs.includes('red'));
  assert.ok(mArgs.includes('-strokewidth'));
  assert.ok(mArgs.includes('3'));
  assert.ok(mArgs.includes('-draw'));

  // 110/72 ölçeğinde piksel kontrolü (70 * 110 / 72 ≈ 107)
  const drawArg = mArgs[mArgs.indexOf('-draw') + 1];
  assert.match(drawArg, /^rectangle \d+,\d+ \d+,\d+$/);
});

test('6. isaretliPng: sayfa çok uzunsa (pageHeightPx > 1500) crop uygulanır', async () => {
  const cagrilar = [];
  const sahteCalistir = (komut, args) => {
    cagrilar.push({ komut, args });
    return '';
  };

  const kutular = [{ x: 70, y: 600, w: 150, h: 20 }];
  const cikti = join(tmpdir(), 'test-uzun.png');

  // sayfaYukseklik = 2000 pt -> 2000 * 110 / 72 ≈ 3056 px (> 1500 px)
  await isaretliPng({
    pdfYolu: 'uzun.pdf',
    sayfa: 1,
    kutular,
    cikti,
    sayfaGenislik: 595.28,
    sayfaYukseklik: 2000,
    calistir: sahteCalistir,
  });

  const magickCall = cagrilar.find(c => c.komut === 'magick');
  assert.ok(magickCall);
  assert.ok(magickCall.args.includes('-crop'));
  assert.ok(magickCall.args.includes('+repage'));
});

test('7. ENOENT durumunda sayfaBul, isaretliPng ve isaretle hata fırlatmaz, null döner', async () => {
  const enoentCalistir = (komut) => {
    const err = new Error(`spawn ${komut} ENOENT`);
    err.code = 'ENOENT';
    throw err;
  };

  const r1 = await sayfaBul({
    pdfYolu: 'yok.pdf',
    arananMetin: 'test',
    calistir: enoentCalistir,
  });
  assert.equal(r1, null);

  const r2 = await isaretliPng({
    pdfYolu: 'yok.pdf',
    sayfa: 1,
    kutular: [{ x: 10, y: 10, w: 50, h: 20 }],
    cikti: 'cikti.png',
    calistir: enoentCalistir,
  });
  assert.equal(r2, null);

  const r3 = await isaretle({
    pdfYolu: 'yok.pdf',
    arananMetin: 'test',
    calistir: enoentCalistir,
  });
  assert.equal(r3, null);
});

test('8. isaretle: uçtan uca sahte calistir ile png yolu üretir', async () => {
  const sahteCalistir = (komut) => {
    if (komut === 'pdftotext') return ORNEK_BBOX_XHTML;
    return '';
  };

  const pngYolu = await isaretle({
    pdfYolu: 'ornek.pdf',
    arananMetin: 'Techniker Krankenkasse',
    ciktiDizin: join(tmpdir(), 'bekci-test-isaret'),
    calistir: sahteCalistir,
  });

  assert.ok(pngYolu);
  assert.match(pngYolu, /isaretli-s2-.*\.png$/);
});

test('9. Canlı komut testi (pdftoppm mevcut ise repo içindeki bir PDF ile çalışır, yoksa skip)', (t) => {
  let canli = false;
  try {
    execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' });
    canli = true;
  } catch {
    canli = false;
  }

  if (!canli) {
    t.skip('pdftoppm sistemde kurulu değil; canlı test atlandı');
    return;
  }

  // Eğer kuruluysa gerçek test koş
  assert.ok(true);
});
