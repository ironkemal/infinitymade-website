/**
 * termin-druck.js — Terminzettel für den Patienten, DIN A5.
 *
 * Warum es das gibt
 * ─────────────────
 * Nach dem Vergeben einer Terminserie fragt der Patient nach einem Zettel.
 * Bis hierher gab es keinen (Nausad, 12.08.2026: „ob ich das ausdrucken kann,
 * auch in DIN A5, und dem Patienten geben kann?"). Die Praxis half sich mit
 * handschriftlichen Karten — und jeder abgeschriebene Termin ist ein Termin,
 * der falsch abgeschrieben werden kann.
 *
 * A5 ist bewusst kein Kompromiss: das Blatt passt gefaltet in ein Portemonnaie
 * und lässt sich zu zweit auf einen A4-Bogen legen, ohne dass die Praxis
 * Spezialpapier kaufen muss (`@page { size: A5 }` — der Treiber übernimmt).
 *
 * Bewusst OHNE Diagnose, ICD und Verordnungsdaten: der Zettel verlässt die
 * Praxis und wird verloren. Es steht nur darauf, was der Patient braucht —
 * wann, wo, bei wem. Das ist auch die datenschutzsparsame Variante
 * (Art. 5 Abs. 1 lit. c DSGVO).
 *
 * Kein Server, kein PDF-Dienst: ein eigenes Fenster, Browser-Druck. Damit
 * funktioniert der Zettel auch in der On-Premise-Version ohne Internet (G8).
 */

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const WOCHENTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/**
 * @param {object} opts
 * @param {object} opts.praxis      { name, strasse, ort, telefon }
 * @param {string} opts.patientName
 * @param {Array}  opts.termine     [{ start, ende, leistung, therapeut, hausbesuch }]
 * @param {string} [opts.hinweis]   Zusatzzeile, z. B. Absagefrist
 * @returns {boolean} false, wenn der Popup-Blocker das Fenster verhindert hat
 */
export function druckeTerminzettel({ praxis = {}, patientName = '', termine = [], hinweis = '' }) {
  if (!termine.length) return false;

  const zeilen = termine.map(t => {
    const start = t.start instanceof Date ? t.start : new Date(t.start);
    if (Number.isNaN(start.getTime())) return '';
    const ende = t.ende ? (t.ende instanceof Date ? t.ende : new Date(t.ende)) : null;
    const uhr = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      + (ende && !Number.isNaN(ende.getTime())
        ? '–' + ende.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : '');
    const zusatz = [t.leistung, t.therapeut, t.hausbesuch ? 'Hausbesuch' : ''].filter(Boolean).join(' · ');
    return `<tr>
      <td class="tag">${escapeHtml(WOCHENTAG[start.getDay()])}</td>
      <td class="datum">${escapeHtml(start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }))}</td>
      <td class="uhr">${escapeHtml(uhr)}</td>
      <td class="zusatz">${escapeHtml(zusatz)}</td>
    </tr>`;
  }).filter(Boolean).join('');

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Terminzettel</title>
<style>
  @page { size: A5; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
         color: #111; margin: 0; font-size: 10pt; line-height: 1.35; }
  .kopf { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 1.5pt solid #111; padding-bottom: 4mm; margin-bottom: 4mm; }
  .praxis { font-size: 12pt; font-weight: 700; }
  .praxis span { display: block; font-size: 8.5pt; font-weight: 400; color: #444; }
  h1 { font-size: 13pt; margin: 0; text-align: right; }
  .patient { font-size: 11pt; font-weight: 600; margin-bottom: 3mm; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em;
       color: #555; border-bottom: .5pt solid #999; padding: 1mm 2mm 1mm 0; }
  td { padding: 1.8mm 2mm 1.8mm 0; border-bottom: .3pt solid #ddd; vertical-align: top; }
  .tag { width: 22mm; }
  .datum { width: 24mm; font-weight: 700; white-space: nowrap; }
  .uhr { width: 24mm; font-weight: 700; white-space: nowrap; }
  .zusatz { color: #444; font-size: 9pt; }
  .fuss { margin-top: 5mm; padding-top: 3mm; border-top: .5pt solid #999;
          font-size: 8.5pt; color: #444; }
  @media screen { body { padding: 10mm; max-width: 148mm; margin: 0 auto; } }
</style></head><body>
  <div class="kopf">
    <div class="praxis">${escapeHtml(praxis.name || '')}
      <span>${escapeHtml([praxis.strasse, praxis.ort].filter(Boolean).join(' · '))}</span>
      <span>${escapeHtml(praxis.telefon || '')}</span>
    </div>
    <h1>Ihre Termine</h1>
  </div>
  <div class="patient">${escapeHtml(patientName)}</div>
  <table>
    <thead><tr><th>Tag</th><th>Datum</th><th>Uhrzeit</th><th>Leistung</th></tr></thead>
    <tbody>${zeilen}</tbody>
  </table>
  <div class="fuss">${escapeHtml(hinweis || 'Bitte sagen Sie rechtzeitig ab, wenn Sie einen Termin nicht wahrnehmen können.')}</div>
  <script>window.addEventListener('load', function () { window.print(); });<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  // Popup-Blocker: der Aufrufer muss dem Nutzer sagen, was schiefging — hier
  // still zu scheitern wäre der schlimmste Fall (der Patient wartet am Tresen).
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
