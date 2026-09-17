import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, List, Switch, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  const [color, setColor] = useState<string | null>(initialData?.color ?? null);
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
      color,
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
      <Text variant="labelLarge" style={styles.colorLabel}>
        Color
      </Text>
      <View style={styles.palette}>
        {theme.chart.map((option) => {
          const selected = color === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={`Budget color ${option}`}
              accessibilityState={{ selected }}
              onPress={() => setColor(option)}
              style={[
                styles.swatch,
                { backgroundColor: option },
                selected && { borderColor: theme.colors.primary },
              ]}
            >
              {selected ? (
                <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="No budget color"
          accessibilityState={{ selected: color === null }}
          onPress={() => setColor(null)}
          style={[
            styles.swatch,
            styles.noColor,
            { borderColor: theme.colors.outline },
            color === null && { borderColor: theme.colors.primary },
          ]}
        >
          <MaterialCommunityIcons
            name="close"
            size={16}
            color={color === null ? theme.colors.primary : theme.colors.outline}
          />
        </Pressable>
      </View>
      <Text variant="bodySmall" style={styles.colorHint}>
        Transactions tagged with this budget use the color for their icon.
      </Text>
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
  colorLabel: {
    marginTop: 16,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noColor: {
    backgroundColor: 'transparent',
  },
  colorHint: {
    marginTop: 8,
    opacity: 0.6,
  },
  submit: {
    marginTop: 8,
  },
  generalError: {
    marginTop: 8,
  },
});