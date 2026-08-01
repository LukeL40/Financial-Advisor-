import type { FinancialPolicy } from '@actual-app/core/server/financial-brain/types';

/**
 * Default policy applied when running the allocator. These are fixed defaults
 * that are surfaced in the UI so users know what assumptions are being applied.
 */
export const DEFAULT_POLICY: FinancialPolicy = {
  minimumCheckingBuffer: 100000,
  emergencyFundTargetMonths: 3,
  highInterestDebtAprThresholdBasisPoints: 1000,
  targetMonthlyInvestingAmount: 0,
};

/**
 * Returns true when the emergency reserve metric is unknown because no
 * emergency fund accounts have been mapped.
 */
export function isEmergencyReserveUnavailable(
  missingMappings: string[],
): boolean {
  return missingMappings.includes('emergencyFundAccountIds');
}

/**
 * Returns true when the monthly surplus metric is unreliable because essential
 * spend categories have not been mapped (surplus = income − essential spend,
 * and unknown essential spend is stored as 0, making the value meaningless).
 */
export function isMonthlySurplusUnavailable(
  missingMappings: string[],
): boolean {
  return missingMappings.includes('essentialCategoryIds');
}

/**
 * Returns true when the required inputs for the default allocation policy are
 * known, i.e. both emergency savings and essential spend are mapped.
 * When false, running the allocator would produce recommendations based on
 * fabricated zero values.
 */
export function hasRequiredAllocationMappings(
  missingMappings: string[],
): boolean {
  return (
    !missingMappings.includes('emergencyFundAccountIds') &&
    !missingMappings.includes('essentialCategoryIds')
  );
}

/**
 * Returns a human-readable message describing which required mappings are
 * missing, or null when all required inputs are present.
 */
export function getMissingAllocationMessage(
  missingMappings: string[],
): string | null {
  const missing: string[] = [];

  if (missingMappings.includes('emergencyFundAccountIds')) {
    missing.push('emergency fund accounts');
  }
  if (missingMappings.includes('essentialCategoryIds')) {
    missing.push('essential spend categories');
  }

  if (missing.length === 0) {
    return null;
  }

  return `Recommendations are blocked until the following are mapped: ${missing.join(' and ')}.`;
}

/**
 * Returns a human-readable summary of the policy assumptions that will be
 * applied when running the allocator.
 */
export function formatPolicyAssumptions(policy: FinancialPolicy): string[] {
  const aprPct = (policy.highInterestDebtAprThresholdBasisPoints / 100).toFixed(
    1,
  );
  return [
    `Checking buffer target: $${(policy.minimumCheckingBuffer / 100).toFixed(2)}`,
    `Emergency fund target: ${policy.emergencyFundTargetMonths} month(s) of essential spend`,
    `High-interest debt threshold: ${aprPct}% APR`,
    `Monthly investing target: $${(policy.targetMonthlyInvestingAmount / 100).toFixed(2)}`,
  ];
}
