import React from 'react';
import { Button, Text } from 'react-native-paper';
import { AppDialog } from './app-dialog';

interface UpdateAvailableDialogProps {
  visible: boolean;
  version: string;
  onOpen: () => void;
  onClose: () => void;
  onIgnore: () => void;
}

export function UpdateAvailableDialog({
  visible,
  version,
  onOpen,
  onClose,
  onIgnore,
}: UpdateAvailableDialogProps) {
  return (
    <AppDialog visible={visible} onDismiss={onClose}>
      <AppDialog.Title>Update available</AppDialog.Title>
      <AppDialog.Content>
        <Text variant="bodyMedium">
          Coconut {version} is available. You are using an older version.
        </Text>
      </AppDialog.Content>
      <AppDialog.Actions>
        <Button onPress={onIgnore}>Ignore</Button>
        <Button onPress={onClose}>Close</Button>
        <Button mode="contained" onPress={onOpen}>
          Open
        </Button>
      </AppDialog.Actions>
    </AppDialog>
  );
}