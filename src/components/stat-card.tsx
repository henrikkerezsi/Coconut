import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAppTheme } from '../theme';

export type Tone = 'neutral' | 'good' | 'bad' | 'attention';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string | null;
  tone?: Tone;
}

export function StatCard({ label, value, sub, tone = 'neutral' }: StatCardProps) {
  const theme = useAppTheme();
  const TONE_COLORS: Record<Tone, string> = {
    neutral: theme.colors.onSurfaceVariant,
    good: theme.semantic.goodBudget,
    bad: theme.semantic.overBudget,
    attention: theme.semantic.warning,
  };
  const color = TONE_COLORS[tone];
  return (
    <Card mode="contained" style={styles.card}>
      <Card.Content style={styles.content}>
        <Text variant="labelMedium" style={styles.label}>
          {label}
        </Text>
        <Text variant="headlineSmall" style={{ color }}>
          {value}
        </Text>
        {sub ? (
          <Text variant="bodySmall" style={styles.sub}>
            {sub}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    opacity: 0.7,
    marginBottom: 2,
  },
  sub: {
    opacity: 0.6,
    marginTop: 2,
  },
});