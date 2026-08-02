import { admissionNumberTypeLabel, detectAdmissionNumberType } from './admissionNumber';

describe('detectAdmissionNumberType', () => {
  it.each(['Dummy1', 'Dummy123', 'dummy0042', ' DUMMY9 '])(
    'detects %s as a dummy admission number',
    (value) => expect(detectAdmissionNumberType(value)).toBe('dummy'),
  );

  it.each(['1', '123', '00042', ' 99 '])(
    'detects %s as a permanent numeric admission number',
    (value) => expect(detectAdmissionNumberType(value)).toBe('permanent'),
  );

  it.each(['Dummy', 'Dummy12A', 'ADM2024001', '#123'])('keeps %s as a custom format', (value) => {
    expect(detectAdmissionNumberType(value)).toBe('custom');
  });

  it('detects blank values and exposes clear labels', () => {
    expect(detectAdmissionNumberType('  ')).toBe('empty');
    expect(detectAdmissionNumberType(null)).toBe('empty');
    expect(admissionNumberTypeLabel('dummy')).toBe('Temporary / Dummy');
    expect(admissionNumberTypeLabel('permanent')).toBe('Permanent / Numeric');
  });
});

