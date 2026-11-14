// Task: b2b-draft — draft a German B2B email from a free-text intent.
//
// M4 Gateway Integration:
// - Server-auth context verified ({ tenantId, userId, role })
// - Routes exclusively via executeKiTask (never directly calls Azure driver)
// - Strict closed output schema validation ({ to_name, to_email, subject, body })
// - Values unmasked strictly after parse/schema/scan
// - Mail assistant does NOT send email itself (draft generation only)

import { executeKiTask } from '../ki-gateway.js';

const SYSTEM = `Du bist ein professioneller Assistent für eine deutsche Praxis.
Du verfasst formelle, sachliche und präzise geschäftliche E-Mail-Entwürfe auf Deutsch (Sie-Form) für Ärzte, Partnerpraxen, Labore, Lieferanten oder Abrechnungsstellen.
Antworte AUSSCHLIESSLICH als JSON mit den Feldern:
{
  "to_name": string|null,
  "to_email": string|null,
  "subject": string,
  "body": string
}
Keine Erklärungen, keine Code-Fences, nur das JSON-Objekt.`;

/** @param {import('../ki-gateway.js').GatewayPayload} payload */
function buildUserMessage({ intent, contacts = [], owner_info = {} }) {
  const contactsBlock = Array.isArray(contacts) && contacts.length
    ? `Verfügbare Geschäftspartner/Kontakte (max. 30):\n${contacts.slice(0, 30).map(c =>
        `- id=${c.id} name="${c.name || c.contact_name || ''}" email="${c.email || ''}" firma="${c.company || ''}" notizen="${(c.notes || '').slice(0, 120)}"`
      ).join('\n')}`
    : 'Keine Kontaktliste mitgegeben.';

  const ownerBlock = [
    owner_info?.business_name && `Praxis: ${owner_info.business_name}`,
    owner_info?.sender_name   && `Absender: ${owner_info.sender_name}`,
    owner_info?.city          && `Stadt: ${owner_info.city}`,
    owner_info?.sector        && `Branche: ${owner_info.sector}`,
    owner_info?.extra_context && `Kontext: ${owner_info.extra_context}`
  ].filter(Boolean).join('\n');

  return `Auftrag des Nutzers:
"""${intent}"""

${ownerBlock}

${contactsBlock}

Wähle ggf. den passenden Geschäftspartner aus der Liste (id, name, email). Falls die Anfrage einen einzelnen Empfänger meint, gib dessen Daten zurück; sonst lasse to_name/to_email leer und entwirf eine geschäftliche Vorlage.`;
}

/** @param {unknown} parsed @returns {boolean} */
function validateDraftOutput(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const rec = /** @type {Record<string, unknown>} */ (parsed);
  const allowedKeys = new Set(['to_name', 'to_email', 'subject', 'body']);
  for (const k of Object.keys(rec)) {
    if (!allowedKeys.has(k)) return false;
  }
  if (!('to_name' in rec) || !('to_email' in rec) || !('subject' in rec) || !('body' in rec)) return false;
  if (rec.to_name !== null && (typeof rec.to_name !== 'string' || rec.to_name.length > 200)) return false;
  if (rec.to_email !== null && (typeof rec.to_email !== 'string' || rec.to_email.length > 200)) return false;
  if (typeof rec.subject !== 'string' || !rec.subject.trim() || rec.subject.length > 200) return false;
  if (typeof rec.body !== 'string' || !rec.body.trim() || rec.body.length > 8000) return false;
  return true;
}

/**
 * @param {import('../ki-gateway.js').GatewayPayload} payload
 * @param {import('../ki-gateway.js').GatewayContext} [context={}]
 */
export async function run(payload, context = {}) {
  const { output, meta } = await executeKiTask({
    task: 'b2b-draft',
    payload,
    context,
    buildMessages: (p) => [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildUserMessage(p) }
    ],
    validateOutput: validateDraftOutput,
    chatOptions: {
      responseFormat: { type: 'json_object' },
      temperature: 0.4,
      maxTokens: 800
    },
    dependencies: context?.dependencies || {}
  });

  return {
    draft: output,
    _meta: meta
  };
}
