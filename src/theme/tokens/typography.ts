export interface TypeStyle {
  readonly fontSize: number;
  readonly fontWeight: '400' | '500' | '600' | '650' | '700';
  readonly lineHeight: number;
}

export interface TypographyScale {
  readonly screenTitle: TypeStyle;
  readonly sectionHeading: TypeStyle;
  readonly body: TypeStyle;
  readonly secondaryBody: TypeStyle;
  readonly caption: TypeStyle;
  readonly financialValue: TypeStyle;
}

export interface Fonts {
  readonly regular: string;
  readonly medium: string;
  readonly bold: string;
}

export const fonts: Fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const typography: TypographyScale = {
  screenTitle: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  sectionHeading: { fontSize: 19, fontWeight: '650', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 23 },
  secondaryBody: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  financialValue: { fontSize: 32, fontWeight: '700', lineHeight: 38 },
};