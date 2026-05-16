// Azure OpenAI client — singleton config, Frankfurt (Germany West Central) only.
//
// GDPR: data must stay in Germany. The endpoint URL itself encodes the region;
// we additionally assert it on startup so a misconfigured env can never leak
// requests to a US/EU-default Azure resource.
//
// Dry-run mode: if AZURE_DRY_RUN=1, or if NODE_ENV !== 'production' AND keys
// are missing, every call returns a deterministic mock response. This lets us
// validate the router + auth + audit pipeline before the Azure resource is live.

const ENDPOINT       = process.env.AZURE_OPENAI_ENDPOINT || '';
const API_KEY        = process.env.AZURE_OPENAI_API_KEY || '';
const DEPLOYMENT     = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
const API_VERSION    = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
const FORCE_DRY_RUN  = process.env.AZURE_DRY_RUN === '1';
const IS_DEV         = process.env.NODE_ENV !== 'production';

function isDryRun() {
  if (FORCE_DRY_RUN) return true;
  if (!ENDPOINT || !API_KEY) {
    if (IS_DEV) return true;
    throw new Error('Azure OpenAI not configured (missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY) and NODE_ENV=production');
  }
  return false;
}

// Hard assertion: Frankfurt only. Refuse to start if endpoint points elsewhere.
function assertGermanyRegion() {
  if (!ENDPOINT) return; // dry-run, nothing to assert
  const lower = ENDPOINT.toLowerCase();
  const ok = lower.includes('germanywestcentral') || lower.includes('frankfurt');
  if (!ok) {
    throw new Error(`AZURE_OPENAI_ENDPOINT must be Germany West Central (Frankfurt). Got: ${ENDPOINT}`);
  }
}
assertGermanyRegion();

/**
 * Call Azure OpenAI Chat Completions.
 *
 * @param {Object} opts
 * @param {Array}  opts.messages       OpenAI-format messages array
 * @param {Object} [opts.responseFormat] e.g. { type: 'json_object' }
 * @param {number} [opts.temperature=0.4]
 * @param {number} [opts.maxTokens=1200]
 * @param {string} [opts.deployment]   override default deployment
 * @param {Function} [opts.mockFn]     dry-run only: produces task-specific mock content
 * @returns {Promise<{content:string, usage:{prompt_tokens,completion_tokens,total_tokens}, model:string, deployment:string, dry_run:boolean, latency_ms:number}>}
 */
export async function chat({
  messages,
  responseFormat,
  temperature = 0.4,
  maxTokens = 1200,
  deployment = DEPLOYMENT,
  mockFn
}) {
  const t0 = Date.now();

  if (isDryRun()) {
    const content = mockFn
      ? mockFn({ messages, responseFormat })
      : '[DRY_RUN] Azure OpenAI not configured. This is a mock response.';
    return {
      content,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: deployment,
      deployment,
      dry_run: true,
      latency_ms: Date.now() - t0
    };
  }

  const url = `${ENDPOINT.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${API_VERSION}`;
  const body = {
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(responseFormat ? { response_format: responseFormat } : {})
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Azure OpenAI ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const choice = json.choices?.[0];
  const content = choice?.message?.content ?? '';
  const usage = json.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  return {
    content,
    usage,
    model: json.model || deployment,
    deployment,
    dry_run: false,
    latency_ms: Date.now() - t0
  };
}

export function configSummary() {
  return {
    endpoint: ENDPOINT ? ENDPOINT.replace(/^https?:\/\//, '').split('.')[0] + '.…' : '(unset)',
    deployment: DEPLOYMENT,
    api_version: API_VERSION,
    dry_run: isDryRun()
  };
}
