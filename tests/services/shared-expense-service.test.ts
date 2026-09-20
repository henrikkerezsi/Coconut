import {
  buildPeriodReport,
  computeBalances,
  formatBasisPoints,
  parsePercentToBasisPoints,
  resolveEqualSplit,
  resolveExactSplit,
  resolvePercentageSplit,
  resolveSplit,
  settleBalances,
  validateExpense,
  type BalanceExpense,
} from '../../src/services/shared-expense-service';

describe('parsePercentToBasisPoints', () => {
  it('parses whole and decimal percentages', () => {
    expect(parsePercentToBasisPoints('50')).toBe(5000);
    expect(parsePercentToBasisPoints('33.33')).toBe(3333);
    expect(parsePercentToBasisPoints('0.5')).toBe(50);
  });

  it('rejects malformed input', () => {
    expect(parsePercentToBasisPoints('')).toBeNull();
    expect(parsePercentToBasisPoints('abc')).toBeNull();
    expect(parsePercentToBasisPoints('12.345')).toBeNull();
    expect(parsePercentToBasisPoints('-4')).toBeNull();
  });
});

describe('formatBasisPoints', () => {
  it('formats basis points back to percentages', () => {
    expect(formatBasisPoints(5000)).toBe('50.00');
    expect(formatBasisPoints(3333)).toBe('33.33');
  });
});

describe('resolveEqualSplit', () => {
  it('distributes an indivisible remainder deterministically', () => {
    const result = resolveEqualSplit(10000, [1, 2, 3]);
    expect(result).toEqual({
      ok: true,
      splits: [
        { memberId: 1, amountCents: 3334 },
        { memberId: 2, amountCents: 3333 },
        { memberId: 3, amountCents: 3333 },
      ],
    });
  });

  it('splits evenly when divisible', () => {
    const result = resolveEqualSplit(9000, [1, 2, 3]);
    expect(result).toEqual({
      ok: true,
      splits: [
        { memberId: 1, amountCents: 3000 },
        { memberId: 2, amountCents: 3000 },
        { memberId: 3, amountCents: 3000 },
      ],
    });
  });

  it('requires at least one member', () => {
    expect(resolveEqualSplit(1000, [])).toEqual({
      ok: false,
      error: 'Select at least one member to split with.',
    });
  });

  it('sums to the total', () => {
    const result = resolveEqualSplit(99999, [1, 2, 3, 4, 5, 6, 7]);
    if (!result.ok) {
      throw new Error('expected success');
    }
    expect(result.splits.reduce((sum, split) => sum + split.amountCents, 0)).toBe(99999);
  });
});

describe('resolveExactSplit', () => {
  it('accepts amounts that sum to the total', () => {
    const result = resolveExactSplit(10000, [
      { memberId: 1, amountCents: 4000 },
      { memberId: 2, amountCents: 6000 },
    ]);
    expect(result).toEqual({
      ok: true,
      splits: [
        { memberId: 1, amountCents: 4000 },
        { memberId: 2, amountCents: 6000 },
      ],
    });
  });

  it('rejects amounts that do not sum to the total', () => {
    const result = resolveExactSplit(10000, [
      { memberId: 1, amountCents: 4000 },
      { memberId: 2, amountCents: 5000 },
    ]);
    expect(result).toEqual({ ok: false, error: 'Split amounts must add up to the total.' });
  });

  it('rejects negative amounts', () => {
    const result = resolveExactSplit(1000, [{ memberId: 1, amountCents: -100 }]);
    expect(result).toEqual({ ok: false, error: 'Amounts cannot be negative.' });
  });
});

describe('resolvePercentageSplit', () => {
  it('resolves percentages to integer cents', () => {
    const result = resolvePercentageSplit(10000, [
      { memberId: 1, basisPoints: 3333 },
      { memberId: 2, basisPoints: 3333 },
      { memberId: 3, basisPoints: 3334 },
    ]);
    if (!result.ok) {
      throw new Error('expected success');
    }
    expect(result.splits.reduce((sum, split) => sum + split.amountCents, 0)).toBe(10000);
  });

  it('rejects percentages that do not sum to 100%', () => {
    const result = resolvePercentageSplit(10000, [
      { memberId: 1, basisPoints: 5000 },
      { memberId: 2, basisPoints: 4000 },
    ]);
    expect(result).toEqual({ ok: false, error: 'Percentages must add up to 100%.' });
  });
});

describe('resolveSplit', () => {
  it('rejects non-positive totals', () => {
    expect(resolveSplit('equal', 0, [{ memberId: 1 }])).toEqual({
      ok: false,
      error: 'Total must be greater than zero.',
    });
  });

  it('only splits between selected members for equal', () => {
    const result = resolveSplit('equal', 9000, [
      { memberId: 1, selected: true },
      { memberId: 2, selected: false },
      { memberId: 3, selected: true },
    ]);
    expect(result).toEqual({
      ok: true,
      splits: [
        { memberId: 1, amountCents: 4500 },
        { memberId: 3, amountCents: 4500 },
      ],
    });
  });
});

