import React, { useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, List, Text } from 'react-native-paper';
import { useAppData, type MonthDashboard } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { currentMonthKey, relativeDayLabel } from '../../utils/date';
import { EmptyState } from '../../components/empty-state';
import { LoadingScreen } from '../../components/loading-screen';
import { FadeIn } from '../../components/fade-in';
import { MonthSwitcher } from '../../components/month-switcher';
import { ScreenFade } from '../../components/screen-fade';
import { SharedExpenseTraceLabel } from '../../components/shared-expense-trace';
import { useAppTheme } from '../../theme';
import type { MonthKey, Transaction } from '../../models';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface TransactionSection {
  title: string;
  data: Transaction[];
}

export default function BudgetTransactionsScreen() {
  const { budgetId: budgetIdParam } = useLocalSearchParams<{ budgetId: string }>();
  const budgetId = Number(budgetIdParam);
  const router = useRouter();
  const theme = useAppTheme();
  const { ready, settings, currentDashboard, dashboardFor, budgets } = useAppData();
  const budget = budgets.find((entry) => entry.id === budgetId) ?? null;

  const todayMonthKey = currentMonthKey();
  const [monthKey, setMonthKey] = useState<MonthKey>(todayMonthKey);
  const [monthDashboard, setMonthDashboard] = useState<MonthDashboard | null>(null);
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
  }, [monthKey, viewingCurrentMonth, dashboardFor]);

  const changeMonth = (next: MonthKey) => {
    if (next !== monthKey) {
      setMonthKey(next);
      setMonthDashboard(null);
      setLoadingMonth(next !== todayMonthKey);
    }
  };

  const dashboard = viewingCurrentMonth ? currentDashboard : monthDashboard;

  const transactions = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    return dashboard.transactions.filter((transaction) => transaction.budgetId === budgetId);
  }, [dashboard, budgetId]);

  const sections = useMemo<TransactionSection[]>(() => {
    const groups: TransactionSection[] = [];
    for (const transaction of transactions) {
      const last = groups[groups.length - 1];
      if (last && last.data[last.data.length - 1].date === transaction.date) {
        last.data.push(transaction);
      } else {
        groups.push({ title: relativeDayLabel(transaction.date), data: [transaction] });
      }
    }
    return groups;
  }, [transactions]);

  const total = transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0);

  return (
    <ScreenFade>
      <Stack.Screen
        options={{
          title: budget?.name ?? 'Budget',
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
            {dashboard ? `${transactions.length} transactions` : ''}
            {dashboard && transactions.length > 0
              ? ` • ${formatCents(total, settings.currencySymbol)}`
              : ''}
          </Text>
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
                  icon={<Text variant="displaySmall">🍪</Text>}
                  message={
                    viewingCurrentMonth
                      ? 'No transactions in this budget this month.'
                      : 'No transactions in this budget in this month.'
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
                    description={
                      item.originType === 'shared' ? (
                        <SharedExpenseTraceLabel
                          originId={item.originId ?? null}
                          symbol={settings.currencySymbol}
                          fallback={item.note ?? 'Shared expense'}
                        />
                      ) : (
                        item.note ?? undefined
                      )
                    }
                    left={(props) => (
                      <List.Icon
                        {...props}
                        icon="cash"
                        color={budget?.color ?? undefined}
                      />
                    )}
                    right={(props) => (
                      <View style={styles.right}>
                        <Text variant="bodyLarge">{formatCents(item.amountCents, settings.currencySymbol)}</Text>
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
                    onPress={() =>
                      router.push({ pathname: '/transaction/[id]', params: { id: String(item.id) } })
                    }
                  />
                </FadeIn>
              )}
            />
          )}
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
    paddingBottom: 32,
    flexGrow: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  row: {
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  paperclip: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
});