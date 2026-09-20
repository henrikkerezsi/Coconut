import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { releaseInfo } from '../config/release-info';
import { checkForUpdate, type ReleaseInfo } from '../services/update-service';
import {
  getCheckForUpdatesOnStart,
  getIgnoredReleaseVersion,
  setIgnoredReleaseVersion,
} from '../database/updatePrefs';
import { UpdateAvailableDialog } from './update-available-dialog';

export function UpdateNotifier() {
  const [update, setUpdate] = useState<ReleaseInfo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const enabled = await getCheckForUpdatesOnStart();
        if (!enabled) {
          return;
        }
        const ignored = await getIgnoredReleaseVersion();
        const result = await checkForUpdate(releaseInfo.version, ignored);
        if (active && result) {
          setUpdate(result);
          setVisible(true);
        }
      } catch {
        // the check is best-effort; a failure must never break app startup
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const close = useCallback(() => setVisible(false), []);

  const open = useCallback(async () => {
    const url = update?.url;
    setVisible(false);
    if (!url) {
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open the update link.');
    }
  }, [update]);

  const ignore = useCallback(async () => {
    const version = update?.version;
    setVisible(false);
    if (version) {
      await setIgnoredReleaseVersion(version);
    }
  }, [update]);

  return (
    <UpdateAvailableDialog
      visible={visible && update !== null}
      version={update?.version ?? ''}
      onOpen={open}
      onClose={close}
      onIgnore={ignore}
    />
  );
}