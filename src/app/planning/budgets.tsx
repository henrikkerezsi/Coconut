import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, Portal, Text as PaperText, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { LoadingScreen } from '../../components/loading-screen';
import { AmountInput } from '../../components/amount-input';
import { AppDialog } from '../../components/app-dialog';
import type { BudgetWithStatus } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';
import { FadeIn } from '../../components/fade-in';

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
  const [plannedError, setPlannedError] = useState<string | null>(null);
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
              <FadeIn key={status.monthBudgetId}>
                <List.Item
                  title={status.budget.name}
                  description={`${formatCents(status.status.spentCents, symbol)} spent`}
                  right={(props) => (
                    <PaperText {...props} style={styles.rowRight}>
                      {formatCents(status.plannedCents, symbol)}
                    </PaperText>
                  )}
                  onPress={() => {
                    setPlannedDraft(status.plannedCents);
                    setPlannedError(null);
                    setPlanned(status);
                  }}
                />
              </FadeIn>
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
          <FadeIn>
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
          </FadeIn>
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
          <AppDialog visible onDismiss={() => setPlanned(null)}>
            <AppDialog.Title>Planned this month</AppDialog.Title>
            <AppDialog.Content>
              <AmountInput
                label={planned.budget.name}
                value={plannedDraft}
                onChange={setPlannedDraft}
                prefix={symbol}
                error={plannedError}
              />
              <PaperText variant="bodySmall" style={styles.dialogHint}>
                Only affects the current month.
              </PaperText>
            </AppDialog.Content>
            <AppDialog.Actions>
              <List.Item title="Cancel" onPress={() => setPlanned(null)} />
              <List.Item
                title="Save"
                onPress={async () => {
                  if (plannedDraft === null) {
                    setPlannedError('Enter a valid amount.');
                    return;
                  }
                  setSaving(true);
                  try {
                    if (planned.monthBudgetId !== null) {
                      await setBudgetPlanned(planned.monthBudgetId, plannedDraft);
                    }
                  } finally {
                    setSaving(false);
                    setPlanned(null);
                  }
                }}
                disabled={saving}
              />
            </AppDialog.Actions>
          </AppDialog>
        </Portal>
      )}
      {deleteId !== null && (
        <Portal>
          <AppDialog visible onDismiss={() => setDeleteId(null)}>
            <AppDialog.Title>Delete budget?</AppDialog.Title>
            <AppDialog.Content>
              <PaperText variant="bodyMedium">
                Transactions already tagged with this budget keep their tags. This removes the current month&apos;s planned amount too. Past months keep their records.
              </PaperText>
            </AppDialog.Content>
            <AppDialog.Actions>
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
            </AppDialog.Actions>
          </AppDialog>
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