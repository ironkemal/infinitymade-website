/**
 * podo-behandlungen-oeffnen.js — Sprung in die Behandlungsdokumentation der
 * Podologie: vom Termin aus die Tagesbehandlung des Patienten öffnen.
 *
 * Herkunft: bis 29.09.2026 lag `oeffnePodoBehandlungen(leadId)` in
 * `dashboard.js` und wurde nur vom Knopf "Leistungen des Tages" im
 * Einheitenblock gerufen. Reform-Sprint S1.4 gibt ihr einen zweiten Aufrufer:
 * `handleTerminStarten()` — "Termin starten" auf einem podologischen Termin
 * lief bis dahin den Physio-Weg (`markPrescriptionSession`, ein leeres
 * Sitzungsbuch, Notiz-Dialog, Namenssuche über `customer_name.split('·')`,
 * Sprung nach Anamnese/Notizen). Für Podologie ist das falsch: es gibt kein
 * Sitzungsbuch (`module/podo-einheiten.js`, "KEINE Zeilen in
 * prescription_sessions"), und der richtige Zielort ist immer dieselbe
 * Tagesbehandlung.
 *
 * Zwei Einstiege, EIN Weg: der Knopf "Leistungen des Tages" im Einheitenblock
 * und jetzt "Termin starten" auf einem podologischen Termin. Bewusst KEINE
 * zweite Maske: dort haengen die Pruefungen, die Geld kosten, wenn man sie
 * umgeht (78040 nicht neben 78030, 78100 einmal je Kalenderjahr,
 * Behandlungsbeginn innerhalb der Frist).
 *
 * Abhängigkeiten werden injiziert (gleiches Muster wie
 * `zeichnePodoEinheiten({ sb, ownerId, ... })` in `module/podo-einheiten.js`) —
 * so bleibt die Datei ohne DOM/Supabase-Mock testbar.
 */

import { alsBerlinDatum } from './berlin-datum.js';

/**
 * Podo oder Fizyo? `bookings.verordnung_id` wird ausschliesslich von
 * `bindeTermin()` (`module/verordnung-termine.js`) geschrieben und NUR für
 * podologische Verordnungen benutzt — ist sie gesetzt, ist der Termin sicher
 * podologisch, unabhängig vom aktuell aktiven Fachbereich-Tab. Ist sie leer
 * (z. B. Termin noch nicht zugeordnet), entscheidet der Fachbereich: in
 * `podologie` UND mit einem Patienten (`lead_id`) verhält sich der Termin
 * trotzdem podologisch — sonst bleibt es (unverändert) der Physio-Weg.
 *
 * @param {{verordnung_id?:string|null, lead_id?:string|null}} booking
 * @param {string} sector  `getSector()` aus dashboard.js
 * @returns {boolean}
 */
export function terminIstPodo(booking, sector) {
  if (booking?.verordnung_id) return true;
  return sector === 'podologie' && !!booking?.lead_id;
}

/**
 * Der Kalendertag eines Termins, Europe/Berlin, ohne die UTC-Verschiebung von
 * `toISOString()`. Gleiches Idiom wie `heute()`/`tag()` in
 * `module/podo-einheiten.js` und `module/podo-geplant.js` — bewusst nicht neu
 * geschrieben, nur auf `booking.start_time` angewandt.
 *
 * @param {{start_time?:string|null} | null | undefined} [booking]
 * @returns {string|undefined} `YYYY-MM-DD`, oder `undefined` ohne `start_time`
 */
export function terminDatum(booking) {
  if (!booking?.start_time) return undefined;
  return alsBerlinDatum(booking.start_time) || undefined;
}

/**
 * Liegt der Termin-Tag nach heute (Berlin)? Reiner String-Vergleich — beide
 * Seiten sind `YYYY-MM-DD`, das sortiert lexikografisch wie chronologisch.
 *
 * @param {string|undefined} datum  s. `terminDatum()`
 * @param {string} heute            `YYYY-MM-DD`, Europe/Berlin
 * @returns {boolean}
 */
export function terminInZukunft(datum, heute) {
  return !!datum && !!heute && datum > heute;
}

/**
 * @typedef {Object} PodoOeffnenOptionen
 * @property {string} [vordId]
 * @property {string} [datum]
 * @property {boolean} [mehrdeutigFragen]
 * @property {string} [bookingId]
 */

/**
 * @typedef {Object} PodoOeffnenDeps
 * @property {{ from: (table: string) => any }} [sb]
 * @property {string} [ownerId]
 * @property {(msg: string, typ?: string) => void} [showToast]
 * @property {() => void} [closeBkActionPanel]
 * @property {(id: string | null, vorwahl: any) => void} [setPodVorwahl]
 * @property {(panel: string) => Promise<any> | any} [switchPanel]
 * @property {(opts: any) => Promise<boolean>} [showConfirmModal]
 */

/**
 * Sprung in die Behandlungsdokumentation der Podologie.
 *
 * @param {string|null} leadId
 * @param {PodoOeffnenOptionen} [opt]
 * @param {PodoOeffnenDeps} [deps]
 */
