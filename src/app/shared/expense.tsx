import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  HelperText,
  Portal,
  SegmentedButtons,
  Text as PaperText,
  TextInput as PaperTextInput,
} from 'react-native-paper';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import type { User } from '@supabase/supabase-js';
import { AppDialog } from '../../components/app-dialog';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { ScreenToast } from '../../components/screen-toast';
import type {
  SharedExpenseWithSplits,
  SharedPeriod,
  SharedSpaceMember,
  SharedSplitInput,
  SharedSplitMethod,
} from '../../models';
import { DateField } from '../../components/date-field';
import { useAppData } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';
import { formatCents, centsFromString } from '../../utils/currency';
import { DAYJS_STORE_DATE_FORMAT } from '../../utils/date';
import { getSupabaseSessionUser } from '../../sync/supabase';
import { getActiveMembers } from '../../database/sharedSpaces';
import { getOpenPeriod, getPeriod } from '../../database/sharedPeriods';
import {
  createSharedExpense,
  deleteSharedExpense,
  getExpenseWithSplits,
  updateSharedExpense,
} from '../../database/sharedExpenses';
import { reconcileSharedTransactions } from '../../database/sharedLinking';
import { deriveSplitPrefill } from '../../utils/shared-expense-prefill';
import {
  canFillRemaining,
  fillRemainingSplit,
  parsePercentToBasisPoints,
  resolveSplit,
  validateExpense,
} from '../../services/shared-expense-service';

function memberName(member: SharedSpaceMember): string {
  return member.displayName ?? member.email ?? `Member #${member.id}`;
}

function centsToInput(totalCents: number): string {
  return (totalCents / 100).toString();
}

function centsToAmountString(cents: number): string {
  const integer = Math.floor(cents / 100);
  const fraction = cents % 100;
  if (fraction === 0) {
    return `${integer}`;
  }
  if (fraction % 10 === 0) {
    return `${integer}.${Math.floor(fraction / 10)}`;
  }
  return `${integer}.${fraction.toString().padStart(2, '0')}`;
}

function basisPointsToPercentString(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  if (fraction === 0) {
    return `${whole}`;
  }
  if (fraction % 10 === 0) {
    return `${whole}.${Math.floor(fraction / 10)}`;
  }
  return `${whole}.${fraction.toString().padStart(2, '0')}`;
}

