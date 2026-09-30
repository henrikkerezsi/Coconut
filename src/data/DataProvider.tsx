import type { SQLiteDatabase } from 'expo-sqlite';
import dayjs, { type Dayjs } from 'dayjs';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  Attachment,
  Budget,
  FixedExpense,
  Income,
  MerchantSuggestion,
  Month,
  MonthFixedExpense,
  MonthKey,
  MonthSubscription,
  ReserveTransfer,
  Settings,
  Subscription,
  SyncState,
  Transaction,
  TransactionRating,
} from '../models';
import { currentMonthKey } from '../utils/date';
import { getDatabase } from '../database/database';
import { getSettings, updateSettings } from '../database/settings';
import { getSyncState, updateSyncState } from '../database/syncState';
import { isValidApiKey, normalizeSupabaseUrl } from '../services/sync-service';
import {
  closeMonth as persistCloseMonth,
  createPlannedMonth,
  getAllMonths,
  getMonth,
  materializeMonth,
  updateMonthAllowance,
  updateMonthStartingReserve,
  type PlannedMonthInput,
} from '../database/months';
import { recordMonthPlan, type MonthPlanUpdate } from '../database/monthPlan';
import {
  createFixedExpense,
  deactivateFixedExpense,
  getAllFixedExpenses,
  reorderFixedExpenses,
  setMonthFixedExpenseActual,
  updateFixedExpense as updateFixedExpenseRow,
} from '../database/fixedExpenses';
import {
  createBudget,
  deleteBudget as deleteBudgetRow,
  getAllBudgets,
  reorderBudgets,
  updateBudget as updateBudgetRow,
} from '../database/budgets';
import {
  createTransaction,
  deleteTransaction as deleteTransactionRow,
  getTransaction,
  getRecentTransactions,
  setTransactionRating,
  updateTransaction as updateTransactionRow,
  updateTransactionAttachment,
  updateTransactionBudget,
  type TransactionInput,
} from '../database/transactions';
import {
  createIncome,
  deleteIncome as deleteIncomeRow,
  updateIncome as updateIncomeRow,
  type IncomeInput,
} from '../database/income';
import {
  createSubscription,
  deleteSubscription as deleteSubscriptionRow,
  getAllSubscriptions,
  reorderSubscriptions,
  updateSubscription as updateSubscriptionRow,
  type SubscriptionInput,
} from '../database/subscriptions';
import {
  createReserveTransfer,
  getMerchantSuggestions,
  getReserveTransfers,
  upsertMerchantSuggestion,
} from '../database/reserve';
import { getMonthData } from '../database/queries';
import { reconcileSharedTransactionsForLocalUser } from '../database/sharedLinking';
import { syncSharedChanges } from '../sync/engine';
import {
  buildAutomaticReserveTransfer,
  projectReserve,
  type ReserveProjection,
} from '../services/reserve-service';
import { monthsRequiringAutoClose } from '../services/month-closing-service';
import { resolveActiveMonth, validateDateInActiveMonth } from '../services/active-month-service';
import {
  budgetStatus,
  forecastMonth,
  type BudgetStatus,
  type MonthForecast,
} from '../services/forecast-service';

export interface BudgetWithStatus {
  budget: Budget;
  monthBudgetId: number | null;
  plannedCents: number;
  status: BudgetStatus;
}

export interface FixedExpenseWithStatus {
  instance: MonthFixedExpense;
  expense: FixedExpense | null;
}

export interface MonthDashboard {
  monthKey: MonthKey;
  forecast: MonthForecast;
  reserveProjection: ReserveProjection;
  budgetStatuses: BudgetWithStatus[];
  fixedExpenseStatuses: FixedExpenseWithStatus[];
  transactions: Transaction[];
  income: Income[];
  subscriptions: MonthSubscription[];
  budgetNames: Map<number, string>;
  budgetColors: Map<number, string | null>;
}

