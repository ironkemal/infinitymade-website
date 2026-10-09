// Praxura Merkez — Namensdienst für Kunden-Boxen (K2b.2 / K2b.17). NICHT in der Box-Image.
//
// Ablauf:
//   Admin (CLI)  → Einrichtungscode (nur SHA-256 gespeichert, einmalig, 14 Tage)
//   Box          → POST /v1/vorschlag {code}               unsigniert, Name zufällig, 10 min reserviert
//   Box          → POST /v1/register {code,name,public_key} mit dem NEUEN Schlüssel signiert (Besitznachweis)
//   Box          → POST /v1/ip, /v1/caa                      signiert (Kimlik der Box)
//   Box          → POST /v1/ki/jeton                         signiert (Kimlik der Box, Token-Ausgabe)
// Es gibt KEINEN HTTP-Admin-Endpunkt — Verwaltung nur per CLI (admin.js).
import express from 'express';
import rateLimit from 'express-rate-limit';
import { pathToFileURL } from 'node:url';
import { hashCode, istKutuCodeGueltig, FORMAT_KUTU } from '../api-backend/routes/mitarbeiter-zugang-code.js';
import {
  leseSignaturKopf, pruefeSignatur, boxIdAusPublicKey, publicKeyLesen, publicKeyAlsBase64url,
  NONCE_GUELTIG_SEKUNDEN,
} from '../api-backend/merkez-istemci/signatur.js';
import { oeffneDb } from './db.js';
import { zufallsName, nameErlaubt, NAME_FORMAT } from './namen.js';
import { klassifiziereIpv4, entferneV4Praefix, ratenSchluessel } from './ip.js';
import { erstelleCloudflare } from './cloudflare.js';
import { erstelleAcmeDns } from './acmedns.js';
import {
  kiConfigAusEnv, erstelleKiEntra, monatsSchluessel, naechsterMonatsanfangBerlin, tokenFingerabdruck,
} from './ki-jeton.js';
import { pruefeKiBericht, kiBerichtHash, RE_REPORT_ID } from '../api-backend/merkez-istemci/ki-bericht-schema.js';

const RESERVIERUNG_SEK = 600;     // Namensvorschlag gilt 10 min
const MAX_VORSCHLAEGE = 20;       // pro Code
const GLOBAL_FEHLER_SPERRE = 20;  // Register-Fehlversuche/h insgesamt → Alarm + harte Sperre (503) bis Fensterende
// A: 3600 — LAN-Geräte überbrücken damit bis zu 1 h Internetausfall (K2b.9, O-162);
// Preis: IP-Wechsel wirkt bis ~1 h verzögert → DHCP-Reservierung. CNAME liest nur LE: 600.
const DNS_TTL_A = 3600;
const DNS_TTL_CNAME = 600;

