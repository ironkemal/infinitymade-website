// Mini-Gateway statt Kong: /rest/v1/* -> PostgREST, /auth/v1/* -> GoTrue. Nur 127.0.0.1. Args: <rest-port> <auth-port> <listen-port>
import http from 'node:http';
const [rest, auth, listen] = process.argv.slice(2).map(Number);
const ROUTES = [['/rest/v1', rest], ['/auth/v1', auth]];
http.createServer((req, res) => {
  const r = ROUTES.find(([p]) => req.url.startsWith(p));
  if (!r) { res.writeHead(404); return res.end('{"error":"kein Gateway-Pfad"}'); }
  const up = http.request({ host: '127.0.0.1', port: r[1], path: req.url.slice(r[0].length) || '/', method: req.method, headers: { ...req.headers, host: `127.0.0.1:${r[1]}` } }, (u) => { res.writeHead(u.statusCode, u.headers); u.pipe(res); });
  up.on('error', (e) => { res.writeHead(502); res.end(JSON.stringify({ error: String(e.code || e.message) })); });
  req.pipe(up);
}).listen(listen, '127.0.0.1', () => console.log('gateway auf ' + listen));
