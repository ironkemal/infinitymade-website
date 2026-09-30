/**
 * offene-einheiten.js — Teilabrechnung einer podologischen Verordnung.
 *
 * Reform S2.3 (Kemal 28.09.2026, gkv-302 29.09.2026): Wer eine Verordnung mit
 * noch offenen Einheiten abrechnet, beendet sie. Die Restmenge lässt sich auf
 * dieser Verordnung weder erbringen noch abrechnen (Richtlinien § 302 § 7
 * Abs. 1, Podo-Anlage 3 p)/q); Korrekturverfahren UE Frage 1 — VKZ 02 rettet
 * das nicht). Deshalb nie ohne bewusste, protokollierte Bestätigung.
 *
 * Reine Funktionen, kein DOM. „Erbracht" = nicht stornierte Zeilen in
 * `podologie_behandlungen` — derselbe Zähler wie die automatische Bereit-
 * Markierung (podologie-abrechnung.js) und verordnung-status.routes.js.
 * Termine (`terminZaehler`) und HPNR-Summen sind KEIN Ersatz dafür.
 */

import { alsISODatum } from './datum.js?v=20260930f';

/**
 * @param {?number|string} verordnet  `prescriptions.behandlungseinheiten`
 * @param {number} erbracht           Anzahl nicht stornierter Behandlungen
 * @returns {number}  0, wenn die Menge unbekannt ist
 */
export function offeneEinheiten(verordnet, erbracht) {
  const v = Number(verordnet);
  if (!Number.isFinite(v) || v <= 0) return 0;
  const e = Math.max(0, Number(erbracht) || 0);
  return Math.max(0, v - e);
}

/**
 * Vorauswahl in der §302-Liste: eine Verordnung mit offenen Einheiten wird
 * nicht von selbst mitgenommen — außer ihre Bereit-Bestätigung gilt noch
 * (`bereitBestaetigt`, Reform S2.3b).
 */
export function vorausgewaehltPodo(zeile) {
  return !(Number(zeile?.offen) > 0) || zeile?.bereitBestaetigt === true;
}

/**
 * @param {Array<{id:string, patient?:string, nummer?:string, offen?:number}>} zeilen  gewählte Podo-Zeilen
 * @returns {Array<{id:string, patient:string, nummer:string, offen:number}>}
 */
export function offeneAuswahl(zeilen) {
  return (zeilen || [])
    .filter(z => Number(z?.offen) > 0 && z?.bereitBestaetigt !== true)
    .map(z => ({
      id: z.id, patient: z.patient || '—', nummer: z.nummer || '', offen: Number(z.offen),
      ...(z.termine !== undefined && { termine: z.termine }),
      ...(z.freigabeAm !== undefined && { freigabeAm: z.freigabeAm, freigabeOffen: z.freigabeOffen }),
    }));
}

/**
 * Datum ohne Jahr, wenn es das laufende ist: „14.10." — sonst „14.10.2027".
 * @param {Date|string|number} wert  ISO-Zeitpunkt/Kalendertag
 * @param {Date} [heute]
 * @returns {string} '' bei ungültigem Wert
 */
export function datumKurz(wert, heute = new Date()) {
  const iso = typeof wert === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wert) ? wert : alsISODatum(wert);
  if (!iso) return '';
  const [j, m, t] = iso.split('-');
  return j === String(heute.getFullYear()) ? `${t}.${m}.` : `${t}.${m}.${j}`;
}

/**
 * Grund der Rückfrage (Reform S2.3b, Beschluss 30.09.2026). Ergänzt den
 * freigegebenen Text, ersetzt ihn nie. Leer, wenn es keinen Grund gibt.
 * @param {{termine?:Array, freigabeAm?:*, freigabeOffen?:*, offen?:number}} e
 *   termine: künftige, nicht stornierte Termine (Zeitpunkte, beliebige Reihenfolge)
 *   freigabeAm/freigabeOffen: Bereit-Protokoll (Datum, damals offen) — nur gesetzt,
 *   wenn sich die Zahl seither geändert hat
 * @returns {{zeilen:string[], kurz:string}} zeilen = ganze Sätze (Einzeldialog),
 *   kurz = Anhängsel für eine Listenzeile („ · Termin am 14.10. geplant"), sonst ''
 */
