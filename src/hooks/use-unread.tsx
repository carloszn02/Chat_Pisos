/**
 * Total unread private messages (including message requests), private group messages,
 * invitations and join requests, for the badge on the Messages tab. Muted chats don't
 * count. Updates live as messages arrive or are read.
 */

import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useBlocks } from '@/hooks/use-blocks';
import { useMutes } from '@/hooks/use-mutes';
import { useProfile } from '@/hooks/use-profile';
import { fetchInbox } from '@/lib/direct-messages';
import { fetchMyPrivateGroups } from '@/lib/private-groups';
import { supabase } from '@/lib/supabase';
import type { InboxItem, PrivateGroupSummary } from '@/types/chat';

const UnreadContext = createContext(0);

export function UnreadProvider({ children }: PropsWithChildren) {
  const { profile } = useProfile();
  const { blockedIds } = useBlocks();
  const userId = profile?.id;

  const { isMuted } = useMutes();
  const [loaded, setLoaded] = useState<{
    userId: string;
    items: InboxItem[];
    groups: PrivateGroupSummary[];
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function refresh() {
      try {
        const [items, groups] = await Promise.all([fetchInbox(), fetchMyPrivateGroups()]);
        if (!cancelled && userId) setLoaded({ userId, items, groups });
      } catch {
        // Keep the last known count.
      }
    }

    refresh();
    const channel = supabase
      .channel(`unread:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        refresh
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refresh)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'private_group_messages' },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'private_group_members' },
        refresh
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // Re-count when the blocked list changes: blocked conversations disappear from the inbox.
  }, [userId, blockedIds]);

  const count =
    loaded && loaded.userId === userId ? unreadTotal(loaded.items, loaded.groups, isMuted) : 0;
  return <UnreadContext.Provider value={count}>{children}</UnreadContext.Provider>;
}

/** Unread messages, pending requests and invitations, leaving out muted chats. */
export function unreadTotal(
  items: InboxItem[],
  groups: PrivateGroupSummary[],
  isMuted: (kind: 'conversation' | 'private_group', id: string) => boolean
): number {
  return (
    items.reduce(
      (total, item) =>
        total +
        (item.is_incoming_request
          ? 1
          : isMuted('conversation', item.id)
            ? 0
            : (item.unread_count ?? 0)),
      0
    ) +
    groups.reduce((total, group) => {
      if (group.my_status === 'invited') return total + 1;
      if (isMuted('private_group', group.id)) return total;
      // "?? 0": a missing number must never turn the total into NaN.
      return total + (group.unread_count ?? 0) + (group.pending_requests ?? 0);
    }, 0)
  );
}

export function useUnreadCount() {
  return useContext(UnreadContext);
}
