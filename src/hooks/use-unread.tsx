/**
 * Total unread private messages (including message requests), for the badge on
 * the Messages tab. Updates live as messages arrive or are read.
 */

import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useBlocks } from '@/hooks/use-blocks';
import { useProfile } from '@/hooks/use-profile';
import { fetchInbox } from '@/lib/direct-messages';
import { supabase } from '@/lib/supabase';

const UnreadContext = createContext(0);

export function UnreadProvider({ children }: PropsWithChildren) {
  const { profile } = useProfile();
  const { blockedIds } = useBlocks();
  const userId = profile?.id;

  const [loaded, setLoaded] = useState<{ userId: string; count: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function refresh() {
      try {
        const items = await fetchInbox();
        const count = items.reduce((total, item) => total + item.unread_count, 0);
        if (!cancelled && userId) setLoaded({ userId, count });
      } catch {
        // Keep the last known count.
      }
    }

    refresh();
    const channel = supabase
      .channel(`unread:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // Re-count when the blocked list changes: blocked conversations disappear from the inbox.
  }, [userId, blockedIds]);

  const count = loaded && loaded.userId === userId ? loaded.count : 0;
  return <UnreadContext.Provider value={count}>{children}</UnreadContext.Provider>;
}

export function useUnreadCount() {
  return useContext(UnreadContext);
}
