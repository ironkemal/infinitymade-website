#!/usr/bin/env node
// tools/bekci-ajan/gonder-vaka.mjs — bir vakayı Kemal'e "tek başına anlaşılır" mesajla gönderir.
// Niye (Kemal 25.11.2026): "Mesajdan hiçbir şey anlamadım; numara ve dosya adı söyleyince bulamıyorum.
// Mesajı okuyarak karar verebilmeliyim; gerekirse ilgili yeri işaretli fotoğraf at; göndermeden önce
// başka bir ajan kontrol etsin." Akış: Claude'un anlatımı (prompts/anlat.md) + ikinci ajanın denetimi
// (prompts/denetci.md) → anlat.mjs anlatimSec (şema + rakam koruması + yasak kalıplar) → işaretli sayfa
// görselleri (isaretle.mjs) → düğmeli mesaj → message_id vakaya. Geçerli anlatım yoksa yedekMesaj.
//
// Kullanım:
//   node tools/bekci-ajan/gonder-vaka.mjs --kok=DIR --id=VAKA --entscheidung=FILE
//        [--anlatim=FILE] [--denetim=FILE] [--belgeler=DIR] [--olgular=FILE,FILE] [--aciklama]
// env: TELEGRAM_BEKCI_BOT_TOKEN, TELEGRAM_BEKCI_CHAT_ID, TELEGRAM_BEKCI_USER_ID
// stdout: yalnız sayılar (mesaj metni loga basılmaz).

import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BekciTelegram } from './telegram.mjs';
import { yukle, kaydet, mesajIdYaz } from './vaka.mjs';
import { anlatimSec, mesajKur, yedekMesaj } from './anlat.mjs';
import { isaretle } from './isaretle.mjs';

const okuJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const okuMetin = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

/** Entscheidung içindeki vaka listesi (preise/kostentraeger: tek `vaka`, quellen: `vakalar[]`). */
export function entscheidungVakalari(e) {
  if (!e || typeof e !== 'object') return [];
  if (Array.isArray(e.vakalar)) return e.vakalar;
  if (e.vaka && typeof e.vaka === 'object') return [e.vaka];
  return [];
}

/** Kaydedilmiş vakanın entscheidung'daki sırası — önce ek.iz, sonra quelleId, sonra baslik ile eşleşir. */
export function siraBul(vaka, adaylar) {
  const iz = vaka?.ek?.iz;
  let i = iz ? adaylar.findIndex(a => a?.ek?.iz === iz) : -1;
  if (i < 0 && vaka?.ek?.quelleId) i = adaylar.findIndex(a => a?.ek?.quelleId === vaka.ek.quelleId);
  if (i < 0) i = adaylar.findIndex(a => a?.baslik === vaka?.baslik);
  return i;
}

/** anlatim.json / denetim.json: `{ vakalar: [...] }` ya da tek nesne. */
export function siradaki(dosyaIcerik, sira) {
  if (!dosyaIcerik || typeof dosyaIcerik !== 'object') return null;
  if (Array.isArray(dosyaIcerik.vakalar)) return dosyaIcerik.vakalar[sira] ?? null;
  return sira === 0 ? dosyaIcerik : null;
}

/** Rakam korumasının "izinli" metni: vaka satırları + verilen olgu dosyaları + belge metinleri. */
export function olgularKur({ vaka, olguDosyalari = [], belgelerDizin = null, belgeIndex = [] }) {
  const parcalar = [...(vaka?.satirlar || []), vaka?.baslik || ''];
  for (const f of olguDosyalari) parcalar.push(okuMetin(f));
  if (belgelerDizin) for (const b of belgeIndex) if (b?.dosya) parcalar.push(okuMetin(join(belgelerDizin, b.dosya)));
  return parcalar.join('\n');
}

