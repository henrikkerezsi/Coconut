import {
  remainingAllowance,
  reserveAdjustmentCents,
  spendingDifference,
  unplannedAllowance,
} from '../../src/services/allowance-service';

describe('remainingAllowance', () => {
  it('is positive when spending is below the allowance', () => {
    expect(remainingAllowance(50000, 30000)).toBe(20000);
  });

  it('is zero when spending equals the allowance', () => {
    expect(remainingAllowance(50000, 50000)).toBe(0);
  });

  it('is negative when spending exceeds the allowance', () => {
    expect(remainingAllowance(50000, 60000)).toBe(-10000);
  });
});

describe('spendingDifference', () => {
  it('reports positive when actual spending exceeds planned spending', () => {
    expect(spendingDifference(40000, 30000)).toBe(10000);
  });

  it('reports negative when actual spending is below the plan', () => {
    expect(spendingDifference(20000, 30000)).toBe(-10000);
  });
});

describe('reserveAdjustmentCents', () => {
  it('reduces the reserve when spending exceeds the allowance', () => {
    const result = reserveAdjustmentCents(60000, 50000);
    expect(result.adjustmentCents).toBe(10000);
    expect(result.overspent).toBe(true);
  });

  it('increases the reserve when spending is below the allowance', () => {
    const result = reserveAdjustmentCents(35000, 50000);
    expect(result.adjustmentCents).toBe(-15000);
    expect(result.overspent).toBe(false);
  });

  it('produces no adjustment when spending equals the allowance', () => {
    const result = reserveAdjustmentCents(50000, 50000);
    expect(result.adjustmentCents).toBe(0);
    expect(result.overspent).toBe(false);
  });
});

describe('unplannedAllowance', () => {
  it('subtracts committed spending from the allowance', () => {
    expect(unplannedAllowance(50000, 15000)).toBe(35000);
  });
});