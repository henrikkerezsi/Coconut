import { SCHEMA_SQL } from './schema';

export interface Migration {
  id: number;
  description: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Initial schema',
    sql: SCHEMA_SQL,
  },
  {
    id: 2,
    description: 'Transaction attachments',
    sql: `
ALTER TABLE transactions ADD COLUMN attachment BLOB;
ALTER TABLE transactions ADD COLUMN attachment_name TEXT;
ALTER TABLE transactions ADD COLUMN attachment_mime TEXT;
`,
  },
];