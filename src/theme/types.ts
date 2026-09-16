import type { MD3Theme } from 'react-native-paper';
import type {
  BorderColors,
  BrandScale,
  ElevationScale,
  RadiiScale,
  SpacingScale,
  SurfaceColors,
  TextColors,
  TypographyScale,
} from './tokens';
import type { SemanticColors } from './semantic';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

export type ThemeColors = MD3Theme['colors'];

export interface BrandTokens {
  readonly primary: BrandScale;
  readonly secondary: BrandScale;
  readonly water: BrandScale;
  readonly warm: BrandScale;
}

export type CoconutTheme = Omit<MD3Theme, 'colors'> & {
  readonly scheme: ThemeMode;
  readonly colors: ThemeColors;
  readonly brand: BrandTokens;
  readonly surfaces: SurfaceColors;
  readonly borders: BorderColors;
  readonly text: TextColors;
  readonly semantic: SemanticColors;
  readonly spacing: SpacingScale;
  readonly radii: RadiiScale;
  readonly elevation: ElevationScale;
  readonly typography: TypographyScale;
  readonly chart: readonly string[];
};