export async function gonder({ tg, kok, id, entscheidung, anlatimDosya, denetimDosya, belgelerDizin, olguDosyalari = [], aciklama = false }) {
  const dizin = join(kok, 'vakalar');
  let vaka = await yukle(dizin, id);
  const adaylar = entscheidungVakalari(entscheidung);
  const sira = Math.max(0, siraBul(vaka, adaylar));
  const belgeIndex = belgelerDizin ? (okuJson(join(belgelerDizin, 'index.json')) || []) : [];
  const belgeAdlari = belgeIndex.map(b => b?.dosya).filter(Boolean);
  const olgular = olgularKur({ vaka, olguDosyalari, belgelerDizin, belgeIndex });

  const anlatim = siradaki(anlatimDosya ? okuJson(anlatimDosya) : null, sira);
  const denetim = siradaki(denetimDosya ? okuJson(denetimDosya) : null, sira);
  const secim = anlatimSec({ anlatim, denetim, olgular, belgeAdlari });
  const sonuc = { kaynak: secim?.kaynak || null, gorsel: 0, yedek: false };

  // 1) İşaretli sayfa görselleri (yalnız geçerli anlatımda; PDF varsa)
  if (secim?.anlatim && belgelerDizin) {
    const cikti = mkdtempSync(join(tmpdir(), 'bekci-isaret-'));
    for (const isr of (secim.anlatim.isaretler || []).slice(0, 3)) {
      const kayit = belgeIndex.find(b => b?.dosya === isr.belge);
      if (!kayit?.pdf) continue;
      const pdfYolu = join(belgelerDizin, kayit.pdf);
      if (!existsSync(pdfYolu)) continue;
      const png = await isaretle({ pdfYolu, arananMetin: isr.aranan_metin, ciktiDizin: cikti }).catch(() => null);
      if (!png) continue;
      try { await tg.sendeBild(png, `📎 ${isr.neden || 'İlgili yer sarıyla işaretli.'}`); sonuc.gorsel++; } catch { /* görsel gitmezse mesaj yine gider */ }
    }
  }

  // 2) Asıl mesaj
  if (aciklama) {
    const metin = secim?.anlatim ? mesajKur({ vaka, anlatim: secim.anlatim }).text
      : 'Bu konuyu daha ayrıntılı anlatamadım — Claude\'a "bu bekçi sorusunu açıkla" demen yeterli.';
    await tg.sendeKisa(metin, vaka.mesajId ? { replyTo: vaka.mesajId } : {});
    return sonuc;
  }
  const { text, knoepfe } = secim?.anlatim ? mesajKur({ vaka, anlatim: secim.anlatim }) : yedekMesaj({ vaka });
  if (!secim?.anlatim) sonuc.yedek = true;
  const res = await tg.sende(text, knoepfe);
  if (res?.message_id) {
    vaka = mesajIdYaz(vaka, res.message_id);
    await kaydet(dizin, vaka);
  }
  return sonuc;
}

function arg(ad) {
  const a = process.argv.find(x => x.startsWith(`--${ad}=`));
  return a ? a.slice(ad.length + 3) : null;
}

async function main() {
  const { TELEGRAM_BEKCI_BOT_TOKEN: token, TELEGRAM_BEKCI_CHAT_ID: chatId, TELEGRAM_BEKCI_USER_ID: userId } = process.env;
  if (!token || !chatId || !userId) { console.log('Bekçi-Bot nicht konfiguriert — nichts zu tun'); return; }
  const kok = arg('kok'), id = arg('id'), eFile = arg('entscheidung');
  if (!kok || !id || !eFile) { console.error('Eksik: --kok --id --entscheidung'); process.exit(2); }
  const tg = new BekciTelegram({ token, chatId, userId });
  const s = await gonder({
    tg, kok, id,
    entscheidung: okuJson(eFile),
    anlatimDosya: arg('anlatim'), denetimDosya: arg('denetim'), belgelerDizin: arg('belgeler'),
    olguDosyalari: (arg('olgular') || '').split(',').filter(Boolean),
    aciklama: process.argv.includes('--aciklama'),
  });
  console.log(`gönderildi: kaynak=${s.kaynak || 'yok'} görsel=${s.gorsel} yedek=${s.yedek}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e?.message || String(e)); process.exit(1); });
}
void fileURLToPath;
