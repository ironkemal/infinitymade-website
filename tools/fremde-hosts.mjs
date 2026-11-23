// Fremd-Host-Prüfer für die Box (Box-Test 22.11.2026, Problem 2; onprem-Freigabe 23.11.2026, G1/G8).
//
// Frage: Kann eine Box-Datei von sich aus einen fremden Host ansprechen?
// - Dateiliste = COPY-Quellen aus onprem/frontend.Dockerfile und api-backend/Dockerfile (was wirklich ins Image geht).
// - Jeder https?://-Host (Kommentare entfernt) muss in ERLAUBT stehen, mit Klasse und Begründung.
//   verweis   = Link, xmlns, Herkunftstext, CORS-Ursprung — nichts wird automatisch geladen
//   laden     = darf automatisch geladen werden, nur hinter einem Schalter (Begründung nennt ihn)
//   box       = gewollte Außenverbindung der Box → muss in api-backend/lib/verbindungen.js stehen
//   nur-saas  = Server-Ziel, das auf der Box nie aktiv wird; env-Namen dürfen nicht in den Box-Vorlagen stehen
// - Frontend-Ladekontexte (src, srcset, @import, url(), fetch, import(), WebSocket, EventSource, sendBeacon,
//   importScripts, <link rel=stylesheet|preconnect|modulepreload|prefetch>) mit fester URL: Host muss Klasse `laden`.
// - Box-CSP (nur die Content-Security-Policy-Header in onprem/Caddyfile): keine festen https://-Hosts außer {$…}.
// Navigation (Link, window.open, location) verlässt die Box auf Klick des Nutzers und ist bewusst nicht „laden“.
//
// Neuer Host → hier eintragen (mit Begründung) und, wenn er von selbst geladen wird, `onprem` fragen.

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {Record<string, { klasse: 'verweis'|'laden'|'box'|'nur-saas', grund: string, env?: string[] }>} */
export const ERLAUBT = {
  // ── Frontend: Namensräume, Lizenz- und Herkunftsangaben
  'www.w3.org': { klasse: 'verweis', grund: 'SVG/XML-Namensraum' },
  'ns.adobe.com': { klasse: 'verweis', grund: 'XMP-Metadaten in PNG' },
  'ns.attribution.com': { klasse: 'verweis', grund: 'XMP-Metadaten in PNG' },
  'purl.org': { klasse: 'verweis', grund: 'XMP-Metadaten in PNG' },
  'www.xfa.org': { klasse: 'verweis', grund: 'pdf.js-Namensraum' },
  'www.apache.org': { klasse: 'verweis', grund: 'Lizenzangabe pdf.js' },
  'fullcalendar.io': { klasse: 'verweis', grund: 'Lizenzangabe FullCalendar' },
  'fengyuanchen.github.io': { klasse: 'verweis', grund: 'Lizenzangabe Cropper.js' },
  'github.com': { klasse: 'verweis', grund: 'Lizenz-/Fehlerlink in supabase-js' },
  'infinitymade.de': { klasse: 'verweis', grund: 'xmlns im DMRZ-Export (rechnung-dmrz.js); im Backend CORS-Ursprung' },
  'www.ihre-praxis.de': { klasse: 'verweis', grund: 'Platzhalter im Eingabefeld (Rechtslinks)' },
  // ── Frontend: klickbare Links (Navigation verlässt die Box nur auf Klick)
  'praxura.de': { klasse: 'verweis', grund: 'Link „Zur Startseite“, Widget-Host-Text; im Backend CORS-Ursprung' },
  'admin.praxura.de': { klasse: 'verweis', grund: 'Admin-Link, in der Box ausgeblendet (dashboard.js !IST_KUTU); CORS-Ursprung' },
  'app.praxura.de': { klasse: 'verweis', grund: 'Fallback-Basis, wenn window.location.origin fehlt; CORS-Ursprung' },
  'www.trustcenter.itsg.de': { klasse: 'verweis', grund: 'Link in Einstellungen → Datenquellen' },
  'www.davaso.de': { klasse: 'verweis', grund: 'Link in Einstellungen → Datenquellen' },
  'www.ddg-online.de': { klasse: 'verweis', grund: 'Link in Einstellungen → Datenquellen' },
  'www.bitmarck.de': { klasse: 'verweis', grund: 'Link in Einstellungen → Datenquellen' },
  'www.zygotebody.com': { klasse: 'verweis', grund: 'Link „Zygote Body öffnen“ (Körperschema-Fallback)' },
  'www.google.com': { klasse: 'verweis', grund: 'Routen-Link Google Maps (Hausbesuch), nur auf Klick' },
  'myaccount.google.com': { klasse: 'verweis', grund: 'Hilfe-Links App-Passwort (Mailversand-Anleitung)' },
  // ── Frontend: automatisch geladen, nur hinter Schalter
  'js-de.sentry-cdn.com': { klasse: 'laden', grund: 'sentry-init.js lädt nur bei /api/config telemetryEnabled === true (Box: aus, O-06); Box-CSP blockt zusätzlich' },
  'n8n.infinitymade.de': { klasse: 'laden', grund: 'supabase-config.js: API-Basis nur bei hostname app.praxura.de (O-01/K1); Box nutzt /api' },
  // ── Gewollte Außenverbindungen der Box (stehen in lib/verbindungen.js)
  'acme-v02.api.letsencrypt.org': { klasse: 'box', grund: 'Caddy-Zertifikat (Let’s Encrypt)', env: ['letsencrypt'] },
  // ── Backend: CORS-Ursprünge, Herkunftstexte
  'admin.infinitymade.de': { klasse: 'verweis', grund: 'CORS-Ursprung (server.js)' },
  'app.infinitymade.de': { klasse: 'verweis', grund: 'CORS-Ursprung (server.js)' },
  'www.infinitymade.de': { klasse: 'verweis', grund: 'CORS-Ursprung (server.js)' },
  'www.praxura.de': { klasse: 'verweis', grund: 'CORS-Ursprung (server.js)' },
  'trustcenter-data.itsg.de': { klasse: 'verweis', grund: 'Herkunftstext der ITSG-Trust-Anchors; Abruf nur offline im CI, nie zur Laufzeit' },
  // ── Backend: Ziele, die auf der Box nie aktiv werden
  'api.apify.com': { klasse: 'nur-saas', grund: '/api/apify/search antwortet in der Box 404 (istKutu)', env: ['APIFY_TOKEN'] },
  'api.stripe.com': { klasse: 'nur-saas', grund: 'nur mit STRIPE_SECRET_KEY; Box verkauft ohne Stripe', env: ['STRIPE_SECRET_KEY'] },
  'www.googleapis.com': { klasse: 'nur-saas', grund: 'Google-OAuth/Kalender nur mit GOOGLE_* (GOOGLE_KONFIGURIERT); Box ohne Google', env: ['GOOGLE_CLIENT_ID'] },
  'gmail.googleapis.com': { klasse: 'nur-saas', grund: 'Gmail-Versand nur nach Google-OAuth; Box ohne Google', env: ['GOOGLE_CLIENT_ID'] },
};

