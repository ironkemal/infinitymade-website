// tools/bekci-ajan/cevap-isle.mjs
// Ne: Bekçi-Ajan Telegram cevaplarını işleme, vaka durumlarını güncelleme ve hatırlatma motoru.
// Niye: SPEC.md §2.2, §3.0 ve Kemal 25.11.2026 talimatı uyarınca; düğme basışlarını sessiz onay
// (toast) ile karşılama, seyrek hatırlatma (≥ 3 gün, yanıtlama veya toplu özet), takılı vakaları
// sessizce geri açma ve olay defterine kaydetme.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BekciTelegram } from './telegram.mjs';
import {
  VakaHatasi,
  yukle,
  kaydet,
  listele,
  gecis,
  mesaj,
  hatirlatmaGerekli,
  gunFarki,
  eskidi,
  mesajIdYaz,
} from './vaka.mjs';
import { olayEkle } from './rapor.mjs';

/**
 * Telegram cevaplarını işler, vaka durumlarını günceller ve hatırlatmaları iletir.
 *
 * @param {object} params
 * @param {BekciTelegram} params.tg - BekciTelegram örneği veya uyumlu arayüz
 * @param {string} params.dizin - Vakaların saklandığı dizin yolu (<kok>/vakalar)
 * @param {string} [params.kok] - Vakalar dalının kök dizini (yoksa dizin'in üstü)
 * @param {string} [params.offsetDosya] - Offset bilgisinin saklandığı JSON dosyasının yolu
 * @param {string} [params.dispatchDosya] - Bekci-ajan workflow dispatch komutlarının yazılacağı dosya
 * @param {boolean} [params.hatirlat=false] - Açık vakalar için hatırlatma gönderilsin mi
 * @param {Date|string} [params.simdi=new Date()] - Referans zaman (testler için sabitlenebilir)
 * @returns {Promise<{ islenen: number, dispatch: Array<{ vakaId: string, eylem: string }>, hatirlatilan: number, hataSayisi: number }>}
 */
