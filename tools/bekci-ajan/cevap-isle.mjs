// tools/bekci-ajan/cevap-isle.mjs
// Ne: Bekçi-Ajan Telegram cevaplarını işleme, vaka durumlarını güncelleme ve hatırlatma motoru.
// Niye: SPEC.md §2.2, §3.0 ve .github/workflows/bekci-cevap.yml gereğince; Telegram'dan gelen
// kararları (uygula/birak/acikla) ve komutları (/vakalar) güvenli şekilde işler, vaka durum
// makinesini ilerletir, dispatch dosyasını ve offset'i günceller, açık vakalara hatırlatma gönderir.

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
  eskidi,
} from './vaka.mjs';

/**
 * Telegram cevaplarını işler, vaka durumlarını günceller ve hatırlatmaları iletir.
 *
 * @param {object} params
 * @param {BekciTelegram} params.tg - BekciTelegram örneği veya uyumlu arayüz
 * @param {string} params.dizin - Vakaların saklandığı dizin yolu
 * @param {string} [params.offsetDosya] - Offset bilgisinin saklandığı JSON dosyasının yolu
 * @param {string} [params.dispatchDosya] - Bekci-ajan workflow dispatch komutlarının yazılacağı dosya
 * @param {boolean} [params.hatirlat=false] - Açık vakalar için hatırlatma gönderilsin mi
 * @param {Date|string} [params.simdi=new Date()] - Referans zaman (testler için sabitlenebilir)
 * @returns {Promise<{ islenen: number, dispatch: Array<{ vakaId: string, eylem: string }>, hatirlatilan: number, hataSayisi: number }>}
 */
export async function isle({
  tg,
  dizin,
  offsetDosya,
  dispatchDosya,
  hatirlat = false,
  simdi = new Date(),
}) {
  const simdiDate = simdi instanceof Date ? simdi : new Date(simdi);
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

  // 2. Her cevap:
  for (const cevap of cevaplar) {
    islenen++;
    const { vakaId, eylem } = cevap;

    if (eylem === 'liste') {
      const tumVakalar = await listele(dizin);
      const aciklar = tumVakalar.filter(v => v.durum === 'acik' || v.durum === 'uygulaniyor');
      if (aciklar.length === 0) {
        await guvenliGonder(() => tg.sendeKisa('Açık vaka yok ✅'));
      } else {
        const metin = aciklar.map(v => `#${v.id} · ${v.baslik}`).join('\n');
        await guvenliGonder(() => tg.sendeKisa(metin));
      }
      continue;
    }

    if (eylem === 'metin_desteklenmiyor') {
      await guvenliGonder(() =>
        tg.sendeKisa(
          'Şimdilik yalnız düğmeler çalışıyor (✅ Uygula · ❌ Bırak · 💬 Açıkla). Açık vakalar: /vakalar'
        )
      );
      continue;
    }

    if (vakaId) {
      let v;
      try {
        v = await yukle(dizin, vakaId);
      } catch {
        await guvenliGonder(() => tg.sendeKisa(`#${vakaId} bulunamadı`));
        continue;
      }

      try {
        if (eylem === 'birak') {
          const yeniV = gecis(v, 'birak', { simdi: simdiDate });
          await kaydet(dizin, yeniV);
          await guvenliGonder(() => tg.sendeKisa(`❌ #${v.id} bırakıldı.`));
        } else if (eylem === 'acikla') {
          const yeniV = gecis(v, 'acikla', { simdi: simdiDate });
          await kaydet(dizin, yeniV);
          dispatch.push({ vakaId: v.id, eylem: 'acikla' });
          await guvenliGonder(() => tg.sendeKisa(`💬 #${v.id} için açıklama hazırlanıyor…`));
        } else if (eylem === 'uygula') {
          const yeniV = gecis(v, 'uygula', { simdi: simdiDate, yamaSha256: v.yamaSha256 });
          await kaydet(dizin, yeniV);
          dispatch.push({ vakaId: v.id, eylem: 'uygula' });
          await guvenliGonder(() =>
            tg.sendeKisa(`✅ #${v.id} uygulanıyor, bitince haber veririm.`)
          );
        }
      } catch (err) {
        if (err instanceof VakaHatasi || err.name === 'VakaHatasi') {
          await guvenliGonder(() =>
            tg.sendeKisa(`#${v.id} zaten kapalı (durum: ${v.durum}).`)
          );
        } else {
          throw err;
        }
      }
    }
  }

  // 4. hatirlat true ise:
  let hatirlatilan = 0;
  if (hatirlat) {
    const tumVakalar = await listele(dizin);
    for (const v of tumVakalar) {
      if (hatirlatmaGerekli(v, simdiDate)) {
        const { text, knoepfe } = mesaj(v);
        const n = (v.hatirlatma || 0) + 1;
        let onek = `🔁 Hatırlatma ${n} · `;
        if (eskidi(v, simdiDate)) {
          onek = `⏳ 14+ gündür açık · ${onek}`;
        }
        const gonderilecekText = `${onek}${text}`;

        await guvenliGonder(async () => {
          if (typeof tg.sende === 'function') {
            await tg.sende(gonderilecekText, knoepfe);
          } else if (typeof tg.sendeVaka === 'function') {
            await tg.sendeVaka(v);
          }
        });

        const yeniV = gecis(v, 'hatirlat', { simdi: simdiDate });
        await kaydet(dizin, yeniV);
        hatirlatilan++;
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
 * Desteklenen argümanlar: --vakalar=DIR, --offset=FILE, --dispatch=FILE, [--hatirlat]
 */
export function parseCliArgs(argv = process.argv.slice(2)) {
  let dizin = null;
  let offsetDosya = null;
  let dispatchDosya = null;
  let hatirlat = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--vakalar=')) {
      dizin = arg.slice('--vakalar='.length);
    } else if (arg === '--vakalar' && i + 1 < argv.length) {
      dizin = argv[++i];
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

  return { dizin, offsetDosya, dispatchDosya, hatirlat };
}

async function cli() {
  const token = process.env.TELEGRAM_BEKCI_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_BEKCI_CHAT_ID;
  const userId = process.env.TELEGRAM_BEKCI_USER_ID;

  if (!token || !chatId || !userId) {
    console.log('Bekçi-Bot nicht konfiguriert — nichts zu tun');
    process.exit(0);
  }

  const { dizin, offsetDosya, dispatchDosya, hatirlat } = parseCliArgs();

  if (!dizin || !offsetDosya || !dispatchDosya) {
    console.error('Eksik parametre: --vakalar, --offset ve --dispatch zorunludur');
    process.exit(1);
  }

  try {
    const tg = new BekciTelegram({ token, chatId, userId });
    const sonuc = await isle({
      tg,
      dizin,
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
