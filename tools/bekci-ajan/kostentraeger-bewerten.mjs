// tools/bekci-ajan/kostentraeger-bewerten.mjs
// Ne: Kostenträger seed'i için deterministik anomali kapısı ve karar motoru (+ CLI).
// Niye: SPEC.md §3.0e ve gkv-302 kararı (25.11.2026) uyarınca kutu ikizinde üretilen
// Kostenträger seed çıktısını (özet + kontroller) Anhang 03 §5.2/§8.3 kurallarına ve
// işletme eşiklerine göre inceler; anomali yoksa 'auto', anomali varsa 'vaka',
// değişiklik yoksa 'sessiz' kararı üretir.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { iz, kararlıStringify } from './iz.mjs';

/**
 * SHA-256 hash hesaplayıcı (hex).
 * @param {string} metin
 * @returns {string}
 */
export function sha256(metin) {
  return createHash('sha256').update(metin || '', 'utf-8').digest('hex');
}

/**
 * Kostenträger kutu-seed çıktısını değerlendirir.
 * İstisna fırlatmaz; bozuk özet verildiğinde 'vaka' (özet okunamadı) döner.
 *
 * @param {object} params
 * @param {any} params.ozet - kutu-seed stdout JSON çıktısı
 * @param {any} [params.kontroller] - vorher ve nachher DB kontrol sonuçları (opsiyonel; ozet.kontroller'den de alınabilir)
 * @returns {{
 *   karar: 'auto' | 'vaka' | 'sessiz',
 *   gruende: string[],
 *   vaka: null | {
 *     bekci: 'kostentraeger',
 *     baslik: string,
 *     satirlar: string[],
 *     dosyalar: string[],
 *     oneri: null,
 *     ek: { iz: string, dosya: string | null, uygulanabilir: boolean }
 *   },
 *   rapor: string[]
 * }}
 */
