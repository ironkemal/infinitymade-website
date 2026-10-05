// Client zum LOKALEN acme-dns (joohoi/acme-dns, MIT). /register ist nur von Merkez aus
// erreichbar (ACME_DNS_INTERN_URL, nicht öffentlich); nach außen steht allein /update.
export function erstelleAcmeDns({ internUrl, fetchImpl = globalThis.fetch }) {
  if (!internUrl) throw new Error('ACME_DNS_INTERN_URL ist Pflicht');
  const basis = internUrl.replace(/\/+$/, '');
  return {
    /** Neues Konto: {username, password, fulldomain, subdomain}. */
    async registrieren() {
      const r = await fetchImpl(`${basis}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(10000),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.username || !j?.password || !j?.fulldomain || !j?.subdomain) {
        throw new Error(`acme-dns /register fehlgeschlagen: HTTP ${r.status}`);
      }
      return { username: j.username, password: j.password, fulldomain: j.fulldomain, subdomain: j.subdomain };
    },
  };
}
