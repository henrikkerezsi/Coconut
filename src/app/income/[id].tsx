import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'react-native-paper';
import type { Income } from '../../models';
import { getIncome } from '../../database/income';
import { useAppData } from '../../data/DataProvider';
import { IncomeForm } from '../../components/income-form';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppTheme } from '../../theme';

export default function EditIncomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings, saveIncome, removeIncome } = useAppData();
  const theme = useAppTheme();
  const router = useRouter();
  const [income, setIncome] = useState<Income | null>(null);

  useEffect(() => {
    getIncome(Number(id)).then((result) => {
      if (result) {
        setIncome(result);
      }
    });
  }, [id]);

  if (!income) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <IncomeForm
        initial={income}
        symbol={settings.currencySymbol}
        onSubmit={async (input) => {
          await saveIncome(income.id, input);
          router.back();
        }}
      />
      <View style={styles.deleteRow}>
        <Button
          mode="text"
          textColor={theme.semantic.delete}
          onPress={() => {
            removeIncome(income.id).then(() => router.back());
          }}
        >
          Delete one-off income
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  deleteRow: {
    alignItems: 'center',
    marginTop: 16,
  },
});