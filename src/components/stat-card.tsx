import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

export type Tone = 'neutral' | 'good' | 'bad' | 'attention';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string | null;
  tone?: Tone;
}

const TONE_COLORS: Record<Tone, string> = {
  neutral: '#666666',
  good: '#2e7d32',
  bad: '#c62828',
  attention: '#e65100',
};

export function StatCard({ label, value, sub, tone = 'neutral' }: StatCardProps) {
  const color = TONE_COLORS[tone];
  return (
    <Card mode="contained" style={styles.card}>
      <Card.Content>
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
  label: {
    opacity: 0.7,
    marginBottom: 2,
  },
  sub: {
    opacity: 0.6,
    marginTop: 2,
  },
});