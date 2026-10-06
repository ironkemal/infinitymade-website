/**
 * rechnung-anzeige.js — Zeilentext für Rechnungen an Patienten, PKV und BG (PE-006 C, Live-Test 06.10.2026 G1).
 *
 * „klein/groß" sagt dem Zahler nichts, „Komplexbehandlung" ist für 78020 ausdrücklich verboten (Ops #303: offizieller
 * Name von 78003, nicht abrechenbar). NUR Rechnungstext — Katalog-`label`, DTA und GKV-Beleg bleiben beim amtlichen Namen.
 * Eine EIGENE Leistung der Praxis gewinnt, außer ihr Titel ist noch der unveränderte Standardtext des Katalogs
 * (die Standardleistungen entstehen aus dem Katalog und wurden nie bewusst benannt).
 *
 * Zwei Wege bauen Rechnungszeilen aus Behandlungen — `module/rechnung-bruecke.js` (Knopf „Rechnung") und
 * `module/rechnung-verordnung.js` (Verordnung im Editor anhaken, der Weg, den die Praxis tatsächlich geht).
 * Beide nehmen die Texte von hier.
 */
export const PRIVAT_ANZEIGE = Object.freeze({
  '78010': 'Podologische Behandlung (Hornhaut und Nägel), Therapiezeit bis 20 Minuten',
  '78020': 'Podologische Behandlung (Hornhaut und Nägel), Therapiezeit über 20 Minuten',
});

/** Titel, mit denen die Standardleistungen aus dem Katalog angelegt werden (`GKV_LEISTUNGSKATALOG` in dashboard.js). */
export const STANDARD_KATALOGTITEL = new Set(['Podologische Behandlung (groß)', 'Podologische Behandlung (klein)']);

/** Gilt die Verordnung als Nicht-Kasse (Rechnung an Patient, PKV oder BG)? NULL/gkv/kassen = Kasse. */
export function istNichtKasse(rezeptart) {
  return ['privat', 'selbstzahler', 'bg'].includes(String(rezeptart ?? '').trim().toLowerCase());
}

/**
 * @param {string} code             HPNR
 * @param {?string} eigenerTitel    Titel der eigenen Leistung der Praxis (services.title), falls vorhanden
 * @param {?string} katalogTitel    amtlicher Katalogtitel
 */
export function rechnungsTitel(code, eigenerTitel, katalogTitel) {
  const eigen = String(eigenerTitel ?? '').trim();
  const bewusst = eigen && !STANDARD_KATALOGTITEL.has(eigen) ? eigen : null;
  return bewusst || PRIVAT_ANZEIGE[String(code)] || eigen || katalogTitel || String(code);
}
