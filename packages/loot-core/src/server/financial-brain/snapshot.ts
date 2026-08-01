import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { getAccounts as getAccountsWithComputedBalance } from '#server/forecast/forecast-accounts';
import type { AccountWithComputedBalance } from '#server/forecast/forecast-accounts';
import {
  FORECAST_UNASSIGNED_ACCOUNT_ID,
  getFutureOccurrenceDates,
  getNormalizedSchedules,
} from '#server/forecast/forecast-schedules';
import * as monthUtils from '#shared/months';
import { q } from '#shared/query';

import type { FinancialSnapshot, GoalPosition } from './types';

export type SnapshotWarningCode =
  | 'NO_ELIGIBLE_CHECKING_ACCOUNTS'
  | 'NO_ELIGIBLE_LIQUID_ACCOUNTS'
  | 'MISSING_EMERGENCY_FUND_MAPPING'
  | 'MISSING_ESSENTIAL_CATEGORY_MAPPING'
  | 'MISSING_DEBT_APR_MAPPING'
  | 'INCOME_OR_EXPENSE_HISTORY_EMPTY';

export type SnapshotWarning = {
  code: SnapshotWarningCode;
  message: string;
};

export type SnapshotMetricProvenance = {
  source: 'accounts' | 'schedules' | 'transactions' | 'config';
  rule: string;
  accountIds?: string[];
  categoryIds?: string[];
  scheduleIds?: string[];
};

export type FinancialSnapshotBuildResult = {
  snapshot: FinancialSnapshot;
  warnings: SnapshotWarning[];
  missingMappings: string[];
  missingData: string[];
  provenance: {
    checkingBalance: SnapshotMetricProvenance;
    liquidCash: SnapshotMetricProvenance;
    nearTermRequiredCash: SnapshotMetricProvenance;
    emergencySavings: SnapshotMetricProvenance;
    monthlyEssentialSpend: SnapshotMetricProvenance;
    monthlyNetIncome: SnapshotMetricProvenance;
    debts: SnapshotMetricProvenance;
    goals: SnapshotMetricProvenance;
  };
};

export type SnapshotDebtMapping = {
  aprBasisPoints: number;
  name?: string;
};

export type FinancialSnapshotAdapterConfig = {
  asOfDate?: string;
  includeOffBudgetAccounts?: boolean;
  includeClosedAccounts?: boolean;
  checkingAccountIds?: string[];
  liquidAccountIds?: string[];
  emergencyFundAccountIds?: string[];
  essentialCategoryIds?: string[];
  nearTermHorizonDays?: number;
  lookbackMonths?: number;
  debtAccountMappings?: Record<string, SnapshotDebtMapping>;
  goals?: GoalPosition[];
};

const DEFAULT_NEAR_TERM_HORIZON_DAYS = 30;
const DEFAULT_LOOKBACK_MONTHS = 3;

