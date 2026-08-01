import { describe, expect, it } from 'vitest';

import {
  DEFAULT_POLICY,
  formatPolicyAssumptions,
  getMissingAllocationMessage,
  hasRequiredAllocationMappings,
  isEmergencyReserveUnavailable,
  isMonthlySurplusUnavailable,
} from '../financial-brain-utils';

describe('isEmergencyReserveUnavailable', () => {
  it('returns true when emergencyFundAccountIds is in missingMappings', () => {
    expect(
      isEmergencyReserveUnavailable(['emergencyFundAccountIds']),
    ).toBe(true);
  });

  it('returns false when emergencyFundAccountIds is not in missingMappings', () => {
    expect(isEmergencyReserveUnavailable([])).toBe(false);
    expect(
      isEmergencyReserveUnavailable(['essentialCategoryIds']),
    ).toBe(false);
  });

  it('returns true when both mappings are missing', () => {
    expect(
      isEmergencyReserveUnavailable([
        'emergencyFundAccountIds',
        'essentialCategoryIds',
      ]),
    ).toBe(true);
  });
});

describe('isMonthlySurplusUnavailable', () => {
  it('returns true when essentialCategoryIds is in missingMappings', () => {
    expect(isMonthlySurplusUnavailable(['essentialCategoryIds'])).toBe(true);
  });

  it('returns false when essentialCategoryIds is not in missingMappings', () => {
    expect(isMonthlySurplusUnavailable([])).toBe(false);
    expect(
      isMonthlySurplusUnavailable(['emergencyFundAccountIds']),
    ).toBe(false);
  });
});

describe('hasRequiredAllocationMappings', () => {
  it('returns true when both required mappings are present', () => {
    expect(hasRequiredAllocationMappings([])).toBe(true);
  });

  it('returns false when emergency fund mapping is missing', () => {
    expect(
      hasRequiredAllocationMappings(['emergencyFundAccountIds']),
    ).toBe(false);
  });

  it('returns false when essential category mapping is missing', () => {
    expect(
      hasRequiredAllocationMappings(['essentialCategoryIds']),
    ).toBe(false);
  });

  it('returns false when both required mappings are missing', () => {
    expect(
      hasRequiredAllocationMappings([
        'emergencyFundAccountIds',
        'essentialCategoryIds',
      ]),
    ).toBe(false);
  });
});

describe('getMissingAllocationMessage', () => {
  it('returns null when no required mappings are missing', () => {
    expect(getMissingAllocationMessage([])).toBeNull();
  });

  it('returns a message mentioning emergency fund accounts when that mapping is missing', () => {
    const msg = getMissingAllocationMessage(['emergencyFundAccountIds']);
    expect(msg).not.toBeNull();
    expect(msg).toContain('emergency fund accounts');
  });

  it('returns a message mentioning essential spend categories when that mapping is missing', () => {
    const msg = getMissingAllocationMessage(['essentialCategoryIds']);
    expect(msg).not.toBeNull();
    expect(msg).toContain('essential spend categories');
  });

  it('returns a message mentioning both when both mappings are missing', () => {
    const msg = getMissingAllocationMessage([
      'emergencyFundAccountIds',
      'essentialCategoryIds',
    ]);
    expect(msg).not.toBeNull();
    expect(msg).toContain('emergency fund accounts');
    expect(msg).toContain('essential spend categories');
  });
});

describe('formatPolicyAssumptions', () => {
  it('returns an array of human-readable policy lines', () => {
    const lines = formatPolicyAssumptions(DEFAULT_POLICY);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('includes the checking buffer amount', () => {
    const lines = formatPolicyAssumptions(DEFAULT_POLICY);
    const joined = lines.join(' ');
    // DEFAULT_POLICY.minimumCheckingBuffer = 100000 minor units = $1000.00
    expect(joined).toContain('1000.00');
  });

  it('includes the emergency fund target months', () => {
    const lines = formatPolicyAssumptions(DEFAULT_POLICY);
    const joined = lines.join(' ');
    expect(joined).toContain(
      `${DEFAULT_POLICY.emergencyFundTargetMonths} month`,
    );
  });

  it('includes the high-interest APR threshold', () => {
    const lines = formatPolicyAssumptions(DEFAULT_POLICY);
    const joined = lines.join(' ');
    // DEFAULT_POLICY.highInterestDebtAprThresholdBasisPoints = 1000 = 10.0%
    expect(joined).toContain('10.0%');
  });

  it('includes the monthly investing target', () => {
    const lines = formatPolicyAssumptions(DEFAULT_POLICY);
    const joined = lines.join(' ');
    // DEFAULT_POLICY.targetMonthlyInvestingAmount = 0 = $0.00
    expect(joined).toContain('0.00');
  });

  it('surfaces all four policy parameters', () => {
    const lines = formatPolicyAssumptions({
      minimumCheckingBuffer: 50000,
      emergencyFundTargetMonths: 6,
      highInterestDebtAprThresholdBasisPoints: 1500,
      targetMonthlyInvestingAmount: 20000,
    });
    const joined = lines.join(' ');
    expect(joined).toContain('500.00');
    expect(joined).toContain('6 month');
    expect(joined).toContain('15.0%');
    expect(joined).toContain('200.00');
  });
});
