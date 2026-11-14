// Fieldmatrix & Schema validation for AI tasks (M4.1 / M4.3 / K4 safety).
//
// Rejects unknown properties with 400 KI_SCHEMA.
// Enforces depth, bounds, strict types, and mode-dependent B-freetext gating.

import { FREQUENZ_OPTIONEN, DIAGNOSEGRUPPEN } from './catalogs/rezept-optionen.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/** @typedef {Error & { code?: string, status?: number }} SchemaError */

/** @type {Set<string> | null} */
let cachedKnownLabels = null;

/** @returns {Set<string>} */
function getKnownCatalogLabels() {
  if (cachedKnownLabels) return cachedKnownLabels;
  try {
    const catalog = /** @type {{ positions?: Record<string, { label?: string }> }} */ (require('./validators/heilmittel-catalog.json'));
    /** @type {Set<string>} */
    const set = new Set();
    if (catalog?.positions) {
      for (const p of Object.values(catalog.positions)) {
        if (p.label) set.add(p.label.trim().toLowerCase());
      }
    }
    // Also add common standard positions
    set.add('allgemeine krankengymnastik (kg) einzel');
    set.add('manuelle therapie');
    set.add('manuelle lymphdrainage 30 min');
    set.add('manuelle lymphdrainage 45 min');
    set.add('manuelle lymphdrainage 60 min');
    set.add('krankengymnastik am gerät (kgg)');
    set.add('podologische behandlung groß');
    set.add('podologische behandlung klein');
    cachedKnownLabels = set;
    return cachedKnownLabels;
  } catch {
    cachedKnownLabels = new Set([
      'allgemeine krankengymnastik (kg) einzel',
      'manuelle therapie',
      'manuelle lymphdrainage 30 min',
      'manuelle lymphdrainage 45 min',
      'manuelle lymphdrainage 60 min',
      'krankengymnastik am gerät (kgg)'
    ]);
    return cachedKnownLabels;
  }
}

export const ALLOWED_SECTORS = Object.freeze(new Set([
  'physiotherapy',
  'podologie',
  'podology',
  'ergotherapy',
  'logopaedie',
  'physiotherapie',
]));

const RE_ISO_DATE = /^20[2-9]\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const RE_TIME_HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_DEPTH = 5;
/** @param {unknown} value @returns {value is string} */
function validDate(value) { return typeof value === 'string' && RE_ISO_DATE.test(value) && new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) === value; }
/** @param {unknown} value @param {number} [max=5000] @returns {value is string} */
function boundedString(value, max = 5000) { return typeof value === 'string' && value.length <= max; }
/** @param {unknown} value @param {number} min @param {number} max @returns {value is number} */
function integer(value, min, max) { return Number.isSafeInteger(value) && /** @type {number} */ (value) >= min && /** @type {number} */ (value) <= max; }

/**
 * @param {string} message
 * @param {string} [code='KI_SCHEMA']
 * @param {number} [status=400]
 * @returns {SchemaError}
 */
function createSchemaError(message, code = 'KI_SCHEMA', status = 400) {
  /** @type {SchemaError} */
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * @param {unknown} obj
 * @param {number} [currentDepth=0]
 */
function checkDepth(obj, currentDepth = 0) {
  if (currentDepth >= MAX_DEPTH) {
    throw createSchemaError(`Verschachtelungstiefe überschreitet Maximum (${MAX_DEPTH})`);
  }
  if (obj && typeof obj === 'object') {
    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object') {
        checkDepth(val, currentDepth + 1);
      }
    }
  }
}

/**
 * @param {unknown} obj
 * @param {string[]} allowedKeys
 * @param {string} [path='']
 */
function checkUnknownKeys(obj, allowedKeys, path = '') {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      const fieldPath = path ? `${path}.${key}` : key;
      throw createSchemaError(`Unbekannte Eigenschaft im Payload: ${fieldPath}`);
    }
  }
}

/**
 * Validates payload for b2c-draft and b2b-draft.
 * @param {Record<string, unknown>} payload
 * @param {{ mode: string, allowFreeText: boolean }} ctx
 */
