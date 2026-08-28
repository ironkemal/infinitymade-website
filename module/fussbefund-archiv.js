/**
 * fussbefund-archiv.js — Fußbefund-Archiv in der Patientenkarte.
 *
 * Warum es das gibt (27.08.2026)
 * ------------------------------
 * In der Patientenkarte stand ein ZWEITES, vollständiges Fußbefund-Formular:
 * eigene Fußdiagramme, eigene Marker, eigener Speichern-Knopf, ~470 Zeilen
 * Markup und ~450 Zeilen Logik in `dashboard.js`. Es schrieb in dieselbe
 * Tabelle wie das echte Modul (`pat_fussbefund`), aber nach anderen Regeln:
 * **ohne `booking_id`** und **ohne `uebernommen_von`**. Ein dort gespeicherter
 * Befund erschien im Fußbefund-Modul deshalb als „Ohne Termin" und der Termin
 * bekam kein „✓ Befund". Zwei Eingänge für dieselbe Sache, einer davon still
 * kaputt — genau das Muster, das `funktionen/README.md` als Anlass für die
 * Funktionskarte nennt.
 *
 * Entscheidung des Eigentümers: das alte Formular wird entfernt. Die
 * Patientenkarte zeigt nur noch ein **Archiv** — Datum für Datum, die
 * wichtigsten Angaben, kein Bearbeiten. Ein Klick öffnet den Befund im
 * richtigen Modul (`module/fussbefund.js`). Erfasst und geändert wird ab
 * jetzt an genau einer Stelle.
 *
 * Warum nur lesen
 * ---------------
 * Sobald hier auch geschrieben werden könnte, wäre die zweite Wahrheit sofort
 * zurück. Diese Datei ruft deshalb kein `insert`, `update` oder `delete` auf —
 * das ist keine Sparmaßnahme, das ist der Zweck.
 *
 * Quelle der Feldnamen: `db/SCHEMA.sql` → `pat_fussbefund`. Nicht geraten.
 */

/** Risiken, die für einen Podologen den Blick auf den Fuß ändern. */
const RISIKO_LABEL = {
  diabetes:              'Diabetes',
  allergien:             'Allergien',
  infektionskrankheiten: 'Infektion',
  gerinnungshemmer:      'Gerinnungshemmer',
};

/** Diabetes zuerst: das ist die Angabe, wegen der ein Fuß anders behandelt wird. */
const RISIKO_REIHENFOLGE = ['diabetes', 'infektionskrankheiten', 'gerinnungshemmer', 'allergien'];

