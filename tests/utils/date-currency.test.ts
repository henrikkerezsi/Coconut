import {
  centsFromString,
  formatCents,
} from '../../src/utils/currency';
import { monthKeyOf, previousMonthKey, nextMonthKey } from '../../src/utils/date';

describe('formatCents', () => {
  it('formats cents with a decimal separator', () => {
    expect(formatCents(123456)).toBe('1,234.56');
  });

  it('pads the cent fraction', () => {
    expect(formatCents(5)).toBe('0.05');
  });

  it('handles negative values', () => {
    expect(formatCents(-1234)).toBe('-12.34');
  });

  it('appends a currency symbol when provided', () => {
    expect(formatCents(123456, '€')).toBe('€1,234.56');
  });
});

describe('centsFromString', () => {
  it('parses whole amounts', () => {
    expect(centsFromString('12')).toBe(1200);
  });

  it('parses decimal amounts with either separator', () => {
    expect(centsFromString('12.34')).toBe(1234);
    expect(centsFromString('12,34')).toBe(1234);
  });

  it('supports one decimal digit', () => {
    expect(centsFromString('12.3')).toBe(1230);
  });

  it('supports negative amounts', () => {
    expect(centsFromString('-12.34')).toBe(-1234);
  });

  it('rejects invalid input', () => {
    expect(centsFromString('abc')).toBeNull();
    expect(centsFromString('12.345')).toBeNull();
    expect(centsFromString('')).toBeNull();
  });
});

describe('month helpers', () => {
  it('derives a month key from an ISO date', () => {
    expect(monthKeyOf('2026-09-15')).toBe('2026-09');
  });

  it('steps between months', () => {
    expect(previousMonthKey('2026-09')).toBe('2026-08');
    expect(nextMonthKey('2026-09')).toBe('2026-10');
    expect(previousMonthKey('2026-01')).toBe('2025-12');
  });
});