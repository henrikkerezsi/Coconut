import {
  SHARED_ADAPTERS,
  SHARED_REMOTE_COLUMNS,
  SHARED_REMOTE_TABLES,
} from '../../src/sync/shared-serialize';

describe('shared sync adapters', () => {
  it('only emit remote columns that exist on the shared tables', () => {
    for (const adapter of SHARED_ADAPTERS) {
      const remote = adapter.toRemote(
        Object.fromEntries(adapter.fields.map((field) => [field.local, 1])),
        () => 'resolved-uuid'
      );
      const columns = SHARED_REMOTE_COLUMNS[adapter.remoteTable] ?? [];
      for (const key of Object.keys(remote)) {
        expect(columns).toContain(key);
      }
    }
  });

  it('includes uuid and updated_at on every remote table', () => {
    for (const table of SHARED_REMOTE_TABLES) {
      if (table === 'shared_sync_tombstones') {
        continue;
      }
      expect(SHARED_REMOTE_COLUMNS[table]).toContain('uuid');
      expect(SHARED_REMOTE_COLUMNS[table]).toContain('updated_at');
    }
  });

  it('resolves foreign keys to uuids on push and back to ids on pull', () => {
    const expenses = SHARED_ADAPTERS.find(
      (adapter) => adapter.localTable === 'shared_expenses'
    );
    expect(expenses).toBeDefined();
    const remote = expenses!.toRemote(
      {
        space_id: 7,
        period_id: 9,
        description: 'Rent',
        total_amount_cents: 100000,
        date: '2026-09-01',
        paid_by_member_id: 3,
        note: null,
        created_by_user_id: 'user-1',
        deleted: 0,
      },
      (localField, value) => `${localField}:${value}`
    );
    expect(remote.space_uuid).toBe('space_id:7');
    expect(remote.period_uuid).toBe('period_id:9');
    expect(remote.paid_by_member_uuid).toBe('paid_by_member_id:3');
    expect(remote.deleted).toBe(false);

    const local = expenses!.fromRemote(
      {
        space_uuid: 'space-uuid',
        period_uuid: 'period-uuid',
        description: 'Rent',
        total_amount_cents: 100000,
        date: '2026-09-01',
        paid_by_member_uuid: 'member-uuid',
        note: null,
        created_by_user_id: 'user-1',
        deleted: true,
      },
      (remoteField) => `${remoteField}-id`
    );
    expect(local.space_id).toBe('space_uuid-id');
    expect(local.period_id).toBe('period_uuid-id');
    expect(local.paid_by_member_id).toBe('paid_by_member_uuid-id');
    expect(local.deleted).toBe(1);
  });

  it('leaves nullable foreign keys null', () => {
    const reports = SHARED_ADAPTERS.find(
      (adapter) => adapter.localTable === 'shared_period_reports'
    );
    const remote = reports!.toRemote(
      {
        space_id: 1,
        period_id: 2,
        report_json: '{}',
        closed_at: '2026-10-01T00:00:00.000Z',
        closed_by_member_id: null,
      },
      () => 'should-not-be-used'
    );
    expect(remote.closed_by_member_uuid).toBeNull();
  });
});
