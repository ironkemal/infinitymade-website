// Cloudflare-DNS-Client (K2b.2). Zone-Token liegt NUR hier im Merkez, nie in der Box (G2).
// Alle Einträge DNS-only (proxied:false). Zone, Token und Box-Domain kommen aus der Umgebung —
// im Code steht keine Domain.
//
// CAA nur je Box-Unterdomain, NIE am Apex (Vercel/Stripe-Zertifikate der Hauptdomain).
const API = 'https://api.cloudflare.com/client/v4';

export const CAA_BASIS = 'letsencrypt.org; validationmethods=dns-01';

export function erstelleCloudflare({ zoneId, token, fetchImpl = globalThis.fetch, apiBasis = API }) {
  if (!zoneId || !token) throw new Error('CF_ZONE_ID und CF_API_TOKEN sind Pflicht');

  async function anfrage(methode, pfad, body) {
    const r = await fetchImpl(`${apiBasis}/zones/${zoneId}/dns_records${pfad}`, {
      method: methode,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.success) {
      // Token/Antwortdetails nicht ins Log: nur Status + Cloudflare-Fehlercodes
      throw new Error(`Cloudflare ${methode} ${pfad.split('?')[0] || '/'} fehlgeschlagen: HTTP ${r.status} ${(j?.errors || []).map((e) => e.code).join(',')}`);
    }
    return j.result;
  }

  const finde = (typ, name) => anfrage('GET', `?type=${typ}&name=${encodeURIComponent(name)}&per_page=50`);

  async function setze(typ, name, extra, ttl) {
    const vorhanden = await finde(typ, name);
    const inhalt = { type: typ, name, ttl, proxied: false, ...extra };
    if (vorhanden.length > 0) {
      await anfrage('PUT', `/${vorhanden[0].id}`, inhalt);
      for (const ueberzaehlig of vorhanden.slice(1)) await anfrage('DELETE', `/${ueberzaehlig.id}`);
    } else {
      await anfrage('POST', '', inhalt);
    }
  }

  return {
    setzeA: (fqdn, ip, ttl = 600) => setze('A', fqdn, { content: ip }, ttl),
    setzeCname: (fqdn, ziel, ttl = 600) => setze('CNAME', fqdn, { content: ziel }, ttl),
    /** CAA am Box-Namen: genau ein issue-Eintrag, optional an ein LE-Konto (RFC 8657) gebunden. */
    async setzeCaa(fqdn, accountUri) {
      const wert = accountUri ? `${CAA_BASIS}; accounturi=${accountUri}` : CAA_BASIS;
      await setze('CAA', fqdn, { data: { flags: 0, tag: 'issue', value: wert } }, 600);
    },
    async loesche(typ, fqdn) {
      for (const e of await finde(typ, fqdn)) await anfrage('DELETE', `/${e.id}`);
    },
  };
}
