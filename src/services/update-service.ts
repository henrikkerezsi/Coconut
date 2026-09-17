import { GITHUB_API_LATEST_RELEASE_URL } from '../config/repository';

export interface VersionParts {
  major: number;
  minor: number;
  patch: number;
}

export interface ReleaseInfo {
  version: string;
  url: string;
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(version: string): VersionParts | null {
  const match = VERSION_PATTERN.exec(version.trim());
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);
  if (!parsedA || !parsedB) {
    throw new Error(`Invalid semantic version: ${!parsedA ? a : b}`);
  }
  if (parsedA.major !== parsedB.major) {
    return parsedA.major < parsedB.major ? -1 : 1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor < parsedB.minor ? -1 : 1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch < parsedB.patch ? -1 : 1;
  }
  return 0;
}

export function isNewerThan(current: string, candidate: string): boolean {
  return compareVersions(candidate, current) > 0;
}

export function isIgnoredUpdate(latestVersion: string, ignoredVersion: string | null): boolean {
  return ignoredVersion !== null && latestVersion === ignoredVersion;
}

export function releaseFromJson(payload: unknown): ReleaseInfo | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const { tag_name: tagName, html_url: htmlUrl } = payload as Record<string, unknown>;
  if (typeof tagName !== 'string' || typeof htmlUrl !== 'string' || parseVersion(tagName) === null) {
    return null;
  }
  return { version: tagName, url: htmlUrl };
}

export async function fetchLatestRelease(
  url: string,
  fetchImpl: FetchLike = fetch
): Promise<ReleaseInfo | null> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) {
      return null;
    }
    return releaseFromJson(await response.json());
  } catch {
    return null;
  }
}

export async function checkForUpdate(
  currentVersion: string,
  ignoredVersion: string | null,
  fetchImpl: FetchLike = fetch
): Promise<ReleaseInfo | null> {
  const latest = await fetchLatestRelease(GITHUB_API_LATEST_RELEASE_URL, fetchImpl);
  if (!latest) {
    return null;
  }
  if (isIgnoredUpdate(latest.version, ignoredVersion)) {
    return null;
  }
  if (!isNewerThan(currentVersion, latest.version)) {
    return null;
  }
  return latest;
}