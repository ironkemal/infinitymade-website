// Unified AI Gateway Executor (M4.1 / M4.3 / K4 safety).
//
// Pipeline:
// 1. Auth context verification (mandatory tenant & user; client-tenant rejected)
// 2. Outmode / gate checks before dictionary / model / token:
//    - AI_MODE === 'aus' => 503 AI_MODE_AUS
//    - task === 'ocr' / 'rezept-ocr' => 503 AI_OCR_DISABLED
//    - ownerDecision.enabled && cfg.activationReady => 503 if not active
//    - mailReady for mail draft tasks => 503 if not ready
// 3. Schema validation (reject unknown properties with 400 KI_SCHEMA; reject bad types, huge array, deep nesting)
// 4. Tenant dictionary loading (exact minimal columns; RAM context only; fail closed)
// 5. Pseudonymization & B-freetext residual scanning:
//    - Random per-call nonce
//    - Opaque candidate employee tokens
//    - B-freetext gating: Jeton forbids B freetext with KI_FREITEXT_GESPERRT
//    - Direct B residual scan triggers 409 KI_RUECKFRAGE challenge unless valid ki_confirmation provided
// 6. Build prompt & mask messages
// 7. Transport execution (calls chat from azureClient)
// 8. Output processing:
//    - JSON parse
//    - validateOutput callback executed on parsed pseudonymized object
//    - Output scan for PII leaks & unknown placeholders => 502 KI_ANTWORT_UNGUELTIG
//    - Unmask values only (never object keys)
//    - Map opaque structural tokens back to known original IDs
// 9. Returns { output, meta }

import crypto from 'node:crypto';
import { chat } from './azureClient.js';
import { createAiConfig } from './ki-config.js';
import { validateTaskPayload } from './ki-schema.js';
import { createOwnerDecisionStore } from './ki-einwilligung.js';
import { loadTenantDictionary } from './ki-woerterbuch.js';
import { createConfirmationService } from './ki-rueckfrage.js';
import { createJetonClient } from './ki-jeton.js';
import { makeUsageAggregateSupplier, makeDefaultUsageAggregateSupplier, getAiSupabaseClient } from './audit.js';

const tenantJetonClients = new Map();

export function getTenantJetonClient(tenantId, supabase, configProvider) {
  if (!tenantJetonClients.has(tenantId)) {
    const aggregateSupplier = supabase ? makeUsageAggregateSupplier(supabase, tenantId) : makeDefaultUsageAggregateSupplier(tenantId);
    if (tenantJetonClients.size >= 1000) { const first = tenantJetonClients.keys().next().value; tenantJetonClients.get(first)?.invalidate?.(); tenantJetonClients.delete(first); }
    const client = createJetonClient({
      aggregateSupplier,
      configProvider
    });
    tenantJetonClients.set(tenantId, client);
  }
  return tenantJetonClients.get(tenantId);
}

export function invalidateTenantJeton(tenantId) {
  const client = tenantJetonClients.get(tenantId);
  if (client && typeof client.invalidate === 'function') {
    client.invalidate();
  }
  tenantJetonClients.delete(tenantId);
}

import {
  createMaskingContext,
  maskPII,
  maskMessages,
  entitiesFromContacts,
  scanneReste,
  unmaskValues,
  scanOutputPII
} from './pii-mask.js';

const MAIL_TASKS = new Set([
  'b2c-draft',
  'b2b-draft',
  'appointment-confirm-draft'
]);

let _defaultConfirmationService = null;
let _defaultOwnerDecisionStore = null;

