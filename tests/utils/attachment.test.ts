import {
  attachmentExtension,
  bytesToBase64,
  formatBytes,
  isImageMime,
  mimeToExtension,
} from '../../src/utils/attachment';

const CHUNK = 0x7ffe + 3;

describe('isImageMime', () => {
  it('returns true for image mime types', () => {
    expect(isImageMime('image/jpeg')).toBe(true);
    expect(isImageMime('image/png')).toBe(true);
  });

  it('returns false for non-image mime types', () => {
    expect(isImageMime('application/pdf')).toBe(false);
    expect(isImageMime('')).toBe(false);
  });
});

describe('bytesToBase64', () => {
  it('encodes an empty array', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
  });

  it('encodes a small array', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=');
  });

  it('encodes data larger than one chunk', () => {
    const bytes = new Uint8Array(CHUNK);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = i % 256;
    }
    const expected = btoa(String.fromCharCode(...Array.from(bytes)));
    expect(bytesToBase64(bytes)).toBe(expected);
  });
});

describe('attachmentExtension', () => {
  it('returns the extension with the dot', () => {
    expect(attachmentExtension('receipt.jpg')).toBe('.jpg');
  });

  it('returns an empty string when there is no extension', () => {
    expect(attachmentExtension('receipt')).toBe('');
  });

  it('handles a trailing dot', () => {
    expect(attachmentExtension('receipt.')).toBe('.');
  });
});

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes and megabytes', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB');
    expect(formatBytes(512 * 1024)).toBe('512 KB');
  });
});

describe('mimeToExtension', () => {
  it('maps known mime types', () => {
    expect(mimeToExtension('image/png')).toBe('.png');
    expect(mimeToExtension('application/pdf')).toBe('.pdf');
  });

  it('falls back to .bin for unknown mime types', () => {
    expect(mimeToExtension('application/zip')).toBe('.bin');
  });
});