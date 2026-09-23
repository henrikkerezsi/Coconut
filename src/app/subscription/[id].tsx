import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Appbar, Button } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { SubscriptionForm } from '../../components/subscription-form';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';

export default function EditSubscriptionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, settings, allSubscriptions, saveSubscription, removeSubscription } =
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
        <Appbar.Content title="Subscription" />
      </Appbar.Header>
      {loading ? (
        <LoadingScreen />
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={styles.container}>
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
                await saveSubscription(subscription.id, draft);
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
                removeSubscription(subscription!.id).then(() => router.back());
              }}
            >
              Delete subscription
            </Button>
          </View>
        </KeyboardAwareScrollView>
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