async function getConfirmationService() {
  if (_defaultConfirmationService) return _defaultConfirmationService;

  let secret;
  try {
    const { ladeKimlik } = await import('../merkez-istemci/kimlik.js');
    const kimlik = ladeKimlik();
    if (!kimlik || !kimlik.privateKey) {
      throw new Error('Missing kimlik identity');
    }
    const pkcs8 = kimlik.privateKey.export({ type: 'pkcs8', format: 'der' });
    secret = crypto.createHmac('sha256', pkcs8).update('ki-rueckfrage-secret-domain-separation').digest();
  } catch (e) {
    // Missing identity -> safe unavailable. No random fallback!
    throw createGatewayError('Box-Identität fehlt, Rückfrage nicht möglich', 503, 'KI_RUECKFRAGE_UNAVAILABLE');
  }

  const replayDir = process.env.KI_EINWILLIGUNG_DIR || '/var/lib/praxura/ki-freigaben';
  _defaultConfirmationService = createConfirmationService({ secret, directory: replayDir });
  return _defaultConfirmationService;
}

export function getOwnerDecisionStore() {
  if (!_defaultOwnerDecisionStore) {
    _defaultOwnerDecisionStore = createOwnerDecisionStore();
  }
  return _defaultOwnerDecisionStore;
}

