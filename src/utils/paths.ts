const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const FILE_SCHEME = 'file://';

export function toFileUri(path: string): string {
  if (SCHEME.test(path)) {
    return path;
  }
  return `${FILE_SCHEME}${path}`;
}

export function toFilePath(uri: string): string {
  return uri.startsWith(FILE_SCHEME) ? uri.slice(FILE_SCHEME.length) : uri;
}