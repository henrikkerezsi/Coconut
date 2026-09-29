// Deterministic demo dataset for local testing on a real device.
//
// The rows are only ever INSERTed. Nothing here deletes or rewrites a row that
// the user created, so this can be applied to a device that already holds real
// data. Every demo row is tagged so it is recognizable in the UI, and every row
// that needs to be linked to another row refers to it by a symbolic key that
// `seed-demo-data.mjs` resolves to the id the device assigned.
//
// Money is integer cents throughout, as everywhere else in Coconut.

import { createHash } from 'node:crypto';

export const DEMO_TAG = '[Demo]';

// Stable 32-hex uuids, shaped like the ones the change-capture triggers
// generate, so a re-run produces the same identities.
function demoUuid(name) {
  return createHash('md5').update(`coconut-demo:${name}`).digest('hex');
}

function monthKeyOf(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonth(key, delta) {
  const [year, month] = key.split('-').map(Number);
  const total = year * 12 + (month - 1) + delta;
  return monthKeyOf(Math.floor(total / 12), (total % 12) + 1);
}

function lastDayOf(key) {
  const [year, month] = key.split('-').map(Number);
  return String(daysInMonth(year, month)).padStart(2, '0');
}

/**
 * Splits a total into equal integer shares, handing the indivisible remainder
 * cents to the earlier members so the shares always add back up to the total.
 */
function split(totalCents, memberKeys) {
  const base = Math.floor(totalCents / memberKeys.length);
  let remainder = totalCents - base * memberKeys.length;
  return memberKeys.map((key) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { memberKey: key, amountCents: base + extra };
  });
}

const BUDGETS = [
  { key: 'groceries', name: 'Groceries', planned: 45000 },
  { key: 'dining', name: 'Dining out', planned: 25000 },
  { key: 'transport', name: 'Transport', planned: 18000 },
  { key: 'household', name: 'Household', planned: 20000 },
  { key: 'health', name: 'Health', planned: 12000 },
  { key: 'fun', name: 'Fun', planned: 15000 },
  { key: 'buffer', name: 'Buffer', planned: 5000 },
];

const FIXED_EXPENSES = [
  { key: 'rent', name: 'Rent', expected: 95000, kind: 'fixed', strategy: 'manual' },
  { key: 'internet', name: 'Internet', expected: 2999, kind: 'fixed', strategy: 'manual' },
  { key: 'phone', name: 'Phone', expected: 1999, kind: 'fixed', strategy: 'manual' },
  { key: 'insurance', name: 'Car insurance', expected: 14500, kind: 'fixed', strategy: 'manual' },
  { key: 'gym', name: 'Gym', expected: 2900, kind: 'fixed', strategy: 'manual' },
  { key: 'electricity', name: 'Electricity', expected: 6400, kind: 'variable', strategy: 'average' },
  { key: 'water', name: 'Water', expected: 1850, kind: 'variable', strategy: 'average' },
];

const SUBSCRIPTIONS = [
  { key: 'streaming', name: 'Streaming Plus', total: 10800, monthly: 900 },
  { key: 'cloud', name: 'Cloud storage 2TB', total: 23976, monthly: 1998 },
  { key: 'magazine', name: 'Magazine', total: 6000, monthly: 500 },
];

