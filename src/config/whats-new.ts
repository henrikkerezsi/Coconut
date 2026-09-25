export interface WhatsNewEntry {
  version: string;
  releasedAt: string;
  intro?: string;
  features: string[];
}

export const whatsNew: WhatsNewEntry[] = [
  {
    version: '1.0.3',
    releasedAt: '2026-09-25T00:00:00.000Z',
    intro:
      'The overview screen has been rebuilt around a single question: how are you doing compared ' +
      'to your own plan? Instead of judging you against your allowance, Coconut now measures you ' +
      'against what you decided to spend \u2014 so the numbers finally mean something to you. ' +
      'Two more fixes keep your history honest along the way.',
    features: [
      'A slider on every individual budget, marking how far the month has progressed \u2014 so you can ' +
        'compare how much of the budget is spent against how much of the month is gone',
      'The four main tiles are now Planned Spending, Available (your allowance plus one-off ' +
        'income), Actual Spent and Remaining \u2014 where remaining is your plan minus what you have ' +
        'spent so far, green while you are within the plan and red once you are over it',
      'The savings reserve tile now shows the starting reserve, the planned draw, the draw so far ' +
        '\u2014 green while you are within it, even if it is negative, red once you are over \u2014 and the ' +
        'projected reserve at the end of the month',
      'The "Planned vs Available" tile is gone: comparing your plan to your money is what the new ' +
        'tiles do, better',
      'Subscription charges are now frozen into the month they were charged in, so editing a ' +
        'subscription no longer skews your older statistics',
      'Deleting a fixed expense no longer deletes its past data, so your history and averages ' +
        'stay correct',
    ],
  },
  {
    version: '1.0.2',
    releasedAt: '2026-09-23T00:00:00.000Z',
    intro:
      'This update is about fitting your life more precisely into the plan. Budgets are easier ' +
      'to read and to order, shared expenses finally land in your own budget, and yearly ' +
      'expenses march to the rhythm of your own calendar. There\u2019s a healthy dose of polish too ' +
      '\u2014 a split helper that finishes the math for you, a keyboard that stops covering your ' +
      'fields, and budgets you can tap straight into.',
    features: [
      'The "Available" amount on the overview screen no longer overflows out of its bubble \u2014 ' +
        'it fits neatly and stays readable',
      'Fresh budget colors, picked to be much easier to tell apart at a glance',
      'Budgets can now be reordered, and the new order is mirrored everywhere \u2014 overview, ' +
        'planning and transactions',
      'Shared expenses now support notes and attachments, just like your personal transactions',
      'A shared expense can be assigned to one of your personal budgets, so it shows up in ' +
        'your own planning automatically',
      'Shared expenses stay inside the group\u2019s period \u2014 you can no longer add entries dated ' +
        'outside of it',
      'Yearly expenses follow a flexible time frame, so you decide when the year starts and ends',
      'Subscriptions were retested end to end, and the rough edges that surfaced are fixed',
      '"Add rest" for exact and percentage shares \u2014 one tap fills the last share for you ' +
        'automatically',
      'The keyboard no longer overlays the fields you\u2019re typing into \u2014 the screen scrolls up so ' +
        'you always see what you\u2019re entering',
      'Tap a budget on the overview to see every transaction assigned to it',
      'When planning a budget you now see how much of your allowance remains after expected ' +
        'fixed expenses and your other budgets, in both the default and the current month',
    ],
  },
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