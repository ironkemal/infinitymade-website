// Task: transkribieren — transcribe audio into plain text via Azure audio/transcriptions.
//
// M4 Gateway Integration:
// - Server-auth context verified ({ tenantId, userId, role })
// - Routes exclusively via executeKiTask
// - Audio is never written to disk, never logged
// - Output is plain German text

import { executeKiTask } from '../ki-gateway.js';

export async function run(payload, context = {}) {
  const { output, meta } = await executeKiTask({
    task: 'transkribieren',
    payload,
    context,
    dependencies: context?.dependencies || {}
  });

  return {
    text: output.text,
    _meta: meta
  };
}
