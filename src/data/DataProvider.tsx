import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  Budget,
  FixedExpense,
  MerchantSuggestion,
  Month,
  MonthFixedExpense,
  MonthKey,
  ReserveTransfer,
  Settings,
  Transaction,
} from '../models';
import { currentMonthKey } from '../utils/date';
import { getDatabase } from '../database/database';
import { getSettings, updateSettings } from '../database/settings';
import {
  closeMonth as persistCloseMonth,
  ensureCurrentMonth,
  getAllMonths,
  getMonth,
  materializeMonth,
  reopenMonth as persistReopenMonth,
  updateMonthAllowance,
} from '../database/months';
import {
  createFixedExpense,
  deleteFixedExpense as deleteFixedExpenseRow,
  getAllFixedExpenses,
  setMonthFixedExpenseActual,
  updateFixedExpense as updateFixedExpenseRow,
} from '../database/fixedExpenses';
import {
  createBudget,
  deleteBudget as deleteBudgetRow,
  getAllBudgets,
  setMonthBudgetPlanned,
  updateBudget as updateBudgetRow,
} from '../database/budgets';
import {
  createTransaction,
  deleteTransaction as deleteTransactionRow,
  getRecentTransactions,
  updateTransaction as updateTransactionRow,
  type TransactionInput,
} from '../database/transactions';
import {
  createReserveTransfer,
  deleteReserveTransfer,
  getMerchantSuggestions,
  upsertMerchantSuggestion,
} from '../database/reserve';
import { getMonthData } from '../database/queries';
import { projectReserve, type ReserveProjection } from '../services/reserve-service';
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
  budgetNames: Map<number, string>;
}

interface AppData {
  ready: boolean;
  settings: Settings;
  recentTransactions: Transaction[];
  currentMonth: Month | null;
  currentDashboard: MonthDashboard | null;
  allFixedExpenses: FixedExpense[];
  budgets: Budget[];
  allMonths: Month[];
  dashboardFor: (monthKey: MonthKey) => Promise<MonthDashboard | null>;
  setMonthlyAllowance: (cents: number) => Promise<void>;
  setInitialReserve: (cents: number) => Promise<void>;
  setCurrencySymbol: (symbol: string) => Promise<void>;
  setThemeMode: (mode: Settings['themeMode']) => Promise<void>;
  setRecentTransactionsCount: (count: number) => Promise<void>;
  addFixedExpense: (input: Omit<FixedExpense, 'id'>) => Promise<void>;
  saveFixedExpense: (id: number, input: Omit<FixedExpense, 'id'>) => Promise<void>;
  removeFixedExpense: (id: number) => Promise<void>;
  setFixedExpenseActual: (monthFixedExpenseId: number, actualCents: number | null) => Promise<void>;
  addBudget: (input: Omit<Budget, 'id'>) => Promise<void>;
  saveBudget: (id: number, input: Omit<Budget, 'id'>) => Promise<void>;
  removeBudget: (id: number) => Promise<void>;
  setBudgetPlanned: (monthBudgetId: number, plannedCents: number) => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  saveTransaction: (id: number, input: TransactionInput) => Promise<void>;
  removeTransaction: (id: number) => Promise<void>;
  suggestBudgets: (merchant: string) => Promise<MerchantSuggestion[]>;
  addReserveTransfer: (
    amountCents: number,
    direction: ReserveTransfer['direction'],
    note: string | null
  ) => Promise<void>;
  removeReserveTransfer: (id: number) => Promise<void>;
  closeCurrentMonth: () => Promise<void>;
  reopenCurrentMonth: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DataContext = createContext<AppData | null>(null);

async function buildDashboard(monthKey: MonthKey): Promise<MonthDashboard | null> {
  const data = await getMonthData(monthKey);
  if (!data) {
    return null;
  }
  const { month, fixedExpenses, budgets, transactions, transfers } = data;
  const forecast = forecastMonth({ month, fixedExpenses, budgets, transactions });
  const reserveProjection = projectReserve({
    startingReserveCents: month.startingReserveCents,
    actualSpendingCents: forecast.actualSpendingCents,
    allowanceCents: month.allowanceCents,
    transfers,
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

  const fixedExpenseStatuses: FixedExpenseWithStatus[] = fixedExpenses.map((instance) => ({
    instance,
    expense: fixedMap.get(instance.fixedExpenseId) ?? null,
  }));

  return {
    monthKey,
    forecast,
    reserveProjection,
    budgetStatuses,
    fixedExpenseStatuses,
    transactions,
    budgetNames: new Map(budgetDefinitions.map((budget) => [budget.id, budget.name])),
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
  });
  const [currentMonth, setCurrentMonth] = useState<Month | null>(null);
  const [currentDashboard, setCurrentDashboard] = useState<MonthDashboard | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allFixedExpenses, setAllFixedExpenses] = useState<FixedExpense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allMonths, setAllMonths] = useState<Month[]>([]);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    await ensureCurrentMonth(db);

