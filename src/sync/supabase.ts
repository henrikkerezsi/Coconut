import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { getDatabase } from '../database/database';
import { syncMetaAuthStorage } from '../database/syncMeta';
import { getSyncState } from '../database/syncState';

let clientPromise: Promise<SupabaseClient> | null = null;

export class SyncAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncAuthError';
  }
}

export async function getClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const db = await getDatabase();
      const state = await getSyncState(db);
      if (!state.supabaseUrl || !state.apiKey) {
        throw new SyncAuthError('Supabase URL and API key must be configured first.');
      }
      return createClient(state.supabaseUrl, state.apiKey, {
        auth: {
          storage: syncMetaAuthStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 0,
          },
        },
      });
    })();
  }
  return clientPromise;
}

export function resetClient(): void {
  clientPromise = null;
}

export async function signUpToSupabase(
  email: string,
  password: string
): Promise<{ user: User }> {
  const client = await getClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) {
    throw new SyncAuthError(error.message);
  }
  if (!data.session || !data.user) {
    throw new SyncAuthError(
      'Sign-up succeeded but no session returned. You may need to confirm your email.'
    );
  }
  return { user: data.user };
}

export async function signInToSupabase(
  email: string,
  password: string
): Promise<{ user: User }> {
  const client = await getClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new SyncAuthError(error.message);
  }
  return { user: data.user };
}

export async function signOutOfSupabase(): Promise<void> {
  const client = await getClient();
  await client.auth.signOut();
}

export async function getSupabaseSessionUser(): Promise<User | null> {
  try {
    const client = await getClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    return session?.user ?? null;
  } catch {
    return null;
  }
}

export async function getSupabaseUserId(): Promise<string | null> {
  const user = await getSupabaseSessionUser();
  return user?.id ?? null;
}