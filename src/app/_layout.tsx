import { Stack, ThemeProvider } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

import { CoconutThemeProvider, useAppTheme } from '../theme';
import { buildNavigationTheme } from '../theme/navigation';
import { DataProvider, useAppData } from '../data/DataProvider';

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
            name="fixed-expense/new"
            options={{ title: 'New Fixed Expense', headerShown: false }}
          />
          <Stack.Screen
            name="fixed-expense/[id]"
            options={{ title: 'Fixed Expense', headerShown: false }}
          />
          <Stack.Screen name="budget/new" options={{ title: 'New Budget', headerShown: false }} />
          <Stack.Screen name="budget/[id]" options={{ title: 'Budget', headerShown: false }} />
          <Stack.Screen name="about" options={{ title: 'About', headerShown: false }} />
          <Stack.Screen name="whats-new" options={{ title: "What's New", headerShown: false }} />
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