export async function isle({
  tg,
  dizin,
  kok,
  offsetDosya,
  dispatchDosya,
  hatirlat = false,
  simdi = new Date(),
}) {
  const simdiDate = simdi instanceof Date ? simdi : new Date(simdi);
  const kokDizin = kok || path.dirname(path.resolve(dizin));
  let hataSayisi = 0;

  async function guvenliGonder(fn) {
    try {
      return await fn();
    } catch {
      hataSayisi++;
    }
  }

  // 1. offsetDosya oku ({"offset":N}, yoksa 0)
  let offset = 0;
  if (offsetDosya) {
    try {
      const raw = await readFile(offsetDosya, 'utf-8');
      const parsed = JSON.parse(raw);
      if (typeof parsed?.offset === 'number') {
        offset = parsed.offset;
      }
    } catch {
      offset = 0;
    }
  }

  const { offset: yeniOffset, cevaplar = [] } = await tg.cevaplar(offset);

  let islenen = 0;
  const dispatch = [];

  // 2. Takılı 'uygulaniyor' kontrolü (her turda yapılır):
  // Kemal 25.11.2026: Durum 'uygulaniyor' ve son işlem 2 saatten eski ise vaka yeniden açılır;
  // Kemal'e mesaj GİTMESİN, rapor.mjs olayına yazılır.
  let hatirlatilan = 0;
  const takiliAcilanlar = new Set();

  try {
    const baslangicVakalari = await listele(dizin);
    for (const v of baslangicVakalari) {
      if (v.durum === 'uygulaniyor') {
        const sonGecmis =
          Array.isArray(v.gecmis) && v.gecmis.length > 0 ? v.gecmis[v.gecmis.length - 1] : null;
        const sonZaman = sonGecmis?.zaman
          ? new Date(sonGecmis.zaman).getTime()
          : new Date(v.olusturma).getTime();
        const ikiSaatGecti = simdiDate.getTime() - sonZaman > 2 * 60 * 60 * 1000;

        if (ikiSaatGecti) {
          let guncel = gecis(v, 'hata', { simdi: simdiDate });
          await kaydet(dizin, guncel);
          takiliAcilanlar.add(v.id);

          try {
            await olayEkle(kokDizin, {
              bekci: v.bekci,
              tur: 'takili',
              ozet: `#${v.id} 2 saatten uzun süre uygulanıyor kaldı, yeniden açıldı`,
              simdi: simdiDate,
            });
          } catch {}
        }
      }
    }
  } catch {}

  // 3. Her cevap:
  for (const cevap of cevaplar) {
    islenen++;
    const { vakaId, eylem, cqId } = cevap;

    if (eylem === 'liste') {
      const tumVakalar = await listele(dizin);
      const aciklar = tumVakalar.filter(v => v.durum === 'acik' || v.durum === 'uygulaniyor');
      if (aciklar.length === 0) {
        await guvenliGonder(() => tg.sendeKisa('Şu an senden beklediğim bir karar yok ✅'));
      } else {
        const metin = aciklar
          .map(v => `• ${v.baslik} — ${gunFarki(v.olusturma, simdiDate)} gün`)
          .join('\n');
        await guvenliGonder(() => tg.sendeKisa(metin));
      }
      continue;
    }

    if (eylem === 'metin_desteklenmiyor') {
      await guvenliGonder(() =>
        tg.sendeKisa(
          'Şimdilik yalnız mesajlardaki düğmeler çalışıyor. Bekleyen kararlar için: /vakalar'
        )
      );
      continue;
    }

    if (vakaId) {
      let v;
      try {
        v = await yukle(dizin, vakaId);
      } catch {
        const bulunamadiMetin = 'Bu soruyu bulamadım.';
        if (cqId && typeof tg.onayla === 'function') {
          await tg.onayla(cqId, bulunamadiMetin);
        } else {
          await guvenliGonder(() => tg.sendeKisa(bulunamadiMetin));
        }
        continue;
      }

      try {
        if (eylem === 'birak') {
          const yeniV = gecis(v, 'birak', { simdi: simdiDate });
          await kaydet(dizin, yeniV);
          const onayMetin = '❌ Tamam, bırakıldı.';
          if (cqId && typeof tg.onayla === 'function') {
            await tg.onayla(cqId, onayMetin);
          } else {
            await guvenliGonder(() => tg.sendeKisa(onayMetin));
          }
        } else if (eylem === 'acikla') {
          const yeniV = gecis(v, 'acikla', { simdi: simdiDate });
          await kaydet(dizin, yeniV);
          dispatch.push({ vakaId: v.id, eylem: 'acikla' });
          const onayMetin = '💬 Açıklama hazırlanıyor, birkaç dakika içinde gelecek.';
          if (cqId && typeof tg.onayla === 'function') {
            await tg.onayla(cqId, onayMetin);
          } else {
            await guvenliGonder(() => tg.sendeKisa(onayMetin));
          }
        } else if (eylem === 'uygula') {
          const yeniV = gecis(v, 'uygula', { simdi: simdiDate, yamaSha256: v.yamaSha256 });
          await kaydet(dizin, yeniV);
          dispatch.push({ vakaId: v.id, eylem: 'uygula' });
          const onayMetin = '✅ Alındı — uyguluyorum, bitince haftalık raporda görürsün.';
          if (cqId && typeof tg.onayla === 'function') {
            await tg.onayla(cqId, onayMetin);
          } else {
            await guvenliGonder(() => tg.sendeKisa(onayMetin));
          }
        }
      } catch (err) {
        if (err instanceof VakaHatasi || err.name === 'VakaHatasi') {
          const kapaliMetin = 'Bu soru zaten kapanmış.';
          if (cqId && typeof tg.onayla === 'function') {
            await tg.onayla(cqId, kapaliMetin);
          } else {
            await guvenliGonder(() => tg.sendeKisa(kapaliMetin));
          }
        } else {
          throw err;
        }
      }
    }
  }

  // 4. hatirlat true ise:
  // Kemal 25.11.2026:
  // - ≥ 3 Berlin günü geçmiş vakalar aranır.
  // - Toplam 3'ten fazla vaka hatırlatılacaksa, tek tek değil tek bir özet mesaj:
  //   🔁 <n> soru cevabını bekliyor: /vakalar (+ her vakanın asıl mesajına yanıt YOK)
  // - 1..3 vaka için:
  //   - mesajId varsa: asıl mesaja yanıt (reply_parameters: { message_id }) olarak tek satırlık
  //     🔁 Bu soru hâlâ cevabını bekliyor (<n> gündür). (düğme yok)
  //   - mesajId yoksa: bugünkü gibi tam mesajı (düğmeli) bir kez daha gönder ve dönen message_id'yi vakaya yaz.
  if (hatirlat) {
    const tumVakalar = await listele(dizin);
    const hatirlatilacaklar = [];
    for (const v of tumVakalar) {
      if (takiliAcilanlar.has(v.id)) continue;
      if (hatirlatmaGerekli(v, simdiDate)) {
        hatirlatilacaklar.push(v);
      }
    }

    if (hatirlatilacaklar.length > 3) {
      await guvenliGonder(() =>
        tg.sendeKisa(`🔁 ${hatirlatilacaklar.length} soru cevabını bekliyor: /vakalar`)
      );
      for (const v of hatirlatilacaklar) {
        const yeniV = gecis(v, 'hatirlat', { simdi: simdiDate });
        await kaydet(dizin, yeniV);
        hatirlatilan++;
      }
    } else if (hatirlatilacaklar.length > 0) {
      for (const v of hatirlatilacaklar) {
        const farkGun = gunFarki(v.olusturma, simdiDate);
        if (v.mesajId) {
          const yanitMetni = `🔁 Bu soru hâlâ cevabını bekliyor (${farkGun} gündür).`;
          await guvenliGonder(async () => {
            if (typeof tg.sendeYanit === 'function') {
              await tg.sendeYanit(v.mesajId, yanitMetni);
            } else if (typeof tg.sendeKisa === 'function') {
              await tg.sendeKisa(yanitMetni, { replyTo: v.mesajId });
            }
          });
          const yeniV = gecis(v, 'hatirlat', { simdi: simdiDate });
          await kaydet(dizin, yeniV);
          hatirlatilan++;
        } else {
          let sonucMsg = null;
          await guvenliGonder(async () => {
            if (typeof tg.sendeVaka === 'function') {
              sonucMsg = await tg.sendeVaka(v);
            }
          });
          let yeniV = v;
          if (sonucMsg?.message_id) {
            yeniV = mesajIdYaz(yeniV, sonucMsg.message_id);
          }
          yeniV = gecis(yeniV, 'hatirlat', { simdi: simdiDate });
          await kaydet(dizin, yeniV);
          hatirlatilan++;
        }
      }
    }
  }

  // 5. Offset dosyasını yeni offset'le yaz; dispatchDosya'ya her satır <vakaId> <eylem>\n (boşsa boş dosya)
  if (offsetDosya) {
    const dir = path.dirname(path.resolve(offsetDosya));
    await mkdir(dir, { recursive: true });
    const sonOffset = typeof yeniOffset === 'number' ? yeniOffset : offset;
    await writeFile(offsetDosya, JSON.stringify({ offset: sonOffset }) + '\n', 'utf-8');
  }

  if (dispatchDosya) {
    const dir = path.dirname(path.resolve(dispatchDosya));
    await mkdir(dir, { recursive: true });
    const satirlar = dispatch.map(d => `${d.vakaId} ${d.eylem}`).join('\n');
    await writeFile(dispatchDosya, satirlar ? satirlar + '\n' : '', 'utf-8');
  }

  return {
    islenen,
    dispatch,
    hatirlatilan,
    hataSayisi,
  };
}

