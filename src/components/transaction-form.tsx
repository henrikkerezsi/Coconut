import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';
import type { Budget, MerchantSuggestion, Transaction } from '../models';
import { AmountInput } from './amount-input';
import { BudgetSelect } from './budget-select';
import { DateField } from './date-field';
import { DAYJS_STORE_DATE_FORMAT } from '../utils/date';
import dayjs from 'dayjs';
import type { TransactionInput } from '../database/transactions';
import { useAppTheme } from '../theme';

interface TransactionFormProps {
  initial?: Transaction;
  budgets: Budget[];
  symbol: string;
  suggestMerchant: (merchant: string) => Promise<MerchantSuggestion[]>;
  onSubmit: (input: TransactionInput) => Promise<void>;
}

export function TransactionForm({
  initial,
  budgets,
  symbol,
  suggestMerchant,
  onSubmit,
}: TransactionFormProps) {
  const [amount, setAmount] = useState<number | null>(initial?.amountCents ?? null);
  const [merchant, setMerchant] = useState(initial?.merchant ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [budgetId, setBudgetId] = useState<number | null>(initial?.budgetId ?? null);
  const [date, setDate] = useState(initial?.date ?? dayjs().format(DAYJS_STORE_DATE_FORMAT));
  const [suggestions, setSuggestions] = useState<MerchantSuggestion[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useAppTheme();

  useEffect(() => {
    const trimmed = merchant.trim();
    let active = true;
    suggestMerchant(trimmed).then((result) => {
      if (active) {
        setSuggestions(result);
      }
    });
    return () => {
      active = false;
    };
  }, [merchant, suggestMerchant]);

  const budgetSuggestions = useMemo(() => {
    const map = new Map<number, Budget>(budgets.map((budget) => [budget.id, budget]));
    return suggestions
      .map((suggestion) => map.get(suggestion.budgetId))
      .filter((budget): budget is Budget => budget !== undefined);
  }, [suggestions, budgets]);

  const handleSubmit = async () => {
    setError(null);
    if (amount === null || amount <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (merchant.trim().length === 0) {
      setError('Enter a merchant or description.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        date,
        amountCents: amount,
        budgetId,
        merchant: merchant.trim(),
        note: note.trim().length > 0 ? note.trim() : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <AmountInput
        label="Amount"
        value={amount}
        onChange={setAmount}
        autoFocus={!initial}
        error={error}
        prefix={symbol}
      />
      <TextInput
        label="Merchant"
        mode="outlined"
        value={merchant}
        onChangeText={setMerchant}
        placeholder="Where did you spend?"
        style={styles.field}
      />
      {budgetSuggestions.length > 0 ? (
        <View style={styles.suggestionRow}>
          <Text variant="labelSmall" style={styles.suggestionLabel}>
            Used before
          </Text>
          {budgetSuggestions.map((budget) => (
            <Chip
              key={budget.id}
              compact
              onPress={() => setBudgetId(budget.id)}
              style={styles.chip}
            >
              {budget.name}
            </Chip>
          ))}
        </View>
      ) : null}
      <BudgetSelect budgets={budgets} selectedId={budgetId} onSelect={setBudgetId} symbol={symbol} />
      <TextInput
        label="Note"
        mode="outlined"
        value={note}
        onChangeText={setNote}
        style={styles.field}
      />
      <DateField value={date} onChange={setDate} />
      <Button mode="contained" onPress={handleSubmit} loading={submitting} disabled={submitting} style={styles.submit}>
        Save
      </Button>
      {error ? (
        <Text variant="bodySmall" style={[styles.error, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  suggestionLabel: {
    marginRight: 8,
    opacity: 0.6,
  },
  chip: {
    marginRight: 6,
    marginVertical: 2,
  },
  submit: {
    marginTop: 20,
  },
  error: {
    marginTop: 8,
  },
});