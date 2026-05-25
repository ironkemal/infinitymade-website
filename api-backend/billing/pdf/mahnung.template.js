// Mahnung (dunning letter) HTML template — print-ready A4, German standard.
// Level 1 = Zahlungserinnerung (friendly), Level 2 = 1. Mahnung, Level 3 = 2. Mahnung.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtEur = (n) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtDate = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt) ? '' : dt.toLocaleDateString('de-DE');
};

const LEVEL_META = {
  1: { title: 'Zahlungserinnerung',    salutation: 'freundliche Erinnerung',  tone: 'friendly',  color: '#1d4ed8' },
  2: { title: '1. Mahnung',            salutation: 'erste Mahnung',           tone: 'firm',      color: '#d97706' },
  3: { title: '2. Mahnung (letzte)',   salutation: 'letzte Mahnung',          tone: 'final',     color: '#dc2626' },
};

const TONE_BODY = {
  friendly: (p, fällig) => `wir möchten Sie freundlich daran erinnern, dass folgende Zuzahlungsrechnung noch offen ist. Möglicherweise hat Ihre Zahlung unsere Buchung noch nicht erreicht. Bitte begleichen Sie den ausstehenden Betrag bis zum <strong>${fällig}</strong>.`,
  firm:     (p, fällig) => `trotz unserer Zahlungserinnerung haben wir bisher keinen Zahlungseingang feststellen können. Wir bitten Sie dringend, den offenen Betrag bis zum <strong>${fällig}</strong> zu begleichen, um weitere Schritte zu vermeiden.`,
  final:    (p, fällig) => `leider ist der ausstehende Betrag trotz unserer vorherigen Mahnung immer noch nicht bei uns eingegangen. Dies ist unsere letzte Mahnung. Sollten wir bis zum <strong>${fällig}</strong> keinen Zahlungseingang verbuchen können, sehen wir uns gezwungen, das Inkassobüro einzuschalten.`,
};

/**
 * @param {object} opts
 * @param {object} opts.praxis         { name, strasse, plz_ort, telefon, email, ik }
 * @param {object} opts.patient        { vorname, nachname, strasse, plz, ort }
 * @param {number} opts.level          1 | 2 | 3
 * @param {number} opts.mahnung_nr
 * @param {number} opts.amount_eur
 * @param {string} opts.original_rechnung_nr   e.g. "ZU-3A9B1234"
 * @param {Date|string} opts.original_faelligkeit
 * @param {Date|string} opts.neue_faelligkeit
 * @param {string} opts.bankverbindung
 * @param {Date|string} opts.datum             letter date (default: today)
 */
