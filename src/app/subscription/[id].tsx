import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Appbar, Button } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { SubscriptionForm } from '../../components/subscription-form';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';

export default function EditSubscriptionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, settings, allSubscriptions, saveYearlySubscription, removeYearlySubscription } =
    useAppData();
  const theme = useAppTheme();
  const [submitting, setSubmitting] = useState(false);

  const subscription =
    id !== undefined
      ? allSubscriptions.find((item) => item.id === Number(id)) ?? null
      : null;
  const loading = !ready || (id !== undefined && subscription === null);

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Yearly subscription" />
      </Appbar.Header>
      {loading ? (
        <LoadingScreen />
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <SubscriptionForm
            initialData={subscription}
            currencySymbol={settings.currencySymbol}
            submitting={submitting}
            onSubmit={async (draft) => {
              if (subscription === null) {
                return;
              }
              setSubmitting(true);
              try {
                await saveYearlySubscription(subscription.id, draft);
                router.back();
              } finally {
                setSubmitting(false);
              }
            }}
          />
          <View style={styles.deleteRow}>
            <Button
              mode="text"
              textColor={theme.semantic.delete}
              onPress={() => {
                removeYearlySubscription(subscription!.id).then(() => router.back());
              }}
            >
              Delete subscription
            </Button>
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  deleteRow: {
    alignItems: 'center',
    marginTop: 8,
  },
});