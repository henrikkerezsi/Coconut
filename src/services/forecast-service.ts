import type {
  Income,
  Month,
  MonthBudget,
  MonthFixedExpense,
  MonthSubscription,
  Transaction,
} from '../models';
import { monthSubscriptionTotal } from './subscription-service';

export interface FixedExpenseTotals {
  expectedTotalCents: number;
  actualTotalCents: number;
  chargedTotalCents: number;
}

/**
 * The amount a fixed-expense instance contributes to actual monthly spending:
 * the actual amount once known, otherwise the expected amount.
 */
export function fixedExpenseAmount(instance: MonthFixedExpense): number {
  return instance.actualAmountCents ?? instance.expectedAmountCents;
}

export function sumFixedExpenses(instances: MonthFixedExpense[]): FixedExpenseTotals {
  let expectedTotalCents = 0;
  let actualTotalCents = 0;
  let chargedTotalCents = 0;
  for (const instance of instances) {
    expectedTotalCents += instance.expectedAmountCents;
    const charged = fixedExpenseAmount(instance);
    chargedTotalCents += charged;
    if (instance.actualAmountCents !== null) {
      actualTotalCents += instance.actualAmountCents;
    }
  }
  return {
    expectedTotalCents,
    actualTotalCents,
    chargedTotalCents,
  };
}

export function transactionTotal(transactions: Transaction[]): number {
  return transactions.reduce((total, transaction) => total + transaction.amountCents, 0);
}

export function incomeTotal(income: Income[]): number {
  return income.reduce((total, entry) => total + entry.amountCents, 0);
}

export interface BudgetStatus {
  plannedCents: number;
  spentCents: number;
  remainingCents: number;
  differenceCents: number;
}

export function budgetStatus(plannedAmountCents: number, spentCents: number): BudgetStatus {
  return {
    plannedCents: plannedAmountCents,
    spentCents,
    remainingCents: plannedAmountCents - spentCents,
    differenceCents: spentCents - plannedAmountCents,
  };
}

export interface BudgetAvailableEntry {
  budgetId: number;
  plannedCents: number;
  spentCents: number;
}

/**
 * What is left to spend on each budget this month: the month's planned amount
 * minus what has been charged against it. The transaction being edited is
 * already part of `spentCents`, so when one is given it is taken back out —
 * the figure then shows the room the budget still has in total, including the
 * amount currently being edited. A budget with no plan for the month gets no
 * entry, and callers should show no amount for it.
 */
export function budgetAvailableAmounts(
  entries: readonly BudgetAvailableEntry[],
  editedTransaction: { budgetId: number | null; amountCents: number } | null
): Map<number, number> {
  const available = new Map<number, number>();
  for (const entry of entries) {
    const spentCents =
      editedTransaction !== null && editedTransaction.budgetId === entry.budgetId
        ? Math.max(entry.spentCents - editedTransaction.amountCents, 0)
        : entry.spentCents;
    available.set(entry.budgetId, entry.plannedCents - spentCents);
  }
  return available;
}

export interface MonthForecast {
  allowanceCents: number;
  incomeTotalCents: number;
  availableCents: number;
  subscriptionTotalCents: number;
  plannedSpendingCents: number;
  actualSpendingCents: number;
  fixedExpectedTotalCents: number;
  fixedChargedTotalCents: number;
  discretionarySpendingCents: number;
  budgetPlannedTotalCents: number;
  remainingAllowanceCents: number;
  remainingVsPlanCents: number;
  expectedAdjustmentCents: number;
  allowanceVsPlanCents: number;
}

export interface ForecastInput {
  month: Pick<Month, 'monthKey' | 'allowanceCents'>;
  income?: Income[];
  subscriptions?: MonthSubscription[];
  fixedExpenses: MonthFixedExpense[];
  budgets: MonthBudget[];
  transactions: Transaction[];
}

/**
 * Builds the forecast for a month. `actualSpendingCents` is the amount of money
 * that is currently accounted for (charged fixed expenses plus entered
 * transactions plus subscription deductions). `plannedSpendingCents`
 * reflects the original plan (expected fixed expenses plus budget allocations
 * plus subscription deductions). Both are estimates until the month is closed;
 * the caller decides how they are labelled in the UI.
 *
 * `availableCents` (allowance plus one-off income) is the money the month can
 * draw on. The remaining allowance and the expected reserve adjustment are
 * computed against it, so unspent income stays in the reserve at month end.
 * `remainingVsPlanCents` is what is left of the plan itself, so subscriptions
 * count as planned in both directions. `allowanceVsPlanCents` is the planned
 * reserve draw: the allowance alone against the plan, so one-off income never
 * makes the plan look better than it is. Subscription amounts come from the
 * charges frozen into the month, never from the current subscription list.
 */
export function forecastMonth(input: ForecastInput): MonthForecast {
  const { month, fixedExpenses, budgets, transactions } = input;
  const income = input.income ?? [];
  const incomeTotalCents = incomeTotal(income);
  const availableCents = month.allowanceCents + incomeTotalCents;
  const subscriptionTotal = monthSubscriptionTotal(input.subscriptions ?? []);
  const fixed = sumFixedExpenses(fixedExpenses);
  const discretionarySpendingCents = transactionTotal(transactions);
  const budgetPlannedTotalCents = budgets.reduce(
    (total, budget) => total + budget.plannedAmountCents,
    0
  );
  const fixedChargedTotalCents = fixedExpenses.reduce(
    (total, instance) => total + fixedExpenseAmount(instance),
    0
  );

  const actualSpendingCents =
    fixedChargedTotalCents + discretionarySpendingCents + subscriptionTotal;
  const plannedSpendingCents =
    fixed.expectedTotalCents + budgetPlannedTotalCents + subscriptionTotal;

  return {
    allowanceCents: month.allowanceCents,
    incomeTotalCents,
    availableCents,
    subscriptionTotalCents: subscriptionTotal,
    plannedSpendingCents,
    actualSpendingCents,
    fixedExpectedTotalCents: fixed.expectedTotalCents,
    fixedChargedTotalCents,
    discretionarySpendingCents,
    budgetPlannedTotalCents,
    remainingAllowanceCents: availableCents - actualSpendingCents,
    remainingVsPlanCents: plannedSpendingCents - actualSpendingCents,
    expectedAdjustmentCents: availableCents - actualSpendingCents,
    allowanceVsPlanCents: month.allowanceCents - plannedSpendingCents,
  };
}