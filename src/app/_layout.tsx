import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

import { CoconutThemeProvider, useAppTheme } from '../theme';
import { DataProvider, useAppData } from '../data/DataProvider';

function ThemedContent() {
  const theme = useAppTheme();

  return (
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
          name="fixed-expense/new"
          options={{ title: 'New Fixed Expense' }}
        />
        <Stack.Screen
          name="fixed-expense/[id]"
          options={{ title: 'Fixed Expense' }}
        />
        <Stack.Screen name="budget/new" options={{ title: 'New Budget' }} />
        <Stack.Screen name="budget/[id]" options={{ title: 'Budget' }} />
        <Stack.Screen
          name="planning/fixed-expenses"
          options={{ title: 'Fixed Expenses' }}
        />
        <Stack.Screen
          name="planning/budgets"
          options={{ title: 'Flexible Budgets' }}
        />
        <Stack.Screen
          name="planning/reserve"
          options={{ title: 'Savings Reserve' }}
        />
        <Stack.Screen
          name="planning/backup"
          options={{ title: 'Backup & Restore' }}
        />
      </Stack>
    </PaperProvider>
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