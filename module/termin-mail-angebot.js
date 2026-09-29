/**
 * termin-mail-angebot.js — E-Mail-/Druck-Angebot nach Serienerstellung.
 *
 * Warum es das gibt
 * ─────────────────
 * Nach dem Anlegen einer Terminserie (KI-Vorschlag oder manuelle Serie) fragt
 * die Praxis, ob der Patient eine Terminübersicht bekommen soll — per E-Mail
 * oder Ausdruck. Bisher lag dieser ~60-Zeilen-Block direkt in `dashboard.js`
 * (Konsey 2026-08-13: die Datei wächst nicht mehr) und kannte nur den
 * Physio-Anschluss: egal was man klickte („Nein", ✕ oder E-Mail ablehnen),
 * es ging danach immer weiter zur Rechnung.
 *
 * Reform S1.11b (29.09.2026): in der Podologie gibt es direkt nach dem
 * Binden einer Serie noch KEINE einzige erledigte Sitzung — „Rechnung
 * vorbereitet" war dort schlicht falsch. `ohneRechnung` (aus
 * `window._physioFlow?.podo`, gesetzt von `meldePodoSerienBindung`,
 * module/podo-einheiten.js) schaltet den Rechnungs-Anschluss ab:
 * „Nein, weiter zur Rechnung" wird zu „Schließen", und fehlt eine
 * E-Mail-Adresse, wird sie nicht mehr abgefragt — nur Drucken/Schließen
 * bleiben. Physio-Text und -Ablauf bleiben unverändert (ohneRechnung=false).
 */

const TITEL_STANDARD = 'Termine per E-Mail bestätigen?';
const TITEL_OHNE_RECHNUNG = 'Terminübersicht mitgeben?';

/**
 * Reine Entscheidung ohne DOM — Texte/Sichtbarkeiten aus den drei Eingaben,
 * testbar ohne `document`/`window`.
 *
 * @returns {{titel:string, text:string, emailSichtbar:boolean, yesSichtbar:boolean, noText:string}}
 */
export function mailAngebotZustand({ hasEmail, patientName, ohneRechnung = false } = {}) {
  const name = patientName || 'dem Patienten';
  if (ohneRechnung && !hasEmail) {
    // Podologie ohne E-Mail: nicht danach fragen, nur Drucken/Schließen anbieten.
    return {
      titel: TITEL_OHNE_RECHNUNG,
      text: `Für ${name} ist keine E-Mail-Adresse hinterlegt. Sie können die Terminübersicht direkt ausdrucken.`,
      emailSichtbar: false,
      yesSichtbar: false,
      noText: 'Schließen',
    };
  }
  return {
    titel: ohneRechnung ? TITEL_OHNE_RECHNUNG : TITEL_STANDARD,
    text: hasEmail
      ? `Möchten Sie ${name} die erstellten Termine per E-Mail bestätigen?`
      : `Wir haben keine E-Mail-Adresse für ${name}. Bitte fragen Sie nach und tragen Sie sie unten ein — oder drucken Sie die Terminbestätigung direkt aus.`,
    emailSichtbar: !hasEmail,
    yesSichtbar: true,
    noText: ohneRechnung ? 'Schließen' : 'Nein, weiter zur Rechnung',
  };
}

/**
 * `flow.podo` (Reform S1.11b): diese Serie kam aus `meldePodoSerienBindung`
 * (module/podo-einheiten.js) — kein Sitzungsbuch, keine abrechenbare Sitzung
 * zu diesem Zeitpunkt, also keine Rechnung anstoßen.
 */
export function istPodoOhneRechnung(physioFlow) {
  return !!physioFlow?.podo;
}

/**
 * Zeigt das Mail-/Druck-Angebot-Modal und löst mit der Nutzerwahl auf.
 * DOM-IDs sind fest (dashboard.html, Abschnitt „MAIL OFFER MODAL") — von
 * diesem Modal gibt es keine zweite Instanz.
 *
 * deps: { openModal, closeModal } — Standard hier dupliziert (einfaches
 * hidden-Toggle), weil ein Modul `dashboard.js` nicht importieren darf
 * (Zirkel); der Aufrufer reicht dort die echten Funktionen durch.
 *
 * @returns {Promise<{ok:boolean, email?:string, print?:boolean}>}
 */
export function oeffneMailAngebotModal({ hasEmail, patientName, ohneRechnung = false } = {}, deps = {}) {
  const openModal = deps.openModal || ((id) => { const el = document.getElementById(id); if (el) el.hidden = false; });
  const closeModal = deps.closeModal || ((id) => { const el = document.getElementById(id); if (el) el.hidden = true; });

  return new Promise(resolve => {
    const modal = document.getElementById('mailOfferModal');
    const titelEl = document.getElementById('mailOfferModalTitleText');
    const textEl = document.getElementById('mailOfferText');
    const emailWrap = document.getElementById('mailOfferEmailWrap');
    const emailInput = document.getElementById('mailOfferEmail');
    const yesBtn = document.getElementById('mailOfferYesBtn');
    const noBtn = document.getElementById('mailOfferNoBtn');
    const printBtn = document.getElementById('mailOfferPrintBtn');
    const footer = document.getElementById('mailOfferFooter');
    const content = document.getElementById('mailOfferContent');
    const progressWrap = document.getElementById('mailOfferProgressWrap');
    const closeBtn = modal.querySelector('.modal-close');

    // Reset to initial state
    content.hidden = false;
    progressWrap.hidden = true;
    footer.hidden = false;
    closeBtn.style.visibility = '';

    const zustand = mailAngebotZustand({ hasEmail, patientName, ohneRechnung });
    if (titelEl) titelEl.textContent = zustand.titel;
    textEl.textContent = zustand.text;
    emailWrap.hidden = !zustand.emailSichtbar;
    emailInput.value = '';
    yesBtn.hidden = !zustand.yesSichtbar;
    noBtn.textContent = zustand.noText;

    const cleanupNo = () => {
      yesBtn.onclick = null; noBtn.onclick = null; closeBtn.onclick = null;
      if (printBtn) printBtn.onclick = null;
      closeModal('mailOfferModal');
    };

    yesBtn.onclick = !zustand.yesSichtbar ? null : () => {
      let resolvedEmail;
      if (zustand.emailSichtbar) {
        const val = (emailInput.value || '').trim();
        if (!val.includes('@')) {
          emailInput.focus();
          emailInput.style.borderColor = '#e74c3c';
          return;
        }
        resolvedEmail = val;
      }
      // Switch modal to loading state — keep modal open until fetch completes
      yesBtn.onclick = null; noBtn.onclick = null; closeBtn.onclick = null;
      content.hidden = true;
      footer.hidden = true;
      closeBtn.style.visibility = 'hidden';
      progressWrap.hidden = false;
      resolve({ ok: true, email: resolvedEmail });
    };
    noBtn.onclick = () => { cleanupNo(); resolve({ ok: false }); };
    closeBtn.onclick = () => { cleanupNo(); resolve({ ok: false }); };
    // Ohne E-Mail direkt drucken — gleicher Inhalt wie die Bestätigungs-Mail
    if (printBtn) printBtn.onclick = () => { cleanupNo(); resolve({ ok: false, print: true }); };

    openModal('mailOfferModal');
  });
}
