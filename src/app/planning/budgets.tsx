import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FAB, IconButton, List, Portal, Text as PaperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { LoadingScreen } from '../../components/loading-screen';
import { AppDialog } from '../../components/app-dialog';
import { DragHandle, ReorderableList } from '../../components/reorderable-list';
import { useAppTheme } from '../../theme';

/**
 * The budgets themselves: what a category is for and what it is planned to cost
 * by default. The amount the month at hand stands at is not a definition, so it
 * is not edited here: the month's plan is changed in one explicit action in
 * planning, which records what changed.
 */
export default function BudgetsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { ready, settings, budgets, removeBudget, reorderBudgets } = useAppData();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;

  return (
    <>
      <ReorderableList
        items={budgets}
        keyExtractor={(item) => String(item.id)}
        rowHeight={64}
        onReorder={(next) => void reorderBudgets(next.map((budget) => budget.id))}
        ListHeaderComponent={
          <>
            <List.Item
              title="Plan this month"
              description="Set what you expect to spend in each budget this month"
              left={(props) => <List.Icon {...props} icon="calendar-edit-outline" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/planning/month')}
            />
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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
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
