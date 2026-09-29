import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { Appbar } from 'react-native-paper';

import { useAppData } from '../data/DataProvider';
import { monthLabel } from '../utils/date';
import { MonthPlanningEditor } from './month-planning-editor';
import { useAppTheme } from '../theme';

/**
 * The interface a month has to exist for. Settings is deliberately not one of
 * them: the allowance is configured there, and the planning screen links straight
 * to it, so it has to stay reachable while no month is open. Every other route
 * that can be reached from the planning screen hides the overlay and brings it
 * back on return.
 */
const MAIN_ROUTES = ['/', '/transactions', '/statistics', '/shared'];

/**
 * Plans and starts the month the app is waiting for. It covers the main
 * interface until the month exists, because the main interface is built around a
 * month. It is not dismissed by tapping away: it goes away when the user comes
 * back from a screen it sent them to, and only for good once the month is
 * started. Once a month is running, planning it again is the replanning screen
 * in Settings, which the user opens on their own terms.
 *
 * It is a native modal window rather than a Paper Modal: Paper's Modal is a
 * plain view inset by the safe area, which leaves the backdrop showing above and
 * below it. A native modal with translucent system bars covers the whole screen
 * and swallows the hardware back button, so this reads as a page of its own.
 */
export function MonthPlanningOverlay() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { ready, pendingMonthKey, startMonth } = useAppData();

  const visible = ready && pendingMonthKey !== null && MAIN_ROUTES.includes(pathname);

  if (!visible || pendingMonthKey === null) {
    return null;
  }

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, paddingTop: insets.top }]}>
          <Appbar.Header>
            <Appbar.Content title={`Start ${monthLabel(pendingMonthKey)}`} />
          </Appbar.Header>
        </View>
        <MonthPlanningEditor
          monthKey={pendingMonthKey}
          mode="start"
          bottomInset={insets.bottom}
          onCommit={async ({ plans, drawCents }) => {
            await startMonth({ monthKey: pendingMonthKey, budgetPlans: plans, drawCents });
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    // Fills the status bar strip with the header colour so the modal edge is not
    // visible there; the app bar itself keeps its own height.
    elevation: 0,
  },
});
