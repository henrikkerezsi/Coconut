export interface ElevationLevel {
  readonly shadowColor: string;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly elevation: number;
}

export interface ElevationScale {
  readonly level0: ElevationLevel;
  readonly level1: ElevationLevel;
  readonly level2: ElevationLevel;
  readonly level3: ElevationLevel;
  readonly level4: ElevationLevel;
  readonly level5: ElevationLevel;
}

export function buildElevation(shadowColor: string): ElevationScale {
  return {
    level0: {
      shadowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    level1: {
      shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    level2: {
      shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    level3: {
      shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 4,
    },
    level4: {
      shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: 8,
      elevation: 6,
    },
    level5: {
      shadowColor,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 8,
    },
  };
}