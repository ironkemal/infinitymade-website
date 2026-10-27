/**
 * startseite-geld.js — Karte „Abrechnung“ der Startseite (Redesign V6.F03, nur Inhaber).
 *
 * Daten: GET {API_BASE}/startseite/zusammenfassung?bloecke=geld (api-backend/routes/startseite.js,
 * Lader lib/startseite/geld.js, B05a). Angestellte fragen nicht an (Router antwortet 403).
 * E13 (Melih): Hauptzahl = Patienteneingänge des Monats laut Kassenbuch (Erfassungsdatum),
 * Kasseneingänge getrennt; offene Zuzahlungen aus B03. Privat/Ausfall sind serverseitig noch nicht
 * geladen — die Karte sagt das, statt 0 € zu zeigen.
 * Unbekannte Beträge: gezeigt wird die bekannte Teilsumme als „Teilsumme … · Gesamtbetrag unbekannt“.
 * KEIN „mind.“: ungeklärte Einträge können Stornos/Rückflüsse sein, die bekannte Teilsumme ist keine
 * Untergrenze (Codex-Befund V6.F03 P2, 27.10.2026). Offene Zuzahlungen getrennt nach Patient,
 * Kasse (E16 VKZ 03 „Bei Kasse gefordert“) und Klärung — keine gemeinsame Patientensumme.
 */

import { fmtEur } from './geld.js?v=20260909';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WARN = '<svg class="px-sym" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Reine Hilfe (testbar): Hinweis für ein unvollständiges Aggregat („Gesamtbetrag unbekannt · n ungeklärt“). */
export function unbekanntHinweis(s) {
  if (!s || Number.isSafeInteger(s.gesamtCent)) return '';
  const offen = Number.isSafeInteger(s.unbekanntAnzahl) ? s.unbekanntAnzahl : 0;
  return 'Gesamtbetrag unbekannt' + (offen > 0 ? ` · ${offen} ${offen === 1 ? 'Eintrag' : 'Einträge'} ungeklärt` : '');
}

/** Reine Hilfe (testbar): Betrag eines Aggregats als Text + Hinweis bei unbekannten Posten. */
export function summeText(s) {
  if (!s || !Number.isSafeInteger(s.bekanntCent)) return { betrag: '–', hinweis: '' };
  const voll = Number.isSafeInteger(s.gesamtCent);
  return { betrag: (voll ? '' : 'Teilsumme ') + fmtEur((voll ? s.gesamtCent : s.bekanntCent) / 100), hinweis: unbekanntHinweis(s) };
}

/** Reine Hilfe (testbar): Teilbetrag eines Unterblocks; unvollständig, wenn der Block es ist. */
function teilText(cent, vollstaendig) {
  if (!Number.isSafeInteger(cent)) return '–';
  return (vollstaendig ? '' : 'Teilsumme ') + fmtEur(cent / 100);
}

