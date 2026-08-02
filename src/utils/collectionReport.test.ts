import { FeeTransaction } from '../types/models';
import {
  buildCollectionCsv,
  buildCollectionHtml,
  calculateCashDenominations,
  DEFAULT_COLLECTION_REPORT_COLUMNS,
  normalizeCollectionReportColumns,
} from './collectionReport';

jest.mock('./pdfGenerator', () => ({ printHtmlOnWeb: jest.fn() }));

const row: FeeTransaction = {
  id: 'tx-1',
  amount: 1250,
  paid_at: '2026-08-02T10:15:00+05:30',
  payment_method: 'cash',
  transaction_ref: 'CASH-42',
  receipt_no: 'RCT-1001',
  remarks: 'Term 1 & books',
  received_by: 'Asha Rao',
  student_name: 'Ravi Kumar',
  father_name: 'Mohan Kumar',
  admission_no: 'ADM-7',
  class_name: '5',
  section_name: 'A',
  fee_type: 'Tuition Fee',
};

const meta = {
  schoolName: 'Example School',
  accountantName: 'Asha Rao',
  dateLabel: 'Sunday, 2 August 2026',
  dateIso: '2026-08-02',
};

describe('collection report columns', () => {
  it('uses only selected columns in the printable PDF table', () => {
    const html = buildCollectionHtml(
      [row],
      meta,
      ['student_name', 'payment_method', 'remarks', 'amount'],
    );

    expect(html).toContain('<th>Student</th>');
    expect(html).toContain('<th>Payment mode</th>');
    expect(html).toContain('<th>Remarks</th>');
    expect(html).toContain('<th class="num">Amount</th>');
    expect(html).toContain('Cash');
    expect(html).toContain('Term 1 &amp; books');
    expect(html).not.toContain('<th>Father</th>');
    expect(html).not.toContain('<th>Adm no</th>');
    expect(html).toContain('@page { size: A4 portrait;');
  });

  it('preserves the order in which columns were selected', () => {
    const html = buildCollectionHtml([row], meta, ['amount', 'student_name', 'remarks']);
    const csv = buildCollectionCsv([row], meta, ['amount', 'student_name', 'remarks']);

    expect(html.indexOf('<th class="num">Amount</th>')).toBeLessThan(html.indexOf('<th>Student</th>'));
    expect(html.indexOf('<th>Student</th>')).toBeLessThan(html.indexOf('<th>Remarks</th>'));
    expect(csv).toContain('Amount,Student,Remarks');
  });

  it('uses the same selected columns for CSV download', () => {
    const csv = buildCollectionCsv(
      [row],
      meta,
      ['receipt_no', 'payment_method', 'time', 'transaction_ref', 'remarks'],
    );

    expect(csv).toContain('Receipt no,Payment mode,Time,Reference,Remarks');
    expect(csv).toContain('RCT-1001,Cash,');
    expect(csv).toContain('CASH-42,Term 1 & books');
    expect(csv).not.toContain('ADM-7');
  });

  it('sanitizes stale saved settings and never allows an empty report', () => {
    expect(normalizeCollectionReportColumns(['remarks', 'unknown', 'remarks', 'amount']))
      .toEqual(['remarks', 'amount']);
    expect(normalizeCollectionReportColumns([])).toEqual(DEFAULT_COLLECTION_REPORT_COLUMNS);
    expect(normalizeCollectionReportColumns('bad data')).toEqual(DEFAULT_COLLECTION_REPORT_COLUMNS);
  });

  it('switches wide reports to landscape', () => {
    const html = buildCollectionHtml(
      [row],
      meta,
      ['fee_type', 'receipt_no', 'student_name', 'father_name', 'admission_no', 'class_section', 'payment_method', 'time', 'remarks'],
    );

    expect(html).toContain('@page { size: A4 landscape;');
  });

  it('calculates a minimum-piece cash denomination suggestion', () => {
    const breakdown = calculateCashDenominations(1250);

    expect(breakdown.rows.find((item) => item.denomination === 500)?.pieces).toBe(2);
    expect(breakdown.rows.find((item) => item.denomination === 200)?.pieces).toBe(1);
    expect(breakdown.rows.find((item) => item.denomination === 50)?.pieces).toBe(1);
    expect(breakdown.allocatedTotal).toBe(1250);
    expect(breakdown.remainder).toBe(0);
  });

  it('prints reconciliation and conditionally includes denominations at the PDF end', () => {
    const upiRow: FeeTransaction = { ...row, id: 'tx-2', amount: 750, payment_method: 'upi' };
    const withoutDenominations = buildCollectionHtml([row, upiRow], meta, ['student_name', 'amount']);
    const withDenominations = buildCollectionHtml(
      [row, upiRow],
      meta,
      ['student_name', 'amount'],
      { includeDenominations: true },
    );

    expect(withoutDenominations).toContain('Collection Reconciliation');
    expect(withoutDenominations).toContain('Non-cash total');
    expect(withoutDenominations).not.toContain('<h3>Cash denominations</h3>');
    expect(withDenominations).toContain('<h3>Cash denominations</h3>');
    expect(withDenominations).toContain('Auto-calculated minimum-piece suggestion');
    expect(withDenominations).toContain('@page { size: A4 landscape;');
    expect(withDenominations.indexOf('Collection Reconciliation')).toBeGreaterThan(
      withDenominations.indexOf('<tbody class="report-total">'),
    );
  });
});
