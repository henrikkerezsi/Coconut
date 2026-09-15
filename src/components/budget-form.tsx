import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, List, Switch, TextInput } from 'react-native-paper';
import type { Budget } from '../models';
import { AmountInput } from './amount-input';

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

  const canSubmit =
    name.trim().length > 0 && defaultAmountCents !== null && defaultAmountCents >= 0;

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
      />
      <List.Item
        title="Active"
        description="Included in the current month's planning"
        right={() => <Switch value={active} onValueChange={setActive} />}
      />
      <Button
        mode="contained"
        onPress={() => {
          if (!canSubmit || defaultAmountCents === null) {
            return;
          }
          onSubmit({
            name: name.trim(),
            defaultAmountCents,
            active,
            sortOrder: initialData?.sortOrder ?? 0,
          });
        }}
        disabled={!canSubmit || submitting}
        loading={submitting}
        style={styles.submit}
      >
        Save
      </Button>
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
});