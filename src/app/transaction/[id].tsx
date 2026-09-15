import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'react-native-paper';
import type { Transaction } from '../../models';
import { getTransaction } from '../../database/transactions';
import { useAppData } from '../../data/DataProvider';
import { TransactionForm } from '../../components/transaction-form';
import { LoadingScreen } from '../../components/loading-screen';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { budgets, settings, saveTransaction, removeTransaction, suggestBudgets } = useAppData();
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    getTransaction(Number(id)).then((result) => {
      if (result) {
        setTransaction(result);
      }
    });
  }, [id]);

  if (!transaction) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TransactionForm
        initial={transaction}
        budgets={budgets}
        symbol={settings.currencySymbol}
        suggestMerchant={suggestBudgets}
        onSubmit={async (input) => {
          await saveTransaction(transaction.id, input);
          router.back();
        }}
      />
      <View style={styles.deleteRow}>
        <Button
          mode="text"
          textColor="#c62828"
          onPress={() => {
            removeTransaction(transaction.id).then(() => router.back());
          }}
        >
          Delete transaction
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  deleteRow: {
    alignItems: 'center',
    marginTop: 16,
  },
});