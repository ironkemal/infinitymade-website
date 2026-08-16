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

import { anredeFuerGeschlecht } from './geschlecht.js?v=20260816';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const WOCHENTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const WOCHENTAG_KURZ = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/**
 * Anrede aus dem Feld `leads.geschlecht`.
 *
 * Die Zuordnung Code → Anrede steht in module/geschlecht.js; hier wird nur
 * noch entschieden, WO der Wert am Patienten steht (Spalte oder Altbestand in
 * `metadata`). Vorher lag die Buchstabenlogik ein zweites Mal hier — genau so
 * sind die drei Kodierungen im Projekt entstanden.
 */
export function anredeAusGeschlecht(lead) {
  return anredeFuerGeschlecht(lead?.geschlecht || lead?.metadata?.geschlecht);
}

/**
 * Fasst Öffnungszeiten zu Zeilen zusammen und legt gleiche Tage zusammen:
 * aus fünf Zeilen „08:00–18:00" wird „Montag – Freitag  08:00 – 18:00".
 * Ein Zettel mit sieben Zeilen Öffnungszeiten liest niemand.
 *
 * @param {Array} zeiten [{ day_of_week, start_time, end_time, is_active }]
 */
function fasseOeffnungszeiten(zeiten = []) {
  const proTag = new Map();
  zeiten.filter(z => z.is_active !== false).forEach(z => {
    const von = String(z.start_time || '').substring(0, 5);
    const bis = String(z.end_time || '').substring(0, 5);
    if (!von || !bis) return;
    const liste = proTag.get(z.day_of_week) || [];
    liste.push(`${von} – ${bis}`);
    proTag.set(z.day_of_week, liste);
  });
  if (!proTag.size) return [];

  // Montag zuerst, Sonntag zuletzt — 0 = Sonntag in der Datenbank.
  const reihenfolge = [1, 2, 3, 4, 5, 6, 0].filter(d => proTag.has(d));
  const zeilen = [];
  let block = null;
  reihenfolge.forEach((tag, i) => {
    const text = proTag.get(tag).sort().join(', ');
    const luecke = i > 0 && reihenfolge[i - 1] !== (tag === 0 ? 6 : tag - 1);
    if (block && block.text === text && !luecke) { block.bis = tag; return; }
    if (block) zeilen.push(block);
    block = { von: tag, bis: tag, text };
  });
  if (block) zeilen.push(block);

  return zeilen.map(b => ({
    tage: b.von === b.bis ? WOCHENTAG_KURZ[b.von] : `${WOCHENTAG_KURZ[b.von]} – ${WOCHENTAG_KURZ[b.bis]}`,
    zeit: b.text,
  }));
}

/**
 * @param {object} opts
 * @param {object} opts.praxis      { name, strasse, ort, telefon, iban, bic, bank }
 * @param {string} opts.patientName
 * @param {string} [opts.anrede]    „Frau" / „Herr" — steuert die Anredezeile
 * @param {Array}  opts.termine     [{ start, ende, leistung, therapeut, hausbesuch }]
 * @param {Array}  [opts.oeffnungszeiten] [{ day_of_week, start_time, end_time, is_active }]
 * @param {string} [opts.hinweis]   Zusatzzeile, z. B. Absagefrist
 * @param {string} [opts.logoUrl]   Briefkopf-Logo der Praxis, optional
 * @param {string} [opts.titel]     Überschrift, Standard „Ihre Termine"
 * @param {'A5'|'A4'} [opts.format] Papierformat; A4 für die Serienbestätigung
 * @returns {boolean} false, wenn der Popup-Blocker das Fenster verhindert hat
 */
export function druckeTerminzettel({
  praxis = {}, patientName = '', anrede = '', termine = [],
  oeffnungszeiten = [], hinweis = '', logoUrl = '', titel = 'Ihre Termine',
  format = 'A5',
}) {
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

  // Anrede: „Sehr geehrte Frau Meier," wenn wir das Geschlecht kennen, sonst
  // die neutrale Form. Falsch anzureden ist schlimmer als neutral anzureden.
  const nachname = String(patientName || '').trim().split(/\s+/).pop() || '';
  const anredeZeile = anrede === 'Frau' || anrede === 'Herr'
    ? `Sehr geehrte${anrede === 'Frau' ? '' : 'r'} ${anrede} ${nachname},`
    : `Guten Tag ${patientName},`;

  const zeitZeilen = fasseOeffnungszeiten(oeffnungszeiten)
    .map(z => `<tr><td>${escapeHtml(z.tage)}</td><td>${escapeHtml(z.zeit)}</td></tr>`).join('');

  // Bankverbindung nur, wenn hinterlegt — eine leere IBAN-Zeile wirkt wie ein
  // Fehler und der Zettel geht aus dem Haus.
  const bankZeile = [praxis.iban ? `IBAN ${praxis.iban}` : '', praxis.bic ? `BIC ${praxis.bic}` : '', praxis.bank || '']
    .filter(Boolean).join(' · ');

  // Logo und Fusszeile stammen aus der zweiten, älteren Druckstrecke
  // (`printSeriterminConfirmation`, A4). Beim Zusammenlegen der beiden Wege
  // durfte die Praxis ihr Briefkopf-Logo nicht verlieren, also kann dieser
  // Zettel es jetzt auch — es bleibt aber optional.
  const logoHtml = logoUrl
    ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="">`
    : '';

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Terminzettel</title>
<style>
  @page { size: ${format === 'A4' ? 'A4' : 'A5'}; margin: ${format === 'A4' ? '18mm' : '10mm'}; }
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
  .anrede { font-size: 10pt; margin-bottom: 3mm; }
  .zeiten { margin-top: 4mm; }
  .zeiten table { width: auto; }
  .zeiten td { border: 0; padding: .6mm 6mm .6mm 0; font-size: 8.5pt; color: #444; }
  .zeiten .titel, .bank .titel { font-size: 8pt; text-transform: uppercase;
          letter-spacing: .04em; color: #555; margin-bottom: 1mm; }
  .bank { margin-top: 3mm; font-size: 8.5pt; color: #444; }
  .logo { max-height: 18mm; max-width: 55mm; display: block; margin-bottom: 3mm; }
  @media screen { body { padding: 10mm; max-width: ${format === 'A4' ? '210mm' : '148mm'}; margin: 0 auto; } }
</style></head><body>
  ${logoHtml}
  <div class="kopf">
    <div class="praxis">${escapeHtml(praxis.name || '')}
      <span>${escapeHtml([praxis.strasse, praxis.ort].filter(Boolean).join(' · '))}</span>
      <span>${escapeHtml(praxis.telefon || '')}</span>
    </div>
    <h1>${escapeHtml(titel)}</h1>
  </div>
  <div class="patient">${escapeHtml(patientName)}</div>
  <div class="anrede">${escapeHtml(anredeZeile)}<br>
    hier sind Ihre vereinbarten Termine in unserer Praxis:</div>
  <table>
    <thead><tr><th>Tag</th><th>Datum</th><th>Uhrzeit</th><th>Leistung</th></tr></thead>
    <tbody>${zeilen}</tbody>
  </table>
  <div class="fuss">${escapeHtml(hinweis || 'Bitte sagen Sie rechtzeitig ab, wenn Sie einen Termin nicht wahrnehmen können.')}</div>
  ${zeitZeilen ? `<div class="zeiten"><div class="titel">Öffnungszeiten</div><table><tbody>${zeitZeilen}</tbody></table></div>` : ''}
  ${bankZeile ? `<div class="bank"><div class="titel">Bankverbindung</div>${escapeHtml(bankZeile)}</div>` : ''}
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