export async function oeffnePodoBehandlungen(leadId, opt = {}, deps = {}) {
  const { vordId, datum, mehrdeutigFragen, bookingId } = opt;
  // S3.13: Hausbesuch — Buchungs-ID mitgeben, damit die Tagesbehandlung die Fahrt beenden kann.
  // Ohne bookingId bleibt der Aufruf byteweise wie vorher.
  const vorwahl = bookingId ? { datum, bookingId } : { datum };
  const { sb, ownerId, showToast = () => {}, closeBkActionPanel = () => {}, setPodVorwahl = () => {}, switchPanel = () => {} } = deps;

  if (!leadId) { showToast('Kein Patient zu dieser Verordnung gefunden.', 'warning'); return; }

  if (vordId) {
    closeBkActionPanel();
    setPodVorwahl(vordId, vorwahl);
    await switchPanel('podologie-billing');
    return;
  }

  // aktiv→NULL, abrechenbar→bereit (verordnung-topf.js). `.or()` statt
  // `.in()`: `aktiv` ist in der Spalte NULL, `.in()` trifft NULL nicht.
  // `limit(2)` nur wenn Mehrdeutigkeit erkannt werden soll — ein zweiter
  // Treffer reicht, um "mehr als eine" festzustellen, ohne alle zu laden.
  if (!sb) return;
  const { data: vords } = await sb.from('prescriptions')
    .select('id, abrechnung_status, ausstellungsdatum')
    .eq('owner_id', ownerId).eq('patient_id', leadId)
    .eq('therapie_bereich', 'podo')
    .or('abrechnung_status.is.null,abrechnung_status.eq.bereit')
    .order('ausstellungsdatum', { ascending: false }).limit(mehrdeutigFragen ? 2 : 1);
  if (!vords?.length) {
    showToast('Für diesen Patienten ist keine laufende Podologie-Verordnung angelegt.', 'warning');
    return;
  }
  if (mehrdeutigFragen && vords.length >= 2) {
    closeBkActionPanel();
    setPodVorwahl(null, vorwahl);
    showToast('Mehrere laufende Verordnungen — bitte die richtige auswählen.', 'info');
    await switchPanel('podologie-billing');
    return;
  }
  closeBkActionPanel();
  setPodVorwahl(vords[0].id, vorwahl);
  await switchPanel('podologie-billing');
}

/**
 * "Termin starten" auf einem podologischen Termin: kein Sitzungsbuch, keine
 * Notiz-Abfrage, keine Namenssuche — direkt die Tagesbehandlung, mit der
 * Verordnung und dem Datum, die der Termin schon kennt.
 *
 * Zwei Sicherheitsfragen, die NUR diesen Weg betreffen (Knopf "Leistungen des
 * Tages" bleibt unverändert, der ruft `oeffnePodoBehandlungen()` direkt):
 *  1. Liegt der Termin in der Zukunft? Ohne Rückfrage würde die Tagesbehandlung
 *     mit einem Datum geöffnet, das die Kasse ablehnt (S:01005/S:01006,
 *     `podologie-abrechnung.js`) — wer trotzdem heute behandelt (Termin
 *     vorgezogen, aber noch nicht verschoben), bestätigt das ausdrücklich.
 *  2. Mehr als eine laufende Verordnung, aber der Termin trägt noch keine
 *     `verordnung_id`? Automatisch die falsche zu erwischen kostet eine
 *     Behandlung auf dem falschen Rezept — deshalb `mehrdeutigFragen: true`
 *     (nur hier, s. `oeffnePodoBehandlungen`).
 *
 * @param {{id?: string, lead_id?:string|null, verordnung_id?:string|null, start_time?:string|null, hausbesuch?: boolean} | null | undefined} booking
 * @param {PodoOeffnenDeps} deps
 */
export async function terminStartenPodo(booking, deps) {
  let datum = terminDatum(booking);
  const heute = alsBerlinDatum(new Date());

  if (terminInZukunft(datum, heute) && datum) {
    const [j, m, t] = datum.split('-');
    const ok = await deps.showConfirmModal?.({
      title: 'Termin liegt in der Zukunft',
      message: 'Der Termin ist am ' + t + '.' + m + '.' + j + '. Trotzdem heute behandeln?',
      confirmText: 'Heute behandeln',
      cancelText: 'Abbrechen',
    });
    if (!ok) return;
    datum = heute;
  }

  // Schon dokumentiert? Vorher öffnete „Termin starten" dieselbe Tagesdoku
  // ohne Hinweis ein zweites Mal — und lud zur Doppelerfassung ein (canli-test
  // 20.10.2026). Jetzt: sagen, dass es sie gibt; geöffnet wird trotzdem
  // derselbe Tag (dort steht die vorhandene Behandlung zum Ansehen/Stornieren).
  if (booking?.verordnung_id && deps.sb && datum) {
    const { data: schon } = await deps.sb.from('podologie_behandlungen').select('id')
      .eq('owner_id', deps.ownerId).eq('verordnung_id', booking.verordnung_id)
      .eq('behandlungsdatum', datum).is('storniert_am', null).limit(1);
    if (schon?.length) {
      const ok = await deps.showConfirmModal?.({
        title: 'Heute schon dokumentiert',
        message: 'Für diese Verordnung ist am ' + datum.split('-').reverse().join('.') + ' bereits eine Behandlung dokumentiert. '
          + 'Die Tagesdokumentation öffnen, um sie anzusehen oder zu korrigieren?',
        confirmText: 'Dokumentation öffnen',
        cancelText: 'Abbrechen',
      });
      if (!ok) return;
    }
  }

  return oeffnePodoBehandlungen(
    booking?.lead_id || null,
    { vordId: booking?.verordnung_id || undefined, datum, mehrdeutigFragen: true,
      bookingId: booking?.hausbesuch ? booking.id : undefined },
    deps,
  );
}