// [day, merchant, amountCents, budgetKey|null, rating|null, note|null]
const OWN_SPENDING = [
  [1, 'Supermarket', 6230, 'groceries', 'good', 'Weekly shop'],
  [2, 'Bus ticket', 250, 'transport', null, null],
  [3, 'Corner coffee', 450, 'dining', 'regret', 'Third one this week'],
  [4, 'Pharmacy', 1890, 'health', 'good', 'Vitamins'],
  [5, 'Supermarket', 4890, 'groceries', null, null],
  [7, 'Cinema', 1450, 'fun', 'good', null],
  [8, 'Bookshop', 2200, 'fun', null, 'Cookbook'],
  [9, 'Bus ticket', 250, 'transport', null, null],
  [11, 'Supermarket', 5540, 'groceries', null, null],
  [12, 'Restaurant', 4380, 'dining', 'good', 'Anniversary'],
  [14, 'Taxi', 1820, 'transport', 'regret', 'Home from the office party'],
  [15, 'Supermarket', 3990, 'groceries', null, null],
  [16, 'Hardware store', 2740, 'household', null, 'Shelf brackets'],
  [18, 'Gym cafe', 1200, 'health', null, null],
  [19, 'Restaurant', 3120, 'dining', 'regret', 'Went again, same place'],
  [21, 'Supermarket', 6150, 'groceries', null, null],
  [22, 'Museum', 1600, 'fun', 'good', null],
  [24, 'Pharmacy', 2450, 'health', null, null],
  [25, 'Restaurant', 5240, 'dining', 'good', null],
  [26, 'Pet food', 3350, 'household', null, null],
  [27, 'Supermarket', 4590, 'groceries', null, null],
  [28, 'Corner coffee', 480, 'dining', null, null],
  [29, 'Concert tickets', 9500, 'fun', 'good', 'Two seats'],
];

// Spending with no budget attached, to exercise the leftover/uncategorized path.
const OWN_UNBUDGETED = [
  [6, 'Charity donation', 2000, null, 'good', null],
  [17, 'Postage', 750, null, null, null],
];

// A shorter month that is already closed, so history, statistics and the
// closing report have something real to work with.
const CLOSED_SPENDING = [
  [1, 'Supermarket', 5900, 'groceries', 'good', null],
  [2, 'Bus ticket', 250, 'transport', null, null],
  [3, 'Corner coffee', 420, 'dining', null, null],
  [4, 'Supermarket', 4750, 'groceries', null, null],
  [6, 'Cinema', 1450, 'fun', 'good', null],
  [8, 'Restaurant', 3650, 'dining', null, null],
  [9, 'Pharmacy', 1320, 'health', null, null],
  [11, 'Supermarket', 5100, 'groceries', null, null],
  [12, 'Taxi', 1540, 'transport', 'regret', null],
  [14, 'Supermarket', 4380, 'groceries', null, null],
  [16, 'Restaurant', 2980, 'dining', null, null],
  [18, 'Hardware store', 2190, 'household', null, null],
  [20, 'Supermarket', 5640, 'groceries', null, null],
];

const OWN_INCOME = [
  [6, 'Freelance invoice', 120000, 'Design work'],
  [20, 'Sold old monitor', 4500, null],
];

const MEMBERS = [
  { key: 'you', displayName: 'Demo Owner (you)', email: 'demo-owner@example.invalid', role: 'owner', status: 'active' },
  { key: 'alex', displayName: 'Alex Demo', email: 'alex@example.invalid', role: 'member', status: 'active' },
  { key: 'sam', displayName: 'Sam Demo', email: 'sam@example.invalid', role: 'member', status: 'active' },
  { key: 'robin', displayName: 'Robin Demo (invited)', email: 'robin@example.invalid', role: 'member', status: 'pending' },
];

