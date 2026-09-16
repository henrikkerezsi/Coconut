import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme } from './light';
import { darkTheme } from './dark';
import type { CoconutTheme, ThemeMode, ThemePreference } from './types';

const ThemeContext = createContext<CoconutTheme>(lightTheme);

export function CoconutThemeProvider({
  preference = 'system',
  children,
}: {
  preference?: ThemePreference;
  children: React.ReactNode;
}) {
  const systemScheme = useColorScheme();
  const scheme: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const theme = useMemo(() => (scheme === 'dark' ? darkTheme : lightTheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): CoconutTheme {
  return useContext(ThemeContext);
}

export { lightTheme, darkTheme };
export type { CoconutTheme, ThemeMode, ThemePreference, ThemeColors, BrandTokens } from './types';