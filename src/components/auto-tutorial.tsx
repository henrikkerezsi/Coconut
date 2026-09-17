import { useEffect } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';

import { useAppData } from '../data/DataProvider';
import { getTutorialSeen } from '../database/tutorialPrefs';

export function AutoTutorial() {
  const router = useRouter();
  const { ready } = useAppData();
  const navigationState = useRootNavigationState();
  const canNavigate = navigationState?.key != null;

  useEffect(() => {
    if (!ready || !canNavigate) {
      return;
    }
    let active = true;
    void (async () => {
      try {
        const seen = await getTutorialSeen();
        if (active && !seen) {
          router.push('/tutorial');
        }
      } catch {
        // the check is best-effort; never break app startup over the tour
      }
    })();
    return () => {
      active = false;
    };
  }, [ready, canNavigate, router]);

  return null;
}