const ENDUNGEN = /\.(js|mjs|html|css|json)$/;

/** COPY-Quellen eines Dockerfiles (ohne --from), relativ zur Wurzel, aufgelöst zu Textdateien. */
export function imageDateien(dockerfile, kontext, wurzel = WURZEL) {
  const text = readFileSync(join(wurzel, dockerfile), 'utf8');
  /** @type {string[]} */
  const dateien = [];
  /** @param {string} pfad */
  const sammeln = (pfad) => {
    const voll = join(wurzel, pfad);
    if (!existsSync(voll)) return;
    if (statSync(voll).isDirectory()) {
      for (const name of readdirSync(voll)) if (name !== 'node_modules') sammeln(join(pfad, name));
    } else if (ENDUNGEN.test(pfad) && !/\.test\./.test(pfad)) dateien.push(pfad);
  };
  for (const zeile of text.split('\n')) {
    const z = zeile.trim();
    if (!z.startsWith('COPY ') || z.includes('--from=')) continue;
    const teile = z.split(/\s+/).slice(1, -1).filter(t => !t.startsWith('--'));
    for (const t of teile) sammeln(join(kontext, t));
  }
  return [...new Set(dateien)].sort();
}

/** Kommentare entfernen (Block, HTML, Zeilen-// nur am Zeilenanfang oder nach Leerraum — nicht „https://“). */
export function ohneKommentare(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[\s;{}()])\/\/[^\n]*/g, '$1');
}

const HOST = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/gi;

/** @param {string} text @returns {string[]} */
export function hosts(text) {
  return [...new Set([...ohneKommentare(text).matchAll(HOST)].map(m => m[1].toLowerCase()))];
}

