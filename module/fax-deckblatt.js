/**
 * fax-deckblatt.js — Fax-Deckblatt an einen Arzt aus dem Register drucken.
 *
 * Warum es das gibt
 * ─────────────────
 * Interessenten-Anfrage 22.10.2026 (Physio, „Versand … per E-Mail und
 * idealerweise auch per Fax"). Praxis und Arzt verkehren im Alltag noch per
 * Fax: Therapieberichte, Rückfragen zur Verordnung, Änderungswünsche.
 *
 * Rahmen (legal-de + onprem, 22.10.2026 — compliance/LEGAL_DECISIONS.md):
 *   - Praxura SENDET NICHT. Die Praxis druckt das Deckblatt und faxt mit
 *     ihrem eigenen Gerät (Fritzbox, Multifunktionsdrucker). Ein Fax-Dienst
 *     (sipgate o. ä.) wurde bewusst verworfen: Gesundheitsdaten liefen dann
 *     über einen neuen Dritten (guvenlik-Veto „PHI an neuen Ort") und die Box
 *     bekäme eine neue Außenverbindung (G8).
 *   - Auf das Deckblatt gehört KEIN Patientenname und keine Diagnose — es
 *     liegt im Empfangsfach des Arztes oben auf. Deshalb hat der Betreff einen
 *     Hinweis und das Freitextfeld ebenso.
 *   - Vertraulichkeitshinweis (§ 203 StGB) + Bitte um Rückruf bei
 *     Fehlzustellung — dafür steht die Praxis-Telefonnummer darauf.
 *   - Ein nicht blockierender Hinweis im Formular: Fax ist unverschlüsselt.
 *
 * Client-seitig wie module/behandlungsbestaetigung.js: kein Server, kein
 * Speichern, keine externen Schriften/Skripte im Druckfenster.
 */

'use strict';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const DE = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return isNaN(x) ? '' : x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const VERTRAULICH =
  'Vertraulich – dieses Fax kann Gesundheitsdaten enthalten, die der ärztlichen ' +
  'Schweigepflicht (§ 203 StGB) unterliegen. Es ist ausschließlich für den oben ' +
  'genannten Empfänger bestimmt. Sollten Sie dieses Fax irrtümlich erhalten haben, ' +
  'benachrichtigen Sie uns bitte umgehend telefonisch und vernichten Sie die Unterlagen.';

/**
 * Das Deckblatt als vollständiges HTML-Dokument. Rein — für Tests ohne DOM.
 *
 * @param {object} o
 * @param {object} o.praxis     { name, strasse, ort, telefon, fax }
 * @param {object} o.empfaenger { name, fax, telefon }
 * @param {string} [o.betreff]
 * @param {number|string} [o.seiten]  Gesamtzahl inkl. Deckblatt
 * @param {string} [o.nachricht]
 * @param {string} [o.logoUrl]
 * @param {Date}   [o.datum]
 * @returns {string}
 */
export function baueFaxDeckblattHtml({
  praxis = {}, empfaenger = {}, betreff = '', seiten = '', nachricht = '',
  logoUrl = '', datum = new Date(),
} = {}) {
  const zeile = (label, wert) => wert
    ? `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(wert)}</td></tr>` : '';
  const seitenText = Number(seiten) > 0 ? `${Number(seiten)} (inkl. Deckblatt)` : '';
  const logoHtml = logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="">` : '';
  const nachrichtHtml = String(nachricht || '').trim()
    ? `<div class="nachricht">${escapeHtml(nachricht).replace(/\n/g, '<br>')}</div>` : '';

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Fax-Deckblatt</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #000; margin: 0;
         font-size: 12pt; line-height: 1.45; }
  .logo { max-height: 20mm; max-width: 55mm; display: block; margin-bottom: 4mm; }
  h1 { font-size: 30pt; letter-spacing: .08em; margin: 0 0 8mm;
       border-bottom: 2pt solid #000; padding-bottom: 3mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8mm; }
  th { text-align: left; width: 38mm; vertical-align: top; padding: 2mm 3mm 2mm 0;
       font-weight: 700; }
  td { padding: 2mm 0; border-bottom: .5pt solid #000; }
  .block { margin-bottom: 6mm; }
  .block h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 2mm; }
  .nachricht { border: 1pt solid #000; padding: 4mm; min-height: 40mm; margin-bottom: 8mm; }
  .vertraulich { border: 1.5pt solid #000; padding: 4mm; font-size: 10pt; font-weight: 700; }
  @media screen { body { padding: 15mm; max-width: 210mm; margin: 0 auto; } }
</style></head><body>
  ${logoHtml}
  <h1>TELEFAX</h1>
  <div class="block">
    <h2>An</h2>
    <table>
      ${zeile('Empfänger', empfaenger.name)}
      ${zeile('Fax', empfaenger.fax)}
      ${zeile('Telefon', empfaenger.telefon)}
    </table>
  </div>
  <div class="block">
    <h2>Von</h2>
    <table>
      ${zeile('Praxis', praxis.name)}
      ${zeile('Anschrift', [praxis.strasse, praxis.ort].filter(Boolean).join(', '))}
      ${zeile('Telefon', praxis.telefon)}
      ${zeile('Fax', praxis.fax)}
    </table>
  </div>
  <table>
    ${zeile('Datum', DE(datum))}
    ${zeile('Seiten', seitenText)}
    ${zeile('Betreff', betreff)}
  </table>
  ${nachrichtHtml}
  <div class="vertraulich">${escapeHtml(VERTRAULICH)}</div>
  <script>window.addEventListener('load', function () { window.print(); });<\/script>
</body></html>`;
}

