import React from 'react';
import { StyleSheet, View } from 'react-native';
import dayjs from 'dayjs';
import { IconButton, Text } from 'react-native-paper';
import type { MonthKey } from '../models';
import { useAppTheme } from '../theme';

interface MonthFieldProps {
  value: MonthKey;
  onChange: (monthKey: MonthKey) => void;
  label: string;
}

export function MonthField({ value, onChange, label }: MonthFieldProps) {
  const theme = useAppTheme();

  const step = (delta: number) => {
    onChange(dayjs(`${value}-01`).add(delta, 'month').format('YYYY-MM'));
  };

  return (
    <View style={styles.container}>
      <IconButton icon="chevron-left" onPress={() => step(-1)} />
      <View style={styles.value}>
        <Text variant="bodyLarge" style={styles.label}>
          {dayjs(`${value}-01`).format('MMMM YYYY')}
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
          {label}
        </Text>
      </View>
      <IconButton icon="chevron-right" onPress={() => step(1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  value: {
    alignItems: 'center',
    minWidth: 140,
  },
  label: {
    fontWeight: '600',
  },
});