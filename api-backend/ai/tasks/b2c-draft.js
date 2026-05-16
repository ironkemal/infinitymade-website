// Task: b2c-draft — draft a German B2C email from a free-text intent.
//
// Phase 0 proof: this is the first AI feature migrated through the unified
// Azure gateway. Future tasks (rezept-ocr, rezept-validate, schedule-series,
// b2b-draft, doctor-email) follow the same shape: validate input, build
// messages, call chat(), parse, return.

import { chat } from '../azureClient.js';

const SYSTEM = `Du bist ein hilfreicher Assistent für eine deutsche Praxis/Kleinunternehmen.
Du verfasst kurze, höfliche, professionelle E-Mail-Entwürfe auf Deutsch (Sie-Form).
Antworte AUSSCHLIESSLICH als JSON mit den Feldern:
{
  "to_name": string|null,
  "to_email": string|null,
  "subject": string,
  "body": string
}
Keine Erklärungen, keine Code-Fences, nur das JSON-Objekt.`;

function buildUserMessage({ intent, contacts = [], owner_info = {} }) {
  const contactsBlock = contacts.length
    ? `Verfügbare Kunden (max. 30):\n${contacts.map(c =>
        `- id=${c.id} name="${c.name || c.contact_name || ''}" email="${c.email || ''}" notizen="${(c.notes || '').slice(0, 120)}"`
      ).join('\n')}`
    : 'Keine Kundenliste mitgegeben.';

  const ownerBlock = [
    owner_info.business_name && `Praxis: ${owner_info.business_name}`,
    owner_info.sender_name   && `Absender: ${owner_info.sender_name}`,
    owner_info.city          && `Stadt: ${owner_info.city}`,
    owner_info.sector        && `Branche: ${owner_info.sector}`,
    owner_info.extra_context && `Kontext: ${owner_info.extra_context}`
  ].filter(Boolean).join('\n');

  return `Auftrag des Nutzers:
"""${intent}"""

${ownerBlock}

${contactsBlock}

Wähle ggf. den passenden Kunden aus der Liste (id, name, email). Falls die Anfrage einen einzelnen Empfänger meint, gib dessen Daten zurück; sonst lasse to_name/to_email leer und entwirf eine Vorlage.`;
}

function mockResponse({ messages }) {
  const userMsg = messages.find(m => m.role === 'user')?.content || '';
  const intentMatch = userMsg.match(/"""([\s\S]+?)"""/);
  const intent = intentMatch ? intentMatch[1].trim().slice(0, 80) : 'Allgemeine Nachricht';
  return JSON.stringify({
    to_name: null,
    to_email: null,
    subject: `[DRY-RUN] ${intent.slice(0, 60)}`,
    body: `Sehr geehrte Damen und Herren,\n\ndies ist ein Dry-Run-Entwurf (Azure OpenAI ist noch nicht konfiguriert).\n\nAuftrag: ${intent}\n\nMit freundlichen Grüßen`
  });
}

export async function run(payload) {
  const intent = (payload?.intent || '').toString().trim();
  if (!intent) {
    const err = new Error('intent is required');
    err.status = 400;
    throw err;
  }

  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: buildUserMessage(payload) }
  ];

  const result = await chat({
    messages,
    responseFormat: { type: 'json_object' },
    temperature: 0.5,
    maxTokens: 800,
    mockFn: mockResponse
  });

  let draft;
  try {
    draft = JSON.parse(result.content);
  } catch {
    throw new Error('AI returned non-JSON content');
  }

  return {
    draft,
    _meta: {
      model: result.model,
      deployment: result.deployment,
      usage: result.usage,
      dry_run: result.dry_run,
      latency_ms: result.latency_ms
    }
  };
}
