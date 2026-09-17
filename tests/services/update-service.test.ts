import {
  checkForUpdate,
  compareVersions,
  fetchLatestRelease,
  isIgnoredUpdate,
  isNewerThan,
  parseVersion,
  releaseFromJson,
  type FetchLike,
  type ReleaseInfo,
} from '../../src/services/update-service';

function okFetch(payload: unknown): FetchLike {
  return async () => ({ ok: true, json: async () => payload });
}

function failFetch(): FetchLike {
  return async () => ({ ok: false, json: async () => ({}) });
}

describe('parseVersion', () => {
  it('parses a plain semantic version', () => {
    expect(parseVersion('0.3.0')).toEqual({ major: 0, minor: 3, patch: 0 });
  });

  it('parses a version with a leading v', () => {
    expect(parseVersion('v1.2.10')).toEqual({ major: 1, minor: 2, patch: 10 });
  });

  it('trims surrounding whitespace', () => {
    expect(parseVersion('  2.0.1  ')).toEqual({ major: 2, minor: 0, patch: 1 });
  });

  it('rejects malformed versions', () => {
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('1.2.3.4')).toBeNull();
    expect(parseVersion('release')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('0.3.0', 'v0.3.0')).toBe(0);
  });

  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('0.3.0', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '0.3.0')).toBeGreaterThan(0);
    expect(compareVersions('0.3.9', '0.4.0')).toBeLessThan(0);
    expect(compareVersions('0.4.0', '0.3.9')).toBeGreaterThan(0);
    expect(compareVersions('0.3.0', '0.3.1')).toBeLessThan(0);
    expect(compareVersions('0.3.1', '0.3.0')).toBeGreaterThan(0);
  });

  it('throws on invalid input', () => {
    expect(() => compareVersions('abc', '0.1.0')).toThrow();
    expect(() => compareVersions('0.1.0', 'abc')).toThrow();
  });
});

describe('isNewerThan', () => {
  it('detects a newer candidate', () => {
    expect(isNewerThan('0.3.0', 'v0.4.0')).toBe(true);
  });

  it('rejects older or identical candidates', () => {
    expect(isNewerThan('0.4.0', 'v0.3.0')).toBe(false);
    expect(isNewerThan('0.3.0', 'v0.3.0')).toBe(false);
  });
});

describe('isIgnoredUpdate', () => {
  it('returns true when the latest version was ignored', () => {
    expect(isIgnoredUpdate('v0.4.0', 'v0.4.0')).toBe(true);
  });

  it('returns false when nothing was ignored or the version differs', () => {
    expect(isIgnoredUpdate('v0.4.0', null)).toBe(false);
    expect(isIgnoredUpdate('v0.4.0', 'v0.3.0')).toBe(false);
  });
});

describe('releaseFromJson', () => {
  it('extracts version and url from the GitHub payload', () => {
    const release = releaseFromJson({
      tag_name: 'v0.4.0',
      html_url: 'https://github.com/henrikkerezsi/Coconut/releases/tag/v0.4.0',
    });
    expect(release).toEqual({
      version: 'v0.4.0',
      url: 'https://github.com/henrikkerezsi/Coconut/releases/tag/v0.4.0',
    });
  });

  it('returns null for invalid payloads', () => {
    expect(releaseFromJson(null)).toBeNull();
    expect(releaseFromJson('not an object')).toBeNull();
    expect(releaseFromJson({ tag_name: 'not-a-version', html_url: 'https://example.com' })).toBeNull();
    expect(releaseFromJson({ tag_name: 'v0.4.0' })).toBeNull();
  });
});

describe('fetchLatestRelease', () => {
  it('returns the release for a successful response', async () => {
    const fetchImpl = okFetch({ tag_name: 'v0.4.0', html_url: 'https://example.com/v0.4.0' });
    const release = await fetchLatestRelease('https://api.example.com/releases/latest', fetchImpl);
    expect(release).toEqual({ version: 'v0.4.0', url: 'https://example.com/v0.4.0' });
  });

  it('returns null when the request fails', async () => {
    expect(await fetchLatestRelease('https://api.example.com/releases/latest', failFetch())).toBeNull();
  });

  it('returns null when the network throws', async () => {
    const throwing: FetchLike = async () => {
      throw new Error('offline');
    };
    expect(await fetchLatestRelease('https://api.example.com/releases/latest', throwing)).toBeNull();
  });

  it('returns null for a malformed payload', async () => {
    const fetchImpl = okFetch({ unexpected: true });
    expect(await fetchLatestRelease('https://api.example.com/releases/latest', fetchImpl)).toBeNull();
  });
});

describe('checkForUpdate', () => {
  it('returns the release when a newer, non-ignored version exists', async () => {
    const fetchImpl = okFetch({ tag_name: 'v0.4.0', html_url: 'https://example.com/v0.4.0' });
    const release: ReleaseInfo | null = await checkForUpdate('0.3.0', null, fetchImpl);
    expect(release?.version).toBe('v0.4.0');
  });

  it('returns null when the latest version is ignored', async () => {
    const fetchImpl = okFetch({ tag_name: 'v0.4.0', html_url: 'https://example.com/v0.4.0' });
    expect(await checkForUpdate('0.3.0', 'v0.4.0', fetchImpl)).toBeNull();
  });

  it('returns null when the current version is already newest', async () => {
    const fetchImpl = okFetch({ tag_name: 'v0.3.0', html_url: 'https://example.com/v0.3.0' });
    expect(await checkForUpdate('0.3.0', null, fetchImpl)).toBeNull();
  });

  it('returns null when the latest release cannot be fetched', async () => {
    expect(await checkForUpdate('0.3.0', null, failFetch())).toBeNull();
  });

  it('returns null when the check throws', async () => {
    const throwing: FetchLike = async () => {
      throw new Error('offline');
    };
    expect(await checkForUpdate('0.3.0', null, throwing)).toBeNull();
  });
});