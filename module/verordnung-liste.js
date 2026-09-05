/**
 * verordnung-liste.js — die obere Hälfte der Seite „Verordnungen".
 *
 * Kommt aus `dashboard.js` (`loadVerordnungen`) hierher, weil dort zwei Dinge
 * dazukommen mussten und die Datei nicht wachsen darf (Konsey 2026-08-13):
 *
 *   1. Die Nummer neben dem Namen. Bisher stand in der Liste nur „Kemal Demir".
 *      Wer aus zwei Metern auf den Bildschirm sieht, konnte nicht erkennen, um
 *      welche Verordnung desselben Patienten es geht. Jetzt steht dort
 *      `Kemal Demir  1-3` — Patient 1, dessen dritte Verordnung. Dieselbe
 *      Nummer steht auf der Rechnung und im DTA-Datensatz (Feld INV-4), also
 *      ist sie auch das, worüber man mit der Kasse spricht.
 *      Zusammensetzung und Vorrangregel: `module/belegnummer.js`.
 *
 *   2. Der Klick auf die Zeile. Eine gespeicherte Verordnung liess sich nicht
 *      mehr aufmachen; was in der Muster-13-Maske eingetragen worden war, war
 *      nach dem Speichern nur noch auf dem Papier zu finden.
 *
 * Umbau in zwei Hälften (Kemal, 31.08.2026)
 * ─────────────────────────────────────────
 *   „Wir brauchen eine ganz große Reform, wir müssen die Seite in zwei Hälften
 *    teilen. Über der Hälfte soll in der Reihe Nachname, Vorname [stehen],
 *    Datum, Rezeptnummer … dann Status bereit"
 *
 * Diese Datei ist die obere Hälfte: eine Zeile je Verordnung mit genau den
 * genannten Feldern. Die untere Hälfte — Verordnungsdaten, Verschreibung,
 * Termine — steht in `module/verordnung-detail.js`; hier wird sie nur
 * angestossen. Die Auswahl bleibt sichtbar markiert, damit oben und unten
 * erkennbar dasselbe gemeint ist.
 *
 * Beide Töpfe, nicht einer
 * ────────────────────────
 * Bis zum Umbau las diese Seite ausschliesslich `prescriptions` (Physio · Ergo
 * · Logopädie). Für einen Podologen war sie damit LEER — seine Verordnungen
 * liegen in `verordnungen` und waren nur über die Podologie-Abrechnung
 * erreichbar. Genau deshalb kannte die Seite auch die Zustände nicht, nach
 * denen gefragt wurde („in Behandlung" / „bereit zur Abrechnung"): das sind
 * Werte des Podologie-Topfes.
 *
 * Geladen wird über `ladeAktiveVerordnungen` (module/verordnung-uebersicht.js),
 * die beide Töpfe schon zusammenführt — hier praxisweit und ohne Filter auf
 * „läuft noch". Eine vierte Ladefunktion wäre die dritte Stelle gewesen, an der
 * dieselbe Zusammenführung steht.
 */

import { ladeAktiveVerordnungen } from './verordnung-uebersicht.js?v=20260905';
import { statusBadgeGross, bereichBadge } from './abrechnungsstatus.js?v=20260905';
import { zeigeVerordnungDetail } from './verordnung-detail.js?v=20260905';
import { on } from './signal.js?v=20260813';

const SPALTEN = 7;

/**
 * Die aktuell aufgeschlagene Verordnung. Modulweit, weil es genau EINE untere
 * Hälfte gibt; nach dem Neuladen der Liste wird sie wieder markiert, damit ein
 * Speichern die Auswahl nicht wegwirft.
 */
let _auswahl = null;   // { quelle, id } | null

/** Der Zuhörer auf `verordnungen:changed` wird genau einmal registriert. */
let _hoertZu = false;

/**
 * Verordnungsliste laden und zeichnen.
 *
 * @param {object} ctx
 * @param {object} ctx.supabase
 * @param {string} ctx.ownerId
 * @param {(s:string)=>string} ctx.escapeHtml
 * @param {() => void} [ctx.onNeu]  Handler für „+ Neue Verordnung".
 */
