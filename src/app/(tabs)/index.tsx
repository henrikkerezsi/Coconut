import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, FAB, List, ProgressBar, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { currentMonthKey, monthLabel, relativeDayLabel } from '../../utils/date';
import { nextChargeMonth } from '../../services/subscription-service';
import { StatCard, type Tone } from '../../components/stat-card';
import { LoadingScreen } from '../../components/loading-screen';
import { CoconutLogo } from '../../components/coconut-logo';
import { useAppTheme } from '../../theme';
import { ScreenFade } from '../../components/screen-fade';
import { FadeIn } from '../../components/fade-in';
import { AnimatedNumber } from '../../components/animated-number';

export default function OverviewScreen() {
  const { ready, settings, recentTransactions, currentDashboard, currentMonth } = useAppData();
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

  const remaining = forecast.remainingAllowanceCents;
  const remainingTone: Tone = remaining < 0 ? 'bad' : remaining === 0 ? 'neutral' : 'good';
  const adjustmentTone: Tone =
    reserveProjection.adjustmentCents > 0 ? 'good' : reserveProjection.adjustmentCents < 0 ? 'bad' : 'neutral';

  return (
    <ScreenFade>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
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
        <Card.Title
          title="Savings Reserve"
          subtitle={reserved ? 'Month closed' : 'Projected month end'}
          right={() => (
            <AnimatedNumber value={reserveProjection.endingReserveCents} format={(v) => formatCents(v, symbol)} style={styles.reserveValue} />
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
        <StatCard label="Allowance" value={forecast.allowanceCents} format={(v) => formatCents(v, symbol)} />
        <StatCard label="Income" value={forecast.incomeTotalCents} format={(v) => formatCents(v, symbol)} tone="good" />
      </View>
      <View style={styles.statRow}>
        <StatCard label="Actual spent" value={forecast.actualSpendingCents} format={(v) => formatCents(v, symbol)} />
        <StatCard label="Remaining" value={remaining} format={(v) => formatCents(v, symbol)} tone={remainingTone} sub={remaining < 0 ? 'Over what is available' : null} />
      </View>

      {subscriptions.length > 0 && (
      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title
          title="Yearly Subscriptions"
          subtitle={`${formatCents(forecast.subscriptionTotalCents, symbol)} deducted this month`}
        />
        <Card.Content>
          {subscriptions.map((subscription) => (
            <FadeIn key={subscription.id}>
              <List.Item
                title={subscription.name}
                description={
                  subscription.deductMonthly
                    ? `Deducted monthly · renews ${monthLabel(nextChargeMonth(subscription, currentMonthKey()))}`
                    : `Renews ${monthLabel(nextChargeMonth(subscription, currentMonthKey()))}`
                }
                left={(props) => <List.Icon {...props} icon="calendar-refresh" />}
                right={() => (
                  <Text variant="bodyLarge">
                    {formatCents(subscription.monthlyAmountCents, symbol)}
                  </Text>
                )}
                style={[styles.transactionRow, { borderRadius: theme.radii.medium }]}
                onPress={() =>
                  router.push({
                    pathname: '/subscription/[id]',
                    params: { id: String(subscription.id) },
                  })
                }
              />
            </FadeIn>
          ))}
        </Card.Content>
      </Card>
      )}

      <Card mode="elevated" style={styles.card} contentStyle={styles.cardContent}>
        <Card.Title title="Planned vs Available" />
        <Card.Content>
          <View style={styles.row}>
            <Text variant="bodyMedium">Planned spending</Text>
            <Text variant="bodyMedium">{formatCents(forecast.plannedSpendingCents, symbol)}</Text>
          </View>
          <View style={styles.row}>
            <Text variant="bodyMedium">Available (allowance + income)</Text>
            <Text variant="bodyMedium">{formatCents(forecast.availableCents, symbol)}</Text>
          </View>
          <Text variant="bodySmall" style={styles.hint}>
            Planned spending may exceed what is available; that is expected, not an error.
          </Text>
        </Card.Content>
      </Card>

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
          title="Income"
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
      </ScrollView>
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