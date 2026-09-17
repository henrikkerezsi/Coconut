import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { FAB, List, Text as PaperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { formatCents } from '../../utils/currency';
import { currentMonthKey, monthLabel } from '../../utils/date';
import { LoadingScreen } from '../../components/loading-screen';
import { nextChargeMonth } from '../../services/subscription-service';
import { FadeIn } from '../../components/fade-in';

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { ready, settings, allSubscriptions, currentDashboard } = useAppData();

  if (!ready) {
    return <LoadingScreen />;
  }

  const symbol = settings.currencySymbol;
  const referenceMonth = currentDashboard?.monthKey ?? currentMonthKey();

  return (
    <>
      <FlatList
        data={allSubscriptions}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <FadeIn>
            <List.Item
              title={item.name}
              description={
                item.deductMonthly
                  ? `${formatCents(item.monthlyAmountCents, symbol)} per month · renews ${monthLabel(
                      nextChargeMonth(item, referenceMonth)
                    )}`
                  : `Renews ${monthLabel(nextChargeMonth(item, referenceMonth))}`
              }
              right={(props) => (
                <PaperText {...props} style={styles.rowRight}>
                  {formatCents(item.monthlyAmountCents, symbol)}
                </PaperText>
              )}
              onPress={() => router.push(`/subscription/${item.id}`)}
            />
          </FadeIn>
        )}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<List.Subheader>Yearly subscriptions</List.Subheader>}
        ListEmptyComponent={
          <PaperText variant="bodyMedium" style={styles.empty}>
            No yearly subscriptions yet. Add ones paid once a year to spread them monthly.
          </PaperText>
        }
      />
      <FAB
        icon="plus"
        label="Add"
        style={styles.fab}
        onPress={() => router.push('/subscription/new')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 96,
  },
  empty: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 32,
    paddingHorizontal: 32,
  },
  rowRight: {
    alignSelf: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});