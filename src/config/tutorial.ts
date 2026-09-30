export interface TutorialPage {
  icon: string;
  title: string;
  body: string;
}

export const tutorialPages: TutorialPage[] = [
  {
    icon: 'sprout-outline',
    title: 'Welcome to Coconut',
    body: 'Your private budget planner. Everything you record stays on this device by default \u2014 ' +
      'no account, no ads, no tracking. It works fully offline; optional syncing to your own ' +
      'Supabase backend is always opt-in.',
  },
  {
    icon: 'wallet-outline',
    title: 'Allowance & Savings Reserve',
    body: 'Each month you set an allowance you can spend. What you do not spend flows into your ' +
      'savings reserve; what you overspend is covered by it. The Overview shows this at a glance.',
  },
  {
    icon: 'calendar-plus-outline',
    title: 'Starting a Month',
    body: 'A month only comes into existence because you start it — the app never creates one ' +
      'on its own. One screen asks what the coming month looks like: your allowance, the fixed ' +
      'expenses and subscriptions already committed, an amount for each budget, and optionally ' +
      'how much you mean to draw from your savings reserve. The plan is checked against what the ' +
      'month can afford, so you can never plan away money that is not there.',
  },
  {
    icon: 'cash-multiple',
    title: 'Transactions',
    body: 'Record spending in seconds: pick a date, enter the amount, choose a budget and add a ' +
      'note. Coconut remembers your merchants and suggests the matching budget next time.',
  },
  {
    icon: 'tag-multiple-outline',
    title: 'Flexible Budgets',
    body: 'Split discretionary spending into budgets like groceries, eating out or fuel. Each ' +
      'budget shows planned vs actual and lets you know when you are going over.',
  },
  {
    icon: 'calendar-check-outline',
    title: 'Fixed Expenses',
    body: 'Add recurring bills like rent or insurance and they are planned automatically every ' +
      'month. Variable bills can be estimated from previous months and corrected to the real ' +
      'amount once you know it.',
  },
  {
    icon: 'file-document-outline',
    title: 'Closing a Month',
    body: 'Closing the month is the final action. It becomes available shortly before the month ' +
      'ends, asks you to confirm, and warns that it cannot be undone; should you miss the window, ' +
      'the app settles the month for you. Closing records the reserve movement and opens the ' +
      'month\u2019s report: what you spent against fixed expenses, subscriptions and each budget, ' +
      'what every budget started at and what you adjusted it to before closing, the draw as you ' +
      'planned it, and what your savings reserve ended on. Reports are read-only from then on.',
  },
  {
    icon: 'chart-line',
    title: 'Statistics',
    body: 'See averages, spending by budget, budget performance and how your savings reserve ' +
      'develops over time — without any complex spreadsheets.',
  },
  {
    icon: 'cloud-outline',
    title: 'Optional Cloud Sync',
    body: 'The app is fully private and offline by default — nothing ever leaves this device. If ' +
      'you want, you can point Coconut at your own Supabase project to keep your data in sync ' +
      'across devices. Skip your backend, and it stays completely optional: off keeps being ' +
      'fully offline with zero network use. You can skip this entirely.',
  },
  {
    icon: 'account-group-outline',
    title: 'Shared Spaces',
    body: 'Team up with another Coconut user to track common expenses together. Invite them by ' +
      'email, split a shared expense by member, and your share automatically appears in your own ' +
      'personal budget as a linked transaction — always kept in sync when the shared amount ' +
      'changes. Period closing produces a report of balances for the whole group.',
  },
  {
    icon: 'rocket-launch-outline',
    title: 'Ready to start?',
    body: 'Start your first month: set the allowance, bring in your fixed expenses and give each ' +
      'budget a number. Then add your first transaction. When the month is done, close it and read ' +
      'the report. You can replay this tour any time from Settings.',
  },
];
