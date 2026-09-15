import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { FixedExpenseForm } from '../../components/fixed-expense-form';
import { LoadingScreen } from '../../components/loading-screen';

export default function EditFixedExpenseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, settings, allFixedExpenses, saveFixedExpense } = useAppData();
  const [submitting, setSubmitting] = useState(false);

  const expense =
    id !== undefined
      ? allFixedExpenses.find((expense) => expense.id === Number(id)) ?? null
      : null;
  const loading = !ready || (id !== undefined && expense === null);

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Fixed expense" />
      </Appbar.Header>
      {loading ? (
        <LoadingScreen />
      ) : (
        <FixedExpenseForm
          initialData={expense}
          currencySymbol={settings.currencySymbol}
          submitting={submitting}
          onSubmit={async (draft) => {
            if (expense === null) {
              return;
            }
            setSubmitting(true);
            try {
              await saveFixedExpense(expense.id, draft);
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