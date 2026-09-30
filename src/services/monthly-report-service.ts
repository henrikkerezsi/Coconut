import type {
  Budget,
  FixedExpense,
  Income,
  Month,
  MonthBudget,
  MonthFixedExpense,
  MonthKey,
  MonthPlanEvent,
  MonthSubscription,
  Transaction,
} from '../models';
import { budgetStatus, fixedExpenseAmount, incomeTotal, transactionTotal } from './forecast-service';
import { reserveAdjustmentCents } from './allowance-service';
import { spendingByCategory } from './statistics-service';

export interface MonthlyReportFixedExpense {
  name: string;
  expectedCents: number;
  actualCents: number | null;
  chargedCents: number;
}

export interface MonthlyReportSubscription {
  name: string;
  monthlyCents: number;
}

export interface MonthlyReportBudget {
  name: string;
  /**
   * The amount the budget was planned at when the month started, or null when the
   * month has no plan record and so no known starting point.
   */
  startingCents: number | null;
  /** The amount the user ended up adjusting the budget to before closing. */
  plannedCents: number;
  spentCents: number;
  remainingCents: number;
}

export interface MonthlyReportInput {
  month: Month;
  fixedExpenses: MonthFixedExpense[];
  budgets: MonthBudget[];
  transactions: Transaction[];
  income: Income[];
  subscriptions: MonthSubscription[];
  fixedExpenseDefinitions: Record<number, FixedExpense>;
  budgetDefinitions: Record<number, Budget>;
  /** The month's plan record, which is what knows how the plan was arrived at. */
  planEvents: MonthPlanEvent[];
}

export interface MonthlyReport {
  monthKey: MonthKey;
  allowanceCents: number;
  incomeCents: number;
  spendingCents: number;
  fixedExpenses: MonthlyReportFixedExpense[];
  fixedTotalCents: number;
  subscriptions: MonthlyReportSubscription[];
  subscriptionTotalCents: number;
  budgets: MonthlyReportBudget[];
  budgetSpentTotalCents: number;
  startingReserveCents: number;
  adjustmentCents: number;
  endingReserveCents: number | null;
  /** The planned draw as first recorded, or null when the month has no record of one. */
  initialDrawCents: number | null;
  /** The draw the month was left planning, or null when none was ever planned. */
  endingDrawCents: number | null;
}

/** What a month's plan record says about how its plan was arrived at. */
export interface MonthPlanSummary {
  /** The opening amount of each budget, for the budgets the record opens. */
  startingByBudget: Map<number, number>;
  initialDrawCents: number | null;
  endingDrawCents: number | null;
}

/**
 * Folds a month's plan record into the two things a closing report needs: where
 * each budget started, and the draw as planned at each end of the month.
 *
 * The record opens with one `initial` event per budget, holding the amount the
 * month started at, and a budget's later amounts are each a `budget` event. The
 * month ends at the last of them, which is the amount the user left it at. A
 * budget with no `initial` event has no known starting point, so it is absent
 * from the map rather than guessed at.
 *
 * The draw is a single month-wide plan, not a per-budget one. Its first recorded
 * event is the opening draw and its last is the ending one; a month that planned
 * no draw and then raised one has no opening event, so its first recorded draw
 * is where the record begins rather than a value the month started at.
 */
export function summarizeMonthPlan(events: MonthPlanEvent[]): MonthPlanSummary {
  const startingByBudget = new Map<number, number>();
  let initialDrawCents: number | null = null;
  let endingDrawCents: number | null = null;

  for (const event of events) {
    if (
      event.kind === 'initial' &&
      event.budgetId !== null &&
      !startingByBudget.has(event.budgetId)
    ) {
      startingByBudget.set(event.budgetId, event.newAmountCents);
    }
    if (event.kind === 'draw') {
      initialDrawCents ??= event.newAmountCents;
      endingDrawCents = event.newAmountCents;
    }
  }

  return { startingByBudget, initialDrawCents, endingDrawCents };
}

