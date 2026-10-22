// App für Mitarbeiter (22.10.2026, onprem O-214) — Web-App-Manifest der Box mit dem
// Praxisnamen. Caddy schreibt /manifest.json auf /api/manifest um (onprem/Caddyfile),
// so steht unter dem Symbol auf dem Startbildschirm „Podologie Müller", nicht die
// zufällige Box-Adresse. Die HTML-Seiten verweisen weiter auf /manifest.json —
// im SaaS liefert Vercel dort die statische Datei („Praxura"), diese Route gibt es
// dort nicht (nurKutu: sonst zeigte der SaaS-VPS den Namen eines beliebigen Kunden).
//
// Muss VOR der Wartungsmodus-Middleware hängen und darf nie 5xx werden: Fehlt der
// Name (DB weg, Einrichtung offen), kommt die Grundfassung „Praxura" mit 200.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { nurKutu } from '../lib/dagitim.js';

// Android schneidet den Namen unter dem Symbol nach ~12 Zeichen ab.
const KURZ_MAX = 12;

export const GRUNDFASSUNG = Object.freeze({
  id: '/dashboard.html',
  name: 'Praxura',
  short_name: 'Praxura',
  description: 'Praxissoftware für Heilmittelerbringer',
  start_url: '/dashboard.html',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait-primary',
  theme_color: '#b1891b',
  background_color: '#0a0a0f',
  lang: 'de-DE',
  icons: [
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
  categories: ['business', 'productivity'],
});

/** Praxisname → Manifest. Leer/ungültig → Grundfassung. */
export function manifestFuer(praxisName) {
  const name = String(praxisName ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!name) return { ...GRUNDFASSUNG };
  const kurz = name.length <= KURZ_MAX ? name : name.slice(0, KURZ_MAX - 1).trimEnd() + '…';
  return { ...GRUNDFASSUNG, name, short_name: kurz };
}

const manifestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte warten Sie eine Minute.' },
});

// Ein Name pro Box (eine Praxis) — 5 min im Speicher, keine Abfrage pro Aufruf.
let cache = { name: null, bis: 0 };

export function createManifestRouter({ supabase }) {
  const router = Router();
  router.get('/manifest', nurKutu, manifestLimiter, async (req, res) => {
    const jetzt = Date.now();
    if (jetzt >= cache.bis) {
      let name = null;
      try {
        const { data, error } = await supabase.from('profiles')
          .select('business_name').eq('role', 'owner')
          .order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (!error) name = data?.business_name || null;
      } catch { /* Grundfassung */ }
      cache = { name, bis: jetzt + 300_000 };
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.type('application/manifest+json').send(JSON.stringify(manifestFuer(cache.name)));
  });
  return router;
}

/** Nur für Tests. */
export function cacheLeeren() { cache = { name: null, bis: 0 }; }
