// Central single-source Azure Data Zone EUR cost calculation table (Faz 1A).
// Pure ESM, zero external dependencies.
// Strictly Azure OpenAI Data Zone EUR cost calculation — never customer sales prices.

export const KI_PREISE_STAND = '2026-11-27';
export const KI_USD_TO_EUR = 0.92;

/**
 * @typedef {{
 *   billingType: 'tokens',
 *   inputPerMtokEur: number,
 *   outputPerMtokEur: number,
 *   reasoningIncludedInOutput: boolean,
 *   resource: string,
 *   retiresOn: string | null
 * }} KiTokenPreisEintrag
 * @typedef {{
 *   billingType: 'audio_minutes',
 *   audioPerMinuteEur: number,
 *   resource: string,
 *   retiresOn: string | null
 * }} KiAudioPreisEintrag
 * @typedef {KiTokenPreisEintrag | KiAudioPreisEintrag} KiModellPreisEintrag
 */

/** @type {Readonly<Record<string, Readonly<KiModellPreisEintrag>>>} */
export const KI_MODEL_PREISE = Object.freeze({
  'gpt-5': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 1.265,
    outputPerMtokEur: 10.12,
    reasoningIncludedInOutput: true,
    resource: 'de-text',
    retiresOn: null,
  }),
  'gpt-5-mini': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 0.253,
    outputPerMtokEur: 2.024,
    reasoningIncludedInOutput: true,
    resource: 'de-text',
    retiresOn: '2027-07-13',
  }),
  'gpt-5-nano': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 0.0506,
    outputPerMtokEur: 0.4048,
    reasoningIncludedInOutput: true,
    resource: 'de-text',
    retiresOn: null,
  }),
  'gpt-4.1': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 2.024,
    outputPerMtokEur: 8.096,
    reasoningIncludedInOutput: false,
    resource: 'se-legacy',
    retiresOn: null,
  }),
  'gpt-4.1-mini': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 0.4048,
    outputPerMtokEur: 1.6192,
    reasoningIncludedInOutput: false,
    resource: 'se-legacy',
    retiresOn: '2027-04-14',
  }),
  'gpt-4o': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 2.53,
    outputPerMtokEur: 10.12,
    reasoningIncludedInOutput: false,
    resource: 'se-legacy',
    retiresOn: '2027-04-14',
  }),
  'gpt-4o-mini': Object.freeze({
    billingType: 'tokens',
    inputPerMtokEur: 0.1518,
    outputPerMtokEur: 0.6072,
    reasoningIncludedInOutput: false,
    resource: 'se-legacy',
    retiresOn: '2027-04-14',
  }),
  'gpt-4o-transcribe': Object.freeze({
    billingType: 'audio_minutes',
    audioPerMinuteEur: 0.006072,
    resource: 'se-audio',
    retiresOn: null,
  }),
  'gpt-4o-mini-transcribe': Object.freeze({
    billingType: 'audio_minutes',
    audioPerMinuteEur: 0.003036,
    resource: 'se-audio',
    retiresOn: null,
  }),
  'whisper': Object.freeze({
    billingType: 'audio_minutes',
    audioPerMinuteEur: 0.006072,
    resource: 'se-audio',
    retiresOn: null,
  }),
});

/**
 * Normalizes an Azure/OpenAI model identifier by lowercasing and stripping a trailing `-YYYY-MM-DD`.
 *
 * @param {unknown} model
 * @returns {string}
 */
