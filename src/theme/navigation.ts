import type { Theme } from 'expo-router';
import { DarkTheme, DefaultTheme } from 'expo-router';
import type { CoconutTheme } from './types';

export function buildNavigationTheme(theme: CoconutTheme): Theme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: theme.scheme === 'dark',
    colors: {
      ...base.colors,
      primary: theme.brand.primary.base,
      background: theme.surfaces.background,
      card: theme.surfaces.surface,
      text: theme.text.primary,
      border: theme.borders.border,
      notification: theme.semantic.info,
    },
  };
}