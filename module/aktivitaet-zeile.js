/**
 * module/aktivitaet-zeile.js — Ruhige Darstellung der letzten Praxis-Aktivitäten (#activityFeedList).
 *
 * Ersetzt die früheren Unicode-Emojis (📝, 💶, 🚗, 👤, 📅) und Inline-Stile aus
 * `loadActivityFeed()` in dashboard.js durch feine monochrome SVG-Symbole (1.7 px Strich)
 * und semantische Klassen (gestylt in dashboard-start.css).
 */

const SVG = (pfad) =>
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pfad}</svg>`;

const ICON = {
  note: SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
  invoice: SVG('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
  fahrt: SVG('<path d="M5 17h14M6 17l1.5-6h9L18 17"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>'),
  lead: SVG('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  booking: SVG('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
};

const escDefault = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Formatiert eine einzelne Zeile für `#activityFeedList` ohne Emojis.
 *
 * @param {{ type: string, ts?: string, name?: string, invoice_number?: string, total_patient?: number, distance_km?: number }} item
 * @param {{ escapeHtml?: (s: string) => string, formatTimestamp?: (ts?: string) => string }} [opts]
 * @returns {string}
 */
export function aktivitaetZeileHtml(item, opts = {}) {
  const esc = opts.escapeHtml || escDefault;
  const zeit = typeof opts.formatTimestamp === 'function' ? opts.formatTimestamp(item?.ts) : '';
  const typ = String(item?.type || 'booking');
  const icon = ICON[/** @type {keyof typeof ICON} */ (typ)] || ICON.booking;
  let text = '';

  if (typ === 'note') {
    text = `Notiz hinzugefügt für <strong>${esc(item?.name || '')}</strong>`;
  } else if (typ === 'invoice') {
    const betrag = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(item?.total_patient) || 0) + ' €';
    text = `Rechnung <strong>${esc(item?.invoice_number || '')}</strong> (${esc(betrag)}) für ${esc(item?.name || '')} bezahlt`;
  } else if (typ === 'fahrt') {
    text = `Fahrt dokumentiert (${esc(String(item?.distance_km ?? 0))} km)`;
  } else if (typ === 'lead') {
    text = `<strong>${esc(item?.name || '')}</strong> neu als Patient angelegt`;
  } else {
    text = `Termin für <strong>${esc(item?.name || '')}</strong> gebucht`;
  }

  return `<div class="act-row">
    <span class="act-icon">${icon}</span>
    <div class="act-body">
      <div class="act-text">${text}</div>
      ${zeit ? `<div class="act-time">${esc(zeit)}</div>` : ''}
    </div>
  </div>`;
}
