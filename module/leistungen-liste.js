/**
 * leistungen-liste.js — die Leistungsübersicht als Tabelle, nach Kostenträger
 * gruppiert.
 *
 * Warum es das gibt
 * ─────────────────
 * Die Übersicht war eine Kachelwand: jede Leistung eine Karte, alle gleich
 * groß, alle untereinander weg. Rückmeldung aus der Beta: „Kachel-Chaos
 * vereinfachen und tabellarisch/gruppiert darstellen", und vor allem „klare
 * Trennung nach Abrechnungsart: GKV bundeseinheitlich, Privat, Selbstzahler,
 * BG."
 *
 * Der zweite Teil war bisher gar nicht abbildbar. Unterschieden wurde nur
 * implizit — `gkv_position_nr` gesetzt hieß GKV, leer hieß Privat. Selbstzahler
 * und BG gab es schlicht nicht.
 *
 * Warum es trotzdem schon ohne die neue Spalte läuft
 * ─────────────────────────────────────────────────
 * `services.kostentraeger_typ` kommt per Migration
 * (`sql-melih/2026-08-25-kostentraeger-typ.sql`). Bis die gelaufen ist, ist die
 * Spalte nicht da und jeder Datensatz liefert `undefined`. Deshalb entscheidet
 * `kostentraegerTyp()` mit Rückfall auf die alte, implizite Regel: die Ansicht
 * funktioniert vorher und nachher, und die Migration verbessert sie, statt sie
 * zu ermöglichen. Anders herum hätte ein Deploy vor der Migration eine leere
 * Leistungsliste bedeutet — in einer Praxis, die damit arbeitet.
 */

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/**
 * Die Gruppen in der Reihenfolge, in der die Praxis sie braucht: GKV zuerst,
 * weil dort das Geld herkommt; „Intern" zuletzt, weil es keine Leistung am
 * Patienten ist.
 */
export const TYP_GRUPPEN = [
  { typ: 'gkv', label: 'GKV — bundeseinheitliche Vergütung', hinweis: '§125 SGB V · Preise und Positionsnummern sind vorgegeben' },
  { typ: 'privat', label: 'Privat', hinweis: 'Eigene Preise' },
  { typ: 'selbstzahler', label: 'Selbstzahler', hinweis: 'Ohne Verordnung, Patient zahlt selbst' },
  { typ: 'bg', label: 'BG — Berufsgenossenschaft', hinweis: 'Arbeitsunfall / Berufskrankheit' },
  { typ: 'intern', label: 'Intern', hinweis: 'Blocker und Zuschläge — erscheinen nicht in der Patientenauswahl' },
];

/**
 * Welcher Kostenträgertyp gilt für diese Leistung?
 *
 * Reihenfolge der Entscheidung — jede Stufe hat einen Grund:
 *   1. `is_internal` schlägt alles. Ein Blocker ist keine abrechenbare Leistung,
 *      auch wenn er zufällig eine Positionsnummer trüge.
 *   2. Die gepflegte Spalte, sobald es sie gibt.
 *   3. Rückfall auf die alte implizite Regel, damit die Ansicht auch vor der
 *      Migration und bei nie bearbeiteten Altdaten etwas anzeigt.
 */
export function kostentraegerTyp(leistung) {
  if (!leistung) return 'privat';
  if (leistung.is_internal) return 'intern';
  const gepflegt = leistung.kostentraeger_typ;
  if (gepflegt && TYP_GRUPPEN.some(g => g.typ === gepflegt)) return gepflegt;
  return (leistung.gkv_position_nr && String(leistung.gkv_position_nr).trim()) ? 'gkv' : 'privat';
}

/**
 * Gruppiert und sortiert. Leere Gruppen fallen raus — eine Praxis ohne
 * BG-Leistungen soll keine leere BG-Tabelle sehen.
 */
