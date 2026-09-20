import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  HelperText,
  List,
  Switch,
  Text as PaperText,
  TextInput as PaperTextInput,
} from 'react-native-paper';
import dayjs from 'dayjs';
import type { User } from '@supabase/supabase-js';
import type { SyncStatus } from '../models';
import { useAppData } from '../data/DataProvider';
import { LoadingScreen } from '../components/loading-screen';
import { ScreenToast } from '../components/screen-toast';
import { useAppTheme } from '../theme';
import { formatMaskedKey, isValidApiKey, normalizeSupabaseUrl } from '../services/sync-service';
import {
  getSupabaseSessionUser,
  resetClient,
  signInToSupabase,
  signOutOfSupabase,
  signUpToSupabase,
} from '../sync/supabase';
import { syncNow } from '../sync/engine';
import { setMemberDisplayNameForUser } from '../database/sharedSpaces';

function statusLabel(lastSyncStatus: SyncStatus | null): string {
  switch (lastSyncStatus) {
    case 'syncing':
      return 'Syncing…';
    case 'success':
      return 'Last sync succeeded';
    case 'error':
      return 'Last sync failed';
    default:
      return 'Not synced yet';
  }
}

export default function SyncScreen() {
  const { ready, syncState, saveSyncConfig, setSyncEnabled, refresh, settings, setUsername } =
    useAppData();
  const theme = useAppTheme();
  const [urlDraft, setUrlDraft] = useState(syncState.supabaseUrl ?? '');
  const [keyDraft, setKeyDraft] = useState(syncState.apiKey ?? '');
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [usernameDraft, setUsernameDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadSessionUser = useCallback(() => {
    getSupabaseSessionUser().then(setSessionUser).catch(() => setSessionUser(null));
  }, []);

  useEffect(() => {
    loadSessionUser();
  }, [loadSessionUser]);

  if (!ready) {
    return <LoadingScreen />;
  }

  const urlInvalid = urlDraft.trim() !== '' && normalizeSupabaseUrl(urlDraft) === null;
  const keyInvalid = keyDraft.trim() !== '' && !isValidApiKey(keyDraft);
  const canSave =
    urlDraft.trim() !== '' && keyDraft.trim() !== '' && !urlInvalid && !keyInvalid;
  const canEnable = syncState.supabaseUrl !== null && syncState.apiKey !== null;
  const canAuth = canEnable && emailDraft.trim() !== '' && passwordDraft.length >= 6;
  const signedIn = sessionUser !== null;

  async function saveConfig(): Promise<void> {
    setBusy(true);
    try {
      if (await saveSyncConfig(urlDraft, keyDraft)) {
        resetClient();
        setToast('Configuration saved');
      } else {
        setToast('Check your URL and key');
      }
    } catch {
      setToast('Could not save the configuration');
    } finally {
      setBusy(false);
    }
  }

  async function runSyncNow(): Promise<void> {
    setSyncing(true);
    try {
      const outcome = await syncNow();
      await refresh();
      if (outcome) {
        setToast('Sync complete');
      } else {
        setToast('Enable sync and sign in to sync');
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function runSignIn(): Promise<void> {
    setBusy(true);
    try {
      await signInToSupabase(emailDraft.trim(), passwordDraft);
      setPasswordDraft('');
      setSessionUser(await getSupabaseSessionUser());
      setToast('Signed in');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  async function runSignUp(): Promise<void> {
    setBusy(true);
    try {
      await signUpToSupabase(emailDraft.trim(), passwordDraft);
      setPasswordDraft('');
      setSessionUser(await getSupabaseSessionUser());
      setToast('Account created and signed in');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  }

  async function runSignOut(): Promise<void> {
    setBusy(true);
    try {
      await signOutOfSupabase();
      setSessionUser(null);
      setToast('Signed out');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Sign out failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveUsername(): Promise<void> {
    const trimmed = (usernameDraft ?? '').trim();
    const normalized = trimmed === '' ? null : trimmed;
    setBusy(true);
    try {
      await setUsername(normalized);
      if (sessionUser) {
        await setMemberDisplayNameForUser(sessionUser.id, normalized);
      }
      setUsernameDraft(null);
      setToast('Username saved');
    } catch {
      setToast('Could not save the username');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Cloud sync"
          subtitle="Optional — never required"
          style={styles.cardTitle}
        />
        <Card.Content style={styles.cardContent}>
          <PaperText variant="bodyMedium" style={styles.text}>
            Coconut is local-first: the database on this device is the source of truth and the
            app makes no network requests by default. Cloud sync lets you mirror your own data
            to the Supabase project you configure below so your other devices can pull it back.
          </PaperText>
          <PaperText variant="bodySmall" style={styles.hint}>
            Sync is disabled by default and never blocks normal use.
          </PaperText>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title
          title="Status"
          style={styles.cardTitle}
          right={(props) => (
            <List.Icon
              {...props}
              icon={syncState.enabled ? 'cloud-check-outline' : 'cloud-off-outline'}
            />
          )}
        />
        <Card.Content style={styles.cardContent}>
          <List.Item
            title={syncState.enabled ? 'Sync enabled' : 'Sync disabled'}
            description="Cloud sync is off until you turn it on"
            right={() => (
              <View style={styles.statusPill}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: syncState.enabled ? theme.semantic.success : theme.semantic.warning },
                  ]}
                />
              </View>
            )}
          />
          <List.Item
            title={
              signedIn
                ? `Signed in as ${sessionUser.email ?? 'unknown'}`
                : 'Not signed in'
            }
            description={signedIn ? 'Your data syncs under this account' : 'Sign in to sync your data'}
          />
          <List.Item
            title={statusLabel(syncState.lastSyncStatus)}
            description={
              syncState.lastSyncAt
                ? dayjs(syncState.lastSyncAt).format('D MMM YYYY, HH:mm')
                : 'No sync has run yet'
            }
          />
          {syncState.lastSyncError ? (
            <List.Item
              title="Last error"
              description={syncState.lastSyncError}
              descriptionNumberOfLines={6}
              left={(props) => <List.Icon {...props} icon="alert-circle-outline" />}
            />
          ) : null}
          <Button
            mode="contained"
            icon="sync"
            onPress={runSyncNow}
            disabled={syncing || !syncState.enabled || !signedIn}
            loading={syncing}
            style={styles.button}
          >
            Sync now
          </Button>
          <HelperText type="info">Sync now re-uploads your entire database, so any previously missed rows will appear.</HelperText>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Supabase project" style={styles.cardTitle} />
        <Card.Content style={styles.cardContent}>
          <PaperTextInput
            mode="outlined"
            label="Supabase URL"
            value={urlDraft}
            onChangeText={setUrlDraft}
            placeholder="https://xxxx.supabase.co"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={urlInvalid}
            style={styles.input}
          />
          {urlInvalid ? (
            <HelperText type="error">Enter a valid https:// project URL.</HelperText>
          ) : null}
          <PaperTextInput
            mode="outlined"
            label="API key (publishable)"
            value={keyDraft}
            onChangeText={setKeyDraft}
            placeholder="sb_publishable_…"
            autoCapitalize="none"
            autoCorrect={false}
            error={keyInvalid}
            style={styles.input}
          />
          {keyInvalid ? (
            <HelperText type="error">
              Enter the publishable key (or legacy anon key) from your Supabase project.
            </HelperText>
          ) : null}
          {syncState.apiKey && syncState.apiKey !== keyDraft ? (
            <PaperText variant="bodySmall" style={styles.hint}>
              Saved key: {formatMaskedKey(syncState.apiKey)}
            </PaperText>
          ) : null}
          <Button
            mode="contained"
            icon="content-save-outline"
            onPress={saveConfig}
            disabled={busy || !canSave}
            loading={busy}
            style={styles.button}
          >
            Save configuration
          </Button>
          <PaperText variant="bodySmall" style={styles.hint}>
            In Supabase use the Publishable key from Project Settings → API keys. Legacy anon
            keys still work until they are retired in 2026.
          </PaperText>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Account" style={styles.cardTitle} />
        <Card.Content style={styles.cardContent}>
          {signedIn ? (
            <>
              <List.Item
                title={sessionUser.email ?? 'Signed in'}
                description="Data syncs to this Supabase Auth account"
                left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
              />
              <Button
                mode="outlined"
                icon="logout"
                onPress={runSignOut}
                disabled={busy}
                loading={busy}
                style={styles.button}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <PaperTextInput
                mode="outlined"
                label="Email"
                value={emailDraft}
                onChangeText={setEmailDraft}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
              <PaperTextInput
                mode="outlined"
                label="Password"
                value={passwordDraft}
                onChangeText={setPasswordDraft}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <View style={styles.row}>
                <Button
                  mode="contained"
                  icon="login"
                  onPress={runSignIn}
                  disabled={busy || !canAuth}
                  loading={busy}
                  style={styles.flexButton}
                >
                  Sign in
                </Button>
                <Button
                  mode="outlined"
                  icon="account-plus-outline"
                  onPress={runSignUp}
                  disabled={busy || !canAuth}
                  style={styles.flexButton}
                >
                  Create account
                </Button>
              </View>
              <PaperText variant="bodySmall" style={styles.hint}>
                The same account on the same Supabase project lets your devices share data. Email
                confirmation must be enabled or disabled in your Supabase project’s Auth settings.
              </PaperText>
            </>
          )}
        </Card.Content>
      </Card>

      {signedIn ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Title title="Username (optional)" style={styles.cardTitle} />
          <Card.Content style={styles.cardContent}>
            <PaperTextInput
              mode="outlined"
              label="Username"
              value={usernameDraft ?? settings.username ?? ''}
              onChangeText={setUsernameDraft}
              placeholder={sessionUser.email ?? ''}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Button
              mode="contained"
              icon="account-edit-outline"
              onPress={saveUsername}
              disabled={busy}
              loading={busy}
              style={styles.button}
            >
              Save username
            </Button>
            <PaperText variant="bodySmall" style={styles.hint}>
              Shown as your name on shared expenses. Your email is shown instead when no username
              is set.
            </PaperText>
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <List.Item
            title="Enable cloud sync"
            description={
              canEnable
                ? 'Mirror your local data to Supabase and pull changes from your other devices'
                : 'Save a Supabase URL and API key first'
            }
            right={() => (
              <Switch
                value={syncState.enabled}
                disabled={!canEnable}
                onValueChange={(enabled) => {
                  setSyncEnabled(enabled).catch(() => setToast('Could not update sync'));
                }}
              />
            )}
          />
        </Card.Content>
      </Card>

      <PaperText variant="bodySmall" style={styles.footnote}>
        The publishable key is a public client key. Only your own account can read rows in your
        project (row-level security). With sync disabled, nothing leaves this device and no
        network requests are made.
      </PaperText>

      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 12,
  },
  cardTitle: {
    paddingLeft: 24,
    paddingRight: 24,
  },
  cardContent: {
    paddingHorizontal: 24,
  },
  text: {
    marginBottom: 8,
  },
  hint: {
    opacity: 0.6,
    marginTop: 4,
  },
  input: {
    marginBottom: 4,
  },
  button: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  flexButton: {
    flex: 1,
  },
  statusPill: {
    justifyContent: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footnote: {
    opacity: 0.6,
    marginTop: 8,
  },
});