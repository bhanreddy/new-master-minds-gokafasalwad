/**
 * NPCI-style UPI deep link for static / dynamic QR payloads.
 * @see https://www.npci.org.in/ (UPI linking spec)
 */
export function buildUpiPayUri(pa: string, pn: string, amount: string, transactionNote?: string): string {
  const parts = [
    `pa=${encodeURIComponent(pa)}`,
    `pn=${encodeURIComponent(pn)}`,
    `am=${encodeURIComponent(amount)}`,
    'cu=INR',
  ];
  const tn = transactionNote?.trim();
  if (tn) parts.push(`tn=${encodeURIComponent(tn)}`);
  return `upi://pay?${parts.join('&')}`;
}

/** Returns normalized decimal string or null if invalid. */
export function parseInrAmount(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return s;
}
