import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { BudgetForm } from '../../components/budget-form';
import { LoadingScreen } from '../../components/loading-screen';

export default function EditBudgetScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, settings, budgets, saveBudget } = useAppData();
  const [submitting, setSubmitting] = useState(false);

  const budget =
    id !== undefined ? budgets.find((budget) => budget.id === Number(id)) ?? null : null;
  const loading = !ready || (id !== undefined && budget === null);

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