/**
 * einrichtung-fortschritt.js — „Einrichtung X % abgeschlossen" (KHS M2.6, K-9).
 *
 * Ein Ansporn, nie eine Sperre: der Ring zeigt, was für vollständige Rechnungen noch fehlt,
 * und springt beim Klick zur passenden Einstellung. Maßstab ist derselbe wie auf der
 * Branding-Seite (`module/branding.js` → `brandingLuecken`, legal-de F7 05.10.2026):
 * Pflicht (§ 14 UStG) zählt doppelt, empfohlene Angaben einfach. Logo, Stempel und Fußzeile
 * sind Optik und zählen nicht.
 *
 * Bewusst NICHT im Ring (nachgesehen, nicht geraten):
 *  - „Annahmestelle": hängt am Kostenträger, nicht an der Praxis — es gibt keine Praxis-Einstellung.
 *  - „Mitarbeiter": eine Einzelpraxis ohne Team ist vollständig eingerichtet.
 *
 * Reine Funktionen; die Zeichnung steht in `einrichtung-ring.js`.
 */
import { brandingAus, brandingLuecken } from './branding.js?v=20261022q';

const GEWICHT = { pflicht: 2, soll: 1 };
const PFLICHT_ANZAHL = 5;
const SOLL_ANZAHL = 3;
const GESAMT = PFLICHT_ANZAHL * GEWICHT.pflicht + SOLL_ANZAHL * GEWICHT.soll;

/**
 * @param {?object} profil  Profilzeile der PRAXIS (`ownerProfile || currentProfile`)
 * @returns {{prozent:number, erfuellt:number, gesamt:number, fehlend:Aufgabe[], erledigt:Aufgabe[]}}
 *   Aufgabe = {schluessel, label, zielAnsicht, feld, stufe:'pflicht'|'soll', punkte}
 *   `punkte` = so viele Prozent bringt die Aufgabe (Aufgabenliste wie im Spiel).
 */
export function einrichtungFortschritt(profil) {
  const aufgaben = (l) => [
    ...l.pflicht.map((x) => aufgabe(x, 'pflicht')),
    ...l.soll.map((x) => aufgabe(x, 'soll')),
  ];
  const fehlend = aufgaben(brandingLuecken(brandingAus(profil)));
  const offen = new Set(fehlend.map((x) => x.schluessel));
  // Alle Aufgaben = die Lücken eines leeren Profils; erledigt ist, was davon nicht mehr fehlt.
  const erledigt = aufgaben(brandingLuecken(brandingAus({}))).filter((x) => !offen.has(x.schluessel));
  const fehlGewicht = fehlend.reduce((s, x) => s + GEWICHT[x.stufe], 0);
  const erfuellt = GESAMT - fehlGewicht;
  let prozent = Math.round((erfuellt / GESAMT) * 100);
  if (fehlend.length && prozent >= 100) prozent = 99;   // nie 100 %, solange etwas fehlt
  return { prozent, erfuellt, gesamt: GESAMT, fehlend, erledigt };
}

function aufgabe(x, stufe) {
  return { schluessel: x.schluessel, label: x.label, zielAnsicht: x.ziel, feld: x.feld || '', stufe,
    punkte: Math.round((GEWICHT[stufe] / GESAMT) * 100) };
}

/** SVG-Ring: Umfang und Versatz (stroke-dasharray/-dashoffset) für `prozent`. */
export function ringStrich(prozent, radius) {
  const p = Math.min(100, Math.max(0, Number(prozent) || 0));
  const umfang = 2 * Math.PI * radius;
  return { umfang, versatz: umfang * (1 - p / 100) };
}
