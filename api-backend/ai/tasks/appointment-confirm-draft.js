// Task: appointment-confirm-draft — German email confirming a series of
// physiotherapy appointments to a patient.
//
// Input:  { patient: {name, email}, slots: [{date, time, employeeName}], service: {title}, owner_info }
// Output: { draft: { to_name, to_email, subject, body } }

import { chat } from '../azureClient.js';

const SYSTEM = `Du bist Assistent einer deutschen Physiotherapie-Praxis.
Du verfasst eine kurze, freundliche Terminbestätigungs-E-Mail an einen Patienten (Sie-Form).
Liste die Termine klar und übersichtlich (Wochentag, Datum, Uhrzeit, ggf. Therapeut).
Schließe mit einer Bitte um kurze Rückmeldung bei Verhinderung.
Antworte AUSSCHLIESSLICH als JSON:
{
  "to_name": string|null,
  "to_email": string|null,
  "subject": string,
  "body": string
}
Keine Erklärungen, keine Code-Fences, nur das JSON-Objekt.`;

function formatSlot(s) {
  const dt = new Date(s.date + 'T' + (s.time || '09:00') + ':00');
  const wd = dt.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const parts = [`${wd} um ${s.time} Uhr`];
  if (s.employeeName) parts.push(`(${s.employeeName})`);
  return '- ' + parts.join(' ');
}

function buildUserMessage({ patient = {}, slots = [], service = {}, owner_info = {} }) {
  const slotsBlock = slots.length
    ? slots.map(formatSlot).join('\n')
    : '(keine Termine)';
  const ownerBlock = [
    owner_info.business_name && `Praxis: ${owner_info.business_name}`,
    owner_info.sender_name   && `Absender: ${owner_info.sender_name}`,
    owner_info.city          && `Stadt: ${owner_info.city}`,
    owner_info.phone         && `Praxis-Telefon: ${owner_info.phone}`
  ].filter(Boolean).join('\n');

  return `Patient:
- Name: ${patient.name || '(unbekannt)'}
- E-Mail: ${patient.email || '(fehlt)'}

Behandlung: ${service.title || 'Physiotherapie'}

Terminliste:
${slotsBlock}

${ownerBlock}

Verfasse die Bestätigungs-E-Mail. Verwende den Patientennamen als to_name, die E-Mail als to_email. Betreff kurz und konkret. Im Body: Begrüßung, Bestätigungssatz, Terminliste, Hinweis auf Pünktlichkeit/Absage 24h vorher, Grußformel mit Absendername.`;
}

function mockResponse({ messages }) {
  const userMsg = messages.find(m => m.role === 'user')?.content || '';
  const nameMatch = userMsg.match(/Name:\s*([^\n]+)/);
  const emailMatch = userMsg.match(/E-Mail:\s*([^\n]+)/);
  const name = nameMatch ? nameMatch[1].trim() : null;
  const email = emailMatch ? emailMatch[1].trim() : null;
  return JSON.stringify({
    to_name: name && name !== '(unbekannt)' ? name : null,
    to_email: email && email !== '(fehlt)' ? email : null,
    subject: '[DRY-RUN] Terminbestätigung Ihrer Physiotherapie',
    body: `Sehr geehrte/r ${name || 'Patient/in'},\n\nhiermit bestätigen wir Ihre Termine (Dry-Run).\n\nMit freundlichen Grüßen`
  });
}

export async function run(payload) {
  if (!payload?.slots?.length) {
    const err = new Error('slots is required');
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
    temperature: 0.4,
    maxTokens: 900,
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
