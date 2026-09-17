export type MonthKey = string;

export type FixedExpenseKind = 'fixed' | 'variable';

export type Recurrence = 'monthly';

export type EstimationStrategy = 'manual' | 'last-month' | 'average' | 'history-average';

export interface Settings {
  monthlyAllowanceCents: number;
  initialReserveCents: number;
  currencySymbol: string;
  themeMode: 'light' | 'dark' | 'system';
  recentTransactionsCount: number;
}

export interface Month {
  monthKey: MonthKey;
  allowanceCents: number;
  startingReserveCents: number;
  endingReserveCents: number | null;
  isClosed: boolean;
  closedAt: string | null;
}

export interface FixedExpense {
  id: number;
  name: string;
  expectedAmountCents: number;
  kind: FixedExpenseKind;
  recurrence: Recurrence;
  estimationStrategy: EstimationStrategy;
  averageMonths: number | null;
  active: boolean;
  sortOrder: number;
}

export interface MonthFixedExpense {
  id: number;
  monthKey: MonthKey;
  fixedExpenseId: number;
  expectedAmountCents: number;
  actualAmountCents: number | null;
}

export interface Budget {
  id: number;
  name: string;
  defaultAmountCents: number;
  active: boolean;
  sortOrder: number;
  color: string | null;
}

export interface MonthBudget {
  id: number;
  monthKey: MonthKey;
  budgetId: number;
  plannedAmountCents: number;
}

export interface Transaction {
  id: number;
  monthKey: MonthKey;
  date: string;
  amountCents: number;
  budgetId: number | null;
  merchant: string;
  note: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachment: Uint8Array | null;
}

export interface Income {
  id: number;
  monthKey: MonthKey;
  date: string;
  amountCents: number;
  description: string;
  note: string | null;
}

export interface YearlySubscription {
  id: number;
  name: string;
  yearlyAmountCents: number;
  monthlyAmountCents: number;
  startedMonth: MonthKey;
  billingMonth: MonthKey;
  deductMonthly: boolean;
  active: boolean;
  sortOrder: number;
}

export interface Attachment {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface ReserveTransfer {
  id: number;
  monthKey: MonthKey;
  amountCents: number;
  direction: 'to-month' | 'to-reserve';
  note: string | null;
}

export interface MerchantSuggestion {
  merchant: string;
  budgetId: number;
  useCount: number;
}

export interface ReserveSnapshot {
  monthKey: MonthKey;
  startingReserveCents: number;
  endingReserveCents: number | null;
}

export interface ReserveAdjustment {
  adjustmentCents: number;
  overspent: boolean;
}