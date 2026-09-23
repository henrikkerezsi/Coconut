import React, { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { remainingForBudget } from '../../services/allowance-service';
import { BudgetForm } from '../../components/budget-form';
import { LoadingScreen } from '../../components/loading-screen';

export default function EditBudgetScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, settings, currentMonth, currentDashboard, budgets, saveBudget } = useAppData();
  const [submitting, setSubmitting] = useState(false);

  const budget =
    id !== undefined ? budgets.find((budget) => budget.id === Number(id)) ?? null : null;
  const loading = !ready || (id !== undefined && budget === null);

  const remainingCents = useMemo(() => {
    if (!currentMonth || budget === null) {
      return undefined;
    }
    return remainingForBudget({
      allowanceCents: currentMonth.allowanceCents,
      expectedFixedExpensesCents: currentDashboard?.forecast.fixedExpectedTotalCents ?? 0,
      budgets: budgets
        .filter((entry) => entry.active)
        .map((entry) => ({ id: entry.id, amountCents: entry.defaultAmountCents })),
      excludeBudgetId: budget.id,
    });
  }, [currentMonth, currentDashboard, budgets, budget]);

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Budget" />
      </Appbar.Header>
      {loading ? (
        <LoadingScreen />
      ) : (
        <BudgetForm
          initialData={budget}
          currencySymbol={settings.currencySymbol}
          remainingCents={remainingCents}
          submitting={submitting}
          onSubmit={async (draft) => {
            if (budget === null) {
              return;
            }
            setSubmitting(true);
            try {
              await saveBudget(budget.id, draft);
              router.back();
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
    </>
  );
}