// Members that share each expense. `robin` never appears: the account is still
// pending, so it must not be billed.
const SHARED_EXPENSES = [
  {
    key: 'shared-groceries',
    period: 'open',
    description: 'Big grocery run',
    total: 9360,
    day: 10,
    paidBy: 'you',
    members: ['you', 'alex', 'sam'],
    note: 'Split three ways',
  },
  {
    key: 'shared-internet',
    period: 'open',
    description: 'Internet and utilities',
    total: 15300,
    day: 5,
    paidBy: 'alex',
    members: ['you', 'alex', 'sam'],
    note: 'Router plus power',
  },
  {
    key: 'shared-cleaning',
    period: 'open',
    description: 'Cleaning supplies',
    total: 2300,
    day: 16,
    paidBy: 'sam',
    members: ['alex', 'sam'],
    note: 'You were away that week',
  },
  {
    key: 'shared-dinner',
    period: 'open',
    description: 'Dinner at the Italian place',
    total: 6600,
    day: 19,
    paidBy: 'you',
    members: ['you', 'alex', 'sam'],
    note: null,
  },
  {
    key: 'shared-train',
    period: 'open',
    description: 'Train to the coast',
    total: 3700,
    day: 24,
    paidBy: 'alex',
    members: ['you', 'alex'],
    note: 'Weekend away',
  },
  {
    key: 'shared-last-month',
    period: 'closed',
    description: 'Groceries and household run',
    total: 8700,
    day: 12,
    paidBy: 'you',
    members: ['you', 'alex', 'sam'],
    note: null,
  },
  {
    key: 'shared-last-month-dinner',
    period: 'closed',
    description: 'Birthday dinner',
    total: 9900,
    day: 18,
    paidBy: 'alex',
    members: ['you', 'alex', 'sam'],
    note: 'Sam treated, then split',
  },
];

/**
 * Builds every demo row for the month containing `monthKey`.
 *
 * The returned list is ordered, and each entry names a symbolic `key`. Entries
 * may refer to earlier keys through a `*IdRef` or `*UuidRef` property, which the
 * seeder resolves to the id or uuid the device actually assigned.
 */