export function bewerte({ ozet, kontroller: disKontroller } = {}) {
  // 0) Bozuk veya eksik özet kontrolü (istisna fırlatmaz)
  if (!ozet || typeof ozet !== 'object' || Array.isArray(ozet)) {
    const vakaIzi = iz([sha256('bozuk_ozet')]);
    return {
      karar: 'vaka',
      gruende: ['özet okunamadı'],
      vaka: {
        bekci: 'kostentraeger',
        baslik: 'Kostenträger: özet okunamadı',
        satirlar: ['• Özet verisi geçersiz veya okunamadı.'],
        dosyalar: [],
        oneri: null,
        ek: {
          iz: vakaIzi,
          dosya: null,
          uygulanabilir: false,
        },
      },
      rapor: [],
    };
  }

  const kontroller = disKontroller || ozet.kontroller || {};
  const vorherK = kontroller.vorher || {};
  const nachherK = kontroller.nachher || {};

  const gruende = [];
  const satirlar = [];

  // 4) Eşik 4: waehleAusgaben().ohneGueltige dolu veya kutu-seed hata taşıyor
  if (ozet.hata || (Array.isArray(ozet.ohneGueltige) && ozet.ohneGueltige.length > 0)) {
    const hataMetni = ozet.hata || `Kassenart ${ozet.ohneGueltige.join(', ')} için geçerli çıktı bulunamadı`;
    gruende.push('ohne_gueltige_ausgabe');
    satirlar.push(`• Hata (ohneGueltige): ${hataMetni}`);
  }

  // Değişiklik yoksa ve hata yoksa -> sessiz
  if (ozet.degisiklik === false && gruende.length === 0) {
    return {
      karar: 'sessiz',
      gruende: [],
      vaka: null,
      rapor: [],
    };
  }

  const stichtag = ozet.stichtag || '';
  const tablolar = ozet.tablolar || {};
  const ktStats = tablolar.kostentraeger || { satir: 0, yeni: 0, kapanan: 0, degisen: 0, degisenGercek: 0 };
  const vkgStats = tablolar.kostentraeger_annahmestellen || { satir: 0, yeni: 0, kapanan: 0, degisen: 0, degisenGercek: 0 };
  const ansStats = tablolar.kostentraeger_anschriften || { satir: 0, yeni: 0, kapanan: 0, degisen: 0, degisenGercek: 0 };

  // 1) Eşik 1:
  // - VKG: kapanan anahtar > açık satırların %3'ü
  const vkgAcik = nachherK.acikSatirlar?.vkg ?? vorherK.acikSatirlar?.vkg ?? vkgStats.acik ?? vkgStats.satir ?? 0;
  if (vkgAcik > 0 && vkgStats.kapanan > 0) {
    const vkgOran = vkgStats.kapanan / vkgAcik;
    if (vkgOran > 0.03) {
      gruende.push('vkg_kapanan_esigi_asildi');
      satirlar.push(`• VKG kapanan anahtar (%${(vkgOran * 100).toFixed(1)}) eşiği (%3) aştı: ${vkgStats.kapanan} / ${vkgAcik}`);
    }
  }

  // - ANS: kapanan anahtar > açık satırların %5'i
  const ansAcik = nachherK.acikSatirlar?.ans ?? vorherK.acikSatirlar?.ans ?? ansStats.acik ?? ansStats.satir ?? 0;
  if (ansAcik > 0 && ansStats.kapanan > 0) {
    const ansOran = ansStats.kapanan / ansAcik;
    if (ansOran > 0.05) {
      gruende.push('ans_kapanan_esigi_asildi');
      satirlar.push(`• ANS kapanan anahtar (%${(ansOran * 100).toFixed(1)}) eşiği (%5) aştı: ${ansStats.kapanan} / ${ansAcik}`);
    }
  }

  // - reopens > 20
  const reopensSayisi = Number(ozet.reopens ?? ((ozet.vkg?.reopens?.length || 0) + (ozet.ans?.reopens?.length || 0)));
  if (reopensSayisi > 20) {
    gruende.push('reopens_esigi_asildi');
    satirlar.push(`• Yeniden açılan satır sayısı (${reopensSayisi}) eşiği (20) aştı`);
  }

  // - Herhangi bir tabloda toplam değişen satır > %10 (sadece degisenGercek sayılır; quelle/quelle_stand/updated_at sayılmaz)
  const tabloAdlari = ['kostentraeger', 'kostentraeger_annahmestellen', 'kostentraeger_anschriften'];
  for (const t of tabloAdlari) {
    const tStats = tablolar[t];
    if (!tStats) continue;
    const gercekDegisen = tStats.degisenGercek !== undefined ? tStats.degisenGercek : tStats.degisen;
    const toplamSatir = tStats.satir || 0;
    if (toplamSatir > 0 && (gercekDegisen / toplamSatir) > 0.10) {
      const oran = (gercekDegisen / toplamSatir) * 100;
      gruende.push(`${t}_degisen_gercek_esigi_asildi`);
      satirlar.push(`• ${t} gerçek değişen satır oranı (%${oran.toFixed(1)}) eşiği (%10) aştı: ${gercekDegisen} / ${toplamSatir}`);
    }
  }

  // 2) Eşik 2:
  // - kostentraeger: kapanan IK > 5
  const kapananIkSayisi = Number(ktStats.kapanan ?? (ozet.kapananIk?.length || 0));
  if (kapananIkSayisi > 5) {
    gruende.push('kt_kapanan_esigi_asildi');
    const ornekIkler = (ozet.kapananIk || []).slice(0, 5).join(', ');
    satirlar.push(`• Kostenträger kapanan IK (${kapananIkSayisi}) eşiği (5) aştı${ornekIkler ? ': ' + ornekIkler : ''}`);
  }

  // - kostentraeger: yeni IK > 30
  const yeniIkSayisi = Number(ktStats.yeni ?? (ozet.yeniIk?.length || 0));
  if (yeniIkSayisi > 30) {
    gruende.push('kt_yeni_esigi_asildi');
    const ornekIkler = (ozet.yeniIk || []).slice(0, 5).join(', ');
    satirlar.push(`• Kostenträger yeni IK (${yeniIkSayisi}) eşiği (30) aştı${ornekIkler ? ': ' + ornekIkler : ''}`);
  }

  // 3) Eşik 3: abrechnender_kt_ik olmayan IK veya valid_to < stichtag veya zincir döngü — yalnız YENİ ortaya çıkanlar (delta)
  const vorherGecersizKt = new Set((vorherK.gecersizAbrechnenderKt || []).map(r => `${r.ik}->${r.abrechnender_kt_ik}`));
  const yeniGecersizKt = (nachherK.gecersizAbrechnenderKt || []).filter(r => !vorherGecersizKt.has(`${r.ik}->${r.abrechnender_kt_ik}`));
  for (const r of yeniGecersizKt) {
    gruende.push('yeni_gecersiz_abrechnender_kt');
    const neden = !r.ziel_ik ? 'hedef IK mevcut değil' : `hedef IK süresi dolmuş (${r.ziel_valid_to} < ${stichtag})`;
    satirlar.push(`• Yeni geçersiz abrechnender_kt_ik: ${r.ik} → ${r.abrechnender_kt_ik} (${neden})`);
  }

  const vorherDongu = new Set((vorherK.zincirDongu || []).map(r => r.start_ik));
  const yeniDonguler = (nachherK.zincirDongu || []).filter(r => !vorherDongu.has(r.start_ik));
  for (const r of yeniDonguler) {
    gruende.push('yeni_zincir_dongusu');
    const yol = Array.isArray(r.pfad) ? r.pfad.join(' → ') : r.start_ik;
    satirlar.push(`• Yeni faturalayan KT zincir döngüsü: ${r.start_ik} (yol: ${yol})`);
  }

  // 5) Eşik 5: Aktif ve ist_abrechnender_kt = true bir KT'nin açık VKG'si 02/03 + 07/30 kalmıyor — DELTA olarak
  const vorherCozulemeyen = new Set((vorherK.cozulemeyenKt || []).map(r => (typeof r === 'string' ? r : r.ik)));
  const nachherCozulemeyen = (nachherK.cozulemeyenKt || []).map(r => (typeof r === 'string' ? { ik: r, name: '' } : r));
  const yeniCozulemeyenler = nachherCozulemeyen.filter(r => !vorherCozulemeyen.has(r.ik));
  for (const r of yeniCozulemeyenler) {
    gruende.push('yeni_cozulemeyen_kt');
    satirlar.push(`• Çözülemeyen faturalayan KT (yeni): ${r.ik}${r.name ? ' (' + r.name + ')' : ''} açık 02/03 + 07/30 VKG bulunamadı`);
  }

  // 6) Eşik 6: Bir KT'nin açık art_datenlieferung = '09' (veya verknuepfungsart = '09') satırı kalmıyor (vorher'de vardı)
  // ya da hiç açık VKG satırı kalmıyor (vorher'de vardı).
  const vorherVkgMap = new Map((vorherK.vkgVe09Sayisi || []).map(r => [r.ik, r]));
  for (const n of nachherK.vkgVe09Sayisi || []) {
    const v = vorherVkgMap.get(n.ik);
    if (!v) continue;
    if (v.acik_09_sayisi > 0 && n.acik_09_sayisi === 0) {
      gruende.push('acik_09_satiri_kalmadi');
      satirlar.push(`• KT ${n.ik} açık 09 (Papierannahmestelle) satırı kalmadı (vorher: ${v.acik_09_sayisi}, nachher: 0)`);
    }
    if (v.acik_vkg_sayisi > 0 && n.acik_vkg_sayisi === 0) {
      gruende.push('hic_acik_vkg_kalmadi');
      satirlar.push(`• KT ${n.ik} hiçbir açık VKG satırı kalmadı (vorher: ${v.acik_vkg_sayisi}, nachher: 0)`);
    }
  }

  // 7) Eşik 7: Bir KT'nin açık VKG verknuepfungsart = '03' partner_ik kümesi değişiyor (DAS/sertifika).
  // Özellikle yeni partner daha önce hiç 03 hedefi olmadıysa satırda belirt.
  const vorher03Map = new Map((vorherK.vkg03Partnerler || []).map(r => [r.kostentraeger_ik, r.partner_ikler || '']));
  const tum03VorherSet = new Set(
    vorherK.tum03Partnerler ||
    (vorherK.vkg03Partnerler || []).flatMap(r => (r.partner_ikler || '').split(',').filter(Boolean))
  );

  for (const n of nachherK.vkg03Partnerler || []) {
    const ktIk = n.kostentraeger_ik;
    const vPartnerlerStr = vorher03Map.get(ktIk);
    const nPartnerlerStr = n.partner_ikler || '';
    if (vPartnerlerStr !== undefined && vPartnerlerStr !== nPartnerlerStr) {
      gruende.push('vkg_03_partner_degisti');
      const vSet = new Set(vPartnerlerStr.split(',').filter(Boolean));
      const nList = nPartnerlerStr.split(',').filter(Boolean);
      const yeniEklenenler = nList.filter(p => !vSet.has(p));
      const hicHedefOlmamis = yeniEklenenler.filter(p => !tum03VorherSet.has(p));

      let ekNot = '';
      if (hicHedefOlmamis.length > 0) {
        ekNot = ` (yeni partner ${hicHedefOlmamis.join(', ')} daha önce hiç 03 hedefi olmadı)`;
      }
      satirlar.push(`• KT ${ktIk} açık VKG 03 partner kümesi değişti: [${vPartnerlerStr}] → [${nPartnerlerStr}]${ekNot}`);
    }
  }

  // 8) Eşik 8: ist_abrechnender_kt bir KT'de tersine dönüyor
  const vorherIstAbrechnender = new Map((vorherK.istAbrechnenderKt || []).map(r => [r.ik, Boolean(r.ist_abrechnender_kt)]));
  for (const n of nachherK.istAbrechnenderKt || []) {
    const v = vorherIstAbrechnender.get(n.ik);
    const simdi = Boolean(n.ist_abrechnender_kt);
    if (v !== undefined && v !== simdi) {
      gruende.push('ist_abrechnender_kt_tersine_dondu');
      satirlar.push(`• KT ${n.ik} ist_abrechnender_kt tersine döndü: ${v} → ${simdi}`);
    }
  }

  // 9) Eşik 9: ungueltigeAnschriften artıyor
  let ungueltigeOnceki = 0;
  let ungueltigeSimdi = 0;
  let ungueltigeArtisi = false;

  if (typeof ozet.ungueltigeAnschriften === 'object' && ozet.ungueltigeAnschriften !== null) {
    ungueltigeOnceki = Number(ozet.ungueltigeAnschriften.onceki ?? 0);
    ungueltigeSimdi = Number(ozet.ungueltigeAnschriften.simdi ?? 0);
    ungueltigeArtisi = ungueltigeSimdi > ungueltigeOnceki;
  } else if (typeof ozet.ungueltigeAnschriften === 'number') {
    ungueltigeSimdi = ozet.ungueltigeAnschriften;
    ungueltigeOnceki = Number(ozet.oncekiUngueltigeAnschriften ?? 0);
    ungueltigeArtisi = ungueltigeSimdi > ungueltigeOnceki;
  } else if (nachherK.ungueltigeAnschriften !== undefined && vorherK.ungueltigeAnschriften !== undefined) {
    ungueltigeSimdi = Number(nachherK.ungueltigeAnschriften);
    ungueltigeOnceki = Number(vorherK.ungueltigeAnschriften);
    ungueltigeArtisi = ungueltigeSimdi > ungueltigeOnceki;
  }

  if (ungueltigeArtisi) {
    gruende.push('ungueltige_anschriften_artti');
    satirlar.push(`• Geçersiz adres segmenti (ungueltigeAnschriften) arttı: ${ungueltigeOnceki} → ${ungueltigeSimdi}`);
  }

  // 11) Eşik 11: Bir Kassenart için kayıt sayısı önceki geçerli dosyaya göre %5'ten fazla düşüyor
  const dosyaSayilari = ozet.dosyaSayilari || {};
  for (const [kassenart, sayilar] of Object.entries(dosyaSayilari)) {
    if (!sayilar || typeof sayilar !== 'object') continue;
    const onceki = Number(sayilar.onceki);
    const simdi = Number(sayilar.simdi);
    if (onceki > 0 && Number.isFinite(simdi) && simdi < onceki) {
      const dusus = (onceki - simdi) / onceki;
      if (dusus > 0.05) {
        gruende.push(`kassenart_${kassenart.toLowerCase()}_kayit_sayisi_dustu`);
        satirlar.push(`• Kassenart ${kassenart} kayıt sayısı önceki geçerli dosyaya göre %${(dusus * 100).toFixed(1)} düştü (${onceki} → ${simdi}, eşik: %5)`);
      }
    }
  }

  // Parmak izi hesaplama: ek.iz = iz([dosya içeriğinin sha256'sı])
  let dosyaSha = '';
  if (typeof ozet.durumIz === 'string' && /^[a-f0-9]{64}$/.test(ozet.durumIz)) {
    // Veri durumu izi (updated_at hariç) — her gün yeniden üretilen dosya aynı vakayı açmasın
    dosyaSha = ozet.durumIz;
  } else if (ozet.dosyaSha256) {
    dosyaSha = ozet.dosyaSha256;
  } else if (ozet.dosya && existsSync(ozet.dosya)) {
    try {
      dosyaSha = sha256(readFileSync(ozet.dosya, 'utf8'));
    } catch {
      dosyaSha = sha256(ozet.dosya);
    }
  } else if (ozet.dosyaIcerik) {
    dosyaSha = sha256(ozet.dosyaIcerik);
  } else {
    dosyaSha = sha256(kararlıStringify(ozet));
  }
  const vakaIzi = iz([dosyaSha]);

  // VAKA KARARI
  if (gruende.length > 0) {
    const kirpilmisSatirlar = satirlar.slice(0, 15);
    return {
      karar: 'vaka',
      gruende,
      vaka: {
        bekci: 'kostentraeger',
        baslik: `Kostenträger: ${gruende.length} anomali tespit edildi`,
        satirlar: kirpilmisSatirlar,
        dosyalar: ozet.dosya ? [ozet.dosya] : [],
        oneri: null,
        ek: {
          iz: vakaIzi,
          dosya: ozet.dosya || null,
          uygulanabilir: true,
        },
      },
      rapor: [],
    };
  }

  // AUTO KARARI (hiçbir eşik aşılmadı)
  const rapor = [
    `✓ Kostenträger: kostentraeger +${ktStats.yeni} / −${ktStats.kapanan} / ~${ktStats.degisen}`,
    `✓ Kostenträger: kostentraeger_annahmestellen +${vkgStats.yeni} / −${vkgStats.kapanan} / ~${vkgStats.degisen}`,
    `✓ Kostenträger: kostentraeger_anschriften +${ansStats.yeni} / −${ansStats.kapanan} / ~${ansStats.degisen}`,
  ];
  if (Array.isArray(ozet.aktiv) && ozet.aktiv.length > 0) {
    rapor.push(`Kaynak dosyalar: ${ozet.aktiv.join(', ')}`);
  }
  if (ozet.dosya) {
    rapor.push(`Üretilen seed: ${ozet.dosya}`);
  }

  return {
    karar: 'auto',
    gruende: [],
    vaka: null,
    rapor,
  };
}

