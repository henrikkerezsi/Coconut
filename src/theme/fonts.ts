import type { MD3Type, MD3Typescale } from 'react-native-paper/lib/typescript/types';
import { fonts } from './tokens/typography';

function makeType(
  fontSize: number,
  fontWeight: MD3Type['fontWeight'],
  lineHeight: number,
  letterSpacing = 0.15
): MD3Type {
  return { fontFamily: fonts.regular, fontSize, fontWeight, lineHeight, letterSpacing };
}

export function buildFontScale(): MD3Typescale {
  return {
    displayLarge: makeType(32, '700', 38, 0.2),
    displayMedium: makeType(28, '700', 34, 0.2),
    displaySmall: makeType(24, '600', 30, 0.2),
    headlineLarge: makeType(22, '600', 28),
    headlineMedium: makeType(20, '600', 26),
    headlineSmall: makeType(18, '600', 24),
    titleLarge: makeType(20, '600', 26),
    titleMedium: makeType(19, '600', 24),
    titleSmall: makeType(16, '600', 22),
    labelLarge: makeType(14, '600', 20),
    labelMedium: makeType(12, '600', 16),
    labelSmall: makeType(11, '500', 14),
    bodyLarge: makeType(16, '400', 23),
    bodyMedium: makeType(14, '400', 20),
    bodySmall: makeType(12, '500', 16, 0.4),
    default: {
      fontFamily: fonts.regular,
      fontWeight: '400',
      letterSpacing: 0.15,
    },
  };
}