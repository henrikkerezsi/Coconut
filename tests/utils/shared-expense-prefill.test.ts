import { deriveSplitPrefill } from '../../src/utils/shared-expense-prefill';
import type { SharedExpenseSplit } from '../../src/models';

function split(id: number, memberId: number, amountCents: number): SharedExpenseSplit {
  return {
    id,
    uuid: null,
    expenseId: 1,
    memberId,
    amountCents,
    updatedAt: null,
  };
}

describe('deriveSplitPrefill', () => {
  it('derives equal split when every amount is identical', () => {
    const prefill = deriveSplitPrefill([1, 2], [split(1, 1, 2500), split(2, 2, 2500)]);
    expect(prefill.method).toBe('equal');
    expect(prefill.selected).toEqual({ 1: true, 2: true });
    expect(prefill.exact[1]).toBe('25.00');
  });

  it('derives exact split when amounts differ', () => {
    const prefill = deriveSplitPrefill([1, 2], [split(1, 1, 4000), split(2, 2, 6000)]);
    expect(prefill.method).toBe('exact');
    expect(prefill.selected[1]).toBe(true);
    expect(prefill.exact[2]).toBe('60.00');
  });

  it('marks members without a split as unselected with a zero amount', () => {
    const prefill = deriveSplitPrefill([1, 2, 3], [split(1, 1, 5000), split(2, 2, 5000)]);
    expect(prefill.selected).toEqual({ 1: true, 2: true, 3: false });
    expect(prefill.exact[3]).toBe('0.00');
  });

  it('derives exact for a single-member split', () => {
    const prefill = deriveSplitPrefill([1], [split(1, 1, 10000)]);
    expect(prefill.method).toBe('exact');
  });

  it('handles empty splits', () => {
    const prefill = deriveSplitPrefill([1, 2], []);
    expect(prefill.method).toBe('exact');
    expect(prefill.selected).toEqual({ 1: false, 2: false });
    expect(prefill.exact[2]).toBe('0.00');
  });
});