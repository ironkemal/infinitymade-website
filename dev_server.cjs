/**
 * dev_server.cjs — statischer Server für die Entwicklung, Port 8081.
 *
 * ⚠️ Nur lokal. Diese Datei wird nie ausgeliefert: auf Vercel läuft der echte
 * Server, und `api/` sind dort Serverless Functions.
 *
 * Warum hier trotzdem `/api/config` liegt
 * ───────────────────────────────────────
 * `supabase-config.js` holt Projekt-URL und Anon-Key beim Start über
 * `fetch('/api/config')`. Auf Vercel beantwortet das `api/config.js` aus den
 * Environment Variables. Ein reiner Dateiserver kennt diese Route nicht,
 * lieferte 404 — und damit schlug der Login lokal immer fehl. Man kam also gar
 * nicht bis zum Dashboard, um etwas zu prüfen.
 *
 * Die zwei Werte sind kein Geheimnis: der Anon-Key geht ohnehin an jeden
 * Browser, der die Seite öffnet. Der Schutz liegt bei RLS, nicht bei diesem
 * Schlüssel. Der Service-Role-Key ist etwas völlig anderes und hat hier
 * nichts zu suchen.
 *
 * Woher die Werte nehmen
 * ──────────────────────
 * 1. `.env.local` im Projektverzeichnis anlegen (steht in .gitignore):
 *
 *        NEXT_PUBLIC_SUPABASE_URL=https://njvuclullotbksskpwgk.supabase.co
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
 *
 * 2. Beide Werte stehen im Browser unter
 *    https://app.praxura.de/api/config — einfach aufrufen und kopieren.
 *
 * Alternativ als Umgebungsvariablen vor dem Start setzen.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const DIR = __dirname;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Liest `.env.local`, ohne eine Abhängigkeit dafür zu installieren. */
function ladeEnvDatei() {
  const werte = {};
  const datei = path.join(DIR, '.env.local');
  if (!fs.existsSync(datei)) return werte;
  for (const zeile of fs.readFileSync(datei, 'utf8').split('\n')) {
    const treffer = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (treffer) werte[treffer[1]] = treffer[2].replace(/^["']|["']$/g, '');
  }
  return werte;
}

const envDatei = ladeEnvDatei();
const konfig = (name) => process.env[name] || envDatei[name];

const supabaseUrl = konfig('NEXT_PUBLIC_SUPABASE_URL') || konfig('SUPABASE_URL');
const supabaseAnonKey = konfig('NEXT_PUBLIC_SUPABASE_ANON_KEY') || konfig('SUPABASE_ANON_KEY');

http.createServer((req, res) => {
  let url = req.url.split('?')[0];

  // Ersatz für die Vercel-Funktion api/config.js. Gleiche Antwortform, damit
  // supabase-config.js keinen Sonderfall braucht.
  if (url === '/api/config') {
    res.setHeader('Content-Type', 'application/json');
    if (!supabaseUrl || !supabaseAnonKey) {
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Supabase config not set',
        hinweis: 'Lege .env.local mit NEXT_PUBLIC_SUPABASE_URL und '
               + 'NEXT_PUBLIC_SUPABASE_ANON_KEY an. Beide Werte stehen unter '
               + 'https://app.praxura.de/api/config',
      }));
      console.log('  ✗ /api/config — .env.local fehlt oder ist unvollständig');
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({ supabaseUrl, supabaseAnonKey }));
    return;
  }

  // Alles andere unter /api/ gibt es lokal nicht. Ein ehrlicher 501 ist besser
  // als ein 404, das nach einem Tippfehler aussieht.
  if (url.startsWith('/api/')) {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Diese API-Route gibt es nur auf Vercel, nicht im lokalen Server.',
      route: url,
    }));
    console.log(`  ⚠ ${url} — nur auf Vercel vorhanden`);
    return;
  }

  if (url === '/') url = '/index.html';

  let filePath = path.join(DIR, url);

  // Kein Ausbruch aus dem Projektverzeichnis über ../ im Pfad.
  if (!path.resolve(filePath).startsWith(path.resolve(DIR))) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath += '.html';
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} -> ${fs.existsSync(filePath) ? '200 OK' : '404 NOT FOUND'}`);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found');
    } else {
      // Im Entwicklungsserver nie zwischenspeichern — sonst sieht man die
      // eigene Änderung nicht und sucht den Fehler im Code.
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      res.end(content);
    }
  });
}).listen(PORT, () => {
  console.log(`\n  Praxura — lokaler Server:  http://localhost:${PORT}/login.html\n`);
  if (supabaseUrl && supabaseAnonKey) {
    console.log(`  /api/config liefert: ${supabaseUrl}`);
  } else {
    console.log('  ⚠ .env.local fehlt — der Login wird fehlschlagen.');
    console.log('    Werte holen unter https://app.praxura.de/api/config');
  }
  console.log('');
});
