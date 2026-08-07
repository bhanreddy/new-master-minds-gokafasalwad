import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { FeeTransaction } from '../types/models';
import { printHtmlOnWeb } from './pdfGenerator';

export const PAYMENT_MODES = ['cash', 'upi', 'card', 'cheque', 'bank_transfer', 'online'] as const;

export type PaymentMode = typeof PAYMENT_MODES[number];

export interface CollectionReportMeta {
  schoolName: string;
  accountantName: string;
  dateLabel: string;
  dateIso: string;
  /** When export/print reflects active filters, e.g. "Payment: Cash · Fee: Tuition" */
  filterNote?: string;
}

export interface CollectionTotals {
  count: number;
  grandTotal: number;
  byMode: Record<string, { count: number; total: number }>;
}

/** Commonly circulating notes/coins, deliberately excluding the withdrawn-from-circulation ₹2000 note. */
export const CASH_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export type CashDenominationValue = (typeof CASH_DENOMINATIONS)[number];
export type CashDenominationPieces = Partial<Record<CashDenominationValue, number>>;

export interface CollectionReportOptions {
  includeDenominations?: boolean;
  /** Piece counts entered in the pre-print calculator. Falls back to a minimum-piece suggestion. */
  denominationPieces?: CashDenominationPieces;
}

export interface CashDenominationRow {
  denomination: number;
  pieces: number;
  amount: number;
}

export interface CashDenominationBreakdown {
  rows: CashDenominationRow[];
  allocatedTotal: number;
  remainder: number;
}

function sanitizePieceCount(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 99999);
}

/** Normalize saved/entered piece counts to known denominations only. */
export function normalizeCashDenominationPieces(value: unknown): CashDenominationPieces {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const pieces: CashDenominationPieces = {};
  for (const denomination of CASH_DENOMINATIONS) {
    pieces[denomination] = sanitizePieceCount(source[String(denomination)] ?? source[denomination as unknown as string]);
  }
  return pieces;
}

export function piecesFromCashDenominationBreakdown(
  breakdown: CashDenominationBreakdown,
): CashDenominationPieces {
  const pieces: CashDenominationPieces = {};
  for (const row of breakdown.rows) {
    if ((CASH_DENOMINATIONS as readonly number[]).includes(row.denomination)) {
      pieces[row.denomination as CashDenominationValue] = sanitizePieceCount(row.pieces);
    }
  }
  return pieces;
}

/** Build a cash drawer total from entered piece counts. */
export function buildCashDenominationBreakdownFromPieces(
  piecesInput: unknown,
): CashDenominationBreakdown {
  const pieces = normalizeCashDenominationPieces(piecesInput);
  const rows = CASH_DENOMINATIONS.map((denomination) => {
    const count = pieces[denomination] ?? 0;
    return { denomination, pieces: count, amount: count * denomination };
  });
  const allocatedTotal = rows.reduce((sum, row) => sum + row.amount, 0);
  return { rows, allocatedTotal, remainder: 0 };
}

/** Greedy minimum-piece suggestion. Useful as a starting point before physical count edits. */
export function calculateCashDenominations(cashTotal: number): CashDenominationBreakdown {
  const safeTotal = Math.max(0, Number.isFinite(Number(cashTotal)) ? Number(cashTotal) : 0);
  let remainingPaise = Math.round(safeTotal * 100);
  const rows = CASH_DENOMINATIONS.map((denomination) => {
    const denominationPaise = denomination * 100;
    const pieces = Math.floor(remainingPaise / denominationPaise);
    remainingPaise -= pieces * denominationPaise;
    return { denomination, pieces, amount: pieces * denomination };
  });
  const allocatedTotal = rows.reduce((sum, row) => sum + row.amount, 0);
  return { rows, allocatedTotal, remainder: remainingPaise / 100 };
}

export function resolveCashDenominationBreakdown(
  cashTotal: number,
  piecesInput?: CashDenominationPieces | null,
): { breakdown: CashDenominationBreakdown; source: 'entered' | 'suggested' } {
  if (piecesInput != null) {
    return {
      breakdown: buildCashDenominationBreakdownFromPieces(piecesInput),
      source: 'entered',
    };
  }
  return {
    breakdown: calculateCashDenominations(cashTotal),
    source: 'suggested',
  };
}

