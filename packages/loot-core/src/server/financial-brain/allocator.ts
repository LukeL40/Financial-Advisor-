import {
  validateDeployableAmount,
  validateFinancialPolicy,
  validateFinancialSnapshot,
} from './policy';
import type {
  AllocationAction,
  AllocationReasonCode,
  AllocationRecommendation,
  AllocationResult,
  DebtPosition,
  FinancialPolicy,
  FinancialSnapshot,
  GoalPosition,
} from './types';

function sortHighInterestDebts(
  debts: DebtPosition[],
  thresholdBasisPoints: number,
) {
  return debts
    .filter(
      debt =>
        debt.balance > 0 && debt.aprBasisPoints >= thresholdBasisPoints,
    )
    .sort(
      (left, right) =>
        right.aprBasisPoints - left.aprBasisPoints ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
    );
}

function createGoalWarning(goal: GoalPosition) {
  return `Goal "${goal.name}" (${goal.id}) is missing required contribution metadata and was skipped.`;
}

function createRecommendation({
  action,
  amount,
  priority,
  reasonCode,
  remainingDeployableAmount,
  explanation,
  targetId,
}: {
  action: AllocationAction;
  amount: number;
  priority: number;
  reasonCode: AllocationReasonCode;
  remainingDeployableAmount: number;
  explanation: string;
  targetId?: string;
}): AllocationRecommendation {
  return {
    action,
    amount,
    priority,
    reasonCode,
    explanation,
    remainingDeployableAmount,
    targetId,
  };
}

export function allocateFinancialRecommendations({
  snapshot,
  policy,
  deployableAmount,
}: {
  snapshot: FinancialSnapshot;
  policy: FinancialPolicy;
  deployableAmount: number;
}): AllocationResult {
  validateFinancialSnapshot(snapshot);
  validateFinancialPolicy(policy);
  validateDeployableAmount(deployableAmount);

  const recommendations: AllocationRecommendation[] = [];
  const warnings: string[] = [];

  let remainingDeployableAmount = deployableAmount;
  let cashCoverage = snapshot.liquidCash;

  function allocateStage({
    action,
    reasonCode,
    priority,
    need,
    explanation,
    targetId,
  }: {
    action: AllocationAction;
    reasonCode: AllocationReasonCode;
    priority: number;
    need: number;
    explanation: (amount: number) => string;
    targetId?: string;
  }) {
    if (remainingDeployableAmount === 0 || need <= 0) {
      return 0;
    }

    const amount = Math.min(remainingDeployableAmount, need);
    remainingDeployableAmount -= amount;

    recommendations.push(
      createRecommendation({
        action,
        amount,
        priority,
        reasonCode,
        targetId,
        remainingDeployableAmount,
        explanation: explanation(amount),
      }),
    );

    return amount;
  }

  const checkingShortfall = Math.max(
    0,
    policy.minimumCheckingBuffer - snapshot.checkingBalance,
  );
  cashCoverage += allocateStage({
    action: 'MAINTAIN_CHECKING_BUFFER',
    reasonCode: 'CHECKING_BUFFER_SHORTFALL',
    priority: 1,
    need: checkingShortfall,
    explanation: amount =>
      `Allocate ${amount} to checking because the current balance is ${snapshot.checkingBalance} and the minimum buffer target is ${policy.minimumCheckingBuffer}.`,
  });

  const nearTermShortfall = Math.max(
    0,
    snapshot.nearTermRequiredCash - cashCoverage,
  );
  cashCoverage += allocateStage({
    action: 'RESERVE_NEAR_TERM_CASH',
    reasonCode: 'NEAR_TERM_CASH_SHORTFALL',
    priority: 2,
    need: nearTermShortfall,
    explanation: amount =>
      `Reserve ${amount} for near-term cash needs because required cash is ${snapshot.nearTermRequiredCash} and covered liquid cash after earlier steps is ${cashCoverage}.`,
  });

  for (const debt of sortHighInterestDebts(
    snapshot.debts,
    policy.highInterestDebtAprThresholdBasisPoints,
  )) {
    allocateStage({
      action: 'PAY_HIGH_INTEREST_DEBT',
      reasonCode: 'HIGH_INTEREST_DEBT',
      priority: 3,
      need: debt.balance,
      targetId: debt.id,
      explanation: amount =>
        `Apply ${amount} to ${debt.name} because its APR is ${debt.aprBasisPoints} basis points, which meets or exceeds the ${policy.highInterestDebtAprThresholdBasisPoints} basis point threshold.`,
    });
  }

  const emergencyTarget =
    policy.emergencyFundTargetMonths * snapshot.monthlyEssentialSpend;
  const emergencyShortfall = Math.max(
    0,
    emergencyTarget - snapshot.emergencySavings,
  );
  allocateStage({
    action: 'BUILD_EMERGENCY_FUND',
    reasonCode: 'EMERGENCY_FUND_SHORTFALL',
    priority: 4,
    need: emergencyShortfall,
    explanation: amount =>
      `Set aside ${amount} for emergency savings because the target is ${emergencyTarget} (${policy.emergencyFundTargetMonths} months × ${snapshot.monthlyEssentialSpend}) and current emergency savings are ${snapshot.emergencySavings}.`,
  });

  for (const goal of snapshot.goals) {
    if (goal.requiredContributionAmount == null) {
      warnings.push(createGoalWarning(goal));
      continue;
    }

    allocateStage({
      action: 'FUND_GOAL',
      reasonCode: 'GOAL_REQUIRED_CONTRIBUTION_SHORTFALL',
      priority: 5,
      need: goal.requiredContributionAmount,
      targetId: goal.id,
      explanation: amount =>
        `Fund ${amount} toward ${goal.name} because its required contribution shortfall is ${goal.requiredContributionAmount}.`,
    });
  }

  allocateStage({
    action: 'INVEST',
    reasonCode: 'TARGET_INVESTING',
    priority: 6,
    need: policy.targetMonthlyInvestingAmount,
    explanation: amount =>
      `Invest ${amount} because higher-priority needs are satisfied and the monthly investing target is ${policy.targetMonthlyInvestingAmount}.`,
  });

  allocateStage({
    action: 'UNALLOCATED',
    reasonCode: 'NO_HIGHER_PRIORITY_NEEDS',
    priority: 7,
    need: remainingDeployableAmount,
    explanation: amount =>
      `Leave ${amount} unallocated because all configured priorities have been satisfied.`,
  });

  return {
    deployableAmount,
    recommendations,
    warnings,
  };
}
