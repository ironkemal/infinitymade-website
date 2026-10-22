// Login-Hinweis in der Box: Einrichtung noch nicht abgeschlossen (15.10.2026).
//
// Test 15.10.2026: Am Ende der Windows-Einrichtung stand der Login-Link, der
// Setup-Tab (setup.html#Jeton) lag hinten bzw. öffnete sich bei einem zweiten
// Lauf nie — die Praxis stand am Login, ohne je E-Mail/Passwort festgelegt zu
// haben, und ohne Hinweis, was zu tun ist. Diese Seite sagt es jetzt.
//
// Beta-Test Linux 22.10.2026: Der Hinweis über dem Login-Formular reichte nicht —
// man sah ein Formular für E-Mail/Passwort, die es noch gar nicht gibt. Gibt es
// noch KEIN Konto, leitet die Seite deshalb direkt auf setup.html weiter (dort
// steht, wie man an den Link kommt). Nur „Konto da, Abschluss fehlt" bleibt ein
// Hinweis, weil Anmelden dann geht.
//
// Liest GET /api/setup/status genauso wie setup.js init(): 404 = Router nicht
// eingehängt (Einrichtung fertig, SETUP_TOKEN geleert) → nichts tun. Nur in
// der Box (IST_KUTU); in der SaaS gibt es den Router nicht.
//
// Den Jeton kennt diese Seite nie.

export const NEUER_LINK_LINUX = 'sudo bash /opt/praxura/onprem/install.sh --neuer-jeton';
export const NEUER_LINK_WINDOWS = '„Praxura-Einrichtung" erneut starten';

/** Status-Antwort → { weiterleiten } | Hinweistext | null (nichts tun). */
export function einrichtungHinweisText(httpStatus, daten) {
  if (httpStatus !== 200 || !daten || daten.abgeschlossen) return null;
  if (daten.verfuegbar !== false) return { weiterleiten: true };
  return {
    titel: 'Einrichtung noch nicht abgeschlossen',
    text: 'Das Inhaber-Konto ist angelegt, die Einrichtung aber nicht fertig. Anmelden geht; zum Abschließen den Einrichtungslink erneut öffnen.',
    linux: `Neuer Link — Linux-Server: ${NEUER_LINK_LINUX} · Windows-PC: ${NEUER_LINK_WINDOWS}`,
  };
}

/** Holt den Status; leitet weiter oder setzt den Hinweis vor `vor` (Element). Fehler → still. */
export async function einrichtungHinweisZeigen({ istKutu, apiBase, vor, weiterleiten = (url) => location.replace(url) }) {
  if (!istKutu || !vor) return;
  let hinweis = null;
  try {
    const res = await fetch(apiBase + '/setup/status');
    hinweis = einrichtungHinweisText(res.status, res.status === 200 ? await res.json() : null);
  } catch {
    return;
  }
  if (!hinweis) return;
  if (hinweis.weiterleiten) { weiterleiten('/setup.html'); return; }

  const box = document.createElement('div');
  box.className = 'msg show info';
  box.setAttribute('role', 'status');
  const titel = document.createElement('strong');
  titel.textContent = hinweis.titel;
  const text = document.createElement('p');
  text.style.margin = '6px 0 0';
  text.textContent = hinweis.text;
  const klein = document.createElement('p');
  klein.style.cssText = 'margin:6px 0 0;font-size:12px;opacity:.8';
  klein.append(hinweis.linux + ' · ');
  const link = document.createElement('a');
  link.href = '/setup.html';
  link.textContent = 'Einrichtungs-Jeton von Hand eingeben';
  klein.append(link);
  box.append(titel, text, klein);
  vor.before(box);
}