function validateDraftPayload(payload, { mode, allowFreeText }) {
  checkUnknownKeys(payload, ['intent', 'contacts', 'owner_info', 'ki_confirmation']);

  if (!payload.intent || typeof payload.intent !== 'string' || !payload.intent.trim()) {
    throw createSchemaError('intent ist erforderlich und muss ein nicht-leerer String sein');
  }
  if (payload.intent.length > 5000) {
    throw createSchemaError('intent überschreitet Maximallänge von 5000 Zeichen');
  }

  // Gating for B-Freetext: one operator gate for direkt and jeton (Inhaber-Entscheidung 30.10.2026)
  if (!allowFreeText) {
    throw createSchemaError('Freitext ist ohne Betreiber-Freigabe (AI_ALLOW_FREETEXT=1) gesperrt', 'KI_FREITEXT_GESPERRT', 403);
  }

  if (payload.contacts !== undefined) {
    if (!Array.isArray(payload.contacts)) {
      throw createSchemaError('contacts muss ein Array sein');
    }
    if (payload.contacts.length > 50) {
      throw createSchemaError('contacts Array überschreitet Maximalgröße von 50');
    }
    for (let i = 0; i < payload.contacts.length; i++) {
      const rawC = payload.contacts[i];
      if (!rawC || typeof rawC !== 'object' || Array.isArray(rawC)) {
        throw createSchemaError(`contacts[${i}] muss ein Objekt sein`);
      }
      const c = /** @type {Record<string, unknown>} */ (rawC);
      checkUnknownKeys(c, [
        'id', 'name', 'contact_name', 'first_name', 'last_name',
        'email', 'phone', 'company', 'notes', 'geburtsdatum', 'kvnr'
      ], `contacts[${i}]`);
      for (const k of ['id', 'name', 'contact_name', 'first_name', 'last_name', 'email', 'phone', 'company', 'notes', 'geburtsdatum', 'kvnr']) {
        if (c[k] !== undefined && typeof c[k] !== 'string') {
          throw createSchemaError(`contacts[${i}].${k} muss ein String sein`);
        }
      }

      if (c.notes && typeof c.notes === 'string' && c.notes.trim()) {
        if (!allowFreeText) {
          throw createSchemaError('Freitext in Kontakten ist ohne Betreiber-Freigabe gesperrt', 'KI_FREITEXT_GESPERRT', 403);
        }
        if (c.notes.length > 500) {
          throw createSchemaError(`contacts[${i}].notes überschreitet Maximallänge von 500 Zeichen`);
        }
      }
    }
  }

  if (payload.owner_info !== undefined) {
    if (!payload.owner_info || typeof payload.owner_info !== 'object' || Array.isArray(payload.owner_info)) {
      throw createSchemaError('owner_info muss ein Objekt sein');
    }
    const ownerInfo = /** @type {Record<string, unknown>} */ (payload.owner_info);
    checkUnknownKeys(ownerInfo, [
      'business_name', 'sender_name', 'city', 'sector', 'phone', 'extra_context'
    ], 'owner_info')
    for (const k of ['business_name', 'sender_name', 'city', 'phone', 'extra_context', 'sector']) {
      if (ownerInfo[k] !== undefined && typeof ownerInfo[k] !== 'string') {
        throw createSchemaError(`owner_info.${k} muss ein String sein`);
      }
    };

    if (ownerInfo.sector) {
      const sec = String(ownerInfo.sector).toLowerCase();
      if (!ALLOWED_SECTORS.has(sec)) {
        throw createSchemaError(`Ungültige Branche`);
      }
    }

    if (ownerInfo.extra_context && typeof ownerInfo.extra_context === 'string' && ownerInfo.extra_context.trim()) {
      if (!allowFreeText) {
        throw createSchemaError('Freitext in owner_info ist ohne Betreiber-Freigabe gesperrt', 'KI_FREITEXT_GESPERRT', 403);
      }
      if (ownerInfo.extra_context.length > 500) {
        throw createSchemaError('owner_info.extra_context überschreitet Maximallänge von 500 Zeichen');
      }
    }
  }
}

/**
 * Validates payload for appointment-confirm-draft.
 * @param {Record<string, unknown>} payload
 */
