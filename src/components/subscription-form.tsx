import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, List, Switch, Text, TextInput } from 'react-native-paper';
import type { YearlySubscription } from '../models';
import type { YearlySubscriptionInput } from '../database/yearlySubscriptions';
import { AmountInput } from './amount-input';
import { MonthField } from './month-field';
import { currentMonthKey } from '../utils/date';
import { monthlyFromYearly } from '../services/subscription-service';
import { useAppTheme } from '../theme';

interface Props {
  initialData: YearlySubscription | null;
  currencySymbol: string;
  submitting: boolean;
  onSubmit: (draft: YearlySubscriptionInput) => void;
}

export function SubscriptionForm({
  initialData,
  currencySymbol,
  submitting,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [yearlyAmountCents, setYearlyAmountCents] = useState<number | null>(
    initialData?.yearlyAmountCents ?? null
  );
  const [monthlyAmountCents, setMonthlyAmountCents] = useState<number | null>(
    initialData?.monthlyAmountCents ?? null
  );
  const [startedMonth, setStartedMonth] = useState(
    initialData?.startedMonth ?? currentMonthKey()
  );
  const [billingMonth, setBillingMonth] = useState(
    initialData?.billingMonth ?? currentMonthKey()
  );
  const [deductMonthly, setDeductMonthly] = useState(initialData?.deductMonthly ?? true);
  const [active, setActive] = useState(initialData?.active ?? true);
  const [amountError, setAmountError] = useState<string | null>(null);
  const theme = useAppTheme();

  const hasName = name.trim().length > 0;

  function handleSubmit() {
    setAmountError(null);
    if (!hasName) {
      return;
    }
    if (yearlyAmountCents === null || yearlyAmountCents <= 0) {
      setAmountError('Enter a valid yearly amount.');
      return;
    }
    if (monthlyAmountCents === null || monthlyAmountCents <= 0) {
      setAmountError('Enter a valid monthly amount.');
      return;
    }
    onSubmit({
      name: name.trim(),
      yearlyAmountCents,
      monthlyAmountCents,
      startedMonth,
      billingMonth,
      deductMonthly,
      active,
      sortOrder: initialData?.sortOrder ?? 0,
    });
  }

  return (
    <View style={styles.container}>
      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        mode="outlined"
        placeholder="e.g. Streaming service"
        style={styles.field}
      />
      <AmountInput
        label="Yearly amount"
        value={yearlyAmountCents}
        onChange={setYearlyAmountCents}
        prefix={currencySymbol}
        error={amountError}
      />
      <View style={styles.field}>
        <AmountInput
          label="Monthly amount"
          value={monthlyAmountCents}
          onChange={setMonthlyAmountCents}
          prefix={currencySymbol}
        />
      </View>
      <List.Item
        title="Monthly = yearly ÷ 12"
        description="Use the yearly price split evenly by month"
        titleStyle={styles.helperTitle}
        descriptionStyle={styles.helperDescription}
        onPress={() => {
          if (yearlyAmountCents !== null) {
            setMonthlyAmountCents(monthlyFromYearly(yearlyAmountCents));
          }
        }}
      />

      <List.Subheader style={styles.sectionSubheader}>Timeline</List.Subheader>
      <Text variant="bodyMedium" style={styles.sectionTitle}>Since</Text>
      <MonthField value={startedMonth} onChange={setStartedMonth} label="Start month" />
      <Text variant="bodyMedium" style={styles.sectionTitle}>Charged every year in</Text>
      <MonthField value={billingMonth} onChange={setBillingMonth} label="Renewal month" />

      <List.Item
        title="Deduct monthly"
        description="Each month require this amount from what is available"
        right={() => <Switch value={deductMonthly} onValueChange={setDeductMonthly} />}
      />
      <List.Item
        title="Active"
        description="Included in the current month's planning"
        right={() => <Switch value={active} onValueChange={setActive} />}
      />

      <Button
        mode="contained"
        onPress={handleSubmit}
        disabled={submitting}
        loading={submitting}
        style={styles.submit}
      >
        Save
      </Button>
      {!hasName ? (
        <Text variant="bodySmall" style={[styles.generalError, { color: theme.colors.error }]}>
          Enter a name.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  sectionSubheader: {
    paddingHorizontal: 0,
    marginTop: 8,
  },
  sectionTitle: {
    marginTop: 4,
    opacity: 0.7,
  },
  helperTitle: {
    fontSize: 14,
  },
  helperDescription: {
    fontSize: 12,
  },
  submit: {
    marginTop: 8,
  },
  generalError: {
    marginTop: 8,
  },
});