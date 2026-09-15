import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text variant="bodyMedium" style={styles.label}>
        Loading…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 12,
    opacity: 0.6,
  },
});