export interface WhatsNewEntry {
  version: string;
  releasedAt: string;
  intro?: string;
  features: string[];
}

export const whatsNew: WhatsNewEntry[] = [
  {
    version: '0.2.0',
    releasedAt: '',
    features: [
      'Fixed restoring backups — importing works again',
      'UI fixes and consistency improvements',
      'A reformatted About page',
      'A new What\u2019s New section',
      'Animations and a dark theme overhaul',
    ],
  },
  {
    version: '0.1.31',
    releasedAt: '2026-09-16T09:31:35.555Z',
    intro:
      'The first public build of Coconut, a private, offline-first budget app. Each month it ' +
      'compares your allowance against planned fixed expenses and flexible budgets, and it tracks ' +
      'a savings reserve. Everything stays on this device only \u2014 no network, no account, no tracking.',
    features: [
      'Base setup: monthly allowance, fixed expenses, flexible budgets and a savings reserve',
      'A new theming engine',
      'Show the last X transactions on the home screen',
      'An info section in Settings',
    ],
  },
];