describe('validateExpense', () => {
  const base = {
    totalCents: 10000,
    description: 'Dinner',
    paidByMemberId: 1,
    memberIds: [1, 2],
    splits: [
      { memberId: 1, amountCents: 5000 },
      { memberId: 2, amountCents: 5000 },
    ],
  };

  it('accepts a well-formed expense', () => {
    expect(validateExpense(base)).toEqual({ ok: true });
  });

  it('rejects a missing description', () => {
    expect(validateExpense({ ...base, description: '  ' })).toEqual({
      ok: false,
      error: 'Description is required.',
    });
  });

  it('rejects a payer outside the split', () => {
    expect(validateExpense({ ...base, paidByMemberId: 9 })).toEqual({
      ok: false,
      error: 'Select who paid.',
    });
  });

  it('rejects splits that do not sum to the total', () => {
    expect(
      validateExpense({ ...base, splits: [{ memberId: 1, amountCents: 1000 }] })
    ).toEqual({ ok: false, error: 'Split amounts must add up to the total.' });
  });

  it('rejects unknown members', () => {
    expect(
      validateExpense({
        ...base,
        splits: [
          { memberId: 1, amountCents: 5000 },
          { memberId: 9, amountCents: 5000 },
        ],
      })
    ).toEqual({ ok: false, error: 'Split references an unknown member.' });
  });
});

describe('computeBalances', () => {
  it('nets paid against owed', () => {
    const expenses: BalanceExpense[] = [
      {
        paidByMemberId: 1,
        totalAmountCents: 10000,
        splits: [
          { memberId: 1, amountCents: 5000 },
          { memberId: 2, amountCents: 5000 },
        ],
      },
      {
        paidByMemberId: 2,
        totalAmountCents: 3000,
        splits: [
          { memberId: 1, amountCents: 1000 },
          { memberId: 2, amountCents: 2000 },
        ],
      },
    ];
    expect(computeBalances([1, 2], expenses)).toEqual([
      { memberId: 1, paidCents: 10000, owedCents: 6000, netCents: 4000 },
      { memberId: 2, paidCents: 3000, owedCents: 7000, netCents: -4000 },
    ]);
  });

  it('returns zero balances when there are no expenses', () => {
    expect(computeBalances([1, 2], [])).toEqual([
      { memberId: 1, paidCents: 0, owedCents: 0, netCents: 0 },
      { memberId: 2, paidCents: 0, owedCents: 0, netCents: 0 },
    ]);
  });
});

describe('settleBalances', () => {
  it('produces pairwise transfers that clear the balances', () => {
    const settlements = settleBalances([
      { memberId: 1, paidCents: 10000, owedCents: 6000, netCents: 4000 },
      { memberId: 2, paidCents: 3000, owedCents: 7000, netCents: -4000 },
    ]);
    expect(settlements).toEqual([{ fromMemberId: 2, toMemberId: 1, amountCents: 4000 }]);
  });

  it('handles multiple debtors and creditors deterministically', () => {
    const settlements = settleBalances([
      { memberId: 1, paidCents: 9000, owedCents: 3000, netCents: 6000 },
      { memberId: 2, paidCents: 2000, owedCents: 5000, netCents: -3000 },
      { memberId: 3, paidCents: 1000, owedCents: 4000, netCents: -3000 },
    ]);
    expect(settlements).toEqual([
      { fromMemberId: 2, toMemberId: 1, amountCents: 3000 },
      { fromMemberId: 3, toMemberId: 1, amountCents: 3000 },
    ]);
  });
});

describe('buildPeriodReport', () => {
  it('snapshots expenses, totals, balances and settlements', () => {
    const report = buildPeriodReport({
      spaceName: 'Home',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      closedAt: '2026-10-01T00:00:00.000Z',
      memberIds: [1, 2],
      members: [
        { memberId: 1, uuid: 'member-uuid-1', displayName: 'Alice', email: 'alice@example.com' },
        { memberId: 2, uuid: 'member-uuid-2', displayName: null, email: 'bob@example.com' },
      ],
      expenses: [
        {
          description: 'Rent',
          date: '2026-09-02',
          paidByMemberId: 1,
          totalAmountCents: 100000,
          splits: [
            { memberId: 1, amountCents: 50000 },
            { memberId: 2, amountCents: 50000 },
          ],
        },
      ],
    });
    expect(report.spaceName).toBe('Home');
    expect(report.expenses).toHaveLength(1);
    expect(report.members).toEqual([
      { memberId: 1, uuid: 'member-uuid-1', displayName: 'Alice', email: 'alice@example.com' },
      { memberId: 2, uuid: 'member-uuid-2', displayName: null, email: 'bob@example.com' },
    ]);
    expect(report.memberTotals).toEqual([
      { memberId: 1, paidCents: 100000 },
      { memberId: 2, paidCents: 0 },
    ]);
    expect(report.settlements).toEqual([
      { fromMemberId: 2, toMemberId: 1, amountCents: 50000 },
    ]);
  });

  it('embeds the member snapshot so names survive device-local id differences', () => {
    const report = buildPeriodReport({
      spaceName: 'Home',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      closedAt: '2026-10-01T00:00:00.000Z',
      memberIds: [7],
      members: [
        { memberId: 7, uuid: 'owner-uuid', displayName: 'Mia', email: 'mia@example.com' },
      ],
      expenses: [
        {
          description: 'Rent',
          date: '2026-09-02',
          paidByMemberId: 7,
          totalAmountCents: 10000,
          splits: [{ memberId: 7, amountCents: 10000 }],
        },
      ],
    });
    expect(report.members[0]).toEqual({
      memberId: 7,
      uuid: 'owner-uuid',
      displayName: 'Mia',
      email: 'mia@example.com',
    });
  });
});
