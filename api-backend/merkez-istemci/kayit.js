#!/usr/bin/env node
// Kutu-Registrierung (K2b.17 / K2b.2): Einrichtungscode → zufälliger Name → Schlüssel → /v1/register.
//
//   node merkez-istemci/kayit.js                       interaktiv (fragt Code, zeigt Vorschlag)
//   node merkez-istemci/kayit.js --code XXXX-XXXX-XXXX-XXXX --auto          nicht interaktiv, erster Vorschlag
//   node merkez-istemci/kayit.js --code … --nur-vorschlag --json            nur Name vorschlagen (für den Assistenten)
//   node merkez-istemci/kayit.js --code … --name sonne-tal-42               zuvor vorgeschlagenen Namen übernehmen
//   --neuer-schluessel  vorhandene (bereits registrierte) Identität ersetzen (Neu-Bindung mit Wiederverbindungs-Code)
//
// Env: MERKEZ_URL (Pflicht), KIMLIK_DIR, ACMEDNS_DIR. Der Code wird nie geloggt.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { erzeugeKimlik, ladeKimlik, speichereAd, uebernehmeNeueKimlik, kimlikVerzeichnis } from './kimlik.js';
import { merkezFetch } from './merkez-fetch.js';

export function acmednsVerzeichnis() {
  return process.env.ACMEDNS_DIR || '/var/lib/praxura/acmedns';
}

// Format der caddy-dns/acmedns-Speicherdatei: { "<domain>": { username, password, fulldomain, subdomain, server_url } }
// (in K2b.4 gegen das Caddy-Modul verifizieren)
function schreibeAcmedns(dir, fqdn, acmedns) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const pfad = path.join(dir, 'acmedns.json');
  fs.writeFileSync(pfad, JSON.stringify({ [fqdn]: acmedns }, null, 2), { mode: 0o600 });
  fs.chmodSync(pfad, 0o600);
  return pfad;
}

/**
 * @returns {Promise<{name:string, fqdn:string, boxId:string, acmednsDatei:string}|{vorschlag:object}>}
 */
export async function kayitAusfuehren({
  code, name, auto = false, nurVorschlag = false, neuerSchluessel = false,
  kimlikDir = kimlikVerzeichnis(), acmednsDir = acmednsVerzeichnis(),
  fetchImpl, baseUrl, frage, ausgabe = () => {},
}) {
  if (!code) throw new Error('Einrichtungscode fehlt');
  const vorhanden = ladeKimlik({ dir: kimlikDir });
  if (vorhanden?.ad && !neuerSchluessel) {
    throw new Error(`Diese Box ist bereits registriert (${vorhanden.ad}). Für eine Neu-Bindung: --neuer-schluessel mit Wiederverbindungs-Code.`);
  }
  const opt = { baseUrl, fetchImpl };

  // 1) Namensvorschlag (ohne Signatur — die Box hat noch keine registrierte Identität)
  let gewaehlt = name || null;
  let vorschlag = null;
  if (!gewaehlt || nurVorschlag) {
    for (;;) {
      const r = await merkezFetch('/v1/vorschlag', { body: { code }, ohneSignatur: true, ...opt });
      if (!r.ok) throw new Error(fehlerText(r));
      vorschlag = r.json;
      if (nurVorschlag) return { vorschlag };
      ausgabe(`Vorgeschlagene Adresse: ${vorschlag.fqdn}`);
      if (vorschlag.rebind || auto) break;
      const antwort = ((await frage?.('Übernehmen? [J]a / [N]euen Namen vorschlagen: ')) || '').trim().toLowerCase();
      if (antwort === 'j' || antwort === 'ja') break;
    }
    gewaehlt = vorschlag.name;
  }

  // 2) Schlüssel erzeugen (falls nötig) und mit dem NEUEN Schlüssel signiert registrieren
  const kimlik = (vorhanden && !neuerSchluessel && !vorhanden.ad) ? vorhanden : erzeugeKimlik({ dir: kimlikDir, ersetzen: neuerSchluessel });
  const r = await merkezFetch('/v1/register', {
    body: { code, name: gewaehlt, public_key: kimlik.publicKeyBase64url },
    kimlik, ...opt,
  });
  if (!r.ok) throw new Error(fehlerText(r));

  // 3) Ergebnis festhalten. Reihenfolge ist Absturzschutz: erst die einmalig gelieferten acme-dns-Zugangsdaten sichern,
  //    dann den neuen Schlüssel aktivieren (bis dahin gilt die alte Identität unverändert), zuletzt den Namen eintragen.
  //    Absturz nach der Registrierung, vor Abschluss: Merkez kennt den neuen Schlüssel, die Box hat ihn noch als *.neu →
  //    Admin gibt per kod-rebind einen neuen Code, kayit.js --neuer-schluessel nimmt das vorhandene *.neu wieder auf.
  const acmednsDatei = schreibeAcmedns(acmednsDir, r.json.fqdn, r.json.acmedns);
  if (kimlik.neu) uebernehmeNeueKimlik({ dir: kimlikDir });
  speichereAd({ dir: kimlikDir, ad: r.json.name });
  return { name: r.json.name, fqdn: r.json.fqdn, boxId: kimlik.boxId, acmednsDatei };
}

function fehlerText(r) {
  const f = r.json?.fehler || `HTTP ${r.status}`;
  const hilfe = {
    code: 'Der Einrichtungscode ist ungültig, abgelaufen oder bereits benutzt.',
    name: 'Der Name ist nicht (mehr) reserviert — bitte einen neuen Namen vorschlagen lassen.',
    zu_viele_vorschlaege: 'Zu viele Namensvorschläge für diesen Code.',
    zu_viele_anfragen: 'Zu viele Versuche — bitte später erneut.',
  }[f];
  return hilfe ? `${hilfe} (${f})` : `Merkez-Fehler: ${f}`;
}

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--code') o.code = argv[++i];
    else if (a === '--name') o.name = argv[++i];
    else if (a === '--auto') o.auto = true;
    else if (a === '--nur-vorschlag') o.nurVorschlag = true;
    else if (a === '--neuer-schluessel') o.neuerSchluessel = true;
    else if (a === '--json') o.json = true;
    else throw new Error('Unbekannte Option: ' + a);
  }
  return o;
}

async function main() {
  const o = args(process.argv.slice(2));
  let rl;
  const frage = async (q) => { rl ??= readline.createInterface({ input: process.stdin, output: process.stderr }); return rl.question(q); };
  try {
    if (!o.code) {
      if (!process.stdin.isTTY) throw new Error('--code fehlt (nicht interaktiv)');
      o.code = await frage('Einrichtungscode (XXXX-XXXX-XXXX-XXXX): ');
    }
    const ergebnis = await kayitAusfuehren({ ...o, frage, ausgabe: o.json ? () => {} : (t) => console.error(t) });
    if (o.json) console.log(JSON.stringify(ergebnis));
    else if (ergebnis.vorschlag) console.log(`Vorschlag: ${ergebnis.vorschlag.fqdn}`);
    else console.log(`Registriert: ${ergebnis.fqdn}`);
  } catch (e) {
    console.error(o.json ? JSON.stringify({ fehler: e.message }) : `Fehler: ${e.message}`);
    process.exitCode = 1;
  } finally {
    rl?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
