import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { TransactionForm } from '../../components/transaction-form';

export default function NewTransactionScreen() {
  const { budgets, settings, addTransaction, suggestBudgets } = useAppData();
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TransactionForm
        budgets={budgets}
        symbol={settings.currencySymbol}
        suggestMerchant={suggestBudgets}
        onSubmit={async (input) => {
          await addTransaction(input);
          router.back();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
});