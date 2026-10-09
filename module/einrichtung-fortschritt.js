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
import { brandingAus, brandingLuecken } from './branding.js?v=20261009k15';

const GEWICHT = { pflicht: 2, soll: 1 };
const PFLICHT_ANZAHL = 5;
const SOLL_ANZAHL = 3;
const GESAMT = PFLICHT_ANZAHL * GEWICHT.pflicht + SOLL_ANZAHL * GEWICHT.soll;

/**
 * @param {?object} profil  Profilzeile der PRAXIS (`ownerProfile || currentProfile`)
 * @returns {{prozent:number, erfuellt:number, gesamt:number,
 *            fehlend:Array<{schluessel:string,label:string,zielAnsicht:string,stufe:'pflicht'|'soll'}>}}
 */
export function einrichtungFortschritt(profil) {
  const l = brandingLuecken(brandingAus(profil));
  const fehlend = [
    ...l.pflicht.map((x) => ({ schluessel: x.schluessel, label: x.label, zielAnsicht: x.ziel, stufe: 'pflicht' })),
    ...l.soll.map((x) => ({ schluessel: x.schluessel, label: x.label, zielAnsicht: x.ziel, stufe: 'soll' })),
  ];
  const fehlGewicht = fehlend.reduce((s, x) => s + GEWICHT[x.stufe], 0);
  const erfuellt = GESAMT - fehlGewicht;
  let prozent = Math.round((erfuellt / GESAMT) * 100);
  if (fehlend.length && prozent >= 100) prozent = 99;   // nie 100 %, solange etwas fehlt
  return { prozent, erfuellt, gesamt: GESAMT, fehlend };
}

/** SVG-Ring: Umfang und Versatz (stroke-dasharray/-dashoffset) für `prozent`. */
export function ringStrich(prozent, radius) {
  const p = Math.min(100, Math.max(0, Number(prozent) || 0));
  const umfang = 2 * Math.PI * radius;
  return { umfang, versatz: umfang * (1 - p / 100) };
}
