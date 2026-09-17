import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { SubscriptionForm } from '../../components/subscription-form';
import { LoadingScreen } from '../../components/loading-screen';

export default function NewSubscriptionScreen() {
  const router = useRouter();
  const { ready, settings, addYearlySubscription } = useAppData();
  const [submitting, setSubmitting] = useState(false);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="New yearly subscription" />
      </Appbar.Header>
      <SubscriptionForm
        initialData={null}
        currencySymbol={settings.currencySymbol}
        submitting={submitting}
        onSubmit={async (draft) => {
          setSubmitting(true);
          try {
            await addYearlySubscription(draft);
            router.back();
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </>
  );
}