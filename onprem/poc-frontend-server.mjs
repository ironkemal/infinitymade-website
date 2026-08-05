// PoC static server: website/ kökünü servis eder + /api/config'i lokal Supabase'e yönlendirir.
// Faz 2'de bu işi Caddy + Express üstlenecek; bu dosya yalnızca Faz 0 doğrulaması içindir.
// Kullanım: node onprem/poc-frontend-server.mjs  (env: LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, PORT)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.LOCAL_SUPABASE_URL || 'http://localhost:8000';
const ANON_KEY = process.env.LOCAL_ANON_KEY || '';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: ANON_KEY }));
  }
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`[poc-frontend] http://localhost:${PORT} → ${ROOT} (supabase: ${SUPABASE_URL})`));
