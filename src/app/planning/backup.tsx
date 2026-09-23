import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { Button, Card, List, Portal, Text as PaperText } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { LoadingScreen } from '../../components/loading-screen';
import { shareBackup, pickBackupFile, restoreFromBackup } from '../../utils/backup';
import { AppDialog } from '../../components/app-dialog';
import { ScreenToast } from '../../components/screen-toast';

export default function BackupScreen() {
  const { ready, refresh } = useAppData();
  const [busy, setBusy] = useState(false);
  const [confirmUri, setConfirmUri] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Export backup" />
        <Card.Content>
          <PaperText variant="bodyMedium" style={styles.text}>
            Creates a single file containing your entire Coconut dataset. Keep it somewhere safe.
            Everything is stored on this device only.
          </PaperText>
          <Button
            mode="contained"
            onPress={async () => {
              setBusy(true);
              try {
                if (await shareBackup()) {
                  setToast('Backup exported');
                } else {
                  setToast('Sharing is not available on this device');
                }
              } catch {
                setToast('Could not create the backup');
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            loading={busy}
            style={styles.button}
            icon="share-variant-outline"
          >
            Export backup
          </Button>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Restore from backup" />
        <Card.Content>
          <PaperText variant="bodyMedium" style={styles.text}>
            Pick a backup file to replace the current data. The restore overwrites everything on this
            device.
          </PaperText>
          <Button
            mode="outlined"
            onPress={async () => {
              setBusy(true);
              try {
                const file = await pickBackupFile();
                if (file) {
                  setConfirmUri(file.uri);
                }
              } catch {
                setToast('Could not open the file picker');
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            style={styles.button}
            icon="folder-open-outline"
          >
            Choose backup file
          </Button>
        </Card.Content>
      </Card>

      <Portal>
        <AppDialog visible={confirmUri !== null} onDismiss={() => setConfirmUri(null)}>
          <AppDialog.Title>Replace current data?</AppDialog.Title>
          <AppDialog.Content>
            <PaperText variant="bodyMedium">
              All current transactions, months and settings will be replaced with the contents of the
              backup.
            </PaperText>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setConfirmUri(null)}>Cancel</Button>
            <Button
              loading={busy}
              disabled={busy}
              onPress={async () => {
                if (confirmUri === null) {
                  return;
                }
                setBusy(true);
                try {
                  await restoreFromBackup(confirmUri);
                  await refresh();
                  setToast('Backup restored');
                } catch {
                  setToast('The backup could not be restored');
                } finally {
                  setBusy(false);
                  setConfirmUri(null);
                }
              }}
            >
              Restore
            </Button>
          </AppDialog.Actions>
        </AppDialog>
      </Portal>

      <List.Item
        title=""
        description="Tip: export a backup before testing experimental changes."
        style={styles.tip}
      />

      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </KeyboardAwareScrollView>
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
  text: {
    marginBottom: 12,
  },
  button: {
    marginTop: 4,
  },
  tip: {
    marginTop: 8,
  },
});