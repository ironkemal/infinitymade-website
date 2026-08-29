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
  var DS_LINK = '/datenschutz.html#reichweitenmessung';
  var geladen = false;

  function injectUmami() {
    if (geladen) return;              // doppeltes Einhängen verhindern
    geladen = true;
    var s = document.createElement('script');
    s.defer = true;
    s.src = SRC;
    s.setAttribute('data-website-id', WEBSITE_ID);
    document.head.appendChild(s);
  }

  // localStorage kann werfen (privater Modus, blockierte Website-Daten).
  // Im Zweifel gilt: keine Entscheidung, also keine Messung.
  function lesen() {
    try {
      var wert = localStorage.getItem(KEY);
      if (wert !== 'accepted' && wert !== 'declined') return null;
      var ts = parseInt(localStorage.getItem(ZEIT_KEY) || '0', 10);
      if (!ts) return null;                                   // Altbestand → neu fragen
      if (Date.now() - ts > GUELTIG_TAGE * 86400000) return null;  // abgelaufen → neu fragen
      return wert;
    } catch (_) {
      return null;
    }
  }

  function speichern(wert) {
    try {
      localStorage.setItem(KEY, wert);
      localStorage.setItem(ZEIT_KEY, String(Date.now()));
    } catch (_) { /* privater Modus: Entscheidung gilt nur für diese Sitzung */ }
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
      speichern('declined');
      schliessen();
    });

    var annehmen = knopf('Akzeptieren', true);
    annehmen.addEventListener('click', function () {
      speichern('accepted');
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
    var entscheidung = lesen();
    if (entscheidung === 'accepted') injectUmami();
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
