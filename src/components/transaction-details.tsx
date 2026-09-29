import React from 'react';
import { View } from 'react-native';
import { List } from 'react-native-paper';
import dayjs from 'dayjs';
import type { Transaction } from '../models';
import { formatCents } from '../utils/currency';

interface TransactionDetailsProps {
  transaction: Transaction;
  symbol: string;
  /** Rendered as a row when given, e.g. the budget a stored purchase sat in. */
  budgetName?: string;
}

/**
 * Read-only view of a transaction, used where editing is not possible: a
 * purchase derived from a shared expense, and any purchase of a month that has
 * already been closed.
 */
export function TransactionDetails({ transaction, symbol, budgetName }: TransactionDetailsProps) {
  return (
    <View>
      <List.Item
        title={transaction.merchant}
        description="Merchant"
        left={(props) => <List.Icon {...props} icon="cash" />}
      />
      <List.Item
        title={formatCents(transaction.amountCents, symbol)}
        description="Amount"
        left={(props) => <List.Icon {...props} icon="currency-eur" />}
      />
      <List.Item
        title={dayjs(transaction.date).format('ddd, D MMM YYYY')}
        description="Date"
        left={(props) => <List.Icon {...props} icon="calendar-outline" />}
      />
      {budgetName !== undefined ? (
        <List.Item
          title={budgetName.length > 0 ? budgetName : 'No budget'}
          description="Budget"
          left={(props) => <List.Icon {...props} icon="shape-outline" />}
        />
      ) : null}
      {transaction.note ? (
        <List.Item
          title={transaction.note}
          description="Note"
          left={(props) => <List.Icon {...props} icon="note-text-outline" />}
        />
      ) : null}
      {transaction.attachmentName ? (
        <List.Item
          title={transaction.attachmentName}
          description="Attachment"
          left={(props) => <List.Icon {...props} icon="paperclip" />}
        />
      ) : null}
    </View>
  );
}
