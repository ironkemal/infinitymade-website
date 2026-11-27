import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KI_PREISE_STAND,
  KI_USD_TO_EUR,
  KI_MODEL_PREISE,
  normalisiereKiModell,
  kiModellPreis,
  berechneKiKostenEur,
  kiAbkuendigungen,
} from './ki-preise.js';
import {
  aiCallCostEUR,
  normalizeModel,
  planMonthlyEUR,
  PRICING_META,
} from '../../api/_lib/pricing.js';

test('ki-preise: Konstanten und tief eingefrorene Modelltabelle', () => {
  assert.equal(KI_PREISE_STAND, '2026-11-27');
  assert.equal(KI_USD_TO_EUR, 0.92);
  assert.ok(Object.isFrozen(KI_MODEL_PREISE));

  const expectedModels = [
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4o-transcribe',
    'gpt-4o-mini-transcribe',
    'whisper',
  ];
  assert.deepEqual(Object.keys(KI_MODEL_PREISE), expectedModels);
  for (const m of expectedModels) {
    assert.ok(Object.isFrozen(KI_MODEL_PREISE[m]), `${m} must be frozen`);
  }
});

test('normalisiereKiModell und kiModellPreis: Kanonisierung, Datums-Suffix und Schutz gegen Nicht-Strings/Prototype', () => {
  assert.equal(normalisiereKiModell('GPT-5-Mini-2025-08-07'), 'gpt-5-mini');
  assert.equal(normalisiereKiModell('  gpt-4o-2024-11-20  '), 'gpt-4o');
  assert.equal(normalisiereKiModell('gpt-4o-transcribe'), 'gpt-4o-transcribe');
  assert.equal(normalisiereKiModell(null), '');
  assert.equal(normalisiereKiModell(undefined), '');
  assert.equal(normalisiereKiModell(42), '');
  assert.equal(normalisiereKiModell({}), '');

  assert.equal(kiModellPreis('gpt-5-mini-2025-08-07')?.resource, 'de-text');
  assert.equal(kiModellPreis('gpt-4.1')?.resource, 'se-legacy');
  assert.equal(kiModellPreis('gpt-4o-mini-transcribe')?.resource, 'se-audio');
  assert.equal(kiModellPreis('unknown-model'), null);
  assert.equal(kiModellPreis('__proto__'), null);
  assert.equal(kiModellPreis('constructor'), null);
  assert.equal(kiModellPreis('toString'), null);
});

test('berechneKiKostenEur: Token-Modelle inkl. Reasoning ohne Doppelberechnung', () => {
  // gpt-5-mini: input 0.253 / 1M, output 2.024 / 1M
  // 1M prompt + 500k completion (davon 300k reasoning) -> reasoning darf NICHT addiert werden!
  const res = berechneKiKostenEur({
    model: 'gpt-5-mini-2025-08-07',
    promptTokens: 1_000_000,
    completionTokens: 500_000,
    reasoningTokens: 300_000,
  });

  assert.equal(res.knownModel, true);
  assert.equal(res.billingType, 'tokens');
  assert.equal(res.resource, 'de-text');
  assert.ok(Math.abs(res.breakdown.inputEur - 0.253) < 1e-12);
  assert.ok(Math.abs(res.breakdown.outputEur - 1.012) < 1e-12);
  assert.equal(res.breakdown.audioEur, 0);
  assert.ok(Math.abs(res.breakdown.reasoningShareEur - 0.6072) < 1e-12);
  assert.ok(Math.abs(res.costEur - 1.265) < 1e-12);

  // Wenn reasoningTokens > completionTokens übergeben wird, wird reasoningShareEur auf completionTokens gedeckelt
  const capped = berechneKiKostenEur({
    model: 'gpt-5',
    promptTokens: 0,
    completionTokens: 100_000,
    reasoningTokens: 999_999,
  });
  assert.ok(Math.abs(capped.costEur - 1.012) < 1e-12);
  assert.ok(Math.abs(capped.breakdown.reasoningShareEur - 1.012) < 1e-12);

  // Standardmodell gpt-4o-mini
  const mini = berechneKiKostenEur({
    model: 'gpt-4o-mini',
    promptTokens: 2_000_000,
    completionTokens: 1_000_000,
  });
  assert.equal(mini.resource, 'se-legacy');
  assert.ok(Math.abs(mini.costEur - (2 * 0.1518 + 0.6072)) < 1e-12);
});

test('berechneKiKostenEur: Audio-Modelle (Sekunden -> Minuten)', () => {
  const transcribe = berechneKiKostenEur({
    model: 'gpt-4o-transcribe',
    audioSeconds: 90,
    promptTokens: 9999,
    completionTokens: 9999,
  });
  assert.equal(transcribe.knownModel, true);
  assert.equal(transcribe.billingType, 'audio_minutes');
  assert.equal(transcribe.resource, 'se-audio');
  assert.ok(Math.abs(transcribe.breakdown.audioEur - 0.009108) < 1e-12);
  assert.ok(Math.abs(transcribe.costEur - 0.009108) < 1e-12);
  assert.equal(transcribe.breakdown.inputEur, 0);
  assert.equal(transcribe.breakdown.outputEur, 0);
  assert.equal(transcribe.breakdown.reasoningShareEur, 0);

  const miniTranscribe = berechneKiKostenEur({
    model: 'gpt-4o-mini-transcribe',
    audioSeconds: 60,
  });
  assert.ok(Math.abs(miniTranscribe.costEur - 0.003036) < 1e-12);

  const whisper = berechneKiKostenEur({
    model: 'whisper',
    audioSeconds: 30,
  });
  assert.ok(Math.abs(whisper.costEur - 0.003036) < 1e-12);
});

