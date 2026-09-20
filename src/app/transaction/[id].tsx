import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, List, Portal, Text } from 'react-native-paper';
import type { Transaction } from '../../models';
import { getTransaction } from '../../database/transactions';
import { getExpenseTraceByOriginId, type SharedExpenseTrace } from '../../database/sharedExpenses';
import { useAppData } from '../../data/DataProvider';
import { TransactionForm } from '../../components/transaction-form';
import { AppDialog } from '../../components/app-dialog';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';
import { formatCents } from '../../utils/currency';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { budgets, settings, saveTransaction, removeTransaction, suggestBudgets } = useAppData();
  const theme = useAppTheme();
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [trace, setTrace] = useState<SharedExpenseTrace | null>(null);

  useEffect(() => {
    getTransaction(Number(id)).then((result) => {
      if (result) {
        setTransaction(result);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!transaction || transaction.originType !== 'shared' || !transaction.originId) {
      return;
    }
    let active = true;
    getExpenseTraceByOriginId(transaction.originId).then((result) => {
      if (active) {
        setTrace(result);
      }
    });
    return () => {
      active = false;
    };
  }, [transaction]);

  if (!transaction) {
    return <LoadingScreen />;
  }

  const openSharedExpense = () => {
    if (!trace) {
      return;
    }
    router.push({
      pathname: '/shared/expense',
      params: { spaceId: String(trace.spaceId), id: String(trace.expenseId) },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {trace ? (
        <Card mode="outlined" style={styles.sharedCard}>
          <Card.Title
            title="Shared expense"
            subtitle={trace.spaceName}
            left={(props) => <List.Icon {...props} icon="account-group-outline" />}
          />
          <Card.Content>
            <View style={styles.traceRow}>
              <Text variant="bodyMedium">Paid by</Text>
              <Text variant="bodyMedium">{trace.paidByName}</Text>
            </View>
            <View style={styles.traceRow}>
              <Text variant="bodyMedium">Expense total</Text>
              <Text variant="bodyMedium">
                {formatCents(trace.totalAmountCents, settings.currencySymbol)}
              </Text>
            </View>
            <Text variant="bodySmall" style={styles.traceHint}>
              This transaction is derived from the shared expense and cannot be edited here.
            </Text>
            <Button mode="outlined" icon="open-in-new" onPress={openSharedExpense} style={styles.traceButton}>
              Open shared expense
            </Button>
          </Card.Content>
        </Card>
      ) : null}
      {transaction.originType === 'shared' ? (
        <View>
          <List.Item
            title={transaction.merchant}
            description="Merchant"
            left={(props) => <List.Icon {...props} icon="cash" />}
          />
          <List.Item
            title={formatCents(transaction.amountCents, settings.currencySymbol)}
            description="Amount"
            left={(props) => <List.Icon {...props} icon="currency-eur" />}
          />
          <List.Item
            title={transaction.date}
            description="Date"
            left={(props) => <List.Icon {...props} icon="calendar-outline" />}
          />
        </View>
      ) : (
        <>
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
              textColor={theme.semantic.delete}
              onPress={() => setConfirmDelete(true)}
            >
              Delete transaction
            </Button>
          </View>
        </>
      )}
      <Portal>
        <AppDialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <AppDialog.Title>Delete this transaction?</AppDialog.Title>
          <AppDialog.Content>
            <Text variant="bodyMedium">
              This transaction will be permanently removed from this month.
            </Text>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.semantic.delete}
              onPress={() => {
                setConfirmDelete(false);
                removeTransaction(transaction.id).then(() => router.back());
              }}
            >
              Delete
            </Button>
          </AppDialog.Actions>
        </AppDialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  sharedCard: {
    marginBottom: 16,
  },
  traceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  traceHint: {
    marginTop: 6,
    opacity: 0.6,
  },
  traceButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  deleteRow: {
    alignItems: 'center',
    marginTop: 16,
  },
});