function assertSafeIntegerAmount(value: number, fieldName: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${fieldName} must be a safe integer minor-unit amount; received ${value}`,
    );
  }

  return value;
}

function hasLiquidLikeStructuredMetadata(account: {
  type?: string | null;
  subtype?: string | null;
}) {
  const type = (account.type ?? '').toLowerCase();
  const subtype = (account.subtype ?? '').toLowerCase();
  return (
    subtype === 'checking' ||
    subtype === 'savings' ||
    subtype === 'cash' ||
    type === 'depository' ||
    type === 'cash'
  );
}

function hasCheckingLikeStructuredMetadata(account: {
  type?: string | null;
  subtype?: string | null;
}) {
  const type = (account.type ?? '').toLowerCase();
  const subtype = (account.subtype ?? '').toLowerCase();
  return subtype === 'checking' || type === 'checking';
}

function dedupeIds(ids: string[] | undefined): string[] {
  return [...new Set(ids ?? [])];
}

function getLookbackWindow({
  asOfDate,
  lookbackMonths,
}: {
  asOfDate: string;
  lookbackMonths: number;
}) {
  const latestDate = asOfDate;
  const earliestMonth = monthUtils.subMonths(
    asOfDate,
    Math.max(lookbackMonths - 1, 0),
  );

  return {
    earliestDate: monthUtils.firstDayOfMonth(earliestMonth),
    latestDate,
    monthCount: lookbackMonths,
  };
}

function sumAccountBalances(
  accountsById: Map<string, AccountWithComputedBalance>,
  accountIds: string[],
  fieldName: string,
) {
  return accountIds.reduce((total, accountId) => {
    const account = accountsById.get(accountId);
    if (!account) {
      return total;
    }

    return (
      total +
      assertSafeIntegerAmount(
        account.balance_current ?? 0,
        `${fieldName}[${accountId}]`,
      )
    );
  }, 0);
}

async function getScheduleOutflowByHorizon({
  startDate,
  horizonDays,
  liquidOrCheckingAccountIds,
}: {
  startDate: string;
  horizonDays: number;
  liquidOrCheckingAccountIds: Set<string>;
}) {
  const schedules = await getNormalizedSchedules();
  const endDate = monthUtils.parseDate(
    monthUtils.addDays(startDate, horizonDays),
  );

  const scheduleIds = new Set<string>();
  let nearTermRequiredCash = 0;

  for (const schedule of schedules) {
    const relevantAccount =
      liquidOrCheckingAccountIds.has(schedule._account) ||
      schedule._account === FORECAST_UNASSIGNED_ACCOUNT_ID;

    if (!relevantAccount) {
      continue;
    }

    const occurrences = getFutureOccurrenceDates(schedule, endDate);

    for (const date of occurrences) {
      if (date < startDate) {
        continue;
      }

      if (schedule._amount >= 0) {
        continue;
      }

      nearTermRequiredCash += -assertSafeIntegerAmount(
        schedule._amount,
        `schedule(${schedule.id}).amount`,
      );
      scheduleIds.add(schedule.id);
    }
  }

  return {
    nearTermRequiredCash,
    scheduleIds: [...scheduleIds].sort(),
  };
}

export async function buildFinancialSnapshot(
  config: FinancialSnapshotAdapterConfig = {},
): Promise<FinancialSnapshotBuildResult> {
  const asOfDate = config.asOfDate ?? monthUtils.currentDay();
  const includeOffBudgetAccounts = config.includeOffBudgetAccounts ?? false;
  const includeClosedAccounts = config.includeClosedAccounts ?? false;
  const nearTermHorizonDays =
    config.nearTermHorizonDays ?? DEFAULT_NEAR_TERM_HORIZON_DAYS;
  const lookbackMonths = config.lookbackMonths ?? DEFAULT_LOOKBACK_MONTHS;

  if (!monthUtils.isValidYearMonthDay(asOfDate)) {
    throw new Error(`Invalid asOfDate: ${asOfDate}`);
  }

  if (!Number.isSafeInteger(nearTermHorizonDays) || nearTermHorizonDays < 0) {
    throw new Error('nearTermHorizonDays must be a non-negative safe integer');
  }

  if (!Number.isSafeInteger(lookbackMonths) || lookbackMonths <= 0) {
    throw new Error('lookbackMonths must be a positive safe integer');
  }

  const warnings: SnapshotWarning[] = [];
  const missingMappings: string[] = [];
  const missingData: string[] = [];

  const allAccounts = await db.getAccounts();
  const eligibleAccounts = allAccounts.filter(
    account =>
      (includeOffBudgetAccounts || account.offbudget === 0) &&
      (includeClosedAccounts || account.closed === 0),
  );

  const eligibleAccountIds = eligibleAccounts.map(account => account.id);
  const accountsWithBalances =
    await getAccountsWithComputedBalance(eligibleAccountIds);
  const accountsById = new Map(
    accountsWithBalances.map(account => [account.id, account]),
  );
  const eligibleAccountsById = new Map(
    eligibleAccounts.map(account => [account.id, account]),
  );

  const defaultCheckingIds = eligibleAccounts
    .filter(hasCheckingLikeStructuredMetadata)
    .map(account => account.id);
  const checkingAccountIds =
    config.checkingAccountIds == null
      ? defaultCheckingIds
      : dedupeIds(config.checkingAccountIds).filter(accountId =>
          accountsById.has(accountId),
        );

  const defaultLiquidIds = eligibleAccounts
    .filter(hasLiquidLikeStructuredMetadata)
    .map(account => account.id);
  const liquidAccountIds =
    config.liquidAccountIds == null
      ? defaultLiquidIds
      : dedupeIds(config.liquidAccountIds).filter(accountId =>
          accountsById.has(accountId),
        );

  if (checkingAccountIds.length === 0) {
    warnings.push({
      code: 'NO_ELIGIBLE_CHECKING_ACCOUNTS',
      message:
        'No checking accounts were mapped; checking balance is set to 0 until account mapping is configured.',
    });
    missingMappings.push('checkingAccountIds');
  }

  if (liquidAccountIds.length === 0) {
    warnings.push({
      code: 'NO_ELIGIBLE_LIQUID_ACCOUNTS',
      message:
        'No liquid accounts were mapped; liquid cash is set to 0 until account mapping is configured.',
    });
    missingMappings.push('liquidAccountIds');
  }

  const checkingBalance = sumAccountBalances(
    accountsById,
    checkingAccountIds,
    'checkingBalance',
  );
  const liquidCash = sumAccountBalances(
    accountsById,
    liquidAccountIds,
    'liquidCash',
  );

  const liquidOrCheckingAccountIds = new Set([
    ...checkingAccountIds,
    ...liquidAccountIds,
  ]);

  const { nearTermRequiredCash, scheduleIds } =
    await getScheduleOutflowByHorizon({
      startDate: asOfDate,
      horizonDays: nearTermHorizonDays,
      liquidOrCheckingAccountIds,
    });

  const emergencyFundAccountIds = dedupeIds(
    config.emergencyFundAccountIds,
  ).filter(accountId => accountsById.has(accountId));
  const emergencySavings = sumAccountBalances(
    accountsById,
    emergencyFundAccountIds,
    'emergencySavings',
  );

  if (emergencyFundAccountIds.length === 0) {
    warnings.push({
      code: 'MISSING_EMERGENCY_FUND_MAPPING',
      message:
        'Emergency savings mapping is missing or invalid; emergencySavings is set to 0 until emergencyFundAccountIds resolve to eligible accounts.',
    });
    missingMappings.push('emergencyFundAccountIds');
  }

  const { earliestDate, latestDate, monthCount } = getLookbackWindow({
    asOfDate,
    lookbackMonths,
  });

  const categories = await db.getCategories();
  const categoryIsIncomeById = new Map(
    categories.map(category => [category.id, category.is_income === 1]),
  );
  const validCategoryIds = new Set(categories.map(category => category.id));

  let monthlyEssentialSpend = 0;
  const essentialCategoryIds = dedupeIds(config.essentialCategoryIds).filter(
    categoryId => validCategoryIds.has(categoryId),
  );
  if (essentialCategoryIds.length === 0) {
    warnings.push({
      code: 'MISSING_ESSENTIAL_CATEGORY_MAPPING',
      message:
        'Essential spend mapping is missing or invalid; monthlyEssentialSpend is set to 0 until essentialCategoryIds resolve to existing categories.',
    });
    missingMappings.push('essentialCategoryIds');
  } else {
    const { data } = await aqlQuery(
      q('transactions')
        .filter({
          tombstone: false,
          date: { $gte: earliestDate, $lte: latestDate },
          'account.id': { $oneof: eligibleAccountIds },
          'category.id': { $oneof: essentialCategoryIds },
        })
        .select(['amount', 'date']),
    );

    const totalEssentialOutflow = (
      data as Array<{ amount: number; date: string }>
    )
      .filter(tx => tx.amount < 0)
      .reduce(
        (sum, tx) =>
          sum +
          -assertSafeIntegerAmount(tx.amount, 'monthlyEssentialSpend.amount'),
        0,
      );

    monthlyEssentialSpend = Math.round(totalEssentialOutflow / monthCount);
  }

  const { data: recentTransactions } = await aqlQuery(
    q('transactions')
      .filter({
        tombstone: false,
        date: { $gte: earliestDate, $lte: latestDate },
        'account.id': { $oneof: eligibleAccountIds },
      })
      .select(['amount', 'date', 'category']),
  );

  let totalIncome = 0;
  let totalExpense = 0;
  let hasCategorizedIncomeOrExpenseHistory = false;

  for (const tx of recentTransactions as Array<{
    amount: number;
    date: string;
    category: string | null;
  }>) {
    if (!tx.category) {
      continue;
    }

    const isIncomeCategory = categoryIsIncomeById.get(tx.category);
    if (isIncomeCategory == null) {
      continue;
    }

    const amount = assertSafeIntegerAmount(
      tx.amount,
      'monthlyNetIncome.amount',
    );
    hasCategorizedIncomeOrExpenseHistory = true;

    if (isIncomeCategory) {
      totalIncome += amount;
    } else if (amount < 0) {
      totalExpense += -amount;
    }
  }

  if (!hasCategorizedIncomeOrExpenseHistory) {
    warnings.push({
      code: 'INCOME_OR_EXPENSE_HISTORY_EMPTY',
      message:
        'No categorized income/expense history found in the lookback window; monthlyNetIncome is set to 0.',
    });
    missingData.push('monthlyNetIncomeHistory');
  }

  const monthlyNetIncome = !hasCategorizedIncomeOrExpenseHistory
    ? 0
    : Math.round((totalIncome - totalExpense) / monthCount);

  const debts = [] as FinancialSnapshot['debts'];
  const debtMappings = config.debtAccountMappings ?? {};
  for (const accountId of Object.keys(debtMappings)) {
    const account = eligibleAccountsById.get(accountId);
    if (!account) {
      continue;
    }

    const balance = accountsById.get(account.id)?.balance_current ?? 0;
    const normalizedDebtBalance =
      balance < 0
        ? -assertSafeIntegerAmount(balance, `debt(${account.id}).balance`)
        : 0;

    if (normalizedDebtBalance <= 0) {
      continue;
    }

    const mapping = debtMappings[account.id];
    const aprBasisPoints = assertSafeIntegerAmount(
      mapping.aprBasisPoints,
      `debt(${account.id}).aprBasisPoints`,
    );
    if (aprBasisPoints < 0) {
      throw new Error(
        `debt(${account.id}).aprBasisPoints must be a non-negative safe integer`,
      );
    }

    debts.push({
      id: account.id,
      name: mapping.name ?? account.name,
      balance: normalizedDebtBalance,
      aprBasisPoints,
    });
  }

  const goals = [...(config.goals ?? [])];

  const result = {
    snapshot: {
      checkingBalance,
      liquidCash,
      nearTermRequiredCash,
      emergencySavings,
      monthlyEssentialSpend,
      monthlyNetIncome,
      debts: debts.sort((left, right) => left.id.localeCompare(right.id)),
      goals,
    } satisfies FinancialSnapshot,
    warnings,
    missingMappings: [...new Set(missingMappings)].sort(),
    missingData: [...new Set(missingData)].sort(),
    provenance: {
      checkingBalance: {
        source: 'accounts',
        rule: 'sum(balance_current) over configured or structured-metadata-selected checking accounts',
        accountIds: [...checkingAccountIds].sort(),
      },
      liquidCash: {
        source: 'accounts',
        rule: 'sum(balance_current) over configured or structured-metadata-selected liquid accounts',
        accountIds: [...liquidAccountIds].sort(),
      },
      nearTermRequiredCash: {
        source: 'schedules',
        rule: `sum(abs(schedule amount)) for negative schedule occurrences between ${asOfDate} and ${monthUtils.addDays(asOfDate, nearTermHorizonDays)}`,
        accountIds: [...liquidOrCheckingAccountIds].sort(),
        scheduleIds,
      },
      emergencySavings: {
        source: 'accounts',
        rule: 'sum(balance_current) over explicitly mapped emergency fund accounts',
        accountIds: [...emergencyFundAccountIds].sort(),
      },
      monthlyEssentialSpend: {
        source: 'transactions',
        rule: `average monthly outflow over configured essential categories in lookback window ${earliestDate}..${latestDate}`,
        categoryIds: [...essentialCategoryIds].sort(),
      },
      monthlyNetIncome: {
        source: 'transactions',
        rule: `average monthly (income-category inflow - expense-category outflow) in lookback window ${earliestDate}..${latestDate}`,
        categoryIds: [...categoryIsIncomeById.keys()].sort(),
      },
      debts: {
        source: 'accounts',
        rule: 'explicitly mapped debt account with negative balance plus explicit APR mapping',
        accountIds: debts.map(debt => debt.id).sort(),
      },
      goals: {
        source: 'config',
        rule: 'goals are accepted only from explicit adapter configuration',
      },
    },
  } satisfies FinancialSnapshotBuildResult;

  return result;
}
