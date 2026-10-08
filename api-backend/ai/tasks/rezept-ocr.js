// Task: rezept-ocr — disabled (C5 compliance gate).
//
// M4 Gateway Integration:
// - Server-auth context verified ({ tenantId, userId, role })
// - OCR is always disabled with fixed German error (C5 gate)
// - Multimodal / vision images must NEVER be sent to external models
// - Routes through executeKiTask which enforces gate before transport

import { executeKiTask } from '../ki-gateway.js';

/**
 * Executes rezept-ocr task.
 * Under M4 / C5 gate, OCR is strictly disabled and rejected without transmitting image data.
 *
 * @param {object} payload
 * @param {object} [context]
 * @throws {Error} always throws AI_OCR_DISABLED (status 503)
 */
export async function run(payload, context = {}) {
  // Pass to gateway to enforce auth verification and C5 OCR gate.
  // Never builds or transmits image payloads.
  await executeKiTask({
    task: 'rezept-ocr',
    payload: payload || {},
    context,
    buildMessages: () => [],
    dependencies: context?.dependencies || {}
  });

  // Fail-safe if gateway ever returned without error:
  const err = new Error('OCR über diesen Dienst ist deaktiviert');
  err.code = 'AI_OCR_DISABLED';
  err.status = 503;
  throw err;
}