/** Reine Hilfe (testbar): HTML „Offene Zuzahlungen“ getrennt nach Patient / Kasse / Klärung. */
export function zuzahlungHtml(z) {
  if (!z || !Number.isSafeInteger(z.bekanntCent)) return zeile('Offene Zuzahlungen', null);
  const voll = Number.isSafeInteger(z.gesamtCent);
  const reihen = [['Bei Patienten offen', z.patientBekanntCent], ['Bei Kasse gefordert', z.kasseBekanntCent]];
  if (!voll || (Number.isSafeInteger(z.klaerungBekanntCent) && z.klaerungBekanntCent > 0)) reihen.push(['In Klärung', z.klaerungBekanntCent]);
  const hinweis = unbekanntHinweis(z);
  return `<div class="px-geld-gruppe"><span class="px-geld-gruppe-titel">Offene Zuzahlungen (GKV)</span>
    ${reihen.map(([t, c]) => `<div class="px-geld-zeile px-geld-zeile--unter"><span class="lbl">${esc(t)}</span><span class="zahl">${esc(teilText(c, voll))}</span></div>`).join('')}
    ${hinweis ? `<span class="px-geld-hinweis">${WARN}${esc(hinweis)}</span>` : ''}</div>`;
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

const BEREIT_GRUENDE = Object.freeze({
  SNAPSHOT_ZUORDNUNG_UNKLAR: 'Abrechnungsbeleg nicht eindeutig zugeordnet',
  SNAPSHOT_FEHLT_ODER_MEHRDEUTIG: 'Kein eindeutiger Abrechnungsbeleg',
  SNAPSHOT_HERKUNFT_UNKLAR: 'Herkunft des Abrechnungsbetrags ungeklärt',
  SNAPSHOT_ABSETZUNG_UNGEKLAERT: 'Absetzung am Abrechnungsbeleg ungeklärt',
  SNAPSHOT_KOPF_UNKLAR: 'Abrechnungsstand nicht eindeutig belegt',
  SNAPSHOT_BETRAG_UNGUELTIG: 'Beträge des Abrechnungsbelegs nicht plausibel',
  LEISTUNGEN_UNGEKLAERT: 'Erbrachte Leistungen nicht vollständig belegt',
  HEILMITTEL_ZUORDNUNG_UNGEKLAERT: 'Leistung keiner eindeutigen Heilmittelposition zugeordnet',
  LEISTUNGSDATUM_UNGEKLAERT: 'Leistungsdatum ungeklärt',
  PREIS_UNBEKANNT: 'Preis für den Leistungstag nicht belegt',
  POSITION_UNGUELTIG: 'Position am Leistungstag nicht gültig',
  LEISTUNGSBETRAG_UNGUELTIG: 'Leistungsbeträge nicht plausibel',
  PREISBEREICH_NICHT_BELEGT: 'Kassenanteil für diesen Fachbereich nicht belegt',
  BEFREIUNG_UNGEKLAERT: 'Kassenanteil ohne belegte Befreiung hier nicht ermittelbar',
});

/** Bereit ist ein gespeicherter Verordnungsstatus, keine technische Versandfreigabe. */
export function bereitHtml(z = {}) {
  const kopf = '<h3 class="px-geld-gruppe-titel">Bereit zur Abrechnung (GKV)</h3><p class="px-geld-fuss">Praxisweit, unabhängig vom Abrechnungsmonat.</p>';
  const d = z.daten, b = d?.bereit;
  const count = n => Number.isSafeInteger(n) && n >= 0;
  let inhalt;
  if (z.laden && !d) inhalt = '<p class="px-geld-fuss">Abrechnungsstand wird geladen …</p>';
  else if (!b || !count(b.anzahl) || !count(b.bekanntCent) || !count(b.unbekanntAnzahl)
    || !(b.gesamtCent === null || count(b.gesamtCent)) || !count(d.abgesetzt?.anzahl)
    || !count(d.teilabgesetzt?.anzahl) || d.ungefaehr !== true) {
    inhalt = '<p class="px-geld-fuss">Abrechnungsstand gerade nicht verfügbar.</p><button type="button" class="px-knopf px-knopf--zweit" data-aktion="geld-neu">Erneut versuchen</button>';
  } else {
    const betrag = summeText(b).betrag;
    const hinweis = b.gesamtCent === null ? `Gesamtbetrag unbekannt · ${b.unbekanntAnzahl} ${b.unbekanntAnzahl === 1 ? 'Verordnung mit unbekanntem Betrag' : 'Verordnungen mit unbekanntem Betrag'}` : '';
    const gruende = (Array.isArray(b.gruende) ? b.gruende : []).filter(g => count(g?.anzahl) && g.anzahl > 0);
    inhalt = `<div class="px-geld-zeile"><span class="lbl">Verordnungen mit Status „bereit“</span><span class="zahl">${b.anzahl}</span></div>
      <div class="px-geld-zeile px-bereit-betrag"><span class="lbl">Geschätzter Kassenanteil</span><span class="zahl">≈ ${esc(betrag)}</span>
        ${hinweis ? `<span class="px-geld-hinweis">${WARN}${esc(hinweis)}</span>` : ''}</div>
      ${hinweis ? `<ul class="px-bereit-gruende">${gruende.length ? gruende.map(g => `<li>${esc(Object.hasOwn(BEREIT_GRUENDE, g.code) ? BEREIT_GRUENDE[g.code] : 'Kassenanteil noch zu klären')}: ${g.anzahl} ${g.anzahl === 1 ? 'Verordnung' : 'Verordnungen'}</li>`).join('') : '<li>Kassenanteil noch zu klären</li>'}</ul><p class="px-geld-fuss">Mehrere Gründe je Verordnung möglich.</p>` : ''}
      <div class="px-geld-zeile"><span class="lbl">Abgesetzt (Verordnungen)</span><span class="zahl">${d.abgesetzt.anzahl}</span></div>
      <div class="px-geld-zeile"><span class="lbl">Teilabgesetzt (Verordnungen)</span><span class="zahl">${d.teilabgesetzt.anzahl}</span></div>
      <p class="px-geld-fuss">Gespeicherter Status, keine technische Versandfreigabe. Kein gemeinsamer Transaktionsstand.</p>`;
    if (z.fehler) inhalt += '<p class="px-geld-hinweis">Aktualisierung fehlgeschlagen. Zuletzt geladener Stand.</p>';
  }
  return `<div class="px-geld"><div class="px-geld-gruppe">${kopf}${inhalt}<button type="button" class="px-fuss-knopf" data-ziel="abrechnung">Zur Abrechnung</button></div></div>`;
}

/** B06: höchste Mahnstufe je Forderung, belegter Rest; keine vollständige Forderungsübersicht. */
export function mahnungenHtml(z = {}) {
  const kopf = '<h3 class="px-geld-gruppe-titel">Mahnungen</h3><p class="px-geld-fuss">Bereits gemahnte Forderungen, aktuell belegter Rest. Unabhängig vom Abrechnungsmonat.</p>';
  let inhalt;
  if (z.laden && !z.daten) inhalt = '<p class="px-geld-fuss">Mahnstufen werden geladen …</p>';
  else if (!z.daten || !Array.isArray(z.daten.stufen) || z.daten.stufen.length !== 3
    || z.daten.stufen.some((s, i) => s?.stufe !== i + 1)) {
    inhalt = '<p class="px-geld-fuss">Mahnstufen gerade nicht verfügbar.</p><button type="button" class="px-knopf px-knopf--zweit" data-aktion="geld-neu">Erneut versuchen</button>';
  } else {
    inhalt = z.daten.stufen.map((s, i) => {
      const anzahl = Number.isSafeInteger(s.anzahl) ? `${s.anzahl} ${s.anzahl === 1 ? 'Forderung' : 'Forderungen'}`
        : `Teilerfassung: ${Number.isSafeInteger(s.bekanntAnzahl) ? s.bekanntAnzahl : '–'} ${s.bekanntAnzahl === 1 ? 'bekannte Forderung' : 'bekannte Forderungen'} · Gesamtanzahl unbekannt`;
      return `${zeile(`Stufe ${i + 1}`, s.rest)}<p class="px-geld-fuss">${esc(anzahl)}</p>`;
    }).join('');
    if (z.fehler) inhalt += '<p class="px-geld-hinweis">Aktualisierung fehlgeschlagen. Zuletzt geladener Stand.</p>';
  }
  return `<div class="px-geld"><div class="px-geld-gruppe">${kopf}${inhalt}<p class="px-geld-fuss">Höchste Stufe je Forderung; kein gemeinsamer Transaktionsstand.</p><button type="button" class="px-fuss-knopf" data-ziel="mahnwesen">Zum Mahnwesen</button></div></div>`;
}

/**
 * Reine Hilfe (testbar): HTML der Karte.
 * @param {{laden?: boolean, fehler?: boolean, daten?: object|null}} z
 */
export function geldKarteHtml(z = {}, mahnungen = {}, abrechnung = {}) {
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
      ${zuzahlungHtml(d.offen?.zuzahlung)}
      <p class="px-geld-fuss">Vollständige offene Privat-, BG-, Selbstzahler- und Ausfallforderungen sind hier noch nicht enthalten.</p>
    </div>`;
  }
  const unter = z.daten ? [monatText(z.daten.monat), 'alle Standorte'].filter(Boolean).join(' · ') : 'Dieser Monat';
  return `<section class="px-karte px-k-geld" aria-labelledby="pxGeldTitel">${kopf(unter)}${rumpf}${bereitHtml(abrechnung)}${mahnungenHtml(mahnungen)}
    <div class="px-karte-fuss"><button type="button" class="px-fuss-knopf" data-ziel="belegliste">Zum Kassenbuch <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div></section>`;
}

/**
 * Holt Finanzblock (nur Inhaber aufrufen). Gemeinsame Auth-/Fehlerbehandlung.
 * Historischer Funktionsname bleibt für bestehende Aufrufer erhalten.
 * @param {{supabase: object, apiBase: string, fetchFn?: Function, blockName?: string}} o
 */
export async function holeGeld({ supabase, apiBase, fetchFn = (...a) => fetch(...a), blockName = 'geld' }) {
  if (!['geld', 'mahnungen', 'abrechnung'].includes(blockName)) throw new Error('UNGUELTIGER_BLOCK');
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token || !apiBase) throw new Error('KEINE_SITZUNG');
  const res = await fetchFn(`${String(apiBase).replace(/\/+$/, '')}/startseite/zusammenfassung?bloecke=${blockName}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const block = (await res.json())?.bloecke?.[blockName];
  if (block?.status !== 'ok' || !block.daten || typeof block.daten !== 'object') throw new Error('BLOCK_NICHT_VERFUEGBAR');
  return block.daten;
}
