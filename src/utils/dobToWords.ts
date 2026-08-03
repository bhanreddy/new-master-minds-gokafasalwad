/**
 * Convert a calendar date into certificate-style words.
 * Day uses ordinals: 2 → Second, 10 → Tenth, 21 → Twenty-first.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Ordinal day names for 1–31 (certificate DOB wording). */
const DAY_ORDINALS = [
  '',
  'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
  'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth',
  'Eighteenth', 'Nineteenth', 'Twentieth',
  'Twenty-first', 'Twenty-second', 'Twenty-third', 'Twenty-fourth', 'Twenty-fifth',
  'Twenty-sixth', 'Twenty-seventh', 'Twenty-eighth', 'Twenty-ninth', 'Thirtieth',
  'Thirty-first',
];

function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 20) return ONES[n];
  if (n < 100) {
    return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10].toLowerCase() : '');
  }
  if (n < 1000) {
    return ONES[Math.floor(n / 100)]
      + ' hundred'
      + (n % 100 ? ' ' + numToWords(n % 100).toLowerCase() : '');
  }
  const thousands = Math.floor(n / 1000);
  const remainder = n % 1000;
  return numToWords(thousands)
    + ' thousand'
    + (remainder ? ' ' + numToWords(remainder).toLowerCase() : '');
}

/** Day-of-month as ordinal words (1–31). */
export function dayToOrdinalWords(day: number): string {
  if (day < 1 || day > 31) return String(day);
  return DAY_ORDINALS[day];
}

function parseDob(dobStr: string): Date | null {
  const parts = dobStr.split(/[-/]/);
  let d: Date;
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    } else {
      d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    }
  } else {
    d = new Date(dobStr);
  }
  return isNaN(d.getTime()) ? null : d;
}

/**
 * e.g. "2009-05-10" / "10-05-2009" → "Tenth-May-Two thousand nine"
 */
export function dobToWords(dobStr: string): string {
  try {
    if (!dobStr?.trim()) return 'N/A';
    const d = parseDob(dobStr.trim());
    if (!d) return 'N/A';

    const dayWords = dayToOrdinalWords(d.getDate());
    const month = MONTHS_LONG[d.getMonth()];
    let yearWords = numToWords(d.getFullYear());
    yearWords = yearWords.charAt(0).toUpperCase() + yearWords.slice(1);

    return `${dayWords}-${month}-${yearWords}`;
  } catch {
    return 'N/A';
  }
}