export function erstelleApp({ db, cloudflare, acmedns, config, kiEntra = null, jetzt = Date.now, log = console }) {
  const { boxDomain, acmeDnsUrl, hostErwartet = null, trustProxy = false } = config;
  const accountPraefix = config.accountPraefix || 'https://acme-v02.api.letsencrypt.org/acme/acct/';
  if (!boxDomain) throw new Error('BOX_DOMAIN ist Pflicht');
  const sek = () => Math.floor(jetzt() / 1000);
  const fqdnVon = (name) => `${name}.${boxDomain}`;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  // IPv6-Clients erhalten ein /64 als gemeinsamen Schlüssel (sonst umgeht man das Limit mit jeder Adresse des Präfixes).
  const limitOpt = { standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: (req) => ratenSchluessel(req.ip) };
  const vorschlagLimit = rateLimit({ ...limitOpt, windowMs: 60_000, limit: config.limitVorschlag ?? 10, message: { fehler: 'zu_viele_anfragen' } });
  // Nur Fehlversuche zählen (Statuscode ≥ 400); Erfolg verbraucht das Kontingent nicht.
  const registerLimit = rateLimit({ ...limitOpt, windowMs: 3_600_000, limit: config.limitRegister ?? 5, skipSuccessfulRequests: true, message: { fehler: 'zu_viele_anfragen' } });
  const signiertLimit = rateLimit({ ...limitOpt, windowMs: 60_000, limit: config.limitSigniert ?? 60, message: { fehler: 'zu_viele_anfragen' } });
  const kiLimit = rateLimit({ ...limitOpt, windowMs: 60_000, limit: config.limitKi ?? 30, statusCode: 503, message: { fehler: 'zu_viele_anfragen' } });

  const kiLetztes = new Map(); // box_id -> { fp, exp }

  // Body roh lesen (Signatur braucht die exakten Bytes); Größenlimit greift VOR dem Hashen.
  const roh = express.raw({ type: () => true, limit: '8kb' });
  const jsonBody = (req) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return {};
    try {
      const o = JSON.parse(req.body.toString('utf8'));
      return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
    } catch { return null; }
  };
  const quelleIp = (req) => entferneV4Praefix(req.ip);

  // Globaler Fehlversuchszähler für /v1/register (Fenster 1 h). Zählt JEDE abgelehnte Antwort (4xx inkl. 413/429),
  // nicht unsere eigenen 5xx. Über der Schwelle: Alarm im Log und harte Sperre (503) bis das Fenster endet —
  // Registrierungen sind selten; der Preis (ein Angreifer kann Registrierungen für ≤1 h blockieren) ist bewusst gewählt,
  // weil der Code-Raum sonst von vielen IPs aus beratbar wäre. Neustart des Dienstes hebt die Sperre auf.
  let fehlerFenster = { start: 0, anzahl: 0, alarmiert: false };
  function registerWaechter(req, res, next) {
    const t = sek();
    if (t - fehlerFenster.start > 3600) fehlerFenster = { start: t, anzahl: 0, alarmiert: false };
    if (fehlerFenster.anzahl > GLOBAL_FEHLER_SPERRE) return res.status(503).json({ fehler: 'gesperrt' });
    res.on('finish', () => {
      if (res.statusCode < 400 || res.statusCode >= 500) return;
      fehlerFenster.anzahl++;
      if (fehlerFenster.anzahl > GLOBAL_FEHLER_SPERRE && !fehlerFenster.alarmiert) {
        fehlerFenster.alarmiert = true;
        log.error(`[ALARM] merkez: ${fehlerFenster.anzahl} fehlgeschlagene /v1/register in einer Stunde — möglicher Code-Ratevorgang, /v1/register gesperrt`);
      }
    });
    next();
  }
  // Roher Body als Buffer; ohne Body setzt express.raw {} — für den Hash muss es ein leerer Buffer sein.
  const rohBody = (req) => (Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));

  const antwort401 = (res) => res.status(401).json({ fehler: 'signatur', serverzeit: sek() }); // Serverzeit nur zur Diagnose; die Box übernimmt sie nicht

  function codePruefen(code, art) {
    if (!istKutuCodeGueltig(code)) return null;
    const hash = hashCode(code, FORMAT_KUTU);
    const zeile = db.codeHolen(hash);
    if (!zeile || zeile.benutzt_am || zeile.gueltig_bis <= sek()) return null;
    if (art && zeile.art !== art) return null;
    return { hash, zeile };
  }

  // ---------------------------------------------------------------- /v1/vorschlag
  app.post('/v1/vorschlag', vorschlagLimit, roh, (req, res) => {
    const body = jsonBody(req);
    if (!body) return res.status(400).json({ fehler: 'body' });
    const c = codePruefen(body.code);
    if (!c) return res.status(401).json({ fehler: 'code' });
    if (c.zeile.art === 'rebind') {
      // Neu-Bindung: der Name steht fest, es wird nichts vorgeschlagen.
      return res.json({ name: c.zeile.box_name, fqdn: fqdnVon(c.zeile.box_name), rebind: true });
    }
    if (c.zeile.vorschlag_anzahl >= MAX_VORSCHLAEGE) return res.status(429).json({ fehler: 'zu_viele_vorschlaege' });
    let name = null;
    for (let i = 0; i < 100 && !name; i++) {
      const kandidat = zufallsName();
      if (!nameErlaubt(kandidat)) continue;
      if (!db.nameBelegt(kandidat, sek())) name = kandidat;
    }
    if (!name) return res.status(503).json({ fehler: 'kein_name_frei' });
    const bis = sek() + RESERVIERUNG_SEK;
    db.vorschlagAnlegen(c.hash, name, bis);
    res.json({ name, fqdn: fqdnVon(name), reserviert_bis: bis });
  });

  // ---------------------------------------------------------------- /v1/register
  app.post('/v1/register', registerWaechter, registerLimit, roh, async (req, res) => {
    const body = jsonBody(req);
    const scheitern = (status, fehler) => res.status(status).json({ fehler });
    if (!body || typeof body.public_key !== 'string') return scheitern(400, 'body');

    // 1) Besitznachweis: mit dem neuen Schlüssel signiert, box_id aus diesem Schlüssel abgeleitet
    let neuerKey; let neueBoxId;
    try { neuerKey = publicKeyLesen(body.public_key); neueBoxId = boxIdAusPublicKey(neuerKey); } catch { return scheitern(400, 'schluessel'); }
    const sigErgebnis = pruefeSignatur({
      method: req.method, host: hostErwartet || req.headers.host, pfad: req.originalUrl, body: rohBody(req),
      kopf: leseSignaturKopf(req.headers), publicKey: neuerKey, jetzt: jetzt(),
      nonceNeu: (b, n) => db.nonceMerken(b, n, sek(), NONCE_GUELTIG_SEKUNDEN),
      erwarteterHost: hostErwartet || undefined,
    });
    if (!sigErgebnis.ok) return antwort401(res);

    // 2) Code + Name
    const c = codePruefen(body.code);
    if (!c) return scheitern(401, 'code');
    const rebind = c.zeile.art === 'rebind';
    const name = rebind ? c.zeile.box_name : body.name;
    if (typeof name !== 'string' || !NAME_FORMAT.test(name)) return scheitern(400, 'name');
    if (rebind) {
      if (body.name && body.name !== name) return scheitern(409, 'name');
      if (!db.boxNachName(name)) return scheitern(409, 'name');
    } else if (!db.vorschlagGueltig(c.hash, name, sek())) {
      return scheitern(409, 'name'); // nie vorgeschlagen, abgelaufen oder verworfen
    }
    if (db.boxNachId(neueBoxId) && !rebind) return scheitern(409, 'schluessel');

    // 3) Code atomar verbrauchen (zweiter paralleler Versuch scheitert hier)
    if (!db.codeVerbrauchen(c.hash, sek())) return scheitern(401, 'code');

    const fqdn = fqdnVon(name);
    try {
      // 4) acme-dns-Konto + DNS (Cloudflare). Wiederholbar: setze* ist idempotent.
      const konto = await acmedns.registrieren();
      await cloudflare.setzeCname(`_acme-challenge.${fqdn}`, konto.fulldomain, DNS_TTL_CNAME);
      await cloudflare.setzeCaa(fqdn, null);
      // 5) Box eintragen
      const box = {
        boxId: neueBoxId, publicKey: publicKeyAlsBase64url(neuerKey), name,
        acmeUser: konto.username, acmeSubdomain: konto.subdomain, acmeFulldomain: konto.fulldomain, jetzt: sek(),
      };
      const altBoxId = rebind ? db.boxNachName(name).box_id : null;
      db.tx(() => {
        if (rebind) db.boxRebind(name, box); else db.boxNeu(box);
        db.vorschlagVergeben(c.hash, name);
        db.adminLog('system', rebind ? 'rebind' : 'register', name, { box_id: neueBoxId, alt_box_id: altBoxId }, sek());
      });
      return res.json({
        box_id: neueBoxId, name, fqdn,
        acmedns: { username: konto.username, password: konto.password, subdomain: konto.subdomain, fulldomain: konto.fulldomain, server_url: acmeDnsUrl },
        zeit: sek(),
      });
    } catch (e) {
      db.codeFreigeben(c.hash); // Code nicht verbrennen, wenn WIR scheitern
      log.error('[merkez] register fehlgeschlagen:', e.message);
      return res.status(e.code === 'ERR_SQLITE_ERROR' ? 409 : 502).json({ fehler: e.code === 'ERR_SQLITE_ERROR' ? 'konflikt' : 'dienst' });
    }
  });

  // ---------------------------------------------------------------- Signatur-Prüfung für alle anderen Wege
  function signiert(req, res, next) {
    const kopf = leseSignaturKopf(req.headers);
    const box = kopf && db.boxNachId(kopf.boxId);
    // Gleiche Antwort bei unbekannt / iptal / ungültig → kein Orakel. Iptal wird bei JEDER Anfrage geprüft.
    if (!box || box.status !== 'aktiv') return antwort401(res);
    const ergebnis = pruefeSignatur({
      method: req.method, host: hostErwartet || req.headers.host, pfad: req.originalUrl, body: rohBody(req),
      kopf, publicKey: box.public_key, jetzt: jetzt(),
      nonceNeu: (b, n) => db.nonceMerken(b, n, sek(), NONCE_GUELTIG_SEKUNDEN),
      erwarteterHost: hostErwartet || undefined,
    });
    if (!ergebnis.ok) return antwort401(res);
    req.box = box;
    next();
  }

  // ---------------------------------------------------------------- /v1/ip
  app.post('/v1/ip', signiertLimit, roh, signiert, async (req, res) => {
    const body = jsonBody(req);
    if (!body) return res.status(400).json({ fehler: 'body' });
    let ip;
    if (body.modus === 'lan') {
      ip = body.ip;
      if (typeof ip !== 'string') return res.status(400).json({ fehler: 'ip_nicht_privat' });
      if (klassifiziereIpv4(ip) !== 'privat') return res.status(400).json({ fehler: 'ip_nicht_privat' });
    } else if (body.modus === 'internet') {
      ip = quelleIp(req);
      if (klassifiziereIpv4(ip) !== 'oeffentlich') return res.status(400).json({ fehler: 'ip_nicht_oeffentlich' });
    } else {
      return res.status(400).json({ fehler: 'modus' });
    }
    const unveraendert = req.box.lan_ip === ip && req.box.ip_am && sek() - req.box.ip_am < 6 * 3600;
    try {
      if (!unveraendert) await cloudflare.setzeA(fqdnVon(req.box.name), ip, DNS_TTL_A);
    } catch (e) {
      log.error('[merkez] ip fehlgeschlagen:', e.message);
      return res.status(502).json({ fehler: 'dienst' });
    }
    if (!unveraendert) db.boxIp(req.box.box_id, ip, sek());
    res.json({ ip, ttl: DNS_TTL_A });
  });

  // ---------------------------------------------------------------- /v1/caa
  app.post('/v1/caa', signiertLimit, roh, signiert, async (req, res) => {
    const body = jsonBody(req);
    const uri = body?.accountUri;
    if (typeof uri !== 'string' || !uri.startsWith(accountPraefix) || !/^[0-9]{1,20}$/.test(uri.slice(accountPraefix.length))) {
      return res.status(400).json({ fehler: 'account_uri' });
    }
    // K2b.4b (guvenlik S-47 Nachtrag 08.10.2026): gleicher Wert → nichts tun (die Box sendet beim
    // Start einmal). Erstbindung → adminlog 'caa-bindung'. JEDER spätere Kontowechsel →
    // adminlog 'caa-wechsel' (alt→neu, nur anhängbar) + [ALARM]. Höchstens 3 Wechsel je 24 h
    // je Box-Identität (nach Rebind zählt die alte nicht), sonst 429 — kein 24-h-Riegel, weil die
    // Box nach Verlust von caddy_data sofort ihr neues LE-Konto melden muss.
    const alt = req.box.caa_account || null;
    if (alt === uri) return res.json({ ok: true, unveraendert: true });
    if (caaInArbeit.has(req.box.box_id)) return res.status(429).json({ fehler: 'zu_viele_anfragen' });
    if (alt && db.caaWechselZaehlen(req.box.box_id, sek() - 86400) >= 3) {
      log.error(`[ALARM] caa: zu viele Kontowechsel für ${req.box.name} (24 h)`);
      return res.status(429).json({ fehler: 'zu_viele_anfragen' });
    }
    caaInArbeit.add(req.box.box_id);
    try {
      await cloudflare.setzeCaa(fqdnVon(req.box.name), uri);
    } catch (e) {
      log.error('[merkez] caa fehlgeschlagen:', e.message);
      return res.status(502).json({ fehler: 'dienst' });
    } finally {
      caaInArbeit.delete(req.box.box_id);
    }
    db.boxCaa(req.box.box_id, uri);
    db.adminLog(`box:${req.box.box_id}`, alt ? 'caa-wechsel' : 'caa-bindung', req.box.name, { alt, neu: uri }, sek());
    if (alt) log.error(`[ALARM] caa: LE-Konto von ${req.box.name} gewechselt (${alt} → ${uri})`);
    res.json({ ok: true });
  });
  const caaInArbeit = new Set(); // je Box höchstens eine /v1/caa gleichzeitig (Zählung vor await)

  // ---------------------------------------------------------------- /v1/ki/jeton
  // Async-Handler: eine Ausnahme (z. B. DB) darf nie als unbehandelte Ablehnung den Prozess treffen → 503 'dienst'.
  const kiJeton = async (req, res) => {
    // 0. Body prüfen
    const body = jsonBody(req);
    if (!body || body.antragsteller !== 'praxura-box') {
      return res.status(400).json({ fehler: 'body' });
    }

    // 1. KI-Konfiguration, Entra-Instanz und globaler Schalter
    if (!config.ki?.gueltig || !kiEntra || db.einstellungLesen('ki_global') !== 'an') {
      return res.status(503).json({ fehler: 'ki_aus' });
    }

    // 2. Box KI-Status (Freigabe)
    if (req.box.ki_status !== 'aktiv') {
      return res.status(503).json({ fehler: 'ki_nicht_freigeschaltet' });
    }

    // 3. Report verarbeiten (falls vorhanden)
    let ack = null;
    // Dauerhaft abgelehnter Bericht (abweichender Inhalt unter bekannter ID, oder ungültig mit lesbarer ID):
    // der Box sagen, dass sie ihn verwerfen soll — sonst blockiert ihr einziger ausstehender Bericht jede
    // weitere Meldung bis zum Neustart (onprem O-169, Befund γ 09.10.2026). Zusatzfeld, Client darf es ignorieren.
    let abgelehnt = null;
    if (body.report != null) {
      const g = pruefeKiBericht(body.report);
      // guvenlik S-55 (D): Tagesfenster muss nahe an der Serverzeit liegen (±2 Tage) — sonst könnte eine
      // signierte Box mit erfundenen IDs/Tagen beliebig viele Zeilen anlegen. Wie ungültig behandeln.
      if (g.ok && Math.abs(Date.parse(g.bericht.windowStart) - jetzt()) > 2 * 86_400_000) {
        g.ok = false; g.grund = 'fenster_zeit';
      }
      if (g.ok) {
        const hash = kiBerichtHash(g.bericht);
        const erg = db.kiBerichtSpeichern({
          boxId: req.box.box_id,
          reportId: g.bericht.reportId,
          payloadHash: hash,
          windowStart: g.bericht.windowStart,
          empfangen: sek(),
          daten: g.bericht,
        });
        if (erg === 'neu' || erg === 'gleich') {
          ack = g.bericht.reportId;
        } else if (erg === 'abweichend') {
          log.error(`[merkez] ki-bericht abweichend: ${req.box.name}`);
          abgelehnt = g.bericht.reportId;
        }
      } else {
        log.error(`[merkez] bericht_ungueltig: ${req.box.name} (${g.grund})`);
        const id = body.report?.reportId;
        if (typeof id === 'string' && RE_REPORT_ID.test(id)) abgelehnt = id;
      }
    }

    // 4. Entra-Token holen
    let token;
    let entraExp;
    try {
      const r = await kiEntra.holeToken();
      token = r.token;
      entraExp = r.entraExp;
    } catch (e) {
      log.error('[merkez] ki-entra fehlgeschlagen:', e.message);
      return res.status(503).json({ fehler: 'dienst' });
    }

    // 5. exp berechnen und prüfen
    const jetztSek = sek();
    const exp = Math.min(entraExp, jetztSek + 3600);
    if (exp <= jetztSek + 60) {
      return res.status(503).json({ fehler: 'dienst' });
    }

    // 6. Kein Doppelzählen: gleiches Token für dieselbe Box wiederverwenden
    const fp = tokenFingerabdruck(token);
    const letztes = kiLetztes.get(req.box.box_id);
    if (letztes && letztes.fp === fp && letztes.exp > jetztSek) {
      return res.json({
        token,
        exp,
        endpoint: config.ki.endpoint,
        deployment: config.ki.deployment,
        region: config.ki.region,
        apiVersion: config.ki.apiVersion,
        ...(ack ? { acknowledgedReportId: ack } : {}),
        ...(abgelehnt ? { rejectedReportId: abgelehnt } : {}),
      });
    }

    // 7. Monatskontingent prüfen
    const monat = monatsSchluessel(jetzt());
    const limit = req.box.ki_limit ?? config.ki.monatsLimit;
    if (db.kiZaehlen(req.box.box_id, monat) >= limit) {
      // Bericht-Ergebnis auch hier: sonst wartet ein abgelehnter Bericht bis Monatsende (M4.11 γ).
      return res.status(402).json({
        code: 'AI_QUOTA_EXCEEDED',
        resetAt: naechsterMonatsanfangBerlin(jetzt()),
        ...(ack ? { acknowledgedReportId: ack } : {}),
        ...(abgelehnt ? { rejectedReportId: abgelehnt } : {}),
      });
    }

    // 8. Erfolg: Zähler eintragen und RAM-Cache aktualisieren (ohne await dazwischen)
    db.kiAusgabeEintragen({
      boxId: req.box.box_id,
      zeit: jetztSek,
      monat,
      exp,
      entraExp,
    });
    kiLetztes.set(req.box.box_id, { fp, exp });

    // 9. Erfolgsantwort
    return res.json({
      token,
      exp,
      endpoint: config.ki.endpoint,
      deployment: config.ki.deployment,
      region: config.ki.region,
      apiVersion: config.ki.apiVersion,
      ...(ack ? { acknowledgedReportId: ack } : {}),
      ...(abgelehnt ? { rejectedReportId: abgelehnt } : {}),
    });
  };
  app.post('/v1/ki/jeton', kiLimit, roh, signiert, (req, res) => {
    kiJeton(req, res).catch((e) => {
      log.error('[merkez] ki-jeton intern:', e?.message);
      if (!res.headersSent) res.status(503).json({ fehler: 'dienst' });
    });
  });

  // Fehler: zu großer Body → 413, kaputtes Rohformat → 400. Keine Details nach außen.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ fehler: 'zu_gross' });
    log.error('[merkez] fehler:', err?.message);
    res.status(err?.status && err.status < 500 ? err.status : 500).json({ fehler: 'intern' });
  });

  return app;
}