export const COLLECTION_REPORT_COLUMNS = [
  { key: 'fee_type', label: 'Fee type', heading: 'Fee type' },
  { key: 'receipt_no', label: 'Receipt number', heading: 'Receipt no' },
  { key: 'student_name', label: 'Student name', heading: 'Student' },
  { key: 'father_name', label: 'Father name', heading: 'Father' },
  { key: 'admission_no', label: 'Admission number', heading: 'Adm no' },
  { key: 'class_section', label: 'Class & section', heading: 'Class · Section' },
  { key: 'payment_method', label: 'Payment mode', heading: 'Payment mode' },
  { key: 'time', label: 'Time', heading: 'Time' },
  { key: 'transaction_ref', label: 'Transaction reference', heading: 'Reference' },
  { key: 'remarks', label: 'Remarks', heading: 'Remarks' },
  { key: 'received_by', label: 'Collected by', heading: 'Collected by' },
  { key: 'amount', label: 'Amount', heading: 'Amount', numeric: true },
] as const;

export type CollectionReportColumnKey = typeof COLLECTION_REPORT_COLUMNS[number]['key'];

export const COLLECTION_REPORT_COLUMN_KEYS: readonly CollectionReportColumnKey[] =
  COLLECTION_REPORT_COLUMNS.map((column) => column.key);

/** Preserve the report's previous layout until the user opts into the new columns. */
export const DEFAULT_COLLECTION_REPORT_COLUMNS: readonly CollectionReportColumnKey[] = [
  'fee_type',
  'receipt_no',
  'student_name',
  'father_name',
  'admission_no',
  'class_section',
  'time',
  'amount',
];

const VALID_COLLECTION_REPORT_COLUMN_KEYS = new Set<CollectionReportColumnKey>(COLLECTION_REPORT_COLUMN_KEYS);

/**
 * Keeps saved column preferences valid when columns are added or removed in a later app version.
 * At least one column is always returned so the printable table can never be empty.
 */
export function normalizeCollectionReportColumns(value: unknown): CollectionReportColumnKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_COLLECTION_REPORT_COLUMNS];

  const normalized: CollectionReportColumnKey[] = [];
  for (const key of value) {
    if (
      typeof key === 'string' &&
      VALID_COLLECTION_REPORT_COLUMN_KEYS.has(key as CollectionReportColumnKey) &&
      !normalized.includes(key as CollectionReportColumnKey)
    ) {
      normalized.push(key as CollectionReportColumnKey);
    }
  }
  return normalized.length > 0 ? normalized : [...DEFAULT_COLLECTION_REPORT_COLUMNS];
}

export function formatPaymentMethod(method?: string | null): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    cheque: 'Cheque',
    bank_transfer: 'Bank transfer',
    online: 'Online',
  };
  const key = String(method ?? '').toLowerCase();
  return map[key] ?? (method ? String(method) : '—');
}

