import type { ReserveTransfer } from '../models';
import { reserveAdjustmentCents } from './allowance-service';

export interface TransferTotals {
  toMonthCents: number;
  toReserveCents: number;
  netCents: number;
}

export function sumTransfers(transfers: ReserveTransfer[]): TransferTotals {
  let toMonthCents = 0;
  let toReserveCents = 0;
  for (const transfer of transfers) {
    if (transfer.direction === 'to-month') {
      toMonthCents += transfer.amountCents;
    } else {
      toReserveCents += transfer.amountCents;
    }
  }
  return {
    toMonthCents,
    toReserveCents,
    netCents: toReserveCents - toMonthCents,
  };
}

export interface ReserveProjectionInput {
  startingReserveCents: number;
  actualSpendingCents: number;
  allowanceCents: number;
  incomeCents?: number;
  transfers: ReserveTransfer[];
}

export interface ReserveProjection {
  startingReserveCents: number;
  endingReserveCents: number;
  adjustmentCents: number;
  overspent: boolean;
  transferNetCents: number;
}

/**
 * Computes the ending reserve for a month:
 *
 *   ending = starting + transfers_to_reserve - transfers_to_month + (allowance + income - spending)
 *
 * The monthly adjustment (allowance + income - spending) grows the reserve when
 * the month came in under its available funds and reduces it when spending
 * exceeded them. Reserve transfers are tracked separately from spending.
 */
export function projectReserve(input: ReserveProjectionInput): ReserveProjection {
  const { startingReserveCents, actualSpendingCents, allowanceCents, incomeCents = 0, transfers } = input;
  const { netCents } = sumTransfers(transfers);
  const { adjustmentCents, overspent } = reserveAdjustmentCents(
    actualSpendingCents,
    allowanceCents,
    incomeCents
  );
  const endingReserveCents = startingReserveCents + netCents + adjustmentCents;
  return {
    startingReserveCents,
    endingReserveCents,
    adjustmentCents,
    overspent,
    transferNetCents: netCents,
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