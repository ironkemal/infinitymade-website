/**
 * Praxura — Plan Gating Helper
 * =================================
 * Paket bazlı özellik kilidi.
 *
 * Planlar:
 *   starter         — temel (1 işletme, 1-2 çalışan)
 *   professional    — pro    (1 işletme, 1-5 çalışan)
 *   klinik          — klinik (1 işletme, fizyo odaklı + DTA-Pro mümkün)
 *   enterprise      — multi-business + RBAC + advanced calendar
 *
 * Feature flag'ler: hasFeature(profile, 'multi_business') gibi.
 *
 * Usage:
 *   import { hasFeature, isPlanActive } from './lib/plan.js';
 */

const PLAN_FEATURES = {
  starter: new Set([
    'single_business', 'basic_calendar', 'basic_team',
  ]),
  professional: new Set([
    'single_business', 'basic_calendar', 'basic_team',
    'b2b_email', 'extended_templates',
  ]),
  klinik: new Set([
    'single_business', 'basic_calendar', 'basic_team',
    'b2b_email', 'extended_templates',
    'prescriptions', 'anamnese', 'abrechnung',
  ]),
  enterprise: new Set([
    'single_business', 'basic_calendar', 'basic_team',
    'b2b_email', 'extended_templates',
    'prescriptions', 'anamnese', 'abrechnung',
    // Enterprise-only:
    'multi_business', 'rbac', 'weekly_calendar', 'monthly_calendar',
    'cross_employment',
  ]),
};

const ACTIVE_STATUSES = new Set(['trial', 'active', 'past_due']);

/**
 * Plan aktif mi? (trial dahil)
 */
export function isPlanActive(profile) {
  if (!profile) return false;
  return ACTIVE_STATUSES.has(profile.plan_status);
}

/**
 * Prüft, ob der Nutzer Zugang zu einem bestimmten Feature hat.
 *
 * Für Employees gilt der Plan des Owners (wird über owner_id aufgelöst
 * — dieser Helper muss mit dem Owner-Profile des Employees aufgerufen werden).
 */
export function hasFeature(profile, feature) {
  if (!profile) return false;
  if (!isPlanActive(profile)) return false;
  const plan = (profile.plan || 'starter').toLowerCase();
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.starter;
  return features.has(feature);
}

/**
 * UI'da kısa erişim: plan adından feature listesi.
 */
export function getPlanFeatures(plan) {
  return Array.from(PLAN_FEATURES[plan] || PLAN_FEATURES.starter);
}

/**
 * Multi-business kilidi için kısa yol.
 */
export function canHaveMultipleBusinesses(profile) {
  return hasFeature(profile, 'multi_business');
}
