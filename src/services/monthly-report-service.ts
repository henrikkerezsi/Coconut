import type {
  Budget,
  FixedExpense,
  Income,
  Month,
  MonthBudget,
  MonthFixedExpense,
  MonthKey,
  ReserveTransfer,
  Transaction,
  Subscription,
} from '../models';
import { budgetStatus, fixedExpenseAmount, incomeTotal, transactionTotal } from './forecast-service';
import { reserveAdjustmentCents } from './allowance-service';
import { sumTransfers } from './reserve-service';
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
  subscriptions: Subscription[];
  transfers: ReserveTransfer[];
  fixedExpenseDefinitions: Record<number, FixedExpense>;
  budgetDefinitions: Record<number, Budget>;
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
  transferNetCents: number;
  adjustmentCents: number;
  endingReserveCents: number | null;
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

/**
 * Subscriptions that charged money during the month: every active subscription
 * with a monthly deduction whose start/end period covers the month.
 */
export function subscriptionsChargedInMonth(
  subscriptions: Subscription[],
  monthKey: MonthKey
): MonthlyReportSubscription[] {
  return subscriptions
    .filter(
      (subscription) =>
        subscription.active &&
        subscription.deductMonthly &&
        monthKey >= subscription.startMonth &&
        monthKey <= subscription.endMonth
    )
    .map((subscription) => ({
      name: subscription.name,
      monthlyCents: subscription.monthlyAmountCents,
    }));
}

/** Planned vs. spent per flexible budget, sorted by amount spent descending. */
export function reportBudgets(
  monthBudgets: MonthBudget[],
  definitions: Record<number, Budget>,
  transactions: Transaction[]
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
  const fixedExpenses = reportFixedExpenses(input.fixedExpenses, input.fixedExpenseDefinitions);
  const subscriptions = subscriptionsChargedInMonth(input.subscriptions, input.month.monthKey);
  const budgets = reportBudgets(input.budgets, input.budgetDefinitions, input.transactions);
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
  const transferNetCents = sumTransfers(input.transfers).netCents;

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
    transferNetCents,
    adjustmentCents,
    endingReserveCents: input.month.endingReserveCents,
  };
}