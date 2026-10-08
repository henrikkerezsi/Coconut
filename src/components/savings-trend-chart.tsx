import React, { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import dayjs from 'dayjs';
import type { MonthKey } from '../models';
import { shortMonthLabel } from '../utils/date';
import { formatSignedCents } from '../utils/currency';
import { useAppTheme } from '../theme';

export interface SavingsTrendPoint {
  monthKey: MonthKey;
  adjustmentCents: number;
}

interface SavingsTrendChartProps {
  points: readonly SavingsTrendPoint[];
  symbol: string;
}

const CHART_HEIGHT = 180;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 26;
const PADDING_SIDE = 12;
const BAR_GAP = 4;
const VALUE_LABEL_LIMIT = 7;

/**
 * A dependency-free bar chart of how the savings reserve moved each closed
 * month: positive adjustments rise above the baseline as savings, negative
 * ones hang below it as draws into a month.
 */
export function SavingsTrendChart({ points, symbol }: SavingsTrendChartProps) {
  const theme = useAppTheme();
  const [width, setWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const plotWidth = Math.max(0, width - PADDING_SIDE * 2);
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  if (points.length === 0) {
    return null;
  }

  const maxPositive = Math.max(0, ...points.map((point) => point.adjustmentCents));
  const maxNegative = Math.min(0, ...points.map((point) => point.adjustmentCents));
  const range = maxPositive - maxNegative;
  const zeroY = range > 0 ? PADDING_TOP + (maxPositive / range) * plotHeight : PADDING_TOP + plotHeight / 2;

  const slotWidth = plotWidth / points.length;
  const barWidth = Math.max(2, slotWidth - BAR_GAP);
  const xFor = (index: number) => PADDING_SIDE + slotWidth * index + (slotWidth - barWidth) / 2;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {width > 0 ? (
        <>
          <View
            style={[
              styles.baseline,
              {
                backgroundColor: theme.colors.outline,
                left: PADDING_SIDE,
                top: zeroY - 0.5,
                width: plotWidth,
              },
            ]}
          />
          {points.map((point, index) => {
            const value = point.adjustmentCents;
            const height = Math.abs((value / (range > 0 ? range : 1)) * plotHeight);
            const x = xFor(index);
            const top = value >= 0 ? zeroY - height : zeroY;
            return (
              <React.Fragment key={point.monthKey}>
                {value !== 0 ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        left: x,
                        top,
                        width: barWidth,
                        height,
                        backgroundColor: value > 0 ? theme.semantic.success : theme.semantic.error,
                      },
                    ]}
                  />
                ) : null}
                {value !== 0 && points.length <= VALUE_LABEL_LIMIT ? (
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.valueLabel,
                      {
                        left: x + barWidth / 2 - 60,
                        top:
                          value >= 0
                            ? top - 18
                            : Math.min(zeroY + height + 4, CHART_HEIGHT - PADDING_BOTTOM - 18),
                      },
                    ]}
                  >
                    {formatSignedCents(value, symbol)}
                  </Text>
                ) : null}
                <Text
                  variant="labelSmall"
                  style={[
                    styles.monthLabel,
                    { left: x + barWidth / 2 - 45, top: CHART_HEIGHT - PADDING_BOTTOM + 2 },
                  ]}
                  numberOfLines={1}
                >
                  {points.length > VALUE_LABEL_LIMIT
                    ? dayjs(`${point.monthKey}-01`).format('MMM')
                    : shortMonthLabel(point.monthKey)}
                </Text>
              </React.Fragment>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CHART_HEIGHT,
    width: '100%',
  },
  baseline: {
    position: 'absolute',
    height: 1,
    opacity: 0.5,
  },
  bar: {
    position: 'absolute',
    borderRadius: 3,
  },
  valueLabel: {
    position: 'absolute',
    width: 120,
    textAlign: 'center',
    opacity: 0.85,
  },
  monthLabel: {
    position: 'absolute',
    width: 90,
    textAlign: 'center',
    opacity: 0.7,
  },
});