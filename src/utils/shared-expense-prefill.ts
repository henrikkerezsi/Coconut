import type { SharedExpenseSplit, SharedSplitMethod } from '../models';

export interface SplitPrefill {
  method: SharedSplitMethod;
  selected: Record<number, boolean>;
  exact: Record<number, string>;
  percent: Record<number, string>;
}

function centsToInput(amountCents: number): string {
  const integer = Math.floor(amountCents / 100);
  const fraction = (amountCents % 100).toString().padStart(2, '0');
  return `${integer}.${fraction}`;
}

export function deriveSplitPrefill(
  memberIds: number[],
  splits: SharedExpenseSplit[]
): SplitPrefill {
  const amounts = new Map<number, number>();
  for (const split of splits) {
    amounts.set(split.memberId, split.amountCents);
  }
  const selected: Record<number, boolean> = {};
  const exact: Record<number, string> = {};
  for (const memberId of memberIds) {
    const amountCents = amounts.get(memberId) ?? 0;
    selected[memberId] = amountCents > 0;
    exact[memberId] = centsToInput(amountCents);
  }
  const positiveAmounts = [...amounts.values()].filter((amount) => amount > 0);
  const allEqual =
    positiveAmounts.length >= 2 && positiveAmounts.every((amount) => amount === positiveAmounts[0]);
  return { method: allEqual ? 'equal' : 'exact', selected, exact, percent: {} };
}
