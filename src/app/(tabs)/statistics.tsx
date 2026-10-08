import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { Card, List, ProgressBar, Text } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import type {
  BudgetPerformanceRecord,
  ClosedMonthRecord,
  RatingPerformancePoint,
} from '../../database/queries';
import {
  getBudgetPerformance,
  getClosedMonthRecords,
  getRatingPerformance,
} from '../../database/queries';
import {
  averageMonthlySpending,
  averageReserveAdjustment,
  highestMonthlySpending,
  medianMonthlySpending,
} from '../../services/statistics-service';
import { formatCents } from '../../utils/currency';
import { StatCard } from '../../components/stat-card';
import { MonthlySpendChart } from '../../components/monthly-spend-chart';
import { SpendingPerformanceChart } from '../../components/spending-performance-chart';
import { SavingsTrendChart } from '../../components/savings-trend-chart';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';
import { ScreenFade } from '../../components/screen-fade';

export default function StatisticsScreen() {
  const { ready, settings } = useAppData();
  const theme = useAppTheme();
  const router = useRouter();
  const [records, setRecords] = useState<ClosedMonthRecord[]>([]);
  const [performance, setPerformance] = useState<BudgetPerformanceRecord[]>([]);
  const [ratingPerformance, setRatingPerformance] = useState<RatingPerformancePoint[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) {
        return;
      }
      getClosedMonthRecords().then(setRecords);
      getBudgetPerformance().then(setPerformance);
      getRatingPerformance().then(setRatingPerformance);
    }, [ready])
  );

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;
  const average = averageMonthlySpending(records);
  const highest = highestMonthlySpending(records);
  const averageAdjustment = averageReserveAdjustment(records);
  const median = medianMonthlySpending(records);

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
        <View style={styles.chartHeader}>
          <Text variant="titleMedium">Monthly spend</Text>
          {median !== null ? (
            <View
              style={[
                styles.medianBubble,
                { backgroundColor: theme.colors.primaryContainer, borderRadius: theme.radii.pill },
                theme.elevation.level2,
              ]}
            >
              <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                {`Median ${formatCents(median, symbol)}`}
              </Text>
            </View>
          ) : null}
        </View>
        {records.length === 0 ? (
          <Text variant="bodyMedium" style={styles.chartEmpty}>
            Close a month to chart its spending.
          </Text>
        ) : (
          <View style={styles.chartBody}>
            <MonthlySpendChart
              points={records.map((record) => ({
                monthKey: record.monthKey,
                valueCents: record.spendingCents,
              }))}
              medianCents={median ?? 0}
              symbol={symbol}
            />
          </View>
        )}
      </Card>
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Spending performance"
          subtitle="Share of transactions rated regret, neutral, and good"
        />
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.semantic.error }]} />
            <Text variant="labelSmall">Regret</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.outline }]} />
            <Text variant="labelSmall">Neutral</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.semantic.success }]} />
            <Text variant="labelSmall">Good</Text>
          </View>
        </View>
        {ratingPerformance.length === 0 ? (
          <Text variant="bodyMedium" style={styles.chartEmpty}>
            Close a month with transactions to chart its spending performance.
          </Text>
        ) : (
          <View style={styles.chartBody}>
            <SpendingPerformanceChart points={ratingPerformance} />
          </View>
        )}
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Savings trend"
          subtitle="Money added to or drawn from the reserve each month"
        />
        <Card.Content>
          {records.length === 0 ? (
            <Text variant="bodyMedium" style={styles.chartEmpty}>
              Close a month to chart how the reserve moves.
            </Text>
          ) : (
            <SavingsTrendChart
              points={records.map((record) => ({
                monthKey: record.monthKey,
                adjustmentCents: record.reserveAdjustmentCents,
              }))}
              symbol={symbol}
            />
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Budget usage"
          subtitle="Average of each month's spend vs. its plan"
        />
        <Card.Content>
          {performance.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              No budget data in closed months yet.
            </Text>
          ) : (
            performance.map((entry) => {
              const average = entry.averagePercent;
              if (average === null) {
                return (
                  <View key={entry.budgetId} style={styles.budgetRow}>
                    <View style={styles.historyRow}>
                      <Text variant="bodyMedium">{entry.name}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        No budget data
                      </Text>
                    </View>
                  </View>
                );
              }
              const over = average > 100;
              return (
                <View key={entry.budgetId} style={styles.budgetRow}>
                  <View style={styles.historyRow}>
                    <Text variant="bodyMedium">{entry.name}</Text>
                    <Text variant="bodySmall" style={{ color: over ? theme.semantic.overBudget : theme.colors.onSurfaceVariant }}>
                      {`${average}% of plan / month`}
                    </Text>
                  </View>
                  <ProgressBar
                    progress={Math.min(average / 100, 1)}
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
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  medianBubble: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chartBody: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  chartEmpty: {
    opacity: 0.6,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
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