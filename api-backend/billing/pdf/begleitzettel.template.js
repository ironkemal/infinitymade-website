// Begleitzettel HTML template for Urbeleg-Postversand.
//
// Begleitzettel = Papierbeleg, der den unterschriebenen Original-Verordnungen
// beiliegt. Pflicht nach Anlage 4 zu § 302 SGB V.
//
// EINER JE GESAMTRECHNUNG — nicht je Datei (geändert 07.09.2026, Ops #283).
// Eine DTA-Datei kann mehrere Gesamtrechnungen enthalten: je Karten-IK eine.
// Jede davon ist eine eigene Rechnung mit eigener Rechnungsnummer und eigenen
// Summen, also braucht jede ihren eigenen Begleitzettel. Vorher entstand einer
// je Datei, mit der Kostenträger-IK im Feld „IK Krankenkasse" und der
// Sammelrechnungsnummer statt der Einzelrechnungsnummer — drei Felder, die
// nicht zu der Rechnung passten, der sie beilagen.
//
// Ausgeliefert wird EINE HTML-Datei mit einer Seite je Gesamtrechnung
// (`page-break-before`). Der Ausdruck lässt sich blattweise trennen und in die
// jeweiligen Umschläge legen; die Praxis muss nichts zusammensuchen.
//
// ⚠️ Die Adresse der Datenannahmestelle steht hier BEWUSST NICHT.
// Die Urbelege gehen zur Papierannahmestelle (Verknüpfungsart 09), nicht zur
// Datenannahmestelle (02/03), an die die Datei elektronisch geht. Anlage 4
// verlangt das Feld nicht — lieber leer als falsch adressiert.

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmtEur = (n) => (n == null ? '' : Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €';
const fmtDate = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('de-DE');
};

const STYLE = `
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font: 10pt/1.4 'Inter','Segoe UI',sans-serif; color: #1a1a1a; margin: 0; }
  .doc { max-width: 174mm; margin: 0 auto; }
  .blatt + .blatt { page-break-before: always; margin-top: 16mm; }
  header { border-bottom: 2px solid #0a4a7a; padding-bottom: 4mm; margin-bottom: 6mm; }
  header h1 { color: #0a4a7a; font-size: 18pt; margin: 0; }
  header .sub { color: #555; font-size: 9pt; }
  header .zaehler { float: right; font-size: 9pt; color: #0a4a7a; font-weight: 600; }
  .addresses { display: flex; gap: 30mm; margin: 6mm 0; }
  .addresses .box { flex: 1; padding: 3mm; border: 1px solid #cdd5df; border-radius: 3pt; background: #fafbfc; }
  .addresses .label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2mm; }
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4mm; margin: 6mm 0 4mm; font-size: 9pt; }
  .meta .item { padding: 2mm 3mm; background: #f3f6fa; border-radius: 3pt; }
  .meta .label { font-size: 8pt; color: #666; }
  .meta .value { font-weight: 600; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #f3f6fa; text-align: left; padding: 1.5mm 2mm; border-bottom: 2px solid #cdd5df; font-weight: 600; }
  td { padding: 1.5mm 2mm; border-bottom: 1px solid #e6eaef; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { display: flex; justify-content: space-between; margin-top: 6mm; padding: 4mm; background: #eaf2fb; border-radius: 3pt; font-size: 11pt; }
  .totals .label { color: #444; font-size: 9pt; }
  .totals .value { font-weight: 700; font-variant-numeric: tabular-nums; font-size: 13pt; color: #0a4a7a; }
  .checklist { margin-top: 10mm; padding: 4mm; border: 1px dashed #999; }
  .checklist h3 { margin: 0 0 3mm; font-size: 10pt; }
  .checklist ul { margin: 0; padding-left: 5mm; font-size: 9pt; line-height: 1.6; }
  .signature { margin-top: 14mm; display: flex; gap: 20mm; }
  .signature .line { flex: 1; border-top: 1px solid #1a1a1a; padding-top: 1.5mm; font-size: 8pt; color: #666; }

  /* Screen-only toolbar (hidden in print/PDF output) */
  .no-print {
    position: sticky; top: 0; z-index: 10;
    background: #0a4a7a; color: #fff;
    padding: 10px 16px; margin: -18mm -18mm 8mm;
    display: flex; align-items: center; justify-content: space-between;
    font-family: 'Inter','Segoe UI',sans-serif; font-size: 11pt;
  }
  .no-print .hint { font-size: 9pt; opacity: .9; }
  .no-print button {
    background: #fff; color: #0a4a7a; border: 0;
    padding: 7px 14px; border-radius: 4px; font-weight: 600; cursor: pointer;
    font-size: 11pt;
  }
  .no-print button:hover { background: #e6eaef; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
`;

