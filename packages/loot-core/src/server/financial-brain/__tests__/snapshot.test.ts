import { beforeEach, describe, expect, it } from 'vitest';

import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { buildFinancialSnapshot } from '#server/financial-brain/snapshot';
import { createSchedule } from '#server/schedules/app';
import { loadRules } from '#server/transactions/transaction-rules';
import type { RuleConditionEntity } from '#types/models';

const { emptyDatabase } = global as typeof globalThis & {
  emptyDatabase: () => () => Promise<void>;
};

async function createCategoryFixture() {
  const incomeGroupId = await db.insertCategoryGroup({
    id: 'income-group',
    name: 'Income',
    is_income: 1,
  });
  const expenseGroupId = await db.insertCategoryGroup({
    id: 'expense-group',
    name: 'Expenses',
    is_income: 0,
  });

  const salaryCategoryId = await db.insertCategory({
    id: 'salary',
    name: 'Salary',
    cat_group: incomeGroupId,
    is_income: 1,
  });
  const groceriesCategoryId = await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: expenseGroupId,
    is_income: 0,
  });
  const diningCategoryId = await db.insertCategory({
    id: 'dining',
    name: 'Dining',
    cat_group: expenseGroupId,
    is_income: 0,
  });

  return {
    salaryCategoryId,
    groceriesCategoryId,
    diningCategoryId,
  };
}

async function insertAccountWithTransaction({
  id,
  name,
  amount,
  date = '2024-01-01',
  offbudget = 0,
  closed = 0,
  type,
  subtype,
}: {
  id: string;
  name: string;
  amount: number;
  date?: string;
  offbudget?: 0 | 1;
  closed?: 0 | 1;
  type?: string;
  subtype?: string;
}) {
  await db.insertAccount({
    id,
    name,
    offbudget,
    closed,
    ...(type ? { type } : {}),
    ...(subtype ? { subtype } : {}),
  });

  await db.insertTransaction({
    id: `txn-${id}`,
    account: id,
    amount,
    date,
  });
}

beforeEach(async () => {
  await emptyDatabase()();
  await loadMappings();
  await loadRules();
});

