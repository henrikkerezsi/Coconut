const HTTPS_HOSTNAME_PATTERN = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i;

const ANON_KEY_PREFIX = 'eyJ';
const PUBLISHABLE_KEY_PREFIX = 'sb_publishable_';
const API_KEY_MIN_LENGTH = 40;

export function normalizeSupabaseUrl(input: string): string | null {
  const trimmed = input.trim().split(/[?#]/, 1)[0];
  if (trimmed.length === 0) {
    return null;
  }
  if (!HTTPS_HOSTNAME_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

export function isValidApiKey(input: string): boolean {
  const key = input.trim();
  if (key.length < API_KEY_MIN_LENGTH) {
    return false;
  }
  return key.startsWith(ANON_KEY_PREFIX) || key.startsWith(PUBLISHABLE_KEY_PREFIX);
}

export function formatMaskedKey(input: string): string {
  const key = input.trim();
  if (key.length <= 10) {
    return '••••';
  }
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}