const DRUCK_SKRIPT = `
  // Auto-open print dialog once page + fonts are ready.
  // ?autoprint=0 → skip (e.g. when opened from history just to view).
  (function () {
    var params = new URLSearchParams(window.location.search || '');
    if (params.get('autoprint') === '0') return;
    var fire = function () { setTimeout(function () { window.print(); }, 250); };
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(fire).catch(fire);
    } else if (document.readyState === 'complete') {
      fire();
    } else {
      window.addEventListener('load', fire, { once: true });
    }
  })();
`;

/**
 * Ein Blatt = eine Gesamtrechnung.
 *
 * @param {object} opts
 * @param {object} opts.praxis      { name, strasse, plz_ort, telefon, ik }
 * @param {object} opts.abrechnung  {
 *   dateiname,           // 'EHK5678900000023' — die Datei, in der diese Rechnung steckt
 *   rechnungsnummer,     // Einzel-Rechnungsnummer DIESER Gesamtrechnung (= SLGA.REC)
 *   datum, abrechnungsmonat, leistungsbereich,
 *   prescription_count,  // Urbelege DIESER Gesamtrechnung
 *   total_brutto, total_zuzahlung, total_netto,
 *   krankenkasse_name,   // Name zur Karten-IK
 *   krankenkasse_ik,     // Karten-IK des Versicherten (SLGA.FKT Feld 5)
 *   kostentraeger_name,  // Rechnungsadressat
 *   kostentraeger_ik,    // Kostenträger-IK        (SLGA.FKT Feld 4)
 * }
 * @param {Array} opts.belege
 * @param {{nummer:number,von:number}} [opts.blatt]  Seitenzähler bei mehreren Blättern
 */
