import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

import { theme } from '../theme';
import { DataProvider } from '../data/DataProvider';

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <DataProvider>
        <Stack>
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
      </DataProvider>
      <StatusBar style="auto" />
    </PaperProvider>
  );
}