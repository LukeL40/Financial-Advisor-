export type DebtPosition = {
  id: string;
  name: string;
  balance: number;
  aprBasisPoints: number;
};

export type GoalPosition = {
  id: string;
  name: string;
  targetAmount?: number | null;
  currentAmount?: number | null;
  requiredContributionAmount?: number | null;
};

export type FinancialSnapshot = {
  liquidCash: number;
  checkingBalance: number;
  nearTermRequiredCash: number;
  emergencySavings: number;
  monthlyEssentialSpend: number;
  monthlyNetIncome: number;
  debts: DebtPosition[];
  goals: GoalPosition[];
};

export type FinancialPolicy = {
  minimumCheckingBuffer: number;
  emergencyFundTargetMonths: number;
  highInterestDebtAprThresholdBasisPoints: number;
  targetMonthlyInvestingAmount: number;
};

export type AllocationAction =
  | 'MAINTAIN_CHECKING_BUFFER'
  | 'RESERVE_NEAR_TERM_CASH'
  | 'PAY_HIGH_INTEREST_DEBT'
  | 'BUILD_EMERGENCY_FUND'
  | 'FUND_GOAL'
  | 'INVEST'
  | 'UNALLOCATED';

export type AllocationReasonCode =
  | 'CHECKING_BUFFER_SHORTFALL'
  | 'NEAR_TERM_CASH_SHORTFALL'
  | 'HIGH_INTEREST_DEBT'
  | 'EMERGENCY_FUND_SHORTFALL'
  | 'GOAL_REQUIRED_CONTRIBUTION_SHORTFALL'
  | 'TARGET_INVESTING'
  | 'NO_HIGHER_PRIORITY_NEEDS';

export type AllocationRecommendation = {
  action: AllocationAction;
  amount: number;
  priority: number;
  reasonCode: AllocationReasonCode;
  targetId?: string;
  explanation: string;
  remainingDeployableAmount: number;
};

export type AllocationResult = {
  deployableAmount: number;
  recommendations: AllocationRecommendation[];
  warnings: string[];
};
