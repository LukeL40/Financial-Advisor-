import React from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { Card } from '@actual-app/components/card';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { integerToCurrency } from '@actual-app/core/shared/util';

import { FinancialText } from '#components/FinancialText';

type MetricCardProps = {
  label: string;
  amountMinorUnits: number;
  subtitle?: string;
  amountStyle?: CSSProperties;
};

export function MetricCard({
  label,
  amountMinorUnits,
  subtitle,
  amountStyle,
}: MetricCardProps) {
  return (
    <Card
      style={{
        flex: 1,
        minWidth: 160,
        padding: '16px 20px',
        margin: 0,
      }}
    >
      <View style={{ gap: 6 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: theme.pageTextLight,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </Text>
        <FinancialText
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: theme.pageText,
            ...amountStyle,
          }}
        >
          {integerToCurrency(amountMinorUnits)}
        </FinancialText>
        {subtitle && (
          <Text style={{ fontSize: 12, color: theme.pageTextLight }}>
            {subtitle}
          </Text>
        )}
      </View>
    </Card>
  );
}

type MetricCardGridProps = {
  children: ReactNode;
};

export function MetricCardGrid({ children }: MetricCardGridProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
      }}
    >
      {children}
    </View>
  );
}
