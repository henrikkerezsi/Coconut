import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import type { MD3Colors } from 'react-native-paper/lib/typescript/types';
import {
  buildElevation,
  chartPalette,
  radii,
  spacing,
  typography,
  type ColorTokens,
} from './tokens';
import { buildSemanticColors } from './semantic';
import { buildFontScale } from './fonts';
import type { CoconutTheme, ThemeMode } from './types';

export function buildCoconutTheme(raw: ColorTokens, scheme: ThemeMode): CoconutTheme {
  const base = scheme === 'light' ? MD3LightTheme : MD3DarkTheme;
  const onContainerText = scheme === 'light' ? raw.primary.pressed : raw.text.primary;

  const colors: MD3Colors = {
    primary: raw.primary.base,
    onPrimary: raw.text.onAccent,
    primaryContainer: raw.primary.light,
    onPrimaryContainer: onContainerText,
    secondary: raw.secondary.base,
    onSecondary: raw.text.onAccent,
    secondaryContainer: raw.secondary.light,
    onSecondaryContainer: scheme === 'light' ? raw.secondary.pressed : raw.text.primary,
    tertiary: raw.water.base,
    onTertiary: raw.text.onAccent,
    tertiaryContainer: raw.water.light,
    onTertiaryContainer: scheme === 'light' ? raw.water.pressed : raw.text.primary,
    background: raw.surfaces.background,
    onBackground: raw.text.primary,
    surface: raw.surfaces.surface,
    onSurface: raw.text.primary,
    surfaceVariant: raw.surfaces.surfaceSecondary,
    onSurfaceVariant: raw.text.secondary,
    surfaceDisabled: raw.borders.borderSubtle,
    onSurfaceDisabled: raw.text.disabled,
    error: raw.semantic.error,
    onError: raw.text.onAccent,
    errorContainer: raw.semantic.errorLight,
    onErrorContainer: raw.semantic.onErrorContainer,
    outline: raw.borders.border,
    outlineVariant: raw.borders.borderSubtle,
    inverseSurface: scheme === 'light' ? raw.primary.pressed : raw.surfaces.background,
    inverseOnSurface: scheme === 'light' ? raw.text.onAccent : raw.text.primary,
    inversePrimary: scheme === 'light' ? raw.primary.muted : raw.primary.pressed,
    shadow: '#000000',
    scrim: '#000000',
    backdrop: scheme === 'light' ? 'rgba(41,37,31,0.5)' : 'rgba(0,0,0,0.7)',
    elevation: {
      level0: 'transparent',
      level1: raw.surfaces.elevation1,
      level2: raw.surfaces.elevation2,
      level3: raw.surfaces.elevation3,
      level4: raw.surfaces.elevation4,
      level5: raw.surfaces.elevation5,
    },
  };

  return {
    ...base,
    dark: scheme === 'dark',
    roundness: radii.medium,
    animation: { scale: 1 },
    version: 3,
    isV3: true,
    colors,
    fonts: buildFontScale(),
    scheme,
    semantic: buildSemanticColors(raw.semantic, raw.text.onAccent),
    brand: {
      primary: raw.primary,
      secondary: raw.secondary,
      water: raw.water,
      warm: raw.warm,
    },
    surfaces: raw.surfaces,
    borders: raw.borders,
    text: raw.text,
    spacing,
    radii,
    elevation: buildElevation(scheme === 'light' ? raw.primary.base : '#000000'),
    typography,
    chart: chartPalette,
  };
}