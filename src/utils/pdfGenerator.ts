import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Invoice } from '../types/invoices';
import { FeeTransaction } from '../types/models';
import { SCHOOL_CONFIG } from '../constants/schoolConfig';

/**
 * expo-print `printToFileAsync` / `printAsync` on web only call `window.print()` on the main
 * document — the receipt HTML is ignored, so the whole app (sidebar, shell) is printed.
 * Load the HTML in a hidden iframe and print that document only.
 */
export function printHtmlOnWeb(fullHtml: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'receipt-print');
    iframe.setAttribute(
      'style',
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;visibility:hidden;',
    );
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      reject(new Error('Could not open print frame'));
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
      resolve();
    };

    const runPrint = () => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        finish();
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      win.addEventListener('afterprint', finish);
      setTimeout(finish, 4000);
    };

    doc.open();
    doc.write(fullHtml);
    doc.close();
    // Brief delay so layout / @import fonts can start (iframe is isolated)
    setTimeout(runPrint, 450);
  });
}

// ─── Logo Loader ───────────────────────────────────────────────────────────────
const loadLogoAsBase64 = async (imageAsset: any): Promise<string | null> => {
  try {
    // If it's a remote URL already, return as is
    if (typeof imageAsset === 'string' && imageAsset.startsWith('http')) {
      return imageAsset;
    }

    const asset = Asset.fromModule(imageAsset);
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) {
      console.warn('Logo: no URI from asset');
      return null;
    }

    console.log('Logo asset URI:', uri);

    if (Platform.OS === 'web') {
      // If already a data URI, use it directly
      if (uri.startsWith('data:')) return uri;

      // Resolve the URI
      const resolvedUri = uri.startsWith('http')
        ? uri
        : `${window.location.origin}${uri.startsWith('/') ? '' : '/'}${uri}`;

      console.log('Logo resolved URI:', resolvedUri);

      // Primary approach: load into Image element → canvas → dataURL
      // This is the most reliable because it handles all URL formats
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const img = new (window as any).Image() as HTMLImageElement;
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) { reject(new Error('no canvas context')); return; }
              ctx.drawImage(img, 0, 0);
              const result = canvas.toDataURL('image/png');
              console.log('Logo canvas conversion success, length:', result.length);
              resolve(result);
            } catch (canvasErr) {
              reject(canvasErr);
            }
          };
          img.onerror = (err) => {
            console.warn('Logo Image.onerror:', err);
            reject(new Error('Image load failed'));
          };
          img.src = resolvedUri;
        });
        return dataUrl;
      } catch (imgErr) {
        console.warn('Logo canvas approach failed:', imgErr);
      }

      // Fallback: fetch as blob → FileReader
      try {
        const response = await fetch(resolvedUri, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
        const blob = await response.blob();
        const result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        console.log('Logo fetch+blob conversion success');
        return result;
      } catch (fetchErr) {
        console.warn('Logo fetch approach also failed:', fetchErr);
        // Last resort: return the raw URI and hope the browser can resolve it
        return resolvedUri;
      }
    }

    // Read local file as base64 (Native only)
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const extension = uri.split('.').pop()?.toLowerCase();
    const mimeType =
      extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'image/png';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn('PDF Logo Error:', error);
    return null;
  }
};

// ─── Amount to Words ───────────────────────────────────────────────────────────
const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const numToWords = (n: number): string => {
  if (n === 0) return 'Zero';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
  return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
};

const amountInWords = (amount: number): string => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = numToWords(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result + ' Only';
};

