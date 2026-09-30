/// <reference types="node" />

import dayjs from 'dayjs';

import { whatsNew } from '../../src/config/whats-new';

describe('the what\u2019s new list', () => {
  it('lists the newest version first, so it is the one badged as latest', () => {
    const versions = whatsNew.map((entry) => entry.version);
    const sorted = [...versions].sort((a, b) => compareVersions(b, a));
    expect(versions).toEqual(sorted);
  });

  it('never lists the same version twice', () => {
    const versions = whatsNew.map((entry) => entry.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('dates every entry, and the newest entry carries the latest date', () => {
    const dates = whatsNew.map((entry) => dayjs(entry.releasedAt).valueOf());
    for (const date of dates) {
      expect(Number.isNaN(date)).toBe(false);
    }
    expect(Math.max(...dates)).toBe(dates[0]);
  });

  it('gives every entry at least one feature, with no blank ones', () => {
    for (const entry of whatsNew) {
      expect(entry.features.length).toBeGreaterThan(0);
      for (const feature of entry.features) {
        expect(feature.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
