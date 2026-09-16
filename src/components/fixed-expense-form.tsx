import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, List, Menu, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import type {
  EstimationStrategy,
  FixedExpense,
  FixedExpenseKind,
} from '../models';
import { AmountInput } from './amount-input';
import { useAppTheme } from '../theme';

export type FixedExpenseDraft = Omit<FixedExpense, 'id' | 'sortOrder'> & { sortOrder: number };

const STRATEGY_LABELS: Record<EstimationStrategy, string> = {
  manual: 'Manual',
  'last-month': 'Last month',
  average: 'Recent average',
  'history-average': 'All history',
};

const STRATEGY_HINTS: Record<EstimationStrategy, string> = {
  manual: 'Use the expected amount as-is.',
  'last-month': 'Estimate from the last actual amount.',
  average: 'Average of the last few actual amounts.',
  'history-average': 'Average of all recorded actuals.',
};

interface Props {
  initialData: FixedExpense | null;
  currencySymbol: string;
  submitting: boolean;
  onSubmit: (draft: FixedExpenseDraft) => void;
}

export function FixedExpenseForm({ initialData, currencySymbol, submitting, onSubmit }: Props) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [expectedAmountCents, setExpectedAmountCents] = useState<number | null>(
    initialData?.expectedAmountCents ?? null
  );
  const [kind, setKind] = useState<FixedExpenseKind>(initialData?.kind ?? 'variable');
  const [strategy, setStrategy] = useState<EstimationStrategy>(
    initialData?.estimationStrategy ?? 'manual'
  );
  const [averageMonths, setAverageMonths] = useState(
    String(initialData?.averageMonths ?? '3')
  );
  const [active, setActive] = useState(initialData?.active ?? true);
  const [strategyMenu, setStrategyMenu] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const theme = useAppTheme();

  const isVariable = kind === 'variable';
  const averageMonthsNumber = Number(averageMonths);
  const hasName = name.trim().length > 0;
  const hasAverageMonths =
    !isVariable || strategy !== 'average' || (Number.isInteger(averageMonthsNumber) && averageMonthsNumber > 0);

  function handleSubmit() {
    setAmountError(null);
    if (!hasName || !hasAverageMonths) {
      return;
    }
    if (expectedAmountCents === null) {
      setAmountError('Enter a valid amount.');
      return;
    }
    if (expectedAmountCents < 0) {
      setAmountError('Amount cannot be negative.');
      return;
    }
    setAmountError(null);
    onSubmit({
      name: name.trim(),
      expectedAmountCents,
      kind,
      recurrence: 'monthly',
      estimationStrategy: isVariable ? strategy : 'manual',
      averageMonths:
        isVariable && strategy === 'average' ? averageMonthsNumber : null,
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
        label={isVariable ? 'Expected amount' : 'Amount'}
        value={expectedAmountCents}
        onChange={setExpectedAmountCents}
        prefix={currencySymbol}
        error={amountError}
      />

      <SegmentedButtons
        value={kind}
        onValueChange={(value) => setKind(value as FixedExpenseKind)}
        buttons={[
          { value: 'variable', label: 'Variable' },
          { value: 'fixed', label: 'Fixed' },
        ]}
        style={styles.field}
      />

      {isVariable && (
        <>
          <Menu
            visible={strategyMenu}
            onDismiss={() => setStrategyMenu(false)}
            anchor={
              <List.Item
                title="Estimation strategy"
                description={STRATEGY_HINTS[strategy]}
                right={(props) => <List.Icon {...props} icon="chevron-down" />}
                onPress={() => setStrategyMenu(true)}
              />
            }
          >
            {(Object.keys(STRATEGY_LABELS) as EstimationStrategy[]).map((key) => (
              <Menu.Item
                key={key}
                title={STRATEGY_LABELS[key]}
                onPress={() => {
                  setStrategy(key);
                  setStrategyMenu(false);
                }}
              />
            ))}
          </Menu>

          {strategy === 'average' && (
            <TextInput
              label="Months to average"
              value={averageMonths}
              onChangeText={setAverageMonths}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.field}
            />
          )}
        </>
      )}

      <List.Item
        title="Active"
        description="Included in estimates and month planning"
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
      {!hasName || !hasAverageMonths ? (
        <Text variant="bodySmall" style={[styles.generalError, { color: theme.colors.error }]}>
          {!hasName
            ? 'Enter a name.'
            : !hasAverageMonths
              ? 'Months to average must be a whole number greater than zero.'
              : null}
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