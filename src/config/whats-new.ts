export interface WhatsNewEntry {
  version: string;
  releasedAt: string;
  intro?: string;
  features: string[];
}

export const whatsNew: WhatsNewEntry[] = [
  {
    version: '1.0.1',
    releasedAt: '2026-09-20T00:00:00.000Z',
    intro:
      'The first update since 1.0 is all about making shared spaces feel right. Shared data now ' +
      'stays current in the background and refreshes the moment you ask for it, and it\u2019s finally ' +
      'easy to step away from a group you\u2019re no longer part of. Along the way we cleared up a few ' +
      'confusing names and fixed a batch of annoyances in shared groups.',
    features: [
      'A manual refresh for shared spaces \u2014 pull down on the shared screen and Coconut reaches ' +
        'out to the group and brings in the very latest expenses',
      'Shared spaces now sync automatically when you open the app, so the latest changes from ' +
        'everyone else are already there before you start',
      '"Category" is now simply "budget" on the transactions screen, matching what these things ' +
        'actually are',
      'Income is now "one-off income" \u2014 a name that says exactly what it is: a one-time addition ' +
        'to what you have available this month',
      'You can leave a shared space whenever you want, with one tap in the group menu \u2014 the group ' +
        'is handed over to the remaining members',
      'Shared expenses can be deleted straight from their edit screen',
      'The shared screen now only lists groups you\u2019re actually a member of \u2014 no more ghosts of ' +
        'spaces you were removed from',
      'The "who paid" selector on a shared expense now reliably highlights the person you picked',
      'Every member\u2019s expenses appear in a shared group now, not only the ones you added yourself',
      'Personal transactions now mirror shared expenses correctly \u2014 when a shared amount changes, ' +
        'your own budget always keeps up',
    ],
  },
  {
    version: '1.0.0',
    releasedAt: '2026-09-20T00:00:00.000Z',
    intro:
      'Coconut hits 1.0 with the biggest change since launch: optional, family-sized budgets. ' +
      'Sync your data to your own Supabase project so it survives across devices \u2014 or team up ' +
      'with other people in a shared space to track common expenses together. Everything stays ' +
      'local and private by default; your own backend is always opt-in.',
    features: [
      'Optional Supabase syncing \u2014 point Coconut at your own Supabase project to back up your ' +
        'data and keep it in sync across Android and the desktop web build. Straight out of the box ' +
        'there is no network: off stays fully offline.',
      'A sync engine that reconciles changes made on any device: edits, new rows and deletions ' +
        'flow in both directions automatically as soon as you are online.',
      'Shared spaces \u2014 two or more people with accounts can track common expenses together, with ' +
        'member roles, email invites and period closing',
      'Linked personal transactions \u2014 your share of a shared expense shows up automatically in ' +
        'your own budget, and stays in sync when the shared amount changes',
      'Closing a shared period produces a report of balances and settled amounts for the whole group',
      'Various bug fixes and stability improvements across the board',
    ],
  },
  {
    version: '0.4.0',
    releasedAt: '2026-09-17T00:00:00.000Z',
    intro:
      'The final update in the 0.3 series. Coconut now writes a month-end summary report for every ' +
      'closed month, walks new users through a quick tutorial and lets you know when a new version ' +
      'is available. Along the way, budgets can be color-coded, transactions are grouped by day and ' +
      'you can browse back through earlier months.',
    features: [
      'Month-end summary report \u2014 closing a month saves a detailed breakdown of fixed expenses, subscriptions, budgets and how the reserve changed',
      'Option to view previous months on the transactions screen',
      'An in-app tutorial that walks you through the app on first launch, replayable from Settings',
      'Automatic new version notifications when a newer release is available',
      'Transactions are grouped by date so it\u2019s easy to see what was spent on a given day',
      'Fixed the initial reserve setting so it actually updates the month\u2019s starting balance',
      'Assign a color to each flexible budget \u2014 transactions tagged with it get a matching icon',
    ],
  },
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