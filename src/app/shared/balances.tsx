import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import {
  ActivityIndicator,
  Card,
  Divider,
  List,
  Text as PaperText,
} from 'react-native-paper';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { SharedExpenseWithSplits, SharedSpace, SharedSpaceMember } from '../../models';
import { useAppData } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';
import { formatCents } from '../../utils/currency';
import { sharedMemberName } from '../../utils/shared-members';
import { getSharedSpace, getSpaceMembers } from '../../database/sharedSpaces';
import { getOpenPeriod } from '../../database/sharedPeriods';
import { listPeriodExpenses } from '../../database/sharedExpenses';
import { computeBalances, settleBalances } from '../../services/shared-expense-service';

export default function SharedBalancesScreen() {
  const params = useLocalSearchParams<{ spaceId: string }>();
  const spaceId = Number(params.spaceId);
  const { settings } = useAppData();
  const theme = useAppTheme();

  const [space, setSpace] = useState<SharedSpace | null>(null);
  const [members, setMembers] = useState<SharedSpaceMember[]>([]);
  const [expenses, setExpenses] = useState<SharedExpenseWithSplits[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setSpace(await getSharedSpace(spaceId));
    setMembers(await getSpaceMembers(spaceId));
    const open = await getOpenPeriod(spaceId);
    setExpenses(open ? await listPeriodExpenses(open.id) : []);
    setLoading(false);
  }, [spaceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members]
  );
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, sharedMemberName(member)])),
    [members]
  );
  const balances = useMemo(
    () =>
      computeBalances(
        activeMembers.map((member) => member.id),
        expenses.map(({ expense, splits }) => ({
          paidByMemberId: expense.paidByMemberId,
          totalAmountCents: expense.totalAmountCents,
          splits: splits.map((split) => ({
            memberId: split.memberId,
            amountCents: split.amountCents,
          })),
        }))
      ),
    [activeMembers, expenses]
  );
  const settlements = useMemo(() => settleBalances(balances), [balances]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <Card mode="elevated" style={styles.card}>
        <Card.Title title={space?.name ?? 'Balances'} subtitle="Current period" />
        <Card.Content style={styles.cardContent}>
          {balances.length === 0 ? (
            <PaperText variant="bodyMedium" style={styles.text}>
              Add members to see who owes what.
            </PaperText>
          ) : (
            balances.map((balance) => (
              <List.Item
                key={balance.memberId}
                title={memberNames.get(balance.memberId) ?? `Member #${balance.memberId}`}
                description={`Paid ${formatCents(
                  balance.paidCents,
                  settings.currencySymbol
                )} · share ${formatCents(balance.owedCents, settings.currencySymbol)}`}
                right={() => (
                  <PaperText
                    variant="titleMedium"
                    style={{
                      color:
                        balance.netCents > 0
                          ? theme.semantic.goodBudget
                          : balance.netCents < 0
                            ? theme.semantic.error
                            : theme.colors.onSurfaceVariant,
                    }}
                  >
                    {formatCents(balance.netCents, settings.currencySymbol)}
                  </PaperText>
                )}
              />
            ))
          )}
          {settlements.length > 0 ? (
            <>
              <Divider style={styles.divider} />
              <PaperText variant="labelLarge" style={styles.sectionLabel}>
                Settle up
              </PaperText>
              {settlements.map((settlement) => (
                <List.Item
                  key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
                  title={`${memberNames.get(settlement.fromMemberId) ?? 'Someone'} pays ${
                    memberNames.get(settlement.toMemberId) ?? 'someone'
                  }`}
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
    </KeyboardAwareScrollView>
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
  text: {
    marginBottom: 8,
  },
  divider: {
    marginVertical: 8,
  },
  sectionLabel: {
    marginBottom: 4,
  },
});
