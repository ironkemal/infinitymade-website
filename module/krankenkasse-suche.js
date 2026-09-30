/**
 * krankenkasse-suche.js — Kassenauswahl, die die eigene Praxis kennt.
 *
 * Warum es das gibt
 * ─────────────────
 * Die Kassenauswahl war ein `<input list="leadKkDatalist">` mit 93 gesetzlichen
 * Kassen in alphabetischer Reihenfolge. Zwei Probleme:
 *
 *   1. `<datalist>` ist im Haus untersagt (CLAUDE.md → Frontend). Es sieht auf
 *      jedem Browser anders aus, lässt sich nicht gestalten, kann nichts
 *      gruppieren und öffnet neben unseren eigenen Dropdowns ein zweites,
 *      fremdes Menü.
 *   2. Alphabetisch heisst: „AOK Bayern" steht in der Nähe von „actimonda",
 *      und die fünf Kassen, aus denen fast alle Patienten dieser Praxis kommen,
 *      sind über die ganze Liste verteilt. Beta-2 im Beta-Gespräch (12.08.2026):
 *      seine Patienten sind ganz überwiegend AOK Bayern, Barmer, SBK, TK, HEK
 *      und ein paar BKKs.
 *
 * Woher die Reihenfolge kommt
 * ───────────────────────────
 * NICHT aus einer gepflegten Liste im Code. Eine fest verdrahtete Top-5 wäre
 * für Nürnberg richtig und für Flensburg falsch, und niemand würde sie je
 * nachziehen. Stattdessen zählt diese Datei, welche Kassen in der Kartei DIESER
 * Praxis tatsächlich vorkommen (`leads.krankenkasse`) — die Liste stimmt damit
 * ab dem zwanzigsten Patienten von selbst und bleibt richtig, wenn die Praxis
 * umzieht oder den Schwerpunkt wechselt.
 *
 * Solange noch keine Patienten da sind, bleibt es bei alphabetisch; dann gibt
 * es schlicht nichts zu bevorzugen.
 *
 * Die Dropdown-Mechanik kommt aus `katalog-suche.js` (`attachAutocomplete`) —
 * dieselbe Tastatursteuerung, Positionierung und Trennlogik wie bei Diagnosen
 * und Heilmitteln. Hier steht nur, WAS angezeigt wird, nicht WIE.
 */

'use strict';

import { attachAutocomplete } from '../katalog-suche.js?v=20261001a';

/** @type {{ownerId: string, kassen: Array, haeufig: Map}|null} */
let cache = null;

/**
 * Alle Kassen + die Häufigkeit in der eigenen Kartei.
 * @param sb        Supabase-Client
 * @param ownerId   Mandant
 */
export async function ladeKassen(sb, ownerId) {
  if (cache && cache.ownerId === ownerId) return cache;

  const [alle, eigene] = await Promise.all([
    sb.from('krankenkassen').select('name, abbreviation, ik_number, type').order('name'),
    // Nur das Namensfeld — es geht um Häufigkeit, nicht um Patientendaten.
    sb.from('leads').select('krankenkasse').eq('owner_id', ownerId).not('krankenkasse', 'is', null),
  ]);

  if (alle.error) {
    console.warn('[krankenkasse-suche] Kassenliste:', alle.error.message);
    return { ownerId, kassen: [], haeufig: new Map() };
  }

  const haeufig = new Map();
  for (const z of (eigene.data || [])) {
    const k = normalisiere(z.krankenkasse);
    if (k) haeufig.set(k, (haeufig.get(k) || 0) + 1);
  }

  const kassen = (alle.data || []).map(k => ({
    name: k.name,
    kurz: k.abbreviation || null,
    ik:   k.ik_number || null,
    typ:  k.type || 'gesetzlich',
    anzahl: haeufig.get(normalisiere(k.name)) || 0,
  }));

  cache = { ownerId, kassen, haeufig };
  return cache;
}

/** Cache wegwerfen — nach dem Anlegen von Patienten ändert sich die Reihenfolge. */
export function verwerfeKassenCache() { cache = null; }