export function gruppiereLeistungen(leistungen = []) {
  const nachTyp = new Map(TYP_GRUPPEN.map(g => [g.typ, []]));
  for (const l of leistungen) {
    const typ = kostentraegerTyp(l);
    (nachTyp.get(typ) || nachTyp.get('privat')).push(l);
  }
  return TYP_GRUPPEN
    .map(g => ({ ...g, leistungen: (nachTyp.get(g.typ) || []).sort(
      (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de')) }))
    .filter(g => g.leistungen.length > 0);
}

/**
 * Die Dauer-/Preis-Zelle. `price_config.durations` ist die aktive Quelle;
 * `duration_minutes` + `price` sind der Altbestand.
 */
function dauerZelle(l, formatEur) {
  const cfg = l.price_config?.durations;
  if (cfg) {
    const aktiv = Object.entries(cfg)
      .filter(([, v]) => v && v.active)
      .map(([k, v]) => ({ min: parseInt(k, 10), preis: v.price }))
      .sort((a, b) => a.min - b.min);
    if (!aktiv.length) return '<span class="srv-chip srv-chip-warn">Keine aktive Dauer</span>';
    return aktiv.map(d =>
      `<span class="srv-chip">${d.min} Min${d.preis != null ? ' · ' + formatEur(d.preis) : ''}</span>`
    ).join(' ');
  }
  const preis = l.price != null ? ' · ' + formatEur(l.price) : '';
  return `<span class="srv-chip">${l.duration_minutes || '–'} Min${preis}</span>`;
}

function mitarbeiterZelle(l, teamMembers) {
  const namen = (l.employee_services || []).map(es => {
    const m = teamMembers.find(tm => tm.id === es.employee_id);
    return m ? (m.business_name || m.email?.split('@')[0]) : null;
  }).filter(Boolean);
  // Keine Zuordnung heißt in dieser Anwendung „alle dürfen" — das muss dastehen,
  // sonst liest man es als „niemand".
  return namen.length ? escapeHtml(namen.join(', ')) : '<span class="srv-alle">Alle</span>';
}

/**
 * Zeichnet die Übersicht.
 *
 * @param {object} o
 * @param {Element}  o.container
 * @param {Array}    o.leistungen
 * @param {Array}    o.teamMembers
 * @param {function} o.formatEur
 * @param {function} o.onBearbeiten (id) => void
 * @param {function} o.onLoeschen   (id) => void
 * @param {function} o.onNeu        () => void
 */
export function renderLeistungenListe({
  container,
  leistungen = [],
  teamMembers = [],
  formatEur = (v) => String(v),
  onBearbeiten,
  onLoeschen,
  onNeu,
}) {
  if (!container) return;

  const neuKnopf = '<button type="button" class="btn-primary btn-sm" id="srvNeuBtn">+ Neue Leistung</button>';

  if (!leistungen.length) {
    container.innerHTML = `<div class="srv-leer">Noch keine Leistungen angelegt.${neuKnopf}</div>`;
    container.querySelector('#srvNeuBtn')?.addEventListener('click', () => onNeu && onNeu());
    return;
  }

  const gruppen = gruppiereLeistungen(leistungen);

  container.innerHTML = `
    <div class="srv-liste-kopf">
      <span class="srv-liste-anzahl">${leistungen.length} Leistungen</span>
      ${neuKnopf}
    </div>
    ${gruppen.map(g => `
      <section class="srv-gruppe" data-typ="${g.typ}">
        <header class="srv-gruppe-kopf">
          <h4>${escapeHtml(g.label)}</h4>
          <span class="srv-gruppe-hinweis">${escapeHtml(g.hinweis)}</span>
          <span class="srv-gruppe-zahl">${g.leistungen.length}</span>
        </header>
        <table class="srv-tabelle">
          <thead>
            <tr>
              <th>Leistung</th>
              <th>Kürzel</th>
              <th>GKV-Position</th>
              <th>Dauer &amp; Preis</th>
              <th>Mitarbeiter</th>
              <th><span class="srv-sr">Aktionen</span></th>
            </tr>
          </thead>
          <tbody>
            ${g.leistungen.map(l => `
              <tr data-srv-id="${escapeHtml(l.id)}" tabindex="0">
                <td class="srv-td-name">
                  <span class="srv-farbpunkt" style="background:${escapeHtml(l.color || '#22c55e')}"></span>
                  ${escapeHtml(l.title)}
                </td>
                <td>${l.code ? `<span class="srv-code-badge">${escapeHtml(l.code)}</span>` : '—'}</td>
                <td>${l.gkv_position_nr ? `<span class="gkv-pos-badge">${escapeHtml(l.gkv_position_nr)}</span>` : '—'}</td>
                <td>${dauerZelle(l, formatEur)}</td>
                <td class="srv-td-emp">${mitarbeiterZelle(l, teamMembers)}</td>
                <td class="srv-td-akt">
                  <button type="button" class="srv-del-btn" data-srv-del="${escapeHtml(l.id)}" title="Löschen" aria-label="Löschen">✕</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `).join('')}
  `;

  container.querySelector('#srvNeuBtn')?.addEventListener('click', () => onNeu && onNeu());

  container.querySelectorAll('tr[data-srv-id]').forEach(zeile => {
    const oeffne = (ev) => {
      if (ev.target.closest('[data-srv-del]')) return;
      if (onBearbeiten) onBearbeiten(zeile.dataset.srvId);
    };
    zeile.addEventListener('click', oeffne);
    // Eine Tabellenzeile ist kein Knopf — ohne das käme man mit der Tastatur
    // nicht in die Bearbeitung.
    zeile.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); oeffne(ev); }
    });
  });

  container.querySelectorAll('[data-srv-del]').forEach(knopf => {
    knopf.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (onLoeschen) onLoeschen(knopf.dataset.srvDel);
    });
  });
}
