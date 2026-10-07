/**
 * hausbesuch-route.js — Hausbesuch in der Box: „Route öffnen" statt „Entfernung berechnen".
 *
 * Herkunft: KHS K2.9 / Entscheidung K-5 (01.10.2026), onprem/REGISTER.md O-11.
 * Die Entfernungsberechnung läuft über drei Supabase-Edge-Functions
 * (`fahrtenbuch-geocode`, `fahrtenbuch-route` → openrouteservice) — die Box hat
 * keine Edge-Runtime (docker-compose.yml REGEL 2: `functions` weggelassen), der
 * Knopf liefe dort in einen Fehler. Bis zur dauerhaften Lösung (§3b.3: ORS mit
 * dem eigenen Schlüssel der Praxis) wird er in der Box ENTFERNT, nicht versteckt
 * (gleiches Muster wie module/lead-suche.js): `#bkHbBerechnenBtn` hat genau
 * einen Listener (dashboard.js, invokeFahrtenbuchFn) — ohne Knopf ist der Weg tot.
 *
 * 07.10.2026 (K2b.15, K-19 c): an seine Stelle tritt „Route öffnen" — ein Link
 * zur Kartenansicht mit der Patientenadresse als Ziel, ohne API, ohne Start
 * (das Gerät nimmt seinen Standort). Die Adresse verlässt die Box nicht: erst
 * der Klick im Browser des Nutzers öffnet die Karte. km bleibt Handeintrag im
 * Fahrtenbuch.
 *
 * Läuft beim Import (ES-Module laufen nach dem Parsen des Dokuments) — so
 * braucht dashboard.js nur eine Importzeile und wächst nicht (Konsey 2026-08-13).
 */
import { IST_KUTU } from '../supabase-config.js';

const KEIN_PATIENT = '— Patient auswählen —';

/** Zieladresse wie refreshBkHausbesuchPanel() sie zeigt: Anzeige oder Eingabefelder. */
export function hausbesuchZiel(doc = globalThis.document) {
  const ansicht = doc?.getElementById('bkHbAddrView');
  const text = (doc?.getElementById('bkHbAddressText')?.textContent || '').trim();
  if (ansicht && !ansicht.hidden && text && text !== KEIN_PATIENT) return text;
  const wert = id => (doc?.getElementById(id)?.value || '').trim();
  const ort = [wert('bkHbPlz'), wert('bkHbCity')].filter(Boolean).join(' ');
  return [wert('bkHbStreet'), ort].filter(Boolean).join(', ');
}

export function routeLink(ziel) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ziel)}`;
}

export function hausbesuchRouteAusblenden(doc = globalThis.document) {
  const btn = doc?.getElementById('bkHbBerechnenBtn');
  if (!btn) return false;
  const knopf = doc.createElement('button');
  knopf.type = 'button';
  knopf.className = 'btn-ghost';
  knopf.id = 'bkHbRouteBtn';
  knopf.style.cssText = 'font-size:13px;padding:6px 14px;';
  knopf.textContent = 'Route öffnen';
  knopf.addEventListener('click', () => {
    const ziel = hausbesuchZiel(doc);
    fehler.textContent = ziel ? '' : 'Bitte zuerst eine Adresse eintragen.';
    if (!ziel) return;
    globalThis.open?.(routeLink(ziel), '_blank', 'noopener');
  });
  const hinweis = doc.createElement('div');
  hinweis.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:6px;';
  hinweis.textContent = 'Automatische Entfernungsberechnung ist in der Praxis-Box nicht verfügbar — der Termin wird ohne Fahrtzeit geblockt (bei Bedarf Dauer erhöhen), die Strecke bitte im Fahrtenbuch von Hand eintragen.';
  const fehler = doc.createElement('div');
  fehler.style.cssText = 'font-size:12px;color:var(--danger,#c00);margin-top:6px;';
  btn.replaceWith(knopf);
  knopf.after(hinweis);
  hinweis.after(fehler);
  return true;
}

if (IST_KUTU) hausbesuchRouteAusblenden();
