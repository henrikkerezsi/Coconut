import { MD3LightTheme } from 'react-native-paper';
import type { CoconutTheme, ThemeColors } from './types';
import { lightPalette } from './palette';
import { buildSemanticColors } from './semantic';

const palette = lightPalette;

const colors: ThemeColors = {
  ...MD3LightTheme.colors,
  primary: palette.brown[300],
  onPrimary: '#FFFFFF',
  primaryContainer: palette.brown[100],
  onPrimaryContainer: palette.brown[800],
  secondary: palette.green[600],
  onSecondary: '#FFFFFF',
  secondaryContainer: palette.green[100],
  onSecondaryContainer: palette.green[800],
  tertiary: palette.brown[400],
  onTertiary: '#FFFFFF',
  tertiaryContainer: palette.brown[50],
  onTertiaryContainer: palette.brown[800],
  error: '#A63D40',
  onError: '#FFFFFF',
  errorContainer: '#FDDFDF',
  onErrorContainer: '#8B2020',
  background: palette.green[100],
  onBackground: palette.brown[800],
  surface: palette.green[100],
  onSurface: palette.brown[800],
  surfaceVariant: palette.green[50],
  onSurfaceVariant: palette.brown[600],
  surfaceDisabled: palette.neutral[200],
  onSurfaceDisabled: palette.neutral[500],
  outline: palette.neutral[400],
  outlineVariant: palette.neutral[300],
  inverseSurface: palette.brown[700],
  inverseOnSurface: palette.neutral[100],
  inversePrimary: palette.brown[200],
  elevation: {
    level0: 'transparent',
    level1: palette.green[100],
    level2: palette.green[200],
    level3: palette.neutral[100],
    level4: palette.neutral[200],
    level5: palette.neutral[300],
  },
};

export const lightTheme: CoconutTheme = {
  ...MD3LightTheme,
  dark: false,
  colors,
  semantic: buildSemanticColors(palette),
  palette,
};
