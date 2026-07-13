// Ausfallrechnung HTML template — private no-show / late-cancel fee invoice.
//
// Legal framing: Ausfallhonorar is Schadensersatz (not a medical service),
// therefore umsatzsteuerfrei and NOT billable to the Krankenkasse. It is only
// enforceable if the patient signed an Ausfallvereinbarung beforehand — the
// invoice must reference that agreement, never the word "Behandlung" as the
// billed item.
//
// Print flow identical to zuzahlungsrechnung.template.js: browser print-to-PDF.

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
const fmtTime = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
};

const REASON_LABELS = {
  no_show: 'Nicht wahrgenommener Termin (unentschuldigtes Fernbleiben)',
  late_cancel: 'Kurzfristige Terminabsage',
};

/**
 * @param {object} opts
 * @param {object} opts.praxis    { name, strasse, plz_ort, telefon, steuernummer, email }
 * @param {object} opts.patient   { nachname, vorname, strasse, plz, ort }
 * @param {object} opts.rechnung  { nummer, datum, faelligkeit }
 * @param {object} opts.termin    { datum (Date/ISO), leistung, reason ('no_show'|'late_cancel') }
 * @param {number} opts.amount_eur
 * @param {string} [opts.bankverbindung]
 * @param {string} [opts.hinweisText]        custom clause text (businesses.ausfall_hinweis)
 * @param {string} [opts.invoiceFooterText]
 * @param {string} [opts.logoUrl]
 */
