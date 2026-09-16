import type { Palette } from './palette';

export interface SemanticColors {
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
}

export function buildSemanticColors(palette: Palette): SemanticColors {
  return {
    success: palette.green[700],
    successContainer: palette.green[100],
    onSuccess: '#FFFFFF',
    warning: palette.brown[400],
    warningContainer: palette.brown[50],
    onWarning: '#FFFFFF',
    overBudget: '#A63D40',
    goodBudget: palette.green[700],
    delete: '#A63D40',
    deleteContainer: '#FDDFDF',
  };
}
