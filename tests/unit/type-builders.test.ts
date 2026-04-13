import { t } from '../../src/type-builders';
import { SheetsdbValidationError } from '../../src/errors';

describe('t.string() write validation', () => {
  const col = t.string();

  it('accepts a string value', () => {
    expect(col.write('hello', 'name')).toBe('hello');
  });

  it('throws SheetsdbValidationError for number input', () => {
    expect(() => col.write(123 as never, 'name')).toThrow(SheetsdbValidationError);
  });

  it('throws SheetsdbValidationError for boolean input', () => {
    expect(() => col.write(true as never, 'name')).toThrow(SheetsdbValidationError);
  });
});

describe('t.number() write validation', () => {
  const col = t.number();

  it('accepts a number value', () => {
    expect(col.write(42, 'rating')).toBe('42');
  });

  it('throws SheetsdbValidationError for string input', () => {
    expect(() => col.write('abc' as never, 'rating')).toThrow(SheetsdbValidationError);
  });

  it('throws SheetsdbValidationError for NaN', () => {
    expect(() => col.write(NaN, 'rating')).toThrow(SheetsdbValidationError);
  });

  it('throws SheetsdbValidationError for Infinity', () => {
    expect(() => col.write(Infinity, 'rating')).toThrow(SheetsdbValidationError);
  });

  it('throws SheetsdbValidationError for -Infinity', () => {
    expect(() => col.write(-Infinity, 'rating')).toThrow(SheetsdbValidationError);
  });
});

describe('t.boolean() write validation', () => {
  const col = t.boolean();

  it('accepts true', () => {
    expect(col.write(true, 'active')).toBe('TRUE');
  });

  it('accepts false', () => {
    expect(col.write(false, 'active')).toBe('FALSE');
  });

  it('throws SheetsdbValidationError for number input', () => {
    expect(() => col.write(1 as never, 'active')).toThrow(SheetsdbValidationError);
  });

  it('throws SheetsdbValidationError for string input', () => {
    expect(() => col.write('true' as never, 'active')).toThrow(SheetsdbValidationError);
  });
});

describe('t.date() write validation', () => {
  const col = t.date();

  it('accepts a valid Date object', () => {
    const d = new Date('2024-01-15');
    expect(col.write(d, 'joined')).toBe('2024-01-15');
  });

  it('throws SheetsdbValidationError for string input', () => {
    expect(() => col.write('2024-01-15' as never, 'joined')).toThrow(SheetsdbValidationError);
  });

  it('throws SheetsdbValidationError for invalid Date', () => {
    expect(() => col.write(new Date('not-a-date'), 'joined')).toThrow(SheetsdbValidationError);
  });
});

describe('t.enum() write validation', () => {
  const col = t.enum(['Active', 'Contacted'] as const);

  it('accepts a valid enum value', () => {
    expect(col.write('Active', 'status')).toBe('Active');
  });

  it('throws SheetsdbValidationError for invalid enum value', () => {
    expect(() => col.write('Pending' as never, 'status')).toThrow(SheetsdbValidationError);
  });
});

describe('optional write validation', () => {
  const col = t.number().optional();

  it('accepts null', () => {
    expect(col.write(null, 'rating')).toBe('');
  });

  it('validates non-null values through the base descriptor', () => {
    expect(() => col.write('abc' as never, 'rating')).toThrow(SheetsdbValidationError);
  });
});
