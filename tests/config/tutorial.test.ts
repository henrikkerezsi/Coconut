/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { tutorialPages } from '../../src/config/tutorial';

const GLYPHMAP = join(
  process.cwd(),
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'
);

const glyphs: Record<string, unknown> = JSON.parse(readFileSync(GLYPHMAP, 'utf8'));

describe('the tutorial tour', () => {
  it('gives every page an icon that the icon set actually has', () => {
    const missing = tutorialPages
      .map((page) => page.icon)
      .filter((icon) => !(icon in glyphs));
    expect(missing).toEqual([]);
  });

  it('gives every page a title and some body copy', () => {
    for (const page of tutorialPages) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.body.length).toBeGreaterThan(0);
    }
  });

  it('starts the month before it describes anything spent in it', () => {
    const titles = tutorialPages.map((page) => page.title);
    expect(titles.indexOf('Starting a Month')).toBeLessThan(titles.indexOf('Transactions'));
    expect(titles.indexOf('Closing a Month')).toBeLessThan(titles.indexOf('Statistics'));
    expect(titles.indexOf('Closing a Month')).toBeGreaterThan(titles.indexOf('Flexible Budgets'));
  });

  it('ends on the page that tells the user to get started', () => {
    expect(tutorialPages[tutorialPages.length - 1].title).toBe('Ready to start?');
  });
});
