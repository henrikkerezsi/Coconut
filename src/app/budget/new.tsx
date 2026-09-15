import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { BudgetForm } from '../../components/budget-form';
import { LoadingScreen } from '../../components/loading-screen';

export default function NewBudgetScreen() {
  const router = useRouter();
  const { ready, settings, addBudget } = useAppData();
  const [submitting, setSubmitting] = useState(false);

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