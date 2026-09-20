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
      'across devices)Skip your backend, and it stays completely optional: off keeps being' +
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
    body: 'Set your monthly allowance, plan fixed expenses, create a few budgets, then add your ' +
      'first transaction. You can replay this tour any time from Settings.',
  },
];