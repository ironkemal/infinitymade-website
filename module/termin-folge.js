/**
 * termin-folge.js — „Folgetermin" im Seitenbereich (Termin-Aktionen).
 *
 * Warum es das gibt
 * ─────────────────
 * Der Knopf „Folgetermin buchen" war am 31.08.2026 entfallen: er öffnete die
 * Terminmaske eine Woche später, und was er sonst noch tat, stand nirgends.
 * Konsey 30.09.2026 (Podologie-Reform S0/S4): die Podologin bucht am Ende der
 * Behandlung den nächsten Termin — es ist ihr häufigster Schritt nach dem
 * Behandeln, also gehört er zurück, diesmal mit einem eindeutigen Vertrag:
 *
 *   dieselbe Patientin · dieselben Leistungen · dieselbe Verordnung ·
 *   Datum aus der Frequenz der Verordnung, Uhrzeit wie beim Ausgangstermin.
 *
 * Es entsteht KEIN neuer Schreibweg. Das Modul füllt die vorhandene
 * Terminmaske (`#bookingModal`, „Neuer Termin") vor; gespeichert wird dort, mit
 * allen Prüfungen (Frequenz, Beginnfrist, Überschneidung).
 *
 * Bewusst NICHT übernommen: die Eingangsbefundung 78040. Sie ist einmalig
 * (eingangsbefundung-regel.js) — sie in den Folgetermin zu kopieren hiesse,
 * beim Speichern eine zweite 78040 anzulegen. Die Maske bietet die Befundung
 * selbst als Vorschlag an (`schlageBefundungVor`).
 *
 * Oben steht die Rechnung ohne DOM (testbar), unten die Verdrahtung.
 */

import { alsDatetimeLocal } from './datum.js?v=20261001a';
import { sollAbstand } from './frequenz-pruefung.js?v=20260929b';
import { parseNameMitGeburt } from './termin-patient-bezug.js?v=20260817';
import { POD_EINGANGSBEFUNDUNG } from './eingangsbefundung-regel.js?v=20261003a';
import { hpnrVonDienst, setzeLeistungen, schlageBefundungVor } from './termin-leistungen.js?v=20261003a';

/** Ohne lesbare Frequenz: eine Woche — die Zeile, die die Serienplanung auch nimmt. */
export const STANDARD_ABSTAND_TAGE = 7;



/**
 * Früheste sinnvolle Startzeit des Folgetermins.
 *
 * Abstand = untere Grenze der Verordnungsfrequenz („alle 4–6 Wochen" → 28 Tage,
 * „2x pro Woche" → 4 Tage); ohne lesbare Frequenz eine Woche. Uhrzeit wie beim
 * Ausgangstermin. Liegt das Ergebnis nicht in der Zukunft (alter Ausgangstermin),
 * gilt morgen zur selben Uhrzeit — die Maske sperrt Vergangenes ohnehin.
 *
 * @param {string|Date} startZeit  Beginn des Ausgangstermins
 * @param {?string} frequenz       `prescriptions.frequenz`
 * @param {Date} [jetzt]
 * @returns {{start:string, abstandTage:number, ausFrequenz:boolean}}
 */
export function folgeterminStart(startZeit, frequenz, jetzt = new Date()) {
  const basis = new Date(startZeit);
  const soll = sollAbstand(frequenz);
  const abstandTage = soll ? Math.max(1, Math.round(soll.min)) : STANDARD_ABSTAND_TAGE;
  const ziel = new Date(basis.getFullYear(), basis.getMonth(), basis.getDate() + abstandTage,
    basis.getHours(), basis.getMinutes());
  if (ziel.getTime() <= jetzt.getTime()) {
    ziel.setTime(new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1,
      basis.getHours(), basis.getMinutes()).getTime());
  }
  return { start: alsDatetimeLocal(ziel), abstandTage, ausFrequenz: !!soll };
}

/**
 * Die Leistungen des Folgetermins: die des Ausgangstermins ohne die
 * Eingangsbefundung (einmalig).
 *
 * @param {Array<{service_id:string, anzahl:number}>} zeilen  booking_leistungen, sortiert
 * @param {?string} hauptServiceId  bookings.service_id — Rückfall ohne Zeilen
 * @param {Array} dienste           Leistungskatalog
 * @returns {{serviceIds:string[], menge:number}}
 */
export function folgeLeistungen(zeilen, hauptServiceId, dienste) {
  const alle = (zeilen || []).filter(z => z && z.service_id);
  const dienstVon = (id) => (dienste || []).find(d => d && d.id === id);
  const ohneErst = alle.filter(z => hpnrVonDienst(dienstVon(z.service_id)) !== POD_EINGANGSBEFUNDUNG);
  if (!ohneErst.length) {
    // Nur Eingangsbefundung (oder gar nichts): die Hauptleistung des Termins,
    // sofern sie nicht selbst die Eingangsbefundung ist.
    const haupt = hauptServiceId && hpnrVonDienst(dienstVon(hauptServiceId)) !== POD_EINGANGSBEFUNDUNG
      ? hauptServiceId : null;
    return { serviceIds: haupt ? [haupt] : [], menge: 1 };
  }
  return {
    serviceIds: ohneErst.map(z => z.service_id),
    menge: Math.max(1, Number.parseInt(ohneErst[0].anzahl, 10) || 1),
  };
}

// ── Die Maske ──────────────────────────────────────────────────────────────