interface AppData {
  ready: boolean;
  settings: Settings;
  syncState: SyncState;
  recentTransactions: Transaction[];
  currentMonth: Month | null;
  currentDashboard: MonthDashboard | null;
  /**
   * The month that is waiting to be started, or null while one is open. A month
   * only ever comes into existence through `startMonth`, so this is what the
   * planning screen offers and what keeps the main interface out of reach.
   */
  pendingMonthKey: MonthKey | null;
  /**
   * The period the app is working on. It advances when a month is closed rather
   * than with the calendar, so it can be ahead of or behind the calendar month.
   */
  activeMonthKey: MonthKey;
  allFixedExpenses: FixedExpense[];
  budgets: Budget[];
  allSubscriptions: Subscription[];
  allMonths: Month[];
  /** The reserve movement applied when each month was closed, newest first. */
  reserveHistory: ReserveTransfer[];
  dashboardFor: (monthKey: MonthKey) => Promise<MonthDashboard | null>;
  setMonthlyAllowance: (cents: number) => Promise<void>;
  setInitialReserve: (cents: number) => Promise<void>;
  setCurrencySymbol: (symbol: string) => Promise<void>;
  setThemeMode: (mode: Settings['themeMode']) => Promise<void>;
  setRecentTransactionsCount: (count: number) => Promise<void>;
  setUsername: (username: string | null) => Promise<void>;
  saveSyncConfig: (supabaseUrl: string, apiKey: string) => Promise<boolean>;
  setSyncEnabled: (enabled: boolean) => Promise<void>;
  addFixedExpense: (input: Omit<FixedExpense, 'id'>) => Promise<void>;
  saveFixedExpense: (id: number, input: Omit<FixedExpense, 'id'>) => Promise<void>;
  removeFixedExpense: (id: number) => Promise<void>;
  reorderFixedExpenses: (orderedIds: number[]) => Promise<void>;
  setFixedExpenseActual: (monthFixedExpenseId: number, actualCents: number | null) => Promise<void>;
  addBudget: (input: Omit<Budget, 'id'>) => Promise<void>;
  saveBudget: (id: number, input: Omit<Budget, 'id'>) => Promise<void>;
  removeBudget: (id: number) => Promise<void>;
  reorderBudgets: (orderedIds: number[]) => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  saveTransaction: (id: number, input: TransactionInput) => Promise<void>;
  saveTransactionAttachment: (id: number, attachment: Attachment | null) => Promise<void>;
  saveTransactionBudget: (id: number, budgetId: number | null) => Promise<void>;
  setTransactionRating: (id: number, rating: TransactionRating) => Promise<void>;
  removeTransaction: (id: number) => Promise<void>;
  suggestBudgets: (merchant: string) => Promise<MerchantSuggestion[]>;
  addIncome: (input: IncomeInput) => Promise<void>;
  saveIncome: (id: number, input: IncomeInput) => Promise<void>;
  removeIncome: (id: number) => Promise<void>;
  addSubscription: (input: SubscriptionInput) => Promise<void>;
  saveSubscription: (id: number, input: SubscriptionInput) => Promise<void>;
  removeSubscription: (id: number) => Promise<void>;
  reorderSubscriptions: (orderedIds: number[]) => Promise<void>;
  closeCurrentMonth: (monthKey: MonthKey) => Promise<boolean>;
  /** Creates the pending month with the plan the user laid out for it. */
  startMonth: (input: PlannedMonthInput) => Promise<void>;
  /**
   * Applies an explicit re-plan of the month that is running, and records what it
   * changed. A month planned before the record existed is opened at the amounts
   * it stood at when the user first re-planned it.
   */
  replanMonth: (input: MonthPlanUpdate) => Promise<void>;
  refresh: () => Promise<void>;
  syncSharedAndRefresh: () => Promise<void>;
}

const DataContext = createContext<AppData | null>(null);

/**
 * Settles a month: stores the reserve balance it ended on and records the
 * movement it applied. Returns false when the month was already closed, so the
 * reserve movement is never recorded twice.
 */
async function settleMonth(monthKey: MonthKey, db: SQLiteDatabase): Promise<boolean> {
  const dashboard = await buildDashboard(monthKey);
  if (!dashboard) {
    return false;
  }
  const closed = await persistCloseMonth(
    monthKey,
    dashboard.reserveProjection.endingReserveCents,
    db
  );
  if (!closed) {
    return false;
  }
  const transfer = buildAutomaticReserveTransfer(dashboard.reserveProjection.adjustmentCents);
  await createReserveTransfer(monthKey, transfer.amountCents, transfer.direction, transfer.note, db);
  return true;
}

/**
 * Brings the dataset in line with the closing rules before the app reads it:
 * every open month whose closing window has passed is settled, so a month the
 * user never got to close is finished rather than left open. Its reserve
 * adjustment is applied and recorded at that point.
 *
 * It deliberately stops there. When nothing is left open, the month the app
 * would move on to is only resolved, never created: the user starts it through
 * the planning screen, which is what makes a month exist at all.
 */
async function catchUpOnClosings(db: SQLiteDatabase, now: Dayjs): Promise<MonthKey> {
  for (const stale of monthsRequiringAutoClose(await getAllMonths(db), now)) {
    await settleMonth(stale, db);
  }
  return resolveActiveMonth(await getAllMonths(db), currentMonthKey()).monthKey;
}

