/**
 * standort-zuschnitt.js — Welche Verordnungen zeigt die Podologie-Liste?
 *
 * Warum eigenes Modul
 * ───────────────────
 * Die Regel entscheidet, ob eine Verordnung sichtbar ist. Faellt eine heraus,
 * zeigt sie ihre 28/14-Tage-Frist nicht mehr an und verbrennt still. Solche
 * Regeln gehoeren neben einen Test und nicht in eine 1300-Zeilen-Bildschirm-
 * datei, die sich ohne Browser nicht laden laesst.
 *
 * Warum nicht `bizScope`
 * ──────────────────────
 * `bizScope(query, cat)` in `dashboard.js` filtert auf die Spalte
 * `business_id`. **`verordnungen` hat diese Spalte nicht** —
 * `podologie_behandlungen`, `prescription_sessions` und `pat_fussbefund`
 * ebenso wenig; der Physio-Topf `prescriptions` hat sie. `bizScope` hier
 * anzuwenden haette die Abfrage scheitern lassen und die Liste waere leer
 * geblieben. Der Standort ist in der Podologie nur ueber den Patienten
 * erreichbar: `verordnungen.lead_id` → `leads.business_id`.
 *
 * Warum praxisweit die Vorgabe ist (Konsey 2026-08-28)
 * ────────────────────────────────────────────────────
 * Eine Verordnung gehoert der Praxis, nicht der Filiale: Muster 13 kennt kein
 * Standortfeld, und die IK gegenueber der Kasse ist die der Praxis. Der
 * Standort haengt an der einzelnen *Behandlung*, nicht an der Verordnung.
 * Es wird deshalb NICHT gefiltert, solange der Inhaber nichts anderes
 * verlangt — das ist eine Entscheidung, kein vergessener Filter.
 *
 * Gefiltert wird erst, wenn der Inhaber in `data_sharing_settings` fuer die
 * Kategorie `patients` („Patientenliste, Notizen, Anamnese, **Rezepte**,
 * Ueberweisungen, Warteliste") ausdruecklich „getrennt" gewaehlt hat UND mehr
 * als ein Standort existiert.
 *
 * Was NIE verschwindet
 * ────────────────────
 * Zeilen ohne Patientenakte (`lead_id` NULL — heute drei, alles Privat/BG) und
 * Zeilen, deren Patient keine `business_id` traegt, bleiben in JEDEM Standort
 * sichtbar. Dieselbe Fehlerklasse hat am 12.08.2026 schon einmal zugeschlagen
 * („Podologie Nord"): ein hartes `.eq('business_id', …)` blendete alle
 * NULL-Zeilen aus. Zu viel zu zeigen kostet Aufmerksamkeit, zu wenig zu zeigen
 * kostet Geld — deshalb ist die Regel bewusst unsymmetrisch.
 */

'use strict';

/**
 * Traegt diese Verordnung keine Standortzuordnung?
 * Solche Zeilen stehen in jeder Filiale und bekommen die Marke „Praxisweit".
 * @param {{ lead_id?: string|null, leads?: { business_id?: string|null }|null }} v
 * @returns {boolean}
 */
export function istPraxisweit(v) {
  return !v?.lead_id || v?.leads?.business_id == null;
}

/**
 * @param {any[]} zeilen Verordnungen inkl. eingebettetem `leads.business_id`.
 * @param {string|null|undefined} aktiverStandort
 *        Id, wenn getrennt werden soll; `null` bei Einzelpraxis oder wenn der
 *        Inhaber `patients` auf „gemeinsam" stehen hat.
 * @returns {{ zeilen: any[], zeigeHerkunft: boolean }}
 *          `zeigeHerkunft` steuert nur die Marke in der Liste — bei einer
 *          Einzelpraxis waere sie sinnloses Rauschen.
 */
export function standortZuschnitt(zeilen, aktiverStandort) {
  const liste = Array.isArray(zeilen) ? zeilen : [];
  if (!aktiverStandort) return { zeilen: liste, zeigeHerkunft: false };
  return {
    zeilen: liste.filter(v => istPraxisweit(v) || v.leads.business_id === aktiverStandort),
    zeigeHerkunft: true,
  };
}
