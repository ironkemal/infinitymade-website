// Structured appointment drafts. All identifying leaves are allocated by the gateway.
import { executeKiTask } from '../ki-gateway.js';
const SYSTEM = `Verfasse eine kurze deutsche Terminbestätigung in Sie-Form. Übernimm die bereitgestellten Platzhalter unverändert. Antworte nur als JSON mit genau to_name, to_email (string|null), subject und body (string). Liste alle Termine und den Behandlungstitel. Versende keine Nachricht.`;
function validateDraft(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  if (Object.keys(parsed).sort().join(',') !== 'body,subject,to_email,to_name') return false;
  return ['to_name','to_email'].every(k => parsed[k] === null || typeof parsed[k] === 'string' && parsed[k].length <= 200)
    && typeof parsed.subject === 'string' && parsed.subject.trim().length > 0 && parsed.subject.length <= 200
    && typeof parsed.body === 'string' && parsed.body.trim().length > 0 && parsed.body.length <= 8000;
}
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