export function formatClassSection(className?: string | null, sectionName?: string | null): string {
  const parts = [className, sectionName].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatAmount(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export function computeCollectionTotals(rows: FeeTransaction[]): CollectionTotals {
  const byMode: Record<string, { count: number; total: number }> = {};
  for (const mode of PAYMENT_MODES) {
    byMode[mode] = { count: 0, total: 0 };
  }

  let grandTotal = 0;
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    grandTotal += amount;
    const key = String(row.payment_method ?? '').toLowerCase() || 'other';
    if (!byMode[key]) byMode[key] = { count: 0, total: 0 };
    byMode[key].count += 1;
    byMode[key].total += amount;
  }

  return { count: rows.length, grandTotal, byMode };
}

function escapeCsv(value: string): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function escapeHtml(value?: string | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fileSafe(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'accountant'
  );
}

export function getCollectionCsvFileName(meta: CollectionReportMeta): string {
  return `collection_${fileSafe(meta.accountantName)}_${meta.dateIso}.csv`;
}

function getCollectionColumnValue(
  row: FeeTransaction,
  key: CollectionReportColumnKey,
  output: 'display' | 'csv',
): string {
  switch (key) {
    case 'fee_type': return row.fee_type ?? '—';
    case 'receipt_no': return row.receipt_no ?? '—';
    case 'student_name': return row.student_name ?? '—';
    case 'father_name': return row.father_name ?? '—';
    case 'admission_no': return row.admission_no ?? '—';
    case 'class_section': return formatClassSection(row.class_name, row.section_name);
    case 'payment_method': return formatPaymentMethod(row.payment_method);
    case 'time': return formatTime(row.paid_at);
    case 'transaction_ref': return row.transaction_ref ?? '—';
    case 'remarks': return row.remarks?.trim() || '—';
    case 'received_by': return row.received_by?.trim() || '—';
    case 'amount':
      return output === 'csv'
        ? Number(row.amount || 0).toFixed(2)
        : formatAmount(Number(row.amount || 0));
  }
}

function buildCsvSummaryRow(
  columns: readonly CollectionReportColumnKey[],
  label: string,
  amount: string,
  countLabel?: string,
): string {
  const cells = columns.map(() => '');
  const amountIndex = columns.indexOf('amount');

  if (cells.length === 1) {
    cells[0] = `${label}${countLabel ? ` · ${countLabel}` : ''}: ${amount}`;
  } else {
    cells[0] = label;
    const valueIndex = amountIndex >= 0 ? amountIndex : cells.length - 1;
    cells[valueIndex] = amount;
    if (countLabel) {
      if (valueIndex > 1) cells[valueIndex - 1] = countLabel;
      else cells[0] = `${label} · ${countLabel}`;
    }
  }

  return cells.map(escapeCsv).join(',');
}

export function buildCollectionCsv(
  rows: FeeTransaction[],
  meta: CollectionReportMeta,
  columns: readonly CollectionReportColumnKey[] = DEFAULT_COLLECTION_REPORT_COLUMNS,
): string {
  const totals = computeCollectionTotals(rows);
  const selectedColumns = normalizeCollectionReportColumns(columns);
  const lines: string[] = [
    escapeCsv(meta.schoolName),
    `Accountant,${escapeCsv(meta.accountantName)}`,
    `Date,${escapeCsv(meta.dateLabel)}`,
    ...(meta.filterNote ? [`Filters,${escapeCsv(meta.filterNote)}`] : []),
    '',
    selectedColumns
      .map((key) => COLLECTION_REPORT_COLUMNS.find((column) => column.key === key)!.heading)
      .map(escapeCsv)
      .join(','),
  ];

  for (const row of rows) {
    lines.push(
      selectedColumns
        .map((key) => getCollectionColumnValue(row, key, 'csv'))
        .map(escapeCsv)
        .join(','),
    );
  }

  lines.push('');
  lines.push(buildCsvSummaryRow(selectedColumns, 'Grand total', totals.grandTotal.toFixed(2)));
  for (const mode of PAYMENT_MODES) {
    const bucket = totals.byMode[mode];
    if (!bucket || bucket.count === 0) continue;
    lines.push(
      buildCsvSummaryRow(
        selectedColumns,
        `${formatPaymentMethod(mode)} subtotal`,
        bucket.total.toFixed(2),
        `${bucket.count} transaction${bucket.count === 1 ? '' : 's'}`,
      ),
    );
  }

  return lines.join('\n');
}

async function shareCsvWeb(csv: string, fileName: string): Promise<void> {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function shareCsvNative(csv: string, fileName: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      dialogTitle: 'Export collection report',
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
    });
    return;
  }
  throw new Error('Sharing is not available on this device.');
}

export async function exportCollectionCsv(
  rows: FeeTransaction[],
  meta: CollectionReportMeta,
  columns: readonly CollectionReportColumnKey[] = DEFAULT_COLLECTION_REPORT_COLUMNS,
): Promise<string> {
  const csv = buildCollectionCsv(rows, meta, columns);
  const fileName = getCollectionCsvFileName(meta);
  if (Platform.OS === 'web') {
    await shareCsvWeb(csv, fileName);
  } else {
    await shareCsvNative(csv, fileName);
  }
  return fileName;
}