export async function verordnungenListeLaden(ctx) {
  const { supabase, ownerId, escapeHtml } = ctx;
  const tbody = document.getElementById('vordTbody');
  const empty = document.getElementById('vordListEmpty');
  if (!tbody) return;

  // Erstes Laden: "Lädt…". Ein Neuladen (z.B. nach Zuordnen/Lösen eines
  // Termins, das an dieser Tabelle inhaltlich nichts ändert) dimmt die
  // bestehenden Zeilen statt sie zu leeren — sonst blitzt die ganze Tabelle
  // bei jeder Kleinigkeit weiss auf. Kemal, 04.09.2026.
  if (tbody.dataset.geladen === '1') tbody.style.opacity = '0.45';
  else tbody.innerHTML = `<tr><td colspan="${SPALTEN}" style="text-align:center;padding:20px;color:var(--text-muted)">Lädt…</td></tr>`;

  const btn = document.getElementById('vordNeueBtn');
  if (btn && ctx.onNeu) btn.onclick = ctx.onNeu;

  // Wer schreibt, meldet — hier wird zugehört. Ändert jemand die verordnete
  // Menge in der unteren Hälfte oder den Status aus der Patientenliste heraus,
  // zieht die Liste von selbst nach, statt bis zum nächsten Panelwechsel das
  // Alte zu zeigen. Einmal registrieren, nicht bei jedem Laden.
  if (!_hoertZu) {
    _hoertZu = true;
    on('verordnungen:changed', () => {
      if (document.getElementById('vordTbody')?.isConnected) verordnungenListeLaden(ctx);
    });
    // Der Stift in der Termine-Spalte (module/verordnung-detail.js) öffnet den
    // Terminbearbeiten-Dialog aus dashboard.js — der schreibt an `bookings`,
    // nicht an `verordnungen:changed`. Ohne diesen Zuhörer zeigte die
    // aufgeschlagene Verordnung nach dem Speichern weiter den alten Termin,
    // bis man sie manuell neu öffnete.
    on('bookings:changed', () => {
      if (_auswahl && document.getElementById('vordDetailContent')?.isConnected) {
        oeffne({ supabase: ctx.supabase, escapeHtml: ctx.escapeHtml, quelle: _auswahl.quelle, id: _auswahl.id });
      }
    });
  }
  // Einmal verdrahten, nicht bei jedem Laden erneut — sonst sammeln sich
  // Handler auf demselben Knopf an.
  const zu = document.getElementById('vordDetailClose');
  if (zu && !zu.dataset.verdrahtet) {
    zu.dataset.verdrahtet = '1';
    zu.addEventListener('click', () => auswahlAufheben(escapeHtml));
  }

  const liste = await ladeAktiveVerordnungen(supabase, { ownerId, nurAktive: false });

  if (!liste.length) {
    tbody.innerHTML = '';
    tbody.style.opacity = '';
    delete tbody.dataset.geladen;
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  tbody.innerHTML = liste.map(v => zeileHtml(v, escapeHtml)).join('');
  tbody.style.opacity = '';
  tbody.dataset.geladen = '1';

  tbody.querySelectorAll('.vord-row').forEach(row => {
    row.addEventListener('click', () => {
      oeffne({ supabase, escapeHtml, quelle: row.dataset.quelle, id: row.dataset.vordId });
    });
  });

  // Nach einem Neuladen die vorherige Auswahl wieder anzeichnen. Ohne das
  // stünde unten weiter eine Verordnung, die oben nicht mehr markiert ist.
  if (_auswahl) markiere(_auswahl);
}

function zeileHtml(v, esc) {
  const datum = v.datum ? new Date(v.datum).toLocaleDateString('de-DE') : '—';
  const gewaehlt = _auswahl && _auswahl.id === v.id && _auswahl.quelle === v.quelle;

  // Ohne Belegnummer bleibt die Zelle leer statt „—": eine Verordnung ohne
  // Patientenakte hat wirklich keine Nummer (der Trigger vergibt sie erst mit
  // `lead_id`), und ein Platzhalter läse sich wie eine vorhandene.
  const nummer = v.nummerText
    ? `<code style="font-size:12px;color:var(--text-main);">${esc(v.nummerText)}</code>`
    : `<span style="font-size:11px;color:var(--warning,#f59e0b);" title="Diese Verordnung hängt an keiner Patientenakte — deshalb vergibt die Datenbank keine Nummer.">ohne Akte</span>`;

  const zaehler = v.verordnet
    ? `${v.erbracht} / ${v.verordnet}`
    : '—';

  return `<tr class="vord-row${gewaehlt ? ' vord-row-gewaehlt' : ''}"
      data-vord-id="${esc(v.id)}" data-quelle="${esc(v.quelle)}"
      style="cursor:pointer;${gewaehlt ? 'background:var(--bg-card);' : ''}" title="Verordnung öffnen">
    <td style="font-weight:600;color:var(--text-main);">${esc(v.nachname || '—')}</td>
    <td style="color:var(--text-main);">${esc(v.vorname || '—')}</td>
    <td style="white-space:nowrap;">${datum}</td>
    <td style="white-space:nowrap;">${nummer}</td>
    <td>${bereichBadge(v.quelle)}</td>
    <td style="text-align:center;white-space:nowrap;color:var(--text-muted);">${zaehler}</td>
    <td>${statusBadgeGross(v.quelle, v.status)}</td>
  </tr>`;
}

/** Eine Verordnung in der unteren Hälfte aufschlagen. */
function oeffne({ supabase, escapeHtml, quelle, id }) {
  _auswahl = { quelle, id };
  markiere(_auswahl);
  return zeigeVerordnungDetail({
    supabase,
    quelle,
    verordnungId: id,
    titel: document.getElementById('vordDetailName'),
    inhalt: document.getElementById('vordDetailContent'),
    escapeHtml,
  });
}

function auswahlAufheben(esc) {
  _auswahl = null;
  markiere(null);
  const titel = document.getElementById('vordDetailName');
  const inhalt = document.getElementById('vordDetailContent');
  if (titel) titel.textContent = 'Verordnung';
  if (inhalt) {
    inhalt.innerHTML = '<span style="color:var(--text-muted);">Wählen Sie oben eine Verordnung aus.</span>';
    // Sonst dimmt zeigeVerordnungDetail() beim nächsten Öffnen diesen Hinweis-
    // text, statt "Lade…" zu zeigen — er zählt nicht als „schon geladener Inhalt".
    delete inhalt.dataset.geladen;
  }
}

function markiere(auswahl) {
  document.querySelectorAll('#vordTbody .vord-row').forEach(r => {
    const treffer = !!auswahl && r.dataset.vordId === auswahl.id && r.dataset.quelle === auswahl.quelle;
    r.classList.toggle('vord-row-gewaehlt', treffer);
    r.style.background = treffer ? 'var(--bg-card)' : '';
  });
}
