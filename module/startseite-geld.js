/**
 * startseite-geld.js — Karte „Abrechnung“ der Startseite (Redesign V6.F03, nur Inhaber).
 *
 * Daten: GET {API_BASE}/startseite/zusammenfassung?bloecke=geld (api-backend/routes/startseite.js,
 * Lader lib/startseite/geld.js, B05a). Angestellte fragen nicht an (Router antwortet 403).
 * E13 (Melih): Hauptzahl = Patienteneingänge des Monats laut Kassenbuch (Erfassungsdatum),
 * Kasseneingänge getrennt; offene Zuzahlungen aus B03. Privat/Ausfall sind serverseitig noch nicht
 * geladen — die Karte sagt das, statt 0 € zu zeigen.
 * Unbekannte Beträge: gezeigt wird die bekannte Teilsumme als „mind.“, nie eine geschätzte Summe.
 */

import { fmtEur } from './geld.js?v=20260909';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WARN = '<svg class="px-sym" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Reine Hilfe (testbar): Betrag eines Aggregats als Text + Hinweis bei unbekannten Posten. */
export function summeText(s) {
  if (!s || !Number.isSafeInteger(s.bekanntCent)) return { betrag: '–', hinweis: '' };
  const offen = Number.isSafeInteger(s.unbekanntAnzahl) ? s.unbekanntAnzahl : 0;
  const voll = Number.isSafeInteger(s.gesamtCent);
  const betrag = (voll ? '' : 'mind. ') + fmtEur(s.bekanntCent / 100);
  const hinweis = offen > 0 ? `${offen} ${offen === 1 ? 'Eintrag' : 'Einträge'} ohne gültigen Betrag` : (voll ? '' : 'Teilsumme');
  return { betrag, hinweis };
}

/** Reine Hilfe (testbar): „2026-10“ → „Oktober 2026“. */
export function monatText(monat) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monat || ''));
  return m && +m[2] >= 1 && +m[2] <= 12 ? `${MONATE[+m[2] - 1]} ${m[1]}` : '';
}

function zeile(titel, s, klasse = '') {
  const t = summeText(s);
  return `<div class="px-geld-zeile${klasse}">
    <span class="lbl">${esc(titel)}</span><span class="zahl">${esc(t.betrag)}</span>
    ${t.hinweis ? `<span class="px-geld-hinweis">${WARN}${esc(t.hinweis)}</span>` : ''}</div>`;
}

/**
 * Reine Hilfe (testbar): HTML der Karte.
 * @param {{laden?: boolean, fehler?: boolean, daten?: object|null}} z
 */
export function geldKarteHtml(z = {}) {
  const kopf = (unter) => `<div class="px-karte-kopf"><div><h2 id="pxGeldTitel">Abrechnung</h2><p>${esc(unter)}</p></div></div>`;
  let rumpf;
  if (z.laden && !z.daten) rumpf = '<div class="px-karte-zustand"><p>Zahlen werden geladen …</p></div>';
  // Fehler beim Nachladen: letzte gute Zahlen bleiben stehen; ohne Zahlen der Fehlerzustand.
  else if (!z.daten) rumpf = '<div class="px-karte-zustand"><p>Zahlen gerade nicht verfügbar.</p><button type="button" class="px-knopf px-knopf--zweit" data-aktion="geld-neu">Erneut versuchen</button></div>';
  else {
    const d = z.daten;
    const patient = summeText(d.kassiert?.patient);
    rumpf = `<div class="px-geld">
      <div class="px-geld-haupt"><span class="lbl">${esc(d.umfang?.patient || 'Kassiert diesen Monat (erfasst im Kassenbuch)')}</span>
        <span class="zahl">${esc(patient.betrag)}</span>
        ${patient.hinweis ? `<span class="px-geld-hinweis">${WARN}${esc(patient.hinweis)}</span>` : ''}</div>
      ${zeile('Von Krankenkassen eingegangen', d.kassiert?.kasse)}
      ${zeile('Offene Zuzahlungen', d.offen?.zuzahlung)}
      <p class="px-geld-fuss">Offene Privat- und Ausfallrechnungen sind hier noch nicht enthalten.</p>
    </div>`;
  }
  const unter = z.daten ? [monatText(z.daten.monat), 'alle Standorte'].filter(Boolean).join(' · ') : 'Dieser Monat';
  return `<section class="px-karte px-k-geld" aria-labelledby="pxGeldTitel">${kopf(unter)}${rumpf}
    <div class="px-karte-fuss"><button type="button" class="px-fuss-knopf" data-ziel="belegliste">Zum Kassenbuch <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div></section>`;
}

/**
 * Holt den Geld-Block (nur Inhaber aufrufen). Wirft bei Netz-, HTTP- oder Blockfehler.
 * @param {{supabase: object, apiBase: string, fetchFn?: Function}} o
 */
export async function holeGeld({ supabase, apiBase, fetchFn = (...a) => fetch(...a) }) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token || !apiBase) throw new Error('KEINE_SITZUNG');
  const res = await fetchFn(`${String(apiBase).replace(/\/+$/, '')}/startseite/zusammenfassung?bloecke=geld`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const block = (await res.json())?.bloecke?.geld;
  if (block?.status !== 'ok' || !block.daten || typeof block.daten !== 'object') throw new Error('BLOCK_NICHT_VERFUEGBAR');
  return block.daten;
}
