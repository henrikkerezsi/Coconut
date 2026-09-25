import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { useAppTheme } from '../theme';

interface MonthProgressBarProps {
  progress: number;
  monthProgress: number;
  color?: string;
}

/**
 * Spending progress bar with a marker showing how far through the month it
 * already is, so spent amount can be compared against elapsed time.
 */
export function MonthProgressBar({ progress, monthProgress, color }: MonthProgressBarProps) {
  const theme = useAppTheme();
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const clampedMonthProgress = Math.min(Math.max(monthProgress, 0), 1);
  return (
    <View style={styles.track}>
      <ProgressBar progress={clampedProgress} color={color} style={styles.bar} />
      <View
        pointerEvents="none"
        style={[
          styles.marker,
          { left: `${clampedMonthProgress * 100}%`, backgroundColor: theme.colors.onSurface },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 12,
    justifyContent: 'center',
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  marker: {
    position: 'absolute',
    width: 2,
    height: 12,
    marginLeft: -1,
    borderRadius: 1,
    opacity: 0.55,
  },
});