function validateAppointmentConfirmPayload(payload) {
  checkUnknownKeys(payload, ['patient', 'slots', 'service', 'owner_info', 'ki_confirmation']);

  if (!Array.isArray(payload.slots) || payload.slots.length === 0) {
    throw createSchemaError('slots muss ein nicht-leeres Array sein');
  }
  if (payload.slots.length > 50) {
    throw createSchemaError('slots Array überschreitet Maximalgröße von 50');
  }

  for (let i = 0; i < payload.slots.length; i++) {
    const rawS = payload.slots[i];
    if (!rawS || typeof rawS !== 'object' || Array.isArray(rawS)) {
      throw createSchemaError(`slots[${i}] muss ein Objekt sein`);
    }
    const s = /** @type {Record<string, unknown>} */ (rawS);

      checkUnknownKeys(s, ['date', 'time', 'employeeName', 'employeeId'], `slots[${i}]`);
      if (s.employeeName !== undefined && typeof s.employeeName !== 'string') throw createSchemaError('slot employeeName muss String sein');
      if (s.employeeId !== undefined && typeof s.employeeId !== 'string') throw createSchemaError('slot employeeId muss String sein');


    if (!s.date || typeof s.date !== 'string' || !validDate(s.date)) {
      throw createSchemaError(`slots[${i}].date muss im Format YYYY-MM-DD sein`);
    }
    if (!s.time || typeof s.time !== 'string' || !RE_TIME_HHMM.test(s.time)) {
      throw createSchemaError(`slots[${i}].time muss im Format HH:mm sein`);
    }
  }

  if (payload.patient) {
    if (typeof payload.patient !== 'object' || Array.isArray(payload.patient)) {
      throw createSchemaError('patient muss ein Objekt sein');
    }
    const patient = /** @type {Record<string, unknown>} */ (payload.patient);
    checkUnknownKeys(patient, ['name', 'email', 'phone'], 'patient');

    for (const k of ['name', 'email', 'phone']) {
      if (patient[k] !== undefined && typeof patient[k] !== 'string') {
        throw createSchemaError(`patient.${k} muss ein String sein`);
      }
    }

  }

  if (payload.service) {
    if (typeof payload.service !== 'object' || Array.isArray(payload.service)) {
      throw createSchemaError('service muss ein Objekt sein');
    }
    const service = /** @type {Record<string, unknown>} */ (payload.service);
    checkUnknownKeys(service, ['title', 'duration'], 'service');

    if (service.title !== undefined && !boundedString(service.title, 500)) {
      throw createSchemaError('service.title muss ein String sein');
    }

    if (service.duration !== undefined) {
      const dur = service.duration;
      if (!Number.isInteger(dur) || typeof dur !== 'number' || dur < 1 || dur > 480) {
        throw createSchemaError('service.duration muss eine positive Ganzzahl zwischen 1 und 480 sein');
      }
    }
  }

  if (payload.owner_info) {
    if (typeof payload.owner_info !== 'object' || Array.isArray(payload.owner_info)) {
      throw createSchemaError('owner_info muss ein Objekt sein');
    }
    const ownerInfo = /** @type {Record<string, unknown>} */ (payload.owner_info);
    checkUnknownKeys(ownerInfo, ['business_name', 'sender_name', 'city', 'phone', 'sector'], 'owner_info')
    for (const k of ['business_name', 'sender_name', 'city', 'phone', 'extra_context', 'sector']) {
      if (ownerInfo[k] !== undefined && typeof ownerInfo[k] !== 'string') {
        throw createSchemaError(`owner_info.${k} muss ein String sein`);
      }
    };
    if (ownerInfo.sector) {
      const sec = String(ownerInfo.sector).toLowerCase();
      if (!ALLOWED_SECTORS.has(sec)) {
        throw createSchemaError(`Ungültige Branche`);
      }
    }
  }
}

/**
 * Validates payload for series-scheduler.
 * @param {Record<string, unknown>} payload
 * @param {{ mode: string, allowFreeText: boolean }} ctx
 */
