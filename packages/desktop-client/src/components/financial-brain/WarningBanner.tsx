import React from 'react';
import { Trans } from 'react-i18next';

import { SvgExclamationSolid } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { SnapshotWarning } from '@actual-app/core/server/financial-brain/snapshot';

type WarningBannerProps = {
  warnings: SnapshotWarning[];
};

export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: theme.warningBackground,
        borderColor: theme.warningBorder,
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 6,
        padding: '12px 16px',
        marginBottom: 24,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <SvgExclamationSolid
          width={16}
          height={16}
          style={{ color: theme.warningText, flexShrink: 0 }}
        />
        <Text
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.warningText,
          }}
        >
          <Trans>Missing data — some values may be zero</Trans>
        </Text>
      </View>
      {warnings.map(warning => (
        <Text
          key={warning.code}
          style={{
            fontSize: 12,
            color: theme.warningText,
            paddingLeft: 24,
          }}
        >
          {warning.message}
        </Text>
      ))}
    </View>
  );
}