export function buildCollectionHtml(
  rows: FeeTransaction[],
  meta: CollectionReportMeta,
  columns: readonly CollectionReportColumnKey[] = DEFAULT_COLLECTION_REPORT_COLUMNS,
  options: CollectionReportOptions = {},
): string {
  const totals = computeCollectionTotals(rows);
  const selectedColumns = normalizeCollectionReportColumns(columns);
  const selectedDefinitions = selectedColumns.map(
    (key) => COLLECTION_REPORT_COLUMNS.find((column) => column.key === key)!,
  );
  // Landscape only when the transaction table is wide. Denominations stay portrait-friendly
  // so the sheet files cleanly in punch-hole binders without crowding the left margin.
  const useLandscape = selectedDefinitions.length > 8;
  const modeSummaryRows = PAYMENT_MODES
    .map((mode) => {
      const bucket = totals.byMode[mode];
      if (!bucket || bucket.count === 0) return '';
      return `<tr><td>${escapeHtml(formatPaymentMethod(mode))}</td><td class="num">${bucket.count}</td><td class="num">${escapeHtml(formatAmount(bucket.total))}</td></tr>`;
    })
    .filter(Boolean)
    .join('');
  const cashTotal = totals.byMode.cash?.total || 0;
  const digitalTotal = totals.grandTotal - cashTotal;
  const { breakdown: denominationBreakdown, source: denominationSource } = resolveCashDenominationBreakdown(
    cashTotal,
    options.denominationPieces,
  );
  const denominationDifference = Number((denominationBreakdown.allocatedTotal - cashTotal).toFixed(2));
  const denominationMatchLabel =
    denominationDifference === 0
      ? 'Matches cash total'
      : denominationDifference > 0
        ? `Excess ${formatAmount(denominationDifference)}`
        : `Short ${formatAmount(Math.abs(denominationDifference))}`;
  const feeTypeTotals = new Map<string, { count: number; total: number }>();
  for (const row of rows) {
    const feeType = row.fee_type?.trim() || 'Other';
    const current = feeTypeTotals.get(feeType) || { count: 0, total: 0 };
    current.count += 1;
    current.total += Number(row.amount || 0);
    feeTypeTotals.set(feeType, current);
  }
  const feeTypeSummaryRows = Array.from(feeTypeTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([feeType, bucket]) => `<tr><td>${escapeHtml(feeType)}</td><td class="num">${bucket.count}</td><td class="num">${escapeHtml(formatAmount(bucket.total))}</td></tr>`)
    .join('');
  const denominationRows = denominationBreakdown.rows
    .map((row) => {
      const rowClass = row.pieces > 0 ? ' class="active-denom"' : '';
      return `<tr${rowClass}><td class="num">${escapeHtml(formatAmount(row.denomination))}</td><td class="num">${row.pieces}</td><td class="num">${escapeHtml(formatAmount(row.amount))}</td></tr>`;
    })
    .join('');
  const denominationNote =
    denominationSource === 'entered'
      ? 'Calculated from the cash denomination box before printing. Verify against physical cash in the drawer.'
      : 'Auto-suggested minimum-piece breakup (no pre-print count entered). Verify against physical cash.';

  const reportHeadings = selectedDefinitions
    .map((column) => `<th${'numeric' in column && column.numeric ? ' class="num"' : ''}>${escapeHtml(column.heading)}</th>`)
    .join('');

  const tableRows = rows
    .map((row) => {
      const cells = selectedDefinitions
        .map((column) => {
          const classNames = ['numeric' in column && column.numeric ? 'num' : '', column.key === 'remarks' ? 'remarks' : '']
            .filter(Boolean)
            .join(' ');
          return `<td${classNames ? ` class="${classNames}"` : ''}>${escapeHtml(getCollectionColumnValue(row, column.key, 'display'))}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const amountVisible = selectedColumns.includes('amount');
  const amountIndex = selectedColumns.indexOf('amount');
  const totalFooter = amountVisible
    ? amountIndex === 0
      ? `<td class="num"><strong>Grand total (${totals.count} transactions): ${escapeHtml(formatAmount(totals.grandTotal))}</strong></td>`
      : `<td colspan="${amountIndex}"><strong>Grand total (${totals.count} transactions)</strong></td>
          <td class="num"><strong>${escapeHtml(formatAmount(totals.grandTotal))}</strong></td>
          ${selectedColumns.length - amountIndex - 1 > 0 ? `<td colspan="${selectedColumns.length - amountIndex - 1}"></td>` : ''}`
    : `<td colspan="${selectedColumns.length}" class="num"><strong>Grand total (${totals.count} transactions): ${escapeHtml(formatAmount(totals.grandTotal))}</strong></td>`;

  // Extra left margin clears punch holes on lever-arch / spring files (~12mm hole centres).
  // top | right | bottom | left
  const pageMargin = useLandscape ? '12mm 12mm 12mm 28mm' : '12mm 12mm 14mm 26mm';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Today's Collection</title>
  <style>
    @page { size: A4 ${useLandscape ? 'landscape' : 'portrait'}; margin: ${pageMargin}; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; margin: 0; padding: 24px; background: #fff; }
    .sheet { max-width: 980px; margin: 0 auto; width: 100%; }
    .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #1E293B; padding-bottom: 12px; }
    .school { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; }
    .title { font-size: 16px; font-weight: 700; margin-top: 6px; color: #334155; }
    .meta { font-size: 12px; color: #64748B; margin-top: 4px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0 20px; }
    .summary-card { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; background: #F8FAFC; }
    .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.4px; }
    .summary-value { font-size: 18px; font-weight: 800; margin-top: 4px; color: #0F766E; }
    table { width: 100%; border-collapse: collapse; font-size: ${useLandscape ? '9px' : '10px'}; }
    th, td { border: 1px solid #CBD5E1; padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #EEF2FF; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    td.remarks { min-width: 90px; overflow-wrap: anywhere; }
    .totals { margin-top: 14px; width: 320px; margin-left: auto; }
    .reconciliation { margin-top: 20px; break-inside: avoid; page-break-inside: avoid; border: 1px solid #CBD5E1; border-radius: 10px; overflow: hidden; }
    .reconciliation-title { background: #DDBA86; color: #111827; text-align: center; padding: 8px 10px; font-size: 13px; font-weight: 800; }
    .reconciliation-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 14px; align-items: start; }
    .reconciliation-grid .denomination-block { grid-column: 1 / -1; }
    .denomination-layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
    .reconciliation h3 { font-size: 11px; margin: 0 0 7px; color: #334155; text-transform: uppercase; letter-spacing: 0.35px; }
    .reconciliation table { font-size: 9px; }
    .reconciliation th, .reconciliation td { padding: 5px 6px; }
    .reconciliation .total-row td { font-weight: 800; background: #F8FAFC; border-top: 2px solid #94A3B8; }
    .reconciliation tr.active-denom td { background: #FFFBEB; font-weight: 700; }
    .denomination-note { color: #64748B; font-size: 8px; line-height: 1.35; margin: 0 0 7px; }
    .denomination-calc { width: 100%; border-collapse: collapse; font-size: 9px; margin: 0 0 8px; }
    .denomination-calc th, .denomination-calc td { border: 1px solid #CBD5E1; padding: 5px 6px; }
    .denomination-calc th { background: #FEF3C7; text-align: left; text-transform: none; letter-spacing: 0; font-size: 9px; }
    .denomination-calc .match { color: #047857; font-weight: 800; }
    .denomination-calc .mismatch { color: #B45309; font-weight: 800; }
    .signatures { margin-top: 36px; display: flex; justify-content: space-between; gap: 24px; }
    .sign-box { flex: 1; border-top: 1px solid #94A3B8; padding-top: 8px; font-size: 12px; color: #475569; }
    @media print {
      body { padding: 0; }
      .sheet { max-width: none; margin: 0; width: 100%; }
      .summary-card, .reconciliation { border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="school">${escapeHtml(meta.schoolName)}</div>
      <div class="title">Today's Collection</div>
      <div class="meta">${escapeHtml(meta.accountantName)} · ${escapeHtml(meta.dateLabel)}</div>
      ${meta.filterNote ? `<div class="meta">Filters: ${escapeHtml(meta.filterNote)}</div>` : ''}
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">Transactions</div>
        <div class="summary-value">${totals.count}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Grand total</div>
        <div class="summary-value">${escapeHtml(formatAmount(totals.grandTotal))}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Report generated</div>
        <div class="summary-value" style="font-size:13px;color:#334155;">${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>${reportHeadings}</tr>
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="${selectedColumns.length}">No collections recorded today.</td></tr>`}
      </tbody>
      <tbody class="report-total">
        <tr>${totalFooter}</tr>
      </tbody>
    </table>

    <section class="reconciliation">
      <div class="reconciliation-title">Collection Reconciliation</div>
      <div class="reconciliation-grid">
        <div>
          <h3>Payment totals</h3>
          <table>
            <thead><tr><th>Mode</th><th class="num">Count</th><th class="num">Amount</th></tr></thead>
            <tbody>
              ${modeSummaryRows || '<tr><td colspan="3">No payments</td></tr>'}
              <tr class="total-row"><td colspan="2">Non-cash total</td><td class="num">${escapeHtml(formatAmount(digitalTotal))}</td></tr>
              <tr class="total-row"><td colspan="2">Grand total</td><td class="num">${escapeHtml(formatAmount(totals.grandTotal))}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3>Fee type totals</h3>
          <table>
            <thead><tr><th>Fee type</th><th class="num">Count</th><th class="num">Amount</th></tr></thead>
            <tbody>
              ${feeTypeSummaryRows || '<tr><td colspan="3">No fees</td></tr>'}
              <tr class="total-row"><td colspan="2">Total fee types</td><td class="num">${escapeHtml(formatAmount(totals.grandTotal))}</td></tr>
            </tbody>
          </table>
        </div>
        ${options.includeDenominations ? `<div class="denomination-block">
          <h3>Cash denomination calculation</h3>
          <p class="denomination-note">${escapeHtml(denominationNote)}</p>
          <div class="denomination-layout">
            <table class="denomination-calc">
              <tbody>
                <tr><th>Cash collections (system)</th><td class="num">${escapeHtml(formatAmount(cashTotal))}</td></tr>
                <tr><th>Counted denomination total</th><td class="num">${escapeHtml(formatAmount(denominationBreakdown.allocatedTotal))}</td></tr>
                <tr><th>Difference</th><td class="num ${denominationDifference === 0 ? 'match' : 'mismatch'}">${escapeHtml(denominationMatchLabel)}</td></tr>
              </tbody>
            </table>
            <table>
              <thead><tr><th class="num">Denomination</th><th class="num">Pieces</th><th class="num">Amount</th></tr></thead>
              <tbody>
                ${denominationRows}
                <tr class="total-row"><td>Total pieces / amount</td><td class="num">${denominationBreakdown.rows.reduce((sum, row) => sum + row.pieces, 0)}</td><td class="num">${escapeHtml(formatAmount(denominationBreakdown.allocatedTotal))}</td></tr>
                ${denominationBreakdown.remainder > 0 ? `<tr><td colspan="2">Non-denomination remainder</td><td class="num">${escapeHtml(formatAmount(denominationBreakdown.remainder))}</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        </div>` : ''}
      </div>
    </section>

    <div class="signatures">
      <div class="sign-box">Collected by ____________________</div>
      <div class="sign-box">Verified by ____________________</div>
    </div>
  </div>
</body>
</html>`;
}

async function printCollectionNative(html: string): Promise<void> {
  const Print = await import('expo-print');
  const Sharing = await import('expo-sharing');
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: "Print today's collection",
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
    return;
  }
  await Print.printAsync({ uri });
}

export async function printCollectionReport(
  rows: FeeTransaction[],
  meta: CollectionReportMeta,
  columns: readonly CollectionReportColumnKey[] = DEFAULT_COLLECTION_REPORT_COLUMNS,
  options: CollectionReportOptions = {},
): Promise<void> {
  const html = buildCollectionHtml(rows, meta, columns, options);
  if (Platform.OS === 'web') {
    await printHtmlOnWeb(html);
    return;
  }
  await printCollectionNative(html);
}
