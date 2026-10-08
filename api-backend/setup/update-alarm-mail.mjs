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
  // O-175 (07.10.2026) — von backup.sh (nächtliche Sicherung), nicht von update.sh.
  // guvenlik: nur fester Text, kein Log-Auszug, kein Pfad, kein Schlüssel.
  sicherung_fehlgeschlagen: 'Die nächtliche Sicherung ist fehlgeschlagen — es gibt keine neue Sicherung.',
  sicherungsschluessel_fehlt: 'Die nächtliche Sicherung wurde NICHT erstellt: es ist kein Sicherungsschlüssel eingerichtet. Einmal ausführen: sudo bash install.sh --sicherungsschluessel',
  // O-172 / S-47 Bed. 5 (08.10.2026) — von update.sh, eigener Zustand, nicht son-bildirim.json.
  // K2b.19 (S-53 Nr. 5): die lokale CA der Box ("eigene Adresse") erneuert sich nicht selbst.
  lokale_ca_laeuft_ab: 'Die Zertifizierungsstelle der Box läuft in weniger als 90 Tagen ab und erneuert sich nicht von selbst. Bitte den Support kontaktieren: Die Box braucht ein neues Zertifikat, das danach auf jedem Praxisgerät einmal neu importiert wird.',
  zertifikat_laeuft_ab: 'Das Sicherheitszertifikat der Box läuft in weniger als 21 Tagen ab und wurde noch nicht automatisch erneuert. Bitte prüfen, ob die Box Internetzugang hat; besteht das Problem weiter, den Support kontaktieren.',
};

const SICHERUNG = new Set(['sicherung_fehlgeschlagen', 'sicherungsschluessel_fehlt']);
const betreff = sonuc === 'ok'
  ? 'Praxura — Entwarnung: automatisches Update wieder ok'
  : SICHERUNG.has(sonuc)
    ? 'Praxura — nächtliche Sicherung braucht Aufmerksamkeit'
    : (sonuc === 'zertifikat_laeuft_ab' || sonuc === 'lokale_ca_laeuft_ab')
      ? 'Praxura — Zertifikat der Box läuft bald ab'
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
      <p style="color:#666;font-size:13px">Details: ${SICHERUNG.has(sonuc) ? 'backup.log' : 'update.log'} auf dem Server.</p>
    </div>`,
  });
} catch (err) {
  // Mail-Fehler dürfen den Exit-Code des Update-Laufs nie beeinflussen — das
  // ist bereits vor diesem Aufruf entschieden. update.sh liest nur diesen
  // Exit-Code (0/1), keine Ursache; die Diagnose steht in update.log.
  console.error('[update-alarm-mail]', err.message);
  process.exit(1);
}