/**
 * Every record the user enters carries a date of its own, and a date only ever
 * falls inside the active month (see idea.txt §3.0). Screens bound the date
 * picker as well; this is the guard that keeps the rule true for every write.
 */
function assertActiveMonthDate(date: string, monthKey: MonthKey, subject: string): void {
  const check = validateDateInActiveMonth(date, monthKey, subject);
  if (!check.ok) {
    throw new Error(check.error ?? 'The date is not inside the active month.');
  }
}

async function buildDashboard(monthKey: MonthKey): Promise<MonthDashboard | null> {
  const data = await getMonthData(monthKey);
  if (!data) {
    return null;
  }
  const { month, fixedExpenses, budgets, transactions, income, subscriptions } = data;
  const forecast = forecastMonth({
    month,
    income,
    subscriptions,
    fixedExpenses,
    budgets,
    transactions,
  });
  const reserveProjection = projectReserve({
    startingReserveCents: month.startingReserveCents,
    actualSpendingCents: forecast.actualSpendingCents,
    allowanceCents: month.allowanceCents,
    incomeCents: forecast.incomeTotalCents,
  });

  const [budgetDefinitions, fixedExpenseDefinitions] = await Promise.all([
    getAllBudgets(),
    getAllFixedExpenses(),
  ]);
  const definitionMap = new Map(budgetDefinitions.map((budget) => [budget.id, budget]));
  const fixedMap = new Map(fixedExpenseDefinitions.map((expense) => [expense.id, expense]));
  const spentByBudget = new Map<number, number>();
  for (const transaction of transactions) {
    if (transaction.budgetId !== null) {
      spentByBudget.set(
        transaction.budgetId,
        (spentByBudget.get(transaction.budgetId) ?? 0) + transaction.amountCents
      );
    }
  }

  const budgetStatuses: BudgetWithStatus[] = [];
  for (const monthBudget of budgets) {
    const budget = definitionMap.get(monthBudget.budgetId);
    if (!budget) {
      continue;
    }
    const spent = spentByBudget.get(monthBudget.budgetId) ?? 0;
    budgetStatuses.push({
      budget,
      monthBudgetId: monthBudget.id,
      plannedCents: monthBudget.plannedAmountCents,
      status: budgetStatus(monthBudget.plannedAmountCents, spent),
    });
  }
  budgetStatuses.sort((a, b) => a.budget.sortOrder - b.budget.sortOrder || a.budget.id - b.budget.id);

  const fixedExpenseStatuses: FixedExpenseWithStatus[] = fixedExpenses.map((instance) => ({
    instance,
    expense: fixedMap.get(instance.fixedExpenseId) ?? null,
  }));
  fixedExpenseStatuses.sort(
    (a, b) => (a.expense?.sortOrder ?? 0) - (b.expense?.sortOrder ?? 0)
  );

  return {
    monthKey,
    forecast,
    reserveProjection,
    budgetStatuses,
    fixedExpenseStatuses,
    transactions,
    income,
    subscriptions,
    budgetNames: new Map(budgetDefinitions.map((budget) => [budget.id, budget.name])),
    budgetColors: new Map(budgetDefinitions.map((budget) => [budget.id, budget.color])),
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    monthlyAllowanceCents: 0,
    initialReserveCents: 0,
    currencySymbol: '€',
    themeMode: 'system',
    recentTransactionsCount: 5,
    username: null,
  });
  const [syncState, setSyncState] = useState<SyncState>({
    supabaseUrl: null,
    apiKey: null,
    enabled: false,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
  });
  const [currentMonth, setCurrentMonth] = useState<Month | null>(null);
  const [pendingMonthKey, setPendingMonthKey] = useState<MonthKey | null>(null);
  const [currentDashboard, setCurrentDashboard] = useState<MonthDashboard | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allFixedExpenses, setAllFixedExpenses] = useState<FixedExpense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [allMonths, setAllMonths] = useState<Month[]>([]);
  const [reserveHistory, setReserveHistory] = useState<ReserveTransfer[]>([]);

  // The period the app is working on, which advances on closing rather than with
  // the calendar, so every write below lands on the month actually on screen.
  const activeMonthKey = currentMonth?.monthKey ?? currentMonthKey();

  const loadLocal = useCallback(async () => {
    const db = await getDatabase();
    const monthKey = await catchUpOnClosings(db, dayjs());

    const nextSettings = await getSettings(db);
    setSettings(nextSettings);
    setSyncState(await getSyncState(db));

    const month = await getMonth(monthKey, db);
    setCurrentMonth(month);
    // A resolved month with no row is the one waiting to be started.
    setPendingMonthKey(month ? null : monthKey);
    setCurrentDashboard(month ? await buildDashboard(monthKey) : null);
    setRecentTransactions(await getRecentTransactions(nextSettings.recentTransactionsCount, db));
    setAllFixedExpenses(await getAllFixedExpenses(db));
    setBudgets(await getAllBudgets(db));
    setAllSubscriptions(await getAllSubscriptions(db));
    setAllMonths(await getAllMonths(db));
    setReserveHistory(await getReserveTransfers(60, db));
  }, []);

  const refresh = useCallback(async () => {
    // Re-read the personal dataset, then keep shared groups in step with other
    // members cheaply in the background: push local shared changes and pull
    // anything new, without the heavy whole-database resync (that stays
    // available in Settings for emergencies). Once the sync lands, read the
    // personal dataset again so re-derived mirrors appear without a restart.
    await loadLocal();
    const synced = syncSharedChanges();
    void synced
      .then((outcome) => {
        if (outcome) {
          return loadLocal();
        }
        return undefined;
      })
      .catch(() => undefined);
  }, [loadLocal]);

  // Pull-to-refresh entry point for the shared tab: sync the shared tables
  // (push + pull + reconcile mirrors) and then re-read the personal dataset so
  // mirrored amounts updated on another device show up immediately.
  const syncSharedAndRefresh = useCallback(async () => {
    const outcome = await syncSharedChanges();
    if (outcome) {
      await loadLocal();
    }
  }, [loadLocal]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      await refresh();
      if (active) {
        setReady(true);
      }
    }
    initialize().catch((error) => {
      console.error('Failed to load app data', error);
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const value = useMemo<AppData>(() => {
    return {
      ready,
      settings,
      syncState,
      recentTransactions,
      currentMonth,
      currentDashboard,
      pendingMonthKey,
      activeMonthKey,
      allFixedExpenses,
      budgets,
      allSubscriptions,
      allMonths,
      reserveHistory,
      dashboardFor: buildDashboard,
      setMonthlyAllowance: async (cents) => {
        const db = await getDatabase();
        await updateSettings({ monthlyAllowanceCents: cents }, db);
        await updateMonthAllowance(activeMonthKey, cents, db);
        await refresh();
      },
      setInitialReserve: async (cents) => {
        const db = await getDatabase();
        await updateSettings({ initialReserveCents: cents }, db);
        if (currentMonth && !currentMonth.isClosed) {
          await updateMonthStartingReserve(currentMonth.monthKey, cents, db);
        }
        await refresh();
      },
      setCurrencySymbol: async (symbol) => {
        const db = await getDatabase();
        await updateSettings({ currencySymbol: symbol }, db);
        await refresh();
      },
      setThemeMode: async (mode) => {
        const db = await getDatabase();
        await updateSettings({ themeMode: mode }, db);
        await refresh();
      },
      setRecentTransactionsCount: async (count) => {
        const db = await getDatabase();
        await updateSettings({ recentTransactionsCount: count }, db);
        await refresh();
      },
      setUsername: async (username) => {
        const db = await getDatabase();
        await updateSettings({ username }, db);
        await refresh();
      },
      saveSyncConfig: async (supabaseUrl, apiKey) => {
        const normalizedUrl = normalizeSupabaseUrl(supabaseUrl);
        if (normalizedUrl === null || !isValidApiKey(apiKey)) {
          return false;
        }
        const db = await getDatabase();
        await updateSyncState({ supabaseUrl: normalizedUrl, apiKey: apiKey.trim() }, db);
        await refresh();
        return true;
      },
      setSyncEnabled: async (enabled) => {
        const db = await getDatabase();
        await updateSyncState({ enabled }, db);
        await refresh();
      },
      addFixedExpense: async (input) => {
        const db = await getDatabase();
        const sortOrder = allFixedExpenses.length;
        await createFixedExpense({ ...input, sortOrder }, db);
        await materializeMonth(activeMonthKey, db);
        await refresh();
      },
      saveFixedExpense: async (id, input) => {
        const db = await getDatabase();
        await updateFixedExpenseRow(id, input, db);
        await materializeMonth(activeMonthKey, db);
        await refresh();
      },
      removeFixedExpense: async (id) => {
        const db = await getDatabase();
        await deactivateFixedExpense(id, db);
        await refresh();
      },
      reorderFixedExpenses: async (orderedIds) => {
        const db = await getDatabase();
        await reorderFixedExpenses(orderedIds, db);
        await refresh();
      },
      setFixedExpenseActual: async (monthFixedExpenseId, actualCents) => {
        const db = await getDatabase();
        await setMonthFixedExpenseActual(monthFixedExpenseId, actualCents, db);
        await refresh();
      },
      addBudget: async (input) => {
        const db = await getDatabase();
        const sortOrder = budgets.length;
        await createBudget({ ...input, sortOrder }, db);
        await materializeMonth(activeMonthKey, db);
        await refresh();
      },
      saveBudget: async (id, input) => {
        const db = await getDatabase();
        await updateBudgetRow(id, input, db);
        await refresh();
      },
      removeBudget: async (id) => {
        const db = await getDatabase();
        await deleteBudgetRow(id, db);
        await refresh();
      },
      reorderBudgets: async (orderedIds) => {
        const db = await getDatabase();
        await reorderBudgets(orderedIds, db);
        await refresh();
      },
      addTransaction: async (input) => {
        const db = await getDatabase();
        assertActiveMonthDate(input.date, activeMonthKey, 'A transaction');
        await createTransaction(input, db);
        await upsertMerchantSuggestion(input.merchant, input.budgetId, db);
        await refresh();
      },
      saveTransaction: async (id, input) => {
        const db = await getDatabase();
        const existing = await getTransaction(id, db);
        if (existing?.originType === 'shared') {
          return;
        }
        assertActiveMonthDate(input.date, activeMonthKey, 'A transaction');
        await updateTransactionRow(id, input, db);
        await upsertMerchantSuggestion(input.merchant, input.budgetId, db);
        await refresh();
      },
      saveTransactionAttachment: async (id, attachment) => {
        const db = await getDatabase();
        await updateTransactionAttachment(id, attachment, db);
        await refresh();
      },
      setTransactionRating: async (id, rating) => {
        const db = await getDatabase();
        await setTransactionRating(id, rating, db);
        await refresh();
      },
      saveTransactionBudget: async (id, budgetId) => {
        const db = await getDatabase();
        await updateTransactionBudget(id, budgetId, db);
        await refresh();
      },
      removeTransaction: async (id) => {
        const db = await getDatabase();
        const existing = await getTransaction(id, db);
        if (existing?.originType === 'shared') {
          return;
        }
        await deleteTransactionRow(id, db);
        await refresh();
      },
      suggestBudgets: getMerchantSuggestions,
      addIncome: async (input) => {
        const db = await getDatabase();
        assertActiveMonthDate(input.date, activeMonthKey, 'One-off income');
        await createIncome(input, db);
        await refresh();
      },
      saveIncome: async (id, input) => {
        const db = await getDatabase();
        assertActiveMonthDate(input.date, activeMonthKey, 'One-off income');
        await updateIncomeRow(id, input, db);
        await refresh();
      },
      removeIncome: async (id) => {
        const db = await getDatabase();
        await deleteIncomeRow(id, db);
        await refresh();
      },
      addSubscription: async (input) => {
        const db = await getDatabase();
        const sortOrder = allSubscriptions.length;
        await createSubscription({ ...input, sortOrder }, db);
        await materializeMonth(activeMonthKey, db);
        await refresh();
      },
      saveSubscription: async (id, input) => {
        const db = await getDatabase();
        await updateSubscriptionRow(id, input, db);
        await materializeMonth(activeMonthKey, db);
        await refresh();
      },
      removeSubscription: async (id) => {
        const db = await getDatabase();
        await deleteSubscriptionRow(id, db);
        await materializeMonth(activeMonthKey, db);
        await refresh();
      },
      reorderSubscriptions: async (orderedIds) => {
        const db = await getDatabase();
        await reorderSubscriptions(orderedIds, db);
        await refresh();
      },
      closeCurrentMonth: async (monthKey) => {
        const db = await getDatabase();
        const closed = await settleMonth(monthKey, db);
        await refresh();
        return closed;
      },
      startMonth: async (input) => {
        const db = await getDatabase();
        await createPlannedMonth(input, db);
        // Shared expenses belonging to this month were held back while it did
        // not exist, because mirroring one may never create a month of its own.
        // Now that the user has planned it they can be recorded.
        await reconcileSharedTransactionsForLocalUser(db);
        await refresh();
      },
      replanMonth: async (input) => {
        const db = await getDatabase();
        await recordMonthPlan(input, db);
        await refresh();
      },
      refresh,
      syncSharedAndRefresh,
    };
  }, [ready, settings, syncState, recentTransactions, currentMonth, currentDashboard, pendingMonthKey, allFixedExpenses, budgets, allSubscriptions, allMonths, reserveHistory, activeMonthKey, refresh, syncSharedAndRefresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData(): AppData {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useAppData must be used within a DataProvider');
  }
  return context;
}