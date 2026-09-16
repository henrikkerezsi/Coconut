import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, List, Switch, Text, TextInput } from 'react-native-paper';
import type { Budget } from '../models';
import { AmountInput } from './amount-input';
import { useAppTheme } from '../theme';

export type BudgetDraft = Omit<Budget, 'id' | 'sortOrder'> & { sortOrder: number };

interface Props {
  initialData: Budget | null;
  currencySymbol: string;
  submitting: boolean;
  onSubmit: (draft: BudgetDraft) => void;
}

export function BudgetForm({ initialData, currencySymbol, submitting, onSubmit }: Props) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [defaultAmountCents, setDefaultAmountCents] = useState<number | null>(
    initialData?.defaultAmountCents ?? null
  );
  const [active, setActive] = useState(initialData?.active ?? true);
  const [amountError, setAmountError] = useState<string | null>(null);
  const theme = useAppTheme();

  const hasName = name.trim().length > 0;

  function handleSubmit() {
    setAmountError(null);
    if (!hasName) {
      return;
    }
    if (defaultAmountCents === null) {
      setAmountError('Enter a valid amount.');
      return;
    }
    if (defaultAmountCents < 0) {
      setAmountError('Amount cannot be negative.');
      return;
    }
    onSubmit({
      name: name.trim(),
      defaultAmountCents,
      active,
      sortOrder: initialData?.sortOrder ?? 0,
    });
  }

  return (
    <View style={styles.container}>
      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.field}
      />
      <AmountInput
        label="Default monthly amount"
        value={defaultAmountCents}
        onChange={setDefaultAmountCents}
        prefix={currencySymbol}
        error={amountError}
      />
      <List.Item
        title="Active"
        description="Included in the current month's planning"
        right={() => <Switch value={active} onValueChange={setActive} />}
      />
      <Button
        mode="contained"
        onPress={handleSubmit}
        disabled={submitting}
        loading={submitting}
        style={styles.submit}
      >
        Save
      </Button>
      {!hasName ? (
        <Text variant="bodySmall" style={[styles.generalError, { color: theme.colors.error }]}>
          Enter a name.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  submit: {
    marginTop: 8,
  },
  generalError: {
    marginTop: 8,
  },
});