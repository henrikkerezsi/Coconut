import React from 'react';
import { Dialog } from 'react-native-paper';
import { useAppTheme } from '../theme';

export function AppDialog(props: React.ComponentProps<typeof Dialog>) {
  const theme = useAppTheme();
  return <Dialog {...props} style={[{ borderRadius: theme.radii.dialog }, props.style]} />;
}

AppDialog.Title = Dialog.Title;
AppDialog.Content = Dialog.Content;
AppDialog.Actions = Dialog.Actions;