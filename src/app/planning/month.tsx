import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text } from 'react-native-paper';

import { useAppData } from '../../data/DataProvider';
import { MonthPlanningEditor } from '../../components/month-planning-editor';
import { LoadingScreen } from '../../components/loading-screen';

/**
 * Re-plans the month that is already running.
 *
 * This is the one place a month's plan is changed after it has started. Changing
 * a budget, or raising how much of the reserve the month plans to draw, happens
 * here as a single explicit action, and what it changed is recorded so that the
 * amount each budget started the month at stays answerable later.
 *
 * The plan itself is the month's, not a draft kept here: leaving without saving
 * changes nothing.
 */
export default function MonthPlanScreen() {
  const router = useRouter();
  const { ready, currentMonth, replanMonth } = useAppData();

  if (!ready) {
    return <LoadingScreen />;
  }

  if (currentMonth === null) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyMedium" style={styles.message}>
          There is no month to plan yet. Start one from the overview.
        </Text>
        <Button onPress={() => router.back()}>Back</Button>
      </View>
    );
  }

  return (
    <MonthPlanningEditor
      monthKey={currentMonth.monthKey}
      mode="replan"
      onCommit={async ({ plans, drawCents }) => {
        await replanMonth({ monthKey: currentMonth.monthKey, plans, drawCents });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    opacity: 0.7,
    paddingBottom: 12,
    textAlign: 'center',
  },
});
