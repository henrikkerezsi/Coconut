import type { ReserveTransfer } from '../models';
import { reserveAdjustmentCents } from './allowance-service';

export const AUTOMATIC_TRANSFER_NOTE = 'Automatic month close';

export interface ReserveProjectionInput {
  startingReserveCents: number;
  actualSpendingCents: number;
  allowanceCents: number;
  incomeCents?: number;
}

export interface ReserveProjection {
  startingReserveCents: number;
  endingReserveCents: number;
  adjustmentCents: number;
  overspent: boolean;
}

/**
 * Computes the ending reserve for a month:
 *
 *   ending = starting + (allowance + income - spending)
 *
 * The monthly adjustment (allowance + income - spending) grows the reserve when
 * the month came in under its available funds and reduces it when spending
 * exceeded them. There is no manual reserve transfer: the adjustment itself is
 * the only movement between the month and the reserve.
 */
export function projectReserve(input: ReserveProjectionInput): ReserveProjection {
  const { startingReserveCents, actualSpendingCents, allowanceCents, incomeCents = 0 } = input;
  const { adjustmentCents, overspent } = reserveAdjustmentCents(
    actualSpendingCents,
    allowanceCents,
    incomeCents
  );
  return {
    startingReserveCents,
    endingReserveCents: startingReserveCents + adjustmentCents,
    adjustmentCents,
    overspent,
  };
}

export interface AutomaticReserveTransfer {
  amountCents: number;
  direction: ReserveTransfer['direction'];
  note: string;
}

/**
 * Derives the reserve movement recorded when a month is closed. A positive
 * adjustment is money the month did not spend and therefore flows into the
 * reserve; a negative one is spending above the available funds, drawn out of
 * the reserve into the month. This is an audit record only and is never fed
 * back into the projection, which is derived from spending alone.
 */
export function buildAutomaticReserveTransfer(adjustmentCents: number): AutomaticReserveTransfer {
  return {
    amountCents: Math.abs(adjustmentCents),
    direction: adjustmentCents < 0 ? 'to-month' : 'to-reserve',
    note: AUTOMATIC_TRANSFER_NOTE,
  };
}

/**
 * The reserve available at the end of a month, used as the starting reserve
 * of the following month. Falls back to the starting reserve when the month has
 * not been closed yet.
 */
export function effectiveEndingReserve(
  endingReserveCents: number | null,
  startingReserveCents: number
): number {
  return endingReserveCents ?? startingReserveCents;
}