export function renderMahnung(opts) {
  const {
    praxis = {}, patient = {}, level = 1,
    mahnung_nr = 1, amount_eur = 0,
    original_rechnung_nr = '', original_faelligkeit,
    neue_faelligkeit, bankverbindung = '',
    datum = new Date(),
  } = opts;

  const meta = LEVEL_META[level] || LEVEL_META[1];
  const bodyText = TONE_BODY[meta.tone](patient, fmtDate(neue_faelligkeit));
  const letterDate = fmtDate(datum);

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${esc(meta.title)} – ${esc(praxis.name)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11pt;color:#111;background:#fff;}
  .page{width:210mm;min-height:297mm;margin:0 auto;padding:20mm 22mm 20mm 25mm;}
  .sender-line{font-size:8pt;color:#555;border-bottom:1px solid #555;padding-bottom:2px;margin-bottom:18pt;}
  .recipient{margin-bottom:24pt;line-height:1.6;}
  .meta-row{display:flex;justify-content:space-between;margin-bottom:24pt;font-size:9.5pt;color:#555;}
  .subject{font-size:13pt;font-weight:700;color:${meta.color};margin-bottom:6pt;}
  .mahnung-badge{display:inline-block;background:${meta.color};color:#fff;font-size:8.5pt;font-weight:700;
    padding:2px 8px;border-radius:3px;margin-bottom:16pt;}
  p{margin-bottom:10pt;line-height:1.55;}
  .invoice-box{border:1px solid #d1d5db;border-radius:4px;padding:12pt 16pt;margin:16pt 0;background:#f9fafb;}
  .invoice-box table{width:100%;border-collapse:collapse;}
  .invoice-box td{padding:4pt 0;font-size:10.5pt;}
  .invoice-box td:last-child{text-align:right;font-weight:600;}
  .total-row td{border-top:1px solid #d1d5db;padding-top:8pt;font-size:12pt;}
  .bank-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;padding:10pt 14pt;margin:14pt 0;font-size:9.5pt;}
  .bank-box strong{display:block;margin-bottom:4pt;font-size:10pt;}
  .usage{font-style:italic;color:#374151;}
  .footer-note{margin-top:20pt;font-size:8.5pt;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:8pt;}
  .sig-block{margin-top:32pt;}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .page{padding:15mm 20mm 15mm 25mm;}
  }
</style>
</head>
<body>
<div class="page">

  <!-- Sender small line -->
  <div class="sender-line">${esc(praxis.name)} · ${esc(praxis.strasse)} · ${esc(praxis.plz_ort)} · ${esc(praxis.telefon)}</div>

  <!-- Recipient block -->
  <div class="recipient">
    <div>${esc(patient.vorname)} ${esc(patient.nachname)}</div>
    <div>${esc(patient.strasse)}</div>
    <div>${esc(patient.plz)} ${esc(patient.ort)}</div>
  </div>

  <!-- Date / Reference -->
  <div class="meta-row">
    <span>Mahnung-Nr.: <strong>MN-${String(mahnung_nr).padStart(6, '0')}</strong></span>
    <span>${esc(praxis.plz_ort)}, ${letterDate}</span>
  </div>

  <!-- Subject -->
  <div class="mahnung-badge">${esc(meta.title)}</div>
  <div class="subject">${esc(meta.title)}: Offene Zuzahlung – ${esc(original_rechnung_nr)}</div>

  <!-- Salutation & body -->
  <p>Sehr geehrte/r ${esc(patient.vorname)} ${esc(patient.nachname)},</p>
  <p>${bodyText}</p>

  <!-- Invoice summary -->
  <div class="invoice-box">
    <table>
      <tr>
        <td>Ursprüngliche Rechnungsnummer:</td>
        <td>${esc(original_rechnung_nr)}</td>
      </tr>
      <tr>
        <td>Ursprüngliches Fälligkeitsdatum:</td>
        <td>${fmtDate(original_faelligkeit)}</td>
      </tr>
      <tr class="total-row">
        <td><strong>Ausstehender Betrag (Zuzahlung):</strong></td>
        <td><strong>${fmtEur(amount_eur)}</strong></td>
      </tr>
      <tr>
        <td>Neues Zahlungsziel:</td>
        <td><strong>${fmtDate(neue_faelligkeit)}</strong></td>
      </tr>
    </table>
  </div>

  <!-- Bank details -->
  <div class="bank-box">
    <strong>Bitte überweisen Sie auf folgendes Konto:</strong>
    ${esc(bankverbindung)}<br>
    <span class="usage">Verwendungszweck: ${esc(original_rechnung_nr)} / ${esc(patient.nachname)}</span>
  </div>

  <p>Für Rückfragen stehen wir Ihnen gerne zur Verfügung unter <strong>${esc(praxis.telefon)}</strong> oder <strong>${esc(praxis.email)}</strong>.</p>

  <p>Bitte beachten Sie, dass bei weiterhin ausbleibender Zahlung weitere rechtliche Schritte eingeleitet werden müssen, die mit zusätzlichen Kosten verbunden sein können.</p>

  <!-- Signature -->
  <div class="sig-block">
    <p>Mit freundlichen Grüßen,</p>
    <br>
    <p><strong>${esc(praxis.name)}</strong></p>
  </div>

  <div class="footer-note">
    Dieses Schreiben wurde maschinell erstellt und ist ohne Unterschrift gültig. · IK-Nr.: ${esc(praxis.ik)} · ${esc(praxis.email)}
  </div>

</div>
</body>
</html>`;
}
