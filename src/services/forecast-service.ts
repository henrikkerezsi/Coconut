import type { Month, MonthBudget, MonthFixedExpense, Transaction } from '../models';

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

export interface MonthForecast {
  allowanceCents: number;
  plannedSpendingCents: number;
  actualSpendingCents: number;
  fixedExpectedTotalCents: number;
  fixedChargedTotalCents: number;
  discretionarySpendingCents: number;
  budgetPlannedTotalCents: number;
  remainingAllowanceCents: number;
  expectedAdjustmentCents: number;
  plannedVsAllowanceCents: number;
}

export interface ForecastInput {
  month: Pick<Month, 'allowanceCents'>;
  fixedExpenses: MonthFixedExpense[];
  budgets: MonthBudget[];
  transactions: Transaction[];
}

/**
 * Builds the forecast for a month. `actualSpendingCents` is the amount of money
 * that is currently accounted for (charged fixed expenses plus entered
 * transactions). `plannedSpendingCents` reflects the original plan (expected
 * fixed expenses plus budget allocations). Both are estimates until the month
 * is closed; the caller decides how they are labelled in the UI.
 */
export function forecastMonth(input: ForecastInput): MonthForecast {
  const { month, fixedExpenses, budgets, transactions } = input;
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

  const actualSpendingCents = fixedChargedTotalCents + discretionarySpendingCents;
  const plannedSpendingCents = fixed.expectedTotalCents + budgetPlannedTotalCents;

  return {
    allowanceCents: month.allowanceCents,
    plannedSpendingCents,
    actualSpendingCents,
    fixedExpectedTotalCents: fixed.expectedTotalCents,
    fixedChargedTotalCents,
    discretionarySpendingCents,
    budgetPlannedTotalCents,
    remainingAllowanceCents: month.allowanceCents - actualSpendingCents,
    expectedAdjustmentCents: actualSpendingCents - month.allowanceCents,
    plannedVsAllowanceCents: month.allowanceCents - plannedSpendingCents,
  };
}