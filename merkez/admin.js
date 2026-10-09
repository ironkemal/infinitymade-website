#!/usr/bin/env node
// Merkez-Verwaltung — NUR per CLI auf dem Merkez-Server (kein HTTP-Admin-Endpunkt).
//
//   node admin.js kod-neu                  neuer Einrichtungscode (14 Tage, einmalig)
//   node admin.js kod-rebind <name>        Wiederverbindungs-Code für bestehende Box (72 h): Backup-Rückkehr / neue Hardware
//   node admin.js iptal <name>             Kimlik sperren (Ad/Y3/KI zugleich) + acme-dns-Zugang (CNAME) schließen; A-Eintrag BLEIBT
//   node admin.js adresse-loeschen <name>  A-/CAA-Eintrag entfernen (nur nach iptal); Name bleibt auf dem Grabstein
//   node admin.js liste                    alle Boxen
//   node admin.js ki-an <name>             KI für Box freischalten (Status: aktiv)
//   node admin.js ki-aus <name>            KI für Box sperren (Status: aus)
//   node admin.js ki-limit <name> <n|std>  Monatslimit für Box setzen (1..1000000 oder 'standard')
//   node admin.js ki-global <an|aus>       Globalen KI-Schalter ein-/ausschalten
//   node admin.js ki-stand [name]          KI-Status, Monatszähler und Berichte anzeigen
//   node admin.js ki-abgleich <JJJJ-MM-TT> <azure_tokens> [--abschalten] [--toleranz-prozent=N] [--toleranz-tokens=N]
//                                          Azure-Tagessumme (UTC-Tag) ↔ Box-Berichte (O-169 Bed. 7). Exit 0 = im Rahmen,
//                                          2 = über der Toleranz; mit --abschalten dann ki-global aus (erst nach O-186)
//
// Klartext-Codes erscheinen EINMAL auf der Konsole; gespeichert wird nur der SHA-256.
// Jede Aktion landet im nur anhängbaren adminlog (ohne Codes).
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { generateSetupCode, formatSetupCode, hashCode, FORMAT_KUTU } from '../api-backend/routes/mitarbeiter-zugang-code.js';
import { oeffneDb } from './db.js';
import { erstelleCloudflare } from './cloudflare.js';
import { monatsSchluessel } from './ki-jeton.js';
import { abgleichen, berichtTokens, utcTag, STANDARD_TOLERANZ } from './ki-abgleich.js';

const TAG = 86400;

