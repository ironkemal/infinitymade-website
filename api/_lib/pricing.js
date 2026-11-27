// Model + plan pricing. Used by admin endpoints to estimate AI cost and MRR.
// Must stay completely self-contained (zero imports outside api/_lib/, because
// .vercelignore excludes api-backend/ during Vercel builds).
// Azure Data Zone EUR rates are mirrored 1:1 from api-backend/ai/ki-preise.js
// and verified by the strict parity test in api-backend/ai/ki-preise.test.js.

const USD_TO_EUR = 0.92;

/**
 * Azure OpenAI Data Zone EUR rates (strictly cost calculation, never sales prices).
 * Reasoning tokens are already included in completionTokens and never billed twice.
 *
 * @type {Readonly<Record<string, Readonly<{ billingType: 'tokens', inputPerMtokEur: number, outputPerMtokEur: number } | { billingType: 'audio_minutes', audioPerMinuteEur: number }>>>}
 */
const AZURE_DATA_ZONE_EUR = Object.freeze({
  'gpt-5': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 1.265,
    outputPerMtokEur: 10.12,
  }),
  'gpt-5-mini': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 0.253,
    outputPerMtokEur: 2.024,
  }),
  'gpt-5-nano': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 0.0506,
    outputPerMtokEur: 0.4048,
  }),
  'gpt-4.1': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 2.024,
    outputPerMtokEur: 8.096,
  }),
  'gpt-4.1-mini': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 0.4048,
    outputPerMtokEur: 1.6192,
  }),
  'gpt-4o': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 2.53,
    outputPerMtokEur: 10.12,
  }),
  'gpt-4o-mini': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 0.1518,
    outputPerMtokEur: 0.6072,
  }),
  'gpt-4o-transcribe': Object.freeze({
    billingType: 'audio_minutes',
    audioPerMinuteEur: 0.006072,
  }),
  'gpt-4o-mini-transcribe': Object.freeze({
    billingType: 'audio_minutes',
    audioPerMinuteEur: 0.003036,
  }),
  'whisper': Object.freeze({
    billingType: 'audio_minutes',
    audioPerMinuteEur: 0.006072,
  }),
});

/** @type {Record<string, { input: number, output: number }>} */
const MODEL_PRICES_USD_PER_MTOK = {
  // OpenAI (kept in PRICING_META for admin db_health compatibility)
  'gpt-4o':            { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':       { input: 0.15,  output: 0.60  },
  'gpt-4.1':           { input: 2.00,  output: 8.00  },
  'gpt-4.1-mini':      { input: 0.40,  output: 1.60  },
  // Anthropic Claude (legacy fallback)
  'claude-haiku-4-5':  { input: 1.00,  output: 5.00  },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00 },
  // Google Gemini (legacy fallback)
  'gemini-2.0-flash':  { input: 0.075, output: 0.30  },
  'gemini-2.0-pro':    { input: 1.25,  output: 5.00  },
  'gemini-1.5-flash':  { input: 0.075, output: 0.30  },
  'gemini-1.5-pro':    { input: 1.25,  output: 5.00  },
};

/**
 * @param {unknown} value
 * @returns {number}
 */
function clampNonNegativeFinite(value) {
  if (typeof value === 'boolean' || value === null || value === undefined) return 0;
  if (typeof value === 'string' && value.trim() === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

// Strip the dated suffix some providers append, e.g.
// "gpt-4.1-mini-2025-04-14" -> "gpt-4.1-mini"
/**
 * @param {unknown} model
 * @returns {string | null}
 */
export function normalizeModel(model) {
  if (typeof model !== 'string') return null;
  const trimmed = model.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/, '');
  return normalized || null;
}

/**
 * @param {unknown} model
 * @param {number} [promptTokens]
 * @param {number} [completionTokens]
 * @param {number} [audioSeconds]
 * @returns {number}
 */
export function aiCallCostEUR(model, promptTokens, completionTokens, audioSeconds = 0) {
  const normalized = normalizeModel(model);
  if (!normalized) return 0;

  if (Object.hasOwn(AZURE_DATA_ZONE_EUR, normalized)) {
    const entry = AZURE_DATA_ZONE_EUR[normalized];
    if (entry.billingType === 'audio_minutes') {
      const sec = clampNonNegativeFinite(audioSeconds);
      return (sec / 60) * entry.audioPerMinuteEur;
    }
    const pt = clampNonNegativeFinite(promptTokens);
    const ct = clampNonNegativeFinite(completionTokens);
    return (pt / 1_000_000) * entry.inputPerMtokEur
      + (ct / 1_000_000) * entry.outputPerMtokEur;
  }

  const prices = Object.hasOwn(MODEL_PRICES_USD_PER_MTOK, normalized)
    ? MODEL_PRICES_USD_PER_MTOK[normalized]
    : undefined;
  if (!prices) return 0;
  const pt = clampNonNegativeFinite(promptTokens);
  const ct = clampNonNegativeFinite(completionTokens);
  const usd = (pt / 1_000_000) * prices.input
            + (ct / 1_000_000) * prices.output;
  return usd * USD_TO_EUR;
}

// Plan list price in EUR per month. Yearly subscriptions still report the
// monthly-equivalent here (close enough for an MRR estimate).
/** @type {Record<string, number>} */
const PLAN_PRICE_EUR = {
  starter:      29,
  professional: 49,
  klinik:       99,
};

/** @param {string} plan */
export function planMonthlyEUR(plan) {
  return PLAN_PRICE_EUR[plan] || 0;
}

export const PRICING_META = { USD_TO_EUR, MODEL_PRICES_USD_PER_MTOK, PLAN_PRICE_EUR };
