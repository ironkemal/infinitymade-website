// Rezeptvorderseite HTML template — prints the front face of a Heilmittelrezept (§32 SGB V).
//
// Renders key prescription data in an A4 print layout with a dashed Stempel box.
// Intended for pre-printing / archiving purposes; not a legally binding re-issue.

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmtDate = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('de-DE');
};

/**
 * @param {object} opts
 * @param {object} opts.praxis          { name, strasse, plz_ort, telefon, ik, steuernummer, email }
 * @param {object} opts.patient         { nachname, vorname, strasse, plz, ort, geburtsdatum, kvnr }
 * @param {object} opts.verordnung      { ausstellungsdatum, krankenkasse, arzt, icd10, heilmittel, frequenz }
 * @param {string} opts.logoUrl
 * @param {string} opts.praxisZusatz    From vorlage content_json.praxis_zusatz
 * @param {string} opts.stempelHinweis  From vorlage content_json.stempel_hinweis
 */
export function renderRezeptvorderseite(opts) {
  const {
    praxis = {}, patient = {}, verordnung = {},
    logoUrl = '',
    praxisZusatz = null, stempelHinweis = null,
  } = opts;

  const hinweis = stempelHinweis || 'Praxisstempel (IK, Name, Anschrift)';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Rezept-Vorderseite — ${escapeHtml(patient.nachname || '')} ${escapeHtml(patient.vorname || '')} ${fmtDate(verordnung.ausstellungsdatum)}</title>
<style>
  @page { size: A4; margin: 18mm 18mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.4 'Inter','Segoe UI',sans-serif; color: #1a1a1a; margin: 0; }
  .doc { max-width: 174mm; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0a4a7a; padding-bottom: 5mm; margin-bottom: 6mm; }
  header .praxis { font-size: 9pt; }
  header h1 { color: #0a4a7a; font-size: 15pt; margin: 0; text-align: right; }
  .section-title { font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; color: #0a4a7a; font-weight: 700; margin: 5mm 0 2mm; border-bottom: 1px solid #d0dae8; padding-bottom: 1mm; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 10mm; font-size: 9.5pt; margin-bottom: 3mm; }
  .grid2 dt { color: #666; }
  .grid2 dd { margin: 0; font-weight: 500; }
  .field-row { display: flex; gap: 6mm; margin-bottom: 3mm; font-size: 9.5pt; }
  .field-row .lbl { color: #666; white-space: nowrap; }
  .field-row .val { font-weight: 500; }
  .stempel-box { border: 2px dashed #aab5c3; border-radius: 4pt; padding: 6mm; min-height: 35mm; margin: 6mm 0; display: flex; flex-direction: column; justify-content: space-between; }
  .stempel-box .hint { font-size: 8pt; color: #999; margin: 0; }
  .stempel-content { font-size: 9.5pt; font-weight: 500; }
  .praxis-zusatz { font-size: 8.5pt; color: #555; margin-top: 2mm; }
  .archiv-hinweis { margin-top: 10mm; padding: 3mm 4mm; border-left: 3px solid #0a4a7a; background: #f3f6fa; font-size: 8pt; color: #555; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="doc">

  <header>
    <div class="praxis">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:45px;max-width:150px;display:block;margin-bottom:5px;" />` : ''}
      <strong>${escapeHtml(praxis.name || '')}</strong><br>
      ${escapeHtml(praxis.strasse || '')}<br>
      ${escapeHtml(praxis.plz_ort || '')}<br>
      Tel.: ${escapeHtml(praxis.telefon || '')}<br>
      IK: ${escapeHtml(praxis.ik || '')}
    </div>
    <div style="text-align:right">
      <h1>Rezept-Vorderseite</h1>
      <div style="font-size:8pt;color:#666;">Heilmittelverordnung gem. § 32 SGB V</div>
    </div>
  </header>

  <!-- Patient -->
  <div class="section-title">Versichertendaten</div>
  <dl class="grid2">
    <dt>Name</dt><dd>${escapeHtml(patient.vorname || '')} ${escapeHtml(patient.nachname || '')}</dd>
    <dt>Geburtsdatum</dt><dd>${fmtDate(patient.geburtsdatum)}</dd>
    <dt>KVNR</dt><dd>${escapeHtml(patient.kvnr || '—')}</dd>
    <dt>Krankenkasse</dt><dd>${escapeHtml(verordnung.krankenkasse || '—')}</dd>
    <dt>Straße</dt><dd>${escapeHtml(patient.strasse || '')}</dd>
    <dt>PLZ / Ort</dt><dd>${escapeHtml(patient.plz || '')} ${escapeHtml(patient.ort || '')}</dd>
  </dl>

  <!-- Verordnung -->
  <div class="section-title">Verordnungsdaten</div>
  <dl class="grid2">
    <dt>Verordnungsdatum</dt><dd>${fmtDate(verordnung.ausstellungsdatum)}</dd>
    <dt>Verordnender Arzt</dt><dd>${escapeHtml(verordnung.arzt || '—')}</dd>
    <dt>Heilmittel</dt><dd>${escapeHtml(verordnung.heilmittel || '—')}</dd>
    <dt>ICD-10 Diagnose</dt><dd>${escapeHtml(verordnung.icd10 || '—')}</dd>
    <dt>Frequenz</dt><dd>${escapeHtml(verordnung.frequenz || '—')}</dd>
  </dl>

  <!-- Praxis-Stempel -->
  <div class="section-title">Praxisstempel</div>
  <div class="stempel-box">
    <div class="stempel-content">
      <strong>${escapeHtml(praxis.name || '')}</strong><br>
      ${escapeHtml(praxis.strasse || '')}<br>
      ${escapeHtml(praxis.plz_ort || '')}<br>
      IK: ${escapeHtml(praxis.ik || '')}
      ${praxisZusatz ? `<div class="praxis-zusatz">${escapeHtml(praxisZusatz)}</div>` : ''}
    </div>
    <p class="hint">${escapeHtml(hinweis)}</p>
  </div>

  <div class="archiv-hinweis">
    Dieses Dokument dient der internen Archivierung. Es handelt sich nicht um eine Neuausstellung
    des Originalrezepts. Das Original verbleibt bei der zuständigen Krankenkasse.
  </div>

</div>
</body>
</html>`;
}