function normalisiere(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Treffer suchen. Praxiseigene Kassen zuerst (nach Häufigkeit), danach der Rest
 * alphabetisch.
 */
// Grenze grosszuegig: es gibt 94 Kassen in der Tabelle, und die Liste ist
// alphabetisch. Mit einer Obergrenze von 30 brach sie mitten im „B" ab — der
// Anwender sah ein Fuenftel des Bestandes und hielt die Datenquelle fuer falsch.
// Das Dropdown scrollt ohnehin (max-height in dashboard.css), also kostet die
// vollstaendige Liste nichts ausser ein paar Zeilen DOM.
export function sucheKassen(kassen, query, limit = 300) {
  const q = normalisiere(query);
  const passt = q
    ? kassen.filter(k => normalisiere(k.name).includes(q) || normalisiere(k.kurz).includes(q))
    : kassen.slice();

  return passt
    .sort((a, b) => (b.anzahl - a.anzahl) || a.name.localeCompare(b.name, 'de'))
    .slice(0, limit);
}

// ── IK-Suche (Ops #300, Konsey 21.09.2026) ─────────────────────────────────
//
// Der Podologe tippt die IK von Muster 13 — die KARTEN-IK. Sie steht nur in
// `kostentraeger` (eigene Zeile, die per `abrechnender_kt_ik` auf die abrechnende
// IK verweist), nicht in `krankenkassen.ik_number` (dort steht die abrechnende
// IK). DAK: Karte 100167999 → abgerechnet wird bei 105830016.
//
// Diese drei Funktionen sind der reine Teil: sie kennen weder Netz noch DOM.
// Welche Zeilen überhaupt Kassen sind (ohne Rechenzentren und Pflegekassen),
// entscheidet die View `kostentraeger_auswahl`, nicht dieser Code.

/**
 * Erst ab drei Ziffern wird nach IK gesucht: 1.020 von 1.043 IK beginnen mit
 * „10", bei zwei Stellen filtert der Präfix nichts. Bei drei Stellen hat der
 * größte Präfix („108") 189 Treffer, bei vier („1080") 86 — gemessen am Seed
 * `0006_seed_kostentraeger.sql` (Obergrenze; die View zeigt weniger Zeilen).
 * gkv-302 hatte vier empfohlen; drei ist die Entscheidung von Melih (21.09.2026),
 * dafür ist die Trefferliste länger und scrollt.
 */
export const IK_MIN_ZIFFERN = 3;

/** Mehr Treffer als der größte Dreier-Präfix (189 im Seed) — sonst schnitte die Liste still ab. */
const IK_TREFFER_MAX = 300;

/**
 * Ist die Eingabe eine IK-Suche? Dann die Ziffern, sonst null.
 * Nur reine Ziffern zählen (Leerzeichen und Punkte werden vorher entfernt).
 * „AOK 105" ist ein Name und bleibt bei der Namenssuche.
 */
export function ikAusEingabe(query) {
  const ziffern = String(query ?? '').replace(/[\s.]/g, '');
  return /^\d+$/.test(ziffern) && ziffern.length >= IK_MIN_ZIFFERN ? ziffern : null;
}

/**
 * IK, an die abgerechnet wird: der Verweis der Karten-IK, sonst die eigene.
 * Wie `COALESCE(abrechnender_kt_ik, ik)` — nur zählt hier auch ein leerer String
 * als „fehlt" (`||` statt `??`): eine leere IK im Feld wäre schlechter als die
 * eigene.
 *
 * ⚠️ Das ist die Kostenträger-IK (`prescriptions.kostentraeger_ik`), NICHT das,
 * was `rzPatKasseIk` speichert: das Feld trägt seit 30.09.2026 die Karten-IK
 * (`prescriptions.krankenkasse_ik`, gkv-302, Anlage 1 TP5 V21 §5.5.2/§5.5.3.1).
 * Die Kostenträger-IK leitet der Server beim Speichern daraus ab
 * (`kostentraegerIkAufloesen`, api-backend/lib/rezept-felder.js); hier dient die
 * Ableitung nur der Anzeige („Karte X → Kostenträger Y").
 */
export function aufgeloesteIk(zeile) {
  return zeile.abrechnender_kt_ik || zeile.ik;
}

/**
 * Karten-IK normalisieren: 9 Ziffern oder `null` (Leerraum/Punkte fallen weg,
 * nichts wird aufgefüllt). Spiegel von `kartenIkNormalisieren()` in
 * `api-backend/lib/rezept-felder.js` — der Server prüft beim Speichern
 * ohnehin selbst (zwei Deploys, kein gemeinsamer Import).
 */
export function kartenIkNormalisieren(roh) {
  const ziffern = String(roh ?? '').replace(/\D/g, '');
  return /^\d{9}$/.test(ziffern) ? ziffern : null;
}

/**
 * Ist die Verordnung kassenseitig „bereit"? Kostenträger UND Karten-IK (9 Ziffern)
 * müssen da sein — sonst erscheint sie in der Liste als bereit und scheitert beim
 * Erzeugen der Datei mit 422 (billing/utils/karten-ik.js, gkv-302 30.09.2026).
 * @param {{kostentraeger_ik?: ?string, krankenkasse_ik?: ?string}} rx
 */
export function kasseAbrechnungsbereit(rx) {
  return !!(rx?.kostentraeger_ik && kartenIkNormalisieren(rx.krankenkasse_ik));
}

/**
 * Hinweise zum Karten-IK-Feld beim Speichern (leeres Array = in Ordnung).
 * Kein Blocker: die OCR legt Verordnungen zuerst unvollständig an — aber erst
 * mit Karten-IK kommt die Verordnung in eine Abrechnung.
 */
export function kartenIkHinweise(roh) {
  if (!String(roh ?? '').trim()) return [HINWEISE.de.ikFehlt];
  return kartenIkNormalisieren(roh) ? [] : [HINWEISE.de.ikFormat];
}

/**
 * IK-Präfixsuche über Zeilen der View `kostentraeger_auswahl`.
 * Die Treffer haben dieselbe Form wie Kassen aus `sucheKassen` — so rendern und
 * wählen `attachKrankenkasseSuche` beide Quellen mit demselben Code. `ik` ist die
 * AUFGELÖSTE IK (das, was ins Feld kommt), `kartenIk` die abgetippte.
 * Sortiert nach IK; die Kassenhäufigkeit der Praxis spielt hier keine Rolle.
 * Limit grosszuegig wie bei `sucheKassen`: der größte Präfix ab drei Ziffern hat
 * 189 Treffer, und ein zu kleines Limit schnitte hier still Kassen ab. Das
 * Dropdown scrollt ohnehin (max-height in dashboard.css).
 */
export function sucheKostentraeger(zeilen, query, limit = IK_TREFFER_MAX) {
  const ziffern = ikAusEingabe(query);
  if (!ziffern) return [];

  return (zeilen || [])
    .filter(z => z.ik && z.ik.startsWith(ziffern))
    .sort((a, b) => a.ik.localeCompare(b.ik, 'de'))
    .slice(0, limit)
    .map(z => ({
      name: z.name,
      kurz: z.kurzname || null,
      ik: aufgeloesteIk(z),
      kartenIk: z.ik,
      typ: 'gesetzlich',
      anzahl: 0,
      quelle: 'kostentraeger',
    }));
}

// ── Anschluss ans Feld ──────────────────────────────────────────────────────

let viewWarnungGezeigt = false;

/** Nur für Tests: die „nur einmal warnen"-Sperre zurücksetzen. */
export function _warnungZuruecksetzen() { viewWarnungGezeigt = false; }

function warneEinmal(grund) {
  if (viewWarnungGezeigt) return;
  viewWarnungGezeigt = true;
  console.warn('[krankenkasse-suche] IK-Suche nicht verfügbar (View kostentraeger_auswahl):', grund);
}

/**
 * Präfixabfrage gegen die View `kostentraeger_auswahl` (Migration 0040) — pro
 * Eingabe serverseitig statt die ganze Tabelle zu laden: kein Cache, der
 * veralten könnte, und kein PostgREST-Zeilenlimit. `ziffern` sind nur Ziffern
 * (`ikAusEingabe`), es gelangt also kein Platzhalter in das `like`.
 * Fehlt die View noch (Migration nicht live), kommt eine leere Liste und EINE
 * Warnung — die Namenssuche bleibt davon unberührt.
 */
async function holeKostentraeger(sb, ziffern) {
  try {
    const { data, error } = await sb.from('kostentraeger_auswahl')
      .select('ik, name, kurzname, abrechnender_kt_ik')
      .like('ik', `${ziffern}%`)
      .order('ik')
      .limit(IK_TREFFER_MAX);
    if (error) { warneEinmal(error.message || error.code); return []; }
    return data || [];
  } catch (e) {
    warneEinmal(e?.message || e);
    return [];
  }
}

/**
 * Die Weiche des Kassenfelds: reine Ziffern (≥ 3) → IK-Suche in der View, sonst
 * die Namenssuche über `krankenkassen`. Bei einer IK-Eingabe läuft KEINE
 * Namenssuche (Entscheidung Melih 21.09.2026). Wirft nie: `attachAutocomplete`
 * fängt eine Ausnahme aus `fetchItems` nicht ab.
 */
export async function sucheKassenfeld(sb, ownerId, query) {
  try {
    const ziffern = ikAusEingabe(query);
    if (ziffern) return sucheKostentraeger(await holeKostentraeger(sb, ziffern), ziffern);
    const { kassen } = await ladeKassen(sb, ownerId);
    return sucheKassen(kassen, query);
  } catch (e) {
    console.warn('[krankenkasse-suche] Suche:', e);
    return [];
  }
}

/** IK-Angabe in der Trefferzeile: bei einer Auflösung „Karte → abrechnende IK". */
export function ikAnzeige(k) {
  if (k.quelle === 'kostentraeger' && k.kartenIk && k.kartenIk !== k.ik) return `IK ${k.kartenIk} → ${k.ik}`;
  return k.ik ? `IK ${k.ik}` : '';
}

// Texte des Hinweises unter dem IK-Feld. Bewusst hier und nicht im Wörterbuch
// von dashboard.js: das darf nicht wachsen (CLAUDE.md, Konsey 2026-08-13). Die
// Sprache kommt aus <html lang>, das dashboard.js beim Wechsel setzt.
const HINWEISE = {
  de: {
    // Karten-IK (30.09.2026, gkv-302): nur Deutsch — das Produkt ist deutschsprachig.
    ikEintragen: 'IK von der Versichertenkarte eintragen (nicht die Kassen-IK aus der Suche).',
    ikFehlt: 'IK der Krankenkasse von der Versichertenkarte fehlt — ohne sie kommt die Verordnung nicht in eine Abrechnung.',
    ikFormat: 'IK der Krankenkasse muss genau 9 Ziffern haben.',
    ikUnbekannt: 'Zu dieser IK wurde kein Kostenträger gefunden — bitte mit der Versichertenkarte abgleichen.',
    kostentraeger: (karte, name, kt) => karte === kt ? `Kostenträger: ${name} (IK ${kt})` : `Karte ${karte} → Kostenträger ${name} (IK ${kt})`,
    aufgeloest: (karte, ik) => `Karte ${karte} → rechnet ab bei ${ik}`,
    abweichend: (vorhanden, karte) => `Im Feld steht bereits ${vorhanden} — die gewählte Kasse hat die Karten-IK ${karte}. Nicht überschrieben.`,
  },
  en: {
    aufgeloest: (karte, ik) => `Card ${karte} → bills via ${ik}`,
    abweichend: (vorhanden, karte) => `The field already contains ${vorhanden} — the selected fund has card IK ${karte}. Not overwritten.`,
  },
  tr: {
    aufgeloest: (karte, ik) => `Kart ${karte} → ${ik} üzerinden faturalanır`,
    abweichend: (vorhanden, karte) => `Alanda zaten ${vorhanden} var — seçilen kasanın kart IK'sı ${karte}. Üzerine yazılmadı.`,
  },
};

/**
 * Was unter dem IK-Feld stehen bleibt, nachdem eine Kasse gewählt wurde.
 * Das Feld trägt die KARTEN-IK (von der Versichertenkarte, gkv-302 30.09.2026):
 *  - Treffer aus der IK-Suche: die getippte Karten-IK wird eingetragen. War das
 *    Feld schon mit einer ANDEREN IK gefüllt (Handeingabe, OCR), bleibt sie
 *    stehen und die Abweichung wird sichtbar (Konsey 21.09.2026). Sonst, wenn
 *    die Karte auf einen anderen Kostenträger verweist: die Auflösung.
 *  - Treffer aus der Namenssuche: `k.ik` ist die IK des Kostenträgers, NICHT die
 *    der Karte — sie kommt deshalb nie ins Feld. Bleibt das Feld leer, steht der
 *    Hinweis, die IK von der Karte einzutragen.
 */
export function hinweisZeile(k, vorhandeneIk, sprache = 'de') {
  if (!k) return '';
  const T = HINWEISE[sprache] || HINWEISE.de;
  const vorhanden = String(vorhandeneIk || '').trim();
  if (k.quelle === 'kostentraeger') {
    if (!k.kartenIk) return '';
    if (vorhanden && vorhanden !== k.kartenIk) return T.abweichend(vorhanden, k.kartenIk);
    if (k.kartenIk !== k.ik) return T.aufgeloest(k.kartenIk, k.ik);
    return '';
  }
  return vorhanden ? '' : (T.ikEintragen || HINWEISE.de.ikEintragen);
}

/**
 * Prüft die eingetragene Karten-IK gegen die Kostenträgerdatei (View
 * `kostentraeger_auswahl`) und nennt den daraus abgeleiteten Kostenträger.
 * Wirft nie. `status`: 'leer' | 'format' | 'unbekannt' | 'ok'.
 */
export async function kartenIkStatus(sb, roh) {
  if (!String(roh ?? '').trim()) return { status: 'leer', text: '' };
  const ik = kartenIkNormalisieren(roh);
  if (!ik) return { status: 'format', text: HINWEISE.de.ikFormat };
  const zeile = (await holeKostentraeger(sb, ik)).find(z => z.ik === ik);
  if (!zeile) return { status: 'unbekannt', kartenIk: ik, text: HINWEISE.de.ikUnbekannt };
  const kt = aufgeloesteIk(zeile);
  return {
    status: 'ok', kartenIk: ik, kostentraegerIk: kt,
    text: HINWEISE.de.kostentraeger(ik, zeile.kurzname || zeile.name, kt),
  };
}

function ikHinweisElement(ikEl) {
  let el = document.getElementById(ikEl.id + 'Hinweis');
  if (!el) {
    el = document.createElement('div');
    el.id = ikEl.id + 'Hinweis';
    el.setAttribute('role', 'status');
    el.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:2px;';
    ikEl.insertAdjacentElement('afterend', el);
  }
  return el;
}

function zeigeIkHinweis(ikEl, k, vorher) {
  if (!ikEl) return;
  ikHinweisElement(ikEl).textContent = hinweisZeile(k, vorher, document.documentElement.lang || 'de');
}

function loescheIkHinweis(ikEl) {
  const el = document.getElementById(ikEl.id + 'Hinweis');
  if (el) el.textContent = '';
}

let _hinweisSb = null;

/**
 * Hinweis unter dem IK-Feld neu berechnen, nachdem ein Programm den Wert
 * geschrieben hat (Maske füllen löst kein `input`/`change` aus — der Hinweis
 * zum vorher getippten Wert blieb sonst stehen, canli-test 30.09.2026).
 * Erst leeren, dann (falls Wert + Client bekannt) neu prüfen. Wirft nie.
 */
export async function tazeleIkHinweis(ikEl) {
  if (!ikEl) return;
  loescheIkHinweis(ikEl);
  const wert = ikEl.value;
  if (!String(wert ?? '').trim() || !_hinweisSb) return;
  try {
    const r = await kartenIkStatus(_hinweisSb, wert);
    if (ikEl.value !== wert) return;
    if (r.text) ikHinweisElement(ikEl).textContent = r.text;
  } catch { /* Hinweis ist Zugabe */ }
}

/**
 * Hängt die Kassenauswahl an ein Textfeld.
 *
 * Ops-Kart #264 (Krankenkasse → IK): füllt automatisch ein Geschwisterfeld
 * `<id des inputEl>Ik`, falls es existiert und noch leer ist — z. B.
 * `rzPatKasse` → `rzPatKasseIk` in der Muster-13-Maske. Kein neuer Aufruf im
 * Dashboard nötig (dashboard.js darf nicht wachsen, siehe CLAUDE.md); die
 * Namenskonvention war in der Maske schon da, nur ungenutzt. Überschreibt
 * NIE einen vorhandenen Wert — eine per OCR gelesene oder von Hand korrigierte
 * IK bleibt stehen, das Feld bleibt frei editierbar (Ersatzkassen haben laut
 * gkv-302 mehrere IK, `ik_number` ist die eine kanonische, kein Zwang).
 *
 * @param {HTMLInputElement} inputEl
 * @param {object} cfg
 * @param {object} cfg.sb           Supabase-Client
 * @param {Function} cfg.ownerId    () => string
 * @param {Function} [cfg.onSelect] (kasse) => void — bekommt auch die IK-Nummer
 */
export function attachKrankenkasseSuche(inputEl, cfg = {}) {
  // Idempotent: die eingebettete Maske ruft das bei jedem Öffnen (sonst stapeln sich die Listener).
  if (!inputEl || inputEl.dataset.katalogWired === '1') return;
  const { sb, ownerId, onSelect = null } = cfg;
  if (sb) _hinweisSb = sb;
  const ikEl = inputEl.id ? document.getElementById(inputEl.id + 'Ik') : null;

  // Das alte <datalist> würde sonst als zweites Menü danebenstehen.
  inputEl.removeAttribute('list');
  inputEl.setAttribute('autocomplete', 'off');

  attachAutocomplete(inputEl, {
    minChars: 0,          // leeres Feld zeigt die Kassen der Praxis — der Normalfall
    ariaLabel: 'Krankenkassen',
    separatorLabel: 'Weitere Kassen',
    // Trenner genau dort, wo die eigenen Kassen aufhören.
    needsSeparator: (prev, cur) => prev.anzahl > 0 && cur.anzahl === 0,

    // Ziffern → IK-Suche (View), sonst Namenssuche — siehe sucheKassenfeld().
    fetchItems: query => sucheKassenfeld(sb, ownerId(), query),

    toText: k => k.name,

    renderItem: k => {
      const ikText = ikAnzeige(k);
      const ik = ikText ? `<span style="color:var(--text-muted);font-size:11px;">${esc(ikText)}</span>` : '';
      // Die Zahl erklärt die Reihenfolge. Ohne sie wirkt eine nicht-alphabetische
      // Liste wie ein Fehler.
      const zaehler = k.anzahl > 0
        ? `<span style="color:var(--text-muted);font-size:11px;">${k.anzahl}×</span>`
        : '';
      return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">
                <span>${esc(k.name)}${k.kurz && k.kurz !== k.name ? ` <span style="color:var(--text-muted);font-size:11px;">${esc(k.kurz)}</span>` : ''}</span>
                <span style="display:flex;gap:8px;white-space:nowrap;">${zaehler}${ik}</span>
              </div>`;
    },

    onSelect: k => {
      const vorher = ikEl ? ikEl.value : '';
      if (ikEl && k.quelle === 'kostentraeger' && k.kartenIk && !ikEl.value) { ikEl.value = k.kartenIk; }
      zeigeIkHinweis(ikEl, k, vorher);
      if (onSelect) onSelect(k);
    },
  });

  // Ein neuer Tastendruck im Kassen- oder im IK-Feld macht den alten Hinweis
  // ungültig. Die Auswahl selbst löst ebenfalls ein input-Ereignis aus — der
  // Hinweis wird danach in onSelect gesetzt, nicht davor gelöscht.
  if (ikEl) {
    const weg = () => loescheIkHinweis(ikEl);
    inputEl.addEventListener('input', weg);
    ikEl.addEventListener('input', weg);
    // Nach dem Tippen der Karten-IK: Format prüfen und den abgeleiteten
    // Kostenträger zeigen. Veraltete Antworten (Feld inzwischen geändert) fallen weg.
    ikEl.addEventListener('change', async () => {
      const wert = ikEl.value;
      const r = await kartenIkStatus(sb, wert);
      if (ikEl.value !== wert) return;
      ikHinweisElement(ikEl).textContent = r.text;
    });
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
