import { dayToOrdinalWords, dobToWords } from './dobToWords';

describe('dayToOrdinalWords', () => {
  it('uses ordinals for single-digit days', () => {
    expect(dayToOrdinalWords(1)).toBe('First');
    expect(dayToOrdinalWords(2)).toBe('Second');
    expect(dayToOrdinalWords(3)).toBe('Third');
  });

  it('uses ordinals for teens and twenties', () => {
    expect(dayToOrdinalWords(10)).toBe('Tenth');
    expect(dayToOrdinalWords(11)).toBe('Eleventh');
    expect(dayToOrdinalWords(21)).toBe('Twenty-first');
    expect(dayToOrdinalWords(22)).toBe('Twenty-second');
    expect(dayToOrdinalWords(30)).toBe('Thirtieth');
    expect(dayToOrdinalWords(31)).toBe('Thirty-first');
  });
});

describe('dobToWords', () => {
  it('formats ISO and DD-MM-YYYY with ordinal day', () => {
    expect(dobToWords('2009-05-10')).toBe('Tenth-May-Two thousand nine');
    expect(dobToWords('02-05-2009')).toBe('Second-May-Two thousand nine');
    expect(dobToWords('15-05-2009')).toBe('Fifteenth-May-Two thousand nine');
  });

  it('returns N/A for invalid input', () => {
    expect(dobToWords('')).toBe('N/A');
    expect(dobToWords('not-a-date')).toBe('N/A');
  });
});
