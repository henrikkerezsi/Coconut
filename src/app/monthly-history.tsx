import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { Card, List, Text } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAppData } from '../data/DataProvider';
import type { ClosedMonthRecord } from '../database/queries';
import { getClosedMonthRecords } from '../database/queries';
import { formatCents } from '../utils/currency';
import { shortMonthLabel } from '../utils/date';
import { LoadingScreen } from '../components/loading-screen';
import { useAppTheme } from '../theme';

export default function MonthlyHistoryScreen() {
  const { ready, settings } = useAppData();
  const theme = useAppTheme();
  const router = useRouter();
  const [records, setRecords] = useState<ClosedMonthRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) {
        return;
      }
      getClosedMonthRecords().then(setRecords);
    }, [ready])
  );

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      {records.length === 0 ? (
        <Text variant="bodyMedium" style={styles.empty}>
          Close a month to generate its report here.
        </Text>
      ) : (
        records
          .slice()
          .reverse()
          .map((record) => {
            const saved = record.reserveAdjustmentCents > 0;
            return (
              <Card key={record.monthKey} mode="elevated" style={styles.card}>
                <List.Item
                  title={shortMonthLabel(record.monthKey)}
                  description={`Spent ${formatCents(record.spendingCents, symbol)}`}
                  left={(props) => <List.Icon {...props} icon="file-chart-outline" />}
                  right={() => (
                    <View style={styles.right}>
                      <Text
                        variant="bodyMedium"
                        style={{
                          color: saved ? theme.semantic.goodBudget : theme.colors.onSurface,
                        }}
                      >
                        {record.reserveAdjustmentCents >= 0 ? '+' : ''}
                        {formatCents(record.reserveAdjustmentCents, symbol)}
                      </Text>
                      <Text variant="labelSmall" style={styles.rightHint}>
                        reserve
                      </Text>
                    </View>
                  )}
                  onPress={() =>
                    router.push({
                      pathname: '/monthly-report/[monthKey]',
                      params: { monthKey: record.monthKey },
                    })
                  }
                />
              </Card>
            );
          })
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 12,
  },
  empty: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  right: {
    alignItems: 'flex-end',
  },
  rightHint: {
    opacity: 0.6,
    marginTop: 2,
  },
});