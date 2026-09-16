import React, { createContext, useContext } from 'react';
import type { CoconutTheme } from './types';
import { lightTheme } from './light';

const ThemeContext = createContext<CoconutTheme>(lightTheme);

export function CoconutThemeProvider({
  theme,
  children,
}: {
  theme: CoconutTheme;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): CoconutTheme {
  return useContext(ThemeContext);
}

export { lightTheme };
export type { CoconutTheme, SemanticColors, ThemeColors } from './types';
export { lightPalette, darkPalette } from './palette';
export type { Palette } from './palette';
