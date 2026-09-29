import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { Button, Card, List, Portal, Text } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { monthLabel } from '../../utils/date';
import { useAppTheme } from '../../theme';
import { StatCard } from '../../components/stat-card';
import { AmountInput } from '../../components/amount-input';
import { AppDialog } from '../../components/app-dialog';
import { LoadingScreen } from '../../components/loading-screen';
import { ScreenToast } from '../../components/screen-toast';

export default function ReserveScreen() {
  const theme = useAppTheme();
  const {
    ready,
    settings,
    currentMonth,
    currentDashboard,
    reserveHistory,
    setInitialReserve,
  } = useAppData();

  const [initialDialog, setInitialDialog] = useState(false);
  const [initialDraft, setInitialDraft] = useState<number | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!ready || !currentMonth || !currentDashboard) {
    return <LoadingScreen />;
  }

  const { reserveProjection: projection } = currentDashboard;
  const symbol = settings.currencySymbol;
  const adjustment = projection.adjustmentCents;

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <View style={styles.statRow}>
        <StatCard
          label="Starting reserve"
          value={projection.startingReserveCents}
          format={(v) => formatCents(v, symbol)}
        />
        <StatCard
          label="Ending reserve"
          value={projection.endingReserveCents}
          format={(v) => formatCents(v, symbol)}
        />
      </View>
      <View style={styles.statRow}>
        <StatCard
          label="Month surplus"
          value={adjustment}
          format={(v) => (v >= 0 ? '+' : '') + formatCents(v, symbol)}
          sub={projection.overspent ? 'Spending above allowance draws the reserve' : 'Unused allowance stays in the reserve'}
          tone={projection.overspent ? 'bad' : 'good'}
        />
      </View>
        <Card mode="elevated" style={styles.card}>
          <Card.Title
            title="Reserve history"
            subtitle="Every automatic adjustment, recorded when a month was closed"
          />
          <Card.Content>
            {reserveHistory.length === 0 ? (
              <Text variant="bodyMedium" style={styles.empty}>
                Nothing recorded yet. Closing a month applies its adjustment and
                writes it here.
              </Text>
            ) : (
              reserveHistory.map((entry) => (
                <List.Item
                  key={entry.id}
                  title={monthLabel(entry.monthKey)}
                  description={entry.direction === 'to-reserve' ? 'Added to the reserve' : 'Drawn from the reserve'}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={entry.direction === 'to-reserve' ? 'arrow-down' : 'arrow-up'}
                    />
                  )}
                  right={() => (
                    <Text
                      variant="bodyLarge"
                      style={{
                        color:
                          entry.direction === 'to-reserve'
                            ? theme.semantic.goodBudget
                            : theme.semantic.overBudget,
                      }}
                    >
                      {`${entry.direction === 'to-reserve' ? '+' : '-'}${formatCents(entry.amountCents, symbol)}`}
                    </Text>
                  )}
                />
              ))
            )}
          </Card.Content>
        </Card>

        <Card mode="elevated" style={styles.card}>
          <Card.Title title="Reserve settings" />
        <Card.Content>
          <List.Item
            title="Initial reserve"
            description="The balance your reserve starts with. Sets this month's starting reserve and the first month when there is no history."
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              setInitialDraft(settings.initialReserveCents);
              setInitialError(null);
              setInitialDialog(true);
            }}
          />
        </Card.Content>
      </Card>

      <Portal>
        <AppDialog visible={initialDialog} onDismiss={() => setInitialDialog(false)}>
          <AppDialog.Title>Initial reserve</AppDialog.Title>
          <AppDialog.Content>
            <AmountInput
              label="Initial reserve"
              value={initialDraft}
              onChange={setInitialDraft}
              prefix={symbol}
              error={initialError}
            />
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setInitialDialog(false)}>Cancel</Button>
            <Button
              onPress={async () => {
                if (initialDraft === null) {
                  setInitialError('Enter a valid amount.');
                  return;
                }
                if (initialDraft < 0) {
                  setInitialError('Amount cannot be negative.');
                  return;
                }
                setInitialError(null);
                await setInitialReserve(initialDraft);
                setInitialDialog(false);
                setToast('Reserve balance updated');
              }}
            >
              Save
            </Button>
          </AppDialog.Actions>
        </AppDialog>
      </Portal>

      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} duration={2000} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  card: {
    marginBottom: 12,
  },
  empty: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  button: {
    marginTop: 12,
  },
});