import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, List, Text } from 'react-native-paper';

import { useAppData } from '../data/DataProvider';
import {
  getClosedMonthRecords,
  getMonthPlanningInputs,
  type MonthPlanningInputs,
} from '../database/queries';
import { averageMonthlySpending } from '../services/statistics-service';
import {
  budgetHeadroomCents,
  clampDrawCents,
  diffMonthPlan,
  planMonth,
  toMonthBudgets,
} from '../services/month-planning-service';
import { formatCents } from '../utils/currency';
import { monthLabel } from '../utils/date';
import { AmountInput } from './amount-input';
import { KeyboardAwareScrollView } from './keyboard-aware-scroll-view';
import { LoadingScreen } from './loading-screen';
import { useAppTheme } from '../theme';

export type MonthPlanningMode = 'start' | 'replan';

export interface MonthPlanCommit {
  plans: Record<number, number>;
  drawCents: number;
}

interface MonthPlanningEditorProps {
  monthKey: string;
  mode: MonthPlanningMode;
  /**
   * Space to keep clear below the last control, for a screen whose content
   * runs under the system navigation bar. Zero on an ordinary screen, which
   * already sits clear of it.
   */
  bottomInset?: number;
  /**
   * Called with the plan the user committed to. The editor writes nothing
   * itself: starting a month and re-planning one are different actions with
   * different records, and the caller owns which one this is.
   */
  onCommit: (commit: MonthPlanCommit) => Promise<void>;
}

/**
 * The plan of a month, laid out and committed in one explicit action.
 *
 * Used both to start a month, where nothing exists yet and the action creates
 * it, and to re-plan a month that is already under way, where the action writes
 * the new amounts and records what changed. Both modes plan against the same
 * rules, because a budget that cannot be planned beyond what the month has is
 * just as true halfway through the month as it is at the start of one.
 */
