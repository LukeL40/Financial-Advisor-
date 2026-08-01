import { describe, expect, it } from 'vitest';

import { allocateFinancialRecommendations } from '#server/financial-brain/allocator';
import type {
  FinancialPolicy,
  FinancialSnapshot,
} from '#server/financial-brain/types';

function buildSnapshot(
  overrides: Partial<FinancialSnapshot> = {},
): FinancialSnapshot {
  return {
    liquidCash: 1_000,
    checkingBalance: 1_000,
    nearTermRequiredCash: 1_000,
    emergencySavings: 3_000,
    monthlyEssentialSpend: 1_000,
    monthlyNetIncome: 5_000,
    debts: [],
    goals: [],
    ...overrides,
  };
}

function buildPolicy(
  overrides: Partial<FinancialPolicy> = {},
): FinancialPolicy {
  return {
    minimumCheckingBuffer: 500,
    emergencyFundTargetMonths: 3,
    highInterestDebtAprThresholdBasisPoints: 1_000,
    targetMonthlyInvestingAmount: 400,
    ...overrides,
  };
}

describe('allocateFinancialRecommendations', () => {
  it('returns no recommendations for zero deployable cash', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot(),
      policy: buildPolicy(),
      deployableAmount: 0,
    });

    expect(result.recommendations).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('lets the checking buffer consume all available cash', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot({
        liquidCash: 200,
        checkingBalance: 200,
      }),
      policy: buildPolicy({
        minimumCheckingBuffer: 500,
        targetMonthlyInvestingAmount: 0,
      }),
      deployableAmount: 250,
    });

    expect(result.recommendations).toEqual([
      expect.objectContaining({
        action: 'MAINTAIN_CHECKING_BUFFER',
        amount: 250,
        priority: 1,
        remainingDeployableAmount: 0,
      }),
    ]);
  });

  it('cascades cash through multiple priorities in order', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot({
        liquidCash: 200,
        checkingBalance: 200,
        nearTermRequiredCash: 400,
        emergencySavings: 200,
        monthlyEssentialSpend: 100,
        debts: [
          {
            id: 'debt-1',
            name: 'Credit Card',
            balance: 100,
            aprBasisPoints: 2_000,
          },
        ],
        goals: [
          {
            id: 'goal-1',
            name: 'Vacation',
            requiredContributionAmount: 50,
          },
        ],
      }),
      policy: buildPolicy({
        minimumCheckingBuffer: 300,
        emergencyFundTargetMonths: 3,
        highInterestDebtAprThresholdBasisPoints: 1_500,
        targetMonthlyInvestingAmount: 75,
      }),
      deployableAmount: 450,
    });

    expect(
      result.recommendations.map(recommendation => ({
        action: recommendation.action,
        amount: recommendation.amount,
      })),
    ).toEqual([
      { action: 'MAINTAIN_CHECKING_BUFFER', amount: 100 },
      { action: 'RESERVE_NEAR_TERM_CASH', amount: 100 },
      { action: 'PAY_HIGH_INTEREST_DEBT', amount: 100 },
      { action: 'BUILD_EMERGENCY_FUND', amount: 100 },
      { action: 'FUND_GOAL', amount: 50 },
    ]);
  });

  it('targets high-interest debts by APR descending', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot({
        debts: [
          {
            id: 'debt-1',
            name: 'Card A',
            balance: 200,
            aprBasisPoints: 1_800,
          },
          {
            id: 'debt-2',
            name: 'Card B',
            balance: 200,
            aprBasisPoints: 2_200,
          },
        ],
      }),
      policy: buildPolicy({
        targetMonthlyInvestingAmount: 0,
      }),
      deployableAmount: 300,
    });

    expect(
      result.recommendations
        .filter(
          recommendation => recommendation.action === 'PAY_HIGH_INTEREST_DEBT',
        )
        .map(recommendation => recommendation.targetId),
    ).toEqual(['debt-2', 'debt-1']);
  });

  it('does not target low-interest debt below the threshold', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot({
        debts: [
          {
            id: 'debt-1',
            name: 'Low APR Loan',
            balance: 500,
            aprBasisPoints: 900,
          },
        ],
      }),
      policy: buildPolicy({
        targetMonthlyInvestingAmount: 0,
      }),
      deployableAmount: 100,
    });

    expect(
      result.recommendations.some(
        recommendation => recommendation.action === 'PAY_HIGH_INTEREST_DEBT',
      ),
    ).toBe(false);
    expect(result.recommendations).toEqual([
      expect.objectContaining({
        action: 'UNALLOCATED',
        amount: 100,
      }),
    ]);
  });

  it('calculates the emergency target from target months and essential spend', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot({
        emergencySavings: 500,
        monthlyEssentialSpend: 1_000,
      }),
      policy: buildPolicy({
        emergencyFundTargetMonths: 3,
        targetMonthlyInvestingAmount: 0,
      }),
      deployableAmount: 2_500,
    });

    expect(result.recommendations).toEqual([
      expect.objectContaining({
        action: 'BUILD_EMERGENCY_FUND',
        amount: 2_500,
      }),
    ]);
  });

  it('only invests after higher priorities are satisfied', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot({
        liquidCash: 100,
        checkingBalance: 100,
      }),
      policy: buildPolicy({
        minimumCheckingBuffer: 200,
        targetMonthlyInvestingAmount: 100,
      }),
      deployableAmount: 100,
    });

    expect(
      result.recommendations.some(
        recommendation => recommendation.action === 'INVEST',
      ),
    ).toBe(false);
  });

  it('marks leftover cash as unallocated', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot(),
      policy: buildPolicy({
        targetMonthlyInvestingAmount: 0,
      }),
      deployableAmount: 120,
    });

    expect(result.recommendations).toEqual([
      expect.objectContaining({
        action: 'UNALLOCATED',
        amount: 120,
        remainingDeployableAmount: 0,
      }),
    ]);
  });

  it('rejects negative inputs', () => {
    expect(() =>
      allocateFinancialRecommendations({
        snapshot: buildSnapshot(),
        policy: buildPolicy(),
        deployableAmount: -1,
      }),
    ).toThrow('deployableAmount must be non-negative');
  });

  it('conserves the full deployable amount across recommendations', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot({
        liquidCash: 100,
        checkingBalance: 100,
        nearTermRequiredCash: 250,
        debts: [
          {
            id: 'debt-1',
            name: 'Card',
            balance: 80,
            aprBasisPoints: 1_500,
          },
        ],
      }),
      policy: buildPolicy({
        minimumCheckingBuffer: 150,
        emergencyFundTargetMonths: 0,
        targetMonthlyInvestingAmount: 40,
      }),
      deployableAmount: 300,
    });

    const total = result.recommendations.reduce(
      (sum, recommendation) => sum + recommendation.amount,
      0,
    );

    expect(total).toBe(300);
  });

  it('returns warnings for goals with insufficient contribution metadata', () => {
    const result = allocateFinancialRecommendations({
      snapshot: buildSnapshot({
        goals: [
          {
            id: 'goal-1',
            name: 'House',
          },
        ],
      }),
      policy: buildPolicy({
        targetMonthlyInvestingAmount: 0,
      }),
      deployableAmount: 50,
    });

    expect(result.warnings).toEqual([
      'Goal "House" (goal-1) is missing required contribution metadata and was skipped.',
    ]);
    expect(result.recommendations).toEqual([
      expect.objectContaining({
        action: 'UNALLOCATED',
        amount: 50,
      }),
    ]);
  });
});
