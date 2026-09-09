/**
 * abrechnung-status.js — der Status einer §302-DATEI, nicht einer Verordnung.
 *
 * Nicht verwechseln mit `abrechnungsstatus.js`
 * ─────────────────────────────────────────────
 * Der Name ist absichtlich fast identisch, die Achse ist eine andere:
 *
 *     abrechnungsstatus.js   → Status EINER VERORDNUNG auf dem Weg zum Geld
 *                               (`prescriptions.abrechnung_status`:
 *                               aktiv · abrechenbar · abgerechnet · …)
 *     abrechnung-status.js   → Status EINER DATEI, die schon abgeschickt ist
 *                               (`abrechnung.status`:
 *                               erstellt · gesendet · accepted · rejected · …)
 *
 * `statusBadge()`/`statusBadgeGross()` aus `abrechnungsstatus.js` verstehen
 * diese Werte NICHT — ein unbekannter Schlüssel fällt dort still auf `aktiv`
 * zurück (rotes „In Behandlung", `statusInfo()`), weil diese Tabelle für die
 * Verordnungsachse gebaut ist. `erstellt`, `gesendet`, `paid` würden dort
 * alle als rotes „In Behandlung" erscheinen — falsch und irreführend auf
 * einem Bildschirm, der zeigt, ob Geld gekommen ist.
 *
 * Herkunft
 * ────────
 * Entstanden als Phase 0.1 von `ABRECHNUNG_BILDSCHIRM_PLAN.md` (08.09.2026):
 * der gemeinsame §302-Bildschirm für alle Fachbereiche braucht ein Archiv
 * mit „oben Mavi (offen), Grün (angenommen), Rot (abgesetzt), Sarı
 * (teilweise)" — dafür fehlte bisher jede Rosette. Diese Datei liefert sie,
 * wird aber erst in Phase 3 (Archiv-Ansicht) tatsächlich angezeigt.
 *
 * `teilweise_abgesetzt` steht NICHT in der Datenbank
 * ───────────────────────────────────────────────────
 * `abrechnung.status` kennt laut `db/SCHEMA.sql` nur
 * `erstellt, heruntergeladen, gesendet, accepted, rejected, paid` — kein
 * „teilweise". Ob eine Datei ganz oder teilweise abgesetzt wurde, steht in
 * zwei separaten Spalten (`rejected_count`, `prescription_count`) und wird
 * hier aus beiden ZUSAMMEN abgeleitet (`aggregierterDateiStatus()`).
 * Gespeichert wird nichts — dieselbe Regel wie beim Verordnungsstatus in
 * `abrechnungsstatus.js`: ein Aggregat, das man speichert, läuft auseinander,
 * sobald sich eine der Ausgangszahlen ändert.
 *
 * Zwei verschiedene Rot fehlen noch — bewusst
 * ─────────────────────────────────────────────
 * gkv-302 hat für den Plan zwei Ablehnungsarten unterschieden, die NICHT
 * dieselbe Farbe/Aktion haben dürfen: „Datei abgewiesen" (Prüfstufe 1-3,
 * Annahmestelle, Antwort: erneut mit VKZ 01) gegen „Beleg abgesetzt"
 * (Prüfstufe 4, Kasse, Antwort: Korrektur mit VKZ 04). Die Datenbank hält
 * heute nur die zweite Sorte fest (`status = 'rejected'`). Die erste braucht
 * eine eigene Spalte und kommt mit Phase 5 (Korrekturverfahren) — bis dahin
 * zeigt `rejected` hier als „Abgesetzt", nicht als Sammelbegriff „Fehler".
 *
 * Der Wortlaut ersetzt absichtlich den alten, nicht nur zusätzlich
 * ─────────────────────────────────────────────────────────────────
 * `renderAbrechnungHistory()` (`dashboard.js:18859`) zeigt heute schon eine
 * Dateiliste und holt ihre Beschriftung aus dem `ab_status_*`-Wörterbuch
 * (`dashboard.js` T-Objekt, drei Sprachen). Diese Datei wählt an zwei
 * Stellen bewusst ANDERE deutsche Wörter für denselben Rohwert:
 *
 *     rejected   Wörterbuch „Abgelehnt"   →  hier „Abgesetzt"
 *     gesendet   Wörterbuch „Versendet"   →  hier „Gesendet — Antwort steht aus"
 *     accepted   Wörterbuch „Akzeptiert"  →  hier „Angenommen"
 *
 * Das ist kein Versehen: „Abgelehnt" verwischt genau die Unterscheidung
 * oben (Datei abgewiesen vs. Beleg abgesetzt) — der Fehler, den `gkv-302`
 * als Grund für Veto V2 benennt. Phase 3 (Archiv-Ansicht) löst
 * `renderAbrechnungHistory()` ab (siehe `ABRECHNUNG_BILDSCHIRM_PLAN.md`
 * Abschnitt 6, Phase 3, Fussnote „Wortlaut") und nimmt DIESEN Wortlaut als
 * verbindlich; das `ab_status_*`-Wörterbuch wird dort mit-entfernt, nicht
 * daneben stehen gelassen. Warum hier kein `ctx.t()` (das übliche Muster für
 * Text in Modulen, siehe `module/podologie-abrechnung.js`): jede neue
 * Wörterbuch-Zeile in `dashboard.js` verstösst gegen die Wachstumssperre
 * (`tools/check-dashboard-size.sh`, Konsey 2026-08-13) — derselbe Grund,
 * aus dem `module/podologie-dateieinheit.js` (07.09.2026, ebenfalls §302)
 * sein Deutsch fest verdrahtet statt über `ctx.t()` zu beziehen. Englisch/
 * Türkisch für dieses GKV-Vokabular nachzuziehen ist eine spätere,
 * eigenständige Entscheidung — keine, die diese Datei blockieren darf.
 */