/** Fixed-expense instances with their name and the amount actually charged. */
export function reportFixedExpenses(
  instances: MonthFixedExpense[],
  definitions: Record<number, FixedExpense>
): MonthlyReportFixedExpense[] {
  return instances.map((instance) => {
    const definition = definitions[instance.fixedExpenseId];
    return {
      name: definition?.name ?? `Expense #${instance.fixedExpenseId}`,
      expectedCents: instance.expectedAmountCents,
      actualCents: instance.actualAmountCents,
      chargedCents: fixedExpenseAmount(instance),
    };
  });
}

/** The subscription charges frozen into the month, with their charged amount. */
export function reportSubscriptions(
  charges: MonthSubscription[]
): MonthlyReportSubscription[] {
  return charges.map((charge) => ({
    name: charge.name,
    monthlyCents: charge.amountCents,
  }));
}

/** Planned vs. spent per flexible budget, sorted by amount spent descending. */
export function reportBudgets(
  monthBudgets: MonthBudget[],
  definitions: Record<number, Budget>,
  transactions: Transaction[],
  plan: MonthPlanSummary = { startingByBudget: new Map(), initialDrawCents: null, endingDrawCents: null }
): MonthlyReportBudget[] {
  const spentByBudget = spendingByCategory(transactions);
  const entries = monthBudgets.map((monthBudget) => {
    const definition = definitions[monthBudget.budgetId];
    const status = budgetStatus(
      monthBudget.plannedAmountCents,
      spentByBudget.get(monthBudget.budgetId) ?? 0
    );
    return {
      name: definition?.name ?? `Budget #${monthBudget.budgetId}`,
      startingCents: plan.startingByBudget.get(monthBudget.budgetId) ?? null,
      plannedCents: status.plannedCents,
      spentCents: status.spentCents,
      remainingCents: status.remainingCents,
    };
  });
  const uncategorizedCents = transactions.reduce(
    (total, transaction) =>
      transaction.budgetId === null ? total + transaction.amountCents : total,
    0
  );
  if (uncategorizedCents > 0) {
    entries.push({
      name: 'No budget',
      startingCents: null,
      plannedCents: 0,
      spentCents: uncategorizedCents,
      remainingCents: -uncategorizedCents,
    });
  }
  return entries.sort((a, b) => b.spentCents - a.spentCents);
}

/**
 * Builds the end-of-month report for a closed month. Every value is derived
 * from the month's stored data, so the result is deterministic and stable for
 * closed (immutable) months.
 */
export function buildMonthlyReport(input: MonthlyReportInput): MonthlyReport {
  const plan = summarizeMonthPlan(input.planEvents);
  const fixedExpenses = reportFixedExpenses(input.fixedExpenses, input.fixedExpenseDefinitions);
  const subscriptions = reportSubscriptions(input.subscriptions);
  const budgets = reportBudgets(input.budgets, input.budgetDefinitions, input.transactions, plan);
  const fixedTotalCents = fixedExpenses.reduce((sum, expense) => sum + expense.chargedCents, 0);
  const subscriptionTotalCents = subscriptions.reduce(
    (sum, subscription) => sum + subscription.monthlyCents,
    0
  );
  const discretionarySpendingCents = transactionTotal(input.transactions);
  const budgetSpentTotalCents = budgets.reduce((sum, budget) => sum + budget.spentCents, 0);
  const incomeCents = incomeTotal(input.income);
  const spendingCents = fixedTotalCents + subscriptionTotalCents + discretionarySpendingCents;
  const adjustmentCents = reserveAdjustmentCents(
    spendingCents,
    input.month.allowanceCents,
    incomeCents
  ).adjustmentCents;

  return {
    monthKey: input.month.monthKey,
    allowanceCents: input.month.allowanceCents,
    incomeCents,
    spendingCents,
    fixedExpenses,
    fixedTotalCents,
    subscriptions,
    subscriptionTotalCents,
    budgets,
    budgetSpentTotalCents,
    startingReserveCents: input.month.startingReserveCents,
    adjustmentCents,
    endingReserveCents: input.month.endingReserveCents,
    initialDrawCents: plan.initialDrawCents,
    endingDrawCents: plan.endingDrawCents,
  };
}