function validateSeriesSchedulerPayload(payload, { mode, allowFreeText }) {
  checkUnknownKeys(payload, [
    'count', 'recurrence', 'targetDates', 'emptyDates', 'candidates',
    'preferences', 'service', 'employees', 'customer', 'sector',
    'genderFilterApplied', 'userFeedback', 'feedbackApplied',
    'previousSelected', 'ki_confirmation'
  ]);

  if (payload.count !== undefined) {
    const c = payload.count;
    if (!Number.isInteger(c) || typeof c !== 'number' || c < 1 || c > 60) {
      throw createSchemaError('count muss eine Ganzzahl zwischen 1 und 50 sein');
    }
  }

  if (payload.recurrence !== undefined) {
    if (typeof payload.recurrence !== 'string' || !['weekly', 'biweekly', 'daily'].includes(payload.recurrence)) {
      throw createSchemaError('recurrence muss "weekly", "biweekly" oder "daily" sein');
    }
  }

  if (payload.targetDates !== undefined) {
    if (!Array.isArray(payload.targetDates) || payload.targetDates.length > 60) {
      throw createSchemaError('targetDates muss ein Array mit höchstens 50 Daten sein');
    }
    for (const d of payload.targetDates) {
      if (typeof d !== 'string' || !validDate(d)) {
        throw createSchemaError('targetDates Einträge müssen im Format YYYY-MM-DD sein');
      }
    }
  }

  if (payload.emptyDates !== undefined) {
    if (!Array.isArray(payload.emptyDates) || payload.emptyDates.length > 60) {
      throw createSchemaError('emptyDates muss ein Array mit höchstens 50 Daten sein');
    }
    for (const d of payload.emptyDates) {
      if (typeof d !== 'string' || !validDate(d)) throw createSchemaError('emptyDates Einträge müssen im Format YYYY-MM-DD sein');
    }
  }

  if (payload.service) {
    if (typeof payload.service !== 'object' || Array.isArray(payload.service)) throw createSchemaError('service muss ein Objekt sein');
    const service = /** @type {Record<string, unknown>} */ (payload.service);
    checkUnknownKeys(service, ['title', 'duration'], 'service');
    if (service.title !== undefined && !boundedString(service.title, 500)) throw createSchemaError('service.title muss ein String sein');
    if (service.duration !== undefined) {
      const dur = service.duration;
      if (!Number.isSafeInteger(dur) || typeof dur !== 'number' || dur < 1 || dur > 480) throw createSchemaError('service.duration ungültig');
    }
  }

  if (payload.customer) {
    if (typeof payload.customer !== 'object' || Array.isArray(payload.customer)) throw createSchemaError('customer muss ein Objekt sein');
    const customer = /** @type {Record<string, unknown>} */ (payload.customer);
    checkUnknownKeys(customer, ['id', 'name', 'email', 'phone'], 'customer');
    if (customer.id !== undefined && customer.id !== null && !boundedString(customer.id, 200)) throw createSchemaError('customer.id ungültig');
    for (const k of ['name', 'email', 'phone']) {
      if (customer[k] !== undefined && typeof customer[k] !== 'string') throw createSchemaError(`customer.${k} muss ein String sein`);
    }
  }

  if (payload.employees) {
    if (!Array.isArray(payload.employees) || payload.employees.length > 50) throw createSchemaError('employees muss ein Array sein');
    for (let i = 0; i < payload.employees.length; i++) {
      const rawE = payload.employees[i];
      if (!rawE || typeof rawE !== 'object' || Array.isArray(rawE)) throw createSchemaError('employees Eintrag muss ein Objekt sein');
      const e = /** @type {Record<string, unknown>} */ (rawE);
      checkUnknownKeys(e, ['id', 'name', 'anrede'], `employees[${i}]`);
      if (e.id !== undefined && typeof e.id !== 'string') throw createSchemaError('employees id muss ein String sein');
      if (e.name !== undefined && typeof e.name !== 'string') throw createSchemaError('employees name muss ein String sein');
      if (e.anrede !== undefined && e.anrede !== null && e.anrede !== 'Herr' && e.anrede !== 'Frau') throw createSchemaError('employees anrede ungültig');
    }
  }

  if (payload.genderFilterApplied !== undefined) {
    if (payload.genderFilterApplied !== null && payload.genderFilterApplied !== 'female' && payload.genderFilterApplied !== 'male' && typeof payload.genderFilterApplied !== 'boolean') {
      throw createSchemaError('genderFilterApplied ungültig');
    }
  }

  if (payload.feedbackApplied !== undefined) {
    if (payload.feedbackApplied !== null && typeof payload.feedbackApplied !== 'boolean' && typeof payload.feedbackApplied !== 'string') {
      throw createSchemaError('feedbackApplied ungültig');
    }
  }

  /**
   * @param {unknown} rawCand
   * @param {boolean} [candidate]
   */
  function validateSlot(rawCand, candidate) {
    if (!rawCand || typeof rawCand !== 'object' || Array.isArray(rawCand)) throw createSchemaError('Termin muss ein Objekt sein');
    const cand = /** @type {Record<string, unknown>} */ (rawCand);
    checkUnknownKeys(cand, ['date', 'time', 'employeeId', 'employeeName', 'bucket', 'shiftedFromDate', 'dateShiftDays']);
    if (!validDate(cand.date) || typeof cand.time !== 'string' || !RE_TIME_HHMM.test(cand.time)) throw createSchemaError('Termin Datum oder Uhrzeit ungültig');
    for (const key of ['employeeId', 'employeeName']) if (cand[key] !== undefined && !boundedString(cand[key], 200)) throw createSchemaError('Mitarbeiter ungültig');
    if (cand.bucket !== undefined && !integer(cand.bucket, 0, 59)) throw createSchemaError('bucket ungültig');
    if (cand.shiftedFromDate !== undefined && !validDate(cand.shiftedFromDate)) throw createSchemaError('Verschobenes Datum ungültig');
    if (cand.dateShiftDays !== undefined && !integer(cand.dateShiftDays, -3, 3)) throw createSchemaError('Verschiebung ungültig');
  }
  for (const [key, max] of /** @type {const} */ ([['previousSelected', 60], ['candidates', 1024]])) {
    const list = payload[key];
    if (list !== undefined) {
      if (!Array.isArray(list) || list.length > max) throw createSchemaError('Terminliste ungültig');
      for (const slot of list) validateSlot(slot, key === 'candidates');
    }
  }
  if (!integer(payload.count, 1, 60)) throw createSchemaError('count ungültig');

  if (payload.userFeedback !== undefined && payload.userFeedback !== null && !boundedString(payload.userFeedback, 500)) throw createSchemaError('userFeedback ungültig');
  // Freetext checks for series-scheduler
  if (payload.userFeedback && typeof payload.userFeedback === 'string' && payload.userFeedback.trim()) {
    if (!allowFreeText) {
      throw createSchemaError('userFeedback ist ohne Betreiber-Freigabe gesperrt', 'KI_FREITEXT_GESPERRT', 403);
    }
    if (payload.userFeedback.length > 500) {
      throw createSchemaError('userFeedback überschreitet Maximallänge von 500 Zeichen');
    }
  }

  if (payload.preferences) {
    if (typeof payload.preferences !== 'object' || Array.isArray(payload.preferences)) {
      throw createSchemaError('preferences muss ein Objekt sein');
    }
    const prefs = /** @type {Record<string, unknown>} */ (payload.preferences);
    checkUnknownKeys(prefs, ['sameEmployee', 'preferredEmployee', 'timeOfDay', 'notes'], 'preferences');

    if (prefs.sameEmployee !== undefined) {
      if (prefs.sameEmployee !== 'always' && prefs.sameEmployee !== 'preferred' && prefs.sameEmployee !== 'any' && typeof prefs.sameEmployee !== 'boolean') {
        throw createSchemaError('preferences.sameEmployee ungültig');
      }
    }

    if (prefs.preferredEmployee !== undefined && prefs.preferredEmployee !== null && typeof prefs.preferredEmployee !== 'string') {
      throw createSchemaError('preferences.preferredEmployee muss ein String sein');
    }

    if (prefs.timeOfDay !== undefined) {
      if (prefs.timeOfDay !== 'morning' && prefs.timeOfDay !== 'afternoon' && prefs.timeOfDay !== 'any') {
        throw createSchemaError('preferences.timeOfDay ungültig');
      }
    }

    if (prefs.notes !== undefined && prefs.notes !== null && !boundedString(prefs.notes, 500)) throw createSchemaError('preferences.notes ungültig');
    if (prefs.notes && typeof prefs.notes === 'string' && prefs.notes.trim()) {
      if (!allowFreeText) {
        throw createSchemaError('preferences.notes ist ohne Betreiber-Freigabe gesperrt', 'KI_FREITEXT_GESPERRT', 403);
      }
      if (prefs.notes.length > 500) {
        throw createSchemaError('preferences.notes überschreitet Maximallänge von 500 Zeichen');
      }
    }
  }

  if (payload.sector) {
    const sec = String(payload.sector).toLowerCase();
    if (!ALLOWED_SECTORS.has(sec)) {
      throw createSchemaError(`Ungültige Branche`);
    }
  }
}

