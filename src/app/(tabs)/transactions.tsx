import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FAB, List, Searchbar, Text } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { relativeDayLabel } from '../../utils/date';
import { LoadingScreen } from '../../components/loading-screen';
import { EmptyState } from '../../components/empty-state';
import { useAppTheme } from '../../theme';
import { ScreenFade } from '../../components/screen-fade';
import { FadeIn } from '../../components/fade-in';

export default function TransactionsScreen() {
  const { ready, settings, currentDashboard } = useAppData();
  const router = useRouter();
  const theme = useAppTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const dashboard = currentDashboard;
    if (!dashboard) {
      return [];
    }
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
      return dashboard.transactions;
    }
    return dashboard.transactions.filter((transaction) => {
      const merchantMatch = transaction.merchant.toLowerCase().includes(normalized);
      const noteMatch = (transaction.note ?? '').toLowerCase().includes(normalized);
      const budgetMatch = (dashboard.budgetNames.get(transaction.budgetId ?? -1) ?? '')
        .toLowerCase()
        .includes(normalized);
      return merchantMatch || noteMatch || budgetMatch;
    });
  }, [query, currentDashboard]);

  if (!ready) {
    return <LoadingScreen />;
  }

  const total = currentDashboard?.transactions.reduce(
    (sum, transaction) => sum + transaction.amountCents,
    0
  ) ?? 0;

  return (
    <ScreenFade>
      <View style={styles.container}>
        <Text style={styles.header} variant="titleMedium">
          {currentDashboard ? `${currentDashboard.transactions.length} transactions` : ''}
          {currentDashboard && currentDashboard.transactions.length > 0
            ? ` • ${formatCents(total, settings.currencySymbol)}`
            : ''}
        </Text>
        <Searchbar
          placeholder="Search transactions"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon={<Text variant="displaySmall">🛒</Text>}
              message={
                query.trim().length > 0
                  ? 'No transactions match your search.'
                  : 'No transactions this month yet.'
              }
              actionLabel={query.trim().length > 0 ? undefined : 'Add a transaction'}
              onAction={query.trim().length > 0 ? undefined : () => router.push('/transaction/new')}
            />
          }
          renderItem={({ item }) => (
            <FadeIn>
              <List.Item
                title={item.merchant}
                description={`${relativeDayLabel(item.date)}${item.note ? ` • ${item.note}` : ''}`}
                left={(props) => <List.Icon {...props} icon="cash" />}
                right={(props) => (
                  <View style={styles.right}>
                    <Text variant="bodyLarge">{formatCents(item.amountCents, settings.currencySymbol)}</Text>
                    <Text variant="labelSmall" style={styles.budgetLabel}>
                      {currentDashboard?.budgetNames.get(item.budgetId ?? -1) ?? ''}
                    </Text>
                  </View>
                )}
                style={[styles.row, { borderRadius: theme.radii.medium }]}
                onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(item.id) } })}
              />
            </FadeIn>
          )}
        />
        <FAB icon="plus" style={styles.fab} onPress={() => router.push('/transaction/new')} />
      </View>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    opacity: 0.7,
  },
  search: {
    margin: 12,
    marginBottom: 4,
  },
  listContent: {
    paddingBottom: 96,
    flexGrow: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  row: {
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  budgetLabel: {
    opacity: 0.6,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});