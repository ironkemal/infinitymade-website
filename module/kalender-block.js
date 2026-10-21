/**
 * kalender-block.js — der Inhalt eines Terminblocks in der Tagesansicht.
 *
 * Warum es das gibt
 * ─────────────────
 * Bis 20.10.2026 stand dieser Inhalt als `renderBookingSlotInner` in
 * dashboard.js. Mit dem freigegebenen Kalender-Entwurf (Kemal, 20.10.2026)
 * änderte sich, WAS ein Block zeigt — und dashboard.js darf nicht wachsen.
 * Also zog die Funktion um (Kuşatma: wer sie anfasst, nimmt sie mit).
 *
 * Was ein Block jetzt zeigt
 * ─────────────────────────
 *   Zeile 1 — Patient (fett) · Leistung
 *   Zeile 2 — 08:00–08:35 · davon 20 Min am Patienten · DG       (3/6)
 *   Symbole — Hausbesuch, Dringend, Blanko, LHB, Notiz (rechts oben)
 *
 * „davon X Min am Patienten" kommt aus der Regelleistungszeit-Entscheidung
 * (Podoloji/PRODUKT-ENTSCHEIDUNGEN.md, 16.08.2026): der Termin blockiert die
 * Regelleistungszeit (35/50 Min), die reine Therapiezeit (20/35) steht nur als
 * Etikett daneben. Die Zahl kommt aus dem Leistungskatalog
 * (`GKV_LEISTUNGSKATALOG` in dashboard.js, Feld `therapiezeit`), der als
 * Parameter hereinkommt — wie bei renderGkvKatalog in leistungen-liste.js.
 * Keine zweite Kopie der Minuten hier.
 *
 * Abhängigkeiten aus dashboard.js (ICON, escapeHtml, katalog) kommen als
 * Parameter — so bleibt das Modul ohne DOM und ohne dashboard.js prüfbar.
 */

import { terminZeitLabel } from './kalender-raster.js?v=20261021p';
import { parseNameMitGeburt } from './termin-patient-bezug.js?v=20260817';

/** „Vorname Nachname" → „Nachname, Vorname". Schon mit Komma oder ein Wort: unverändert. */
export function anzeigeName(raw) {
  const s = String(raw || '').trim();
  if (!s || s.includes(',')) return s;
  const teile = s.split(/\s+/);
  if (teile.length < 2) return s;
  return teile[teile.length - 1] + ', ' + teile.slice(0, -1).join(' ');
}

/** Etikett „davon X Min am Patienten" — leer, wenn der Katalog für den Code keine Therapiezeit kennt. */
export function therapiezeitEtikett(code, katalog = []) {
  const c = String(code || '').trim();
  const min = c ? katalog.find((k) => k.code === c)?.therapiezeit : null;
  return min ? `davon ${min} Min am Patienten` : '';
}

/**
 * HTML für einen Terminblock.
 *
 * @param {object} b             Termin (bookings-Zeile mit services, prescription_sessions)
 * @param {object[]} kinder      Teilnehmer bei Gruppenterminen
 * @param {object} deps
 * @param {object} deps.ICON
 * @param {function} deps.escapeHtml
 * @param {object[]} [deps.katalog]  Leistungskatalog des Sektors (für die Therapiezeit)
 */
export function blockInhalt(b, kinder = [], { ICON = {}, escapeHtml, katalog = [] }) {
  const esc = escapeHtml;
  const sess = (b.prescription_sessions && b.prescription_sessions[0]) || null;
  const rx = sess?.prescriptions || null;

  const symbole = [
    b.hausbesuch ? `<span title="Hausbesuch" style="width:13px;height:13px;display:inline-flex;">${ICON.car || ''}</span>` : '',
    rx?.is_dringend ? `<span title="Dringend" style="color:#B4532A;width:13px;height:13px;display:inline-flex;">${ICON.warning || ''}</span>` : '',
    rx?.is_blanko ? '<span title="Blankoverordnung" style="font-size:9px;border:1px solid currentColor;padding:0 3px;border-radius:3px;">BL</span>' : '',
    rx?.is_lhb_bvb ? '<span title="LHB/BVB" style="font-size:9px;border:1px solid currentColor;padding:0 3px;border-radius:3px;">LHB</span>' : '',
    b.notes ? `<span title="Notiz" style="opacity:0.85;width:13px;height:13px;display:inline-flex;">${ICON.info || ''}</span>` : '',
  ].filter(Boolean).join(' ');
  const symbolLeiste = symbole
    ? `<div class="bk-icon-strip" style="position:absolute;top:4px;right:6px;display:flex;gap:3px;font-size:11px;line-height:1;pointer-events:none;">${symbole}</div>`
    : '';

  const leistung = b.services?.title || '';
  const zeit = terminZeitLabel(b);

  if (b.is_group) {
    const anzahl = kinder.length;
    const plaetze = b.group_capacity || 5;
    const namen = kinder.map((k) => (k.customer_name || 'Teilnehmer').split(',')[0].trim()).join(', ');
    return `<div class="kb-inhalt">
      <div class="dv-booking-name kb-zeile1">
        <span class="kb-name">${esc(leistung || 'Gruppe')}</span>
        <span class="kb-plaetze">${anzahl}/${plaetze}</span>
      </div>
      <div class="dv-booking-subtitle kb-zeile2">${zeit}<span class="kb-rest">${namen ? esc(namen) : 'Freier Gruppenslot'}</span></div>
      ${symbolLeiste}
    </div>`;
  }

  const name = anzeigeName(parseNameMitGeburt(b.customer_name).name || leistung || 'Termin');
  const dg = rx?.diagnosegruppe || '';
  const zaehler = (sess?.session_number && rx?.anzahl_einheiten) ? `${sess.session_number}/${rx.anzahl_einheiten}` : '';
  const bereit = rx?.abrechnung_status === 'bereit' ? '<span class="kb-bereit" title="Abrechnungsbereit">●</span>' : '';
  const rest = [therapiezeitEtikett(b.services?.code, katalog), dg].filter(Boolean).map(esc).join(' · ');
  const nichtDa = b.status === 'no_show' ? ' kb-nicht-erschienen' : '';
  // Kurze Termine (≤ 20 Min) zeigen nur Zeile 1 (.dv-booking-block--compact
  // blendet den Untertitel aus) — die Uhrzeit muss dann dort stehen, sonst ist
  // sie weg (Grund in kalender-raster.js bei terminZeitLabel).
  const dauer = (new Date(b.end_time) - new Date(b.start_time)) / 60000;
  const kurz = Number.isFinite(dauer) && dauer <= 20;

  return `<div class="kb-inhalt${nichtDa}">
    <div class="dv-booking-name kb-zeile1">
      ${kurz ? zeit : ''}<span class="kb-name">${esc(name)}</span>${leistung && leistung !== name ? `<span class="kb-leistung"> · ${esc(leistung)}</span>` : ''}${bereit}
    </div>
    <div class="dv-booking-subtitle kb-zeile2">
      ${zeit}${rest ? `<span class="kb-rest">· ${rest}</span>` : ''}${zaehler ? `<span class="kb-zaehler">${esc(zaehler)}</span>` : ''}
    </div>
    ${symbolLeiste}
  </div>`;
}