/**
 * Validates payload for rezept-normalize.
 * @param {Record<string, unknown>} payload
 * @param {{ mode: string, allowFreeText: boolean }} ctx
 */
function validateRezeptNormalizePayload(payload, { mode, allowFreeText }) {
  checkUnknownKeys(payload, ['rezept', 'heilmittel_positionen', 'ki_confirmation']);

  if (!payload.rezept || typeof payload.rezept !== 'object' || Array.isArray(payload.rezept)) {
    throw createSchemaError('rezept muss ein Objekt sein');
  }
  const rezept = /** @type {Record<string, unknown>} */ (payload.rezept);

  // Allowed rezept keys (local-only patient/arzt are stripped during transform)
  checkUnknownKeys(rezept, [
    'frequenz', 'diagnosegruppe', 'heilmittel', 'ergaenzendes_heilmittel',
    'heilmittel_feld_text', 'therapiebereich', 'patient', 'arzt'
  ], 'rezept');

  for (const key of ['frequenz', 'diagnosegruppe', 'heilmittel', 'ergaenzendes_heilmittel', 'heilmittel_feld_text', 'therapiebereich']) {
    if (rezept[key] !== undefined && rezept[key] !== null && !boundedString(rezept[key], 500)) throw createSchemaError('Rezeptfeld ungültig');
  }
  if (typeof rezept.frequenz === 'string' && rezept.frequenz && !FREQUENZ_OPTIONEN.includes(rezept.frequenz)) throw createSchemaError('Frequenz nicht im Katalog');
  if (typeof rezept.diagnosegruppe === 'string' && rezept.diagnosegruppe && !DIAGNOSEGRUPPEN.includes(rezept.diagnosegruppe)) throw createSchemaError('Diagnosegruppe nicht im Katalog');
  for (const key of ['heilmittel', 'ergaenzendes_heilmittel']) {
    const val = rezept[key];
    if (typeof val === 'string' && val && !/^X[0-9]{4}$/.test(val)) throw createSchemaError('Heilmittelcode ungültig');
  }
  if (typeof rezept.therapiebereich === 'string' && rezept.therapiebereich && !ALLOWED_SECTORS.has(rezept.therapiebereich.toLowerCase())) throw createSchemaError('Therapiebereich ungültig');
  for (const key of ['patient', 'arzt']) if (rezept[key] !== undefined) {
    const obj = rezept[key];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw createSchemaError('Lokaler Kopf ungültig');
    checkUnknownKeys(obj, ['name', 'first_name', 'last_name', 'email', 'phone', 'geburtsdatum', 'kvnr', 'arzt_name', 'praxis_name']);
    for (const value of Object.values(obj)) if (!boundedString(value, 500)) throw createSchemaError('Lokaler Kopfwert ungültig');
  }
  // In Jeton mode: heilmittel_feld_text is B freetext and forbidden!
  if ((mode === 'jeton' || !allowFreeText) && rezept.heilmittel_feld_text && String(rezept.heilmittel_feld_text).trim()) {
    throw createSchemaError('heilmittel_feld_text ist im Jeton-Modus gesperrt', 'KI_FREITEXT_GESPERRT', 403);
  }

  if (payload.heilmittel_positionen !== undefined) {
    if (!Array.isArray(payload.heilmittel_positionen) || payload.heilmittel_positionen.length > 100) {
      throw createSchemaError('heilmittel_positionen muss ein Array mit höchstens 100 Einträgen sein');
    }
    const knownLabels = getKnownCatalogLabels();

    for (let i = 0; i < payload.heilmittel_positionen.length; i++) {
      const rawP = payload.heilmittel_positionen[i];
      if (!rawP || typeof rawP !== 'object' || Array.isArray(rawP)) {
        throw createSchemaError(`heilmittel_positionen[${i}] muss ein Objekt sein`);
      }
      const p = /** @type {Record<string, unknown>} */ (rawP);
      checkUnknownKeys(p, ['x', 'label', 'kat'], `heilmittel_positionen[${i}]`);

      if (!p.x || typeof p.x !== 'string' || !/^(?:X[0-9]{4}|[0-9]{5})$/.test(p.x)) {
        throw createSchemaError(`heilmittel_positionen[${i}].x muss ein gültiger Code sein`);
      }
      if (!p.label || typeof p.label !== 'string') {
        throw createSchemaError(`heilmittel_positionen[${i}].label muss ein String sein`);
      }

      if (p.kat !== undefined && p.kat !== null && (typeof p.kat !== 'string' || !['', 'vorrangig', 'ergänzend'].includes(p.kat))) throw createSchemaError('Unbekannte Katalogkategorie');

      // Check label against known catalog labels
      const cleanLabel = p.label.trim().toLowerCase();
      if (!knownLabels.has(cleanLabel)) {
        throw createSchemaError(`enthält unbekanntes Katalog-Label`);
      }
    }
  }
}