// ─── Shared CSS ────────────────────────────────────────────────────────────────
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { margin: 0; size: A4 portrait; }
  html, body { height: auto; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1F2937;
    background: #fff;
    font-size: 10px;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    position: relative;
    padding: 10px 16px;
    max-width: 700px;
    margin: 0 auto;
    overflow: hidden;
  }

  /* ── Watermark (absolute inside .page, NOT fixed) ── */
  .watermark {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 56px; font-weight: 800;
    opacity: 0.04; color: #4F46E5;
    pointer-events: none; z-index: 0;
    white-space: nowrap; letter-spacing: 8px;
  }

  /* ── Header ── */
  .doc-header {
    display: flex; justify-content: space-between;
    align-items: flex-start; margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 3px solid #4F46E5;
  }
  .school-logo { width: 36px; height: 36px; object-fit: contain; margin-bottom: 2px; }
  .school-name { font-size: 13px; font-weight: 800; color: #111827; }
  .school-sub { font-size: 8px; color: #6B7280; margin-top: 1px; max-width: 260px; line-height: 1.2; }

  .doc-title-block { text-align: right; }
  .doc-title { font-size: 20px; font-weight: 800; letter-spacing: -1px; color: #4F46E5; }
  .doc-no { font-size: 9px; color: #6B7280; margin-top: 1px; font-weight: 600; }

  /* ── Info grid ── */
  .info-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 5px; margin-bottom: 6px;
  }
  .info-box {
    background: #F9FAFB; border-radius: 5px;
    padding: 4px 7px; border: 1px solid #F3F4F6;
  }
  .info-box.highlight { background: #EEF2FF; border-color: #C7D2FE; }
  .info-label {
    font-size: 7px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; color: #9CA3AF; margin-bottom: 1px;
  }
  .info-value { font-size: 10px; font-weight: 700; color: #111827; }
  .info-sub { font-size: 8px; color: #6B7280; margin-top: 0; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  thead tr { background: #4F46E5; }
  thead th {
    padding: 4px 7px; text-align: left;
    font-size: 8px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.6px; color: #fff;
  }
  thead th:last-child { text-align: right; }
  tbody tr:nth-child(even) { background: #F9FAFB; }
  tbody td { padding: 4px 7px; font-size: 10px; border-bottom: 1px solid #F3F4F6; }
  tbody td:last-child { text-align: right; font-weight: 600; }
  .td-desc-main { font-weight: 600; color: #111827; }
  .td-desc-sub { font-size: 8px; color: #9CA3AF; margin-top: 0; }

  /* ── Totals ── */
  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 6px; }
  .totals-box { width: 190px; }
  .totals-row {
    display: flex; justify-content: space-between;
    padding: 2px 0; font-size: 10px; color: #4B5563;
    border-bottom: 1px dashed #E5E7EB;
  }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.grand {
    font-size: 11px; font-weight: 800;
    color: #111827; padding-top: 4px; margin-top: 2px;
    border-top: 2px solid #4F46E5; border-bottom: none;
  }
  .totals-row.paid-row { color: #059669; font-weight: 600; }
  .totals-row.due-row  { color: #DC2626; font-weight: 700; }

  /* ── Amount in words ── */
  .amount-words {
    background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 5px;
    padding: 4px 8px; margin-bottom: 6px; font-size: 9px;
    color: #065F46; font-weight: 500;
  }
  .amount-words strong { font-weight: 700; }

  /* ── Status badge ── */
  .badge {
    display: inline-block; padding: 2px 7px;
    border-radius: 20px; font-size: 8px; font-weight: 700;
    letter-spacing: 0.5px; text-transform: uppercase;
  }
  .badge-paid    { background: #D1FAE5; color: #065F46; }
  .badge-pending { background: #FEF3C7; color: #92400E; }
  .badge-partial { background: #DBEAFE; color: #1E40AF; }
  .badge-unpaid  { background: #FEE2E2; color: #991B1B; }

  /* ── Payment method chip ── */
  .method-chip {
    display: inline-flex; align-items: center; gap: 4px;
    background: #EEF2FF; color: #4F46E5;
    padding: 2px 6px; border-radius: 5px;
    font-size: 8px; font-weight: 700; letter-spacing: 0.5px;
  }

  /* ── Signature ── */
  .signature-row {
    display: flex; justify-content: space-between;
    align-items: flex-end; margin-top: 6px; padding-top: 5px;
    border-top: 1px dashed #D1D5DB;
  }
  .sig-block { text-align: center; }
  .sig-line {
    border-top: 1px solid #9CA3AF; width: 100px;
    padding-top: 2px; font-size: 8px; color: #6B7280; margin-top: 10px;
  }
  .qr-placeholder {
    width: 32px; height: 32px; border: 1px dashed #D1D5DB;
    border-radius: 4px; display: flex; align-items: center;
    justify-content: center; font-size: 7px; color: #9CA3AF;
    text-align: center; padding: 2px; line-height: 1.2;
  }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 5px; padding-top: 4px;
    border-top: 1px solid #F3F4F6;
    text-align: center; font-size: 7px; color: #9CA3AF; line-height: 1.3;
  }
  .doc-footer strong { color: #6B7280; }

  /* ── Divider ── */
  .section-divider { border: none; border-top: 1px solid #F3F4F6; margin: 5px 0; }

  /* ── Receipt specific ── */
  .receipt-banner {
    background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
    border-radius: 7px; padding: 7px 10px; margin-bottom: 6px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .receipt-banner-label {
    font-size: 8px; color: rgba(255,255,255,0.7);
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;
  }
  .receipt-banner-amount { font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -1px; }
  .receipt-banner-right { text-align: right; }
  .receipt-banner-date { font-size: 8px; color: rgba(255,255,255,0.8); margin-top: 1px; }

  /* ── Print-specific overrides ── */
  @media print {
    html, body { height: auto !important; overflow: visible !important; }
    .page { page-break-inside: avoid; page-break-after: avoid; }
  }
`;

// ─── Receipt PDF ───────────────────────────────────────────────────────────────
export const generateReceiptPDF = async (transaction: FeeTransaction) => {
  try {
    const studentName = transaction.student_name || 'Student';
    const admissionNo = transaction.admission_no || 'N/A';
    const paidAtStr = transaction.paid_at || new Date().toISOString();
    const dateObj = new Date(paidAtStr);
    const dateFull = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const dateTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const feeName = transaction.fee_type || 'School Fee';
    const amountNum = Number(transaction.amount || 0);
    const amountFmt = amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const paymentMethod = (transaction.payment_method || 'Cash').toUpperCase();
    const receiptNo = transaction.transaction_ref || (transaction.id ? `RCP-${transaction.id.slice(0, 8).toUpperCase()}` : 'N/A');
    const academicYearText =
      transaction.academic_year ||
      (transaction as any).academicYear ||
      `${dateObj.getFullYear()}–${dateObj.getFullYear() + 1}`;
    const words = amountInWords(amountNum);

    const logoBase64 = await loadLogoAsBase64(SCHOOL_CONFIG.logo);
    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" class="school-logo" />`
      : `<div style="font-size:20px;font-weight:800;color:#4F46E5;">${SCHOOL_CONFIG.name.slice(0, 2).toUpperCase()}</div>`;

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>${BASE_CSS}</style>
        </head>
        <body>
          <div class="page">
            <div class="watermark">RECEIPT</div>

            <!-- Header -->
            <div class="doc-header">
              <div>
                ${logoHtml}
                <div class="school-name">${SCHOOL_CONFIG.name}</div>
                <div class="school-sub">${SCHOOL_CONFIG.address || ''}</div>
              </div>
              <div class="doc-title-block">
                <div class="doc-title">RECEIPT</div>
                <div class="doc-no">${receiptNo}</div>
                <div style="margin-top:4px;">
                  <span class="badge badge-paid">✓ PAYMENT RECEIVED</span>
                </div>
              </div>
            </div>

            <!-- Banner: Paid Amount -->
            <div class="receipt-banner">
              <div>
                <div class="receipt-banner-label">Amount Received</div>
                <div class="receipt-banner-amount">₹${amountFmt}</div>
              </div>
              <div class="receipt-banner-right">
                <span class="method-chip">⚡ ${paymentMethod}</span>
                <div class="receipt-banner-date">${dateFull} · ${dateTime}</div>
              </div>
            </div>

            <!-- Info Grid -->
            <div class="info-grid">
              <div class="info-box highlight">
                <div class="info-label">Received From</div>
                <div class="info-value">${studentName}</div>
                <div class="info-sub">Admission No: ${admissionNo}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Payment Details</div>
                <div class="info-value">${feeName}</div>
                <div class="info-sub">Academic Year: ${academicYearText}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Receipt Date</div>
                <div class="info-value">${dateFull}</div>
                <div class="info-sub">Time: ${dateTime}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Payment Mode</div>
                <div class="info-value">${paymentMethod}</div>
                <div class="info-sub">Ref: ${receiptNo}</div>
              </div>
            </div>

            <!-- Table -->
            <table>
              <thead>
                <tr>
                  <th style="width:50%;">Description</th>
                  <th>Fee Type</th>
                  <th>Academic Year</th>
                  <th>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div class="td-desc-main">${feeName}</div>
                    <div class="td-desc-sub">Payment by ${studentName}</div>
                  </td>
                  <td>${feeName}</td>
                  <td>${academicYearText}</td>
                  <td>${amountFmt}</td>
                </tr>
              </tbody>
            </table>

            <!-- Totals -->
            <div class="totals-section">
              <div class="totals-box">
                <div class="totals-row">
                  <span>Sub Total</span>
                  <span>₹${amountFmt}</span>
                </div>
                <div class="totals-row">
                  <span>Discount</span>
                  <span>₹0.00</span>
                </div>
                <div class="totals-row grand">
                  <span>Total Received</span>
                  <span>₹${amountFmt}</span>
                </div>
              </div>
            </div>

            <!-- Amount in Words -->
            <div class="amount-words">
              <strong>Amount in Words:</strong> ${words}
            </div>

            <!-- Signature -->
            <div class="signature-row">
              <div>
                <div style="font-size:8px; color:#9CA3AF; margin-bottom:2px;">SCAN TO VERIFY</div>
                <div class="qr-placeholder">QR<br/>Verify</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">Authorized Signatory</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">Receiver's Signature</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="doc-footer">
              <p>🖨️ This is a computer-generated receipt and is valid without a physical signature.</p>
              <p>
                ${SCHOOL_CONFIG.contact ? `<strong>Phone:</strong> ${SCHOOL_CONFIG.contact}` : ''}
                ${SCHOOL_CONFIG.website ? ` &nbsp;|&nbsp; <strong>Web:</strong> ${SCHOOL_CONFIG.website}` : ''}
              </p>
              <p style="margin-top:2px;">Generated on ${new Date().toLocaleString('en-IN')}</p>
            </div>

          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      await printHtmlOnWeb(html);
      return;
    }
    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    throw error;
  }
};

// ─── Invoice PDF ───────────────────────────────────────────────────────────────
export const generateInvoicePDF = async (invoice: Invoice) => {
  try {
    const studentName = invoice.student?.person?.display_name || 'Student';
    const admissionNo = invoice.student?.admission_no || 'N/A';
    const dateObj = new Date(invoice.created_at);
    const invoiceDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const feeName = invoice.fee_structure?.fee_type?.name || 'School Fee';
    const feeDesc = invoice.fee_structure?.fee_type?.description || '';
    const invoiceNo = `INV-${dateObj.getFullYear()}-${invoice.id.slice(0, 8).toUpperCase()}`;

    const subtotal = invoice.amount_due;
    const discount = invoice.discount ?? 0;
    const paid = invoice.amount_paid ?? 0;
    const netDue = Math.max(subtotal - discount - paid, 0);

    const statusKey =
      invoice.status?.toLowerCase() === 'paid' ? 'paid'
        : paid > 0 ? 'partial'
          : 'unpaid';
    const statusLabel =
      statusKey === 'paid' ? 'PAID'
        : statusKey === 'partial' ? 'PARTIAL'
          : 'UNPAID';

    const dueDateObj = new Date(dateObj);
    dueDateObj.setDate(dueDateObj.getDate() + 30);
    const dueDate = dueDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const logoBase64 = await loadLogoAsBase64(SCHOOL_CONFIG.logo);
    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" class="school-logo" />`
      : `<div style="font-size:20px;font-weight:800;color:#4F46E5;">${SCHOOL_CONFIG.name.slice(0, 2).toUpperCase()}</div>`;

    const academicYearText =
      (invoice as any).academic_year ||
      (invoice.fee_structure as any)?.academic_year ||
      `${dateObj.getFullYear()}–${dateObj.getFullYear() + 1}`;
    const fmtINR = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>${BASE_CSS}</style>
        </head>
        <body>
          <div class="page">
            <div class="watermark">${statusLabel}</div>

            <!-- Header -->
            <div class="doc-header">
              <div>
                ${logoHtml}
                <div class="school-name">${SCHOOL_CONFIG.name}</div>
                <div class="school-sub">${SCHOOL_CONFIG.address || ''}</div>
              </div>
              <div class="doc-title-block">
                <div class="doc-title">INVOICE</div>
                <div class="doc-no"># ${invoiceNo}</div>
                <div style="margin-top:8px;">
                  <span class="badge badge-${statusKey}">${statusLabel}</span>
                </div>
              </div>
            </div>

            <!-- Info Grid -->
            <div class="info-grid">
              <div class="info-box highlight">
                <div class="info-label">Bill To</div>
                <div class="info-value">${studentName}</div>
                <div class="info-sub">Admission No: ${admissionNo}</div>
              </div>
              <div class="info-box highlight">
                <div class="info-label">Bill From</div>
                <div class="info-value">${SCHOOL_CONFIG.name}</div>
                <div class="info-sub">${SCHOOL_CONFIG.address || ''}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Invoice Date</div>
                <div class="info-value">${invoiceDate}</div>
                <div class="info-sub">Ref: ${invoiceNo}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Due Date</div>
                <div class="info-value" style="color:${statusKey === 'unpaid' ? '#DC2626' : 'inherit'};">${dueDate}</div>
                <div class="info-sub">Academic Year: ${academicYearText}</div>
              </div>
            </div>

            <!-- Table -->
            <table>
              <thead>
                <tr>
                  <th style="width:5%;">#</th>
                  <th style="width:45%;">Description</th>
                  <th>Fee Type</th>
                  <th>Academic Year</th>
                  <th>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="color:#9CA3AF;">01</td>
                  <td>
                    <div class="td-desc-main">${feeName}</div>
                    ${feeDesc ? `<div class="td-desc-sub">${feeDesc}</div>` : ''}
                  </td>
                  <td>${feeName}</td>
                  <td>${academicYearText}</td>
                  <td>${fmtINR(subtotal)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Totals -->
            <div class="totals-section">
              <div class="totals-box">
                <div class="totals-row">
                  <span>Sub Total</span>
                  <span>₹${fmtINR(subtotal)}</span>
                </div>
                ${discount > 0 ? `
                <div class="totals-row" style="color:#059669;">
                  <span>Discount</span>
                  <span>− ₹${fmtINR(discount)}</span>
                </div>` : ''}
                ${paid > 0 ? `
                <div class="totals-row paid-row">
                  <span>Amount Paid</span>
                  <span>− ₹${fmtINR(paid)}</span>
                </div>` : ''}
                <div class="totals-row grand ${statusKey === 'paid' ? '' : 'due-row'}">
                  <span>${statusKey === 'paid' ? '✓ Settled' : 'Balance Due'}</span>
                  <span>₹${fmtINR(netDue)}</span>
                </div>
              </div>
            </div>

            <!-- Amount in words -->
            <div class="amount-words">
              <strong>Amount Due in Words:</strong> ${amountInWords(netDue)}
            </div>

            <!-- Payment instructions (only when not paid) -->
            ${statusKey !== 'paid' ? `
            <div style="background:#FFF7ED; border:1px solid #FED7AA; border-radius:8px; padding:8px 12px; margin-bottom:10px;">
              <div style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#92400E; margin-bottom:5px;">Payment Instructions</div>
              <div style="font-size:11px; color:#78350F; line-height:1.6;">
                Please make the payment before <strong>${dueDate}</strong> to avoid late fees.<br/>
                ${SCHOOL_CONFIG.contact ? `For queries, contact: <strong>${SCHOOL_CONFIG.contact}</strong>` : ''}
              </div>
            </div>` : ''}

            <!-- Signature row -->
            <div class="signature-row">
              <div>
                <div style="font-size:9px; color:#9CA3AF; margin-bottom:4px;">SCAN TO VERIFY</div>
                <div class="qr-placeholder">QR<br/>Verify</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">Principal / Authorized</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">Accounts Department</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="doc-footer">
              <p>📄 This is a system-generated invoice. Please retain for your records.</p>
              <p>
                ${SCHOOL_CONFIG.contact ? `<strong>Phone:</strong> ${SCHOOL_CONFIG.contact}` : ''}
                ${SCHOOL_CONFIG.website ? ` &nbsp;|&nbsp; <strong>Web:</strong> ${SCHOOL_CONFIG.website}` : ''}
              </p>
              <p style="margin-top:3px;">Generated on ${new Date().toLocaleString('en-IN')}</p>
            </div>

          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      await printHtmlOnWeb(html);
      return;
    }
    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    throw error;
  }
};