export function rueckfrageGrund(e, heute = new Date()) {
  const zeilen = [];
  const kurz = [];
  const ts = (Array.isArray(e?.termine) ? e.termine : [])
    .map(t => new Date(t)).filter(d => !Number.isNaN(d.getTime())).sort((a, b) => a - b);
  if (ts.length === 1) {
    const d = datumKurz(ts[0], heute);
    zeilen.push(`Für diese Verordnung ist noch ein Termin am ${d} geplant.`);
    kurz.push(`Termin am ${d} geplant`);
  } else if (ts.length > 1) {
    const d = datumKurz(ts[0], heute);
    zeilen.push(`Für diese Verordnung sind noch ${ts.length} Termine geplant (nächster am ${d}).`);
    kurz.push(`${ts.length} Termine geplant (nächster am ${d})`);
  }
  const am = e?.freigabeAm ? datumKurz(e.freigabeAm, heute) : '';
  if (am && e.freigabeOffen != null && Number.isFinite(Number(e.freigabeOffen))
      && Number.isFinite(Number(e.offen)) && Number(e.freigabeOffen) !== Number(e.offen)) {
    zeilen.push(`Seit der Freigabe am ${am} hat sich die Zahl offener Einheiten geändert (damals ${Number(e.freigabeOffen)}, jetzt ${Number(e.offen)}).`);
    kurz.push(`seit Freigabe geändert (damals ${Number(e.freigabeOffen)})`);
  }
  return { zeilen, kurz: kurz.length ? ' · ' + kurz.join(' · ') : '' };
}

/**
 * Gründe je Verordnung aus den bereits geladenen Zeilen (reine Aufbereitung).
 * @param {Array<{id:string, offen:number}>} offene
 * @param {Array<{prescription_id:string, input_snapshot?:{offen?:number}, created_at?:string}>} bereitZeilen
 * @param {Array<{verordnung_id:string, start_time:string}>} kuenftigeTermine
 * @returns {Map<string,{termine:string[], freigabeAm?:string, freigabeOffen?:number}>}
 */
export function grundDaten(offene, bereitZeilen, kuenftigeTermine) {
  const neueste = new Map();
  for (const z of bereitZeilen || []) {
    const alt = neueste.get(z?.prescription_id);
    if (!alt || String(z.created_at || '') > String(alt.created_at || '')) neueste.set(z?.prescription_id, z);
  }
  const out = new Map();
  for (const o of offene || []) {
    const termine = (kuenftigeTermine || []).filter(t => t.verordnung_id === o.id && t.start_time).map(t => t.start_time);
    const z = neueste.get(o.id);
    const damals = z?.input_snapshot?.offen;
    const d = { termine };
    if (z && damals != null && Number(damals) !== Number(o.offen)) {
      d.freigabeAm = z.created_at;
      d.freigabeOffen = Number(damals);
    }
    out.set(o.id, d);
  }
  return out;
}

/**
 * Text des Bestätigungsdialogs (freigegebener Wortlaut, gkv-302 29.09.2026).
 * „N Einheit(en)" bleibt bewusst so — kein Plural-Umbau.
 * @param {Array<{patient:string, nummer:string, offen:number}>} eintraege
 * @returns {{title:string, message:string, confirmText:string, cancelText:string}}
 */
