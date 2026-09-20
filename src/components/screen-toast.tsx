import React from 'react';
import { Portal, Snackbar } from 'react-native-paper';

interface ScreenToastProps {
  visible: boolean;
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

export function ScreenToast({
  visible,
  message,
  onDismiss,
  duration = 2500,
}: ScreenToastProps) {
  return (
    <Portal>
      <Snackbar visible={visible} onDismiss={onDismiss} duration={duration}>
        {message}
      </Snackbar>
    </Portal>
  );
}