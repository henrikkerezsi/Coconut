import React from 'react';
import dayjs from 'dayjs';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import type { MonthKey } from '../models';

interface MonthSwitcherProps {
  value: MonthKey;
  onChange: (monthKey: MonthKey) => void;
  max?: MonthKey;
}

export function MonthSwitcher({ value, onChange, max }: MonthSwitcherProps) {
  const step = (delta: number) => {
    const next = dayjs(`${value}-01`).add(delta, 'month').format('YYYY-MM');
    if (max && next > max) {
      return;
    }
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <IconButton icon="chevron-left" size={20} onPress={() => step(-1)} />
      <Text variant="labelLarge" style={styles.label}>
        {dayjs(`${value}-01`).format('MMM YYYY')}
      </Text>
      <IconButton
        icon="chevron-right"
        size={20}
        disabled={max !== undefined && value >= max}
        onPress={() => step(1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  label: {
    fontWeight: '600',
  },
});