// -------------------------------------------------------------------- Start (nur bei direktem Aufruf)
// MERKEZ_DEV=1: lokale Entwicklung ohne Host-Pflicht und ohne Proxy-Angabe.
export function configAusEnv(env = process.env) {
  const noetig = ['BOX_DOMAIN', 'CF_ZONE_ID', 'CF_API_TOKEN', 'ACME_DNS_INTERN_URL', 'ACME_DNS_URL'];
  const fehlt = noetig.filter((k) => !env[k]);
  if (fehlt.length) throw new Error('Fehlende Umgebungsvariablen: ' + fehlt.join(', '));
  const dev = env.MERKEZ_DEV === '1';
  if (!env.MERKEZ_HOST && !dev) throw new Error('MERKEZ_HOST ist Pflicht (erwarteter Host-Header; nur zum lokalen Entwickeln MERKEZ_DEV=1)');
  let trustProxy = false;
  if (env.MERKEZ_TRUST_PROXY !== undefined && env.MERKEZ_TRUST_PROXY !== '') {
    if (!/^[0-9]+$/.test(env.MERKEZ_TRUST_PROXY)) throw new Error('MERKEZ_TRUST_PROXY muss eine ganze Zahl sein (Anzahl Proxy-Stufen), nicht: ' + env.MERKEZ_TRUST_PROXY);
    trustProxy = Number(env.MERKEZ_TRUST_PROXY);
  } else if (!dev && /^(127[.]|::1$|localhost$)/.test(env.HOST || '127.0.0.1')) {
    // Loopback-Bindung = Reverse-Proxy davor; ohne trust proxy teilen sich alle Clients EINEN Rate-Limit-Eimer.
    throw new Error('MERKEZ_TRUST_PROXY fehlt: Bindung an Loopback bedeutet Reverse-Proxy davor (z. B. 1)');
  }
  return {
    boxDomain: env.BOX_DOMAIN,
    acmeDnsUrl: env.ACME_DNS_URL,
    hostErwartet: env.MERKEZ_HOST || null,
    trustProxy,
  };
}

export function baueAusEnv(env = process.env) {
  const config = configAusEnv(env);
  const db = oeffneDb(env.MERKEZ_DB || './merkez.sqlite');
  const cloudflare = erstelleCloudflare({ zoneId: env.CF_ZONE_ID, token: env.CF_API_TOKEN });
  const acmedns = erstelleAcmeDns({ internUrl: env.ACME_DNS_INTERN_URL });
  const ki = kiConfigAusEnv(env);
  if (!ki.gueltig) {
    console.warn('[merkez] KI-Jeton-Ausgabe aus (' + ki.grund + ')');
  }
  const kiEntra = ki.gueltig ? erstelleKiEntra({ config: ki }) : null;
  return { db, cloudflare, acmedns, config: { ...config, ki }, kiEntra };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const teile = baueAusEnv();
  const port = Number(process.env.PORT || 8788);
  erstelleApp(teile).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`[merkez] lauscht auf ${port}`));
}
