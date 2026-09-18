import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Card,
  Divider,
  List,
  Text as PaperText,
} from 'react-native-paper';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import dayjs from 'dayjs';
import type { SharedPeriodReport, SharedSpaceMember } from '../../../models';
import { useAppData } from '../../../data/DataProvider';
import { formatCents } from '../../../utils/currency';
import { getSpaceMembers } from '../../../database/sharedSpaces';
import { getPeriodReport } from '../../../database/sharedExpenses';

export default function SharedReportScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const periodId = Number(params.id);
  const { settings } = useAppData();
  const [report, setReport] = useState<SharedPeriodReport | null>(null);
  const [members, setMembers] = useState<SharedSpaceMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const entry = await getPeriodReport(periodId);
    setReport(entry);
    if (entry) {
      setMembers(await getSpaceMembers(entry.spaceId));
    }
    setLoading(false);
  }, [periodId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.centered}>
        <PaperText variant="bodyLarge">This report is no longer available.</PaperText>
      </View>
    );
  }

  const names = new Map(
    members.map((member) => [
      member.id,
      member.displayName ?? member.email ?? `Member #${member.id}`,
    ])
  );
  const nameOf = (id: number): string => names.get(id) ?? `Member #${id}`;
  const { report: data } = report;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title={data.spaceName}
          subtitle={`${dayjs(data.periodStart).format('D MMM YYYY')} – ${dayjs(data.periodEnd).format('D MMM YYYY')}`}
        />
        <Card.Content>
          <PaperText variant="bodySmall" style={styles.hint}>
            Closed {dayjs(data.closedAt).format('D MMM YYYY, HH:mm')}
          </PaperText>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Expenses" />
        <Card.Content style={styles.cardContent}>
          {data.expenses.map((expense, index) => (
            <List.Item
              key={`${expense.description}-${index}`}
              title={expense.description}
              description={`${dayjs(expense.date).format('D MMM')} · paid by ${nameOf(
                expense.paidByMemberId
              )}`}
              right={() => (
                <PaperText variant="titleMedium">
                  {formatCents(expense.totalAmountCents, settings.currencySymbol)}
                </PaperText>
              )}
            />
          ))}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Balances" />
        <Card.Content style={styles.cardContent}>
          {data.balances.map((balance) => (
            <List.Item
              key={balance.memberId}
              title={nameOf(balance.memberId)}
              description={`Paid ${formatCents(balance.paidCents, settings.currencySymbol)} · share ${formatCents(
                balance.owedCents,
                settings.currencySymbol
              )}`}
              right={() => (
                <PaperText variant="titleMedium">
                  {formatCents(balance.netCents, settings.currencySymbol)}
                </PaperText>
              )}
            />
          ))}
          {data.settlements.length > 0 ? (
            <>
              <Divider style={styles.divider} />
              <PaperText variant="labelLarge" style={styles.sectionLabel}>
                Settle up
              </PaperText>
              {data.settlements.map((settlement) => (
                <List.Item
                  key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
                  title={`${nameOf(settlement.fromMemberId)} pays ${nameOf(settlement.toMemberId)}`}
                  right={() => (
                    <PaperText variant="titleMedium">
                      {formatCents(settlement.amountCents, settings.currencySymbol)}
                    </PaperText>
                  )}
                  left={(props) => <List.Icon {...props} icon="swap-horizontal" />}
                />
              ))}
            </>
          ) : null}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    paddingHorizontal: 16,
  },
  hint: {
    opacity: 0.6,
  },
  divider: {
    marginVertical: 8,
  },
  sectionLabel: {
    marginBottom: 4,
  },
});
