/**
 * KI-Bericht Schema- und Validierungsregeln für Merkez (M4.11 / Vertrauensgrenze).
 *
 * Warum:
 * Merkez empfängt aggregierte Token-Verbrauchsdaten von dezentralen Boxen.
 * Da Merkez die Vertrauensgrenze bildet, müssen alle eingehenden Berichtsdaten
 * strikt geprüft, gegen Prototyp-Manipulation gehärtet und kanonisch normalisiert werden.
 * Unerlaubte Zusatzfelder oder verfälschte Zeitfenster werden strikt abgewiesen.
 */

import { createHash } from 'node:crypto';

// Erlaubte ID für Berichte: 1 bis 64 alphanumerische Zeichen, Bindestrich oder Unterstrich.
export const RE_REPORT_ID = /^[a-zA-Z0-9_-]{1,64}$/;

// Erlaubtes UTC-Datumsformat nach ISO 8601 (T...Z, Millisekunden optional).
export const RE_UTC_DAY = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

// Erlaubte KI-Tasks laut Vertrag mit Merkez.
export const KI_TASKS = Object.freeze([
  'b2c-draft',
  'rezept-validate',
  'rezept-ocr',
  'appointment-confirm-draft',
  'series-scheduler',
  'b2b-draft',
  'rezept-normalize',
  'transkribieren'
]);

/** @type {Set<string>} */
const ERLAUBTE_TASKS_SET = new Set(KI_TASKS);
const ERLAUBTE_TOP_FELDER = new Set(['reportId', 'windowStart', 'windowEnd', 'taskTotals']);
const ERLAUBTE_METRIK_FELDER = new Set([
  'calls',
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
  'reasoning_tokens',
  'audio_seconds'
]);

/**
 * @typedef {object} KiTaskMetrik
 * @property {number} calls
 * @property {number} prompt_tokens
 * @property {number} completion_tokens
 * @property {number} total_tokens
 * @property {number} [reasoning_tokens]
 * @property {number} [audio_seconds]
 */

/**
 * @typedef {object} KiBericht
 * @property {string} reportId
 * @property {string} windowStart
 * @property {string} windowEnd
 * @property {Record<string, KiTaskMetrik>} taskTotals
 */

/**
 * Prüft ein aggregiertes KI-Berichtsobjekt gegen die Merkez-Vertrauensgrenze.
 * Wirft NIE eine Ausnahme.
 *
 * @param {unknown} obj - Das zu prüfende Eingabeobjekt.
 * @returns {{ ok: true, bericht: KiBericht, grund?: undefined } | { ok: false, grund: string, bericht?: undefined }}
 *          grund ist immer eine sichere Konstante ('form', 'zusatzfeld', 'report_id', 'fenster', 'tasks', 'metrik')
 *          und enthält niemals Benutzereingaben.
 */
