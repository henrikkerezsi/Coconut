import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FAB, List, Text as PaperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { EVERGREEN_MONTH_KEY, monthLabel } from '../../utils/date';
import { LoadingScreen } from '../../components/loading-screen';
import { DragHandle, ReorderableList } from '../../components/reorderable-list';
import { useAppTheme } from '../../theme';
import type { Subscription } from '../../models';

function periodLabel(item: Subscription): string {
  if (item.endMonth === EVERGREEN_MONTH_KEY) {
    return 'Ongoing';
  }
  return `${monthLabel(item.startMonth)} \u2013 ${monthLabel(item.endMonth)}`;
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { ready, settings, allSubscriptions, reorderSubscriptions } =
    useAppData();

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;

  return (
    <>
      <ReorderableList
        items={allSubscriptions}
        keyExtractor={(item) => String(item.id)}
        rowHeight={64}
        onReorder={(next) => void reorderSubscriptions(next.map((item) => item.id))}
        ListHeaderComponent={<List.Subheader>Subscriptions</List.Subheader>}
        ListEmptyComponent={
          <PaperText variant="bodyMedium" style={styles.empty}>
            No subscriptions yet. Add a paid-over-time service to spread its cost monthly.
          </PaperText>
        }
        renderRow={(item, { isDragged, handleProps }) => (
          <View
            style={[
              styles.row,
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
              description={
                item.deductMonthly
                  ? `${formatCents(item.monthlyAmountCents, symbol)} per month \u00b7 ${periodLabel(item)}`
                  : periodLabel(item)
              }
              right={(props) => (
                <PaperText {...props} style={styles.rowRight}>
                  {formatCents(item.monthlyAmountCents, symbol)}
                </PaperText>
              )}
              onPress={() => router.push(`/subscription/${item.id}`)}
              style={styles.rowContent}
            />
          </View>
        )}
        contentContainerStyle={styles.content}
      />
      <FAB
        icon="plus"
        label="Add"
        style={styles.fab}
        onPress={() => router.push('/subscription/new')}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingRight: 8,
  },
  rowContent: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});