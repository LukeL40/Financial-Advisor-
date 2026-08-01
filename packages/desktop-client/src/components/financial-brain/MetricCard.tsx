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
  amountMinorUnits?: number;
  subtitle?: string;
  amountStyle?: CSSProperties;
  /** When true the metric value is unknown; renders "—" instead of a dollar amount. */
  unavailable?: boolean;
  /** Tooltip shown beneath the label when unavailable is true. */
  unavailableReason?: string;
};

export function MetricCard({
  label,
  amountMinorUnits = 0,
  subtitle,
  amountStyle,
  unavailable,
  unavailableReason,
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
        {unavailable ? (
          <>
            <Text
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: theme.pageTextSubdued,
              }}
            >
              —
            </Text>
            {unavailableReason && (
              <Text style={{ fontSize: 12, color: theme.warningText }}>
                {unavailableReason}
              </Text>
            )}
          </>
        ) : (
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
        )}
        {subtitle && !unavailable && (
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
