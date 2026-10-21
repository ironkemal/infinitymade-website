// Login-Hinweis in der Box: Einrichtung noch nicht abgeschlossen (15.10.2026).
//
// Test 15.10.2026: Am Ende der Windows-Einrichtung stand der Login-Link, der
// Setup-Tab (setup.html#Jeton) lag hinten bzw. öffnete sich bei einem zweiten
// Lauf nie — die Praxis stand am Login, ohne je E-Mail/Passwort festgelegt zu
// haben, und ohne Hinweis, was zu tun ist. Diese Seite sagt es jetzt.
//
// Liest GET /api/setup/status genauso wie setup.js init(): 404 = Router nicht
// eingehängt (Einrichtung fertig, SETUP_TOKEN geleert) → nichts zeigen. Nur in
// der Box (IST_KUTU); in der SaaS gibt es den Router nicht.
//
// Der Ausweg ist bewusst „Praxura-Einrichtung erneut starten": install.ps1
// öffnet bei offener Einrichtung den Setup-Link selbst (und erneuert einen
// abgelaufenen Jeton). Den Jeton kennt diese Seite nie.

/** Status-Antwort → Hinweistext oder null (nichts anzeigen). */
export function einrichtungHinweisText(httpStatus, daten) {
  if (httpStatus !== 200 || !daten || daten.abgeschlossen) return null;
  const kontoDa = daten.verfuegbar === false;
  return {
    titel: 'Einrichtung noch nicht abgeschlossen',
    text: kontoDa
      ? 'Das Inhaber-Konto ist angelegt, die Einrichtung aber nicht fertig. Anmelden geht; zum Abschließen auf dem PC mit der Box „Praxura-Einrichtung" erneut starten — die Einrichtung öffnet sich dann im Browser.'
      : 'Für diese Praxis-Box gibt es noch kein Konto. Auf dem PC mit der Box „Praxura-Einrichtung" erneut starten — die Einrichtung öffnet sich dann im Browser. Dort legen Sie E-Mail und Passwort für die Anmeldung fest.',
    linux: 'Linux-Server: sudo bash install.sh --neuer-jeton',
  };
}

/** Holt den Status und setzt den Hinweis vor `vor` (Element). Fehler → still. */
export async function einrichtungHinweisZeigen({ istKutu, apiBase, vor }) {
  if (!istKutu || !vor) return;
  let hinweis = null;
  try {
    const res = await fetch(apiBase + '/setup/status');
    hinweis = einrichtungHinweisText(res.status, res.status === 200 ? await res.json() : null);
  } catch {
    return;
  }
  if (!hinweis) return;

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
