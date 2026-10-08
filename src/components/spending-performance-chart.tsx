import React, { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import dayjs from 'dayjs';
import type { RatingPerformancePoint } from '../database/queries';
import { shortMonthLabel } from '../utils/date';
import { useAppTheme } from '../theme';

interface SpendingPerformanceChartProps {
  points: readonly RatingPerformancePoint[];
}

interface SeriesEntry {
  name: string;
  key: 'regret' | 'neutral' | 'good';
  color: string;
}

const CHART_HEIGHT = 180;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 26;
const PADDING_SIDE = 12;
const DOT_RADIUS = 3.5;
const VALUE_LABEL_LIMIT = 4;

/**
 * A dependency-free line chart of each closed month's share of regret, neutral
 * and good transactions. The three series share a 0–100% vertical scale, so the
 * lines are directly comparable month to month.
 */
export function SpendingPerformanceChart({ points }: SpendingPerformanceChartProps) {
  const theme = useAppTheme();
  const [width, setWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const plotWidth = Math.max(0, width - PADDING_SIDE * 2);
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const scaleY = (value: number) => PADDING_TOP + plotHeight * (1 - value / 100);
  const xFor = (index: number) =>
    points.length === 1
      ? PADDING_SIDE + plotWidth / 2
      : PADDING_SIDE + (plotWidth * index) / (points.length - 1);

  const series: SeriesEntry[] = [
    { name: 'Regret', key: 'regret', color: theme.semantic.error },
    { name: 'Neutral', key: 'neutral', color: theme.colors.outline },
    { name: 'Good', key: 'good', color: theme.semantic.success },
  ];

  if (points.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {width > 0 ? (
        <>
          {series.map((entry, seriesIndex) => {
            const positions = points.map((point, index) => ({
              monthKey: point.monthKey,
              value: point[entry.key],
              x: xFor(index),
              y: scaleY(point[entry.key]),
            }));
            const segments = positions.slice(1).map((position, index) => {
              const from = positions[index];
              const dx = position.x - from.x;
              const dy = position.y - from.y;
              return {
                from,
                to: position,
                length: Math.hypot(dx, dy),
                angle: (Math.atan2(dy, dx) * 180) / Math.PI,
              };
            });
            return (
              <React.Fragment key={entry.key}>
                {segments.map((segment, index) => (
                  <View
                    key={index}
                    style={{
                      position: 'absolute',
                      left: (segment.from.x + segment.to.x) / 2 - segment.length / 2,
                      top: (segment.from.y + segment.to.y) / 2 - LINE_THICKNESS / 2,
                      width: segment.length,
                      height: LINE_THICKNESS,
                      backgroundColor: entry.color,
                      transform: [{ rotate: `${segment.angle}deg` }],
                    }}
                  />
                ))}
                {positions.map((position) => (
                  <View
                    key={position.monthKey}
                    style={[
                      styles.dot,
                      {
                        left: position.x - DOT_RADIUS,
                        top: position.y - DOT_RADIUS,
                        backgroundColor: entry.color,
                      },
                    ]}
                  />
                ))}
                {points.length <= VALUE_LABEL_LIMIT
                  ? positions.map((position) => (
                      <Text
                        key={`${entry.key}-value-${position.monthKey}`}
                        variant="labelSmall"
                        style={[
                          styles.valueLabel,
                          {
                            left: position.x - 40,
                            top: position.y - 20 + (seriesIndex - 1) * 10,
                            color: entry.color,
                          },
                        ]}
                      >
                        {`${position.value}%`}
                      </Text>
                    ))
                  : null}
              </React.Fragment>
            );
          })}
          {points.map((point, index) => (
            <Text
              key={`month-${point.monthKey}`}
              variant="labelSmall"
              style={[styles.monthLabel, { left: xFor(index) - 45, top: CHART_HEIGHT - PADDING_BOTTOM + 2 }]}
              numberOfLines={1}
            >
              {points.length > VALUE_LABEL_LIMIT
                ? dayjs(`${point.monthKey}-01`).format('MMM')
                : shortMonthLabel(point.monthKey)}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const LINE_THICKNESS = 2;

const styles = StyleSheet.create({
  container: {
    height: CHART_HEIGHT,
    width: '100%',
  },
  dot: {
    position: 'absolute',
    width: DOT_RADIUS * 2,
    height: DOT_RADIUS * 2,
    borderRadius: DOT_RADIUS,
  },
  valueLabel: {
    position: 'absolute',
    width: 80,
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