export function MonthPlanningEditor({
  monthKey,
  mode,
  bottomInset = 0,
  onCommit,
}: MonthPlanningEditorProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const { settings, budgets } = useAppData();

  const [inputs, setInputs] = useState<MonthPlanningInputs | null>(null);
  const [averageSpendingCents, setAverageSpendingCents] = useState<number | null>(null);
  const [draw, setDraw] = useState<number | null>(0);
  const [plans, setPlans] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const symbol = settings.currencySymbol;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [nextInputs, records] = await Promise.all([
          getMonthPlanningInputs(monthKey),
          getClosedMonthRecords(),
        ]);
        if (!active) {
          return;
        }
        setInputs(nextInputs);
        setAverageSpendingCents(averageMonthlySpending(records));
        setDraw(nextInputs.currentDrawCents);
        // A month that stands at a plan is re-planned from that plan; a month
        // that does not exist yet starts from the budget defaults.
        setPlans(
          Object.keys(nextInputs.currentPlans).length > 0
            ? { ...nextInputs.currentPlans }
            : Object.fromEntries(
                nextInputs.budgets.map((budget) => [budget.budgetId, budget.plannedAmountCents])
              )
        );
        setLoadError(null);
      } catch {
        setLoadError('The month could not be loaded. Nothing was changed.');
      }
    })();
    return () => {
      active = false;
    };
  }, [monthKey, attempt]);

  // A draw can never be more than the reserve holds, however it is typed. A
  // negative draw is the user setting extra aside, which the reserve can take
  // without limit.
  const drawCents = clampDrawCents(draw ?? 0, inputs?.startingReserveCents ?? 0);
  const drawTooLarge = (draw ?? 0) > (inputs?.startingReserveCents ?? 0);

  const planned = useMemo(
    () =>
      Object.entries(plans).map(([budgetId, plannedAmountCents]) => ({
        budgetId: Number(budgetId),
        plannedAmountCents,
      })),
    [plans]
  );

  const plan = useMemo(() => {
    if (!inputs) {
      return null;
    }
    return planMonth({
      monthKey,
      allowanceCents: inputs.allowanceCents,
      drawCents,
      fixedExpenses: inputs.fixedExpenses,
      subscriptions: inputs.subscriptions,
      budgets: toMonthBudgets(monthKey, planned),
    });
  }, [inputs, monthKey, planned, drawCents]);

  const planRows = useMemo(
    () => planned.map((entry) => ({ id: entry.budgetId, amountCents: entry.plannedAmountCents })),
    [planned]
  );

  const nameOf = useMemo(
    () => new Map(budgets.map((budget) => [budget.id, budget.name])),
    [budgets]
  );

  const replan = useMemo(() => {
    if (mode !== 'replan' || !inputs) {
      return null;
    }
    return diffMonthPlan(
      Object.entries(inputs.currentPlans).map(([budgetId, plannedAmountCents]) => ({
        budgetId: Number(budgetId),
        plannedAmountCents,
      })),
      plans,
      inputs.currentDrawCents,
      drawCents
    );
  }, [mode, inputs, plans, drawCents]);

  if (inputs === null || plan === null) {
    if (loadError === null) {
      return <LoadingScreen />;
    }
    return (
      <View style={styles.centered}>
        <Card mode="elevated" style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
              {loadError}
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => setAttempt((current) => current + 1)}>Try again</Button>
          </Card.Actions>
        </Card>
      </View>
    );
  }

  const blocked = saving || plan.overPlannedCents > 0 || drawTooLarge;
  const nothingToRecord = replan !== null && replan.unchanged;

  const commit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onCommit({ plans, drawCents });
    } catch {
      setSaveError('Nothing was changed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomInset }]}
      style={styles.scroll}
    >
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title={mode === 'start' ? 'What you are starting with' : 'Where this month stands'}
        />
        <Card.Content>
          <List.Item
            title="Savings reserve"
            description={`${formatCents(inputs.startingReserveCents, symbol)} carried into this month`}
            left={(props) => <List.Icon {...props} icon="piggy-bank-outline" />}
          />
          <List.Item
            title="Allowance"
            description={formatCents(plan.allowanceCents, symbol)}
            left={(props) => <List.Icon {...props} icon="cash" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings')}
          />
          <List.Item
            title="Average monthly spend"
            description={
              averageSpendingCents === null
                ? 'No months closed yet'
                : formatCents(averageSpendingCents, symbol)
            }
            left={(props) => <List.Icon {...props} icon="chart-line" />}
          />
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Draw from the reserve"
          subtitle="Optional. Planning only, for sizing the plan below."
        />
        <Card.Content>
          <AmountInput
            label="Draw this month"
            value={draw}
            onChange={setDraw}
            prefix={symbol}
            allowNegative
            error={
              drawTooLarge
                ? `You have ${formatCents(inputs.startingReserveCents, symbol)} in the reserve.`
                : null
            }
          />
          <Text variant="bodySmall" style={styles.hint}>
            Draw to bring money out of the reserve and plan it this month. Flip the sign to
            set that amount aside instead, and your plan is sized around what is left.
            Nothing moves now and nothing is recorded in the reserve. At the end of the
            month the reserve moves by what you actually spent, which may be no movement
            at all.
          </Text>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Already committed"
          subtitle="Deducted before you plan anything."
        />
        <Card.Content>
          <List.Item
            title="Fixed expenses"
            description={`${formatCents(plan.expectedFixedCents, symbol)} expected`}
            left={(props) => <List.Icon {...props} icon="home-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/planning/fixed-expenses')}
          />
          <List.Item
            title="Subscriptions"
            description={formatCents(plan.subscriptionCents, symbol)}
            left={(props) => <List.Icon {...props} icon="repeat" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/planning/subscriptions')}
          />
          <List.Item
            title="To spread across your budgets"
            description={formatCents(plan.distributableCents, symbol)}
            left={(props) => <List.Icon {...props} icon="wallet-outline" />}
          />
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Plan your budgets" subtitle="What you expect to spend in each." />
        <Card.Content>
          {inputs.budgets.length === 0 ? (
            <Text variant="bodyMedium" style={styles.hint}>
              You have no budgets yet. You can {mode === 'start' ? 'start the month' : 'save'}{' '}
              without them and add them later.
            </Text>
          ) : (
            inputs.budgets.map((budget) => {
              const headroom = budgetHeadroomCents(plan, planRows, budget.budgetId);
              const value = plans[budget.budgetId] ?? 0;
              return (
                <AmountInput
                  key={budget.budgetId}
                  label={nameOf.get(budget.budgetId) ?? `Budget ${budget.budgetId}`}
                  value={value}
                  onChange={(next) =>
                    setPlans((current) => ({
                      ...current,
                      [budget.budgetId]: next ?? 0,
                    }))
                  }
                  prefix={symbol}
                  error={
                    headroom < 0
                      ? `This month has no room left for it: ${formatCents(headroom, symbol)} short.`
                      : null
                  }
                />
              );
            })
          )}
          <List.Item
            title="Manage budgets"
            left={(props) => <List.Icon {...props} icon="format-list-bulleted" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/planning/budgets')}
          />
          <Text
            variant="bodyMedium"
            style={[
              styles.tally,
              {
                color:
                  plan.overPlannedCents > 0
                    ? theme.semantic.overBudget
                    : theme.semantic.goodBudget,
              },
            ]}
          >
            {plan.overPlannedCents > 0
              ? `Planned ${formatCents(plan.overPlannedCents, symbol)} more than this month has.`
              : `${formatCents(plan.remainingCents, symbol)} left unplanned.`}
          </Text>
        </Card.Content>
      </Card>

      {mode === 'replan' && (
        <Text variant="bodySmall" style={styles.recorded}>
          {nothingToRecord
            ? 'Nothing has changed yet, so there is nothing to record.'
            : 'Saving records what you changed, so the plan this month started from stays answerable.'}
        </Text>
      )}

      {saveError !== null && (
        <Text variant="bodyMedium" style={[styles.saveError, { color: theme.colors.error }]}>
          {saveError}
        </Text>
      )}

      <Button
        mode="contained"
        onPress={commit}
        loading={saving}
        disabled={blocked || nothingToRecord}
      >
        {mode === 'start' ? `Start ${monthLabel(monthKey)}` : 'Update the plan'}
      </Button>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  hint: {
    opacity: 0.7,
    paddingVertical: 8,
  },
  tally: {
    paddingTop: 8,
  },
  recorded: {
    opacity: 0.7,
    paddingBottom: 12,
  },
  saveError: {
    paddingBottom: 12,
    textAlign: 'center',
  },
});
