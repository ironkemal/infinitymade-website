/**
 * design-oeffentlich.js — Neu-Design auf öffentlichen Seiten (Redesign Phase 8, nur Vorschau).
 *
 * Login, Onboarding, Buchung und Terminanfrage haben keine Anmeldung und damit keinen Mandanten für die
 * Server-Entscheidung (module/design-entscheidung.js). Deshalb gilt hier nur der lokale Vorschaumodus:
 * `data-design="neu"` wird gesetzt, wenn /api/config `designVorschau:true` liefert (nur dev_server.cjs)
 * UND der Wunsch „neu“ (?design=neu oder gespeichert) vorliegt. SaaS und Box: Feld fehlt → Alt, immer.
 * Ein öffentlicher Schalter für den Livebetrieb ist bewusst nicht gebaut (offene Produktentscheidung).
 */
import { DESIGN_VORSCHAU } from '../supabase-config.js';

/** Rein, testbar: Wunsch aus Query/Speicher, jeder Zugriffsfehler = kein Wunsch. */
export function leseWunsch(suche = '', speicher = null) {
  let d = null;
  try { d = new URLSearchParams(suche).get('design'); } catch { d = null; }
  if (d === 'alt' || d === 'neu') return d;
  try { return speicher?.getItem('px-design') === 'neu' ? 'neu' : null; } catch { return null; }
}

export function wendeAn({ vorschau = DESIGN_VORSCHAU, suche = globalThis.location?.search, speicher = globalThis.localStorage, wurzel = globalThis.document?.documentElement } = {}) {
  const neu = vorschau === true && leseWunsch(suche, (() => { try { return speicher; } catch { return null; } })()) === 'neu';
  if (wurzel) { if (neu) wurzel.setAttribute('data-design', 'neu'); else wurzel.removeAttribute('data-design'); }
  return neu ? 'neu' : 'alt';
}

if (globalThis.document) wendeAn();
