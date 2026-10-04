/**
 * rezept-patientenfeld.js — der Patientenkopf der Rezeptmaske (Muster 13).
 *
 * Warum es das gibt
 * ─────────────────
 * Die Verdrahtung stand in `wireM13Toggles()` in dashboard.js. Angefasst wurde
 * sie fuer Ops #267 („der Patient mit heutigem Termin gehoert nach oben"), und
 * nach dem Belagerungsprinzip (Konsey 2026-08-13) wandert Code beim Anfassen
 * heraus statt zu wachsen.
 *
 * Sie haelt nichts eigenes: die Patientenliste, die Suchregel und das Label
 * liegen weiter beim Aufrufer. Hier kommt nur der Vorschlag „heute im Haus"
 * dazu — und der ist bewusst NUR eine Sortierung. Ausgewaehlt wird weiterhin
 * von Hand; ein automatisch gesetzter Patient waere in einer Verordnung ein
 * Dokumentationsfehler, kein Komfort.
 */

import { attachPatientSearch } from '../patient-suche.js?v=20260906';
import { heuteRang, heuteHinweis } from './termin-heute.js?v=20261004m113';

/**
 * Lädt die Patientenliste (Datenquelle des Feldes). Ruft KEIN `refresh()` —
 * das muss der Aufrufer erst NACH dem Zuweisen des Caches tun, sonst liest
 * das Suchfeld synchron noch die alte (leere) Liste (Ops #302 Nachtrag zwei:
 * genau dieser Fehler ist beim ersten Wurf hier reingerutscht).
 *
 * @param {object}   cfg
 * @param {object}   cfg.supabase
 * @param {Function} cfg.bizScope
 * @param {Function} cfg.getOwnerId
 * @returns {Promise<{ownerId: string|null, leads: Array}>}
 */
export async function ladePatientenCache({ supabase, bizScope, getOwnerId }) {
  const hint = document.getElementById('rzPatientHint');
  try {
    const ownerId = getOwnerId();
    // bizScope ist Pflicht — sonst stehen im Rezept-Kopf Patienten aller
    // Standorte zur Auswahl, obwohl die Freigabe abgeschaltet sein kann.
    const { data, error } = await bizScope(supabase.from('leads')
      .select('id,first_name,last_name,title,geburtsdatum,phone,metadata,versichertennummer')
      .eq('owner_id', ownerId)
      .order('last_name', { ascending: true }), 'patients');
    if (error) throw error;
    const leads = data || [];
    if (hint) {
      if (!leads.length) {
        hint.textContent = '⚠ Keine Patienten gefunden — bitte zuerst Patienten anlegen';
        hint.style.color = '#b45309';
      } else {
        hint.textContent = `${leads.length} Patienten — tippen zum Suchen`;
        hint.style.color = '';
      }
    }
    return { ownerId, leads };
  } catch (e) {
    console.error('[ladePatientenCache]', e);
    if (hint) { hint.textContent = 'Fehler beim Laden der Patienten'; hint.style.color = '#b45309'; }
    return { ownerId: null, leads: [] };
  }
}

/**
 * @param {object}   cfg
 * @param {Function} cfg.getLeads  () => Array — bereits bizScope't
 * @param {Function} cfg.matches   (lead, q) => boolean
 * @param {Function} cfg.labelOf   (lead) => string
 * @param {Function} cfg.onSelect  (lead) => void
 */
export function verdrahteRezeptPatientenfeld(cfg) {
  const feld = document.getElementById('rzPatientSearch');
  if (!feld) return;
  attachPatientSearch(feld, {
    loadLeads: cfg.getLeads,
    matches:   cfg.matches,
    labelOf:   cfg.labelOf,
    onSelect:  cfg.onSelect,
    rank:      heuteRang,
    badgeOf:   heuteHinweis,
    separatorLabel: 'Alle Patienten',
  });
}
