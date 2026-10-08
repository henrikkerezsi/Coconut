import React, { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import dayjs from 'dayjs';
import type { MonthKey } from '../models';
import { shortMonthLabel } from '../utils/date';
import { formatCents } from '../utils/currency';
import { useAppTheme } from '../theme';

export interface MonthlySpendPoint {
  monthKey: MonthKey;
  valueCents: number;
}

interface MonthlySpendChartProps {
  points: readonly MonthlySpendPoint[];
  medianCents: number;
  symbol: string;
}

const CHART_HEIGHT = 180;
const PADDING_TOP = 32;
const PADDING_BOTTOM = 26;
const PADDING_SIDE = 12;
const DOT_RADIUS = 4;
const DASH_WIDTH = 4;
const DASH_GAP = 6;
const VALUE_LABEL_LIMIT = 7;

/**
 * A dependency-free line chart of spend per month: each point is a dot, adjacent
 * months are joined by a line, and the median is drawn as a dashed reference
 * line. Value labels are shown above points only while the series stays short
 * enough not to crowd the chart.
 */
export function MonthlySpendChart({ points, medianCents, symbol }: MonthlySpendChartProps) {
  const theme = useAppTheme();
  const [width, setWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const plotWidth = Math.max(0, width - PADDING_SIDE * 2);
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const maxValue = points.reduce((max, point) => Math.max(max, point.valueCents), 0);
  const scaleY = (valueCents: number) =>
    PADDING_TOP + plotHeight * (1 - valueCents / (maxValue > 0 ? maxValue : 1));

  if (points.length === 0) {
    return null;
  }

  const positions = points.map((point, index) => ({
    point,
    x:
      points.length === 1
        ? PADDING_SIDE + plotWidth / 2
        : PADDING_SIDE + (plotWidth * index) / (points.length - 1),
    y: scaleY(point.valueCents),
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

  const medianY = scaleY(medianCents);
  const dashCount = Math.max(1, Math.floor(plotWidth / (DASH_WIDTH + DASH_GAP)));

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {width > 0 ? (
        <>
          {segments.map((segment, index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                left: (segment.from.x + segment.to.x) / 2 - segment.length / 2,
                top: (segment.from.y + segment.to.y) / 2 - LINE_THICKNESS / 2,
                width: segment.length,
                height: LINE_THICKNESS,
                backgroundColor: theme.colors.primary,
                transform: [{ rotate: `${segment.angle}deg` }],
              }}
            />
          ))}
          <View
            style={[
              styles.medianLine,
              { left: PADDING_SIDE, top: medianY - 1, width: plotWidth },
            ]}
          >
            {Array.from({ length: dashCount }).map((_, index) => (
              <View
                key={index}
                style={[styles.dash, { backgroundColor: theme.colors.outline }]}
              />
            ))}
          </View>
          {positions.map((position) => (
            <View
              key={position.point.monthKey}
              style={[
                styles.dot,
                {
                  left: position.x - DOT_RADIUS,
                  top: position.y - DOT_RADIUS,
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          ))}
          {points.length <= VALUE_LABEL_LIMIT
            ? positions.map((position) => (
                <Text
                  key={`value-${position.point.monthKey}`}
                  variant="labelSmall"
                  style={[styles.valueLabel, { left: position.x - 40, top: position.y - 20 }]}
                >
                  {formatCents(position.point.valueCents, symbol)}
                </Text>
              ))
            : null}
          {positions.map((position) => (
            <Text
              key={`month-${position.point.monthKey}`}
              variant="labelSmall"
              style={[styles.monthLabel, { left: position.x - 45, top: CHART_HEIGHT - PADDING_BOTTOM + 2 }]}
              numberOfLines={1}
            >
              {points.length > VALUE_LABEL_LIMIT
                ? dayjs(`${position.point.monthKey}-01`).format('MMM')
                : shortMonthLabel(position.point.monthKey)}
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
  medianLine: {
    position: 'absolute',
    height: 2,
    flexDirection: 'row',
    overflow: 'hidden',
    opacity: 0.7,
  },
  dash: {
    width: DASH_WIDTH,
    height: 2,
    marginRight: DASH_GAP,
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