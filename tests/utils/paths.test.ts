import { toFilePath, toFileUri } from '../../src/utils/paths';

describe('toFileUri', () => {
  it('adds the file scheme to a raw absolute path', () => {
    expect(toFileUri('/data/user/0/com.coconut.app/files/SQLite/coconut.db')).toBe(
      'file:///data/user/0/com.coconut.app/files/SQLite/coconut.db'
    );
  });

  it('leaves an existing file URI unchanged', () => {
    expect(toFileUri('file:///data/user/0/com.coconut.app/files/SQLite/coconut.db')).toBe(
      'file:///data/user/0/com.coconut.app/files/SQLite/coconut.db'
    );
  });

  it('leaves other schemes unchanged', () => {
    expect(toFileUri('content://com.android.providers.downloads/files/1')).toBe(
      'content://com.android.providers.downloads/files/1'
    );
  });
});

describe('toFilePath', () => {
  it('strips the file scheme from a file URI', () => {
    expect(toFilePath('file:///data/user/0/host.exp.exponent/files/cached_expo_files')).toBe(
      '/data/user/0/host.exp.exponent/files/cached_expo_files'
    );
  });

  it('leaves a raw path unchanged', () => {
    expect(toFilePath('/data/user/0/host.exp.exponent/files/cached_expo_files')).toBe(
      '/data/user/0/host.exp.exponent/files/cached_expo_files'
    );
  });
});