export function normalisiereKiModell(model) {
  if (typeof model !== 'string') return '';
  return model.trim().toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

/**
 * Looks up a canonical pricing entry in `KI_MODEL_PREISE`, or `null` if unknown.
 *
 * @param {unknown} model
 * @returns {Readonly<KiModellPreisEintrag> | null}
 */
export function kiModellPreis(model) {
  const key = normalisiereKiModell(model);
  if (!key || !Object.hasOwn(KI_MODEL_PREISE, key)) return null;
  return KI_MODEL_PREISE[key];
}

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

/**
 * Calculates Azure Data Zone EUR cost for a single AI call.
 * IMPORTANT: `reasoningTokens` is already included inside `completionTokens`
 * (Azure bills reasoning tokens as completion tokens) — never added on top of `outputEur`.
 *
 * @param {{
 *   model?: unknown,
 *   promptTokens?: number,
 *   completionTokens?: number,
 *   reasoningTokens?: number,
 *   audioSeconds?: number
 * }} [params]
 * @returns {{
 *   costEur: number,
 *   billingType: 'tokens' | 'audio_minutes' | 'unknown',
 *   resource: string,
 *   knownModel: boolean,
 *   breakdown: {
 *     inputEur: number,
 *     outputEur: number,
 *     audioEur: number,
 *     reasoningShareEur: number
 *   }
 * }}
 */
export function berechneKiKostenEur(params = {}) {
  const opts = params && typeof params === 'object' ? params : {};
  const {
    model,
    promptTokens = 0,
    completionTokens = 0,
    reasoningTokens = 0,
    audioSeconds = 0,
  } = opts;

  const entry = kiModellPreis(model);
  if (!entry) {
    return {
      costEur: 0,
      billingType: 'unknown',
      resource: 'unknown',
      knownModel: false,
      breakdown: {
        inputEur: 0,
        outputEur: 0,
        audioEur: 0,
        reasoningShareEur: 0,
      },
    };
  }

  if (entry.billingType === 'audio_minutes') {
    const sec = clampNonNegativeFinite(audioSeconds);
    const audioEur = (sec / 60) * entry.audioPerMinuteEur;
    return {
      costEur: audioEur,
      billingType: entry.billingType,
      resource: entry.resource,
      knownModel: true,
      breakdown: {
        inputEur: 0,
        outputEur: 0,
        audioEur,
        reasoningShareEur: 0,
      },
    };
  }

  const pt = clampNonNegativeFinite(promptTokens);
  const ct = clampNonNegativeFinite(completionTokens);
  const rt = clampNonNegativeFinite(reasoningTokens);

  const inputEur = (pt / 1_000_000) * entry.inputPerMtokEur;
  const outputEur = (ct / 1_000_000) * entry.outputPerMtokEur;
  const reasoningShareEur = (Math.min(rt, ct) / 1_000_000) * entry.outputPerMtokEur;

  return {
    costEur: inputEur + outputEur,
    billingType: entry.billingType,
    resource: entry.resource,
    knownModel: true,
    breakdown: {
      inputEur,
      outputEur,
      audioEur: 0,
      reasoningShareEur,
    },
  };
}

/**
 * Returns sorted retirement calendar entries for models with `retiresOn !== null`.
 *
 * @param {Date | string | number} [asOfDate]
 * @returns {Array<{ model: string, retiresOn: string, daysRemaining: number, resource: string }>}
 */
export function kiAbkuendigungen(asOfDate = new Date()) {
  const ref = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  const validRef = Number.isNaN(ref.getTime()) ? new Date() : ref;
  const refUtcDay = Date.UTC(validRef.getUTCFullYear(), validRef.getUTCMonth(), validRef.getUTCDate());

  /** @type {Array<{ model: string, retiresOn: string, daysRemaining: number, resource: string }>} */
  const items = [];
  for (const [model, entry] of Object.entries(KI_MODEL_PREISE)) {
    if (entry.retiresOn === null) continue;
    const retireUtcDay = Date.parse(`${entry.retiresOn}T00:00:00.000Z`);
    const daysRemaining = Math.round((retireUtcDay - refUtcDay) / 86_400_000);
    items.push({
      model,
      retiresOn: entry.retiresOn,
      daysRemaining,
      resource: entry.resource,
    });
  }

  items.sort((a, b) => a.retiresOn.localeCompare(b.retiresOn) || a.model.localeCompare(b.model));
  return items;
}
