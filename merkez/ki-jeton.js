// KI-Jeton-Verwaltung für Merkez (M4.1 / 3b.4).
// Verwaltet Konfiguration, Entra-Token-Beschaffung mit RAM-Cache und Berliner Zeitfenster.
import { createHash } from 'node:crypto';
import { berlinHeute } from '../api-backend/lib/berlin-tag.js';
import { EU_DATA_BOUNDARY_REGIONS } from '../api-backend/ai/ki-config.js';

export const ENTRA_MIN_RESTLAUF_SEK = 2700; // 45 Minuten Mindestrestlaufzeit
export const MAX_TTL_SEK = 3600;

const RE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const RE_DEPLOYMENT = /^[a-zA-Z0-9_-]{1,64}$/;
const RE_API_VERSION = /^\d{4}-\d{2}-\d{2}(-preview)?$/;
const RE_CONTROL_CHARS = /[\r\n\x00-\x1f\x7f]/;

function baueConfig({
  gueltig = false,
  grund = null,
  tenantId = null,
  clientId = null,
  clientSecret = null,
  endpoint = null,
  deployment = null,
  region = null,
  apiVersion = null,
  monatsLimit = null,
} = {}) {
  const cfg = {
    gueltig,
    grund,
    tenantId,
    clientId,
    endpoint,
    deployment,
    region,
    apiVersion,
    monatsLimit,
  };
  // clientSecret niemals in JSON.stringify oder Log-Ausgaben leaken
  Object.defineProperty(cfg, 'clientSecret', {
    value: clientSecret,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return cfg;
}

/**
 * Liest und validiert KI-Umgebungsvariablen. Wirft NIE eine Ausnahme.
 * @param {Record<string, string|undefined>} [env=process.env]
 */
export function kiConfigAusEnv(env = process.env) {
  try {
    const e = env || {};

    const tenantId = e.KI_ENTRA_TENANT_ID;
    if (!tenantId) return baueConfig({ grund: 'fehlt:KI_ENTRA_TENANT_ID' });
    if (!RE_UUID.test(tenantId)) return baueConfig({ grund: 'ungueltig:KI_ENTRA_TENANT_ID' });

    const clientId = e.KI_ENTRA_CLIENT_ID;
    if (!clientId) return baueConfig({ grund: 'fehlt:KI_ENTRA_CLIENT_ID' });
    if (!RE_UUID.test(clientId)) return baueConfig({ grund: 'ungueltig:KI_ENTRA_CLIENT_ID' });

    const clientSecret = e.KI_ENTRA_CLIENT_SECRET;
    if (!clientSecret || typeof clientSecret !== 'string' || clientSecret.trim() === '') {
      return baueConfig({ grund: 'fehlt:KI_ENTRA_CLIENT_SECRET' });
    }

    const rawEndpoint = e.KI_ENDPOINT;
    if (!rawEndpoint) return baueConfig({ grund: 'fehlt:KI_ENDPOINT' });
    if (RE_CONTROL_CHARS.test(rawEndpoint)) return baueConfig({ grund: 'ungueltig:KI_ENDPOINT' });

    let parsedEndpoint;
    try {
      parsedEndpoint = new URL(rawEndpoint);
    } catch {
      return baueConfig({ grund: 'ungueltig:KI_ENDPOINT' });
    }

    if (
      parsedEndpoint.protocol !== 'https:' ||
      parsedEndpoint.username ||
      parsedEndpoint.password ||
      (parsedEndpoint.port && parsedEndpoint.port !== '443') ||
      parsedEndpoint.search ||
      parsedEndpoint.hash ||
      (parsedEndpoint.pathname !== '' && parsedEndpoint.pathname !== '/') ||
      !parsedEndpoint.hostname
    ) {
      return baueConfig({ grund: 'ungueltig:KI_ENDPOINT' });
    }
    const endpoint = `https://${parsedEndpoint.hostname.toLowerCase()}/`;

    const deployment = e.KI_DEPLOYMENT;
    if (!deployment) return baueConfig({ grund: 'fehlt:KI_DEPLOYMENT' });
    if (!RE_DEPLOYMENT.test(deployment)) return baueConfig({ grund: 'ungueltig:KI_DEPLOYMENT' });

    const rawRegion = e.KI_REGION;
    if (!rawRegion) return baueConfig({ grund: 'fehlt:KI_REGION' });
    const region = String(rawRegion).toLowerCase();
    if (!EU_DATA_BOUNDARY_REGIONS.includes(region)) return baueConfig({ grund: 'ungueltig:KI_REGION' });

    let apiVersion = '2024-10-21';
    if (e.KI_API_VERSION !== undefined && e.KI_API_VERSION !== '') {
      if (!RE_API_VERSION.test(String(e.KI_API_VERSION))) {
        return baueConfig({ grund: 'ungueltig:KI_API_VERSION' });
      }
      apiVersion = String(e.KI_API_VERSION);
    }

    let monatsLimit = 600;
    if (e.KI_MONATS_LIMIT !== undefined && e.KI_MONATS_LIMIT !== '') {
      const rawLimit = String(e.KI_MONATS_LIMIT).trim();
      if (!/^\d+$/.test(rawLimit)) {
        return baueConfig({ grund: 'ungueltig:KI_MONATS_LIMIT' });
      }
      const n = parseInt(rawLimit, 10);
      if (!Number.isSafeInteger(n) || n < 1 || n > 1000000) {
        return baueConfig({ grund: 'ungueltig:KI_MONATS_LIMIT' });
      }
      monatsLimit = n;
    }

    return baueConfig({
      gueltig: true,
      grund: null,
      tenantId,
      clientId,
      clientSecret,
      endpoint,
      deployment,
      region,
      apiVersion,
      monatsLimit,
    });
  } catch (_e) {
    return baueConfig({ grund: 'ungueltig:KI_CONFIG' });
  }
}

/**
 * Erstellt den Entra-OAuth2-Client mit In-Memory-Cache und Singleflight.
 */
export function erstelleKiEntra({ config, fetchImpl = globalThis.fetch, jetzt = Date.now, log = console } = {}) {
  let cached = null; // { token: string, entraExp: number }
  let inflight = null;

  async function tokenBeschaffen() {
    const jetztSek = Math.floor(jetzt() / 1000);
    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_id', config.clientId);
    params.set('client_secret', config.clientSecret);
    params.set('scope', 'https://cognitiveservices.azure.com/.default');

    let res;
    try {
      res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });
    } catch (_netErr) {
      const err = new Error('Entra nicht erreichbar');
      err.code = 'KI_ENTRA';
      throw err;
    }

    if (!res.ok) {
      const err = new Error(`Entra HTTP ${res.status}`);
      err.code = 'KI_ENTRA';
      throw err;
    }

    let data;
    try {
      data = await res.json();
    } catch (_jsonErr) {
      const err = new Error('Entra Antwort ungueltig');
      err.code = 'KI_ENTRA';
      throw err;
    }

    const token = data?.access_token;
    const expiresIn = data?.expires_in;

    if (
      typeof token !== 'string' ||
      token.length < 10 ||
      token.length > 4096 ||
      RE_CONTROL_CHARS.test(token) ||
      !Number.isSafeInteger(expiresIn) ||
      expiresIn <= 0
    ) {
      const err = new Error('Entra Antwort ungueltig');
      err.code = 'KI_ENTRA';
      throw err;
    }

    const entraExp = jetztSek + expiresIn;
    cached = { token, entraExp };
    return cached;
  }

  return {
    async holeToken() {
      const jetztSek = Math.floor(jetzt() / 1000);
      if (cached && (cached.entraExp - jetztSek >= ENTRA_MIN_RESTLAUF_SEK)) {
        return cached;
      }
      if (inflight) {
        return inflight;
      }
      inflight = (async () => {
        try {
          return await tokenBeschaffen();
        } catch (err) {
          cached = null;
          throw err;
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    },
  };
}

/**
 * Liefert den Monatsschlüssel 'YYYY-MM' in Europe/Berlin.
 * @param {number} jetztMs
 * @returns {string}
 */
export function monatsSchluessel(jetztMs) {
  return berlinHeute(new Date(jetztMs)).slice(0, 7);
}

const DTF_BERLIN_TEILE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

function berlinWandzeitMs(d) {
  const parts = DTF_BERLIN_TEILE.formatToParts(d);
  const m = {};
  for (const p of parts) {
    if (p.type !== 'literal') m[p.type] = parseInt(p.value, 10);
  }
  return Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);
}

/**
 * Berechnet den UNIX-Sekunden-Zeitstempel des 1. des Folgemonats 00:00:00 Europe/Berlin (DST-sicher).
 * @param {number} jetztMs
 * @returns {number}
 */
export function naechsterMonatsanfangBerlin(jetztMs) {
  const tagStr = berlinHeute(new Date(jetztMs));
  const jahr = parseInt(tagStr.slice(0, 4), 10);
  const monat = parseInt(tagStr.slice(5, 7), 10);

  let zielJahr = jahr;
  let zielMonat = monat + 1;
  if (zielMonat > 12) {
    zielMonat = 1;
    zielJahr += 1;
  }

  // Ziel-Wandzeit: 00:00:00 am 1. des Folgemonats
  const zielWandMs = Date.UTC(zielJahr, zielMonat - 1, 1, 0, 0, 0);

  // UTC-Kandidat initial mit Wandzeit ansetzen und Offset abziehen
  let kandidatUtc = zielWandMs;
  const initialOffset = berlinWandzeitMs(new Date(kandidatUtc)) - kandidatUtc;
  kandidatUtc -= initialOffset;

  // Wandzeit des Kandidaten prüfen und ggf. korrigieren (DST-Sprünge)
  const istWandMs = berlinWandzeitMs(new Date(kandidatUtc));
  if (istWandMs !== zielWandMs) {
    kandidatUtc -= (istWandMs - zielWandMs);
  }

  return Math.floor(kandidatUtc / 1000);
}

/**
 * Erzeugt einen SHA-256-Hex-Fingerabdruck eines Tokens (nur im RAM verwenden).
 * @param {string} token
 * @returns {string}
 */
export function tokenFingerabdruck(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}
