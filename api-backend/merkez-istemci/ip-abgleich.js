// IP-Abgleich der Box mit Merkez (K2b.6, O-161 / L7-L9, L12).
// Regelmäßiger Hintergrund-Job im api-Container: liest die vom Host-Timer
// bereitgestellte LAN-IP und gleicht sie bei Änderung signiert über /v1/ip ab.
//
// Im SaaS (MERKEZ_URL leer) oder auf Worker-Instanzen (NODE_APP_INSTANCE != '0')
// wird kein Timer registriert (G7).
import fs from 'node:fs';
import path from 'node:path';
import { ladeKimlik, kimlikVerzeichnis } from './kimlik.js';
import { merkezFetch } from './merkez-fetch.js';

const SECHS_STUNDEN_MS = 6 * 60 * 60 * 1000;
const FUENF_MINUTEN_MS = 5 * 60 * 1000;

export function istGueltigesIpv4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s ?? ''));
  if (!m) return false;
  return m.slice(1).every((t) => {
    if (t.length > 1 && t.startsWith('0')) return false;
    const n = Number(t);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

/** RFC1918 (10/8, 172.16/12, 192.168/16) — merkez nimmt im lan-Modus nur diese an (L1). */
export function istRfc1918(ip) {
  const [a, b] = String(ip).split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function erzeugeZustand() {
  return {
    letzterWert: null,           // z. B. '192.168.1.10' oder 'internet'
    letzterErfolgZeit: null,      // Timestamp (ms)
    naechsterVersuchErlaubt: 0,  // Timestamp (ms)
    warnung401Geloggt: false,    // boolean
  };
}

/**
 * Einzelschritt des IP-Abgleichs — testbare Kernfunktion ohne globale Timer.
 *
 * @param {object} zustand
 * @param {object} [optionen]
 * @returns {Promise<object|undefined>}
 */
export async function ipAbgleichSchritt(zustand, {
  env = process.env,
  fetchImpl,
  jetzt = Date.now,
  log = console,
  ipDir,
  kimlikDir,
} = {}) {
  if (!zustand) return;
  const jetztMs = typeof jetzt === 'function' ? jetzt() : jetzt;

  // Nach Fehlschlag: Karenzzeit abwarten (5 min bei 5xx/429/Netz, 6 h bei 401/403)
  if (zustand.naechsterVersuchErlaubt && jetztMs < zustand.naechsterVersuchErlaubt) {
    return;
  }

  // 1) Kimlik laden — keine oder unregistriert -> nichts tun
  const kDir = kimlikDir || env.KIMLIK_DIR || kimlikVerzeichnis();
  let kimlik;
  try {
    kimlik = ladeKimlik({ dir: kDir });
  } catch {
    return;
  }
  if (!kimlik || !kimlik.ad) {
    return;
  }

  // 2) Modus aus <ipDir>/modus lesen
  const dir = ipDir || env.IP_DIR || '/var/lib/praxura/ip';
  const modusPfad = path.join(dir, 'modus');
  if (!fs.existsSync(modusPfad)) {
    return;
  }
  let modus;
  try {
    modus = fs.readFileSync(modusPfad, 'utf8').trim();
  } catch {
    return;
  }

  let body;
  let aktuellerWert;

  if (modus === 'lan') {
    const lanIpPfad = path.join(dir, 'lan-ip');
    if (!fs.existsSync(lanIpPfad)) {
      return;
    }
    let ip;
    try {
      ip = fs.readFileSync(lanIpPfad, 'utf8').trim();
    } catch {
      return;
    }
    if (!istGueltigesIpv4(ip) || !istRfc1918(ip)) {
      return;
    }
    body = { modus: 'lan', ip };
    aktuellerWert = ip;
  } else if (modus === 'internet') {
    body = { modus: 'internet' };
    aktuellerWert = 'internet';
  } else {
    return;
  }

  // 3) Senden nur wenn: Wert != zuletzt erfolgreich gesendet ODER letzter Erfolg > 6 h her
  const wertGeaendert = zustand.letzterWert !== aktuellerWert;
  const sechsStundenVorbei = zustand.letzterErfolgZeit === null || (jetztMs - zustand.letzterErfolgZeit) >= SECHS_STUNDEN_MS;

  if (!wertGeaendert && !sechsStundenVorbei) {
    return;
  }

  // 4) Anfrage signiert über /v1/ip an Merkez senden
  let antwort;
  try {
    antwort = await merkezFetch('/v1/ip', {
      body,
      kimlik,
      fetchImpl,
      baseUrl: env.MERKEZ_URL,
      jetzt: jetztMs,
    });
  } catch (netErr) {
    zustand.naechsterVersuchErlaubt = jetztMs + FUENF_MINUTEN_MS;
    try {
      const msg = netErr?.message || String(netErr);
      (log.warn || log.log)(`[ip-abgleich] Netzwerkfehler: ${msg}`);
    } catch {}
    return;
  }

  if (antwort.ok) {
    const vorher = zustand.letzterWert;
    const warAenderung = vorher !== null && vorher !== aktuellerWert;
    zustand.letzterWert = aktuellerWert;
    zustand.letzterErfolgZeit = jetztMs;
    zustand.naechsterVersuchErlaubt = 0;
    zustand.warnung401Geloggt = false;

    if (warAenderung) {
      try {
        log.log(`[ip-abgleich] IP ${vorher} → ${aktuellerWert} gemeldet`);
      } catch {}
    }
    return antwort;
  }

  if (antwort.status === 401 || antwort.status === 403) {
    zustand.naechsterVersuchErlaubt = jetztMs + SECHS_STUNDEN_MS;
    if (!zustand.warnung401Geloggt) {
      zustand.warnung401Geloggt = true;
      try {
        (log.warn || log.log)(`[ip-abgleich] Nicht autorisiert (${antwort.status}) — Box-Registrierung prüfen`);
      } catch {}
    }
    return antwort;
  }

  // 5xx, 429 oder sonstige Fehler -> frühestens 5 min später erneut
  zustand.naechsterVersuchErlaubt = jetztMs + FUENF_MINUTEN_MS;
  try {
    const fehler = antwort.json?.fehler || `HTTP ${antwort.status}`;
    (log.warn || log.log)(`[ip-abgleich] Abgleich fehlgeschlagen: ${fehler}`);
  } catch {}
  return antwort;
}

/**
 * Startet den periodischen IP-Abgleich im Hintergrund.
 *
 * @param {object} [config]
 * @returns {object|null}
 */
export function starteIpAbgleich({
  env = process.env,
  fetchImpl,
  jetzt = Date.now,
  timer = { setTimeout, setInterval },
  log = console,
  ipDir,
} = {}) {
  // Sofort return (kein Timer!), wenn MERKEZ_URL leer ist (SaaS — G7)
  const merkezUrl = env.MERKEZ_URL ? String(env.MERKEZ_URL).trim() : '';
  if (!merkezUrl) return null;

  // Nur Primär-Instanz auf Multiprocess-Setups
  if (env.NODE_APP_INSTANCE !== undefined && env.NODE_APP_INSTANCE !== null && String(env.NODE_APP_INSTANCE) !== '0') {
    return null;
  }

  const zustand = erzeugeZustand();
  const dir = ipDir || env.IP_DIR || '/var/lib/praxura/ip';

  const tick = async () => {
    try {
      await ipAbgleichSchritt(zustand, { env, fetchImpl, jetzt, log, ipDir: dir });
    } catch (err) {
      try {
        const msg = err?.message || String(err);
        (log.warn || log.log)(`[ip-abgleich] Unerwarteter Fehler: ${msg}`);
      } catch {}
    }
  };

  // Erster Tick nach 30 s, dann alle 60 s
  const t1 = timer.setTimeout(tick, 30_000);
  if (t1 && typeof t1.unref === 'function') {
    try { t1.unref(); } catch {}
  }

  const t2 = timer.setInterval(tick, 60_000);
  if (t2 && typeof t2.unref === 'function') {
    try { t2.unref(); } catch {}
  }

  return {
    zustand,
    timer: { t1, t2 },
    stop() {
      const ct = timer.clearTimeout || globalThis.clearTimeout;
      const ci = timer.clearInterval || globalThis.clearInterval;
      if (t1) ct(t1);
      if (t2) ci(t2);
    },
  };
}