export function pruefeKiBericht(obj) {
  try {
    // 1. Grundform: Nur reine JavaScript-Objekte, keine Primitiven, kein null, keine Arrays
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, grund: 'form' };
    }

    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
      return { ok: false, grund: 'form' };
    }

    // 2. Keine Zusatzfelder auf Top-Ebene (Merkez als Vertrauensgrenze)
    const topKeys = Object.getOwnPropertyNames(obj);
    for (const key of topKeys) {
      if (!ERLAUBTE_TOP_FELDER.has(key)) {
        return { ok: false, grund: 'zusatzfeld' };
      }
    }
    if (Object.getOwnPropertySymbols(obj).length > 0) {
      return { ok: false, grund: 'zusatzfeld' };
    }

    // 3. reportId prüfen
    const { reportId, windowStart, windowEnd, taskTotals } = /** @type {Record<string, any>} */ (obj);
    if (typeof reportId !== 'string' || !RE_REPORT_ID.test(reportId)) {
      return { ok: false, grund: 'report_id' };
    }

    // 4. Zeitfenster: windowStart und windowEnd müssen gültige, kanonische 24h-UTC-Tage ab 00:00:00.000Z sein
    if (
      typeof windowStart !== 'string' || !RE_UTC_DAY.test(windowStart) ||
      typeof windowEnd !== 'string' || !RE_UTC_DAY.test(windowEnd)
    ) {
      return { ok: false, grund: 'fenster' };
    }

    const startMs = Date.parse(windowStart);
    const endMs = Date.parse(windowEnd);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return { ok: false, grund: 'fenster' };
    }

    const dStart = new Date(startMs);
    const dEnd = new Date(endMs);

    // Kanonische ISO-Repräsentation erzwingen (keine alternativen Offsets oder unvollständige Formate)
    if (dStart.toISOString() !== windowStart || dEnd.toISOString() !== windowEnd) {
      return { ok: false, grund: 'fenster' };
    }

    // Zeitfenster muss zwingend exakt um Mitternacht UTC beginnen
    if (
      dStart.getUTCHours() !== 0 ||
      dStart.getUTCMinutes() !== 0 ||
      dStart.getUTCSeconds() !== 0 ||
      dStart.getUTCMilliseconds() !== 0
    ) {
      return { ok: false, grund: 'fenster' };
    }

    // Exakt 24 Stunden = 86.400.000 Millisekunden
    if (endMs !== startMs + 86_400_000) {
      return { ok: false, grund: 'fenster' };
    }

    // 5. taskTotals prüfen
    if (!taskTotals || typeof taskTotals !== 'object' || Array.isArray(taskTotals)) {
      return { ok: false, grund: 'tasks' };
    }

    const totalsProto = Object.getPrototypeOf(taskTotals);
    if (totalsProto !== Object.prototype && totalsProto !== null) {
      return { ok: false, grund: 'tasks' };
    }

    if (Object.getOwnPropertySymbols(taskTotals).length > 0) {
      return { ok: false, grund: 'tasks' };
    }

    const taskKeys = Object.getOwnPropertyNames(taskTotals);
    // Höchstgrenze 20 Tasks (Schutz vor DoS durch übergroße Payloads)
    if (taskKeys.length > 20) {
      return { ok: false, grund: 'tasks' };
    }

    // Prototype-Schutz und Prüfung bekannter Tasks
    for (const task of taskKeys) {
      if (!ERLAUBTE_TASKS_SET.has(task)) {
        return { ok: false, grund: 'tasks' };
      }
    }

    // 6. Metriken je Task prüfen und Kopie aufbauen
    const sortedTaskKeys = [...taskKeys].sort();
    /** @type {Record<string, KiTaskMetrik>} */
    const sanitizedTotals = {};

    for (const task of sortedTaskKeys) {
      const m = /** @type {Record<string, any>} */ (taskTotals)[task];
      if (!m || typeof m !== 'object' || Array.isArray(m)) {
        return { ok: false, grund: 'metrik' };
      }

      const mProto = Object.getPrototypeOf(m);
      if (mProto !== Object.prototype && mProto !== null) {
        return { ok: false, grund: 'metrik' };
      }

      // Keine Zusatzfelder im Task erlaubt
      const mKeys = Object.getOwnPropertyNames(m);
      for (const mk of mKeys) {
        if (!ERLAUBTE_METRIK_FELDER.has(mk)) {
          return { ok: false, grund: 'zusatzfeld' };
        }
      }
      if (Object.getOwnPropertySymbols(m).length > 0) {
        return { ok: false, grund: 'zusatzfeld' };
      }

      const { calls, prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, audio_seconds } = m;
      if (
        !Number.isSafeInteger(calls) || calls < 0 ||
        !Number.isSafeInteger(prompt_tokens) || prompt_tokens < 0 ||
        !Number.isSafeInteger(completion_tokens) || completion_tokens < 0 ||
        !Number.isSafeInteger(total_tokens) || total_tokens < 0
      ) {
        return { ok: false, grund: 'metrik' };
      }
      if (reasoning_tokens !== undefined && (!Number.isSafeInteger(reasoning_tokens) || reasoning_tokens < 0)) {
        return { ok: false, grund: 'metrik' };
      }
      if (audio_seconds !== undefined && (!Number.isSafeInteger(audio_seconds) || audio_seconds < 0)) {
        return { ok: false, grund: 'metrik' };
      }

      // Feste Reihenfolge der Metrikfelder für Kanonisierung
      /** @type {KiTaskMetrik} */
      const sanitizedMetric = {
        calls,
        prompt_tokens,
        completion_tokens,
        total_tokens
      };
      if (reasoning_tokens !== undefined) sanitizedMetric.reasoning_tokens = reasoning_tokens;
      if (audio_seconds !== undefined) sanitizedMetric.audio_seconds = audio_seconds;
      sanitizedTotals[task] = sanitizedMetric;
    }

    // Frisches normalisiertes Objekt ohne Referenzen auf das Eingabeobjekt
    const bericht = {
      reportId,
      windowStart,
      windowEnd,
      taskTotals: sanitizedTotals
    };

    return { ok: true, bericht };
  } catch (_err) {
    // Defensive Fehlerbehandlung: Nie werfen, immer konstanten Grund liefern
    return { ok: false, grund: 'form' };
  }
}

/**
 * Erzeugt einen reproduzierbaren SHA-256-Hex-Hash eines Berichts.
 * Sortiert Schlüssel kanonisch, sodass die Eingabereihenfolge keine Rolle spielt.
 *
 * @param {Record<string, any>} bericht - Zu hashender Bericht (oder Rohobjekt).
 * @returns {string} SHA-256 Hex-Digest.
 */
export function kiBerichtHash(bericht) {
  if (!bericht || typeof bericht !== 'object' || Array.isArray(bericht)) {
    throw new TypeError('Ungültiges Berichtsobjekt für Hash-Berechnung');
  }

  // Falls das Objekt validierbar ist, nutzen wir die bereits bereinigte Fassung
  const geprueft = pruefeKiBericht(bericht);
  const quelle = /** @type {Record<string, any>} */ (geprueft.ok ? geprueft.bericht : bericht);

  const rawTotals = quelle.taskTotals && typeof quelle.taskTotals === 'object' && !Array.isArray(quelle.taskTotals)
    ? /** @type {Record<string, any>} */ (quelle.taskTotals)
    : {};
  const sortedTaskKeys = Object.keys(rawTotals).sort();
  /** @type {Record<string, any>} */
  const canonicalTotals = {};

  for (const t of sortedTaskKeys) {
    const m = rawTotals[t];
    if (m && typeof m === 'object' && !Array.isArray(m)) {
      /** @type {Record<string, any>} */
      const canon = {
        calls: m.calls,
        prompt_tokens: m.prompt_tokens,
        completion_tokens: m.completion_tokens,
        total_tokens: m.total_tokens
      };
      if (m.reasoning_tokens !== undefined) canon.reasoning_tokens = m.reasoning_tokens;
      if (m.audio_seconds !== undefined) canon.audio_seconds = m.audio_seconds;
      canonicalTotals[t] = canon;
    } else {
      canonicalTotals[t] = m;
    }
  }

  // Feste Reihenfolge der Top-Ebene
  const canonical = {
    reportId: quelle.reportId,
    windowStart: quelle.windowStart,
    windowEnd: quelle.windowEnd,
    taskTotals: canonicalTotals
  };

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
