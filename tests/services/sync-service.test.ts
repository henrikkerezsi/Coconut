import {
  formatMaskedKey,
  isValidApiKey,
  normalizeSupabaseUrl,
} from '../../src/services/sync-service';

describe('normalizeSupabaseUrl', () => {
  it('normalizes a project URL', () => {
    expect(normalizeSupabaseUrl('https://abcxyz.supabase.co/')).toBe(
      'https://abcxyz.supabase.co'
    );
  });

  it('strips trailing slashes only', () => {
    expect(normalizeSupabaseUrl('https://abcxyz.supabase.co///')).toBe(
      'https://abcxyz.supabase.co'
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeSupabaseUrl('  https://abcxyz.supabase.co  ')).toBe(
      'https://abcxyz.supabase.co'
    );
  });

  it('accepts a custom https domain', () => {
    expect(normalizeSupabaseUrl('https://sync.example.com')).toBe(
      'https://sync.example.com'
    );
  });

  it('rejects non-https URLs', () => {
    expect(normalizeSupabaseUrl('http://abcxyz.supabase.co')).toBeNull();
  });

  it('rejects strings without a hostname', () => {
    expect(normalizeSupabaseUrl('https://nope')).toBeNull();
    expect(normalizeSupabaseUrl('abcxyz.supabase.co')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(normalizeSupabaseUrl('')).toBeNull();
    expect(normalizeSupabaseUrl('   ')).toBeNull();
  });

  it('rejects query strings and fragments', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co?x=1')).toBe(
      'https://abc.supabase.co'
    );
  });
});

describe('isValidApiKey', () => {
  it('accepts a well-formed legacy anon key', () => {
    const key = `eyJ${'a'.repeat(60)}`;
    expect(isValidApiKey(key)).toBe(true);
  });

  it('accepts a well-formed publishable key', () => {
    const key = `sb_publishable_${'b'.repeat(60)}`;
    expect(isValidApiKey(key)).toBe(true);
  });

  it('rejects a short key', () => {
    expect(isValidApiKey('abc')).toBe(false);
  });

  it('rejects a key without a known prefix', () => {
    expect(isValidApiKey(`${'a'.repeat(60)}`)).toBe(false);
  });

  it('rejects a secret key', () => {
    expect(isValidApiKey(`sb_secret_${'c'.repeat(60)}`)).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isValidApiKey('')).toBe(false);
    expect(isValidApiKey('   ')).toBe(false);
  });
});

describe('formatMaskedKey', () => {
  it('masks a long key keeping edges', () => {
    const key = `eyJ${'b'.repeat(60)}`;
    expect(formatMaskedKey(key)).toBe(`${key.slice(0, 4)}…${key.slice(-4)}`);
  });

  it('trims surrounding whitespace', () => {
    const key = `eyJ${'b'.repeat(60)}`;
    expect(formatMaskedKey(`  ${key}  `)).toBe(formatMaskedKey(key));
  });

  it('hides a short value', () => {
    expect(formatMaskedKey('short')).toBe('••••');
  });
});