function datumDe(wert) {
  const d = new Date(wert);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Aktive Risiken einer Befundzeile, in klinischer Reihenfolge. */
function risiken(row) {
  const r = row?.befund?.risiken || {};
  return RISIKO_REIHENFOLGE.filter(k => r[k]).map(k => RISIKO_LABEL[k]);
}

/**
 * Kurzfassung des Hautbefunds. Bewusst knapp: das Archiv soll überflogen
 * werden, die vollständige Ansicht liegt einen Klick entfernt.
 */
function hautKurz(row) {
  const h = row?.befund?.haut || {};
  const teile = [];
  if (h.hornhaut)      teile.push('Hornhaut');
  if (h.hallux_valgus) teile.push('Hallux valgus');
  if (h.warzen)        teile.push('Warzen');
  if (h.hautpilz)      teile.push('Hautpilz');
  return teile;
}

function markerAnzahl(row) {
  return Array.isArray(row?.markierungen) ? row.markierungen.length : 0;
}

function chip(text, art) {
  const farben = {
    warn:    'background:rgba(239,68,68,.14);color:#ef4444;',
    info:    'background:rgba(59,130,246,.14);color:#60a5fa;',
    neutral: 'background:var(--bg-card-solid,#1f2937);color:var(--text-muted);',
  };
  return '<span style="display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;' +
         'border-radius:10px;white-space:nowrap;' + (farben[art] || farben.neutral) + '">' + text + '</span>';
}

/**
 * Das Archiv in einen Container zeichnen.
 *
 * @param {object}   deps                 Abhängigkeiten aus dashboard.js
 * @param {object}   deps.supabase        Supabase-Client
 * @param {function} deps.escapeHtml      HTML-Maskierung
 * @param {function} deps.oeffneEintrag   ({leadId, befundId}) → springt ins Modul
 * @param {string}   leadId               Patient
 * @param {string}   containerId          Ziel-Element
 */
export async function renderFussbefundArchiv(deps, leadId, containerId = 'pdFussbefundArchiv') {
  const wurzel = document.getElementById(containerId);
  if (!wurzel) return;

  if (!leadId) {
    wurzel.innerHTML = leer('Kein Patient ausgewählt.');
    return;
  }

  wurzel.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:14px 0;">Lade Fußbefunde…</div>';

  // Nur die Spalten, die das Archiv zeigt. `befund` ist jsonb und kann groß
  // werden — für eine Liste reicht es, aber es wird nichts darüber hinaus geholt.
  const { data, error } = await deps.supabase
    .from('pat_fussbefund')
    .select('id, erstellt_am, befund, markierungen, notiz, booking_id')
    .eq('lead_id', leadId)
    .order('erstellt_am', { ascending: false });

  if (error) {
    console.error('[fussbefund-archiv] laden:', error.message);
    wurzel.innerHTML = leer('Die Fußbefunde konnten nicht geladen werden.');
    return;
  }

  if (!data || !data.length) {
    wurzel.innerHTML = leer(
      'Für diesen Patienten ist noch kein Fußbefund gespeichert.',
      'Neuen Befund im Modul <strong>Fußbefund</strong> anlegen (linke Navigation).'
    );
    return;
  }

  const esc = deps.escapeHtml || (t => String(t == null ? '' : t));

  const zeilen = data.map(row => {
    const rs   = risiken(row);
    const haut = hautKurz(row);
    const n    = markerAnzahl(row);

    const marken = []
      .concat(rs.map(t => chip(esc(t), 'warn')))
      .concat(haut.map(t => chip(esc(t), 'info')))
      .concat(n ? [chip(n + (n === 1 ? ' Markierung' : ' Markierungen'), 'neutral')] : [])
      .concat(row.booking_id ? [] : [chip('ohne Termin', 'neutral')]);

    const notiz = (row.notiz || '').trim();

    return '' +
      '<tr class="pd-fb-zeile" data-befund="' + esc(row.id) + '" tabindex="0" role="button" ' +
      '    style="cursor:pointer;border-bottom:1px solid var(--border);" ' +
      '    title="Öffnen im Fußbefund-Modul">' +
        '<td style="padding:9px 10px;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:600;">' +
          datumDe(row.erstellt_am) +
        '</td>' +
        '<td style="padding:9px 10px;">' +
          (marken.length
            ? '<div style="display:flex;flex-wrap:wrap;gap:5px;">' + marken.join('') + '</div>'
            : '<span style="font-size:12px;color:var(--text-faint);">keine Auffälligkeiten markiert</span>') +
        '</td>' +
        '<td style="padding:9px 10px;font-size:12px;color:var(--text-muted);max-width:260px;">' +
          (notiz
            ? esc(notiz.length > 90 ? notiz.slice(0, 90) + '…' : notiz)
            : '<span style="color:var(--text-faint);">—</span>') +
        '</td>' +
        '<td style="padding:9px 10px;text-align:right;color:var(--text-muted);" aria-hidden="true">›</td>' +
      '</tr>';
  }).join('');

  wurzel.innerHTML = '' +
    '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">' +
      '<h4 style="margin:0;font-size:14px;color:var(--text-main);">Fußbefunde <span style="font-weight:400;color:var(--text-muted);">(' + data.length + ')</span></h4>' +
      '<span style="font-size:12px;color:var(--text-muted);">Zum Öffnen oder Ändern auf eine Zeile klicken</span>' +
    '</div>' +
    '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;min-width:520px;">' +
        '<thead><tr style="text-align:left;color:var(--text-muted);font-size:12px;">' +
          '<th style="padding:0 10px 6px;font-weight:600;">Datum</th>' +
          '<th style="padding:0 10px 6px;font-weight:600;">Befund</th>' +
          '<th style="padding:0 10px 6px;font-weight:600;">Notiz</th>' +
          '<th></th>' +
        '</tr></thead>' +
        '<tbody>' + zeilen + '</tbody>' +
      '</table>' +
    '</div>';

  const springe = (id) => {
    if (id && typeof deps.oeffneEintrag === 'function') deps.oeffneEintrag({ leadId, befundId: id });
  };

  wurzel.querySelectorAll('.pd-fb-zeile').forEach(tr => {
    tr.addEventListener('click', () => springe(tr.dataset.befund));
    // Tastatur: die Zeile ist als `role="button"` ausgezeichnet, dann muss sie
    // sich auch so verhalten — sonst ist das Archiv nur mit der Maus bedienbar.
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); springe(tr.dataset.befund); }
    });
  });
}

function leer(text, hinweis) {
  return '<div style="padding:18px 0;text-align:center;color:var(--text-muted);font-size:13px;">' +
           text +
           (hinweis ? '<div style="margin-top:6px;font-size:12px;color:var(--text-faint);">' + hinweis + '</div>' : '') +
         '</div>';
}
