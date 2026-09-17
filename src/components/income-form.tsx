import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import type { Income } from '../models';
import { AmountInput } from './amount-input';
import { DateField } from './date-field';
import { DAYJS_STORE_DATE_FORMAT } from '../utils/date';
import dayjs from 'dayjs';
import type { IncomeInput } from '../database/income';
import { useAppTheme } from '../theme';

interface IncomeFormProps {
  initial?: Income;
  symbol: string;
  onSubmit: (input: IncomeInput) => Promise<void>;
}

export function IncomeForm({ initial, symbol, onSubmit }: IncomeFormProps) {
  const [amount, setAmount] = useState<number | null>(initial?.amountCents ?? null);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(initial?.date ?? dayjs().format(DAYJS_STORE_DATE_FORMAT));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useAppTheme();

  const handleSubmit = async () => {
    setError(null);
    if (amount === null || amount <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (description.trim().length === 0) {
      setError('Enter a description.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        date,
        amountCents: amount,
        description: description.trim(),
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
        label="Description"
        mode="outlined"
        value={description}
        onChangeText={setDescription}
        placeholder="Where did the money come from?"
        style={styles.field}
      />
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
  submit: {
    marginTop: 20,
  },
  error: {
    marginTop: 8,
  },
});