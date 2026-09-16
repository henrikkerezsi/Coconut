import type { Palette } from './palette';
import type { MD3Theme } from 'react-native-paper';

export type ThemeColors = MD3Theme['colors'] & {
  readonly surfaceVariant: string;
  readonly onSurfaceDisabled: string;
  readonly outlineVariant: string;
  readonly inverseSurface: string;
  readonly inverseOnSurface: string;
  readonly inversePrimary: string;
};

export type SemanticColors = {
  readonly success: string;
  readonly successContainer: string;
  readonly onSuccess: string;
  readonly warning: string;
  readonly warningContainer: string;
  readonly onWarning: string;
  readonly overBudget: string;
  readonly goodBudget: string;
  readonly delete: string;
  readonly deleteContainer: string;
};

export type CoconutTheme = Omit<MD3Theme, 'colors'> & {
  readonly colors: ThemeColors;
  readonly semantic: SemanticColors;
  readonly palette: Palette;
};
