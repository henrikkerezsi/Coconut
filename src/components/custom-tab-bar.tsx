import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { useAppTheme } from '../theme';

const TAB_ICONS: Record<string, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  index: 'home-outline',
  transactions: 'swap-horizontal',
  statistics: 'chart-bar',
  settings: 'cog-outline',
};

function TabItem({
  icon,
  label,
  isFocused,
  onPress,
  onLongPress,
  theme,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const color = isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.tabItem}>
      <View
        style={[
          styles.tabIndicator,
          isFocused && { backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        <MaterialCommunityIcons name={icon} color={color} size={24} />
      </View>
      <Text variant="labelSmall" style={[styles.tabLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CustomTabBar({ state, navigation, descriptors, insets }: BottomTabBarProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          paddingBottom: 8 + insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const rawLabel = options.tabBarLabel ?? options.title ?? route.name;
        const label = typeof rawLabel === 'string' ? rawLabel : route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TabItem
            key={route.key}
            icon={TAB_ICONS[route.name] ?? 'circle-outline'}
            label={label}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicator: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  tabLabel: {
    marginTop: 2,
  },
});