/**
 * Druckfenster öffnen.
 * @returns {boolean} false, wenn der Popup-Blocker das Fenster verhindert hat
 */
export function druckeFaxDeckblatt(opts) {
  const w = window.open('', '_blank');
  // Gleiches Muster wie module/termin-druck.js: lieber eine Meldung als ein
  // Klick, auf den nichts passiert.
  if (!w) return false;
  w.document.write(baueFaxDeckblattHtml(opts));
  w.document.close();
  return true;
}

/**
 * Knopf + kleines Formular in ein Zielelement (Arzt-Detail im Register).
 *
 * @param {HTMLElement} el
 * @param {object} deps { arzt, praxis, logoUrl }
 */
export function mountFaxDeckblatt(el, { arzt, praxis = {}, logoUrl = '' } = {}) {
  if (!el || !arzt) return;
  const hatFax = !!String(arzt.fax || '').trim();

  el.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" data-fax-toggle style="font-size:12px;">
      Fax-Deckblatt drucken
    </button>
    ${hatFax ? '' : '<span class="text-muted" style="font-size:12px;margin-left:8px;">Für diesen Arzt ist keine Faxnummer hinterlegt („Bearbeiten").</span>'}
    <div data-fax-form style="display:none;margin-top:8px;padding:10px;background:var(--bg-card-solid);
         border:1px solid var(--border);border-radius:8px;gap:8px;">
      <label style="font-size:12px;color:var(--text-muted);">Betreff
        <input type="text" data-fax-betreff maxlength="120" style="display:block;width:100%;font-size:13px;"
               placeholder="z. B. Therapiebericht · Rückfrage zur Verordnung vom …">
      </label>
      <label style="font-size:12px;color:var(--text-muted);">Seiten gesamt (inkl. Deckblatt)
        <input type="number" data-fax-seiten min="1" max="99" value="2" style="display:block;width:90px;font-size:13px;">
      </label>
      <label style="font-size:12px;color:var(--text-muted);">Nachricht (optional)
        <textarea data-fax-nachricht rows="3" maxlength="1000" style="display:block;width:100%;font-size:13px;"></textarea>
      </label>
      <p style="margin:0;font-size:12px;color:var(--text-muted);">
        Bitte keinen Patientennamen und keine Diagnose auf das Deckblatt schreiben — es liegt beim Empfänger offen aus.
        Fax ist unverschlüsselt: Nummer vorher prüfen, im Zweifel den Empfänger vorab anrufen.
      </p>
      <div><button type="button" class="btn btn-primary btn-sm" data-fax-drucken style="font-size:12px;">Drucken</button>
        <span data-fax-fehler style="font-size:12px;color:var(--danger, #dc2626);margin-left:8px;"></span></div>
    </div>`;

  const form = el.querySelector('[data-fax-form]');
  el.querySelector('[data-fax-toggle]').addEventListener('click', () => {
    // style statt [hidden]: eine display-Regel überstimmt das Attribut.
    form.style.display = form.style.display === 'none' ? 'grid' : 'none';
  });
  el.querySelector('[data-fax-drucken]').addEventListener('click', () => {
    const fehler = el.querySelector('[data-fax-fehler]');
    fehler.textContent = '';
    const ok = druckeFaxDeckblatt({
      praxis, logoUrl,
      empfaenger: { name: arzt.arzt_name || '', fax: arzt.fax || '', telefon: arzt.telefon || '' },
      betreff: el.querySelector('[data-fax-betreff]').value.trim(),
      seiten: el.querySelector('[data-fax-seiten]').value,
      nachricht: el.querySelector('[data-fax-nachricht]').value,
    });
    if (!ok) fehler.textContent = 'Popup wurde blockiert — bitte Popups für diese Seite erlauben.';
  });
}
