import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { monthLabel } from '../utils/date';
import { useAppTheme } from '../theme';

interface MonthClosingBannerProps {
  monthKey: string;
  onPress: () => void;
}

/**
 * Shown while a month is in its closing window. Closing is final, so the prompt
 * stays until the month is closed or the window passes.
 */
export function MonthClosingBanner({ monthKey, onPress }: MonthClosingBannerProps) {
  const theme = useAppTheme();
  const onAccent = theme.text.onAccent;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${monthLabel(monthKey)} is coming to an end. Review and close the month.`}
        testID="month-closing-banner"
        style={({ pressed }) => [
          styles.banner,
          {
            backgroundColor: theme.brand.primary.base,
            borderRadius: theme.radii.large,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.text}>
          <Text variant="titleSmall" style={[styles.title, { color: onAccent }]}>
            {monthLabel(monthKey)} is coming to an end
          </Text>
          <Text variant="bodySmall" style={[styles.sub, { color: onAccent }]}>
            Review how the month went, then close it
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={onAccent}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
  },
  sub: {
    opacity: 0.85,
  },
});
