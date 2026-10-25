import { router } from 'expo-router';
import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { useSession } from '@/hooks/use-session';
import { hasSeenTutorial } from '@/lib/tutorial';

export default function TabLayout() {
  const { session } = useSession();
  const userId = session?.user.id;

  // The first time someone reaches the app, show the welcome tutorial (it can be skipped).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    hasSeenTutorial(userId).then((seen) => {
      if (!seen && !cancelled) router.push('/tutorial');
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <AppTabs />;
}
