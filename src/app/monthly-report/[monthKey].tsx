import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { Card, List, Text } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';

import { useAppData } from '../../data/DataProvider';
import { getMonthlyReport } from '../../database/monthlyReports';
import type { MonthlyReport } from '../../services/monthly-report-service';
import { formatCents } from '../../utils/currency';
import { monthLabel } from '../../utils/date';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';

function ReportRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  const theme = useAppTheme();
  const color =
    tone === 'good'
      ? theme.semantic.goodBudget
      : tone === 'bad'
        ? theme.semantic.overBudget
        : undefined;
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium">{label}</Text>
      <Text variant="bodyMedium" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}

function formatSignedCents(cents: number, symbol: string): string {
  return `${cents >= 0 ? '+' : ''}${formatCents(cents, symbol)}`;
}

export default function MonthlyReportScreen() {
  const { monthKey } = useLocalSearchParams<{ monthKey: string }>();
  const { ready, settings } = useAppData();
  const theme = useAppTheme();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready || !monthKey) {
      return;
    }
    let active = true;
    void getMonthlyReport(monthKey).then((result) => {
      if (active) {
        setReport(result);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [ready, monthKey]);

  if (!ready || !loaded) {
    return <LoadingScreen />;
  }
  if (!report) {
    return (
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Text variant="bodyMedium" style={styles.empty}>
          This month has no report yet. Close the month to generate one.
        </Text>
      </KeyboardAwareScrollView>
    );
  }

  const symbol = settings.currencySymbol;
  const saved = report.adjustmentCents > 0;
  const drawn = report.adjustmentCents < 0;
  const transferNote =
    report.transferNetCents !== 0
      ? report.transferNetCents > 0
        ? ` +${formatCents(report.transferNetCents, symbol)} transferred to reserve`
        : ` ${formatCents(-report.transferNetCents, symbol)} transferred to the month`
      : null;

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <Text variant="titleLarge" style={styles.title}>
        {monthLabel(report.monthKey)}
      </Text>

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title title="Summary" />
        <Card.Content>
          <ReportRow label="Monthly allowance" value={formatCents(report.allowanceCents, symbol)} />
          <ReportRow label="One-off income" value={formatCents(report.incomeCents, symbol)} />
          <ReportRow label="Total spent" value={formatCents(report.spendingCents, symbol)} />
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title
          title="Fixed expenses"
          subtitle={`${formatCents(report.fixedTotalCents, symbol)} total`}
        />
        <Card.Content>
          {report.fixedExpenses.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              No fixed expenses.
            </Text>
          ) : (
            report.fixedExpenses.map((expense) => (
              <List.Item
                key={expense.name}
                title={expense.name}
                description={
                  expense.actualCents !== null
                    ? 'Actual'
                    : `Estimated · expected ${formatCents(expense.expectedCents, symbol)}`
                }
                left={(props) => <List.Icon {...props} icon="calendar-check-outline" />}
                right={() => (
                  <Text variant="bodyLarge">{formatCents(expense.chargedCents, symbol)}</Text>
                )}
              />
            ))
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title
          title="Subscriptions"
          subtitle={`${formatCents(report.subscriptionTotalCents, symbol)} deducted this month`}
        />
        <Card.Content>
          {report.subscriptions.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              No monthly subscription deductions.
            </Text>
          ) : (
            report.subscriptions.map((subscription) => (
              <List.Item
                key={subscription.name}
                title={subscription.name}
                description="Monthly deduction"
                left={(props) => <List.Icon {...props} icon="calendar-refresh-outline" />}
                right={() => (
                  <Text variant="bodyLarge">{formatCents(subscription.monthlyCents, symbol)}</Text>
                )}
              />
            ))
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title
          title="Flexible budgets"
          subtitle={`${formatCents(report.budgetSpentTotalCents, symbol)} spent`}
        />
        <Card.Content>
          {report.budgets.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              No flexible budgets.
            </Text>
          ) : (
            report.budgets.map((budget) => {
              const over = budget.spentCents > budget.plannedCents;
              return (
                <View key={budget.name} style={styles.budgetRow}>
                  <View style={styles.row}>
                    <Text variant="bodyMedium">{budget.name}</Text>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: over ? theme.semantic.overBudget : theme.colors.onSurfaceVariant,
                      }}
                    >
                      {formatCents(budget.spentCents, symbol)} / {formatCents(budget.plannedCents, symbol)}
                      {over ? ' • over' : ''}
                    </Text>
                  </View>
                  <ReportRow
                    label={over ? 'Over by' : 'Remaining'}
                    value={over ? formatCents(-budget.remainingCents, symbol) : formatCents(budget.remainingCents, symbol)}
                    tone={over ? 'bad' : undefined}
                  />
                </View>
              );
            })
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title title="Savings reserve" />
        <Card.Content>
          <ReportRow
            label="Previously on the account"
            value={formatCents(report.startingReserveCents, symbol)}
          />
          <ReportRow
            label={saved ? 'Added at month end' : drawn ? 'Taken at month end' : 'Added at month end'}
            value={formatSignedCents(report.adjustmentCents, symbol)}
            tone={saved && report.adjustmentCents !== 0 ? 'good' : drawn ? 'bad' : undefined}
          />
          {transferNote ? (
            <ReportRow label="Transfers" value={transferNote.trim()} />
          ) : null}
          <ReportRow
            label="Ending reserve"
            value={
              report.endingReserveCents !== null
                ? formatCents(report.endingReserveCents, symbol)
                : '—'
            }
          />
        </Card.Content>
      </Card>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  budgetRow: {
    marginVertical: 6,
  },
  empty: {
    opacity: 0.6,
    paddingVertical: 8,
  },
});