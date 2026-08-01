import { describe, expect, it } from 'vitest';

import { app } from '#server/financial-brain/app';
import type {
  AllocationRequest,
  FinancialPolicy,
  FinancialSnapshot,
} from '#server/financial-brain/types';

function buildSnapshot(
  overrides: Partial<FinancialSnapshot> = {},
): FinancialSnapshot {
  return {
    liquidCash: 500_00,
    checkingBalance: 500_00,
    nearTermRequiredCash: 0,
    emergencySavings: 0,
    monthlyEssentialSpend: 200_00,
    monthlyNetIncome: 400_00,
    debts: [],
    goals: [],
    ...overrides,
  };
}

function buildPolicy(
  overrides: Partial<FinancialPolicy> = {},
): FinancialPolicy {
  return {
    minimumCheckingBuffer: 100_00,
    emergencyFundTargetMonths: 3,
    highInterestDebtAprThresholdBasisPoints: 1000,
    targetMonthlyInvestingAmount: 0,
    ...overrides,
  };
}

const allocateHandler = app.handlers['financial-brain-allocate'];

describe('financial-brain app — allocate handler', () => {
  it('returns an AllocationResult for a valid request', async () => {
    const request: AllocationRequest = {
      snapshot: buildSnapshot(),
      policy: buildPolicy(),
      deployableAmount: 300_00,
    };
    const result = await allocateHandler(request);
    expect(result).toHaveProperty('deployableAmount', 300_00);
    expect(result).toHaveProperty('recommendations');
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('returns zero recommendations when deployable amount is zero', async () => {
    const request: AllocationRequest = {
      snapshot: buildSnapshot(),
      policy: buildPolicy(),
      deployableAmount: 0,
    };
    const result = await allocateHandler(request);
    expect(result.recommendations).toHaveLength(0);
  });

  it('allocates to checking buffer shortfall first', async () => {
    const request: AllocationRequest = {
      snapshot: buildSnapshot({ checkingBalance: 0 }),
      policy: buildPolicy({ minimumCheckingBuffer: 100_00 }),
      deployableAmount: 500_00,
    };
    const result = await allocateHandler(request);
    const first = result.recommendations[0];
    expect(first.reasonCode).toBe('CHECKING_BUFFER_SHORTFALL');
    expect(first.amount).toBe(100_00);
  });

  it('rejects a negative deployable amount', async () => {
    const request: AllocationRequest = {
      snapshot: buildSnapshot(),
      policy: buildPolicy(),
      deployableAmount: -1,
    };
    await expect(allocateHandler(request)).rejects.toThrow();
  });

  it('sum of recommendation amounts equals deployable amount', async () => {
    const deployableAmount = 400_00;
    const request: AllocationRequest = {
      snapshot: buildSnapshot({ checkingBalance: 0 }),
      policy: buildPolicy({
        minimumCheckingBuffer: 100_00,
        targetMonthlyInvestingAmount: 50_00,
      }),
      deployableAmount,
    };
    const result = await allocateHandler(request);
    const total = result.recommendations.reduce((sum, r) => sum + r.amount, 0);
    expect(total).toBe(deployableAmount);
  });
});