/**
 * CLI argümanlarını ayrıştırır.
 * Desteklenen argümanlar: --vakalar=DIR, --kok=DIR, --offset=FILE, --dispatch=FILE, [--hatirlat]
 */
export function parseCliArgs(argv = process.argv.slice(2)) {
  let dizin = null;
  let kok = null;
  let offsetDosya = null;
  let dispatchDosya = null;
  let hatirlat = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--vakalar=')) {
      dizin = arg.slice('--vakalar='.length);
    } else if (arg === '--vakalar' && i + 1 < argv.length) {
      dizin = argv[++i];
    } else if (arg.startsWith('--kok=')) {
      kok = arg.slice('--kok='.length);
    } else if (arg === '--kok' && i + 1 < argv.length) {
      kok = argv[++i];
    } else if (arg.startsWith('--offset=')) {
      offsetDosya = arg.slice('--offset='.length);
    } else if (arg === '--offset' && i + 1 < argv.length) {
      offsetDosya = argv[++i];
    } else if (arg.startsWith('--dispatch=')) {
      dispatchDosya = arg.slice('--dispatch='.length);
    } else if (arg === '--dispatch' && i + 1 < argv.length) {
      dispatchDosya = argv[++i];
    } else if (arg === '--hatirlat' || arg === '--hatirlat=true') {
      hatirlat = true;
    }
  }

  return { dizin, kok, offsetDosya, dispatchDosya, hatirlat };
}

async function cli() {
  const token = process.env.TELEGRAM_BEKCI_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_BEKCI_CHAT_ID;
  const userId = process.env.TELEGRAM_BEKCI_USER_ID;

  if (!token || !chatId || !userId) {
    console.log('Bekçi-Bot nicht konfiguriert — nichts zu tun');
    process.exit(0);
  }

  const { dizin, kok, offsetDosya, dispatchDosya, hatirlat } = parseCliArgs();

  if (!dizin || !offsetDosya || !dispatchDosya) {
    console.error('Eksik parametre: --vakalar, --offset ve --dispatch zorunludur');
    process.exit(1);
  }

  try {
    const tg = new BekciTelegram({ token, chatId, userId });
    const sonuc = await isle({
      tg,
      dizin,
      kok,
      offsetDosya,
      dispatchDosya,
      hatirlat,
    });

    console.log(`${sonuc.islenen} cevap işlendi, ${sonuc.dispatch.length} dispatch`);
    if (sonuc.hataSayisi > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(err?.message || String(err));
    process.exit(1);
  }
}

// Dosya doğrudan çalıştırıldığında CLI'ı çalıştır
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  cli();
}
