import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { List, Portal, Text } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { AmountInput } from '../../components/amount-input';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';
import { AppDialog } from '../../components/app-dialog';

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
        <List.Item
          title="Yearly subscriptions"
          description="One-time yearly charges spread across the year"
          left={(props) => <List.Icon {...props} icon="calendar-refresh-outline" />}
          onPress={() => router.push('/planning/subscriptions')}
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

      <List.Section>
        <List.Subheader>About</List.Subheader>
        <List.Item
          title="Welcome tour"
          description="Replay the getting-started walkthrough"
          left={(props) => <List.Icon {...props} icon="compass-outline" />}
          onPress={() => router.push('/tutorial')}
        />
        <List.Item
          title="What's New"
          description="What changed in each release"
          left={(props) => <List.Icon {...props} icon="creation-outline" />}
          onPress={() => router.push('/whats-new')}
        />
        <List.Item
          title="About Coconut"
          description="Developer, version, source code"
          left={(props) => <List.Icon {...props} icon="information-outline" />}
          onPress={() => router.push('/about')}
        />
      </List.Section>

      <Portal>
        <AppDialog visible={recentCountDialog} onDismiss={() => setRecentCountDialog(false)}>
          <AppDialog.Title>Recent transactions</AppDialog.Title>
          <AppDialog.Content>
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
          </AppDialog.Content>
          <AppDialog.Actions>
            <List.Item title="Cancel" onPress={() => setRecentCountDialog(false)} />
          </AppDialog.Actions>
        </AppDialog>

        <AppDialog visible={appearanceDialog} onDismiss={() => setAppearanceDialog(false)}>
          <AppDialog.Title>Theme</AppDialog.Title>
          <AppDialog.Content>
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
          </AppDialog.Content>
          <AppDialog.Actions>
            <List.Item title="Cancel" onPress={() => setAppearanceDialog(false)} />
          </AppDialog.Actions>
        </AppDialog>

        <AppDialog visible={allowanceDialog} onDismiss={() => setAllowanceDialog(false)}>
          <AppDialog.Title>Monthly allowance</AppDialog.Title>
          <AppDialog.Content>
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
          </AppDialog.Content>
          <AppDialog.Actions>
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
          </AppDialog.Actions>
        </AppDialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  dialogHint: {
    marginTop: 8,
    opacity: 0.6,
  },
  cancelButton: {
    paddingLeft: 8,
  },
});