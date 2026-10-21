// Einwilligung für die Reichweitenmessung (Umami, selbst gehostet).
//
// STAND 29.08.2026 — überarbeitet nach einer Prüfung durch `legal-de`.
// Was vorher falsch war und warum es geändert wurde:
//
//   1. Der Banner behauptete „Keine personenbezogenen Daten werden gespeichert."
//      Das ist mit hoher Wahrscheinlichkeit unzutreffend: Umami bildet aus
//      IP-Adresse, User-Agent und einem täglich wechselnden Salt eine
//      `session_id`. Das ist ein PSEUDONYMER Bezeichner (ErwG 26 DSGVO), kein
//      anonymer. Eine Einwilligung, die auf einer irreführenden Angabe beruht,
//      ist nach Art. 4 Nr. 11 DSGVO angreifbar — die Aussage schadete also
//      genau dem, was sie stützen sollte.
//   2. Es gab KEINEN Widerruf. Nach einem Klick auf „Akzeptieren" erschien der
//      Banner nie wieder und es existierte nirgends ein Link zu den
//      Einstellungen. Art. 7 Abs. 3 S. 4 DSGVO verlangt aber, dass der Widerruf
//      so einfach ist wie die Erteilung. Das war der ernsteste Mangel — ernster
//      als der Textwiderspruch, der ihn aufgedeckt hat.
//   3. Die Einwilligung galt unbefristet. Die DSK erwartet, dass nach etwa
//      zwölf Monaten erneut gefragt wird.
//   4. Im Banner fehlte der Link zur Datenschutzerklärung.
//
// Warum die Schranke bleibt, obwohl `datenschutz.html` einmal das Gegenteil
// behauptete: § 25 Abs. 1 TDDDG ist technologieneutral und erfasst nicht nur
// Cookies, sondern auch den ZUGRIFF auf bereits gespeicherte Informationen.
// Das Umami-Skript liest aktiv `screen`, `navigator.language` und
// `document.referrer` aus. § 25 Abs. 2 Nr. 2 greift nicht — Reichweitenmessung
// ist für die Bereitstellung der Seite nicht unbedingt erforderlich, und eine
// deutsche Reichweitenmessungs-Ausnahme gibt es nicht. Vor allem: § 25 gilt
// UNABHÄNGIG davon, ob personenbezogene Daten verarbeitet werden. Mit einem
// DSGVO-Argument lässt sich die TDDDG-Pflicht deshalb nicht abräumen.
//
// Bestehende Zustimmungen werden bewusst NICHT übernommen: sie wurden unter dem
// irreführenden Text aus Punkt 1 erteilt. Wer damals zugestimmt hat, wird einmal
// erneut gefragt. Das kostet kurz Messdaten und ist trotzdem richtig.
(function () {
  var WEBSITE_ID = 'fa4b493b-35cd-4555-b667-b6a5439471e6';
  var SRC = 'https://analytics.infinitymade.de/script.js';
  var KEY = 'cookie_consent';
  var ZEIT_KEY = 'cookie_consent_zeitpunkt';
  var GUELTIG_TAGE = 365;
  var WIDERRUF_COOKIE = '__Host-praxura_consent_widerruf';
  var widerrufAusstehend = false;
  var DS_LINK = '/datenschutz.html#reichweitenmessung';
  var geladen = false;
  var messungErlaubt = false;

  // Umami >= 2.18: auch bereits registrierte Tracker-Listener müssen nach
  // Widerruf verstummen, selbst wenn Browser-Speicherung inzwischen fehlschlägt.
  // https://docs.umami.is/docs/tracker-configuration#data-before-send
  function praxuraUmamiVorSenden(_typ, payload) {
    return messungErlaubt && widerrufMarker() === false ? payload : false;
  }
  window.praxuraUmamiVorSenden = praxuraUmamiVorSenden;

  function injectUmami() {
    if (geladen || !messungErlaubt || widerrufMarker() !== false) return;              // doppeltes Einhängen verhindern
    geladen = true;
    var s = document.createElement('script');
    s.defer = true;
    s.src = SRC;
    s.setAttribute('data-website-id', WEBSITE_ID);
    s.setAttribute('data-before-send', 'praxuraUmamiVorSenden');
    document.head.appendChild(s);
  }

  // Ausschließlich notwendige Widerrufssperre: fester Wert, kein Bezeichner,
  // host-only (__Host-, kein Domain), höchstens die bestehende Consent-Laufzeit.
  // null heißt: nicht lesbar, also keine Messung. Schreibversuche werden geprüft.
  function widerrufMarker(aktion) {
    try {
      if (aktion === 'loeschen' && widerrufMarker() === false) return true;
      if (aktion) {
        document.cookie = WIDERRUF_COOKIE + '=1; Path=/; Secure; SameSite=Lax; Max-Age='
          + (aktion === 'setzen' ? GUELTIG_TAGE * 86400 : 0);
      }
      var aktiv = document.cookie.split(';').some(function (teil) {
        return teil.trim() === WIDERRUF_COOKIE + '=1';
      });
      return aktion ? aktiv === (aktion === 'setzen') : aktiv;
    } catch (_) { return null; }
  }

  // Beide Löschungen unabhängig versuchen, auch nach Teilwrites/Lesefehlern.
  // Ein nachweislich fehlender Schlüssel reicht, um altes accepted zu entwerten.
  function invalidiereZustimmung() {
    try { localStorage.removeItem(KEY); } catch (_) { /* zweiten Schlüssel versuchen */ }
    try { localStorage.removeItem(ZEIT_KEY); } catch (_) { /* unabhängig prüfen */ }
    var ungueltig = false;
    try { ungueltig = localStorage.getItem(KEY) !== 'accepted'; } catch (_) { /* unbestätigt */ }
    try { ungueltig = localStorage.getItem(ZEIT_KEY) === null || ungueltig; } catch (_) { /* unbestätigt */ }
    if (ungueltig) {
      widerrufMarker('loeschen');
      return true;
    }
    return widerrufMarker('setzen') === true;
  }

  // localStorage kann werfen (privater Modus, blockierte Website-Daten).
  // Im Zweifel gilt: keine Entscheidung, also keine Messung.
  function lesen() {
    var sperre = widerrufMarker();
    if (sperre !== false) return sperre === true ? 'declined' : null;
    try {
      var wert = localStorage.getItem(KEY);
      if (wert !== 'accepted' && wert !== 'declined') return null;
      var ts = parseInt(localStorage.getItem(ZEIT_KEY) || '0', 10);
      if (!ts) return null;                                   // Altbestand → neu fragen
      if (Date.now() - ts > GUELTIG_TAGE * 86400000) return null;  // abgelaufen → neu fragen
      // Ein alter Opt-in darf nicht aktiviert werden, wenn der Browser dessen
      // Widerruf nicht mehr speichern könnte. Keine Verlängerung des Zeitpunkts.
      localStorage.setItem(KEY, wert);
      return wert;
    } catch (_) {
      return null;
    }
  }

  // Rückgabe: dauerhaft sicher für Navigation, nicht zwingend „declined gespeichert“.
  function speichern(wert) {
    if (wert === 'declined') widerrufAusstehend = true;
    try {
      var zeitpunkt = String(Date.now());
      localStorage.setItem(KEY, wert);
      localStorage.setItem(ZEIT_KEY, zeitpunkt);
      if (localStorage.getItem(KEY) === wert && localStorage.getItem(ZEIT_KEY) === zeitpunkt) {
        if (wert === 'declined') {
          widerrufAusstehend = false;
          widerrufMarker('loeschen'); // altes accepted nachweislich ersetzt
        }
        return true;
      }
    } catch (_) { /* Teilwrite und fehlgeschlagenes Readback ebenfalls invalidieren. */ }
    return wert === 'declined' ? invalidiereZustimmung() : false;
  }

  function schliessen() {
    var alt = document.getElementById('cookie-banner');
    if (alt && alt.parentNode) alt.parentNode.removeChild(alt);
  }

  function knopf(beschriftung, gefuellt) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = beschriftung;
    // Beide Knöpfe gleich groß und gleich prominent. Ein optisch schwächeres
    // „Ablehnen" ist der klassische Angriffspunkt bei Einwilligungsbannern.
    b.style.cssText = 'min-width:130px;padding:9px 20px;border-radius:4px;cursor:pointer;'
      + 'font-size:14px;font-family:inherit;border:1px solid #fff;'
      + (gefuellt ? 'background:#fff;color:#1a1a2e;' : 'background:transparent;color:#fff;');
    return b;
  }

  function zeigeBanner() {
    schliessen();

    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Einwilligung zur Reichweitenmessung');
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;'
      + 'background:#1a1a2e;color:#fff;padding:16px 24px;display:flex;align-items:center;'
      + 'gap:16px;flex-wrap:wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;';

    var text = document.createElement('span');
    text.style.cssText = 'flex:1;min-width:220px;';
    text.appendChild(document.createTextNode(
      'Wir möchten die Nutzung dieser Website statistisch auswerten (Umami, selbst '
      + 'gehostet in Deutschland, cookie-frei). Dafür wird ein Messskript geladen, das '
      + 'Seitenaufruf, Referrer, Sprache und Bildschirmgröße überträgt. Ihre Einwilligung '
      + 'ist freiwillig und jederzeit widerrufbar. Mehr dazu in unserer '
    ));
    var link = document.createElement('a');
    link.href = DS_LINK;
    link.textContent = 'Datenschutzerklärung';
    link.style.cssText = 'color:#fff;text-decoration:underline;';
    text.appendChild(link);
    text.appendChild(document.createTextNode('.'));

    var ablehnen = knopf('Ablehnen', false);
    ablehnen.addEventListener('click', function () {
      messungErlaubt = false;
      var dauerhaftSicher = speichern('declined');
      schliessen();
      // Reload nur nach verifizierter Ablehnung, Invalidierung oder Cookie-Sperre.
      if (geladen && dauerhaftSicher) location.reload();
    });

    var annehmen = knopf('Akzeptieren', true);
    annehmen.addEventListener('click', function () {
      speichern('accepted');
      // Nur ein frischer expliziter Opt-in darf die Widerrufssperre überstimmen.
      widerrufAusstehend = false;
      messungErlaubt = widerrufMarker('loeschen') === true;
      injectUmami();
      schliessen();
    });

    banner.appendChild(text);
    banner.appendChild(ablehnen);
    banner.appendChild(annehmen);
    document.body.appendChild(banner);
    ablehnen.focus();
  }

  function init() {
    // Best effort: pagehide ist nicht garantiert. Keine Zusage über Navigation,
    // wenn sowohl Storage als auch Cookies sämtliche Änderungen verweigern.
    window.addEventListener('pagehide', function () {
      if (widerrufAusstehend) speichern('declined');
    });
    // Widerruf in einem anderen Tab beendet die Messung auch hier (ab dem nächsten Ereignis).
    window.addEventListener('storage', function () {
      if (messungErlaubt && lesen() !== 'accepted') messungErlaubt = false;
    });
    var entscheidung = lesen();
    if (entscheidung === 'accepted') { messungErlaubt = true; injectUmami(); }
    else if (entscheidung === null) zeigeBanner();
    // 'declined' → nichts tun, nicht erneut fragen (bis zum Ablauf)

    // ── Widerruf: drei Wege, damit er wirklich so einfach ist wie die Erteilung ──
    // 1. Ein Link/Button mit [data-cookie-einstellungen] auf beliebiger Seite.
    document.addEventListener('click', function (e) {
      var ausloeser = e.target && e.target.closest && e.target.closest('[data-cookie-einstellungen]');
      if (ausloeser) { e.preventDefault(); zeigeBanner(); }
    });
    // 2. Der Anker `#cookie-einstellungen` — funktioniert damit als Link von JEDER
    //    Seite aus (`/datenschutz.html#cookie-einstellungen`), ohne dass 30 Footer
    //    angefasst werden müssen. Die Datenschutzerklärung ist überall verlinkt.
    if (location.hash === '#cookie-einstellungen') zeigeBanner();
    window.addEventListener('hashchange', function () {
      if (location.hash === '#cookie-einstellungen') zeigeBanner();
    });
    // 3. Für die Konsole und für Seiten, die es selbst auslösen wollen.
    window.praxuraCookieEinstellungen = zeigeBanner;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
