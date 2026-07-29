import type { StudentFee } from '../types/models';
import { sortStudentFeesByConfiguredOrder } from './feeOrdering';

function fee(
  id: string,
  feeType: string,
  order: number | undefined,
  dueDate: string,
): StudentFee {
  return {
    id,
    student_id: 'student-1',
    amount_due: 100,
    amount_paid: 0,
    discount: 0,
    status: 'pending',
    due_date: dueDate,
    fee_type: feeType,
    fee_type_sort_order: order,
  };
}

describe('sortStudentFeesByConfiguredOrder', () => {
  it('uses the administrator-configured fee type order', () => {
    const source = [
      fee('transport', 'Transport', 3, '2026-06-01'),
      fee('tuition', 'Tuition', 1, '2026-06-01'),
      fee('books', 'Books', 2, '2026-06-01'),
    ];

    expect(sortStudentFeesByConfiguredOrder(source).map((item) => item.id)).toEqual([
      'tuition',
      'books',
      'transport',
    ]);
    expect(source.map((item) => item.id)).toEqual(['transport', 'tuition', 'books']);
  });

  it('orders recurring rows chronologically within the same fee type', () => {
    const source = [
      fee('july', 'Tuition', 1, '2026-07-10'),
      fee('june', 'Tuition', 1, '2026-06-10'),
      fee('books', 'Books', 2, '2026-05-01'),
    ];

    expect(sortStudentFeesByConfiguredOrder(source).map((item) => item.id)).toEqual([
      'june',
      'july',
      'books',
    ]);
  });

  it('places legacy rows without a configured order after ordered fee types', () => {
    const source = [
      fee('legacy', 'Legacy Fee', undefined, '2026-01-01'),
      fee('tuition', 'Tuition', 1, '2026-08-01'),
    ];

    expect(sortStudentFeesByConfiguredOrder(source).map((item) => item.id)).toEqual([
      'tuition',
      'legacy',
    ]);
  });
});
