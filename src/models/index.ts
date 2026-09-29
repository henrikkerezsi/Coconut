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
  username: string | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncState {
  supabaseUrl: string | null;
  apiKey: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: SyncStatus | null;
  lastSyncError: string | null;
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

/**
 * What a plan change did to a month's plan, recorded when the user explicitly
 * changes it so that later statistics can see how a plan was arrived at.
 *
 * Three kinds, one row each, so nothing is ever counted twice:
 * - `initial` opens the record for a budget: the amount the month started at.
 *   A plan that was set up before the record began opens with the amount as it
 *   stood, which is a truthful starting point rather than a claim about a past
 *   the record does not have.
 * - `budget` is one explicit change to one budget's planned amount, up or down.
 * - `draw` is one explicit change to the planned reserve draw. `fundedBudgetId`
 *   names the budget the difference was handed to, which is how a raise reads
 *   as "this budget got more because the reserve is being drawn down further".
 *
 * Nothing here moves money. A draw is a plan, and the reserve itself only ever
 * moves at the end of a month, by the closing rule.
 */
export const MONTH_PLAN_EVENT_KINDS = ['initial', 'budget', 'draw'] as const;
export type MonthPlanEventKind = (typeof MONTH_PLAN_EVENT_KINDS)[number];

export interface MonthPlanEvent {
  id: number;
  monthKey: MonthKey;
  kind: MonthPlanEventKind;
  /** The budget the change is about; null for a draw, which is not a budget. */
  budgetId: number | null;
  /** The budget amount before the change; 0 when the record opens. */
  previousAmountCents: number;
  /** The budget amount after the change; the draw itself for a draw event. */
  newAmountCents: number;
  /** The budget a draw was handed to, when the user gave the money to one. */
  fundedBudgetId: number | null;
  createdAt: string;
}

/**
 * How much value a purchase turned out to be, set when the user reviews a month
 * before closing it. A missing rating means the user never judged the purchase
 * and counts as neutral, so the month can always be closed.
 */
export const TRANSACTION_RATINGS = ['regret', 'neutral', 'good'] as const;

export type TransactionRating = (typeof TRANSACTION_RATINGS)[number];

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
  originType?: string | null;
  originId?: string | null;
  rating: TransactionRating | null;
}

export interface Income {
  id: number;
  monthKey: MonthKey;
  date: string;
  amountCents: number;
  description: string;
  note: string | null;
}

export interface Subscription {
  id: number;
  name: string;
  totalAmountCents: number;
  monthlyAmountCents: number;
  startMonth: MonthKey;
  endMonth: MonthKey;
  deductMonthly: boolean;
  active: boolean;
  sortOrder: number;
}

/** A subscription charge frozen into one month, kept for that month's history. */
export interface MonthSubscription {
  id: number;
  monthKey: MonthKey;
  subscriptionId: number | null;
  name: string;
  amountCents: number;
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

export type SharedMemberRole = 'owner' | 'member';

export type SharedMemberStatus = 'pending' | 'active' | 'left';

export type SharedPeriodStatus = 'open' | 'closed';

export type SharedSplitMethod = 'equal' | 'exact' | 'percentage';

export interface SharedSpace {
  id: number;
  uuid: string | null;
  name: string;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface SharedSpaceMember {
  id: number;
  uuid: string | null;
  spaceId: number;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: SharedMemberRole;
  status: SharedMemberStatus;
  joinedAt: string | null;
  updatedAt: string | null;
}

export interface SharedPeriod {
  id: number;
  uuid: string | null;
  spaceId: number;
  startDate: string;
  endDate: string | null;
  status: SharedPeriodStatus;
  createdAt: string;
  updatedAt: string | null;
}

export interface SharedExpense {
  id: number;
  uuid: string | null;
  spaceId: number;
  periodId: number;
  description: string;
  totalAmountCents: number;
  date: string;
  paidByMemberId: number;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface SharedExpenseSplit {
  id: number;
  uuid: string | null;
  expenseId: number;
  memberId: number;
  amountCents: number;
  updatedAt: string | null;
}

export interface SharedExpenseWithSplits {
  expense: SharedExpense;
  splits: SharedExpenseSplit[];
}

export interface SharedBalance {
  memberId: number;
  paidCents: number;
  owedCents: number;
  netCents: number;
}

export interface SharedSettlement {
  fromMemberId: number;
  toMemberId: number;
  amountCents: number;
}

export interface SharedReportMemberInfo {
  memberId: number;
  uuid: string | null;
  displayName: string | null;
  email: string | null;
}

export interface SharedReportExpense {
  description: string;
  date: string;
  totalAmountCents: number;
  paidByMemberId: number;
  splits: { memberId: number; amountCents: number }[];
}

export interface SharedReportMemberTotal {
  memberId: number;
  paidCents: number;
}

export interface SharedPeriodReportData {
  spaceName: string;
  periodStart: string;
  periodEnd: string;
  closedAt: string;
  members: SharedReportMemberInfo[];
  expenses: SharedReportExpense[];
  memberTotals: SharedReportMemberTotal[];
  balances: SharedBalance[];
  settlements: SharedSettlement[];
}

export interface SharedPeriodReport {
  id: number;
  uuid: string | null;
  spaceId: number;
  periodId: number;
  report: SharedPeriodReportData;
  closedAt: string;
  closedByMemberId: number | null;
  updatedAt: string | null;
}

export interface SharedSplitInput {
  memberId: number;
  amountCents?: number;
  basisPoints?: number;
  selected?: boolean;
}

export interface SharedSplitRecord {
  memberId: number;
  amountCents: number;
}