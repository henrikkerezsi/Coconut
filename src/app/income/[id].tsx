import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, List, Text } from 'react-native-paper';
import type { Income } from '../../models';
import { getIncome } from '../../database/income';
import { useAppData } from '../../data/DataProvider';
import { IncomeForm } from '../../components/income-form';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';
import { formatCents } from '../../utils/currency';
import { monthLabel } from '../../utils/date';
import dayjs from 'dayjs';

export default function EditIncomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings, activeMonthKey, allMonths, saveIncome, removeIncome } = useAppData();
  const theme = useAppTheme();
  const router = useRouter();
  const [income, setIncome] = useState<Income | null>(null);

  useEffect(() => {
    getIncome(Number(id)).then((result) => {
      if (result) {
        setIncome(result);
      }
    });
  }, [id]);

  if (!income) {
    return <LoadingScreen />;
  }

  // A closed month is final, so its income is shown but never edited; it can
  // still be deleted, exactly like a transaction of a closed month.
  const isClosedMonth = allMonths.find((month) => month.monthKey === income.monthKey)?.isClosed ?? false;

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      {isClosedMonth ? (
        <View>
          <List.Item
            title={income.description}
            description="Description"
            left={(props) => <List.Icon {...props} icon="bank-transfer-in" />}
          />
          <List.Item
            title={formatCents(income.amountCents, settings.currencySymbol)}
            description="Amount"
            left={(props) => <List.Icon {...props} icon="currency-eur" />}
          />
          <List.Item
            title={dayjs(income.date).format('ddd, D MMM YYYY')}
            description="Date"
            left={(props) => <List.Icon {...props} icon="calendar-outline" />}
          />
          {income.note ? (
            <List.Item
              title={income.note}
              description="Note"
              left={(props) => <List.Icon {...props} icon="note-text-outline" />}
            />
          ) : null}
          <Text variant="bodySmall" style={styles.closedHint}>
            {`${monthLabel(income.monthKey)} is closed, so this income is read-only.`}
          </Text>
        </View>
      ) : (
        <IncomeForm
          initial={income}
          symbol={settings.currencySymbol}
          activeMonthKey={activeMonthKey}
          onSubmit={async (input) => {
            await saveIncome(income.id, input);
            router.back();
          }}
        />
      )}
      <View style={styles.deleteRow}>
        <Button
          mode="text"
          textColor={theme.semantic.delete}
          onPress={() => {
            removeIncome(income.id).then(() => router.back());
          }}
        >
          Delete one-off income
        </Button>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  deleteRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  closedHint: {
    marginTop: 12,
    opacity: 0.6,
  },
});