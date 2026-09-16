import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Dialog, List, Portal, Text } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { AmountInput } from '../../components/amount-input';
import { CoconutLogo } from '../../components/coconut-logo';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const RECENT_COUNT_OPTIONS = [3, 5, 8, 10, 15, 20];

export default function SettingsScreen() {
  const {
    ready,
    settings,
    currentMonth,
    setMonthlyAllowance,
    setThemeMode,
    setRecentTransactionsCount,
  } = useAppData();
  const theme = useAppTheme();
  const router = useRouter();
  const [allowanceDialog, setAllowanceDialog] = useState(false);
  const [allowanceDraft, setAllowanceDraft] = useState<number | null>(null);
  const [allowanceError, setAllowanceError] = useState<string | null>(null);
  const [appearanceDialog, setAppearanceDialog] = useState(false);
  const [recentCountDialog, setRecentCountDialog] = useState(false);

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

      <List.Section>
        <List.Subheader>Home screen</List.Subheader>
        <List.Item
          title="Recent transactions"
          description={`Show the last ${settings.recentTransactionsCount} transactions on the home screen`}
          left={(props) => <List.Icon {...props} icon="history" />}
          onPress={() => setRecentCountDialog(true)}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <List.Item
          title="Theme"
          description={`${THEME_OPTIONS.find((o) => o.value === settings.themeMode)?.label ?? 'System'}${
            settings.themeMode === 'system' ? ' (follows device)' : ''
          }`}
          left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
          onPress={() => setAppearanceDialog(true)}
        />
      </List.Section>

      <Text variant="bodySmall" style={styles.about}>
        Coconut keeps all data on this device only. No network, no account, no tracking.
      </Text>
      <View style={styles.aboutLogo}>
        <CoconutLogo size={36} />
      </View>

      <Portal>
        <Dialog visible={recentCountDialog} onDismiss={() => setRecentCountDialog(false)}>
          <Dialog.Title>Recent transactions</Dialog.Title>
          <Dialog.Content>
            {RECENT_COUNT_OPTIONS.map((count) => (
              <List.Item
                key={count}
                title={`Last ${count}`}
                onPress={() => {
                  setRecentTransactionsCount(count);
                  setRecentCountDialog(false);
                }}
                right={() =>
                  settings.recentTransactionsCount === count ? (
                    <List.Icon icon="check" color={theme.brand.primary.base} />
                  ) : null
                }
              />
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <List.Item title="Cancel" onPress={() => setRecentCountDialog(false)} />
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={appearanceDialog} onDismiss={() => setAppearanceDialog(false)}>
          <Dialog.Title>Theme</Dialog.Title>
          <Dialog.Content>
            {THEME_OPTIONS.map((option) => (
              <List.Item
                key={option.value}
                title={option.label}
                onPress={() => {
                  setThemeMode(option.value);
                  setAppearanceDialog(false);
                }}
                right={() =>
                  settings.themeMode === option.value ? (
                    <List.Icon icon="check" color={theme.brand.primary.base} />
                  ) : null
                }
              />
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <List.Item title="Cancel" onPress={() => setAppearanceDialog(false)} />
          </Dialog.Actions>
        </Dialog>

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
  aboutLogo: {
    alignItems: 'center',
    marginTop: 12,
  },
  dialogHint: {
    marginTop: 8,
    opacity: 0.6,
  },
  cancelButton: {
    paddingLeft: 8,
  },
});