export function renderAusfallrechnung(opts) {
  const {
    praxis = {}, patient = {}, rechnung = {}, termin = {},
    amount_eur = 0, bankverbindung = '',
    hinweisText = null, invoiceFooterText = '', logoUrl = '',
  } = opts;

  const reasonLabel = REASON_LABELS[termin.reason] || REASON_LABELS.no_show;

  const hinweisContent = hinweisText
    ? escapeHtml(hinweisText)
    : 'Der reservierte Termin wurde nicht wahrgenommen bzw. nicht fristgerecht abgesagt. ' +
      'Gemäß der mit Ihnen getroffenen Ausfallvereinbarung stellen wir Ihnen hierfür ein Ausfallhonorar in Rechnung. ' +
      'Es handelt sich um Schadensersatz — eine Erstattung durch die Krankenkasse ist nicht möglich.';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Ausfallrechnung — ${escapeHtml(rechnung.nummer || '')}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.4 'Inter','Segoe UI',sans-serif; color: #1a1a1a; margin: 0; }
  .doc { max-width: 174mm; margin: 0 auto; }
  header { display: flex; justify-content: space-between; border-bottom: 2px solid #7a3a0a; padding-bottom: 6mm; }
  header .praxis { font-size: 9pt; }
  header h1 { color: #7a3a0a; font-size: 16pt; margin: 0 0 4mm 0; }
  .addresses { display: flex; gap: 30mm; margin: 12mm 0 8mm; }
  .addresses .box { flex: 1; }
  .addresses .label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2mm; }
  .invoice-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 10mm; font-size: 9pt; margin-bottom: 6mm; }
  .invoice-meta dt { color: #666; }
  .invoice-meta dd { margin: 0; font-weight: 500; }
  table.pos { width: 100%; border-collapse: collapse; margin: 6mm 0; font-size: 10pt; }
  table.pos th { background: #faf5f0; text-align: left; padding: 2mm 3mm; border-bottom: 2px solid #dfd0c4; font-weight: 600; font-size: 9pt; }
  table.pos td { padding: 2mm 3mm; border-bottom: 1px solid #efe6dd; }
  table.pos td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 80mm; font-size: 10pt; }
  .totals .row { display: flex; justify-content: space-between; padding: 1.5mm 0; }
  .totals .row.sum { border-top: 2px solid #7a3a0a; margin-top: 2mm; padding-top: 3mm; font-weight: 700; font-size: 12pt; }
  .totals .num { font-variant-numeric: tabular-nums; }
  .hinweis { background: #fff8e6; border: 1px solid #f4d56b; border-radius: 3pt; padding: 4mm; margin: 8mm 0; font-size: 9pt; }
  .ust { font-size: 9pt; color: #444; margin: 4mm 0; }
  footer { margin-top: 14mm; padding-top: 4mm; border-top: 1px solid #dfd0c4; font-size: 8pt; color: #666; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="doc">

  <header>
    <div class="praxis">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:50px;max-width:160px;display:block;margin-bottom:6px;" />` : ''}
      <strong>${escapeHtml(praxis.name || '')}</strong><br>
      ${escapeHtml(praxis.strasse || '')}<br>
      ${escapeHtml(praxis.plz_ort || '')}<br>
      Tel.: ${escapeHtml(praxis.telefon || '')}
    </div>
    <div style="text-align:right">
      <h1>Ausfallrechnung</h1>
      <div style="font-size:9pt;color:#666;">Ausfallhonorar gemäß Ausfallvereinbarung</div>
    </div>
  </header>

  <section class="addresses">
    <div class="box">
      <div class="label">Rechnungsempfänger</div>
      <strong>${escapeHtml(patient.vorname || '')} ${escapeHtml(patient.nachname || '')}</strong><br>
      ${escapeHtml(patient.strasse || '')}<br>
      ${escapeHtml(patient.plz || '')} ${escapeHtml(patient.ort || '')}
    </div>
    <div class="box">
      <dl class="invoice-meta">
        <dt>Rechnungsnummer</dt><dd>${escapeHtml(rechnung.nummer || '')}</dd>
        <dt>Rechnungsdatum</dt><dd>${fmtDate(rechnung.datum)}</dd>
        <dt>Fällig am</dt><dd>${fmtDate(rechnung.faelligkeit)}</dd>
        <dt>Termin am</dt><dd>${fmtDate(termin.datum)}${termin.datum ? ', ' + fmtTime(termin.datum) + ' Uhr' : ''}</dd>
      </dl>
    </div>
  </section>

  <table class="pos">
    <thead>
      <tr>
        <th>Termin</th>
        <th>Grund</th>
        <th>Reservierte Leistung</th>
        <th class="num">Betrag</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${fmtDate(termin.datum)}</td>
        <td>${escapeHtml(reasonLabel)}</td>
        <td>${escapeHtml(termin.leistung || 'Reservierter Behandlungstermin')}</td>
        <td class="num">${fmtEur(amount_eur)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="row sum"><span>Zu zahlen</span><span class="num">${fmtEur(amount_eur)}</span></div>
  </div>

  <p class="ust">
    Das Ausfallhonorar ist Schadensersatz und unterliegt nicht der Umsatzsteuer
    (kein Leistungsaustausch i.S.d. § 1 Abs. 1 Nr. 1 UStG).
  </p>

  <p class="hinweis">
    <strong>Hinweis:</strong> ${hinweisContent}
  </p>

  <footer>
    ${invoiceFooterText
      ? `<div style="grid-column:1/-1;font-size:8pt;color:#555;">${escapeHtml(invoiceFooterText).replace(/\n/g, '<br>')}</div>`
      : `<div>
      <strong>${escapeHtml(praxis.name || '')}</strong><br>
      Steuer-Nr.: ${escapeHtml(praxis.steuernummer || '')}<br>
      E-Mail: ${escapeHtml(praxis.email || '')}
    </div>
    <div>
      <strong>Bankverbindung</strong><br>
      ${escapeHtml(bankverbindung)}
    </div>
    <div>
      <strong>Zahlungsweise</strong><br>
      Bitte überweisen Sie den Betrag bis zum
      <strong>${fmtDate(rechnung.faelligkeit)}</strong> unter Angabe der
      Rechnungsnummer <strong>${escapeHtml(rechnung.nummer || '')}</strong>.
    </div>`}
  </footer>

</div>
</body>
</html>`;
}
