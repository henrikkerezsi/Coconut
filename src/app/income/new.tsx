import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { IncomeForm } from '../../components/income-form';

export default function NewIncomeScreen() {
  const { settings, addIncome } = useAppData();
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <IncomeForm
        symbol={settings.currencySymbol}
        onSubmit={async (input) => {
          await addIncome(input);
          router.back();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
});