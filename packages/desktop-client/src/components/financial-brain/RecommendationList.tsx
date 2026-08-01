import React from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { AllocationRecommendation } from '@actual-app/core/server/financial-brain/types';
import { integerToCurrency } from '@actual-app/core/shared/util';

import { FinancialText } from '#components/FinancialText';

const ACTION_LABELS: Record<AllocationRecommendation['action'], string> = {
  MAINTAIN_CHECKING_BUFFER: 'Maintain Checking Buffer',
  RESERVE_NEAR_TERM_CASH: 'Reserve Near-Term Cash',
  PAY_HIGH_INTEREST_DEBT: 'Pay High-Interest Debt',
  BUILD_EMERGENCY_FUND: 'Build Emergency Fund',
  FUND_GOAL: 'Fund Goal',
  INVEST: 'Invest',
  UNALLOCATED: 'Unallocated',
};

type RecommendationRowProps = {
  recommendation: AllocationRecommendation;
  index: number;
};

function RecommendationRow({ recommendation, index }: RecommendationRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: '12px 16px',
        borderBottom: `1px solid ${theme.tableBorder}`,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: theme.pageTextSubdued,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: theme.pageBackground,
          }}
        >
          {index + 1}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text
            style={{ fontSize: 14, fontWeight: 600, color: theme.pageText }}
          >
            {ACTION_LABELS[recommendation.action]}
          </Text>
          <FinancialText
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: theme.pageText,
              marginLeft: 16,
            }}
          >
            {integerToCurrency(recommendation.amount)}
          </FinancialText>
        </View>
        <Text style={{ fontSize: 12, color: theme.pageTextLight }}>
          {recommendation.explanation}
        </Text>
        <FinancialText style={{ fontSize: 11, color: theme.pageTextSubdued }}>
          Remaining after:{' '}
          {integerToCurrency(recommendation.remainingDeployableAmount)}
        </FinancialText>
      </View>
    </View>
  );
}

type RecommendationListProps = {
  recommendations: AllocationRecommendation[];
  warnings: string[];
};

export function RecommendationList({
  recommendations,
  warnings,
}: RecommendationListProps) {
  return (
    <View>
      {recommendations.length === 0 ? (
        <View
          style={{
            padding: '24px 16px',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.pageTextLight, fontSize: 14 }}>
            No recommendations — enter a deployable amount above and click Run.
          </Text>
        </View>
      ) : (
        recommendations.map((rec, i) => (
          <RecommendationRow key={i} recommendation={rec} index={i} />
        ))
      )}
      {warnings.length > 0 && (
        <View style={{ padding: '8px 16px' }}>
          {warnings.map((w, i) => (
            <Text key={i} style={{ fontSize: 12, color: theme.warningText }}>
              ⚠ {w}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
