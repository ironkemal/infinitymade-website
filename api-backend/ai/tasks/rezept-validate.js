// Task: rezept-validate — deterministic G-BA/KBV compliance check.
//
// NO Azure call. Pure-function rules engine. This is the "legal firewall":
// the AI parses Muster 13 (separate task rezept-ocr), then this validator
// runs the regulatory checks. The user confirms the parsed+validated result.

import { validateRezept } from '../validators/validate.js';

export async function run(payload) {
  const result = validateRezept(payload);
  return {
    ...result,
    _meta: {
      // No Azure usage — validate runs locally on the gateway server.
      model: null,
      deployment: null,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      dry_run: false,
      latency_ms: 0
    }
  };
}
