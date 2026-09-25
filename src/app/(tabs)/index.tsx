import React from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { Button, Card, FAB, List, Text, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { formatCents, formatSignedCents } from '../../utils/currency';
import { currentMonthKey, EVERGREEN_MONTH_KEY, monthLabel, monthProgress, relativeDayLabel } from '../../utils/date';
import { StatCard, type Tone } from '../../components/stat-card';
import { reserveDrawBehindPlan } from '../../services/allowance-service';
import { MonthProgressBar } from '../../components/month-progress-bar';
import { LoadingScreen } from '../../components/loading-screen';
import { CoconutLogo } from '../../components/coconut-logo';
import { useAppTheme } from '../../theme';
import { ScreenFade } from '../../components/screen-fade';
import { FadeIn } from '../../components/fade-in';
import { AnimatedNumber } from '../../components/animated-number';

export default function OverviewScreen() {
  const { ready, settings, recentTransactions, currentDashboard, currentMonth, allSubscriptions } = useAppData();
  const theme = useAppTheme();
  const router = useRouter();

  if (!ready) {
    return <LoadingScreen />;
  }
  if (!currentDashboard || !currentMonth) {
    return null;
  }

  const { forecast, reserveProjection, budgetStatuses, fixedExpenseStatuses, income, subscriptions } = currentDashboard;
  const symbol = settings.currencySymbol;
  const reserved = currentMonth.isClosed;
  const subscriptionById = new Map(allSubscriptions.map((entry) => [entry.id, entry]));

  const remaining = forecast.remainingVsPlanCents;
  const elapsed = monthProgress();
  const remainingTone: Tone = remaining < 0 ? 'bad' : 'good';
  const plannedDraw = forecast.allowanceVsPlanCents;
  const actualDraw = forecast.remainingAllowanceCents;
  const behindPlan = reserveDrawBehindPlan(plannedDraw, actualDraw);
  const transferNote =
    reserveProjection.transferNetCents > 0
      ? `${formatCents(reserveProjection.transferNetCents, symbol)} moved to the reserve`
      : `${formatCents(-reserveProjection.transferNetCents, symbol)} moved to the month`;

  return (
    <ScreenFade>
      <View style={styles.screen}>
        <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <View style={styles.brandRow}>
        <CoconutLogo size={28} />
        <Text
          variant="bodyMedium"
          style={[styles.brandWord, { color: theme.text.secondary }]}
        >
          Coconut
        </Text>
      </View>
      <Text variant="titleLarge" style={styles.monthTitle}>
        {monthLabel(currentMonthKey())}
      </Text>

      <Card mode="contained" style={styles.reserveCard} contentStyle={styles.cardContent}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.reserveTitle}>
            Savings Reserve
          </Text>
          <View style={styles.reserveRow}>
            <Text variant="bodyMedium">Starting reserve</Text>
            <Text variant="bodyMedium">{formatCents(reserveProjection.startingReserveCents, symbol)}</Text>
          </View>
          <View style={styles.reserveRow}>
            <Text variant="bodyMedium">Planned draw</Text>
            <Text variant="bodyMedium">{formatSignedCents(plannedDraw, symbol)}</Text>
          </View>
          <View style={styles.reserveRow}>
            <Text variant="bodyMedium">Draw so far</Text>
            <Text
              variant="bodyMedium"
              style={{ color: behindPlan ? theme.semantic.overBudget : theme.semantic.goodBudget }}
            >
              {formatSignedCents(actualDraw, symbol)}
            </Text>
          </View>
          <View style={styles.reserveRow}>
            <Text variant="bodyMedium">{reserved ? 'Month closed' : 'Projected month end'}</Text>
            <AnimatedNumber
              value={reserveProjection.endingReserveBeforeTransfersCents}
              format={(v) => formatCents(v, symbol)}
            />
          </View>
          {reserveProjection.transferNetCents !== 0 ? (
            <Text variant="labelSmall" style={styles.reserveNote}>
              {`Projected without manual transfers: ${transferNote}`}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      <View style={styles.statRow}>
        <StatCard label="Planned spending" value={forecast.plannedSpendingCents} format={(v) => formatCents(v, symbol)} />
        <StatCard label="Available" value={forecast.availableCents} format={(v) => formatCents(v, symbol)} />
      </View>
      <View style={styles.statRow}>
        <StatCard label="Actual spent" value={forecast.actualSpendingCents} format={(v) => formatCents(v, symbol)} />
        <StatCard label="Remaining" value={remaining} format={(v) => formatCents(v, symbol)} tone={remainingTone} sub={remaining < 0 ? 'Over plan' : null} />
      </View>

      {subscriptions.length > 0 && (
      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title
          title="Subscriptions"
          subtitle={`${formatCents(forecast.subscriptionTotalCents, symbol)} deducted this month`}
        />
        <Card.Content>
          {subscriptions.map((charge) => {
            const subscription =
              charge.subscriptionId !== null
                ? subscriptionById.get(charge.subscriptionId) ?? null
                : null;
            const period = subscription
              ? subscription.endMonth === EVERGREEN_MONTH_KEY
                ? 'Ongoing'
                : `${monthLabel(subscription.startMonth)} \u2013 ${monthLabel(subscription.endMonth)}`
              : 'No longer active';
            return (
              <FadeIn key={charge.id}>
                <List.Item
                  title={subscription?.name ?? charge.name}
                  description={`Deducted monthly \u00b7 ${period}`}
                  left={(props) => <List.Icon {...props} icon="calendar-refresh" />}
                  right={() => (
                    <Text variant="bodyLarge">
                      {formatCents(charge.amountCents, symbol)}
                    </Text>
                  )}
                  style={[styles.transactionRow, { borderRadius: theme.radii.medium }]}
                  onPress={
                    subscription
                      ? () =>
                          router.push({
                            pathname: '/subscription/[id]',
                            params: { id: String(subscription.id) },
                          })
                      : undefined
                  }
                />
              </FadeIn>
            );
          })}
        </Card.Content>
      </Card>
      )}

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
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

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title
          title="One-off income"
          subtitle={`${formatCents(forecast.incomeTotalCents, symbol)} this month`}
          right={() => (
            <Button
              mode="contained-tonal"
              compact
              style={styles.incomeAdd}
              onPress={() => router.push('/income/new')}
            >
              Add
            </Button>
          )}
        />
        <Card.Content>
          {income.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              None yet. One-off income adds to what is available this month.
            </Text>
          ) : (
            income.map((entry) => (
              <FadeIn key={entry.id}>
                <List.Item
                  title={entry.description}
                  description={relativeDayLabel(entry.date)}
                  left={(props) => <List.Icon {...props} icon="bank-transfer-in" />}
                  right={() => (
                    <Text variant="bodyLarge">{formatCents(entry.amountCents, symbol)}</Text>
                  )}
                  style={[styles.transactionRow, { borderRadius: theme.radii.medium }]}
                  onPress={() => router.push({ pathname: '/income/[id]', params: { id: String(entry.id) } })}
                />
              </FadeIn>
            ))
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
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
                <TouchableRipple
                  key={budget.id}
                  onPress={() =>
                    router.push({
                      pathname: '/budget-transactions/[budgetId]',
                      params: { budgetId: String(budget.id) },
                    })
                  }
                  style={[styles.budgetRow, { borderRadius: theme.radii.medium }]}
                >
                  <View>
                    <View style={styles.row}>
                      <Text variant="bodyMedium">{budget.name}</Text>
                      <Text variant="bodySmall" style={{ color: over ? theme.semantic.overBudget : theme.colors.onSurfaceVariant }}>
                        {formatCents(status.spentCents, symbol)} / {formatCents(status.plannedCents, symbol)}
                        {over ? ' • over' : ''}
                      </Text>
                    </View>
                    <MonthProgressBar
                      progress={fraction}
                      monthProgress={elapsed}
                      color={over ? theme.semantic.overBudget : undefined}
                    />
                  </View>
                </TouchableRipple>
              );
            })
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title
          title="Recent Transactions"
          right={() => (
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.primary, marginRight: 12, opacity: 0.8 }}
              onPress={() => router.push('/transactions')}
            >
              See all
            </Text>
          )}
        />
        <Card.Content>
          {recentTransactions.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              No transactions yet.
            </Text>
          ) : (
            recentTransactions.map((tx) => {
              const budgetName = currentDashboard?.budgetNames.get(tx.budgetId ?? -1);
              return (
                <FadeIn key={tx.id}>
                <List.Item
                  title={tx.merchant}
                  description={relativeDayLabel(tx.date)}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="cash"
                      color={currentDashboard?.budgetColors.get(tx.budgetId ?? -1) ?? undefined}
                    />
                  )}
                  right={() => (
                    <View style={styles.transactionRight}>
                      <Text variant="bodyLarge">{formatCents(tx.amountCents, symbol)}</Text>
                      {budgetName ? (
                        <Text variant="labelSmall" style={styles.budgetTag}>
                          {budgetName}
                        </Text>
                      ) : null}
                    </View>
                  )}
                  style={[styles.transactionRow, { borderRadius: theme.radii.medium }]}
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(tx.id) } })}
                />
              </FadeIn>
              );
            })
          )}
        </Card.Content>
      </Card>
      </KeyboardAwareScrollView>
      <FAB icon="plus" style={styles.fab} onPress={() => router.push('/transaction/new')} />
      </View>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 96,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  brandWord: {
    letterSpacing: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  monthTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  reserveCard: {
    marginBottom: 12,
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
  reserveNote: {
    opacity: 0.6,
    marginTop: 6,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  empty: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  budgetRow: {
    marginVertical: 6,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionRow: {
    overflow: 'hidden',
  },
  budgetTag: {
    opacity: 0.6,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  incomeAdd: {
    marginRight: 12,
  },
});