export default function SharedExpenseScreen() {
  const params = useLocalSearchParams<{ spaceId: string; id?: string }>();
  const spaceId = Number(params.spaceId);
  const editingId = params.id ? Number(params.id) : null;
  const router = useRouter();
  const { refresh, settings } = useAppData();
  const theme = useAppTheme();

  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [members, setMembers] = useState<SharedSpaceMember[]>([]);
  const [period, setPeriod] = useState<SharedPeriod | null>(null);
  const [expense, setExpense] = useState<SharedExpenseWithSplits | null>(null);
  const [editable, setEditable] = useState(true);
  const [loading, setLoading] = useState(true);

  const [description, setDescription] = useState('');
  const [total, setTotal] = useState('');
  const [date, setDate] = useState(dayjs().format(DAYJS_STORE_DATE_FORMAT));
  const [paidBy, setPaidBy] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<SharedSplitMethod>('equal');
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [exact, setExact] = useState<Record<number, string>>({});
  const [percent, setPercent] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const user = await getSupabaseSessionUser();
    setSessionUser(user);
    const active = await getActiveMembers(spaceId);
    setMembers(active);
    setPeriod(await getOpenPeriod(spaceId));

    if (editingId === null) {
      setPaidBy((current) => current ?? active[0]?.id ?? null);
      setSelected(Object.fromEntries(active.map((member) => [member.id, true])));
      setEditable(true);
      setLoading(false);
      return;
    }

    const existing = await getExpenseWithSplits(editingId);
    if (!existing) {
      setToast('This expense could not be found.');
      router.back();
      return;
    }
    setExpense(existing);
    setDescription(existing.expense.description);
    setTotal(centsToInput(existing.expense.totalAmountCents));
    setDate(existing.expense.date);
    setNote(existing.expense.note ?? '');
    setPaidBy(
      active.some((member) => member.id === existing.expense.paidByMemberId)
        ? existing.expense.paidByMemberId
        : (active[0]?.id ?? null)
    );
    const prefill = deriveSplitPrefill(
      active.map((member) => member.id),
      existing.splits
    );
    setMethod(prefill.method);
    setSelected(prefill.selected);
    setExact(prefill.exact);
    setPercent(prefill.percent);
    const expensePeriod = await getPeriod(existing.expense.periodId);
    setPeriod(expensePeriod ?? null);
    setEditable(expensePeriod?.status === 'open');
    setLoading(false);
  }, [spaceId, editingId, router]);

  const loadedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (loadedRef.current) {
        return;
      }
      loadedRef.current = true;
      void load().catch(() => setToast('Could not load this space'));
    }, [load])
  );

  const totalCents = useMemo(() => centsFromString(total) ?? 0, [total]);
  const preview = useMemo(() => {
    const inputs: SharedSplitInput[] = members.map((member) => {
      if (method === 'equal') {
        return { memberId: member.id, selected: selected[member.id] ?? false };
      }
      if (method === 'exact') {
        return { memberId: member.id, amountCents: centsFromString(exact[member.id] ?? '') ?? 0 };
      }
      return {
        memberId: member.id,
        basisPoints: parsePercentToBasisPoints(percent[member.id] ?? '') ?? 0,
      };
    });
    return resolveSplit(method, totalCents, inputs);
  }, [members, method, selected, exact, percent, totalCents]);

  const inputsForRest = useMemo((): SharedSplitInput[] => {
    if (method === 'equal') {
      return [];
    }
    return members.map((member) =>
      method === 'exact'
        ? {
            memberId: member.id,
            amountCents: centsFromString(exact[member.id] ?? '') ?? 0,
          }
        : {
            memberId: member.id,
            basisPoints: parsePercentToBasisPoints(percent[member.id] ?? '') ?? 0,
          }
    );
  }, [members, method, exact, percent]);

  const showAddRest = useMemo(
    () => canFillRemaining(method, totalCents, inputsForRest),
    [method, totalCents, inputsForRest]
  );

  function handleAddRest(): void {
    const result = fillRemainingSplit(method, totalCents, inputsForRest);
    if (!result.ok) {
      setToast(result.error);
      return;
    }
    if (method === 'exact') {
      setExact((current) => ({
        ...current,
        [result.memberId]: centsToAmountString(result.value),
      }));
    } else {
      setPercent((current) => ({
        ...current,
        [result.memberId]: basisPointsToPercentString(result.value),
      }));
    }
  }

  async function handleSave(): Promise<void> {
    if (!sessionUser) {
      setError('Sign in to save a shared expense.');
      return;
    }
    if (!period) {
      setError('This space has no open period.');
      return;
    }
    if (!editable) {
      setError('This expense can no longer be edited.');
      return;
    }
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    const validation = validateExpense({
      totalCents,
      description,
      paidByMemberId: paidBy,
      memberIds: members.map((member) => member.id),
      splits: preview.splits,
      date,
      periodStart: period.startDate,
      today: dayjs().format(DAYJS_STORE_DATE_FORMAT),
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const input = {
        spaceId,
        periodId: expense?.expense.periodId ?? period.id,
        description,
        totalAmountCents: totalCents,
        date,
        paidByMemberId: paidBy as number,
        note: note.trim().length > 0 ? note.trim() : null,
        createdByUserId: sessionUser.id,
      };
      if (expense) {
        await updateSharedExpense(expense.expense.id, input, preview.splits);
      } else {
        await createSharedExpense(input, preview.splits);
      }
      await reconcileSharedTransactions(sessionUser.id);
      await refresh();
      router.back();
    } catch {
      setToast('Could not save the expense');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!sessionUser || !expense) {
      return;
    }
    const id = expense.expense.id;
    setConfirmDelete(false);
    setBusy(true);
    try {
      await deleteSharedExpense(id);
      await reconcileSharedTransactions(sessionUser.id);
      await refresh();
      router.back();
    } catch {
      setToast('Could not delete the expense');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const closedNotice = !editable ? 'This expense belongs to a closed period and can no longer be changed.' : null;

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} keyboardBottomOffset={16}>
      {closedNotice ? (
        <HelperText type="info" visible style={styles.notice}>
          {closedNotice}
        </HelperText>
      ) : null}
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <PaperTextInput
            mode="outlined"
            label="Description"
            value={description}
            onChangeText={setDescription}
            style={styles.input}
            disabled={!editable}
          />
          <PaperTextInput
            mode="outlined"
            label={`Total (${settings.currencySymbol})`}
            value={total}
            onChangeText={setTotal}
            keyboardType="decimal-pad"
            style={styles.input}
            disabled={!editable}
          />
          <DateField
            value={date}
            onChange={setDate}
            disabled={!editable}
            minimumDate={period?.startDate}
            maximumDate={dayjs().format(DAYJS_STORE_DATE_FORMAT)}
          />
          <PaperTextInput
            mode="outlined"
            label="Note"
            value={note}
            onChangeText={setNote}
            style={styles.input}
            disabled={!editable}
          />
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Paid by" />
        <Card.Content style={styles.cardContent}>
          <View style={styles.chips}>
            {members.map((member) => (
              <Chip
                key={member.id}
                selected={paidBy === member.id}
                showSelectedCheck={false}
                onPress={() => setPaidBy(member.id)}
                disabled={!editable}
                style={{
                  backgroundColor: paidBy === member.id ? theme.colors.secondaryContainer : 'transparent',
                }}
              >
                {memberName(member)}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Title title="Split" />
        <Card.Content style={styles.cardContent}>
          <SegmentedButtons
            value={method}
            onValueChange={(value) => setMethod(value as SharedSplitMethod)}
            buttons={[
              { value: 'equal', label: 'Equal', disabled: !editable },
              { value: 'exact', label: 'Exact', disabled: !editable },
              { value: 'percentage', label: 'Percent', disabled: !editable },
            ]}
          />
          <Divider style={styles.divider} />
          {editable && showAddRest ? (
            <View style={styles.restRow}>
              <Button
                mode="outlined"
                compact
                icon="plus"
                onPress={handleAddRest}
              >
                Add rest
              </Button>
            </View>
          ) : null}
          {members.map((member) => {
            const resolved = preview.ok
              ? preview.splits.find((split) => split.memberId === member.id)?.amountCents ?? 0
              : null;
            return (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberName}>
                  <PaperText variant="bodyLarge">{memberName(member)}</PaperText>
                  {resolved !== null ? (
                    <PaperText variant="bodySmall" style={styles.share}>
                      {formatCents(resolved, settings.currencySymbol)}
                    </PaperText>
                  ) : null}
                </View>
                {method === 'equal' ? (
                  <Checkbox
                    status={selected[member.id] ? 'checked' : 'unchecked'}
                    onPress={() =>
                      setSelected((current) => ({ ...current, [member.id]: !current[member.id] }))
                    }
                    disabled={!editable}
                  />
                ) : (
                  <PaperTextInput
                    mode="outlined"
                    dense
                    value={method === 'exact' ? exact[member.id] ?? '' : percent[member.id] ?? ''}
                    onChangeText={(value) =>
                      method === 'exact'
                        ? setExact((current) => ({ ...current, [member.id]: value }))
                        : setPercent((current) => ({ ...current, [member.id]: value }))
                    }
                    keyboardType="decimal-pad"
                    style={styles.splitInput}
                    disabled={!editable}
                  />
                )}
              </View>
            );
          })}
          {!preview.ok ? <HelperText type="info">{preview.error}</HelperText> : null}
        </Card.Content>
      </Card>

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        icon="content-save-outline"
        onPress={() => void handleSave()}
        loading={busy}
        disabled={busy || members.length === 0 || !period || !editable}
        style={styles.button}
      >
        {editable ? 'Save expense' : 'Period closed'}
      </Button>

      {expense ? (
        <Button
          mode="text"
          icon="delete-outline"
          textColor={theme.semantic.delete}
          onPress={() => setConfirmDelete(true)}
          disabled={!editable}
          style={styles.deleteButton}
        >
          Delete expense
        </Button>
      ) : null}

      <Portal>
        <AppDialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <AppDialog.Title>Delete this expense?</AppDialog.Title>
          <AppDialog.Content>
            <PaperText variant="bodyMedium">
              It will be removed from this space for everyone, and the linked transaction will be
              removed from the personal expenses of every member.
            </PaperText>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.semantic.delete}
              loading={busy}
              onPress={() => void handleDelete()}
            >
              Delete
            </Button>
          </AppDialog.Actions>
        </AppDialog>
      </Portal>

      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    marginBottom: 4,
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    paddingHorizontal: 16,
  },
  input: {
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  divider: {
    marginVertical: 8,
  },
  restRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  memberName: {
    flex: 1,
  },
  share: {
    opacity: 0.6,
  },
  splitInput: {
    width: 140,
  },
  button: {
    marginTop: 8,
  },
  deleteButton: {
    marginTop: 4,
  },
});