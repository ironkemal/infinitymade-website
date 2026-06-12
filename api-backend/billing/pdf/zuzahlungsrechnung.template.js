// Zuzahlungsrechnung HTML template for §32 SGB V Heilmittel.
//
// Produces a print-ready A4 invoice that the practice gives to the patient.
// Browser print-to-PDF or html2pdf.js converts to PDF. No server-side
// puppeteer dependency.
//
// Required by §14 UStG and Bundesvertrag §125 SGB V.

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

/**
 * @param {object} opts
 * @param {object} opts.praxis        { name, strasse, plz_ort, telefon, ik, steuernummer, email }
 * @param {object} opts.patient       { nachname, vorname, strasse, plz, ort, geburtsdatum, kvnr }
 * @param {object} opts.verordnung    { ausstellungsdatum, krankenkasse, arzt }
 * @param {object} opts.rechnung      { nummer, datum, faelligkeit }
 * @param {Array}  opts.sessions      [{ datum, position, bezeichnung, brutto, zuzahlung }]
 * @param {object} opts.totals        { brutto, prozZuzahlung, pauschZuzahlung, gesZuzahlung }
 * @param {string} opts.bankverbindung
 */
export function renderZuzahlungsrechnung(opts) {
  const {
    praxis = {}, patient = {}, verordnung = {}, rechnung = {},
    sessions = [], totals = {}, bankverbindung = '',
    logoUrl = '', invoiceFooterText = '',
  } = opts;

  const sessionRows = sessions.map(s => `
    <tr>
      <td>${fmtDate(s.datum)}</td>
      <td>${escapeHtml(s.position || '')}</td>
      <td>${escapeHtml(s.bezeichnung || '')}</td>
      <td class="num">${fmtEur(s.brutto)}</td>
      <td class="num">${fmtEur(s.zuzahlung)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Zuzahlungsrechnung — ${escapeHtml(rechnung.nummer || '')}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.4 'Inter','Segoe UI',sans-serif; color: #1a1a1a; margin: 0; }
  .doc { max-width: 174mm; margin: 0 auto; }
  header { display: flex; justify-content: space-between; border-bottom: 2px solid #0a4a7a; padding-bottom: 6mm; }
  header .praxis { font-size: 9pt; }
  header h1 { color: #0a4a7a; font-size: 16pt; margin: 0 0 4mm 0; }
  .addresses { display: flex; gap: 30mm; margin: 12mm 0 8mm; }
  .addresses .box { flex: 1; }
  .addresses .label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2mm; }
  .invoice-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 10mm; font-size: 9pt; margin-bottom: 6mm; }
  .invoice-meta dt { color: #666; }
  .invoice-meta dd { margin: 0; font-weight: 500; }
  table.sessions { width: 100%; border-collapse: collapse; margin: 6mm 0; font-size: 10pt; }
  table.sessions th { background: #f3f6fa; text-align: left; padding: 2mm 3mm; border-bottom: 2px solid #cdd5df; font-weight: 600; font-size: 9pt; }
  table.sessions td { padding: 2mm 3mm; border-bottom: 1px solid #e6eaef; }
  table.sessions td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 80mm; font-size: 10pt; }
  .totals .row { display: flex; justify-content: space-between; padding: 1.5mm 0; }
  .totals .row.sum { border-top: 2px solid #0a4a7a; margin-top: 2mm; padding-top: 3mm; font-weight: 700; font-size: 12pt; }
  .totals .label { color: #444; }
  .totals .num { font-variant-numeric: tabular-nums; }
  .hinweis { background: #fff8e6; border: 1px solid #f4d56b; border-radius: 3pt; padding: 4mm; margin: 8mm 0; font-size: 9pt; }
  footer { margin-top: 14mm; padding-top: 4mm; border-top: 1px solid #cdd5df; font-size: 8pt; color: #666; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6mm; }
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
      Tel.: ${escapeHtml(praxis.telefon || '')}<br>
      IK: ${escapeHtml(praxis.ik || '')}
    </div>
    <div style="text-align:right">
      <h1>Zuzahlung Heilmittel</h1>
      <div style="font-size:9pt;color:#666;">gem. §32 Abs. 2 SGB V</div>
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
        <dt>Patient KVNR</dt><dd>${escapeHtml(patient.kvnr || '')}</dd>
        <dt>Krankenkasse</dt><dd>${escapeHtml(verordnung.krankenkasse || '')}</dd>
        <dt>Verordnung vom</dt><dd>${fmtDate(verordnung.ausstellungsdatum)}</dd>
      </dl>
    </div>
  </section>

  <table class="sessions">
    <thead>
      <tr>
        <th>Datum</th>
        <th>Pos.-Nr.</th>
        <th>Leistung</th>
        <th class="num">Brutto</th>
        <th class="num">Zuzahlung</th>
      </tr>
    </thead>
    <tbody>
      ${sessionRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span class="label">Bruttosumme</span><span class="num">${fmtEur(totals.brutto)}</span></div>
    <div class="row"><span class="label">10 % prozentuale Zuzahlung</span><span class="num">${fmtEur(totals.prozZuzahlung)}</span></div>
    <div class="row"><span class="label">Verordnungspauschale (10 €)</span><span class="num">${fmtEur(totals.pauschZuzahlung)}</span></div>
    <div class="row sum"><span>Zu zahlen</span><span class="num">${fmtEur(totals.gesZuzahlung)}</span></div>
  </div>

  <p class="hinweis">
    <strong>Hinweis:</strong> Die Zuzahlung ist gesetzlich vorgeschrieben (§ 32 Abs. 2 i.V.m. § 61 SGB V). Wenden Sie sich an Ihre Krankenkasse,
    wenn Sie wegen Erreichens der Belastungsgrenze (§ 62 SGB V) von der Zuzahlung befreit sind — die Befreiungsbescheinigung kann auch noch
    nachgereicht werden. Versicherte unter 18 Jahren sind grundsätzlich zuzahlungsfrei.
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
