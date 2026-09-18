import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { SharedExpenseTrace } from '../database/sharedExpenses';
import { getExpenseTraceByOriginId } from '../database/sharedExpenses';
import { formatCents } from '../utils/currency';
import { useAppTheme } from '../theme';

interface SharedExpenseTraceLabelProps {
  originId: string | null;
  symbol: string;
  fallback: string;
}

export function SharedExpenseTraceLabel({
  originId,
  symbol,
  fallback,
}: SharedExpenseTraceLabelProps) {
  const theme = useAppTheme();
  const [trace, setTrace] = useState<SharedExpenseTrace | null>(null);

  useEffect(() => {
    if (!originId) {
      return;
    }
    let active = true;
    getExpenseTraceByOriginId(originId).then((result) => {
      if (active) {
        setTrace(result);
      }
    });
    return () => {
      active = false;
    };
  }, [originId]);

  if (!trace) {
    return (
      <Text variant="bodySmall" style={[styles.line, { color: theme.text.secondary }]}>
        {fallback}
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text variant="bodySmall" style={[styles.line, { color: theme.text.secondary }]}>
        {`Shared expense · ${trace.spaceName}`}
      </Text>
      <Text variant="labelSmall" style={[styles.line, styles.sub, { color: theme.text.secondary }]}>
        {`paid by ${trace.paidByName} · total ${formatCents(trace.totalAmountCents, symbol)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  line: {
    opacity: 0.9,
  },
  sub: {
    opacity: 0.6,
    marginTop: 1,
  },
});