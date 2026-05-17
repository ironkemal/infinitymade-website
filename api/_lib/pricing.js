// Model + plan pricing. Used by admin endpoints to estimate AI cost and MRR.
// Token prices are USD per 1M tokens; converted to EUR with a fixed rate.
// Update USD_TO_EUR when the spread moves enough to matter — admin numbers
// are estimates anyway, not invoiced amounts.

const USD_TO_EUR = 0.92;

const MODEL_PRICES_USD_PER_MTOK = {
  // OpenAI
  'gpt-4o':            { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':       { input: 0.15,  output: 0.60  },
  'gpt-4.1':           { input: 2.00,  output: 8.00  },
  'gpt-4.1-mini':      { input: 0.40,  output: 1.60  },
  // Anthropic Claude
  'claude-haiku-4-5':  { input: 1.00,  output: 5.00  },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00 },
  // Google Gemini
  'gemini-2.0-flash':  { input: 0.075, output: 0.30  },
  'gemini-2.0-pro':    { input: 1.25,  output: 5.00  },
  'gemini-1.5-flash':  { input: 0.075, output: 0.30  },
  'gemini-1.5-pro':    { input: 1.25,  output: 5.00  },
};

// Strip the dated suffix some providers append, e.g.
// "gpt-4.1-mini-2025-04-14" -> "gpt-4.1-mini"
function normalizeModel(model) {
  if (!model) return null;
  return String(model).toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

export function aiCallCostEUR(model, promptTokens, completionTokens) {
  const prices = MODEL_PRICES_USD_PER_MTOK[normalizeModel(model)];
  if (!prices) return 0;
  const usd = ((promptTokens || 0) / 1_000_000) * prices.input
            + ((completionTokens || 0) / 1_000_000) * prices.output;
  return usd * USD_TO_EUR;
}

// Plan list price in EUR per month. Yearly subscriptions still report the
// monthly-equivalent here (close enough for an MRR estimate).
const PLAN_PRICE_EUR = {
  starter:      29,
  professional: 49,
  klinik:       99,
};

export function planMonthlyEUR(plan) {
  return PLAN_PRICE_EUR[plan] || 0;
}

export const PRICING_META = { USD_TO_EUR, MODEL_PRICES_USD_PER_MTOK, PLAN_PRICE_EUR };
