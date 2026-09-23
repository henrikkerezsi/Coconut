import React from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { TransactionForm } from '../../components/transaction-form';

export default function NewTransactionScreen() {
  const { budgets, settings, addTransaction, suggestBudgets } = useAppData();
  const router = useRouter();

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <TransactionForm
        budgets={budgets}
        symbol={settings.currencySymbol}
        suggestMerchant={suggestBudgets}
        onSubmit={async (input) => {
          await addTransaction(input);
          router.back();
        }}
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
});