import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  IconButton,
  List,
  Menu,
  Text as PaperText,
} from 'react-native-paper';
import dayjs from 'dayjs';
import type { SharedPeriodReport, SharedSpace, SharedSpaceMember } from '../models';
import { useAppTheme } from '../theme';
import { sharedMemberName, sharedMemberRoleLabel } from '../utils/shared-members';

export interface SharedHeaderMenuProps {
  spaces: SharedSpace[];
  selectedSpace: SharedSpace | null;
  members: SharedSpaceMember[];
  reports: SharedPeriodReport[];
  pendingInvites: SharedSpaceMember[];
  canInvite: boolean;
  canClosePeriod: boolean;
  busy: boolean;
  onSelectSpace: (space: SharedSpace) => void;
  onCreateSpace: () => void;
  onInvite: () => void;
  onAcceptInvite: (member: SharedSpaceMember) => void;
  onOpenBalances: () => void;
  onOpenReport: (periodId: number) => void;
  onClosePeriod: () => void;
}

type MenuMode = 'spaces' | 'space';

export function SharedHeaderMenu({
  spaces,
  selectedSpace,
  members,
  reports,
  pendingInvites,
  canInvite,
  canClosePeriod,
  busy,
  onSelectSpace,
  onCreateSpace,
  onInvite,
  onAcceptInvite,
  onOpenBalances,
  onOpenReport,
  onClosePeriod,
}: SharedHeaderMenuProps) {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<MenuMode>('spaces');

  const openMenu = () => {
    setMode(selectedSpace ? 'space' : 'spaces');
    setVisible(true);
  };
  const closeMenu = () => setVisible(false);

  const spaceName = (spaceId: number): string =>
    spaces.find((space) => space.id === spaceId)?.name ?? `Space #${spaceId}`;

  return (
    <Menu
      visible={visible}
      onDismiss={closeMenu}
      contentStyle={styles.menuContent}
      anchor={
        <IconButton
          icon="menu"
          iconColor={theme.colors.onSurface}
          onPress={openMenu}
          accessibilityLabel="Shared space menu"
        />
      }
    >
      {mode === 'spaces' ? (
        <>
          <Menu.Item
            leadingIcon="plus"
            title="New shared space"
            disabled={busy}
            onPress={() => {
              closeMenu();
              onCreateSpace();
            }}
          />
          {spaces.length > 0 ? <Divider /> : null}
          {spaces.length === 0 ? (
            <PaperText variant="bodySmall" style={styles.hint}>
              No shared spaces yet.
            </PaperText>
          ) : (
            spaces.map((space) => (
              <Menu.Item
                key={space.id}
                leadingIcon="account-group-outline"
                title={space.name}
                onPress={() => {
                  onSelectSpace(space);
                  setMode('space');
                }}
              />
            ))
          )}
          {pendingInvites.length > 0 ? (
            <>
              <Divider />
              <PaperText variant="labelLarge" style={styles.sectionLabel}>
                Pending invites
              </PaperText>
              {pendingInvites.map((invite) => (
                <List.Item
                  key={invite.id}
                  title={spaceName(invite.spaceId)}
                  description={invite.email ?? undefined}
                  left={(props) => <List.Icon {...props} icon="email-outline" />}
                  right={() => (
                    <Button
                      mode="contained-tonal"
                      compact
                      disabled={busy}
                      onPress={() => onAcceptInvite(invite)}
                    >
                      Accept
                    </Button>
                  )}
                />
              ))}
            </>
          ) : null}
        </>
      ) : selectedSpace ? (
        <>
          <Menu.Item
            leadingIcon="arrow-left"
            title="All spaces"
            onPress={() => setMode('spaces')}
          />
          <Divider />
          <PaperText variant="labelLarge" style={styles.sectionLabel}>
            {selectedSpace.name}
          </PaperText>
          <Menu.Item
            leadingIcon="scale-balance"
            title="Balances"
            onPress={() => {
              closeMenu();
              onOpenBalances();
            }}
          />
          {canInvite ? (
            <Menu.Item
              leadingIcon="account-plus-outline"
              title="Invite by email"
              disabled={busy}
              onPress={() => {
                closeMenu();
                onInvite();
              }}
            />
          ) : null}
          <Divider />
          <PaperText variant="labelLarge" style={styles.sectionLabel}>
            Members
          </PaperText>
          {members.map((member) => (
            <List.Item
              key={member.id}
              title={sharedMemberName(member)}
              description={sharedMemberRoleLabel(member)}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon={member.role === 'owner' ? 'crown-outline' : 'account-outline'}
                />
              )}
            />
          ))}
          {reports.length > 0 ? (
            <>
              <Divider />
              <PaperText variant="labelLarge" style={styles.sectionLabel}>
                Closed periods
              </PaperText>
              {reports.map((entry) => (
                <Menu.Item
                  key={entry.id}
                  leadingIcon="file-document-outline"
                  title={`${dayjs(entry.report.periodStart).format('D MMM')} – ${dayjs(
                    entry.report.periodEnd
                  ).format('D MMM YYYY')}`}
                  onPress={() => {
                    closeMenu();
                    onOpenReport(entry.periodId);
                  }}
                />
              ))}
            </>
          ) : null}
          <View style={styles.closeWrapper}>
            <Button
              mode="contained"
              icon="lock-outline"
              disabled={!canClosePeriod || busy}
              onPress={() => {
                closeMenu();
                onClosePeriod();
              }}
              style={styles.closeButton}
              contentStyle={styles.closeButtonContent}
            >
              Close period
            </Button>
          </View>
        </>
      ) : null}
    </Menu>
  );
}

const styles = StyleSheet.create({
  menuContent: {
    minWidth: 300,
    paddingBottom: 0,
  },
  hint: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    opacity: 0.7,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    opacity: 0.7,
  },
  closeWrapper: {
    marginTop: 8,
  },
  closeButton: {
    borderRadius: 0,
  },
  closeButtonContent: {
    width: '100%',
    paddingVertical: 4,
  },
});