function renderBlatt({ praxis = {}, abrechnung = {}, belege = [], blatt = null }) {
  const belegRows = belege.map((b, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${escapeHtml(b.belegnummer || '')}</td>
      <td>${escapeHtml(b.patient_nachname || '')}, ${escapeHtml(b.patient_vorname || '')}</td>
      <td>${fmtDate(b.verordnungsdatum)}</td>
      <td class="num">${fmtEur(b.brutto)}</td>
    </tr>
  `).join('');

  const zaehler = blatt
    ? `<div class="zaehler">Gesamtrechnung ${blatt.nummer} von ${blatt.von}</div>`
    : '';

  return `
  <section class="blatt">

  <header>
    ${zaehler}
    <h1>Begleitzettel zur Gesamtrechnung</h1>
    <div class="sub">gem. Anlage 4 zur Vereinbarung nach § 302 SGB V — Urbelege zur elektronisch übermittelten Datei</div>
  </header>

  <section class="addresses">
    <div class="box">
      <div class="label">Absender (Leistungserbringer)</div>
      <strong>${escapeHtml(praxis.name || '')}</strong><br>
      ${escapeHtml(praxis.strasse || '')}<br>
      ${escapeHtml(praxis.plz_ort || '')}<br>
      IK: ${escapeHtml(praxis.ik || '')}<br>
      Tel.: ${escapeHtml(praxis.telefon || '')}
    </div>
    <div class="box">
      <div class="label">Rechnungsempfänger (Kostenträger)</div>
      <strong>${escapeHtml(abrechnung.kostentraeger_name || '')}</strong><br>
      IK: ${escapeHtml(abrechnung.kostentraeger_ik || '')}
    </div>
  </section>

  <div class="meta">
    <div class="item"><div class="label">Dateiname (DTA)</div><div class="value">${escapeHtml(abrechnung.dateiname || '')}</div></div>
    <div class="item"><div class="label">Rechnungsnummer</div><div class="value">${escapeHtml(abrechnung.rechnungsnummer || '')}</div></div>
    <div class="item"><div class="label">Rechnungsdatum</div><div class="value">${fmtDate(abrechnung.datum)}</div></div>
    <div class="item"><div class="label">Abrechnungsmonat</div><div class="value">${escapeHtml(abrechnung.abrechnungsmonat || '')}</div></div>
    <div class="item"><div class="label">Krankenkasse (KV-Karte)</div><div class="value">${escapeHtml(abrechnung.krankenkasse_name || '')}</div></div>
    <div class="item"><div class="label">IK der Krankenkasse (KV-Karte)</div><div class="value">${escapeHtml(abrechnung.krankenkasse_ik || '')}</div></div>
    <div class="item"><div class="label">Leistungsbereich</div><div class="value">${escapeHtml(abrechnung.leistungsbereich || 'B')} (Heilmittel)</div></div>
    <div class="item"><div class="label">Anzahl Belege</div><div class="value">${escapeHtml(String(abrechnung.prescription_count ?? belege.length))}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Belegnr.</th>
        <th>Versicherter</th>
        <th>Verordnungsdatum</th>
        <th class="num">Brutto</th>
      </tr>
    </thead>
    <tbody>
      ${belegRows}
    </tbody>
  </table>

  <div class="totals">
    <div><div class="label">Brutto gesamt</div><div class="value">${fmtEur(abrechnung.total_brutto)}</div></div>
    <div><div class="label">Zuzahlung gesamt</div><div class="value">${fmtEur(abrechnung.total_zuzahlung)}</div></div>
    <div><div class="label">Rechnungsbetrag (Netto)</div><div class="value">${fmtEur(abrechnung.total_netto)}</div></div>
  </div>

  <div class="checklist">
    <h3>Checkliste — bitte vor dem Versand prüfen</h3>
    <ul>
      <li>Alle ${escapeHtml(String(belege.length))} Original-Verordnungen dieser Gesamtrechnung liegen in der angegebenen Reihenfolge bei.</li>
      <li>Jede Verordnung ist von der/dem Versicherten an jeder Behandlung mit Datum und Unterschrift quittiert.</li>
      <li>Bei Hausbesuch-Pauschalen (X9922/X9950/X9951) ist der Hausbesuchsnachweis beigefügt.</li>
      <li>DTA-Datei <strong>${escapeHtml(abrechnung.dateiname || '')}</strong> wurde im Portal der Datenannahmestelle hochgeladen.</li>
      <li>Belege sind nach Belegnummer aufsteigend sortiert.</li>
      ${blatt ? `<li><strong>Dieser Umschlag enthält nur die Belege der Gesamtrechnung ${escapeHtml(abrechnung.rechnungsnummer || '')} (IK ${escapeHtml(abrechnung.krankenkasse_ik || '')}).</strong></li>` : ''}
    </ul>
  </div>

  <div class="signature">
    <div class="line">Datum, Stempel und Unterschrift Leistungserbringer</div>
    <div class="line">Eingang bei der Annahmestelle (intern)</div>
  </div>

  </section>`;
}

function huelle({ titel, blaetter, hinweis }) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${escapeHtml(titel)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="doc">

  <div class="no-print">
    <div>
      <strong>Begleitzettel</strong>
      <div class="hint">${hinweis}</div>
    </div>
    <button type="button" onclick="window.print()">🖨️ Drucken / PDF speichern</button>
  </div>
${blaetter.join('\n')}

</div>
<script>${DRUCK_SKRIPT}</script>
</body>
</html>`;
}

/** Ein einzelner Begleitzettel (eine Gesamtrechnung). */
export function renderBegleitzettel(opts) {
  return huelle({
    titel:   `Begleitzettel — ${opts?.abrechnung?.dateiname || ''}`,
    blaetter: [renderBlatt(opts)],
    hinweis: 'Im Druckdialog &bdquo;Ziel &rarr; Als PDF speichern&ldquo; wählen und den Urbelegen beilegen.',
  });
}

/**
 * Mehrere Gesamtrechnungen einer Datei — ein Blatt je Gesamtrechnung.
 * @param {object} opts
 * @param {Array} opts.blaetter  je Eintrag ein renderBlatt()-opts (ohne `blatt`)
 * @param {string} [opts.dateiname]
 */
export function renderBegleitzettelBundle({ blaetter = [], dateiname = '' }) {
  if (blaetter.length === 1) return renderBegleitzettel(blaetter[0]);
  return huelle({
    titel:   `Begleitzettel — ${dateiname} (${blaetter.length} Gesamtrechnungen)`,
    blaetter: blaetter.map((b, i) =>
      renderBlatt({ ...b, blatt: { nummer: i + 1, von: blaetter.length } })),
    hinweis: `${blaetter.length} Gesamtrechnungen — jede Seite geh&ouml;rt in einen eigenen Umschlag. ` +
             'Im Druckdialog &bdquo;Ziel &rarr; Als PDF speichern&ldquo; w&auml;hlen.',
  });
}