test('berechneKiKostenEur: unbekannte Modelle und ungültige/negative/NaN-Eingaben', () => {
  const unknown = berechneKiKostenEur({
    model: 'non-existent-model',
    promptTokens: 1000,
    completionTokens: 1000,
    audioSeconds: 60,
  });
  assert.deepEqual(unknown, {
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
  });

  const invalidNumbers = berechneKiKostenEur({
    model: 'gpt-5-nano',
    promptTokens: -500,
    completionTokens: Number.NaN,
    reasoningTokens: Number.POSITIVE_INFINITY,
    audioSeconds: -10,
  });
  assert.equal(invalidNumbers.knownModel, true);
  assert.equal(invalidNumbers.costEur, 0);
  assert.deepEqual(invalidNumbers.breakdown, {
    inputEur: 0,
    outputEur: 0,
    audioEur: 0,
    reasoningShareEur: 0,
  });

  assert.equal(berechneKiKostenEur(/** @type {any} */ (null)).knownModel, false);
  assert.equal(berechneKiKostenEur().knownModel, false);
});

test('kiAbkuendigungen: sortierter Kalender und verbleibende Tage', () => {
  const list = kiAbkuendigungen(new Date('2027-04-04T15:30:00.000Z'));
  assert.deepEqual(
    list.map((e) => e.model),
    ['gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-5-mini']
  );

  assert.equal(list[0].retiresOn, '2027-04-14');
  assert.equal(list[0].daysRemaining, 10);
  assert.equal(list[0].resource, 'se-legacy');

  assert.equal(list[3].retiresOn, '2027-07-13');
  assert.equal(list[3].daysRemaining, 100);
  assert.equal(list[3].resource, 'de-text');

  // Am Stichtag selbst -> 0; danach negativ
  const onDay = kiAbkuendigungen(new Date('2027-04-14T23:59:59.000Z'));
  assert.equal(onDay[0].daysRemaining, 0);

  const pastDay = kiAbkuendigungen(new Date('2027-04-16T00:00:00.000Z'));
  assert.equal(pastDay[0].daysRemaining, -2);
});

test('api/_lib/pricing.js: eigenstaendig (ohne api-backend-Import), Alt-Exporte + Claude/Gemini-Fallback', () => {
  const gpt5Cost = aiCallCostEUR('gpt-5-mini-2025-08-07', 1_000_000, 500_000);
  assert.ok(Math.abs(gpt5Cost - 1.265) < 1e-12);

  const audioCost = aiCallCostEUR('gpt-4o-transcribe', 0, 0, 60);
  assert.ok(Math.abs(audioCost - 0.006072) < 1e-12);

  // Legacy fallback: claude-sonnet-4-6 ($3/$15 * 0.92)
  const claudeCost = aiCallCostEUR('claude-sonnet-4-6', 1_000_000, 1_000_000);
  assert.ok(Math.abs(claudeCost - 18 * 0.92) < 1e-12);

  const geminiCost = aiCallCostEUR('gemini-2.0-flash', 1_000_000, 0);
  assert.ok(Math.abs(geminiCost - 0.075 * 0.92) < 1e-12);

  assert.equal(aiCallCostEUR('unknown', 1000, 1000), 0);
  assert.equal(normalizeModel('GPT-4o-Mini-2024-07-18'), 'gpt-4o-mini');
  assert.equal(normalizeModel(null), null);
  assert.equal(normalizeModel({}), null);
  assert.equal(normalizeModel('   '), null);
  assert.equal(normalizeModel(42), null);
  assert.equal(normalizeModel('__proto__'), '__proto__');
  assert.equal(aiCallCostEUR('__proto__', 1000, 1000), 0);
  assert.equal(planMonthlyEUR('professional'), 49);
  assert.equal(PRICING_META.USD_TO_EUR, 0.92);
});

test('Paritaet: api/_lib/pricing.js und api-backend/ai/ki-preise.js liefern fuer jedes Modell identische EUR-Kosten', () => {
  for (const [model, entry] of Object.entries(KI_MODEL_PREISE)) {
    const variants = [model, `${model}-2026-11-27`, `  ${model.toUpperCase()}  `];
    for (const variant of variants) {
      assert.equal(normalizeModel(variant), normalisiereKiModell(variant));
      if (entry.billingType === 'audio_minutes') {
        const expected = berechneKiKostenEur({
          model: variant,
          promptTokens: 123_456,
          completionTokens: 78_910,
          audioSeconds: 95,
        }).costEur;
        const actual = aiCallCostEUR(variant, 123_456, 78_910, 95);
        assert.ok(
          Math.abs(actual - expected) < 1e-12,
          `Audio-Paritaetsfehler fuer ${variant}: ${actual} vs ${expected}`
        );
      } else {
        const expected = berechneKiKostenEur({
          model: variant,
          promptTokens: 250_000,
          completionTokens: 125_000,
          reasoningTokens: 80_000,
          audioSeconds: 45,
        }).costEur;
        const actual = aiCallCostEUR(variant, 250_000, 125_000, 45);
        assert.ok(
          Math.abs(actual - expected) < 1e-12,
          `Token-Paritaetsfehler fuer ${variant}: ${actual} vs ${expected}`
        );
      }
    }
  }
});
