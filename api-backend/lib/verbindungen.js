// O-178 / K2b.16 (08.10.2026) — „Mit wem spricht diese Box?" für ueber.html.
//
// Die Liste wird aus der tatsächlichen Konfiguration der Box gebildet (env),
// nicht als fester Text gepflegt: eine handgeschriebene Liste, die nicht zur
// Einstellung der Praxis passt (TLS-Modus, KI, SMTP), wäre eine falsche
// Transparenzangabe — schlimmer als keine (onprem O-178 Bedingung 5).
//
// Die Hosts hier sind reiner Anzeigetext. Kein Code ruft sie über diese Datei
// auf (keine neue feste Adresse im Sinne von Typ C).
//
// Wer eine neue Außenverbindung einbaut, ergänzt sie HIER im selben Commit —
// sonst sagt die Box der Praxis nicht die Wahrheit.

import { istKutu } from './dagitim.js';

function host(url) {
  try { return new URL(url).host; } catch { return ''; }
}

/**
 * @param {Record<string,string|undefined>} [env]
 * @returns {{kutu: boolean, verbindungen: Array<{ziel:string, zweck:string, wann:string, inhalt:string, von:'Praxura'|'Betriebssystem'}>}}
 */
export function verbindungenListe(env = process.env) {
  const v = [];
  const add = (ziel, zweck, wann, inhalt, von = 'Praxura') => v.push({ ziel, zweck, wann, inhalt, von });

  // Immer: Bezug der Programmteile. update.sh läuft jede Nacht (02:00 + bis 2 h
  // Streuung) und fragt mit `docker compose pull` BEIDE Registries ab
  // (onprem/update.sh). Alle Domains genannt, die eine Firewall freigeben muss.
  add('ghcr.io, pkg-containers.githubusercontent.com', 'Praxura-Programmteile herunterladen (Aktualisierungen)',
    'bei der Installation und jede Nacht zwischen 02:00 und 04:00 Uhr',
    'nur Abruf, es werden keine Praxisdaten gesendet');
  add('registry-1.docker.io, auth.docker.io, production.cloudflare.docker.com (Docker Hub)',
    'Basis-Komponenten herunterladen (Datenbank, Anmeldung, Proxy)',
    'bei der Installation und jede Nacht zwischen 02:00 und 04:00 Uhr (Prüfung auf neue Versionen)',
    'nur Abruf, es werden keine Praxisdaten gesendet');
  // Starter installieren/install.sh bzw. install.ps1 — nur auf dem Rechner, nur einmal.
  add('praxura.de, download.docker.com', 'Installationsprogramm und Docker laden',
    'nur bei der Einrichtung', 'nur Abruf, es werden keine Praxisdaten gesendet');

  const merkez = host(env.MERKEZ_URL || '');
  if (merkez) {
    // merkez-istemci/ip-abgleich.js: prüft jede Minute, SENDET nur bei IP-Wechsel
    // oder nach 6 h; /v1/caa einmal je Let's-Encrypt-Konto.
    add(merkez, 'Praxura-Namensdienst: Adresse der Box aktuell halten',
      'bei der Einrichtung, wenn sich die IP-Adresse ändert, sonst alle 6 Stunden',
      "Box-Kennung (signiert), die interne IP-Adresse der Box und die Kennung ihres Let's-Encrypt-Kontos — keine Patientendaten");
  }

  const modus = env.CADDY_TLS_MODUS || '';
  const tlsArg = env.CADDY_TLS_ARG || 'internal';
  if (modus === 'acmedns') {
    add('acme-v02.api.letsencrypt.org', 'Sicherheitszertifikat für die Box-Adresse (Let\'s Encrypt)',
      'etwa alle 60 Tage', 'Box-Adresse — keine Patientendaten');
    add('auth.praxura.de', 'Nachweis für das Zertifikat (DNS-Eintrag beim Praxura-Namensdienst)',
      'nur zusammen mit der Zertifikatserneuerung', 'ein einmaliger Prüfwert — keine Patientendaten');
  } else if (modus && tlsArg !== 'internal') {
    add('acme-v02.api.letsencrypt.org', 'Sicherheitszertifikat für die eigene Adresse (Let\'s Encrypt)',
      'etwa alle 60 Tage', 'Box-Adresse — keine Patientendaten');
  }

  if (env.SMTP_HOST) {
    add(`${env.SMTP_HOST}:${env.SMTP_PORT || 587}`, 'E-Mail-Versand über den Mailserver der Praxis',
      'wenn die Software eine E-Mail verschickt', 'die jeweilige E-Mail (Empfänger, Inhalt)');
  }

  const ki = (env.AI_MODE || 'aus').toLowerCase();
  if (ki === 'direkt') {
    add(host(env.AI_ENDPOINT || '') || '(KI-Adresse nicht gesetzt)', 'KI-Funktionen mit dem eigenen KI-Zugang der Praxis',
      'nur wenn eine KI-Funktion benutzt wird', 'pseudonymisierter Text der jeweiligen Anfrage');
  } else if (ki === 'jeton') {
    if (merkez) {
      add(merkez, 'KI-Zugang anfordern (kurzlebiger Schlüssel)', 'höchstens einmal pro Stunde, nur bei KI-Nutzung',
        'Box-Kennung (signiert) und Nutzungssummen — keine Inhalte, keine Patientendaten');
    }
    add('Azure OpenAI (EU, vom Praxura-Zugangsdienst genannt)', 'KI-Funktionen über den Praxura-KI-Zugang',
      'nur wenn eine KI-Funktion benutzt wird', 'pseudonymisierter Text der jeweiligen Anfrage');
  }

  add('Zeitserver und Paketquellen des Betriebssystems', 'Uhrzeit und Sicherheitsupdates des Rechners',
    'nach Einstellung des Betriebssystems', 'keine Praxisdaten', 'Betriebssystem');

  return { kutu: istKutu(), verbindungen: v };
}