export function buildDemoDataset(monthKey) {
  const previous = shiftMonth(monthKey, -1);
  const rows = [];
  const add = (table, row, key) => rows.push({ table, row, key });

  add(
    'months',
    {
      month_key: previous,
      allowance_cents: 240000,
      starting_reserve_cents: 500000,
      ending_reserve_cents: 520000,
      is_closed: 1,
      closed_at: `${previous}-${lastDayOf(previous)}T23:59:59.000Z`,
    },
    `month-${previous}`
  );
  add(
    'months',
    {
      month_key: monthKey,
      allowance_cents: 240000,
      starting_reserve_cents: 520000,
      ending_reserve_cents: null,
      is_closed: 0,
      closed_at: null,
    },
    `month-${monthKey}`
  );

  for (const budget of BUDGETS) {
    add(
      'budgets',
      { name: `${DEMO_TAG} ${budget.name}`, default_amount_cents: budget.planned, active: 1, sort_order: BUDGETS.indexOf(budget) },
      `budget-${budget.key}`
    );
    for (const target of [previous, monthKey]) {
      add(
        'month_budgets',
        { month_key: target, budget_idRef: `budget-${budget.key}`, planned_amount_cents: budget.planned },
        `month-budget-${target}-${budget.key}`
      );
    }
  }

  for (const expense of FIXED_EXPENSES) {
    add(
      'fixed_expenses',
      {
        name: `${DEMO_TAG} ${expense.name}`,
        expected_amount_cents: expense.expected,
        kind: expense.kind,
        recurrence: 'monthly',
        estimation_strategy: expense.strategy,
        average_months: expense.strategy === 'average' ? 3 : null,
        active: 1,
        sort_order: FIXED_EXPENSES.indexOf(expense),
      },
      `fixed-${expense.key}`
    );
    for (const target of [previous, monthKey]) {
      add(
        'month_fixed_expenses',
        { month_key: target, fixed_expense_idRef: `fixed-${expense.key}`, expected_amount_cents: expense.expected },
        `month-fixed-${target}-${expense.key}`
      );
    }
  }

  // The electricity bill for the closed month came in higher than expected, so
  // the report has a real difference to show.
  add(
    'month_fixed_expenses',
    { month_key: previous, fixed_expense_idRef: 'fixed-electricity', expected_amount_cents: 6400, actual_amount_cents: 7150 },
    'month-fixed-closed-electricity-actual'
  );
  add(
    'month_fixed_expenses',
    { month_key: monthKey, fixed_expense_idRef: 'fixed-electricity', expected_amount_cents: 6400, actual_amount_cents: null },
    'month-fixed-open-electricity-pending'
  );

  for (const subscription of SUBSCRIPTIONS) {
    add(
      'yearly_subscriptions',
      {
        name: `${DEMO_TAG} ${subscription.name}`,
        total_amount_cents: subscription.total,
        monthly_amount_cents: subscription.monthly,
        start_month: previous,
        end_month: '9999-12',
        deduct_monthly: 1,
        active: 1,
        sort_order: SUBSCRIPTIONS.indexOf(subscription),
      },
      `subscription-${subscription.key}`
    );
    for (const target of [previous, monthKey]) {
      add(
        'month_subscriptions',
        { month_key: target, subscription_idRef: `subscription-${subscription.key}`, name: `${DEMO_TAG} ${subscription.name}`, amount_cents: subscription.monthly },
        `month-subscription-${target}-${subscription.key}`
      );
    }
  }

  for (const [day, description, amountCents, note] of OWN_INCOME) {
    add(
      'income',
      { month_key: monthKey, date: `${monthKey}-${String(day).padStart(2, '0')}`, amount_cents: amountCents, description: `${DEMO_TAG} ${description}`, note },
      `income-${day}`
    );
  }

  for (const [day, merchant, amountCents, budgetKey, rating, note] of CLOSED_SPENDING) {
    add(
      'transactions',
      {
        month_key: previous,
        date: `${previous}-${String(day).padStart(2, '0')}`,
        amount_cents: amountCents,
        budget_idRef: budgetKey ? `budget-${budgetKey}` : null,
        merchant,
        note,
        rating,
        origin_type: null,
        origin_id: null,
      },
      `tx-closed-${merchant}-${day}`
    );
  }

  // The closed month's reserve movement, exactly as closing it would have written.
  add(
    'reserve_transfers',
    { month_key: previous, amount_cents: 20000, direction: 'to-reserve', note: 'Automatic month close' },
    'transfer-closed'
  );

  const lastDay = daysInMonth(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)));
  for (const [day, merchant, amountCents, budgetKey, rating, note] of OWN_SPENDING) {
    add(
      'transactions',
      {
        month_key: monthKey,
        date: `${monthKey}-${String(Math.min(day, lastDay)).padStart(2, '0')}`,
        amount_cents: amountCents,
        budget_idRef: budgetKey ? `budget-${budgetKey}` : null,
        merchant,
        note,
        rating,
        origin_type: null,
        origin_id: null,
      },
      `tx-${merchant}-${day}`
    );
  }
  for (const [day, merchant, amountCents, budgetKey, rating, note] of OWN_UNBUDGETED) {
    add(
      'transactions',
      {
        month_key: monthKey,
        date: `${monthKey}-${String(Math.min(day, lastDay)).padStart(2, '0')}`,
        amount_cents: amountCents,
        budget_idRef: budgetKey ? `budget-${budgetKey}` : null,
        merchant,
        note,
        rating,
        origin_type: null,
        origin_id: null,
      },
      `tx-${merchant}-${day}`
    );
  }

  add(
    'merchant_suggestions',
    { merchant: 'Supermarket', budget_idRef: 'budget-groceries', use_count: 6, last_used: `${monthKey}-27` },
    'suggest-supermarket'
  );
  add(
    'merchant_suggestions',
    { merchant: 'Restaurant', budget_idRef: 'budget-dining', use_count: 3, last_used: `${monthKey}-25` },
    'suggest-restaurant'
  );
  add(
    'merchant_suggestions',
    { merchant: 'Corner coffee', budget_idRef: 'budget-dining', use_count: 3, last_used: `${monthKey}-28` },
    'suggest-coffee'
  );
  add(
    'merchant_suggestions',
    { merchant: 'Bus ticket', budget_idRef: 'budget-transport', use_count: 2, last_used: `${monthKey}-09` },
    'suggest-bus'
  );
  add(
    'merchant_suggestions',
    { merchant: 'Pharmacy', budget_idRef: 'budget-health', use_count: 2, last_used: `${monthKey}-24` },
    'suggest-pharmacy'
  );

  add(
    'shared_spaces',
    { uuid: demoUuid('space-flat3'), name: `${DEMO_TAG} Flat 3`, owner_user_id: null },
    'space'
  );
  for (const member of MEMBERS) {
    add(
      'shared_space_members',
      {
        uuid: demoUuid(`member-${member.key}`),
        space_idRef: 'space',
        user_id: null,
        email: member.email,
        display_name: member.displayName,
        role: member.role,
        status: member.status,
        joined_at: member.status === 'active' ? `${previous}-01T09:00:00.000Z` : null,
      },
      `member-${member.key}`
    );
  }

  add(
    'shared_periods',
    {
      uuid: demoUuid(`period-${previous}`),
      space_idRef: 'space',
      start_date: `${previous}-01`,
      end_date: `${previous}-${lastDayOf(previous)}`,
      status: 'closed',
    },
    'period-closed'
  );
  add(
    'shared_periods',
    {
      uuid: demoUuid(`period-${monthKey}`),
      space_idRef: 'space',
      start_date: `${monthKey}-01`,
      end_date: null,
      status: 'open',
    },
    'period-open'
  );

  for (const expense of SHARED_EXPENSES) {
    const target = expense.period === 'closed' ? previous : monthKey;
    const lastDayForTarget = daysInMonth(Number(target.slice(0, 4)), Number(target.slice(5, 7)));
    const date = `${target}-${String(Math.min(expense.day, lastDayForTarget)).padStart(2, '0')}`;
    const expenseUuid = demoUuid(expense.key);
    add(
      'shared_expenses',
      {
        uuid: expenseUuid,
        space_idRef: 'space',
        period_idRef: expense.period === 'closed' ? 'period-closed' : 'period-open',
        description: `${DEMO_TAG} ${expense.description}`,
        total_amount_cents: expense.total,
        date,
        paid_by_member_idRef: `member-${expense.paidBy}`,
        note: expense.note,
        created_by_user_id: null,
        deleted: 0,
      },
      `expense-${expense.key}`
    );
    for (const share of split(expense.total, expense.members)) {
      add(
        'shared_expense_splits',
        {
          uuid: demoUuid(`${expense.key}-${share.memberKey}`),
          expense_idRef: `expense-${expense.key}`,
          member_idRef: `member-${share.memberKey}`,
          amount_cents: share.amountCents,
        },
        `split-${expense.key}-${share.memberKey}`
      );
    }

    // The personal mirror of your own share, exactly as the app links it: a
    // transaction on your own month that points back at the shared expense.
    if (expense.members.includes('you')) {
      const myShare = split(expense.total, expense.members).find((s) => s.memberKey === 'you');
      const budgetFor = {
        'shared-groceries': 'groceries',
        'shared-internet': 'household',
        'shared-cleaning': 'household',
        'shared-dinner': 'dining',
        'shared-train': 'transport',
        'shared-last-month': 'groceries',
        'shared-last-month-dinner': 'dining',
      }[expense.key];
      add(
        'transactions',
        {
          month_key: target,
          date,
          amount_cents: myShare.amountCents,
          budget_idRef: budgetFor ? `budget-${budgetFor}` : null,
          merchant: `${DEMO_TAG} ${expense.description}`,
          note: 'Your share, linked to the shared expense',
          // Deliberately unrated: these are the rows the review screen must let
          // the user judge, including the ones that come from a shared expense.
          rating: null,
          origin_type: 'shared',
          origin_id: expenseUuid,
        },
        `tx-shared-${expense.key}`
      );
    }
  }

  return { monthKey, previous, rows, demoUuids: rows.filter((entry) => entry.row.uuid).map((entry) => entry.row.uuid) };
}
