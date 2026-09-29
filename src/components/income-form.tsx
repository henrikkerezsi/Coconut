import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import type { Income, MonthKey } from '../models';
import { AmountInput } from './amount-input';
import { DateField } from './date-field';
import { DAYJS_STORE_DATE_FORMAT, monthLabel } from '../utils/date';
import dayjs from 'dayjs';
import type { IncomeInput } from '../database/income';
import { useAppTheme } from '../theme';
import {
  activeMonthDateWindow,
  clampToActiveMonth,
  validateDateInActiveMonth,
} from '../services/active-month-service';

interface IncomeFormProps {
  initial?: Income;
  symbol: string;
  /**
   * The period the app is working on. One-off income can only be dated inside
   * it, so the date picker is limited to that month.
   */
  activeMonthKey: MonthKey;
  onSubmit: (input: IncomeInput) => Promise<void>;
}

export function IncomeForm({ initial, symbol, activeMonthKey, onSubmit }: IncomeFormProps) {
  const [amount, setAmount] = useState<number | null>(initial?.amountCents ?? null);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(() =>
    clampToActiveMonth(
      initial?.date ?? dayjs().format(DAYJS_STORE_DATE_FORMAT),
      activeMonthKey
    )
  );
  // The active month can arrive after the form opened, and moves on when a month
  // is closed while the form is still up, so a date that no longer fits the
  // active month is pulled into it.
  const [dateMonthKey, setDateMonthKey] = useState(activeMonthKey);
  if (dateMonthKey !== activeMonthKey) {
    setDateMonthKey(activeMonthKey);
    setDate(clampToActiveMonth(date, activeMonthKey));
  }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useAppTheme();
  const dateWindow = activeMonthDateWindow(activeMonthKey);

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
    const dateCheck = validateDateInActiveMonth(date, activeMonthKey, 'One-off income');
    if (!dateCheck.ok) {
      setError(dateCheck.error);
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
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'The income could not be saved.'
      );
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
      <DateField
        value={date}
        onChange={setDate}
        minimumDate={dateWindow.minimumDate}
        maximumDate={dateWindow.maximumDate}
      />
      <Text variant="labelSmall" style={[styles.monthHint, { color: theme.text.secondary }]}>
        {`Dates are limited to ${monthLabel(activeMonthKey)}.`}
      </Text>
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
  monthHint: {
    marginTop: 2,
  },
  error: {
    marginTop: 8,
  },
});