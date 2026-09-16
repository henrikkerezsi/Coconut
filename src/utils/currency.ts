export function formatCents(cents: number, symbol = ''): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const integer = Math.floor(absolute / 100);
  const fraction = (absolute % 100).toString().padStart(2, '0');
  const groupedInteger = integer.toLocaleString('en-US');
  const formatted = `${symbol}${groupedInteger}.${fraction}`;
  return negative ? `-${formatted}` : formatted;
}

export function centsFromString(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '');
  if (normalized.length === 0) {
    return null;
  }
  const match = /^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/.exec(normalized);
  if (!match) {
    return null;
  }
  const sign = match[1] === '-' ? -1 : 1;
  const integer = Number(match[2]);
  const fraction = (match[3] ?? '').padEnd(2, '0');
  const fractionNumber = fraction.length === 2 ? Number(fraction) : 0;
  return sign * (integer * 100 + fractionNumber);
}