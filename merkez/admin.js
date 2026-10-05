#!/usr/bin/env node
// Merkez-Verwaltung — NUR per CLI auf dem Merkez-Server (kein HTTP-Admin-Endpunkt).
//
//   node admin.js kod-neu                  neuer Einrichtungscode (14 Tage, einmalig)
//   node admin.js kod-rebind <name>        Wiederverbindungs-Code für bestehende Box (72 h): Backup-Rückkehr / neue Hardware
//   node admin.js iptal <name>             Kimlik sperren (Ad/Y3/KI zugleich) + acme-dns-Zugang (CNAME) schließen; A-Eintrag BLEIBT
//   node admin.js adresse-loeschen <name>  A-/CAA-Eintrag entfernen (nur nach iptal); Name bleibt auf dem Grabstein
//   node admin.js liste                    alle Boxen
//
// Klartext-Codes erscheinen EINMAL auf der Konsole; gespeichert wird nur der SHA-256.
// Jede Aktion landet im nur anhängbaren adminlog (ohne Codes).
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { generateSetupCode, formatSetupCode, hashCode, FORMAT_KUTU } from '../api-backend/routes/mitarbeiter-zugang-code.js';
import { oeffneDb } from './db.js';
import { erstelleCloudflare } from './cloudflare.js';

const TAG = 86400;

export async function adminBefehl({ db, cloudflare, boxDomain, jetzt = Date.now, akteur = 'unbekannt' }, argv) {
  const [befehl, name] = argv;
  const t = Math.floor(jetzt() / 1000);
  const fqdn = (n) => `${n}.${boxDomain}`;

  switch (befehl) {
    case 'kod-neu': {
      const code = generateSetupCode(10, FORMAT_KUTU);
      db.codeAnlegen({ codeHash: hashCode(code, FORMAT_KUTU), art: 'kurulum', gueltigBis: t + 14 * TAG, jetzt: t });
      db.adminLog(akteur, 'kod-neu', null, { gueltig_tage: 14 }, t);
      return { code: formatSetupCode(code, FORMAT_KUTU), text: `Einrichtungscode (einmalig, 14 Tage): ${formatSetupCode(code, FORMAT_KUTU)}` };
    }
    case 'kod-rebind': {
      if (!name || !db.boxNachName(name)) throw new Error('Unbekannte Box: ' + name);
      const code = generateSetupCode(10, FORMAT_KUTU);
      db.codeAnlegen({ codeHash: hashCode(code, FORMAT_KUTU), art: 'rebind', boxName: name, gueltigBis: t + 3 * TAG, jetzt: t });
      db.adminLog(akteur, 'kod-rebind', name, { gueltig_stunden: 72 }, t);
      return { code: formatSetupCode(code, FORMAT_KUTU), text: `Wiederverbindungs-Code für ${name} (einmalig, 72 h): ${formatSetupCode(code, FORMAT_KUTU)}\nMit der Registrierung wird der alte Schlüssel ungültig.` };
    }
    case 'iptal': {
      if (!name) throw new Error('Name fehlt');
      const box = db.boxNachName(name);
      if (!box) throw new Error('Unbekannte Box: ' + name);
      // Idempotent: Wiederholung (z. B. nach Cloudflare-Ausfall) versucht nur das CNAME-Löschen erneut.
      // Protokoll VOR dem Aufruf, der scheitern kann — der Sperr-Beschluss steht dann immer im Log.
      const neu = db.boxIptal(name, t);
      db.adminLog(akteur, neu ? 'iptal' : 'iptal-wiederholt', name, { box_id: box.box_id }, t);
      // Zugang schließen: Challenge-CNAME weg → Zertifikatserneuerung scheitert, Zertifikat läuft ≤ 90 Tage aus.
      // Der A-Eintrag bleibt (K9: Adresse nicht als Druckmittel; Auflösung im LAN soll weiterlaufen).
      await cloudflare.loesche('CNAME', `_acme-challenge.${fqdn(name)}`);
      return { text: `Gesperrt: ${name}. Signierte Anfragen und acme-dns-Zugang sind geschlossen; der A-Eintrag bleibt.` };
    }
    case 'adresse-loeschen': {
      if (!name) throw new Error('Name fehlt');
      const box = db.boxNachName(name);
      if (!box) throw new Error('Unbekannte Box: ' + name);
      if (box.status !== 'iptal') throw new Error('Erst "iptal", dann "adresse-loeschen"');
      // Grabstein + Protokoll zuerst (idempotent), dann die Aufrufe, die scheitern können; Wiederholung ist erlaubt.
      db.grabstein(name, 'adresse_geloescht', t);
      db.adminLog(akteur, 'adresse-loeschen', name, null, t);
      await cloudflare.loesche('A', fqdn(name));
      await cloudflare.loesche('CAA', fqdn(name));
      return { text: `Adresse gelöscht: ${fqdn(name)} (Name bleibt gesperrt, wird nie neu vergeben).` };
    }
    case 'liste': {
      const zeilen = db.boxenListe().map((b) => `${b.name}\t${b.status}\t${b.lan_ip || '-'}\t${b.box_id}`);
      return { text: ['name\tstatus\tip\tbox_id', ...zeilen].join('\n') };
    }
    default:
      throw new Error('Befehl: kod-neu | kod-rebind <name> | iptal <name> | adresse-loeschen <name> | liste');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  try {
    const db = oeffneDb(env.MERKEZ_DB || './merkez.sqlite');
    const braucht = ['iptal', 'adresse-loeschen'].includes(process.argv[2]);
    if (braucht && !(env.BOX_DOMAIN && env.CF_ZONE_ID && env.CF_API_TOKEN)) throw new Error('BOX_DOMAIN, CF_ZONE_ID, CF_API_TOKEN nötig');
    const cloudflare = braucht ? erstelleCloudflare({ zoneId: env.CF_ZONE_ID, token: env.CF_API_TOKEN }) : null;
    const r = await adminBefehl({ db, cloudflare, boxDomain: env.BOX_DOMAIN, akteur: os.userInfo().username }, process.argv.slice(2));
    console.log(r.text);
  } catch (e) {
    console.error('Fehler: ' + e.message);
    process.exitCode = 1;
  }
}