/** Farbcodes bewusst identisch zur Verordnungsachse (`abrechnungsstatus.js`):
 *  dieselbe Bedeutung soll app-weit dieselbe Farbe tragen. Absetzung ist dort
 *  Magenta (nicht Rot) und Teilabsetzung Orange (nicht Gelb) — dieselbe
 *  Unterscheidung gilt hier. */
export const DATEI_STATUS = [
  {
    key: 'erstellt', label: 'Erstellt — noch nicht heruntergeladen', kurz: 'Erstellt',
    farbe: '#6b7280', bg: 'rgba(107,114,128,0.14)',
    hilfe: 'Die DTA-Datei liegt bereit, wurde aber noch nicht heruntergeladen oder eingereicht.',
  },
  {
    key: 'heruntergeladen', label: 'Heruntergeladen — noch nicht eingereicht', kurz: 'Heruntergeladen',
    farbe: '#6b7280', bg: 'rgba(107,114,128,0.14)',
    hilfe: 'Die Datei wurde heruntergeladen. Solange sie nicht im DAS-Portal hochgeladen ist, hat die Kasse sie nicht gesehen.',
  },
  {
    key: 'gesendet', label: 'Gesendet — Antwort steht aus', kurz: 'Gesendet',
    farbe: '#2563eb', bg: 'rgba(37,99,235,0.14)',
    hilfe: 'Bei der Datenannahmestelle eingereicht. Antwort (ZAA) steht laut Richtlinie innerhalb von 24–72 Stunden aus.',
  },
  {
    key: 'teilweise_abgesetzt', label: 'Teilweise abgesetzt', kurz: 'Teilweise',
    farbe: '#ea580c', bg: 'rgba(234,88,12,0.14)',
    hilfe: 'Ein Teil der Belege wurde von der Kasse abgesetzt, der Rest angenommen. Abgesetzte Belege einzeln prüfen.',
  },
  {
    key: 'rejected', label: 'Abgesetzt', kurz: 'Abgesetzt',
    farbe: '#be185d', bg: 'rgba(190,24,93,0.14)',
    hilfe: 'Die Kasse hat alle Belege dieser Datei abgesetzt. Grund prüfen, korrigieren, mit VKZ 04 erneut einreichen.',
  },
  {
    key: 'accepted', label: 'Angenommen', kurz: 'Angenommen',
    farbe: '#16a34a', bg: 'rgba(22,163,74,0.14)',
    hilfe: 'Von der Kasse angenommen (ZAA fehlerfrei). Zahlung kann noch offen sein — siehe Zahlungsstatus.',
  },
  {
    key: 'paid', label: 'Bezahlt', kurz: 'Bezahlt',
    farbe: '#15803d', bg: 'rgba(21,128,61,0.16)',
    hilfe: 'Der volle Rechnungsbetrag (abzüglich Absetzungen) ist eingegangen.',
  },
];

const BY_KEY = new Map(DATEI_STATUS.map(s => [s.key, s]));

/** Info-Objekt zu einem rohen `abrechnung.status`-Wert oder dem abgeleiteten
 *  `teilweise_abgesetzt`. Unbekanntes wird sichtbar als es selbst gezeigt,
 *  nicht auf einen falschen bekannten Status geschönt (anders als der
 *  Fallback in `abrechnungsstatus.js` — dort ist der Fallback "aktiv" ein
 *  bewusster Normalfall, hier gibt es keinen Normalfall, auf den es sich
 *  lohnt zu raten). */
export function dateiStatusInfo(key) {
  return BY_KEY.get(key) || {
    key: key || '—', label: key || 'Unbekannt', kurz: key || '—',
    farbe: 'var(--text-muted)', bg: 'transparent',
    hilfe: 'Unbekannter Status — steht so in der Datenbank.',
  };
}

/**
 * Leitet den anzuzeigenden Status aus der Zeile der Tabelle `abrechnung` ab.
 *
 * Nur bei `status === 'rejected'` wird nachgeschaut, ob es sich um eine
 * TEILWEISE oder eine VOLLSTÄNDIGE Absetzung handelt — in jedem anderen
 * Status sagt `rejected_count` nichts über den aktuellen Zustand der Datei.
 *
 * @param {{status: string, rejected_count?: number|null, prescription_count?: number|null}} abrechnung
 * @returns {string} ein Schlüssel aus DATEI_STATUS
 */
export function aggregierterDateiStatus(abrechnung) {
  if (!abrechnung) return 'erstellt';
  const { status, rejected_count, prescription_count } = abrechnung;
  if (status !== 'rejected') return status;

  const rc = Number(rejected_count) || 0;
  const pc = Number(prescription_count) || 0;
  if (pc > 0 && rc > 0 && rc < pc) return 'teilweise_abgesetzt';
  return 'rejected';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Farbiges Etikett für die Dateiliste (Phase 3, Archiv-Ansicht).
 * @param {string} key  ein Schlüssel aus DATEI_STATUS, z. B. Ergebnis von aggregierterDateiStatus()
 * @param {{kurz?: boolean}} [opts]
 */
export function dateiStatusBadge(key, { kurz = false } = {}) {
  const s = dateiStatusInfo(key);
  const text = kurz ? s.kurz : s.label;
  return `<span title="${escapeHtml(s.hilfe)}" style="display:inline-block;font-size:11px;font-weight:600;`
       + `padding:2px 8px;border-radius:10px;background:${s.bg};color:${s.farbe};white-space:nowrap;">`
       + `${escapeHtml(text)}</span>`;
}
