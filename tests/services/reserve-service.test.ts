import {
  AUTOMATIC_TRANSFER_NOTE,
  buildAutomaticReserveTransfer,
  effectiveEndingReserve,
  projectReserve,
} from '../../src/services/reserve-service';

describe('projectReserve', () => {
  it('draws from the reserve when spending exceeds the allowance', () => {
    const result = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 60000,
      allowanceCents: 50000,
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
    });
    expect(result.endingReserveCents).toBe(110000);
    expect(result.adjustmentCents).toBe(10000);
  });

  it('keeps the reserve unchanged when spending equals the allowance', () => {
    const result = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 50000,
      allowanceCents: 50000,
    });
    expect(result.endingReserveCents).toBe(100000);
  });

  it('counts one-off income as available money', () => {
    const result = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 60000,
      allowanceCents: 50000,
      incomeCents: 10000,
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
    });
    expect(result.adjustmentCents).toBe(25000);
    expect(result.endingReserveCents).toBe(125000);
  });
});

describe('buildAutomaticReserveTransfer', () => {
  it('records unspent money as a move into the reserve', () => {
    expect(buildAutomaticReserveTransfer(25000)).toEqual({
      amountCents: 25000,
      direction: 'to-reserve',
      note: AUTOMATIC_TRANSFER_NOTE,
    });
  });

  it('records overspending as a draw from the reserve into the month', () => {
    expect(buildAutomaticReserveTransfer(-10000)).toEqual({
      amountCents: 10000,
      direction: 'to-month',
      note: AUTOMATIC_TRANSFER_NOTE,
    });
  });

  it('records a zero adjustment as no movement in either direction', () => {
    const result = buildAutomaticReserveTransfer(0);
    expect(result.amountCents).toBe(0);
    expect(result.direction).toBe('to-reserve');
  });

  it('always records the amount as a positive magnitude', () => {
    expect(buildAutomaticReserveTransfer(-10000).amountCents).toBe(10000);
    expect(buildAutomaticReserveTransfer(10000).amountCents).toBe(10000);
  });

  it('agrees with the adjustment the projection reports', () => {
    const projection = projectReserve({
      startingReserveCents: 100000,
      actualSpendingCents: 60000,
      allowanceCents: 50000,
    });
    const transfer = buildAutomaticReserveTransfer(projection.adjustmentCents);
    expect(projection.startingReserveCents - projection.endingReserveCents).toBe(
      transfer.amountCents
    );
    expect(transfer.direction).toBe('to-month');
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