const LADEN = [
  /\bsrc\s*=\s*["'`]\s*https?:\/\/([^/"'`\s]+)/gi,
  /\.src\s*=\s*["'`]\s*https?:\/\/([^/"'`\s]+)/gi,
  /\bsrcset\s*=\s*["'`][^"'`]*?https?:\/\/([^/"'`\s,]+)/gi,
  /@import\s+(?:url\()?\s*["']?https?:\/\/([^/"')\s]+)/gi,
  /\burl\(\s*["']?https?:\/\/([^/"')\s]+)/gi,
  /\b(?:fetch|import|importScripts|sendBeacon)\s*\(\s*["'`]\s*https?:\/\/([^/"'`\s]+)/gi,
  /\bnew\s+(?:WebSocket|EventSource)\s*\(\s*["'`]\s*wss?:\/\/([^/"'`\s]+)/gi,
  /\bnew\s+(?:WebSocket|EventSource)\s*\(\s*["'`]\s*https?:\/\/([^/"'`\s]+)/gi,
  /<link\b[^>]*\brel\s*=\s*["']?(?:stylesheet|preconnect|modulepreload|prefetch|preload)[^>]*\bhref\s*=\s*["']https?:\/\/([^/"'\s]+)/gi,
  /<link\b[^>]*\bhref\s*=\s*["']https?:\/\/([^/"'\s]+)[^>]*\brel\s*=\s*["']?(?:stylesheet|preconnect|modulepreload|prefetch|preload)/gi,
];

/** Hosts in automatischen Ladekontexten. @param {string} text @returns {string[]} */
export function geladeneHosts(text) {
  const t = ohneKommentare(text);
  return [...new Set(LADEN.flatMap(rx => [...t.matchAll(rx)].map(m => m[1].toLowerCase().replace(/:\d+$/, ''))))];
}

/** Feste https-Hosts in den CSP-Headern der Box. @param {string} caddyfile */
export function cspFremdhosts(caddyfile) {
  const zeilen = caddyfile.split('\n').filter(z => /Content-Security-Policy/i.test(z));
  return zeilen.flatMap(z => [...z.replace(/\{\$[A-Z_]+\}/g, '').matchAll(/https?:\/\/([^\s;"']+)/gi)].map(m => m[1]));
}

/**
 * Gesamtprüfung. Liefert Verstöße als lesbare Zeilen (leer = sauber).
 * @param {{ wurzel?: string, erlaubt?: typeof ERLAUBT, extra?: Record<string,string> }} [o]
 *   extra: zusätzliche Dateien {pfad: inhalt} für die Gegenprobe
 */
export function pruefe({ wurzel = WURZEL, erlaubt = ERLAUBT, extra = {} } = {}) {
  /** @type {string[]} */
  const fehler = [];
  const frontend = imageDateien('onprem/frontend.Dockerfile', '.', wurzel);
  const backend = imageDateien('api-backend/Dockerfile', 'api-backend', wurzel);
  /** @param {string} p */
  const lies = (p) => extra[p] ?? readFileSync(join(wurzel, p), 'utf8');
  const alle = [...frontend.map(p => ({ p, teil: 'frontend' })), ...backend.map(p => ({ p, teil: 'backend' })),
    ...Object.keys(extra).map(p => ({ p, teil: 'frontend' }))];

  /** @type {Map<string, Set<string>>} */
  const unbekannt = new Map();
  for (const { p, teil } of alle) {
    const text = lies(p);
    for (const h of hosts(text)) if (!erlaubt[h]) (unbekannt.get(h) || unbekannt.set(h, new Set()).get(h)).add(p);
    if (teil === 'frontend') for (const h of geladeneHosts(text)) {
      if (erlaubt[h]?.klasse !== 'laden') fehler.push(`lädt automatisch von ${h} ohne Klasse „laden“: ${p}`);
    }
  }
  for (const [h, dateien] of unbekannt) fehler.push(`unbekannter Host ${h} in ${[...dateien].slice(0, 3).join(', ')} — in tools/fremde-hosts.mjs ERLAUBT eintragen (mit Grund)`);

  const verbindungen = readFileSync(join(wurzel, 'api-backend/lib/verbindungen.js'), 'utf8').toLowerCase();
  const boxVorlagen = ['onprem/.env.template', 'onprem/docker-compose.yml']
    .filter(p => existsSync(join(wurzel, p))).map(p => readFileSync(join(wurzel, p), 'utf8')).join('\n');
  for (const [h, e] of Object.entries(erlaubt)) {
    if (e.klasse === 'box' && !(e.env || [h]).some(n => verbindungen.includes(n.toLowerCase()))) {
      fehler.push(`Box-Verbindung ${h} fehlt in api-backend/lib/verbindungen.js`);
    }
    if (e.klasse === 'nur-saas') for (const n of e.env || []) {
      if (new RegExp(`\\b${n}\\b`).test(boxVorlagen)) fehler.push(`${h} gilt als nur-SaaS, aber ${n} steht in den Box-Vorlagen (.env.template/docker-compose)`);
    }
  }
  for (const h of cspFremdhosts(readFileSync(join(wurzel, 'onprem/Caddyfile'), 'utf8'))) {
    fehler.push(`Box-CSP enthält festen Host ${h} (onprem/Caddyfile)`);
  }
  return { fehler, dateien: { frontend: frontend.length, backend: backend.length } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { fehler, dateien } = pruefe();
  if (fehler.length) { console.error('✗ Fremd-Host-Prüfung:\n  ' + fehler.join('\n  ')); process.exit(1); }
  console.log(`✓ Fremd-Host-Prüfung: ${dateien.frontend} Frontend- + ${dateien.backend} Backend-Dateien sauber`);
}
