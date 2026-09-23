import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { remainingForBudget } from '../../services/allowance-service';
import { BudgetForm } from '../../components/budget-form';
import { LoadingScreen } from '../../components/loading-screen';

export default function NewBudgetScreen() {
  const router = useRouter();
  const { ready, settings, currentMonth, currentDashboard, budgets, addBudget } = useAppData();
  const [submitting, setSubmitting] = useState(false);

  const remainingCents = useMemo(() => {
    if (!currentMonth) {
      return undefined;
    }
    return remainingForBudget({
      allowanceCents: currentMonth.allowanceCents,
      expectedFixedExpensesCents: currentDashboard?.forecast.fixedExpectedTotalCents ?? 0,
      budgets: budgets
        .filter((budget) => budget.active)
        .map((budget) => ({ id: budget.id, amountCents: budget.defaultAmountCents })),
    });
  }, [currentMonth, currentDashboard, budgets]);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="New budget" />
      </Appbar.Header>
      <BudgetForm
        initialData={null}
        currencySymbol={settings.currencySymbol}
        remainingCents={remainingCents}
        submitting={submitting}
        onSubmit={async (draft) => {
          setSubmitting(true);
          try {
            await addBudget(draft);
            router.back();
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </>
  );
}