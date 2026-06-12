// RZG-Quittung HTML template — Rezeptgebühren-Quittung.
//
// Confirms receipt of Zuzahlung for a single Rezept.
// Rendered as A4 but content fits upper ~A5 half so it can be cut and handed to patient.

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
 * @param {object} opts.praxis          { name, strasse, plz_ort, telefon, ik, steuernummer, email }
 * @param {object} opts.patient         { nachname, vorname, kvnr }
 * @param {object} opts.verordnung      { ausstellungsdatum, krankenkasse }
 * @param {object} opts.rechnung        { nummer, datum }
 * @param {Array}  opts.sessions        [{ datum, position, bezeichnung, zuzahlung }]
 * @param {object} opts.totals          { gesZuzahlung }
 * @param {string} opts.logoUrl
 * @param {string} opts.invoiceFooterText
 * @param {string} opts.unterschriftLabel   From vorlage content_json.unterschrift_label
 * @param {string} opts.fusszeile           From vorlage content_json.fusszeile
 */
export function renderRzgQuittung(opts) {
  const {
    praxis = {}, patient = {}, verordnung = {}, rechnung = {},
    sessions = [], totals = {},
    logoUrl = '', invoiceFooterText = '',
    unterschriftLabel = null, fusszeile = null,
  } = opts;

  const signLabel = unterschriftLabel || 'Unterschrift Praxisinhaber/in';
  const footerText = fusszeile || invoiceFooterText || '';

  const sessionRows = sessions.map(s => `
    <tr>
      <td>${fmtDate(s.datum)}</td>
      <td>${escapeHtml(s.position || '')}</td>
      <td>${escapeHtml(s.bezeichnung || '')}</td>
      <td class="num">${fmtEur(s.zuzahlung)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>RZG-Quittung — ${escapeHtml(rechnung.nummer || '')}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.4 'Inter','Segoe UI',sans-serif; color: #1a1a1a; margin: 0; }
  .doc { max-width: 174mm; margin: 0 auto; }
  /* Upper A5-like card with dashed cut line below */
  .card { border: 1px solid #cdd5df; border-radius: 4pt; padding: 8mm; margin-bottom: 6mm; }
  .cut-line { border-top: 1px dashed #aaa; margin: 6mm 0; text-align: center; font-size: 7pt; color: #999; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0a4a7a; padding-bottom: 4mm; margin-bottom: 5mm; }
  header .praxis { font-size: 9pt; }
  header h1 { color: #0a4a7a; font-size: 14pt; margin: 0; text-align: right; }
  .confirm-banner { background: #eef4fb; border: 1px solid #b3cde8; border-radius: 3pt; padding: 3mm 4mm; margin-bottom: 5mm; font-size: 10pt; color: #0a4a7a; font-weight: 600; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 8mm; font-size: 9pt; margin-bottom: 5mm; }
  .meta-grid dt { color: #666; }
  .meta-grid dd { margin: 0; font-weight: 500; }
  table.sessions { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 9.5pt; }
  table.sessions th { background: #f3f6fa; text-align: left; padding: 1.5mm 2.5mm; border-bottom: 2px solid #cdd5df; font-weight: 600; font-size: 8.5pt; }
  table.sessions td { padding: 1.5mm 2.5mm; border-bottom: 1px solid #e6eaef; }
  table.sessions td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row { display: flex; justify-content: flex-end; gap: 12mm; font-size: 11pt; font-weight: 700; margin-top: 3mm; }
  .total-row .label { color: #444; }
  .sign-area { display: flex; gap: 20mm; margin-top: 8mm; }
  .sign-box { flex: 1; }
  .sign-line { border-bottom: 1px solid #333; margin-bottom: 2mm; height: 10mm; }
  .sign-label { font-size: 8pt; color: #666; }
  footer { margin-top: 6mm; padding-top: 3mm; border-top: 1px solid #cdd5df; font-size: 7.5pt; color: #666; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="doc">
<div class="card">

  <header>
    <div class="praxis">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:40px;max-width:130px;display:block;margin-bottom:4px;" />` : ''}
      <strong>${escapeHtml(praxis.name || '')}</strong><br>
      ${escapeHtml(praxis.strasse || '')}<br>
      ${escapeHtml(praxis.plz_ort || '')}<br>
      IK: ${escapeHtml(praxis.ik || '')}
    </div>
    <div style="text-align:right">
      <h1>Quittung</h1>
      <div style="font-size:8pt;color:#666;">Rezeptgebühren gem. § 32 SGB V</div>
    </div>
  </header>

  <div class="confirm-banner">Empfang der Zuzahlung bestätigt</div>

  <dl class="meta-grid">
    <dt>Patient</dt><dd>${escapeHtml(patient.vorname || '')} ${escapeHtml(patient.nachname || '')}</dd>
    <dt>KVNR</dt><dd>${escapeHtml(patient.kvnr || '—')}</dd>
    <dt>Krankenkasse</dt><dd>${escapeHtml(verordnung.krankenkasse || '—')}</dd>
    <dt>Verordnung vom</dt><dd>${fmtDate(verordnung.ausstellungsdatum)}</dd>
    <dt>Quittungsnummer</dt><dd>${escapeHtml(rechnung.nummer || '')}</dd>
    <dt>Datum</dt><dd>${fmtDate(rechnung.datum)}</dd>
  </dl>

  <table class="sessions">
    <thead>
      <tr>
        <th>Datum</th>
        <th>Pos.-Nr.</th>
        <th>Leistung</th>
        <th class="num">Zuzahlung</th>
      </tr>
    </thead>
    <tbody>
      ${sessionRows}
    </tbody>
  </table>

  <div class="total-row">
    <span class="label">Erhaltener Betrag:</span>
    <span>${fmtEur(totals.gesZuzahlung ?? totals.gesamt ?? 0)}</span>
  </div>

  <div class="sign-area">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">Datum, ${escapeHtml(signLabel)}</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">Datum, Unterschrift Patient/in</div>
    </div>
  </div>

  ${footerText ? `<footer>${escapeHtml(footerText).replace(/\n/g, '<br>')}</footer>` : ''}

</div>
<div class="cut-line">✂ &nbsp; Hier trennen &nbsp; ✂</div>
</div>
</body>
</html>`;
}
