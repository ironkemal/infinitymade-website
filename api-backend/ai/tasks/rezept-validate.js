// Task: rezept-validate — deterministic G-BA/KBV compliance check.
//
// Model-free. Pure-function rules engine. No Azure/LLM calls.
// Regulatory checks for Muster 13 and Blankoverordnung.

import { validateRezept } from '../validators/validate.js';

export async function run(payload, _context = {}) {
  const result = validateRezept(payload || {});
  return {
    ...result,
    _meta: {
      model: null,
      deployment: null,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      dry_run: false,
      latency_ms: 0
    }
  };
}