/**
 * CLI çalıştırıcı.
 */
export function cliCalistir() {
  const args = process.argv.slice(2);
  let ozetPath = null;
  let outPath = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--ozet=')) {
      ozetPath = a.slice('--ozet='.length);
    } else if (a === '--ozet' && i + 1 < args.length) {
      ozetPath = args[++i];
    } else if (a.startsWith('--out=')) {
      outPath = a.slice('--out='.length);
    } else if (a === '--out' && i + 1 < args.length) {
      outPath = args[++i];
    }
  }

  if (!ozetPath) {
    console.error('Kullanım: node tools/bekci-ajan/kostentraeger-bewerten.mjs --ozet=FILE [--out=FILE]');
    process.exit(1);
  }

  let ozet = null;
  try {
    const icerik = readFileSync(ozetPath, 'utf8');
    ozet = JSON.parse(icerik);
  } catch {
    ozet = null;
  }

  const sonuc = bewerte({ ozet });

  if (outPath) {
    try {
      writeFileSync(outPath, JSON.stringify(sonuc, null, 2), 'utf8');
    } catch (err) {
      console.error(`Çıktı dosyası yazılamadı: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`karar: ${sonuc.karar}`);
  process.exit(0);
}

// Yalnız doğrudan çalıştırıldığında CLI tetiklenir
const suAnkiDosya = fileURLToPath(import.meta.url).toLowerCase();
const cagirilanDosya = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (cagirilanDosya && cagirilanDosya === suAnkiDosya) {
  cliCalistir();
}
