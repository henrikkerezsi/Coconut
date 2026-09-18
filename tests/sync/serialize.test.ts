import type { LocalRow, RemoteRow, SyncTableAdapter } from '../../src/sync/serialize';
import { COMPLETE_ADAPTERS, SYNC_SETTINGS_KEYS } from '../../src/sync/serialize';
import { isRemoteNewer, nowIso, toMillis } from '../../src/sync/time';

describe('time helpers', () => {
  it('produces a parseable ISO timestamp', () => {
    const value = nowIso();
    expect(Number.isNaN(Date.parse(value))).toBe(false);
  });

  it('treats missing timestamps as epoch', () => {
    expect(toMillis(null)).toBe(0);
    expect(toMillis(undefined)).toBe(0);
    expect(toMillis('not-a-date')).toBe(0);
  });

  it('compares local and remote timestamps for last-writer-wins', () => {
    expect(isRemoteNewer('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z')).toBe(true);
    expect(isRemoteNewer('2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false);
    expect(isRemoteNewer('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false);
    expect(isRemoteNewer(null, '2026-01-01T00:00:00.000Z')).toBe(true);
  });
});

describe('row serialization', () => {
  function adapterFor(table: string): SyncTableAdapter {
    const adapter = COMPLETE_ADAPTERS.find((a) => a.localTable === table);
    if (!adapter) {
      throw new Error(`No adapter for ${table}`);
    }
    return adapter;
  }

  it('covers every sync-facing local table exactly once', () => {
    expect(COMPLETE_ADAPTERS.map((a) => a.localTable).sort()).toEqual([
      'budgets',
      'fixed_expenses',
      'income',
      'month_budgets',
      'month_fixed_expenses',
      'months',
      'reserve_transfers',
      'transactions',
      'yearly_subscriptions',
    ]);
  });

  it('maps boolean flags to remote booleans and back', () => {
    const adapter = adapterFor('budgets');
    const remote = adapter.toRemote(
      { name: 'Food', default_amount_cents: 50000, active: 1, sort_order: 2, color: '#FF0000' },
      () => null
    );
    expect(remote.active).toBe(true);
    expect(remote.name).toBe('Food');

    const local = adapter.fromRemote(
      { name: 'Food', default_amount_cents: 50000, active: true, sort_order: 2, color: '#FF0000' },
      () => null
    );
    expect(local.active).toBe(1);
  });

  it('rewrites budget foreign key on transactions both ways', () => {
    const adapter = adapterFor('transactions');
    const remote = adapter.toRemote(
      {
        month_key: '2026-09',
        date: '2026-09-18',
        amount_cents: 1234,
        budget_id: 7,
        merchant: 'Shop',
        origin_type: null,
        origin_id: null,
      },
      (field, value) => (field === 'budget_id' ? `uuid-${value}` : null)
    );
    expect(remote.budget_uuid).toBe('uuid-7');

    const local = adapter.fromRemote(
      {
        month_key: '2026-09',
        date: '2026-09-18',
        amount_cents: 1234,
        budget_uuid: 'uuid-7',
        merchant: 'Shop',
        note: null,
        origin_type: null,
        origin_id: null,
      },
      (field, uuid) => (field === 'budget_uuid' ? (uuid === 'uuid-7' ? 7 : null) : null)
    );
    expect(local.budget_id).toBe(7);
  });

  it('keeps null foreign keys null', () => {
    const adapter = adapterFor('transactions');
    const remote = adapter.toRemote(
      { budget_id: null },
      () => 'should-not-be-called'
    );
    expect(remote.budget_uuid).toBeNull();
  });

  it('carries month_key through month children without mapping', () => {
    const adapter = adapterFor('income');
    const remote = adapter.toRemote(
      {
        month_key: '2026-09',
        date: '2026-09-10',
        amount_cents: 100000,
        description: 'Salary',
        note: null,
      },
      () => null
    );
    expect(remote.month_key).toBe('2026-09');
  });

  it('round-trips a full month row', () => {
    const adapter = adapterFor('months');
    const remote = adapter.toRemote(
      {
        month_key: '2026-09',
        allowance_cents: 200000,
        starting_reserve_cents: 50000,
        ending_reserve_cents: 42000,
        is_closed: 1,
        closed_at: '2026-09-18T00:00:00Z',
      },
      () => null
    ) as RemoteRow;
    expect(remote.is_closed).toBe(true);

    const local = adapter.fromRemote({ ...remote, uuid: 'u1', updated_at: '2026-09-18T01:00:00Z' }, () => null) as LocalRow;
    expect(local.month_key).toBe('2026-09');
    expect(local.is_closed).toBe(1);
    expect(local.ending_reserve_cents).toBe(42000);
  });

  it('lists the synced settings allowlist without device-local keys', () => {
    expect(SYNC_SETTINGS_KEYS).toEqual([
      'monthly_allowance_cents',
      'initial_reserve_cents',
      'currency_symbol',
      'theme_mode',
      'recent_transactions_count',
      'username',
    ]);
    expect(SYNC_SETTINGS_KEYS as readonly string[]).not.toContain('tutorial_seen');
  });
});