export function bestaetigungsText(eintraege, heute = new Date()) {
  const liste = eintraege || [];
  const einzeln = liste.length <= 1;
  const kopf = einzeln ? '' : liste.map(e =>
    `${e.patient} · ${e.nummer}: ${e.offen} offen${rueckfrageGrund(e, heute).kurz}`).join('\n') + '\n\n';
  const grund = einzeln && liste[0] ? rueckfrageGrund(liste[0], heute).zeilen : [];
  const koerper = einzeln
    ? `Es sind noch ${liste[0]?.offen ?? 0} Einheit(en) offen. `
    : 'Es sind noch Einheiten offen. ';
  return {
    title: 'Verordnung vorzeitig abrechnen?',
    message: kopf + koerper
      + 'Mit der Abrechnung wird die Verordnung beendet – die offenen Einheiten können auf dieser Verordnung nicht mehr erbracht oder abgerechnet werden. '
      + 'Bitte das Datum des Behandlungsabbruchs auf der Rückseite der Verordnung vermerken.'
      + '\n\nBereits erbrachte, aber noch nicht dokumentierte Einheiten bitte vorher nachtragen.'
      + (grund.length ? '\n\n' + grund.join('\n') : ''),
    confirmText: 'Trotzdem abrechnen',
    cancelText: 'Abbrechen',
  };
}

/**
 * Fragt einmal für alle. Liefert die bestätigten Ids, `[]` wenn nichts offen
 * war, `null` bei Abbruch (oder wenn kein Dialog verfügbar ist — ohne Dialog
 * wird nie stillschweigend durchgewunken).
 * @param {Function} frage  showConfirmModal (Promise<boolean>)
 */
export async function frageOffeneEinheiten(zeilen, frage) {
  const offen = offeneAuswahl(zeilen);
  if (!offen.length) return [];
  if (typeof frage !== 'function') return null;
  const ok = await frage(bestaetigungsText(offen));
  return ok ? offen.map(e => e.id) : null;
}

/**
 * Reform S2.3b: Eine beim Bereit-Setzen erteilte Bestätigung („Verordnung
 * vorzeitig beenden") gilt weiter, solange sich nichts geändert hat: gleiche
 * Zahl offener Einheiten wie im Protokoll UND kein künftiger, nicht
 * stornierter Termin an der Verordnung. Sonst wird noch einmal gefragt.
 * Fehlende/ungültige Angaben => false (im Zweifel fragen).
 * @param {{offenJetzt:*, snapshotOffen:*, kuenftigeTermine:*}} p
 * @returns {boolean}
 */
export function bestaetigungNochGueltig({ offenJetzt, snapshotOffen, kuenftigeTermine } = {}) {
  if (offenJetzt == null || snapshotOffen == null || kuenftigeTermine == null) return false;
  const j = Number(offenJetzt), s = Number(snapshotOffen), t = Number(kuenftigeTermine);
  if (![j, s, t].every(Number.isFinite)) return false;
  return j > 0 && j === s && t === 0;
}

/**
 * Ids der offenen Verordnungen, deren Bereit-Bestätigung noch gilt.
 * ⚠️ `ok:false` im Protokoll heißt hier „bestätigt" — nicht danach filtern.
 * @param {Array<{id:string, offen:number}>} offene            offeneJeVerordnung
 * @param {Array<{prescription_id:string, input_snapshot?:{offen?:number}, created_at?:string}>} bereitZeilen
 *        prescription_validations (engine 'abrechnung-freigabe', result.aktion 'bereit')
 * @param {Array<{verordnung_id:string}>} kuenftigeTermine  künftige, nicht stornierte Termine
 * @returns {Set<string>}
 */
export function gueltigBestaetigteIds(offene, bereitZeilen, kuenftigeTermine) {
  const neueste = new Map();
  for (const z of bereitZeilen || []) {
    const alt = neueste.get(z?.prescription_id);
    if (!alt || String(z.created_at || '') > String(alt.created_at || '')) neueste.set(z?.prescription_id, z);
  }
  const termine = new Map();
  for (const t of kuenftigeTermine || []) termine.set(t.verordnung_id, (termine.get(t.verordnung_id) || 0) + 1);
  const out = new Set();
  for (const o of offene || []) {
    const z = neueste.get(o.id);
    if (!z) continue;
    if (bestaetigungNochGueltig({
      offenJetzt: o.offen, snapshotOffen: z.input_snapshot?.offen, kuenftigeTermine: termine.get(o.id) || 0,
    })) out.add(o.id);
  }
  return out;
}
