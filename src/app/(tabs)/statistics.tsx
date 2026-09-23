import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { Card, List, ProgressBar, Text } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { StatCard } from '../../components/stat-card';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';
import { ScreenFade } from '../../components/screen-fade';
import { FadeIn } from '../../components/fade-in';

export default function StatisticsScreen() {
  const { ready, settings, budgets } = useAppData();
  const theme = useAppTheme();
  const router = useRouter();
  const [records, setRecords] = useState<ClosedMonthRecord[]>([]);
  const [categories, setCategories] = useState<CategoryPerformance[]>([]);
  const [allTimeByCategory, setAllTimeByCategory] = useState<Map<number, number>>(
    new Map()
  );

  useFocusEffect(
    useCallback(() => {
      if (!ready) {
        return;
      }
      getClosedMonthRecords().then(setRecords);
      getCategoryPerformance().then(setCategories);
      getAllTimeSpendingByCategory().then(setAllTimeByCategory);
    }, [ready])
  );

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;
  const average = averageMonthlySpending(records);
  const highest = highestMonthlySpending(records);
  const averageAdjustment = averageReserveAdjustment(records);
  const budgetNames = new Map(budgets.map((budget) => [budget.id, budget.name]));

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <View style={styles.statRow}>
        <StatCard
          label="Avg spending / month"
          value={average}
          format={(v) => formatCents(v, symbol)}
        />
        <StatCard
          label="Highest month"
          value={highest}
          format={(v) => formatCents(v, symbol)}
        />
      </View>
      <View style={styles.statRow}>
        <StatCard
          label="Avg reserve adjustment"
          value={averageAdjustment}
          format={(v) => formatCents(v, symbol)}
          sub={
            averageAdjustment !== null
              ? averageAdjustment < 0
                ? 'Months draw on the reserve on average'
                : averageAdjustment > 0
                  ? 'Months saved on average'
                  : 'No net shift in the reserve'
              : null
          }
          tone={averageAdjustment !== null && averageAdjustment > 0 ? 'good' : averageAdjustment !== null && averageAdjustment < 0 ? 'bad' : 'neutral'}
        />
      </View>

      <Card mode="elevated" style={styles.card}>
        <List.Item
          title="Monthly history"
          description={
            records.length === 0
              ? 'Close a month to generate its report'
              : 'Open the report of every closed month'
          }
          left={(props) => <List.Icon {...props} icon="calendar-month-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/monthly-history')}
        />
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Spending by budget" />
        <Card.Content>
          {allTimeByCategory.size === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              No spending assigned to budgets yet.
            </Text>
          ) : (
            [...allTimeByCategory.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([budgetId, total]) => (
                <FadeIn key={String(budgetId)}>
                  <List.Item
                    title={budgetNames.get(budgetId) ?? `Budget #${budgetId}`}
                    right={() => <Text variant="bodyLarge">{formatCents(total, symbol)}</Text>}
                  />
                </FadeIn>
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
                    <Text variant="bodySmall" style={{ color: over ? theme.semantic.overBudget : theme.colors.onSurfaceVariant }}>
                      {formatCents(category.spentCents, symbol)} / {formatCents(category.plannedCents, symbol)}
                    </Text>
                  </View>
                  <ProgressBar
                    progress={Math.min(fraction, 1)}
                    color={over ? theme.semantic.overBudget : undefined}
                    style={styles.progress}
                  />
                </View>
              );
            })
          )}
        </Card.Content>
      </Card>
    </KeyboardAwareScrollView>
    </ScreenFade>
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
  budgetRow: {
    marginVertical: 6,
  },
  progress: {
    marginTop: 4,
    borderRadius: 4,
  },
});