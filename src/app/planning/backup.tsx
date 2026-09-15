import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Dialog, List, Portal, Snackbar, Text as PaperText } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { LoadingScreen } from '../../components/loading-screen';
import { shareBackup, pickBackupFile, restoreFromBackup } from '../../utils/backup';

export default function BackupScreen() {
  const { ready, refresh } = useAppData();
  const [busy, setBusy] = useState(false);
  const [confirmUri, setConfirmUri] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
        <Dialog visible={confirmUri !== null} onDismiss={() => setConfirmUri(null)}>
          <Dialog.Title>Replace current data?</Dialog.Title>
          <Dialog.Content>
            <PaperText variant="bodyMedium">
              All current transactions, months and settings will be replaced with the contents of the
              backup.
            </PaperText>
          </Dialog.Content>
          <Dialog.Actions>
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
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <List.Item
        title=""
        description="Tip: export a backup before testing experimental changes."
        style={styles.tip}
      />

      <Snackbar visible={toast !== null} onDismiss={() => setToast(null)} duration={2500}>
        {toast}
      </Snackbar>
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