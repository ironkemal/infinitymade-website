// IPv4-Einordnung für /v1/ip (K2b.6). Nur IPv4: der DNS-Eintrag ist ein A-Record.

/** @returns {number[]|null} */
export function parseIpv4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s ?? ''));
  if (!m) return null;
  const teile = m.slice(1).map((t) => (t.length > 1 && t.startsWith('0') ? NaN : Number(t))); // keine führenden Nullen (Oktal-Mehrdeutigkeit)
  return teile.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? teile : null;
}

/**
 * @returns {'ungueltig'|'null'|'loopback'|'linklocal'|'privat'|'cgnat'|'reserviert'|'oeffentlich'}
 * 'privat' = RFC1918 (10/8, 172.16/12, 192.168/16)
 */
export function klassifiziereIpv4(s) {
  const t = parseIpv4(s);
  if (!t) return 'ungueltig';
  const [a, b] = t;
  if (a === 0) return 'null';
  if (a === 127) return 'loopback';
  if (a === 169 && b === 254) return 'linklocal';
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'privat';
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat';
  if (a >= 224) return 'reserviert'; // Multicast, Klasse E, Broadcast
  return 'oeffentlich';
}

/** "::ffff:1.2.3.4" → "1.2.3.4" (Express liefert IPv4 hinter dual-stack so). */
export function entferneV4Praefix(ip) {
  return String(ip ?? '').replace(/^::ffff:/i, '');
}

/**
 * Rate-Limit-Schlüssel: IPv4 unverändert, IPv6 auf das /64-Präfix gekürzt
 * (ein Angreifer besitzt meist ein ganzes /64 und könnte sonst beliebig viele Schlüssel erzeugen).
 */
export function ratenSchluessel(ip) {
  const s = entferneV4Praefix(ip);
  if (!s.includes(':')) return s;
  const [kopf, ende = null] = s.split('::');
  const vorn = kopf ? kopf.split(':') : [];
  const hinten = ende === null ? [] : (ende ? ende.split(':') : []);
  const teile = ende === null ? vorn : [...vorn, ...Array(Math.max(0, 8 - vorn.length - hinten.length)).fill('0'), ...hinten];
  return teile.slice(0, 4).map((g) => g.toLowerCase().padStart(4, '0')).join(':') + '::/64';
}
