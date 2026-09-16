import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, List, Modal, Portal, RadioButton, Text } from 'react-native-paper';
import type { Budget } from '../models';
import { formatCents } from '../utils/currency';
import { useAppTheme } from '../theme';

interface BudgetSelectProps {
  budgets: Budget[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  symbol?: string;
}

export function BudgetSelect({ budgets, selectedId, onSelect, symbol = '' }: BudgetSelectProps) {
  const [visible, setVisible] = useState(false);
  const theme = useAppTheme();
  const selected = budgets.find((budget) => budget.id === selectedId);

  return (
    <>
      <List.Item
        title={selected ? selected.name : 'No category'}
        description={selected ? formatCents(selected.defaultAmountCents, symbol) : 'Transactions can exist without a category'}
        left={(props) => <List.Icon {...props} icon="tag-outline" />}
        onPress={() => setVisible(true)}
      />
      <Portal>
        <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium" style={styles.title}>
            Category
          </Text>
          <RadioButton.Group
            onValueChange={(value) => {
              onSelect(value === 'none' ? null : Number(value));
              setVisible(false);
            }}
            value={selectedId === null ? 'none' : String(selectedId)}
          >
            <RadioButton.Item label="No category" value="none" />
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