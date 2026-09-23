import React from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { useAppData } from '../../data/DataProvider';
import { IncomeForm } from '../../components/income-form';

export default function NewIncomeScreen() {
  const { settings, addIncome } = useAppData();
  const router = useRouter();

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <IncomeForm
        symbol={settings.currencySymbol}
        onSubmit={async (input) => {
          await addIncome(input);
          router.back();
        }}
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
});