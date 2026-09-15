import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, List, ProgressBar, Text } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import type { ClosedMonthRecord, CategoryPerformance } from '../../database/queries';
import {
  getCategoryPerformance,
  getClosedMonthRecords,
  getAllTimeSpendingByCategory,
} from '../../database/queries';
import {
  averageMonthlySpending,
  averageReserveAdjustment,
  highestMonthlySpending,
} from '../../services/statistics-service';
import { formatCents } from '../../utils/currency';
import { shortMonthLabel } from '../../utils/date';
import { StatCard } from '../../components/stat-card';
import { LoadingScreen } from '../../components/loading-screen';

export default function StatisticsScreen() {
  const { ready, settings, budgets } = useAppData();
  const [records, setRecords] = useState<ClosedMonthRecord[]>([]);
  const [categories, setCategories] = useState<CategoryPerformance[]>([]);
  const [allTimeByCategory, setAllTimeByCategory] = useState<Map<number, number>>(
    new Map()
  );

  useEffect(() => {
    if (!ready) {
      return;
    }
    getClosedMonthRecords().then(setRecords);
    getCategoryPerformance().then(setCategories);
    getAllTimeSpendingByCategory().then(setAllTimeByCategory);
  }, [ready]);

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;
  const average = averageMonthlySpending(records);
  const highest = highestMonthlySpending(records);
  const averageAdjustment = averageReserveAdjustment(records);
  const budgetNames = new Map(budgets.map((budget) => [budget.id, budget.name]));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.statRow}>
        <StatCard
          label="Avg spending / month"
          value={average === null ? '—' : formatCents(average, symbol)}
        />
        <StatCard
          label="Highest month"
          value={highest === null ? '—' : formatCents(highest, symbol)}
        />
      </View>
      <View style={styles.statRow}>
        <StatCard
          label="Avg reserve adjustment"
          value={averageAdjustment === null ? '—' : formatCents(averageAdjustment, symbol)}
          sub={
            averageAdjustment !== null
              ? averageAdjustment < 0
                ? 'Months saved on average'
                : 'Months draw on the reserve on average'
              : null
          }
          tone={averageAdjustment !== null && averageAdjustment <= 0 ? 'good' : 'bad'}
        />
      </View>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Monthly history" />
        <Card.Content>
          {records.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              Close a month to record its history here.
            </Text>
          ) : (
            records
              .slice()
              .reverse()
              .map((record) => (
                <View key={record.monthKey} style={styles.historyRow}>
                  <Text variant="bodyMedium">{shortMonthLabel(record.monthKey)}</Text>
                  <View style={styles.historyRight}>
                    <Text variant="bodyMedium">{formatCents(record.spendingCents, symbol)}</Text>
                    <Text variant="labelSmall" style={styles.historyAdjustment}>
                      {record.reserveAdjustmentCents >= 0 ? '+' : ''}
                      {formatCents(record.reserveAdjustmentCents, symbol)} reserve
                    </Text>
                  </View>
                </View>
              ))
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Spending by category" />
        <Card.Content>
          {allTimeByCategory.size === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              No categorized spending yet.
            </Text>
          ) : (
            [...allTimeByCategory.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([budgetId, total]) => (
                <List.Item
                  key={budgetId}
                  title={budgetNames.get(budgetId) ?? `Budget #${budgetId}`}
                  right={() => <Text variant="bodyLarge">{formatCents(total, symbol)}</Text>}
                />
              ))
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Budget performance (closed months)" />
        <Card.Content>
          {categories.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              No budget data in closed months yet.
            </Text>
          ) : (
            categories.map((category) => {
              const fraction =
                category.plannedCents > 0
                  ? category.spentCents / category.plannedCents
                  : category.spentCents > 0
                    ? 1
                    : 0;
              const over = category.spentCents > category.plannedCents;
              return (
                <View key={category.budgetId} style={styles.budgetRow}>
                  <View style={styles.historyRow}>
                    <Text variant="bodyMedium">{category.name}</Text>
                    <Text variant="bodySmall" style={over ? styles.overText : undefined}>
                      {formatCents(category.spentCents, symbol)} / {formatCents(category.plannedCents, symbol)}
                    </Text>
                  </View>
                  <ProgressBar
                    progress={Math.min(fraction, 1)}
                    color={over ? '#c62828' : undefined}
                    style={styles.progress}
                  />
                </View>
              );
            })
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  card: {
    marginBottom: 12,
  },
  empty: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAdjustment: {
    opacity: 0.6,
  },
  budgetRow: {
    marginVertical: 6,
  },
  progress: {
    marginTop: 4,
    borderRadius: 4,
  },
  overText: {
    color: '#c62828',
  },
});