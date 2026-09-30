import { resolveSharedMirrorPlacement } from '../../src/services/shared-mirror-service';
import type { Month, MonthKey } from '../../src/models';

function month(monthKey: MonthKey, isClosed = false): Month {
  return {
    monthKey,
    allowanceCents: 0,
    startingReserveCents: 0,
    endingReserveCents: null,
    isClosed,
    closedAt: null,
  };
}

describe('resolveSharedMirrorPlacement', () => {
  it('keeps the expense date when that month is open', () => {
    const placement = resolveSharedMirrorPlacement([month('2026-09')], '2026-09-28');
    expect(placement).toEqual({ monthKey: '2026-09', date: '2026-09-28' });
  });

  it('moves the amount to the first of the next open month when its own is closed', () => {
    const placement = resolveSharedMirrorPlacement(
      [month('2026-09', true), month('2026-10')],
      '2026-09-28'
    );
    expect(placement).toEqual({ monthKey: '2026-10', date: '2026-10-01' });
  });

  it('moves the amount past a month that was never started', () => {
    // September is skipped entirely, so an expense dated then lands in October.
    const placement = resolveSharedMirrorPlacement([month('2026-10')], '2026-09-28');
    expect(placement).toEqual({ monthKey: '2026-10', date: '2026-10-01' });
  });

  it('takes the earliest open month that follows, skipping over closed ones', () => {
    const placement = resolveSharedMirrorPlacement(
      [month('2026-09', true), month('2026-10', true), month('2026-11')],
      '2026-08-15'
    );
    expect(placement).toEqual({ monthKey: '2026-11', date: '2026-11-01' });
  });

  it('waits when no month is open to receive the amount', () => {
    expect(resolveSharedMirrorPlacement([month('2026-09', true)], '2026-09-28')).toBeNull();
  });

  it('waits when the user has no month at all', () => {
    expect(resolveSharedMirrorPlacement([], '2026-09-28')).toBeNull();
  });

  it('never dates a mirror before the expense itself', () => {
    // An open month that lies before the expense cannot receive it.
    const placement = resolveSharedMirrorPlacement([month('2026-08')], '2026-09-28');
    expect(placement).toBeNull();
  });

  it('leaves an existing mirror where it is once that month closes', () => {
    // The amount was part of September's spending, so closing September must not
    // rewrite a settled period and push it into October.
    const placement = resolveSharedMirrorPlacement(
      [month('2026-09', true), month('2026-10')],
      '2026-09-28',
      { monthKey: '2026-09', date: '2026-09-28' }
    );
    expect(placement).toEqual({ monthKey: '2026-09', date: '2026-09-28' });
  });

  it('moves an existing mirror when the expense is re-dated into an open month', () => {
    const placement = resolveSharedMirrorPlacement(
      [month('2026-09'), month('2026-10')],
      '2026-10-04',
      { monthKey: '2026-09', date: '2026-09-28' }
    );
    expect(placement).toEqual({ monthKey: '2026-10', date: '2026-10-04' });
  });

  it('keeps an existing mirror that already sits ahead of the expense', () => {
    // September was never started, so there is no September to return to and the
    // mirror stays in the open month it was already recorded in.
    const placement = resolveSharedMirrorPlacement(
      [month('2026-10')],
      '2026-09-28',
      { monthKey: '2026-10', date: '2026-10-01' }
    );
    expect(placement).toEqual({ monthKey: '2026-10', date: '2026-10-01' });
  });

  it('brings a mirror back from a later month to the month its expense belongs to', () => {
    // A previous build, or another device, placed this September expense in
    // October. The mirror is returned so the amount is not counted twice over
    // in the current month.
    const placement = resolveSharedMirrorPlacement(
      [month('2026-09', true), month('2026-10')],
      '2026-09-28',
      { monthKey: '2026-10', date: '2026-10-01' }
    );
    expect(placement).toEqual({ monthKey: '2026-09', date: '2026-09-28' });
  });

  it('brings a displaced mirror back even while that month is still open', () => {
    const placement = resolveSharedMirrorPlacement(
      [month('2026-09'), month('2026-10')],
      '2026-09-28',
      { monthKey: '2026-10', date: '2026-10-01' }
    );
    expect(placement).toEqual({ monthKey: '2026-09', date: '2026-09-28' });
  });
});
