import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import dayjs, { type Dayjs } from 'dayjs';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Appbar, Button, Card, List, Portal, Text } from 'react-native-paper';
import { useAppData, type MonthDashboard } from '../../data/DataProvider';
import type { TransactionRating } from '../../models';
import { monthLabel } from '../../utils/date';
import { formatCents, formatSignedCents } from '../../utils/currency';
import { fixedExpenseAmount } from '../../services/forecast-service';
import { reserveDrawBehindPlan } from '../../services/allowance-service';
import { isWithinClosingWindow, monthClosingWindow } from '../../services/month-closing-service';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { LoadingScreen } from '../../components/loading-screen';
import { RatingLegend, RatingSelector } from '../../components/rating-selector';
import { ScreenToast } from '../../components/screen-toast';
import { StatCard, type Tone } from '../../components/stat-card';
import { AppDialog } from '../../components/app-dialog';
import { AnimatedNumber } from '../../components/animated-number';
import { useAppTheme } from '../../theme';

export default function CloseMonthScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { monthKey } = useLocalSearchParams<{ monthKey: string }>();
  const {
    ready,
    settings,
    allMonths,
    dashboardFor,
    setTransactionRating,
    closeCurrentMonth,
  } = useAppData();

  const [dashboard, setDashboard] = useState<MonthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const month = allMonths.find((entry) => entry.monthKey === monthKey) ?? null;
  const symbol = settings.currencySymbol;

  useEffect(() => {
    if (!ready) {
      return;
    }
    let active = true;
    void dashboardFor(monthKey).then((result) => {
      if (active) {
        setDashboard(result);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [ready, dashboardFor, monthKey]);

  if (!ready || loading) {
    return <LoadingScreen />;
  }

  if (!month) {
    return (
      <View style={styles.container}>
        <CloseMonthHeader title="Close Month" onBack={() => router.back()} />
        <Text variant="bodyMedium" style={styles.empty}>
          This month is not available.
        </Text>
      </View>
    );
  }

  const transactions = dashboard?.transactions ?? [];
  const fixedTotalCents = dashboard
    ? dashboard.fixedExpenseStatuses.reduce(
        (total, entry) => total + fixedExpenseAmount(entry.instance),
        0
      )
    : 0;
  const subscriptionTotalCents = dashboard
    ? dashboard.subscriptions.reduce((total, entry) => total + entry.amountCents, 0)
    : 0;
  const budgetRows = (dashboard?.budgetStatuses ?? [])
    .filter((entry) => entry.status.spentCents !== 0)
    .map((entry) => ({
      id: entry.budget.id,
      name: entry.budget.name,
      spentCents: entry.status.spentCents,
      plannedCents: entry.status.plannedCents,
    }));
  const alreadyClosed = month.isClosed;
  const closingWindow = monthClosingWindow(month.monthKey);
  const withinClosingWindow = isWithinClosingWindow(month.monthKey, dayjs());

  const forecast = dashboard?.forecast;
  const reserveProjection = dashboard?.reserveProjection;
  const wantedToSpendCents = forecast?.plannedSpendingCents ?? 0;
  const actuallySpentCents = forecast?.actualSpendingCents ?? 0;
  const againstPlanCents = forecast?.remainingVsPlanCents ?? 0;
  const againstPlanTone: Tone = againstPlanCents < 0 ? 'bad' : 'good';
  const plannedReserveMoveCents = forecast?.allowanceVsPlanCents ?? 0;
  const actualReserveMoveCents = forecast?.remainingAllowanceCents ?? 0;
  const behindPlan = reserveDrawBehindPlan(plannedReserveMoveCents, actualReserveMoveCents);

  const rate = (id: number, rating: TransactionRating) => {
    setDashboard((current) =>
      current
        ? {
            ...current,
            transactions: current.transactions.map((entry) =>
              entry.id === id ? { ...entry, rating } : entry
            ),
          }
        : current
    );
    void setTransactionRating(id, rating);
  };

  return (
    <View style={styles.container}>
      <CloseMonthHeader
        title={`Close ${monthLabel(month.monthKey)}`}
        onBack={() => router.back()}
      />

      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <View style={styles.statRow}>
          <StatCard
            label="Wanted to spend"
            value={wantedToSpendCents}
            format={(value) => formatCents(value, symbol)}
          />
          <StatCard
            label="Actually spent"
            value={actuallySpentCents}
            format={(value) => formatCents(value, symbol)}
          />
        </View>
        <View style={styles.statRow}>
          <StatCard
            label="Wanted vs spent"
            value={againstPlanCents}
            format={(value) => formatCents(value, symbol)}
            tone={againstPlanTone}
            sub={againstPlanCents < 0 ? 'Spent over plan' : 'Left unspent'}
          />
          <StatCard
            label="Transactions"
            value={transactions.length}
            format={(value) => String(value)}
          />
        </View>

        <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.reserveTitle}>
              Savings Reserve
            </Text>
            <View style={styles.reserveRow}>
              <Text variant="bodyMedium">Starting reserve</Text>
              <Text variant="bodyMedium">
                {formatCents(reserveProjection?.startingReserveCents ?? 0, symbol)}
              </Text>
            </View>
            <View style={styles.reserveRow}>
              <Text variant="bodyMedium">Wanted to add</Text>
              <Text variant="bodyMedium">
                {formatSignedCents(plannedReserveMoveCents, symbol)}
              </Text>
            </View>
            <View style={styles.reserveRow}>
              <Text variant="bodyMedium">Actually added so far</Text>
              <Text
                variant="bodyMedium"
                style={{
                  color: behindPlan
                    ? theme.semantic.overBudget
                    : theme.semantic.goodBudget,
                }}
              >
                {formatSignedCents(actualReserveMoveCents, symbol)}
              </Text>
            </View>
            <View style={styles.reserveRow}>
              <Text variant="bodyMedium">
                {alreadyClosed ? 'End of month' : 'Will be at the end of the month'}
              </Text>
              <AnimatedNumber
                value={reserveProjection?.endingReserveCents ?? 0}
                format={(value) => formatCents(value, symbol)}
              />
            </View>
          </Card.Content>
        </Card>

        <View style={styles.statRow}>
          <StatCard
            label="Fixed expenses"
            value={fixedTotalCents}
            format={(value) => formatCents(value, symbol)}
          />
          <StatCard
            label="Subscriptions"
            value={subscriptionTotalCents}
            format={(value) => formatCents(value, symbol)}
          />
        </View>

        <Card mode="elevated" style={styles.card}>
          <Card.Title title="Per budget" />
          <Card.Content>
            {budgetRows.length === 0 ? (
              <Text variant="bodyMedium" style={styles.empty}>
                No spending tagged to a budget.
              </Text>
            ) : (
              budgetRows.map((row) => (
                <List.Item
                  key={row.id}
                  title={row.name}
                  description={`Planned ${formatCents(row.plannedCents, symbol)}`}
                  right={() => (
                    <Text variant="bodyLarge">{formatCents(row.spentCents, symbol)}</Text>
                  )}
                />
              ))
            )}
          </Card.Content>
        </Card>

        <Card mode="elevated" style={styles.card}>
          <Card.Title
            title="How useful was your spending?"
            subtitle="Look back over the month and mark each purchase"
          />
          <Card.Content>
            <RatingLegend />
            {transactions.length === 0 ? (
              <Text variant="bodyMedium" style={styles.empty}>
                No transactions in this month.
              </Text>
            ) : (
              transactions.map((transaction) => {
                const shared = transaction.originType === 'shared';
                const budgetName =
                  dashboard?.budgetNames.get(transaction.budgetId ?? -1) ?? null;
                return (
                  <View
                    key={transaction.id}
                    style={[styles.transactionRow, { borderRadius: theme.radii.medium }]}
                  >
                    <View style={styles.transactionText}>
                      <Text variant="bodyMedium" numberOfLines={1}>
                        {transaction.merchant}
                      </Text>
                      <Text variant="labelSmall" style={{ color: theme.text.secondary }}>
                        {[budgetName, shared ? 'Shared' : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text variant="bodyMedium">
                      {formatCents(transaction.amountCents, symbol)}
                    </Text>
                    <RatingSelector
                      value={transaction.rating}
                      disabled={alreadyClosed}
                      onChange={(rating) => rate(transaction.id, rating)}
                    />
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>

        {alreadyClosed || withinClosingWindow ? (
          <Button
            mode="contained"
            style={styles.closeButton}
            disabled={alreadyClosed || closing}
            loading={closing}
            onPress={() => setConfirm(true)}
          >
            {alreadyClosed ? `${monthLabel(month.monthKey)} is closed` : 'Close month'}
          </Button>
        ) : (
          <Card mode="contained" style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium">
                {`${monthLabel(month.monthKey)} can be closed from ${closingWindowLabel(closingWindow.start)} until ${closingWindowLabel(closingWindow.end)}. Until then you can keep editing the month, and the overview shows the option once it is time.`}
              </Text>
            </Card.Content>
          </Card>
        )}
      </KeyboardAwareScrollView>

      <Portal>
        <AppDialog visible={confirm} onDismiss={() => setConfirm(false)}>
          <AppDialog.Title>Close {monthLabel(month.monthKey)}?</AppDialog.Title>
          <AppDialog.Content>
            <Text variant="bodyMedium">
              {`This is final and cannot be undone. ${monthLabel(month.monthKey)} cannot be reopened or edited afterwards, and its ending reserve balance is recorded as it stands now.`}
            </Text>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setConfirm(false)}>Cancel</Button>
            <Button
              loading={closing}
              onPress={async () => {
                setClosing(true);
                try {
                  const closed = await closeCurrentMonth(month.monthKey);
                  setConfirm(false);
                  if (closed) {
                    setToast(`${monthLabel(month.monthKey)} closed`);
                    router.replace({
                      pathname: '/monthly-report/[monthKey]',
                      params: { monthKey: month.monthKey },
                    });
                  } else {
                    setToast(`${monthLabel(month.monthKey)} was already closed`);
                  }
                } finally {
                  setClosing(false);
                }
              }}
            >
              Close month
            </Button>
          </AppDialog.Actions>
        </AppDialog>
      </Portal>

      <ScreenToast
        visible={toast !== null}
        message={toast}
        onDismiss={() => setToast(null)}
        duration={2000}
      />
    </View>
  );
}

function closingWindowLabel(moment: Dayjs): string {
  return moment.format('D MMM YYYY, HH:mm');
}

function CloseMonthHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <Appbar.Header>
      <Appbar.BackAction onPress={onBack} />
      <Appbar.Content title={title} />
    </Appbar.Header>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
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
  cardContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  reserveTitle: {
    marginBottom: 8,
  },
  reserveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  empty: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  transactionText: {
    flex: 1,
  },
  closeButton: {
    marginTop: 8,
  },
});
