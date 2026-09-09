/**
 * zuzahlung-streifen.js — die farbige Zuzahlungszeile im Termin-Panel
 * (`#bkRxZuzahlungWarn`).
 *
 * Hierher gezogen aus `dashboard.js` (Ops #277, 09.09.2026) — drei Gründe:
 *
 *   1. `dashboard.js` darf nicht mehr wachsen (Konsey 2026-08-13).
 *   2. Zwei Rechenwege für dieselbe Zahl: der Streifen rechnete bisher SELBST
 *      noch einmal (`ermittleGeldstand()` ohne `podoKarte`), während die
 *      Geldzeile darüber (`module/rezeptinfo-geld.js`) längst den richtigen
 *      Stand kennt — inklusive der zuzahlungsfreien Podologie-Positionen
 *      (78220/78530), die ohne `podoKarte` als „unbekannt" galten und mit
 *      10 % belastet wurden. Der Streifen bekommt seinen Stand jetzt gereicht
 *      statt ihn zu duplizieren.
 *   3. Verschwand bisher STUMM, wenn `stand.unbekannt` war (siehe unten) —
 *      keine Katalogposition heisst nicht „gesperrt", sondern „Betrag lässt
 *      sich nicht berechnen", und genau das muss dastehen statt nichts.
 *
 * Was NICHT hierher gehört: der Klick selbst. `data-zuzahl`-Knöpfe werden
 * weiter zentral in dashboard.js eingesammelt (ein Listener auf dem
 * Elternelement, siehe dort) — dieses Modul zeichnet nur.
 */

import { korrekturKnopfHtml } from './zuzahlung-korrektur.js?v=20260909';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Zeichnet den Streifen. Reine Anzeige — rechnet nichts nach, sondern nimmt
 * den `stand` entgegen, den die Geldzeile (`rezeptinfo-geld.js`) ohnehin
 * schon ermittelt hat (inkl. `podoKarte`).
 *
 * @param {HTMLElement} el          `#bkRxZuzahlungWarn`
 * @param {object} args
 * @param {object} args.rx          Zeile aus `prescriptions`
 * @param {object} args.stand       GKV-Stand aus `ermittleGeldstand()`
 *                                  ({gesamt, unbekannt, …})
 * @param {(key:string)=>string} args.t            dashboard.js' i18n-Funktion
 * @param {(key:string)=>string} args.zahlartLabel  dashboard.js' Zahlart-Label
 * @param {string} [args.patientId]    für Kassieren/Storno — siehe unten
 * @param {string} [args.patientName]  für Kassieren/Storno und Korrektur
 */
