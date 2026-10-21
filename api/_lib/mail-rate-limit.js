import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

// Zusätzliche Instanzbremse, kein verteilter WAF-Schutz. Cold Starts und weitere
// Serverless-Instanzen haben eigene Zähler. Keine Roh-IP und kein persistentes Secret.
export function createMailRateLimiter({ limit = 5, windowMs = 600_000, maxEntries = 2000,
  now = Date.now, secret = randomBytes(32), isVercel = () => process.env.VERCEL === '1' } = {}) {
  if (![limit, windowMs, maxEntries].every(n => Number.isSafeInteger(n) && n > 0)) {
    throw new TypeError('Ungültige Drosselungsgrenzen');
  }
  const buckets = new Map();
  return function consume(req, scope) {
    if (!['contact', 'demo-create', 'demo-reschedule'].includes(scope)) throw new TypeError('Unbekannter Mailpfad');
    const current = now();
    for (const [key, value] of buckets) if (value.until <= current) buckets.delete(key);
    const header = req.headers?.['x-vercel-forwarded-for'];
    const raw = isVercel() ? (typeof header === 'string' ? header.trim() : '') : req.socket?.remoteAddress;
    let ip = typeof raw === 'string' && isIP(raw) ? raw : 'unknown';
    if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
    if (isIP(ip) === 6) {
      try { ip = new URL(`http://[${ip}]/`).hostname; } catch { ip = 'unknown'; }
    }
    const key = createHmac('sha256', secret).update(scope + ':' + ip).digest('hex');
    let bucket = buckets.get(key);
    if (!bucket) {
      // Nicht durch Verdrängung alter Schlüssel umgehbar; volle Kapazität sperrt
      // neue Schlüssel bis zum nächsten Ablauf. Speicher bleibt begrenzt.
      if (buckets.size >= maxEntries) {
        const until = Math.min(...Array.from(buckets.values(), b => b.until));
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((until - current) / 1000)) };
      }
      bucket = { count: 0, until: current + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count = Math.min(bucket.count + 1, limit + 1);
    return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.until - current) / 1000)) };
  };
}

const consume = createMailRateLimiter();

export function allowMailRequest(req, res, scope) {
  const decision = consume(req, scope);
  if (decision.allowed) return true;
  res.statusCode = 429;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', String(decision.retryAfter));
  res.end(JSON.stringify({ error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' }));
  return false;
}
