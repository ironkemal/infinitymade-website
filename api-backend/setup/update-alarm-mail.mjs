// update-alarm-mail.mjs — O-82 (onprem/REGISTER.md): update.sh'ın "ok" dışındaki
// her sonucunu (durak/konflikt/geri_alindi/bakim_modu/yedek_basarisiz) ve
// "ok"'a dönüşü owner'a tek satırlık bir e-postayla bildirir. Faz 2.4'ün tam
// panelinden önceki ucuz ara kanal — onprem'in Çözüm önerisi.
//
// Bilerek DB'ye bağlanmıyor: `bakim_modu` tam olarak "db dahil konteynerler
// sağlıksız" demek, o an bir Supabase sorgusu da başarısız olurdu. Owner
// e-postası update.sh tarafından bir önceki başarılı "ok" koşusunda psql ile
// okunup önbelleğe alınmış ve buraya argüman olarak geliyor (onprem-Review,
// 13.09.2026) — mail yolu, alarm vermesi gereken arızadan bağımsız kalsın diye.
//
// Kullanım: node setup/update-alarm-mail.mjs <sonuc> <email> [business_name]
import { createSMTPTransport, getMailFrom } from '../lib/mail.js';

const [, , sonuc, email, businessName] = process.argv;

// SMTP kurulu değilse sessizce çık — install.sh'ın kendisi SMTP'yi atlamaya
// izin veriyor (O-66), o kutularda alarm da yoktur. Sicilde ayrıca not edilmiş.
if (!process.env.SMTP_HOST) process.exit(0);
if (!sonuc || !email) process.exit(0);

const METINLER = {
  ok: 'Automatisches Update erfolgreich abgeschlossen — Entwarnung, das vorherige Problem ist behoben.',
  durak: 'Automatisches Update angehalten: dieser Schritt erfordert eine manuelle Aktion.',
  konflikt: 'Automatisches Update angehalten: eigene Änderungen an Systemdateien gefunden.',
  geri_alindi: 'Update fehlgeschlagen und automatisch zurückgerollt — die Box läuft wieder auf dem vorherigen Stand.',
  bakim_modu: 'Update fehlgeschlagen, Rückrollen ebenfalls nicht erfolgreich — die Box benötigt manuelle Hilfe.',
  yedek_basarisiz: 'Update NICHT durchgeführt: die Sicherung vor dem Update ist fehlgeschlagen.',
};

const betreff = sonuc === 'ok'
  ? 'Praxura — Entwarnung: automatisches Update wieder ok'
  : 'Praxura — automatisches Update braucht Aufmerksamkeit';
const zeile = METINLER[sonuc] || `Automatisches Update: unbekannter Status "${sonuc}".`;

const transport = createSMTPTransport();
try {
  await transport.verify();
  await transport.sendMail({
    from: getMailFrom(businessName),
    to: email,
    subject: betreff,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2>${betreff}</h2>
      <p>${zeile}</p>
      <p style="color:#666;font-size:13px">Status: <code>${sonuc}</code> · ${new Date().toISOString()}</p>
      <p style="color:#666;font-size:13px">Details: update.log auf dem Server.</p>
    </div>`,
  });
} catch (err) {
  // Mail-Fehler dürfen den Exit-Code des Update-Laufs nie beeinflussen — das
  // ist bereits vor diesem Aufruf entschieden. update.sh liest nur diesen
  // Exit-Code (0/1), keine Ursache; die Diagnose steht in update.log.
  console.error('[update-alarm-mail]', err.message);
  process.exit(1);
}
