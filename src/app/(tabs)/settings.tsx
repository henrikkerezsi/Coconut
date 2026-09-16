import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Dialog, List, Portal, Text } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { AmountInput } from '../../components/amount-input';
import { LoadingScreen } from '../../components/loading-screen';

export default function SettingsScreen() {
  const { ready, settings, currentMonth, setMonthlyAllowance } = useAppData();
  const router = useRouter();
  const [allowanceDialog, setAllowanceDialog] = useState(false);
  const [allowanceDraft, setAllowanceDraft] = useState<number | null>(null);
  const [allowanceError, setAllowanceError] = useState<string | null>(null);

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <List.Section>
        <List.Subheader>Money</List.Subheader>
        <List.Item
          title="Monthly allowance"
          description={`${formatCents(settings.monthlyAllowanceCents, symbol)} per month`}
          left={(props) => <List.Icon {...props} icon="bank-outline" />}
          onPress={() => {
            setAllowanceDraft(settings.monthlyAllowanceCents);
            setAllowanceError(null);
            setAllowanceDialog(true);
          }}
        />
        <List.Item
          title="Savings reserve"
          description="Transfers, closing, initial reserve"
          left={(props) => <List.Icon {...props} icon="piggy-bank-outline" />}
          onPress={() => router.push('/planning/reserve')}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>Planning</List.Subheader>
        <List.Item
          title="Fixed expenses"
          description="Recurring bills and how they are estimated"
          left={(props) => <List.Icon {...props} icon="calendar-check-outline" />}
          onPress={() => router.push('/planning/fixed-expenses')}
        />
        <List.Item
          title="Flexible budgets"
          description="Discretionary spending categories"
          left={(props) => <List.Icon {...props} icon="tag-multiple-outline" />}
          onPress={() => router.push('/planning/budgets')}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>Data</List.Subheader>
        <List.Item
          title="Backup & restore"
          description="Export your data to a file, or restore it"
          left={(props) => <List.Icon {...props} icon="database-export-outline" />}
          onPress={() => router.push('/planning/backup')}
        />
      </List.Section>

      <Text variant="bodySmall" style={styles.about}>
        Coconut keeps all data on this device only. No network, no account, no tracking.
      </Text>

      <Portal>
        <Dialog visible={allowanceDialog} onDismiss={() => setAllowanceDialog(false)}>
          <Dialog.Title>Monthly allowance</Dialog.Title>
          <Dialog.Content>
            <AmountInput
              label="Allowance"
              value={allowanceDraft}
              onChange={setAllowanceDraft}
              prefix={symbol}
              error={allowanceError}
            />
            <Text variant="bodySmall" style={styles.dialogHint}>
              Applies to {currentMonth ? 'the current' : ''} and future months. Past months keep their own allowance.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <List.Item
              title="Cancel"
              onPress={() => setAllowanceDialog(false)}
              style={styles.cancelButton}
            />
            <List.Item
              title="Save"
              onPress={() => {
                if (allowanceDraft === null) {
                  setAllowanceError('Enter a valid amount.');
                  return;
                }
                if (allowanceDraft < 0) {
                  setAllowanceError('Amount cannot be negative.');
                  return;
                }
                setMonthlyAllowance(allowanceDraft);
                setAllowanceDialog(false);
              }}
            />
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  about: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 24,
    paddingHorizontal: 32,
  },
  dialogHint: {
    marginTop: 8,
    opacity: 0.6,
  },
  cancelButton: {
    paddingLeft: 8,
  },
});