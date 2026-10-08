export function formatCents(cents: number, symbol = ''): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const integer = Math.floor(absolute / 100);
  const fraction = (absolute % 100).toString().padStart(2, '0');
  const groupedInteger = integer.toLocaleString('en-US').replace(/,/g, '.');
  const number = `${groupedInteger},${fraction}`;
  const formatted = symbol ? `${number} ${symbol}` : number;
  return negative ? `-${formatted}` : formatted;
}

export function formatSignedCents(cents: number, symbol = ''): string {
  return `${cents >= 0 ? '+' : ''}${formatCents(cents, symbol)}`;
}

export function centsFromString(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '');
  if (normalized.length === 0) {
    return null;
  }
  const match = /^([+-]?)(\d*)(?:[.,](\d*))?$/.exec(normalized);
  if (!match || match[2] === '' && match[3] === '') {
    return null;
  }
  if (match[3] && match[3].length > 2) {
    return null;
  }
  // Allow trailing separator like "10." or "10," during typing - treat as zero cents after decimal
  if (match[3] === '') {
    // Trailing separator case is fine - we'll pad to '00'
  }
  const sign = match[1] === '-' ? -1 : 1;
  const integerStr = match[2] === '' ? '0' : match[2];
  const integer = Number(integerStr);
  const fraction = (match[3] ?? '').padEnd(2, '0');
  const fractionNumber = Number(fraction);
  return sign * (integer * 100 + fractionNumber);
}