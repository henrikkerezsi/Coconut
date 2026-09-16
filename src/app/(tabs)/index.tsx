import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, List, ProgressBar, Text } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { currentMonthKey, monthLabel } from '../../utils/date';
import { StatCard, type Tone } from '../../components/stat-card';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';

export default function OverviewScreen() {
  const { ready, settings, currentDashboard, currentMonth } = useAppData();
  const theme = useAppTheme();

  if (!ready) {
    return <LoadingScreen />;
  }
  if (!currentDashboard || !currentMonth) {
    return null;
  }

  const { forecast, reserveProjection, budgetStatuses, fixedExpenseStatuses } = currentDashboard;
  const symbol = settings.currencySymbol;
  const reserved = currentMonth.isClosed;

  const remaining = forecast.remainingAllowanceCents;
  const remainingTone: Tone = remaining < 0 ? 'bad' : remaining === 0 ? 'neutral' : 'good';
  const adjustmentTone: Tone =
    reserveProjection.adjustmentCents > 0 ? 'bad' : reserveProjection.adjustmentCents < 0 ? 'good' : 'neutral';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="titleLarge" style={styles.monthTitle}>
        {monthLabel(currentMonthKey())}
      </Text>

      <Card mode="contained" style={styles.reserveCard}>
        <Card.Title
          title="Savings Reserve"
          subtitle={reserved ? 'Month closed' : 'Projected month end'}
          right={(props) => (
            <Text variant="titleLarge" style={styles.reserveValue}>
              {formatCents(reserveProjection.endingReserveCents, symbol)}
            </Text>
          )}
        />
        <Card.Content>
          <View style={styles.row}>
            <Text variant="bodyMedium">Starting reserve</Text>
            <Text variant="bodyMedium">{formatCents(reserveProjection.startingReserveCents, symbol)}</Text>
          </View>
          <View style={styles.row}>
            <Text variant="bodyMedium">Reserve adjustment</Text>
            <Text variant="bodyMedium" style={{ color: adjustmentTone === 'bad' ? theme.semantic.overBudget : adjustmentTone === 'good' ? theme.semantic.goodBudget : undefined }}>
              {reserveProjection.adjustmentCents > 0 ? '+' : ''}
              {formatCents(reserveProjection.adjustmentCents, symbol)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.statRow}>
        <StatCard label="Allowance" value={formatCents(forecast.allowanceCents, symbol)} />
        <StatCard label="Actual spent" value={formatCents(forecast.actualSpendingCents, symbol)} />
        <StatCard label="Remaining" value={formatCents(remaining, symbol)} tone={remainingTone} sub={remaining < 0 ? 'Over the allowance' : null} />
      </View>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Planned vs Allowance" />
        <Card.Content>
          <View style={styles.row}>
            <Text variant="bodyMedium">Planned spending</Text>
            <Text variant="bodyMedium">{formatCents(forecast.plannedSpendingCents, symbol)}</Text>
          </View>
          <View style={styles.row}>
            <Text variant="bodyMedium">Allowance</Text>
            <Text variant="bodyMedium">{formatCents(forecast.allowanceCents, symbol)}</Text>
          </View>
          <Text variant="bodySmall" style={styles.hint}>
            Planned spending may exceed the allowance; that is expected, not an error.
          </Text>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Fixed Expenses"
          subtitle={`${formatCents(forecast.fixedExpectedTotalCents, symbol)} expected`}
        />
        <Card.Content>
          {fixedExpenseStatuses.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              None defined.
            </Text>
          ) : (
            fixedExpenseStatuses.map(({ instance, expense }) => {
              const known = instance.actualAmountCents !== null;
              return (
                <List.Item
                  key={instance.id}
                  title={expense?.name ?? `Expense #${instance.fixedExpenseId}`}
                  description={known ? 'Actual' : `Estimated${expense?.kind === 'variable' ? '' : ' (fixed)'}`}
                  right={() => (
                    <Text variant="bodyLarge">{formatCents(instance.actualAmountCents ?? instance.expectedAmountCents, symbol)}</Text>
                  )}
                />
              );
            })
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Flexible Budgets" subtitle={`${formatCents(forecast.budgetPlannedTotalCents, symbol)} planned`} />
        <Card.Content>
          {budgetStatuses.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              None defined. Set them up in Planning.
            </Text>
          ) : (
            budgetStatuses.map(({ budget, status }) => {
              const over = status.remainingCents < 0;
              const fraction = status.plannedCents > 0 ? status.spentCents / status.plannedCents : status.spentCents > 0 ? 1 : 0;
              return (
                <View key={budget.id} style={styles.budgetRow}>
                  <View style={styles.row}>
                    <Text variant="bodyMedium">{budget.name}</Text>
                    <Text variant="bodySmall" style={{ color: over ? theme.semantic.overBudget : theme.colors.onSurfaceVariant }}>
                      {formatCents(status.spentCents, symbol)} / {formatCents(status.plannedCents, symbol)}
                      {over ? ' • over' : ''}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  monthTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  reserveCard: {
    marginBottom: 12,
  },
  reserveValue: {
    marginRight: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  card: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  hint: {
    opacity: 0.6,
    marginTop: 8,
    fontStyle: 'italic',
  },
  empty: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  budgetRow: {
    marginVertical: 6,
  },
  progress: {
    marginTop: 4,
    borderRadius: 4,
  },
});