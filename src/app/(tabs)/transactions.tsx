import React, { useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, FAB, List, Searchbar, Text } from 'react-native-paper';
import { useAppData, type MonthDashboard } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { currentMonthKey, relativeDayLabel } from '../../utils/date';
import { LoadingScreen } from '../../components/loading-screen';
import { EmptyState } from '../../components/empty-state';
import { useAppTheme } from '../../theme';
import { ScreenFade } from '../../components/screen-fade';
import { FadeIn } from '../../components/fade-in';
import { MonthSwitcher } from '../../components/month-switcher';
import type { MonthKey, Transaction } from '../../models';

interface TransactionSection {
  title: string;
  data: Transaction[];
}

export default function TransactionsScreen() {
  const { ready, settings, currentDashboard, dashboardFor } = useAppData();
  const router = useRouter();
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const todayMonthKey = currentMonthKey();
  const [monthKey, setMonthKey] = useState<MonthKey>(todayMonthKey);
  const [monthDashboard, setMonthDashboard] = useState<MonthDashboard | null>(currentDashboard);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const viewingCurrentMonth = monthKey === todayMonthKey;

  useEffect(() => {
    if (viewingCurrentMonth) {
      return;
    }
    let active = true;
    dashboardFor(monthKey)
      .then((dashboard) => {
        if (active) {
          setMonthDashboard(dashboard);
          setLoadingMonth(false);
        }
      })
      .catch(() => {
        if (active) {
          setMonthDashboard(null);
          setLoadingMonth(false);
        }
      });
    return () => {
      active = false;
    };
  }, [monthKey, viewingCurrentMonth, currentDashboard, dashboardFor]);

  const changeMonth = (next: MonthKey) => {
    if (next !== monthKey) {
      setMonthKey(next);
      setMonthDashboard(null);
      setLoadingMonth(next !== todayMonthKey);
    }
  };

  const dashboard = viewingCurrentMonth ? currentDashboard : monthDashboard;

  const filtered = useMemo(() => {
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
  }, [query, dashboard]);

  const sections = useMemo<TransactionSection[]>(() => {
    const groups: TransactionSection[] = [];
    for (const transaction of filtered) {
      const last = groups[groups.length - 1];
      if (last && last.data[last.data.length - 1].date === transaction.date) {
        last.data.push(transaction);
      } else {
        groups.push({ title: relativeDayLabel(transaction.date), data: [transaction] });
      }
    }
    return groups;
  }, [filtered]);

  const total = dashboard?.transactions.reduce(
    (sum, transaction) => sum + transaction.amountCents,
    0
  ) ?? 0;

  return (
    <ScreenFade>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <MonthSwitcher value={monthKey} onChange={changeMonth} max={todayMonthKey} />
          ),
        }}
      />
      {!ready ? (
        <LoadingScreen />
      ) : (
        <View style={styles.container}>
        <Text style={styles.header} variant="titleMedium">
          {dashboard ? `${dashboard.transactions.length} transactions` : ''}
          {dashboard && dashboard.transactions.length > 0
            ? ` • ${formatCents(total, settings.currencySymbol)}`
            : ''}
        </Text>
        <Searchbar
          placeholder="Search transactions"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        {loadingMonth ? (
          <ActivityIndicator size="small" style={styles.spinner} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon={<Text variant="displaySmall">🛒</Text>}
                message={
                  query.trim().length > 0
                    ? 'No transactions match your search.'
                    : viewingCurrentMonth
                      ? 'No transactions this month yet.'
                      : 'No transactions in this month.'
                }
                actionLabel={
                  query.trim().length > 0 || !viewingCurrentMonth ? undefined : 'Add a transaction'
                }
                onAction={
                  query.trim().length > 0 || !viewingCurrentMonth
                    ? undefined
                    : () => router.push('/transaction/new')
                }
              />
            }
            renderSectionHeader={({ section }) => (
              <Text style={[styles.sectionHeader, { color: theme.text.secondary }]}>
                {`--- ${section.title} ---`}
              </Text>
            )}
            renderItem={({ item }) => (
              <FadeIn>
                <List.Item
                  title={item.merchant}
                  description={item.note ?? undefined}
                  left={(props) => <List.Icon {...props} icon="cash" />}
                  right={(props) => (
                    <View style={styles.right}>
                      <Text variant="bodyLarge">{formatCents(item.amountCents, settings.currencySymbol)}</Text>
                      <Text variant="labelSmall" style={styles.budgetLabel}>
                        {dashboard?.budgetNames.get(item.budgetId ?? -1) ?? ''}
                      </Text>
                      {item.attachmentName ? (
                        <MaterialCommunityIcons
                          name="paperclip"
                          size={14}
                          color={theme.colors.outline}
                          style={styles.paperclip}
                        />
                      ) : null}
                    </View>
                  )}
                  style={[styles.row, { borderRadius: theme.radii.medium }]}
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(item.id) } })}
                />
              </FadeIn>
            )}
          />
        )}
        {viewingCurrentMonth ? (
          <FAB icon="plus" style={styles.fab} onPress={() => router.push('/transaction/new')} />
        ) : null}
        </View>
      )}
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  spinner: {
    marginTop: 24,
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
  paperclip: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});