import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, Portal, Dialog, Text as PaperText, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { LoadingScreen } from '../../components/loading-screen';
import { AmountInput } from '../../components/amount-input';
import type { BudgetWithStatus } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';

export default function BudgetsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const {
    ready,
    settings,
    budgets,
    currentDashboard,
    removeBudget,
    setBudgetPlanned,
  } = useAppData();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [planned, setPlanned] = useState<BudgetWithStatus | null>(null);
  const [plannedDraft, setPlannedDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;
  const statuses = currentDashboard?.budgetStatuses ?? [];
  const spentByBudgetId = new Map<number, number>();
  for (const status of statuses) {
    spentByBudgetId.set(status.budget.id, status.status.spentCents);
  }

  return (
    <>
      <FlatList
        ListHeaderComponent={
          <>
            <List.Subheader>Planned this month</List.Subheader>
            {statuses.map((status) => (
              <List.Item
                key={status.monthBudgetId}
                title={status.budget.name}
                description={`${formatCents(status.status.spentCents, symbol)} spent`}
                right={(props) => (
                  <PaperText {...props} style={styles.rowRight}>
                    {formatCents(status.plannedCents, symbol)}
                  </PaperText>
                )}
                onPress={() => {
                  setPlannedDraft(status.plannedCents);
                  setPlanned(status);
                }}
              />
            ))}
            {statuses.length === 0 && (
              <PaperText variant="bodyMedium" style={styles.empty}>
                No budgets in the current month yet.
              </PaperText>
            )}
            <List.Subheader>Definitions</List.Subheader>
          </>
        }
        data={budgets}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={`Default: ${formatCents(item.defaultAmountCents, symbol)}`}
            right={(props) => (
              <View {...props} style={styles.rowActions}>
                <IconButton icon="pencil-outline" onPress={() => router.push(`/budget/${item.id}`)} />
                <IconButton icon="delete-outline" onPress={() => setDeleteId(item.id)} />
              </View>
            )}
            onPress={() => router.push(`/budget/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <PaperText variant="bodyMedium" style={styles.empty}>
            No budget definitions yet. Add one to categorize transactions.
          </PaperText>
        }
      />
      {planned !== null && (
        <Portal>
          <Dialog visible onDismiss={() => setPlanned(null)}>
            <Dialog.Title>Planned this month</Dialog.Title>
            <Dialog.Content>
              <AmountInput
                label={planned.budget.name}
                value={plannedDraft}
                onChange={setPlannedDraft}
                prefix={symbol}
              />
              <PaperText variant="bodySmall" style={styles.dialogHint}>
                Only affects the current month.
              </PaperText>
            </Dialog.Content>
            <Dialog.Actions>
              <List.Item title="Cancel" onPress={() => setPlanned(null)} />
              <List.Item
                title="Save"
                onPress={async () => {
                  setSaving(true);
                  try {
                    if (planned.monthBudgetId !== null && plannedDraft !== null) {
                      await setBudgetPlanned(planned.monthBudgetId, plannedDraft);
                    }
                  } finally {
                    setSaving(false);
                    setPlanned(null);
                  }
                }}
                disabled={saving}
              />
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
      {deleteId !== null && (
        <Portal>
          <Dialog visible onDismiss={() => setDeleteId(null)}>
            <Dialog.Title>Delete budget?</Dialog.Title>
            <Dialog.Content>
              <PaperText variant="bodyMedium">
                Transactions already tagged with this budget keep their tags. Past months keep their records.
              </PaperText>
            </Dialog.Content>
            <Dialog.Actions>
              <List.Item title="Cancel" onPress={() => setDeleteId(null)} />
              <List.Item
                title="Delete"
                titleStyle={{ color: theme.semantic.delete }}
                onPress={async () => {
                  if (deleteId === null) {
                    return;
                  }
                  await removeBudget(deleteId);
                  setDeleteId(null);
                }}
              />
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
      <FAB
        icon="plus"
        label="Add"
        style={styles.fab}
        onPress={() => router.push('/budget/new')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 96,
  },
  empty: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 32,
    paddingHorizontal: 32,
  },
  rowRight: {
    alignSelf: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  dialogHint: {
    marginTop: 8,
    opacity: 0.6,
  },
});