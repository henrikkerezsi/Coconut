import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, List, Portal, SegmentedButtons, Snackbar, TextInput, IconButton } from 'react-native-paper';
import { useAppData } from '../../data/DataProvider';
import { getMonthTransfers } from '../../database/reserve';
import type { ReserveTransfer } from '../../models';
import { formatCents } from '../../utils/currency';
import { StatCard } from '../../components/stat-card';
import { AmountInput } from '../../components/amount-input';
import { LoadingScreen } from '../../components/loading-screen';

export default function ReserveScreen() {
  const {
    ready,
    settings,
    currentMonth,
    currentDashboard,
    setInitialReserve,
    addReserveTransfer,
    removeReserveTransfer,
    closeCurrentMonth,
    reopenCurrentMonth,
  } = useAppData();

  const [transfers, setTransfers] = useState<ReserveTransfer[]>([]);
  const [initialDialog, setInitialDialog] = useState(false);
  const [initialDraft, setInitialDraft] = useState<number | null>(null);
  const [transferDialog, setTransferDialog] = useState(false);
  const [transferAmount, setTransferAmount] = useState<number | null>(null);
  const [transferDirection, setTransferDirection] = useState<'to-reserve' | 'to-month'>('to-reserve');
  const [transferNote, setTransferNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (currentMonth) {
      getMonthTransfers(currentMonth.monthKey).then(setTransfers);
    }
  }, [currentMonth, currentDashboard]);

  if (!ready || !currentMonth || !currentDashboard) {
    return <LoadingScreen />;
  }

  const { reserveProjection: projection } = currentDashboard;
  const symbol = settings.currencySymbol;
  const adjustment = -projection.adjustmentCents;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.statRow}>
        <StatCard label="Starting reserve" value={formatCents(projection.startingReserveCents, symbol)} />
        <StatCard label="Ending reserve" value={formatCents(projection.endingReserveCents, symbol)} />
      </View>
      <View style={styles.statRow}>
        <StatCard
          label="Month surplus"
          value={(adjustment >= 0 ? '+' : '') + formatCents(adjustment, symbol)}
          sub={projection.overspent ? 'Spending above allowance draws the reserve' : 'Unused allowance stays in the reserve'}
          tone={projection.overspent ? 'bad' : 'good'}
        />
      </View>
      <View style={styles.statRow}>
        <StatCard
          label="Net transfers"
          value={(projection.transferNetCents >= 0 ? '+' : '') + formatCents(projection.transferNetCents, symbol)}
          sub="Into the reserve (+) / out to the month (−)"
        />
      </View>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Transfers this month" />
        <Card.Content>
          {transfers.length === 0 ? (
            <List.Item
              title="No transfers yet"
              description="Move money between the reserve and the month when needed."
            />
          ) : (
            transfers.map((transfer) => (
              <List.Item
                key={transfer.id}
                title={`${transfer.direction === 'to-reserve' ? 'To reserve' : 'To month'} · ${formatCents(transfer.amountCents, symbol)}`}
                description={transfer.note ?? ''}
                left={(props) => (
                  <List.Icon {...props} icon={transfer.direction === 'to-reserve' ? 'arrow-collapse-down' : 'arrow-expand-up'} />
                )}
                right={() => (
                  <IconButton
                    icon="close-circle-outline"
                    onPress={() => removeReserveTransfer(transfer.id)}
                  />
                )}
              />
            ))
          )}
          <Button
            mode="outlined"
            onPress={() => {
              setTransferAmount(null);
              setTransferNote('');
              setTransferDirection('to-reserve');
              setTransferDialog(true);
            }}
            style={styles.button}
          >
            Add transfer
          </Button>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Reserve settings" />
        <Card.Content>
          <List.Item
            title="Initial reserve"
            description="The starting reserve balance used when a month has no history."
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              setInitialDraft(settings.initialReserveCents);
              setInitialDialog(true);
            }}
          />
          {currentMonth.isClosed ? (
            <Button
              mode="outlined"
              onPress={async () => {
                await reopenCurrentMonth();
                setToast('Month reopened');
              }}
              style={styles.button}
            >
              Reopen month
            </Button>
          ) : (
            <Button
              mode="contained"
              style={styles.button}
              onPress={async () => {
                await closeCurrentMonth();
                setToast('Month closed and recorded in history');
              }}
            >
              Close month
            </Button>
          )}
        </Card.Content>
      </Card>

      <Portal>
        <Dialog visible={initialDialog} onDismiss={() => setInitialDialog(false)}>
          <Dialog.Title>Initial reserve</Dialog.Title>
          <Dialog.Content>
            <AmountInput
              label="Initial reserve"
              value={initialDraft}
              onChange={setInitialDraft}
              prefix={symbol}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInitialDialog(false)}>Cancel</Button>
            <Button
              onPress={async () => {
                if (initialDraft !== null && initialDraft >= 0) {
                  await setInitialReserve(initialDraft);
                }
                setInitialDialog(false);
              }}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={transferDialog} onDismiss={() => setTransferDialog(false)}>
          <Dialog.Title>Reserve transfer</Dialog.Title>
          <Dialog.Content>
            <SegmentedButtons
              value={transferDirection}
              onValueChange={(value) => setTransferDirection(value as 'to-reserve' | 'to-month')}
              buttons={[
                { value: 'to-reserve', label: 'To reserve' },
                { value: 'to-month', label: 'To month' },
              ]}
              style={styles.field}
            />
            <AmountInput
              label="Amount"
              value={transferAmount}
              onChange={setTransferAmount}
              prefix={symbol}
            />
            <TextInput
              label="Note (optional)"
              value={transferNote}
              onChangeText={setTransferNote}
              mode="outlined"
              style={styles.field}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTransferDialog(false)}>Cancel</Button>
            <Button
              disabled={saving || transferAmount === null || transferAmount < 0}
              loading={saving}
              onPress={async () => {
                if (transferAmount === null) {
                  return;
                }
                setSaving(true);
                try {
                  await addReserveTransfer(transferAmount, transferDirection, transferNote.trim() || null);
                  setTransferDialog(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={toast !== null} onDismiss={() => setToast(null)} duration={2000}>
        {toast}
      </Snackbar>
    </ScrollView>
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
  button: {
    marginTop: 12,
  },
  field: {
    marginBottom: 16,
  },
});