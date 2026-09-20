import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import {
  Button,
  Card,
  FAB,
  HelperText,
  List,
  Portal,
  Searchbar,
  Text,
  TextInput as PaperTextInput,
} from 'react-native-paper';
import dayjs from 'dayjs';
import type { User } from '@supabase/supabase-js';
import type {
  SharedExpenseWithSplits,
  SharedPeriod,
  SharedPeriodReport,
  SharedSpace,
  SharedSpaceMember,
} from '../../models';
import { useAppData } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';
import { formatCents } from '../../utils/currency';
import { DAYJS_STORE_DATE_FORMAT, relativeDayLabel } from '../../utils/date';
import { sharedMemberName } from '../../utils/shared-members';
import { getClient, getSupabaseSessionUser } from '../../sync/supabase';
import { ScreenToast } from '../../components/screen-toast';
import { getSelectedSpaceUuid, setSelectedSpaceUuid } from '../../database/localPreferences';
import {
  acceptInvite,
  addPendingMember,
  createSharedSpace,
  deleteSharedSpace,
  getMySharedSpaces,
  getPendingInvitesForEmail,
  getSharedSpace,
  getSpaceMembers,
  getSpaceMembersIncludingLeft,
  leaveSharedSpace,
  removeSpaceMember,
  renameSharedSpace,
} from '../../database/sharedSpaces';
import { getDatabase } from '../../database/database';
import { closePeriod, ensureOpenPeriod, getOpenPeriod } from '../../database/sharedPeriods';
import {
  getPeriodsWithReports,
  listPeriodExpenses,
  savePeriodReport,
} from '../../database/sharedExpenses';
import { reconcileSharedTransactions } from '../../database/sharedLinking';
import { pullSharedChanges } from '../../sync/shared';
import { syncSharedChanges } from '../../sync/engine';
import { buildPeriodReport } from '../../services/shared-expense-service';
import { SharedHeaderMenu } from '../../components/shared-header-menu';
import { AppDialog } from '../../components/app-dialog';
import { ScreenFade } from '../../components/screen-fade';
import { LoadingScreen } from '../../components/loading-screen';
import { EmptyState } from '../../components/empty-state';

interface ExpenseSection {
  title: string;
  data: SharedExpenseWithSplits[];
}

