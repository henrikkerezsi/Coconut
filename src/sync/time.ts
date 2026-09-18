export function nowIso(): string {
  return new Date().toISOString();
}

export function toMillis(updatedAt: string | null | undefined): number {
  if (!updatedAt) {
    return 0;
  }
  const ms = Date.parse(updatedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

export function isRemoteNewer(
  localUpdatedAt: string | null | undefined,
  remoteUpdatedAt: string | null | undefined
): boolean {
  return toMillis(remoteUpdatedAt) > toMillis(localUpdatedAt);
}