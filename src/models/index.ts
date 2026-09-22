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