export default function SharedScreen() {
  const { ready, refresh, settings } = useAppData();
  const theme = useAppTheme();
  const router = useRouter();

  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [members, setMembers] = useState<SharedSpaceMember[]>([]);
  const [period, setPeriod] = useState<SharedPeriod | null>(null);
  const [expenses, setExpenses] = useState<SharedExpenseWithSplits[]>([]);
  const [reports, setReports] = useState<SharedPeriodReport[]>([]);
  const [pending, setPending] = useState<SharedSpaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [removeTarget, setRemoveTarget] = useState<SharedSpaceMember | null>(null);
  const [deleteSpaceOpen, setDeleteSpaceOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const selectedRef = useRef<number | null>(null);

  const loadSpace = useCallback(async (id: number) => {
    setMembers(await getSpaceMembers(id));
    const open = await getOpenPeriod(id);
    setPeriod(open);
    setExpenses(open ? await listPeriodExpenses(open.id) : []);
    setReports(await getPeriodsWithReports(id));
  }, []);

  const reload = useCallback(async () => {
    const user = await getSupabaseSessionUser();
    setSessionUser(user);
    if (!user) {
      setLoading(false);
      return;
    }
    const all = await getMySharedSpaces(user.id);
    setSpaces(all);
    setPending(user.email ? await getPendingInvitesForEmail(user.email) : []);
    const storedUuid = await getSelectedSpaceUuid();
    const preferred =
      selectedRef.current ??
      all.find((space) => space.uuid && space.uuid === storedUuid)?.id ??
      all[0]?.id ??
      null;
    selectedRef.current = preferred;
    setSelectedId(preferred);
    if (preferred) {
      await loadSpace(preferred);
    } else {
      setMembers([]);
      setPeriod(null);
      setExpenses([]);
      setReports([]);
    }
    setLoading(false);
  }, [loadSpace]);

  useFocusEffect(
    useCallback(() => {
      void reload().catch(() => setToast('Could not load shared spaces'));
    }, [reload])
  );

  const handlePullRefresh = useCallback(async (): Promise<void> => {
    setSyncing(true);
    try {
      await syncSharedChanges();
    } catch {
      setToast('Could not sync with the shared space');
    } finally {
      setSyncing(false);
      await reload();
    }
  }, [reload]);

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, sharedMemberName(member)])),
    [members]
  );
  const selectedSpace = spaces.find((space) => space.id === selectedId) ?? null;
  const currentMember = sessionUser
    ? members.find((member) => member.userId === sessionUser.id) ?? null
    : null;
  const myMemberId = currentMember?.id ?? null;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const newestFirst = [...expenses].reverse();
    if (normalized.length === 0) {
      return newestFirst;
    }
    return newestFirst.filter(({ expense }) => {
      const payer = memberNames.get(expense.paidByMemberId) ?? '';
      return (
        expense.description.toLowerCase().includes(normalized) ||
        (expense.note ?? '').toLowerCase().includes(normalized) ||
        payer.toLowerCase().includes(normalized)
      );
    });
  }, [expenses, memberNames, query]);

  const sections = useMemo<ExpenseSection[]>(() => {
    const groups: ExpenseSection[] = [];
    for (const item of filtered) {
      const last = groups[groups.length - 1];
      if (last && last.data[last.data.length - 1].expense.date === item.expense.date) {
        last.data.push(item);
      } else {
        groups.push({ title: relativeDayLabel(item.expense.date), data: [item] });
      }
    }
    return groups;
  }, [filtered]);

  const total = expenses.reduce((sum, { expense }) => sum + expense.totalAmountCents, 0);

  async function selectSpace(space: SharedSpace): Promise<void> {
    selectedRef.current = space.id;
    setSelectedId(space.id);
    await setSelectedSpaceUuid(space.uuid);
    await loadSpace(space.id);
  }

  async function handleCreateSpace(): Promise<void> {
    if (!sessionUser || spaceName.trim().length === 0) {
      return;
    }
    setBusy(true);
    try {
      const id = await createSharedSpace({
        name: spaceName.trim(),
        ownerUserId: sessionUser.id,
        ownerEmail: sessionUser.email ?? null,
        ownerDisplayName: settings.username ?? null,
      });
      await ensureOpenPeriod(id);
      selectedRef.current = id;
      const created = await getSharedSpace(id);
      await setSelectedSpaceUuid(created?.uuid ?? null);
      setCreateOpen(false);
      setSpaceName('');
      await reload();
      await refresh();
    } catch {
      setToast('Could not create the shared space');
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(): Promise<void> {
    if (selectedId === null || inviteEmail.trim().length === 0) {
      return;
    }
    setBusy(true);
    try {
      await addPendingMember(selectedId, inviteEmail.trim());
      setInviteOpen(false);
      setInviteEmail('');
      await loadSpace(selectedId);
      await refresh();
    } catch {
      setToast('Could not send the invite');
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(member: SharedSpaceMember): Promise<void> {
    if (!sessionUser) {
      return;
    }
    setBusy(true);
    try {
      await acceptInvite(member.id, sessionUser.id, settings.username ?? null);
      await ensureOpenPeriod(member.spaceId);
      selectedRef.current = member.spaceId;
      const space = await getSharedSpace(member.spaceId);
      await setSelectedSpaceUuid(space?.uuid ?? null);
      await reconcileSharedTransactions(sessionUser.id);
      await reload();
      await refresh();
    } catch {
      setToast('Could not accept the invite');
    } finally {
      setBusy(false);
    }
  }

  function openRenameSpace(): void {
    if (!selectedSpace) {
      return;
    }
    setRenameName(selectedSpace.name);
    setRenameOpen(true);
  }

  async function handleRenameSpace(): Promise<void> {
    if (selectedId === null || renameName.trim().length === 0) {
      return;
    }
    setBusy(true);
    try {
      await renameSharedSpace(selectedId, renameName.trim());
      setRenameOpen(false);
      await reload();
      await refresh();
    } catch {
      setToast('Could not rename the space');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(): Promise<void> {
    if (selectedId === null || removeTarget === null) {
      return;
    }
    const member = removeTarget;
    setRemoveTarget(null);
    setBusy(true);
    try {
      await removeSpaceMember(member.id);
      await loadSpace(selectedId);
      await refresh();
    } catch {
      setToast('Could not remove the member');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeaveSpace(): Promise<void> {
    if (selectedId === null || myMemberId === null || !sessionUser) {
      return;
    }
    const memberId = myMemberId;
    setLeaveOpen(false);
    setBusy(true);
    try {
      const left = await leaveSharedSpace(memberId, sessionUser.id);
      if (!left) {
        setToast('The owner cannot leave a shared space');
        return;
      }
      selectedRef.current = null;
      await reload();
      await refresh();
    } catch {
      setToast('Could not leave the shared space');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSpace(): Promise<void> {
    if (selectedId === null) {
      return;
    }
    const id = selectedId;
    setDeleteSpaceOpen(false);
    setBusy(true);
    try {
      await deleteSharedSpace(id);
      selectedRef.current = null;
      await reload();
      await refresh();
    } catch {
      setToast('Could not delete the space');
    } finally {
      setBusy(false);
    }
  }

  async function handleClosePeriod(): Promise<void> {
    if (!sessionUser || !selectedSpace || !period) {
      return;
    }
    setBusy(true);
    try {
      // Force a shared-data pull before generating the report so a stale local
      // copy cannot silently omit expenses added by other members. The report
      // is only ever built from the cloud-authoritative shared rows.
      const db = await getDatabase();
      const client = await getClient();
      await pullSharedChanges(client, db);

      const latestSpace = await getSharedSpace(selectedSpace.id);
      const latestMembers = await getSpaceMembersIncludingLeft(selectedSpace.id);
      const latest = await getOpenPeriod(selectedSpace.id);
      if (!latest) {
        setToast('This space has no open period after syncing');
        setCloseOpen(false);
        await loadSpace(selectedSpace.id);
        return;
      }
      if (latest.id !== period.id) {
        setToast('The open period changed on another device — reloading');
        setCloseOpen(false);
        await loadSpace(selectedSpace.id);
        return;
      }
      const latestExpenses = await listPeriodExpenses(latest.id);

      const closedAt = dayjs().toISOString();
      const periodEnd = dayjs().format(DAYJS_STORE_DATE_FORMAT);
      const activeMemberIds = latestMembers
        .filter((member) => member.status === 'active')
        .map((member) => member.id);
      const reportMembers = latestMembers.map((member) => ({
        memberId: member.id,
        uuid: member.uuid,
        displayName: member.displayName,
        email: member.email,
      }));
      const report = buildPeriodReport({
        spaceName: latestSpace?.name ?? selectedSpace.name,
        periodStart: latest.startDate,
        periodEnd,
        closedAt,
        memberIds: activeMemberIds,
        members: reportMembers,
        expenses: latestExpenses.map(({ expense, splits }) => ({
          description: expense.description,
          date: expense.date,
          paidByMemberId: expense.paidByMemberId,
          totalAmountCents: expense.totalAmountCents,
          splits: splits.map((split) => ({
            memberId: split.memberId,
            amountCents: split.amountCents,
          })),
        })),
      });
      const closer = latestMembers.find((member) => member.userId === sessionUser.id) ?? null;
      await savePeriodReport({
        spaceId: selectedSpace.id,
        periodId: latest.id,
        report,
        closedByMemberId: closer?.id ?? null,
      });
      await closePeriod(latest.id, periodEnd);
      await ensureOpenPeriod(selectedSpace.id);
      setCloseOpen(false);
      await loadSpace(selectedSpace.id);
      await refresh();
    } catch {
      setToast('Could not close the period — a pre-close sync is required');
    } finally {
      setBusy(false);
    }
  }

  function openAddExpense(): void {
    if (!selectedSpace) {
      return;
    }
    if (!period) {
      setToast('This space has no open period');
      return;
    }
    router.push({
      pathname: '/shared/expense',
      params: { spaceId: String(selectedSpace.id) },
    });
  }

  if (!ready || loading) {
    return <LoadingScreen />;
  }

  if (!sessionUser) {
    return (
      <View style={styles.centeredContainer}>
        <Card mode="elevated" style={styles.card}>
          <Card.Title title="Shared spaces" subtitle="Optional — requires an account" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.text}>
              Shared spaces let you track common expenses with another Coconut user. Local
              tracking keeps working offline; shared data syncs through the Supabase project you
              configure.
            </Text>
            <Button
              mode="contained"
              icon="cloud-outline"
              onPress={() => router.push('/sync')}
              style={styles.button}
            >
              Set up cloud sync
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <ScreenFade>
      <Tabs.Screen
        options={{
          title: selectedSpace?.name ?? 'Shared',
          tabBarLabel: 'Shared',
          headerRight: () => (
            <SharedHeaderMenu
              spaces={spaces}
              selectedSpace={selectedSpace}
              members={members}
              reports={reports}
              pendingInvites={pending}
              canInvite={currentMember?.role === 'owner'}
              canManage={currentMember?.role === 'owner'}
              canClosePeriod={period !== null && expenses.length > 0}
              busy={busy}
              currentMemberId={myMemberId}
              onSelectSpace={(space) => void selectSpace(space)}
              onCreateSpace={() => setCreateOpen(true)}
              onInvite={() => setInviteOpen(true)}
              onAcceptInvite={(member) => void handleAccept(member)}
              onRenameSpace={openRenameSpace}
              onRemoveMember={(member) => setRemoveTarget(member)}
              onLeaveSpace={() => setLeaveOpen(true)}
              onDeleteSpace={() => setDeleteSpaceOpen(true)}
              onOpenBalances={() => {
                if (selectedSpace) {
                  router.push({
                    pathname: '/shared/balances',
                    params: { spaceId: String(selectedSpace.id) },
                  });
                }
              }}
              onOpenReport={(periodId) =>
                router.push({
                  pathname: '/shared/report/[id]',
                  params: { id: String(periodId) },
                })
              }
              onClosePeriod={() => setCloseOpen(true)}
            />
          ),
        }}
      />

      {selectedSpace ? (
        <View style={styles.container}>
          <Text style={styles.header} variant="titleMedium">
            {expenses.length} expenses
            {expenses.length > 0 ? ` • ${formatCents(total, settings.currencySymbol)}` : ''}
          </Text>
          <Text style={styles.periodLabel} variant="bodySmall">
            {period
              ? `Current period since ${dayjs(period.startDate).format('D MMM YYYY')}`
              : 'No open period'}
          </Text>
          <Searchbar
            placeholder="Search expenses"
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
          <SectionList
            sections={sections}
            keyExtractor={({ expense }) => String(expense.id)}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={syncing}
                onRefresh={() => void handlePullRefresh()}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
                progressBackgroundColor={theme.colors.surface}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon={<Text variant="displaySmall">🧾</Text>}
                message={
                  query.trim().length > 0
                    ? 'No expenses match your search.'
                    : 'No shared expenses yet.'
                }
                actionLabel={query.trim().length > 0 ? undefined : 'Add an expense'}
                onAction={query.trim().length > 0 ? undefined : openAddExpense}
              />
            }
            renderSectionHeader={({ section }) => (
              <Text style={[styles.sectionHeader, { color: theme.text.secondary }]}>
                {`--- ${section.title} ---`}
              </Text>
            )}
            renderItem={({ item }) => {
              const { expense, splits } = item;
              const myShare = splits.find((split) => split.memberId === myMemberId)?.amountCents ?? 0;
              return (
                <List.Item
                  title={expense.description}
                  description={`Paid by ${memberNames.get(expense.paidByMemberId) ?? 'someone'}`}
                  left={(props) => <List.Icon {...props} icon="cash" />}
                  right={() => (
                    <View style={styles.right}>
                      <Text variant="bodyLarge">
                        {formatCents(expense.totalAmountCents, settings.currencySymbol)}
                      </Text>
                      <Text variant="labelSmall" style={styles.shareLabel}>
                        {`Your share ${formatCents(myShare, settings.currencySymbol)}`}
                      </Text>
                    </View>
                  )}
                  style={[styles.row, { borderRadius: theme.radii.medium }]}
                  onPress={
                    period
                      ? () =>
                          router.push({
                            pathname: '/shared/expense',
                            params: {
                              spaceId: String(selectedSpace.id),
                              id: String(expense.id),
                            },
                          })
                      : undefined
                  }
                />
              );
            }}
          />
          <FAB icon="plus" style={styles.fab} onPress={openAddExpense} />
        </View>
      ) : (
        <View style={styles.centeredContainer}>
          <EmptyState
            icon={<Text variant="displaySmall">👥</Text>}
            message={
              spaces.length === 0
                ? 'Create a shared space from the menu to start tracking shared expenses.'
                : 'Choose a shared space from the menu.'
            }
            actionLabel="New shared space"
            onAction={() => setCreateOpen(true)}
          />
        </View>
      )}

      <Portal>
        <AppDialog visible={createOpen} onDismiss={() => setCreateOpen(false)}>
          <AppDialog.Title>New shared space</AppDialog.Title>
          <AppDialog.Content>
            <PaperTextInput
              mode="outlined"
              label="Name"
              value={spaceName}
              onChangeText={setSpaceName}
              autoFocus
            />
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={busy}
              disabled={busy || spaceName.trim().length === 0}
              onPress={() => void handleCreateSpace()}
            >
              Create
            </Button>
          </AppDialog.Actions>
        </AppDialog>

        <AppDialog visible={inviteOpen} onDismiss={() => setInviteOpen(false)}>
          <AppDialog.Title>Invite by email</AppDialog.Title>
          <AppDialog.Content>
            <PaperTextInput
              mode="outlined"
              label="Email"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoFocus
            />
            <HelperText type="info">
              They will see a pending invite after signing in with this email.
            </HelperText>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={busy}
              disabled={busy || inviteEmail.trim().length === 0}
              onPress={() => void handleInvite()}
            >
              Send
            </Button>
          </AppDialog.Actions>
        </AppDialog>

        <AppDialog visible={closeOpen} onDismiss={() => setCloseOpen(false)}>
          <AppDialog.Title>Close this period?</AppDialog.Title>
          <AppDialog.Content>
            <Text variant="bodyMedium">
              This snapshots the balances and opens a new period. Expenses stay visible in the
              report.
            </Text>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setCloseOpen(false)}>Cancel</Button>
            <Button mode="contained" loading={busy} onPress={() => void handleClosePeriod()}>
              Close period
            </Button>
          </AppDialog.Actions>
        </AppDialog>

        <AppDialog
          visible={renameOpen}
          onDismiss={() => setRenameOpen(false)}
          style={{ borderRadius: theme.radii.small }}
        >
          <AppDialog.Title>Rename space</AppDialog.Title>
          <AppDialog.Content>
            <PaperTextInput
              mode="outlined"
              label="Name"
              value={renameName}
              onChangeText={setRenameName}
              autoFocus
            />
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={busy}
              disabled={busy || renameName.trim().length === 0}
              onPress={() => void handleRenameSpace()}
            >
              Save
            </Button>
          </AppDialog.Actions>
        </AppDialog>

        {removeTarget !== null ? (
          <AppDialog
            visible
            onDismiss={() => setRemoveTarget(null)}
            style={{ borderRadius: theme.radii.small }}
          >
            <AppDialog.Title>Remove {sharedMemberName(removeTarget)}?</AppDialog.Title>
            <AppDialog.Content>
              <Text variant="bodyMedium">
                {sharedMemberName(removeTarget)} will lose access to this space on all their
                devices. Their linked personal expenses are kept and become ordinary
                transactions.
              </Text>
            </AppDialog.Content>
            <AppDialog.Actions>
              <Button onPress={() => setRemoveTarget(null)}>Cancel</Button>
              <Button
                mode="contained"
                buttonColor={theme.semantic.delete}
                loading={busy}
                onPress={() => void handleRemoveMember()}
              >
                Remove
              </Button>
            </AppDialog.Actions>
          </AppDialog>
        ) : null}

        <AppDialog
          visible={leaveOpen}
          onDismiss={() => setLeaveOpen(false)}
          style={{ borderRadius: theme.radii.xl }}
        >
          <AppDialog.Title>Leave this space?</AppDialog.Title>
          <AppDialog.Content>
            <Text variant="bodyMedium">
              You will lose access to this space on all your devices. Your linked personal
              expenses are kept and become ordinary transactions. The other members can keep
              managing the space without you.
            </Text>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setLeaveOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.semantic.delete}
              loading={busy}
              onPress={() => void handleLeaveSpace()}
            >
              Leave
            </Button>
          </AppDialog.Actions>
        </AppDialog>

        <AppDialog
          visible={deleteSpaceOpen}
          onDismiss={() => setDeleteSpaceOpen(false)}
          style={{ borderRadius: theme.radii.small }}
        >
          <AppDialog.Title>Delete this space?</AppDialog.Title>
          <AppDialog.Content>
            <Text variant="bodyMedium">
              Everyone loses access and the shared expenses are removed from all devices. Your
              linked personal expenses are kept and become ordinary transactions. This cannot
              be undone.
            </Text>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setDeleteSpaceOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.semantic.delete}
              loading={busy}
              onPress={() => void handleDeleteSpace()}
            >
              Delete
            </Button>
          </AppDialog.Actions>
        </AppDialog>

        </Portal>

      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    opacity: 0.7,
  },
  periodLabel: {
    paddingHorizontal: 16,
    paddingTop: 2,
    opacity: 0.6,
  },
  search: {
    margin: 12,
    marginBottom: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  listContent: {
    paddingBottom: 96,
    flexGrow: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  row: {
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  shareLabel: {
    opacity: 0.6,
    marginTop: 2,
  },
  card: {
    marginBottom: 12,
  },
  text: {
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
