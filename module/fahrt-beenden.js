/**
 * fahrt-beenden.js — Hausbesuch: die Fahrt auch aus der Tagesbehandlung heraus
 * beenden (Reform-Sprint S3.13, 29.09.2026).
 *
 * Problem: "Termin starten" auf einem Hausbesuch setzt die Fahrt auf
 * `fahrt_return_pending` (der DB-CHECK kennt kein `in_progress`) und springt in die Tagesbehandlung (S1.4). Von dort gab es
 * keinen Weg zurück zum Fahrt-Ende-Dialog — die Fahrt blieb offen, das
 * Fahrtenbuch unvollständig.
 *
 * Lösung: nach dem Speichern der Behandlung erscheint ein Knopf "Fahrt
 * beenden". Er öffnet den bestehenden Fahrt-Ende-Dialog mit der Buchung, die
 * hier ausdrücklich mitgegeben wird (der globale `bkActionBookingCache` in
 * dashboard.js gehört dem Termin-Panel und darf nicht Grundlage sein). Nach dem
 * Speichern bleibt man in der Tagesbehandlung.
 *
 * Der Aufruf aus den Termin-Aktionen (ohne Kontext) verhält sich unverändert:
 * Cache lesen, am Ende ins Fahrtenbuch springen.
 */

/**
 * Soll der Knopf "Fahrt beenden" erscheinen? Nur mit Buchung und offener Fahrt.
 * @param {{bookingId?:string|null, fahrt_status?:string|null}} p
 */
export function zeigeFahrtBeenden({ bookingId, fahrt_status } = {}) {
  return !!bookingId && fahrt_status === 'fahrt_return_pending';
}

/** HTML des Hinweises samt Knopf (id `podFahrtBeendenBtn`, Handler delegiert). */
export function fahrtBeendenHinweisHtml() {
  return '<div id="podFahrtHinweis" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;'
    + 'padding:10px 12px;margin-bottom:12px;border:1px solid var(--border);border-radius:8px;'
    + 'background:var(--bg-card-solid);color:var(--text-main);">'
    + '<span style="font-size:13px;">Hausbesuch: Fahrt ist noch offen.</span>'
    + '<button type="button" class="btn btn-primary" id="podFahrtBeendenBtn">Fahrt beenden</button>'
    + '</div>';
}

// ── Kontext des Fahrt-Ende-Dialogs ─────────────────────────────────────────
let kontext = null; // { booking, onFertig } — nur solange der Dialog von hier geöffnet wurde

/**
 * Beim Öffnen des Dialogs: Buchung bestimmen und Kontext setzen/löschen.
 * @param {{booking?:object, onFertig?:Function}|*} opt  ohne `booking` (z. B. Klick-Event): Termin-Aktionen
 * @param {object|null} cache  `bkActionBookingCache`
 */
export function fahrtEndOeffnen(opt, cache) {
  kontext = opt && opt.booking ? { booking: opt.booking, onFertig: opt.onFertig } : null;
  return kontext ? kontext.booking : cache;
}

/** Beim Speichern: die Buchung, für die der Dialog offen ist. */
export function fahrtEndAktuell(cache) {
  return kontext ? kontext.booking : cache;
}

/**
 * Nach erfolgreichem Speichern. Mit Kontext: in der Tagesbehandlung bleiben.
 * Ohne: wie bisher Panel schliessen und ins Fahrtenbuch.
 */
export function fahrtEndAbschluss({ closeBkActionPanel, showToast, switchPanel }) {
  const k = kontext;
  kontext = null;
  if (!k) closeBkActionPanel();
  showToast('🏁 Fahrt abgeschlossen — im Fahrtenbuch eingetragen.');
  if (k) { if (k.onFertig) k.onFertig(); } else switchPanel('fahrtenbuch');
}

/**
 * Patient (leads.id) zu einem Hausbesuch-Termin, damit schon die ERSTE
 * `fahrten`-Zeile (beim Start der Fahrt) `lead_id` trägt — bisher wurde sie nur
 * über die Telefonnummer gesucht und blieb ohne Nummer leer, bis erst
 * „Beenden" sie füllte (canli-test 30.09.2026). Reihenfolge wie beim Beenden:
 * `bookings.lead_id` (direkt), dann Telefon-Rückfall. Wirft nie, Ergebnis kann null sein.
 * @param {object} sb  Supabase-Client
 * @param {{lead_id?:?string, owner_id?:string, customer_phone?:?string}} b  Buchung
 * @returns {Promise<string|null>}
 */
export async function leadIdFuerFahrt(sb, b) {
  if (b?.lead_id) return b.lead_id;
  if (!b?.customer_phone || !sb) return null;
  try {
    const { data } = await sb.from('leads').select('id')
      .eq('owner_id', b.owner_id).eq('phone', b.customer_phone).maybeSingle();
    return data?.id || null;
  } catch { return null; }
}
