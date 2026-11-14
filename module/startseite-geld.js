/**
 * startseite-geld.js — Karte „Abrechnung“ der neuen Startseite (V6.B03, nur Inhaber, nur data-design="neu").
 *
 * Quelle ist der vorhandene Endpunkt GET {API}/billing/statistik?monate=1 (seit V6.B01 nur Inhaber, 403 NUR_INHABER).
 * Bewusst kein eigener Router und kein Port von rettung/…/lib/startseite/*: fonksiyon-ustasi 14.11.2026 — die Regeln
 * stehen schon in billing/zuzahlung/bezahlt.js (offen/bezahlt) und billing/api/statistik.routes.js (Kassenbuch);
 * eine zweite Rechnung wäre eine dritte Kopie. Diese Datei rechnet nichts nach, sie liest nur aus.
 *
 * E10/E13 (Melih 26.10.): „Kassiert diesen Monat“ = Forderungseingänge laut Kassenbuch (Zuzahlung, Ausfall, minus
 * Stornos), das Wort „Umsatz“ wird nicht verwendet. Was die Statistik nicht liefert (Kassenzahlungen, „bereit zur
 * Abrechnung ≈ €“, VKZ03 „Bei Kasse gefordert“), zeigt die Karte nicht als Zahl, sondern als Sprung in den Bereich.
 * Unbekannt ist nie 0 €: fehlt ein Wert oder ist er nicht endlich, steht „–“ bzw. „nicht verfügbar“.
 */
import { fmtEur } from './geld.js?v=20260909';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const anzahl = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);

/** Reine Auswertung (testbar). null = Antwort unbrauchbar; einzelne Felder null = unbekannt. */
export function geldAuswerten(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.monatlich)) return null;
  const monat = json.monatlich.at(-1);
  return {
    monat: typeof monat?.monat === 'string' ? monat.monat : null,
    kassiert: zahl(monat?.bezahlt),
    zuzahlungen: { anzahl: anzahl(json.offene_zuzahlungen), summe: zahl(json.offene_zuzahlungen_summe) },
    ausfall: { anzahl: anzahl(json.ausfallrechnungen?.offen), summe: zahl(json.ausfallrechnungen?.offen_summe) },
    offenGesamt: zahl(json.offen_gesamt_summe),
    mahnungenOffen: anzahl(json.mahnungen?.offen),
  };
}

/**
 * Lädt die Zahlen. Gibt {status:'ok', daten} | {status:'fehler'} | {status:'abgebrochen'} zurück, wirft nie.
 * Logs nur Status/Code, nie Beträge (guvenlik-Auflage wie V2.09b).
 */
export async function ladeGeld({ supabase, apiBase, signal, fetchFn = globalThis.fetch }) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token || !apiBase) return { status: 'fehler' };
    const res = await fetchFn(`${apiBase}/billing/statistik?monate=1`, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (!res.ok) { console.warn('[startseite-geld]', res.status); return { status: 'fehler' }; }
    const daten = geldAuswerten(await res.json());
    return daten ? { status: 'ok', daten } : { status: 'fehler' };
  } catch (e) {
    if (e?.name === 'AbortError' || signal?.aborted) return { status: 'abgebrochen' };
    console.warn('[startseite-geld]', e?.code || e?.name || 'fehler');
    return { status: 'fehler' };
  }
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** „2026-11“ → „November“ (Jahr nur, wenn nicht das laufende). */
export function monatText(monat, jetzt = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monat || ''));
  if (!m || +m[2] < 1 || +m[2] > 12) return '';
  return MONATE[+m[2] - 1] + (Number(m[1]) === jetzt.getFullYear() ? '' : ` ${m[1]}`);
}

const betrag = (v) => (v === null ? '–' : fmtEur(v));
const offenZeile = (titel, z) => {
  const teil = z.anzahl === null ? '' : `${z.anzahl} · `;
  return `<div class="px-geld-zeile"><span class="lbl">${esc(titel)}</span><span class="zahl">${esc(z.summe === null ? '–' : teil + fmtEur(z.summe))}</span></div>`;
};

/** Innerer Karteninhalt (ohne Kopf/Fuß) für die Zustände laden | fehler | ok. */
export function geldHtml(zustand) {
  if (!zustand || zustand.status === 'laden') return '<div class="px-karte-zustand px-karte-zustand--ruhig"><p>Abrechnungszahlen werden geladen …</p></div>';
  if (zustand.status !== 'ok' || !zustand.daten) {
    return '<div class="px-karte-zustand"><p>Abrechnungszahlen sind gerade nicht verfügbar.</p><button type="button" class="px-knopf px-knopf--zweit" data-aktion="geld-neu">Erneut versuchen</button></div>';
  }
  const d = zustand.daten;
  const monat = monatText(d.monat);
  const mahn = d.mahnungenOffen === null ? '–' : String(d.mahnungenOffen);
  return `<div class="px-geld">
    <div class="px-geld-haupt"><span class="lbl">Kassiert${monat ? ` im ${esc(monat)}` : ' diesen Monat'}</span><span class="zahl">${esc(betrag(d.kassiert))}</span></div>
    ${offenZeile('Zuzahlungen offen', d.zuzahlungen)}
    ${offenZeile('Ausfallrechnungen offen', d.ausfall)}
    <div class="px-geld-zeile"><span class="lbl">Mahnungen offen</span><span class="zahl">${esc(mahn)}</span></div>
    <p class="px-geld-fuss">Kassiert = Zuzahlungen und Ausfallrechnungen laut Belegliste, Stornos abgezogen. Kassenzahlungen und „bereit zur Abrechnung“ stehen unter §302-Abrechnung.</p>
  </div>`;
}
