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
import { heuteRang, heuteHinweis } from './termin-heute.js?v=20260906';

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
