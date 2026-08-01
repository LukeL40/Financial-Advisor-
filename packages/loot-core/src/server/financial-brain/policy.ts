import type {
  DebtPosition,
  FinancialPolicy,
  FinancialSnapshot,
  GoalPosition,
} from './types';

function validateIntegerAmount(name: string, value: number) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer`);
  }
}

function validateNonNegativeInteger(name: string, value: number) {
  validateIntegerAmount(name, value);
  if (value < 0) {
    throw new Error(`${name} must be non-negative`);
  }
}

function validateDebtPosition(debt: DebtPosition, index: number) {
  validateNonNegativeInteger(`debts[${index}].balance`, debt.balance);
  validateNonNegativeInteger(
    `debts[${index}].aprBasisPoints`,
    debt.aprBasisPoints,
  );
}

function validateGoalPosition(goal: GoalPosition, index: number) {
  if (goal.targetAmount != null) {
    validateNonNegativeInteger(
      `goals[${index}].targetAmount`,
      goal.targetAmount,
    );
  }

  if (goal.currentAmount != null) {
    validateNonNegativeInteger(
      `goals[${index}].currentAmount`,
      goal.currentAmount,
    );
  }

  if (goal.requiredContributionAmount != null) {
    validateNonNegativeInteger(
      `goals[${index}].requiredContributionAmount`,
      goal.requiredContributionAmount,
    );
  }
}

export function validateFinancialSnapshot(snapshot: FinancialSnapshot) {
  validateNonNegativeInteger('liquidCash', snapshot.liquidCash);
  validateNonNegativeInteger('checkingBalance', snapshot.checkingBalance);
  validateNonNegativeInteger(
    'nearTermRequiredCash',
    snapshot.nearTermRequiredCash,
  );
  validateNonNegativeInteger('emergencySavings', snapshot.emergencySavings);
  validateNonNegativeInteger(
    'monthlyEssentialSpend',
    snapshot.monthlyEssentialSpend,
  );
  validateIntegerAmount('monthlyNetIncome', snapshot.monthlyNetIncome);

  snapshot.debts.forEach(validateDebtPosition);
  snapshot.goals.forEach(validateGoalPosition);
}

export function validateFinancialPolicy(policy: FinancialPolicy) {
  validateNonNegativeInteger(
    'minimumCheckingBuffer',
    policy.minimumCheckingBuffer,
  );
  validateNonNegativeInteger(
    'emergencyFundTargetMonths',
    policy.emergencyFundTargetMonths,
  );
  validateNonNegativeInteger(
    'highInterestDebtAprThresholdBasisPoints',
    policy.highInterestDebtAprThresholdBasisPoints,
  );
  validateNonNegativeInteger(
    'targetMonthlyInvestingAmount',
    policy.targetMonthlyInvestingAmount,
  );
}

export function validateDeployableAmount(deployableAmount: number) {
  validateNonNegativeInteger('deployableAmount', deployableAmount);
}
