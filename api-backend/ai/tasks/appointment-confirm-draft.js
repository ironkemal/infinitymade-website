// Structured appointment drafts. All identifying leaves are allocated by the gateway.
import { executeKiTask } from '../ki-gateway.js';
const SYSTEM = `Verfasse eine kurze deutsche Terminbestätigung in Sie-Form. Übernimm die bereitgestellten Platzhalter unverändert. Antworte nur als JSON mit genau to_name, to_email (string|null), subject und body (string). Liste alle Termine und den Behandlungstitel. Versende keine Nachricht.`;
/** @param {unknown} parsed @returns {boolean} */
function validateDraft(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  if (Object.keys(parsed).sort().join(',') !== 'body,subject,to_email,to_name') return false;
  const rec = /** @type {Record<string, unknown>} */ (parsed);
  return (['to_name', 'to_email'].every(k => rec[k] === null || (typeof rec[k] === 'string' && /** @type {string} */ (rec[k]).length <= 200)))
    && typeof rec.subject === 'string' && rec.subject.trim().length > 0 && rec.subject.length <= 200
    && typeof rec.body === 'string' && rec.body.trim().length > 0 && rec.body.length <= 8000;
}
/**
 * @param {import('../ki-gateway.js').GatewayPayload} payload
 * @param {import('../ki-gateway.js').GatewayContext} [context={}]
 */
export async function run(payload, context = {}) {
  const { output, meta } = await executeKiTask({
    task: 'appointment-confirm-draft', payload, context,
    buildMessages: p => [{role:'system',content:SYSTEM}, {role:'user',content:JSON.stringify({patient:p.patient || {},service:p.service || {},slots:p.slots || [],owner_info:p.owner_info || {}})}],
    validateOutput: validateDraft,
    chatOptions:{responseFormat:{type:'json_object'},temperature:0.4,maxTokens:900},
    dependencies:context.dependencies || {}
  });
  return {draft:output,_meta:meta};
}
