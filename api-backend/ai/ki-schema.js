// Fieldmatrix & Schema validation for AI tasks (M4.1 / M4.3 / K4 safety).
//
// Rejects unknown properties with 400 KI_SCHEMA.
// Enforces depth, bounds, strict types, and mode-dependent B-freetext gating.

import { FREQUENZ_OPTIONEN, DIAGNOSEGRUPPEN } from './catalogs/rezept-optionen.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let cachedKnownLabels = null;

function getKnownCatalogLabels() {
  if (cachedKnownLabels) return cachedKnownLabels;
  try {
    const catalog = require('./validators/heilmittel-catalog.json');
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
function validDate(value) { return typeof value === 'string' && RE_ISO_DATE.test(value) && new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) === value; }
function boundedString(value, max = 5000) { return typeof value === 'string' && value.length <= max; }
function integer(value, min, max) { return Number.isSafeInteger(value) && value >= min && value <= max; }

function createSchemaError(message, code = 'KI_SCHEMA', status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

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
 */
function validateDraftPayload(payload, { mode, allowFreeText }) {
  checkUnknownKeys(payload, ['intent', 'contacts', 'owner_info', 'ki_confirmation']);

  if (!payload.intent || typeof payload.intent !== 'string' || !payload.intent.trim()) {
    throw createSchemaError('intent ist erforderlich und muss ein nicht-leerer String sein');
  }
  if (payload.intent.length > 5000) {
    throw createSchemaError('intent überschreitet Maximallänge von 5000 Zeichen');
  }

  // Gating for B-Freetext
  if (mode === 'jeton') {
    throw createSchemaError('Freitext (intent) ist im Jeton-Modus gesperrt', 'KI_FREITEXT_GESPERRT', 403);
  }
  if (mode === 'direkt' && !allowFreeText) {
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
      const c = payload.contacts[i];
      if (!c || typeof c !== 'object' || Array.isArray(c)) {
        throw createSchemaError(`contacts[${i}] muss ein Objekt sein`);
      }
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
        if (mode === 'jeton') {
          throw createSchemaError('Freitext in Kontakten (notes) ist im Jeton-Modus gesperrt', 'KI_FREITEXT_GESPERRT', 403);
        }
        if (mode === 'direkt' && !allowFreeText) {
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
    checkUnknownKeys(payload.owner_info, [
      'business_name', 'sender_name', 'city', 'sector', 'phone', 'extra_context'
    ], 'owner_info')
    for (const k of ['business_name', 'sender_name', 'city', 'phone', 'extra_context', 'sector']) {
      if (payload.owner_info[k] !== undefined && typeof payload.owner_info[k] !== 'string') {
        throw createSchemaError(`owner_info.${k} muss ein String sein`);
      }
    };

    if (payload.owner_info.sector) {
      const sec = String(payload.owner_info.sector).toLowerCase();
      if (!ALLOWED_SECTORS.has(sec)) {
        throw createSchemaError(`Ungültige Branche`);
      }
    }

    if (payload.owner_info.extra_context && typeof payload.owner_info.extra_context === 'string' && payload.owner_info.extra_context.trim()) {
      if (mode === 'jeton') {
        throw createSchemaError('Freitext in owner_info (extra_context) ist im Jeton-Modus gesperrt', 'KI_FREITEXT_GESPERRT', 403);
      }
      if (mode === 'direkt' && !allowFreeText) {
        throw createSchemaError('Freitext in owner_info ist ohne Betreiber-Freigabe gesperrt', 'KI_FREITEXT_GESPERRT', 403);
      }
      if (payload.owner_info.extra_context.length > 500) {
        throw createSchemaError('owner_info.extra_context überschreitet Maximallänge von 500 Zeichen');
      }
    }
  }
}

/**
 * Validates payload for appointment-confirm-draft.
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
    const s = payload.slots[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      throw createSchemaError(`slots[${i}] muss ein Objekt sein`);
    }

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
    checkUnknownKeys(payload.patient, ['name', 'email', 'phone'], 'patient');

    for (const k of ['name', 'email', 'phone']) {
      if (payload.patient[k] !== undefined && typeof payload.patient[k] !== 'string') {
        throw createSchemaError(`patient.${k} muss ein String sein`);
      }
    }

  }

  if (payload.service) {
    if (typeof payload.service !== 'object' || Array.isArray(payload.service)) {
      throw createSchemaError('service muss ein Objekt sein');
    }
    checkUnknownKeys(payload.service, ['title', 'duration'], 'service');

    if (payload.service.title !== undefined && !boundedString(payload.service.title, 500)) {
      throw createSchemaError('service.title muss ein String sein');
    }

    if (payload.service.duration !== undefined) {
      const dur = payload.service.duration;
      if (!Number.isInteger(dur) || dur < 1 || dur > 480) {
        throw createSchemaError('service.duration muss eine positive Ganzzahl zwischen 1 und 480 sein');
      }
    }
  }

  if (payload.owner_info) {
    if (typeof payload.owner_info !== 'object' || Array.isArray(payload.owner_info)) {
      throw createSchemaError('owner_info muss ein Objekt sein');
    }
    checkUnknownKeys(payload.owner_info, ['business_name', 'sender_name', 'city', 'phone', 'sector'], 'owner_info')
    for (const k of ['business_name', 'sender_name', 'city', 'phone', 'extra_context', 'sector']) {
      if (payload.owner_info[k] !== undefined && typeof payload.owner_info[k] !== 'string') {
        throw createSchemaError(`owner_info.${k} muss ein String sein`);
      }
    };
    if (payload.owner_info.sector) {
      const sec = String(payload.owner_info.sector).toLowerCase();
      if (!ALLOWED_SECTORS.has(sec)) {
        throw createSchemaError(`Ungültige Branche`);
      }
    }
  }
}

/**
 * Validates payload for series-scheduler.
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
    if (!Number.isInteger(c) || c < 1 || c > 60) {
      throw createSchemaError('count muss eine Ganzzahl zwischen 1 und 50 sein');
    }
  }

  if (payload.recurrence !== undefined) {
    if (!['weekly', 'biweekly', 'daily'].includes(payload.recurrence)) {
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
    checkUnknownKeys(payload.service, ['title', 'duration'], 'service');
    if (payload.service.title !== undefined && !boundedString(payload.service.title, 500)) throw createSchemaError('service.title muss ein String sein');
    if (payload.service.duration !== undefined) {
      const dur = payload.service.duration;
      if (!Number.isSafeInteger(dur) || dur < 1 || dur > 480) throw createSchemaError('service.duration ungültig');
    }
  }

  if (payload.customer) {
    if (typeof payload.customer !== 'object' || Array.isArray(payload.customer)) throw createSchemaError('customer muss ein Objekt sein');
    checkUnknownKeys(payload.customer, ['id', 'name', 'email', 'phone'], 'customer');
    if (payload.customer.id !== undefined && payload.customer.id !== null && !boundedString(payload.customer.id, 200)) throw createSchemaError('customer.id ungültig');
    for (const k of ['name', 'email', 'phone']) {
      if (payload.customer[k] !== undefined && typeof payload.customer[k] !== 'string') throw createSchemaError(`customer.${k} muss ein String sein`);
    }
  }

  if (payload.employees) {
    if (!Array.isArray(payload.employees) || payload.employees.length > 50) throw createSchemaError('employees muss ein Array sein');
    for (let i = 0; i < payload.employees.length; i++) {
      const e = payload.employees[i];
      if (!e || typeof e !== 'object' || Array.isArray(e)) throw createSchemaError('employees Eintrag muss ein Objekt sein');
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

  function validateSlot(cand, candidate) {
    if (!cand || typeof cand !== 'object' || Array.isArray(cand)) throw createSchemaError('Termin muss ein Objekt sein');
    checkUnknownKeys(cand, ['date', 'time', 'employeeId', 'employeeName', 'bucket', 'shiftedFromDate', 'dateShiftDays']);
    if (!validDate(cand.date) || !RE_TIME_HHMM.test(cand.time)) throw createSchemaError('Termin Datum oder Uhrzeit ungültig');
    if (typeof cand.time !== 'string') throw createSchemaError('Uhrzeit muss String sein');
    for (const key of ['employeeId', 'employeeName']) if (cand[key] !== undefined && !boundedString(cand[key], 200)) throw createSchemaError('Mitarbeiter ungültig');
    if (cand.bucket !== undefined && !integer(cand.bucket, 0, 59)) throw createSchemaError('bucket ungültig');
    if (cand.shiftedFromDate !== undefined && !validDate(cand.shiftedFromDate)) throw createSchemaError('Verschobenes Datum ungültig');
    if (cand.dateShiftDays !== undefined && !integer(cand.dateShiftDays, -3, 3)) throw createSchemaError('Verschiebung ungültig');
  }
  for (const [key, max] of [['previousSelected', 60], ['candidates', 1024]]) {
    if (payload[key] !== undefined) {
      if (!Array.isArray(payload[key]) || payload[key].length > max) throw createSchemaError('Terminliste ungültig');
      for (const slot of payload[key]) validateSlot(slot, key === 'candidates');
    }
  }
  if (!integer(payload.count, 1, 60)) throw createSchemaError('count ungültig');

  if (payload.userFeedback !== undefined && payload.userFeedback !== null && !boundedString(payload.userFeedback, 500)) throw createSchemaError('userFeedback ungültig');
  // Freetext checks for series-scheduler
  if (payload.userFeedback && typeof payload.userFeedback === 'string' && payload.userFeedback.trim()) {
    if (mode === 'jeton') {
      throw createSchemaError('userFeedback ist im Jeton-Modus gesperrt', 'KI_FREITEXT_GESPERRT', 403);
    }
    if (mode === 'direkt' && !allowFreeText) {
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
    checkUnknownKeys(payload.preferences, ['sameEmployee', 'preferredEmployee', 'timeOfDay', 'notes'], 'preferences');

    if (payload.preferences.sameEmployee !== undefined) {
      if (payload.preferences.sameEmployee !== 'always' && payload.preferences.sameEmployee !== 'preferred' && payload.preferences.sameEmployee !== 'any' && typeof payload.preferences.sameEmployee !== 'boolean') {
        throw createSchemaError('preferences.sameEmployee ungültig');
      }
    }

    if (payload.preferences.preferredEmployee !== undefined && payload.preferences.preferredEmployee !== null && typeof payload.preferences.preferredEmployee !== 'string') {
      throw createSchemaError('preferences.preferredEmployee muss ein String sein');
    }

    if (payload.preferences.timeOfDay !== undefined) {
      if (payload.preferences.timeOfDay !== 'morning' && payload.preferences.timeOfDay !== 'afternoon' && payload.preferences.timeOfDay !== 'any') {
        throw createSchemaError('preferences.timeOfDay ungültig');
      }
    }

    if (payload.preferences.notes !== undefined && payload.preferences.notes !== null && !boundedString(payload.preferences.notes, 500)) throw createSchemaError('preferences.notes ungültig');
    if (payload.preferences.notes && typeof payload.preferences.notes === 'string' && payload.preferences.notes.trim()) {
      if (mode === 'jeton') {
        throw createSchemaError('preferences.notes ist im Jeton-Modus gesperrt', 'KI_FREITEXT_GESPERRT', 403);
      }
      if (mode === 'direkt' && !allowFreeText) {
        throw createSchemaError('preferences.notes ist ohne Betreiber-Freigabe gesperrt', 'KI_FREITEXT_GESPERRT', 403);
      }
      if (payload.preferences.notes.length > 500) {
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
 */
function validateRezeptNormalizePayload(payload, { mode, allowFreeText }) {
  checkUnknownKeys(payload, ['rezept', 'heilmittel_positionen', 'ki_confirmation']);

  if (!payload.rezept || typeof payload.rezept !== 'object' || Array.isArray(payload.rezept)) {
    throw createSchemaError('rezept muss ein Objekt sein');
  }

  // Allowed rezept keys (local-only patient/arzt are stripped during transform)
  checkUnknownKeys(payload.rezept, [
    'frequenz', 'diagnosegruppe', 'heilmittel', 'ergaenzendes_heilmittel',
    'heilmittel_feld_text', 'therapiebereich', 'patient', 'arzt'
  ], 'rezept');

  for (const key of ['frequenz', 'diagnosegruppe', 'heilmittel', 'ergaenzendes_heilmittel', 'heilmittel_feld_text', 'therapiebereich']) {
    if (payload.rezept[key] !== undefined && payload.rezept[key] !== null && !boundedString(payload.rezept[key], 500)) throw createSchemaError('Rezeptfeld ungültig');
  }
  if (payload.rezept.frequenz && !FREQUENZ_OPTIONEN.includes(payload.rezept.frequenz)) throw createSchemaError('Frequenz nicht im Katalog');
  if (payload.rezept.diagnosegruppe && !DIAGNOSEGRUPPEN.includes(payload.rezept.diagnosegruppe)) throw createSchemaError('Diagnosegruppe nicht im Katalog');
  for (const key of ['heilmittel', 'ergaenzendes_heilmittel']) if (payload.rezept[key] && !/^X[0-9]{4}$/.test(payload.rezept[key])) throw createSchemaError('Heilmittelcode ungültig');
  if (payload.rezept.therapiebereich && !ALLOWED_SECTORS.has(payload.rezept.therapiebereich.toLowerCase())) throw createSchemaError('Therapiebereich ungültig');
  for (const key of ['patient', 'arzt']) if (payload.rezept[key] !== undefined) {
    const obj = payload.rezept[key];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw createSchemaError('Lokaler Kopf ungültig');
    checkUnknownKeys(obj, ['name', 'first_name', 'last_name', 'email', 'phone', 'geburtsdatum', 'kvnr', 'arzt_name', 'praxis_name']);
    for (const value of Object.values(obj)) if (!boundedString(value, 500)) throw createSchemaError('Lokaler Kopfwert ungültig');
  }
  // In Jeton mode: heilmittel_feld_text is B freetext and forbidden!
  if ((mode === 'jeton' || !allowFreeText) && payload.rezept.heilmittel_feld_text && String(payload.rezept.heilmittel_feld_text).trim()) {
    throw createSchemaError('heilmittel_feld_text ist im Jeton-Modus gesperrt', 'KI_FREITEXT_GESPERRT', 403);
  }

  if (payload.heilmittel_positionen !== undefined) {
    if (!Array.isArray(payload.heilmittel_positionen) || payload.heilmittel_positionen.length > 100) {
      throw createSchemaError('heilmittel_positionen muss ein Array mit höchstens 100 Einträgen sein');
    }
    const knownLabels = getKnownCatalogLabels();

    for (let i = 0; i < payload.heilmittel_positionen.length; i++) {
      const p = payload.heilmittel_positionen[i];
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        throw createSchemaError(`heilmittel_positionen[${i}] muss ein Objekt sein`);
      }
      checkUnknownKeys(p, ['x', 'label', 'kat'], `heilmittel_positionen[${i}]`);

      if (!p.x || typeof p.x !== 'string' || !/^(?:X[0-9]{4}|[0-9]{5})$/.test(p.x)) {
        throw createSchemaError(`heilmittel_positionen[${i}].x muss ein gültiger Code sein`);
      }
      if (!p.label || typeof p.label !== 'string') {
        throw createSchemaError(`heilmittel_positionen[${i}].label muss ein String sein`);
      }

      if (p.kat !== undefined && p.kat !== null && !['', 'vorrangig', 'ergänzend'].includes(p.kat)) throw createSchemaError('Unbekannte Katalogkategorie');

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
 * @param {Object} payload
 * @param {Object} [options]
 * @param {'aus'|'direkt'|'jeton'} [options.mode='aus']
 * @param {boolean} [options.allowFreeText=false]
 */
export function validateTaskPayload(task, payload, options = {}) {
  const { mode = 'aus', allowFreeText = false } = options;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createSchemaError('Payload muss ein Objekt sein');
  }

  checkDepth(payload);
  function checkBounds(obj) { for (const value of Object.values(obj)) { if (typeof value === 'string' && value.length > 5000) throw createSchemaError('String zu lang'); if (value && typeof value === 'object') checkBounds(value); } }
  checkBounds(payload);

  // Validate reserved ki_confirmation if present
  if (payload.ki_confirmation !== undefined) {
    if (!payload.ki_confirmation || typeof payload.ki_confirmation !== 'object' || Array.isArray(payload.ki_confirmation)) {
      throw createSchemaError('ki_confirmation muss ein Objekt sein');
    }
    checkUnknownKeys(payload.ki_confirmation, ['challengeId', 'choices'], 'ki_confirmation');
    if (typeof payload.ki_confirmation.challengeId !== 'string') {
      throw createSchemaError('ki_confirmation.challengeId muss ein String sein');
    }
    if (!Array.isArray(payload.ki_confirmation.choices) || payload.ki_confirmation.choices.length > 5) {
      throw createSchemaError('ki_confirmation.choices muss ein Array sein');
    }
    for (let i = 0; i < payload.ki_confirmation.choices.length; i++) {
      const ch = payload.ki_confirmation.choices[i];
      if (!ch || typeof ch !== 'object' || Array.isArray(ch)) {
        throw createSchemaError(`ki_confirmation.choices[${i}] muss ein Objekt sein`);
      }
      checkUnknownKeys(ch, ['id', 'action'], `ki_confirmation.choices[${i}]`);
      if (!boundedString(ch.id, 100)) throw createSchemaError('Kandidaten-ID ungültig');
      if (!['maskieren', 'kein_name'].includes(ch.action)) {
        throw createSchemaError(`Ungültige Aktion in ki_confirmation.choices[${i}]: ${ch.action}`);
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

    default:
      throw createSchemaError(`Unbekannter Task für Schemaprüfung: ${task}`);
  }

  return true;
}
