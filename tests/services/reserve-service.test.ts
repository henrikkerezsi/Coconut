import type { ReserveTransfer } from '../../src/models';
import {
  effectiveEndingReserve,
  projectReserve,
  sumTransfers,
} from '../../src/services/reserve-service';

function transfer(
  direction: ReserveTransfer['direction'],
  amountCents: number
): ReserveTransfer {
  return {
    id: 1,
    monthKey: '2026-09',
    direction,
    amountCents,
    note: null,
  };
}

describe('sumTransfers', () => {
  it('returns zero totals for no transfers', () => {
    expect(sumTransfers([])).toEqual({ toMonthCents: 0, toReserveCents: 0, netCents: 0 });
  });

  it('totals money moved into the month separately from money moved into the reserve', () => {
    const result = sumTransfers([transfer('to-month', 20000), transfer('to-reserve', 5000)]);
    expect(result.toMonthCents).toBe(20000);
    expect(result.toReserveCents).toBe(5000);
    expect(result.netCents).toBe(-15000);
  });
});

describe('projectReserve', () => {
  it('draws from the reserve when spending exceeds the allowance', () => {
    const result = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 60000,
      allowanceCents: 50000,
      transfers: [],
    });
    expect(result.endingReserveCents).toBe(90000);
    expect(result.adjustmentCents).toBe(-10000);
    expect(result.overspent).toBe(true);
  });

  it('grows the reserve when spending is below the allowance', () => {
    const result = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 40000,
      allowanceCents: 50000,
      transfers: [],
    });
    expect(result.endingReserveCents).toBe(110000);
    expect(result.adjustmentCents).toBe(10000);
  });

  it('applies transfers on top of the monthly adjustment', () => {
    const result = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 60000,
      allowanceCents: 50000,
      transfers: [transfer('to-month', 20000), transfer('to-reserve', 10000)],
    });
    expect(result.endingReserveCents).toBe(80000);
  });

  it('keeps the reserve unchanged when spending equals the allowance', () => {
    const result = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 50000,
      allowanceCents: 50000,
      transfers: [],
    });
    expect(result.endingReserveCents).toBe(100000);
  });

  it('counts one-off income as available money', () => {
    const result = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 60000,
      allowanceCents: 50000,
      incomeCents: 10000,
      transfers: [],
    });
    expect(result.adjustmentCents).toBe(0);
    expect(result.overspent).toBe(false);
    expect(result.endingReserveCents).toBe(100000);
  });

  it('adds unspent income to the reserve', () => {
    const result = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 40000,
      allowanceCents: 50000,
      incomeCents: 15000,
      transfers: [],
    });
    expect(result.adjustmentCents).toBe(25000);
    expect(result.endingReserveCents).toBe(125000);
  });
});

describe('effectiveEndingReserve', () => {
  it('uses the ending reserve when the month is closed', () => {
    expect(effectiveEndingReserve(95000, 100000)).toBe(95000);
  });

  it('falls back to the starting reserve for open months', () => {
    expect(effectiveEndingReserve(null, 100000)).toBe(100000);
  });
});