function createGatewayError(message, status = 500, code = 'KI_GATEWAY_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Executes an AI task through the hardened M4 gateway.
 *
 * @param {Object} params
 * @param {string} params.task task identifier (e.g. 'b2c-draft', 'series-scheduler')
 * @param {Object} params.payload client task payload
 * @param {Object} params.context request context ({ req: { auth: { userId, tenantId, role } } } or direct auth)
 * @param {Function} params.buildMessages function(sanitizedPayload, meta) => Array<{role: string, content: string}>
 * @param {Function} [params.validateOutput] function(parsedOutput, meta) => boolean
 * @param {Object} [params.chatOptions] additional chat options
 * @param {Object} [params.dependencies] test injection seams
 * @returns {Promise<{output: any, meta: {model: string, deployment: string, usage: Object, dry_run: boolean, latency_ms: number}}>}
 */
export async function executeKiTask({
  task,
  payload,
  context,
  buildMessages,
  validateOutput,
  chatOptions = {},
  dependencies = {}
}) {
  // 1. Auth context verification: require authenticated tenant & user
  const auth = context?.req?.auth || context?.auth || (
    context?.userId && context?.tenantId && context?.role
      ? { userId: context.userId, tenantId: context.tenantId, role: context.role }
      : null
  );

  if (!auth || !auth.userId || !auth.tenantId || !['owner', 'employee'].includes(auth.role)) {
    throw createGatewayError('Authentifizierter Benutzer und Mandant erforderlich', 401, 'KI_AUTH_REQUIRED');
  }

  // Reject untrusted clienttenant from payload
  if (payload && (payload.tenantId || payload.tenant_id)) {
    throw createGatewayError('Mandant darf nicht im Payload übergeben werden', 400, 'KI_SCHEMA');
  }

  // 2. Gating checks BEFORE dictionary / model / token
  // Context.config is NOT client approved: ignore any context.config
  const cfg = await (dependencies.configProvider?.() || dependencies.config || createAiConfig());

  if (cfg.mode === 'aus' || cfg.valid !== true || !['direkt', 'jeton'].includes(cfg.mode)) {
    throw createGatewayError('KI-Dienst ist deaktiviert', 503, 'AI_MODE_AUS');
  }

  if (task === 'rezept-ocr' || task === 'ocr') {
    throw createGatewayError('OCR über diesen Dienst ist deaktiviert', 503, 'AI_OCR_DISABLED');
  }

  // Owner Opt-in check
  let ownerDecision = dependencies.ownerDecision;
  if (!ownerDecision) {
    const store = dependencies.ownerDecisionStore || getOwnerDecisionStore();
    ownerDecision = await store.read(auth.tenantId);
  }

  if (!ownerDecision || ownerDecision.enabled !== true) {
    throw createGatewayError('Einwilligung des Praxisinhabers erforderlich', 503, 'AI_OWNER_OPTIN_REQUIRED');
  }

  // Operator readiness check
  if (cfg.activationReady !== true) {
    throw createGatewayError('KI-Dienst ist nicht betriebsbereit geschaltet', 503, 'AI_NOT_ACTIVATED');
  }

  // Mail feature readiness check
  if (MAIL_TASKS.has(task) && cfg.mailReady !== true) {
    throw createGatewayError('E-Mail-Assistent ist deaktiviert', 503, 'AI_MAIL_DISABLED');
  }

  // 3. Schema validation
  const allowFreeText = cfg.allowFreeText === true;
  validateTaskPayload(task, payload, { mode: cfg.mode, allowFreeText });

  // 4. Tenant dictionary loading (fail-closed)
  let dictionary = [];
  if (dependencies.dictionary) {
    dictionary = dependencies.dictionary;
  } else if (typeof dependencies.loadDictionary === 'function') {
    dictionary = await dependencies.loadDictionary(auth);
  } else {
    dictionary = await loadTenantDictionary(dependencies.supabase || getAiSupabaseClient(), auth);
  }
  if (!Array.isArray(dictionary) || dictionary.some(value => typeof value !== 'string')) throw createGatewayError('Wörterbuch ungültig', 503, 'KI_WOERTERBUCH_FEHLER');

  // 5. Structured entities extraction & local transforms
  const nonce = crypto.randomBytes(16).toString('hex');
  const explicitEntities = [];

  // Extract from contacts
  if (Array.isArray(payload.contacts)) {
    explicitEntities.push(...entitiesFromContacts(payload.contacts));
  }
  // Extract from patient
  if (payload.patient) {
    explicitEntities.push(...entitiesFromContacts([payload.patient]));
  }
  // Extract from customer
  if (payload.customer?.name) {
    explicitEntities.push({ value: payload.customer.name, type: 'NAME' });
  }
  // Extract from owner_info
  if (payload.owner_info) {
    if (payload.owner_info.business_name) {
      explicitEntities.push({ value: payload.owner_info.business_name, type: 'PRAXIS' });
    }
    if (payload.owner_info.sender_name) {
      explicitEntities.push({ value: payload.owner_info.sender_name, type: 'NAME' });
    }
    if (payload.owner_info.phone) {
      explicitEntities.push({ value: payload.owner_info.phone, type: 'PHONE' });
    }
  }

  const sanitizedPayload = { ...payload };

  if (task === 'series-scheduler') {
    if (Array.isArray(payload.employees)) {
      payload.employees.forEach((emp) => {
        if (emp.name) explicitEntities.push({ value: emp.name, type: 'NAME' });
        if (emp.id) {
          explicitEntities.push({ value: emp.id, type: 'EMP' });
        }
      });
    }

    // Safely omit arbitrary feedbackApplied from prompt
    if (sanitizedPayload.feedbackApplied) {
      delete sanitizedPayload.feedbackApplied;
    }
  }

  // Local-only drop of known PHI keys for rezept-normalize
  if (task === 'rezept-normalize' && sanitizedPayload.rezept) {
    sanitizedPayload.rezept = { ...sanitizedPayload.rezept };
    delete sanitizedPayload.rezept.patient;
    delete sanitizedPayload.rezept.arzt;
  }

  // 6. B-Freetext residual scanning & Rückfrage
  let confirmationService = dependencies.confirmationService;
  const rawCandidates = [];

  const maskingContext = createMaskingContext({
    entities: explicitEntities,
    mandantNamen: dictionary,
    nonce,
    preserveAppointments: true
  });

  try {
    // Scan freetext fields in direct mode with allowFreeText
    if (cfg.mode === 'direkt' && allowFreeText) {
      const textsToScan = [];
      if (payload.intent) textsToScan.push(payload.intent);
      if (payload.rezept?.heilmittel_feld_text) textsToScan.push(payload.rezept.heilmittel_feld_text);
      if (payload.preferences?.notes) textsToScan.push(payload.preferences.notes);
      if (payload.userFeedback) textsToScan.push(payload.userFeedback);
      if (payload.owner_info?.extra_context) textsToScan.push(payload.owner_info.extra_context);
      if (Array.isArray(payload.contacts)) {
        payload.contacts.forEach(c => { if (c.notes) textsToScan.push(c.notes); });
      }

      for (const txt of textsToScan) {
        const maskedProbe = maskPII(txt, { ctx: maskingContext });
        if (maskedProbe.befunde && maskedProbe.befunde.length > 0) {
          rawCandidates.push(...maskedProbe.befunde);
        }
      }
    }

    if (rawCandidates.some(candidate => candidate.art === 'QUASI_REIDENTIFIKATION')) throw createGatewayError('Reidentifizierbare Angaben sind gesperrt', 403, 'KI_REST_BLOCKIERT');
    const distinctCandidates = [...new Map(rawCandidates.map(c => [(c.text || c.ausschnitt) + ':' + (c.type || c.art), c])).values()];
    const acceptedNonNames = [];
    const freetextCandidates = distinctCandidates.map((c, i) => ({
      id: `c_${i + 1}`,
      text: c.text || c.ausschnitt || '',
      type: c.type || c.art || 'UNKNOWN'
    }));

    if (freetextCandidates.length > 0) {
      if (!confirmationService) confirmationService = await getConfirmationService();
      // If confirmation is missing, throw 409 KI_RUECKFRAGE challenge
      if (!payload.ki_confirmation) {
        const challenge = confirmationService.createChallenge({
          task,
          userId: auth.userId,
          tenantId: auth.tenantId,
          payload,
          candidates: freetextCandidates
        });

        const err = new Error('Rückfrage zu unmaskiertem Freitext erforderlich');
        err.code = 'KI_RUECKFRAGE';
        err.status = 409;
        err.challengeId = challenge.challengeId;
        err.expiresAt = challenge.expiresAt;
        err.candidates = challenge.candidates;
        throw err;
      }

      // Verify confirmation
      const verification = confirmationService.verifyConfirmation({
        task,
        userId: auth.userId,
        tenantId: auth.tenantId,
        payload,
        kiConfirmation: payload.ki_confirmation,
        currentCandidates: freetextCandidates
      });

      if (!verification.valid) {
        const err = new Error('Ungültige Rückfrage-Bestätigung');
        err.code = verification.code || 'KI_RUECKFRAGE_INVALID';
        err.status = 409;
        throw err;
      }

      // Apply choices: if 'maskieren', allocate explicit token
      for (const choice of verification.choices) {
        const candidate = freetextCandidates.find(c => c.id === choice.id);
        if (choice.action === 'kein_name') {
          if (candidate?.type !== 'FUZZY_NAME_REST') throw createGatewayError('Sensible Daten müssen maskiert werden', 409, 'KI_CHOICES_INVALID');
          acceptedNonNames.push(candidate.text);
        }
        if (choice.action === 'maskieren') {
          const matchingCand = freetextCandidates.find(c => c.id === choice.id || c.ausschnitt === choice.id);
          if (matchingCand && matchingCand.text) {
             maskingContext.entities.push({ value: matchingCand.text, type: 'NAME' });
          }
        }
      }
    }

    // Field-aware transform runs before task-specific prompt construction.
    function maskPayloadValues(obj, ctx, keyPath = '') {
      if (obj === null || typeof obj !== 'object') {
        if (typeof obj === 'string') {
          const currentKey = keyPath.split('.').pop();
          const typedKeys = ['recurrence', 'sameEmployee', 'timeOfDay', 'genderFilterApplied', 'sector', 'frequenz', 'diagnosegruppe', 'heilmittel', 'ergaenzendes_heilmittel', 'therapiebereich', 'x', 'label', 'anrede'];
          if (typedKeys.includes(currentKey)) return obj;
          if (task === 'series-scheduler' && (['date', 'time', 'shiftedFromDate'].includes(currentKey) || keyPath.startsWith('targetDates[') || keyPath.startsWith('emptyDates['))) return obj;
          if (currentKey === 'preferredEmployee' || currentKey === 'employeeId' || (currentKey === 'id' && keyPath.includes('employees'))) return ctx.allocate('EMP', obj);
          const freeTextKeys = ['intent', 'notes', 'extra_context', 'userFeedback', 'heilmittel_feld_text'];
          if (!freeTextKeys.includes(currentKey)) return ctx.allocate(currentKey === 'id' ? 'ID' : ['name', 'contact_name', 'first_name', 'last_name', 'employeeName', 'sender_name'].includes(currentKey) ? 'NAME' : 'VALUE', obj);

          // For remaining arbitrary text (like notes, feedback, extra_context, intent), use regular maskPII
          return maskPII(obj, { ctx, ignoreProtected: true }).masked;
        }
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map((v, i) => maskPayloadValues(v, ctx, `${keyPath}[${i}]`));
      }
      const result = {};
      for (const k of Object.keys(obj)) {
        if (k === 'ki_confirmation') continue;
        result[k] = maskPayloadValues(obj[k], ctx, keyPath ? `${keyPath}.${k}` : k);
      }
      return result;
    }

    const maskedPayload = maskPayloadValues(sanitizedPayload, maskingContext);

    // 7. Build prompt & mask messages
    if (typeof buildMessages !== 'function') {
      throw createGatewayError('buildMessages-Funktion erforderlich', 500);
    }

    // validateOutput callback output schema required for every task
    if (typeof validateOutput !== 'function') {
      throw createGatewayError('validateOutput-Funktion erforderlich für striktes Schema', 500);
    }

    // Note: realToOpaqueEmployeeMap is no longer needed since EMPs are masked directly via maskPayloadValues.
    const rawMessages = buildMessages(maskedPayload, { nonce });
    if (!Array.isArray(rawMessages) || rawMessages.length < 1 || rawMessages.length > 20 || rawMessages.some(message => !message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 100_000 || Object.keys(message).some(key => !['role', 'content'].includes(key)))) throw createGatewayError('Ungültiger oder nicht-textueller KI-Auftrag', 400, 'KI_SCHEMA');

    const { messages: maskedMessages } = maskMessages(rawMessages, { ctx: maskingContext });

    // 8. Transport execution
    // Rerun final output/rest scanner immediately before transport
    const combinedPromptText = maskedMessages.map(m => m.content).join('\n');
    let scanText = combinedPromptText;
    for (const benign of acceptedNonNames) scanText = scanText.split(benign).join(' ');
    const finalScan = scanneReste(scanText, dictionary);
    if (finalScan.length > 0) {
      throw createGatewayError('Interner Fehler: Unmaskierte sensible Daten vor Transport blockiert', 500, 'KI_REST_BLOCKIERT');
    }

    // Re-check owner opt-in and operator config immediately before external transport
    let freshDecision = dependencies.ownerDecision;
    if (!freshDecision) {
      const store = dependencies.ownerDecisionStore || getOwnerDecisionStore();
      freshDecision = await store.read(auth.tenantId);
    }
    if (!freshDecision || freshDecision.enabled !== true) {
      throw createGatewayError('Einwilligung widerrufen oder geändert während der Ausführung', 503, 'AI_OWNER_OPTIN_REQUIRED');
    }

    const freshCfg = await (dependencies.configProvider?.() || dependencies.config || createAiConfig());
    if (freshCfg.mode !== cfg.mode || freshCfg.valid !== true || !['direkt', 'jeton'].includes(freshCfg.mode) || freshCfg.activationReady !== true || (MAIL_TASKS.has(task) && freshCfg.mailReady !== true) || (allowFreeText && freshCfg.allowFreeText !== true)) {
      throw createGatewayError('KI-Dienst wurde während der Ausführung deaktiviert', 503, 'AI_MODE_AUS');
    }

    if (!dependencies.ownerDecision) { const lastOwner = await (dependencies.ownerDecisionStore || getOwnerDecisionStore()).read(auth.tenantId); if (lastOwner?.enabled !== true) throw createGatewayError('Einwilligung widerrufen', 503, 'AI_OWNER_OPTIN_REQUIRED'); }
    const transport = dependencies.transport || chat;
    const injectedJetonClient = freshCfg.mode === 'jeton' ? (dependencies.jetonClient || getTenantJetonClient(auth.tenantId, dependencies.supabase, dependencies.configProvider || (() => dependencies.config || createAiConfig()))) : undefined;
    const transportOptions = {
      ...chatOptions,
      messages: maskedMessages,
      config: freshCfg,
      jetonClient: injectedJetonClient,
      beforeSend: async () => {
        const currentConfig = await (dependencies.configProvider?.() || dependencies.config || createAiConfig());
        const currentOwner = dependencies.ownerDecision || await (dependencies.ownerDecisionStore || getOwnerDecisionStore()).read(auth.tenantId);
        if (currentOwner?.enabled !== true) throw createGatewayError('Einwilligung widerrufen', 503, 'AI_OWNER_OPTIN_REQUIRED');
        if (currentConfig?.valid !== true || currentConfig.mode !== cfg.mode || currentConfig.activationReady !== true || (MAIL_TASKS.has(task) && currentConfig.mailReady !== true) || (allowFreeText && currentConfig.allowFreeText !== true)) throw createGatewayError('KI-Dienst wurde deaktiviert', 503, 'AI_MODE_AUS');
        return true;
      }
    };

    const transportRes = await transport(transportOptions);

    // 9. Output processing & validation
    const rawContent = transportRes.content;
    let parsedOutput;
    try {
      parsedOutput = JSON.parse(rawContent);
    } catch {
      const err = new Error('KI-Antwort konnte nicht als JSON verarbeitet werden');
      err.code = 'KI_ANTWORT_UNGUELTIG';
      err.status = 502;
      throw err;
    }

    // validateOutput callback on parsed pseudonymized object
    const validationResult = await validateOutput(parsedOutput, {
      maskMap: Object.freeze(Object.assign(Object.create(null), maskingContext.map)),
      nonce
    });
    if (validationResult !== true) {
      const err = new Error('Validierung der Modellantwort fehlgeschlagen');
      err.code = 'KI_ANTWORT_UNGUELTIG';
      err.status = 502;
      throw err;
    }

    // Output PII scan before restore
    const outputScan = scanOutputPII(JSON.stringify(parsedOutput), maskingContext.map, { dictionary });
    if (!outputScan.safe) {
      const err = new Error('KI-Antwort enthält unzulässige Daten');
      err.code = 'KI_ANTWORT_UNGUELTIG';
      err.status = 502;
      throw err;
    }

    // Unmask parsed values only (never object keys)
    function rejectTokenKeys(value) { if (value && typeof value === 'object') for (const key of Object.keys(value)) { if (/[⟦⟧]|<<|>>/.test(key)) throw createGatewayError('Antwortschlüssel ungültig', 502, 'KI_ANTWORT_UNGUELTIG'); rejectTokenKeys(value[key]); } }
    rejectTokenKeys(parsedOutput);
    const restoredOutput = unmaskValues(parsedOutput, maskingContext.unmaskStreng);

    return {
      output: restoredOutput,
      meta: {
        model: transportRes.model,
        deployment: transportRes.deployment,
        usage: transportRes.usage,
        dry_run: transportRes.dry_run,
        latency_ms: transportRes.latency_ms
      }
    };
  } finally {
    // Map clear finally on success and errors
    maskingContext.clear();
  }
}