describe('buildFinancialSnapshot', () => {
  it('aggregates across multiple configured eligible cash accounts without double counting deployable cash', async () => {
    await insertAccountWithTransaction({
      id: 'checking-a',
      name: 'Checking A',
      amount: 10_000,
      type: 'depository',
      subtype: 'checking',
    });
    await insertAccountWithTransaction({
      id: 'checking-b',
      name: 'Checking B',
      amount: 5_000,
      type: 'depository',
      subtype: 'checking',
    });
    await insertAccountWithTransaction({
      id: 'savings-a',
      name: 'Savings A',
      amount: 7_000,
      type: 'depository',
      subtype: 'savings',
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      checkingAccountIds: ['checking-a', 'checking-b'],
      liquidAccountIds: ['checking-a', 'checking-b', 'savings-a'],
      emergencyFundAccountIds: ['savings-a'],
      essentialCategoryIds: ['missing-category'],
      lookbackMonths: 1,
    });

    expect(result.snapshot.checkingBalance).toBe(15_000);
    expect(result.snapshot.liquidCash).toBe(22_000);
    expect(result.snapshot.emergencySavings).toBe(7_000);
  });

  it('excludes off-budget and closed accounts by default', async () => {
    await insertAccountWithTransaction({
      id: 'included-checking',
      name: 'Included Checking',
      amount: 3_000,
      type: 'checking',
    });
    await insertAccountWithTransaction({
      id: 'offbudget-checking',
      name: 'Offbudget Checking',
      amount: 8_000,
      type: 'checking',
      offbudget: 1,
    });
    await insertAccountWithTransaction({
      id: 'closed-checking',
      name: 'Closed Checking',
      amount: 9_000,
      type: 'checking',
      closed: 1,
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      checkingAccountIds: [
        'included-checking',
        'offbudget-checking',
        'closed-checking',
      ],
      liquidAccountIds: [
        'included-checking',
        'offbudget-checking',
        'closed-checking',
      ],
      emergencyFundAccountIds: [],
      lookbackMonths: 1,
    });

    expect(result.snapshot.checkingBalance).toBe(3_000);
    expect(result.snapshot.liquidCash).toBe(3_000);
  });

  it('preserves integer minor-unit semantics when aggregating balances', async () => {
    await insertAccountWithTransaction({
      id: 'checking',
      name: 'Checking',
      amount: 101,
      type: 'checking',
    });

    await db.insertTransaction({
      id: 'second-amount',
      account: 'checking',
      amount: 202,
      date: '2024-01-02',
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      checkingAccountIds: ['checking'],
      liquidAccountIds: ['checking'],
      emergencyFundAccountIds: ['checking'],
      lookbackMonths: 1,
      essentialCategoryIds: ['missing-category'],
    });

    expect(result.snapshot.checkingBalance).toBe(303);
    expect(result.snapshot.liquidCash).toBe(303);
  });

  it('extracts and normalizes debt balances using explicit APR mappings', async () => {
    await insertAccountWithTransaction({
      id: 'credit-card',
      name: 'Credit Card',
      amount: -12_345,
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      lookbackMonths: 1,
      debtAccountMappings: {
        'credit-card': {
          aprBasisPoints: 1_999,
        },
      },
    });

    expect(result.snapshot.debts).toEqual([
      {
        id: 'credit-card',
        name: 'Credit Card',
        balance: 12_345,
        aprBasisPoints: 1_999,
      },
    ]);
  });

  it('does not classify checking or liquid accounts from ambiguous names alone', async () => {
    await insertAccountWithTransaction({
      id: 'vacation-savings-card',
      name: 'Vacation Savings Card',
      amount: 9_000,
    });
    await insertAccountWithTransaction({
      id: 'loan-payment-checking',
      name: 'Loan Payment Checking',
      amount: 5_000,
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      lookbackMonths: 1,
      emergencyFundAccountIds: ['vacation-savings-card'],
      essentialCategoryIds: ['missing-category'],
    });

    expect(result.snapshot.checkingBalance).toBe(0);
    expect(result.snapshot.liquidCash).toBe(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NO_ELIGIBLE_CHECKING_ACCOUNTS' }),
        expect.objectContaining({ code: 'NO_ELIGIBLE_LIQUID_ACCOUNTS' }),
      ]),
    );
  });

  it('does not fabricate emergency savings when mapping is missing', async () => {
    await insertAccountWithTransaction({
      id: 'savings',
      name: 'Savings',
      amount: 40_000,
      type: 'savings',
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      checkingAccountIds: ['savings'],
      liquidAccountIds: ['savings'],
      lookbackMonths: 1,
    });

    expect(result.snapshot.emergencySavings).toBe(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_EMERGENCY_FUND_MAPPING' }),
      ]),
    );
    expect(result.missingMappings).toContain('emergencyFundAccountIds');
  });

  it('marks emergency savings as missing when all configured account mappings are invalid', async () => {
    await insertAccountWithTransaction({
      id: 'checking',
      name: 'Checking',
      amount: 40_000,
      type: 'checking',
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      checkingAccountIds: ['checking'],
      liquidAccountIds: ['checking'],
      emergencyFundAccountIds: ['not-a-real-account-id'],
      lookbackMonths: 1,
      essentialCategoryIds: ['missing-category'],
    });

    expect(result.snapshot.emergencySavings).toBe(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_EMERGENCY_FUND_MAPPING' }),
      ]),
    );
    expect(result.missingMappings).toContain('emergencyFundAccountIds');
  });

  it('derives monthly essential spend from configured categories', async () => {
    const { groceriesCategoryId, diningCategoryId } =
      await createCategoryFixture();

    await insertAccountWithTransaction({
      id: 'checking',
      name: 'Checking',
      amount: 0,
      type: 'checking',
    });

    await db.insertTransaction({
      id: 'essential-jan',
      account: 'checking',
      category: groceriesCategoryId,
      amount: -1_000,
      date: '2024-01-05',
    });
    await db.insertTransaction({
      id: 'essential-feb',
      account: 'checking',
      category: groceriesCategoryId,
      amount: -3_000,
      date: '2024-02-05',
    });
    await db.insertTransaction({
      id: 'non-essential-feb',
      account: 'checking',
      category: diningCategoryId,
      amount: -5_000,
      date: '2024-02-10',
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-02-28',
      lookbackMonths: 2,
      checkingAccountIds: ['checking'],
      liquidAccountIds: ['checking'],
      emergencyFundAccountIds: ['checking'],
      essentialCategoryIds: [groceriesCategoryId],
    });

    expect(result.snapshot.monthlyEssentialSpend).toBe(2_000);
  });

  it('marks essential spend as missing configuration when category mapping is absent', async () => {
    await insertAccountWithTransaction({
      id: 'checking',
      name: 'Checking',
      amount: 0,
      type: 'checking',
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      checkingAccountIds: ['checking'],
      liquidAccountIds: ['checking'],
      emergencyFundAccountIds: ['checking'],
      lookbackMonths: 1,
    });

    expect(result.snapshot.monthlyEssentialSpend).toBe(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_ESSENTIAL_CATEGORY_MAPPING' }),
      ]),
    );
    expect(result.missingMappings).toContain('essentialCategoryIds');
  });

  it('marks essential spend as missing configuration when configured category mappings are all invalid', async () => {
    await insertAccountWithTransaction({
      id: 'checking',
      name: 'Checking',
      amount: 0,
      type: 'checking',
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      checkingAccountIds: ['checking'],
      liquidAccountIds: ['checking'],
      emergencyFundAccountIds: ['checking'],
      lookbackMonths: 1,
      essentialCategoryIds: ['not-a-real-category-id'],
    });

    expect(result.snapshot.monthlyEssentialSpend).toBe(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_ESSENTIAL_CATEGORY_MAPPING' }),
      ]),
    );
    expect(result.missingMappings).toContain('essentialCategoryIds');
  });

  it('derives monthly net income from categorized income and expense history', async () => {
    const { salaryCategoryId, groceriesCategoryId } =
      await createCategoryFixture();

    await insertAccountWithTransaction({
      id: 'checking',
      name: 'Checking',
      amount: 0,
      type: 'checking',
    });

    await db.insertTransaction({
      id: 'salary-jan',
      account: 'checking',
      category: salaryCategoryId,
      amount: 10_000,
      date: '2024-01-10',
    });
    await db.insertTransaction({
      id: 'salary-feb',
      account: 'checking',
      category: salaryCategoryId,
      amount: 10_000,
      date: '2024-02-10',
    });
    await db.insertTransaction({
      id: 'expense-jan',
      account: 'checking',
      category: groceriesCategoryId,
      amount: -4_000,
      date: '2024-01-12',
    });
    await db.insertTransaction({
      id: 'expense-feb',
      account: 'checking',
      category: groceriesCategoryId,
      amount: -4_000,
      date: '2024-02-12',
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-02-28',
      lookbackMonths: 2,
      checkingAccountIds: ['checking'],
      liquidAccountIds: ['checking'],
      emergencyFundAccountIds: ['checking'],
      essentialCategoryIds: [groceriesCategoryId],
    });

    expect(result.snapshot.monthlyNetIncome).toBe(6_000);
  });

  it('averages monthly net income across the full lookback window when activity is sparse', async () => {
    const { salaryCategoryId, groceriesCategoryId } =
      await createCategoryFixture();

    await insertAccountWithTransaction({
      id: 'checking',
      name: 'Checking',
      amount: 0,
      type: 'checking',
    });

    await db.insertTransaction({
      id: 'salary-january',
      account: 'checking',
      category: salaryCategoryId,
      amount: 9_000,
      date: '2024-01-10',
    });
    await db.insertTransaction({
      id: 'expense-january',
      account: 'checking',
      category: groceriesCategoryId,
      amount: -3_000,
      date: '2024-01-12',
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-03-31',
      lookbackMonths: 3,
      checkingAccountIds: ['checking'],
      liquidAccountIds: ['checking'],
      emergencyFundAccountIds: ['checking'],
      essentialCategoryIds: [groceriesCategoryId],
    });

    expect(result.snapshot.monthlyNetIncome).toBe(2_000);
  });

  it('rejects negative debt APR mappings', async () => {
    await insertAccountWithTransaction({
      id: 'credit-card',
      name: 'Credit Card',
      amount: -12_345,
    });

    await expect(
      buildFinancialSnapshot({
        asOfDate: '2024-04-01',
        lookbackMonths: 1,
        debtAccountMappings: {
          'credit-card': {
            aprBasisPoints: -1,
          },
        },
      }),
    ).rejects.toThrow(
      'debt(credit-card).aprBasisPoints must be a non-negative safe integer',
    );
  });

  it('derives near-term required cash from upcoming negative schedules', async () => {
    await insertAccountWithTransaction({
      id: 'checking',
      name: 'Checking',
      amount: 5_000,
      type: 'checking',
    });

    await createSchedule({
      conditions: [
        { op: 'is', field: 'account', value: 'checking' },
        { op: 'is', field: 'amount', value: -2_500 },
        {
          op: 'is',
          field: 'date',
          value: {
            start: '2024-04-05',
            frequency: 'monthly',
          },
        },
      ] satisfies RuleConditionEntity[],
    });

    const result = await buildFinancialSnapshot({
      asOfDate: '2024-04-01',
      nearTermHorizonDays: 10,
      checkingAccountIds: ['checking'],
      liquidAccountIds: ['checking'],
      emergencyFundAccountIds: ['checking'],
      lookbackMonths: 1,
      essentialCategoryIds: ['missing-category'],
    });

    expect(result.snapshot.nearTermRequiredCash).toBe(2_500);
  });

  it('is deterministic for identical source data and has no write side effects', async () => {
    const { groceriesCategoryId } = await createCategoryFixture();

    await insertAccountWithTransaction({
      id: 'checking',
      name: 'Checking',
      amount: 1_000,
      type: 'checking',
    });

    await db.insertTransaction({
      id: 'expense',
      account: 'checking',
      category: groceriesCategoryId,
      amount: -500,
      date: '2024-01-02',
    });

    const countRowsBefore = {
      accounts: await db.first<{ count: number }>(
        'SELECT count(*) as count FROM accounts',
      ),
      transactions: await db.first<{ count: number }>(
        'SELECT count(*) as count FROM transactions',
      ),
      schedules: await db.first<{ count: number }>(
        'SELECT count(*) as count FROM schedules',
      ),
      rules: await db.first<{ count: number }>(
        'SELECT count(*) as count FROM rules',
      ),
    };

    const config = {
      asOfDate: '2024-02-01',
      checkingAccountIds: ['checking'],
      liquidAccountIds: ['checking'],
      emergencyFundAccountIds: ['checking'],
      essentialCategoryIds: [groceriesCategoryId],
      lookbackMonths: 1,
    };

    const firstResult = await buildFinancialSnapshot(config);
    const secondResult = await buildFinancialSnapshot(config);

    expect(secondResult).toEqual(firstResult);

    const countRowsAfter = {
      accounts: await db.first<{ count: number }>(
        'SELECT count(*) as count FROM accounts',
      ),
      transactions: await db.first<{ count: number }>(
        'SELECT count(*) as count FROM transactions',
      ),
      schedules: await db.first<{ count: number }>(
        'SELECT count(*) as count FROM schedules',
      ),
      rules: await db.first<{ count: number }>(
        'SELECT count(*) as count FROM rules',
      ),
    };

    expect(countRowsAfter).toEqual(countRowsBefore);
  });
});
