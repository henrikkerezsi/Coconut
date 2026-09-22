import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, List, Switch, Text, TextInput } from 'react-native-paper';
import type { Subscription } from '../models';
import type { SubscriptionInput } from '../database/subscriptions';
import { AmountInput } from './amount-input';
import { MonthField } from './month-field';
import { currentMonthKey, EVERGREEN_MONTH_KEY } from '../utils/date';
import { monthlyFromTotal, subscriptionMonths } from '../services/subscription-service';
import { useAppTheme } from '../theme';

interface Props {
  initialData: Subscription | null;
  currencySymbol: string;
  submitting: boolean;
  onSubmit: (draft: SubscriptionInput) => void;
}

export function SubscriptionForm({
  initialData,
  currencySymbol,
  submitting,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [totalAmountCents, setTotalAmountCents] = useState<number | null>(
    initialData?.totalAmountCents ?? null
  );
  const [monthlyAmountCents, setMonthlyAmountCents] = useState<number | null>(
    initialData?.monthlyAmountCents ?? null
  );
  const [startMonth, setStartMonth] = useState(
    initialData?.startMonth ?? currentMonthKey()
  );
  const [endMonth, setEndMonth] = useState(
    initialData?.endMonth && initialData.endMonth !== EVERGREEN_MONTH_KEY
      ? initialData.endMonth
      : currentMonthKey()
  );
  const [deductMonthly, setDeductMonthly] = useState(initialData?.deductMonthly ?? true);
  const [active, setActive] = useState(initialData?.active ?? true);
  const [amountError, setAmountError] = useState<string | null>(null);
  const theme = useAppTheme();

  const hasName = name.trim().length > 0;
  const periodMonths = subscriptionMonths({ startMonth, endMonth });
  const periodValid = endMonth >= startMonth;

  function handleSubmit() {
    setAmountError(null);
    if (!hasName) {
      return;
    }
    if (!periodValid) {
      setAmountError('End month must be after the start month.');
      return;
    }
    if (totalAmountCents === null || totalAmountCents <= 0) {
      setAmountError('Enter a valid total amount.');
      return;
    }
    if (monthlyAmountCents === null || monthlyAmountCents <= 0) {
      setAmountError('Enter a valid monthly amount.');
      return;
    }
    onSubmit({
      name: name.trim(),
      totalAmountCents,
      monthlyAmountCents,
      startMonth,
      endMonth,
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
        label="Total amount"
        value={totalAmountCents}
        onChange={setTotalAmountCents}
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
        title={`Calculate monthly amount for ${periodMonths} ${periodMonths === 1 ? 'month' : 'months'}`}
        description="Split the total amount evenly across the period"
        titleStyle={styles.helperTitle}
        descriptionStyle={styles.helperDescription}
        onPress={() => {
          if (totalAmountCents !== null && periodValid) {
            setMonthlyAmountCents(monthlyFromTotal(totalAmountCents, periodMonths));
          }
        }}
      />

      <List.Subheader style={styles.sectionSubheader}>Timeline</List.Subheader>
      <Text variant="bodyMedium" style={styles.sectionTitle}>Since</Text>
      <MonthField value={startMonth} onChange={setStartMonth} label="Start month" />
      <Text variant="bodyMedium" style={styles.sectionTitle}>Until</Text>
      <MonthField value={endMonth} onChange={setEndMonth} label="End month" />
      {!periodValid ? (
        <Text variant="bodySmall" style={[styles.generalError, { color: theme.colors.error }]}>
          The end month must be on or after the start month.
        </Text>
      ) : null}

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