/**
 * Top-level payload validation.
 *
 * @param {string} task
 * @param {unknown} rawPayload
 * @param {{ mode?: 'aus'|'direkt'|'jeton', allowFreeText?: boolean }} [options={}]
 * @returns {true}
 */
export function validateTaskPayload(task, rawPayload, options = {}) {
  const { mode = 'aus', allowFreeText = false } = options;

  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw createSchemaError('Payload muss ein Objekt sein');
  }
  const payload = /** @type {Record<string, unknown>} */ (rawPayload);

  checkDepth(payload);
  /** @param {Record<string, unknown> | unknown[]} obj */
  function checkBounds(obj) {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && value.length > 5000) throw createSchemaError('String zu lang');
      if (value && typeof value === 'object') checkBounds(/** @type {Record<string, unknown> | unknown[]} */ (value));
    }
  }
  checkBounds(payload);

  // Validate reserved ki_confirmation if present
  if (payload.ki_confirmation !== undefined) {
    if (!payload.ki_confirmation || typeof payload.ki_confirmation !== 'object' || Array.isArray(payload.ki_confirmation)) {
      throw createSchemaError('ki_confirmation muss ein Objekt sein');
    }
    const conf = /** @type {Record<string, unknown>} */ (payload.ki_confirmation);
    checkUnknownKeys(conf, ['challengeId', 'choices'], 'ki_confirmation');
    if (typeof conf.challengeId !== 'string') {
      throw createSchemaError('ki_confirmation.challengeId muss ein String sein');
    }
    if (!Array.isArray(conf.choices) || conf.choices.length > 5) {
      throw createSchemaError('ki_confirmation.choices muss ein Array sein');
    }
    for (let i = 0; i < conf.choices.length; i++) {
      const rawCh = conf.choices[i];
      if (!rawCh || typeof rawCh !== 'object' || Array.isArray(rawCh)) {
        throw createSchemaError(`ki_confirmation.choices[${i}] muss ein Objekt sein`);
      }
      const ch = /** @type {Record<string, unknown>} */ (rawCh);
      checkUnknownKeys(ch, ['id', 'action'], `ki_confirmation.choices[${i}]`);
      if (!boundedString(ch.id, 100)) throw createSchemaError('Kandidaten-ID ungültig');
      if (typeof ch.action !== 'string' || !['maskieren', 'kein_name'].includes(ch.action)) {
        throw createSchemaError(`Ungültige Aktion in ki_confirmation.choices[${i}]: ${String(ch.action)}`);
      }
    }
  }

  switch (task) {
    case 'b2c-draft':
    case 'b2b-draft':
      validateDraftPayload(payload, { mode, allowFreeText });
      break;

    case 'appointment-confirm-draft':
      validateAppointmentConfirmPayload(payload);
      break;

    case 'series-scheduler':
      validateSeriesSchedulerPayload(payload, { mode, allowFreeText });
      break;

    case 'rezept-normalize':
      validateRezeptNormalizePayload(payload, { mode, allowFreeText });
      break;

    case 'rezept-ocr':
    case 'ocr':
      // OCR is always disabled at gateway, but validate shape if invoked
      checkUnknownKeys(payload, ['image_base64', 'image_url', 'ki_confirmation']);
      break;

    case 'rezept-validate':
      throw createSchemaError('Lokale Regeln benötigen keinen KI-Transport');

    case 'transkribieren':
      checkUnknownKeys(payload, ['audioBuffer', 'mimeType', 'duration', 'ki_confirmation']);
      if (!payload.audioBuffer) {
        throw createSchemaError('audioBuffer ist erforderlich');
      }
      break;

    default:
      throw createSchemaError(`Unbekannter Task für Schemaprüfung: ${task}`);
  }

  return true;
}
