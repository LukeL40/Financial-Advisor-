import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { FinancialSnapshotBuildResult } from '@actual-app/core/server/financial-brain/snapshot';
import type {
  AllocationResult,
  FinancialPolicy,
  FinancialSnapshot,
} from '@actual-app/core/server/financial-brain/types';
import { currencyToInteger } from '@actual-app/core/shared/util';

import { Page } from '#components/Page';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';

import { MetricCard, MetricCardGrid } from './MetricCard';
import { RecommendationList } from './RecommendationList';
import { WarningBanner } from './WarningBanner';

const DEFAULT_POLICY: FinancialPolicy = {
  minimumCheckingBuffer: 100000,
  emergencyFundTargetMonths: 3,
  highInterestDebtAprThresholdBasisPoints: 1000,
  targetMonthlyInvestingAmount: 0,
};

function totalDebtBalance(snapshot: FinancialSnapshot): number {
  return snapshot.debts.reduce((sum, d) => sum + d.balance, 0);
}

function monthlySurplus(snapshot: FinancialSnapshot): number {
  return snapshot.monthlyNetIncome - snapshot.monthlyEssentialSpend;
}

export function FinancialBrainPage() {
  const { t } = useTranslation();

  const [buildResult, setBuildResult] =
    useState<FinancialSnapshotBuildResult | null>(null);
  const [allocResult, setAllocResult] = useState<AllocationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployableInput, setDeployableInput] = useState('');

  async function loadSnapshot() {
    setLoading(true);
    setError(null);
    setAllocResult(null);
    try {
      const result = await send('financial-brain-build-snapshot', {});
      setBuildResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runAllocator() {
    if (!buildResult) return;
    const rawAmount = currencyToInteger(deployableInput) ?? 0;
    const deployableAmount = Math.max(0, rawAmount);
    setAllocating(true);
    setError(null);
    try {
      const result = await send('financial-brain-allocate', {
        snapshot: buildResult.snapshot,
        policy: DEFAULT_POLICY,
        deployableAmount,
      });
      setAllocResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAllocating(false);
    }
  }

  const snapshot = buildResult?.snapshot ?? null;

  return (
    <Page header={t('Financial Brain')}>
      <View style={{ padding: '8px 0 24px' }}>
        {/* Controls row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
          }}
        >
          <Button variant="primary" onPress={loadSnapshot} isDisabled={loading}>
            {loading ? t('Loading…') : t('Refresh Snapshot')}
          </Button>
          {buildResult && (
            <Text style={{ fontSize: 12, color: theme.pageTextLight }}>
              {buildResult.warnings.length === 0
                ? t('Snapshot loaded')
                : t('Snapshot loaded with warnings')}
            </Text>
          )}
        </View>

        {/* Loading state */}
        {loading && <LoadingIndicator />}

        {/* Error state */}
        {error && !loading && (
          <View
            style={{
              backgroundColor: theme.errorBackground,
              borderColor: theme.errorBorder,
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 6,
              padding: '12px 16px',
              marginBottom: 24,
            }}
          >
            <Text style={{ color: theme.errorText, fontSize: 13 }}>
              <Trans>Error</Trans>: {error}
            </Text>
          </View>
        )}

        {/* Snapshot loaded */}
        {snapshot && !loading && (
          <>
            {/* Warnings */}
            <WarningBanner warnings={buildResult?.warnings ?? []} />

            {/* Metric cards */}
            <MetricCardGrid>
              <MetricCard
                label={t('Liquid Cash')}
                amountMinorUnits={snapshot.liquidCash}
                subtitle={t('Available liquid accounts')}
              />
              <MetricCard
                label={t('Monthly Surplus')}
                amountMinorUnits={monthlySurplus(snapshot)}
                subtitle={t('Income minus essential spend')}
                amountStyle={{
                  color:
                    monthlySurplus(snapshot) >= 0
                      ? theme.noticeText
                      : theme.errorText,
                }}
              />
              <MetricCard
                label={t('Debt Exposure')}
                amountMinorUnits={totalDebtBalance(snapshot)}
                subtitle={t('Tracked debt balances')}
                amountStyle={{
                  color:
                    totalDebtBalance(snapshot) > 0
                      ? theme.errorText
                      : theme.pageText,
                }}
              />
              <MetricCard
                label={t('Emergency Reserve')}
                amountMinorUnits={snapshot.emergencySavings}
                subtitle={t('Mapped emergency fund accounts')}
              />
            </MetricCardGrid>

            {/* Next-dollar allocation */}
            <View
              style={{
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
                borderWidth: 1,
                borderStyle: 'solid',
                borderRadius: 6,
                padding: '16px 20px',
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.pageText,
                  marginBottom: 12,
                }}
              >
                {t('Next-Dollar Recommendations')}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 13, color: theme.pageTextLight }}>
                  {t('Deployable amount ($):')}
                </Text>
                <Input
                  value={deployableInput}
                  onChange={e => setDeployableInput(e.target.value)}
                  placeholder="0.00"
                  style={{ width: 120 }}
                />
                <Button
                  variant="normal"
                  onPress={runAllocator}
                  isDisabled={allocating}
                >
                  {allocating ? t('Running…') : t('Run')}
                </Button>
              </View>

              {allocResult && (
                <RecommendationList
                  recommendations={allocResult.recommendations}
                  warnings={allocResult.warnings}
                />
              )}
            </View>
          </>
        )}

        {/* Empty state */}
        {!snapshot && !loading && !error && (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 60,
              gap: 12,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: theme.pageTextLight,
              }}
            >
              {t('Financial Brain')}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.pageTextLight,
                textAlign: 'center',
                maxWidth: 400,
              }}
            >
              {t(
                'Click "Refresh Snapshot" to load your current financial position from Actual data. Account mappings can be configured in a future release.',
              )}
            </Text>
          </View>
        )}
      </View>
    </Page>
  );
}
