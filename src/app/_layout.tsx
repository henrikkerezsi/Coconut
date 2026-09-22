import { Stack, ThemeProvider } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

import { CoconutThemeProvider, useAppTheme } from '../theme';
import { buildNavigationTheme } from '../theme/navigation';
import { DataProvider, useAppData } from '../data/DataProvider';
import { UpdateNotifier } from '../components/update-notifier';
import { AutoTutorial } from '../components/auto-tutorial';

function ThemedContent() {
  const theme = useAppTheme();
  const navigationTheme = buildNavigationTheme(theme);

  return (
    <ThemeProvider value={navigationTheme}>
      <PaperProvider theme={theme}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.onSurface,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="transaction/new"
            options={{ title: 'New Transaction', presentation: 'modal' }}
          />
          <Stack.Screen
            name="transaction/[id]"
            options={{ title: 'Transaction', presentation: 'modal' }}
          />
          <Stack.Screen
            name="income/new"
            options={{ title: 'New One-off Income', presentation: 'modal' }}
          />
          <Stack.Screen
            name="income/[id]"
            options={{ title: 'One-off Income', presentation: 'modal' }}
          />
          <Stack.Screen
            name="fixed-expense/new"
            options={{ title: 'New Fixed Expense', headerShown: false }}
          />
          <Stack.Screen
            name="fixed-expense/[id]"
            options={{ title: 'Fixed Expense', headerShown: false }}
          />
          <Stack.Screen name="budget/new" options={{ title: 'New Budget', headerShown: false }} />
          <Stack.Screen name="budget/[id]" options={{ title: 'Budget', headerShown: false }} />
          <Stack.Screen
            name="subscription/new"
            options={{ title: 'New Subscription', headerShown: false }}
          />
          <Stack.Screen
            name="subscription/[id]"
            options={{ title: 'Subscription', headerShown: false }}
          />
          <Stack.Screen name="about" options={{ title: 'About', headerShown: false }} />
          <Stack.Screen name="sync" options={{ title: 'Cloud Sync' }} />
          <Stack.Screen
            name="shared/expense"
            options={{ title: 'Shared Expense', presentation: 'modal' }}
          />
          <Stack.Screen name="shared/report/[id]" options={{ title: 'Shared Report' }} />
          <Stack.Screen name="shared/balances" options={{ title: 'Balances' }} />
          <Stack.Screen name="whats-new" options={{ title: "What's New", headerShown: false }} />
          <Stack.Screen name="monthly-history" options={{ title: 'Monthly History' }} />
          <Stack.Screen name="monthly-report/[monthKey]" options={{ title: 'Monthly Report' }} />
          <Stack.Screen
            name="planning/fixed-expenses"
            options={{ title: 'Fixed Expenses' }}
          />
          <Stack.Screen
            name="planning/budgets"
            options={{ title: 'Flexible Budgets' }}
          />
          <Stack.Screen
            name="planning/subscriptions"
            options={{ title: 'Subscriptions' }}
          />
          <Stack.Screen
            name="planning/reserve"
            options={{ title: 'Savings Reserve' }}
          />
          <Stack.Screen
            name="planning/backup"
            options={{ title: 'Backup & Restore' }}
          />
          <Stack.Screen
            name="tutorial"
            options={{ title: 'Coconut Tour', presentation: 'fullScreenModal', headerShown: false }}
          />
        </Stack>
        <UpdateNotifier />
        <AutoTutorial />
      </PaperProvider>
    </ThemeProvider>
  );
}

function ThemedApp() {
  const { settings } = useAppData();

  return (
    <CoconutThemeProvider preference={settings.themeMode}>
      <ThemedContent />
    </CoconutThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <DataProvider>
      <ThemedApp />
    </DataProvider>
  );
}