export function rendereZuzahlungStreifen(el, { rx, stand, t, zahlartLabel, patientId, patientName }) {
  if (!el || !rx || !stand) return;

  // Quelle ist der GERECHNETE Betrag, nicht `rx.zuzahlung_eur` als erstes —
  // die Spalte ist nur nach einer Korrektur (module/zuzahlung-korrektur.js)
  // gesetzt, sonst NULL. Ist sie gesetzt, hat sie Vorrang: sie trägt den
  // protokollierten, ggf. von Hand korrigierten Betrag.
  const betrag = rx.zuzahlung_eur != null ? Number(rx.zuzahlung_eur)
               : (stand.unbekannt ? null : stand.gesamt);
  const befreit = !!rx.zuzahlung_befreit;
  const bezahlt = !!rx.zuzahlung_kassiert_am;

  el.hidden = false;
  el.dataset.rxId = rx.id;
  el.dataset.betrag = String(betrag ?? 0);
  // Liest der Klick-Handler in dashboard.js (kassieren/stornieren/korrigieren)
  // — ohne die beiden hier wären Zahlungsbeleg und Korrektur-Protokoll ohne
  // Patientenbezug gelaufen.
  el.dataset.patientId = patientId || '';
  el.dataset.patientName = patientName || '';

  // Das Euro-Zeichen druckt den Beleg sofort — für Kasse wie Privat derselbe
  // Knopf (Beta-2, 12.08.2026: „bei privat genauso, dann brauche ich nicht
  // extra in diese Vorlage reinzugehen").
  const druckKnopf =
    ` <button type="button" data-zuzahl="drucken" title="Beleg drucken"
       style="margin-left:6px;background:none;border:0;color:inherit;cursor:pointer;font-size:13px;font-family:inherit;">€&nbsp;🖨</button>`;

  if (befreit) {
    el.style.background = 'var(--success-dim)';
    el.style.borderColor = 'var(--success)';
    el.style.color = 'var(--success)';
    el.style.fontWeight = '600';
    el.innerHTML = esc(t('kass_befreit')) + druckKnopf;
    return;
  }

  if (bezahlt) {
    el.style.background = 'var(--success-dim)';
    el.style.borderColor = 'var(--success)';
    el.style.color = 'var(--success)';
    el.style.fontWeight = '600';
    const am = new Date(rx.zuzahlung_kassiert_am)
      .toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const art = rx.zuzahlung_zahlart ? ` · ${zahlartLabel(rx.zuzahlung_zahlart)}` : '';
    // Der Betrag steht seit 03.09.2026 in der Geldzeile oben; hier stand er
    // ein zweites Mal, zwei Zeilen darunter. Was diese Zeile trägt und die
    // Geldzeile nicht, sind die Handlungen — die bleiben.
    el.innerHTML =
      `${esc(t('kass_bezahlt'))} · ${esc(am)}${esc(art)}`
      + ` <button type="button" data-zuzahl="rechnung" style="margin-left:6px;background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer;font-size:11px;font-family:inherit;">${esc(t('kass_rechnung'))}</button>`
      + ` <button type="button" data-zuzahl="undo" style="margin-left:4px;background:none;border:0;color:inherit;opacity:0.75;text-decoration:underline;cursor:pointer;font-size:11px;font-family:inherit;">${esc(t('kass_undo'))}</button>`
      + druckKnopf + korrekturKnopfHtml(rx);
    return;
  }

  // Ein bekannter Betrag — ob 0 oder positiv — ist KEINE Lücke. 0 ist ein
  // gültiger, eigener Zustand (zuzahlungsfreie Position, oder eine Korrektur,
  // die den Betrag bewusst auf 0 gesetzt hat — „die korrigierte Null gilt,
  // sie ist eine Aussage, kein fehlender Wert", zuzahlung-rechnen.test.js).
  // Ein Bug bis 09.09.2026: dieser Fall fiel hier in den Lücken-Zweig unten
  // und verlor dabei Druck- UND Korrektur-Knopf — bei einer bereits
  // korrigierten Verordnung wäre „✎ anpassen" von hier aus nicht mehr
  // erreichbar gewesen.
  if (betrag != null) {
    const offen = betrag > 0;
    el.style.background = offen ? 'var(--warning-dim)' : 'var(--bg-card)';
    el.style.borderColor = offen ? 'var(--warning)' : 'var(--border)';
    el.style.color = offen ? 'var(--warning-text)' : 'var(--text-muted)';
    el.style.fontWeight = offen ? '600' : '400';
    el.innerHTML =
      (offen
        ? `${esc(t('kass_offen'))} <button type="button" data-zuzahl="pay" style="margin-left:6px;background:var(--warning-dim);border:1px solid var(--warning);color:inherit;border-radius:5px;padding:1px 7px;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit;">${esc(t('kass_btn'))}</button>`
        : esc('Für diese Verordnung fällt keine Zuzahlung an.'))
      + druckKnopf + korrekturKnopfHtml(rx);
    return;
  }

  // Bis 09.09.2026 landete man hier — betrag ist NULL, weil keine
  // Katalogposition gefunden wurde — und der Streifen wurde dann komplett
  // versteckt (`hidden = true`), mitsamt jeder Handlung. Der Nutzer sah
  // nichts: keine Zeile, kein Grund, nur einen grauen €-Knopf in der
  // Geldzeile darüber, der auf Hover nichts erklärt (siehe rezeptinfo-geld.js
  // — `title` auf `disabled` feuert in Chrome/Safari nicht). Das war die
  // Hauptursache hinter Ops #277: kein Riegel, eine fehlende Katalogposition,
  // die wie einer aussah. Hier gibt es wirklich nichts zu tun — kein Druck-,
  // kein Korrektur-Knopf: ohne einen Betrag ist auch nichts zu korrigieren.
  el.style.background = 'var(--bg-card)';
  el.style.borderColor = 'var(--border)';
  el.style.color = 'var(--text-muted)';
  el.style.fontWeight = '400';
  el.innerHTML = esc('Für diese Position steht kein Preis im Katalog — Betrag lässt sich nicht berechnen. '
    + 'Position in der Verordnung prüfen.');
}