/**
 * Öffnet die Terminmaske als neuen Termin, vorbelegt aus `booking`.
 *
 * @param {object} booking  Ausgangstermin (Zeile aus `bookings`, mit lead_id)
 * @param {object} deps     Zugriff auf dashboard.js — nichts wird importiert, was
 *   dort schon geladen ist (ein Modul unter einer URL, siehe import-versionen.test.js)
 * @param {object} deps.supabase
 * @param {function} deps.ownerId                    () => id
 * @param {function} deps.prefillBookingModal        (startStr|null) => Promise
 * @param {function} deps.populateSrvSelect          (selectedId) => Promise
 * @param {function} deps.updateBkDuration           (srvId) => Promise
 * @param {function} deps.selectVerordnung           (rx, sessions) => Promise
 * @param {function} deps.zeigeVerordnungenFuerTermin
 * @param {function} deps.rendereVeroKarten
 * @param {function} deps.resetVerordnungFelder
 * @param {function} deps.oeffneAnlegenWahl          (leadId)
 * @param {function} deps.closeModal
 * @param {function} deps.escapeHtml
 * @param {function} deps.getServices                () => Leistungskatalog
 * @param {function} [deps.toast]
 * @returns {Promise<boolean>} true, wenn die Maske offen ist
 */
export async function oeffneFolgetermin(booking, deps) {
  const { supabase, toast } = deps;
  // Ohne `id` (Platzhalter aus der Tagesbehandlung, module/podo-tag-zusatz.js): nur Patient +
  // Verordnung sind bekannt, Leistungen gibt es dann nicht zu lesen.
  if (!booking?.id && !booking?.lead_id) { toast?.('Kein Termin ausgewählt.', 'warning'); return false; }
  if (!booking.lead_id) {
    toast?.('Für diesen Termin gibt es keine Patientenakte — Folgetermin nicht möglich.', 'warning');
    return false;
  }

  // Verordnung und Leistungen des Ausgangstermins holen, BEVOR die Maske
  // aufgeht: die Frequenz bestimmt das Datum.
  const [{ data: leistungen }, { data: rx }] = await Promise.all([
    booking.id
      ? supabase.from('booking_leistungen')
        .select('service_id, anzahl, sort_order').eq('booking_id', booking.id)
        .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    booking.verordnung_id
      ? supabase.from('prescriptions')
        .select('id,heilmittel,heilmittel_position,icd10,anzahl_einheiten,ausstellungsdatum,status,diagnosegruppe,gueltig_bis,is_dringend,frequenz,prescription_sessions(id,session_number,status,booking_id),therapie_bereich')
        .eq('id', booking.verordnung_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { start, abstandTage, ausFrequenz } = folgeterminStart(booking.start_time, rx?.frequenz);
  const { serviceIds, menge } = folgeLeistungen(leistungen, booking.service_id, deps.getServices?.());
  const hauptId = serviceIds[0] || booking.service_id || null;

  await deps.prefillBookingModal(start);

  // Patientin: dieselben drei Felder wie beim Ziehen einer Einheit auf den Kalender.
  const name = parseNameMitGeburt(booking.customer_name).name || '';
  const setze = (id, wert) => { const el = document.getElementById(id); if (el) el.value = wert; };
  setze('bkCustomerSearch', booking.customer_name || name);
  setze('bkCustomer', name);
  setze('bkCustomerId', booking.lead_id);
  setze('bkPhone', booking.customer_phone || '');
  const hb = document.getElementById('bkHausbesuch');
  if (hb) hb.checked = !!booking.hausbesuch;

  // Verordnung: die vorhandene Auswahl-Logik (Karten + Sitzungspunkte). Danach
  // `_bkUrspruenglicheVordId` leeren — das ist die Bindung eines BESTEHENDEN
  // Termins, ein neuer Termin hat noch keine.
  await deps.zeigeVerordnungenFuerTermin(supabase, {
    leadId: booking.lead_id, bookingId: null, bekannteVerordnungId: booking.verordnung_id || null,
  }, {
    veroSection: document.getElementById('bkVerordnungSection'),
    veroCards: document.getElementById('bkVeroCards'),
    escapeHtml: deps.escapeHtml,
    rendereVeroKarten: deps.rendereVeroKarten,
    onSelect: deps.selectVerordnung,
    onAnlegen: () => { deps.closeModal('bookingModal'); deps.oeffneAnlegenWahl(booking.lead_id); },
    resetFelder: deps.resetVerordnungFelder,
    ownerId: deps.ownerId(),
  });
  window._bkUrspruenglicheVordId = null;

  // Leistungen NACH der Verordnung: deren Auswahl setzt die Leistung aus dem
  // Heilmittel, hier gilt aber, was der Ausgangstermin hatte.
  if (hauptId) {
    await deps.populateSrvSelect(hauptId);
    const sel = document.getElementById('bkService');
    if (sel) sel.value = hauptId;
    await deps.updateBkDuration(hauptId);
  }
  const menge0 = document.getElementById('bkMenge');
  if (menge0) menge0.value = String(menge);
  setzeLeistungen(serviceIds.length ? serviceIds : [hauptId]);
  // canli-test P2 30.09: der Befundungsvorschlag (78030, unangekreuzt) kam erst nach erneutem
  // Kartenklick — nach dem Setzen der Leistungen einmal anstossen (wie termin-leistungen.js selbst, mit Verzug).
  setTimeout(() => { schlageBefundungVor(); }, 80);

  toast?.(ausFrequenz
    ? `Folgetermin vorbelegt: ${abstandTage} Tage nach dem letzten Termin (Frequenz der Verordnung) — bitte prüfen und speichern.`
    : 'Folgetermin vorbelegt (Frequenz der Verordnung nicht erkannt: eine Woche) — bitte prüfen und speichern.', 'info');
  return true;
}
