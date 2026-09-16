export interface RadiiScale {
  readonly small: number;
  readonly medium: number;
  readonly large: number;
  readonly xl: number;
  readonly dialog: number;
  readonly pill: number;
}

export const radii: RadiiScale = {
  small: 6,
  medium: 10,
  large: 14,
  xl: 18,
  dialog: 20,
  pill: 999,
};