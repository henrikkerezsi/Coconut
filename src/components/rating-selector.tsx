import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { TRANSACTION_RATINGS, type TransactionRating } from '../models';
import { useAppTheme } from '../theme';

const OPTIONS: { rating: TransactionRating; icon: string; label: string }[] = [
  { rating: 'regret', icon: 'emoticon-sad', label: 'Regret' },
  { rating: 'neutral', icon: 'emoticon-neutral', label: 'Neutral' },
  { rating: 'good', icon: 'emoticon-happy', label: 'Worth it' },
];

interface RatingSelectorProps {
  value: TransactionRating | null;
  onChange: (rating: TransactionRating) => void;
  disabled?: boolean;
  size?: number;
}

/**
 * Compact three-stop rating: regret, neutral and good. An unrated transaction
 * rests on the neutral stop, which is how a purchase counts until judged.
 */
export function RatingSelector({
  value,
  onChange,
  disabled = false,
  size = 22,
}: RatingSelectorProps) {
  const theme = useAppTheme();
  const active: TransactionRating = value ?? 'neutral';
  const colorFor = (rating: TransactionRating): string => {
    if (rating === 'regret') {
      return theme.semantic.overBudget;
    }
    if (rating === 'good') {
      return theme.semantic.goodBudget;
    }
    return theme.colors.onSurfaceVariant;
  };

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map((option, index) => {
        const selected = option.rating === active;
        const color = colorFor(option.rating);
        return (
          <React.Fragment key={option.rating}>
            {index > 0 ? (
              <View
                style={[
                  styles.track,
                  { backgroundColor: theme.colors.outlineVariant },
                ]}
              />
            ) : null}
            <Pressable
              onPress={() => onChange(option.rating)}
              disabled={disabled}
              hitSlop={6}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={option.label}
              testID={`rating-${option.rating}`}
              style={({ pressed }) => [
                styles.stop,
                { borderRadius: theme.radii.pill },
                selected
                  ? { backgroundColor: color, opacity: disabled ? 0.4 : 1 }
                  : {
                      backgroundColor: theme.colors.surfaceVariant,
                      opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
                    },
              ]}
            >
              <MaterialCommunityIcons
                name={option.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                size={size}
                color={selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
              />
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function ratingLabel(rating: TransactionRating | null): string {
  const match = TRANSACTION_RATINGS.indexOf(rating ?? 'neutral');
  return OPTIONS[match]?.label ?? 'Neutral';
}

export function RatingLegend() {
  const theme = useAppTheme();
  return (
    <View style={styles.legend}>
      {OPTIONS.map((option) => (
        <View key={option.rating} style={styles.legendItem}>
          <MaterialCommunityIcons
            name={option.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
            size={14}
            color={
              option.rating === 'regret'
                ? theme.semantic.overBudget
                : option.rating === 'good'
                  ? theme.semantic.goodBudget
                  : theme.colors.onSurfaceVariant
            }
          />
          <Text variant="labelSmall" style={{ color: theme.text.secondary }}>
            {option.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    width: 6,
    height: 2,
  },
  stop: {
    padding: 5,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
