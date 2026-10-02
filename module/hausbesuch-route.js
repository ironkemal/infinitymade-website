/**
 * hausbesuch-route.js — Hausbesuch-„Entfernung berechnen" in der Box ausblenden.
 *
 * Herkunft: KHS K2.9 / Entscheidung K-5 (01.10.2026), onprem/REGISTER.md O-11.
 * Die Entfernungsberechnung läuft über drei Supabase-Edge-Functions
 * (`fahrtenbuch-geocode`, `fahrtenbuch-route` → openrouteservice) — die Box hat
 * keine Edge-Runtime (docker-compose.yml REGEL 2: `functions` weggelassen), der
 * Knopf liefe dort in einen Fehler. Bis zur dauerhaften Lösung (Proxy nach
 * Express, O-11) wird er in der Box ENTFERNT, nicht versteckt (gleiches Muster
 * wie module/lead-suche.js): `#bkHbBerechnenBtn` hat genau einen Listener
 * (dashboard.js, invokeFahrtenbuchFn) — ohne Knopf ist der Weg tot.
 * Manuelle km-Eingabe im Fahrtenbuch bleibt unberührt.
 *
 * Läuft beim Import (ES-Module laufen nach dem Parsen des Dokuments) — so
 * braucht dashboard.js nur eine Importzeile und wächst nicht (Konsey 2026-08-13).
 */
import { IST_KUTU } from '../supabase-config.js';

export function hausbesuchRouteAusblenden(doc = globalThis.document) {
  const btn = doc?.getElementById('bkHbBerechnenBtn');
  if (!btn) return false;
  const hinweis = doc.createElement('span');
  hinweis.style.cssText = 'font-size:12px;color:var(--text-muted);';
  hinweis.textContent = 'Automatische Entfernungsberechnung ist in der Praxis-Box nicht verfügbar — der Termin wird ohne Fahrtzeit geblockt (bei Bedarf Dauer erhöhen), die Strecke bitte im Fahrtenbuch von Hand eintragen.';
  btn.replaceWith(hinweis);
  return true;
}

if (IST_KUTU) hausbesuchRouteAusblenden();
