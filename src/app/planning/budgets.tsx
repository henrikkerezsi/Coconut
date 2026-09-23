import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FAB, IconButton, List, Portal, Text as PaperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { remainingForBudget } from '../../services/allowance-service';
import { LoadingScreen } from '../../components/loading-screen';
import { AmountInput } from '../../components/amount-input';
import { AppDialog } from '../../components/app-dialog';
import { DragHandle, ReorderableList } from '../../components/reorderable-list';
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
    currentMonth,
    currentDashboard,
    removeBudget,
    setBudgetPlanned,
    reorderBudgets,
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

  return (
    <>
      <ReorderableList
        items={budgets}
        keyExtractor={(item) => String(item.id)}
        rowHeight={64}
        onReorder={(next) => void reorderBudgets(next.map((budget) => budget.id))}
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
        ListEmptyComponent={
          <PaperText variant="bodyMedium" style={styles.empty}>
            No budget definitions yet. Add one to assign transactions to a budget.
          </PaperText>
        }
        renderRow={(item, { isDragged, handleProps }) => (
          <View
            style={[
              styles.definitionRow,
              isDragged
                ? {
                    backgroundColor: theme.colors.surface,
                    elevation: 4,
                    shadowColor: '#000000',
                    shadowOpacity: 0.16,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                  }
                : null,
            ]}
          >
            <DragHandle isDragged={isDragged} handleProps={handleProps} label={`Reorder ${item.name}`} />
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
              style={styles.definitionContent}
            />
          </View>
        )}
        contentContainerStyle={styles.content}
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
                <Text style={styles.remainingAmount}>
                  {formatCents(
                    remainingForBudget({
                      allowanceCents: currentMonth?.allowanceCents ?? 0,
                      expectedFixedExpensesCents:
                        currentDashboard?.forecast.fixedExpectedTotalCents ?? 0,
                      budgets: statuses.map((entry) => ({
                        id: entry.budget.id,
                        amountCents: entry.plannedCents,
                      })),
                      excludeBudgetId: planned.budget.id,
                    }),
                    symbol
                  )}
                </Text>{' '}
                remaining from allowance (including expected fixed expenses and other budgets, excluding this budget).
              </PaperText>
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
  remainingAmount: {
    fontWeight: '700',
  },
  definitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingRight: 8,
  },
  definitionContent: {
    flex: 1,
  },
});