export async function adminBefehl({ db, cloudflare, boxDomain, jetzt = Date.now, akteur = 'unbekannt', kiStandardLimit = 600 }, argv) {
  const [befehl, name, arg3, ...optionen] = argv;
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
    case 'ki-an': {
      if (!name || !db.boxNachName(name)) throw new Error('Unbekannte Box: ' + (name || ''));
      db.boxKiSetzen(name, 'aktiv');
      db.adminLog(akteur, 'ki-an', name, null, t);
      return { text: `KI aktiviert für ${name}.` };
    }
    case 'ki-aus': {
      if (!name || !db.boxNachName(name)) throw new Error('Unbekannte Box: ' + (name || ''));
      db.boxKiSetzen(name, 'aus');
      db.adminLog(akteur, 'ki-aus', name, null, t);
      return { text: `KI deaktiviert für ${name}.` };
    }
    case 'ki-limit': {
      if (!name || !db.boxNachName(name)) throw new Error('Unbekannte Box: ' + (name || ''));
      const limitArg = arg3 ?? argv[2];
      let limit = null;
      if (limitArg === 'standard') {
        limit = null;
      } else if (limitArg && /^\d+$/.test(limitArg)) {
        const n = parseInt(limitArg, 10);
        if (n >= 1 && n <= 1000000) {
          limit = n;
        } else {
          throw new Error('Limit muss zwischen 1 und 1000000 liegen oder "standard" sein');
        }
      } else {
        throw new Error('Limit muss zwischen 1 und 1000000 liegen oder "standard" sein');
      }
      db.boxKiLimitSetzen(name, limit);
      db.adminLog(akteur, 'ki-limit', name, { limit }, t);
      return { text: `KI-Limit für ${name} gesetzt auf: ${limit === null ? 'standard' : limit}.` };
    }
    case 'ki-global': {
      if (name !== 'an' && name !== 'aus') {
        throw new Error('Wert muss "an" oder "aus" sein');
      }
      db.einstellungSetzen('ki_global', name);
      db.adminLog(akteur, 'ki-global', null, { wert: name }, t);
      const hinweis = name === 'an' ? ' Nur öffnen nach O-169 Bedingung 7 + ORG-Freigabe.' : '';
      return { text: `Globaler KI-Schalter: ${name}.${hinweis}` };
    }
    case 'ki-stand': {
      const globalKi = db.einstellungLesen('ki_global') ?? 'aus';
      const monat = monatsSchluessel(jetzt());
      let boxen;
      if (name) {
        const b = db.boxNachName(name);
        if (!b) throw new Error('Unbekannte Box: ' + name);
        boxen = [b];
      } else {
        boxen = db.boxenListe();
      }

      const abschnitte = [`Globaler KI-Schalter: ${globalKi}`];
      for (const b of boxen) {
        const status = b.ki_status ?? 'aus';
        const limit = b.ki_limit ?? kiStandardLimit;
        const zaehler = db.kiZaehlen(b.box_id, monat);
        const zeilen = [
          `Box: ${b.name}`,
          `  KI-Status: ${status}`,
          `  Zähler (${monat}): ${zaehler} / ${limit}`,
        ];
        const berichte = db.kiBerichteLesen(b.box_id, 5);
        if (berichte.length === 0) {
          zeilen.push('  Letzte Berichte: keine');
        } else {
          zeilen.push('  Letzte Berichte:');
          for (const ber of berichte) {
            const tokens = berichtTokens(ber.daten);
            zeilen.push(`    - ${ber.report_id} (${ber.window_start}): ${tokens} Tokens`);
          }
        }
        abschnitte.push(zeilen.join('\n'));
      }
      return { text: abschnitte.join('\n\n') };
    }
    case 'ki-abgleich': {
      // O-169 Bed. 7 (onprem O-186, guvenlik S-55): nur abgeschlossene UTC-Tage; ohne --abschalten nur Bericht + Exit 2,
      // weil die Box den letzten Tagesstand heute nicht nachmeldet (O-186) — sonst Fehlalarm-Abschaltung jede Nacht.
      const { windowStart, von, bis } = utcTag(name);
      if (bis > t) throw new Error(`UTC-Tag ${name} ist noch nicht abgeschlossen`);
      const opt = { abschalten: false, toleranz: { ...STANDARD_TOLERANZ } };
      for (const o of optionen) {
        const m = /^--toleranz-(prozent|tokens)=(\d{1,15})$/.exec(o);
        if (o === '--abschalten') opt.abschalten = true;
        else if (m) opt.toleranz[m[1]] = m[2];
        else throw new Error('Unbekannte Option: ' + o);
      }
      const erg = abgleichen({ berichte: db.kiBerichteTag(windowStart), azureTokens: arg3, toleranz: opt.toleranz });
      const namen = new Map(db.boxenListe().map((b) => [b.box_id, b.name]));
      const nameVon = (id) => namen.get(id) ?? id;
      const gemeldetJe = new Map(erg.kutular.map((k) => [k.box_id, k.tokens]));
      // Zuordnung (guvenlik a): Boxen mit Jeton-Ausgabe an dem Tag, aber ohne/leeren Bericht.
      const ohneBericht = db.kiAusgabenZwischen(von, bis)
        .filter((a) => !(gemeldetJe.get(a.box_id) > 0)).map((a) => nameVon(a.box_id));
      const globalVorher = db.einstellungLesen('ki_global') ?? 'aus';
      let abgeschaltet = false;
      if (erg.ueberschritten && opt.abschalten && globalVorher !== 'aus') {
        db.einstellungSetzen('ki_global', 'aus');
        db.adminLog('ki-abgleich-auto', 'ki-global', null, { wert: 'aus', grund: 'ki-abgleich', tag: name }, t);
        abgeschaltet = true;
      }
      db.adminLog(akteur, 'ki-abgleich', name, {
        azure: erg.azure, gemeldet: erg.gemeldet, grenze: erg.grenze, ueberschritten: erg.ueberschritten,
        mehr_gemeldet: erg.mehrGemeldet, abschalten: opt.abschalten, abgeschaltet, ohne_bericht: ohneBericht,
        boxen: erg.kutular.map((k) => ({ name: nameVon(k.box_id), tokens: k.tokens })),
      }, t);
      const zeilen = [
        `KI-Abgleich ${name} (UTC): Azure ${erg.azure} · gemeldet ${erg.gemeldet} · Grenze ${erg.grenze} (+${opt.toleranz.prozent} % +${opt.toleranz.tokens})`,
        ...erg.kutular.map((k) => `  ${nameVon(k.box_id)}: ${k.tokens}`),
      ];
      if (ohneBericht.length) zeilen.push(`  Jetons bezogen, kein Bericht: ${ohneBericht.join(', ')}`);
      if (erg.mehrGemeldet) zeilen.push('  Warnung: Boxen melden mehr als Azure zählt (keine Abschaltung).');
      if (erg.ueberschritten) {
        zeilen.push(abgeschaltet ? 'ÜBERSCHRITTEN — globaler KI-Schalter jetzt AUS.'
          : opt.abschalten ? 'ÜBERSCHRITTEN — globaler KI-Schalter war bereits aus.'
            : 'ÜBERSCHRITTEN — nur Bericht (ohne --abschalten, O-186 offen).');
      } else zeilen.push('Im Rahmen.');
      return { text: zeilen.join('\n'), exitCode: erg.ueberschritten ? 2 : 0 };
    }
    default:
      throw new Error('Befehl: kod-neu | kod-rebind <name> | iptal <name> | adresse-loeschen <name> | liste | ki-an <name> | ki-aus <name> | ki-limit <name> <n|standard> | ki-global an|aus | ki-stand [name] | ki-abgleich <JJJJ-MM-TT> <azure_tokens> [--abschalten]');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  try {
    const db = oeffneDb(env.MERKEZ_DB || './merkez.sqlite');
    const befehl = process.argv[2];
    const braucht = ['iptal', 'adresse-loeschen'].includes(befehl);
    if (braucht && !(env.BOX_DOMAIN && env.CF_ZONE_ID && env.CF_API_TOKEN)) throw new Error('BOX_DOMAIN, CF_ZONE_ID, CF_API_TOKEN nötig');
    const cloudflare = braucht ? erstelleCloudflare({ zoneId: env.CF_ZONE_ID, token: env.CF_API_TOKEN }) : null;
    const rawLimit = env.KI_MONATS_LIMIT;
    const kiStandardLimit = /^\d+$/.test(rawLimit || '') ? parseInt(rawLimit, 10) : 600;
    const r = await adminBefehl({ db, cloudflare, boxDomain: env.BOX_DOMAIN, akteur: os.userInfo().username, kiStandardLimit }, process.argv.slice(2));
    console.log(r.text);
    if (r.exitCode) process.exitCode = r.exitCode;
  } catch (e) {
    console.error('Fehler: ' + e.message);
    process.exitCode = 1;
  }
}
