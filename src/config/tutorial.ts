export interface TutorialPage {
  icon: string;
  title: string;
  body: string;
}

export const tutorialPages: TutorialPage[] = [
  {
    icon: 'sprout-outline',
    title: 'Welcome to Coconut',
    body: 'Your private budget planner. Everything you record stays on this device — no account, ' +
      'no ads, no tracking, and it works fully offline.',
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
    icon: 'rocket-launch-outline',
    title: 'Ready to start?',
    body: 'Set your monthly allowance, plan fixed expenses, create a few budgets, then add your ' +
      'first transaction. You can replay this tour any time from Settings.',
  },
];