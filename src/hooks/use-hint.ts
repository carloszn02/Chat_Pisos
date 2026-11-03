import { useCallback, useEffect, useState } from 'react';

import { useSession } from '@/hooks/use-session';
import { hasSeenHint, markHintSeen, type HintKey } from '@/lib/hints';

/** Whether a one-time tip should show, and a way to dismiss it for good. */
export function useHint(hint: HintKey) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    void (async () => {
      const seen = await hasSeenHint(userId, hint);
      if (current) setVisible(!seen);
    })();
    return () => {
      current = false;
    };
  }, [userId, hint]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (userId) void markHintSeen(userId, hint);
  }, [userId, hint]);

  return { visible, dismiss };
}
