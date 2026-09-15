import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { FixedExpenseForm } from '../../components/fixed-expense-form';
import { LoadingScreen } from '../../components/loading-screen';

export default function NewFixedExpenseScreen() {
  const router = useRouter();
  const { ready, settings, addFixedExpense } = useAppData();
  const [submitting, setSubmitting] = useState(false);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="New fixed expense" />
      </Appbar.Header>
      <FixedExpenseForm
        initialData={null}
        currencySymbol={settings.currencySymbol}
        submitting={submitting}
        onSubmit={async (draft) => {
          setSubmitting(true);
          try {
            await addFixedExpense(draft);
            router.back();
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </>
  );
}