    const nextSettings = await getSettings(db);
    setSettings(nextSettings);

    const monthKey = currentMonthKey();
    setCurrentMonth(await getMonth(monthKey, db));
    setCurrentDashboard(await buildDashboard(monthKey));
    setRecentTransactions(await getRecentTransactions(nextSettings.recentTransactionsCount, db));
    setAllFixedExpenses(await getAllFixedExpenses(db));
    setBudgets(await getAllBudgets(db));
    setAllMonths(await getAllMonths(db));
  }, []);

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
      recentTransactions,
      currentMonth,
      currentDashboard,
      allFixedExpenses,
      budgets,
      allMonths,
      dashboardFor: buildDashboard,
      setMonthlyAllowance: async (cents) => {
        const db = await getDatabase();
        await updateSettings({ monthlyAllowanceCents: cents }, db);
        await updateMonthAllowance(currentMonthKey(), cents, db);
        await refresh();
      },
      setInitialReserve: async (cents) => {
        const db = await getDatabase();
        await updateSettings({ initialReserveCents: cents }, db);
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
      addFixedExpense: async (input) => {
        const db = await getDatabase();
        const sortOrder = allFixedExpenses.length;
        await createFixedExpense({ ...input, sortOrder }, db);
        await materializeMonth(currentMonthKey(), db);
        await refresh();
      },
      saveFixedExpense: async (id, input) => {
        const db = await getDatabase();
        await updateFixedExpenseRow(id, input, db);
        await materializeMonth(currentMonthKey(), db);
        await refresh();
      },
      removeFixedExpense: async (id) => {
        const db = await getDatabase();
        await deleteFixedExpenseRow(id, db);
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
        await materializeMonth(currentMonthKey(), db);
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
      setBudgetPlanned: async (monthBudgetId, plannedCents) => {
        const db = await getDatabase();
        await setMonthBudgetPlanned(monthBudgetId, plannedCents, db);
        await refresh();
      },
      addTransaction: async (input) => {
        const db = await getDatabase();
        await createTransaction(input, db);
        await upsertMerchantSuggestion(input.merchant, input.budgetId ?? 0, db);
        await refresh();
      },
      saveTransaction: async (id, input) => {
        const db = await getDatabase();
        await updateTransactionRow(id, input, db);
        await upsertMerchantSuggestion(input.merchant, input.budgetId ?? 0, db);
        await refresh();
      },
      removeTransaction: async (id) => {
        const db = await getDatabase();
        await deleteTransactionRow(id, db);
        await refresh();
      },
      suggestBudgets: getMerchantSuggestions,
      addReserveTransfer: async (amountCents, direction, note) => {
        const db = await getDatabase();
        await createReserveTransfer(currentMonthKey(), amountCents, direction, note, db);
        await refresh();
      },
      removeReserveTransfer: async (id) => {
        const db = await getDatabase();
        await deleteReserveTransfer(id, db);
        await refresh();
      },
      closeCurrentMonth: async () => {
        const monthKey = currentMonthKey();
        const dashboard = await buildDashboard(monthKey);
        if (dashboard) {
          await persistCloseMonth(monthKey, dashboard.reserveProjection.endingReserveCents);
          await refresh();
        }
      },
      reopenCurrentMonth: async () => {
        await persistReopenMonth(currentMonthKey());
        await refresh();
      },
      refresh,
    };
  }, [ready, settings, recentTransactions, currentMonth, currentDashboard, allFixedExpenses, budgets, allMonths, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData(): AppData {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useAppData must be used within a DataProvider');
  }
  return context;
}