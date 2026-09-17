export interface WhatsNewEntry {
  version: string;
  releasedAt: string;
  intro?: string;
  features: string[];
}

export const whatsNew: WhatsNewEntry[] = [
  {
    version: '0.3.0',
    releasedAt: '2026-09-17T00:00:00.000Z',
    intro:
      'Additions across the board: yearly subscriptions and one-off income for more realistic ' +
      'planning, a reserve number that is finally intuitive, euro as the default currency, photo ' +
      'attachments on transactions and a more streamlined home screen.',
    features: [
      'Yearly subscriptions — split once-a-year charges into a flat monthly amount, with an optional monthly deduction and a renewal-month reminder',
      'One-off income — bonuses and other additions count toward what is available that month',
      'The reserve adjustment now reads as positive when you save up money (green) and negative when you overspend (red)',
      'Default currency switched to euro (€)',
      'Optional photo attachment on every transaction',
      'A streamlined overview screen with a cleaner structure',
    ],
  },
  {
    version: '0.2.0',
    releasedAt: '2026-09-16T00:00:00.000Z',
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