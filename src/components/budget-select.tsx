import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, List, Modal, Portal, RadioButton, Text } from 'react-native-paper';
import type { Budget, Transaction } from '../models';
import type { BudgetWithStatus } from '../data/DataProvider';
import { budgetAvailableAmounts } from '../services/forecast-service';
import { formatCents } from '../utils/currency';
import { useAppTheme } from '../theme';

interface BudgetSelectProps {
  budgets: Budget[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  symbol?: string;
  /** The month's plan and spending per budget; the source of the available amount. */
  budgetStatuses?: readonly BudgetWithStatus[];
  /** The transaction being edited; its own amount is not counted as spent. */
  editedTransaction?: Transaction | null;
}

export function BudgetSelect({
  budgets,
  selectedId,
  onSelect,
  symbol = '',
  budgetStatuses = [],
  editedTransaction = null,
}: BudgetSelectProps) {
  const [visible, setVisible] = useState(false);
  const theme = useAppTheme();
  const selected = budgets.find((budget) => budget.id === selectedId);
  const availableByBudgetId = useMemo(
    () =>
      budgetAvailableAmounts(
        budgetStatuses.map((entry) => ({
          budgetId: entry.budget.id,
          plannedCents: entry.plannedCents,
          spentCents: entry.status.spentCents,
        })),
        editedTransaction
      ),
    [budgetStatuses, editedTransaction]
  );

  let description: string | null;
  if (!selected) {
    description = 'Transactions can exist without a budget';
  } else {
    const availableCents = availableByBudgetId.get(selected.id);
    description = availableCents === undefined ? null : formatCents(availableCents, symbol);
  }

  return (
    <>
      <List.Item
        title={selected ? selected.name : 'No budget'}
        description={description}
        left={(props) => <List.Icon {...props} icon="tag-outline" />}
        onPress={() => setVisible(true)}
      />
      <Portal>
        <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium" style={styles.title}>
            Budget
          </Text>
          <RadioButton.Group
            onValueChange={(value) => {
              onSelect(value === 'none' ? null : Number(value));
              setVisible(false);
            }}
            value={selectedId === null ? 'none' : String(selectedId)}
          >
            <RadioButton.Item label="No budget" value="none" />
            {budgets.map((budget) => (
              <RadioButton.Item key={budget.id} label={budget.name} value={String(budget.id)} />
            ))}
          </RadioButton.Group>
          <Button mode="text" onPress={() => setVisible(false)}>
            Cancel
          </Button>
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  modal: {
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 16,
  },
  title: {
    marginBottom: 8,
  },
});