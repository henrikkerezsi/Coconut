import type { SQLiteDatabase } from 'expo-sqlite';
import type { Settings } from '../models';
import { getDatabase } from './database';

export const DEFAULT_SETTINGS: Settings = {
  monthlyAllowanceCents: 0,
  initialReserveCents: 0,
  currencySymbol: '',
};

type SettingsKey =
  | 'monthly_allowance_cents'
  | 'initial_reserve_cents'
  | 'currency_symbol';

const SETTINGS_KEY_MAP: Record<keyof Settings, SettingsKey> = {
  monthlyAllowanceCents: 'monthly_allowance_cents',
  initialReserveCents: 'initial_reserve_cents',
  currencySymbol: 'currency_symbol',
};

function rowToSettings(
  rows: { key: SettingsKey; value: string }[]
): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    switch (row.key) {
      case 'monthly_allowance_cents':
      case 'initial_reserve_cents':
        settings[
          row.key === 'monthly_allowance_cents'
            ? 'monthlyAllowanceCents'
            : 'initialReserveCents'
        ] = Number(row.value);
        break;
      case 'currency_symbol':
        settings.currencySymbol = row.value;
        break;
    }
  }
  return settings;
}

export async function getSettings(db?: SQLiteDatabase): Promise<Settings> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<{ key: SettingsKey; value: string }>(
    'SELECT key, value FROM settings'
  );
  return rowToSettings(rows);
}

export async function updateSettings(
  patch: Partial<Settings>,
  db?: SQLiteDatabase
): Promise<Settings> {
  const database = db ?? (await getDatabase());
  const current = await getSettings(database);
  const next: Settings = { ...current, ...patch };
  for (const key of Object.keys(next) as (keyof Settings)[]) {
    const dbKey = SETTINGS_KEY_MAP[key];
    const value = String(next[key]);
    await database.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [dbKey, value]
    );
  }
  return next;
}