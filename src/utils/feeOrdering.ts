import type { StudentFee } from '../types/models';

const UNORDERED_FEE_TYPE = Number.MAX_SAFE_INTEGER;

function configuredOrder(fee: Pick<StudentFee, 'fee_type_sort_order'>): number {
  const rawOrder = fee.fee_type_sort_order as unknown;
  if (rawOrder == null || rawOrder === '') {
    return UNORDERED_FEE_TYPE;
  }
  const value = Number(rawOrder);
  return Number.isFinite(value) ? value : UNORDERED_FEE_TYPE;
}

function dueDateValue(value?: string): number {
  if (!value) return UNORDERED_FEE_TYPE;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : UNORDERED_FEE_TYPE;
}

/**
 * Keep every student/family fee list aligned with the manual order saved by
 * the administrator in Fee Structure. Recurring rows within one fee type are
 * shown chronologically.
 */
export function sortStudentFeesByConfiguredOrder<T extends StudentFee>(fees: readonly T[] = []): T[] {
  return fees
    .map((fee, index) => ({ fee, index }))
    .sort((left, right) =>
      configuredOrder(left.fee) - configuredOrder(right.fee) ||
      dueDateValue(left.fee.due_date) - dueDateValue(right.fee.due_date) ||
      left.fee.fee_type.localeCompare(right.fee.fee_type) ||
      left.index - right.index
    )
    .map(({ fee }) => fee);
}
