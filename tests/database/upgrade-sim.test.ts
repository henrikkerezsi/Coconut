/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '../../src/database/migrations';

describe('migration upgrade simulation', () => {
  it('migrating an old (v11-era) database produces the new schema', () => {
    const db = new DatabaseSync(':memory:');

    for (const migration of MIGRATIONS.filter((m) => m.id <= 11).sort((a, b) => a.id - b.id)) {
      db.exec(migration.sql);
    }
    db.exec(
      `INSERT INTO yearly_subscriptions (name, yearly_amount_cents, monthly_amount_cents, started_month, billing_month)
       VALUES ('Legacy', 12000, 1000, '2026-01', '2026-06')`
    );

    for (const migration of MIGRATIONS.filter((m) => m.id > 11).sort((a, b) => a.id - b.id)) {
      db.exec(migration.sql);
    }

    const columns = db
      .prepare('PRAGMA table_info(yearly_subscriptions)')
      .all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);

    expect(names).toContain('total_amount_cents');
    expect(names).toContain('start_month');
    expect(names).toContain('end_month');
    expect(names).not.toContain('billing_month');

    db.prepare(
      `INSERT INTO yearly_subscriptions (name, total_amount_cents, monthly_amount_cents, start_month, end_month, deduct_monthly, active, sort_order)
       VALUES ('New', 12000, 1000, '2026-01', '2026-12', 1, 1, 0)`
    ).run();

    expect(
      (db.prepare('SELECT name, end_month FROM yearly_subscriptions').all() as Array<{ name: string; end_month: string }>)[1]
    ).toMatchObject({ name: 'New' });
  });
});