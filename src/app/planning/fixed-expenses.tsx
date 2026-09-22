import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FAB, List, Portal, Text as PaperText, Divider, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { shortMonthLabel } from '../../utils/date';
import { LoadingScreen } from '../../components/loading-screen';
import { AmountInput } from '../../components/amount-input';
import { AppDialog } from '../../components/app-dialog';
import { useAppTheme } from '../../theme';
import { FadeIn } from '../../components/fade-in';
import { DragHandle, ReorderableList } from '../../components/reorderable-list';

export default function FixedExpensesScreen() {
  const router = useRouter();
  const {
    ready,
    settings,
    allFixedExpenses,
    currentDashboard,
    removeFixedExpense,
    setFixedExpenseActual,
    reorderFixedExpenses,
  } = useAppData();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actualId, setActualId] = useState<number | null>(null);
  const [actualDraft, setActualDraft] = useState<number | null>(null);
  const [actualError, setActualError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const theme = useAppTheme();

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;
  const statuses = currentDashboard?.fixedExpenseStatuses ?? [];
  const targeted = statuses.find((status) => status.instance.id === actualId) ?? null;

  return (
    <>
      <ReorderableList
        items={allFixedExpenses}
        keyExtractor={(item) => String(item.id)}
        rowHeight={72}
        onReorder={(next) => void reorderFixedExpenses(next.map((expense) => expense.id))}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <List.Item
                title="Current month"
                description="As planned this month"
                right={() => (
                  <List.Icon icon={allFixedExpenses.length > 0 ? 'check-circle-outline' : 'close-circle-outline'} />
                )}
              />
            </View>
            {statuses.map((status) => (
              <FadeIn key={status.instance.id}>
                <List.Item
                  title={status.expense?.name ?? 'Removed expense'}
                  description={`Planned: ${formatCents(status.instance.expectedAmountCents, symbol)}`}
                  right={(props) => (
                    <PaperText {...props} style={styles.rowRight}>
                      {status.instance.actualAmountCents === null
                        ? formatCents(status.instance.expectedAmountCents, symbol)
                        : formatCents(status.instance.actualAmountCents, symbol)}
                    </PaperText>
                  )}
                  onPress={() => {
                    setActualDraft(status.instance.actualAmountCents);
                    setActualError(null);
                    setActualId(status.instance.id);
                  }}
                />
              </FadeIn>
            ))}
            {statuses.length > 0 && <Divider />}
            <List.Subheader>Definitions</List.Subheader>
          </>
        }
        ListEmptyComponent={
          <PaperText variant="bodyMedium" style={styles.empty}>
            No fixed expenses yet. Add one to plan recurring bills.
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
              titleNumberOfLines={1}
              description={
                item.kind === 'fixed'
                  ? `${formatCents(item.expectedAmountCents, symbol)} · fixed`
                  : `${formatCents(item.expectedAmountCents, symbol)} · estimated from ${item.estimationStrategy.replace('-', ' ')}`
              }
              descriptionNumberOfLines={2}
              right={(props) => (
                <View {...props} style={styles.rowActions}>
                  <IconButton icon="pencil-outline" onPress={() => router.push(`/fixed-expense/${item.id}`)} />
                  <IconButton icon="delete-outline" onPress={() => setDeleteId(item.id)} />
                </View>
              )}
              onPress={() => router.push(`/fixed-expense/${item.id}`)}
              style={styles.definitionContent}
            />
          </View>
        )}
        contentContainerStyle={styles.content}
      />
      {statuses.length > 0 && (
        <Portal>
          <AppDialog visible={actualId !== null} onDismiss={() => setActualId(null)}>
            <AppDialog.Title>Actual charge</AppDialog.Title>
            <AppDialog.Content>
              <AmountInput
                label={targeted?.expense?.name ?? 'Amount'}
                value={actualDraft}
                onChange={setActualDraft}
                prefix={symbol}
                error={actualError}
              />
              <PaperText variant="bodySmall" style={styles.dialogHint}>
                Leave empty to keep the planned estimate for {targeted ? shortMonthLabel(targeted.instance.monthKey) : 'this month'}.
              </PaperText>
            </AppDialog.Content>
            <AppDialog.Actions>
              <List.Item title="Cancel" onPress={() => setActualId(null)} />
              <List.Item
                title="Save"
                onPress={async () => {
                  if (actualId === null) {
                    return;
                  }
                  if (actualDraft === null || actualDraft <= 0) {
                    setActualError('Enter a valid amount.');
                    return;
                  }
                  setSaving(true);
                  try {
                    await setFixedExpenseActual(actualId, actualDraft);
                  } finally {
                    setSaving(false);
                    setActualId(null);
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
            <AppDialog.Title>Delete fixed expense?</AppDialog.Title>
            <AppDialog.Content>
              <PaperText variant="bodyMedium">
                This removes the definition and its current-month instance. Past months keep their records.
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
                  await removeFixedExpense(deleteId);
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
        onPress={() => router.push('/fixed-expense/new')}
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
  header: {
    opacity: 0.8,
  },
  rowRight: {
    alignSelf: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  definitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    paddingRight: 8,
  },
  definitionContent: {
    flex: 1,
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